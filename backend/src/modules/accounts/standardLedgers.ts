/**
 * Standard Ledger Definitions
 * ---------------------------
 * Central registry of all system-managed "parent" or "aggregate" ledgers.
 * These are the standard books-of-accounts that every Indian trading business
 * carries, and some of them are AGGREGATE accounts — clicking them should
 * display combined activity from all child party ledgers.
 *
 *  • CRED-001 "Sundry Creditors"  ← aggregate of ALL supplier ledgers
 *  • DEBT-001 "Sundry Debtors"    ← aggregate of ALL customer ledgers
 *
 * Other codes below are single-account ledgers (Cash, Bank, tax pots, etc.)
 * with no aggregation — they show only their own posted entries.
 *
 * This file is imported by:
 *   - accounts.service.getLedgerStatement()  → auto-expands aggregate parents
 *   - accounts.service.getTrialBalance()     → merges child balances into parent rows
 *   - voucherPosting.service                 → uses code constants when routing entries
 */

import { PrismaClient, Prisma } from "@prisma/client";

// ─── Standard Ledger Codes ────────────────────────────────────────────────────

export const STANDARD_LEDGER_CODES = {
  CASH: "CASH-001",
  BANK: "BANK-001",
  PETTY_CASH: "PCASH-001",
  SUNDRY_CREDITORS: "CRED-001",
  SUNDRY_DEBTORS: "DEBT-001",
  PURCHASE: "PURCH-001",
  SALES: "SALES-001",
  GENERAL_EXPENSES: "EXP-001",
  SALES_RETURN: "SRT-001",
  PURCHASE_RETURN: "PRT-001",
  CGST_PAYABLE: "CGST-LIA-001",
  SGST_PAYABLE: "SGST-LIA-001",
  IGST_PAYABLE: "IGST-LIA-001",
  CGST_INPUT: "CGST-REC-001",
  SGST_INPUT: "SGST-REC-001",
  IGST_INPUT: "IGST-REC-001",
  OPENING_EQUITY: "EQ-001",
} as const;

/**
 * The codes that are AGGREGATE parents. Clicking them in the Ledger Statement
 * should merge activity from every child ledger (party accounts).
 */
export const AGGREGATE_LEDGER_CODES = new Set<string>([
  STANDARD_LEDGER_CODES.SUNDRY_CREDITORS,
  STANDARD_LEDGER_CODES.SUNDRY_DEBTORS,
]);

// ─── Aggregate Expansion ──────────────────────────────────────────────────────

export interface AggregateExpansion {
  /** All ledger ids to query — always includes the parent's own id */
  ledgerIds: number[];
  /** Whether this ledger is an aggregate parent (Debtors/Creditors) */
  isAggregate: boolean;
  /** Human label for reports */
  label: string;
}

/**
 * Given a ledger, return the set of ledger ids whose journal items should be
 * included when displaying its statement.
 *
 * For non-aggregate ledgers → just returns [ledger.id].
 * For CRED-001 (Sundry Creditors) → all supplier ledger ids + parent id.
 * For DEBT-001 (Sundry Debtors)   → all customer ledger ids + parent id.
 */
export async function expandAggregateLedger(
  ledger: { id: number; code: string; name: string },
  db: PrismaClient | Prisma.TransactionClient
): Promise<AggregateExpansion> {
  if (!AGGREGATE_LEDGER_CODES.has(ledger.code)) {
    return { ledgerIds: [ledger.id], isAggregate: false, label: ledger.name };
  }

  if (ledger.code === STANDARD_LEDGER_CODES.SUNDRY_CREDITORS) {
    const supplierLedgers = await db.accountLedger.findMany({
      where: { supplierId: { not: null } },
      select: { id: true },
    });
    const ids = [ledger.id, ...supplierLedgers.map((l) => l.id)];
    return { ledgerIds: ids, isAggregate: true, label: `${ledger.name} (${supplierLedgers.length} suppliers)` };
  }

  if (ledger.code === STANDARD_LEDGER_CODES.SUNDRY_DEBTORS) {
    const customerLedgers = await db.accountLedger.findMany({
      where: { customerId: { not: null } },
      select: { id: true },
    });
    const ids = [ledger.id, ...customerLedgers.map((l) => l.id)];
    return { ledgerIds: ids, isAggregate: true, label: `${ledger.name} (${customerLedgers.length} customers)` };
  }

  return { ledgerIds: [ledger.id], isAggregate: false, label: ledger.name };
}

/**
 * Merge child balances into their aggregate parent for reports like Trial Balance.
 * Given raw rows keyed by ledgerId, produces a new row list where child rows
 * belonging to an aggregate parent are folded into the parent row.
 */
export interface AggregatableRow {
  ledgerId: number;
  code: string;
  name: string;
  group?: string | null;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
  closingBalance: number;
  openingBalance?: number;
  type?: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
}

export function foldChildrenIntoAggregate<T extends AggregatableRow>(
  rows: T[],
  mode: "expanded" | "collapsed"
): T[] {
  // Expanded = show individual party ledgers (default)
  // Collapsed = merge all supplier rows into Sundry Creditors, all customer rows into Sundry Debtors
  if (mode === "expanded") return rows;

  const parents = new Map<string, T>();
  const outRows: T[] = [];

  for (const row of rows) {
    if (row.code === STANDARD_LEDGER_CODES.SUNDRY_CREDITORS ||
        row.code === STANDARD_LEDGER_CODES.SUNDRY_DEBTORS) {
      parents.set(row.code, row);
    }
  }

  for (const row of rows) {
    // Fold suppliers into Sundry Creditors
    if (row.isSupplier && parents.has(STANDARD_LEDGER_CODES.SUNDRY_CREDITORS)) {
      const parent = parents.get(STANDARD_LEDGER_CODES.SUNDRY_CREDITORS)!;
      parent.totalDebit += row.totalDebit;
      parent.totalCredit += row.totalCredit;
      parent.debitBalance += row.debitBalance;
      parent.creditBalance += row.creditBalance;
      parent.closingBalance += row.closingBalance;
      continue;
    }
    // Fold customers into Sundry Debtors
    if (row.isCustomer && parents.has(STANDARD_LEDGER_CODES.SUNDRY_DEBTORS)) {
      const parent = parents.get(STANDARD_LEDGER_CODES.SUNDRY_DEBTORS)!;
      parent.totalDebit += row.totalDebit;
      parent.totalCredit += row.totalCredit;
      parent.debitBalance += row.debitBalance;
      parent.creditBalance += row.creditBalance;
      parent.closingBalance += row.closingBalance;
      continue;
    }
    outRows.push(row);
  }

  return outRows;
}
