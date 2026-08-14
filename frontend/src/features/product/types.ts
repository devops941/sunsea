import type { Category } from "../categories/types";
import type { UOM } from "../uoms/types";

export type ProductType = "PRODUCTION" | "SALES_PRODUCTION";

export interface Product {
  id: string;
  productCode: string;
  itemCode: string | null;
  productName: string;
  displayName: string | null;
  description: string | null;
  categoryId: number;
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
  category?: Category;
  uom?: UOM | null;
  hsnCode?: string | null;
  gstRate?: number | null;
  cess?: number | null;
  b2b?: number | null;
  mrp?: number | null;
  b2c?: number | null;
  exportPrice?: number | null;
  minimumQty?: string;
  maximumQty?: string;
}


export interface CreateProductDto {
  productCode: string;
  productName: string;
  categoryId: string;
  itemCode?: string;
  displayName?: string;
  description?: string;
  uomId?: string;
  capacityLitres?: number;
  typeCode?: string;
  productType?: ProductType;
  bundleQty?: number;
  weightPerPiece?: number;
  dimensions?: string;
  mouldReference?: string;
  tags?: string;
  isActive?: boolean;
  minimumQty?: number;
  maximumQty?: number;
}

export interface UpdateProductDto {
  productCode?: string;
  productName?: string;
  categoryId?: string;
  itemCode?: string;
  displayName?: string;
  description?: string;
  uomId?: string;
  capacityLitres?: number;
  typeCode?: string;
  productType?: ProductType;
  bundleQty?: number;
  weightPerPiece?: number;
  dimensions?: string;
  mouldReference?: string;
  tags?: string;
  isActive?: boolean;
  minimumQty?: number;
  maximumQty?: number;
}

export interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;
}
