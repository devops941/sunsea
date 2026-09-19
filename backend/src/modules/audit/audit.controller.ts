import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class AuditController {
  getLogsByEntity = asyncHandler(async (req: Request, res: Response) => {
    const entityName = req.params.entityName as string;
    const entityId = req.params.entityId as string;

    const logs = await prisma.auditLog.findMany({
      where: {
        entityName,
        entityId,
      },
      orderBy: {
        changedAt: "desc",
      },
      include: {
        changedByAdminRel: { select: { username: true } },
        changedByUser: { select: { username: true } },
      }
    });

    const processedLogs = logs.map(log => {
      // Create a shallow copy without the relations to keep the payload clean
      const { changedByAdminRel, changedByUser, ...rest } = log as any;
      
      return {
        ...rest,
        // Convert BigInts to string for JSON serialization
        id: log.id.toString(),
        changedByAdmin: log.changedByAdmin?.toString(),
        changedByName: changedByAdminRel?.username || changedByUser?.username || log.changedBy || "Unknown",
      };
    });

    return res.status(200).json(
      new ApiResponse("Audit logs fetched successfully", processedLogs)
    );
  });

  getAllLogs = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filterEntity = req.query.entity as string;

    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (filterEntity && filterEntity !== "All") {
      whereClause.entityName = filterEntity;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: whereClause }),
      prisma.auditLog.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { changedAt: "desc" },
        include: {
          changedByAdminRel: { select: { username: true } },
          changedByUser: { select: { username: true } },
        }
      })
    ]);

    // Pre-fetch customer codes to replace UUIDs with friendly codes
    // Only query UUIDs. Some logs already contain the customer code from our recent changes.
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const customerIds = Array.from(new Set(
      logs.filter(l => l.entityName === 'Customer' && l.entityId && uuidRegex.test(l.entityId)).map(l => l.entityId!)
    ));
    
    let customerIdMap: Record<string, string> = {};
    if (customerIds.length > 0) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, customerCode: true }
      });
      customers.forEach(c => {
        customerIdMap[c.id] = c.customerCode;
      });
    }

    const processedLogs = logs.map(log => {
      const { changedByAdminRel, changedByUser, ...rest } = log as any;
      
      let displayEntityId = log.entityId;
      if (log.entityName === 'Customer' && log.entityId && customerIdMap[log.entityId]) {
         displayEntityId = customerIdMap[log.entityId];
      }

      return {
        ...rest,
        id: log.id.toString(),
        entityId: displayEntityId, // Show friendly code if available
        originalEntityId: log.entityId,
        changedByAdmin: log.changedByAdmin?.toString(),
        changedByName: changedByAdminRel?.username || changedByUser?.username || log.changedBy || "Unknown",
      };
    });

    const uniqueEntitiesQuery = await prisma.auditLog.findMany({
      select: { entityName: true },
      distinct: ['entityName']
    });
    const uniqueEntities = uniqueEntitiesQuery.map(e => e.entityName);

    return res.status(200).json(
      new ApiResponse("All audit logs fetched successfully", { data: processedLogs, total, uniqueEntities })
    );
  });
}

export default new AuditController();
