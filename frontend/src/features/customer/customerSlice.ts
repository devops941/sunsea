import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { customerService } from "../../services/customerService";
import type { Customer, CustomerState, CreateCustomerDto, UpdateCustomerDto } from "./types";


export const fetchCustomers = createAsyncThunk("customers/fetchAll", async (search: string | undefined, { rejectWithValue }) => {
  try {
    return await customerService.fetchAll(search);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch customers");
  }
});

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
      .addCase(fetchCustomers.fulfilled, (state, action: PayloadAction<Customer[]>) => {
        state.loading = false;
        state.customers = action.payload;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        state.customers.push(action.payload);
      })
      .addCase(updateCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        const index = state.customers.findIndex((c) => c.id === action.payload.id);
        if (index !== -1) {
          state.customers[index] = action.payload;
        }
      })
      .addCase(deleteCustomer.fulfilled, (state, action: PayloadAction<string>) => {
        state.customers = state.customers.filter((c) => c.id !== action.payload);
      });
  },
});

export default customerSlice.reducer;
