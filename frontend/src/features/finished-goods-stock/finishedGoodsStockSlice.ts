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
    async (params: any = {}, { rejectWithValue }) => {
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
        finishedGoodsStockCreated: (state, action) => {
            if (Array.isArray(state.data)) {
                const exists = state.data.find(
                    (m) => String(m.storeId) === String(action.payload.storeId) && String(m.productItemId) === String(action.payload.productItemId)
                );
                if (!exists) {
                    state.data.push(action.payload);
                }
            }
        },
        finishedGoodsStockUpdated: (state, action) => {
            if (Array.isArray(state.data)) {
                const index = state.data.findIndex(
                    (m) => String(m.storeId) === String(action.payload.storeId) && String(m.productItemId) === String(action.payload.productItemId)
                );
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            }
        },
        finishedGoodsStockDeleted: (state, action) => {
            if (Array.isArray(state.data)) {
                state.data = state.data.filter(
                    (m) => !(String(m.storeId) === String(action.payload.storeId) && String(m.productItemId) === String(action.payload.productItemId))
                );
            }
        }
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
                (state, action: PayloadAction<any>) => {
                    state.loading = false;
                    if (action.payload && typeof action.payload === "object" && "data" in action.payload) {
                        state.data = action.payload.data || [];
                        state.total = action.payload.total || 0;
                    } else {
                        state.data = action.payload || [];
                        state.total = Array.isArray(action.payload) ? action.payload.length : 0;
                    }
                }
            )
            .addCase(fetchFinishedGoodsStocks.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearError, finishedGoodsStockCreated, finishedGoodsStockUpdated, finishedGoodsStockDeleted } = finishedGoodsStockSlice.actions;
export default finishedGoodsStockSlice.reducer;
