import crypto from "crypto";

import { ApiError } from "../../utils/ApiError";
import { authRepository } from "./auth.repository";
import { hashPassword, comparePassword } from "../../utils/hashPassword";
import { generateAccessToken } from "../../utils/generateAccessToken";
import { generateRefreshToken } from "../../utils/generateRefreshToken";
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

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const ACCESS_TOKEN_EXPIRY_MINUTES = 30;
const ACCOUNT_LOCK_THRESHOLD = 10;
const ACCOUNT_LOCK_DURATION_MINUTES = 0.1;
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
      newValues: {
        email: user.email,
        username: user.username,
        roleId: user.roleId
      },
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
    let user = await authRepository.findUserByEmail(payload.email);
    if (!user) {
      user = await authRepository.findUserByUsername(payload.email);
    }

    // Record attempt regardless of result
    const failureReason = this.getLoginFailureReason(user, payload.password ? undefined : "missing_password");

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

    if (!user || user.status !== UserStatus.ACTIVE) {
      if (user && user.status === UserStatus.LOCKED) {
        if (user.lockedUntil && user.lockedUntil > new Date()) {

          const unlockTime = user.lockedUntil.toLocaleString();

          await authRepository.recordLoginAttempt({
            username: payload.email,
            userId: user.userId,
            ipAddress: ipAddress ?? "unknown",
            success: false,
            failureReason: "account_locked",
            userAgent
          });

          throw new ApiError(
            403,
            `Account is locked due to multiple failed login attempts. Please try again after ${unlockTime} or contact the system administrator.`
          );
        }

        if (user.lockedUntil && user.lockedUntil <= new Date()) {
          await authRepository.unlockUser(user.userId);
        }
      }

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
      // Increment failed attempts
      await authRepository.incrementFailedAttempts(user.userId);

      await authRepository.recordLoginAttempt({
        username: payload.email,
        userId: user.userId,
        ipAddress: ipAddress ?? "unknown",
        success: false,
        failureReason: "invalid_password",
        userAgent
      });

      await authRepository.createAuditLog({
        entityName: "User",
        entityId: user.userId,
        action: "LOGIN_FAILED",
        newValues: { reason: "invalid_password" },
        changedBy: user.userId,
        ipAddress,
        userAgent
      });

      throw new ApiError(401, "Invalid email or password");
    }

    // Successful login
    const permissions = await authRepository.findPermissionsByRole(user.roleId);
    const roleCode = user.role?.code ?? (user.roleId !== null ? user.roleId.toString() : "");

    const accessPayload: AccessTokenPayload = {
      userId: user.userId,
      email: user.email!,
      roleId: roleCode,
      permissions
    };

    const accessToken = generateAccessToken(accessPayload);
    const refreshToken = generateRefreshToken({ userId: user.userId, sessionId: crypto.randomUUID() });
    const refreshTokenHash = this.hashToken(refreshToken);

    // Create session
    await authRepository.createUserSession({
      userId: user.userId,
      refreshTokenHash,
      ipAddress,
      userAgent,
      deviceLabel: this.extractDeviceLabel(userAgent)
    });

    // Update user
    await authRepository.updateLastLogin(user.userId, ipAddress);

    await authRepository.recordLoginAttempt({
      username: payload.email,
      userId: user.userId,
      ipAddress: ipAddress ?? "unknown",
      success: true,
      userAgent
    });

    await authRepository.createAuditLog({
      entityName: "User",
      entityId: user.userId,
      action: "LOGIN_SUCCESS",
      newValues: { lastLoginAt: new Date() },
      changedBy: user.userId,
      ipAddress,
      userAgent
    });

    return {
      user: this.formatUserResponse(user),
      tokens: {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MINUTES * 60 * 1000)
      }
    };
  }

  async logout(
    userId: string,
    refreshToken?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const session = await authRepository.findUserSessionByRefreshTokenHash(tokenHash);
      if (session) {
        await authRepository.revokeUserSession(session.id);
      }
    }

    await authRepository.createAuditLog({
      entityName: "User",
      entityId: userId,
      action: "LOGOUT",
      changedBy: userId,
      ipAddress,
      userAgent
    });
  }

  async logoutAllSessions(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await authRepository.revokeAllUserSessions(userId);

    await authRepository.createAuditLog({
      entityName: "User",
      entityId: userId,
      action: "LOGOUT_ALL_SESSIONS",
      changedBy: userId,
      ipAddress,
      userAgent
    });
  }

  // ============================================================
  // TOKEN MANAGEMENT
  // ============================================================

  async refreshAccessToken(
    refreshToken: string | undefined,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new ApiError(401, "Refresh token is required");
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await authRepository.findUserSessionByRefreshTokenHash(tokenHash);

    if (!session || session.revokedAt) {
      throw new ApiError(401, "Invalid or revoked refresh token");
    }

    if (new Date(session.expiresAt) < new Date()) {
      throw new ApiError(401, "Refresh token has expired");
    }

    const user = await authRepository.findUserById(session.userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      await authRepository.revokeUserSession(session.id);
      throw new ApiError(401, "User account is not active");
    }

    const permissions = await authRepository.findPermissionsByRole(user.roleId);
    const roleCode = user.role?.code ?? (user.roleId !== null ? user.roleId.toString() : "");

    const accessPayload: AccessTokenPayload = {
      userId: user.userId,
      email: user.email!,
      roleId: roleCode,
      permissions
    };

    const accessToken = generateAccessToken(accessPayload);
    const newSessionId = crypto.randomUUID();
    const newRefreshToken = generateRefreshToken({ userId: user.userId, sessionId: newSessionId });
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    // Create new session (this automatically removes previous sessions)
    await authRepository.createUserSession({
      userId: user.userId,
      refreshTokenHash: newRefreshTokenHash,
      ipAddress,
      userAgent,
      deviceLabel: this.extractDeviceLabel(userAgent)
    });

    await authRepository.createAuditLog({
      entityName: "User",
      entityId: user.userId,
      action: "TOKEN_REFRESHED",
      changedBy: user.userId,
      ipAddress,
      userAgent
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MINUTES * 60 * 1000)
    };
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
        newValues: { reason: "invalid_current_password" },
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
    await authRepository.updatePassword(resetToken.userId, passwordHash);
    await authRepository.markPasswordResetTokenAsUsed(resetToken.id);

    // Invalidate all sessions for security
    await authRepository.revokeAllUserSessions(resetToken.userId);

    await authRepository.createAuditLog({
      entityName: "User",
      entityId: resetToken.userId,
      action: "PASSWORD_RESET",
      ipAddress
    });
  }

  // ============================================================
  // USER PROFILE
  // ============================================================

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const permissions = await authRepository.findPermissionsByRole(user.roleId);

    return {
      user: this.formatUserResponse(user),
      permissions
    };
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private formatUserResponse(user: any): UserResponseDto {
    return {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      roleId:
        user.role?.code ??
        (user.roleId !== undefined && user.roleId !== null ? user.roleId.toString() : ""),
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      mfaEnabled: user.mfaEnabled || false
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
