import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { productService } from "../../services/productService";
import type { Product, ProductState, CreateProductDto, UpdateProductDto } from "./types";

export const fetchProducts = createAsyncThunk(
  "products/fetchAll",
  async (arg: string | { search?: string; categoryId?: string } | undefined, { rejectWithValue }) => {
    const params = typeof arg === "string" || arg === undefined ? { search: arg } : arg;
    try {
      return await productService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch products");
    }
  }
);

export const createProduct = createAsyncThunk("products/create", async (data: CreateProductDto, { rejectWithValue }) => {
  try {
    return await productService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create product");
  }
});

export const updateProduct = createAsyncThunk("products/update", async ({ id, data }: { id: string; data: UpdateProductDto }, { rejectWithValue }) => {
  try {
    return await productService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update product");
  }
});

export const deleteProduct = createAsyncThunk("products/delete", async (id: string, { rejectWithValue }) => {
  try {
    await productService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete product");
  }
});

const initialState: ProductState = {
  products: [],
  loading: false,
  error: null,
};

const productSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    productCreated: (state, action: PayloadAction<Product>) => {
      const exists = state.products.find((p) => String(p.id) === String(action.payload.id));
      if (!exists) {
        state.products.push(action.payload);
      }
    },
    productUpdated: (state, action: PayloadAction<Product>) => {
      const index = state.products.findIndex((p) => String(p.id) === String(action.payload.id));
      if (index !== -1) {
        state.products[index] = action.payload;
      }
    },
    productDeleted: (state, action: PayloadAction<string | number>) => {
      const index = state.products.findIndex((p) => String(p.id) === String(action.payload));
      if (index !== -1) {
        state.products.splice(index, 1);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
        state.loading = false;
        state.products = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        state.products.push(action.payload);
      })
      .addCase(updateProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        const index = state.products.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.products[index] = action.payload;
        }
      })
      .addCase(deleteProduct.fulfilled, (state, action: PayloadAction<string>) => {
        state.products = state.products.filter((p) => p.id !== action.payload);
      });
  },
});

export const { productCreated, productUpdated, productDeleted } = productSlice.actions;

export default productSlice.reducer;
