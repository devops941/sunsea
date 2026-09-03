/* ══════════════════════════════════════════════════════════════════
   FIELD SALES TEAM — SHARED ROSTER
   ------------------------------------------------------------------
   Single source of truth for the field-sales roster, used by both the
   in-app live map and the TV dashboard's field-sales scene.

   ⚠️  These positions are SIMULATED. There is no GPS feed, no device
   integration and no backend endpoint behind them — coordinates are
   seeded here and jittered client-side. Replace `useSimulatedPositions`
   with a real feed before presenting this as live tracking.
   ══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

export interface SalesPerson {
  id: string;
  name: string;
  initials: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
  status: "active" | "in_meeting" | "transit" | "idle";
  battery: number;
  speedKmH: number;
  phone: string;
  todayOrdersCount: number;
  todaySalesValue: number;
  targetVisits: number;
  completedVisits: number;
  lastUpdated: string;
  avatarColor: string;
  accentColor: string;
}

export const SALES_TEAM: SalesPerson[] = [
  {
    id: "sp-1",
    name: "Ravi Kumar",
    initials: "RK",
    area: "RS Puram & Gandhipuram",
    city: "Coimbatore",
    lat: 11.0168,
    lng: 76.9558,
    status: "active",
    battery: 88,
    speedKmH: 28,
    phone: "+919842111020",
    todayOrdersCount: 5,
    todaySalesValue: 68400,
    targetVisits: 8,
    completedVisits: 6,
    lastUpdated: "Just now",
    avatarColor: "from-emerald-400 to-emerald-600",
    accentColor: "#10b981",
  },
  {
    id: "sp-2",
    name: "Suresh Mani",
    initials: "SM",
    area: "SIDCO Industrial Estate",
    city: "Tiruppur",
    lat: 11.1085,
    lng: 77.3411,
    status: "active",
    battery: 64,
    speedKmH: 34,
    phone: "+919443255201",
    todayOrdersCount: 7,
    todaySalesValue: 112500,
    targetVisits: 10,
    completedVisits: 7,
    lastUpdated: "1m ago",
    avatarColor: "from-blue-400 to-cyan-600",
    accentColor: "#0ea5e9",
  },
  {
    id: "sp-3",
    name: "Karthik Selvam",
    initials: "KS",
    area: "SIPCOT Industrial Complex",
    city: "Perundurai",
    lat: 11.2758,
    lng: 77.5828,
    status: "in_meeting",
    battery: 92,
    speedKmH: 0,
    phone: "+919789033411",
    todayOrdersCount: 3,
    todaySalesValue: 42000,
    targetVisits: 6,
    completedVisits: 4,
    lastUpdated: "3m ago",
    avatarColor: "from-amber-400 to-orange-600",
    accentColor: "#f59e0b",
  },
  {
    id: "sp-4",
    name: "Anand Natarajan",
    initials: "AN",
    area: "Pollachi Town & Market",
    city: "Pollachi",
    lat: 10.6582,
    lng: 77.0089,
    status: "active",
    battery: 76,
    speedKmH: 42,
    phone: "+919894488712",
    todayOrdersCount: 4,
    todaySalesValue: 54800,
    targetVisits: 7,
    completedVisits: 5,
    lastUpdated: "Just now",
    avatarColor: "from-purple-400 to-indigo-600",
    accentColor: "#a855f7",
  },
];

/** True once a real GPS feed replaces the client-side simulation. */
export const SALES_GPS_IS_LIVE = false;

/**
 * Jitters the roster's coordinates on an interval to mimic movement.
 * Purely cosmetic — it invents no data that is presented as a metric.
 */
export function useSimulatedPositions(enabled: boolean = true, intervalMs: number = 3500) {
  const [team, setTeam] = useState<SalesPerson[]>(SALES_TEAM);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setTeam((prev) =>
        prev.map((sp) => {
          if (sp.status !== "active") return sp;
          return {
            ...sp,
            lat: Number((sp.lat + (Math.random() - 0.48) * 0.0012).toFixed(5)),
            lng: Number((sp.lng + (Math.random() - 0.48) * 0.0012).toFixed(5)),
            speedKmH: Math.max(15, Math.min(55, Math.round(sp.speedKmH + (Math.random() * 8 - 4)))),
            lastUpdated: "Live",
          };
        })
      );
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  return team;
}
