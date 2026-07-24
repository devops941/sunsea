// Helper to convert any Date to IST date parts or string. Needed because server/browser timezone may not be IST.
export const getISTDateParts = (d: Date = new Date()) => {
  const istString = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istString);
  return {
    year: istDate.getFullYear(),
    month: istDate.getMonth(), // 0-indexed
    day: istDate.getDate(),
    hours: istDate.getHours(),
    minutes: istDate.getMinutes(),
  };
};

// Helper to get IST date string in YYYY-MM-DD format. Needed because server/browser timezone may not be IST.
export const getISTDateString = (d: Date = new Date()) => {
  const parts = getISTDateParts(d);
  const month = String(parts.month + 1).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
};
