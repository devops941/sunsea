import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export class MachineOperationAssignmentService {
  /**
   * Get all Roles for assignment selection dropdowns
   */
  static async getRoles() {
    return prisma.role.findMany({
      where: {
        status: "active",
        NOT: [
          { code: { in: ["ROLE_ADMIN", "SUPER_ADMIN", "super_admin", "superadmin"] } },
          { name: { contains: "Super Admin", mode: "insensitive" } },
          { name: { contains: "superadmin", mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
    });
  }

  /**
   * Get employees filtered by Role ID (Role-Based Employee Selection)
   */
  static async getEmployeesByRole(roleId?: number) {
    const rawEmployees = await prisma.employee.findMany({
      where: {
        status: "active",
        ...(roleId
          ? {
              OR: [
                { roleId: Number(roleId) },
                { user: { roleId: Number(roleId) } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        empCode: true,
        fullName: true,
        email: true,
        mobile: true,
        roleId: true,
        role: { select: { id: true, name: true, code: true } },
        user: {
          select: {
            roleId: true,
            role: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return rawEmployees.map((e) => ({
      ...e,
      id: e.id.toString(),
    }));
  }

  /**
   * Fetch all machine operation assignments with search, filter, pagination
   */
  static async getAssignments(filters: any) {
    const {
      machineId,
      operatorEmployeeId,
      inchargeEmployeeId,
      weekStartDate,
      weekEndDate,
      isActive,
      search,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (machineId) where.machineId = machineId;
    if (operatorEmployeeId) where.operatorEmployeeId = BigInt(operatorEmployeeId);
    if (inchargeEmployeeId) where.inchargeEmployeeId = BigInt(inchargeEmployeeId);
    if (isActive !== undefined && isActive !== null && isActive !== "") {
      where.isActive = String(isActive) === "true";
    }

    if (weekStartDate || weekEndDate) {
      if (weekStartDate) where.weekStartDate = { gte: new Date(weekStartDate) };
      if (weekEndDate) where.weekEndDate = { lte: new Date(weekEndDate) };
    }

    if (search) {
      where.OR = [
        { machineId: { contains: search, mode: "insensitive" } },
        { machine: { machineName: { contains: search, mode: "insensitive" } } },
        { operatorEmployee: { fullName: { contains: search, mode: "insensitive" } } },
        { inchargeEmployee: { fullName: { contains: search, mode: "insensitive" } } },
        { remarks: { contains: search, mode: "insensitive" } },
      ];
    }

    const [rawAssignments, total] = await Promise.all([
      prisma.machineOperationAssignment.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
        include: {
          machine: {
            select: {
              machineId: true,
              machineName: true,
              machineType: true,
              machineStatus: true,
              isActive: true,
              operatorId: true,
            },
          },
          shift: true,
          inchargeRole: { select: { id: true, name: true, code: true } },
          inchargeEmployee: { select: { id: true, empCode: true, fullName: true, email: true } },
          operators: {
            include: {
              role: { select: { id: true, name: true, code: true } },
              employee: { select: { id: true, empCode: true, fullName: true, email: true } },
            },
          },
        },
      }),
      prisma.machineOperationAssignment.count({ where }),
    ]);

    // Fetch employee details for machine operatorIds (which store Employee IDs)
    const machineOperatorIds = [...new Set(rawAssignments.map(a => a.machine?.operatorId).filter(Boolean))];
    let machineOperatorMap = new Map();
    if (machineOperatorIds.length > 0) {
      try {
        const machineOperators = await prisma.employee.findMany({
          where: { id: { in: machineOperatorIds.map(id => BigInt(id as string)) } },
          select: { id: true, fullName: true, empCode: true },
        });
        machineOperatorMap = new Map(machineOperators.map(emp => [emp.id.toString(), emp]));
      } catch (err) {
        // Fallback if operatorId is not a valid BigInt (e.g. empCode)
      }
    }

    // Format BigInt values for JSON response
    const assignments = rawAssignments.map((a) => {
      let machineOperatorName = a.machine?.operatorId;
      if (a.machine?.operatorId && machineOperatorMap.has(a.machine.operatorId.toString())) {
        const emp = machineOperatorMap.get(a.machine.operatorId.toString());
        machineOperatorName = emp.fullName;
      }

      return {
        ...a,
        machine: a.machine ? {
          ...a.machine,
          operatorName: machineOperatorName
        } : null,
        id: a.id.toString(),
        inchargeEmployeeId: a.inchargeEmployeeId ? a.inchargeEmployeeId.toString() : null,
        inchargeEmployee: a.inchargeEmployee
          ? { ...a.inchargeEmployee, id: a.inchargeEmployee.id.toString() }
          : null,
        operators: a.operators ? a.operators.map((op: any) => ({
          ...op,
          id: op.id.toString(),
          assignmentId: op.assignmentId.toString(),
          employeeId: op.employeeId.toString(),
          employee: { ...op.employee, id: op.employee.id.toString() },
        })) : [],
      };
    });

    return { assignments, total, page: Number(page), limit: Number(limit) };
  }

  /**
   * Create a new Weekly Machine Operation Assignment
   */
  static async createAssignment(data: any, userId?: string) {
    const {
      machineId,
      shiftId,
      weekStartDate,
      weekEndDate,
      inchargeRoleId,
      inchargeEmployeeId,
      operators,
      remarks,
      isActive = true,
    } = data;

    // 1. Validate Machine existence and active status
    const machine = await prisma.machine.findUnique({
      where: { machineId },
    });
    if (!machine) {
      throw new ApiError(404, `Machine ${machineId} not found`);
    }
    if (!machine.isActive) {
      throw new ApiError(400, `Machine ${machine.machineName} (${machineId}) is currently inactive and cannot be assigned`);
    }

    // 2. Validate Operator Employees active status
    if (operators && operators.length > 0) {
      for (const op of operators) {
        const opEmp = await prisma.employee.findUnique({
          where: { id: BigInt(op.employeeId) },
        });
        if (!opEmp) {
          throw new ApiError(404, `Operator employee ${op.employeeId} not found`);
        }
        if (opEmp.status !== "active") {
          throw new ApiError(400, `Operator employee ${opEmp.fullName} is currently inactive`);
        }
      }
    }

    // 3. Validate Incharge Employee active status
    if (inchargeEmployeeId) {
      const incEmp = await prisma.employee.findUnique({
        where: { id: BigInt(inchargeEmployeeId) },
      });
      if (!incEmp) {
        throw new ApiError(404, "Incharge employee not found");
      }
      if (incEmp.status !== "active") {
        throw new ApiError(400, `Incharge employee ${incEmp.fullName} is currently inactive`);
      }
    }

    const startDate = new Date(weekStartDate);
    const endDate = new Date(weekEndDate);

    // 5. Prevent duplicate weekly assignments for the same machine AND SAME SHIFT during overlapping dates
    const existingOverlap = await prisma.machineOperationAssignment.findFirst({
      where: {
        id: { not: undefined },
        machineId: machineId,
        shiftId: shiftId !== undefined ? (shiftId || null) : undefined,
        isActive: true,
        OR: [
          {
            weekStartDate: { lte: endDate },
            weekEndDate: { gte: startDate },
          },
        ],
      },
    });

    if (existingOverlap) {
      const shiftMsg = (shiftId !== undefined ? shiftId : undefined) ? ` on this shift` : "";
      throw new ApiError(
        409,
        `An active assignment already exists for this Machine${shiftMsg} for week period ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`
      );
    }

    // Create Assignment
    const rawAssignment = await prisma.machineOperationAssignment.create({
      data: {
        machineId,
        shiftId: shiftId || null,
        weekStartDate: startDate,
        weekEndDate: endDate,
        inchargeRoleId: inchargeRoleId ? Number(inchargeRoleId) : null,
        inchargeEmployeeId: inchargeEmployeeId ? BigInt(inchargeEmployeeId) : null,
        remarks: remarks || null,
        isActive,
        assignedBy: userId || "SYSTEM",
        operators: {
          create: operators?.map((o: any) => ({
            roleId: Number(o.roleId),
            employeeId: BigInt(o.employeeId),
          })) || [],
        },
      },
      include: {
        machine: true,
        shift: true,
        inchargeRole: true,
        inchargeEmployee: true,
        operators: {
          include: {
            role: true,
            employee: true,
          },
        },
      },
    });

    // Create Audit Log entry
    try {
      await prisma.auditLog.create({
        data: {
          entityName: "MachineOperationAssignment",
          entityId: rawAssignment.id.toString(),
          action: "CREATE",
          newValues: {
            machineId,
            weekStartDate: startDate.toISOString(),
            weekEndDate: endDate.toISOString(),
            operators: operators.map((o: any) => ({ roleId: o.roleId, employeeId: String(o.employeeId) })),
            inchargeEmployeeId: inchargeEmployeeId ? String(inchargeEmployeeId) : null,
            assignedBy: userId || "SYSTEM",
          },
          changedBy: userId || "SYSTEM",
        },
      });
    } catch (e) {
      console.warn("Audit Log creation warning:", e);
    }

    return {
      ...rawAssignment,
      id: rawAssignment.id.toString(),
      inchargeEmployeeId: rawAssignment.inchargeEmployeeId ? rawAssignment.inchargeEmployeeId.toString() : null,
      operators: rawAssignment.operators ? rawAssignment.operators.map((op: any) => ({
        ...op,
        id: op.id.toString(),
        assignmentId: op.assignmentId.toString(),
        employeeId: op.employeeId.toString(),
        employee: { ...op.employee, id: op.employee.id.toString() },
      })) : [],
      inchargeEmployee: rawAssignment.inchargeEmployee
        ? { ...rawAssignment.inchargeEmployee, id: rawAssignment.inchargeEmployee.id.toString() }
        : null,
    };
  }

  /**
   * Update an existing Assignment
   */
  static async updateAssignment(id: bigint | number | string, data: any, userId?: string) {
    const targetId = BigInt(id);
    const existing = await prisma.machineOperationAssignment.findUnique({
      where: { id: targetId },
    });

    if (!existing) {
      throw new ApiError(404, "Machine Operation Assignment not found");
    }

    const { shiftId, weekStartDate, weekEndDate } = data;
    const startDate = weekStartDate ? new Date(weekStartDate) : existing.weekStartDate;
    const endDate = weekEndDate ? new Date(weekEndDate) : existing.weekEndDate;

    const newMachineId = data.machineId || existing.machineId;

    const existingOverlap = await prisma.machineOperationAssignment.findFirst({
      where: {
        id: { not: targetId },
        machineId: newMachineId,
        shiftId: shiftId !== undefined ? (shiftId || null) : existing.shiftId,
        isActive: true,
        OR: [
          {
            weekStartDate: { lte: endDate },
            weekEndDate: { gte: startDate },
          },
        ],
      },
    });

    if (existingOverlap) {
      const shiftMsg = (shiftId !== undefined ? (shiftId || null) : existing.shiftId) ? ` on this shift` : "";
      throw new ApiError(
        409,
        `An active assignment already exists for this Machine${shiftMsg} for week period ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`
      );
    }

    const updateData: any = {};
    if (data.machineId) updateData.machineId = data.machineId;
    if (data.weekStartDate) updateData.weekStartDate = startDate;
    if (data.weekEndDate) updateData.weekEndDate = endDate;
    if (shiftId !== undefined) updateData.shiftId = shiftId || null;
    if (data.inchargeRoleId !== undefined) updateData.inchargeRoleId = data.inchargeRoleId ? Number(data.inchargeRoleId) : null;
    if (data.inchargeEmployeeId !== undefined) updateData.inchargeEmployeeId = data.inchargeEmployeeId ? BigInt(data.inchargeEmployeeId) : null;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    if (data.operators) {
      updateData.operators = {
        deleteMany: {},
        create: data.operators.map((o: any) => ({
          roleId: Number(o.roleId),
          employeeId: BigInt(o.employeeId),
        })),
      };
    }

    const updatedRaw = await prisma.machineOperationAssignment.update({
      where: { id: targetId },
      data: updateData,
      include: {
        machine: true,
        shift: true,
        inchargeRole: true,
        inchargeEmployee: true,
        operators: {
          include: {
            role: true,
            employee: true,
          },
        },
      },
    });

    // Audit Log for update
    try {
      await prisma.auditLog.create({
        data: {
          entityName: "MachineOperationAssignment",
          entityId: targetId.toString(),
          action: "UPDATE",
          oldValues: {
            inchargeEmployeeId: existing.inchargeEmployeeId ? String(existing.inchargeEmployeeId) : null,
            isActive: existing.isActive,
          },
          newValues: {
            inchargeEmployeeId: updatedRaw.inchargeEmployeeId ? String(updatedRaw.inchargeEmployeeId) : null,
            isActive: updatedRaw.isActive,
          },
          changedBy: userId || "SYSTEM",
        },
      });
    } catch (e) {
      console.warn("Audit Log creation warning:", e);
    }

    return {
      ...updatedRaw,
      id: updatedRaw.id.toString(),
      inchargeEmployeeId: updatedRaw.inchargeEmployeeId ? updatedRaw.inchargeEmployeeId.toString() : null,
      operators: updatedRaw.operators ? updatedRaw.operators.map((op: any) => ({
        ...op,
        id: op.id.toString(),
        assignmentId: op.assignmentId.toString(),
        employeeId: op.employeeId.toString(),
        employee: { ...op.employee, id: op.employee.id.toString() },
      })) : [],
      inchargeEmployee: updatedRaw.inchargeEmployee
        ? { ...updatedRaw.inchargeEmployee, id: updatedRaw.inchargeEmployee.id.toString() }
        : null,
    };
  }

  /**
   * Toggle active/inactive status (Close Assignment)
   */
  static async toggleStatus(id: bigint | number | string, isActive: boolean, userId?: string) {
    const targetId = BigInt(id);
    const updatedRaw = await prisma.machineOperationAssignment.update({
      where: { id: targetId },
      data: { isActive },
      include: {
        machine: true,
        shift: true,
        inchargeRole: true,
        inchargeEmployee: true,
        operators: {
          include: {
            role: true,
            employee: true,
          }
        }
      },
    });

    return {
      ...updatedRaw,
      id: updatedRaw.id.toString(),
      inchargeEmployeeId: updatedRaw.inchargeEmployeeId ? updatedRaw.inchargeEmployeeId.toString() : null,
      operators: updatedRaw.operators ? updatedRaw.operators.map((op: any) => ({
        ...op,
        id: op.id.toString(),
        assignmentId: op.assignmentId.toString(),
        employeeId: op.employeeId.toString(),
        employee: { ...op.employee, id: op.employee.id.toString() },
      })) : [],
    };
  }

  /**
   * Get assignment history for a specific Machine
   */
  static async getHistoryByMachine(machineId: string) {
    const rawList = await prisma.machineOperationAssignment.findMany({
      where: { machineId },
      orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
      include: {
        machine: true,
        shift: true,
        inchargeRole: true,
        inchargeEmployee: true,
        operators: {
          include: {
            role: true,
            employee: true,
          },
        },
      },
    });

    return rawList.map((a) => ({
      ...a,
      id: a.id.toString(),
      inchargeEmployeeId: a.inchargeEmployeeId ? a.inchargeEmployeeId.toString() : null,
      operators: a.operators ? a.operators.map((op: any) => ({
        ...op,
        id: op.id.toString(),
        assignmentId: op.assignmentId.toString(),
        employeeId: op.employeeId.toString(),
        employee: { ...op.employee, id: op.employee.id.toString() },
      })) : [],
      inchargeEmployee: a.inchargeEmployee
        ? { ...a.inchargeEmployee, id: a.inchargeEmployee.id.toString() }
        : null,
    }));
  }

  /**
   * Get Current active assignment for a Machine
   */
  static async getCurrentByMachine(machineId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();

    const currentRaw = await prisma.machineOperationAssignment.findFirst({
      where: {
        machineId,
        isActive: true,
        weekStartDate: { lte: targetDate },
        weekEndDate: { gte: targetDate },
      },
      orderBy: { createdAt: "desc" },
      include: {
        machine: true,
        shift: true,
        inchargeRole: true,
        inchargeEmployee: true,
        operators: {
          include: {
            role: true,
            employee: true,
          },
        },
      },
    });

    if (!currentRaw) {
      // Fallback: get latest active assignment for machine
      const latestRaw = await prisma.machineOperationAssignment.findFirst({
        where: { machineId, isActive: true },
        orderBy: { weekStartDate: "desc" },
        include: {
          machine: true,
          shift: true,
          inchargeRole: true,
          inchargeEmployee: true,
          operators: {
            include: {
              role: true,
              employee: true,
            },
          },
        },
      });

      if (!latestRaw) return null;

      let machineOperatorName = latestRaw.machine?.operatorId;
      if (latestRaw.machine?.operatorId) {
        try {
          const emp = await prisma.employee.findUnique({ where: { id: BigInt(latestRaw.machine.operatorId as string) }});
          if (emp) machineOperatorName = emp.fullName;
        } catch (e) {}
      }

      return {
        ...latestRaw,
        machine: latestRaw.machine ? { ...latestRaw.machine, operatorName: machineOperatorName } : null,
        id: latestRaw.id.toString(),
        inchargeEmployeeId: latestRaw.inchargeEmployeeId ? latestRaw.inchargeEmployeeId.toString() : null,
        operators: latestRaw.operators ? latestRaw.operators.map((op: any) => ({
          ...op,
          id: op.id.toString(),
          assignmentId: op.assignmentId.toString(),
          employeeId: op.employeeId.toString(),
          employee: { ...op.employee, id: op.employee.id.toString() },
        })) : [],
        inchargeEmployee: latestRaw.inchargeEmployee
          ? { ...latestRaw.inchargeEmployee, id: latestRaw.inchargeEmployee.id.toString() }
          : null,
      };
    }

    let machineOperatorName = currentRaw.machine?.operatorId;
    if (currentRaw.machine?.operatorId) {
      try {
        const emp = await prisma.employee.findUnique({ where: { id: BigInt(currentRaw.machine.operatorId as string) }});
        if (emp) machineOperatorName = emp.fullName;
      } catch (e) {}
    }

    return {
      ...currentRaw,
      machine: currentRaw.machine ? { ...currentRaw.machine, operatorName: machineOperatorName } : null,
      id: currentRaw.id.toString(),
      inchargeEmployeeId: currentRaw.inchargeEmployeeId ? currentRaw.inchargeEmployeeId.toString() : null,
      operators: currentRaw.operators ? currentRaw.operators.map((op: any) => ({
        ...op,
        id: op.id.toString(),
        assignmentId: op.assignmentId.toString(),
        employeeId: op.employeeId.toString(),
        employee: { ...op.employee, id: op.employee.id.toString() },
      })) : [],
      inchargeEmployee: currentRaw.inchargeEmployee
        ? { ...currentRaw.inchargeEmployee, id: currentRaw.inchargeEmployee.id.toString() }
        : null,
    };
  }

  /**
   * Resolve active assignment for a machine, shift, and date
   */
  static async resolveAssignment(machineId: string, shiftCode: string, dateInput: string | Date) {
    const targetDate = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

    const shift = await prisma.shift.findUnique({
      where: { shiftCode },
    });
    if (!shift) {
      throw new ApiError(404, `Shift with code ${shiftCode} not found`);
    }

    const assignment = await prisma.machineOperationAssignment.findFirst({
      where: {
        machineId,
        shiftId: shift.shiftCode,
        isActive: true,
        weekStartDate: { lte: targetDate },
        weekEndDate: { gte: targetDate },
      },
      include: {
        machine: true,
        shift: true,
        inchargeEmployee: true,
        operators: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!assignment) {
      return null;
    }

    return {
      assignmentId: assignment.id.toString(),
      machine: assignment.machine,
      shift: assignment.shift,
      operators: assignment.operators.map((op) => ({
        id: op.employee.id.toString(),
        empCode: op.employee.empCode,
        fullName: op.employee.fullName,
        status: op.employee.status,
      })),
      shiftIncharge: assignment.inchargeEmployee ? {
        id: assignment.inchargeEmployee.id.toString(),
        empCode: assignment.inchargeEmployee.empCode,
        fullName: assignment.inchargeEmployee.fullName,
        status: assignment.inchargeEmployee.status,
      } : null,
    };
  }

  static async getAssignmentById(id: string) {
    const assignment = await prisma.machineOperationAssignment.findUnique({
      where: { id: BigInt(id) },
      include: {
        machine: true,
        shift: true,
        inchargeRole: { select: { id: true, name: true, code: true } },
        inchargeEmployee: { select: { id: true, empCode: true, fullName: true, email: true } },
        operators: {
          include: {
            role: { select: { id: true, name: true, code: true } },
            employee: { select: { id: true, empCode: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new ApiError(404, "Machine Operation Assignment not found");
    }

    return {
      ...assignment,
      id: assignment.id.toString(),
      inchargeEmployeeId: assignment.inchargeEmployeeId ? assignment.inchargeEmployeeId.toString() : null,
      inchargeEmployee: assignment.inchargeEmployee
        ? { ...assignment.inchargeEmployee, id: assignment.inchargeEmployee.id.toString() }
        : null,
      operators: assignment.operators ? assignment.operators.map((op: any) => ({
        ...op,
        id: op.id.toString(),
        assignmentId: op.assignmentId.toString(),
        employeeId: op.employeeId.toString(),
        employee: { ...op.employee, id: op.employee.id.toString() },
      })) : [],
    };
  }
}

