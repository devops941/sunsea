import { createSlice, createAsyncThunk, type PayloadAction, createSelector } from "@reduxjs/toolkit";
import {
    gstTaxService,
    type GstTax,
    type CreateGstTaxDto,
    type UpdateGstTaxDto,
    type GstTaxQueryParams,
} from "../../services/gstTaxService";
import type { RootState } from "../../app/store";


export interface GstTaxState {
    data: GstTax[];
    selected: GstTax | null;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    loading: boolean;
    error: string | null;
}

const initialState: GstTaxState = {
    data: [],
    selected: null,
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
    loading: false,
    error: null,
};

// ─── Thunks ───────────────────────────────────────────────────

export const fetchGstTaxes = createAsyncThunk(
    "gst/fetchAll",
    async (params: GstTaxQueryParams | undefined, { rejectWithValue }) => {
        try {
            const response = await gstTaxService.fetchAll(params);
            return response;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch GST taxes");
        }
    }
);

export const fetchGstTaxById = createAsyncThunk(
    "gst/fetchById",
    async (id: number | string, { rejectWithValue }) => {
        try {
            const response = await gstTaxService.fetchById(id);
            return response;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch GST tax");
        }
    }
);

export const createGstTax = createAsyncThunk(
    "gst/create",
    async (data: CreateGstTaxDto, { rejectWithValue }) => {
        try {
            const response = await gstTaxService.create(data);
            return response;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to create GST tax");
        }
    }
);

export const updateGstTax = createAsyncThunk(
    "gst/update",
    async ({ id, data }: { id: number | string; data: UpdateGstTaxDto }, { rejectWithValue }) => {
        try {
            const response = await gstTaxService.update(id, data);
            return response;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to update GST tax");
        }
    }
);

export const deleteGstTax = createAsyncThunk(
    "gst/delete",
    async (id: number | string, { rejectWithValue }) => {
        try {
            await gstTaxService.delete(id);
            return id;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to delete GST tax");
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────

const gstTaxSlice = createSlice({
    name: "gst",
    initialState,
    reducers: {
        clearSelectedGstTax: (state) => {
            state.selected = null;
        },
        clearGstTaxError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchAll
            .addCase(fetchGstTaxes.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchGstTaxes.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data;
                state.total = action.payload.total;
                state.page = action.payload.page;
                state.pageSize = action.payload.pageSize;
                state.totalPages = action.payload.totalPages;
            })
            .addCase(fetchGstTaxes.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            // fetchById
            .addCase(fetchGstTaxById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchGstTaxById.fulfilled, (state, action: PayloadAction<GstTax>) => {
                state.loading = false;
                state.selected = action.payload;
            })
            .addCase(fetchGstTaxById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            // create
            .addCase(createGstTax.fulfilled, (state, action: PayloadAction<GstTax>) => {
                state.data.unshift(action.payload);
                state.total += 1;
            })
            .addCase(createGstTax.rejected, (state, action) => {
                state.error = action.payload as string;
            })

            // update
            .addCase(updateGstTax.fulfilled, (state, action: PayloadAction<GstTax>) => {
                const index = state.data.findIndex((t) => String(t.id) === String(action.payload.id));
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
                if (state.selected && String(state.selected.id) === String(action.payload.id)) {
                    state.selected = action.payload;
                }
            })
            .addCase(updateGstTax.rejected, (state, action) => {
                state.error = action.payload as string;
            })

            // delete
            .addCase(deleteGstTax.fulfilled, (state, action: PayloadAction<number | string>) => {
                state.data = state.data.filter((t) => String(t.id) !== String(action.payload));
                state.total = Math.max(0, state.total - 1);
            })
            .addCase(deleteGstTax.rejected, (state, action) => {
                state.error = action.payload as string;
            });
    },
});

export const { clearSelectedGstTax, clearGstTaxError } = gstTaxSlice.actions;
const selectGstTaxData = (state: RootState) => state.gst.data;

export const selectActiveGstTaxes = createSelector(
    [selectGstTaxData],
    (data) => { console.log(data, 'skdjl'); return data.filter((tax) => tax.status === "ACTIVE") }
);

export default gstTaxSlice.reducer;