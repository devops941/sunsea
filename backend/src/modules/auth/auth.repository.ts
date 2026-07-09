import { prisma } from "../../config/prisma";
import { AuditAction } from "@prisma/client";
import { serializeBigInt } from "../../utils/serializeBigInt";
import { UserStatus, CreateAuditLogDto, LoginAttemptDto } from "../../types/auth.types";

interface PrismaUser {
  userId: string;
  username: string;
  email: string | null;
  passwordHash: string;
  fullName: string;
  status: UserStatus;
  mustChangePw: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  roleId: number | null;
  role?: {
    code: string;
  } | null;
  createdBy: string | null;
  createdOn: Date;
  updatedOn: Date;
}

export class AuthRepository {
  // ============================================================
  // USER OPERATIONS
  // ============================================================

  async findUserByEmail(email: string): Promise<PrismaUser | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { role: { select: { code: true } } }
    }) as Promise<PrismaUser | null>;
  }

  async findUserByUsername(username: string): Promise<PrismaUser | null> {
    return prisma.user.findUnique({
      where: { username },
      include: { role: { select: { code: true } } }
    }) as Promise<PrismaUser | null>;
  }

  async findUserById(userId: string): Promise<PrismaUser | null> {
    return prisma.user.findUnique({
      where: { userId },
      include: { role: { select: { code: true } } }
    }) as Promise<PrismaUser | null>;
  }

  async createUser(payload: {
    fullName: string;
    email: string;
    username: string;
    passwordHash: string;
    roleId?: string | number;
    employeeId?: bigint;
    createdBy?: string;
  }): Promise<PrismaUser> {
    return prisma.user.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        username: payload.username,
        passwordHash: payload.passwordHash,
        roleId: payload.roleId !== undefined ? Number(payload.roleId) : undefined,
        createdBy: payload.createdBy
      },
      include: { role: { select: { code: true } } }
    }) as Promise<PrismaUser>;
  }

  // ============================================================
  // ACCOUNT SECURITY
  // ============================================================

  async updateLastLogin(userId: string, ipAddress?: string): Promise<PrismaUser> {
    return prisma.user.update({
      where: { userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        failedAttempts: 0
      }
    }) as Promise<PrismaUser>;
  }

  async incrementFailedAttempts(userId: string): Promise<PrismaUser> {
    const user = await this.findUserById(userId);
    if (!user) throw new Error("User not found");

    const newFailedAttempts = user.failedAttempts + 1;
    const shouldLock = newFailedAttempts >= 5; // Lock after 5 failed attempts

    return prisma.user.update({
      where: { userId },
      data: {
        failedAttempts: newFailedAttempts,
        ...(shouldLock && {
          status: UserStatus.LOCKED,
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        })
      }
    }) as Promise<PrismaUser>;
  }

  async resetFailedAttempts(userId: string): Promise<PrismaUser> {
    return prisma.user.update({
      where: { userId },
      data: { failedAttempts: 0 }
    }) as Promise<PrismaUser>;
  }

  async unlockUser(userId: string): Promise<PrismaUser> {
    return prisma.user.update({
      where: { userId },
      data: {
        status: UserStatus.ACTIVE,
        lockedUntil: null,
        failedAttempts: 0
      }
    }) as Promise<PrismaUser>;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<PrismaUser> {
    return prisma.user.update({
      where: { userId },
      data: {
        passwordHash,
        mustChangePw: false
      }
    }) as Promise<PrismaUser>;
  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  async createUserSession(payload: {
    userId: string;
    refreshTokenHash: string;
    ipAddress?: string;
    userAgent?: string;
    deviceLabel?: string;
    rememberMe?: boolean;
  }): Promise<any> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return prisma.$transaction(async (tx) => {
      // Remove any existing sessions for this user to prevent constraint violations
      // and ensure a single active session per user.
      await tx.userSession.deleteMany({
        where: { userId: payload.userId }
      });

      // Create the new session
      return tx.userSession.create({
        data: {
          userId: payload.userId,
          refreshTokenHash: payload.refreshTokenHash,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          deviceLabel: payload.deviceLabel,
          rememberMe: payload.rememberMe || false,
          expiresAt
        }
      });
    });
  }

  async findUserSession(sessionId: string): Promise<any | null> {
    return prisma.userSession.findUnique({
      where: { id: sessionId }
    });
  }

  async findUserSessionByRefreshTokenHash(refreshTokenHash: string): Promise<any | null> {
    return prisma.userSession.findUnique({
      where: { refreshTokenHash }
    });
  }

  async revokeUserSession(sessionId: string): Promise<any> {
    return prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
    return result.count;
  }

  // ============================================================
  // PASSWORD RESET
  // ============================================================

  async createPasswordResetToken(payload: {
    userId: string;
    tokenHash: string;
    requestedIp?: string;
  }): Promise<any> {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    return prisma.passwordResetToken.create({
      data: {
        userId: payload.userId,
        tokenHash: payload.tokenHash,
        expiresAt,
        requestedIp: payload.requestedIp
      }
    });
  }

  async findPasswordResetToken(tokenHash: string): Promise<any | null> {
    return prisma.passwordResetToken.findUnique({
      where: { tokenHash }
    });
  }

  async markPasswordResetTokenAsUsed(tokenId: string): Promise<any> {
    return prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() }
    });
  }

  async invalidatePasswordResetTokens(userId: string): Promise<number> {
    const result = await prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      data: { usedAt: new Date() }
    });
    return result.count;
  }

  // ============================================================
  // LOGIN ATTEMPTS
  // ============================================================

  async recordLoginAttempt(attempt: LoginAttemptDto): Promise<any> {
    return prisma.loginAttempt.create({
      data: {
        username: attempt.username,
        userId: attempt.userId,
        ipAddress: attempt.ipAddress,
        success: attempt.success,
        failureReason: attempt.failureReason,
        userAgent: attempt.userAgent
      }
    });
  }

  async getRecentFailedAttempts(ipAddress: string, minutes: number = 15): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const result = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        attemptedAt: {
          gte: since
        }
      }
    });

    return result;
  }

  // ============================================================
  // PERMISSIONS
  // ============================================================

  async findPermissionsByRole(roleId?: number | null): Promise<string[]> {
    if (roleId === undefined || roleId === null) {
      return [];
    }

    const permissions = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { key: true } } }
    });

    return permissions.map((p) => p.permission.key);
  }

  // ============================================================
  // AUDIT LOGGING
  // ============================================================

  async createAuditLog(entry: CreateAuditLogDto): Promise<any> {
    return prisma.auditLog.create({
      data: {
        entityName: entry.entityName,
        entityId: entry.entityId,
        action: entry.action as AuditAction,
        oldValues: entry.oldValues ? serializeBigInt(entry.oldValues) : undefined,
        newValues: entry.newValues ? serializeBigInt(entry.newValues) : undefined,
        changedBy: entry.changedBy,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent
      }
    });
  }

  async getAuditLogs(
    filters: {
      entityName?: string;
      entityId?: string;
      action?: string;
      changedBy?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    const { entityName, entityId, action, changedBy, limit = 100, offset = 0 } = filters;

    return prisma.auditLog.findMany({
      where: {
        ...(entityName && { entityName }),
        ...(entityId && { entityId }),
        ...(action && { action: action as AuditAction }),
        ...(changedBy && { changedBy })
      },
      orderBy: { changedAt: "desc" },
      take: limit,
      skip: offset
    });
  }
}

export const authRepository = new AuthRepository();
