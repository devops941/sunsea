import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { subCategoryService } from "../../services/subCategoryService";
import type { SubCategory, SubCategoryState, CreateSubCategoryDto, UpdateSubCategoryDto } from "./types";

// Previously this thunk took a bare `search: string`, so there was no way
// to ask the API for "subcategories under category 8" without it being
// misread as a text search for the literal string "8". categoryId is now
// its own field, kept separate from free-text search end to end.
export interface FetchSubCategoriesParams {
  search?: string;
  categoryId?: number | string;
  isActive?: boolean;
}

export const fetchSubCategories = createAsyncThunk(
  "subCategories/fetchAll",
  async (params: FetchSubCategoriesParams = {}, { rejectWithValue }) => {
    try {
      return await subCategoryService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch sub-categories");
    }
  }
);

export const createSubCategory = createAsyncThunk("subCategories/create", async (data: CreateSubCategoryDto, { rejectWithValue }) => {
  try {
    return await subCategoryService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create sub-category");
  }
});

export const updateSubCategory = createAsyncThunk("subCategories/update", async ({ id, data }: { id: number; data: UpdateSubCategoryDto }, { rejectWithValue }) => {
  try {
    return await subCategoryService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update sub-category");
  }
});

export const deleteSubCategory = createAsyncThunk("subCategories/delete", async (id: number, { rejectWithValue }) => {
  try {
    await subCategoryService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete sub-category");
  }
});

const initialState: SubCategoryState = {
  data: [],
  loading: false,
  error: null,
};

const subCategorySlice = createSlice({
  name: "subCategories",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSubCategories.fulfilled, (state, action: PayloadAction<SubCategory[]>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchSubCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createSubCategory.fulfilled, (state, action: PayloadAction<SubCategory>) => {
        state.data.push(action.payload);
      })
      .addCase(updateSubCategory.fulfilled, (state, action: PayloadAction<SubCategory>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteSubCategory.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default subCategorySlice.reducer;