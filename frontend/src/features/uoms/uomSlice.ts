import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { uomService } from "../../services/uomService";
import type { UOM, UOMState, CreateUOMDto, UpdateUOMDto, ActiveUOM } from "./types";

export const fetchUOMs = createAsyncThunk(
  "uoms/fetchAll",
  async (search: string = "", { rejectWithValue }) => {
    try {
      return await uomService.fetchAll(search);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch UOMs"
      );
    }
  }
);

export const fetchActiveUOMs = createAsyncThunk(
  "uoms/fetchActive",
  async (_: void, { rejectWithValue }) => {
    try {
      return await uomService.fetchAllActive();
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch active UOMs"
      );
    }
  }
);

export const createUOM = createAsyncThunk("uoms/create", async (data: CreateUOMDto, { rejectWithValue }) => {
  try {
    return await uomService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create UOM");
  }
});

export const updateUOM = createAsyncThunk("uoms/update", async ({ id, data }: { id: number; data: UpdateUOMDto }, { rejectWithValue }) => {
  try {
    return await uomService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update UOM");
  }
});

export const deleteUOM = createAsyncThunk("uoms/delete", async (id: number, { rejectWithValue }) => {
  try {
    await uomService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete UOM");
  }
});

const initialState: UOMState = {
  data: [],
  loading: false,
  error: null,
  activeData: [],
  activeLoading: false,
  activeError: null,

};

const uomSlice = createSlice({
  name: "uoms",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUOMs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUOMs.fulfilled, (state, action: PayloadAction<UOM[]>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchUOMs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActiveUOMs.pending, (state) => {
        state.activeLoading = true;
        state.activeError = null;
      })
      .addCase(fetchActiveUOMs.fulfilled, (state, action: PayloadAction<ActiveUOM[]>) => {
        state.activeLoading = false;
        state.activeData = action.payload;
      })
      .addCase(fetchActiveUOMs.rejected, (state, action) => {
        state.activeLoading = false;
        state.activeError = action.payload as string;
      })
      .addCase(createUOM.fulfilled, (state, action: PayloadAction<UOM>) => {
        state.data.push(action.payload);
      })
      .addCase(updateUOM.fulfilled, (state, action: PayloadAction<UOM>) => {
        const index = state.data.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteUOM.fulfilled, (state, action: PayloadAction<number>) => {
        state.data = state.data.filter((item) => item.id !== action.payload);
      });
  },
});

export default uomSlice.reducer;
