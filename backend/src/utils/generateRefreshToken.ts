import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { RefreshTokenPayload } from "../types/auth.types";

/**
 * Generates a long-lived JWT refresh token
 * used to issue new access tokens.
 */
export const generateRefreshToken = (
  payload: RefreshTokenPayload
): string => {
  return jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    }
  );
};