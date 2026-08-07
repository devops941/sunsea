import { Request, Response } from "express";

import employeeService from "./employee.service";
import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { getIO } from "../../socket/socket";
import { uploadToImageKit } from "../../config/imagekit";

// ─── Helpers for FormData parsing ────────────────────────────────────────────

function parseBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

function parseNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

function parseNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "null") return null;
  return String(value);
}

/**
 * Parse all employee fields from a multipart/form-data request body.
 * String values that are "null" or empty become null.
 * Numeric / boolean strings are coerced to the correct JS type.
 */
/**
 * Convert "YYYY-MM-DD" string to a Date object (noon UTC to avoid TZ drift).
 * Returns null for empty/null/invalid values.
 */
function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "" || value === "null") return null;
  const str = String(value).trim();
  // Accept "YYYY-MM-DD" or full ISO strings
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str}T12:00:00.000Z` : str);
  return isNaN(d.getTime()) ? null : d;
}

function parseEmployeeBody(body: Record<string, any>) {
  const parsed: Record<string, any> = {};

  // ── Text fields passed through as-is (nullify empty strings) ──────────────
  const textFields = [
    "empCode", "fullName", "mobile", "email",
    "photoUrl",
    "bloodGroup", "gender", "maritalStatus", "status",
    "personalMobile", "personalEmail",
    "emergencyContactName", "emergencyContactNumber",
    "fatherName", "motherName", "spouseName", "guardianName", "guardianRelationship",
    "aadhaarNumber", "panNumber", "drivingLicense", "voterId",
    "permanentAddressLine1", "permanentAddressLine2",
    "permanentCity", "permanentState", "permanentPincode",
    "presentAddressLine1", "presentAddressLine2",
    "presentCity", "presentState", "presentPincode",
    "designation", "employeeType",
    "previousExperience",
    "shiftId",
    "salaryType", "paymentMode",
    "bankName", "bankBranch", "accountNumber", "ifscCode", "accountHolderName",
    "pfNumber", "uanNumber", "esiNumber",
  ];

  for (const field of textFields) {
    if (field in body) {
      parsed[field] = parseNullableString(body[field]);
    }
  }

  // ── Date fields — Prisma DateTime requires a Date object, not a bare "YYYY-MM-DD" string ──
  if ("dateOfJoining" in body) parsed.dateOfJoining = parseDate(body.dateOfJoining);
  if ("dateOfBirth"   in body) parsed.dateOfBirth   = parseDate(body.dateOfBirth);
  if ("relievingDate" in body) parsed.relievingDate  = parseDate(body.relievingDate);

  // ── Numeric fields ─────────────────────────────────────────────────────────
  if ("departmentId" in body) parsed.departmentId = parseNum(body.departmentId) ?? null;
  if ("roleId" in body) parsed.roleId = parseNum(body.roleId) ?? null;
  if ("probationPeriod" in body) parsed.probationPeriod = parseNum(body.probationPeriod) ?? null;
  if ("noticePeriod" in body) parsed.noticePeriod = parseNum(body.noticePeriod) ?? null;
  if ("basicSalary" in body) parsed.basicSalary = parseNum(body.basicSalary) ?? null;
  if ("da" in body) parsed.da = parseNum(body.da) ?? null;
  if ("hra" in body) parsed.hra = parseNum(body.hra) ?? null;
  if ("otherAllowance" in body) parsed.otherAllowance = parseNum(body.otherAllowance) ?? null;
  if ("grossSalary" in body) parsed.grossSalary = parseNum(body.grossSalary) ?? null;

  // ── Boolean fields ─────────────────────────────────────────────────────────
  if ("pfApplicable" in body) parsed.pfApplicable = parseBool(body.pfApplicable);
  if ("esiApplicable" in body) parsed.esiApplicable = parseBool(body.esiApplicable);
  if ("professionalTax" in body) parsed.professionalTax = parseBool(body.professionalTax);
  if ("tdsApplicable" in body) parsed.tdsApplicable = parseBool(body.tdsApplicable);
  if ("createLoginAccount" in body) parsed.createLoginAccount = parseBool(body.createLoginAccount);

  // Photo upload is handled in the controller via ImageKit (async).

  // ── Normalize lowercase enums expected by Prisma ─────────────────────────────
  const lowercaseEnums = ["salaryType", "employeeType", "status", "gender", "maritalStatus"];
  for (const field of lowercaseEnums) {
    if (parsed[field] && typeof parsed[field] === "string") {
      parsed[field] = parsed[field].toLowerCase();
    }
  }

  // ── Nested loginAccount (may arrive as JSON string from FormData) ──────────
  if ("loginAccount" in body) {
    const la = body.loginAccount;
    if (la === null || la === "" || la === "null") {
      parsed.loginAccount = null;
    } else if (typeof la === "string") {
      try {
        parsed.loginAccount = JSON.parse(la);
      } catch {
        parsed.loginAccount = null;
      }
    } else {
      parsed.loginAccount = la;
    }
  }

  return parsed;
}

// ─── Controller ───────────────────────────────────────────────────────────────

class EmployeeController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const data = parseEmployeeBody(req.body);

    // Upload profile photo to ImageKit if provided
    if (req.file?.buffer) {
      try {
        const ext = req.file.mimetype.split('/')[1] || 'jpg';
        data.photoUrl = await uploadToImageKit(
          req.file.buffer,
          `emp-${Date.now()}.${ext}`,
          '/sunsea-erp/employees',
        );
      } catch (err) {
        console.error("ImageKit upload failed:", err);
        // fall through — employee saved without photo
      }
    }

    const employee = await employeeService.create(data);

    getIO().emit("employee:created", employee);

    return res.status(201).json(new ApiResponse("Employee created successfully", employee));
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { search, departmentId, page, limit } = req.query;

    const employees = await employeeService.findAll({
      search: search as string | undefined,
      departmentId: departmentId ? parseInt(departmentId as string, 10) : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });

    return res.status(200).json(new ApiResponse("Employees fetched successfully", employees));
  });

  getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }

    const { userId } = req.user;
    const isAdmin = userId.startsWith("admin_");

    if (isAdmin) {
      const adminId = BigInt(userId.replace("admin_", ""));
      const adminRecord = await prisma.admin.findUnique({ where: { id: adminId } });

      if (!adminRecord) {
        throw new ApiError(404, "Admin record not found");
      }

      return res.status(200).json(
        new ApiResponse("Profile fetched successfully", {
          fullName: adminRecord.fullName,
          empCode: "ADMIN",
          department: { name: "System Administration" },
          designation: { name: "Super Admin" },
          dateOfJoining: adminRecord.createdAt,
          createdAt: adminRecord.createdAt,
          status: adminRecord.status,
          mobile: adminRecord.phone,
          email: adminRecord.email,
          roles: [{ role: { name: "Super Admin" } }],
        })
      );
    }

    const userRecord = await prisma.user.findUnique({
      where: { userId },
      select: { employeeId: true },
    });

    if (!userRecord?.employeeId) {
      throw new ApiError(404, "No employee record linked to this account");
    }

    const employee = await employeeService.findById(userRecord.employeeId);

    return res.status(200).json(new ApiResponse("Profile fetched successfully", employee));
  });

  getNextCode = asyncHandler(async (_req: Request, res: Response) => {
    const nextCode = await employeeService.getNextEmployeeCode();
    return res.status(200).json(new ApiResponse("Next employee code fetched successfully", { nextCode }));
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(String(req.params.id));
    const employee = await employeeService.findById(id);
    return res.status(200).json(new ApiResponse("Employee fetched successfully", employee));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(String(req.params.id));
    const data = parseEmployeeBody(req.body);

    // Upload new profile photo to ImageKit if provided
    if (req.file?.buffer) {
      try {
        const ext = req.file.mimetype.split('/')[1] || 'jpg';
        data.photoUrl = await uploadToImageKit(
          req.file.buffer,
          `emp-${Date.now()}.${ext}`,
          '/sunsea-erp/employees',
        );
      } catch (err) {
        console.error("ImageKit upload failed:", err);
      }
    }

    const employee = await employeeService.update(id, data);

    getIO().emit("employee:updated", employee);

    return res.status(200).json(new ApiResponse("Employee updated successfully", employee));
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(String(req.params.id));

    await employeeService.delete(id);

    getIO().emit("employee:deleted", { id: id.toString() });

    return res.status(200).json(new ApiResponse("Employee deleted successfully"));
  });
}

export default new EmployeeController();
