import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { customerService } from "../../services/customerService";
import type { Customer, CustomerState, CreateCustomerDto, UpdateCustomerDto } from "./types";

// BUG-CUST-004 fix: thunk now accepts page and limit for server-side pagination
export const fetchCustomers = createAsyncThunk(
  "customers/fetchAll",
  async (params: { search?: string; page?: number; limit?: number } | string | undefined, { rejectWithValue }) => {
    try {
      // Support both legacy string call (search only) and new paginated params object
      const normalized = typeof params === "string" ? { search: params } : (params ?? {});
      return await customerService.fetchAll(normalized);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch customers");
    }
  }
);

export const createCustomer = createAsyncThunk("customers/create", async (data: CreateCustomerDto, { rejectWithValue }) => {
  try {
    return await customerService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create customer");
  }
});

export const updateCustomer = createAsyncThunk("customers/update", async ({ id, data }: { id: string; data: UpdateCustomerDto }, { rejectWithValue }) => {
  try {
    return await customerService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update customer");
  }
});

export const deleteCustomer = createAsyncThunk("customers/delete", async (id: string, { rejectWithValue }) => {
  try {
    await customerService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete customer");
  }
});

const initialState: CustomerState = {
  customers: [],
  loading: false,
  error: null,
  // BUG-CUST-004 fix: pagination metadata initial state
  total: 0,
  page: 1,
  totalPages: 1,
};

const customerSlice = createSlice({
  name: "customers",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // BUG-CUST-004 fix: handle paginated payload { customers, total, page, totalPages }
      .addCase(fetchCustomers.fulfilled, (state, action: PayloadAction<{ customers: Customer[]; total: number; page: number; totalPages: number }>) => {
        state.loading = false;
        state.customers = action.payload.customers;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        state.customers.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        const index = state.customers.findIndex((c) => c.id === action.payload.id);
        if (index !== -1) {
          state.customers[index] = action.payload;
        }
      })
      .addCase(deleteCustomer.fulfilled, (state, action: PayloadAction<string>) => {
        state.customers = state.customers.filter((c) => c.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export default customerSlice.reducer;
