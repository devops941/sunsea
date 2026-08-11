import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { supplierService } from "../../services/supplierService";
import type { Supplier, SupplierState, CreateSupplierDto, UpdateSupplierDto } from "./types";

export const fetchSuppliers = createAsyncThunk(
  "suppliers/fetchAll",
  async (params: { search?: string; page?: number; limit?: number } | string | undefined, { rejectWithValue }) => {
    try {
      const normalized = typeof params === "string" ? { search: params } : (params ?? {});
      const res = await supplierService.fetchAll(normalized);
      if (res.suppliers) {
        return {
          suppliers: res.suppliers,
          total: res.pagination?.totalItems || res.suppliers.length,
          page: res.pagination?.currentPage || 1,
          totalPages: res.pagination?.totalPages || 1
        };
      }
      return {
        suppliers: res,
        total: res.length,
        page: 1,
        totalPages: 1
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch suppliers");
    }
  }
);

export const createSupplier = createAsyncThunk("suppliers/create", async (data: CreateSupplierDto, { rejectWithValue }) => {
  try {
    return await supplierService.create(data);
  } catch (error: any) {
    const data = error.response?.data;
    return rejectWithValue({
      message: data?.message || "Failed to create supplier",
      errors: data?.errors || []
    });
  }
});

export const updateSupplier = createAsyncThunk("suppliers/update", async ({ id, data }: { id: string; data: UpdateSupplierDto }, { rejectWithValue }) => {
  try {
    return await supplierService.update(id, data);
  } catch (error: any) {
    const data = error.response?.data;
    return rejectWithValue({
      message: data?.message || "Failed to update supplier",
      errors: data?.errors || []
    });
  }
});

export const deleteSupplier = createAsyncThunk("suppliers/delete", async (id: string, { rejectWithValue }) => {
  try {
    await supplierService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete supplier");
  }
});

const initialState: SupplierState = {
  suppliers: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  totalPages: 1,
};

const supplierSlice = createSlice({
  name: "suppliers",
  initialState,
  reducers: {
    supplierCreated: (state, action: PayloadAction<any>) => {
      const exists = state.suppliers.find((s) => String(s.id) === String(action.payload.id));
      if (!exists) {
        state.suppliers.unshift(action.payload);
      }
    },
    supplierUpdated: (state, action: PayloadAction<any>) => {
      const index = state.suppliers.findIndex((s) => String(s.id) === String(action.payload.id));
      if (index !== -1) {
        state.suppliers[index] = action.payload;
      }
    },
    supplierDeleted: (state, action: PayloadAction<string>) => {
      state.suppliers = state.suppliers.filter((s) => String(s.id) !== String(action.payload));
      state.total = Math.max(0, state.total - 1);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSuppliers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSuppliers.fulfilled, (state, action: PayloadAction<{ suppliers: Supplier[]; total: number; page: number; totalPages: number }>) => {
        state.loading = false;
        state.suppliers = action.payload.suppliers;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchSuppliers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createSupplier.fulfilled, (state, action: PayloadAction<Supplier>) => {
        const exists = state.suppliers.find((s) => String(s.id) === String(action.payload.id));
        if (!exists) {
          state.suppliers.unshift(action.payload);
        }
      })
      .addCase(updateSupplier.fulfilled, (state, action: PayloadAction<Supplier>) => {
        const index = state.suppliers.findIndex((s) => s.id === action.payload.id);
        if (index !== -1) {
          state.suppliers[index] = action.payload;
        }
      })
      .addCase(deleteSupplier.fulfilled, (state, action: PayloadAction<string>) => {
        state.suppliers = state.suppliers.filter((s) => s.id !== action.payload);
      });
  },
});

export const { supplierCreated, supplierUpdated, supplierDeleted } = supplierSlice.actions;

export default supplierSlice.reducer;
