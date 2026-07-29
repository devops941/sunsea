import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { categoryService, mapCategory } from "../../services/categoryService";
import type { Category, CategoryState, CreateCategoryDto, UpdateCategoryDto } from "./types";

export const fetchCategories = createAsyncThunk("categories/fetchAll", async (
  args: { search?: string; isActive?: boolean } | string = {},
  { rejectWithValue }
) => {
  const { search, isActive } = typeof args === "string" ? { search: args, isActive: undefined } : args;
  try {
    return await categoryService.fetchAll(search ?? "", isActive);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch categories");
  }
});

export const createCategory = createAsyncThunk("categories/create", async (data: CreateCategoryDto, { rejectWithValue }) => {
  try {
    return await categoryService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create category");
  }
});

export const updateCategory = createAsyncThunk("categories/update", async ({ id, data }: { id: number; data: UpdateCategoryDto }, { rejectWithValue }) => {
  try {
    return await categoryService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update category");
  }
});

export const deleteCategory = createAsyncThunk("categories/delete", async (id: number, { rejectWithValue }) => {
  try {
    await categoryService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete category");
  }
});

const initialState: CategoryState = {
  data: [],
  loading: false,
  error: null,
};

const categorySlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    categoryCreated: (state, action: PayloadAction<any>) => {
      const mapped = mapCategory(action.payload);
      const exists = state.data.find((item) => String(item.id) === String(mapped.id));
      if (!exists) {
        state.data.unshift(mapped);
      }
    },
    categoryUpdated: (state, action: PayloadAction<any>) => {
      const mapped = mapCategory(action.payload);
      const index = state.data.findIndex((item) => String(item.id) === String(mapped.id));
      if (index !== -1) {
        state.data[index] = mapped;
      }
    },
    categoryDeleted: (state, action: PayloadAction<number>) => {
      const index = state.data.findIndex((item) => String(item.id) === String(action.payload));
      if (index !== -1) {
        state.data.splice(index, 1);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<Category[]>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        const exists = state.data.find((item) => String(item.id) === String(action.payload.id));
        if (!exists) {
          state.data.unshift(action.payload);
        }
      })
      .addCase(updateCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteCategory.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export const { categoryCreated, categoryUpdated, categoryDeleted } = categorySlice.actions;

export default categorySlice.reducer;
