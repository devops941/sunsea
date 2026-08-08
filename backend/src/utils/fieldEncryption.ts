/**
 * Field-level encryption utility — AES-256-GCM
 *
 * Centralized encryption for any module that needs to store sensitive fields
 * securely in the database. Completely independent of Prisma, Express, and
 * business logic.
 *
 * Storage format (single Base64 string):
 *   [ IV (16 bytes) | AuthTag (16 bytes) | Ciphertext (variable) ]
 *
 * Environment requirement:
 *   FIELD_ENCRYPT_KEY — 64 hex characters (32 bytes)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 16; // bytes
const AUTH_TAG_LENGTH = 16; // bytes
const KEY_BYTE_LENGTH = 32; // bytes → 64 hex chars

// ─── Key bootstrap (runs once at module load) ─────────────────────────────────

function loadKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPT_KEY;

  if (!raw) {
    throw new Error(
      "[fieldEncryption] FIELD_ENCRYPT_KEY is not set. " +
        "Add a 64-character hex value to your .env file."
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(
      "[fieldEncryption] FIELD_ENCRYPT_KEY must be a hexadecimal string."
    );
  }

  if (raw.length !== KEY_BYTE_LENGTH * 2) {
    throw new Error(
      `[fieldEncryption] FIELD_ENCRYPT_KEY must be exactly ${KEY_BYTE_LENGTH * 2} hex characters (${KEY_BYTE_LENGTH} bytes). Got ${raw.length}.`
    );
  }

  return Buffer.from(raw, "hex");
}

// Key is resolved once. If invalid, the module throws during import which
// stops the application before it accepts any requests.
const ENCRYPTION_KEY: Buffer = loadKey();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt any primitive or JSON-serialisable value.
 *
 * Accepts: string | number | boolean | bigint | object (JSON-serialised)
 * Returns: Base64 string — safe to store in any text column.
 *
 * Every call generates a fresh random IV, so encrypting the same value
 * twice produces different ciphertext.
 */
export function encryptField(value: string | number | boolean | bigint | object | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    throw new Error("[fieldEncryption] Cannot encrypt an empty or null value.");
  }

  const plaintext = typeof value === "object"
    ? JSON.stringify(value)
    : String(value);

  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Layout: IV (16) | AuthTag (16) | Ciphertext (n)
  const payload = Buffer.concat([iv, authTag, encrypted]);

  return payload.toString("base64");
}

/**
 * Decrypt a value previously encrypted with encryptField().
 *
 * Always verifies the GCM authentication tag. Throws if:
 *   - The payload is malformed or too short
 *   - The authentication tag check fails (wrong key or tampered data)
 *   - The base64 string is invalid
 *
 * Returns the original plaintext string.
 */
export function decryptField(encryptedValue: string): string {
  if (!encryptedValue || typeof encryptedValue !== "string") {
    throw new Error("[fieldEncryption] Invalid encrypted payload: value must be a non-empty string.");
  }

  let payload: Buffer;

  try {
    payload = Buffer.from(encryptedValue, "base64");
  } catch {
    throw new Error("[fieldEncryption] Invalid encrypted payload: failed to decode base64.");
  }

  const minimumLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;
  if (payload.length < minimumLength) {
    throw new Error(
      `[fieldEncryption] Invalid encrypted payload: too short. ` +
        `Expected at least ${minimumLength} bytes, got ${payload.length}.`
    );
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  try {
    const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // Do NOT expose crypto internals or key material in error messages
    throw new Error("[fieldEncryption] Invalid encrypted payload: authentication failed or data corrupted.");
  }
}

/**
 * Check whether a string looks like a value produced by encryptField().
 *
 * This is a structural check only — it does NOT attempt decryption.
 * Use it to guard against accidentally encrypting an already-encrypted field.
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== "string") return false;

  try {
    const buf = Buffer.from(value, "base64");
    // Must be at least IV + AuthTag + 1 byte of ciphertext
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
