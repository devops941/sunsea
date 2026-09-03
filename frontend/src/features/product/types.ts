import type { UOM } from "../uoms/types";
import type { Category } from "../categories/types";

export type ProductType = "PRODUCTION" | "SALES_PRODUCTION";

export interface Product {
  id: string;
  productCode: string;
  itemCode: string | null;
  productName: string;
  displayName: string | null;
  description: string | null;
  uomId: number | null;
  capacityLitres: number | null;
  typeCode: string | null;
  productType: ProductType;
  bundleQty: number | null;
  weightPerPiece: number | null;
  weightUom?: string;
  dimensions: string | null;
  mouldReference: string | null;
  tags: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  uom?: UOM | null;
  rate?: number | null;
  /** Grade-based dynamic pricing. Keys are grade names (e.g. "A", "B", "C"), values are prices. */
  gradeRates?: Record<string, number> | null;
  gstRate?: number | null;
  cess?: number | null;
  b2b?: number | null;
  mrp?: number | null;
  b2c?: number | null;
  exportPrice?: number | null;
  minimumQty?: string;
  categoryId?: number | null;
  category?: Category | null;
}


export interface CreateProductDto {
  productCode: string;
  productName: string;
  itemCode?: string;
  displayName?: string;
  description?: string;
  uomId?: string;
  typeCode?: string;
  productType?: ProductType;
  bundleQty?: number;
  weightPerPiece?: number;
  dimensions?: string;
  mouldReference?: string;
  tags?: string;
  isActive?: boolean;
  minimumQty?: number;
  gradeRates?: Record<string, number>;
  categoryId?: number | null;
}

export interface UpdateProductDto {
  productCode?: string;
  productName?: string;
  itemCode?: string;
  displayName?: string;
  description?: string;
  uomId?: string;
  typeCode?: string;
  productType?: ProductType;
  bundleQty?: number;
  weightPerPiece?: number;
  dimensions?: string;
  mouldReference?: string;
  tags?: string;
  isActive?: boolean;
  minimumQty?: number;
  gradeRates?: Record<string, number>;
  categoryId?: number | null;
}

export interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;
}
