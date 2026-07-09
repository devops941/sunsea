import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { storeService } from "../../services/storeService";
import type { Store, StoreState, CreateStoreDto, UpdateStoreDto } from "./types";

export const fetchStores = createAsyncThunk(
  "stores/fetchAll",
  async (
    params: {
      search?: string;
      storeTypeId?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } | undefined,
    { rejectWithValue }
  ) => {
    try {
      return await storeService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch stores"
      );
    }
  }
);

export const createStore = createAsyncThunk("stores/create", async (data: CreateStoreDto, { rejectWithValue }) => {
  try {
    return await storeService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create store");
  }
});

export const updateStore = createAsyncThunk("stores/update", async ({ id, data }: { id: string; data: UpdateStoreDto }, { rejectWithValue }) => {
  try {
    return await storeService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update store");
  }
});

export const deleteStore = createAsyncThunk("stores/delete", async (id: string, { rejectWithValue }) => {
  try {
    await storeService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete store");
  }
});
const initialState: StoreState = {
  data: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};
const storeSlice = createSlice({
  name: "stores",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStores.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStores.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;

        if (
          action.payload &&
          typeof action.payload === "object" &&
          "stores" in action.payload
        ) {
          state.data = action.payload.stores;
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
      .addCase(fetchStores.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createStore.fulfilled, (state, action: PayloadAction<Store>) => {
        state.data.push(action.payload);
      })
      .addCase(updateStore.fulfilled, (state, action: PayloadAction<Store>) => {
        const index = state.data.findIndex((item) => item.storeId === action.payload.storeId);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteStore.fulfilled, (state, action: PayloadAction<string>) => {
        state.data = state.data.filter((item) => item.storeId !== action.payload);
      });
  },
});

export default storeSlice.reducer;
