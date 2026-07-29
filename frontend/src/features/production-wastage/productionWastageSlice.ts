import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { productionWastageService } from "../../services/productionWastageService";

export interface ProductionWastageState {
  data: any[];
  loading: boolean;
  error: string | null;
  total?: number;
}

export const fetchProductionWastages = createAsyncThunk(
  "productionWastages/fetchAll",
  async (
    params: {
      productionOrderId?: string;
      machineId?: string;
      shiftId?: string;
      productId?: string;
      status?: string;
      page?: number;
      limit?: number;
    } | undefined,
    { rejectWithValue }
  ) => {
    try {
      const response = await productionWastageService.getAll(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch production wastages");
    }
  }
);

export const createProductionWastage = createAsyncThunk(
  "productionWastages/create",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await productionWastageService.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to create production wastage");
    }
  }
);

export const updateProductionWastage = createAsyncThunk(
  "productionWastages/update",
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const response = await productionWastageService.update(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to update production wastage");
    }
  }
);

export const deleteProductionWastage = createAsyncThunk(
  "productionWastages/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await productionWastageService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete production wastage");
    }
  }
);

export const approveProductionWastage = createAsyncThunk(
  "productionWastages/approve",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await productionWastageService.approve(id);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to approve production wastage");
    }
  }
);

export const rejectProductionWastage = createAsyncThunk(
  "productionWastages/reject",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await productionWastageService.reject(id);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to reject production wastage");
    }
  }
);

const initialState: ProductionWastageState = {
  data: [],
  loading: false,
  error: null,
};

const productionWastageSlice = createSlice({
  name: "productionWastages",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductionWastages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductionWastages.fulfilled, (state, action) => {
        state.loading = false;
        const resData = action.payload?.data;
        if (resData && typeof resData === "object" && "data" in resData) {
          state.data = resData.data || [];
          state.total = resData.total || 0;
        } else {
          state.data = Array.isArray(resData) ? resData : (action.payload || []);
          state.total = Array.isArray(state.data) ? state.data.length : 0;
        }
      })
      .addCase(fetchProductionWastages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createProductionWastage.fulfilled, (state, action) => {
        const record = action.payload?.data || action.payload;
        if (record && Array.isArray(state.data)) {
          state.data.unshift(record);
        }
      })
      .addCase(updateProductionWastage.fulfilled, (state, action) => {
        const record = action.payload?.data || action.payload;
        if (record && Array.isArray(state.data)) {
          const index = state.data.findIndex((m) => String(m.id) === String(record.id));
          if (index !== -1) {
            state.data[index] = record;
          }
        }
      })
      .addCase(deleteProductionWastage.fulfilled, (state, action) => {
        if (Array.isArray(state.data)) {
          state.data = state.data.filter((m) => String(m.id) !== String(action.payload));
        }
      })
      .addCase(approveProductionWastage.fulfilled, (state, action) => {
        const record = action.payload?.data || action.payload;
        if (record && Array.isArray(state.data)) {
          const index = state.data.findIndex((m) => String(m.id) === String(record.id));
          if (index !== -1) {
            state.data[index] = record;
          }
        }
      })
      .addCase(rejectProductionWastage.fulfilled, (state, action) => {
        const record = action.payload?.data || action.payload;
        if (record && Array.isArray(state.data)) {
          const index = state.data.findIndex((m) => String(m.id) === String(record.id));
          if (index !== -1) {
            state.data[index] = record;
          }
        }
      });
  },
});

export default productionWastageSlice.reducer;
