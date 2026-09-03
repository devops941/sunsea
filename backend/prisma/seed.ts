// // @ts-nocheck
// import {
//   PrismaClient,
//   EmployeeStatus,
//   UserStatus,
// } from '@prisma/client';

// import * as bcrypt from 'bcryptjs';

// const prisma = new PrismaClient();

// async function main() {
//   console.log('🌱 Starting seed...');

//   // ============================================================================
//   // 1. ADMIN MODULE (Roles & Permissions)
//   // ============================================================================
//   // =========================
//   // Roles
//   // =========================
//   const roles = [
//     {
//       code: 'ROLE_MD',
//       name: 'MD / Director',
//       description: 'Read-only KPI access',
//     },
//     {
//       code: 'ad',
//       name: 'MD / Director',
//       description: 'Read-only KPI access',
//     },
//     {
//       code: 'ROLE_HR',
//       name: 'HR Admin',
//       description: 'All operations and approvals',
//     },
//     {
//       code: 'ROLE_PROD',
//       name: 'Production Incharge',
//       description: 'Production, mixing and stores view',
//     },
//     {
//       code: 'ROLE_SHIFT',
//       name: 'Shift Incharge',
//       description: 'Own shift production management',
//     },
//     {
//       code: 'ROLE_OP',
//       name: 'Machine Operator',
//       description: 'Hourly log entry access',
//     },
//     {
//       code: 'ROLE_STORES',
//       name: 'Stores Incharge',
//       description: 'Inventory, GRN and BOM management',
//     },
//     {
//       code: 'ROLE_DISPATCH',
//       name: 'Pack / Dispatch',
//       description: 'Dispatch center and FG store access',
//     },
//     {
//       code: 'ROLE_ACC',
//       name: 'Accounts',
//       description: 'Finance, GST and invoice management',
//     },
//     {
//       code: 'ROLE_AGENT',
//       name: 'Collection Agent',
//       description: 'Mobile collection operations',
//     },
//     {
//       code: 'ROLE_ADMIN',
//       name: 'Super Admin',
//       description: 'System Administrator',
//     },
//   ];

//   for (const role of roles) {
//     await prisma.role.upsert({
//       where: { code: role.code },
//       update: {
//         name: role.name,
//         description: role.description,
//         isSystem: true,
//       },
//       create: {
//         code: role.code,
//         name: role.name,
//         description: role.description,
//         isSystem: true,
//       },
//     });
//   }

//   // =========================
//   // Role permissions
//   // =========================
//   const rolePermissions: Record<string, string[]> = {
//     ROLE_MD: [
//       "reports.view",
//       "products.view",
//       "product-pricing.view",
//       "product-pricing.create",
//       "product-pricing.edit",
//       "product-pricing.delete",
//       "customers.view",
//       "production_orders.view",
//       "hourly_productions.view",
//     ],

//     ROLE_HR: [
//       "employees.view",
//       "employees.create",
//       "employees.edit",

//       "departments.view",
//       "departments.create",
//       "departments.edit",

//       "designations.view",
//       "designations.create",
//       "designations.edit",

//       "users.view",
//       "users.create",
//       "users.edit",
//     ],

//     ROLE_PROD: [
//       "production_orders.view",
//       "production_orders.create",
//       "production_orders.edit",

//       "hourly_productions.view",
//       "hourly_productions.create",
//       "hourly_productions.edit",

//       "machines.view",

//       "raw_material_stocks.view",
//       "finished_goods_stocks.view",
//     ],

//     ROLE_SHIFT: [
//       "production_orders.view",
//       "hourly_productions.view",
//       "hourly_productions.create",
//       "hourly_productions.edit",
//     ],

//     ROLE_OP: [
//       "hourly_productions.view",
//       "hourly_productions.create",
//     ],

//     ROLE_STORES: [
//       "stores.view",
//       "stores.create",
//       "stores.edit",
//       "stores.delete",

//       "store-types.view",
//       "store-types.create",
//       "store-types.edit",
//       "store-types.delete",

//       "raw_materials.view",
//       "raw_materials.create",
//       "raw_materials.edit",
//       "raw_material_categories.view",
//       "raw_material_categories.create",
//       "raw_material_categories.edit",
//       "raw_material_categories.delete",

//       "raw_material_stocks.view",
//       "raw_material_stocks.create",
//       "raw_material_stocks.edit",

//       "raw_material_transactions.view",
//       "raw_material_transactions.create",
//       "raw_material_transactions.edit",
//     ],

//     ROLE_DISPATCH: [
//       "finished_goods_stocks.view",

//       "finished_goods_transactions.view",
//       "finished_goods_transactions.create",
//       "finished_goods_transactions.edit",
//     ],

//     ROLE_ACC: [
//       "customers.view",
//       "supplier.view",
//       "supplierpricelist.view",
//       "supplierpricelist.create",
//       "supplierpricelist.edit",
//       "supplierpricelist.delete",
//       "product-pricing.view",
//       "product-pricing.create",
//       "product-pricing.edit",
//       "product-pricing.delete",
//       "reports.view",
//     ],

//     ROLE_AGENT: [
//       "customers.view",
//     ],

//     ROLE_ADMIN: [],
//   };

//   // =========================
//   // Permissions
//   // =========================
//   const permissionsList = [
//     // Administration
//     { key: "users.view", module: "Users", action: "view" },
//     { key: "users.create", module: "Users", action: "create" },
//     { key: "users.edit", module: "Users", action: "edit" },
//     { key: "users.delete", module: "Users", action: "delete" },
//     { key: "roles.view", module: "Roles", action: "view" },
//     { key: "roles.create", module: "Roles", action: "create" },
//     { key: "roles.edit", module: "Roles", action: "edit" },
//     { key: "roles.delete", module: "Roles", action: "delete" },
//     { key: "permissions.view", module: "Permissions", action: "view" },
//     { key: "role-permissions.view", module: "Role Permissions", action: "view" },
//     { key: "role-permissions.edit", module: "Role Permissions", action: "edit" },

//     // HR Management
//     { key: "departments.view", module: "Department", action: "view" },
//     { key: "departments.create", module: "Department", action: "create" },
//     { key: "departments.edit", module: "Department", action: "edit" },
//     { key: "departments.delete", module: "Department", action: "delete" },
//     { key: "designations.view", module: "Designation", action: "view" },
//     { key: "designations.create", module: "Designation", action: "create" },
//     { key: "designations.edit", module: "Designation", action: "edit" },
//     { key: "designations.delete", module: "Designation", action: "delete" },
//     { key: "employees.view", module: "Employee", action: "view" },
//     { key: "employees.create", module: "Employee", action: "create" },
//     { key: "employees.edit", module: "Employee", action: "edit" },
//     { key: "employees.delete", module: "Employee", action: "delete" },

