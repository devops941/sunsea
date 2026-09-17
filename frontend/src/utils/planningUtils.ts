export interface StatusColor {
  bg: string;
  text: string;
}

export interface PlanStatusInfo {
  statusText: string;
  customColor: StatusColor;
}

/**
 * Calculates plan status and theme colors based on planned capacity and actual produced output.
 */
export function getPlanStatusInfo(capacity: number, totalProduced: number): PlanStatusInfo {
  const cap = Math.max(0, capacity);
  const produced = Math.max(0, totalProduced);

  if (cap > 0 && produced >= cap) {
    return {
      statusText: "High",
      customColor: { bg: "rgba(16,185,129,0.15)", text: "#34d399" },
    };
  } else if (cap > 0 && produced >= cap * 0.85) {
    return {
      statusText: "Medium",
      customColor: { bg: "rgba(245,158,11,0.15)", text: "#fbbf24" },
    };
  } else if (cap > 0 && produced >= cap * 0.70) {
    return {
      statusText: "Low",
      customColor: { bg: "rgba(249,115,22,0.15)", text: "#fb923c" },
    };
  }

  return {
    statusText: "Very Low",
    customColor: { bg: "rgba(239,68,68,0.15)", text: "#f87171" },
  };
}
