import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { goodsDispatchService } from "../../services/goodsDispatchService";
import type {
  GoodsDispatch,
  EligibleProductionOrder,
  CreateGoodsDispatchDto,
  GoodsDispatchQueryParams,
  EligibleOrdersQueryParams,
} from "../../services/goodsDispatchService";

interface GoodsDispatchState {
  dispatches: GoodsDispatch[];
  currentDispatch: GoodsDispatch | null;
  eligibleOrders: EligibleProductionOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  loading: boolean;
  error: string | null;
}

const initialState: GoodsDispatchState = {
  dispatches: [],
  currentDispatch: null,
  eligibleOrders: [],
  meta: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  },
  loading: false,
  error: null,
};

export const fetchGoodsDispatches = createAsyncThunk(
  "goodsDispatch/fetchAll",
  async (params: GoodsDispatchQueryParams, { rejectWithValue }) => {
    try {
      const response = await goodsDispatchService.fetchAll(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch dispatches");
    }
  }
);

export const fetchGoodsDispatchById = createAsyncThunk(
  "goodsDispatch/fetchById",
  async (id: number | string, { rejectWithValue }) => {
    try {
      const response = await goodsDispatchService.fetchById(id);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch dispatch details");
    }
  }
);

export const createGoodsDispatch = createAsyncThunk(
  "goodsDispatch/create",
  async (data: CreateGoodsDispatchDto, { rejectWithValue }) => {
    try {
      const response = await goodsDispatchService.create(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to create goods dispatch");
    }
  }
);

export const gateApproveDispatch = createAsyncThunk(
  "goodsDispatch/gateApprove",
  async (
    { id, data }: { id: number | string; data: { action: "APPROVE" | "REJECT"; remarks?: string } },
    { rejectWithValue }
  ) => {
    try {
      const response = await goodsDispatchService.gateApprove(id, data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to process gate approval");
    }
  }
);

export const storeReceiveDispatch = createAsyncThunk(
  "goodsDispatch/storeReceive",
  async (
    {
      id,
      data,
    }: {
      id: number | string;
      data: { action: "APPROVE" | "REJECT"; remarks?: string; receivedItems?: { itemId: number; receivedQty: number }[] };
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await goodsDispatchService.storeReceive(id, data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to process store receipt");
    }
  }
);

export const fetchEligibleOrders = createAsyncThunk(
  "goodsDispatch/fetchEligibleOrders",
  async (params: EligibleOrdersQueryParams, { rejectWithValue }) => {
    try {
      const response = await goodsDispatchService.fetchEligibleOrders(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch eligible orders");
    }
  }
);

const goodsDispatchSlice = createSlice({
  name: "goodsDispatch",
  initialState,
  reducers: {
    clearCurrentDispatch: (state) => {
      state.currentDispatch = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch All
    builder.addCase(fetchGoodsDispatches.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchGoodsDispatches.fulfilled, (state, action) => {
      state.loading = false;
      state.dispatches = action.payload.data || [];
      if (action.payload.meta) {
        state.meta = action.payload.meta;
      }
    });
    builder.addCase(fetchGoodsDispatches.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Fetch By ID
    builder.addCase(fetchGoodsDispatchById.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchGoodsDispatchById.fulfilled, (state, action) => {
      state.loading = false;
      state.currentDispatch = action.payload;
    });
    builder.addCase(fetchGoodsDispatchById.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Fetch Eligible Orders
    builder.addCase(fetchEligibleOrders.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchEligibleOrders.fulfilled, (state, action) => {
      state.loading = false;
      state.eligibleOrders = action.payload;
    });
    builder.addCase(fetchEligibleOrders.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Actions that just need to handle loading/error (state updates handled by re-fetching if needed)
    const handleActionPending = (state: GoodsDispatchState) => {
      state.loading = true;
      state.error = null;
    };
    const handleActionRejected = (state: GoodsDispatchState, action: any) => {
      state.loading = false;
      state.error = action.payload as string;
    };

    builder.addCase(createGoodsDispatch.pending, handleActionPending);
    builder.addCase(createGoodsDispatch.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(createGoodsDispatch.rejected, handleActionRejected);

    builder.addCase(gateApproveDispatch.pending, handleActionPending);
    builder.addCase(gateApproveDispatch.fulfilled, (state, action) => {
      state.loading = false;
      state.currentDispatch = action.payload; // Update current dispatch after approval
    });
    builder.addCase(gateApproveDispatch.rejected, handleActionRejected);

    builder.addCase(storeReceiveDispatch.pending, handleActionPending);
    builder.addCase(storeReceiveDispatch.fulfilled, (state, action) => {
      state.loading = false;
      state.currentDispatch = action.payload; // Update current dispatch after receipt
    });
    builder.addCase(storeReceiveDispatch.rejected, handleActionRejected);
  },
});

export const { clearCurrentDispatch, clearError } = goodsDispatchSlice.actions;
export default goodsDispatchSlice.reducer;