//     // Business Partners
//     { key: "customers.view", module: "Customer", action: "view" },
//     { key: "customers.create", module: "Customer", action: "create" },
//     { key: "customers.edit", module: "Customer", action: "edit" },
//     { key: "customers.delete", module: "Customer", action: "delete" },
//     { key: "supplier.view", module: "Supplier", action: "view" },
//     { key: "supplier.create", module: "Supplier", action: "create" },
//     { key: "supplier.edit", module: "Supplier", action: "edit" },
//     { key: "supplier.delete", module: "Supplier", action: "delete" },
//     { key: "supplierpricelist.view", module: "Supplier Price List", action: "view" },
//     { key: "supplierpricelist.create", module: "Supplier Price List", action: "create" },
//     { key: "supplierpricelist.edit", module: "Supplier Price List", action: "edit" },
//     { key: "supplierpricelist.delete", module: "Supplier Price List", action: "delete" },

//     // Product Master
//     { key: "categories.view", module: "Category", action: "view" },
//     { key: "categories.create", module: "Category", action: "create" },
//     { key: "categories.edit", module: "Category", action: "edit" },
//     { key: "categories.delete", module: "Category", action: "delete" },
//     { key: "sub-categories.view", module: "Sub Category", action: "view" },
//     { key: "sub-categories.create", module: "Sub Category", action: "create" },
//     { key: "sub-categories.edit", module: "Sub Category", action: "edit" },
//     { key: "sub-categories.delete", module: "Sub Category", action: "delete" },
//     { key: "colors.view", module: "Color", action: "view" },
//     { key: "colors.create", module: "Color", action: "create" },
//     { key: "colors.edit", module: "Color", action: "edit" },
//     { key: "colors.delete", module: "Color", action: "delete" },
//     { key: "sizes.view", module: "Size", action: "view" },
//     { key: "sizes.create", module: "Size", action: "create" },
//     { key: "sizes.edit", module: "Size", action: "edit" },
//     { key: "sizes.delete", module: "Size", action: "delete" },
//     { key: "uoms.view", module: "UOM", action: "view" },
//     { key: "uoms.create", module: "UOM", action: "create" },
//     { key: "uoms.edit", module: "UOM", action: "edit" },
//     { key: "uoms.delete", module: "UOM", action: "delete" },
//     // Products Management
//     { key: "products.view", module: "Product List", action: "view" },
//     { key: "products.create", module: "Product List", action: "create" },
//     { key: "products.edit", module: "Product List", action: "edit" },
//     { key: "products.delete", module: "Product List", action: "delete" },
//     { key: "product-pricing.view", module: "Product Pricing", action: "view" },
//     { key: "product-pricing.create", module: "Product Pricing", action: "create" },
//     { key: "product-pricing.edit", module: "Product Pricing", action: "edit" },
//     { key: "product-pricing.delete", module: "Product Pricing", action: "delete" },
//     { key: "product-images.view", module: "Product Images", action: "view" },
//     { key: "product-images.edit", module: "Product Images", action: "edit" },
//     //shift management
//     { key: "shifts.view", module: "shift", action: "view" },
//     { key: "shifts.create", module: "shift", action: "create" },
//     { key: "shifts.edit", module: "shift", action: "edit" },
//     { key: "shifts.delete", module: "shift", action: "delete" },
//     // Stores & Inventory
//     { key: "stores.view", module: "Stores", action: "view" },
//     { key: "stores.create", module: "Stores", action: "create" },
//     { key: "stores.edit", module: "Stores", action: "edit" },
//     { key: "stores.delete", module: "Stores", action: "delete" },

//     { key: "store-types.view", module: "Store Types", action: "view" },
//     { key: "store-types.create", module: "Store Types", action: "create" },
//     { key: "store-types.edit", module: "Store Types", action: "edit" },
//     { key: "store-types.delete", module: "Store Types", action: "delete" },

//     { key: "raw_materials.view", module: "Raw Materials", action: "view" },
//     { key: "raw_materials.create", module: "Raw Materials", action: "create" },
//     { key: "raw_materials.edit", module: "Raw Materials", action: "edit" },
//     { key: "raw_materials.delete", module: "Raw Materials", action: "delete" },

//     { key: "raw_material_categories.view", module: "Raw Material Categories", action: "view" },
//     { key: "raw_material_categories.create", module: "Raw Material Categories", action: "create" },
//     { key: "raw_material_categories.edit", module: "Raw Material Categories", action: "edit" },
//     { key: "raw_material_categories.delete", module: "Raw Material Categories", action: "delete" },

//     { key: "raw_material_stocks.view", module: "Raw Material Stocks", action: "view" },
//     { key: "raw_material_stocks.create", module: "Raw Material Stocks", action: "create" },
//     { key: "raw_material_stocks.edit", module: "Raw Material Stocks", action: "edit" },
//     { key: "raw_material_stocks.delete", module: "Raw Material Stocks", action: "delete" },

//     { key: "finished_goods_stocks.view", module: "Finished Goods Stocks", action: "view" },
//     { key: "finished_goods_stocks.create", module: "Finished Goods Stocks", action: "create" },
//     { key: "finished_goods_stocks.edit", module: "Finished Goods Stocks", action: "edit" },
//     { key: "finished_goods_stocks.delete", module: "Finished Goods Stocks", action: "delete" },

//     { key: "finished_goods_transactions.view", module: "Finished Goods Transactions", action: "view" },
//     { key: "finished_goods_transactions.create", module: "Finished Goods Transactions", action: "create" },
//     { key: "finished_goods_transactions.edit", module: "Finished Goods Transactions", action: "edit" },
//     { key: "finished_goods_transactions.delete", module: "Finished Goods Transactions", action: "delete" },

//     // Locations
//     { key: "locations.view", module: "Locations", action: "view" },
//     { key: "locations.create", module: "Locations", action: "create" },
//     { key: "locations.edit", module: "Locations", action: "edit" },
//     { key: "locations.delete", module: "Locations", action: "delete" },

//     // Production & Machine Master
//     { key: "machines.view", module: "Machines", action: "view" },
//     { key: "machines.create", module: "Machines", action: "create" },
//     { key: "machines.edit", module: "Machines", action: "edit" },
//     { key: "machines.delete", module: "Machines", action: "delete" },

