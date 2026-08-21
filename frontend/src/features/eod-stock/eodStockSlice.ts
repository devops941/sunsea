import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  eodStockService,
  type EodStockItem,
  type EodStockResponse,
  type FetchEodStockParams,
} from "../../services/eodStockService";

interface EodStockState {
  data: EodStockItem[];
  loading: boolean;
  error: string | null;
  total: number;
  asOf: string;
}

export const fetchEodStock = createAsyncThunk(
  "eodStock/fetchAll",
  async (params: FetchEodStockParams, { rejectWithValue }) => {
    try {
      return await eodStockService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch EOD stock data"
      );
    }
  }
);

const initialState: EodStockState = {
  data: [],
  loading: true,
  error: null,
  total: 0,
  asOf: "",
};

const eodStockSlice = createSlice({
  name: "eodStock",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEodStock.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchEodStock.fulfilled,
        (state, action: PayloadAction<EodStockResponse>) => {
          state.loading = false;
          state.data = action.payload.data || [];
          state.total = action.payload.pagination?.total || 0;
          state.asOf = action.payload.asOf || "";
        }
      )
      .addCase(fetchEodStock.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default eodStockSlice.reducer;
