export interface SubCategory {
  id: number;
  code: string;
  name: string;
  parentCategoryId: number;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: number;
    name: string;
    code: string;
  };
}

export interface CreateSubCategoryDto {
  code: string;
  name: string;
  parentCategoryId: number;
  description?: string;
  status?: string;
}

export interface UpdateSubCategoryDto {
  code?: string;
  name?: string;
  parentCategoryId?: number;
  description?: string;
  status?: string;
}

export interface SubCategoryState {
  data: SubCategory[];
  loading: boolean;
  error: string | null;
}
