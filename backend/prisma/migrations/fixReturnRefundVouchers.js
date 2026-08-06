"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFixReturnRefundVouchersMigration = runFixReturnRefundVouchersMigration;
const prisma_1 = require("../../src/config/prisma");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function runFixReturnRefundVouchersMigration(dryRun = false) {
    console.log(`\n======================================================`);
    console.log(`Starting Fix Return Refund Vouchers Migration Script (Dry Run: ${dryRun})`);
    console.log(`======================================================\n`);
    const logsDir = path_1.default.join(__dirname, "logs");
    if (!fs_1.default.existsSync(logsDir)) {
        fs_1.default.mkdirSync(logsDir, { recursive: true });
    }
    const auditLogFile = path_1.default.join(logsDir, "fixReturnRefundVouchers_audit.log");
    // Step 1: Find Sales Return ledger (SRT-001) and Purchase Return ledger (PRT-001)
    let salesReturnLedger = await prisma_1.prisma.accountLedger.findUnique({ where: { code: "SRT-001" } });
    if (!salesReturnLedger) {
        salesReturnLedger = await prisma_1.prisma.accountLedger.findFirst({
            where: { name: { contains: "Sales Return", mode: "insensitive" } },
        });
    }
    let purchaseReturnLedger = await prisma_1.prisma.accountLedger.findUnique({ where: { code: "PRT-001" } });
    if (!purchaseReturnLedger) {
        purchaseReturnLedger = await prisma_1.prisma.accountLedger.findFirst({
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
    // Step 2: Audit Sales Return Refund Vouchers
    const srtRefundVouchers = await prisma_1.prisma.voucher.findMany({
        where: {
            OR: [
                { refDocType: "SALES_RETURN_REFUND" },
                { narration: { contains: "Refund paid to", mode: "insensitive" } },
            ],
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
    console.log(`Found ${srtRefundVouchers.length} potential Sales Return Refund voucher(s) to check.\n`);
    const auditEntries = [];
    const itemsToFix = [];
    for (const voucher of srtRefundVouchers) {
        for (const item of voucher.items) {
            if (item.debitLedger && (item.debitLedger.customerId != null || item.debitLedger.group.toLowerCase().includes("debtor"))) {
                itemsToFix.push({
                    itemId: item.id,
                    voucherId: voucher.id,
                    voucherNo: voucher.voucherNo,
                    refDocType: voucher.refDocType || "SALES_RETURN_REFUND",
                    oldLedger: { id: item.debitLedger.id, code: item.debitLedger.code, name: item.debitLedger.name },
                    newLedger: { id: salesReturnLedger.id, code: salesReturnLedger.code, name: salesReturnLedger.name },
                    amount: Number(item.debitAmount),
                });
            }
        }
    }
    console.log(`Identified ${itemsToFix.length} incorrect journal line item(s) debiting customer ledgers.`);
    if (itemsToFix.length === 0) {
        console.log(`✅ All return refund vouchers are already clean and correct. No changes needed.`);
        return;
    }
    // Step 3: Transactional Execution
    if (!dryRun) {
        await prisma_1.prisma.$transaction(async (tx) => {
            for (const fix of itemsToFix) {
                await tx.journalItem.update({
                    where: { id: fix.itemId },
                    data: { debitLedgerId: fix.newLedger.id },
                });
                const entry = {
                    timestamp: new Date().toISOString(),
                    voucherId: fix.voucherId,
                    voucherNo: fix.voucherNo,
                    refDocType: fix.refDocType,
                    itemId: fix.itemId,
                    fieldUpdated: "debitLedgerId",
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
                console.log(`[FIXED] Voucher ${fix.voucherNo} (${fix.itemId}): Debit ledger changed from [${fix.oldLedger.code}] to [${fix.newLedger.code}] (₹${fix.amount})`);
            }
        });
        // Write audit log file
        const logContent = auditEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
        fs_1.default.appendFileSync(auditLogFile, logContent, "utf8");
        console.log(`\n📄 Written ${auditEntries.length} audit record(s) to persistent log file: ${auditLogFile}`);
    }
    else {
        for (const fix of itemsToFix) {
            console.log(`[DRY RUN] Would update Voucher ${fix.voucherNo} (${fix.itemId}): Debit ledger [${fix.oldLedger.code}] -> [${fix.newLedger.code}] (₹${fix.amount})`);
        }
    }
    console.log(`\n======================================================`);
    console.log(`Migration Execution Complete.`);
    console.log(`======================================================\n`);
}
// CLI Execution
if (require.main === module) {
    const isDryRun = process.argv.includes("--dry-run");
    runFixReturnRefundVouchersMigration(isDryRun)
        .then(() => process.exit(0))
        .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
}
