import { z } from "zod";

/**
 * Create Color Validation
 */
export const createColorSchema = z.object({
  body: z.object({
    colorCode: z
      .string()
      .min(2, "Color Code is required")
      .max(20),

    colorName: z
      .string()
      .min(2, "Color Name is required")
      .max(100),

    hexCode: z
      .string()
      .optional(),

    hexCode2: z
      .string()
      .optional(),

    colorType: z
      .enum(["sc", "mc"])
      .optional(),

    isActive: z
      .boolean()
      .optional(),
  }),
});

/**
 * Update Color Validation
 */
export const updateColorSchema = z.object({
  body: createColorSchema
    .shape
    .body
    .partial(),

  params: z.object({
    id: z
      .string()
      .regex(
        /^\d+$/,
        "Invalid color id"
      ),
  }),
});

/**
 * Color Id Validation
 */
export const colorIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(
        /^\d+$/,
        "Invalid color id"
      ),
  }),
});

export type CreateColorInput =
  z.infer<
    typeof createColorSchema
  >["body"];

export type UpdateColorInput =
  z.infer<
    typeof updateColorSchema
  >["body"];