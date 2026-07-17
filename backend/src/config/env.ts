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