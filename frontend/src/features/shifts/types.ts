export interface Shift {
  id: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDuration?: string | number | null;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdUserName?: string;
  updatedBy?: string;
  editHistory?: Array<{ updatedBy?: string; updatedByName?: string; updatedAt?: string | Date }>;
}

export interface CreateShiftDto {
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDuration?: string | number | null;

  isActive?: boolean;
}

export type UpdateShiftDto = Partial<CreateShiftDto>;

export interface ShiftState {
  data: Shift[];
  loading: boolean;
  error: string | null;
}
