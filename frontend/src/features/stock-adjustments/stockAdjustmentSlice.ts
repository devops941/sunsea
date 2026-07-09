import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { stockAdjustmentService } from "../../services/stockAdjustmentService";

export const fetchStockAdjustments = createAsyncThunk(
  "stockAdjustments/fetchAll",
  async (params: any | undefined, { rejectWithValue }) => {
    try {
      const data = await stockAdjustmentService.fetchAll(params);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch stock adjustments"
      );
    }
  }
);

export const fetchStockAdjustmentById = createAsyncThunk(
  "stockAdjustments/fetchById",
  async (id: string | number, { rejectWithValue }) => {
    try {
      const data = await stockAdjustmentService.fetchById(id);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch stock adjustment details"
      );
    }
  }
);

export const createStockAdjustment = createAsyncThunk(
  "stockAdjustments/create",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await stockAdjustmentService.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create stock adjustment"
      );
    }
  }
);

export const updateStockAdjustment = createAsyncThunk(
  "stockAdjustments/update",
  async ({ id, data }: { id: string | number, data: any }, { rejectWithValue }) => {
    try {
      const response = await stockAdjustmentService.update(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update stock adjustment"
      );
    }
  }
);

export const approveStockAdjustment = createAsyncThunk(
  "stockAdjustments/approve",
  async ({ id, status, reason }: { id: string | number, status: string, reason?: string }, { rejectWithValue }) => {
    try {
      const response = await stockAdjustmentService.approve(id, status, reason);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update status"
      );
    }
  }
);

interface StockAdjustmentState {
  data: any[];
  currentAdjustment: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: StockAdjustmentState = {
  data: [],
  currentAdjustment: null,
  loading: false,
  error: null,
};

const stockAdjustmentSlice = createSlice({
  name: "stockAdjustments",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrent: (state) => {
      state.currentAdjustment = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch All
      .addCase(fetchStockAdjustments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStockAdjustments.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchStockAdjustments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch By ID
      .addCase(fetchStockAdjustmentById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStockAdjustmentById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentAdjustment = action.payload;
      })
      .addCase(fetchStockAdjustmentById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createStockAdjustment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createStockAdjustment.fulfilled, (state, action) => {
        state.loading = false;
        state.data.unshift(action.payload);
      })
      .addCase(createStockAdjustment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update
      .addCase(updateStockAdjustment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateStockAdjustment.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.data.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
        if (state.currentAdjustment?.id === action.payload.id) {
          state.currentAdjustment = action.payload;
        }
      })
      .addCase(updateStockAdjustment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Approve
      .addCase(approveStockAdjustment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(approveStockAdjustment.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.data.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
        if (state.currentAdjustment?.id === action.payload.id) {
          state.currentAdjustment = action.payload;
        }
      })
      .addCase(approveStockAdjustment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearCurrent } = stockAdjustmentSlice.actions;
export default stockAdjustmentSlice.reducer;
