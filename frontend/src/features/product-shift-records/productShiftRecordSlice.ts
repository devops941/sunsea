import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { productShiftRecordService } from "../../services/productShiftRecordService";
import type { ProductShiftRecord, ProductShiftRecordState } from "./types";

export const fetchRecordsByProduct = createAsyncThunk(
  "productShiftRecords/fetchByProduct",
  async (productId: number, { rejectWithValue }) => {
    try {
      return await productShiftRecordService.fetchByProduct(productId);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch records");
    }
  }
);

export const createShiftRecord = createAsyncThunk(
  "productShiftRecords/create",
  async (data: any, { rejectWithValue }) => {
    try {
      return await productShiftRecordService.create(data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to save record");
    }
  }
);

const initialState: ProductShiftRecordState = {
  records: [],
  highest: null,
  loading: false,
  error: null,
};

const productShiftRecordSlice = createSlice({
  name: "productShiftRecords",
  initialState,
  reducers: {
    clearRecords(state) {
      state.records = [];
      state.highest = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecordsByProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecordsByProduct.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        const data = action.payload?.data || action.payload;
        state.records = data?.records || [];
        state.highest = data?.highest || null;
      })
      .addCase(fetchRecordsByProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createShiftRecord.pending, (state) => {
        state.loading = true;
      })
      .addCase(createShiftRecord.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        const record = action.payload?.data || action.payload;
        if (record && record.id) {
          state.records.unshift(record);
          state.highest = record;
        }
      })
      .addCase(createShiftRecord.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearRecords } = productShiftRecordSlice.actions;
export default productShiftRecordSlice.reducer;
