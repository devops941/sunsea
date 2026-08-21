import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { categoryService } from "../../services/categoryService";
import type {
  Category,
  CategoryState,
  CreateCategoryDto,
  UpdateCategoryDto,
  FetchCategoriesParams,
} from "./types";

export const fetchCategories = createAsyncThunk(
  "categories/fetchAll",
  async (params: FetchCategoriesParams | undefined, { rejectWithValue }) => {
    try {
      return await categoryService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch categories"
      );
    }
  }
);

export const fetchNextCategoryCode = createAsyncThunk(
  "categories/fetchNextCode",
  async (type: string, { rejectWithValue }) => {
    try {
      return await categoryService.fetchNextCode(type);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch next category code"
      );
    }
  }
);

export const createCategory = createAsyncThunk(
  "categories/create",
  async (data: CreateCategoryDto, { rejectWithValue }) => {
    try {
      return await categoryService.create(data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create category"
      );
    }
  }
);

export const updateCategory = createAsyncThunk(
  "categories/update",
  async (
    { id, data }: { id: number; data: UpdateCategoryDto },
    { rejectWithValue }
  ) => {
    try {
      return await categoryService.update(id, data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update category"
      );
    }
  }
);

export const deleteCategory = createAsyncThunk(
  "categories/delete",
  async (id: number, { rejectWithValue }) => {
    try {
      await categoryService.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete category"
      );
    }
  }
);

const initialState: CategoryState = {
  data: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};

const categorySlice = createSlice({
  name: "categories",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchCategories.fulfilled,
        (state, action: PayloadAction<any>) => {
          state.loading = false;
          if (action.payload && "categories" in action.payload) {
            state.data = action.payload.categories;
            state.total = action.payload.total;
            state.page = action.payload.page;
            state.totalPages = action.payload.totalPages;
          } else {
            state.data = Array.isArray(action.payload) ? action.payload : [];
            state.total = state.data.length;
            state.page = 1;
            state.totalPages = 1;
          }
        }
      )
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        createCategory.fulfilled,
        (state, action: PayloadAction<Category>) => {
          state.data.push(action.payload);
          state.total += 1;
        }
      )
      .addCase(
        updateCategory.fulfilled,
        (state, action: PayloadAction<Category>) => {
          const index = state.data.findIndex(
            (item) => item.id === action.payload.id
          );
          if (index !== -1) {
            state.data[index] = action.payload;
          }
        }
      )
      .addCase(
        deleteCategory.fulfilled,
        (state, action: PayloadAction<number>) => {
          state.data = state.data.filter((item) => item.id !== action.payload);
          state.total -= 1;
        }
      );
  },
});

export default categorySlice.reducer;
