import { z } from "zod";
import { standardConverter } from "../../utils/convert.util";

// Retrieve standard convert-units dynamically to validate UOM codes
const possibilities = standardConverter().possibilities();

const uomCodeEnum = z.custom<string>((val) => {
  return typeof val === "string" && possibilities.includes(val as any);
}, {
  message: `UOM Code must be a valid standard converter unit.`,
});

export const createUomSchema = z.object({
  body: z.object({
    uomCode: uomCodeEnum,
    uomName: z
      .string()
      .min(1, "UOM Name is required")
      .max(50, "UOM Name cannot exceed 50 characters"),
    isActive: z.boolean().optional(),
  }),
});

export const updateUomSchema = z.object({
  body: z.object({
    uomCode: uomCodeEnum.optional(),
    uomName: z
      .string()
      .min(1, "UOM Name is required")
      .max(50, "UOM Name cannot exceed 50 characters")
      .optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

export const uomIdSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

export type CreateUomInput = z.infer<typeof createUomSchema>["body"];
export type UpdateUomInput = z.infer<typeof updateUomSchema>["body"];