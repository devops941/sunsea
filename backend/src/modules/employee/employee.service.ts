import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";
import { UserStatus } from "../../types/auth.types";
import bcrypt from "bcrypt";

class EmployeeService {
  async create(data: any) {
    const { createLoginAccount, loginAccount, ...employeeData } = data;

    return prisma.$transaction(async (tx) => {

      // Check if email already exists
      if (employeeData.email) {
        const existingEmail = await tx.employee.findUnique({
          where: { email: employeeData.email },
        });
        if (existingEmail) {
          throw new ApiError(400, "Email already exists");
        }
      }
      // Check if employee code already exists
      if (employeeData.empCode) {
        const existingCode = await tx.employee.findUnique({
          where: { empCode: employeeData.empCode },
        });
        if (existingCode) {
          throw new ApiError(400, "Employee code already exists");
        }
      }

      // Create employee
      const employee = await tx.employee.create({
        data: employeeData,
      });

      // Create login account if requested
      if (createLoginAccount && loginAccount) {
        if (!loginAccount.password) {
          throw new ApiError(400, "Password is required for creating a login account");
        }

        // Check if username already exists
        const existingUser = await tx.user.findUnique({
          where: { username: loginAccount.username },
        });
        if (existingUser) {
          throw new ApiError(400, "Username already exists");
        }

        const passwordHash = await bcrypt.hash(loginAccount.password, 10);
        await tx.user.create({
          data: {
            username: loginAccount.username,
            fullName: employeeData.fullName,
            email: employeeData.email || null,
            passwordHash,
            employeeId: employee.id,
            roleId: Number(loginAccount.roleId),
            status: loginAccount.status || UserStatus.ACTIVE,
            createdBy: "ADMIN",
          },
        });
      }

      // Return employee with user included
      return tx.employee.findUnique({
        where: { id: employee.id },
        include: { user: true, department: true, designation: true },
      });
    });
  }

  // async findAll() {
  //   return prisma.employee.findMany({
  //     include: {
  //       user: true,
  //       department: true,
  //       designation: true,
  //     },
  //     orderBy: {
  //       createdAt: "desc",
  //     },
  //   });
  // }

  async findAll(params: {
    search?: string;
    designationId?: number;   // was bigint, now number
    page?: number;
    limit?: number;
  }) {
    const { search, designationId, page = 1, limit = 10 } = params;

    const where: any = {};

    if (designationId) {
      where.designationId = designationId;
    }

    if (search) {
      where.OR = [
        { empCode: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
        { department: { name: { contains: search, mode: "insensitive" } } },
        { designation: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: { user: true, department: true, designation: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      employees,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: bigint) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: true,
        department: true,
        designation: true,
      },
    });

    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    return employee;
  }

  async update(id: bigint, data: any) {
    // Check if employee exists
    const employeeExists = await this.findById(id);

    const { createLoginAccount, loginAccount, ...employeeData } = data;

    return prisma.$transaction(async (tx) => {
      // Update employee
      const employee = await tx.employee.update({
        where: { id },
        data: employeeData,
      });

      if (createLoginAccount && loginAccount) {
        // Check if there is an existing linked user
        const existingUser = await tx.user.findUnique({
          where: { employeeId: id },
        });

        if (existingUser) {
          // Update existing user account
          const updateData: any = {
            username: loginAccount.username,
            fullName: employeeData.fullName !== undefined ? employeeData.fullName : existingUser.fullName,
            email: employeeData.email !== undefined ? (employeeData.email || null) : existingUser.email,
            roleId: Number(loginAccount.roleId),
            status: loginAccount.status || existingUser.status,
          };

          if (loginAccount.password) {
            updateData.passwordHash = await bcrypt.hash(loginAccount.password, 10);
          }

          // Check if username is being changed and if new username already exists
          if (loginAccount.username !== existingUser.username) {
            const usernameTaken = await tx.user.findUnique({
              where: { username: loginAccount.username },
            });
            if (usernameTaken) {
              throw new ApiError(400, "Username already exists");
            }
          }

          await tx.user.update({
            where: { userId: existingUser.userId },
            data: updateData,
          });
        } else {
          // Create new user account for existing employee
          if (!loginAccount.password) {
            throw new ApiError(400, "Password is required for creating a login account");
          }

          const usernameTaken = await tx.user.findUnique({
            where: { username: loginAccount.username },
          });
          if (usernameTaken) {
            throw new ApiError(400, "Username already exists");
          }

          const passwordHash = await bcrypt.hash(loginAccount.password, 10);
          await tx.user.create({
            data: {
              username: loginAccount.username,
              fullName: employeeData.fullName || employee.fullName,
              email: employeeData.email !== undefined ? (employeeData.email || null) : employee.email,
              passwordHash,
              employeeId: id,
              roleId: Number(loginAccount.roleId),
              status: loginAccount.status || UserStatus.ACTIVE,
              createdBy: "ADMIN",
            },
          });
        }
      }

      // Return employee with user included
      return tx.employee.findUnique({
        where: { id },
        include: { user: true, department: true, designation: true },
      });
    });
  }

  async getNextEmployeeCode() {
    const lastEmployee = await prisma.employee.findFirst({
      orderBy: {
        id: "desc",
      },
    });

    if (!lastEmployee) {
      return "EMP001";
    }

    const lastCode = lastEmployee.empCode;
    const match = lastCode.match(/\d+/);
    if (!match) {
      return lastCode + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const prefix = lastCode.substring(0, lastCode.indexOf(numberStr));
    const suffix = lastCode.substring(lastCode.indexOf(numberStr) + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }

  async delete(id: bigint) {
    await this.findById(id);

    return executeDeleteWithValidation(
      () => prisma.employee.delete({ where: { id } }),
      "Employee"
    );
  }
}


export default new EmployeeService();