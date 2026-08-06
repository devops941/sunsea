import { prisma } from "./config/prisma";
import supplierService from "./modules/supplier/supplier.service";
import customerService from "./modules/customer/customer.service";
import { accountsService } from "./modules/accounts/accounts.service";

async function runBug3AcceptanceTest() {
  console.log("\n=======================================================");
  console.log("RUNNING BUG 3 ACCEPTANCE TESTS (PARTY LEDGERS IN CHART OF ACCOUNTS)");
  console.log("=======================================================\n");

  const company = await prisma.company.findFirst();
  const testCompanyId = company ? company.id : "00000000-0000-0000-0000-000000000000";

  // Cleanup test records
  const existingSupplier = await prisma.supplier.findFirst({ where: { supplierCode: "TEST-BUG3-SUPP" } });
  if (existingSupplier) {
    await prisma.accountLedger.deleteMany({ where: { supplierId: existingSupplier.id } });
    await prisma.supplier.delete({ where: { id: existingSupplier.id } });
  }

  const existingCustomer = await prisma.customer.findFirst({ where: { customerCode: "TEST-BUG3-CUST" } });
  if (existingCustomer) {
    await prisma.accountLedger.deleteMany({ where: { customerId: existingCustomer.id } });
    await prisma.customer.delete({ where: { id: existingCustomer.id } });
  }

  // Test 1: Create Supplier without opening balance
  console.log("1. Creating Supplier 'Test Bug3 Supplier' without opening balance...");
  const newSupplier = await supplierService.createSupplier({
    supplierCode: "TEST-BUG3-SUPP",
    legalName: "Test Bug3 Supplier",
    vendorType: "Manufacturer",
    category: "Raw Material",
    billingAddressLine1: "123 Test St",
    billingCity: "Chennai",
    billingState: "TN",
    billingPincode: "600001",
    stateCode: "33",
    paymentTerms: "Net30",
    leadTimeDays: 7,
    currency: "INR",
    openingBalance: 0,
    companyId: testCompanyId,
    userId: "test-user-id",
  } as any);

  const supplierLedger = await prisma.accountLedger.findUnique({
    where: { supplierId: newSupplier.id },
  });

  console.log("Supplier Ledger in Chart of Accounts:", supplierLedger);
  if (
    supplierLedger &&
    supplierLedger.code === `SUPP-${newSupplier.supplierCode}` &&
    supplierLedger.type === "LIABILITY" &&
    supplierLedger.group === "Sundry Creditors" &&
    supplierLedger.supplierId === newSupplier.id
  ) {
    console.log("✅ PASSED: Supplier immediately registered in Chart of Accounts as LIABILITY / Sundry Creditors!");
  } else {
    console.error("❌ FAILED: Supplier missing or incorrect in Chart of Accounts");
  }

  // Test 2: Create Customer without opening balance
  console.log("\n2. Creating Customer 'Test Bug3 Customer' without opening balance...");
  const newCustomer = await customerService.createCustomer(
    {
      customerCode: "TEST-BUG3-CUST",
      firmName: "Test Bug3 Customer",
      customerType: ["B2B"],
      billingAddressLine1: "456 Test Ave",
      billingCity: "Chennai",
      billingState: "TN",
      billingPincode: "600001",
      openingBalance: 0,
      stateCode: "33",
    } as any,
    { userId: "test-user-id", companyId: testCompanyId }
  );

  const customerLedger = await prisma.accountLedger.findUnique({
    where: { customerId: newCustomer.id },
  });

  console.log("Customer Ledger in Chart of Accounts:", customerLedger);
  if (
    customerLedger &&
    customerLedger.code === `CUST-${newCustomer.customerCode}` &&
    customerLedger.type === "ASSET" &&
    customerLedger.group === "Sundry Debtors" &&
    customerLedger.customerId === newCustomer.id
  ) {
    console.log("✅ PASSED: Customer immediately registered in Chart of Accounts as ASSET / Sundry Debtors!");
  } else {
    console.error("❌ FAILED: Customer missing or incorrect in Chart of Accounts");
  }

  // Test 3: Check getLedgers returns both ledgers
  console.log("\n3. Testing getLedgers API...");
  const allLedgers = await accountsService.getLedgers({ limit: 500 });
  const hasSuppLedger = allLedgers.ledgers.some((l) => l.supplierId === newSupplier.id);
  const hasCustLedger = allLedgers.ledgers.some((l) => l.customerId === newCustomer.id);

  if (hasSuppLedger && hasCustLedger) {
    console.log("✅ PASSED: Both Supplier and Customer ledgers present in Chart of Accounts query output!");
  } else {
    console.error("❌ FAILED: Missing ledgers in getLedgers query output");
  }

  // Cleanup
  console.log("\nCleaning up test data...");
  await prisma.accountLedger.deleteMany({ where: { supplierId: newSupplier.id } });
  await prisma.supplier.delete({ where: { id: newSupplier.id } });

  await prisma.accountLedger.deleteMany({ where: { customerId: newCustomer.id } });
  await prisma.customer.delete({ where: { id: newCustomer.id } });

  console.log("=======================================================\n");
}

runBug3AcceptanceTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Bug 3 Acceptance Test error:", err);
    process.exit(1);
  });
