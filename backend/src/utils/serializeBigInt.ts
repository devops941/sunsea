 /**
  * Recursively converts BigInt values into
  * JSON-safe string representations.
  */
export function serializeBigInt<T>(
  value: T
): T {

  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  // Convert BigInt to string
  if (
    typeof value === "bigint"
  ) {
    return value.toString()   as unknown as T;
  }

  // Process array values recursively
  if (
    Array.isArray(value)
  ) {
    return value.map(
      (item) =>
        serializeBigInt(item)
    ) as unknown as T;
  }

  // Preserve Date objects
  if (
    value instanceof Date
  ) {
    return value as T;
  }

  // Handle Prisma Decimal and other custom types with a toJSON method
  if (
    value &&
    typeof (value as any).toJSON === "function"
  ) {
    return (value as any).toJSON() as unknown as T;
  }

  // Process nested object properties recursively
  if (
    typeof value === "object"
  ) {
    const copied:
      Record<string, unknown> = {};

    for (
      const [key, item]
      of Object.entries(
        value as Record<
          string,
          unknown
        >
      )
    ) {
      copied[key] =
        serializeBigInt(item);
    }

    return copied as T;
  }

  return value;
}