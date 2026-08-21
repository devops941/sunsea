import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import BaseLayout from "../components/layout/BaseLayout";
import PageContainer from "../components/layout/PageContainer";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import CommonLoader from "../components/ui/Loader/CommonLoader";
import logo from '../../public/loaderimage.png'

// ===========================================================================
// CORE
// ===========================================================================
const Dashboard = lazy(() => import("../modules/dashboard/pages/DashboardPage"));
const ProductionDashboard = lazy(() => import("../modules/dashboard/pages/ProductionDashboard"));
const OeeDashboard = lazy(() => import("../modules/dashboard/pages/OeeDashboard"));
const NotFoundPage = lazy(() => import("../modules/not-found/pages/NotFoundPage"));
const UnauthorizedPage = lazy(() => import("../modules/unauthorized/pages/UnauthorizedPage"));
const LoginPage = lazy(() => import("../modules/login/pages/LoginPage"));
const ResetPassword = lazy(() => import("../modules/passwordreset/pages/ResetPassword"));

// ===========================================================================
// ADMINISTRATION & ORGANIZATION
// ===========================================================================
const ProfilePage = lazy(() => import("../modules/profile/ProfilePage"));
const CompanySettings = lazy(() => import("../modules/company/pages/CompanySettings"));
const RoleList = lazy(() => import("../modules/roles/pages/RoleList"));
const RolePermissionMapping = lazy(() => import("../modules/role-permissions/pages/RolePermissionMapping"));
const DepartmentList = lazy(() => import("../modules/departments/pages/DepartmentList"));
const GstTaxList = lazy(() => import("../modules/settings/GstTaxListPage"));
const WhatsappSettings = lazy(() => import("../modules/whatsapp/WhatsappCreate"));
const EmailConfigPage = lazy(() => import("../modules/email-config/pages/EmailConfigPage"));
const InvoiceSettings = lazy(() => import("../modules/sales-order-invoice/sales-invoiceCreate"));
const UserList = lazy(() => import("../modules/users/pages/UserList"));
const PermissionList = lazy(() => import("../modules/permissions/pages/PermissionList"));
const Settings = lazy(() => import("../modules/settings/Setting"));

// ===========================================================================
// CATEGORY MASTER
// ===========================================================================
const CategoryList = lazy(() => import("../modules/category/pages/CategoryList"));
const CategoryForm = lazy(() => import("../modules/category/pages/CategoryForm"));

// ===========================================================================
// PRODUCT MASTER
// ===========================================================================
const ProductList = lazy(() => import("../modules/product/pages/ProductList"));
const UomList = lazy(() => import("../modules/product/pages/UOMList"));
const RawMaterialList = lazy(() => import("../modules/raw-materials/pages/RawMaterialList"));
const WastageStoreList = lazy(() => import("../modules/wastage-store/pages/WastageStoreList"));
const SalesProductList = lazy(() => import("../modules/sales-product/pages/SalesProductList"));

// const ProductForm = lazy(() => import("../modules/product/pages/ProductForm"));
const RawMaterialForm = lazy(() => import("../modules/raw-materials/pages/RawMaterialForm"));
const SalesProductForm = lazy(() => import("../modules/sales-product/pages/SalesProductForm"));
const WastageStoreForm = lazy(() => import("../modules/wastage-store/pages/WastageStoreForm"));

// ===========================================================================
// HR & ORGANIZATION
// ===========================================================================
const EmployeeList = lazy(() => import("../modules/employee/pages/EmployeeList"));
const EmployeeCreatePage = lazy(() => import("../modules/employee/pages/EmployeeCreate"));
const EmployeeEdit = lazy(() => import("../modules/employee/pages/EmployeeEdit"));
const EmployeeViewPage = lazy(() => import("../modules/employee/pages/EmployeeViewPage"));

const ShiftList = lazy(() => import("../modules/shifts/pages/ShiftList"));
const ShiftCreate = lazy(() => import("../modules/shifts/pages/ShiftCreate"));
const ShiftEdit = lazy(() => import("../modules/shifts/pages/ShiftEdit"));

const MachineList = lazy(() => import("../modules/machines/pages/MachineList"));
const SupplierFormPage = lazy(() => import("../modules/supplier/pages/SupplierForm"));
// const SupplierMaterialPricingList = lazy(() => import("../modules/supplier/pages/Suppliermaterialpricinglist"));

