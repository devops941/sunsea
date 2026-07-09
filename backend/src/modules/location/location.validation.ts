import { z } from "zod";

/**
 * Create Location Validation
 */
export const createLocationSchema = z.object({
  body: z.object({
    locationId: z
      .string()
      .min(1, "Location ID is required")
      .max(20, "Location ID cannot exceed 20 characters"),

    locationCode: z
      .string()
      .max(30, "Location Code cannot exceed 30 characters")
      .optional(),

    locationName: z
      .string()
      .min(1, "Location Name is required")
      .max(100, "Location Name cannot exceed 100 characters"),

    locationType: z
      .string()
      .min(1, "Location Type is required")
      .max(50, "Location Type cannot exceed 50 characters"),

    address: z
      .string()
      .max(255, "Address cannot exceed 255 characters")
      .optional()
      .nullable(),

    city: z
      .string()
      .max(100, "City cannot exceed 100 characters")
      .optional()
      .nullable(),

    state: z
      .string()
      .max(100, "State cannot exceed 100 characters")
      .optional()
      .nullable(),

    country: z
      .string()
      .max(100, "Country cannot exceed 100 characters")
      .optional()
      .nullable(),

    isActive: z
      .boolean()
      .optional(),
  }),
});

/**
 * Update Location Validation
 */
export const updateLocationSchema = z.object({
  body: createLocationSchema
    .shape
    .body
    .omit({ locationId: true })
    .partial(),

  params: z.object({
    locationId: z
      .string()
      .min(1, "Location ID is required")
      .max(20),
  }),
});

/**
 * Location ID Validation
 */
export const locationIdSchema = z.object({
  params: z.object({
    locationId: z
      .string()
      .min(1, "Location ID is required")
      .max(20),
  }),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>["body"];
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>["body"];
