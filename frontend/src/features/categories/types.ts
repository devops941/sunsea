export interface Category {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  code: string;
  name: string;
  description?: string;
  status?: string;
}

export interface UpdateCategoryDto {
  code?: string;
  name?: string;
  description?: string;
  status?: string;
}

export interface CategoryState {
  data: Category[];
  loading: boolean;
  error: string | null;
}
