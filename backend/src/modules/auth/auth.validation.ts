import { z } from "zod";

/**
 * Shared password validation rules
 * used across authentication workflows.
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must not exceed 72 characters")
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, and one digit"
  });

/**
 * User registration validation schema.
 */
export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(3, "Full name must be at least 3 characters"),
    email: z.string().email("Invalid email format"),
    username: z.string().min(3, "Username must be at least 3 characters").max(50),
    password: passwordSchema,
    roleId: z.union([z.string(), z.coerce.bigint()]).optional(),
    employeeId: z.string().optional()
  })
});

/**
 * User login validation schema.
 */
export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(3, "Username or email must be at least 3 characters"),
    password: z.string().min(1, "Password is required")
  })
});

/**
 * Refresh token validation schema.
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional()
  }).optional().default({})
});

/**
 * Password reset request validation schema.
 */
export const passwordResetRequestSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format")
  })
});

/**
 * Password reset validation schema.
 */
export const passwordResetSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: passwordSchema
  })
});

/**
 * Change password validation schema.
 */
export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema
  })
});