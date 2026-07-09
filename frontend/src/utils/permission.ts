import { useAppSelector } from "../hooks/reduxHooks";

export const hasPermission = (
    key: string
): boolean => {
    const { user, permissions } = useAppSelector((state) => state.auth);
    if (user?.isSuperAdmin) return true;
    if (user?.roleId === "ROLE_ADMIN") return true;
    return permissions.includes(key);
};