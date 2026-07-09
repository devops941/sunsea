import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { rawMaterialService } from "../../services/rawMaterialService";
import type { RawMaterial, RawMaterialState, CreateRawMaterialDto, UpdateRawMaterialDto } from "./types";

export const fetchRawMaterials = createAsyncThunk("rawMaterials/fetchAll", async (search: string | undefined, { rejectWithValue }) => {
  try {
    return await rawMaterialService.fetchAll({ search });
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch raw materials");
  }
});

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
  loading: false,
  error: null,
};

const rawMaterialSlice = createSlice({
  name: "rawMaterials",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRawMaterials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRawMaterials.fulfilled, (state, action: PayloadAction<RawMaterial[]>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchRawMaterials.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createRawMaterial.fulfilled, (state, action: PayloadAction<RawMaterial>) => {
        state.data.push(action.payload);
      })
      .addCase(updateRawMaterial.fulfilled, (state, action: PayloadAction<RawMaterial>) => {
        const index = state.data.findIndex((item) => item.rawMaterialId === action.payload.rawMaterialId);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteRawMaterial.fulfilled, (state, action: PayloadAction<string>) => {
        state.data = state.data.filter((item) => item.rawMaterialId !== action.payload);
      });
  },
});

export default rawMaterialSlice.reducer;
