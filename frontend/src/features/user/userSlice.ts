import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { userService } from "../../services/userService";
import type { User, UserState, CreateUserDto } from "./types";

export const fetchUsers = createAsyncThunk("users/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await userService.fetchAll();
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to fetch users");
  }
});

export const createUser = createAsyncThunk("users/create", async (data: CreateUserDto, { rejectWithValue }) => {
  try {
    return await userService.create(data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to create user");
  }
});

export const toggleUserStatus = createAsyncThunk("users/toggleStatus", async ({ id, isActive }: { id: string; isActive: boolean }, { rejectWithValue }) => {
  try {
    return await userService.updateStatus(id, isActive);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Failed to update user status");
  }
});

const initialState: UserState = {
  users: [],
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: "users",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action: PayloadAction<User[]>) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.users.push(action.payload);
      })
      .addCase(toggleUserStatus.fulfilled, (state, action: PayloadAction<User>) => {
        const index = state.users.findIndex((u) => u.userId === action.payload.userId);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
      });
  },
});

export default userSlice.reducer;
