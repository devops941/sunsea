import { Request, Response, NextFunction } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { authService } from "./auth.service";
import { isProduction } from "../../config/env";

import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto
} from "../../types/auth.types";

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// ============================================================
// AUTHENTICATION
// ============================================================

export const register = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as RegisterDto;

  const user = await authService.register(
    payload,
    req.ip,
    req.get("user-agent") ?? undefined
  );

  res.status(201).json(
    new ApiResponse("User registered successfully", user)
  );
  return;
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as LoginDto;

  const authResult = await authService.login(
    payload,
    req.ip,
    req.get("user-agent") ?? undefined
  );

  res.cookie(
    "refreshToken",
    authResult.tokens.refreshToken,
    refreshTokenCookieOptions
  );

  res.status(200).json(
    new ApiResponse("Login successful", {
      accessToken: authResult.tokens.accessToken,
      accessTokenExpiresAt: authResult.tokens.accessTokenExpiresAt,
      user: authResult.user
    })
  );
  return;
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  const userId = req.user?.userId as string;

  await authService.logout(
    userId,
    refreshToken,
    req.ip,
    req.get("user-agent") ?? undefined
  );

  res.cookie("refreshToken", "", {
    ...refreshTokenCookieOptions,
    maxAge: 0
  });

  res.status(200).json(new ApiResponse("Logout successful"));
  return;
});

export const logoutAllSessions = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;

    await authService.logoutAllSessions(
      userId,
      req.ip,
      req.get("user-agent") ?? undefined
    );

    res.cookie("refreshToken", "", {
      ...refreshTokenCookieOptions,
      maxAge: 0
    });

    res.status(200).json(new ApiResponse("All sessions logged out successfully"));
    return;
  }
);

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

export const refreshToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const bodyToken = req.body?.refreshToken as string | undefined;
    const cookieToken = req.cookies?.refreshToken as string | undefined;
    const token = bodyToken || cookieToken;

    try {
      const tokens = await authService.refreshAccessToken(
        token,
        req.ip,
        req.get("user-agent") ?? undefined
      );

      res.cookie(
        "refreshToken",
        tokens.refreshToken,
        refreshTokenCookieOptions
      );

      res.status(200).json(
        new ApiResponse("Token refreshed successfully", {
          accessToken: tokens.accessToken,
          accessTokenExpiresAt: tokens.accessTokenExpiresAt
        })
      );
      return;
    } catch (error) {
      res.cookie("refreshToken", "", {
        ...refreshTokenCookieOptions,
        maxAge: 0
      });
      next(error);
    }
  }
);

// ============================================================
// PASSWORD MANAGEMENT
// ============================================================

export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;
    const payload = req.body as ChangePasswordDto;

    await authService.changePassword(
      userId,
      payload.oldPassword,
      payload.newPassword,
      req.ip,
      req.get("user-agent") ?? undefined
    );

    res.status(200).json(new ApiResponse("Password changed successfully"));
    return;
  }
);

export const requestPasswordReset = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = req.body as PasswordResetRequestDto;

    const resetToken = await authService.requestPasswordReset(
      payload.email,
      req.ip
    );

    // In production, send email with reset link containing the token
    // For now, return it (only for development/testing)
    if (process.env.NODE_ENV !== "production") {
      res.status(200).json(
        new ApiResponse("Password reset email sent", { resetToken })
      );
    } else {
      res.status(200).json(
        new ApiResponse("If email exists, you will receive a reset link")
      );
    }
    return;
  }
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = req.body as PasswordResetDto;

    await authService.resetPassword(
      payload.token,
      payload.newPassword,
      req.ip
    );

    res.status(200).json(new ApiResponse("Password reset successfully"));
    return;
  }
);

// ============================================================
// USER PROFILE
// ============================================================

export const getProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;

    const user = await authService.getProfile(userId);

    res.status(200).json(new ApiResponse("Profile fetched successfully", user));
    return;
  }
);

