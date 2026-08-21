export type CategoryType = "PRODUCT" | "RAW_MATERIAL" | "WASTAGE";

export interface Category {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: CategoryType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  _count?: {
    rawMaterials: number;
    products: number;
  };
}

export interface CategoryState {
  data: Category[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

export interface CreateCategoryDto {
  code: string;
  name: string;
  description?: string | null;
  type: CategoryType;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string | null;
  type?: CategoryType;
  isActive?: boolean;
}

export interface FetchCategoriesParams {
  search?: string;
  type?: CategoryType;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
