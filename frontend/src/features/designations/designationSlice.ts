import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { designationService } from "../../services/designationService";
import type { Designation, DesignationState, CreateDesignationDto, UpdateDesignationDto } from "./types";

export const fetchDesignations =
  createAsyncThunk(
    "designations/fetchAll",
    async (
      departmentId: number | undefined,
      { rejectWithValue }
    ) => {
      try {
        return await designationService.fetchAll(
          departmentId
        );
      } catch (error: any) {
        return rejectWithValue(
          error.response?.data?.message ||
          "Failed to fetch designations"
        );
      }
    }
  );

export const createDesignation = createAsyncThunk("designations/create", async (data: CreateDesignationDto, { rejectWithValue }) => {
  try {
    return await designationService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create designation");
  }
});

export const updateDesignation = createAsyncThunk("designations/update", async ({ id, data }: { id: number; data: UpdateDesignationDto }, { rejectWithValue }) => {
  try {
    return await designationService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update designation");
  }
});

export const deleteDesignation = createAsyncThunk("designations/delete", async (id: number, { rejectWithValue }) => {
  try {
    await designationService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete designation");
  }
});

const initialState: DesignationState = {
  data: [],
  loading: false,
  error: null,
};

const designationSlice = createSlice({
  name: "designations",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDesignations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDesignations.fulfilled, (state, action: PayloadAction<Designation[]>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDesignations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createDesignation.fulfilled, (state, action: PayloadAction<Designation>) => {
        state.data.push(action.payload);
      })
      .addCase(updateDesignation.fulfilled, (state, action: PayloadAction<Designation>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteDesignation.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default designationSlice.reducer;
