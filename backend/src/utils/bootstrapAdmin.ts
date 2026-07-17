import { PrismaClient, EmployeeStatus, UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

export const bootstrapAdmin = async (prisma: PrismaClient) => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sunsea.in";
  const adminUsername = process.env.ADMIN_USERNAME || "superadmin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin@123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Ensure Admin role exists
  const adminRole = await prisma.role.upsert({
    where: { code: 'ROLE_ADMIN' },
    update: {
      name: 'Super Admin'
    },
    create: {
      code: 'ROLE_ADMIN',
      name: 'Super Admin',
      description: 'System Administrator',
    }
  });

  // Create or Update Admin record in the new admins table
  const adminProfile = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      fullName: "Super Admin",
      username: adminUsername,
      email: adminEmail,
      phone: "9876543210",
      passwordHash,
      roleId: adminRole.id,
    },
    create: {
      fullName: "Super Admin",
      username: adminUsername,
      email: adminEmail,
      phone: "9876543210",
      passwordHash,
      roleId: adminRole.id,
    },
  });

  console.log("✅ Standalone Super Admin Bootstrapped automatically from .env");

  // --- Seed Permissions ---
  const systemModules = [
    "customers", "supplier", "suppliers", "supplierpricelist", "profile", "employees", "products",
    "categories", "sub-categories", "users", "roles", "permissions", "role-permissions",
    "departments", "colors", "sizes", "uoms", "product-pricing",
    "product-images", "stores", "storage-stores", "store-types", "locations", "machines", "shifts",
    "raw_materials", "raw_material_stocks", "sales-orders", "reports", "purchase-order-approvals", "invoice", "finished_goods_stocks"
  ];
  const actions = ["view", "create", "edit", "delete"];

  const permissionData = [];
  for (const mod of systemModules) {
    for (const action of actions) {
      permissionData.push({
        key: `${mod}.${action}`,
        module: mod,
        action: action,
        description: `Can ${action} ${mod}`,
      });
    }
  }

  // Insert permissions in bulk, skipping duplicates
  await prisma.permission.createMany({
    data: permissionData,
    skipDuplicates: true,
  });

  console.log("✅ Permissions seeded successfully");
};
