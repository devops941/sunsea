/**
 * Utility to parse and format location address string or JSON.
 */
export const formatLocationAddress = (locDesc?: string | null): string => {
    if (!locDesc) return "";
    try {
        const parsed = JSON.parse(locDesc);
        if (typeof parsed === "object" && parsed !== null) {
            if (parsed.formatted) return parsed.formatted;
            return [parsed.addressLine, parsed.city, parsed.state, parsed.country, parsed.zipcode]
                .filter(Boolean)
                .join(", ");
        }
    } catch {
        return locDesc;
    }
    return locDesc;
};
