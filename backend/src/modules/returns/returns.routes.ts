import { Router } from "express";
import { returnsController } from "./returns.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/sales", (req, res, next) => returnsController.getSalesReturns(req, res, next));
router.post("/sales", (req, res, next) => returnsController.createSalesReturn(req, res, next));
router.get("/sales/:id", (req, res, next) => returnsController.getSalesReturnById(req, res, next));
router.put("/sales/:id", (req, res, next) => returnsController.updateSalesReturn(req, res, next));
router.get("/purchase", (req, res, next) => returnsController.getPurchaseReturns(req, res, next));
router.post("/purchase", (req, res, next) => returnsController.createPurchaseReturn(req, res, next));
router.get("/purchase/:id", (req, res, next) => returnsController.getPurchaseReturnById(req, res, next));
router.put("/purchase/:id", (req, res, next) => returnsController.updatePurchaseReturn(req, res, next));

export default router;
