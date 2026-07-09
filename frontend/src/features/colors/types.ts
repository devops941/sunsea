export interface Color {
  id: number;
  code: string;
  name: string;
  hexCode?: string;
  hexCode2?: string;
  colorType?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateColorDto {
  code: string;
  name: string;
  hexCode?: string;
  hexCode2?: string;
  colorType?: string;
  status?: string;
}

export interface UpdateColorDto {
  code?: string;
  name?: string;
  hexCode?: string;
  hexCode2?: string;
  colorType?: string;
  status?: string;
}

export interface ColorState {
  data: Color[];
  loading: boolean;
  error: string | null;
}
