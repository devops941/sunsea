import {
  createSlice,
  createAsyncThunk
} from "@reduxjs/toolkit";

import type {
  PayloadAction
} from "@reduxjs/toolkit";

import type {
  Department,
  DepartmentState,
  CreateDepartmentDto,
  UpdateDepartmentDto
} from "./types";

import { departmentService } from "../../services/departmentService";


export const fetchDepartments = createAsyncThunk(
  "departments/fetchAll",
  async (options: { page?: number; limit?: number; search?: string } | void, { rejectWithValue }) => {
    try {
      return await departmentService.fetchAll(options || undefined);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch departments"
      );
    }
  }
);

export const createDepartment = createAsyncThunk("departments/create", async (data: CreateDepartmentDto, { rejectWithValue }) => {
  try {
    return await departmentService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create department");
  }
});

export const updateDepartment = createAsyncThunk("departments/update", async ({ id, data }: { id: number; data: UpdateDepartmentDto }, { rejectWithValue }) => {
  try {
    return await departmentService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update department");
  }
});

export const deleteDepartment = createAsyncThunk("departments/delete", async (id: number, { rejectWithValue }) => {
  try {
    await departmentService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete department");
  }
});

const initialState: DepartmentState = {
  data: [],
  total: 0,
  loading: false,
  error: null,
};

const departmentSlice = createSlice({
  name: "departments",
  initialState,
  reducers: {
    departmentCreated: (state, action: PayloadAction<Department>) => {
      const exists = state.data.find((item) => item.id === action.payload.id);
      if (!exists) {
        state.data.unshift(action.payload);
        state.total += 1;
      }
    },
    departmentUpdated: (state, action: PayloadAction<Department>) => {
      const index = state.data.findIndex((item) => item.id === action.payload.id);
      if (index !== -1) {
        state.data[index] = action.payload;
      }
    },
    departmentDeleted: (state, action: PayloadAction<number>) => {
      const index = state.data.findIndex((item) => item.id === action.payload);
      if (index !== -1) {
        state.data.splice(index, 1);
        state.total -= 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchDepartments.fulfilled,
        (state, action: PayloadAction<{ data: Department[]; total: number }>) => {
          state.loading = false;
          state.data = action.payload.data;
          state.total = action.payload.total;
        }
      ).addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createDepartment.fulfilled, (state, action: PayloadAction<Department>) => {
        const exists = state.data.find((item) => item.id === action.payload.id);
        if (!exists) {
          state.data.unshift(action.payload);
          state.total += 1;
        }
      })
      .addCase(updateDepartment.fulfilled, (state, action: PayloadAction<Department>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteDepartment.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export const { departmentCreated, departmentUpdated, departmentDeleted } = departmentSlice.actions;

export default departmentSlice.reducer;
