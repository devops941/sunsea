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

// Mass units supported by convert-units (display target: kg)
const MASS_UNITS = new Set(['mcg', 'mg', 'g', 'kg', 'mt', 'oz', 'lb', 't']);
// Volume units supported by convert-units (display target: l)
const VOLUME_UNITS = new Set(['ml', 'l', 'fl-oz', 'cup', 'pnt', 'qt', 'gal', 'ft3', 'yd3']);
// Length units supported by convert-units (display target: m)
const LENGTH_UNITS = new Set(['mm', 'cm', 'm', 'km', 'in', 'ft-us', 'ft', 'fathom', 'mi', 'nMi']);

/**
 * Formats a stock quantity for display using the primary (first-listed) UOM code
 * in a comma-separated baseUom string (e.g. "g, kg, mt" -> displays in "g").
 *
 * It uses the raw stored quantity (which is already stored in primary UOM)
 * and formats it cleanly with the primary unit.
 */
export const formatStockQty = (qty: number | string | null | undefined, uomStr?: string): string => {
    const num = Number(qty ?? 0);
    if (isNaN(num)) return `0`;
    if (!uomStr) return `${num}`;

    const primaryCode = uomStr.split(',')[0].trim();
    if (!primaryCode) return `${num}`;

    let displayUnit = primaryCode;
    const lower = primaryCode.toLowerCase();
    if (lower === 'ea' || lower === 'each') {
        displayUnit = 'pcs';
    }

    const formattedNum = Number(num.toFixed(3));
    return `${formattedNum} ${displayUnit}`;
};

/**
 * Returns the relevant list of UOM options for a given UOM string or base UOM code.
 * E.g. "kg" → ["kg", "g", "mt", "t"], "g,kg" → ["g", "kg"], "pcs" → ["pcs"]
 */
export const getUomOptions = (uomStr?: string): string[] => {
    if (!uomStr) return ["pcs"];
    const listFromStr = uomStr.split(",").map((u) => u.trim()).filter(Boolean);
    if (listFromStr.length > 1) return Array.from(new Set(listFromStr));

    const primary = listFromStr[0].toLowerCase();
    if (primary === "kg") return ["kg", "g", "mt", "t"];
    if (primary === "g") return ["g", "kg"];
    if (primary === "l" || primary === "ltr") return ["ltr", "ml"];
    if (primary === "ml") return ["ml", "ltr"];
    if (primary === "m") return ["m", "cm", "mm"];
    if (primary === "dz") return ["dz", "pcs"];

    return [listFromStr[0] || "pcs"];
};
