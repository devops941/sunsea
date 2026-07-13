import { z } from "zod";

// FormData/multipart fields always arrive as strings, even for numbers and
// booleans. z.coerce.number() converts "20" -> 20 before validating; plain
// z.number() would reject the string and fail validation on every request
// that uses FormData (which is required once an image file is involved).
export const createProductSchema = z.object({
  body: z.object({
    productCode: z.string().min(1),
    productName: z.string().min(1),

    categoryId: z.string(),
    // subCategoryId: z.string(),

    itemCode: z.string().optional(),
    displayName: z.string().optional(),
    description: z.string().optional(),

    uomId: z.string().optional(),
    colorId: z.string().optional(),
    sizeId: z.string().optional(),

    capacityLitres: z.coerce.number().optional(),

    typeCode: z.string().optional(),

    bundleQty: z.coerce.number().optional(),

    weightPerPiece: z.coerce.number().optional(),

    dimensions: z.string().optional(),

    mouldReference: z.string().optional(),

    tags: z.string().optional(),

    minimumQty: z.string().optional(),
    maximumQty: z.string().optional(),

    // FormData booleans also arrive as the literal strings "true"/"false"
    isActive: z
      .union([z.literal("true"), z.literal("false")])
      .optional(),
      
    openingStockQty: z.string().optional(),
    openingStockStoreId: z.string().optional(),
  }),
});

// Ids of existing ProductImage rows the user removed in the edit form.
// Multer/Express puts repeated same-name fields into an array automatically,
// but if only ONE is removed it arrives as a bare string instead of a
// 1-item array — z.preprocess normalizes both shapes to string[] before
// validation runs, and z.coerce.number() further down turns each id into
// a number for the Prisma `in` filter.
const removedImageIdsField = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value : [value];
  },
  z.array(z.coerce.number().int().positive())
).optional();

export const updateProductSchema = z.object({
  body: createProductSchema.shape.body.partial().extend({
    // Existing images to delete. Sent by the edit form as repeated
    // `removedImageIds` fields (one per removed image).
    removedImageIds: removedImageIdsField,

    // Id of the EXISTING image that should become primary. Only relevant
    // when no new images were uploaded — if new images are present, the
    // first new upload is treated as primary instead (see product.service).
    primaryImageId: z.coerce.number().int().positive().optional(),
  }),

  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
});

export const productIdSchema = z.object({
  params: z.object({
    id: z.string().regex(
      /^\d+$/,
      "Invalid product id"
    ),
  }),
});