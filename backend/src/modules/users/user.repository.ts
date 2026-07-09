import { prisma } from "../../config/prisma";
import { UserStatus } from "../../types/auth.types";

export class UserRepository {
  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { userId },
      include: {
        role: {
          select: {
            name: true,
          },
        },
        employee: true,
      },
    });
  }

  async findAllUsers() {
    return prisma.user.findMany({
      include: {
        role: {
          select: {
            name: true,
          },
        },
        employee: true,
      },
      orderBy: {
        createdOn: "desc",
      },
    });
  }

  async findByUsername(username: string) {
    return prisma.user.findUnique({
      where: {
        username,
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
        employee: true,
      },
    });
  }

  async createUser(data: {
    username: string;
    fullName: string;
    email?: string;
    passwordHash: string;
    employeeId: bigint;
    roleId: number;
    status: UserStatus;
    mustChangePw: boolean;
    createdBy: string;
  }) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (existingUser) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    return prisma.user.create({
      data,
      include: {
        role: {
          select: {
            name: true,
          },
        },
        employee: true,
      },
    });
  }

  async updateUser(
    userId: string,
    data: {
      fullName?: string;
      email?: string;
      username?: string;
    }
  ) {
    return prisma.user.update({
      where: { userId },
      data,
      include: {
        role: {
          select: {
            name: true,
          },
        },
        employee: true,
      },
    });
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus
  ) {
    return prisma.user.update({
      where: { userId },
      data: {
        status,
        ...(status === UserStatus.ACTIVE && {
          failedAttempts: 0,
          lockedUntil: null,
        }),
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
        employee: true,
      },
    });
  }
}

export const userRepository =
  new UserRepository();