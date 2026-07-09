import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { rawMaterialCategoryService } from "../../services/rawMaterialCategoryService";
import type { RawMaterialCategory, RawMaterialCategoryState, CreateRawMaterialCategoryDto, UpdateRawMaterialCategoryDto } from "./types";

export const fetchRawMaterialCategories = createAsyncThunk(
  "rawMaterialCategories/fetchAll",
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
      return await rawMaterialCategoryService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
        "Failed to fetch raw material categories"
      );
    }
  }
);

export const createRawMaterialCategory = createAsyncThunk(
  "rawMaterialCategories/create",
  async (data: CreateRawMaterialCategoryDto, { rejectWithValue }) => {
    try {
      return await rawMaterialCategoryService.create(data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to create raw material category");
    }
  }
);

export const updateRawMaterialCategory = createAsyncThunk(
  "rawMaterialCategories/update",
  async ({ id, data }: { id: number; data: UpdateRawMaterialCategoryDto }, { rejectWithValue }) => {
    try {
      return await rawMaterialCategoryService.update(id, data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to update raw material category");
    }
  }
);

export const deleteRawMaterialCategory = createAsyncThunk(
  "rawMaterialCategories/delete",
  async (id: number, { rejectWithValue }) => {
    try {
      await rawMaterialCategoryService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete raw material category");
    }
  }
);

const initialState: RawMaterialCategoryState = {
  data: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};

const rawMaterialCategorySlice = createSlice({
  name: "rawMaterialCategories",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRawMaterialCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchRawMaterialCategories.fulfilled,
        (state, action: PayloadAction<any>) => {
          state.loading = false;

          if (
            action.payload &&
            typeof action.payload === "object" &&
            "rawMaterialCategories" in action.payload
          ) {
            state.data = action.payload.rawMaterialCategories;
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
        }
      )
      .addCase(fetchRawMaterialCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        createRawMaterialCategory.fulfilled,
        (state, action: PayloadAction<RawMaterialCategory>) => {
          state.data.push(action.payload);
        }
      )
      .addCase(
        updateRawMaterialCategory.fulfilled,
        (state, action: PayloadAction<RawMaterialCategory>) => {
          const index = state.data.findIndex(
            (item) => item.id === action.payload.id
          );

          if (index !== -1) {
            state.data[index] = action.payload;
          }
        }
      )
      .addCase(deleteRawMaterialCategory.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default rawMaterialCategorySlice.reducer;
