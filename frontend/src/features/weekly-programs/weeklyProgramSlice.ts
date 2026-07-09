import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { weeklyProgramService } from "../../services/weeklyProgramService";
import type { WeeklyProgramState } from "./types";

export const fetchWeeklyPrograms = createAsyncThunk(
  "weeklyPrograms/fetchAll",
  async (params: any | void, { rejectWithValue }) => {
    try {
      const response = await weeklyProgramService.getAll(params || {});
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch weekly programs");
    }
  }
);

export const createWeeklyProgram = createAsyncThunk(
  "weeklyPrograms/create",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await weeklyProgramService.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to create weekly program");
    }
  }
);

export const updateWeeklyProgram = createAsyncThunk(
  "weeklyPrograms/update",
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const response = await weeklyProgramService.update(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to update weekly program");
    }
  }
);

export const deleteWeeklyProgram = createAsyncThunk(
  "weeklyPrograms/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await weeklyProgramService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete weekly program");
    }
  }
);

const initialState: WeeklyProgramState = {
  data: [],
  loading: false,
  error: null,
};

const weeklyProgramSlice = createSlice({
  name: "weeklyPrograms",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWeeklyPrograms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWeeklyPrograms.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchWeeklyPrograms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createWeeklyProgram.fulfilled, (state, action) => {
        state.data.unshift(action.payload);
      })
      .addCase(updateWeeklyProgram.fulfilled, (state, action) => {
        const index = state.data.findIndex((m) => m.weeklyProgramId === action.payload.weeklyProgramId);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteWeeklyProgram.fulfilled, (state, action) => {
        state.data = state.data.filter((m) => m.weeklyProgramId !== action.payload);
      });
  },
});

export default weeklyProgramSlice.reducer;
