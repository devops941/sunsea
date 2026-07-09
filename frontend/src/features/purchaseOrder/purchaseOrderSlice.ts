import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { purchaseOrderService } from "../../services/purchaseOrderService";
import type {
    PurchaseOrder,
    PurchaseOrderState,
    CreatePurchaseOrderDto,
    UpdatePurchaseOrderDto,
} from "./types";

export const fetchPurchaseOrders = createAsyncThunk(
    "purchaseOrders/fetchAll",
    async (_, { rejectWithValue }) => {
        try {
            return await purchaseOrderService.fetchAll();
        } catch (error: any) {
            return rejectWithValue(
                error.response?.data?.message || "Failed to fetch purchase orders"
            );
        }
    }
);

export const createPurchaseOrder = createAsyncThunk(
    "purchaseOrders/create",
    async (data: CreatePurchaseOrderDto, { rejectWithValue }) => {
        try {
            return await purchaseOrderService.create(data);
        } catch (error: any) {
            return rejectWithValue(
                error.response?.data?.message || "Failed to create purchase order"
            );
        }
    }
);

export const updatePurchaseOrder = createAsyncThunk(
    "purchaseOrders/update",
    async ({ id, data }: { id: string; data: UpdatePurchaseOrderDto }, { rejectWithValue }) => {
        try {
            return await purchaseOrderService.update(id, data);
        } catch (error: any) {
            return rejectWithValue(
                error.response?.data?.message || "Failed to update purchase order"
            );
        }
    }
);

export const deletePurchaseOrder = createAsyncThunk(
    "purchaseOrders/delete",
    async (id: string, { rejectWithValue }) => {
        try {
            await purchaseOrderService.delete(id);
            return id;
        } catch (error: any) {
            return rejectWithValue(
                error.response?.data?.message || "Failed to delete purchase order"
            );
        }
    }
);

const initialState: PurchaseOrderState = {
    purchaseOrders: [],
    loading: false,
    error: null,
};

const purchaseOrderSlice = createSlice({
    name: "purchaseOrders",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // ── Fetch All ──────────────────────────────────────────────────────────
            .addCase(fetchPurchaseOrders.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPurchaseOrders.fulfilled, (state, action: PayloadAction<PurchaseOrder[]>) => {
                state.loading = false;
                state.purchaseOrders = action.payload;
            })
            .addCase(fetchPurchaseOrders.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            // ── Create ─────────────────────────────────────────────────────────────
            .addCase(createPurchaseOrder.fulfilled, (state, action: PayloadAction<PurchaseOrder>) => {
                state.purchaseOrders.unshift(action.payload); // latest first
            })

            // ── Update ─────────────────────────────────────────────────────────────
            .addCase(updatePurchaseOrder.fulfilled, (state, action: PayloadAction<PurchaseOrder>) => {
                const index = state.purchaseOrders.findIndex(
                    (po) => po.id === action.payload.id
                );
                if (index !== -1) {
                    state.purchaseOrders[index] = action.payload;
                }
            })

            // ── Delete ─────────────────────────────────────────────────────────────
            .addCase(deletePurchaseOrder.fulfilled, (state, action: PayloadAction<string>) => {
                state.purchaseOrders = state.purchaseOrders.filter(
                    (po) => po.id !== action.payload
                );
            });
    },
});

export default purchaseOrderSlice.reducer;