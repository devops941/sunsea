/**
 * Returns the conversion multiplier to convert a given UOM into the base UOM.
 * E.g. getUomMultiplier("g", "kg") → 0.001
 */
export const getUomMultiplier = (uom: string = "", baseUom: string = ""): number => {
  const u = (uom || "").trim().toLowerCase();
  const b = (baseUom || "").trim().toLowerCase();
  if (!u || u === b) return 1;
  if (u === "g" || u === "gram" || u === "grams") {
    if (b.includes("kg") || b === "kilogram" || b === "kilograms" || !b) return 0.001;
  }
  if (u === "kg" || u === "kilogram" || u === "kilograms") {
    if (b === "g" || b === "gram" || b === "grams") return 1000;
  }
  if (u === "mg") {
    if (b.includes("kg")) return 0.000001;
    if (b.includes("g")) return 0.001;
  }
  if (u === "ton" || u === "tonne" || u === "tonnes" || u === "tons") {
    if (b.includes("kg") || !b) return 1000;
  }
  if (u === "ml" && (b.includes("l") || !b)) return 0.001;
  if (u === "mm" && (b.includes("m") || !b)) return 0.001;
  if (u === "cm" && (b.includes("m") || !b)) return 0.01;
  return 1;
};
