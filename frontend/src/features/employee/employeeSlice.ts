import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { employeeService } from "../../services/employeeService";
import type { Employee, EmployeeState, CreateEmployeeDto, UpdateEmployeeDto } from "./types";

export const fetchEmployees = createAsyncThunk("employees/fetchAll", async (params: { search?: string; departmentId?: string | number; roleId?: string | number; status?: string; page?: number; limit?: number } | undefined, { rejectWithValue }) => {
  try {
    return await employeeService.fetchAll(params);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch employees");
  }
});

export const createEmployee = createAsyncThunk("employees/create", async (data: CreateEmployeeDto, { rejectWithValue }) => {
  try {
    return await employeeService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create employee");
  }
});

export const updateEmployee = createAsyncThunk("employees/update", async ({ id, data }: { id: string; data: UpdateEmployeeDto }, { rejectWithValue }) => {
  try {
    return await employeeService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update employee");
  }
});

export const deleteEmployee = createAsyncThunk("employees/delete", async (id: string, { rejectWithValue }) => {
  try {
    await employeeService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete employee");
  }
});

const initialState: EmployeeState = {
  employees: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};

const employeeSlice = createSlice({
  name: "employees",
  initialState,
  reducers: {
    employeeCreated: (state, action: PayloadAction<Employee>) => {
      const exists = state.employees.find((item) => String(item.id) === String(action.payload.id));
      if (!exists) {
        state.employees.unshift(action.payload);
        state.total += 1;
      }
    },
    employeeUpdated: (state, action: PayloadAction<Employee>) => {
      const index = state.employees.findIndex((item) => String(item.id) === String(action.payload.id));
      if (index !== -1) {
        state.employees[index] = action.payload;
      }
    },
    employeeDeleted: (state, action: PayloadAction<string>) => {
      const index = state.employees.findIndex((item) => String(item.id) === String(action.payload));
      if (index !== -1) {
        state.employees.splice(index, 1);
        state.total = Math.max(0, state.total - 1);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmployees.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        if (action.payload && typeof action.payload === "object" && "employees" in action.payload) {
          state.employees = action.payload.employees;
          state.total = action.payload.total;
          state.page = action.payload.page;
          state.totalPages = action.payload.totalPages;
        } else {
          state.employees = Array.isArray(action.payload) ? action.payload : [];
          state.total = state.employees.length;
          state.page = 1;
          state.totalPages = 1;
        }
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createEmployee.fulfilled, (state, action: PayloadAction<Employee>) => {
        const exists = state.employees.find((item) => String(item.id) === String(action.payload.id));
        if (!exists) {
          state.employees.unshift(action.payload);
          state.total += 1;
        }
      })
      .addCase(updateEmployee.fulfilled, (state, action: PayloadAction<Employee>) => {
        const index = state.employees.findIndex((e) => e.id === action.payload.id);
        if (index !== -1) {
          state.employees[index] = action.payload;
        }
      })
      .addCase(deleteEmployee.fulfilled, (state, action: PayloadAction<string>) => {
        state.employees = state.employees.filter((e) => e.id !== action.payload);
      });
  },
});

export const { employeeCreated, employeeUpdated, employeeDeleted } = employeeSlice.actions;

export default employeeSlice.reducer;
