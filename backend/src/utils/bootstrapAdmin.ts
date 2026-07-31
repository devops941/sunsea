import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { generatePermissions } from "../config/permissionRegistry";

export const bootstrapAdmin = async (prisma: PrismaClient) => {
  const adminEmail    = process.env.ADMIN_EMAIL    || "admin@sunsea.in";
  const adminUsername = process.env.ADMIN_USERNAME || "superadmin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin@123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // ── 1. Ensure Super Admin Role ────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where:  { code: "ROLE_ADMIN" },
    update: { name: "Super Admin" },
    create: { code: "ROLE_ADMIN", name: "Super Admin", description: "System Administrator" },
  });

  // ── 2. Ensure Super Admin Account ────────────────────────────────────────
  await prisma.admin.upsert({
    where:  { email: adminEmail },
    update: { fullName: "Super Admin", username: adminUsername, passwordHash, roleId: adminRole.id },
    create: { fullName: "Super Admin", username: adminUsername, email: adminEmail, phone: "9876543210", passwordHash, roleId: adminRole.id },
  });

  console.log("✅ Super Admin bootstrapped");

  // ── 3. Seed ALL permissions from centralized registry ────────────────────
  //    generatePermissions() reads PERMISSION_REGISTRY — adding a new module
  //    here is the ONLY place you need to touch for new RBAC entries.
  const permissionData = generatePermissions();

  await prisma.permission.createMany({
    data: permissionData,
    skipDuplicates: true,   // idempotent: safe to run on every server boot
  });

  console.log(`✅ ${permissionData.length} permissions seeded from registry`);
};
