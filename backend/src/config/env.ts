import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/**
 * Environment variable validation schema.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(
      1,
      "Database URL is required"
    ),

  JWT_ACCESS_SECRET: z
    .string()
    .min(
      32,
      "JWT Access Secret must be at least 32 characters"
    ),

  NODE_ENV: z
    .enum([
      "development",
      "production",
      "test",
    ])
    .default("development"),

  PORT: z.string().optional(),

  FRONTEND_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:5173"),

  BACKEND_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:5000"),

  // Max concurrent active sessions per user/admin. When exceeded, the OLDEST
  // session is deleted — so a low value kicks earlier devices out. Default 100
  // is high enough that team-testing with shared admin accounts won't evict
  // anyone; tune down only if a strict device cap is desired.
  MAX_SESSIONS_PER_USER: z
    .string()
    .optional()
    .default("100")
    .transform((v) => {
      const n = parseInt(v, 10);
      if (!Number.isFinite(n) || n < 1) throw new Error("MAX_SESSIONS_PER_USER must be a positive integer");
      return n;
    }),
});

/**
 * Validate environment variables
 * during application startup.
 */
const parsed =
  envSchema.safeParse(
    process.env
  );

if (!parsed.success) {
  const fieldErrors =
    parsed.error
      .flatten()
      .fieldErrors;

  const errorMessages:
    string[] = [];

  Object.entries(
    fieldErrors
  ).forEach(
    ([field, errors]) => {
      if (
        errors &&
        errors.length > 0
      ) {
        errorMessages.push(
          `  ${field}: ${errors.join(", ")}`
        );
      }
    }
  );

  // Fail fast when required environment variables are missing
  const message =
    `\n\nEnvironment validation failed:\n${errorMessages.join("\n")}\n\nPlease check your .env file and ensure all required variables are set correctly.\n`;

  throw new Error(message);
}

/**
 * Strongly typed environment configuration.
 */
export const env = {
  ...parsed.data,
  NODE_ENV:
    parsed.data.NODE_ENV,
  PORT:
    parsed.data.PORT,
};

/**
 * Production environment flag.
 */
export const isProduction =
  env.NODE_ENV ===
  "production";