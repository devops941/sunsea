export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  EMPLOYEE = "EMPLOYEE"
}

export enum UserStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  LOCKED = "locked"
}

// ============================================================
// AUTH DTOs
// ============================================================

export interface RegisterDto {
  fullName: string;
  email: string;
  username: string;
  password: string;
  roleId?: string | number;
  employeeId?: bigint;
  createdBy?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  // Remove - not needed anymore
}

export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetDto {
  token: string;
  newPassword: string;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

// ============================================================
// TOKEN PAYLOADS
// ============================================================

export interface AccessTokenPayload {
  userId: string;
  email: string;
  roleId: string | null;
  permissions: string[];
  isSuperAdmin?: boolean;
  sessionId: string; // Add session ID to token
}

export type JwtPayload = AccessTokenPayload;

// ============================================================
// RESPONSE DTOs
// ============================================================

export interface UserResponseDto {
  userId: string;
  fullName: string;
  email: string;
  username: string;
  roleId: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
  avatarUrl?: string | null;
  isSuperAdmin?: boolean;
}

export interface ProfileResponseDto {
  user: UserResponseDto;
  permissions: string[];
  isSuperAdmin?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt?: Date;
}

export interface AuthResult {
  user: UserResponseDto;
  tokens: AuthTokens;
  sessionInfo?: {
    deviceLabel: string;
    loginAt: Date;
    expiresAt: Date;
  };
}

// ============================================================
// SESSION & AUDIT
// ============================================================

export interface CreateAuditLogDto {
  entityName: string;
  entityId?: string;
  action: string;
  changedBy?: string;
  changedByAdmin?: bigint;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginAttemptDto {
  username: string;
  userId?: string;
  adminId?: bigint;
  ipAddress: string;
  success: boolean;
  failureReason?: string;
  userAgent?: string;
}