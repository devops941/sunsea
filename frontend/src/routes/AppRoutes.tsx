import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import BaseLayout from "../components/layout/BaseLayout";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import CommonLoader from "../components/ui/Loader/CommonLoader";
import logo from '../../public/loaderimage.png'
import PoInvoicePage from "../modules/purchase/purchase-order/invoice/PoInvoicePage";


const Dashboard = lazy(() => import("../modules/dashboard/pages/DashboardPage"));
// const OeeDashboard = lazy(() => import("../modules/dashboard/pages/OeeDashboard"));
const CompanySettings = lazy(() => import("../modules/company/pages/CompanySettings"));
const SupplierBreakdownPage = lazy(() => import("../modules/accounts/pages/payable/SupplierBreakdownPage"));
const CustomerBreakdownPage = lazy(() => import("../modules/accounts/pages/receivable/CustomerBreakdownPage"));
const AccountsTabs = lazy(() => import("../modules/accounts/pages/AccountsTabs"));

const OrganizationTabs = lazy(() => import("../modules/company/pages/OrganizationTabs"));
const InventoryTabs = lazy(() => import("../modules/stock/pages/InventoryTabs"));
const NotFoundPage = lazy(() => import("../modules/not-found/pages/NotFoundPage"));
const UnauthorizedPage = lazy(() => import("../modules/unauthorized/pages/UnauthorizedPage"));
const LoginPage = lazy(() => import("../modules/login/pages/LoginPage"));
const ResetPassword = lazy(() => import("../modules/passwordreset/pages/ResetPassword"));

// Customers

const CustomerFormPage = lazy(() => import("../modules/customers/pages/CustomerFormPage"));

// Employees

const EmployeeCreatePage = lazy(() => import("../modules/employee/pages/EmployeeCreate"));
const EmployeeEdit = lazy(() => import("../modules/employee/pages/EmployeeEdit"));
const EmployeeViewPage = lazy(() => import("../modules/employee/pages/EmployeeViewPage"));

// Suppliers

const SupplierCreatePage = lazy(() => import("../modules/supplier/pages/SupplierCreate"));
const SupplierEditPage = lazy(() => import("../modules/supplier/pages/SupplierEdit"));
const SupplierMaterialPricingList = lazy(() => import("../modules/supplier/pages/Suppliermaterialpricinglist"));

// Products

const ProductForm = lazy(() => import("../modules/product/pages/ProductForm"));

const StoreLocationTabs = lazy(() => import("../modules/storage-stores/pages/StoreLocationTabs"));
const HROrganizationTabs = lazy(() => import("../modules/employee/pages/HROrganizationTabs"));
const ProductMasterTabs = lazy(() => import("../modules/product/pages/ProductMasterTabs"));

// Administration
const UserList = lazy(() => import("../modules/users/pages/UserList"));

const PermissionList = lazy(() => import("../modules/permissions/pages/PermissionList"));


// HR

// Product Master Attributes




// New modules
const MachineCreate = lazy(() => import("../modules/machines/pages/MachineCreate"));
const MachineEdit = lazy(() => import("../modules/machines/pages/MachineEdit"));
const MachineAssignmentList = lazy(() => import("../modules/machine-operation-assignments/pages/MachineAssignmentList"));
const MachineAssignmentForm = lazy(() => import("../modules/machine-operation-assignments/pages/MachineAssignmentForm"));


// shift

const ShiftCreate = lazy(() => import("../modules/shifts/pages/ShiftCreate"));
const ShiftEdit = lazy(() => import("../modules/shifts/pages/ShiftEdit"));


const RawMaterialForm = lazy(() => import("../modules/raw-materials/pages/RawMaterialForm"));
const RawMaterialCategoryList = lazy(() => import("../modules/raw-material-categories/pages/RawMaterialCategoryList"));

const SalesProductForm = lazy(() => import("../modules/sales-product/pages/SalesProductForm"));

const WastageStoreList = lazy(() => import("../modules/wastage-store/pages/WastageStoreList"));
const WastageStoreForm = lazy(() => import("../modules/wastage-store/pages/WastageStoreForm"));


const StockAdjustmentForm = lazy(() => import("../modules/stock-adjustments/pages/StockAdjustmentForm"));
const StockAdjustmentView = lazy(() => import("../modules/stock-adjustments/pages/StockAdjustmentView"));


const FinishedStockCreate = lazy(() => import("../modules/finished-stock/pages/FinishedStockCreate"));
const FinishedStockEdit = lazy(() => import("../modules/finished-stock/pages/FinishedStockEdit"));