// Products

const ProductForm = lazy(() => import("../modules/product/pages/ProductForm"));



// Administration
// const UserList = lazy(() => import("../modules/users/pages/UserList"));

// const PermissionList = lazy(() => import("../modules/permissions/pages/PermissionList"));


// HR

// Product Master Attributes




// New modules
const MachineCreate = lazy(() => import("../modules/machines/pages/MachineCreate"));
const MachineEdit = lazy(() => import("../modules/machines/pages/MachineEdit"));
const MachineAssignmentList = lazy(() => import("../modules/machine-operation-assignments/pages/MachineAssignmentList"));
const MachineAssignmentForm = lazy(() => import("../modules/machine-operation-assignments/pages/MachineAssignmentForm"));

// ===========================================================================
// STORES & LOCATIONS
// ===========================================================================
const StorageStoreList = lazy(() => import("../modules/storage-stores/pages/StorageStoreList"));
const StorageStoreForm = lazy(() => import("../modules/storage-stores/pages/StorageStoreForm"));
// ===========================================================================
// INVENTORY
// ===========================================================================
const StockList = lazy(() => import("../modules/stock/pages/StockList"));
const FinishedStockList = lazy(() => import("../modules/finished-stock/pages/FinishedStockList"));
const FinishedStockCreate = lazy(() => import("../modules/finished-stock/pages/FinishedStockCreate"));
const FinishedStockEdit = lazy(() => import("../modules/finished-stock/pages/FinishedStockEdit"));

const StockAdjustmentList = lazy(() => import("../modules/stock-adjustments/pages/StockAdjustmentList"));
const StockAdjustmentForm = lazy(() => import("../modules/stock-adjustments/pages/StockAdjustmentForm"));
const StockAdjustmentView = lazy(() => import("../modules/stock-adjustments/pages/StockAdjustmentView"));

const EodStockList = lazy(() => import("../modules/Eodstock/pages/EodStockList"));

const WastageStockList = lazy(() => import("../modules/wastage-stock/pages/WastageStockList"));
const WastageStockCreate = lazy(() => import("../modules/wastage-stock/pages/WastageStockCreate"));
const WastageStockEdit = lazy(() => import("../modules/wastage-stock/pages/WastageStockEdit"));

// ===========================================================================
// PRODUCTION & PLANNING
// ===========================================================================
const ProductionOrderList = lazy(() => import("../modules/production-orders/pages/ProductionOrderList"));
const AllProductionOrderList = lazy(() => import("../modules/production-orders/pages/AllProductionOrderList"));
const ProductionOrderCreate = lazy(() => import("../modules/production-orders/pages/ProductionOrderCreate"));
const ProductionOrderHistoryView = lazy(() => import("../modules/production-orders/pages/ProductionOrderHistoryView"));

const WeeklyMachineScheduleList = lazy(() => import("../modules/weekly-machine-schedules/pages/WeeklyMachineScheduleList"));
const WeeklyMachineScheduleCreate = lazy(() => import("../modules/weekly-machine-schedules/pages/WeeklyMachineScheduleCreate"));
const WeeklyMachineScheduleEdit = lazy(() => import("../modules/weekly-machine-schedules/pages/WeeklyMachineScheduleEdit"));

const DailyProductionPlanningPage = lazy(() => import("../modules/daily-machine-planning/pages/DailyProductionPlanningPage"));
const DailyPlanCreate = lazy(() => import("../modules/daily-machine-planning/pages/DailyPlanCreate"));
const DailyPlanViewPage = lazy(() => import("../modules/daily-machine-planning/pages/DailyPlanViewPage"));
const DailyReportPage = lazy(() => import("../modules/daily-machine-planning/pages/DailyReportPage"));

const HourlyWorkReportList = lazy(() => import("../modules/hourly-work-reports/pages/HourlyWorkReportList"));
const HourlyWorkReportCreate = lazy(() => import("../modules/hourly-work-reports/pages/HourlyWorkReportCreate"));
const HourlyWorkReportEdit = lazy(() => import("../modules/hourly-work-reports/pages/HourlyWorkReportEdit"));

const WastageList = lazy(() => import("../modules/production-wastage/pages/WastageList"));
const WastageForm = lazy(() => import("../modules/production-wastage/pages/WastageCreate"));

const ShiftExecutionBoard = lazy(() => import("../modules/shift-execution/pages/ShiftExecutionBoard"));

