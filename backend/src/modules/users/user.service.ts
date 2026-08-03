import { ApiError } from "../../utils/ApiError";
import { UserResponse } from "../../types/user.types";
import { userRepository } from "./user.repository";
import { UserStatus } from "../../types/auth.types";
import employeeService from "../employee/employee.service";
import { prisma } from "../../config/prisma";
import bcrypt from "bcrypt";
import { sendEmail } from "../../utils/mailer";
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
  employeeId?: number | null;
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

  let finalEmployeeId: bigint;
  if (data.employeeId) {
    finalEmployeeId = BigInt(data.employeeId);
  } else {
    const empCode = await employeeService.getNextEmployeeCode();
    const employee = await prisma.employee.create({
      data: {
        empCode,
        fullName: data.fullName,
        email: data.email,
        status: "active",
      }
    });
    finalEmployeeId = employee.id;
  }

  const user =
    await userRepository.createUser({
      username: data.username,
      fullName: data.fullName,
      email: data.email,
      passwordHash,
      employeeId: finalEmployeeId,
      roleId: data.roleId,
      status: UserStatus.ACTIVE,
      mustChangePw: false,
      createdBy: "ADMIN",
    });

  if (data.email) {
    try {
      await sendEmail({
        to: data.email,
        subject: "Welcome to Sunsea — Your User Account Has Been Created",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #1a56db;">Welcome to Sunsea!</h2>
            <p>Dear <strong>${data.fullName}</strong>,</p>
            <p>Your user login account has been created successfully. Below are your login credentials:</p>
            <table style="border-collapse: collapse; margin: 15px 0; background: #f9fafb; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; width: 100%; max-width: 500px;">
              <tr><td style="padding: 8px; font-weight: bold; width: 140px; color: #4b5563;">Username:</td><td style="padding: 8px;">${data.username}</td></tr>
              ${data.password ? `<tr><td style="padding: 8px; font-weight: bold; color: #4b5563;">Password:</td><td style="padding: 8px;">${data.password}</td></tr>` : ''}
            </table>
            <p>Please log in to the Sunsea portal and change your password at your earliest convenience.</p>
            <br/>
            <p>Regards,<br/><strong>Sunsea Admin Team</strong></p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send welcome email (non-fatal):", emailErr);
    }
  }

  return this.formatUser(user);
}


  private formatUser(user: any): UserResponse {
    return {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      roleId:
        user.role?.name ??
        (user.roleId !== undefined && user.roleId !== null ? user.roleId.toString() : ""),
      status: user.status as UserStatus,
      lastLoginAt: user.lastLoginAt,
      createdOn: user.createdOn,
    };
  }
}

export const userService = new UserService();
