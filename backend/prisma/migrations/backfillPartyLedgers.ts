import { prisma } from "../../src/config/prisma";
import { LedgerType } from "@prisma/client";

export async function runBackfillPartyLedgersMigration(dryRun: boolean = false) {
  console.log(`\n======================================================`);
  console.log(`Starting Backfill Party Ledgers Migration Script (Dry Run: ${dryRun})`);
  console.log(`======================================================\n`);

  // Step 1: Backfill Supplier Ledgers
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, supplierCode: true, legalName: true },
  });

  console.log(`Checking ${suppliers.length} supplier(s)...`);
  let supplierLedgersCreated = 0;
  let supplierLedgersExisting = 0;

  for (const supplier of suppliers) {
    const existing = await prisma.accountLedger.findUnique({
      where: { supplierId: supplier.id },
    });

    if (existing) {
      supplierLedgersExisting++;
    } else {
      console.log(`[Supplier Ledger] Missing for ${supplier.legalName} (${supplier.supplierCode}). Creating...`);
      if (!dryRun) {
        const ledgerCode = `SUPP-${supplier.supplierCode}`;
        const codeExists = await prisma.accountLedger.findUnique({ where: { code: ledgerCode } });
        const finalCode = codeExists ? `SUPP-${supplier.supplierCode}-${Date.now().toString().slice(-4)}` : ledgerCode;

        await prisma.accountLedger.create({
          data: {
            code: finalCode,
            name: supplier.legalName,
            type: LedgerType.LIABILITY,
            group: "Sundry Creditors",
            supplierId: supplier.id,
          },
        });
        supplierLedgersCreated++;
        console.log(`[Supplier Ledger] Created ledger '${finalCode}' for ${supplier.legalName}`);
      } else {
        console.log(`[Dry Run] Would create supplier ledger SUPP-${supplier.supplierCode} for ${supplier.legalName}`);
      }
    }
  }

  // Step 2: Backfill Customer Ledgers
  const customers = await prisma.customer.findMany({
    select: { id: true, customerCode: true, firmName: true },
  });

  console.log(`\nChecking ${customers.length} customer(s)...`);
  let customerLedgersCreated = 0;
  let customerLedgersExisting = 0;

  for (const customer of customers) {
    const existing = await prisma.accountLedger.findUnique({
      where: { customerId: customer.id },
    });

    if (existing) {
      customerLedgersExisting++;
    } else {
      console.log(`[Customer Ledger] Missing for ${customer.firmName} (${customer.customerCode}). Creating...`);
      if (!dryRun) {
        const ledgerCode = `CUST-${customer.customerCode}`;
        const codeExists = await prisma.accountLedger.findUnique({ where: { code: ledgerCode } });
        const finalCode = codeExists ? `CUST-${customer.customerCode}-${Date.now().toString().slice(-4)}` : ledgerCode;

        await prisma.accountLedger.create({
          data: {
            code: finalCode,
            name: customer.firmName,
            type: LedgerType.ASSET,
            group: "Sundry Debtors",
            customerId: customer.id,
          },
        });
        customerLedgersCreated++;
        console.log(`[Customer Ledger] Created ledger '${finalCode}' for ${customer.firmName}`);
      } else {
        console.log(`[Dry Run] Would create customer ledger CUST-${customer.customerCode} for ${customer.firmName}`);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`Backfill Summary:`);
  console.log(`- Supplier Ledgers: ${supplierLedgersCreated} created, ${supplierLedgersExisting} existing`);
  console.log(`- Customer Ledgers: ${customerLedgersCreated} created, ${customerLedgersExisting} existing`);
  console.log(`======================================================\n`);
}

// CLI Execution
declare const require: any;
if (require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  runBackfillPartyLedgersMigration(isDryRun)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