//     { key: "weekly_programs.view", module: "Weekly Schedule", action: "view" },
//     { key: "weekly_programs.create", module: "Weekly Schedule", action: "create" },
//     { key: "weekly_programs.edit", module: "Weekly Schedule", action: "edit" },
//     { key: "weekly_programs.delete", module: "Weekly Schedule", action: "delete" },

//     { key: "production_orders.view", module: "Production Orders", action: "view" },
//     { key: "production_orders.create", module: "Production Orders", action: "create" },
//     { key: "production_orders.edit", module: "Production Orders", action: "edit" },
//     { key: "production_orders.delete", module: "Production Orders", action: "delete" },

//     { key: "hourly_productions.view", module: "Hourly Reports", action: "view" },
//     { key: "hourly_productions.create", module: "Hourly Reports", action: "create" },
//     { key: "hourly_productions.edit", module: "Hourly Reports", action: "edit" },
//     { key: "hourly_productions.delete", module: "Hourly Reports", action: "delete" },

//     { key: "raw_material_transactions.view", module: "Raw Material ", action: "view" },
//     { key: "raw_material_transactions.create", module: "Raw Material ", action: "create" },
//     { key: "raw_material_transactions.edit", module: "Raw Material ", action: "edit" },
//     { key: "raw_material_transactions.delete", module: "Raw Material ", action: "delete" },

//     { key: "bill_of_materials.view", module: "Bill Of Material", action: "view" },
//     { key: "bill_of_materials.create", module: "Bill Of Material", action: "create" },
//     { key: "bill_of_materials.edit", module: "Bill Of Material", action: "edit" },
//     { key: "bill_of_materials.delete", module: "Bill Of Material", action: "delete" },

//     // Reports
//     { key: "reports.view", module: "Reports", action: "view" },

//     { key: "sales_order.view", module: "Sales Order ", action: "view" },
//     { key: "sales_order.create", module: "Sales Order", action: "create" },
//     { key: "sales_order.edit", module: "Sales Order", action: "edit" },
//     { key: "sales_order.delete", module: "Sales Order", action: "delete" },

//     //purchse orders permissions
//     { key: "purchaseOrders.view", module: "Purchase Order", action: "view" },
//     { key: "purchaseOrders.create", module: "Purchase Order", action: "create" },
//     { key: "purchaseOrders.edit", module: "Purchase Order", action: "edit" },
//     { key: "purchaseOrders.delete", module: "Purchase Order", action: "delete" },
//   ];

//   console.log("🌱 Seeding permissions...");
//   for (const perm of permissionsList) {
//     await prisma.permission.upsert({
//       where: { key: perm.key },
//       update: {},
//       create: {
//         key: perm.key,
//         module: perm.module,
//         action: perm.action,
//         description: `Allow ${perm.action} on ${perm.module}`
//       }
//     });
//   }

//   const adminRoleFromDb = await prisma.role.findUnique({
//     where: { code: "ROLE_ADMIN" }
//   });

//   if (adminRoleFromDb) {
//     console.log("🌱 Mapping permissions to ROLE_ADMIN...");
//     const allPermissions = await prisma.permission.findMany();
//     for (const perm of allPermissions) {
//       await prisma.rolePermission.upsert({
//         where: {
//           roleId_permissionId: {
//             roleId: adminRoleFromDb.id,
//             permissionId: perm.id
//           }
//         },
//         update: {},
//         create: {
//           roleId: adminRoleFromDb.id,
//           permissionId: perm.id
//         }
//       });
//     }
//   }

//   // Map rolePermissions -> RolePermission rows for every other role
//   console.log("🌱 Mapping permissions to non-admin roles...");
//   for (const [roleCode, permissionKeys] of Object.entries(rolePermissions)) {
//     if (roleCode === 'ROLE_ADMIN') continue; // already fully mapped above
//     if (permissionKeys.length === 0) continue;

//     const roleFromDb = await prisma.role.findUnique({
//       where: { code: roleCode },
//     });

//     if (!roleFromDb) {
//       console.warn(`⚠️  Role ${roleCode} not found, skipping permission mapping`);
//       continue;
//     }

//     for (const permKey of permissionKeys) {
//       const permission = await prisma.permission.findUnique({
//         where: { key: permKey },
//       });

//       if (!permission) {
//         console.warn(`⚠️  Permission ${permKey} not found, skipping for ${roleCode}`);
//         continue;
//       }

//       await prisma.rolePermission.upsert({
//         where: {
//           roleId_permissionId: {
//             roleId: roleFromDb.id,
//             permissionId: permission.id,
//           },
//         },
//         update: {},
//         create: {
//           roleId: roleFromDb.id,
//           permissionId: permission.id,
//         },
//       });
//     }
//   }

//   // =========================
//   // departments
//   // =========================
//   const departments = [
//     {
//       code: 'HR',
//       name: 'Human Resources',
//     },
//     {
//       code: 'PROD',
//       name: 'Production',
//     },
//     {
//       code: 'STORES',
//       name: 'Stores',
//     },
//     {
//       code: 'DISPATCH',
//       name: 'Dispatch',
//     },
//     {
//       code: 'ACC',
//       name: 'Accounts',
//     },
//     {
//       code: 'SALES',
//       name: 'Sales',
//     },
//     {
//       code: 'PURCHASE',
//       name: 'Purchase',
//     },
//     {
//       code: 'QC',
//       name: 'Quality Control',
//     },
//     {
//       code: 'IT',
//       name: 'Information Technology',
//     },
//   ];

//   for (const department of departments) {
//     const existing = await prisma.department.findFirst({
//       where: { name: department.name },
//     });
//     if (!existing) {
//       await prisma.department.create({
//         data: {
//           name: department.name,
//         },
//       });
//     }
//   }

//   // =========================
//   // Designations
//   // =========================

//   console.log("✅ Seed completed successfully with only Roles & Permissions! Returning early to prevent dummy data.");
//   return;

//   const designations = [
//     {
//       code: "HRM",
//       name: "HR Manager",
//       departmentCode: "HR",
//     },
//     {
//       code: "PM",
//       name: "Production Manager",
//       departmentCode: "PROD",
//     },
//     {
//       code: "SI",
//       name: "Stores Incharge",
//       departmentCode: "STORES",
//     },
//     {
//       code: "DI",
//       name: "Dispatch Incharge",
//       departmentCode: "DISPATCH",
//     },
//     {
//       code: "AM",
//       name: "Accounts Manager",
//       departmentCode: "ACC",
//     },
//     {
//       code: "SM",
//       name: "Sales Manager",
//       departmentCode: "SALES",
//     },
//     {
//       code: "PO",
//       name: "Purchase Officer",
//       departmentCode: "PURCHASE",
//     },
//     {
//       code: "QCE",
//       name: "Quality Engineer",
//       departmentCode: "QC",
//     },
//     {
//       code: "ITA",
//       name: "IT Administrator",
//       departmentCode: "IT",
//     },
//     {
//       code: "SUP",
//       name: "Supervisor",
//       departmentCode: "PROD",
//     },
//     {
//       code: "OPR",
//       name: "Machine Operator",
//       departmentCode: "PROD",
//     },
//   ];

