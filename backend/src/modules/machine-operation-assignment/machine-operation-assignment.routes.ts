import { Router } from "express";
import { MachineOperationAssignmentController } from "./machine-operation-assignment.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/roles", requirePermission("machine-assignments.view"), MachineOperationAssignmentController.getRoles);
router.get("/employees-by-role", requirePermission("machine-assignments.view"), MachineOperationAssignmentController.getEmployeesByRole);
router.get("/resolve", requirePermission("machine-assignments.view"), MachineOperationAssignmentController.resolveAssignment);

router.get("/", requirePermission("machine-assignments.view"), MachineOperationAssignmentController.getAssignments);
router.get("/:id", requirePermission("machine-assignments.view"), MachineOperationAssignmentController.getAssignmentById);
router.post("/", requirePermission("machine-assignments.create"), MachineOperationAssignmentController.createAssignment);
router.put("/:id", requirePermission("machine-assignments.edit"), MachineOperationAssignmentController.updateAssignment);
router.patch("/:id/status", requirePermission("machine-assignments.edit"), MachineOperationAssignmentController.toggleStatus);

router.get("/machine/:machineId/history", requirePermission("machine-assignments.view"), MachineOperationAssignmentController.getHistoryByMachine);
router.get("/machine/:machineId/current", requirePermission("machine-assignments.view"), MachineOperationAssignmentController.getCurrentByMachine);

export default router;
