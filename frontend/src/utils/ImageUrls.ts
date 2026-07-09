export const getImageUrl = (path: string | null) => {
    if (!path) return "";

    // already usable URLs (http, https, blob)
    if (
        path.startsWith("http") ||
        path.startsWith("blob:")
    ) {
        return path;
    }

    return `${import.meta.env.VITE_IMAGE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};