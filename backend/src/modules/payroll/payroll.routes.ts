import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { payrollController } from './payroll.controller';
import {
  updatePayrollConfigSchema,
  upsertEmployeePayrollSchema,
  bulkUpsertAttendanceSchema,
  getAttendanceSchema,
  createPayrollRunSchema,
  runActionSchema,
  listRunsSchema,
  createAdvanceSchema,
} from './payroll.validation';

const router = Router();

// All payroll routes require authentication
router.use(authMiddleware);

// ─── Payroll Config ───────────────────────────────────────────────────────────
router.get  ('/config',         payrollController.getConfig);
router.put  ('/config',         validateMiddleware(updatePayrollConfigSchema),   payrollController.updateConfig);

// ─── Employee Payroll ─────────────────────────────────────────────────────────
router.get  ('/employees',                                                       payrollController.listEmployees);
router.get  ('/employees/:employeeId/config',                                    payrollController.getEmployeeConfig);
router.put  ('/employees/:employeeId/config', validateMiddleware(upsertEmployeePayrollSchema), payrollController.upsertEmployeeConfig);

// ─── Attendance ───────────────────────────────────────────────────────────────
router.get  ('/attendance',     validateMiddleware(getAttendanceSchema),          payrollController.getAttendance);
router.post ('/attendance',     validateMiddleware(bulkUpsertAttendanceSchema),   payrollController.bulkUpsertAttendance);

// ─── Payroll Runs ─────────────────────────────────────────────────────────────
router.get  ('/runs',           validateMiddleware(listRunsSchema),               payrollController.listRuns);
router.post ('/runs',           validateMiddleware(createPayrollRunSchema),       payrollController.computeRun);
router.get  ('/runs/:id',                validateMiddleware(runActionSchema), payrollController.getRun);
router.get  ('/runs/:id/payslip/:resultId',                                       payrollController.getPayslip);
router.post ('/runs/:id/approve',        validateMiddleware(runActionSchema), payrollController.approveRun);
router.post ('/runs/:id/lock',           validateMiddleware(runActionSchema), payrollController.lockRun);
router.delete('/runs/:id',               validateMiddleware(runActionSchema), payrollController.deleteRun);

// ─── Salary Advances ──────────────────────────────────────────────────────────
router.get   ('/advances',       payrollController.listAdvances);
router.post  ('/advances',       validateMiddleware(createAdvanceSchema), payrollController.createAdvance);
router.delete('/advances/:id',   payrollController.deleteAdvance);

export default router;
