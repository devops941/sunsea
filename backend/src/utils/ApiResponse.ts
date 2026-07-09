import { serializeBigInt } from "./serializeBigInt";

/**
 * Standard API success response wrapper.
 */
export class ApiResponse<T> {
  public readonly success: boolean;
  public readonly message: string;
  public readonly data?: T;

  constructor(
    message: string,
    data?: T
  ) {
    this.success = true;
    this.message = message;

    // Convert BigInt values into JSON-safe format
    this.data =
      data !== undefined
        ? (serializeBigInt(data) as T)
        : undefined;
  }
}