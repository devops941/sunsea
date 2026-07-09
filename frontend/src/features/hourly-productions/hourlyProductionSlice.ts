import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { hourlyProductionService } from "../../services/hourlyProductionService";
import type { HourlyProductionState } from "./types";

export const fetchHourlyProductions = createAsyncThunk(
  "hourlyProductions/fetchAll",
  async (params: { productionDate?: string; search?: string } | undefined, { rejectWithValue }) => {
    try {
      const response = await hourlyProductionService.getAll(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch hourly productions");
    }
  }
);

export const createHourlyProduction = createAsyncThunk(
  "hourlyProductions/create",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await hourlyProductionService.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to create hourly production");
    }
  }
);

export const updateHourlyProduction = createAsyncThunk(
  "hourlyProductions/update",
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const response = await hourlyProductionService.update(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to update hourly production");
    }
  }
);

export const deleteHourlyProduction = createAsyncThunk(
  "hourlyProductions/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await hourlyProductionService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete hourly production");
    }
  }
);

const initialState: HourlyProductionState = {
  data: [],
  loading: false,
  error: null,
};

const hourlyProductionSlice = createSlice({
  name: "hourlyProductions",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchHourlyProductions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHourlyProductions.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchHourlyProductions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createHourlyProduction.fulfilled, (state, action) => {
        state.data.unshift(action.payload);
      })
      .addCase(updateHourlyProduction.fulfilled, (state, action) => {
        const index = state.data.findIndex((m) => m.hourlyProductionId === action.payload.hourlyProductionId);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteHourlyProduction.fulfilled, (state, action) => {
        state.data = state.data.filter((m) => m.hourlyProductionId !== action.payload);
      });
  },
});

export default hourlyProductionSlice.reducer;
