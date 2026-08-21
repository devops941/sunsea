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
 * Formats a stock quantity for display, converting from the primary (first-listed)
 * UOM code in a comma-separated baseUom string to a human-readable display unit.
 *
 * Mass   → kg  (e.g. 1 mt → "1000 kg",  500 g → "0.5 kg")
 * Volume → L   (e.g. 500 ml → "0.5 L")
 * Length → m   (e.g. 100 cm → "1 m")
 * Each   → pcs (e.g. 2 dz → "24 pcs")
 *
 * Uses convert-units library for all conversions — no hardcoded factors.
 */
export const formatStockQty = (qty: number | string | null | undefined, uomStr?: string): string => {
    const num = Number(qty ?? 0);
    if (isNaN(num)) return `0 kg`;
    if (!uomStr) return `${num} kg`;

    const primaryCode = uomStr.split(',')[0].trim();
    const code = primaryCode.toLowerCase();

    // Mass → kg
    if (MASS_UNITS.has(code)) {
        if (code === 'kg') return `${Number(num.toFixed(3))} kg`;
        const inKg = convertUomQty(num, primaryCode, 'kg');
        return `${Number(inKg.toFixed(3))} kg`;
    }

    // Volume → L
    if (VOLUME_UNITS.has(code)) {
        if (code === 'l') return `${Number(num.toFixed(3))} L`;
        const inL = convertUomQty(num, primaryCode, 'l');
        return `${Number(inL.toFixed(3))} L`;
    }

    // Length → m
    if (LENGTH_UNITS.has(code)) {
        if (code === 'm') return `${Number(num.toFixed(3))} m`;
        const inM = convertUomQty(num, primaryCode, 'm');
        return `${Number(inM.toFixed(3))} m`;
    }

    // Each / count
    if (code === 'ea' || code === 'each' || code === 'pcs') {
        return `${num} pcs`;
    }
    if (code === 'dz') {
        const inPcs = convertUomQty(num, 'dz', 'ea');
        return `${inPcs} pcs`;
    }

    // Unknown unit — show raw value with unit code
    return `${num} ${primaryCode}`;
};
