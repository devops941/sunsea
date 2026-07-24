-- CreateEnum
CREATE TYPE "public"."BusinessPlaceType" AS ENUM ('HEAD_OFFICE', 'BRANCH_OFFICE', 'FACTORY', 'WAREHOUSE', 'RETAIL_STORE');

-- CreateEnum
CREATE TYPE "public"."MachineStatus" AS ENUM ('IDLE', 'RUNNING', 'BREAKDOWN', 'MAINTENANCE', 'MATERIAL_WAITING', 'SETUP');

-- CreateEnum
CREATE TYPE "public"."MachineType" AS ENUM ('PRODUCTION', 'UTILITY');

-- CreateEnum
CREATE TYPE "public"."TechnologyType" AS ENUM ('INJECTION_MOULDING', 'EXTRUSION', 'BLOW_MOULDING', 'ROTATIONAL_MOULDING', 'THERMOFORMING', 'COMPRESSION_MOULDING', 'PRINTING', 'GRANULATION', 'MIXING', 'RECYCLING');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('active', 'suspended', 'locked');

-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENT', 'FLAT');

-- CreateEnum
CREATE TYPE "public"."EmployeeStatus" AS ENUM ('active', 'inactive', 'resigned', 'terminated');

-- CreateEnum
CREATE TYPE "public"."RoleStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'TOKEN_REFRESHED', 'LOGOUT_ALL_SESSIONS');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."SalesOrderStatus" AS ENUM ('DRAFT', 'PENDING_MD_APPROVAL', 'MD_APPROVED', 'MD_REJECTED', 'PENDING_CUSTOMER_APPROVAL', 'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED', 'CONFIRMED', 'QUOTATION_IN_PROGRESS', 'QUOTATION_COMPLETED', 'COMPLETED', 'CANCELLED', 'IN_PRODUCTION', 'PLANNED', 'MATERIAL_PENDING', 'MATERIAL_RESERVED', 'MATERIAL_ISSUED', 'SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'FG_RECEIVED', 'READY_FOR_DISPATCH', 'PARTIALLY_DISPATCHED', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "public"."TaxType" AS ENUM ('INTRA_STATE', 'INTER_STATE');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."WastageType" AS ENUM ('STARTUP', 'MACHINE_SETUP', 'QUALITY_REJECTION', 'RAW_MATERIAL_WASTE', 'SCRAP', 'REWORK', 'MACHINE_BREAKDOWN', 'POWER_FAILURE', 'MOULD_CHANGE', 'COLOR_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."WastageStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."AdjustmentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ItemCategoryType" AS ENUM ('RAW_MATERIAL', 'FINISHED_GOODS', 'SEMI_FINISHED', 'CONSUMABLE');