const WastageStockList = lazy(() => import("../modules/wastage-stock/pages/WastageStockList"));
const WastageStockCreate = lazy(() => import("../modules/wastage-stock/pages/WastageStockCreate"));
const WastageStockEdit = lazy(() => import("../modules/wastage-stock/pages/WastageStockEdit"));



const WeeklyMachineScheduleCreate = lazy(() => import("../modules/weekly-machine-schedules/pages/WeeklyMachineScheduleCreate"));
const WeeklyMachineScheduleEdit = lazy(() => import("../modules/weekly-machine-schedules/pages/WeeklyMachineScheduleEdit"));


const ShiftExecutionBoard = lazy(() => import("../modules/shift-execution/pages/ShiftExecutionBoard"));
const ProductionDashboard = lazy(() => import("../modules/dashboard/pages/ProductionDashboard"));
const ReportsTabs = lazy(() => import("../modules/reports/pages/ReportsTabs"));


const HourlyWorkReportCreate = lazy(() => import("../modules/hourly-work-reports/pages/HourlyWorkReportCreate"));
const HourlyWorkReportEdit = lazy(() => import("../modules/hourly-work-reports/pages/HourlyWorkReportEdit"));
const DailyPlanCreate = lazy(() => import("../modules/daily-machine-planning/pages/DailyPlanCreate"));
const DailyPlanViewPage = lazy(() => import("../modules/daily-machine-planning/pages/DailyPlanViewPage"));
const DailyReportPage = lazy(() => import("../modules/daily-machine-planning/pages/DailyReportPage"));


const WastageForm = lazy(() => import("../modules/production-wastage/pages/WastageCreate"));



const ProductionOrderCreate = lazy(() => import("../modules/production-orders/pages/ProductionOrderCreate"));
// const ProductionOrderEdit = lazy(() => import("../modules/production-orders/pages/ProductionOrderEdit"));
const ProductionOrderTabs = lazy(() => import("../modules/production-orders/pages/ProductionOrderTabs"));
const ProductionOrderHistoryView = lazy(() => import("../modules/production-orders/pages/ProductionOrderHistoryView"));

// Goods Dispatch
const GoodsDispatchList = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchList"));
const GoodsDispatchCreate = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchCreate"));
const GoodsDispatchView = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchView"));
const GoodsDispatchDetail = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchDetail"));
const GoodsDispatchGateApproval = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchGateApproval"));
const GoodsDispatchStoreApproval = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchStoreApproval"));

const SalesOrderCreate = lazy(() => import("../modules/sales/salesorder/CreateOrder"));
const SalesInvoiceView = lazy(() => import("../modules/sales-order-invoice/SalesInvoiceView"));
const GrnInvoiceViewPage = lazy(() => import("../modules/purchase/purchase-order/invoice/GrnInvoiceViewPage"))

const OrderDetails = lazy(() => import("../modules/sales/salesorder/SalesOrderDetail"))

const QuotationCreate = lazy(() => import("../modules/sales/quatation/CreateQuatation"));

const UpdateQuatation = lazy(() => import("../modules/sales/quatation/UpdateQuatation"));
const SalesTabs = lazy(() => import("../modules/sales/pages/SalesTabs"));
const PurchaseTabs = lazy(() => import("../modules/purchase/pages/PurchaseTabs"));

// const ExpensesList = lazy(() => import("../modules/expenses/ExpensesList"));


// Purchase Order Module

const PurchaseOrderCreatePage = lazy(() => import("../modules/purchase/purchase-order/pages/PurchaseOrderCreatePage"));
const PurchaseOrderEditPage = lazy(() => import("../modules/purchase/purchase-order/pages/PurchaseOrderEditPage"));

const PurchaseOrderViewPage = lazy(() => import("../modules/purchase/purchase-order/purchaseordeappovals/PurchaseOrderapprovalEdit"));

const InvoiceDetail = lazy(() => import("../modules/purchase/purchase-order/upcoming-orders/InvoiceDetailPage"));
const SalesInvoiceForm = lazy(() => import("../modules/sales-order-invoice/SalesInvoiceCreate"));

