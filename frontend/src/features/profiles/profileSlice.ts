import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { profileService } from "../../services/profileService";

export const fetchProfile = createAsyncThunk(
    "profile/fetchProfile",
    async (_, { rejectWithValue }) => {
        try {
            return await profileService.fetchProfile();
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Failed to fetch profile");
        }
    }
);

const profileSlice = createSlice({
    name: "profile",
    initialState: { employee: null as any, loading: false, error: null as string | null },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchProfile.pending, (state) => { state.loading = true; })
            .addCase(fetchProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.employee = action.payload;
            })
            .addCase(fetchProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default profileSlice.reducer;