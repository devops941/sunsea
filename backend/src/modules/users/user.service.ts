import { ApiError } from "../../utils/ApiError";
import { UserResponse } from "../../types/user.types";
import { userRepository } from "./user.repository";
import { UserStatus } from "../../types/auth.types";
import bcrypt from "bcrypt";
export class UserService {
  async getProfile(userId: string): Promise<UserResponse> {
    const user = await userRepository.findUserById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return this.formatUser(user);
  }

  async updateProfile(
    userId: string,
    payload: Partial<Omit<UserResponse, "userId" | "createdOn">>
  ): Promise<UserResponse> {
    const userExists = await userRepository.findUserById(userId);
    if (!userExists) {
      throw new ApiError(404, "User not found");
    }

    // Filter update payload fields
    const updateData: {
      fullName?: string;
      email?: string;
      username?: string;
    } = {};

    if (payload.fullName !== undefined) updateData.fullName = payload.fullName;
    if (payload.email !== undefined) updateData.email = payload.email ?? undefined;
    if (payload.username !== undefined) updateData.username = payload.username;

    const updatedUser = await userRepository.updateUser(userId, updateData);
    return this.formatUser(updatedUser);
  }

  async getAllUsers(): Promise<UserResponse[]> {
    const users = await userRepository.findAllUsers();
    return users.map((user) => this.formatUser(user));
  }

  async getUserById(userId: string): Promise<UserResponse> {
    const user = await userRepository.findUserById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return this.formatUser(user);
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<UserResponse> {
    const userExists = await userRepository.findUserById(userId);
    if (!userExists) {
      throw new ApiError(404, "User not found");
    }

    const status = isActive ? UserStatus.ACTIVE : UserStatus.SUSPENDED;
    const updatedUser = await userRepository.updateUserStatus(userId, status);

    return this.formatUser(updatedUser);
  }

  async create(data: {
  username: string;
  fullName: string;
  email?: string;
  password: string;
  employeeId: number;
  roleId: number;
}): Promise<UserResponse> {

  const existingUser =
    await userRepository.findByUsername(
      data.username
    );

  if (existingUser) {
    throw new ApiError(
      400,
      "Username already exists"
    );
  }

  const passwordHash =
    await bcrypt.hash(
      data.password,
      10
    );

  const user =
    await userRepository.createUser({
      username: data.username,
      fullName: data.fullName,
      email: data.email,
      passwordHash,
      employeeId: BigInt(data.employeeId),
      roleId: data.roleId,
      status: UserStatus.ACTIVE,
      mustChangePw: false,
      createdBy: "ADMIN",
    });

  return this.formatUser(user);
}


  private formatUser(user: any): UserResponse {
    return {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      roleId:
        user.role?.code ??
        (user.roleId !== undefined && user.roleId !== null ? user.roleId.toString() : ""),
      status: user.status as UserStatus,
      lastLoginAt: user.lastLoginAt,
      createdOn: user.createdOn,
    };
  }
}

export const userService = new UserService();
