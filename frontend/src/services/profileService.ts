import apiClient from "../api/apiClient";
import config from "../api/config";

export const profileService = {
    fetchProfile: async () => {
        const response = await apiClient.get(`${config?.employee?.me}`);
        return response.data?.data || response.data;
    },
};


export default profileService;