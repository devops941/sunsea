import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { roleService } from "../../services/roleService";
import type { Role, RoleState, CreateRoleDto, UpdateRoleDto } from "./types";

export const fetchRoles = createAsyncThunk("roles/fetchAll", async (options: { page?: number; limit?: number; search?: string }, { rejectWithValue }) => {
  try {
    return await roleService.fetchAll(options);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch roles");
  }
});

export const createRole = createAsyncThunk("roles/create", async (data: CreateRoleDto, { rejectWithValue }) => {
  try {
    return await roleService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create role");
  }
});

export const updateRole = createAsyncThunk("roles/update", async ({ id, data }: { id: number; data: UpdateRoleDto }, { rejectWithValue }) => {
  try {
    return await roleService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update role");
  }
});

export const deleteRole = createAsyncThunk("roles/delete", async (id: number, { rejectWithValue }) => {
  try {
    await roleService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete role");
  }
});

const initialState: RoleState = {
  data: [],
  total: 0,
  loading: false,
  error: null,
};

const roleSlice = createSlice({
  name: "roles",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action: PayloadAction<{ data: Role[]; total: number }>) => {
        state.loading = false;
        state.data = action.payload.data;
        state.total = action.payload.total;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createRole.fulfilled, (state, action: PayloadAction<Role>) => {
        state.data.push(action.payload);
      })
      .addCase(updateRole.fulfilled, (state, action: PayloadAction<Role>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteRole.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default roleSlice.reducer;
