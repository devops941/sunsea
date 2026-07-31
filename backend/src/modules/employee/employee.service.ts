import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { UserStatus } from "../../types/auth.types";
import { sendEmail } from "../../utils/mailer";
import bcrypt from "bcrypt";

class EmployeeService {
  async create(data: any) {
    const { createLoginAccount, loginAccount, ...employeeData } = data;

    if (employeeData.createdBy && employeeData.createdBy.startsWith("admin_")) {
      employeeData.createdBy = null;
    }

    const createdEmployee = await prisma.$transaction(async (tx) => {
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

      // Check unique identity fields
      if (employeeData.aadhaarNumber) {
        const existing = await tx.employee.findUnique({
          where: { aadhaarNumber: employeeData.aadhaarNumber },
        });
        if (existing) throw new ApiError(400, "Aadhaar number already exists");
      }
      if (employeeData.panNumber) {
        const existing = await tx.employee.findUnique({
          where: { panNumber: employeeData.panNumber },
        });
        if (existing) throw new ApiError(400, "PAN number already exists");
      }
      if (employeeData.pfNumber) {
        const existing = await tx.employee.findUnique({
          where: { pfNumber: employeeData.pfNumber },
        });
        if (existing) throw new ApiError(400, "PF number already exists");
      }
      if (employeeData.uanNumber) {
        const existing = await tx.employee.findUnique({
          where: { uanNumber: employeeData.uanNumber },
        });
        if (existing) throw new ApiError(400, "UAN number already exists");
      }
      if (employeeData.esiNumber) {
        const existing = await tx.employee.findUnique({
          where: { esiNumber: employeeData.esiNumber },
        });
        if (existing) throw new ApiError(400, "ESI number already exists");
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
            mustChangePw: loginAccount.mustChangePw !== undefined ? loginAccount.mustChangePw : true,
            status:
              loginAccount.loginEnabled === false
                ? UserStatus.SUSPENDED
                : loginAccount.status || UserStatus.ACTIVE,
            createdBy: "ADMIN",
          },
        });
      }

