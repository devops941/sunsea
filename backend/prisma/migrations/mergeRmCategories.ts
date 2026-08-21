/**
 * Migration: Merge raw_material_categories into categories table
 *
 * Run BEFORE `prisma db push`:
 *   npx ts-node prisma/migrations/mergeRmCategories.ts
 *
 * Then run:
 *   npx prisma db push
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration: merge raw_material_categories → categories");

  // 1. Fetch all existing RM categories
  const rmCategories = await (prisma as any).$queryRaw<
    {
      id: number;
      category_code: string;
      category_name: string;
      description: string | null;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }[]
  >`SELECT id, category_code, category_name, description, is_active, created_at, updated_at FROM raw_material_categories`;

  console.log(`Found ${rmCategories.length} RM categories to migrate`);

  // 2. For each RM category, insert into categories table and capture new ID
  const idMap: Record<number, number> = {}; // oldRmId → newCategoryId

  for (const rmc of rmCategories) {
    // Check if a category with same code already exists (avoid duplicates on re-run)
    const existing = await (prisma as any).$queryRaw<{ id: number }[]>`
      SELECT id FROM categories WHERE category_code = ${rmc.category_code}
    `;

    let newId: number;
    if (existing.length > 0) {
      newId = existing[0].id;
      console.log(`  Skipped (already exists): ${rmc.category_code} → id=${newId}`);
    } else {
      const inserted = await (prisma as any).$queryRaw<{ id: number }[]>`
        INSERT INTO categories (category_code, category_name, description, category_type, is_active, created_at, updated_at)
        VALUES (
          ${rmc.category_code},
          ${rmc.category_name},
          ${rmc.description},
          'RAW_MATERIAL'::"CategoryType",
          ${rmc.is_active},
          ${rmc.created_at},
          ${rmc.updated_at}
        )
        RETURNING id
      `;
      newId = inserted[0].id;
      console.log(`  Inserted: ${rmc.category_code} (old id=${rmc.id}) → new id=${newId}`);
    }

    idMap[rmc.id] = newId;
  }

  // 3. Update raw_materials.category_id to point to new category IDs
  let updatedCount = 0;
  for (const [oldId, newId] of Object.entries(idMap)) {
    const result = await (prisma as any).$executeRaw`
      UPDATE raw_materials SET category_id = ${newId} WHERE category_id = ${Number(oldId)}
    `;
    updatedCount += result;
  }
  console.log(`Updated ${updatedCount} raw_material rows with new category_id`);

  // 4. Drop FK constraint from raw_materials → raw_material_categories (if exists)
  await (prisma as any).$executeRaw`
    ALTER TABLE raw_materials
    DROP CONSTRAINT IF EXISTS raw_materials_category_id_fkey
  `;
  console.log("Dropped FK constraint raw_materials → raw_material_categories");

  // 5. Drop raw_material_categories table
  await (prisma as any).$executeRaw`DROP TABLE IF EXISTS raw_material_categories CASCADE`;
  console.log("Dropped table: raw_material_categories");

  console.log("Migration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
