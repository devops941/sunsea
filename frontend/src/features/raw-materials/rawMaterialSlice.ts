import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { rawMaterialService, mapRawMaterial } from "../../services/rawMaterialService";
import type { RawMaterial, RawMaterialState, CreateRawMaterialDto, UpdateRawMaterialDto } from "./types";

export const fetchRawMaterials = createAsyncThunk(
  "rawMaterials/fetchAll",
  async (
    params: {
      search?: string;
      isActive?: boolean;
      itemType?: string;
      storeId?: string;
      categoryId?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } | undefined,
    { rejectWithValue }
  ) => {
    try {
      return await rawMaterialService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch raw materials");
    }
  }
);

export const createRawMaterial = createAsyncThunk("rawMaterials/create", async (data: CreateRawMaterialDto, { rejectWithValue }) => {
  try {
    return await rawMaterialService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create raw material");
  }
});

export const updateRawMaterial = createAsyncThunk("rawMaterials/update", async ({ id, data }: { id: string; data: UpdateRawMaterialDto }, { rejectWithValue }) => {
  try {
    return await rawMaterialService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update raw material");
  }
});

export const deleteRawMaterial = createAsyncThunk("rawMaterials/delete", async (id: string, { rejectWithValue }) => {
  try {
    await rawMaterialService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete raw material");
  }
});

const initialState: RawMaterialState = {
  data: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};

const rawMaterialSlice = createSlice({
  name: "rawMaterials",
  initialState,
  reducers: {
    rawMaterialCreated: (state, action: PayloadAction<any>) => {
      const mapped = mapRawMaterial(action.payload);
      const exists = state.data.find((item) => String(item.rawMaterialId) === String(mapped.rawMaterialId));
      if (!exists) {
        state.data.push(mapped);
        state.total += 1;
      }
    },
    rawMaterialUpdated: (state, action: PayloadAction<any>) => {
      const mapped = mapRawMaterial(action.payload);
      const index = state.data.findIndex((item) => String(item.rawMaterialId) === String(mapped.rawMaterialId));
      if (index !== -1) {
        state.data[index] = mapped;
      }
    },
    rawMaterialDeleted: (state, action: PayloadAction<string>) => {
      const index = state.data.findIndex((item) => String(item.rawMaterialId) === String(action.payload));
      if (index !== -1) {
        state.data.splice(index, 1);
        state.total = Math.max(0, state.total - 1);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRawMaterials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRawMaterials.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        if (action.payload && "rawMaterials" in action.payload) {
          state.data = action.payload.rawMaterials;
          state.total = action.payload.total;
          state.page = action.payload.page;
          state.totalPages = action.payload.totalPages;
        } else {
          state.data = Array.isArray(action.payload) ? action.payload : [];
          state.total = state.data.length;
          state.page = 1;
          state.totalPages = 1;
        }
      })
      .addCase(fetchRawMaterials.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createRawMaterial.fulfilled, (state, action: PayloadAction<RawMaterial>) => {
        const mapped = mapRawMaterial(action.payload);
        const exists = state.data.find((item) => String(item.rawMaterialId) === String(mapped.rawMaterialId));
        if (!exists) {
          state.data.push(mapped);
          state.total += 1;
        }
      })
      .addCase(updateRawMaterial.fulfilled, (state, action: PayloadAction<RawMaterial>) => {
        const index = state.data.findIndex((item) => item.rawMaterialId === action.payload.rawMaterialId);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteRawMaterial.fulfilled, (state, action: PayloadAction<string>) => {
        state.data = state.data.filter((item) => item.rawMaterialId !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const { rawMaterialCreated, rawMaterialUpdated, rawMaterialDeleted } = rawMaterialSlice.actions;

export default rawMaterialSlice.reducer;
