export interface Size {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSizeDto {
  code: string;
  name: string;
  description?: string;
  status?: string;
}

export interface UpdateSizeDto {
  code?: string;
  name?: string;
  description?: string;
  status?: string;
}

export interface SizeState {
  data: Size[];
  loading: boolean;
  error: string | null;
}
