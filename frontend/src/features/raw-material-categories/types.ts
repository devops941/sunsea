export interface RawMaterialCategory {
  id: number;
  code: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface CreateRawMaterialCategoryDto {
  code: string;
  name: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface UpdateRawMaterialCategoryDto {
  code?: string;
  name?: string;
  description?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface RawMaterialCategoryState {
  data: RawMaterialCategory[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}