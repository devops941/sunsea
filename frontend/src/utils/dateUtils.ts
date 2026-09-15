export const formatDate = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/\//g, "-");
};

/**
 * Numeric `dd-mm-yyyy` (e.g. `03-09-2026`). Standard India business format.
 * Use across dashboards, tables, reports, CSV exports so Excel keeps the
 * value as text and doesn't collapse to `########` due to auto-formatting.
 */
export const formatDateDMY = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Convert a payroll period string to a human-readable label.
 * - `YYYY-MM` → `"September 2026"`
 * - `YYYY-Wnn` → `"Week 32, 2026"`
 * - Anything else is returned as-is.
 */
export const formatPeriod = (period: string | null | undefined): string => {
  if (!period) return '—';
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    return `${MONTH_NAMES[parseInt(monthMatch[2], 10) - 1]} ${monthMatch[1]}`;
  }
  const weekMatch = period.match(/^(\d{4})-W(\d{2})$/);
  if (weekMatch) {
    return `Week ${weekMatch[2]}, ${weekMatch[1]}`;
  }
  return period;
};

export const formatDateTime = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";

  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/\//g, "-");

  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart}, ${timePart}`;
};