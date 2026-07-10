import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import authService from "../../services/authService";
import type { AuthState, UserResponseDto, LoginDto, ProfileResponseDto } from "./types";

const decodePermissions = (token: string): string[] => {
    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        const decoded = JSON.parse(jsonPayload);
        return decoded.permissions || [];
    } catch {
        return [];
    }
};

const initialState: AuthState = {
    user: null,
    permissions: [],
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
};

// Async Thunks
export const loginUser = createAsyncThunk(
    "auth/login",
    async (credentials: LoginDto, thunkAPI) => {
        try {
            const response = await authService.login(credentials);
            const { accessToken, user } = response.data || {};

            // Set access token first so subsequent requests (like get profile) carry it
            thunkAPI.dispatch(setAccessToken(accessToken));
            return user as UserResponseDto;
        } catch (err: any) {
            const message = err.response?.data?.message || "Login failed";
            return thunkAPI.rejectWithValue(message);
        }
    }
);

export const getCurrentUser = createAsyncThunk(
    "auth/getCurrentUser",
    async (_, thunkAPI) => {
        try {
            const response = await authService.getCurrentUser();
            return response.data as ProfileResponseDto;
        } catch (err: any) {
            const message = err.response?.data?.message || "Failed to fetch user profile";
            return thunkAPI.rejectWithValue(message);
        }
    }
);

export const logoutUser = createAsyncThunk(
    "auth/logout",
    async (_, thunkAPI) => {
        try {
            await authService.logout();
        } catch (err) {
            console.error("Logout request failed:", err);
        } finally {
            thunkAPI.dispatch(clearUser());
        }
    }
);

export const initializeAuth = createAsyncThunk(
    "auth/initialize",
    async (_, thunkAPI) => {
        try {
            // Check if access token exists in localStorage or sessionStorage
            const storedToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
            
            if (storedToken) {
                // Set the token first
                thunkAPI.dispatch(setAccessToken(storedToken));
                
                // Verify the token by fetching current user
                try {
                    const userResponse = await authService.getCurrentUser();
                    return userResponse.data as ProfileResponseDto;
                } catch (error) {
                    // Token is invalid or expired, clear it
                    localStorage.removeItem('accessToken');
                    sessionStorage.removeItem('accessToken');
                    return null;
                }
            }
            
            return null;
        } catch {
            return null;
        }
    }
);

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setAccessToken: (state, action: PayloadAction<string>) => {
            state.accessToken = action.payload;
            state.permissions = action.payload ? decodePermissions(action.payload) : [];
            
            // Store token in localStorage for persistence across page refreshes
            if (action.payload) {
                localStorage.setItem('accessToken', action.payload);
            } else {
                localStorage.removeItem('accessToken');
            }
        },
        clearUser: (state) => {
            state.user = null;
            state.accessToken = null;
            state.permissions = [];
            state.isAuthenticated = false;
            
            // Clear stored token
            localStorage.removeItem('accessToken');
            sessionStorage.removeItem('accessToken');
        },
    },
    extraReducers: (builder) => {
        // Login thunk
        builder.addCase(loginUser.pending, (state) => {
            state.isLoading = true;
        });
        builder.addCase(loginUser.fulfilled, (state, action: PayloadAction<UserResponseDto>) => {
            state.user = action.payload;
            state.isAuthenticated = true;
            state.isLoading = false;
        });
        builder.addCase(loginUser.rejected, (state) => {
            state.isLoading = false;
            state.user = null;
            state.accessToken = null;
            state.permissions = [];
            state.isAuthenticated = false;
        });

        // Get Current User thunk
        builder.addCase(getCurrentUser.fulfilled, (state, action: PayloadAction<ProfileResponseDto>) => {
            state.user = action.payload.user;
            state.permissions = action.payload.permissions;
            state.isAuthenticated = true;
        });
        builder.addCase(getCurrentUser.rejected, (state) => {
            state.user = null;
            state.accessToken = null;
            state.permissions = [];
            state.isAuthenticated = false;
        });

        // Initialize thunk
        builder.addCase(initializeAuth.pending, (state) => {
            state.isLoading = true;
        });
        builder.addCase(initializeAuth.fulfilled, (state, action: PayloadAction<ProfileResponseDto | null>) => {
            if (action.payload) {
                state.user = action.payload.user;
                state.permissions = action.payload.permissions;
                state.isAuthenticated = true;
            }
            state.isLoading = false;
            state.isInitialized = true;
        });
        builder.addCase(initializeAuth.rejected, (state) => {
            state.isLoading = false;
            state.isInitialized = true;
            state.user = null;
            state.accessToken = null;
            state.permissions = [];
            state.isAuthenticated = false;
        });
    },
});

export const { setAccessToken, clearUser } = authSlice.actions;
export default authSlice.reducer;