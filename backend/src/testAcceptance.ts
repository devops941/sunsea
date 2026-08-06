import { prisma } from "../src/config/prisma";
import { accountsService } from "../src/modules/accounts/accounts.service";
import { voucherPostingService } from "../src/modules/accounts/voucherPosting.service";

async function testAcceptanceScenario() {
  console.log("==========================================");
  console.log("🧪 RUNNING ACCEPTANCE TEST");
  console.log("==========================================");

  await accountsService.ensureSystemLedgersExist();

  const code1 = `SUPP-TEST-${Date.now().toString().slice(-4)}`;
  const code2 = `SUPP-TEST-${(Date.now() + 1).toString().slice(-4)}`;

  const company = await prisma.company.findFirst();
  const companyId = company?.id || "00000000-0000-0000-0000-000000000000";

  // Create Supplier 1 with ₹1,000 Credit Opening Balance
  const sup1 = await prisma.supplier.create({
    data: {
      companyId,
      supplierCode: code1,
      legalName: "Test Supplier 1",
      vendorType: "Trader",
      category: "Yarn",
      billingAddressLine1: "123 Street",
      billingCity: "Chennai",
      billingState: "Tamil Nadu",
      billingPincode: "600001",
      stateCode: "TN",
      paymentTerms: "Net30",
      leadTimeDays: 7,
      createdBy: "test_admin",
      openingBalance: 1000,
      openingBalanceType: "CREDIT",
    } as any,
  });

  await voucherPostingService.postSupplierOpeningBalanceVoucher(
    { id: sup1.id, supplierCode: sup1.supplierCode, legalName: sup1.legalName },
    1000,
    "CREDIT"
  );

  // Create Supplier 2 with ₹1,500 Credit Opening Balance
  const sup2 = await prisma.supplier.create({
    data: {
      companyId,
      supplierCode: code2,
      legalName: "Test Supplier 2",
      vendorType: "Trader",
      category: "Yarn",
      billingAddressLine1: "456 Avenue",
      billingCity: "Chennai",
      billingState: "Tamil Nadu",
      billingPincode: "600001",
      stateCode: "TN",
      paymentTerms: "Net30",
      leadTimeDays: 7,
      createdBy: "test_admin",
      openingBalance: 1500,
      openingBalanceType: "CREDIT",
    } as any,
  });

  await voucherPostingService.postSupplierOpeningBalanceVoucher(
    { id: sup2.id, supplierCode: sup2.supplierCode, legalName: sup2.legalName },
    1500,
    "CREDIT"
  );

  // Fetch Trial Balance
  const tb = await accountsService.getTrialBalance();

  console.log("\n📊 TRIAL BALANCE RESULT:");
  console.log("------------------------------------------");
  for (const row of tb.rows) {
    if (row.code === "EQ-001" || row.code === `SUPP-${code1}` || row.code === `SUPP-${code2}`) {
      console.log(
        `${row.code.padEnd(20)} ${row.name.padEnd(30)} Dr: ${row.debitBalance.toFixed(2).padStart(8)} | Cr: ${row.creditBalance.toFixed(2).padStart(8)}`
      );
    }
  }
  console.log("------------------------------------------");
  console.log(`TOTAL DEBIT  : ${tb.totalDebitBalance}`);
  console.log(`TOTAL CREDIT : ${tb.totalCreditBalance}`);
  console.log(`IS BALANCED  : ${tb.isBalanced}`);
  console.log("==========================================");

  // Clean up test suppliers and vouchers
  await prisma.journalItem.deleteMany({
    where: { voucher: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: { in: [String(sup1.id), String(sup2.id)] } } },
  });
  await prisma.voucher.deleteMany({
    where: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: { in: [String(sup1.id), String(sup2.id)] } },
  });
  await prisma.accountLedger.deleteMany({
    where: { supplierId: { in: [sup1.id, sup2.id] } },
  });
  await prisma.supplier.deleteMany({
    where: { id: { in: [sup1.id, sup2.id] } },
  });
}

testAcceptanceScenario().catch(console.error);
