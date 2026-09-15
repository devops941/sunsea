import { z } from "zod";

export enum TechnologyType {
  INJECTION_MOULDING = "INJECTION_MOULDING",
  EXTRUSION = "EXTRUSION",
  BLOW_MOULDING = "BLOW_MOULDING",
  ROTATIONAL_MOULDING = "ROTATIONAL_MOULDING",
  THERMOFORMING = "THERMOFORMING",
  COMPRESSION_MOULDING = "COMPRESSION_MOULDING",
  PRINTING = "PRINTING",
  GRANULATION = "GRANULATION",
  MIXING = "MIXING",
  RECYCLING = "RECYCLING"
}

export enum MachineType {
  PRODUCTION = "PRODUCTION",
  UTILITY = "UTILITY"
}

export enum MachineStatus {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  BREAKDOWN = "BREAKDOWN",
  MAINTENANCE = "MAINTENANCE"
}

export const createMachineSchema = z.object({
  body: z.object({
    machineId: z.string().min(1).max(20),
    machineName: z.string().min(1).max(100),
    technologyType: z.string().min(1),
    machineType: z.string().min(1),
    manufacturer: z.string().max(100).optional().nullable(),
    modelNumber: z.string().max(50).optional().nullable(),
    cycleTime: z.number().optional().nullable(),
    operatorId: z.string().max(20).optional().nullable().or(z.literal("")),
    machineStatus: z.nativeEnum(MachineStatus).optional(),
    isActive: z.boolean().optional(),
    description: z.string().max(255).optional().nullable(),
    targetTemperature: z.number().optional().nullable(),
    targetLoadPercent: z.number().optional().nullable(),
  }),
});

export const updateMachineSchema = z.object({
  body: createMachineSchema.shape.body.omit({ machineId: true }).partial(),
  params: z.object({
    machineId: z.string().min(1).max(20),
  }),
});

export const machineIdSchema = z.object({
  params: z.object({
    machineId: z.string().min(1).max(20),
  }),
});

export type CreateMachineInput = z.infer<typeof createMachineSchema>["body"];
export type UpdateMachineInput = z.infer<typeof updateMachineSchema>["body"];
