import { Router } from "express";
import { accountsController } from "./accounts.controller";

const router = Router();

router.get("/ledgers", (req, res, next) => accountsController.getLedgers(req, res, next));
router.post("/ledgers", (req, res, next) => accountsController.createLedger(req, res, next));
router.get("/ledgers/:id", (req, res, next) => accountsController.getLedgerById(req, res, next));
router.patch("/ledgers/:id", (req, res, next) => accountsController.updateLedger(req, res, next));
router.get("/ledger-statement/multi", (req, res, next) => accountsController.getMultiLedgerStatement(req, res, next));
router.get("/ledgers/:id/statement", (req, res, next) => accountsController.getLedgerStatement(req, res, next));

router.get("/bank-accounts", (req, res, next) => accountsController.getBankAccounts(req, res, next));

router.get("/payable", (req, res, next) => accountsController.getPayableSummaries(req, res, next));
router.get("/payable/:supplierId", (req, res, next) => accountsController.getSupplierPayableDetail(req, res, next));

router.get("/receivable", (req, res, next) => accountsController.getReceivableSummaries(req, res, next));
router.get("/receivable/:customerId", (req, res, next) => accountsController.getCustomerReceivableDetail(req, res, next));

// Reports
router.get("/balance-sheet", (req, res, next) => accountsController.getBalanceSheet(req, res, next));
router.get("/trial-balance", (req, res, next) => accountsController.getTrialBalance(req, res, next));
router.get("/profit-loss", (req, res, next) => accountsController.getProfitAndLoss(req, res, next));
router.get("/profit-loss/by-period", (req, res, next) => accountsController.getProfitAndLossByPeriod(req, res, next));

// Accounting Periods
router.get("/periods", (req, res, next) => accountsController.listPeriods(req, res, next));
router.post("/periods", (req, res, next) => accountsController.createPeriod(req, res, next));
router.post("/periods/:id/close", (req, res, next) => accountsController.closePeriod(req, res, next));
router.post("/periods/:id/reopen", (req, res, next) => accountsController.reopenPeriod(req, res, next));

export default router;
