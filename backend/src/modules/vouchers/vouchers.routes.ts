import { Router } from "express";
import { vouchersController } from "./vouchers.controller";

const router = Router();

router.get("/", (req, res, next) => vouchersController.getVouchers(req, res, next));
router.get("/next-no", (req, res, next) => vouchersController.peekNextVoucherNo(req, res, next));
router.post("/", (req, res, next) => vouchersController.createVoucher(req, res, next));
router.get("/:id", (req, res, next) => vouchersController.getVoucherById(req, res, next));
router.patch("/:id", (req, res, next) => vouchersController.updateVoucher(req, res, next));
router.delete("/:id", (req, res, next) => vouchersController.deleteVoucher(req, res, next));

export default router;
