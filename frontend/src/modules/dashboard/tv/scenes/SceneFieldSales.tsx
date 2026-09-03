import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { u, type TvTheme } from "../tvTheme";
import { Panel, KpiCard, TvEmpty } from "../components/TvPrimitives";
import { inrCompact } from "../tvFormat";
import {
  useSimulatedPositions,
  SALES_GPS_IS_LIVE,
  type SalesPerson,
} from "../../salesforce/salesTeam";

/* ══════════════════════════════════════════════════════════════════
   SCENE 4 — FIELD SALES (GPS)
   ------------------------------------------------------------------
   Wall view of where the field team is and what they have booked today.

   The map tiles come from OpenStreetMap, so the display needs internet;
   without it the markers still render over an empty canvas.
   ══════════════════════════════════════════════════════════════════ */

const STATUS_LABEL: Record<SalesPerson["status"], string> = {
  active: "ON THE MOVE",
  in_meeting: "IN MEETING",
  transit: "IN TRANSIT",
  idle: "IDLE",
};

const SceneFieldSales: React.FC<{ theme: TvTheme }> = ({ theme }) => {
  const { T, A } = theme;
  const team = useSimulatedPositions();

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef<Record<string, L.Marker>>({});

  const statusColor = (s: SalesPerson["status"]) =>
    s === "active" ? A.green : s === "in_meeting" ? A.blue : s === "transit" ? A.amber : T.textMute;

  /* ── Map init ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const map = L.map(mapEl.current, {
      center: [11.0168, 77.15],
      zoom: 9,
      attributionControl: false,
      zoomControl: false,
      // A wall display is not interactive — freeze the map so a stray
      // touch or scroll can never leave it panned somewhere useless.
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      subdomains: "abc",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markers.current = {};
    };
  }, []);

  /* ── Markers follow the roster ─────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers when theme changes so they rebuild with new colors
    Object.values(markers.current).forEach((m) => m.remove());
    markers.current = {};

    for (const p of team) {
      const colour = statusColor(p.status);
      const markerTextColor = theme.isDark ? "#0b1020" : "#ffffff";
      const labelBg = theme.isDark ? "rgba(6,10,20,.82)" : "rgba(255,255,255,.88)";
      const labelColor = theme.isDark ? "#fff" : "#0b1020";
      const icon = L.divIcon({
        className: "tv-sales-marker",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="width:30px;height:30px;border-radius:50%;background:${colour};
                        display:flex;align-items:center;justify-content:center;
                        font-family:'IBM Plex Mono',monospace;font-weight:800;font-size:11px;
                        color:${markerTextColor};box-shadow:0 0 10px ${colour};">${p.initials}</div>
            <div style="margin-top:3px;padding:1px 5px;border-radius:2px;white-space:nowrap;
                        background:${labelBg};color:${labelColor};font-size:9px;font-weight:700;
                        font-family:'IBM Plex Mono',monospace;">${p.city}</div>
          </div>`,
      });
      markers.current[p.id] = L.marker([p.lat, p.lng], { icon }).addTo(map);
    }

    // Keep everyone in frame without letting the map drift over time.
    const all = Object.values(markers.current);
    if (all.length) {
      map.fitBounds(L.featureGroup(all).getBounds().pad(0.35), { animate: false });
    }
  }, [team, theme.isDark]);

  /* ── Roll-ups ──────────────────────────────────────────────────── */
  const onDuty = team.filter((p) => p.status !== "idle").length;
  const orders = team.reduce((s, p) => s + p.todayOrdersCount, 0);
  const value = team.reduce((s, p) => s + p.todaySalesValue, 0);
  const visitsDone = team.reduce((s, p) => s + p.completedVisits, 0);
  const visitsTarget = team.reduce((s, p) => s + p.targetVisits, 0);
  const visitPct = visitsTarget ? Math.round((visitsDone / visitsTarget) * 100) : 0;

  const kpis = [
    { label: "Field Staff On Duty", value: `${onDuty}/${team.length}`, sub: "reporting today", color: A.green },
    { label: "Orders Booked", value: String(orders), sub: "today, field team", color: A.blue },
    { label: "Order Value", value: inrCompact(value), sub: "today, field team", color: A.amber },
    { label: "Visits Completed", value: `${visitPct}%`, sub: `${visitsDone} of ${visitsTarget} planned`, color: visitPct >= 75 ? A.green : A.amber },
  ];

  return (
    <>
      <div className="tv-kpi-strip" style={{ display: "flex", gap: u(16), flex: `0 0 ${u(168)}` }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} theme={theme} rail {...k} />
        ))}
      </div>

      <div
        className="tv-body-grid"
        style={{ flex: 1, display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: u(14), minHeight: 0 }}
      >
        <Panel
          theme={theme}
          title="FIELD TEAM — LIVE LOCATION"
          padX={0}
          padY={0}
          right={
            // Never label simulated coordinates "LIVE" on a wall the
            // management team reads as fact.
            !SALES_GPS_IS_LIVE ? (
              <div
                style={{
                  fontSize: u(12),
                  fontWeight: 800,
                  letterSpacing: u(0.6),
                  color: A.amber,
                  border: `${u(1)} solid ${A.amber}`,
                  borderRadius: u(1),
                  padding: `${u(3)} ${u(8)}`,
                  marginRight: u(16),
                }}
                title="Positions are simulated — no GPS feed is connected yet"
              >
                SIMULATED
              </div>
            ) : undefined
          }
          style={{ overflow: "hidden" }}
        >
          <div
            ref={mapEl}
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              background: theme.isDark ? "oklch(0.18 0.02 260)" : "oklch(0.92 0.01 260)",
              filter: theme.isDark ? "brightness(0.78) saturate(0.85)" : "none",
            }}
          />
        </Panel>

        <Panel theme={theme} title="TEAM STATUS">
          {team.length === 0 ? (
            <TvEmpty theme={theme} label="No field staff on duty" />
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: u(10),
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {team.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: u(12),
                    background: T.tile,
                    borderRadius: u(2),
                    padding: `${u(10)} ${u(14)}`,
                  }}
                >
                  <div
                    style={{
                      width: u(34),
                      height: u(34),
                      flex: "0 0 auto",
                      borderRadius: "50%",
                      background: statusColor(p.status),
                      color: theme.isDark ? "#0b1020" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: u(13),
                    }}
                  >
                    {p.initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: u(16),
                        fontWeight: 700,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: u(13),
                        color: T.textDim,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.city} · {p.area}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                    <div style={{ fontSize: u(12), fontWeight: 800, color: statusColor(p.status) }}>
                      {STATUS_LABEL[p.status]}
                    </div>
                    <div style={{ fontSize: u(13), color: T.textDim }}>
                      {p.todayOrdersCount} orders · {inrCompact(p.todaySalesValue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
};

export default SceneFieldSales;
