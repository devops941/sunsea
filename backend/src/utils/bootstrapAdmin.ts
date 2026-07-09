import { PrismaClient, EmployeeStatus, UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

export const bootstrapAdmin = async (prisma: PrismaClient) => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sunsea.in";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

  // Create ROLE_ADMIN if not exists
  const adminRole = await prisma.role.upsert({
    where: { code: "ROLE_ADMIN" },
    update: {},
    create: {
      code: "ROLE_ADMIN",
      name: "IT / ERP Admin",
      description: "Users, Roles, Audit and System management",
      isSystem: true,
    },
  });

  // Create Admin Department
  const adminDepartment = await prisma.department.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: { code: 'ADMIN', name: 'Administration' },
  });

  // Create Admin Designation
  const adminDesignation = await prisma.designation.upsert({
    where: { code: 'DIR' },
    update: {},
    create: { code: 'DIR', name: 'Director' },
  });

  // Create Admin Employee
  const adminEmployee = await prisma.employee.upsert({
    where: {
      empCode: "EMP001",
    },
    update: {
      fullName: "Administrator",
      mobile: "9876543210",
      email: adminEmail,
      departmentId: adminDepartment.id,
      designationId: adminDesignation.id,
      status: EmployeeStatus.active,
    },
    create: {
      empCode: "EMP001",
      fullName: "Administrator",
      mobile: "9876543210",
      email: adminEmail,
      dateOfJoining: new Date(),
      departmentId: adminDepartment.id,
      designationId: adminDesignation.id,
      status: EmployeeStatus.active,
    },
  });

  // Create Admin User
  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername }
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.create({
      data: {
        username: adminUsername,
        fullName: "Administrator",
        email: adminEmail,
        passwordHash,
        employeeId: adminEmployee.id,
        roleId: adminRole.id,
        status: UserStatus.active,
        mustChangePw: false,
        failedAttempts: 0,
        lockedUntil: null,
        mfaEnabled: false,
        mfaSecret: null,
        createdBy: "SYSTEM",
      },
    });
    console.log("✅ Admin User Bootstrapped automatically from .env");
  } else {
    // Optionally update password if needed, but usually we just want to ensure they exist.
    // We'll leave it as is if they exist to avoid overwriting password changes.
    // But we will ensure the role is set correctly.
    await prisma.user.update({
      where: { username: adminUsername },
      data: {
        roleId: adminRole.id,
        email: adminEmail,
      }
    });
  }
};
