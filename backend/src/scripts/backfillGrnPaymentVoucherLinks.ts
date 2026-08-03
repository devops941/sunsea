/**
 * One-time backfill script.
 *
 * Purpose:
 *   For every GRN invoice's `payments` JSON array, find the matching posted
 *   PAYMENT voucher for the same supplier and set `sourceVoucherId` on the
 *   GRN payment entry, so getSupplierPayableDetail() merges them into a
 *   single Payment History row instead of showing a duplicate / unposted row.
 *
 * Matching strategy (best-effort, since no linking field existed before):
 *   1. Same supplier
 *   2. Same date (voucher.date vs payment.paymentDate, same calendar day)
 *   3. Same amount (within 0.01)
 *   4. Not already claimed by another GRN payment entry in this run
 *
 * Usage:
 *   npx ts-node src/scripts/backfillGrnPaymentVoucherLinks.ts --dry-run   (default, no writes)
 *   npx ts-node src/scripts/backfillGrnPaymentVoucherLinks.ts --commit    (applies changes)
 */

import { prisma } from "../config/prisma";
import { VoucherType } from "@prisma/client";
import { extractPaymentsArray } from "../utils/payments";

const COMMIT = process.argv.includes("--commit");

interface MatchLog {
  grnId: string | number;
  grnNumber?: string;
  paymentIndex: number;
  paymentId?: string;
  amount: number;
  status: "MATCHED" | "AMBIGUOUS" | "NO_MATCH" | "ALREADY_LINKED";
  matchedVoucherNo?: string;
  candidateCount?: number;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

async function main() {
  console.log(`Running backfill in ${COMMIT ? "COMMIT" : "DRY-RUN"} mode\n`);

  const grnInvoices = await (prisma as any).grnInvoice.findMany({
    orderBy: { createdAt: "asc" },
  });

  const logs: MatchLog[] = [];
  const claimedVoucherIds = new Set<string>();

  for (const grn of grnInvoices) {
    const pList = extractPaymentsArray(grn.payments);
    if (!pList.length) continue;

    const paymentItems = await prisma.journalItem.findMany({
      where: {
        voucher: {
          type: VoucherType.PAYMENT,
        },
        debitLedger: { supplierId: grn.supplierId },
      },
      include: { voucher: true },
    });

    let mutated = false;
    const newPayments = pList.map((p: any, idx: number) => {
      if (p.sourceVoucherId) {
        logs.push({
          grnId: grn.id,
          grnNumber: grn.grnNumber,
          paymentIndex: idx,
          paymentId: p.id,
          amount: Number(p.amount || 0),
          status: "ALREADY_LINKED",
        });
        return p;
      }

      const pAmount = Number(p.amount || 0);
      const pDate = p.paymentDate ? new Date(p.paymentDate) : new Date(grn.createdAt);

      const candidates = paymentItems.filter((item) => {
        const voucherKey = item.voucher.id.toString();
        if (claimedVoucherIds.has(voucherKey)) return false;
        const amountMatches = Math.abs(Number(item.debitAmount) - pAmount) < 0.01;
        const dateMatches = sameDay(item.voucher.date, pDate);
        return amountMatches && dateMatches;
      });

      if (candidates.length === 1) {
        const voucherKey = candidates[0].voucher.id.toString();
        claimedVoucherIds.add(voucherKey);
        mutated = true;
        logs.push({
          grnId: grn.id,
          grnNumber: grn.grnNumber,
          paymentIndex: idx,
          paymentId: p.id,
          amount: pAmount,
          status: "MATCHED",
          matchedVoucherNo: candidates[0].voucher.voucherNo,
        });
        return { ...p, sourceVoucherId: voucherKey };
      }

      if (candidates.length > 1) {
        logs.push({
          grnId: grn.id,
          grnNumber: grn.grnNumber,
          paymentIndex: idx,
          paymentId: p.id,
          amount: pAmount,
          status: "AMBIGUOUS",
          candidateCount: candidates.length,
        });
        return p;
      }

      logs.push({
        grnId: grn.id,
        grnNumber: grn.grnNumber,
        paymentIndex: idx,
        paymentId: p.id,
        amount: pAmount,
        status: "NO_MATCH",
      });
      return p;
    });

    if (mutated && COMMIT) {
      await (prisma as any).grnInvoice.update({
        where: { id: grn.id },
        data: { payments: newPayments },
      });
    }
  }

  const summary = {
    matched: logs.filter((l) => l.status === "MATCHED").length,
    alreadyLinked: logs.filter((l) => l.status === "ALREADY_LINKED").length,
    ambiguous: logs.filter((l) => l.status === "AMBIGUOUS").length,
    noMatch: logs.filter((l) => l.status === "NO_MATCH").length,
  };

  console.table(logs);
  console.log("\nSummary:", summary);

  if (!COMMIT) {
    console.log(
      "\nDry run only — no data was written. Re-run with --commit to apply matched links."
    );
  } else {
    console.log(`\nCommitted ${summary.matched} link(s) to grnInvoice.payments.`);
  }

  if (summary.ambiguous > 0) {
    console.log(
      `\n${summary.ambiguous} ambiguous case(s) need manual review (multiple vouchers with same amount/date, same supplier).`
    );
  }
  if (summary.noMatch > 0) {
    console.log(
      `${summary.noMatch} payment(s) had no matching voucher — these are genuinely unposted and will keep showing as "Not posted to ledger" in the UI. That's expected if no voucher was ever created for them.`
    );
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
