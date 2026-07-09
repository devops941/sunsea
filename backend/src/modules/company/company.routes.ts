import { Router } from "express";
import companyController from "./company.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// Protect all routes
router.use(authMiddleware);

// View company details
router.get("/", companyController.getCompany);

// Update company details
router.put("/:id", companyController.updateCompany);

export default router;