//   console.log("🌱 Seeding designations...");

//   for (const designation of designations) {
//     const department = await prisma.department.findUnique({
//       where: {
//         code: designation.departmentCode,
//       },
//     });

//     if (!department) {
//       throw new Error(
//         `Department ${designation.departmentCode} not found`
//       );
//     }

//     await prisma.designation.upsert({
//       where: {
//         code: designation.code,
//       },
//       update: {
//         name: designation.name,
//         departmentId: department.id,
//       },
//       create: {
//         code: designation.code,
//         name: designation.name,
//         departmentId: department.id,
//       },
//     });
//   }

//   console.log("✅ Designations seeded successfully");

//   // =========================
//   // Admin Department & Designation
//   // =========================

//   const adminDepartment = await prisma.department.upsert({
//     where: { code: 'ADMIN' },
//     update: {},
//     create: { code: 'ADMIN', name: 'Administration' },
//   });

//   const adminDesignation = await prisma.designation.upsert({
//     where: { code: 'DIR' },
//     update: {},
//     create: { code: 'DIR', name: 'Director' },
//   });


//   // ============================================================================
//   // 2. MASTER DATA
//   // ============================================================================

//   console.log("🌱 Seeding Master Data...");

//   // -------------------------
//   // UOM (4 Records)
//   // -------------------------
//   const uoms = [
//     { uomCode: 'PCS', uomName: 'Pieces', description: 'Count by Pieces' },
//     { uomCode: 'KG', uomName: 'Kilograms', description: 'Weight in Kilograms' },
//     { uomCode: 'LTR', uomName: 'Liters', description: 'Volume in Liters' },
//     { uomCode: 'MTR', uomName: 'Meters', description: 'Length in Meters' },
//   ];
//   for (const uom of uoms) {
//     await prisma.unitOfMeasure.upsert({
//       where: { uomCode: uom.uomCode },
//       update: {},
//       create: uom,
//     });
//   }

//   // -------------------------
//   // Product Category & Sub Category (1 each)
//   // -------------------------
//   const category = await prisma.category.upsert({
//     where: { categoryCode: 'CAT-PLSTC' },
//     update: {},
//     create: { categoryCode: 'CAT-PLSTC', categoryName: 'Plastics', description: 'Plastic Products' },
//   });

//   const subCategory = await prisma.subCategory.upsert({
//     where: { subCategoryCode: 'SUB-BCKT' },
//     update: {},
//     create: { subCategoryCode: 'SUB-BCKT', subCategoryName: 'Buckets', categoryId: category.id },
//   });

//   // -------------------------
//   // Product Size (2 Records)
//   // -------------------------
//   const sizes = [
//     { sizeCode: 'SZ-SM', sizeName: 'Small' },
//     { sizeCode: 'SZ-LG', sizeName: 'Large' },
//     { sizeCode: 'SZ-MD', sizeName: 'Medium' },
//     { sizeCode: 'SZ-XL', sizeName: 'Extra Large' },
//   ];
//   for (const size of sizes) {
//     await prisma.size.upsert({
//       where: { sizeCode: size.sizeCode },
//       update: {},
//       create: size,
//     });
//   }

//   // -------------------------
//   // Product Color (2 Records)
//   // -------------------------
//   const colors = [
//     {
//       colorCode: "CLR-001",
//       colorName: "Red",
//       hexCode: "#FF0000",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-002",
//       colorName: "Blue",
//       hexCode: "#0000FF",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-003",
//       colorName: "Green",
//       hexCode: "#008000",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-004",
//       colorName: "Yellow",
//       hexCode: "#FFFF00",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-005",
//       colorName: "Black",
//       hexCode: "#000000",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-006",
//       colorName: "White",
//       hexCode: "#FFFFFF",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-007",
//       colorName: "Orange",
//       hexCode: "#FFA500",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-008",
//       colorName: "Grey",
//       hexCode: "#808080",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-009",
//       colorName: "Brown",
//       hexCode: "#8B4513",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-010",
//       colorName: "Transparent",
//       hexCode: "#FFFFFF",
//       colorType: "Transparent",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-011",
//       colorName: "Sky Blue",
//       hexCode: "#87CEEB",
//       colorType: "Solid",
//       isActive: true,
//     },
//     {
//       colorCode: "CLR-012",
//       colorName: "Dark Green",
//       hexCode: "#006400",
//       colorType: "Solid",
//       isActive: true,
//     },
//   ];
//   for (const color of colors) {
//     await prisma.color.upsert({
//       where: { colorCode: color.colorCode },
//       update: {},
//       create: color,
//     });
//   }


//   // -------------------------
//   // Employee (2 Records - distinct from admin)
//   // -------------------------
//   const employees = [
//     { empCode: 'EMP-002', fullName: 'John Doe', mobile: '9100000001' },
//     { empCode: 'EMP-003', fullName: 'Jane Smith', mobile: '9100000002' },
//   ];
//   for (const emp of employees) {
//     await prisma.employee.upsert({
//       where: { empCode: emp.empCode },
//       update: {},
//       create: emp,
//     });
//   }
//   const allEmployees = await prisma.employee.findMany();

//   console.log("🌱 Seeding shifts...");

//   // Clear existing shifts to avoid unique constraint violations
//   await prisma.shift.deleteMany();

//   const shifts = [
//     { shiftCode: 'SHF-MOR', shiftName: 'Seed Morning Shift', startTime: '06:00', endTime: '14:00' },
//     { shiftCode: 'SHF-EVE', shiftName: 'Seed Evening Shift', startTime: '14:00', endTime: '22:00' },
//   ];

//   for (const shift of shifts) {
//     await prisma.shift.upsert({
//       where: { shiftCode: shift.shiftCode },
//       update: {},
//       create: shift,
//     });
//   }

//   // -------------------------
//   // Store Type (4 Records)
//   // -------------------------
//   const storeTypes = [
//     { code: 'ST-RAW', name: 'Raw Material Store' },
//     { code: 'ST-FG', name: 'Finished Goods Store' },
//     { code: 'ST-WIP', name: 'WIP Store' },
//     { code: 'ST-SCRAP', name: 'Scrap Store' },
//   ];
//   for (const st of storeTypes) {
//     await prisma.storeType.upsert({
//       where: { code: st.code },
//       update: {},
//       create: st,
//     });
//   }