      // Return employee with user included
      return tx.employee.findUnique({
        where: { id: employee.id },
        include: { user: { include: { role: true } }, department: true, shift: true },
      });
    });

    // Send welcome email after transaction (non-blocking)
    if (
      createLoginAccount &&
      loginAccount?.loginEnabled !== false &&
      createdEmployee?.email
    ) {
      try {
        await sendEmail({
          to: createdEmployee.email,
          subject: "Welcome to Sunsea — Your Account Has Been Created",
          html: `
            <p>Dear ${createdEmployee.fullName},</p>
            <p>Your employee account has been created successfully.</p>
            <p><strong>Employee Code:</strong> ${createdEmployee.empCode}</p>
            <p><strong>Username:</strong> ${loginAccount.username}</p>
            <p>Please log in and change your password at your earliest convenience.</p>
            <p>Regards,<br/>Sunsea HR Team</p>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send welcome email (non-fatal):", emailErr);
      }
    }

    return createdEmployee;
  }

  async findAll(params: {
    search?: string;
    departmentId?: number;
    page?: number;
    limit?: number;
  }) {
    const { search, departmentId, page = 1, limit = 10 } = params;

    const where: any = {};

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (search) {
      where.OR = [
        { empCode: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
        { department: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: { user: { include: { role: true } }, department: true, shift: true },
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
        user: { include: { role: true } },
        department: true,
        shift: true,
      },
    });

    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    return employee;
  }

  async update(id: bigint, data: any) {
    // Check if employee exists
    await this.findById(id);

    const { createLoginAccount, loginAccount, ...employeeData } = data;

    if (employeeData.updatedBy && employeeData.updatedBy.startsWith("admin_")) {
      employeeData.updatedBy = null;
    }

    return prisma.$transaction(async (tx) => {
      // Check unique identity fields against OTHER employees
      if (employeeData.aadhaarNumber) {
        const existing = await tx.employee.findUnique({ where: { aadhaarNumber: employeeData.aadhaarNumber } });
        if (existing && existing.id !== id) throw new ApiError(400, "Aadhaar number already exists");
      }
      if (employeeData.panNumber) {
        const existing = await tx.employee.findUnique({ where: { panNumber: employeeData.panNumber } });
        if (existing && existing.id !== id) throw new ApiError(400, "PAN number already exists");
      }
      if (employeeData.pfNumber) {
        const existing = await tx.employee.findUnique({ where: { pfNumber: employeeData.pfNumber } });
        if (existing && existing.id !== id) throw new ApiError(400, "PF number already exists");
      }
      if (employeeData.uanNumber) {
        const existing = await tx.employee.findUnique({ where: { uanNumber: employeeData.uanNumber } });
        if (existing && existing.id !== id) throw new ApiError(400, "UAN number already exists");
      }
      if (employeeData.esiNumber) {
        const existing = await tx.employee.findUnique({ where: { esiNumber: employeeData.esiNumber } });
        if (existing && existing.id !== id) throw new ApiError(400, "ESI number already exists");
      }

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
            status: loginAccount.loginEnabled === false
              ? UserStatus.SUSPENDED
              : loginAccount.status || existingUser.status,
          };

          if (loginAccount.mustChangePw !== undefined) {
            updateData.mustChangePw = loginAccount.mustChangePw;
          }

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
              mustChangePw: loginAccount.mustChangePw !== undefined ? loginAccount.mustChangePw : true,
              status:
                loginAccount.loginEnabled === false
                  ? UserStatus.SUSPENDED
                  : loginAccount.status || UserStatus.ACTIVE,
              createdBy: "ADMIN",
            },
          });
        }
      }

      // Return employee with user included
      return tx.employee.findUnique({
        where: { id },
        include: { user: { include: { role: true } }, department: true, shift: true },
      });
    });
  }

  async getNextEmployeeCode() {
    const lastEmployee = await prisma.employee.findFirst({
      orderBy: {
        empCode: "desc",
      },
    });

    if (!lastEmployee) {
      return "EMP001";
    }

    const lastCode = lastEmployee.empCode;
    // BUG-EMP-006 fix: use last (trailing) number group instead of the first
    const match = lastCode.match(/\d+(?!.*\d)/);
    if (!match) {
      return lastCode + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const lastIndex = lastCode.lastIndexOf(numberStr);
    const prefix = lastCode.substring(0, lastIndex);
    const suffix = lastCode.substring(lastIndex + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }

  async delete(id: bigint) {
    await this.findById(id);

    const linkedMachineAssignments = await prisma.machineOperationAssignment.findFirst({ where: { inchargeEmployeeId: id } });
    if (linkedMachineAssignments) throw new ApiError(400, "Cannot delete employee because they are assigned as Incharge on a Machine.");

    const linkedMachineOperators = await prisma.machineAssignmentOperator.findFirst({ where: { employeeId: id } });
    if (linkedMachineOperators) throw new ApiError(400, "Cannot delete employee because they are assigned as an Operator on a Machine.");

    const linkedStores = await prisma.store.findFirst({ where: { inchargeId: id } });
    if (linkedStores) throw new ApiError(400, "Cannot delete employee because they are assigned as Incharge for a Store.");

    const linkedCustomers = await prisma.customer.findFirst({ where: { collectionAgentId: id } });
    if (linkedCustomers) throw new ApiError(400, "Cannot delete employee because they are assigned as a Collection Agent for a Customer.");

    // BUG-EMP-008 fix: explicitly delete linked user account first to prevent orphaned records
    return prisma.$transaction(async (tx) => {
      const linkedUser = await tx.user.findUnique({ where: { employeeId: id } });
      if (linkedUser) {
        await tx.user.delete({ where: { userId: linkedUser.userId } });
      }
      return tx.employee.delete({ where: { id } });
    });
  }
}

export default new EmployeeService();
