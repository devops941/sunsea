import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { shiftService } from "../../services/shiftService";
import type { Shift, ShiftState, CreateShiftDto, UpdateShiftDto } from "./types";

export const fetchShifts = createAsyncThunk("shifts/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await shiftService.fetchAll();
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch shifts");
  }
});

export const createShift = createAsyncThunk("shifts/create", async (data: CreateShiftDto, { rejectWithValue }) => {
  try {
    return await shiftService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create shift");
  }
});

export const updateShift = createAsyncThunk("shifts/update", async ({ id, data }: { id: number; data: UpdateShiftDto }, { rejectWithValue }) => {
  try {
    return await shiftService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update shift");
  }
});

export const deleteShift = createAsyncThunk("shifts/delete", async (id: number, { rejectWithValue }) => {
  try {
    await shiftService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete shift");
  }
});

const initialState: ShiftState = {
  data: [],
  loading: false,
  error: null,
};

const shiftSlice = createSlice({
  name: "shifts",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchShifts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShifts.fulfilled, (state, action: PayloadAction<Shift[]>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchShifts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createShift.fulfilled, (state, action: PayloadAction<Shift>) => {
        state.data.push(action.payload);
      })
      .addCase(updateShift.fulfilled, (state, action: PayloadAction<Shift>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteShift.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default shiftSlice.reducer;
