export interface StoreType {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStoreTypeDto {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateStoreTypeDto {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface StoreTypeState {
  data: StoreType[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}
