import { Router } from "express";
import companyController from "./company.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { uploadProductImage } from "../../middleware/upload.middleware";

const router = Router();

// View company details (Public)
router.get("/", companyController.getCompany);

// Protect all routes below
router.use(authMiddleware);

// Update company details
router.put("/:id", uploadProductImage.fields([{ name: "logo", maxCount: 1 }, { name: "favicon", maxCount: 1 }]), companyController.updateCompany);

export default router;
