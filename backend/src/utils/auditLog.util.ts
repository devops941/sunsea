import { prisma } from "../config/prisma";
import { AuditAction } from "@prisma/client";
import { serializeBigInt } from "./serializeBigInt";

/**
 * Creates an audit log entry.
 *
 * @param entityName The name of the entity being modified (e.g., "Customer")
 * @param entityId The ID of the entity being modified
 * @param action The action performed (CREATE, UPDATE, DELETE, etc.)
 * @param userId The ID of the user performing the action (optional)
 * @param ipAddress The IP address of the requester (optional)
 * @param userAgent The User-Agent string of the requester (optional)
 */
export async function logAudit(
  entityName: string,
  entityId: string,
  action: AuditAction,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
) {
  let changedByAdmin: bigint | undefined = undefined;
  let changedBy: string | undefined = undefined;

  if (userId) {
    if (userId.startsWith("admin_")) {
      changedByAdmin = BigInt(userId.replace("admin_", ""));
    } else {
      changedBy = userId;
    }
  }

  return prisma.auditLog.create({
    data: {
      entityName,
      entityId,
      action,
      changedBy,
      ...(changedByAdmin ? { changedByAdmin } : {}),
      ipAddress,
      userAgent,
    },
  });
}