// Goods Dispatch
const GoodsDispatchList = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchList"));
const GoodsDispatchCreate = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchCreate"));
const GoodsDispatchView = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchView"));
const GoodsDispatchDetail = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchDetail"));
const GoodsDispatchGateApproval = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchGateApproval"));
const GoodsDispatchStoreApproval = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchStoreApproval"));

// ===========================================================================
// REPORTS
// ===========================================================================
const SalesReportsCenter = lazy(() => import("../modules/reports/pages/SalesReportsCenter"));
const PurchaseReportsCenter = lazy(() => import("../modules/reports/pages/PurchaseReportsCenter"));
const InventoryReportsCenter = lazy(() => import("../modules/reports/pages/InventoryReportsCenter"));
const ProductionReportsCenter = lazy(() => import("../modules/reports/pages/ProductionReportsCenter"));

// ===========================================================================
// SALES
// ===========================================================================
const CustomerListPage = lazy(() => import("../modules/customers/pages/CustomerListPage"));
const CustomerFormPage = lazy(() => import("../modules/customers/pages/CustomerFormPage"));

const AllSalesOrderList = lazy(() => import("../modules/sales/salesorder/AllSalesOrderList"));
const SalesOrderCreate = lazy(() => import("../modules/sales/salesorder/CreateOrder"));
const OrderDetails = lazy(() => import("../modules/sales/salesorder/SalesOrderDetail"));

const QuotationList = lazy(() => import("../modules/sales/quatation/QuatationList"));
const PendingQuotationList = lazy(() => import("../modules/sales/quatation/PendingQuatation"));
const QuotationCreate = lazy(() => import("../modules/sales/quatation/CreateQuatation"));
const UpdateQuatation = lazy(() => import("../modules/sales/quatation/UpdateQuatation"));

const SalesInvoiceList = lazy(() => import("../modules/sales-order-invoice/SalesInvoiceList"));
const SalesInvoiceForm = lazy(() => import("../modules/sales-order-invoice/SalesInvoiceCreate"));
const SalesInvoiceView = lazy(() => import("../modules/sales-order-invoice/SalesInvoiceView"));

// ===========================================================================
// PURCHASE
// ===========================================================================
const SupplierListPage = lazy(() => import("../modules/supplier/pages/SupplierList"));

const SupplierMaterialPricingList = lazy(() => import("../modules/supplier/pages/Suppliermaterialpricinglist"));

const PurchaseOrderListPage = lazy(() => import("../modules/purchase/purchase-order/pages/PurchaseOrderListPage"));

// Purchase Order Module

const PurchaseOrderForm = lazy(() => import("../modules/purchase/purchase-order/pages/PurchaseOrderForm"));

const PurchaseOrderViewPage = lazy(() => import("../modules/purchase/purchase-order/purchaseordeappovals/PurchaseOrderapprovalEdit"));
const POMDApproval = lazy(() => import("../modules/purchase/purchase-order/purchaseordeappovals/PurchaseOrderapprovalList"));

const ExpensesList = lazy(() => import("../modules/expenses/ExpensesList"));

const InvoiceList = lazy(() => import("../modules/purchase/purchase-order/invoice/InvoiceList"));
const InvoiceDetail = lazy(() => import("../modules/purchase/purchase-order/upcoming-orders/InvoiceDetailPage"));
const GrnInvoiceViewPage = lazy(() => import("../modules/purchase/purchase-order/invoice/GrnInvoiceViewPage"));
const PoInvoicePage = lazy(() => import("../modules/purchase/purchase-order/invoice/PoInvoicePage"));

// ===========================================================================
// ACCOUNTS & FINANCIALS
// Most of these also have a default export; the three at the bottom are named
// exports only, so their lazy import has to remap the name onto `default`.
// ===========================================================================
const AmountPayablePage = lazy(() => import("../modules/accounts/pages/payable/AmountPayablePage"));
const AmountReceivablePage = lazy(() => import("../modules/accounts/pages/receivable/AmountReceivablePage"));
const SupplierBreakdownPage = lazy(() => import("../modules/accounts/pages/payable/SupplierBreakdownPage"));
const CustomerBreakdownPage = lazy(() => import("../modules/accounts/pages/receivable/CustomerBreakdownPage"));
const LedgerStatementPage = lazy(() => import("../modules/accounts/pages/ledger-statement/LedgerStatementPage"));
const ChartOfAccountsPage = lazy(() => import("../modules/accounts/pages/chart-of-accounts/ChartOfAccountsPage"));
const VoucherListPage = lazy(() => import("../modules/accounts/pages/vouchers/VoucherListPage"));
const TrialBalancePage = lazy(() => import("../modules/accounts/pages/reports/TrialBalancePage"));
const ProfitLossPage = lazy(() => import("../modules/accounts/pages/reports/ProfitLossPage"));

