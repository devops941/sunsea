import { Router } from "express";
import { deliveryRoutesController } from "./routes.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// Retrieve all active sales reps (from Employee)
router.get("/reps", authMiddleware, deliveryRoutesController.getSalesReps);

// Retrieve available cities (dynamic from Customer addresses + network)
router.get("/cities", authMiddleware, deliveryRoutesController.getAvailableCities);

// Retrieve all configured delivery routes
router.get("/", authMiddleware, deliveryRoutesController.getAllRoutes);

// Retrieve only customers who have sales invoices
router.get("/invoiced-customers", authMiddleware, deliveryRoutesController.getInvoicedCustomers);

// Retrieve route plan for a specific rep (by employee ID or empCode)
router.get("/rep/:id", authMiddleware, deliveryRoutesController.getRepRoutePlan);

// Save/update route plan for a specific rep
router.post("/rep/:id", authMiddleware, deliveryRoutesController.saveRepRoutePlan);

// Update status of a single stop (ASSIGNED / IN_TRANSIT / DELIVERED / CANCELLED)
router.patch("/stop/:id/status", authMiddleware, deliveryRoutesController.updateStopStatus);

export default router;
