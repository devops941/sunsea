// src/utils/pricingUtils.ts

export type CustomerType = "B2B" | "B2C" | "Export" | string | undefined | null;

interface PriceableItem {
    unitPrice?: string | number | null;
    b2b?: string | number | null;
    b2c?: string | number | null;
    exportPrice?: string | number | null;
    product?: {
        mrp?: string | number | null;
        b2b?: string | number | null;
        b2c?: string | number | null;
        exportPrice?: string | number | null;
    } | null;
}

/**
 * Returns the correct unit price for an order item based on the
 * customer's type (B2B / B2C / Export). Falls back to item.unitPrice
 * or product.mrp if the customer type is missing/unrecognized.
 */
export const getUnitPrice = (item: PriceableItem): string | number => {
    return item.product?.b2b ?? item.b2b ?? item.unitPrice ?? item.product?.mrp ?? 0;
};