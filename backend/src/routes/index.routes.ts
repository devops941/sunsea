import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/role/role.routes";
import permissionRoutes from "../modules/permissions/permission.routes";
import rolePermissionRoutes from "../modules/role-permissions/role-permission.routes";
import employeeRoutes from "../modules/employee/employee.routes";
import departmentRoutes from "../modules/department/department.routes";
import customerRoutes from "../modules/customer/customer.routes";
import supplierRoutes from "../modules/supplier/supplier.routes";
import categoryRoutes from "../modules/category/category.routes";
import subCategoryRoutes from "../modules/sub-category/sub-category.routes";
import uomRoutes from "../modules/uom/uom.routes";
import productImageRoutes from "../modules/product-image/product-image.routes";
import productRoutes from "../modules/product/product.routes";
import companyRoutes from "../modules/company/company.routes";
import shiftRoutes from "../modules/shift/shift.routes";
import storeRoutes from "../modules/store/store.routes";
import storeTypeRoutes from "../modules/store-type/store-type.routes";
import rawMaterialRoutes from "../modules/raw-material/raw-material.routes";
import rawMaterialCategoryRoutes from "../modules/raw-material-category/raw-material-category.routes";
import rawMaterialStockRoutes from "../modules/raw-material-stock/raw-material-stock.routes";
import finishedGoodsStockRoutes from "../modules/finished-goods-stock/finished-goods-stock.routes";
import finishedGoodsTransactionRoutes from "../modules/finished-goods-transaction/finished-goods-transaction.routes";
import locationRoutes from "../modules/location/location.routes";
import machineRoutes from "../modules/machine/machine.routes";
import productionOrderRoutes from "../modules/production-order/production-order.routes";
import hourlyProductionRoutes from "../modules/hourly-production/hourly-production.routes";
import rawMaterialTransactionRoutes from "../modules/raw-material-transaction/raw-material-transaction.routes";
import weeklyProgramRoutes from "../modules/weekly-machine-program/weekly-program.routes";
import dailyScheduleRoutes from "../modules/daily-schedule/daily-schedule.routes";
import dailyPlanRoutes from "../modules/daily-production-plan/daily-plan.routes";
import reportsRoutes from "../modules/reports/reports.routes";
import salesOrderRoutes from "../modules/sales-order/sales-order.routes";
import billOfMaterialRoutes from "../modules/bill-of-material/billOfMaterial.routes";
import stockAdjustmentRoutes from "../modules/stock-adjustment/stock-adjustment.routes";
import purchaseOrderRoutes from "../modules/purchase-order/purchase-order.routes";
import supplierMaterialPriceRoutes from "../modules/supplier-material-price/supplier-material-price.routes";
import productionWastageRoutes from "../modules/production-wastage/production-wastage.routes";
import gstTaxRoutes from "../modules/gst/gstTaxRoutes";
import whatsappRoutes from "../modules/whatsappservice/whatsapp.routes";
import invoiceSettingsRoutes from "../modules/invoice-settings/invoice-settings.routes";
import expenseRoutes from "../modules/expense/expense.routes";
import grnInvoiceRoutes from "../modules/grn-invoice/grn-invoice.routes";
import salesInvoiceRoutes from "../modules/sales-invoice/sales-invoice.routes";
import oeeRoutes from "../modules/oee/oee.routes";
import goodsDispatchRoutes from "../modules/goods-dispatch/goods-dispatch.routes";
import inventoryRoutes from "../modules/inventory/inventory.routes";

const router = Router();

router.use("/auth", authRoutes);

router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/role-permissions", rolePermissionRoutes);
router.use("/departments", departmentRoutes);
router.use("/shifts", shiftRoutes);

router.use("/employees", employeeRoutes);

router.use("/customers", customerRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/purchase-orders", purchaseOrderRoutes);
router.use("/supplier-material-prices", supplierMaterialPriceRoutes);

router.use("/product/categories", categoryRoutes);
router.use("/product/sub-categories", subCategoryRoutes);
router.use("/product/uoms", uomRoutes);
router.use("/uom", uomRoutes);
router.use("/product-images", productImageRoutes);
router.use("/products", productRoutes);
router.use("/companies", companyRoutes);

router.use("/stores", storeRoutes);
router.use("/store-types", storeTypeRoutes);
router.use("/raw-material-categories", rawMaterialCategoryRoutes);
router.use("/raw-materials", rawMaterialRoutes);
router.use("/raw-material-stocks", rawMaterialStockRoutes);
router.use("/finished-goods-stocks", finishedGoodsStockRoutes);
router.use("/finished-goods-transactions", finishedGoodsTransactionRoutes);
router.use("/locations", locationRoutes);
router.use("/machines", machineRoutes);
router.use("/production-orders", productionOrderRoutes);
router.use("/hourly-productions", hourlyProductionRoutes);
router.use("/raw-material-transactions", rawMaterialTransactionRoutes);
router.use("/weekly-machine-programs", weeklyProgramRoutes);
router.use("/daily-schedule", dailyScheduleRoutes);
router.use("/daily-production-plans", dailyPlanRoutes);
router.use("/reports", reportsRoutes);
router.use("/bill-of-materials", billOfMaterialRoutes);
router.use("/sales-orders", salesOrderRoutes);
router.use("/stock-adjustments", stockAdjustmentRoutes);
router.use("/production-wastages", productionWastageRoutes);
router.use("/gst-tax", gstTaxRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/invoice-settings", invoiceSettingsRoutes);
router.use("/expenses", expenseRoutes);
router.use("/grn-invoices", grnInvoiceRoutes);
router.use("/sales-invoices", salesInvoiceRoutes);
router.use("/oee", oeeRoutes);
router.use("/goods-dispatches", goodsDispatchRoutes);
router.use("/inventory", inventoryRoutes);

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to Sunsea ERP API",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString()
    });
});

export default router;