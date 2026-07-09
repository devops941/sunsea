export interface UOM {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveUOM {
  id: number;
  uomCode: string;
  uomName: string;
  createdAt: string;
  updatedAt: string;
}


export interface CreateUOMDto {
  code: string;
  name: string;
  description?: string;
  status?: string;
}

export interface UpdateUOMDto {
  code?: string;
  name?: string;
  description?: string;
  status?: string;
}

export interface UOMState {
  data: UOM[];
  loading: boolean;
  error: string | null;
  activeData: ActiveUOM[];
  activeLoading: boolean;
  activeError: string | null;

}
