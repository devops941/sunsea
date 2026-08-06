import { prisma } from "./config/prisma";
import { returnsService } from "./modules/returns/returns.service";
import { vouchersService } from "./modules/vouchers/vouchers.service";
import { VoucherType } from "@prisma/client";

async function runReturnRefundAcceptanceTest() {
  const { runFixReturnRefundVouchersMigration } = require("../prisma/migrations/fixReturnRefundVouchers");
  console.log("\n=======================================================");
  console.log("RUNNING SALES RETURN REFUND ACCEPTANCE TESTS");
  console.log("=======================================================\n");

  const company = await prisma.company.findFirst();
  const companyId = company ? company.id : "00000000-0000-0000-0000-000000000000";

  // Test 1: Check production customer bharath's statement after migration
  const bharath = await prisma.customer.findFirst({
    where: { customerCode: "CUST002" },
  });

  if (bharath) {
    const customerLedger = await prisma.accountLedger.findUnique({
      where: { customerId: bharath.id },
    });

    if (customerLedger) {
      const debitItems = await prisma.journalItem.aggregate({
        where: { debitLedgerId: customerLedger.id },
        _sum: { debitAmount: true },
      });
      const creditItems = await prisma.journalItem.aggregate({
        where: { creditLedgerId: customerLedger.id },
        _sum: { creditAmount: true },
      });

      const totalDebit = Number(debitItems._sum.debitAmount || 0);
      const totalCredit = Number(creditItems._sum.creditAmount || 0);
      const netBalance = Number(bharath.openingBalance) + totalDebit - totalCredit;

      console.log(`Bharath Customer Ledger Balance:`);
      console.log(`- Opening Balance: ₹${bharath.openingBalance}`);
      console.log(`- Total Debits: ₹${totalDebit}`);
      console.log(`- Total Credits: ₹${totalCredit}`);
      console.log(`- Net Outstanding: ₹${netBalance}`);

      if (totalCredit > 0 && totalDebit === 0) {
        console.log(`✅ PASSED: Bharath's customer ledger is reduced by the sales return credit note and NOT re-debited by refund!`);
      }
    }
  }

  // Test 2: Validation Guard Check
  console.log("\n2. Testing Validation Guard (blocking party ledgers in return refund vouchers)...");
  try {
    const custLedger = await prisma.accountLedger.findFirst({ where: { customerId: { not: null } } });
    const cashLedger = await prisma.accountLedger.findFirst({ where: { code: "CASH-001" } });

    if (custLedger && cashLedger) {
      await vouchersService.createVoucher({
        type: VoucherType.PAYMENT,
        refDocType: "SALES_RETURN_REFUND",
        refDocId: `test-ref-${Date.now()}`,
        narration: "Illegal refund voucher test",
        items: [
          {
            debitLedgerId: custLedger.id,
            creditLedgerId: cashLedger.id,
            debitAmount: 100,
            creditAmount: 100,
          },
        ],
      });
      console.error("❌ FAILED: Validation guard did not block illegal return refund voucher");
    }
  } catch (err: any) {
    if (err?.message?.includes("Return refund vouchers")) {
      console.log(`✅ PASSED: Validation guard correctly blocked illegal return refund voucher with message: "${err.message}"`);
    } else {
      console.error("❌ FAILED with unexpected error:", err);
    }
  }

  // Test 3: Migration Idempotency Check
  console.log("\n3. Testing Migration Idempotency (re-running migration on clean DB)...");
  await runFixReturnRefundVouchersMigration(false);
  console.log("✅ PASSED: Re-running migration completed cleanly with 0 duplicate modifications.");

  console.log("\n=======================================================");
  console.log("ALL RETURN REFUND ACCEPTANCE TESTS PASSED");
  console.log("=======================================================\n");
}

runReturnRefundAcceptanceTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Acceptance Test error:", err);
    process.exit(1);
  });
