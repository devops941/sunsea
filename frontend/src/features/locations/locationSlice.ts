import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { locationService } from "../../services/locationService";
import type { Location, LocationState, CreateLocationDto, UpdateLocationDto } from "./types";

export const fetchLocations = createAsyncThunk(
  "locations/fetchAll",
  async (
    params: {
      search?: string;
      locationType?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } | undefined,
    { rejectWithValue }
  ) => {
    try {
      return await locationService.fetchAll(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch locations"
      );
    }
  }
);

export const createLocation = createAsyncThunk("locations/create", async (data: CreateLocationDto, { rejectWithValue }) => {
  try {
    return await locationService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create location");
  }
});

export const updateLocation = createAsyncThunk("locations/update", async ({ id, data }: { id: string; data: UpdateLocationDto }, { rejectWithValue }) => {
  try {
    return await locationService.update(id, data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update location");
  }
});

export const deleteLocation = createAsyncThunk("locations/delete", async (id: string, { rejectWithValue }) => {
  try {
    await locationService.delete(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to delete location");
  }
});

const initialState: LocationState = {
  data: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};

const locationSlice = createSlice({
  name: "locations",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLocations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLocations.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        if (action.payload && typeof action.payload === "object" && "locations" in action.payload) {
          state.data = action.payload.locations;
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
      .addCase(fetchLocations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createLocation.fulfilled, (state, action: PayloadAction<Location>) => {
        state.data.push(action.payload);
      })
      .addCase(updateLocation.fulfilled, (state, action: PayloadAction<Location>) => {
        const index = state.data.findIndex((item) => item.locationId === action.payload.locationId);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(deleteLocation.fulfilled, (state, action: PayloadAction<string>) => {
        state.data = state.data.filter((item) => item.locationId !== action.payload);
      });
  },
});

export default locationSlice.reducer;
