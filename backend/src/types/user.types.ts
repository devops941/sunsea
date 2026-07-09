import { UserStatus } from "./auth.types";

export interface UserResponse {
  userId: string;
  fullName: string;
  email: string | null;
  username: string;
  roleId: string;
  status: UserStatus;
  lastLoginAt?: Date | null;
  createdOn: Date;
}