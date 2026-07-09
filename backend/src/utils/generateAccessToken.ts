import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { AccessTokenPayload } from "../types/auth.types";

/**
 * Generates a short-lived JWT access token
 * for authenticated API requests.
 */
export const generateAccessToken = (
  payload: AccessTokenPayload
): string => {
  return jwt.sign(
    payload,
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "30m",
    }
  );
};