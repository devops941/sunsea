import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { finishedGoodsStockService } from "../../services/finishedGoodsStockService";
import type { FinishedGoodsStockState, FinishedGoodsStock } from "./types";

const initialState: FinishedGoodsStockState = {
    data: [],
    loading: false,
    error: null,
};

// Fetch all stocks
export const fetchFinishedGoodsStocks = createAsyncThunk(
    "finishedGoodsStock/fetchAll",
    async (params: any | undefined, { rejectWithValue }) => {
        try {
            return await finishedGoodsStockService.fetchAll(params);
        } catch (error: any) {
            return rejectWithValue(
                error.response?.data?.message || "Failed to fetch finished goods stocks"
            );
        }
    }
);

const finishedGoodsStockSlice = createSlice({
    name: "finishedGoodsStock",
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchAll
            .addCase(fetchFinishedGoodsStocks.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(
                fetchFinishedGoodsStocks.fulfilled,
                (state, action: PayloadAction<FinishedGoodsStock[]>) => {
                    state.loading = false;
                    state.data = action.payload;
                }
            )
            .addCase(fetchFinishedGoodsStocks.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearError } = finishedGoodsStockSlice.actions;
export default finishedGoodsStockSlice.reducer;
