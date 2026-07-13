import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { dailyPlanService } from "../../services/dailyPlanService";

interface DailyPlanState {
  data: any[];
  loading: boolean;
  error: string | null;
}

const initialState: DailyPlanState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchDailyPlans = createAsyncThunk(
  "dailyPlans/fetchAll",
  async (params: any | undefined, { rejectWithValue }) => {
    try {
      const response = await dailyPlanService.getAll(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch daily plans");
    }
  }
);

export const createDailyPlan = createAsyncThunk(
  "dailyPlans/create",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await dailyPlanService.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.errors?.length > 0
          ? error.response.data.errors.map((e: any) => e.message).join(", ")
          : error.response?.data?.message || "Failed to create daily plan"
      );
    }
  }
);

export const updateDailyPlan = createAsyncThunk(
  "dailyPlans/update",
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const response = await dailyPlanService.update(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to update daily plan");
    }
  }
);

export const deleteDailyPlan = createAsyncThunk(
  "dailyPlans/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await dailyPlanService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete daily plan");
    }
  }
);

const dailyPlanSlice = createSlice({
  name: "dailyPlans",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyPlans.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyPlans.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload || [];
      })
      .addCase(fetchDailyPlans.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createDailyPlan.fulfilled, (state, action) => {
        if (action.payload) state.data.unshift(action.payload);
      })
      .addCase(updateDailyPlan.fulfilled, (state, action) => {
        const index = state.data.findIndex((p) => p.dailyPlanId === action.payload?.dailyPlanId);
        if (index !== -1 && action.payload) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteDailyPlan.fulfilled, (state, action) => {
        state.data = state.data.filter((p) => p.dailyPlanId !== action.payload);
      });
  },
});

export default dailyPlanSlice.reducer;
