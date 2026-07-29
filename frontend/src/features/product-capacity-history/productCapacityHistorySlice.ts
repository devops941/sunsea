import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { productCapacityHistoryService } from "../../services/productCapacityHistoryService";
import type { ProductCapacityHistory, ProductCapacityHistoryState } from "./types";

export const fetchCapacityHistory = createAsyncThunk(
  "productCapacityHistory/fetchByProduct",
  async (productId: number, { rejectWithValue }) => {
    try {
      return await productCapacityHistoryService.fetchByProduct(productId);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch history");
    }
  }
);

const initialState: ProductCapacityHistoryState = {
  records: [],
  loading: false,
  error: null,
};

const productCapacityHistorySlice = createSlice({
  name: "productCapacityHistory",
  initialState,
  reducers: {
    clearHistory(state) {
      state.records = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCapacityHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCapacityHistory.fulfilled, (state, action: PayloadAction<any[]>) => {
        state.loading = false;
        state.records = action.payload || [];
      })
      .addCase(fetchCapacityHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearHistory } = productCapacityHistorySlice.actions;
export default productCapacityHistorySlice.reducer;
