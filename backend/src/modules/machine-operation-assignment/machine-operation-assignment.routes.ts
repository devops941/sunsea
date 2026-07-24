import { Router } from "express";
import { MachineOperationAssignmentController } from "./machine-operation-assignment.controller";

const router = Router();

router.get("/roles", MachineOperationAssignmentController.getRoles);
router.get("/employees-by-role", MachineOperationAssignmentController.getEmployeesByRole);
router.get("/resolve", MachineOperationAssignmentController.resolveAssignment);

router.get("/", MachineOperationAssignmentController.getAssignments);
router.get("/:id", MachineOperationAssignmentController.getAssignmentById);
router.post("/", MachineOperationAssignmentController.createAssignment);
router.put("/:id", MachineOperationAssignmentController.updateAssignment);
router.patch("/:id/status", MachineOperationAssignmentController.toggleStatus);

router.get("/machine/:machineId/history", MachineOperationAssignmentController.getHistoryByMachine);
router.get("/machine/:machineId/current", MachineOperationAssignmentController.getCurrentByMachine);

export default router;
