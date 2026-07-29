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
        "Bypass-Tunnel-Reminder": "true", // Bypasses localtunnel warning page
        "ngrok-skip-browser-warning": "true", // Bypasses ngrok warning page
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

// Response Interceptor: Handle 401 errors by clearing session
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        // If 401 Unauthorized, it means the token is expired or invalid
        if (error.response?.status === 401 && !error.config.url?.includes("/auth/login")) {
            // Clear the invalid token and redirect to login
            if (storeRef) {
                const { clearUser } = await import("../features/auth/authSlice");
                storeRef.dispatch(clearUser());
            }
            
            // Clear stored tokens
            localStorage.removeItem('accessToken');
            sessionStorage.removeItem('accessToken');
            
            // Optionally redirect to login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
