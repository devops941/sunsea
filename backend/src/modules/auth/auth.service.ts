import crypto from "crypto";

import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { authRepository } from "./auth.repository";
import { hashPassword, comparePassword } from "../../utils/hashPassword";
import { generateAccessToken } from "../../utils/generateAccessToken";
import {
  AccessTokenPayload,
  AuthResult,
  AuthTokens,
  LoginDto,
  RegisterDto,
  UserResponseDto,
  ProfileResponseDto,
  UserStatus
} from "../../types/auth.types";

const ACCESS_TOKEN_EXPIRY_DAYS = 7;
const ACCOUNT_LOCK_THRESHOLD = 5;
const ACCOUNT_LOCK_DURATION_MINUTES = 30;
const RATE_LIMIT_THRESHOLD = 10;
const RATE_LIMIT_WINDOW_MINUTES = 15;

export class AuthService {
  // ============================================================
  // AUTHENTICATION
  // ============================================================

  async register(
    payload: RegisterDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserResponseDto> {
    // Check email uniqueness
    const existingEmailUser = await authRepository.findUserByEmail(payload.email);
    if (existingEmailUser) {
      throw new ApiError(409, "Email already registered");
    }

    // Check username uniqueness
    const existingUsernameUser = await authRepository.findUserByUsername(payload.username);
    if (existingUsernameUser) {
      throw new ApiError(409, "Username already taken");
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await authRepository.createUser({
      fullName: payload.fullName,
      email: payload.email,
      username: payload.username,
      passwordHash,
      roleId: payload.roleId,
      createdBy: payload.createdBy
    });

    await authRepository.createAuditLog({
      entityName: "User",
      entityId: user.userId,
      action: "USER_CREATED",
      changedBy: payload.createdBy,
      ipAddress,
      userAgent
    });

    return this.formatUserResponse(user);
  }

  async login(
    payload: LoginDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    let isAdminLogin = false;
    let admin = await authRepository.findAdminByEmail(payload.email);
    if (!admin) {
      admin = await authRepository.findAdminByUsername(payload.email);
    }

    let user: any = null;
    if (admin) {
      isAdminLogin = true;
      user = {
        userId: "admin_" + admin.id.toString(),
        email: admin.email,
        username: admin.username,
        passwordHash: admin.passwordHash,
        fullName: admin.fullName,
        status: admin.status || "active",
        roleId: admin.roleId || null,
        role: admin.role || null,
        failedAttempts: 0,
        lockedUntil: null
      };
    } else {
      user = await authRepository.findUserByEmail(payload.email);
      if (!user) {
        user = await authRepository.findUserByUsername(payload.email);
      }
    }

    // Rate limiting check
    if (ipAddress) {
      const recentFailedAttempts = await authRepository.getRecentFailedAttempts(
        ipAddress,
        RATE_LIMIT_WINDOW_MINUTES
      );

      if (recentFailedAttempts >= RATE_LIMIT_THRESHOLD) {
        await authRepository.recordLoginAttempt({
          username: payload.email,
          ipAddress,
          success: false,
          failureReason: "rate_limit_exceeded",
          userAgent
        });

        throw new ApiError(429, "Too many login attempts. Please try again later.");
      }
    }

    if (user && user.status === UserStatus.LOCKED) {
      await authRepository.unlockUser(user.userId);
      user.status = UserStatus.ACTIVE;
    }

    if (!user || user.status !== UserStatus.ACTIVE) {

      await authRepository.recordLoginAttempt({
        username: payload.email,
        ipAddress: ipAddress ?? "unknown",
        success: false,
        failureReason: "invalid_user",
        userAgent
      });

      throw new ApiError(401, "Invalid email or password");
    }

    // Verify password
    const passwordMatches = await comparePassword(
      payload.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      if (!isAdminLogin) {
        await authRepository.incrementFailedAttempts(user.userId);

        await authRepository.recordLoginAttempt({
          username: payload.email,
          userId: user.userId,
          ipAddress: ipAddress ?? "unknown",
          success: false,
          failureReason: "invalid_password",
          userAgent
        });
      }

      throw new ApiError(401, "Invalid email or password");
    }

    // Successful login
    const permissions = await authRepository.findPermissionsByRole(user.roleId);
    const roleCode = user.role?.code ?? (user.roleId !== null ? user.roleId.toString() : "");

    // Generate unique session token
    const sessionToken = crypto.randomBytes(32).toString("hex");

    // Create session first (automatically manages 4-device limit)
    const session = await authRepository.createUserSession({
      userId: isAdminLogin ? undefined : user.userId,
      adminId: isAdminLogin ? admin!.id : undefined,
      sessionToken,
      ipAddress,
      userAgent,
      deviceLabel: this.extractDeviceLabel(userAgent)
    });

    // Use the database session ID in the JWT payload
    const accessPayload: AccessTokenPayload = {
      userId: user.userId,
      email: user.email!,
      roleId: roleCode,
      permissions,
      isSuperAdmin: isAdminLogin,
      sessionId: session.id // Use the actual database session ID
    };

    const accessToken = generateAccessToken(accessPayload);

    // Update user
    if (isAdminLogin) {
      await prisma.admin.update({
        where: { id: admin!.id },
        data: { lastLoginAt: new Date() }
      });
    } else {
      await authRepository.updateLastLogin(user.userId, ipAddress);
      
      await authRepository.recordLoginAttempt({
        username: payload.email,
        userId: user.userId,
        ipAddress: ipAddress ?? "unknown",
        success: true,
        userAgent
      });
    }

    return {
      user: this.formatUserResponse(user, isAdminLogin),
      tokens: {
        accessToken,
        accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      },
      sessionInfo: {
        deviceLabel: session.deviceLabel || "Unknown Device",
        loginAt: session.loginAt,
        expiresAt: session.expiresAt
      }
    };
  }

  async logout(
    userId: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const isAdmin = userId.startsWith("admin_");
    
    if (sessionId) {
      // Look up the specific session by sessionId (UUID from JWT)
      const session = await prisma.userSession.findFirst({
        where: {
          id: sessionId, // Use the sessionId from JWT to find the exact session
          ...(isAdmin ? { adminId: BigInt(userId.replace("admin_", "")) } : { userId }),
          isActive: true
        }
      });
      
      if (session) {
        await authRepository.logoutSession(session.id);
      }
    } else {
      // Fallback: logout all active sessions for this user
      if (isAdmin) {
        const adminId = BigInt(userId.replace("admin_", ""));
        await authRepository.logoutAllUserSessions(undefined, adminId);
      } else {
        await authRepository.logoutAllUserSessions(userId);
      }
    }

  }

  async logoutAllSessions(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const isAdmin = userId.startsWith("admin_");
    
    if (isAdmin) {
      const adminId = BigInt(userId.replace("admin_", ""));
      await authRepository.logoutAllUserSessions(undefined, adminId);
    } else {
      await authRepository.logoutAllUserSessions(userId);
    }

  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  async getActiveSessions(userId: string): Promise<any[]> {
    const isAdmin = userId.startsWith("admin_");
    
    if (isAdmin) {
      const adminId = BigInt(userId.replace("admin_", ""));
      return authRepository.getActiveSessions(undefined, adminId);
    } else {
      return authRepository.getActiveSessions(userId);
    }
  }

  // ============================================================
  // PASSWORD MANAGEMENT
  // ============================================================

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const passwordMatches = await comparePassword(oldPassword, user.passwordHash);

    if (!passwordMatches) {
      await authRepository.createAuditLog({
        entityName: "User",
        entityId: userId,
        action: "PASSWORD_CHANGE_FAILED",
        changedBy: userId,
        ipAddress,
        userAgent
      });

      throw new ApiError(401, "Current password is incorrect");
    }

    const passwordHash = await hashPassword(newPassword);
    await authRepository.updatePassword(userId, passwordHash);

    // Invalidate all password reset tokens
    await authRepository.invalidatePasswordResetTokens(userId);

    await authRepository.createAuditLog({
      entityName: "User",
      entityId: userId,
      action: "PASSWORD_CHANGED",
      changedBy: userId,
      ipAddress,
      userAgent
    });
  }

  async requestPasswordReset(email: string, ipAddress?: string): Promise<string> {
    const user = await authRepository.findUserByEmail(email);

    // Don't reveal if user exists
    if (!user) {
      return crypto.randomUUID(); // Return dummy token
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(resetToken);

    await authRepository.createPasswordResetToken({
      userId: user.userId,
      tokenHash,
      requestedIp: ipAddress
    });

    await authRepository.createAuditLog({
      entityName: "User",
      entityId: user.userId,
      action: "PASSWORD_RESET_REQUESTED",
      ipAddress
    });

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const resetToken = await authRepository.findPasswordResetToken(tokenHash);

    if (!resetToken || resetToken.usedAt || new Date(resetToken.expiresAt) < new Date()) {
      throw new ApiError(401, "Invalid or expired password reset token");
    }

    const passwordHash = await hashPassword(newPassword);
    
    if (resetToken.userId) {
      await authRepository.updatePassword(resetToken.userId, passwordHash);
      await authRepository.logoutAllUserSessions(resetToken.userId);
    } else if (resetToken.adminId) {
      await authRepository.updateAdminPassword(resetToken.adminId, passwordHash);
      await authRepository.logoutAllUserSessions(undefined, resetToken.adminId);
    }
    
    await authRepository.markPasswordResetTokenAsUsed(resetToken.id);

    await authRepository.createAuditLog({
      entityName: resetToken.userId ? "User" : "Admin",
      entityId: resetToken.userId || resetToken.adminId?.toString() || "",
      action: "PASSWORD_RESET_COMPLETED",
      ipAddress
    });
  }

  // ============================================================
  // USER PROFILE
  // ============================================================

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    if (userId.startsWith("admin_")) {
      const adminId = BigInt(userId.replace("admin_", ""));
      const admin = await authRepository.findAdminById(adminId);
      if (!admin) {
        throw new ApiError(404, "Admin not found");
      }
      
      const mockedUser = {
        userId: userId,
        email: admin.email,
        username: admin.username,
        fullName: admin.fullName,
        status: admin.status || "active",
        roleId: null,
        role: null
      };

      return {
        user: this.formatUserResponse(mockedUser, true),
        permissions: [],
        isSuperAdmin: true
      };
    }

    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const permissions = await authRepository.findPermissionsByRole(user.roleId);

    return {
      user: this.formatUserResponse(user, false),
      permissions,
      isSuperAdmin: false
    };
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private formatUserResponse(user: any, isSuperAdmin: boolean = false): UserResponseDto {
    return {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      roleId:
        user.role?.name ??
        (user.roleId !== undefined && user.roleId !== null ? user.roleId.toString() : null),
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      mfaEnabled: user.mfaEnabled || false,
      avatarUrl: user.avatarUrl || user.profilePicture || user.photoUrl || user.employee?.photoUrl || null,
      isSuperAdmin
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private extractDeviceLabel(userAgent?: string): string {
    if (!userAgent) return "Unknown Device";

    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    if (userAgent.includes("Mobile")) return "Mobile";
    if (userAgent.includes("Tablet")) return "Tablet";

    return "Unknown Device";
  }

  private getLoginFailureReason(user: any | null, fallback?: string): string {
    if (!user) return "invalid_user";
    if (user.status === UserStatus.LOCKED) return "account_locked";
    if (user.status === UserStatus.SUSPENDED) return "account_suspended";
    return fallback || "invalid_credentials";
  }
}

export const authService = new AuthService();
