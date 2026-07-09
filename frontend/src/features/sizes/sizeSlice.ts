import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { sizeService } from "../../services/sizeService";
import type { Size, SizeState, CreateSizeDto, UpdateSizeDto } from "./types";

export const fetchSizes = createAsyncThunk(
  "sizes/fetchAll",
  async (
    args: { search?: string; isActive?: boolean } | string = {},
    { rejectWithValue }
  ) => {
    const { search, isActive } = typeof args === "string" ? { search: args, isActive: undefined } : args;
    try {
      return await sizeService.fetchAll(search, isActive);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch sizes");
    }
  }
);

export const createSize = createAsyncThunk("sizes/create", async (data: CreateSizeDto, { rejectWithValue }) => {
  try {
    return await sizeService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create size");
  }
});

export const updateSize = createAsyncThunk("sizes/update", async ({ id, data }: { id: number; data: UpdateSizeDto }, { rejectWithValue }) => {
  try {
    return await sizeService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update size");
  }
});

export const deleteSize = createAsyncThunk("sizes/delete", async (id: number, { rejectWithValue }) => {
  try {
    await sizeService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete size");
  }
});

const initialState: SizeState = {
  data: [],
  loading: false,
  error: null,
};

const sizeSlice = createSlice({
  name: "sizes",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSizes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSizes.fulfilled, (state, action: PayloadAction<Size[]>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchSizes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createSize.fulfilled, (state, action: PayloadAction<Size>) => {
        state.data.push(action.payload);
      })
      .addCase(updateSize.fulfilled, (state, action: PayloadAction<Size>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteSize.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default sizeSlice.reducer;
