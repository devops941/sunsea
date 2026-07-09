export interface Shift {
  id: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDuration?: string | number | null;
  gracePeriod?: string | number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftDto {
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDuration?: string | number | null;
  gracePeriod?: string | number | null;
  isActive?: boolean;
}

export type UpdateShiftDto = Partial<CreateShiftDto>;

export interface ShiftState {
  data: Shift[];
  loading: boolean;
  error: string | null;
}
