import type { UserStatus } from "../auth/types";

export interface User {
    userId: string;
    username: string;
    fullName: string;
    email: string | null;
    roleId: string | null;
    status: UserStatus;
    isSuperAdmin?: boolean;
    lastLoginAt: string | null;
    createdOn: string;
}

export interface CreateUserDto {
    username: string;
    fullName: string;
    email?: string;
    password?: string;
    employeeId: number;
    roleId: number;
}

export interface UserState {
    users: User[];
    loading: boolean;
    error: string | null;
}
