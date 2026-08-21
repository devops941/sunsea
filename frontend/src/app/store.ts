import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import { baseApi } from "../services/baseApi";
import roleReducer from "../features/roles/roleSlice";
import departmentReducer from "../features/departments/departmentSlice";
import uomReducer from "../features/uoms/uomSlice";
import userReducer from "../features/user/userSlice";
import employeeReducer from "../features/employee/employeeSlice";
import customerReducer from "../features/customer/customerSlice";
import productReducer from "../features/product/productSlice";
import permissionReducer from "../features/permissions/permissionSlice";
import supplierReducer from "../features/supplier/supplierSlice";
import shiftReducer from "../features/shifts/shiftSlice";
import storeReducer from "../features/stores/storeSlice";
import rawMaterialReducer from "../features/raw-materials/rawMaterialSlice";
import rawMaterialStockReducer from "../features/raw-materials/rawMaterialStockSlice";
import machineReducer from "../features/machines/machineSlice";
import weeklyProgramReducer from "../features/weekly-programs/weeklyProgramSlice";
import productionOrderReducer from "../features/production-orders/productionOrderSlice";
import hourlyProductionReducer from "../features/hourly-productions/hourlyProductionSlice";
import profileReducer from "../features/profiles/profileSlice";
import stockAdjustmentReducer from "../features/stock-adjustments/stockAdjustmentSlice";
import purchaseOrderReducer from "../features/purchaseOrder/purchaseOrderSlice";
import productionWastageReducer from "../features/production-wastage/productionWastageSlice";
import companyReducer from "../features/company/companySlice";
import finishedGoodsStockReducer from "../features/finished-goods-stock/finishedGoodsStockSlice";
import gstReducer from "../features/gst/gstSlice";
import dailyPlanReducer from "../features/daily-plans/dailyPlanSlice";
import goodsDispatchReducer from "../features/goods-dispatch/goodsDispatchSlice";
import productShiftRecordReducer from "../features/product-shift-records/productShiftRecordSlice";
import productCapacityHistoryReducer from "../features/product-capacity-history/productCapacityHistorySlice";
import payrollSettingsReducer from "../features/payroll/payrollSettingsSlice";
import payrollRunReducer from "../features/payroll/payrollRunSlice";
import categoryReducer from "../features/categories/categorySlice";
import eodStockReducer from "../features/eod-stock/eodStockSlice";


export const store = configureStore({
    reducer: {
        auth: authReducer,
        roles: roleReducer,
        departments: departmentReducer,
        uoms: uomReducer,
        users: userReducer,
        employees: employeeReducer,
        customers: customerReducer,
        products: productReducer,
        permissions: permissionReducer,
        suppliers: supplierReducer,
        shifts: shiftReducer,
        profile: profileReducer,
        gst: gstReducer,
        stores: storeReducer,
        rawMaterials: rawMaterialReducer,
        rawMaterialStocks: rawMaterialStockReducer,
        machines: machineReducer,
        weeklyPrograms: weeklyProgramReducer,
        productionOrders: productionOrderReducer,
        hourlyProductions: hourlyProductionReducer,
        stockAdjustments: stockAdjustmentReducer,
        [baseApi.reducerPath]: baseApi.reducer,
        purchaseOrder: purchaseOrderReducer,
        productionWastages: productionWastageReducer,
        company: companyReducer,
        finishedGoodsStocks: finishedGoodsStockReducer,
        dailyPlans: dailyPlanReducer,
        goodsDispatch: goodsDispatchReducer,
        productShiftRecords: productShiftRecordReducer,
        productCapacityHistory: productCapacityHistoryReducer,
        payrollSettings: payrollSettingsReducer,
        payrollRun: payrollRunReducer,
        categories: categoryReducer,
        eodStock: eodStockReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;