const SalesReturnPage = lazy(() =>
  import("../modules/accounts/pages/returns/SalesReturnPage").then((m) => ({ default: m.SalesReturnPage }))
);
const PurchaseReturnPage = lazy(() =>
  import("../modules/accounts/pages/returns/PurchaseReturnPage").then((m) => ({ default: m.PurchaseReturnPage }))
);
const PettyCashPage = lazy(() =>
  import("../modules/accounts/pages/petty-cash/PettyCashPage").then((m) => ({ default: m.PettyCashPage }))
);

// ===========================================================================
// PAYROLL
// ===========================================================================
const PayrollDashboard = lazy(() => import("../modules/payroll/pages/PayrollDashboard"));
const PayrollRun = lazy(() => import("../modules/payroll/pages/PayrollRun"));
const PayrollSettings = lazy(() => import("../modules/payroll/pages/PayrollSettings"));
const AttendancePage = lazy(() => import("../modules/payroll/pages/AttendancePage"));
const SalaryAdvancePage = lazy(() => import("../modules/payroll/pages/SalaryAdvancePage"));
const MonthlyPayrollReport = lazy(() => import("../modules/payroll/pages/MonthlyPayrollReport"));
const WeeklyPayrollReport = lazy(() => import("../modules/payroll/pages/WeeklyPayrollReport"));

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

            {/* ================================================================= */}
            {/* CORE & DASHBOARD                                                  */}
            {/* ================================================================= */}
            <Route index element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/company/edit" element={<CompanySettings />} />
            <Route path="/settings" element={<Settings />} />

            {/* Administration pages that ship their own `.inner-container` */}
            <Route element={<ProtectedRoute permission="users.view" />}>
              <Route path="/users" element={<UserList />} />
            </Route>
            <Route element={<ProtectedRoute permission="permissions.view" />}>
              <Route path="/permissions" element={<PermissionList />} />
            </Route>

            {/* ================================================================= */}
            {/* LIST / CONTENT PAGES                                              */}
            {/* Everything below used to be reached through a `*Tabs` wrapper;    */}
            {/* PageContainer supplies the shell those wrappers used to add.      */}
            {/* ================================================================= */}
            <Route element={<PageContainer />}>

              {/* ---------- Organization & Settings ---------- */}
              <Route path="/company/view" element={<ProfilePage />} />
              <Route path="/settings/company" element={<CompanySettings />} />
              <Route path="/settings/gst-taxes" element={<GstTaxList />} />
              <Route path="/whatsapp" element={<WhatsappSettings />} />
              <Route path="/email-config" element={<EmailConfigPage />} />
              <Route path="/settings/invoice" element={<InvoiceSettings />} />

              <Route element={<ProtectedRoute permission="profile.view" />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              <Route element={<ProtectedRoute permission="roles.view" />}>
                <Route path="/roles" element={<RoleList />} />
              </Route>
              <Route element={<ProtectedRoute permission="role-permissions.view" />}>
                <Route path="/role-permissions" element={<RolePermissionMapping />} />
              </Route>
              <Route element={<ProtectedRoute permission="departments.view" />}>
                <Route path="/departments" element={<DepartmentList />} />
              </Route>

              {/* ---------- Category Master ---------- */}
              <Route element={<ProtectedRoute permission="categories.view" />}>
                <Route path="/categories" element={<CategoryList />} />
              </Route>

              {/* ---------- Product Master ---------- */}
              <Route element={<ProtectedRoute permission="products.view" />}>
                <Route path="/products" element={<ProductList />} />
              </Route>
              <Route element={<ProtectedRoute permission="uoms.view" />}>
                <Route path="/uoms" element={<UomList />} />
              </Route>
              <Route element={<ProtectedRoute permission="raw_materials.view" />}>
                <Route path="/raw-materials" element={<RawMaterialList />} />
              </Route>
              <Route element={<ProtectedRoute permission="wastage-store.view" />}>
                <Route path="/wastage-store" element={<WastageStoreList />} />
              </Route>
              <Route element={<ProtectedRoute permission="sales_products.view" />}>
                <Route path="/sales-products" element={<SalesProductList />} />
              </Route>

              {/* ---------- HR & Organization ---------- */}
              <Route element={<ProtectedRoute permission="employees.view" />}>
                <Route path="/employees" element={<EmployeeList />} />
              </Route>
              <Route element={<ProtectedRoute permission="shifts.view" />}>
                <Route path="/shifts" element={<ShiftList />} />
              </Route>
              <Route element={<ProtectedRoute permission="machines.view" />}>
                <Route path="/machines" element={<MachineList />} />
              </Route>
              <Route element={<ProtectedRoute permission="machine-assignments.view" />}>
                <Route path="/machines/assignments" element={<MachineAssignmentList />} />
              </Route>

              {/* ---------- Stores & Locations ---------- */}
              <Route element={<ProtectedRoute permission="stores.view" />}>
                <Route path="/storage-stores" element={<StorageStoreList />} />
              </Route>
              <Route element={<ProtectedRoute permission="stores.create" />}>
                <Route path="/storage-stores/create" element={<StorageStoreForm />} />
              </Route>
              <Route element={<ProtectedRoute permission="stores.edit" />}>
                <Route path="/storage-stores/edit/:id" element={<StorageStoreForm />} />
              </Route>
              {/* ---------- Inventory ---------- */}
              <Route element={<ProtectedRoute permission="raw_material_stocks.view" />}>
                <Route path="/stock" element={<StockList />} />
              </Route>
              <Route element={<ProtectedRoute permission="finished_goods_stocks.view" />}>
                <Route path="/finished-stock" element={<FinishedStockList />} />
              </Route>
              <Route element={<ProtectedRoute permission="stock-adjustments.view" />}>
                <Route path="/inventory/stock-adjustments" element={<StockAdjustmentList />} />
              </Route>
              <Route element={<ProtectedRoute permission="eod-stock.view" />}>
                <Route path="/inventory/eod-stock" element={<EodStockList />} />
              </Route>
              <Route element={<ProtectedRoute permission="wastage-stock.view" />}>
                <Route path="/wastage-stock" element={<WastageStockList />} />
              </Route>

              {/* ---------- Production & Planning ---------- */}
              <Route element={<ProtectedRoute permission="production_orders.view" />}>
                <Route path="/production-orders" element={<ProductionOrderList />} />
                <Route path="/approved-sales-orders" element={<ProductionOrderList />} />
                <Route path="/allproduction-orders" element={<AllProductionOrderList />} />
              </Route>
              <Route element={<ProtectedRoute permission="oee-dashboard.view" />}>
                <Route path="/oee-dashboard" element={<OeeDashboard />} />
              </Route>
              <Route element={<ProtectedRoute permission="weekly_programs.view" />}>
                <Route path="/weekly-machine-schedules" element={<WeeklyMachineScheduleList />} />
              </Route>
              <Route element={<ProtectedRoute permission="daily-machine-planning.view" />}>
                <Route path="/daily-machine-planning" element={<DailyProductionPlanningPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="hourly_productions.view" />}>
                <Route path="/hourly-work-reports" element={<HourlyWorkReportList />} />
              </Route>
              <Route element={<ProtectedRoute permission="production-wastages.view" />}>
                <Route path="/production-wastages" element={<WastageList />} />
              </Route>
              <Route element={<ProtectedRoute permission="goods-dispatch.view" />}>
                <Route path="/production/goods-dispatch" element={<GoodsDispatchList />} />
              </Route>

              {/* ---------- Reports ---------- */}
              <Route element={<ProtectedRoute permission="sales-reports.view" />}>
                <Route path="/reports/sales" element={<SalesReportsCenter />} />
              </Route>
              <Route element={<ProtectedRoute permission="purchase-reports.view" />}>
                <Route path="/reports/purchase" element={<PurchaseReportsCenter />} />
              </Route>
              <Route element={<ProtectedRoute permission="inventory-reports.view" />}>
                <Route path="/reports/inventory" element={<InventoryReportsCenter />} />
              </Route>
              <Route element={<ProtectedRoute permission="production-reports.view" />}>
                <Route path="/reports/production" element={<ProductionReportsCenter />} />
              </Route>

              {/* ---------- Sales ---------- */}
              <Route element={<ProtectedRoute permission="customers.view" />}>
                <Route path="/customers" element={<CustomerListPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="sales-orders.view" />}>
                <Route path="/sales-order" element={<AllSalesOrderList />} />
              </Route>
              <Route element={<ProtectedRoute permission="quotations.view" />}>
                <Route path="/quatation-order" element={<QuotationList />} />
              </Route>
              <Route element={<ProtectedRoute permission="pending-quotations.view" />}>
                <Route path="/pending-quotations" element={<PendingQuotationList />} />
              </Route>
              <Route element={<ProtectedRoute permission="sales-invoices.view" />}>
                <Route path="/sales-invoices" element={<SalesInvoiceList />} />
              </Route>
              <Route element={<ProtectedRoute permissionAny={["sales-returns.view", "sales-invoices.view"]} />}>
                <Route path="/sales-returns" element={<SalesReturnPage />} />
              </Route>

              {/* ---------- Purchase ---------- */}
              <Route element={<ProtectedRoute permission="suppliers.view" />}>
                <Route path="/suppliers" element={<SupplierListPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="purchaseOrders.view" />}>
                <Route path="/purchase-orders" element={<PurchaseOrderListPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="purchase-order-approvals.view" />}>
                <Route path="/purchase-order-approvals" element={<POMDApproval />} />
              </Route>
              <Route element={<ProtectedRoute permission="invoice.view" />}>
                <Route path="/invoice" element={<InvoiceList />} />
              </Route>
              <Route element={<ProtectedRoute permission="expenses.view" />}>
                <Route path="/expenses" element={<ExpensesList />} />
              </Route>
              <Route element={<ProtectedRoute permissionAny={["purchase-returns.view", "expenses.view", "purchaseOrders.view"]} />}>
                <Route path="/purchase-returns" element={<PurchaseReturnPage />} />
              </Route>

              {/* ---------- Accounts & Financials ---------- */}
              <Route element={<ProtectedRoute permissionAny={["accounts.view", "payable.view", "receivable.view", "vouchers.view", "petty-cash.view", "chart-of-accounts.view"]} />}>
                <Route path="/accounts" element={<AmountPayablePage />} />
                <Route path="/accounts/payable" element={<AmountPayablePage />} />
                <Route path="/accounts/receivable" element={<AmountReceivablePage />} />
                <Route path="/accounts/ledger-statement" element={<LedgerStatementPage />} />
                <Route path="/accounts/chart-of-accounts" element={<ChartOfAccountsPage />} />
                <Route path="/accounts/vouchers" element={<VoucherListPage />} />
                <Route path="/accounts/vouchers/*" element={<VoucherListPage />} />
                <Route path="/accounts/sales-returns" element={<SalesReturnPage />} />
                <Route path="/accounts/purchase-returns" element={<PurchaseReturnPage />} />
                <Route path="/accounts/petty-cash" element={<PettyCashPage />} />
                <Route path="/accounts/trial-balance" element={<TrialBalancePage />} />
                <Route path="/accounts/profit-loss" element={<ProfitLossPage />} />
              </Route>

            </Route>
            {/* ================= end of PageContainer group ==================== */}

            {/* ================================================================= */}
            {/* FULL-WIDTH PAGES (forms, detail views, dashboards)                */}
            {/* ================================================================= */}

            {/* ---------- Categories ---------- */}
            <Route element={<ProtectedRoute permission="categories.create" />}>
              <Route path="/categories/create" element={<CategoryForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="categories.edit" />}>
              <Route path="/categories/edit/:id" element={<CategoryForm />} />
            </Route>

            {/* ---------- Customers ---------- */}
            <Route element={<ProtectedRoute permission="customers.create" />}>
              <Route path="/customers/create" element={<CustomerFormPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="customers.edit" />}>
              <Route path="/customers/edit/:id" element={<CustomerFormPage />} />
            </Route>

            {/* ---------- Suppliers ---------- */}
            <Route element={<ProtectedRoute permission="suppliers.create" />}>
              <Route path="/suppliers/create" element={<SupplierFormPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="suppliers.edit" />}>
              <Route path="/suppliers/edit/:id" element={<SupplierFormPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="supplierpricelist.view" />}>
              <Route path="/suppliers/:supplierId/material-prices" element={<SupplierMaterialPricingList />} />
            </Route>

            {/* ---------- Employees ---------- */}
            <Route element={<ProtectedRoute permission="employees.create" />}>
              <Route path="/employees/create" element={<EmployeeCreatePage />} />
            </Route>
            <Route element={<ProtectedRoute permission="employees.view" />}>
              <Route path="/employees/view/:id" element={<EmployeeViewPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="employees.edit" />}>
              <Route path="/employees/edit/:id" element={<EmployeeEdit />} />
            </Route>

            {/* ---------- Products ---------- */}
            <Route element={<ProtectedRoute permission="products.create" />}>
              <Route path="/products/create" element={<ProductForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="products.edit" />}>
              <Route path="/products/edit/:id" element={<ProductForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales_products.create" />}>
              <Route path="/sales-products/create" element={<SalesProductForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales_products.edit" />}>
              <Route path="/sales-products/edit/:id" element={<SalesProductForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="raw_materials.create" />}>
              <Route path="/raw-materials/create" element={<RawMaterialForm />} />
              <Route path="/wastage-store/create" element={<WastageStoreForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="raw_materials.edit" />}>
              <Route path="/raw-materials/edit/:id" element={<RawMaterialForm />} />
              <Route path="/wastage-store/edit/:id" element={<WastageStoreForm />} />
            </Route>

            {/* ---------- Machines & Shifts ---------- */}
            <Route element={<ProtectedRoute permission="machines.create" />}>
              <Route path="/machines/create" element={<MachineCreate />} />
              <Route path="/machines/assignments/create" element={<MachineAssignmentForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="machines.edit" />}>
              <Route path="/machines/edit/:id" element={<MachineEdit />} />
              <Route path="/machines/assignments/edit/:id" element={<MachineAssignmentForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="shifts.create" />}>
              <Route path="/shifts/create" element={<ShiftCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="shifts.edit" />}>
              <Route path="/shifts/edit/:id" element={<ShiftEdit />} />
            </Route>

            {/* ---------- Inventory ---------- */}
            <Route element={<ProtectedRoute permission="stock-adjustments.view" />}>
              <Route path="/inventory/stock-adjustments/view/:id" element={<StockAdjustmentView />} />
            </Route>
            <Route element={<ProtectedRoute permission="stock-adjustments.create" />}>
              <Route path="/inventory/stock-adjustments/create" element={<StockAdjustmentForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="stock-adjustments.edit" />}>
              <Route path="/inventory/stock-adjustments/edit/:id" element={<StockAdjustmentForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="wastage-stock.create" />}>
              <Route path="/wastage-stock/create" element={<WastageStockCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="wastage-stock.edit" />}>
              <Route path="/wastage-stock/edit/:id" element={<WastageStockEdit />} />
            </Route>
            <Route element={<ProtectedRoute permission="finished_goods_stocks.create" />}>
              <Route path="/finished-stock/create" element={<FinishedStockCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="finished_goods_stocks.edit" />}>
              <Route path="/finished-stock/edit/:id" element={<FinishedStockEdit />} />
            </Route>

            {/* ---------- Production ---------- */}
            <Route element={<ProtectedRoute permission="weekly_programs.create" />}>
              <Route path="/weekly-machine-schedules/create" element={<WeeklyMachineScheduleCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="weekly_programs.edit" />}>
              <Route path="/weekly-machine-schedules/edit/:id" element={<WeeklyMachineScheduleEdit />} />
            </Route>
            <Route element={<ProtectedRoute permission="daily-machine-planning.view" />}>
              <Route path="/daily-machine-planning/view/:id" element={<DailyPlanViewPage />} />
              <Route path="/daily-machine-planning/report" element={<DailyReportPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="daily-machine-planning.create" />}>
              <Route path="/daily-production-plans/create" element={<DailyPlanCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="daily-machine-planning.edit" />}>
              <Route path="/daily-production-plans/edit/:id" element={<DailyPlanCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="shift-execution.view" />}>
              <Route path="/shift-execution" element={<ShiftExecutionBoard />} />
            </Route>
            <Route element={<ProtectedRoute permission="production_orders.view" />}>
              <Route path="/production-dashboard" element={<ProductionDashboard />} />
              <Route path="/production-orders/history/view/:id" element={<ProductionOrderHistoryView />} />
            </Route>
            <Route element={<ProtectedRoute permission="production_orders.create" />}>
              <Route path="/production-orders/create" element={<ProductionOrderCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="production_orders.edit" />}>
              <Route path="/production-orders/edit/:id" element={<ProductionOrderCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="hourly_productions.create" />}>
              <Route path="/hourly-work-reports/create" element={<HourlyWorkReportCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="hourly_productions.edit" />}>
              <Route path="/hourly-work-reports/edit/:id" element={<HourlyWorkReportEdit />} />
            </Route>
            <Route element={<ProtectedRoute permission="production-wastages.create" />}>
              <Route path="/production-wastages/create" element={<WastageForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="production-wastages.edit" />}>
              <Route path="/production-wastages/edit/:id" element={<WastageForm />} />
            </Route>

            {/* ---------- Goods Dispatch ---------- */}
            <Route element={<ProtectedRoute permission="goods-dispatch.view" />}>
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

            {/* ---------- Sales ---------- */}
            <Route element={<ProtectedRoute permission="sales-orders.view" />}>
              <Route path="/sales-order/details/:id" element={<OrderDetails />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales-orders.create" />}>
              <Route path="/sales-order/create" element={<SalesOrderCreate />} />
            </Route>
            <Route element={<ProtectedRoute permissionAny={["sales-orders.create", "sales-orders.view", "draft-orders.edit"]} />}>
              <Route path="/sales-order/edit/:id" element={<SalesOrderCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="draft-orders.edit" />}>
              <Route path="/draft-order/edit/:id" element={<SalesOrderCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="quotations.create" />}>
              <Route path="/quatation-order/create" element={<QuotationCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="quotations.edit" />}>
              <Route path="/quatation-order/edit/:id" element={<QuotationCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="pending-quotations.edit" />}>
              <Route path="/pending-quotations/edit/:id" element={<UpdateQuatation />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales-invoices.view" />}>
              <Route path="/sales-invoices/details/:id" element={<SalesInvoiceView />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales-invoices.create" />}>
              <Route path="/sales-invoices/create" element={<SalesInvoiceForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales-invoices.edit" />}>
              <Route path="/sales-invoices/edit/:id" element={<SalesInvoiceForm />} />
            </Route>

            {/* ---------- Purchase ---------- */}
            <Route element={<ProtectedRoute permission="purchaseOrders.view" />}>
              <Route path="/purchase-orders/view/:id" element={<PurchaseOrderViewPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="purchaseOrders.create" />}>
              <Route path="/purchase-orders/create" element={<PurchaseOrderForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="purchaseOrders.edit" />}>
              <Route path="/purchase-orders/edit/:id" element={<PurchaseOrderForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="invoice.view" />}>
              <Route path="/invoice/details/:id" element={<GrnInvoiceViewPage />} />
              <Route path="/po-invoice/:id" element={<PoInvoicePage />} />
            </Route>
            <Route element={<ProtectedRoute permission="invoice.create" />}>
              <Route path="/invoice/create" element={<InvoiceDetail />} />
            </Route>
            <Route element={<ProtectedRoute permission="invoice.edit" />}>
              <Route path="/invoice/edit/:id" element={<InvoiceDetail />} />
            </Route>

            {/* ---------- Accounts drill-downs ---------- */}
            <Route element={<ProtectedRoute permissionAny={["accounts.view", "payable.view", "receivable.view"]} />}>
              <Route path="/accounts/payable/:supplierId" element={<SupplierBreakdownPage />} />
              <Route path="/accounts/receivable/:customerId" element={<CustomerBreakdownPage />} />
            </Route>

            {/* ---------- Payroll ---------- */}
            <Route element={<ProtectedRoute permissionAny={["payroll.view", "payroll-run.view", "payroll-settings.view", "payroll-attendance.view", "payroll-advance.view"]} />}>
              <Route path="/payroll" element={<PayrollDashboard />} />
              <Route path="/payroll/run" element={<PayrollRun />} />
              <Route path="/payroll/settings" element={<PayrollSettings />} />
              <Route path="/payroll/attendance" element={<AttendancePage />} />
              <Route path="/payroll/advance" element={<SalaryAdvancePage />} />
              <Route path="/payroll/monthly-report" element={<MonthlyPayrollReport />} />
              <Route path="/payroll/weekly-report" element={<WeeklyPayrollReport />} />
            </Route>

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
