import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { machineService } from "../../services/machineService";
import type { MachineState } from "./types";

export const fetchMachines = createAsyncThunk<
  any,
  { search?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" } | void
>(
  "machines/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      return await machineService.getAll(params || undefined);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch machines");
    }
  }
);

export const createMachine = createAsyncThunk(
  "machines/create",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await machineService.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to create machine");
    }
  }
);

export const updateMachine = createAsyncThunk(
  "machines/update",
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const response = await machineService.update(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to update machine");
    }
  }
);

export const deleteMachine = createAsyncThunk(
  "machines/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await machineService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete machine");
    }
  }
);

const initialState: MachineState = {
  data: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};

const machineSlice = createSlice({
  name: "machines",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMachines.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMachines.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        if (Array.isArray(payload)) {
          state.data = payload;
          state.total = payload.length;
          state.totalPages = 1;
          state.page = 1;
        } else if (payload && Array.isArray(payload.data)) {
          state.data = payload.data;
          state.total = payload.total ?? payload.data.length;
          state.page = payload.page ?? 1;
          state.totalPages = payload.totalPages ?? 1;
        } else if (payload && Array.isArray(payload.machines)) {
          state.data = payload.machines;
          state.total = payload.total ?? payload.machines.length;
          state.page = payload.page ?? 1;
          state.totalPages = payload.totalPages ?? 1;
        }
      })
      .addCase(fetchMachines.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createMachine.fulfilled, (state, action) => {
        if (action.payload) state.data.unshift(action.payload);
      })
      .addCase(updateMachine.fulfilled, (state, action) => {
        if (action.payload) {
          const index = state.data.findIndex((m) => m.machineId === action.payload.machineId);
          if (index !== -1) state.data[index] = action.payload;
        }
      })
      .addCase(deleteMachine.fulfilled, (state, action) => {
        state.data = state.data.filter((m) => m.machineId !== action.payload);
      });
  },
});

export default machineSlice.reducer;