//   // -------------------------
//   // Location (2 Records)
//   // -------------------------
//   const locations = [
//     { locationId: 'LOC-001', locationCode: 'L-MAIN', locationName: 'Main Warehouse', locationType: 'Warehouse' },
//     { locationId: 'LOC-002', locationCode: 'L-SUB', locationName: 'Sub Warehouse', locationType: 'Warehouse' },
//   ];
//   for (const loc of locations) {
//     await prisma.location.upsert({
//       where: { locationCode: loc.locationCode },
//       update: {},
//       create: loc,
//     });
//   }

//   // -------------------------
//   // Store (4 Records)
//   // -------------------------
//   const dbStoreTypes = await prisma.storeType.findMany();
//   const dbLocations = await prisma.location.findMany();

//   const stores = [
//     { storeId: 'STR-001', storeCode: 'STR-R1', storeName: 'Raw Store 1', storeTypeId: dbStoreTypes[0].id, locationId: dbLocations[0].locationId },
//     { storeId: 'STR-002', storeCode: 'STR-F1', storeName: 'FG Store 1', storeTypeId: dbStoreTypes[1].id, locationId: dbLocations[0].locationId },
//     { storeId: 'STR-003', storeCode: 'STR-W1', storeName: 'WIP Store 1', storeTypeId: dbStoreTypes[2].id, locationId: dbLocations[1].locationId },
//     { storeId: 'STR-004', storeCode: 'STR-S1', storeName: 'Scrap Store 1', storeTypeId: dbStoreTypes[3].id, locationId: dbLocations[1].locationId },
//   ];
//   for (const store of stores) {
//     await prisma.store.upsert({
//       where: { storeId: store.storeId },
//       update: {},
//       create: store,
//     });
//   }

//   // -------------------------
//   // Store Locations (Seeding Bins/Racks)
//   // -------------------------
//   console.log("🌱 Seeding Store Locations...");
//   const storeLocationsData = [
//     { storeId: 'STR-001', locationCode: 'R1-BIN1', locationType: 'BIN', capacityQty: 5000, capacityUom: 'KG', status: 'Active' },
//     { storeId: 'STR-001', locationCode: 'R1-BIN2', locationType: 'BIN', capacityQty: 5000, capacityUom: 'KG', status: 'Active' },
//     { storeId: 'STR-002', locationCode: 'F1-RACK1', locationType: 'RACK', capacityQty: 10000, capacityUom: 'PCS', status: 'Active' },
//     { storeId: 'STR-003', locationCode: 'W1-ZONE1', locationType: 'ZONE', capacityQty: 10000, capacityUom: 'PCS', status: 'Active' },
//   ];

//   const dbStoreLocations = [];
//   for (const sl of storeLocationsData) {
//     const createdSl = await prisma.storeLocation.upsert({
//       where: { storeId_locationCode: { storeId: sl.storeId, locationCode: sl.locationCode } },
//       update: {},
//       create: sl,
//     });
//     dbStoreLocations.push(createdSl);
//   }

//   // ============================================================================
//   // 3. PRODUCTS & RAW MATERIALS
//   // ============================================================================

//   console.log("🌱 Seeding Products and Raw Materials...");

//   // -------------------------
//   // Products (2 Records)
//   // -------------------------
//   const dbUoms = await prisma.unitOfMeasure.findMany();
//   const dbSizes = await prisma.size.findMany();

//   const products = [
//     {
//       productCode: 'PRD-001',
//       productName: '10L Plastic Bucket',
//       displayName: '10L Bucket Standard',
//       itemCode: 'ITM-BKT-10L',
//       description: 'High quality durable 10L plastic bucket',
//       typeCode: 'FINISHED_GOOD',
//       dimensions: '30x30x35',
//       mouldReference: 'MLD-BKT-01',
//       tags: JSON.stringify(['Bucket', 'Household']),
//       categoryId: category.id,
//       subCategoryId: subCategory.id,
//       uomId: dbUoms[0].id,
//       sizeId: dbSizes[0].id,
//       capacityLitres: 10,
//       weightPerPiece: 0.250,
//       bundleQty: 50,
//       isActive: true,
//       gstRate: 18,
//       cess: 0,
//       minimumQty: "10",
//       maximumQty: "100",
//     },
//     {
//       productCode: 'PRD-002',
//       productName: '20L Plastic Bucket',
//       displayName: '20L Bucket Standard',
//       itemCode: 'ITM-BKT-20L',
//       description: 'High quality durable 20L plastic bucket',
//       typeCode: 'FINISHED_GOOD',
//       dimensions: '40x40x45',
//       mouldReference: 'MLD-BKT-02',
//       tags: JSON.stringify(['Bucket', 'Heavy Duty']),
//       categoryId: category.id,
//       subCategoryId: subCategory.id,
//       uomId: dbUoms[0].id,
//       sizeId: dbSizes[1].id,
//       capacityLitres: 20,
//       weightPerPiece: 0.500,
//       bundleQty: 25,
//       isActive: true,
//       gstRate: 18,
//       cess: 0,
//       minimumQty: "10",
//       maximumQty: "100",
//     },
//     {
//       productCode: 'PRD-003',
//       productName: '15L Plastic Bucket',
//       displayName: '15L Bucket Standard',
//       itemCode: 'ITM-BKT-15L',
//       description: 'High quality durable 15L plastic bucket',
//       typeCode: 'FINISHED_GOOD',
//       dimensions: '35x35x40',
//       mouldReference: 'MLD-BKT-03',
//       tags: JSON.stringify(['Bucket', 'Household']),
//       categoryId: category.id,
//       subCategoryId: subCategory.id,
//       uomId: dbUoms[0].id,
//       sizeId: dbSizes[2].id,
//       capacityLitres: 15,
//       weightPerPiece: 0.420,
//       bundleQty: 40,
//       isActive: true,
//       gstRate: 18,
//       cess: 0,
//       minimumQty: "15",
//       maximumQty: "150",
//     },
//     {
//       productCode: 'PRD-004',
//       productName: '25L Plastic Bucket',
//       displayName: '25L Bucket Premium',
//       itemCode: 'ITM-BKT-25L',
//       description: 'High quality premium 25L plastic bucket',
//       typeCode: 'FINISHED_GOOD',
//       dimensions: '45x45x50',
//       mouldReference: 'MLD-BKT-04',
//       tags: JSON.stringify(['Bucket', 'Premium']),
//       categoryId: category.id,
//       subCategoryId: subCategory.id,
//       uomId: dbUoms[0].id,
//       sizeId: dbSizes[3].id,
//       capacityLitres: 25,
//       weightPerPiece: 0.650,
//       bundleQty: 20,
//       isActive: true,
//       gstRate: 18,
//       cess: 0,
//       minimumQty: "20",
//       maximumQty: "200",
//     },
//   ];
//   for (const prd of products) {
//     const createdPrd = await prisma.product.upsert({
//       where: { productCode: prd.productCode },
//       update: prd,
//       create: prd,
//     });

