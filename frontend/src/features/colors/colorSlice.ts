import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { colorService } from "../../services/colorService";
import type { Color, ColorState, CreateColorDto, UpdateColorDto } from "./types";

export const fetchColors = createAsyncThunk(
  "colors/fetchAll",
  async (
    args: { search?: string; isActive?: boolean } | string = {},
    { rejectWithValue }
  ) => {
    const { search, isActive } = typeof args === "string" ? { search: args, isActive: undefined } : args;
    try {
      return await colorService.fetchAll(search, isActive);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch colors");
    }
  }
);

export const createColor = createAsyncThunk("colors/create", async (data: CreateColorDto, { rejectWithValue }) => {
  try {
    return await colorService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create color");
  }
});

export const updateColor = createAsyncThunk("colors/update", async ({ id, data }: { id: number; data: UpdateColorDto }, { rejectWithValue }) => {
  try {
    return await colorService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update color");
  }
});

export const deleteColor = createAsyncThunk("colors/delete", async (id: number, { rejectWithValue }) => {
  try {
    await colorService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete color");
  }
});

const initialState: ColorState = {
  data: [],
  loading: false,
  error: null,
};

const colorSlice = createSlice({
  name: "colors",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchColors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchColors.fulfilled, (state, action: PayloadAction<Color[]>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchColors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createColor.fulfilled, (state, action: PayloadAction<Color>) => {
        state.data.push(action.payload);
      })
      .addCase(updateColor.fulfilled, (state, action: PayloadAction<Color>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteColor.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default colorSlice.reducer;
