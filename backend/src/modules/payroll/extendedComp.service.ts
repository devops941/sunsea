/**
 * Extended Compensation Service
 *
 * Stores a single encrypted cash salary amount per employee.
 * All values are encrypted with AES-256-GCM before touching the database.
 * This service is isolated — it does NOT touch any on-record payroll fields.
 *
 * Dependency: EmployeePayrollConfig must exist for the employee before calling
 * setExtendedCompensation (create it via upsertEmployeePayrollConfig first).
 */

import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { encryptField, decryptField } from '../../utils/fieldEncryption';
import { ENC_FIELDS } from '../../constants/encryptedFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtendedCompInput {
  offRecordAmount: number;
}

export interface ExtendedCompData {
  offRecordAmount: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ExtendedCompService {

  /**
   * Save (create or update) the encrypted cash salary for an employee.
   * Only writes to xc_val_a — all other payroll fields are untouched.
   */
  async setExtendedCompensation(
    employeeId: bigint,
    input: ExtendedCompInput
  ): Promise<void> {
    const config = await prisma.employeePayrollConfig.findUnique({
      where: { employeeId },
    });

    if (!config) {
      throw new ApiError(
        404,
        'Employee payroll configuration not found. Configure base salary first.'
      );
    }

    await (prisma.employeePayrollConfig as any).update({
      where: { employeeId },
      data: {
        [ENC_FIELDS.CONFIG_AMOUNT]: encryptField(input.offRecordAmount),
      },
    });
  }

  /**
   * Read and decrypt the cash salary for an employee.
   * Returns null when no cash salary is configured.
   * Throws on decryption failure (tampered data or wrong key).
   */
  async getExtendedCompensation(
    employeeId: bigint
  ): Promise<ExtendedCompData | null> {
    const config = await (prisma.employeePayrollConfig as any).findUnique({
      where: { employeeId },
    });

    if (!config) {
      throw new ApiError(404, 'Employee payroll configuration not found.');
    }

    const encAmount: string | null = config[ENC_FIELDS.CONFIG_AMOUNT];
    if (!encAmount) {
      return null;
    }

    try {
      return {
        offRecordAmount: Number(decryptField(encAmount)),
      };
    } catch {
      throw new ApiError(500, 'Failed to read compensation data. Contact administrator.');
    }
  }

  /**
   * Remove the cash salary for an employee.
   * Sets xc_val_a to null. Does NOT touch any on-record fields.
   */
  async clearExtendedCompensation(employeeId: bigint): Promise<void> {
    const config = await prisma.employeePayrollConfig.findUnique({
      where: { employeeId },
    });

    if (!config) {
      throw new ApiError(404, 'Employee payroll configuration not found.');
    }

    await (prisma.employeePayrollConfig as any).update({
      where: { employeeId },
      data: {
        [ENC_FIELDS.CONFIG_AMOUNT]: null,
      },
    });
  }

  /**
   * Check (without decrypting) whether an employee has a cash salary set.
   */
  hasExtendedComp(config: Record<string, unknown>): boolean {
    return typeof config[ENC_FIELDS.CONFIG_AMOUNT] === 'string';
  }
}

export const extendedCompService = new ExtendedCompService();
