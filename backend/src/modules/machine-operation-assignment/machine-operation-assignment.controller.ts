import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { MachineOperationAssignmentService } from "./machine-operation-assignment.service";
import {
  createMachineAssignmentSchema,
  updateMachineAssignmentSchema,
} from "./machine-operation-assignment.validation";
import { getIO } from "../../socket/socket";

export class MachineOperationAssignmentController {
  static getRoles = asyncHandler(async (_req: Request, res: Response) => {
    const roles = await MachineOperationAssignmentService.getRoles();
    res.json({
      success: true,
      data: roles,
    });
  });

  static getEmployeesByRole = asyncHandler(async (req: Request, res: Response) => {
    const roleId = req.query.roleId ? Number(req.query.roleId) : undefined;
    const employees = await MachineOperationAssignmentService.getEmployeesByRole(roleId);
    res.json({
      success: true,
      data: employees,
    });
  });

  static getAssignments = asyncHandler(async (req: Request, res: Response) => {
    const result = await MachineOperationAssignmentService.getAssignments(req.query);
    res.json({
      success: true,
      data: result.assignments,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  });

  static createAssignment = asyncHandler(async (req: any, res: Response) => {
    const validatedData = createMachineAssignmentSchema.parse(req.body);
    const userId = req.user?.userId || req.user?.id || "SYSTEM";

    const assignment = await MachineOperationAssignmentService.createAssignment(
      validatedData,
      userId
    );

    const safeAssignment = JSON.parse(JSON.stringify(assignment, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("machineOperationAssignment:created", safeAssignment);

    res.status(201).json({
      success: true,
      message: "Machine Operation Assignment created successfully",
      data: assignment,
    });
  });

  static updateAssignment = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const validatedData = updateMachineAssignmentSchema.parse(req.body);
    const userId = req.user?.userId || req.user?.id || "SYSTEM";

    const assignment = await MachineOperationAssignmentService.updateAssignment(
      id,
      validatedData,
      userId
    );

    const safeAssignment = JSON.parse(JSON.stringify(assignment, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("machineOperationAssignment:updated", safeAssignment);

    res.json({
      success: true,
      message: "Machine Operation Assignment updated successfully",
      data: assignment,
    });
  });

  static toggleStatus = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const userId = req.user?.userId || req.user?.id || "SYSTEM";

    const assignment = await MachineOperationAssignmentService.toggleStatus(
      id,
      Boolean(isActive),
      userId
    );

    const safeAssignment = JSON.parse(JSON.stringify(assignment, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("machineOperationAssignment:updated", safeAssignment);

    res.json({
      success: true,
      message: `Assignment ${isActive ? "activated" : "closed"} successfully`,
      data: assignment,
    });
  });

  static getHistoryByMachine = asyncHandler(async (req: Request, res: Response) => {
    const machineId = Array.isArray(req.params.machineId) ? req.params.machineId[0] : String(req.params.machineId);
    const history = await MachineOperationAssignmentService.getHistoryByMachine(machineId);
    res.json({
      success: true,
      data: history,
    });
  });

  static getCurrentByMachine = asyncHandler(async (req: Request, res: Response) => {
    const machineId = Array.isArray(req.params.machineId) ? req.params.machineId[0] : String(req.params.machineId);
    const date = typeof req.query.date === "string" ? req.query.date : undefined;

    const current = await MachineOperationAssignmentService.getCurrentByMachine(
      machineId,
      date
    );

    res.json({
      success: true,
      data: current,
    });
  });

  static resolveAssignment = asyncHandler(async (req: Request, res: Response) => {
    const { machineId, shiftId, date } = req.query;
    if (!machineId || !shiftId) {
      throw new ApiError(400, "machineId and shiftId are required");
    }

    const assignment = await MachineOperationAssignmentService.resolveAssignment(
      String(machineId),
      String(shiftId),
      date ? String(date) : new Date()
    );

    res.json({
      success: true,
      data: assignment,
    });
  });

  static getAssignmentById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const assignment = await MachineOperationAssignmentService.getAssignmentById(String(id));
    res.json({
      success: true,
      data: assignment,
    });
  });
}
