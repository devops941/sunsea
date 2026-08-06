import { prisma } from "./config/prisma";
import { accountsService } from "./modules/accounts/accounts.service";
import { payableService } from "./modules/accounts/payable.service";
import supplierService from "./modules/supplier/supplier.service";

async function runAcceptanceTest() {
  console.log("\n=======================================================");
  console.log("RUNNING OPENING BALANCE ACCEPTANCE TESTS");
  console.log("=======================================================\n");

  // Cleanup test suppliers if already existing
  const existingMurugan = await prisma.supplier.findFirst({ where: { supplierCode: "TEST-SUP-MURUGAN" } });
  if (existingMurugan) {
    await prisma.journalItem.deleteMany({ where: { voucher: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(existingMurugan.id) } } });
    await prisma.voucher.deleteMany({ where: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(existingMurugan.id) } });
    await prisma.accountLedger.deleteMany({ where: { supplierId: existingMurugan.id } });
    await prisma.supplier.delete({ where: { id: existingMurugan.id } });
  }

  const existingVinayaga = await prisma.supplier.findFirst({ where: { supplierCode: "TEST-SUP-VINAYAGA" } });
  if (existingVinayaga) {
    await prisma.journalItem.deleteMany({ where: { voucher: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(existingVinayaga.id) } } });
    await prisma.voucher.deleteMany({ where: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(existingVinayaga.id) } });
    await prisma.accountLedger.deleteMany({ where: { supplierId: existingVinayaga.id } });
    await prisma.supplier.delete({ where: { id: existingVinayaga.id } });
  }

  // Create test suppliers
  const testCompanyId = "00000000-0000-0000-0000-000000000000";

  console.log("1. Creating Supplier 'Murugan Agencies' with opening balance ₹1,500 (CREDIT)...");
  const murugan = await supplierService.createSupplier({
    supplierCode: "TEST-SUP-MURUGAN",
    legalName: "Murugan Agencies",
    vendorType: "Manufacturer",
    category: "Raw Material",
    billingAddressLine1: "123 Main St",
    billingCity: "Chennai",
    billingState: "TN",
    billingPincode: "600001",
    stateCode: "33",
    paymentTerms: "Net30",
    leadTimeDays: 7,
    currency: "INR",
    openingBalance: 1500,
    openingBalanceType: "CREDIT",
    companyId: testCompanyId,
    userId: "test-user-id",
  } as any);

  console.log("2. Creating Supplier 'Sri Vinayaga Chemicals Pvt Ltd' with opening balance ₹1,000 (CREDIT)...");
  const vinayaga = await supplierService.createSupplier({
    supplierCode: "TEST-SUP-VINAYAGA",
    legalName: "Sri Vinayaga Chemicals Pvt Ltd",
    vendorType: "Manufacturer",
    category: "Raw Material",
    billingAddressLine1: "456 Trade Ave",
    billingCity: "Chennai",
    billingState: "TN",
    billingPincode: "600001",
    stateCode: "33",
    paymentTerms: "Net30",
    leadTimeDays: 7,
    currency: "INR",
    openingBalance: 1000,
    openingBalanceType: "CREDIT",
    companyId: testCompanyId,
    userId: "test-user-id",
  } as any);

  // Test 1: Check Murugan Agencies Payable Summary
  console.log("\n--- Testing Murugan Agencies Outstanding ---");
  const muruganSummary = await payableService.getSupplierPayableDetail(murugan.id);
  console.log(`Supplier: ${muruganSummary.supplier.legalName}`);
  console.log(`Opening Balance: ₹${muruganSummary.summary.openingBalance}`);
  console.log(`Total Billed (New Invoices): ₹${muruganSummary.summary.totalBilled}`);
  console.log(`Total Paid: ₹${muruganSummary.summary.totalPaid}`);
  console.log(`Closing Balance: ₹${muruganSummary.summary.closingBalance}`);
  
  if (muruganSummary.summary.closingBalance === 1500) {
    console.log("✅ PASSED: Murugan Agencies Closing Outstanding is exactly ₹1,500");
  } else {
    console.error(`❌ FAILED: Murugan Agencies Closing Outstanding is ₹${muruganSummary.summary.closingBalance} (Expected: ₹1,500)`);
  }

  // Test 2: Check Sri Vinayaga Chemicals Payable Summary
  console.log("\n--- Testing Sri Vinayaga Chemicals Outstanding ---");
  const vinayagaSummary = await payableService.getSupplierPayableDetail(vinayaga.id);
  console.log(`Supplier: ${vinayagaSummary.supplier.legalName}`);
  console.log(`Opening Balance: ₹${vinayagaSummary.summary.openingBalance}`);
  console.log(`Total Billed (New Invoices): ₹${vinayagaSummary.summary.totalBilled}`);
  console.log(`Total Paid: ₹${vinayagaSummary.summary.totalPaid}`);
  console.log(`Closing Balance: ₹${vinayagaSummary.summary.closingBalance}`);

  if (vinayagaSummary.summary.closingBalance === 1000) {
    console.log("✅ PASSED: Sri Vinayaga Chemicals Closing Outstanding is exactly ₹1,000");
  } else {
    console.error(`❌ FAILED: Sri Vinayaga Chemicals Closing Outstanding is ₹${vinayagaSummary.summary.closingBalance} (Expected: ₹1,000)`);
  }

  // Test 3: Check Amount Payable Report Total across both suppliers
  console.log("\n--- Testing Amount Payable Report Total ---");
  const payableReport = await payableService.getPayableSummaries({ limit: 100 });
  const testSuppliersPayable = payableReport.data.filter(s => s.supplierCode === "TEST-SUP-MURUGAN" || s.supplierCode === "TEST-SUP-VINAYAGA");
  const reportTotal = testSuppliersPayable.reduce((sum, s) => sum + s.netBalance, 0);

  console.log(`Report Total across test suppliers: ₹${reportTotal}`);
  if (reportTotal === 2500) {
    console.log("✅ PASSED: Amount Payable Report total across both test suppliers is exactly ₹2,500");
  } else {
    console.error(`❌ FAILED: Amount Payable Report total is ₹${reportTotal} (Expected: ₹2,500)`);
  }

  // Test 4: Check Trial Balance for EQ-001 and balance status
  console.log("\n--- Testing Trial Balance & EQ-001 ---");
  const trialBalance = await accountsService.getTrialBalance();
  const eqRow = trialBalance.rows.find(r => r.code === "EQ-001");
  console.log(`EQ-001 Row:`, eqRow);
  console.log(`Trial Balance isBalanced: ${trialBalance.isBalanced}`);
  console.log(`Total Debit Balance: ₹${trialBalance.totalDebitBalance}, Total Credit Balance: ₹${trialBalance.totalCreditBalance}`);

  if (trialBalance.isBalanced) {
    console.log("✅ PASSED: Trial Balance is completely balanced (isBalanced: true)");
  } else {
    console.error("❌ FAILED: Trial Balance is UNBALANCED");
  }

  // Cleanup test suppliers after verification
  console.log("\nCleaning up test data...");
  await prisma.journalItem.deleteMany({ where: { voucher: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(murugan.id) } } });
  await prisma.voucher.deleteMany({ where: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(murugan.id) } });
  await prisma.accountLedger.deleteMany({ where: { supplierId: murugan.id } });
  await prisma.supplier.delete({ where: { id: murugan.id } });

  await prisma.journalItem.deleteMany({ where: { voucher: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(vinayaga.id) } } });
  await prisma.voucher.deleteMany({ where: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(vinayaga.id) } });
  await prisma.accountLedger.deleteMany({ where: { supplierId: vinayaga.id } });
  await prisma.supplier.delete({ where: { id: vinayaga.id } });

  console.log("=======================================================\n");
}

runAcceptanceTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Acceptance test error:", err);
    process.exit(1);
  });
