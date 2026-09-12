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

/**
 * onBlur handler for amount inputs — formats value to 2 decimal places.
 * Usage: <input onBlur={formatAmountOnBlur((formatted) => updateRow(id, "amount", formatted))} />
 */
export const formatAmountOnBlur = (onUpdate: (formatted: string) => void) =>
  (e: React.FocusEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) onUpdate(v.toFixed(2));
  };

/**
 * Wraps a react-hook-form field to format its value to 2 decimal places on blur.
 * Usage with Controller: <CtrlText field={withDecimalFormat(field)} ... />
 */
export const withDecimalFormat = (field: { value: any; onChange: (v: any) => void; onBlur: () => void; [key: string]: any }) => ({
  ...field,
  onBlur: () => {
    field.onBlur();
    const num = parseFloat(field.value || "0");
    field.onChange(isNaN(num) ? "0.00" : num.toFixed(2));
  },
});

export const formatAmount = (value: number) => {
  return value % 1 === 0
    ? value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};