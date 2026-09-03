import type { Product } from "../product/types";

export interface ProductPricing {
  id: number;
  productId: number;
  gstRate?: number | null;
  cess?: number | null;
  unitPrice?: number | null;
  mrp?: number | null;
  minSalePrice?: number | null;
  distributorPrice?: number | null;
  wholesalePrice?: number | null;
  directPrice?: number | null;
  product?: Product;
}

export interface CreateProductPricingDto {
  productId: string;
  gstRate?: number;
  cess?: number;
  unitPrice?: number;
  mrp?: number;
  minSalePrice?: number;
  distributorPrice?: number;
  wholesalePrice?: number;
  directPrice?: number;
}

export interface UpdateProductPricingDto {
  gstRate?: number;
  cess?: number;
  unitPrice?: number;
  mrp?: number;
  minSalePrice?: number;
  distributorPrice?: number;
  wholesalePrice?: number;
  directPrice?: number;
}
