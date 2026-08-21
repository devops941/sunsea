import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
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
      return response.data.data;
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
      return response.data.data;
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
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update status"
      );
    }
  }
);

export const fetchProductionOrdersForIssue = createAsyncThunk(
  "stockAdjustments/fetchProductionOrdersForIssue",
  async (_, { rejectWithValue }) => {
    try {
      const data = await stockAdjustmentService.fetchProductionOrdersForIssue();
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch production orders"
      );
    }
  }
);

export const fetchNextAdjustmentNumber = createAsyncThunk(
  "stockAdjustments/fetchNextNumber",
  async (_, { rejectWithValue }) => {
    try {
      return await stockAdjustmentService.fetchNextNumber();
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch next adjustment number"
      );
    }
  }
);

export const deleteStockAdjustment = createAsyncThunk(
  "stockAdjustments/delete",
  async (id: string | number, { rejectWithValue }) => {
    try {
      await stockAdjustmentService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete stock adjustment"
      );
    }
  }
);

interface StockAdjustmentState {
  data: any[];
  meta: any | null;
  currentAdjustment: any | null;
  productionOrdersForIssue: any[];
  loading: boolean;
  error: string | null;
}

const initialState: StockAdjustmentState = {
  data: [],
  meta: null,
  currentAdjustment: null,
  productionOrdersForIssue: [],
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
    },
    stockAdjustmentCreated: (state, action: PayloadAction<any>) => {
      const exists = state.data.find(a => String(a.id) === String(action.payload.id));
      if (!exists) {
        state.data.unshift(action.payload);
      }
    },
    stockAdjustmentUpdated: (state, action: PayloadAction<any>) => {
      const index = state.data.findIndex(a => String(a.id) === String(action.payload.id));
      if (index !== -1) {
        state.data[index] = action.payload;
        if (state.currentAdjustment?.id === action.payload.id) {
          state.currentAdjustment = action.payload;
        }
      }
    },
    stockAdjustmentDeleted: (state, action: PayloadAction<any>) => {
      const idToDelete = action.payload.id || action.payload;
      state.data = state.data.filter(a => String(a.id) !== String(idToDelete));
      if (state.currentAdjustment?.id === idToDelete) {
        state.currentAdjustment = null;
      }
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
        state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
        if (action.payload?.meta) state.meta = action.payload.meta;
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
        if (action.payload) state.data.unshift(action.payload);
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
        if (action.payload) {
          const index = state.data.findIndex(a => a.id === action.payload.id);
          if (index !== -1) state.data[index] = action.payload;
          if (state.currentAdjustment?.id === action.payload.id) state.currentAdjustment = action.payload;
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
        if (action.payload) {
          const index = state.data.findIndex(a => a.id === action.payload.id);
          if (index !== -1) state.data[index] = action.payload;
          if (state.currentAdjustment?.id === action.payload.id) state.currentAdjustment = action.payload;
        }
      })
      .addCase(approveStockAdjustment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Production Orders For Issue
      .addCase(fetchProductionOrdersForIssue.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProductionOrdersForIssue.fulfilled, (state, action) => {
        state.loading = false;
        state.productionOrdersForIssue = action.payload || [];
      })
      .addCase(fetchProductionOrdersForIssue.rejected, (state) => {
        state.loading = false;
      })
      // Delete
      .addCase(deleteStockAdjustment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteStockAdjustment.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.filter(a => String(a.id) !== String(action.payload));
        if (state.currentAdjustment && String(state.currentAdjustment.id) === String(action.payload)) {
          state.currentAdjustment = null;
        }
      })
      .addCase(deleteStockAdjustment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Next Number (no loading state change needed — handled locally in form)
      .addCase(fetchNextAdjustmentNumber.fulfilled, (_state, _action) => {});
  },
});

export const { clearError, clearCurrent, stockAdjustmentCreated, stockAdjustmentUpdated, stockAdjustmentDeleted } = stockAdjustmentSlice.actions;
export default stockAdjustmentSlice.reducer;
