import { prisma } from "../../src/config/prisma";
import fs from "fs";
import path from "path";

export interface AuditLogEntry {
  timestamp: string;
  voucherId: number;
  voucherNo: string;
  refDocType: string;
  itemId: number;
  fieldUpdated: "debitLedgerId" | "creditLedgerId";
  oldLedgerId: number;
  oldLedgerCode: string;
  oldLedgerName: string;
  newLedgerId: number;
  newLedgerCode: string;
  newLedgerName: string;
  amount: number;
  status: "SUCCESS" | "DRY_RUN" | "SKIPPED";
}

export async function runFixReturnRefundVouchersMigration(dryRun: boolean = false) {
  console.log(`\n======================================================`);
  console.log(`Starting Fix Return Refund Vouchers Migration Script (Dry Run: ${dryRun})`);
  console.log(`======================================================\n`);

  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const auditLogFile = path.join(logsDir, "fixReturnRefundVouchers_audit.log");

  // Step 1: Find Sales Return ledger (SRT-001) and Purchase Return ledger (PRT-001)
  let salesReturnLedger = await prisma.accountLedger.findUnique({ where: { code: "SRT-001" } });
  if (!salesReturnLedger) {
    salesReturnLedger = await prisma.accountLedger.findFirst({
      where: { name: { contains: "Sales Return", mode: "insensitive" } },
    });
  }

  let purchaseReturnLedger = await prisma.accountLedger.findUnique({ where: { code: "PRT-001" } });
  if (!purchaseReturnLedger) {
    purchaseReturnLedger = await prisma.accountLedger.findFirst({
      where: { name: { contains: "Purchase Return", mode: "insensitive" } },
    });
  }

  if (!salesReturnLedger) {
    throw new Error("Sales Return ledger (SRT-001) not found in system. Migration aborted.");
  }

  console.log(`Sales Return Ledger: [${salesReturnLedger.code}] ${salesReturnLedger.name} (ID: ${salesReturnLedger.id})`);
  if (purchaseReturnLedger) {
    console.log(`Purchase Return Ledger: [${purchaseReturnLedger.code}] ${purchaseReturnLedger.name} (ID: ${purchaseReturnLedger.id})`);
  }

  // Step 2: Audit Sales & Purchase Return Refund Vouchers where party ledger is STILL referenced
  const candidateVouchers = await prisma.voucher.findMany({
    where: {
      OR: [
        { refDocType: { in: ["SALES_RETURN_REFUND", "PURCHASE_RETURN_REFUND"] } },
        { narration: { contains: "Refund paid to", mode: "insensitive" } },
        { narration: { contains: "Refund received from", mode: "insensitive" } },
      ],
      // Strict Idempotency Query Guard: Only return vouchers where line items STILL point to a Party Ledger
      items: {
        some: {
          OR: [
            { debitLedger: { customerId: { not: null } } },
            { debitLedger: { group: { contains: "debtor", mode: "insensitive" } } },
            { creditLedger: { supplierId: { not: null } } },
            { creditLedger: { group: { contains: "creditor", mode: "insensitive" } } },
          ],
        },
      },
    },
    include: {
      items: {
        include: {
          debitLedger: true,
          creditLedger: true,
        },
      },
    },
  });

  console.log(`Found ${candidateVouchers.length} candidate voucher(s) with active party ledger references.\n`);

  const auditEntries: AuditLogEntry[] = [];
  const itemsToFix: Array<{
    itemId: number;
    voucherId: number;
    voucherNo: string;
    refDocType: string;
    fieldUpdated: "debitLedgerId" | "creditLedgerId";
    oldLedger: { id: number; code: string; name: string };
    newLedger: { id: number; code: string; name: string };
    amount: number;
  }> = [];

  for (const voucher of candidateVouchers) {
    for (const item of voucher.items) {
      // Case A: Sales Return Refund incorrectly debiting Customer Ledger -> Change to Sales Return A/c
      if (item.debitLedger && (item.debitLedger.customerId != null || item.debitLedger.group.toLowerCase().includes("debtor"))) {
        itemsToFix.push({
          itemId: item.id,
          voucherId: voucher.id,
          voucherNo: voucher.voucherNo,
          refDocType: voucher.refDocType || "SALES_RETURN_REFUND",
          fieldUpdated: "debitLedgerId",
          oldLedger: { id: item.debitLedger.id, code: item.debitLedger.code, name: item.debitLedger.name },
          newLedger: { id: salesReturnLedger.id, code: salesReturnLedger.code, name: salesReturnLedger.name },
          amount: Number(item.debitAmount),
        });
      }

      // Case B: Purchase Return Refund incorrectly crediting Supplier Ledger -> Change to Purchase Return A/c
      if (purchaseReturnLedger && item.creditLedger && (item.creditLedger.supplierId != null || item.creditLedger.group.toLowerCase().includes("creditor"))) {
        itemsToFix.push({
          itemId: item.id,
          voucherId: voucher.id,
          voucherNo: voucher.voucherNo,
          refDocType: voucher.refDocType || "PURCHASE_RETURN_REFUND",
          fieldUpdated: "creditLedgerId",
          oldLedger: { id: item.creditLedger.id, code: item.creditLedger.code, name: item.creditLedger.name },
          newLedger: { id: purchaseReturnLedger.id, code: purchaseReturnLedger.code, name: purchaseReturnLedger.name },
          amount: Number(item.creditAmount),
        });
      }
    }
  }

  console.log(`Identified ${itemsToFix.length} incorrect journal line item(s) to fix.`);

  if (itemsToFix.length === 0) {
    console.log(`✅ All return refund vouchers are already clean and correct. No changes needed.`);
    return;
  }

  // Step 3: Transactional Execution & Audit Trail Logging
  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      for (const fix of itemsToFix) {
        await tx.journalItem.update({
          where: { id: fix.itemId },
          data: { [fix.fieldUpdated]: fix.newLedger.id },
        });

        const entry: AuditLogEntry = {
          timestamp: new Date().toISOString(),
          voucherId: fix.voucherId,
          voucherNo: fix.voucherNo,
          refDocType: fix.refDocType,
          itemId: fix.itemId,
          fieldUpdated: fix.fieldUpdated,
          oldLedgerId: fix.oldLedger.id,
          oldLedgerCode: fix.oldLedger.code,
          oldLedgerName: fix.oldLedger.name,
          newLedgerId: fix.newLedger.id,
          newLedgerCode: fix.newLedger.code,
          newLedgerName: fix.newLedger.name,
          amount: fix.amount,
          status: "SUCCESS",
        };
        auditEntries.push(entry);
        console.log(`[FIXED] Voucher ${fix.voucherNo} (${fix.itemId}): ${fix.fieldUpdated} changed from [${fix.oldLedger.code}] to [${fix.newLedger.code}] (₹${fix.amount})`);
      }
    });

    // Write audit log file
    const logContent = auditEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.appendFileSync(auditLogFile, logContent, "utf8");
    console.log(`\n📄 Written ${auditEntries.length} audit record(s) to persistent log file: ${auditLogFile}`);
  } else {
    for (const fix of itemsToFix) {
      console.log(`[DRY RUN] Would update Voucher ${fix.voucherNo} (${fix.itemId}): ${fix.fieldUpdated} [${fix.oldLedger.code}] -> [${fix.newLedger.code}] (₹${fix.amount})`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`Migration Execution Complete.`);
  console.log(`======================================================\n`);
}

// CLI Execution
declare const require: any;
if (require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  runFixReturnRefundVouchersMigration(isDryRun)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
