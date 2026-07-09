export interface Location {
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface CreateLocationDto {
  locationId: string;
  locationCode?: string;
  locationName: string;
  locationType: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}

export interface UpdateLocationDto {
  locationName?: string;
  locationType?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}

export interface LocationState {
  data: Location[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}