//     // Add ProductSize mapping
//     await prisma.productSize.upsert({
//       where: { productId_sizeId: { productId: createdPrd.id, sizeId: prd.sizeId } },
//       update: {},
//       create: { productId: createdPrd.id, sizeId: prd.sizeId },
//     });
//   }
//   const dbProducts = await prisma.product.findMany();

//   // -------------------------
//   // Raw Material Categories (4 Records)
//   // -------------------------
//   const categoryData = [
//     { categoryCode: 'RMC-001', categoryName: 'Polymers & Resins', description: 'Base plastic materials like HDPE, PVC' },
//     { categoryCode: 'RMC-002', categoryName: 'Additives & Chemicals', description: 'Modifiers, stabilizers, and plasticizers' },
//     { categoryCode: 'RMC-003', categoryName: 'Colorants & Masterbatches', description: 'Pigments and color concentrates' },
//     { categoryCode: 'RMC-004', categoryName: 'Packaging Materials', description: 'Boxes, tapes, and wrapping materials' },
//   ];

//   const createdCategories = [];
//   for (const cat of categoryData) {
//     const rmCat = await prisma.rawMaterialCategory.upsert({
//       where: { categoryCode: cat.categoryCode },
//       update: cat,
//       create: {
//         ...cat,
//         isActive: true,
//         createdBy: "SYSTEM",
//       },
//     });
//     createdCategories.push(rmCat);
//   }

//   // -------------------------
//   // Raw Materials (8 Records, 2 per category)
//   // -------------------------
//   const dbStores = await prisma.store.findMany();
//   const mainStoreId = dbStores.length > 0 ? dbStores[0].storeId : 'STORE-001';

//   const mainStoreLocations = dbStoreLocations.filter(sl => sl.storeId === mainStoreId);
//   const rawMaterialLocationId = mainStoreLocations.length > 0 ? mainStoreLocations[0].id : null;

//   const rawMaterialsData = [
//     // Polymers & Resins (Category 1)
//     {
//       rawMaterialId: 'RM-001', materialName: 'HDPE Granules Grade A', categoryId: createdCategories[0].id,
//       minimumStock: 1000, leadTimeDays: 7, baseUom: 'KG', reorderLevel: 2000,
//       unitPrice: 120.50, storeId: mainStoreId, isActive: true, createdBy: "SYSTEM", updatedBy: "SYSTEM",
//       batchNo: 'BATCH-H001', onHandQty: 5000, reservedQty: 0, avgCost: 118.00, remarks: 'High Density Polyethylene',
//       lastMovementAt: new Date(), status: 'Active', locationId: rawMaterialLocationId
//     },
//     {
//       rawMaterialId: 'RM-002', materialName: 'PVC Resin K-67', categoryId: createdCategories[0].id,
//       minimumStock: 800, leadTimeDays: 10, baseUom: 'KG', reorderLevel: 1500,
//       unitPrice: 95.00, storeId: mainStoreId, isActive: true, createdBy: "SYSTEM", updatedBy: "SYSTEM",
//       batchNo: 'BATCH-P002', onHandQty: 3000, reservedQty: 0, avgCost: 92.50, remarks: 'Polyvinyl Chloride Resin',
//       lastMovementAt: new Date(), status: 'Active', locationId: rawMaterialLocationId
//     },
//     // Additives & Chemicals (Category 2)
//     {
//       rawMaterialId: 'RM-003', materialName: 'UV Stabilizer UV-328', categoryId: createdCategories[1].id,
//       minimumStock: 50, leadTimeDays: 15, baseUom: 'KG', reorderLevel: 100,
//       unitPrice: 850.00, storeId: mainStoreId, isActive: true, createdBy: "SYSTEM", updatedBy: "SYSTEM",
//       batchNo: 'BATCH-U003', onHandQty: 150, reservedQty: 0, avgCost: 840.00, remarks: 'Prevents UV degradation',
//       lastMovementAt: new Date(), status: 'Active', locationId: rawMaterialLocationId
//     },
//     {
//       rawMaterialId: 'RM-004', materialName: 'Plasticizer DOP', categoryId: createdCategories[1].id,
//       minimumStock: 200, leadTimeDays: 5, baseUom: 'LITRE', reorderLevel: 400,
//       unitPrice: 150.00, storeId: mainStoreId, isActive: true, createdBy: "SYSTEM", updatedBy: "SYSTEM",
//       batchNo: 'BATCH-D004', onHandQty: 800, reservedQty: 0, avgCost: 145.00, remarks: 'Dioctyl Phthalate',
//       lastMovementAt: new Date(), status: 'Active', locationId: rawMaterialLocationId
//     },
//     // Colorants & Masterbatches (Category 3)
//     {
//       rawMaterialId: 'RM-005', materialName: 'Titanium White Masterbatch', categoryId: createdCategories[2].id,
//       minimumStock: 100, leadTimeDays: 5, baseUom: 'KG', reorderLevel: 250,
//       unitPrice: 320.00, storeId: mainStoreId, isActive: true, createdBy: "SYSTEM", updatedBy: "SYSTEM",
//       batchNo: 'BATCH-W005', onHandQty: 400, reservedQty: 0, avgCost: 315.00, remarks: 'White pigment concentrate',
//       lastMovementAt: new Date(), status: 'Active', locationId: rawMaterialLocationId
//     },
//     {
//       rawMaterialId: 'RM-006', materialName: 'Carbon Black Masterbatch', categoryId: createdCategories[2].id,
//       minimumStock: 100, leadTimeDays: 5, baseUom: 'KG', reorderLevel: 250,
//       unitPrice: 280.00, storeId: mainStoreId, isActive: true, createdBy: "SYSTEM", updatedBy: "SYSTEM",
//       batchNo: 'BATCH-B006', onHandQty: 350, reservedQty: 0, avgCost: 275.00, remarks: 'Black pigment concentrate',
//       lastMovementAt: new Date(), status: 'Active', locationId: rawMaterialLocationId
//     },
//     // Packaging Materials (Category 4)
//     {
//       rawMaterialId: 'RM-007', materialName: 'Corrugated Box 5-Ply', categoryId: createdCategories[3].id,
//       minimumStock: 500, leadTimeDays: 3, baseUom: 'NOS', reorderLevel: 1000,
//       unitPrice: 45.00, storeId: mainStoreId, isActive: true, createdBy: "SYSTEM", updatedBy: "SYSTEM",
//       batchNo: 'BATCH-C007', onHandQty: 2500, reservedQty: 0, avgCost: 44.00, remarks: 'Outer packaging box',
//       lastMovementAt: new Date(), status: 'Active', locationId: rawMaterialLocationId
//     },
//     {
//       rawMaterialId: 'RM-008', materialName: 'BOPP Packing Tape', categoryId: createdCategories[3].id,
//       minimumStock: 200, leadTimeDays: 2, baseUom: 'ROLL', reorderLevel: 500,
//       unitPrice: 25.00, storeId: mainStoreId, isActive: true, createdBy: "SYSTEM", updatedBy: "SYSTEM",
//       batchNo: 'BATCH-T008', onHandQty: 1200, reservedQty: 0, avgCost: 24.50, remarks: 'Adhesive tape 2 inch',
//       lastMovementAt: new Date(), status: 'Active', locationId: rawMaterialLocationId
//     },
//   ];