// Payroll
const PayrollDashboard = lazy(() => import("../modules/payroll/pages/PayrollDashboard"));
const PayrollRun = lazy(() => import("../modules/payroll/pages/PayrollRun"));
const PayrollSettings = lazy(() => import("../modules/payroll/pages/PayrollSettings"));
const AttendancePage = lazy(() => import("../modules/payroll/pages/AttendancePage"));
const SalaryAdvancePage = lazy(() => import("../modules/payroll/pages/SalaryAdvancePage"));
const MonthlyPayrollReport = lazy(() => import("../modules/payroll/pages/MonthlyPayrollReport"));
const WeeklyPayrollReport = lazy(() => import("../modules/payroll/pages/WeeklyPayrollReport"));
// profile
const ProfilePage = lazy(() => import("../modules/profile/ProfilePage"));
const Settings = lazy(() => import("../modules/settings/Setting"));

const LoadingFallback = () => <CommonLoader text="Loading..." image={logo} />;

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          {/* Onboarding Route (Rendered without BaseLayout) */}
          <Route path="/company/create" element={<CompanySettings />} />

          <Route element={<BaseLayout />}>

            {/* ========================================================================= */}
            {/* CORE & DASHBOARD                                                          */}
            {/* ========================================================================= */}
            <Route index element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/company/edit" element={<CompanySettings />} />
            <Route path="/company/view" element={<OrganizationTabs />} />
            <Route path="/settings/company" element={<OrganizationTabs />} />
            <Route path="/settings/gst-taxes" element={<OrganizationTabs />} />
            <Route path="/whatsapp" element={<OrganizationTabs />} />
            <Route path="/email-config" element={<OrganizationTabs />} />
            <Route path="/settings/invoice" element={<OrganizationTabs />} />

            {/* ========================================================================= */}
            {/* MASTER DATA MANAGEMENT                                                    */}
            {/* ========================================================================= */}

            {/* Customers */}
            <Route element={<ProtectedRoute permission="customers.view" />}>
              <Route path="/customers" element={<SalesTabs />} />
            </Route>
            {/* Customers Create Route */}
            <Route element={<ProtectedRoute permission="customers.create" />}>
              <Route path="/customers/create" element={<CustomerFormPage />} />
            </Route>
            {/* Customers Edit :Id Route */}
            <Route element={<ProtectedRoute permission="customers.edit" />}>
              <Route path="/customers/edit/:id" element={<CustomerFormPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="suppliers.view" />}>
              <Route path="/suppliers" element={<PurchaseTabs />} />
            </Route>
            {/* Suppliers Create Route */}
            <Route element={<ProtectedRoute permission="suppliers.create" />}>
              <Route path="/suppliers/create" element={<SupplierCreatePage />} />
            </Route>
            {/* Suppliers Edit :Id Route */}
            <Route element={<ProtectedRoute permission="suppliers.edit" />}>
              <Route path="/suppliers/edit/:id" element={<SupplierEditPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="supplierpricelist.view" />}>
              <Route path="/suppliers/:supplierId/material-prices" element={<SupplierMaterialPricingList />} />
            </Route>

            {/* Profile */}
            <Route element={<ProtectedRoute permission="profile.view" />}>
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Employees Management (RBAC guarded) */}
            <Route element={<ProtectedRoute permission="employees.view" />}>
              <Route path="/employees" element={<HROrganizationTabs />} />
            </Route>
            {/* Employees Create Route */}
            <Route element={<ProtectedRoute permission="employees.create" />}>
              <Route path="/employees/create" element={<EmployeeCreatePage />} />
            </Route>
            {/* Employees View :Id Route */}
            <Route element={<ProtectedRoute permission="employees.view" />}>
              <Route path="/employees/view/:id" element={<EmployeeViewPage />} />
            </Route>
            {/* Employees Edit :Id Route */}
            <Route element={<ProtectedRoute permission="employees.edit" />}>
              <Route path="/employees/edit/:id" element={<EmployeeEdit />} />
            </Route>

            {/* Products Management (RBAC guarded) */}
            <Route element={<ProtectedRoute permissionAny={["products.view", "categories.view", "raw_material_categories.view", "raw_materials.view", "uoms.view", "wastage-store.view", "sales_products.view"]} />}>
              <Route path="/products" element={<ProductMasterTabs />} />
              <Route path="/categories" element={<ProductMasterTabs />} />
              <Route path="/uoms" element={<ProductMasterTabs />} />
              <Route path="/raw-materials" element={<ProductMasterTabs />} />
              <Route path="/raw-material-categories" element={<ProductMasterTabs />} />
              <Route path="/wastage-store" element={<ProductMasterTabs />} />
              <Route path="/sales-products" element={<ProductMasterTabs />} />
            </Route>
            {/* Products Create Route */}
            <Route element={<ProtectedRoute permission="products.create" />}>
              <Route path="/products/create" element={<ProductForm />} />
            </Route>
            {/* Products Edit :Id Route */}
            <Route element={<ProtectedRoute permission="products.edit" />}>
              <Route path="/products/edit/:id" element={<ProductForm />} />
            </Route>
            {/* Sales Product Routes */}
            <Route element={<ProtectedRoute permission="sales_products.create" />}>
              <Route path="/sales-products/create" element={<SalesProductForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales_products.edit" />}>
              <Route path="/sales-products/edit/:id" element={<SalesProductForm />} />
            </Route>

            {/* Administration (RBAC guarded) */}
            <Route element={<ProtectedRoute permission="users.view" />}>
              <Route path="/users" element={<UserList />} />
            </Route>
            {/* Roles Route */}
            <Route element={<ProtectedRoute permission="roles.view" />}>
              <Route path="/roles" element={<OrganizationTabs />} />
            </Route>
            {/* Permissions Route */}
            <Route element={<ProtectedRoute permission="permissions.view" />}>
              <Route path="/permissions" element={<PermissionList />} />
            </Route>
            {/* Role Permissions Route */}
            <Route element={<ProtectedRoute permission="role-permissions.view" />}>
              <Route path="/role-permissions" element={<OrganizationTabs />} />
            </Route>

            <Route element={<ProtectedRoute permission="departments.view" />}>
              <Route path="/departments" element={<OrganizationTabs />} />
            </Route>
            {/* Uoms Route */}
            <Route element={<ProtectedRoute permissionAny={["products.view", "categories.view", "raw_material_categories.view", "raw_materials.view", "uoms.view", "wastage-store.view"]} />}>
              <Route path="/uoms" element={<ProductMasterTabs />} />
            </Route>

            {/* ========================================================================= */}
            {/* INVENTORY & STORES                                                        */}
            {/* ========================================================================= */}

            {/* Storage Stores */}
            <Route element={<ProtectedRoute permissionAny={["stores.view", "store-types.view", "locations.view"]} />}>
              <Route path="/storage-stores" element={<StoreLocationTabs />} />
            </Route>


            {/* Store Types */}
            <Route element={<ProtectedRoute permissionAny={["stores.view", "store-types.view", "locations.view"]} />}>
              <Route path="/store-types" element={<StoreLocationTabs />} />
            </Route>

            {/* Locations */}
            <Route element={<ProtectedRoute permissionAny={["stores.view", "store-types.view", "locations.view"]} />}>
              <Route path="/locations" element={<StoreLocationTabs />} />
            </Route>

            {/* Machines */}
            <Route element={<ProtectedRoute permission="machines.view" />}>
              <Route path="/machines" element={<HROrganizationTabs />} />
              <Route path="/machines/assignments" element={<HROrganizationTabs />} />
            </Route>
            {/* Machines Create Route */}
            <Route element={<ProtectedRoute permission="machines.create" />}>
              <Route path="/machines/create" element={<MachineCreate />} />
            </Route>
            {/* Machines Edit :Id Route */}
            <Route element={<ProtectedRoute permission="machines.edit" />}>
              <Route path="/machines/edit/:id" element={<MachineEdit />} />
            </Route>
            {/* Machine Assignments Create/Edit Routes */}
            <Route element={<ProtectedRoute permission="machines.create" />}>
              <Route path="/machines/assignments/create" element={<MachineAssignmentForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="machines.edit" />}>
              <Route path="/machines/assignments/edit/:id" element={<MachineAssignmentForm />} />
            </Route>

            {/* Shifts */}
            <Route element={<ProtectedRoute permission="shifts.view" />}>
              <Route path="/shifts" element={<HROrganizationTabs />} />
            </Route>
            {/* Shifts Create Route */}
            <Route element={<ProtectedRoute permission="shifts.create" />}>
              <Route path="/shifts/create" element={<ShiftCreate />} />
            </Route>
            {/* Shifts Edit :Id Route */}
            <Route element={<ProtectedRoute permission="shifts.edit" />}>
              <Route path="/shifts/edit/:id" element={<ShiftEdit />} />
            </Route>

            {/* Raw Materials */}
            <Route element={<ProtectedRoute permissionAny={["products.view", "categories.view", "raw_material_categories.view", "raw_materials.view", "uoms.view", "wastage-store.view"]} />}>
              <Route path="/raw-materials" element={<ProductMasterTabs />} />
            </Route>
            {/* Raw Material Categories Route */}
            <Route element={<ProtectedRoute permissionAny={["products.view", "categories.view", "raw_material_categories.view", "raw_materials.view", "uoms.view", "wastage-store.view"]} />}>
              <Route path="/raw-material-categories" element={<ProductMasterTabs />} />
            </Route>
            {/* Raw Materials Create Route */}
            <Route element={<ProtectedRoute permission="raw_materials.create" />}>
              <Route path="/raw-materials/create" element={<RawMaterialForm />} />
            </Route>
            {/* Raw Materials Edit :Id Route */}
            <Route element={<ProtectedRoute permission="raw_materials.edit" />}>
              <Route path="/raw-materials/edit/:id" element={<RawMaterialForm />} />
            </Route>

            {/* Sales Product */}
            <Route element={<ProtectedRoute permissionAny={["products.view", "categories.view", "raw_material_categories.view", "raw_materials.view", "uoms.view", "wastage-store.view", "sales_products.view"]} />}>
              <Route path="/sales-products" element={<ProductMasterTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales_products.create" />}>
              <Route path="/sales-products/create" element={<SalesProductForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales_products.edit" />}>
              <Route path="/sales-products/edit/:id" element={<SalesProductForm />} />
            </Route>

            {/* Wastage Store */}
            <Route element={<ProtectedRoute permissionAny={["products.view", "categories.view", "raw_material_categories.view", "raw_materials.view", "uoms.view", "wastage-store.view"]} />}>
              <Route path="/wastage-store" element={<ProductMasterTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="raw_materials.create" />}>
              <Route path="/wastage-store/create" element={<WastageStoreForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="raw_materials.edit" />}>
              <Route path="/wastage-store/edit/:id" element={<WastageStoreForm />} />
            </Route>

            {/* Stock (raw material / finished goods stores) */}
            <Route element={<ProtectedRoute permissionAny={["raw_material_stocks.view", "finished_goods_stocks.view"]} />}>
              <Route path="/stock" element={<InventoryTabs />} />
            </Route>

            {/* Stock Adjustments */}
            <Route element={<ProtectedRoute permission="stock-adjustments.view" />}>
              <Route path="/inventory/stock-adjustments" element={<InventoryTabs />} />
              <Route path="/inventory/stock-adjustments/view/:id" element={<StockAdjustmentView />} />
            </Route>
            <Route element={<ProtectedRoute permission="stock-adjustments.create" />}>
              <Route path="/inventory/stock-adjustments/create" element={<StockAdjustmentForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="stock-adjustments.edit" />}>
              <Route path="/inventory/stock-adjustments/edit/:id" element={<StockAdjustmentForm />} />
            </Route>

            {/* EOD Stock */}
            <Route element={<ProtectedRoute permission="eod-stock.view" />}>
              <Route path="/inventory/eod-stock" element={<InventoryTabs />} />
            </Route>

            {/* Wastage Stock */}
            <Route element={<ProtectedRoute permission="wastage-stock.view" />}>
              <Route path="/wastage-stock" element={<WastageStockList />} />
            </Route>
            <Route element={<ProtectedRoute permission="wastage-stock.create" />}>
              <Route path="/wastage-stock/create" element={<WastageStockCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="wastage-stock.edit" />}>
              <Route path="/wastage-stock/edit/:id" element={<WastageStockEdit />} />
            </Route>

            {/* Finished Stock */}
            <Route element={<ProtectedRoute permission="finished_goods_stocks.view" />}>
              <Route path="/finished-stock" element={<InventoryTabs />} />
            </Route>
            {/* Finished Stock Create Route */}
            <Route element={<ProtectedRoute permission="finished_goods_stocks.create" />}>
              <Route path="/finished-stock/create" element={<FinishedStockCreate />} />
            </Route>
            {/* Finished Stock Edit :Id Route */}
            <Route element={<ProtectedRoute permission="finished_goods_stocks.edit" />}>
              <Route path="/finished-stock/edit/:id" element={<FinishedStockEdit />} />
            </Route>

            {/* ========================================================================= */}
            {/* PRODUCTION & PLANNING                                                     */}
            {/* ========================================================================= */}

            {/* Weekly Machine Schedules */}
            <Route element={<ProtectedRoute permission="weekly_programs.view" />}>
              <Route path="/weekly-machine-schedules" element={<ProductionOrderTabs />} />
            </Route>


            {/* Weekly Machine Schedules Board Route */}
            <Route element={<ProtectedRoute permission="weekly_programs.view" />}>
              {/* <Route path="/weekly-machine-schedules/board" element={<WeeklyMachinePlanningBoard />} /> */}
            </Route>

            {/* Weekly Machine Schedules Create Route */}
            <Route element={<ProtectedRoute permission="weekly_programs.create" />}>
              <Route path="/weekly-machine-schedules/create" element={<WeeklyMachineScheduleCreate />} />
            </Route>
            {/* Weekly Machine Schedules Edit :Id Route */}
            <Route element={<ProtectedRoute permission="weekly_programs.edit" />}>
              <Route path="/weekly-machine-schedules/edit/:id" element={<WeeklyMachineScheduleEdit />} />
            </Route>

            {/* Daily Machine Planning */}
            <Route element={<ProtectedRoute permission="daily-machine-planning.view" />}>
              <Route path="/daily-machine-planning" element={<ProductionOrderTabs />} />
              <Route path="/daily-machine-planning/view/:id" element={<DailyPlanViewPage />} />
              <Route path="/daily-machine-planning/report" element={<DailyReportPage />} />
            </Route>

            {/* Daily Production Plans Create / Edit */}
            <Route element={<ProtectedRoute permission="daily-machine-planning.create" />}>
              <Route path="/daily-production-plans/create" element={<DailyPlanCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="daily-machine-planning.edit" />}>
              <Route path="/daily-production-plans/edit/:id" element={<DailyPlanCreate />} />
            </Route>

            {/* Shift Execution Board */}
            <Route element={<ProtectedRoute permission="shift-execution.view" />}>
              <Route path="/shift-execution" element={<ShiftExecutionBoard />} />
            </Route>

            {/* Production Dashboard */}
            <Route element={<ProtectedRoute permission="production_orders.view" />}>
              <Route path="/production-dashboard" element={<ProductionDashboard />} />
            </Route>

            {/* Hourly Machine Work Reports */}
            <Route element={<ProtectedRoute permission="hourly_productions.view" />}>
              <Route path="/hourly-work-reports" element={<ProductionOrderTabs />} />
            </Route>
            {/* Hourly Work Reports Create Route */}
            <Route element={<ProtectedRoute permission="hourly_productions.create" />}>
              <Route path="/hourly-work-reports/create" element={<HourlyWorkReportCreate />} />
            </Route>
            {/* Hourly Work Reports Edit :Id Route */}
            <Route element={<ProtectedRoute permission="hourly_productions.edit" />}>
              <Route path="/hourly-work-reports/edit/:id" element={<HourlyWorkReportEdit />} />
            </Route>

            {/* Production Wastage */}
            <Route element={<ProtectedRoute permission="production-wastages.view" />}>
              <Route path="/production-wastages" element={<ProductionOrderTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="production-wastages.create" />}>
              <Route path="/production-wastages/create" element={<WastageForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="production-wastages.edit" />}>
              <Route path="/production-wastages/edit/:id" element={<WastageForm />} />
            </Route>

            {/* Production Orders */}
            <Route element={<ProtectedRoute permission="production_orders.view" />}>
              <Route path="/production-orders" element={<ProductionOrderTabs />} />
              <Route path="/allproduction-orders" element={<ProductionOrderTabs />} />
              <Route path="/approved-sales-orders" element={<ProductionOrderTabs />} />
              <Route path="/production-orders/history/view/:id" element={<ProductionOrderHistoryView />} />
            </Route>
            {/* OEE Dashboard */}
            <Route element={<ProtectedRoute permission="oee-dashboard.view" />}>
              <Route path="/oee-dashboard" element={<ProductionOrderTabs />} />
            </Route>
            {/* Production Orders Create Route */}
            <Route element={<ProtectedRoute permission="production_orders.create" />}>
              <Route path="/production-orders/create" element={<ProductionOrderCreate />} />
            </Route>
            {/* Production Orders Edit :Id Route */}
            <Route element={<ProtectedRoute permission="production_orders.edit" />}>
              <Route path="/production-orders/edit/:id" element={<ProductionOrderCreate />} />
            </Route>

            {/* Goods Dispatch */}
            <Route element={<ProtectedRoute permission="goods-dispatch.view" />}>
              <Route path="/production/goods-dispatch" element={<ProductionOrderTabs />} />
              <Route path="/production/goods-dispatch/view/:id" element={<GoodsDispatchView />} />
              <Route path="/production/goods-dispatch/detail/:id" element={<GoodsDispatchDetail />} />
            </Route>
            <Route element={<ProtectedRoute permission="goods-dispatch.edit" />}>
              <Route path="/production/goods-dispatch/gate-approval/:id" element={<GoodsDispatchGateApproval />} />
              <Route path="/production/goods-dispatch/store-approval/:id" element={<GoodsDispatchStoreApproval />} />
            </Route>
            <Route element={<ProtectedRoute permission="goods-dispatch.create" />}>
              <Route path="/production/goods-dispatch/create" element={<GoodsDispatchCreate />} />
            </Route>

            {/* ========================================================================= */}
            {/* REPORTS                                                                   */}
            {/* ========================================================================= */}

            {/* Reports */}
            <Route element={<ProtectedRoute permission="sales-reports.view" />}>
              <Route path="/reports/sales" element={<ReportsTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="purchase-reports.view" />}>
              <Route path="/reports/purchase" element={<ReportsTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="inventory-reports.view" />}>
              <Route path="/reports/inventory" element={<ReportsTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="production-reports.view" />}>
              <Route path="/reports/production" element={<ReportsTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="audit-reports.view" />}>
              <Route path="/reports/audit" element={<ReportsTabs />} />
            </Route>

            {/* ========================================================================= */}
            {/* SALES & QUOTATIONS                                                        */}
            {/* ========================================================================= */}

            {/* ========================================================================= */}
            {/* SALES & QUOTATIONS                                                        */}
            {/* ========================================================================= */}

            {/* Sales Orders */}
            <Route element={<ProtectedRoute permission="sales-orders.view" />}>
              <Route path="/sales-order" element={<SalesTabs />} />
              <Route path="/sales-order/details/:id" element={<OrderDetails />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales-orders.create" />}>
              <Route path="/sales-order/create" element={<SalesOrderCreate />} />
            </Route>
            {/* Draft Orders */}
            <Route element={<ProtectedRoute permission="draft-orders.view" />}>
              <Route path="/draft-order" element={<SalesTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="draft-orders.edit" />}>
              <Route path="/draft-order/edit/:id" element={<SalesOrderCreate />} />
            </Route>
            {/* Quotations */}
            <Route element={<ProtectedRoute permission="quotations.view" />}>
              <Route path="/quatation-order" element={<SalesTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="quotations.edit" />}>
              <Route path="/quatation-order/edit/:id" element={<QuotationCreate />} />
            </Route>
            {/* Pending Quotations / MD Approvals */}
            <Route element={<ProtectedRoute permission="pending-quotations.view" />}>
              <Route path="/pending-quotations" element={<SalesTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="pending-quotations.edit" />}>
              <Route path="/pending-quotations/edit/:id" element={<UpdateQuatation />} />
            </Route>

            {/* Sales Invoices */}
            <Route element={<ProtectedRoute permission="sales-invoices.view" />}>
              <Route path="/sales-invoices" element={<SalesTabs />} />
              <Route path="/sales-invoices/details/:id" element={<SalesInvoiceView />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales-invoices.create" />}>
              <Route path="/sales-invoices/create" element={<SalesInvoiceForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales-invoices.edit" />}>
              <Route path="/sales-invoices/edit/:id" element={<SalesInvoiceForm />} />
            </Route>

            {/* Sales Returns */}
            <Route element={<ProtectedRoute permissionAny={["sales-returns.view", "sales-invoices.view"]} />}>
              <Route path="/sales-returns" element={<SalesTabs />} />
            </Route>

            {/* ========================================================================= */}
            {/* PURCHASE ORDERS                                                           */}
            {/* ========================================================================= */}

            <Route element={<ProtectedRoute permission="purchaseOrders.view" />}>
              <Route path="/purchase-orders" element={<PurchaseTabs />} />
              <Route path="/purchase-orders/view/:id" element={<PurchaseOrderViewPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="purchaseOrders.create" />}>
              <Route path="/purchase-orders/create" element={<PurchaseOrderCreatePage />} />
            </Route>
            <Route element={<ProtectedRoute permission="purchaseOrders.edit" />}>
              <Route path="/purchase-orders/edit/:id" element={<PurchaseOrderEditPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="purchase-order-approvals.view" />}>
              <Route path="/purchase-order-approvals" element={<PurchaseTabs />} />
            </Route>

            <Route element={<ProtectedRoute permission="expenses.view" />}>
              <Route path="/expenses" element={<PurchaseTabs />} />
            </Route>

            <Route element={<ProtectedRoute permissionAny={["purchase-returns.view", "expenses.view", "purchaseOrders.view"]} />}>
              <Route path="/purchase-returns" element={<PurchaseTabs />} />
            </Route>

            <Route element={<ProtectedRoute permission="invoice.view" />}>
              <Route path="/invoice" element={<PurchaseTabs />} />
              <Route path="/invoice/details/:id" element={<GrnInvoiceViewPage />} />
              <Route path="/po-invoice/:id" element={<PoInvoicePage />} />
            </Route>
            <Route element={<ProtectedRoute permission="invoice.create" />}>
              <Route path="/invoice/create" element={<InvoiceDetail />} />
            </Route>
            <Route element={<ProtectedRoute permission="invoice.edit" />}>
              <Route path="/invoice/edit/:id" element={<InvoiceDetail />} />
            </Route>

            {/* ========================================================================= */}
            {/* ACCOUNTS & FINANCIALS                                                     */}
            {/* ========================================================================= */}
            <Route element={<ProtectedRoute permissionAny={["accounts.view", "payable.view", "receivable.view", "vouchers.view", "petty-cash.view", "chart-of-accounts.view"]} />}>
              <Route path="/accounts" element={<AccountsTabs />} />
              <Route path="/accounts/payable" element={<AccountsTabs />} />
              <Route path="/accounts/payable/:supplierId" element={<SupplierBreakdownPage />} />
              <Route path="/accounts/receivable" element={<AccountsTabs />} />
              <Route path="/accounts/receivable/:customerId" element={<CustomerBreakdownPage />} />
              <Route path="/accounts/ledger-statement" element={<AccountsTabs />} />
              <Route path="/accounts/chart-of-accounts" element={<AccountsTabs />} />
              <Route path="/accounts/vouchers" element={<AccountsTabs />} />
              <Route path="/accounts/sales-returns" element={<AccountsTabs />} />
              <Route path="/accounts/purchase-returns" element={<AccountsTabs />} />
              <Route path="/accounts/petty-cash" element={<AccountsTabs />} />
              <Route path="/accounts/trial-balance" element={<AccountsTabs />} />
              <Route path="/accounts/profit-loss" element={<AccountsTabs />} />
            </Route>

            <Route path="/settings" element={<Settings />} />

            {/* ========================================================================= */}
            {/* PAYROLL                                                                   */}
            {/* ========================================================================= */}
            <Route element={<ProtectedRoute permissionAny={["payroll.view", "payroll-run.view", "payroll-settings.view", "payroll-attendance.view", "payroll-advance.view"]} />}>
              <Route path="/payroll" element={<PayrollDashboard />} />
              <Route path="/payroll/run" element={<PayrollRun />} />
              <Route path="/payroll/settings" element={<PayrollSettings />} />
              <Route path="/payroll/attendance" element={<AttendancePage />} />
              <Route path="/payroll/advance" element={<SalaryAdvancePage />} />
              <Route path="/payroll/monthly-report" element={<MonthlyPayrollReport />} />
              <Route path="/payroll/weekly-report" element={<WeeklyPayrollReport />} />
            </Route>
            {/* Accounts Module Routes */}
            <Route path="/accounts/payable" element={<AccountsTabs />} />
            <Route path="/accounts/payable/:supplierId" element={<SupplierBreakdownPage />} />
            <Route path="/accounts/receivable" element={<AccountsTabs />} />
            <Route path="/accounts/receivable/:customerId" element={<CustomerBreakdownPage />} />
            <Route path="/accounts/ledger-statement" element={<AccountsTabs />} />
            <Route path="/accounts/chart-of-accounts" element={<AccountsTabs />} />
            <Route path="/accounts/vouchers" element={<AccountsTabs />} />
            <Route path="/accounts/vouchers/*" element={<AccountsTabs />} />
            <Route path="/accounts/sales-returns" element={<AccountsTabs />} />
            <Route path="/accounts/purchase-returns" element={<AccountsTabs />} />
            <Route path="/accounts/petty-cash" element={<AccountsTabs />} />

          </Route>
        </Route>

        {/* Public Routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          {/* Reset Route */}
          <Route path="/reset" element={<ResetPassword />} />
        </Route>

        {/* 403 — Access Denied (outside BaseLayout so it's full-page) */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </Suspense >
  );
};

export default AppRoutes;
