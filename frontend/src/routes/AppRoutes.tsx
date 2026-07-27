import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import BaseLayout from "../components/layout/BaseLayout";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import CommonLoader from "../components/ui/Loader/CommonLoader";
import logo from '../../public/loaderimage.png'


const Dashboard = lazy(() => import("../modules/dashboard/pages/DashboardPage"));
// const OeeDashboard = lazy(() => import("../modules/dashboard/pages/OeeDashboard"));
const CompanySettings = lazy(() => import("../modules/company/pages/CompanySettings"));

const OrganizationTabs = lazy(() => import("../modules/company/pages/OrganizationTabs"));
const InventoryTabs = lazy(() => import("../modules/stock/pages/InventoryTabs"));
const Sample = lazy(() => import("../modules/sample"));
const NotFoundPage = lazy(() => import("../modules/not-found/pages/NotFoundPage"));
const LoginPage = lazy(() => import("../modules/login/pages/LoginPage"));
const ResetPassword = lazy(() => import("../modules/passwordreset/pages/ResetPassword"));

// Customers

const CustomerCreatePage = lazy(() => import("../modules/customers/pages/CustomerCreatePage"));
const CustomerEditPage = lazy(() => import("../modules/customers/pages/CustomerEditPage"));

// Employees

const EmployeeCreatePage = lazy(() => import("../modules/employee/pages/EmployeeCreate"));
const EmployeeEdit = lazy(() => import("../modules/employee/pages/EmployeeEdit"));

// Suppliers

const SupplierCreatePage = lazy(() => import("../modules/supplier/pages/SupplierCreate"));
const SupplierEditPage = lazy(() => import("../modules/supplier/pages/SupplierEdit"));
const SupplierMaterialPricingList = lazy(() => import("../modules/supplier/pages/Suppliermaterialpricinglist"));

// Products

const ProductEdit = lazy(() => import("../modules/product/pages/ProductEdit"));
const ProductCreatePage = lazy(() => import("../modules/product/pages/ProductCreate"));

// Categories & Sub Categories (Product Master)

const SubcategoryList = lazy(() => import("../modules/product/pages/SubCategoryList"));

const StoreLocationTabs = lazy(() => import("../modules/storage-stores/pages/StoreLocationTabs"));
const HROrganizationTabs = lazy(() => import("../modules/employee/pages/HROrganizationTabs"));
const ProductMasterTabs = lazy(() => import("../modules/product/pages/ProductMasterTabs"));

// Administration
const UserList = lazy(() => import("../modules/users/pages/UserList"));

const PermissionList = lazy(() => import("../modules/permissions/pages/PermissionList"));


// HR

// Product Master Attributes




// Product Management
const ProductPricing = lazy(() => import("../modules/product-pricing/pages/ProductPricing"));
const ProductImageUpload = lazy(() => import("../modules/product-images/pages/ProductImageUpload"));

// New modules
const MachineCreate = lazy(() => import("../modules/machines/pages/MachineCreate"));
const MachineEdit = lazy(() => import("../modules/machines/pages/MachineEdit"));
const MachineAssignmentList = lazy(() => import("../modules/machine-operation-assignments/pages/MachineAssignmentList"));
const MachineAssignmentForm = lazy(() => import("../modules/machine-operation-assignments/pages/MachineAssignmentForm"));


// shift

const ShiftCreate = lazy(() => import("../modules/shifts/pages/ShiftCreate"));
const ShiftEdit = lazy(() => import("../modules/shifts/pages/ShiftEdit"));


const RawMaterialCreate = lazy(() => import("../modules/raw-materials/pages/RawMaterialCreate"));
const RawMaterialCategoryList = lazy(() => import("../modules/raw-material-categories/pages/RawMaterialCategoryList"));
const RawMaterialEdit = lazy(() => import("../modules/raw-materials/pages/RawMaterialEdit"));

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


const WastageForm = lazy(() => import("../modules/production-wastage/pages/WastageCreate"));



const ProductionOrderCreate = lazy(() => import("../modules/production-orders/pages/ProductionOrderCreate"));
// const ProductionOrderEdit = lazy(() => import("../modules/production-orders/pages/ProductionOrderEdit"));
const ProductionOrderTabs = lazy(() => import("../modules/production-orders/pages/ProductionOrderTabs"));

// Goods Dispatch
const GoodsDispatchList = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchList"));
const GoodsDispatchCreate = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchCreate"));
const GoodsDispatchView = lazy(() => import("../modules/goods-dispatch/pages/GoodsDispatchView"));