//   for (const rm of rawMaterialsData) {
//     await prisma.rawMaterial.upsert({
//       where: { rawMaterialId: rm.rawMaterialId },
//       update: rm,
//       create: rm,
//     });
//   }

//   // ============================================================================
//   // 4. MACHINES
//   // ============================================================================
//   console.log("🌱 Seeding Machines...");

//   const machines = [
//     {
//       machineId: "MAC-001",
//       machineName: "Injection Moulding Machine 350T",
//       technologyType: "INJECTION_MOULDING",
//       machineType: "PRODUCTION",
//       capacity: 350,
//       manufacturer: "Haitian",
//       modelNumber: "HT-350",
//       cycleTime: 45,
//       operatorId: null,
//       machineStatus: "IDLE",
//       isActive: true,
//       description: "350 Ton Injection Moulding Machine",
//       targetTemperature: 220,
//       targetLoadPercent: 85,
//     },
//     {
//       machineId: "MAC-002",
//       machineName: "Injection Moulding Machine 250T",
//       technologyType: "INJECTION_MOULDING",
//       machineType: "PRODUCTION",
//       capacity: 250,
//       manufacturer: "Toshiba",
//       modelNumber: "TS-250",
//       cycleTime: 38,
//       operatorId: null,
//       machineStatus: "RUNNING",
//       isActive: true,
//       description: "250 Ton Injection Moulding Machine",
//       targetTemperature: 210,
//       targetLoadPercent: 80,
//     },
//     {
//       machineId: "MAC-003",
//       machineName: "Plastic Extrusion Machine",
//       technologyType: "EXTRUSION",
//       machineType: "PRODUCTION",
//       capacity: 500,
//       manufacturer: "Lohia",
//       modelNumber: "LE-500",
//       cycleTime: 60,
//       operatorId: null,
//       machineStatus: "IDLE",
//       isActive: true,
//       description: "PVC Pipe Extrusion Machine",
//       targetTemperature: 195,
//       targetLoadPercent: 75,
//     },
//     {
//       machineId: "MAC-004",
//       machineName: "Granulator Machine",
//       technologyType: "GRANULATION",
//       machineType: "UTILITY",
//       capacity: 150,
//       manufacturer: "Rapid",
//       modelNumber: "GR-150",
//       cycleTime: 30,
//       operatorId: null,
//       machineStatus: "MAINTENANCE",
//       isActive: true,
//       description: "Plastic Scrap Granulator",
//       targetTemperature: 40,
//       targetLoadPercent: 50,
//     },
//     {
//       machineId: "MAC-005",
//       machineName: "Printing Machine",
//       technologyType: "PRINTING",
//       machineType: "PRODUCTION",
//       capacity: 100,
//       manufacturer: "Autoprint",
//       modelNumber: "PR-100",
//       cycleTime: 20,
//       operatorId: null,
//       machineStatus: "RUNNING",
//       isActive: true,
//       description: "Plastic Product Printing Machine",
//       targetTemperature: 60,
//       targetLoadPercent: 70,
//     },
//   ];

//   for (const machine of machines) {
//     await prisma.machine.upsert({
//       where: { machineId: machine.machineId },
//       update: machine as any,
//       create: machine as any,
//     });
//   }
//   // ============================================================================
//   // 5. CUSTOMERS & SALES ORDERS
//   // ============================================================================
//   console.log("🌱 Seeding Customers and Sales Orders...");


//   // -------------------------
//   // Sales Orders (3 Records) - FIXED
//   // -------------------------
  

//   // -------------------------
//   // Additional Master Data
//   // -------------------------
//   console.log("🌱 Seeding Additional Master Data (Route, SupplierAddress, ProductColor, ProductImage)...");

//   // Route
//   const route = await prisma.route.upsert({
//     where: { routeCode: 'RT-001' },
//     update: {},
//     create: { routeCode: 'RT-001', routeName: 'North Zone Route' },
//   });

//   //  Address
//   const dbSuppliers = await prisma.supplier.findMany();
//   if (dbSuppliers.length > 0) {
//     const firstSupplier = dbSuppliers[0];
//     const existingAddress = await prisma.supplierAddress.findFirst({ where: { supplierId: firstSupplier.id } });
//     if (!existingAddress) {
//       await prisma.supplierAddress.create({
//         data: {
//           supplierId: firstSupplier.id,
//           label: 'Warehouse A',
//           isDefault: true,
//           address: { street: '123 Main St', city: 'Chennai', pin: '600001' },
//           stateCode: 'TN',
//         }
//       });
//     }
//   }

//   // ProductColor & ProductImage
//   const dbColors = await prisma.color.findMany();
//   if (dbProducts.length > 0 && dbColors.length > 0) {
//     for (const prd of dbProducts) {
//       await prisma.productColor.upsert({
//         where: { productId_colorId: { productId: prd.id, colorId: dbColors[0].id } },
//         update: {},
//         create: { productId: prd.id, colorId: dbColors[0].id, isDefault: true },
//       });
//       const existingImages = await prisma.productImage.findMany({ where: { productId: prd.id } });
//       if (existingImages.length === 0) {
//         await prisma.productImage.create({
//           data: { productId: prd.id, imageUrl: 'https://via.placeholder.com/150', isPrimary: true },
//         });
//       }
//     }
//   }

