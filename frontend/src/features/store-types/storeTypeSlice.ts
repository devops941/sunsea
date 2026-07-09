import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { storeTypeService } from "../../services/storeTypeService";
import type { StoreType, StoreTypeState, CreateStoreTypeDto, UpdateStoreTypeDto } from "./types";

export const fetchStoreTypes = createAsyncThunk(
  "storeTypes/fetchAll",
  async (
    params: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } | undefined,
    { rejectWithValue }
  ) => {
    try {
      return await storeTypeService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch store types"
      );
    }
  }
);

export const createStoreType = createAsyncThunk("storeTypes/create", async (data: CreateStoreTypeDto, { rejectWithValue }) => {
  try {
    return await storeTypeService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create store type");
  }
});

export const updateStoreType = createAsyncThunk("storeTypes/update", async ({ id, data }: { id: number; data: UpdateStoreTypeDto }, { rejectWithValue }) => {
  try {
    return await storeTypeService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update store type");
  }
});

export const deleteStoreType = createAsyncThunk("storeTypes/delete", async (id: number, { rejectWithValue }) => {
  try {
    await storeTypeService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete store type");
  }
});
const initialState: StoreTypeState = {
  data: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};

const storeTypeSlice = createSlice({
  name: "storeTypes",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStoreTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStoreTypes.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;

        if (
          action.payload &&
          typeof action.payload === "object" &&
          "storeTypes" in action.payload
        ) {
          state.data = action.payload.storeTypes;
          state.total = action.payload.total;
          state.page = action.payload.page;
          state.totalPages = action.payload.totalPages;
        } else {
          state.data = Array.isArray(action.payload)
            ? action.payload
            : [];

          state.total = state.data.length;
          state.page = 1;
          state.totalPages = 1;
        }
      })
      .addCase(fetchStoreTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createStoreType.fulfilled, (state, action: PayloadAction<StoreType>) => {
        state.data.push(action.payload);
      })
      .addCase(updateStoreType.fulfilled, (state, action: PayloadAction<StoreType>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteStoreType.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default storeTypeSlice.reducer;
