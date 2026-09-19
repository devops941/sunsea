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
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { recordName: { contains: search, mode: "insensitive" } },
        { entityName: { contains: search, mode: "insensitive" } },
        { changedBy: { contains: search, mode: "insensitive" } },
      ];
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

    // Group entities to fetch their names
    const entityQueries = logs.reduce((acc, log) => {
      if (log.entityId) {
        if (!acc[log.entityName]) acc[log.entityName] = new Set<string>();
        acc[log.entityName].add(log.entityId);
      }
      return acc;
    }, {} as Record<string, Set<string>>);

    const recordNamesMap: Record<string, Record<string, string>> = {};

    // Helper to add names to map
    const addNames = (entityName: string, items: any[], idKey: string, nameKey: string) => {
      if (!recordNamesMap[entityName]) recordNamesMap[entityName] = {};
      items.forEach(item => {
        if (item[idKey]) {
          recordNamesMap[entityName][item[idKey].toString()] = item[nameKey] || item[idKey].toString();
        }
      });
    };

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (entityQueries['Customer']) {
      const ids = Array.from(entityQueries['Customer']);
      const uuids = ids.filter(id => uuidRegex.test(id));
      const codes = ids.filter(id => !uuidRegex.test(id));
      
      if (uuids.length > 0) {
        const customersByUuid = await prisma.customer.findMany({ where: { id: { in: uuids } }});
        addNames('Customer', customersByUuid, 'id', 'firmName');
      }
      if (codes.length > 0) {
        const customersByCode = await prisma.customer.findMany({ where: { customerCode: { in: codes } }});
        addNames('Customer', customersByCode, 'customerCode', 'firmName');
      }
    }

    if (entityQueries['Supplier']) {
      const codes = Array.from(entityQueries['Supplier']);
      const suppliers = await prisma.supplier.findMany({ where: { supplierCode: { in: codes } } });
      addNames('Supplier', suppliers, 'supplierCode', 'legalName');
    }

    if (entityQueries['Machine']) {
      const ids = Array.from(entityQueries['Machine']);
      const machines = await prisma.machine.findMany({ where: { machineId: { in: ids } } });
      addNames('Machine', machines, 'machineId', 'machineName');
    }

    if (entityQueries['Shift']) {
      const codes = Array.from(entityQueries['Shift']);
      const shifts = await prisma.shift.findMany({ where: { shiftCode: { in: codes } } });
      addNames('Shift', shifts, 'shiftCode', 'shiftName');
    }

    if (entityQueries['Employee']) {
      const codes = Array.from(entityQueries['Employee']);
      const employees = await prisma.employee.findMany({ where: { empCode: { in: codes } } });
      addNames('Employee', employees, 'empCode', 'fullName');
    }

    if (entityQueries['Role']) {
      const codes = Array.from(entityQueries['Role']);
      const numericIds = codes.map(Number).filter(n => !isNaN(n));
      const rolesById = await prisma.role.findMany({ where: { id: { in: numericIds } } });
      addNames('Role', rolesById, 'id', 'name');
      const rolesByCode = await prisma.role.findMany({ where: { code: { in: codes } } });
      addNames('Role', rolesByCode, 'code', 'name');
    }

    if (entityQueries['RolePermission']) {
      const ids = Array.from(entityQueries['RolePermission']);
      const numericIds = ids.map(Number).filter(n => !isNaN(n));
      const roles = await prisma.role.findMany({ where: { id: { in: numericIds } } });
      if (!recordNamesMap['RolePermission']) recordNamesMap['RolePermission'] = {};
      roles.forEach(r => {
        recordNamesMap['RolePermission'][r.id.toString()] = `Permissions for ${r.name}`;
      });
    }

    const processedLogs = logs.map(log => {
      const { changedByAdminRel, changedByUser, ...rest } = log as any;
      
      let displayEntityId = log.entityId;
      if (log.entityName === 'Customer' && log.entityId && uuidRegex.test(log.entityId)) {
        // Fallback or keep it UUID if we want, we'll let recordName show the actual name
      }

      let recordName = log.recordName || log.entityId;
      if (!log.recordName && log.entityId && recordNamesMap[log.entityName] && recordNamesMap[log.entityName][log.entityId]) {
        recordName = recordNamesMap[log.entityName][log.entityId];
      } else if (!log.recordName && log.entityName === 'Department') {
        recordName = log.entityId; // For department it's usually already the name
      }

      return {
        ...rest,
        id: log.id.toString(),
        entityId: displayEntityId,
        originalEntityId: log.entityId,
        recordName: recordName,
        changedByAdmin: log.changedByAdmin?.toString(),
        changedByName: changedByAdminRel?.username || changedByUser?.username || log.changedBy || "Unknown",
      };
    });

    return res.status(200).json(
      new ApiResponse("All audit logs fetched successfully", { data: processedLogs, total })
    );
  });
}

export default new AuditController();
