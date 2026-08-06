"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFixOpeningBalanceMigration = runFixOpeningBalanceMigration;
const prisma_1 = require("../../src/config/prisma");
const client_1 = require("@prisma/client");
async function runFixOpeningBalanceMigration(dryRun = false) {
    console.log(`\n======================================================`);
    console.log(`Starting Opening Balance Migration Script (Dry Run: ${dryRun})`);
    console.log(`======================================================\n`);
    // Step 1: Ensure system ledger EQ-001 exists
    let eqLedger = await prisma_1.prisma.accountLedger.findUnique({ where: { code: "EQ-001" } });
    if (!eqLedger) {
        console.log(`[EQ-001] System ledger "Opening Balance Equity" not found. Creating...`);
        if (!dryRun) {
            eqLedger = await prisma_1.prisma.accountLedger.create({
                data: {
                    code: "EQ-001",
                    name: "Opening Balance Equity",
                    type: client_1.LedgerType.EQUITY,
                    group: "Equity",
                    isActive: true,
                },
            });
            console.log(`[EQ-001] Created Opening Balance Equity ledger with ID ${eqLedger.id}`);
        }
        else {
            console.log(`[Dry Run] Would create EQ-001 Opening Balance Equity ledger`);
        }
    }
    else {
        console.log(`[EQ-001] System ledger "Opening Balance Equity" verified (ID: ${eqLedger.id})`);
    }
    // Step 2: Fetch all Suppliers with openingBalance != 0
    const suppliers = await prisma_1.prisma.supplier.findMany({
        where: {
            openingBalance: { not: 0 },
        },
    });
    console.log(`\nFound ${suppliers.length} supplier(s) with opening balances.`);
    let supplierVouchersCreated = 0;
    let supplierVouchersUpdated = 0;
    for (const supplier of suppliers) {
        const opBal = Number(supplier.openingBalance || 0);
        if (opBal === 0)
            continue;
        const refDocId = String(supplier.id);
        const existingVoucher = await prisma_1.prisma.voucher.findFirst({
            where: {
                refDocType: "SUPPLIER_OPENING_BALANCE",
                refDocId,
            },
            include: { items: true },
        });
        const isCredit = true; // Default supplier opening balance is CREDIT (business owes supplier)
        const voucherNo = `OPB-SUP-${supplier.supplierCode}`;
        if (existingVoucher) {
            console.log(`[Supplier] ${supplier.legalName} (${supplier.supplierCode}): Voucher ${existingVoucher.voucherNo} already exists.`);
            supplierVouchersUpdated++;
        }
        else {
            console.log(`[Supplier] ${supplier.legalName} (${supplier.supplierCode}): Missing opening balance voucher for ₹${opBal}.`);
            if (!dryRun && eqLedger) {
                // Ensure supplier ledger exists
                let supplierLedger = await prisma_1.prisma.accountLedger.findUnique({ where: { supplierId: supplier.id } });
                if (!supplierLedger) {
                    const ledgerCode = `SUPP-${supplier.supplierCode}`;
                    supplierLedger = await prisma_1.prisma.accountLedger.create({
                        data: {
                            code: ledgerCode,
                            name: supplier.legalName,
                            type: client_1.LedgerType.LIABILITY,
                            group: "Sundry Creditors",
                            supplierId: supplier.id,
                        },
                    });
                }
                await prisma_1.prisma.voucher.create({
                    data: {
                        voucherNo,
                        type: client_1.VoucherType.JOURNAL,
                        date: supplier.createdAt || new Date(),
                        narration: `Opening balance for supplier ${supplier.legalName} (CREDIT)`,
                        refDocType: "SUPPLIER_OPENING_BALANCE",
                        refDocId,
                        items: {
                            create: [
                                {
                                    debitLedgerId: isCredit ? eqLedger.id : supplierLedger.id,
                                    debitAmount: new client_1.Prisma.Decimal(opBal),
                                    creditAmount: new client_1.Prisma.Decimal(0),
                                    narration: `Opening balance contra equity debit`,
                                },
                                {
                                    creditLedgerId: isCredit ? supplierLedger.id : eqLedger.id,
                                    debitAmount: new client_1.Prisma.Decimal(0),
                                    creditAmount: new client_1.Prisma.Decimal(opBal),
                                    narration: `Supplier opening balance credit`,
                                },
                            ],
                        },
                    },
                });
                supplierVouchersCreated++;
                console.log(`[Supplier] Created balanced 2-line journal voucher ${voucherNo} for ₹${opBal}`);
            }
        }
    }
    // Step 3: Fetch all Customers with openingBalance != 0
    const customers = await prisma_1.prisma.customer.findMany({
        where: {
            openingBalance: { not: 0 },
        },
    });
    console.log(`\nFound ${customers.length} customer(s) with opening balances.`);
    let customerVouchersCreated = 0;
    let customerVouchersUpdated = 0;
    for (const customer of customers) {
        const opBal = Number(customer.openingBalance || 0);
        if (opBal === 0)
            continue;
        const refDocId = String(customer.id);
        const existingVoucher = await prisma_1.prisma.voucher.findFirst({
            where: {
                refDocType: "CUSTOMER_OPENING_BALANCE",
                refDocId,
            },
            include: { items: true },
        });
        const isDebit = true; // Default customer opening balance is DEBIT (customer owes business)
        const voucherNo = `OPB-CUST-${customer.customerCode}`;
        if (existingVoucher) {
            console.log(`[Customer] ${customer.firmName} (${customer.customerCode}): Voucher ${existingVoucher.voucherNo} already exists.`);
            customerVouchersUpdated++;
        }
        else {
            console.log(`[Customer] ${customer.firmName} (${customer.customerCode}): Missing opening balance voucher for ₹${opBal}.`);
            if (!dryRun && eqLedger) {
                // Ensure customer ledger exists
                let customerLedger = await prisma_1.prisma.accountLedger.findUnique({ where: { customerId: customer.id } });
                if (!customerLedger) {
                    const ledgerCode = `CUST-${customer.customerCode}`;
                    customerLedger = await prisma_1.prisma.accountLedger.create({
                        data: {
                            code: ledgerCode,
                            name: customer.firmName,
                            type: client_1.LedgerType.ASSET,
                            group: "Sundry Debtors",
                            customerId: customer.id,
                        },
                    });
                }
                await prisma_1.prisma.voucher.create({
                    data: {
                        voucherNo,
                        type: client_1.VoucherType.JOURNAL,
                        date: customer.createdAt || new Date(),
                        narration: `Opening balance for customer ${customer.firmName} (DEBIT)`,
                        refDocType: "CUSTOMER_OPENING_BALANCE",
                        refDocId,
                        items: {
                            create: [
                                {
                                    debitLedgerId: isDebit ? customerLedger.id : eqLedger.id,
                                    debitAmount: new client_1.Prisma.Decimal(opBal),
                                    creditAmount: new client_1.Prisma.Decimal(0),
                                    narration: `Customer opening balance debit`,
                                },
                                {
                                    creditLedgerId: isDebit ? eqLedger.id : customerLedger.id,
                                    debitAmount: new client_1.Prisma.Decimal(0),
                                    creditAmount: new client_1.Prisma.Decimal(opBal),
                                    narration: `Opening balance contra equity credit`,
                                },
                            ],
                        },
                    },
                });
                customerVouchersCreated++;
                console.log(`[Customer] Created balanced 2-line journal voucher ${voucherNo} for ₹${opBal}`);
            }
        }
    }
    console.log(`\n======================================================`);
    console.log(`Migration Summary:`);
    console.log(`- Supplier vouchers created: ${supplierVouchersCreated}, existing verified: ${supplierVouchersUpdated}`);
    console.log(`- Customer vouchers created: ${customerVouchersCreated}, existing verified: ${customerVouchersUpdated}`);
    console.log(`======================================================\n`);
}
if (require.main === module) {
    const isDryRun = process.argv.includes("--dry-run");
    runFixOpeningBalanceMigration(isDryRun)
        .then(() => process.exit(0))
        .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
}
