import { z } from "zod";

const loginAccountSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
  roleId: z.number(),
  mustChangePw: z.boolean().optional(),
  loginEnabled: z.boolean().optional(),
  status: z.enum(["active", "suspended", "locked"]).optional(),
});

const employeeBodySchema = z.object({
  // ── Section 1: Basic Info ────────────────────────────────────────────────
  // BUG-EMP-005 fix: added max(20) to empCode
  empCode: z
    .string()
    .min(1, "Employee code is required")
    .max(20, "Employee code must be at most 20 characters"),
  fullName: z.string().min(1, "Full name is required"),
  photoUrl: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  dateOfBirth: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"])
    .optional()
    .nullable(),
  maritalStatus: z
    .enum(["single", "married", "divorced", "widowed"])
    .optional()
    .nullable(),
  status: z
    .enum(["active", "inactive", "resigned", "retired", "terminated"])
    .optional(),

  // ── Section 2: Contact Info ───────────────────────────────────────────────
  // BUG-EMP-001 fix: mobile is now optional on backend
  mobile: z
    .string()
    .min(10, "Mobile number must be at least 10 digits")
    .optional()
    .nullable(),
  // BUG-EMP-002 fix: email is now optional on backend
  email: z.string().email("Invalid email format").optional().nullable(),
  personalMobile: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactNumber: z.string().optional().nullable(),
  emergencyContactRelationship: z.string().optional().nullable(),
  emergencyContactName2: z.string().optional().nullable(),
  emergencyContactNumber2: z.string().optional().nullable(),
  emergencyContactRelationship2: z.string().optional().nullable(),

  // ── Section 3: Family Details ─────────────────────────────────────────────
  fatherName: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  spouseName: z.string().optional().nullable(),

  // ── Section 4: Identity Documents ────────────────────────────────────────
  aadhaarNumber: z.string().optional().nullable(),
  panNumber: z.string().optional().nullable(),
  drivingLicense: z.string().optional().nullable(),

  // ── Section 5: Address ───────────────────────────────────────────────────
  permanentAddressLine1: z.string().optional().nullable(),
  permanentAddressLine2: z.string().optional().nullable(),
  permanentCity: z.string().optional().nullable(),
  permanentState: z.string().optional().nullable(),
  permanentPincode: z.string().optional().nullable(),
  presentAddressLine1: z.string().optional().nullable(),
  presentAddressLine2: z.string().optional().nullable(),
  presentCity: z.string().optional().nullable(),
  presentState: z.string().optional().nullable(),
  presentPincode: z.string().optional().nullable(),

  // ── Section 6: Official Info ─────────────────────────────────────────────
  departmentId: z.number().optional().nullable(),
  roleId: z.number().optional().nullable(),
  designation: z.string().optional().nullable(),
  employeeType: z
    .enum(["permanent", "contract", "intern", "consultant", "operator", "supervisor"])
    .optional()
    .nullable(),
  employeeCategory: z
    .enum(["office_staff", "labour"])
    .optional()
    .nullable(),

  // ── Section 7: Joining Details ────────────────────────────────────────────
  dateOfJoining: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
  relievingDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
  previousExperience: z.string().optional().nullable(),
  probationPeriod: z.number().int().optional().nullable(),
  noticePeriod: z.number().int().optional().nullable(),

  // ── Section 8: Shift ─────────────────────────────────────────────────────
  shiftId: z.string().optional().nullable(),

  // ── Section 9: Payroll & Statutory ───────────────────────────────────────
  salaryType: z.enum(["monthly", "weekly", "daily", "hourly"]).optional().nullable(),
  paymentMode: z.string().optional().nullable(),
  basicSalary: z.number().optional().nullable(),
  da: z.number().optional().nullable(),
  hra: z.number().optional().nullable(),
  otherAllowance: z.number().optional().nullable(),
  cashInHand: z.number().optional().nullable(),
  grossSalary: z.number().optional().nullable(),
  pfApplicable: z.boolean().optional(),
  pfNumber: z.string().optional().nullable(),
  uanNumber: z.string().optional().nullable(),
  esiApplicable: z.boolean().optional(),
  esiNumber: z.string().optional().nullable(),
  professionalTax: z.boolean().optional(),
  tdsApplicable: z.boolean().optional(),
  bankName: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
  accountHolderName: z.string().optional().nullable(),

  // ── Section 11: Login Account ─────────────────────────────────────────────
  createLoginAccount: z.boolean().optional(),
  loginAccount: loginAccountSchema.optional().nullable(),
});

export const createEmployeeSchema = z.object({
  body: employeeBodySchema,
});

export const updateEmployeeSchema = z.object({
  body: employeeBodySchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});

export const employeeIdSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});
