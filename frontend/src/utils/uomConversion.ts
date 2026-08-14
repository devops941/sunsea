import convert from "convert-units";

/**
 * Converts a quantity between two UOM codes using the same convert-units
 * library that backs the dynamic /uom/units and /uom/categories endpoints
 * (see backend/src/modules/uom/uom.service.ts). Codes coming out of
 * UOMSelect/useUOM are already the library's own abbreviations, so no
 * static lookup table is needed or should be maintained here.
 */
export const convertUomQty = (qty: number, fromCode?: string | null, toCode?: string | null): number => {
    if (!fromCode || !toCode || fromCode === toCode) return qty;
    try {
        return convert(qty).from(fromCode as any).to(toCode as any);
    } catch {
        // Units aren't known to convert-units or belong to different
        // categories (shouldn't happen since UOMSelect locks category) -
        // fall back to the raw quantity rather than corrupting it.
        return qty;
    }
};

/**
 * Converts a quantity expressed in `selectedUom` into the primary
 * (first-listed) unit of a comma-separated baseUom string, e.g.
 * baseUomStr = "kg,g" with selectedUom = "g" converts grams to kilograms.
 */
export const convertToPrimaryUom = (qty: number, selectedUom: string, baseUomStr: string): number => {
    if (!baseUomStr || !selectedUom) return qty;
    const primary = baseUomStr.split(",")[0]?.trim();
    return convertUomQty(qty, selectedUom, primary);
};

/**
 * Splits a comma-separated baseUom string (e.g. "kg,g") into its primary
 * (first-listed) unit and the remaining secondary units.
 */
export const parseBaseUom = (uomStr?: string): { primary: string; secondary: string; list: string[] } => {
    if (!uomStr) return { primary: "N/A", secondary: "None", list: [] };
    const list = uomStr.split(',').map(u => u.trim()).filter(Boolean);
    if (list.length === 0) return { primary: "N/A", secondary: "None", list: [] };
    const primary = list[0];
    const secondaryList = list.slice(1);
    const secondary = secondaryList.length > 0 ? secondaryList.join(', ') : "None";
    return { primary, secondary, list };
};

/**
 * Formats a stock quantity for display, normalizing it to the display unit
 * implied by the primary (first-listed) code in a comma-separated baseUom
 * string (e.g. 200 with baseUom "g,kg" -> "0.2 kg").
 */
export const formatStockQty = (qty: number | string | null | undefined, uomStr?: string): string => {
    const num = Number(qty ?? 0);
    if (isNaN(num)) return `0 kg`;
    if (!uomStr) return `${num} kg`;

    const firstCode = uomStr.split(',')[0].trim().toLowerCase();

    // Mass conversion to primary unit kg (e.g., 200 g -> 0.2 kg)
    if (firstCode === 'g' || firstCode === 'gram' || firstCode === 'grams' || firstCode === 'gm') {
        const kgVal = num / 1000;
        return `${Number(kgVal.toFixed(3))} kg`;
    }
    if (firstCode === 't' || firstCode === 'ton' || firstCode === 'tons') {
        return `${Number((num * 1000).toFixed(3))} kg`;
    }
    if (firstCode === 'kg' || firstCode === 'kilogram' || firstCode === 'kilo' || firstCode === 'kgs') {
        return `${Number(num.toFixed(3))} kg`;
    }

    // Volume conversion to L
    if (firstCode === 'ml') {
        const lVal = num / 1000;
        return `${Number(lVal.toFixed(3))} L`;
    }
    if (firstCode === 'l' || firstCode === 'ltr' || firstCode === 'litre' || firstCode === 'litres') {
        return `${Number(num.toFixed(3))} L`;
    }

    // Count
    if (firstCode === 'ea' || firstCode === 'each' || firstCode === 'pcs') {
        return `${num} pcs`;
    }
    if (firstCode === 'dz' || firstCode === 'dozen') {
        return `${num * 12} pcs`;
    }

    return `${num} ${firstCode}`;
};
