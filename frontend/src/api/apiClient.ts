import axios from "axios";

let storeRef: any;

export const injectStore = (_store: any) => {
    storeRef = _store;
};

const apiUrl = import.meta.env.VITE_API_URL;


export const apiClient = axios.create({
    baseURL: apiUrl,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request Interceptor: Attach bearer token from Redux state dynamically
apiClient.interceptors.request.use(
    (config) => {
        if (storeRef) {
            const token = storeRef.getState().auth.accessToken;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        const isFormData = config.data instanceof FormData;

        if (isFormData) {
            // Let browser set multipart boundary automatically
            delete config.headers["Content-Type"];
        } else {
            config.headers["Content-Type"] = "application/json";
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Silent refresh on 401 error
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes("/auth/login") &&
            !originalRequest.url?.includes("/auth/refresh-token")
        ) {
            originalRequest._retry = true;
            try {
                // Call public axios since we don't want to use apiClient interceptor recursive loops
                const response = await axios.post(
                    apiUrl + "/auth/refresh-token",
                    {},
                    { withCredentials: true }
                );

                const { accessToken } = response.data?.data || {};

                if (accessToken && storeRef) {
                    const { setAccessToken } = await import("../features/auth/authSlice");
                    storeRef.dispatch(setAccessToken(accessToken));

                    // Update authorization header and retry original request
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return apiClient(originalRequest);
                }
            } catch (refreshError) {
                // Silent refresh failed -> cookie expired or invalid. Force logout.
                if (storeRef) {
                    const { clearUser } = await import("../features/auth/authSlice");
                    storeRef.dispatch(clearUser());
                }
                return Promise.reject(new Error("Session expired. Please log in again."));
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
