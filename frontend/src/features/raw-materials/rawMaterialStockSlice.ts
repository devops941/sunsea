import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { rawMaterialStockService } from "../../services/rawMaterialStockService";
import type { 
    RawMaterialStock, 
    RawMaterialStockState, 
    CreateRawMaterialStockDto, 
    UpdateRawMaterialStockDto 
} from "./types";

export const fetchRawMaterialStocks = createAsyncThunk(
  "rawMaterialStocks/fetchAll",
  async (params: any | undefined, { rejectWithValue }) => {
    try {
      return await rawMaterialStockService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch raw material stocks"
      );
    }
  }
);

export const createRawMaterialStock = createAsyncThunk(
  "rawMaterialStocks/create",
  async (data: CreateRawMaterialStockDto, { rejectWithValue }) => {
    try {
      return await rawMaterialStockService.create(data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create raw material stock"
      );
    }
  }
);

export const updateRawMaterialStock = createAsyncThunk(
  "rawMaterialStocks/update",
  async ({ id, data }: { id: string; data: UpdateRawMaterialStockDto }, { rejectWithValue }) => {
    try {
      return await rawMaterialStockService.update(id, data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update raw material stock"
      );
    }
  }
);

export const deleteRawMaterialStock = createAsyncThunk(
  "rawMaterialStocks/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await rawMaterialStockService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete raw material stock"
      );
    }
  }
);

const initialState: RawMaterialStockState = {
  data: [],
  loading: false,
  error: null,
};

const rawMaterialStockSlice = createSlice({
  name: "rawMaterialStocks",
  initialState,
  reducers: {
    clearStockError: (state) => {
      state.error = null;
    },
    rawMaterialStockCreated: (state, action) => {
      if (Array.isArray(state.data)) {
        const exists = state.data.find((m: any) => String(m.id) === String(action.payload.id));
        if (!exists) {
          state.data.unshift(action.payload);
        }
      }
    },
    rawMaterialStockUpdated: (state, action) => {
      if (Array.isArray(state.data)) {
        const index = state.data.findIndex((m: any) => String(m.id) === String(action.payload.id));
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      }
    },
    rawMaterialStockDeleted: (state, action) => {
      if (Array.isArray(state.data)) {
        state.data = state.data.filter((m: any) => String(m.id) !== String(action.payload.id));
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRawMaterialStocks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchRawMaterialStocks.fulfilled,
        (state, action: PayloadAction<RawMaterialStock[]>) => {
          state.loading = false;
          state.data = action.payload;
        }
      )
      .addCase(fetchRawMaterialStocks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        createRawMaterialStock.fulfilled,
        (state, action: PayloadAction<RawMaterialStock>) => {
          state.data.push(action.payload);
        }
      )
      .addCase(
        updateRawMaterialStock.fulfilled,
        (state, action: PayloadAction<any>) => {
          const index = state.data.findIndex((item: any) => (item.rawMaterialId || item.id) === (action.payload.rawMaterialId || action.payload.id));
          if (index !== -1) {
            state.data[index] = action.payload;
          }
        }
      )
      .addCase(
        deleteRawMaterialStock.fulfilled,
        (state, action: PayloadAction<string>) => {
          // Remove from UI list as requested by user
          state.data = state.data.filter((item: any) => (item.rawMaterialId || item.id) !== action.payload);
        }
      );
  },
});

export const { clearStockError, rawMaterialStockCreated, rawMaterialStockUpdated, rawMaterialStockDeleted } = rawMaterialStockSlice.actions;

export default rawMaterialStockSlice.reducer;
