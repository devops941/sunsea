import { useAppSelector } from "../hooks/reduxHooks";

export const hasPermission = (
    key: string
): boolean => {
    const { permissions } = useAppSelector((state) => state.auth);
    return permissions.includes(key);
};