//   // -------------------------
//   // Stock & Inventory Data
//   // -------------------------
//   console.log("🌱 Seeding Stock & Inventory Data...");

//   const dbRawMaterials = await prisma.rawMaterial.findMany();
//   if (dbRawMaterials.length > 0 && dbStores.length > 0 && dbLocations.length > 0) {
//     for (const rm of dbRawMaterials) {
//       const storeId = rm.storeId || dbStores[0].storeId;
//       const existingStock = await prisma.rawMaterialTransaction.findFirst({
//         where: { rawMaterialId: rm.rawMaterialId, storeId: storeId }
//       });
//       if (!existingStock) {
//         await prisma.rawMaterialTransaction.create({
//           data: {
//             storeId: storeId,
//             rawMaterialId: rm.rawMaterialId,
//             txnType: 'OPENING',
//             qty: 100,
//             remarks: 'Initial stock',
//           }
//         });
//       }
//     }
//   }

//   if (dbProducts.length > 0 && dbStores.length > 0) {
//     for (const prd of dbProducts) {
//       const existingFgStock = await prisma.finishedGoodsStock.findUnique({
//         where: { storeId_productItemId: { storeId: dbStores[0].storeId, productItemId: prd.id } }
//       });
//       if (!existingFgStock) {
//         await prisma.finishedGoodsStock.create({
//           data: {
//             storeId: dbStores[0].storeId,
//             productItemId: prd.id,
//             onHandQty: 500,
//           }
//         });
//         await prisma.finishedGoodsTransaction.create({
//           data: {
//             txnDateTime: new Date(),
//             storeId: dbStores[0].storeId,
//             productItemId: prd.id,
//             txnType: 'OPENING',
//             qty: 500,
//             remarks: 'Initial finished goods stock',
//             createdBy: "SYSTEM",
//           }
//         });
//       }
//     }
//   }

//   // -------------------------
//   // Production & Planning Data
//   // -------------------------
//   // console.log("🌱 Seeding Production & Planning Data...");

//   // const dbSalesOrders = await prisma.salesOrder.findMany();
//   // const dbMachines = await prisma.machine.findMany();
//   // const dbShifts = await prisma.shift.findMany();

//   // if (dbProducts.length > 0 && dbMachines.length > 0 && dbShifts.length > 0) {
//   //   const prodOrderId = "PROD-1001";
//   //   const existingProdOrder = await prisma.productionOrder.findUnique({ where: { productionOrderId: prodOrderId } });

//   //   // We get the first sales order if it exists, otherwise it will be null (optional field)
//   //   const sourceSalesOrderId = dbSalesOrders.length > 0 ? dbSalesOrders[0].orderNo : null;

//   //   if (!existingProdOrder) {
//   //     await prisma.productionOrder.create({
//   //       data: {
//   //         productionOrderId: prodOrderId,
//   //         orderDate: new Date(),
//   //         dueDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
//   //         productItemId: dbProducts[0].id,
//   //         targetQty: 5000,
//   //         uom: "PCS",
//   //         priority: "HIGH",
//   //         sourceSalesOrderId: sourceSalesOrderId,
//   //         status: "READY_FOR_PLANNING", // Set status so it appears in the Weekly Schedule dropdown
//   //       }
//   //     });
//   //   }
//   // }

//   // -------------------------
//   // Company, Customers & Suppliers Data
//   // -------------------------
//   // console.log("🌱 Seeding Company, Customers & Suppliers Data...");

//   // const adminUserForSeed = await prisma.user.findFirst({ where: { role: { code: 'ROLE_ADMIN' } } });
//   // const createdByUserId = adminUserForSeed?.userId || 'system';

//   // // Ensure a Company exists
//   // let mainCompany = await prisma.company.findFirst();
//   // if (!mainCompany) {
//   //   mainCompany = await prisma.company.create({
//   //     data: {
//   //       companyCode: 'COMP001',
//   //       companyName: 'Sunsea Operations Ltd',
//   //       legalName: 'Sunsea Operations Private Limited',
//   //       shortName: 'Sunsea',
//   //       cin: 'U12345TN2023PTC123456',
//   //       pan: 'ABCDE1234F',
//   //       gstin: '33ABCDE1234F1Z5',
//   //       tan: 'CHNM12345E',
//   //       msmeNumber: 'UDYAM-TN-02-0123456',
//   //       ieCode: '0123456789',
//   //       currencyCode: 'INR',
//   //       financialYearFrom: 4,
//   //       phone: '044-12345678',
//   //       mobile: '9876543210',
//   //       email: 'info@sunsea.com',
//   //       website: 'https://www.sunsea.com',
//   //       logoUrl: 'https://www.sunsea.com/logo.png',
//   //       isActive: true,
//   //     }
//   //   });
//   // }


//   // Seed Sizes
//   const sizeCount = await prisma.size.count();
//   if (sizeCount === 0) {
//     await prisma.size.createMany({
//       data: [
//         { sizeCode: "SZ-20L", sizeName: "20 Liters", description: "Volume 20L", isActive: true },
//         { sizeCode: "SZ-10L", sizeName: "10 Liters", description: "Volume 10L", isActive: true },
//         { sizeCode: "SZ-5L", sizeName: "5 Liters", description: "Volume 5L", isActive: true },
//         { sizeCode: "SZ-25KG", sizeName: "25 Kilograms", description: "Weight 25KG", isActive: true },
//         { sizeCode: "SZ-SMALL", sizeName: "Small", description: "Standard Small", isActive: true },
//         { sizeCode: "SZ-LARGE", sizeName: "Large", description: "Standard Large", isActive: false },
//       ]
//     });
//   }
//   // Seed Super Admin
//   const adminRoleFromDbForSeed = await prisma.role.findUnique({
//     where: { code: "ROLE_ADMIN" }
//   });

//   if (adminRoleFromDbForSeed) {
//     const adminPasswordHash = await bcrypt.hash('admin123', 10);
    
//     await prisma.admin.upsert({
//       where: { username: 'admin' },
//       update: {
//         roleId: adminRoleFromDbForSeed.id
//       },
//       create: {
//         fullName: 'Super Admin',
//         email: 'admin@sunsea.com',
//         username: 'admin',
//         passwordHash: adminPasswordHash,
//         status: UserStatus.active,
//         roleId: adminRoleFromDbForSeed.id
//       }
//     });
//     console.log("🌱 Super Admin created/updated with role.");
//   }

//   console.log('✅ Seed completed successfully!');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });