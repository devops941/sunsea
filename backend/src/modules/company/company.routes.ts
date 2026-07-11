import { Router } from "express";
import companyController from "./company.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { uploadProductImage } from "../../middleware/upload.middleware";

const router = Router();

// Protect all routes
router.use(authMiddleware);

// View company details
router.get("/", companyController.getCompany);

// Update company details
router.put("/:id", uploadProductImage.single("logo"), companyController.updateCompany);

export default router;
