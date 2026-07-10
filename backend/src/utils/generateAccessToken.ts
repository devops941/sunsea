import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { AccessTokenPayload } from "../types/auth.types";

/**
 * Generates JWT access token for authenticated API requests.
 * Token is valid for 7 days to match session duration.
 */
export const generateAccessToken = (
  payload: AccessTokenPayload
): string => {
  return jwt.sign(
    payload,
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "7d",
    }
  );
};