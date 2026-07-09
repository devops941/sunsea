import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { productionOrderService } from "../../services/productionOrderService";
import type { ProductionOrderState } from "./types";

export const fetchProductionOrders = createAsyncThunk(
  "productionOrders/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await productionOrderService.fetchAll();
      // Handle both paginated response { data, total, ... } and raw array
      return response.data || response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch production orders");
    }
  }
);

export const createProductionOrder = createAsyncThunk(
  "productionOrders/create",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await productionOrderService.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to create production order");
    }
  }
);

export const updateProductionOrder = createAsyncThunk(
  "productionOrders/update",
  async ({ id, data }: { id: number; data: any }, { rejectWithValue }) => {
    try {
      const response = await productionOrderService.update(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to update production order");
    }
  }
);

export const deleteProductionOrder = createAsyncThunk(
  "productionOrders/delete",
  async (id: number, { rejectWithValue }) => {
    try {
      await productionOrderService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete production order");
    }
  }
);

const initialState: ProductionOrderState = {
  data: [],
  loading: false,
  error: null,
};

const productionOrderSlice = createSlice({
  name: "productionOrders",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductionOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductionOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchProductionOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createProductionOrder.fulfilled, (state, action) => {
        state.data.unshift(action.payload);
      })
      .addCase(updateProductionOrder.fulfilled, (state, action) => {
        const index = state.data.findIndex((m) => m.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteProductionOrder.fulfilled, (state, action) => {
        state.data = state.data.filter((m) => m.id !== action.payload);
      });
  },
});

export default productionOrderSlice.reducer;

