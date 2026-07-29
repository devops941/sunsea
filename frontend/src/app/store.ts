import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import { baseApi } from "../services/baseApi";
import roleReducer from "../features/roles/roleSlice";
import departmentReducer from "../features/departments/departmentSlice";
import categoryReducer from "../features/categories/categorySlice";
import subCategoryReducer from "../features/subCategories/subCategorySlice";
import colorReducer from "../features/colors/colorSlice";
import sizeReducer from "../features/sizes/sizeSlice";
import uomReducer from "../features/uoms/uomSlice";
import userReducer from "../features/user/userSlice";
import employeeReducer from "../features/employee/employeeSlice";
import customerReducer from "../features/customer/customerSlice";
import productReducer from "../features/product/productSlice";
import permissionReducer from "../features/permissions/permissionSlice";
import supplierReducer from "../features/supplier/supplierSlice";
import shiftReducer from "../features/shifts/shiftSlice";
import storeReducer from "../features/stores/storeSlice";
import locationReducer from "../features/locations/locationSlice";
import rawMaterialReducer from "../features/raw-materials/rawMaterialSlice";
import rawMaterialCategoryReducer from "../features/raw-material-categories/rawMaterialCategorySlice";
import rawMaterialStockReducer from "../features/raw-materials/rawMaterialStockSlice";
import machineReducer from "../features/machines/machineSlice";
import weeklyProgramReducer from "../features/weekly-programs/weeklyProgramSlice";
import productionOrderReducer from "../features/production-orders/productionOrderSlice";
import hourlyProductionReducer from "../features/hourly-productions/hourlyProductionSlice";
import storeTypeReducer from "../features/store-types/storeTypeSlice";
import storeLocationReducer from "../features/locations/locationSlice";
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


export const store = configureStore({
    reducer: {
        auth: authReducer,
        roles: roleReducer,
        departments: departmentReducer,
        categories: categoryReducer,
        subCategories: subCategoryReducer,
        colors: colorReducer,
        sizes: sizeReducer,
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
        locations: locationReducer,
        rawMaterials: rawMaterialReducer,
        rawMaterialCategories: rawMaterialCategoryReducer,
        rawMaterialStocks: rawMaterialStockReducer,
        storeLocations: storeLocationReducer,
        machines: machineReducer,
        weeklyPrograms: weeklyProgramReducer,
        productionOrders: productionOrderReducer,
        hourlyProductions: hourlyProductionReducer,
        storeTypes: storeTypeReducer,
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
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;