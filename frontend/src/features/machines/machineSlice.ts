import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { machineService } from "../../services/machineService";
import type { MachineState } from "./types";

export const fetchMachines = createAsyncThunk(
  "machines/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await machineService.getAll();
      return response.data;
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
        state.data = action.payload;
      })
      .addCase(fetchMachines.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createMachine.fulfilled, (state, action) => {
        state.data.unshift(action.payload);
      })
      .addCase(updateMachine.fulfilled, (state, action) => {
        const index = state.data.findIndex((m) => m.machineId === action.payload.machineId);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteMachine.fulfilled, (state, action) => {
        state.data = state.data.filter((m) => m.machineId !== action.payload);
      });
  },
});

export default machineSlice.reducer;