// OEE Dashboard
const BillOfMaterialList = lazy(() => import("../modules/bill-of-material/pages/BillOfMaterialList"));
const BillOfMaterialCreate = lazy(() => import("../modules/bill-of-material/pages/BillOfMaterialCreate"));
const BillOfMaterialEdit = lazy(() => import("../modules/bill-of-material/pages/BillOfMaterialEdit"));

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
            <Route path="/settings/invoice" element={<OrganizationTabs />} />
            {/* Sample Route */}
            <Route path="/sample" element={<Sample />} />

            {/* ========================================================================= */}
            {/* MASTER DATA MANAGEMENT                                                    */}
            {/* ========================================================================= */}

            {/* Customers */}
            <Route element={<ProtectedRoute permission="customers.view" />}>
              <Route path="/customers" element={<HROrganizationTabs />} />
            </Route>
            {/* Customers Create Route */}
            <Route element={<ProtectedRoute permission="customers.create" />}>
              <Route path="/customers/create" element={<CustomerCreatePage />} />
            </Route>
            {/* Customers Edit :Id Route */}
            <Route element={<ProtectedRoute permission="customers.edit" />}>
              <Route path="/customers/edit/:id" element={<CustomerEditPage />} />
            </Route>

            {/* Suppliers */}
            <Route element={<ProtectedRoute permission="suppliers.view" />}>
              <Route path="/suppliers" element={<HROrganizationTabs />} />
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
            {/* Employees Edit :Id Route */}
            <Route element={<ProtectedRoute permission="employees.edit" />}>
              <Route path="/employees/edit/:id" element={<EmployeeEdit />} />
            </Route>

            {/* Products Management (RBAC guarded) */}
            <Route element={<ProtectedRoute permission="products.view" />}>
              <Route path="/products" element={<ProductMasterTabs />} />
            </Route>
            {/* Products Create Route */}
            <Route element={<ProtectedRoute permission="products.create" />}>
              <Route path="/products/create" element={<ProductCreatePage />} />
            </Route>
            {/* Products Edit :Id Route */}
            <Route element={<ProtectedRoute permission="products.edit" />}>
              <Route path="/products/edit/:id" element={<ProductEdit />} />
            </Route>

            {/* Categories & Subcategories */}
            <Route element={<ProtectedRoute permission="categories.view" />}>
              <Route path="/categories" element={<ProductMasterTabs />} />
            </Route>
            {/* Sub Categories Route */}
            <Route element={<ProtectedRoute permission="sub-categories.view" />}>
              <Route path="/sub-categories" element={<SubcategoryList />} />
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
            {/* Product Master Attributes */}
            <Route element={<ProtectedRoute permission="colors.view" />}>
              <Route path="/colours" element={<ProductMasterTabs />} />
            </Route>
            {/* Sizes Route */}
            <Route element={<ProtectedRoute permission="sizes.view" />}>
              <Route path="/sizes" element={<ProductMasterTabs />} />
            </Route>
            {/* Uoms Route */}
            <Route element={<ProtectedRoute permission="uoms.view" />}>
              <Route path="/uoms" element={<ProductMasterTabs />} />
            </Route>

            {/* Product Management Extras */}
            <Route element={<ProtectedRoute permission="product-pricing.view" />}>
              <Route path="/product-pricing" element={<ProductPricing />} />
            </Route>
            {/* Product Images Route */}
            <Route element={<ProtectedRoute permission="product-images.view" />}>
              <Route path="/product-images" element={<ProductImageUpload />} />
            </Route>

            {/* ========================================================================= */}
            {/* INVENTORY & STORES                                                        */}
            {/* ========================================================================= */}

            {/* Storage Stores */}
            <Route element={<ProtectedRoute permission="stores.view" />}>
              <Route path="/storage-stores" element={<StoreLocationTabs />} />
            </Route>


            {/* Store Types */}
            <Route element={<ProtectedRoute permission="store-types.view" />}>
              <Route path="/store-types" element={<StoreLocationTabs />} />
            </Route>

            {/* Locations */}
            <Route element={<ProtectedRoute permission="locations.view" />}>
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
            <Route element={<ProtectedRoute permission="shift.view" />}>
              <Route path="/shifts" element={<HROrganizationTabs />} />
            </Route>
            {/* Shifts Create Route */}
            <Route element={<ProtectedRoute permission="shift.create" />}>
              <Route path="/shifts/create" element={<ShiftCreate />} />
            </Route>
            {/* Shifts Edit :Id Route */}
            <Route element={<ProtectedRoute permission="shift.edit" />}>
              <Route path="/shifts/edit/:id" element={<ShiftEdit />} />
            </Route>

            {/* Raw Materials */}
            <Route element={<ProtectedRoute permission="raw_materials.view" />}>
              <Route path="/raw-materials" element={<ProductMasterTabs />} />
            </Route>
            {/* Raw Material Categories Route */}
            <Route element={<ProtectedRoute permission="raw_materials.view" />}>
              <Route path="/raw-material-categories" element={<ProductMasterTabs />} />
            </Route>
            {/* Raw Materials Create Route */}
            <Route element={<ProtectedRoute permission="raw_materials.create" />}>
              <Route path="/raw-materials/create" element={<RawMaterialCreate />} />
            </Route>
            {/* Raw Materials Edit :Id Route */}
            <Route element={<ProtectedRoute permission="raw_materials.edit" />}>
              <Route path="/raw-materials/edit/:id" element={<RawMaterialEdit />} />
            </Route>

            {/* Wastage Store */}
            <Route element={<ProtectedRoute permission="raw_materials.view" />}>
              <Route path="/wastage-store" element={<ProductMasterTabs />} />
            </Route>
            <Route element={<ProtectedRoute permission="raw_materials.create" />}>
              <Route path="/wastage-store/create" element={<WastageStoreForm />} />
            </Route>
            <Route element={<ProtectedRoute permission="raw_materials.edit" />}>
              <Route path="/wastage-store/edit/:id" element={<WastageStoreForm />} />
            </Route>

            {/* Stock */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.view" />}>
              <Route path="/stock" element={<InventoryTabs />} />
            </Route>

            {/* Stock Adjustments */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.view" />}>
              <Route path="/inventory/stock-adjustments" element={<InventoryTabs />} />
            </Route>
            {/* EOD Stock */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.view" />}>
              <Route path="/inventory/eod-stock" element={<InventoryTabs />} />
            </Route>
            {/* Stock Adjustments Create Route */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.create" />}>
              <Route path="/inventory/stock-adjustments/create" element={<StockAdjustmentForm />} />
            </Route>
            {/* Stock Adjustments Edit Route */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.edit" />}>
              <Route path="/inventory/stock-adjustments/edit/:id" element={<StockAdjustmentForm />} />
            </Route>
            {/* Stock Adjustments View Route */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.view" />}>
              <Route path="/inventory/stock-adjustments/view/:id" element={<StockAdjustmentView />} />
            </Route>

            {/* Wastage Stock */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.view" />}>
              <Route path="/wastage-stock" element={<WastageStockList />} />
            </Route>
            {/* Wastage Stock Create Route */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.view" />}>
              <Route path="/wastage-stock/create" element={<WastageStockCreate />} />
            </Route>
            {/* Wastage Stock Edit :Id Route */}
            <Route element={<ProtectedRoute permission="raw_material_stocks.view" />}>
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
            <Route element={<ProtectedRoute permission="weekly_programs.view" />}>
              <Route path="/daily-machine-planning" element={<ProductionOrderTabs />} />
            </Route>

            {/* Daily Production Plans Create / Edit */}
            <Route element={<ProtectedRoute permission="weekly_programs.create" />}>
              <Route path="/daily-production-plans/create" element={<DailyPlanCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="weekly_programs.edit" />}>
              <Route path="/daily-production-plans/edit/:id" element={<DailyPlanCreate />} />
            </Route>

            {/* Shift Execution Board */}
            <Route element={<ProtectedRoute permission="weekly_programs.view" />}>
              <Route path="/shift-execution" element={<ShiftExecutionBoard />} />
            </Route>

            {/* Production Dashboard */}
            <Route element={<ProtectedRoute permission="machines.view" />}>
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

            {/* Production Wastage Audits */}
            <Route element={<ProtectedRoute permission="machines.view" />}>
              <Route path="/production-wastages" element={<ProductionOrderTabs />} />
              <Route path="/production-wastages/create" element={<WastageForm />} />
              <Route path="/production-wastages/edit/:id" element={<WastageForm />} />
            </Route>

            {/* Production Orders */}
            <Route element={<ProtectedRoute permission="production_orders.view" />}>
              <Route path="/production-orders" element={<ProductionOrderTabs />} />
              <Route path="/allproduction-orders" element={<ProductionOrderTabs />} />
              <Route path="/weekly-machine-schedules" element={<ProductionOrderTabs />} />
              <Route path="/daily-machine-planning" element={<ProductionOrderTabs />} />
              <Route path="/hourly-work-reports" element={<ProductionOrderTabs />} />
              <Route path="/production-wastages" element={<ProductionOrderTabs />} />
              <Route path="/oee-dashboard" element={<ProductionOrderTabs />} />
              {/* Approved Sales Orders Route */}
              <Route path="/approved-sales-orders" element={<ProductionOrderTabs />} />
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
            <Route element={<ProtectedRoute permission="production_orders.view" />}>
              <Route path="/production/goods-dispatch" element={<ProductionOrderTabs />} />
              <Route path="/production/goods-dispatch/view/:id" element={<GoodsDispatchView />} />
            </Route>
            <Route element={<ProtectedRoute permission="production_orders.create" />}>
              <Route path="/production/goods-dispatch/create" element={<GoodsDispatchCreate />} />
            </Route>

            {/* Bill Of Material */}
            <Route element={<ProtectedRoute permission="bill_of_materials.view" />}>
              <Route path="/bill-of-materials" element={<BillOfMaterialList />} />
            </Route>
            {/* Bill Of Materials Create Route */}
            <Route element={<ProtectedRoute permission="bill_of_materials.create" />}>
              <Route path="/bill-of-materials/create" element={<BillOfMaterialCreate />} />
            </Route>
            {/* Bill Of Materials Edit :Id Route */}
            <Route element={<ProtectedRoute permission="bill_of_materials.edit" />}>
              <Route path="/bill-of-materials/edit/:id" element={<BillOfMaterialEdit />} />
            </Route>

            {/* ========================================================================= */}
            {/* REPORTS                                                                   */}
            {/* ========================================================================= */}

            {/* Reports */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/reports/sales" element={<ReportsTabs />} />
              <Route path="/reports/purchase" element={<ReportsTabs />} />
              <Route path="/reports/inventory" element={<ReportsTabs />} />
              <Route path="/reports/production" element={<ReportsTabs />} />
              <Route path="/reports/audit" element={<ReportsTabs />} />
            </Route>

            {/* ========================================================================= */}
            {/* SALES & QUOTATIONS                                                        */}
            {/* ========================================================================= */}

            {/* Sales */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/draft-order" element={<SalesTabs />} />
            </Route>
            {/* All Order Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/sales-order" element={<SalesTabs />} />
            </Route>
            {/* All Order Details :Id Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/sales-order/details/:id" element={<OrderDetails />} />
            </Route>
            {/* Sales Order Create Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/sales-order/create" element={<SalesOrderCreate />} />
            </Route>
            {/* Sales Order Edit :Id Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/draft-order/edit/:id" element={<SalesOrderCreate />} />
            </Route>
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/sales-invoices/details/:id" element={<SalesInvoiceView />} />
            </Route>

            {/* Quatation Order Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/quatation-order" element={<SalesTabs />} />
            </Route>

            {/* Quatation Order Edit :Id Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/quatation-order/edit/:id" element={<QuotationCreate />} />
            </Route>

            {/* Pending Quotations Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/pending-quotations" element={<SalesTabs />} />
            </Route>

            {/* Sales Invoice Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/sales-invoices" element={<SalesTabs />} />
            </Route>

            {/* Create Sales Invoice Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/sales-invoices/create" element={<SalesInvoiceForm />} />
            </Route>

            {/* Pending Quotations Edit :Id Route */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/pending-quotations/edit/:id" element={<UpdateQuatation />} />
            </Route>

            {/* ========================================================================= */}
            {/* PURCHASE ORDERS                                                           */}
            {/* ========================================================================= */}

            {/* Purchase Orders - List */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/purchase-orders" element={<PurchaseTabs />} />
            </Route>

            {/* Purchase Orders - Create */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/purchase-orders/create" element={<PurchaseOrderCreatePage />} />
            </Route>

            {/* Purchase Orders - Edit */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/purchase-orders/edit/:id" element={<PurchaseOrderEditPage />} />
            </Route>

            {/* ============================================ */}
            {/* END PURCHASE ORDER MODULE */}
            {/* ============================================ */}

            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/purchase-order-approvals" element={<PurchaseTabs />} />
            </Route>

            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/purchase-orders/view/:id" element={<PurchaseOrderViewPage />} />

              <Route path="/expenses" element={<PurchaseTabs />} />
              <Route path="/invoice" element={<PurchaseTabs />} />
              <Route path="/invoice/details/:id" element={<GrnInvoiceViewPage />} />
            </Route>
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/invoice/create" element={<InvoiceDetail />} />
            </Route>
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route element={<ProtectedRoute permission="purchase_orders.view" />}>

            </Route>

          </Route>
        </Route>

        {/* Public Routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          {/* Reset Route */}
          <Route path="/reset" element={<ResetPassword />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
