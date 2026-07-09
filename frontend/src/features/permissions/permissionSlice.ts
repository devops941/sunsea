import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { permissionService } from "../../services/permissionService";
import type { Permission, PermissionState, CreatePermissionDto, UpdatePermissionDto, RoleWithPermissions } from "./types";

export const fetchPermissions = createAsyncThunk("permissions/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await permissionService.fetchAll();
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch permissions");
  }
});

export const createPermission = createAsyncThunk("permissions/create", async (data: CreatePermissionDto, { rejectWithValue }) => {
  try {
    return await permissionService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create permission");
  }
});

export const updatePermission = createAsyncThunk("permissions/update", async ({ id, data }: { id: number; data: UpdatePermissionDto }, { rejectWithValue }) => {
  try {
    return await permissionService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update permission");
  }
});

export const deletePermission = createAsyncThunk("permissions/delete", async (id: number, { rejectWithValue }) => {
  try {
    await permissionService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete permission");
  }
});

export const fetchRolePermissions = createAsyncThunk("permissions/fetchRolePermissions", async (roleId: number, { rejectWithValue }) => {
  try {
    const data = await permissionService.fetchRolePermissions(roleId);
    return { roleId, data };
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch role permissions");
  }
});

export const assignRolePermissions = createAsyncThunk("permissions/assignRolePermissions", async ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }, { rejectWithValue }) => {
  try {
    await permissionService.assignPermissions(roleId, permissionIds);
    return { roleId, permissionIds };
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to assign permissions");
  }
});

export const removeRolePermission = createAsyncThunk("permissions/removeRolePermission", async ({ roleId, permissionId }: { roleId: number; permissionId: number }, { rejectWithValue }) => {
  try {
    await permissionService.removePermission(roleId, permissionId);
    return { roleId, permissionId };
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to remove permission");
  }
});

const initialState: PermissionState = {
  permissions: [],
  rolePermissions: {},
  loading: false,
  error: null,
};

const permissionSlice = createSlice({
  name: "permissions",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPermissions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPermissions.fulfilled, (state, action: PayloadAction<Permission[]>) => {
        state.loading = false;
        state.permissions = action.payload;
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createPermission.fulfilled, (state, action: PayloadAction<Permission>) => {
        state.permissions.push(action.payload);
      })
      .addCase(updatePermission.fulfilled, (state, action: PayloadAction<Permission>) => {
        const index = state.permissions.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.permissions[index] = action.payload;
        }
      })
      .addCase(deletePermission.fulfilled, (state, action: PayloadAction<number>) => {
        state.permissions = state.permissions.filter((p) => p.id !== action.payload);
      })
      .addCase(fetchRolePermissions.fulfilled, (state, action: PayloadAction<{ roleId: number; data: RoleWithPermissions }>) => {
        const perms = action.payload.data.rolePermissions?.map((rp) => rp.permission) || [];
        state.rolePermissions[action.payload.roleId] = perms;
      })
      .addCase(assignRolePermissions.fulfilled, (state, action) => {
        const { roleId, permissionIds } = action.payload;
        const current = state.rolePermissions[roleId] || [];
        const added = state.permissions.filter((p) => permissionIds.includes(p.id) && !current.some((x) => x.id === p.id));
        state.rolePermissions[roleId] = [...current, ...added];
      })
      .addCase(removeRolePermission.fulfilled, (state, action) => {
        const { roleId, permissionId } = action.payload;
        if (state.rolePermissions[roleId]) {
          state.rolePermissions[roleId] = state.rolePermissions[roleId].filter((p) => p.id !== permissionId);
        }
      });
  },
});

export default permissionSlice.reducer;
