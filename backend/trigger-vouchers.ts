/**
 * Manually trigger voucher posting for all GRNs
 * Run: npx ts-node trigger-vouchers.ts
 */
import { prisma } from "./src/config/prisma";
import { voucherPostingService } from "./src/modules/accounts/voucherPosting.service";

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  MANUALLY TRIGGER VOUCHER POSTING FOR ALL GRNs");
  console.log("═══════════════════════════════════════════════════════\n");

  const grns = await prisma.grnInvoice.findMany({ select: { id: true, grnNumber: true, netAmount: true } });
  console.log("Found GRNs:", grns.length);

  let posted = 0, failed = 0;

  for (const grn of grns) {
    try {
      const existing = await prisma.voucher.findFirst({
        where: { refDocType: "GRN_INVOICE", refDocId: grn.id },
      });
      if (existing) {
        console.log(`  → ${grn.grnNumber}: already posted (${existing.voucherNo})`);
        continue;
      }

      const result = await voucherPostingService.postPurchaseVoucher(grn.id);
      if (result) {
        posted++;
        console.log(`  ✓ ${grn.grnNumber}: posted → ${result.voucherNo}`);
        // Also try payment voucher
        await voucherPostingService.postPaymentVouchersForGRN(grn.id);
      } else {
        failed++;
        console.log(`  ✗ ${grn.grnNumber}: returned null`);
      }
    } catch (e: any) {
      failed++;
      console.log(`  ✗ ${grn.grnNumber}: ${e.message?.substring(0, 800)}`);
    }
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Posted: ${posted} | Failed: ${failed}`);
  console.log("═══════════════════════════════════════════════════════");

  const purCount = await prisma.voucher.count({ where: { type: "PURCHASE" } });
  const payCount = await prisma.voucher.count({ where: { type: "PAYMENT" } });
  console.log(`  Total PURCHASE vouchers: ${purCount}`);
  console.log(`  Total PAYMENT vouchers: ${payCount}`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
