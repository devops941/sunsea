import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { companyService } from "../../services/companyService";
import type { Company, CompanyState, UpdateCompanyDto } from "./types";

export const fetchCompany = createAsyncThunk(
  "company/fetch",
  async (_, { rejectWithValue }) => {
    try {
      return await companyService.getCompany();
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch company details");
    }
  }
);

export const updateCompany = createAsyncThunk(
  "company/update",
  async ({ id, data }: { id: string; data: UpdateCompanyDto }, { rejectWithValue }) => {
    try {
      return await companyService.updateCompany(id, data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to update company details");
    }
  }
);

const initialState: CompanyState = {
  data: null,
  loading: false,
  error: null,
};

const companySlice = createSlice({
  name: "company",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompany.fulfilled, (state, action: PayloadAction<Company>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCompany.fulfilled, (state, action: PayloadAction<Company>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(updateCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default companySlice.reducer;
