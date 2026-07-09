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
  refreshToken?: string;
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
  roleId: string;
  permissions: string[];
}

export type JwtPayload = AccessTokenPayload;

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
}

// ============================================================
// RESPONSE DTOs
// ============================================================

export interface UserResponseDto {
  userId: string;
  fullName: string;
  email: string;
  username: string;
  roleId: string;
  status: UserStatus;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
}

export interface ProfileResponseDto {
  user: UserResponseDto;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: Date;
}

export interface AuthResult {
  user: UserResponseDto;
  tokens: AuthTokens;
}

// ============================================================
// SESSION & AUDIT
// ============================================================

export interface CreateAuditLogDto {
  entityName: string;
  entityId?: string;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginAttemptDto {
  username: string;
  userId?: string;
  ipAddress: string;
  success: boolean;
  failureReason?: string;
  userAgent?: string;
}