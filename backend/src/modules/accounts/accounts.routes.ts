import { Router } from "express";
import { accountsController } from "./accounts.controller";

const router = Router();

router.get("/ledgers", (req, res, next) => accountsController.getLedgers(req, res, next));
router.post("/ledgers", (req, res, next) => accountsController.createLedger(req, res, next));
router.get("/ledgers/:id", (req, res, next) => accountsController.getLedgerById(req, res, next));
router.patch("/ledgers/:id", (req, res, next) => accountsController.updateLedger(req, res, next));
router.get("/ledgers/:id/statement", (req, res, next) => accountsController.getLedgerStatement(req, res, next));

router.get("/payable", (req, res, next) => accountsController.getPayableSummaries(req, res, next));
router.get("/payable/:supplierId", (req, res, next) => accountsController.getSupplierPayableDetail(req, res, next));

router.get("/receivable", (req, res, next) => accountsController.getReceivableSummaries(req, res, next));
router.get("/receivable/:customerId", (req, res, next) => accountsController.getCustomerReceivableDetail(req, res, next));

export default router;
