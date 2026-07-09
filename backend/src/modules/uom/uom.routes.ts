import { Router } from "express";
import uomController from "./uom.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/categories", uomController.getCategories);
router.get("/units", uomController.getUnits);

export default router;
