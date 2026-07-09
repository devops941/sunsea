import bcrypt from "bcrypt";

/**
 * Bcrypt salt rounds used for password hashing.
 */
const SALT_ROUNDS = 12;

/**
 * Generates a secure bcrypt hash
 * for the provided password.
 */
export const hashPassword = async (
  password: string
): Promise<string> => {
  return await bcrypt.hash(
    password,
    SALT_ROUNDS
  );
};

/**
 * Compares a plain-text password
 * against a stored password hash.
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(
    password,
    hashedPassword
  );
};