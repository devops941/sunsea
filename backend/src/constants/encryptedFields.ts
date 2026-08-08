/**
 * Encrypted field name constants.
 *
 * These constants map logical names to their masked database column names.
 * Column names are intentionally neutral — they carry no business meaning.
 *
 * EmployeePayrollConfig encrypted columns:
 *   xc_val_a → encrypted cash salary amount
 *
 * PayrollResult encrypted columns:
 *   xr_net   → encrypted combined net payable
 *   xr_gross → encrypted combined gross amount
 *   xr_flag  → boolean — whether an extended component exists (not encrypted)
 *
 * Usage:
 *   import { ENC_FIELDS } from "@/constants/encryptedFields";
 *   prisma.employeePayrollConfig.update({ data: { [ENC_FIELDS.CONFIG_AMOUNT]: encrypted } })
 */

export const ENC_FIELDS = {
  // EmployeePayrollConfig
  CONFIG_AMOUNT: "xc_val_a",

  // PayrollResult
  RESULT_NET:   "xr_net",
  RESULT_GROSS: "xr_gross",
  RESULT_FLAG:  "xr_flag",
} as const;

export type EncFieldKey = keyof typeof ENC_FIELDS;
export type EncFieldColumn = typeof ENC_FIELDS[EncFieldKey];
