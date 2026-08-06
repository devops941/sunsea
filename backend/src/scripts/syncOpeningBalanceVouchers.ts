import { voucherPostingService } from "../modules/accounts/voucherPosting.service";
import { accountsService } from "../modules/accounts/accounts.service";
import { prisma } from "../config/prisma";

async function main() {
  console.log("Starting opening balance voucher sync...");
  await voucherPostingService.syncMissingOpeningBalanceVouchers();
  console.log("Sync complete. Checking Trial Balance...");

  const tb = await accountsService.getTrialBalance();
  console.log("\n--- TRIAL BALANCE SUMMARY ---");
  console.log(`Is Balanced: ${tb.isBalanced}`);
  console.log(`Total Debit Balance:  ₹${tb.totalDebitBalance}`);
  console.log(`Total Credit Balance: ₹${tb.totalCreditBalance}`);
  console.log(`Difference:           ₹${Math.abs(tb.totalDebitBalance - tb.totalCreditBalance)}`);
  console.log("\nRows:");
  console.table(
    tb.rows.map((r) => ({
      Code: r.code,
      Name: r.name,
      Type: r.type,
      Debit: r.debitBalance,
      Credit: r.creditBalance,
    }))
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error executing sync script:", err);
  prisma.$disconnect();
  process.exit(1);
});