-- CreateTable
CREATE TABLE "public"."employees" (
    "id" BIGSERIAL NOT NULL,
    "empCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobile" VARCHAR(20),
    "email" VARCHAR(100),
    "dateOfJoining" TIMESTAMP(3),
    "departmentId" INTEGER,
    "status" "public"."EmployeeStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admins" (
    "id" BIGSERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMPTZ(6),

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "employeeId" BIGINT,
    "roleId" INTEGER,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'active',
    "mustChangePw" BOOLEAN NOT NULL DEFAULT false,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "lastLoginIp" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "createdBy" TEXT,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "adminId" BIGINT,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "loginAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "used" BOOLEAN NOT NULL DEFAULT false,
    "requestedIp" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" BIGINT,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."login_attempts" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "userAgent" TEXT,
    "attemptedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" BIGINT,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_log" (
    "id" BIGSERIAL NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityId" TEXT,
    "action" "public"."AuditAction" NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByAdmin" BIGINT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'ADMIN',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."RoleStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "public"."departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "contactPerson" VARCHAR(80),
    "whatsapp" VARCHAR(15),
    "email" VARCHAR(120),
    "gstin" VARCHAR(15),
    "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "aiRiskBand" VARCHAR(10),
    "aiRiskScore" INTEGER,
    "altPhone" VARCHAR(15),
    "bankAccount" JSONB,
    "billingAddressLine1" VARCHAR(255) NOT NULL,
    "billingCity" VARCHAR(100) NOT NULL,
    "billingState" VARCHAR(100) NOT NULL,
    "billingPincode" VARCHAR(20) NOT NULL,
    "collectionAgentId" BIGINT,
    "companyId" UUID NOT NULL,
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "customerCode" VARCHAR(20) NOT NULL,
    "customerType" VARCHAR(100) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "designation" VARCHAR(60),
    "displayName" VARCHAR(80),
    "firmName" VARCHAR(160) NOT NULL,
    "gstRegType" VARCHAR(20),
    "mobile" VARCHAR(15) NOT NULL,
    "pan" VARCHAR(10),
    "priceList" VARCHAR(20) DEFAULT 'Standard',
    "routeId" UUID,
    "searchTsv" tsvector,
    "shippingAddressLine1" VARCHAR(255),
    "shippingCity" VARCHAR(100),
    "shippingState" VARCHAR(100),
    "shippingPincode" VARCHAR(20),
    "stateCode" VARCHAR(2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "tcsRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tdsSection" VARCHAR(10),
    "updatedBy" TEXT,
    "id" UUID NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."companies" (
    "id" UUID NOT NULL,
    "companyCode" VARCHAR(20),
    "companyName" VARCHAR(160) NOT NULL,
    "legalName" VARCHAR(160),
    "shortName" VARCHAR(60),
    "gstin" VARCHAR(15),
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "phone" VARCHAR(20),
    "mobile" VARCHAR(20),
    "email" VARCHAR(120),
    "website" VARCHAR(200),
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "addressLine1" VARCHAR(255),
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "zipcode" VARCHAR(20),
    "country" VARCHAR(100),
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."whatsapp_configs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "phoneNumberId" VARCHAR(50) NOT NULL,
    "wabaId" VARCHAR(50) NOT NULL,
    "businessPhone" VARCHAR(20) NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."business_places" (
    "id" BIGSERIAL NOT NULL,
    "companyId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "public"."BusinessPlaceType" NOT NULL,
    "gstPlaceCode" VARCHAR(2),
    "phone" VARCHAR(20),
    "email" VARCHAR(120),
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "address" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."routes" (
    "id" UUID NOT NULL,
    "routeCode" TEXT NOT NULL,
    "routeName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplierMaterialPrice" (
    "id" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierMaterialPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "designation" VARCHAR(60),
    "mobile" VARCHAR(15) NOT NULL,
    "email" VARCHAR(120),
    "website" VARCHAR(200),
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "alt_phone" VARCHAR(15),
    "bank_holder" VARCHAR(80),
    "bank_ifsc" VARCHAR(11),
    "billing_address_line1" VARCHAR(255) NOT NULL,
    "billing_city" VARCHAR(100) NOT NULL,
    "billing_state" VARCHAR(100) NOT NULL,
    "billing_pincode" VARCHAR(20) NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "company_id" TEXT NOT NULL,
    "contact_person" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "display_name" VARCHAR(80),
    "gst_reg_type" VARCHAR(20),
    "lead_time_days" SMALLINT NOT NULL,
    "legal_name" VARCHAR(160) NOT NULL,
    "min_order_qty" DECIMAL(12,3),
    "msme_status" VARCHAR(10),
    "on_time_pct" DECIMAL(5,2),
    "payment_terms" VARCHAR(20) NOT NULL,
    "state_code" VARCHAR(2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "supplier_code" VARCHAR(20) NOT NULL,
    "tds_section" VARCHAR(10),
    "udyam_no" VARCHAR(20),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" TEXT,
    "upi_id" VARCHAR(50),
    "vendor_type" VARCHAR(20) NOT NULL,
    "bank_account" JSONB,
    "raw_material_categories" VARCHAR(255),
    "whatsapp" VARCHAR(15),
    "id" SERIAL NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_addresses" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "address" JSONB NOT NULL,
    "state_code" VARCHAR(2) NOT NULL,
    "supplier_id" INTEGER NOT NULL,

    CONSTRAINT "supplier_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shifts" (
    "id" SERIAL NOT NULL,
    "shiftCode" TEXT NOT NULL,
    "shiftName" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakDuration" INTEGER,
    "gracePeriod" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" SERIAL NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sub_categories" (
    "id" SERIAL NOT NULL,
    "subCategoryCode" TEXT NOT NULL,
    "subCategoryName" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."colors" (
    "id" SERIAL NOT NULL,
    "colorCode" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "hexCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "colorType" TEXT DEFAULT 'sc',
    "hexCode2" TEXT,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sizes" (
    "id" SERIAL NOT NULL,
    "sizeCode" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_images" (
    "id" BIGSERIAL NOT NULL,
    "productId" BIGINT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_color_type_prices" (
    "id" BIGSERIAL NOT NULL,
    "productId" BIGINT NOT NULL,
    "colorType" VARCHAR(10) NOT NULL,
    "b2b" DECIMAL(12,2),
    "mrp" DECIMAL(12,2),
    "b2c" DECIMAL(12,2),
    "exportPrice" DECIMAL(12,2),

    CONSTRAINT "product_color_type_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" BIGSERIAL NOT NULL,
    "productCode" TEXT NOT NULL,
    "itemCode" TEXT,
    "productName" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "subCategoryId" INTEGER,
    "uomId" INTEGER,
    "capacityLitres" DECIMAL(6,2),
    "typeCode" TEXT,
    "bundleQty" INTEGER,
    "weightPerPiece" DECIMAL(10,2),
    "dimensions" TEXT,
    "mouldReference" TEXT,
    "tags" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "modifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sizeId" INTEGER,
    "cess" DECIMAL(5,2),
    "gstRate" DECIMAL(5,2),
    "gst_tax_rate_id" TEXT,
    "hsnCode" TEXT,
    "maximum_qty" TEXT NOT NULL DEFAULT '0',
    "minimum_qty" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."units_of_measure" (
    "id" SERIAL NOT NULL,
    "uomCode" TEXT NOT NULL,
    "uomName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_colors" (
    "id" BIGSERIAL NOT NULL,
    "productId" BIGINT NOT NULL,
    "colorId" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_sizes" (
    "id" BIGSERIAL NOT NULL,
    "productId" BIGINT NOT NULL,
    "sizeId" INTEGER NOT NULL,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "location_id" VARCHAR(20) NOT NULL,
    "location_code" VARCHAR(30) NOT NULL,
    "location_name" VARCHAR(100) NOT NULL,
    "location_type" VARCHAR(50) NOT NULL,
    "address" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "public"."machines" (
    "machine_id" VARCHAR(20) NOT NULL,
    "machine_name" VARCHAR(100) NOT NULL,
    "technologyType" "public"."TechnologyType",
    "machineType" "public"."MachineType",
    "capacity" DECIMAL(10,2),
    "target_temperature" DECIMAL(5,2),
    "target_load_percent" DECIMAL(5,2),
    "manufacturer" VARCHAR(100),
    "model_number" VARCHAR(50),
    "cycle_time" DECIMAL(10,2),
    "operator_id" VARCHAR(20),
    "machineStatus" "public"."MachineStatus" NOT NULL DEFAULT 'IDLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "businessPlaceId" BIGINT,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("machine_id")
);

-- CreateTable
CREATE TABLE "public"."stores" (
    "store_id" VARCHAR(20) NOT NULL,
    "store_name" VARCHAR(120) NOT NULL,
    "location_id" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "allow_negative" BOOLEAN NOT NULL DEFAULT false,
    "cost_method" VARCHAR(10) NOT NULL DEFAULT 'WAVG',
    "gst_place" VARCHAR(50),
    "incharge_id" BIGINT,
    "location_desc" VARCHAR(120),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "store_code" VARCHAR(20),
    "store_type_id" INTEGER,
    "businessPlaceId" BIGINT,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("store_id")
);

-- CreateTable
CREATE TABLE "public"."store_types" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_locations" (
    "id" TEXT NOT NULL,
    "store_id" VARCHAR(20) NOT NULL,
    "parent_id" TEXT,
    "location_code" VARCHAR(20) NOT NULL,
    "location_type" VARCHAR(15) NOT NULL,
    "capacity_qty" DECIMAL(12,3),
    "capacity_uom" VARCHAR(8),
    "status" VARCHAR(15) NOT NULL DEFAULT 'Active',

    CONSTRAINT "store_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."raw_material_categories" (
    "id" SERIAL NOT NULL,
    "category_code" VARCHAR(20) NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),

    CONSTRAINT "raw_material_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."raw_materials" (
    "raw_material_id" VARCHAR(20) NOT NULL,
    "material_name" VARCHAR(100) NOT NULL,
    "base_uom" VARCHAR(50) NOT NULL,
    "reorder_level" DECIMAL(14,3),
    "unit_price" DECIMAL(14,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "store_id" VARCHAR(20),
    "category_id" INTEGER,
    "hsn_code" VARCHAR(20),
    "lead_time_days" INTEGER,
    "minimum_stock" DECIMAL(14,3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "avg_cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "batch_no" VARCHAR(40),
    "last_movement_at" TIMESTAMP(3),
    "location_id" TEXT,
    "on_hand_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "qty_reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(255),
    "item_type" VARCHAR(50),
    "flagged_for_review" BOOLEAN NOT NULL DEFAULT false,
    "gst_tax_rate_id" TEXT,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("raw_material_id")
);

-- CreateTable
CREATE TABLE "public"."bill_of_materials" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "raw_material_id" VARCHAR(20) NOT NULL,
    "required_quantity" DECIMAL(12,3) NOT NULL,
    "uom" VARCHAR(10),
    "remarks" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finished_goods_stocks" (
    "store_id" VARCHAR(20) NOT NULL,
    "product_item_id" BIGINT NOT NULL,
    "on_hand_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finished_goods_stocks_pkey" PRIMARY KEY ("store_id","product_item_id")
);

-- CreateTable
CREATE TABLE "public"."finished_goods_transactions" (
    "fg_txn_id" BIGSERIAL NOT NULL,
    "txn_date_time" TIMESTAMP(3) NOT NULL,
    "store_id" VARCHAR(20) NOT NULL,
    "product_item_id" BIGINT NOT NULL,
    "txn_type" VARCHAR(30) NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "production_order_id" VARCHAR(20),
    "delivery_challan_id" VARCHAR(20),
    "invoice_id" VARCHAR(20),
    "related_doc_no" VARCHAR(30),
    "remarks" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(36),

    CONSTRAINT "finished_goods_transactions_pkey" PRIMARY KEY ("fg_txn_id")
);

-- CreateTable
CREATE TABLE "public"."production_orders" (
    "production_order_id" VARCHAR(20) NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "product_item_id" BIGINT NOT NULL,
    "target_qty" DECIMAL(14,3) NOT NULL,
    "uom" VARCHAR(10) NOT NULL,
    "source_sales_order_id" VARCHAR(20),
    "source_sales_order_line_id" BIGINT,
    "color_type" VARCHAR(10),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    "remarks" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "approved_at" TIMESTAMP(3),
    "approved_by" VARCHAR(36),
    "batch_no" VARCHAR(40),
    "bom_id" VARCHAR(20),
    "destination_store_id" VARCHAR(20),
    "due_date" TIMESTAMP(3) NOT NULL,
    "lot_no" VARCHAR(40),
    "machineMachineId" VARCHAR(20),
    "orderType" VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "produced_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "rejected_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "routing_id" VARCHAR(20),
    "scrap_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "source_store_id" VARCHAR(20),
    "required_raw_material_qty" DECIMAL(14,3),
    "weight_per_piece_used" DECIMAL(10,3),
    "draft_raw_materials" JSONB,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("production_order_id")
);

-- CreateTable
CREATE TABLE "public"."goods_dispatches" (
    "id" BIGSERIAL NOT NULL,
    "dispatch_number" VARCHAR(30) NOT NULL,
    "dispatch_date" DATE NOT NULL,
    "vehicle_number" VARCHAR(30) NOT NULL,
    "driver_name" VARCHAR(100) NOT NULL,
    "driver_mobile" VARCHAR(20),
    "transport_name" VARCHAR(100),
    "loading_time" VARCHAR(10),
    "remarks" VARCHAR(500),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_GATE_APPROVAL',
    "gate_approved_by" VARCHAR(36),
    "gate_approved_at" TIMESTAMP(3),
    "gate_remarks" VARCHAR(500),
    "store_received_by" VARCHAR(36),
    "store_received_at" TIMESTAMP(3),
    "store_remarks" VARCHAR(500),
    "destination_store_id" VARCHAR(20),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goods_dispatch_items" (
    "id" BIGSERIAL NOT NULL,
    "dispatch_id" BIGINT NOT NULL,
    "production_order_id" VARCHAR(20) NOT NULL,
    "product_item_id" BIGINT NOT NULL,
    "dispatch_qty" DECIMAL(14,3) NOT NULL,
    "uom" VARCHAR(10) NOT NULL,
    "received_qty" DECIMAL(14,3),
    "remarks" VARCHAR(255),

    CONSTRAINT "goods_dispatch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."weekly_machine_programs" (
    "weekly_program_id" VARCHAR(20) NOT NULL,
    "week_start_date" DATE NOT NULL,
    "week_end_date" DATE NOT NULL,
    "machine_id" VARCHAR(20),
    "day_of_week" INTEGER NOT NULL,
    "shift_id" VARCHAR(20),
    "planned_qty" DECIMAL(12,3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "remarks" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "approved_at" TIMESTAMP(3),
    "approved_by" VARCHAR(36),
    "planned_hours" DECIMAL(10,2),
    "priority" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "productId" BIGINT,
    "production_order_id" VARCHAR(20) NOT NULL,
    "sequence_no" INTEGER NOT NULL DEFAULT 1,
    "setup_hours" DECIMAL(10,2),

    CONSTRAINT "weekly_machine_programs_pkey" PRIMARY KEY ("weekly_program_id")
);

-- CreateTable
CREATE TABLE "public"."hourly_productions" (
    "hourly_production_id" BIGSERIAL NOT NULL,
    "production_order_id" VARCHAR(20) NOT NULL,
    "production_date" DATE NOT NULL,
    "shift_id" VARCHAR(20) NOT NULL,
    "machine_id" VARCHAR(20) NOT NULL,
    "hour_index" INTEGER NOT NULL,
    "qty_produced" DECIMAL(14,3) NOT NULL,
    "reject_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "scrap_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "downtime" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "runtime_minutes" DECIMAL(10,2) NOT NULL DEFAULT 60,
    "remarks" VARCHAR(255),
    "downtime_reason" VARCHAR(100),
    "reject_reason" VARCHAR(100),
    "scrap_reason" VARCHAR(100),
    "operator_id" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "daily_plan_id" VARCHAR(50),

    CONSTRAINT "hourly_productions_pkey" PRIMARY KEY ("hourly_production_id")
);

-- CreateTable
CREATE TABLE "public"."daily_production_plans" (
    "daily_plan_id" VARCHAR(50) NOT NULL,
    "weekly_program_id" VARCHAR(20) NOT NULL,
    "production_order_id" VARCHAR(20) NOT NULL,
    "production_date" DATE NOT NULL,
    "machine_id" VARCHAR(20) NOT NULL,
    "shift_id" VARCHAR(20) NOT NULL,
    "planned_qty" DECIMAL(12,3) NOT NULL,
    "planned_hours" DECIMAL(10,2),
    "priority" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "remarks" VARCHAR(255),
    "carry_forward_from_plan_id" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),

    CONSTRAINT "daily_production_plans_pkey" PRIMARY KEY ("daily_plan_id")
);

-- CreateTable
CREATE TABLE "public"."raw_material_transactions" (
    "rm_txn_id" BIGSERIAL NOT NULL,
    "store_id" VARCHAR(20) NOT NULL,
    "raw_material_id" VARCHAR(20) NOT NULL,
    "txn_type" VARCHAR(30) NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "txn_date_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "production_order_id" VARCHAR(20),

    CONSTRAINT "raw_material_transactions_pkey" PRIMARY KEY ("rm_txn_id")
);

-- CreateTable
CREATE TABLE "public"."sales_orders" (
    "id" SERIAL NOT NULL,
    "orderNo" VARCHAR(30) NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "expectedCompletionDate" TIMESTAMP(3) NOT NULL,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "customerId" UUID NOT NULL,
    "customerType" VARCHAR(20),
    "salesPersonId" BIGINT,
    "paymentTermId" INTEGER,
    "billingAddressLine1" VARCHAR(255) NOT NULL,
    "billingCity" VARCHAR(100) NOT NULL,
    "billingState" VARCHAR(100) NOT NULL,
    "billingPincode" VARCHAR(20) NOT NULL,
    "shippingAddressLine1" VARCHAR(255),
    "shippingCity" VARCHAR(100),
    "shippingState" VARCHAR(100),
    "shippingPincode" VARCHAR(20),
    "sameAsBilling" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "internalNotes" TEXT,
    "status" "public"."SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orderDiscountType" "public"."DiscountType" NOT NULL DEFAULT 'PERCENT',
    "orderDiscountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mdApprovalStatus" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "mdApprovedBy" TEXT,
    "mdApprovedAt" TIMESTAMP(3),
    "mdRejectionReason" TEXT,
    "md_approval_reason" VARCHAR(255),
    "credit_check_outstanding" DECIMAL(14,2),
    "credit_check_limit" DECIMAL(14,2),
    "credit_check_exceeded_by" DECIMAL(14,2),
    "customerApprovalStatus" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "customerApprovedAt" TIMESTAMP(3),
    "customerRejectionReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "dispatchType" TEXT,
    "orderType" TEXT,
    "production_status" VARCHAR(30) DEFAULT 'NOT_STARTED',
    "totalCgst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_order_items" (
    "id" BIGSERIAL NOT NULL,
    "salesOrderId" INTEGER NOT NULL,
    "productId" BIGINT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "gstTaxRateId" TEXT,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountType" "public"."DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mrp" DECIMAL(12,2),
    "b2b" DECIMAL(12,2),
    "b2c" DECIMAL(12,2),
    "exportPrice" DECIMAL(12,2),
    "taxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "colorType" VARCHAR(10) NOT NULL,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_orders" (
    "id" UUID NOT NULL,
    "poNumber" TEXT NOT NULL,
    "poDate" DATE NOT NULL,
    "expectedDeliveryDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "rejectReason" TEXT,
    "sameAsBilling" BOOLEAN NOT NULL DEFAULT false,
    "billingAddressLine1" TEXT NOT NULL,
    "billingCity" TEXT NOT NULL,
    "billingState" TEXT NOT NULL,
    "billingPincode" TEXT NOT NULL,
    "shippingAddressLine1" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingState" TEXT NOT NULL,
    "shippingPincode" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "companyId" UUID NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "store_id" VARCHAR(20),
    "discount_type" "public"."DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_order_items" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountType" "public"."DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."grn_invoices" (
    "id" UUID NOT NULL,
    "grn_number" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "grn_date" DATE NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "store_id" VARCHAR(20) NOT NULL,
    "billing_address_line1" TEXT NOT NULL,
    "billing_city" TEXT NOT NULL,
    "billing_state" TEXT NOT NULL,
    "billing_pincode" TEXT NOT NULL,
    "same_as_billing" BOOLEAN NOT NULL DEFAULT false,
    "update_stock" BOOLEAN NOT NULL DEFAULT false,
    "shipping_address_line1" TEXT NOT NULL,
    "shipping_city" TEXT NOT NULL,
    "shipping_state" TEXT NOT NULL,
    "shipping_pincode" TEXT NOT NULL,
    "receive_date" DATE,
    "bill_due_date" DATE,
    "challan_no" TEXT,
    "transport" TEXT,
    "eway_bill" TEXT,
    "invoice_image" TEXT,
    "remarks" TEXT,
    "discount_type" "public"."DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rounding_adjust" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',
    "payment_method" TEXT,
    "reference_number" TEXT,
    "payment_date" DATE,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "company_id" UUID NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "po_id" UUID,

    CONSTRAINT "grn_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."grn_invoice_items" (
    "id" UUID NOT NULL,
    "grn_invoice_id" UUID NOT NULL,
    "product_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grn_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gst_tax_rates" (
    "id" TEXT NOT NULL,
    "taxName" VARCHAR(50) NOT NULL,
    "taxType" "public"."TaxType" NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "status" "public"."Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."production_wastages" (
    "id" BIGSERIAL NOT NULL,
    "wastage_no" VARCHAR(30) NOT NULL,
    "wastage_date" DATE NOT NULL,
    "production_order_id" VARCHAR(20) NOT NULL,
    "hourly_production_id" BIGINT,
    "machine_id" VARCHAR(20) NOT NULL,
    "shift_id" VARCHAR(20) NOT NULL,
    "product_id" BIGINT NOT NULL,
    "raw_material_id" VARCHAR(20),
    "wastage_type" "public"."WastageType" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uom" VARCHAR(10) NOT NULL,
    "estimated_value" DECIMAL(18,2),
    "reason" VARCHAR(255),
    "corrective_action" VARCHAR(255),
    "remarks" VARCHAR(255),
    "is_recyclable" BOOLEAN NOT NULL DEFAULT false,
    "sent_for_rework" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" VARCHAR(36),
    "approved_at" TIMESTAMP(3),
    "status" "public"."WastageStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" VARCHAR(36) NOT NULL,
    "updated_by" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_wastages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_adjustments" (
    "adj_id" BIGSERIAL NOT NULL,
    "adjustment_number" VARCHAR(50) NOT NULL,
    "adjustment_date" TIMESTAMP(3) NOT NULL,
    "adjustment_type" VARCHAR(40) NOT NULL DEFAULT 'STOCK_INCREASE',
    "reason" VARCHAR(255),
    "status" "public"."AdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by" VARCHAR(36),
    "approved_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "source_document" VARCHAR(50),
    "source_doc_id" VARCHAR(50),
    "auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "type" VARCHAR(50),
    "production_order_id" VARCHAR(20),

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("adj_id")
);

-- CreateTable
CREATE TABLE "public"."stock_adjustment_items" (
    "adj_item_id" BIGSERIAL NOT NULL,
    "stock_adjustment_id" BIGINT NOT NULL,
    "item_type" "public"."ItemCategoryType" NOT NULL,
    "raw_material_id" VARCHAR(20),
    "product_item_id" BIGINT,
    "store_id" VARCHAR(20) NOT NULL,
    "current_qty" DECIMAL(14,3) NOT NULL,
    "adjusted_qty" DECIMAL(14,3) NOT NULL,
    "difference" DECIMAL(14,3) NOT NULL,
    "remarks" VARCHAR(255),
    "unit_cost" DECIMAL(14,2),
    "batch_no" VARCHAR(40),

    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("adj_item_id")
);

-- CreateTable
CREATE TABLE "public"."expenses" (
    "id" UUID NOT NULL,
    "expenseNumber" VARCHAR(30) NOT NULL,
    "expenseCategory" VARCHAR(60) NOT NULL,
    "date" DATE NOT NULL,
    "expense" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "paymentMethod" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "receiptInvoice" VARCHAR(255),
    "companyId" UUID NOT NULL,
    "supplierId" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_settings" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "invoice_prefix" VARCHAR(20) NOT NULL DEFAULT 'INV',
    "sequence_length" INTEGER NOT NULL DEFAULT 4,
    "current_sequence_number" INTEGER NOT NULL DEFAULT 1,
    "financial_year_start" DATE NOT NULL,
    "financial_year_end" DATE NOT NULL,
    "auto_financial_year" BOOLEAN NOT NULL DEFAULT true,
    "format_template" VARCHAR(100) NOT NULL DEFAULT '{PREFIX}-{FY}-{SEQ}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_invoices" (
    "id" UUID NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customer_id" UUID NOT NULL,
    "notes" TEXT,
    "sub_total" DECIMAL(14,2) NOT NULL,
    "tax_total" DECIMAL(14,2) NOT NULL,
    "grand_total" DECIMAL(14,2) NOT NULL,
    "company_id" UUID NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sales_order_id" INTEGER,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_invoice_items" (
    "id" UUID NOT NULL,
    "sales_invoice_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "description" TEXT,
    "uom" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."machine_oee_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "machine_id" VARCHAR(20) NOT NULL,
    "daily_plan_id" VARCHAR(50),
    "production_date" DATE NOT NULL,
    "shift_id" VARCHAR(20) NOT NULL,
    "planned_run_time" DECIMAL(10,2) NOT NULL,
    "actual_run_time" DECIMAL(10,2) NOT NULL,
    "total_downtime" DECIMAL(10,2) NOT NULL,
    "total_produced" DECIMAL(14,3) NOT NULL,
    "good_qty" DECIMAL(14,3) NOT NULL,
    "reject_qty" DECIMAL(14,3) NOT NULL,
    "availability" DECIMAL(5,2) NOT NULL,
    "performance" DECIMAL(5,2) NOT NULL,
    "quality" DECIMAL(5,2) NOT NULL,
    "oee_percent" DECIMAL(5,2) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_oee_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_empCode_key" ON "public"."employees"("empCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "public"."employees"("email");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "public"."employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "public"."employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "public"."admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "public"."admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "public"."users"("employeeId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "public"."users"("status");

-- CreateIndex
CREATE INDEX "users_employeeId_idx" ON "public"."users"("employeeId");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "public"."users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_sessionToken_key" ON "public"."user_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "user_sessions_userId_isActive_idx" ON "public"."user_sessions"("userId", "isActive");

-- CreateIndex
CREATE INDEX "user_sessions_adminId_isActive_idx" ON "public"."user_sessions"("adminId", "isActive");

-- CreateIndex
CREATE INDEX "user_sessions_sessionToken_idx" ON "public"."user_sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "public"."password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "public"."password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "login_attempts_username_idx" ON "public"."login_attempts"("username");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_idx" ON "public"."login_attempts"("ipAddress");

-- CreateIndex
CREATE INDEX "login_attempts_attemptedAt_idx" ON "public"."login_attempts"("attemptedAt");

-- CreateIndex
CREATE INDEX "login_attempts_userId_idx" ON "public"."login_attempts"("userId");

-- CreateIndex
CREATE INDEX "audit_log_entityName_entityId_idx" ON "public"."audit_log"("entityName", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_changedBy_idx" ON "public"."audit_log"("changedBy");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "public"."permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "public"."roles"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "public"."role_permissions"("permissionId");

-- CreateIndex
CREATE INDEX "idx_cust_company_status" ON "public"."customers"("companyId", "status");

-- CreateIndex
CREATE INDEX "idx_cust_route_agent" ON "public"."customers"("routeId", "collectionAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_companyId_customerCode_key" ON "public"."customers"("companyId", "customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "companies_companyCode_key" ON "public"."companies"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_configs_companyId_key" ON "public"."whatsapp_configs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "routes_routeCode_key" ON "public"."routes"("routeCode");

-- CreateIndex
CREATE INDEX "SupplierMaterialPrice_supplierId_rawMaterialId_validFrom_va_idx" ON "public"."SupplierMaterialPrice"("supplierId", "rawMaterialId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "suppliers_legal_name_idx" ON "public"."suppliers"("legal_name");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "public"."suppliers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_company_id_supplier_code_key" ON "public"."suppliers"("company_id", "supplier_code");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_shiftCode_key" ON "public"."shifts"("shiftCode");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_shiftName_key" ON "public"."shifts"("shiftName");

-- CreateIndex
CREATE UNIQUE INDEX "categories_categoryCode_key" ON "public"."categories"("categoryCode");

-- CreateIndex
CREATE UNIQUE INDEX "sub_categories_subCategoryCode_key" ON "public"."sub_categories"("subCategoryCode");

-- CreateIndex
CREATE INDEX "sub_categories_categoryId_idx" ON "public"."sub_categories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "sub_categories_id_categoryId_key" ON "public"."sub_categories"("id", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "colors_colorCode_key" ON "public"."colors"("colorCode");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_sizeCode_key" ON "public"."sizes"("sizeCode");

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "public"."product_images"("productId");

-- CreateIndex
CREATE INDEX "product_color_type_prices_productId_idx" ON "public"."product_color_type_prices"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_color_type_prices_productId_colorType_key" ON "public"."product_color_type_prices"("productId", "colorType");

-- CreateIndex
CREATE UNIQUE INDEX "products_productCode_key" ON "public"."products"("productCode");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "public"."products"("categoryId");

-- CreateIndex
CREATE INDEX "products_subCategoryId_idx" ON "public"."products"("subCategoryId");

-- CreateIndex
CREATE INDEX "products_uomId_idx" ON "public"."products"("uomId");

-- CreateIndex
CREATE INDEX "products_gst_tax_rate_id_idx" ON "public"."products"("gst_tax_rate_id");

-- CreateIndex
CREATE INDEX "products_sizeId_idx" ON "public"."products"("sizeId");

-- CreateIndex
CREATE INDEX "products_productName_idx" ON "public"."products"("productName");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_uomCode_key" ON "public"."units_of_measure"("uomCode");

-- CreateIndex
CREATE INDEX "product_colors_colorId_idx" ON "public"."product_colors"("colorId");

-- CreateIndex
CREATE UNIQUE INDEX "product_colors_productId_colorId_key" ON "public"."product_colors"("productId", "colorId");

-- CreateIndex
CREATE INDEX "product_sizes_sizeId_idx" ON "public"."product_sizes"("sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "product_sizes_productId_sizeId_key" ON "public"."product_sizes"("productId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_location_code_key" ON "public"."locations"("location_code");

-- CreateIndex
CREATE INDEX "locations_location_code_idx" ON "public"."locations"("location_code");

-- CreateIndex
CREATE INDEX "locations_is_active_idx" ON "public"."locations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "stores_store_code_key" ON "public"."stores"("store_code");

-- CreateIndex
CREATE INDEX "stores_store_type_id_idx" ON "public"."stores"("store_type_id");

-- CreateIndex
CREATE INDEX "stores_is_active_idx" ON "public"."stores"("is_active");

-- CreateIndex
CREATE INDEX "stores_location_id_idx" ON "public"."stores"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_types_code_key" ON "public"."store_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "store_locations_store_id_location_code_key" ON "public"."store_locations"("store_id", "location_code");

-- CreateIndex
CREATE UNIQUE INDEX "raw_material_categories_category_code_key" ON "public"."raw_material_categories"("category_code");

-- CreateIndex
CREATE UNIQUE INDEX "raw_material_categories_category_name_key" ON "public"."raw_material_categories"("category_name");

-- CreateIndex
CREATE INDEX "raw_material_categories_is_active_idx" ON "public"."raw_material_categories"("is_active");

-- CreateIndex
CREATE INDEX "raw_materials_category_id_idx" ON "public"."raw_materials"("category_id");

-- CreateIndex
CREATE INDEX "raw_materials_store_id_idx" ON "public"."raw_materials"("store_id");

-- CreateIndex
CREATE INDEX "raw_materials_location_id_idx" ON "public"."raw_materials"("location_id");

-- CreateIndex
CREATE INDEX "raw_materials_is_active_idx" ON "public"."raw_materials"("is_active");

-- CreateIndex
CREATE INDEX "raw_materials_gst_tax_rate_id_idx" ON "public"."raw_materials"("gst_tax_rate_id");

-- CreateIndex
CREATE INDEX "bill_of_materials_product_id_idx" ON "public"."bill_of_materials"("product_id");

-- CreateIndex
CREATE INDEX "bill_of_materials_raw_material_id_idx" ON "public"."bill_of_materials"("raw_material_id");

-- CreateIndex
CREATE INDEX "finished_goods_stocks_store_id_idx" ON "public"."finished_goods_stocks"("store_id");

-- CreateIndex
CREATE INDEX "finished_goods_stocks_product_item_id_idx" ON "public"."finished_goods_stocks"("product_item_id");

-- CreateIndex
CREATE INDEX "finished_goods_transactions_txn_date_time_idx" ON "public"."finished_goods_transactions"("txn_date_time");

-- CreateIndex
CREATE INDEX "finished_goods_transactions_store_id_idx" ON "public"."finished_goods_transactions"("store_id");

-- CreateIndex
CREATE INDEX "finished_goods_transactions_product_item_id_idx" ON "public"."finished_goods_transactions"("product_item_id");

-- CreateIndex
CREATE INDEX "finished_goods_transactions_txn_type_idx" ON "public"."finished_goods_transactions"("txn_type");

-- CreateIndex
CREATE INDEX "production_orders_order_date_idx" ON "public"."production_orders"("order_date");

-- CreateIndex
CREATE INDEX "production_orders_due_date_idx" ON "public"."production_orders"("due_date");

-- CreateIndex
CREATE INDEX "production_orders_product_item_id_idx" ON "public"."production_orders"("product_item_id");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "public"."production_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "goods_dispatches_dispatch_number_key" ON "public"."goods_dispatches"("dispatch_number");

-- CreateIndex
CREATE INDEX "goods_dispatches_status_idx" ON "public"."goods_dispatches"("status");

-- CreateIndex
CREATE INDEX "goods_dispatches_dispatch_date_idx" ON "public"."goods_dispatches"("dispatch_date");

-- CreateIndex
CREATE INDEX "goods_dispatch_items_dispatch_id_idx" ON "public"."goods_dispatch_items"("dispatch_id");

-- CreateIndex
CREATE INDEX "goods_dispatch_items_production_order_id_idx" ON "public"."goods_dispatch_items"("production_order_id");

-- CreateIndex
CREATE INDEX "weekly_machine_programs_production_order_id_idx" ON "public"."weekly_machine_programs"("production_order_id");

-- CreateIndex
CREATE INDEX "weekly_machine_programs_machine_id_idx" ON "public"."weekly_machine_programs"("machine_id");

-- CreateIndex
CREATE INDEX "weekly_machine_programs_shift_id_idx" ON "public"."weekly_machine_programs"("shift_id");

-- CreateIndex
CREATE INDEX "weekly_machine_programs_week_start_date_idx" ON "public"."weekly_machine_programs"("week_start_date");

-- CreateIndex
CREATE INDEX "weekly_machine_programs_status_idx" ON "public"."weekly_machine_programs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_machine_programs_machine_id_shift_id_week_start_date_key" ON "public"."weekly_machine_programs"("machine_id", "shift_id", "week_start_date", "day_of_week", "sequence_no");

-- CreateIndex
CREATE INDEX "hourly_productions_production_order_id_idx" ON "public"."hourly_productions"("production_order_id");

-- CreateIndex
CREATE INDEX "hourly_productions_machine_id_idx" ON "public"."hourly_productions"("machine_id");

-- CreateIndex
CREATE INDEX "hourly_productions_shift_id_idx" ON "public"."hourly_productions"("shift_id");

-- CreateIndex
CREATE INDEX "hourly_productions_daily_plan_id_idx" ON "public"."hourly_productions"("daily_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "hourly_productions_production_date_machine_id_shift_id_hour_key" ON "public"."hourly_productions"("production_date", "machine_id", "shift_id", "hour_index");

-- CreateIndex
CREATE INDEX "daily_production_plans_weekly_program_id_idx" ON "public"."daily_production_plans"("weekly_program_id");

-- CreateIndex
CREATE INDEX "daily_production_plans_production_order_id_idx" ON "public"."daily_production_plans"("production_order_id");

-- CreateIndex
CREATE INDEX "daily_production_plans_machine_id_idx" ON "public"."daily_production_plans"("machine_id");

-- CreateIndex
CREATE INDEX "daily_production_plans_shift_id_idx" ON "public"."daily_production_plans"("shift_id");

-- CreateIndex
CREATE INDEX "daily_production_plans_production_date_idx" ON "public"."daily_production_plans"("production_date");

-- CreateIndex
CREATE INDEX "daily_production_plans_status_idx" ON "public"."daily_production_plans"("status");

-- CreateIndex
CREATE INDEX "daily_production_plans_carry_forward_from_plan_id_idx" ON "public"."daily_production_plans"("carry_forward_from_plan_id");

-- CreateIndex
CREATE INDEX "raw_material_transactions_store_id_idx" ON "public"."raw_material_transactions"("store_id");

-- CreateIndex
CREATE INDEX "raw_material_transactions_raw_material_id_idx" ON "public"."raw_material_transactions"("raw_material_id");

-- CreateIndex
CREATE INDEX "raw_material_transactions_txn_date_time_idx" ON "public"."raw_material_transactions"("txn_date_time");

-- CreateIndex
CREATE INDEX "raw_material_transactions_production_order_id_idx" ON "public"."raw_material_transactions"("production_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_orderNo_key" ON "public"."sales_orders"("orderNo");

-- CreateIndex
CREATE INDEX "sales_orders_customerId_idx" ON "public"."sales_orders"("customerId");

-- CreateIndex
CREATE INDEX "sales_orders_mdApprovalStatus_idx" ON "public"."sales_orders"("mdApprovalStatus");

-- CreateIndex
CREATE INDEX "sales_orders_customerApprovalStatus_idx" ON "public"."sales_orders"("customerApprovalStatus");

-- CreateIndex
CREATE INDEX "sales_order_items_salesOrderId_idx" ON "public"."sales_order_items"("salesOrderId");

-- CreateIndex
CREATE INDEX "sales_order_items_productId_idx" ON "public"."sales_order_items"("productId");

-- CreateIndex
CREATE INDEX "sales_order_items_gstTaxRateId_idx" ON "public"."sales_order_items"("gstTaxRateId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "public"."purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "public"."purchase_orders"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_idx" ON "public"."purchase_orders"("companyId");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "public"."purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "grn_invoices_grn_number_key" ON "public"."grn_invoices"("grn_number");

-- CreateIndex
CREATE INDEX "grn_invoices_supplier_id_idx" ON "public"."grn_invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "grn_invoices_store_id_idx" ON "public"."grn_invoices"("store_id");

-- CreateIndex
CREATE INDEX "grn_invoices_company_id_idx" ON "public"."grn_invoices"("company_id");

-- CreateIndex
CREATE INDEX "grn_invoices_po_id_idx" ON "public"."grn_invoices"("po_id");

-- CreateIndex
CREATE INDEX "grn_invoice_items_grn_invoice_id_idx" ON "public"."grn_invoice_items"("grn_invoice_id");

-- CreateIndex
CREATE INDEX "grn_invoice_items_product_id_idx" ON "public"."grn_invoice_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_wastages_wastage_no_key" ON "public"."production_wastages"("wastage_no");

-- CreateIndex
CREATE INDEX "production_wastages_production_order_id_idx" ON "public"."production_wastages"("production_order_id");

-- CreateIndex
CREATE INDEX "production_wastages_hourly_production_id_idx" ON "public"."production_wastages"("hourly_production_id");

-- CreateIndex
CREATE INDEX "production_wastages_machine_id_idx" ON "public"."production_wastages"("machine_id");

-- CreateIndex
CREATE INDEX "production_wastages_shift_id_idx" ON "public"."production_wastages"("shift_id");

-- CreateIndex
CREATE INDEX "production_wastages_product_id_idx" ON "public"."production_wastages"("product_id");

-- CreateIndex
CREATE INDEX "production_wastages_wastage_date_idx" ON "public"."production_wastages"("wastage_date");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_adjustment_number_key" ON "public"."stock_adjustments"("adjustment_number");

-- CreateIndex
CREATE INDEX "stock_adjustments_adjustment_date_idx" ON "public"."stock_adjustments"("adjustment_date");

-- CreateIndex
CREATE INDEX "stock_adjustments_status_idx" ON "public"."stock_adjustments"("status");

-- CreateIndex
CREATE INDEX "stock_adjustments_adjustment_type_idx" ON "public"."stock_adjustments"("adjustment_type");

-- CreateIndex
CREATE INDEX "stock_adjustments_production_order_id_idx" ON "public"."stock_adjustments"("production_order_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_stock_adjustment_id_idx" ON "public"."stock_adjustment_items"("stock_adjustment_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_store_id_idx" ON "public"."stock_adjustment_items"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_companyId_expenseNumber_key" ON "public"."expenses"("companyId", "expenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_settings_companyId_key" ON "public"."invoice_settings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_invoice_no_key" ON "public"."sales_invoices"("invoice_no");

-- CreateIndex
CREATE INDEX "sales_invoices_customer_id_idx" ON "public"."sales_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "sales_invoices_company_id_idx" ON "public"."sales_invoices"("company_id");

-- CreateIndex
CREATE INDEX "sales_invoices_sales_order_id_idx" ON "public"."sales_invoices"("sales_order_id");

-- CreateIndex
CREATE INDEX "sales_invoice_items_sales_invoice_id_idx" ON "public"."sales_invoice_items"("sales_invoice_id");

-- CreateIndex
CREATE INDEX "sales_invoice_items_product_id_idx" ON "public"."sales_invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "machine_oee_snapshots_machine_id_production_date_idx" ON "public"."machine_oee_snapshots"("machine_id", "production_date");

-- CreateIndex
CREATE INDEX "machine_oee_snapshots_daily_plan_id_idx" ON "public"."machine_oee_snapshots"("daily_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "machine_oee_snapshots_machine_id_production_date_shift_id_key" ON "public"."machine_oee_snapshots"("machine_id", "production_date", "shift_id");

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."login_attempts" ADD CONSTRAINT "login_attempts_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."login_attempts" ADD CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_log" ADD CONSTRAINT "audit_log_changedByAdmin_fkey" FOREIGN KEY ("changedByAdmin") REFERENCES "public"."admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_log" ADD CONSTRAINT "audit_log_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_collectionAgentId_fkey" FOREIGN KEY ("collectionAgentId") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "public"."routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."business_places" ADD CONSTRAINT "business_places_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierMaterialPrice" ADD CONSTRAINT "SupplierMaterialPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_addresses" ADD CONSTRAINT "supplier_addresses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sub_categories" ADD CONSTRAINT "sub_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_color_type_prices" ADD CONSTRAINT "product_color_type_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_gst_tax_rate_id_fkey" FOREIGN KEY ("gst_tax_rate_id") REFERENCES "public"."gst_tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_subCategoryId_categoryId_fkey" FOREIGN KEY ("subCategoryId", "categoryId") REFERENCES "public"."sub_categories"("id", "categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "public"."units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_colors" ADD CONSTRAINT "product_colors_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."colors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_colors" ADD CONSTRAINT "product_colors_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_sizes" ADD CONSTRAINT "product_sizes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_sizes" ADD CONSTRAINT "product_sizes_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."machines" ADD CONSTRAINT "machines_businessPlaceId_fkey" FOREIGN KEY ("businessPlaceId") REFERENCES "public"."business_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stores" ADD CONSTRAINT "stores_businessPlaceId_fkey" FOREIGN KEY ("businessPlaceId") REFERENCES "public"."business_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stores" ADD CONSTRAINT "stores_incharge_id_fkey" FOREIGN KEY ("incharge_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stores" ADD CONSTRAINT "stores_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stores" ADD CONSTRAINT "stores_store_type_id_fkey" FOREIGN KEY ("store_type_id") REFERENCES "public"."store_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."store_locations" ADD CONSTRAINT "store_locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."store_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."store_locations" ADD CONSTRAINT "store_locations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."raw_materials" ADD CONSTRAINT "raw_materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."raw_material_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."raw_materials" ADD CONSTRAINT "raw_materials_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."store_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."raw_materials" ADD CONSTRAINT "raw_materials_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."raw_materials" ADD CONSTRAINT "raw_materials_gst_tax_rate_id_fkey" FOREIGN KEY ("gst_tax_rate_id") REFERENCES "public"."gst_tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bill_of_materials" ADD CONSTRAINT "bill_of_materials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bill_of_materials" ADD CONSTRAINT "bill_of_materials_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("raw_material_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_stocks" ADD CONSTRAINT "finished_goods_stocks_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_stocks" ADD CONSTRAINT "finished_goods_stocks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_transactions" ADD CONSTRAINT "finished_goods_transactions_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_transactions" ADD CONSTRAINT "finished_goods_transactions_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("production_order_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_transactions" ADD CONSTRAINT "finished_goods_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_orders" ADD CONSTRAINT "production_orders_machineMachineId_fkey" FOREIGN KEY ("machineMachineId") REFERENCES "public"."machines"("machine_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_orders" ADD CONSTRAINT "production_orders_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_dispatches" ADD CONSTRAINT "goods_dispatches_destination_store_id_fkey" FOREIGN KEY ("destination_store_id") REFERENCES "public"."stores"("store_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_dispatch_items" ADD CONSTRAINT "goods_dispatch_items_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."goods_dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_dispatch_items" ADD CONSTRAINT "goods_dispatch_items_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("production_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_dispatch_items" ADD CONSTRAINT "goods_dispatch_items_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."weekly_machine_programs" ADD CONSTRAINT "weekly_machine_programs_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."weekly_machine_programs" ADD CONSTRAINT "weekly_machine_programs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."weekly_machine_programs" ADD CONSTRAINT "weekly_machine_programs_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("production_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."weekly_machine_programs" ADD CONSTRAINT "weekly_machine_programs_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("shiftCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hourly_productions" ADD CONSTRAINT "hourly_productions_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hourly_productions" ADD CONSTRAINT "hourly_productions_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("production_order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hourly_productions" ADD CONSTRAINT "hourly_productions_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("shiftCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hourly_productions" ADD CONSTRAINT "hourly_productions_daily_plan_id_fkey" FOREIGN KEY ("daily_plan_id") REFERENCES "public"."daily_production_plans"("daily_plan_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_production_plans" ADD CONSTRAINT "daily_production_plans_weekly_program_id_fkey" FOREIGN KEY ("weekly_program_id") REFERENCES "public"."weekly_machine_programs"("weekly_program_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_production_plans" ADD CONSTRAINT "daily_production_plans_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("production_order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_production_plans" ADD CONSTRAINT "daily_production_plans_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_production_plans" ADD CONSTRAINT "daily_production_plans_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("shiftCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_production_plans" ADD CONSTRAINT "daily_production_plans_carry_forward_from_plan_id_fkey" FOREIGN KEY ("carry_forward_from_plan_id") REFERENCES "public"."daily_production_plans"("daily_plan_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."raw_material_transactions" ADD CONSTRAINT "raw_material_transactions_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("raw_material_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."raw_material_transactions" ADD CONSTRAINT "raw_material_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."raw_material_transactions" ADD CONSTRAINT "raw_material_transactions_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("production_order_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_mdApprovedBy_fkey" FOREIGN KEY ("mdApprovedBy") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_order_items" ADD CONSTRAINT "sales_order_items_gstTaxRateId_fkey" FOREIGN KEY ("gstTaxRateId") REFERENCES "public"."gst_tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_order_items" ADD CONSTRAINT "sales_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_order_items" ADD CONSTRAINT "sales_order_items_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grn_invoices" ADD CONSTRAINT "grn_invoices_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grn_invoices" ADD CONSTRAINT "grn_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grn_invoices" ADD CONSTRAINT "grn_invoices_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grn_invoice_items" ADD CONSTRAINT "grn_invoice_items_grn_invoice_id_fkey" FOREIGN KEY ("grn_invoice_id") REFERENCES "public"."grn_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grn_invoice_items" ADD CONSTRAINT "grn_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."raw_materials"("raw_material_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_wastages" ADD CONSTRAINT "production_wastages_hourly_production_id_fkey" FOREIGN KEY ("hourly_production_id") REFERENCES "public"."hourly_productions"("hourly_production_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_wastages" ADD CONSTRAINT "production_wastages_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_wastages" ADD CONSTRAINT "production_wastages_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_wastages" ADD CONSTRAINT "production_wastages_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("production_order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_wastages" ADD CONSTRAINT "production_wastages_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("raw_material_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_wastages" ADD CONSTRAINT "production_wastages_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("shiftCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("production_order_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("raw_material_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_stock_adjustment_id_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "public"."stock_adjustments"("adj_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_settings" ADD CONSTRAINT "invoice_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_invoices" ADD CONSTRAINT "sales_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."machine_oee_snapshots" ADD CONSTRAINT "machine_oee_snapshots_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE CASCADE ON UPDATE CASCADE;
