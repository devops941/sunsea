import { prisma } from "../../src/config/prisma";
import { accountsService } from "../../src/modules/accounts/accounts.service";
import { voucherPostingService } from "../../src/modules/accounts/voucherPosting.service";

/**
 * Migration Script: Backfill Opening Balance Journal Vouchers
 * 
 * Finds all Suppliers and Customers with opening balance > 0 that do NOT currently
 * have a corresponding SUPPLIER_OPENING_BALANCE or CUSTOMER_OPENING_BALANCE journal voucher,
 * and creates a balanced double-entry voucher (contra entry in EQ-001 Opening Balance Equity).
 */
export async function backfillOpeningBalanceVouchers() {
  console.log("🚀 Starting Opening Balance Vouchers Backfill Migration...");

  // Ensure system ledgers (including EQ-001) exist
  await accountsService.ensureSystemLedgersExist();

  let supplierBackfills = 0;
  let customerBackfills = 0;

  // 1. Backfill Suppliers
  const suppliers = await prisma.supplier.findMany();
  for (const supplier of suppliers) {
    const opBal = Number(supplier.openingBalance || 0);
    if (opBal > 0) {
      const existingVoucher = await prisma.voucher.findFirst({
        where: {
          refDocType: "SUPPLIER_OPENING_BALANCE",
          refDocId: String(supplier.id),
        },
      });

      if (!existingVoucher) {
        const opBalType = (supplier.openingBalanceType || "CREDIT").toUpperCase() as "DEBIT" | "CREDIT";
        await voucherPostingService.postSupplierOpeningBalanceVoucher(
          { id: supplier.id, supplierCode: supplier.supplierCode, legalName: supplier.legalName },
          opBal,
          opBalType
        );
        supplierBackfills++;
        console.log(`  [Supplier] Backfilled opening balance voucher for ${supplier.supplierCode} (${supplier.legalName}): ₹${opBal} (${opBalType})`);
      }
    }
  }

  // 2. Backfill Customers
  const customers = await prisma.customer.findMany();
  for (const customer of customers) {
    const opBal = Number(customer.openingBalance || 0);
    if (opBal > 0) {
      const existingVoucher = await prisma.voucher.findFirst({
        where: {
          refDocType: "CUSTOMER_OPENING_BALANCE",
          refDocId: String(customer.id),
        },
      });

      if (!existingVoucher) {
        const opBalType = (customer.openingBalanceType || "DEBIT").toUpperCase() as "DEBIT" | "CREDIT";
        await voucherPostingService.postCustomerOpeningBalanceVoucher(
          { id: customer.id, customerCode: customer.customerCode, firmName: customer.firmName },
          opBal,
          opBalType
        );
        customerBackfills++;
        console.log(`  [Customer] Backfilled opening balance voucher for ${customer.customerCode} (${customer.firmName}): ₹${opBal} (${opBalType})`);
      }
    }
  }

  console.log(`✅ Backfill complete. Suppliers backfilled: ${supplierBackfills}, Customers backfilled: ${customerBackfills}`);
}

// Run directly if called as a script
declare const require: any;
if (require.main === module) {
  backfillOpeningBalanceVouchers()
    .then(() => {
      console.log("Migration finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
