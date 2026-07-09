export interface UserProfile {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    avatarUrl?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ActivityItem {
    id: number;
    action: string;       // e.g. "Logged in", "Updated shift SHF-002"
    description?: string;
    timestamp: string;
}

export interface UpdateProfileDto {
    name?: string;
    email?: string;
    phone?: string | null;
}

export interface ProfileState {
    user: UserProfile | null;
    activity: ActivityItem[];
    loading: boolean;
    uploading: boolean;
    error: string | null;
}