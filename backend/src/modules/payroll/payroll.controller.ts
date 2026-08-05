import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { payrollService } from './payroll.service';
import { prisma } from '../../config/prisma';

class PayrollController {

  // ── Payroll Config ───────────────────────────────────────────────────────────

  getConfig = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) throw new ApiError(404, 'Company not found');
    const config = await payrollService.getConfig(company.id);
    res.json(new ApiResponse('Payroll config fetched', config));
  });

  updateConfig = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) throw new ApiError(404, 'Company not found');
    const config = await payrollService.updateConfig(company.id, req.body);
    res.json(new ApiResponse('Payroll config updated', config));
  });

  // ── Employee Payroll ─────────────────────────────────────────────────────────

  listEmployees = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query as { category?: string };
    const employees = await payrollService.listEmployeesWithPayroll(category);
    res.json(new ApiResponse('Employees fetched', employees));
  });

  getEmployeeConfig = asyncHandler(async (req: Request, res: Response) => {
    const empId = BigInt(String(req.params.employeeId));
    const config = await payrollService.getEmployeePayrollConfig(empId);
    res.json(new ApiResponse('Employee payroll config fetched', config));
  });

  upsertEmployeeConfig = asyncHandler(async (req: Request, res: Response) => {
    const empId = BigInt(String(req.params.employeeId));
    const config = await payrollService.upsertEmployeePayrollConfig(empId, req.body);
    res.json(new ApiResponse('Employee payroll config updated', config));
  });

  // ── Attendance ───────────────────────────────────────────────────────────────

  getAttendance = asyncHandler(async (req: Request, res: Response) => {
    const { period, employeeId } = req.query as { period: string; employeeId?: string };
    if (!period) throw new ApiError(400, 'period is required');
    const records = await payrollService.getAttendance(
      period,
      employeeId ? BigInt(employeeId) : undefined
    );
    res.json(new ApiResponse('Attendance fetched', records));
  });

  bulkUpsertAttendance = asyncHandler(async (req: Request, res: Response) => {
    const { period, records } = req.body;
    const mapped = records.map((r: any) => ({
      employeeId:        BigInt(r.employeeId),
      date:              r.date,
      period,
      status:            r.status,
      otHours:           r.otHours ?? 0,
      lateMinutes:       r.lateMinutes ?? 0,
      permissionMinutes: r.permissionMinutes ?? 0,
      salaryAdvance:     r.salaryAdvance ?? 0,
    }));
    const result = await payrollService.bulkUpsertAttendance(mapped);
    res.json(new ApiResponse('Attendance saved', { count: result.length }));
  });

  // ── Payroll Run ──────────────────────────────────────────────────────────────

  listRuns = asyncHandler(async (req: Request, res: Response) => {
    const { period, type, status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const result = await payrollService.listRuns({
      period, type, status,
      page:  parseInt(page,  10),
      limit: parseInt(limit, 10),
    });
    res.json(new ApiResponse('Payroll runs fetched', result));
  });

  getRun = asyncHandler(async (req: Request, res: Response) => {
    const id  = parseInt(String(req.params.id), 10);
    const run = await payrollService.getRun(id);
    res.json(new ApiResponse('Payroll run fetched', run));
  });

  computeRun = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) throw new ApiError(404, 'Company not found');

    const userId = (req as any).user?.userId ?? 'unknown';
    const { period, type, employeeCategory, calendarDays, attendance } = req.body;

    const run = await payrollService.computeRun({
      period,
      type,
      employeeCategory: employeeCategory ?? 'ALL',
      calendarDays:     calendarDays     ?? 31,
      attendance:       attendance       ?? [],
      createdById:      userId,
      companyId:        company.id,
    });

    res.status(201).json(new ApiResponse('Payroll computed successfully', run));
  });

  approveRun = asyncHandler(async (req: Request, res: Response) => {
    const id     = parseInt(String(req.params.id), 10);
    const userId = (req as any).user?.userId ?? 'unknown';
    const run    = await payrollService.approveRun(id, userId);
    res.json(new ApiResponse('Payroll run approved', run));
  });

  lockRun = asyncHandler(async (req: Request, res: Response) => {
    const id     = parseInt(String(req.params.id), 10);
    const userId = (req as any).user?.userId ?? 'unknown';
    const run    = await payrollService.lockRun(id, userId);
    res.json(new ApiResponse('Payroll run locked', run));
  });

  deleteRun = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    await payrollService.deleteRun(id);
    res.json(new ApiResponse('Payroll run deleted'));
  });

  getPayslip = asyncHandler(async (req: Request, res: Response) => {
    const runId    = parseInt(String(req.params.id),       10);
    const resultId = parseInt(String(req.params.resultId), 10);
    const data = await payrollService.getPayslip(runId, resultId);
    res.json(new ApiResponse('Payslip fetched', data));
  });

  // ── Salary Advances ──────────────────────────────────────────────────────────

  listAdvances = asyncHandler(async (req: Request, res: Response) => {
    const { employeeId, status, dateFrom, dateTo } = req.query as {
      employeeId?: string; status?: string; dateFrom?: string; dateTo?: string;
    };
    const advances = await payrollService.listAdvances(
      employeeId ? BigInt(employeeId) : undefined,
      status,
      dateFrom,
      dateTo,
    );
    res.json(new ApiResponse('Advances fetched', advances));
  });

  createAdvance = asyncHandler(async (req: Request, res: Response) => {
    const { employeeId, amount, disbursedDate, reason } = req.body;
    const advance = await payrollService.createAdvance({
      employeeId: BigInt(employeeId),
      amount: Number(amount),
      disbursedDate: new Date(disbursedDate),
      reason,
    });
    res.status(201).json(new ApiResponse('Advance created', advance));
  });

  deleteAdvance = asyncHandler(async (req: Request, res: Response) => {
    await payrollService.deleteAdvance(parseInt(String(req.params.id), 10));
    res.json(new ApiResponse('Advance deleted', null));
  });
}

export const payrollController = new PayrollController();
