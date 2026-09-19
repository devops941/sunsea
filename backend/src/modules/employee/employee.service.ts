import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { UserStatus } from "../../types/auth.types";
import { sendEmail } from "../../utils/mailer";
import { generateWelcomeEmailHtml } from "../../templates/welcomeEmailTemplate";
import bcrypt from "bcrypt";
import { logAudit } from "../../utils/auditLog.util";

class EmployeeService {
  async create(data: any) {
    const { createLoginAccount, loginAccount, da, hra, otherAllowance, cashInHand, userId, ...employeeData } = data;

    const actualUserId = userId || employeeData.createdBy;
    const initialEditHistory = actualUserId
      ? [{ updatedBy: actualUserId, updatedAt: new Date().toISOString() }]
      : [];

    const dbCreatedBy = (actualUserId && !actualUserId.startsWith("admin_")) ? actualUserId : null;
    employeeData.createdBy = dbCreatedBy;
    employeeData.updatedBy = dbCreatedBy;
    employeeData.editHistory = initialEditHistory.length > 0 ? initialEditHistory : undefined;

    const createdEmployee = (await prisma.$transaction(async (tx) => {
      // Check if email already exists (skip for drafts)
      if (employeeData.email && employeeData.status !== "draft") {
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
          // If saving a draft and existing is also a draft, update it instead
          if (employeeData.status === "draft" && existingCode.status === "draft") {
            await tx.employee.update({
              where: { id: existingCode.id },
              data: employeeData,
            });
            return tx.employee.findUnique({
              where: { id: existingCode.id },
              include: { user: { include: { role: true } }, role: true, department: true, shift: true, payrollConfig: true },
            });
          }
          // If saving a real employee and existing is a draft, allow (draft will be overwritten)
          if (employeeData.status !== "draft" && existingCode.status === "draft") {
            await tx.employee.delete({ where: { id: existingCode.id } });
          } else {
            throw new ApiError(400, "Employee code already exists");
          }
        }
      }

      // Check unique identity fields (skip for drafts — validated on final save)
      if (employeeData.status !== "draft") {
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
      }

      // Track initial status change timestamp
      employeeData.statusChangedAt = new Date();

      // Create employee
      const employee = await tx.employee.create({
        data: employeeData,
      });

      // Upsert payroll config for the created employee
      await tx.employeePayrollConfig.upsert({
        where: { employeeId: employee.id },
        create: {
          employeeId: employee.id,
          salaryType: employeeData.salaryType ? String(employeeData.salaryType).toUpperCase() : "MONTHLY",
          monthlySalary: Number(employeeData.grossSalary || 0),
          basicSalary: Number(employeeData.basicSalary || 0),
          da: Number(da || 0),
          hra: Number(hra || 0),
          otherAllowance: Number(otherAllowance || 0),
          cashInHand: Number(cashInHand || 0),
          bankAccount: employeeData.accountNumber || null,
          ifscCode: employeeData.ifscCode || null,
          bankName: employeeData.bankName || null,
          pfNumber: employeeData.pfNumber || null,
          esiNumber: employeeData.esiNumber || null,
          paymentMode: employeeData.paymentMode ? String(employeeData.paymentMode).toUpperCase() : "CASH",
        },
        update: {
          salaryType: employeeData.salaryType ? String(employeeData.salaryType).toUpperCase() : "MONTHLY",
          monthlySalary: Number(employeeData.grossSalary || 0),
          basicSalary: Number(employeeData.basicSalary || 0),
          da: Number(da || 0),
          hra: Number(hra || 0),
          otherAllowance: Number(otherAllowance || 0),
          cashInHand: Number(cashInHand || 0),
          bankAccount: employeeData.accountNumber || null,
          ifscCode: employeeData.ifscCode || null,
          bankName: employeeData.bankName || null,
          pfNumber: employeeData.pfNumber || null,
          esiNumber: employeeData.esiNumber || null,
          paymentMode: employeeData.paymentMode ? String(employeeData.paymentMode).toUpperCase() : "CASH",
        },
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
            fullName: employeeData.fullName || "",
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

      // Return employee with user & role included
      return tx.employee.findUnique({
        where: { id: employee.id },
        include: { user: { include: { role: true } }, role: true, department: true, shift: true },
      });
    }))!;

    // Send welcome email after transaction (non-blocking)
    const recipientEmail = createdEmployee?.email || loginAccount?.email;
    if (
      createLoginAccount &&
      loginAccount?.loginEnabled !== false &&
      recipientEmail
    ) {
      try {
        await sendEmail({
          to: recipientEmail,
          subject: "Welcome to Sunsea — Your Account Has Been Created",
          html: generateWelcomeEmailHtml({
            fullName: createdEmployee.fullName || "",
            empCode: createdEmployee.empCode,
            username: loginAccount.username,
            password: loginAccount.password,
            title: "Welcome to Sunsea!",
            subtitle: "Your official employee account and login credentials are ready.",
            teamName: "Sunsea HR & IT Team",
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send welcome email (non-fatal):", emailErr);
      }
    }

    if (createdEmployee?.empCode) {
      await logAudit("Employee", createdEmployee.empCode, "CREATE", actualUserId, createdEmployee.fullName || createdEmployee.empCode);
    }

    return createdEmployee;
  }

  async findAll(params: {
    search?: string;
    departmentId?: number;
    roleId?: number;
    status?: string;
    includeDrafts?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { search, departmentId, roleId, status, includeDrafts, page = 1, limit = 10 } = params;

    const where: any = {};

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    if (status) {
      where.status = status;
    } else if (!includeDrafts) {
      // Exclude draft employees by default — only show when explicitly filtered
      where.status = { not: "draft" };
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
        include: { user: { include: { role: true } }, role: true, department: true, shift: true, payrollConfig: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    const mappedEmployees = employees.map((emp: any) => {
      const e = { ...emp };
      if (emp.payrollConfig) {
        if (!e.basicSalary && emp.payrollConfig.basicSalary) e.basicSalary = emp.payrollConfig.basicSalary;
        if (!e.da && emp.payrollConfig.da) e.da = emp.payrollConfig.da;
        if (!e.hra && emp.payrollConfig.hra) e.hra = emp.payrollConfig.hra;
        if (!e.otherAllowance && emp.payrollConfig.otherAllowance) e.otherAllowance = emp.payrollConfig.otherAllowance;
      }
      return e;
    });

    return {
      employees: mappedEmployees,
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
        role: true,
        department: true,
        shift: true,
        payrollConfig: true,
      },
    });

    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    const empObj: any = { ...employee };
    if (employee.payrollConfig) {
      if ((empObj.basicSalary === null || empObj.basicSalary === undefined || Number(empObj.basicSalary) === 0) && employee.payrollConfig.basicSalary) {
        empObj.basicSalary = employee.payrollConfig.basicSalary;
      }
      if ((empObj.da === null || empObj.da === undefined) && employee.payrollConfig.da) {
        empObj.da = employee.payrollConfig.da;
      }
      if ((empObj.hra === null || empObj.hra === undefined) && employee.payrollConfig.hra) {
        empObj.hra = employee.payrollConfig.hra;
      }
      if ((empObj.otherAllowance === null || empObj.otherAllowance === undefined) && employee.payrollConfig.otherAllowance) {
        empObj.otherAllowance = employee.payrollConfig.otherAllowance;
      }
    }

    // Resolve Audit Information
    let rawHistory = (employee as any).editHistory;
    if (typeof rawHistory === "string") {
      try {
        rawHistory = JSON.parse(rawHistory);
      } catch (e) {
        rawHistory = [];
      }
    }

    const initialCreator = Array.isArray(rawHistory) && rawHistory.length > 0 ? rawHistory[0]?.updatedBy : (employee.createdBy || null);

    let createdUserName = "Unknown User";
    let createdUserRole = "Unknown Role";

    if (initialCreator) {
      if (initialCreator.startsWith("admin_")) {
        const adminId = BigInt(initialCreator.replace("admin_", ""));
        const admin = await prisma.admin.findUnique({
          where: { id: adminId },
          select: { username: true, fullName: true, role: { select: { name: true } } },
        });
        if (admin) {
          createdUserName = admin.fullName || admin.username;
          createdUserRole = admin.role?.name || "Super Admin";
        } else {
          createdUserName = initialCreator;
        }
      } else {
        const user = await prisma.user.findUnique({
          where: { userId: initialCreator },
          select: { username: true, fullName: true, role: { select: { name: true } } },
        });
        if (user) {
          createdUserName = user.fullName || user.username;
          createdUserRole = user.role?.name || "User";
        } else {
          createdUserName = initialCreator;
        }
      }
    }

    // Resolve names for editHistory
    let enrichedEditHistory: any[] = [];
    if (Array.isArray(rawHistory)) {
      enrichedEditHistory = await Promise.all(
        rawHistory.map(async (edit: any) => {
          let name = edit.updatedByName || edit.updatedBy || "Unknown User";
          if (edit.updatedBy) {
            if (edit.updatedBy.startsWith("admin_")) {
              const adminId = BigInt(edit.updatedBy.replace("admin_", ""));
              const admin = await prisma.admin.findUnique({
                where: { id: adminId },
                select: { username: true, fullName: true },
              });
              if (admin) name = admin.fullName || admin.username;
            } else {
              const user = await prisma.user.findUnique({
                where: { userId: edit.updatedBy },
                select: { username: true, fullName: true },
              });
              if (user) name = user.fullName || user.username;
            }
          }
          return { ...edit, updatedByName: name };
        })
      );
    }

    return {
      ...empObj,
      createdUserName,
      createdUserRole,
      editHistory: enrichedEditHistory,
    };
  }

  async update(id: bigint, data: any) {
    // Check if employee exists
    const currentEmployee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!currentEmployee) {
      throw new ApiError(404, "Employee not found");
    }

    const { createLoginAccount, loginAccount, da, hra, otherAllowance, cashInHand, userId, ...employeeData } = data;

    let newEditHistory: any[] = [];
    let rawHistory = (currentEmployee as any).editHistory;
    if (typeof rawHistory === "string") {
      try {
        rawHistory = JSON.parse(rawHistory);
      } catch (e) {
        rawHistory = [];
      }
    }

    if (Array.isArray(rawHistory) && rawHistory.length > 0) {
      newEditHistory = rawHistory.map((item: any) => ({
        updatedBy: item.updatedBy,
        updatedAt: item.updatedAt,
      }));
    } else if (currentEmployee.createdBy || currentEmployee.createdAt) {
      newEditHistory.push({
        updatedBy: currentEmployee.createdBy || "System",
        updatedAt: currentEmployee.createdAt ? new Date(currentEmployee.createdAt).toISOString() : new Date().toISOString(),
      });
    }

    if (userId) {
      newEditHistory.push({
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    // Track status change timestamp if status is updated
    if (employeeData.status && employeeData.status !== currentEmployee.status) {
      employeeData.statusChangedAt = new Date();
    }

    const dbUpdatedBy = (userId && !userId.startsWith("admin_")) ? userId : (employeeData.updatedBy && !employeeData.updatedBy.startsWith("admin_") ? employeeData.updatedBy : null);
    employeeData.updatedBy = dbUpdatedBy;
    employeeData.editHistory = newEditHistory.length > 0 ? newEditHistory : undefined;

    const updatedEmployee = (await prisma.$transaction(async (tx) => {
      // Check unique identity fields against OTHER employees
      if (employeeData.empCode) {
        const existing = await tx.employee.findUnique({ where: { empCode: employeeData.empCode } });
        if (existing && existing.id !== id) throw new ApiError(400, "Employee code already exists");
      }
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

      // Upsert payroll config for the updated employee
      await tx.employeePayrollConfig.upsert({
        where: { employeeId: id },
        create: {
          employeeId: id,
          salaryType: employeeData.salaryType ? String(employeeData.salaryType).toUpperCase() : "MONTHLY",
          monthlySalary: Number(employeeData.grossSalary || 0),
          basicSalary: Number(employeeData.basicSalary || 0),
          da: Number(da || 0),
          hra: Number(hra || 0),
          otherAllowance: Number(otherAllowance || 0),
          cashInHand: Number(cashInHand || 0),
          bankAccount: employeeData.accountNumber || null,
          ifscCode: employeeData.ifscCode || null,
          bankName: employeeData.bankName || null,
          pfNumber: employeeData.pfNumber || null,
          esiNumber: employeeData.esiNumber || null,
          paymentMode: employeeData.paymentMode ? String(employeeData.paymentMode).toUpperCase() : "CASH",
        },
        update: {
          ...(employeeData.salaryType && { salaryType: String(employeeData.salaryType).toUpperCase() }),
          ...(employeeData.grossSalary !== undefined && { monthlySalary: Number(employeeData.grossSalary || 0) }),
          ...(employeeData.basicSalary !== undefined && { basicSalary: Number(employeeData.basicSalary || 0) }),
          ...(da !== undefined && { da: Number(da || 0) }),
          ...(hra !== undefined && { hra: Number(hra || 0) }),
          ...(otherAllowance !== undefined && { otherAllowance: Number(otherAllowance || 0) }),
          ...(cashInHand !== undefined && { cashInHand: Number(cashInHand || 0) }),
          ...(employeeData.accountNumber !== undefined && { bankAccount: employeeData.accountNumber || null }),
          ...(employeeData.ifscCode !== undefined && { ifscCode: employeeData.ifscCode || null }),
          ...(employeeData.bankName !== undefined && { bankName: employeeData.bankName || null }),
          ...(employeeData.pfNumber !== undefined && { pfNumber: employeeData.pfNumber || null }),
          ...(employeeData.esiNumber !== undefined && { esiNumber: employeeData.esiNumber || null }),
          ...(employeeData.paymentMode !== undefined && { paymentMode: String(employeeData.paymentMode).toUpperCase() }),
        },
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
    }))!;

    // Send email notification after transaction if login account password was set/updated
    const recipientEmail = updatedEmployee?.email || loginAccount?.email;
    if (
      createLoginAccount &&
      loginAccount?.loginEnabled !== false &&
      loginAccount?.password &&
      recipientEmail
    ) {
      try {
        await sendEmail({
          to: recipientEmail,
          subject: "Sunsea — Your Login Account Credentials",
          html: generateWelcomeEmailHtml({
            fullName: updatedEmployee.fullName || "",
            empCode: updatedEmployee.empCode,
            username: loginAccount.username,
            password: loginAccount.password,
            title: "Account Credentials Updated",
            subtitle: "Your login credentials for the Sunsea portal have been updated.",
            teamName: "Sunsea HR & IT Team",
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send welcome email on update (non-fatal):", emailErr);
      }
    }

    if (updatedEmployee?.empCode) {
      await logAudit("Employee", updatedEmployee.empCode, "UPDATE", userId, updatedEmployee.fullName || updatedEmployee.empCode);
    }

    return updatedEmployee;
  }

  async getNextEmployeeCode() {
    const lastEmployee = await prisma.employee.findFirst({
      where: { status: { not: "draft" } },
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

  async delete(id: bigint, userId?: string) {
    const employee = await this.findById(id);

    const linkedStores = await prisma.store.findFirst({ where: { inchargeId: id } });
    if (linkedStores) throw new ApiError(400, "Cannot delete employee because they are assigned as Incharge for a Store.");

    const linkedSalesOrders = await prisma.salesOrder.findFirst({ where: { sourceEmployeeId: id } });
    if (linkedSalesOrders) throw new ApiError(400, "Cannot delete employee because they are linked as Source Employee on Sales Orders.");

    // explicitly delete linked records first to prevent RESTRICT foreign key constraint failures
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete linked user account
      const linkedUser = await tx.user.findUnique({ where: { employeeId: id } });
      if (linkedUser) {
        await tx.user.delete({ where: { userId: linkedUser.userId } });
      }

      // 2. Delete payroll config
      await tx.employeePayrollConfig.deleteMany({ where: { employeeId: id } });

      // 3. Delete attendance records
      await tx.attendanceRecord.deleteMany({ where: { employeeId: id } });

      // 4. Delete payroll results
      await tx.payrollResult.deleteMany({ where: { employeeId: id } });

      // 5. Delete permanent deductions
      await tx.employeePermanentDeduction.deleteMany({ where: { employeeId: id } });

      // 6. Delete salary advances
      await tx.salaryAdvance.deleteMany({ where: { employeeId: id } });

      // 7. Delete employee record
      return tx.employee.delete({ where: { id } });
    });

    if (employee?.empCode) {
      await logAudit("Employee", employee.empCode, "DELETE", userId, employee.fullName || employee.empCode);
    }

    return result;
  }
}

export default new EmployeeService();
