/**
 * One-time backfill script for Sales Invoice Payments.
 *
 * Purpose:
 *   For every sales invoice's `payments` JSON array, find the matching posted
 *   RECEIPT voucher for the same customer and set `sourceVoucherId` on the
 *   sales payment entry, so getCustomerReceivableDetail() merges them into a
 *   single Collection History row instead of showing a duplicate / unposted row.
 *
 * Matching strategy (best-effort, since no linking field existed before):
 *   1. Same customer
 *   2. Same date (voucher.date vs payment.paymentDate, same calendar day)
 *   3. Same amount (within 0.01)
 *   4. Not already claimed by another sales payment entry in this run
 *
 * Usage:
 *   npx ts-node src/scripts/backfillSalesPaymentVoucherLinks.ts --dry-run   (default, no writes)
 *   npx ts-node src/scripts/backfillSalesPaymentVoucherLinks.ts --commit    (applies changes)
 */

import { prisma } from "../config/prisma";
import { VoucherType } from "@prisma/client";
import { extractPaymentsArray } from "../utils/payments";

const COMMIT = process.argv.includes("--commit");

interface MatchLog {
  salesInvoiceId: string;
  invoiceNo?: string;
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

  const salesInvoices = await (prisma as any).salesInvoice.findMany({
    orderBy: { createdAt: "asc" },
  });

  const logs: MatchLog[] = [];
  const claimedVoucherIds = new Set<string>();

  for (const inv of salesInvoices) {
    const pList = extractPaymentsArray(inv.payments);
    if (!pList.length) continue;

    const collectionItems = await prisma.journalItem.findMany({
      where: {
        voucher: {
          type: VoucherType.RECEIPT,
        },
        creditLedger: { customerId: inv.customerId },
      },
      include: { voucher: true },
    });

    let mutated = false;
    const newPayments = pList.map((p: any, idx: number) => {
      if (p.sourceVoucherId) {
        logs.push({
          salesInvoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          paymentIndex: idx,
          paymentId: p.id,
          amount: Number(p.amount || 0),
          status: "ALREADY_LINKED",
        });
        return p;
      }

      const pAmount = Number(p.amount || 0);
      const pDate = p.paymentDate ? new Date(p.paymentDate) : new Date(inv.createdAt);

      const candidates = collectionItems.filter((item) => {
        const voucherKey = item.voucher.id.toString();
        if (claimedVoucherIds.has(voucherKey)) return false;
        const amountMatches = Math.abs(Number(item.creditAmount) - pAmount) < 0.01;
        const dateMatches = sameDay(item.voucher.date, pDate);
        return amountMatches && dateMatches;
      });

      if (candidates.length === 1) {
        const voucherKey = candidates[0].voucher.id.toString();
        claimedVoucherIds.add(voucherKey);
        mutated = true;
        logs.push({
          salesInvoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          paymentIndex: idx,
          paymentId: p.id,
          amount: pAmount,
          status: "MATCHED",
          matchedVoucherNo: candidates[0].voucher.voucherNo,
        });
        return {
          ...p,
          sourceVoucherId: voucherKey,
        };
      }

      if (candidates.length > 1) {
        logs.push({
          salesInvoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          paymentIndex: idx,
          paymentId: p.id,
          amount: pAmount,
          status: "AMBIGUOUS",
          candidateCount: candidates.length,
        });
        return p;
      }

      logs.push({
        salesInvoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        paymentIndex: idx,
        paymentId: p.id,
        amount: pAmount,
        status: "NO_MATCH",
      });
      return p;
    });

    if (mutated && COMMIT) {
      await (prisma as any).salesInvoice.update({
        where: { id: inv.id },
        data: { payments: newPayments as any },
      });
    }
  }

  const matched = logs.filter((l) => l.status === "MATCHED");
  const ambiguous = logs.filter((l) => l.status === "AMBIGUOUS");
  const noMatch = logs.filter((l) => l.status === "NO_MATCH");
  const alreadyLinked = logs.filter((l) => l.status === "ALREADY_LINKED");

  console.log("=== Backfill Summary ===");
  console.log(`Already linked: ${alreadyLinked.length}`);
  console.log(`Newly matched: ${matched.length}`);
  console.log(`Ambiguous (skipped): ${ambiguous.length}`);
  console.log(`No match found (skipped): ${noMatch.length}`);

  if (matched.length > 0) {
    console.log("\nMatched items:");
    for (const m of matched) {
      console.log(
        `  - SalesInvoice ${m.invoiceNo || m.salesInvoiceId} | Pmt #${m.paymentIndex} (₹${m.amount}) -> Voucher ${m.matchedVoucherNo}`
      );
    }
  }

  if (ambiguous.length > 0) {
    console.log("\nAmbiguous items (skipped for manual review):");
    for (const a of ambiguous) {
      console.log(
        `  - SalesInvoice ${a.invoiceNo || a.salesInvoiceId} | Pmt #${a.paymentIndex} (₹${a.amount}) -> ${a.candidateCount} candidate vouchers`
      );
    }
  }

  if (!COMMIT) {
    console.log("\n[DRY RUN complete - no writes performed. Pass --commit to apply changes.]");
  } else {
    console.log("\n[COMMIT complete - database updated.]");
  }
}

main()
  .catch((e) => {
    console.error("Backfill script error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
