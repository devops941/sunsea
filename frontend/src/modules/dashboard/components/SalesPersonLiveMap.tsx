import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FaMapMarkerAlt,
  FaCrosshairs,
  FaCompress,
  FaExpand,
  FaPlay,
  FaPause,
} from "react-icons/fa";
import { useTheme } from "../../../providers/ThemeProvider";

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

const SALES_PERSONS_INITIAL: SalesPerson[] = [
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

type TileLayerType = "theme_default" | "satellite" | "streets";

export const SalesPersonLiveMap: React.FC = () => {
  const { mode } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});

  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>(SALES_PERSONS_INITIAL);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [tileLayerType, setTileLayerType] = useState<TileLayerType>("theme_default");
  const [isSimulating, setIsSimulating] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Resolve Tile Layer URL — free OpenStreetMap & ESRI Satellite without API Key watermarks
  const getLayerUrl = (layerType: TileLayerType) => {
    if (layerType === "satellite") {
      return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [11.0168, 77.15],
        zoom: 10,
        zoomControl: false,
        attributionControl: false,
      });

      const url = getLayerUrl(tileLayerType);
      const tileLayer = L.tileLayer(url, {
        maxZoom: 19,
        subdomains: "abc",
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Handle Layer Switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const url = getLayerUrl(tileLayerType);
    const newLayer = L.tileLayer(url, {
      maxZoom: 19,
      subdomains: "abc",
    }).addTo(map);
    tileLayerRef.current = newLayer;
  }, [tileLayerType]);

  // 3. Render Custom Location Markers on Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    const isLight = mode === "light";

    salesPersons.forEach((person) => {
      const isSelected = person.id === selectedPersonId;
      const isLive = person.status === "active";

      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        iconSize: [44, 52],
        iconAnchor: [22, 50],
        html: `
          <div class="relative flex flex-col items-center cursor-pointer select-none">
            ${
              isLive
                ? `<div class="absolute -top-1 w-10 h-10 rounded-full animate-ping opacity-30" style="background-color: ${person.accentColor}"></div>`
                : ""
            }
            
            <div class="relative z-10 w-9 h-9 rounded-full bg-gradient-to-br ${person.avatarColor} border-[2.5px] ${
          isSelected ? "border-white scale-110 ring-4 ring-emerald-400/80 shadow-xl" : isLight ? "border-white shadow-md" : "border-slate-900 shadow-md"
        } flex items-center justify-center transition-transform hover:scale-110">
              <span class="text-white text-[10px] font-black tracking-tight leading-none">${person.initials}</span>
              ${
                isLive
                  ? `<span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 ${isLight ? "border-white" : "border-slate-950"} animate-pulse"></span>`
                  : `<span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border ${isLight ? "border-white" : "border-slate-950"}"></span>`
              }
            </div>

            <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent ${
              isSelected ? "border-t-white" : isLight ? "border-t-white" : "border-t-slate-900"
            } -mt-[1px] drop-shadow-md"></div>

            <div class="mt-0.5 px-2 py-0.5 rounded-md ${
              isLight ? "bg-white/95 text-slate-900 border-slate-200" : "bg-slate-950/90 text-white border-slate-700/80"
            } backdrop-blur-md border shadow-lg text-center whitespace-nowrap">
              <p class="text-[9px] font-black leading-none">${person.name}</p>
              <p class="text-[8px] font-medium opacity-80">${person.city}</p>
            </div>
          </div>
        `,
      });

      const marker = L.marker([person.lat, person.lng], { icon: customIcon }).addTo(map);

      // Tooltip showing exact live location / area
      marker.bindTooltip(
        `<div class="text-[11px] font-bold"><strong>${person.name}</strong><br/><span class="text-slate-600 dark:text-slate-300">📍 ${person.area}, ${person.city}</span></div>`,
        { direction: "top", offset: [0, -46] }
      );

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        handleSelectPerson(person);
      });

      markersRef.current[person.id] = marker;
    });
  }, [salesPersons, selectedPersonId, mode]);

  // 4. Live Movement Simulation
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setSalesPersons((prev) =>
        prev.map((sp) => {
          if (sp.status !== "active") return sp;
          const deltaLat = (Math.random() - 0.48) * 0.0012;
          const deltaLng = (Math.random() - 0.48) * 0.0012;
          const newSpeed = Math.max(15, Math.min(55, Math.round(sp.speedKmH + (Math.random() * 8 - 4))));

          return {
            ...sp,
            lat: Number((sp.lat + deltaLat).toFixed(5)),
            lng: Number((sp.lng + deltaLng).toFixed(5)),
            speedKmH: newSpeed,
            lastUpdated: "Live",
          };
        })
      );
    }, 3500);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Click salesperson to focus map location
  const handleSelectPerson = (person: SalesPerson) => {
    setSelectedPersonId(person.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([person.lat, person.lng], 13, {
        duration: 1.1,
      });
    }
  };

  const handleFitAll = () => {
    setSelectedPersonId(null);
    if (!mapInstanceRef.current || salesPersons.length === 0) return;
    const group = L.featureGroup(Object.values(markersRef.current));
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2), { duration: 1 });
  };

  return (
    <div
      className={`bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden relative transition-all duration-300 ${
        isFullscreen ? "fixed inset-3 z-50 rounded-2xl shadow-2xl" : "h-full min-h-0"
      }`}
    >
      {/* ── CARD HEADER ────────────────────────────────────── */}
      <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft bg-card-2/60 flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FaMapMarkerAlt className="text-xs" />
          </div>
          <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink truncate">
            Sales Force Live GPS Map
          </div>
          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {salesPersons.filter((p) => p.status === "active").length} Active
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Simulation Play/Pause */}
          <button
            type="button"
            onClick={() => setIsSimulating(!isSimulating)}
            title={isSimulating ? "Pause live simulation" : "Resume live simulation"}
            className={`p-1.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
              isSimulating
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-card-2 text-ink-subtle border-line-soft"
            }`}
          >
            {isSimulating ? <FaPause className="text-[8px]" /> : <FaPlay className="text-[8px]" />}
            <span className="hidden sm:inline">{isSimulating ? "Live Feed" : "Paused"}</span>
          </button>

          {/* Map Layer Switcher */}
          <div className="flex items-center bg-card-2 p-0.5 rounded-lg border border-line-soft gap-0.5 shadow-inner">
            {(
              [
                { key: "theme_default", label: "Street Map" },
                { key: "satellite", label: "Satellite" },
              ] as { key: TileLayerType; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTileLayerType(key)}
                className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                  tileLayerType === key
                    ? "bg-teal-500 text-white shadow-sm font-bold"
                    : "text-ink-muted hover:text-ink hover:bg-card"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Fit All Button */}
          <button
            type="button"
            onClick={handleFitAll}
            title="Center all salespersons"
            className="p-1.5 rounded-lg bg-card-2 hover:bg-card text-ink-muted hover:text-ink border border-line-soft transition-colors cursor-pointer"
          >
            <FaCrosshairs className="text-xs" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setTimeout(() => mapInstanceRef.current?.invalidateSize(), 300);
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className="p-1.5 rounded-lg bg-card-2 hover:bg-card text-ink-muted hover:text-ink border border-line-soft transition-colors cursor-pointer"
          >
            {isFullscreen ? <FaCompress className="text-xs" /> : <FaExpand className="text-xs" />}
          </button>
        </div>
      </div>

      {/* ── MAP CANVAS & OVERLAYS ────────────────────────────── */}
      <div className="flex-1 min-h-0 w-full relative overflow-hidden flex">
        {/* Leaflet Map Target */}
        <div
          ref={mapContainerRef}
          className={`w-full h-full z-0 bg-page ${
            mode === "dark" && tileLayerType === "theme_default" ? "map-tiles-dark" : ""
          }`}
          style={
            mode === "dark" && tileLayerType === "theme_default"
              ? { filter: "brightness(0.82) invert(92%) hue-rotate(180deg) contrast(1.15)" }
              : {}
          }
        />

        {/* ── TOP-LEFT FLOATING QUICK LOCATION CHIPS ─────────────── */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-120px)]">
          {salesPersons.map((person) => {
            const isSelected = person.id === selectedPersonId;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => handleSelectPerson(person)}
                title={`📍 ${person.area}, ${person.city}`}
                className={`px-2.5 py-1 rounded-lg backdrop-blur-md text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-400/40 scale-105"
                    : "bg-card/90 text-ink border-line-soft hover:bg-card hover:border-teal-500/40"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      person.status === "active"
                        ? "#10b981"
                        : person.status === "in_meeting"
                        ? "#f59e0b"
                        : "#64748b",
                  }}
                />
                <span>{person.name}</span>
                <span className="text-[9px] opacity-75 font-normal">📍 {person.city}</span>
              </button>
            );
          })}
        </div>

        {/* ── FLOATING ZOOM CONTROLS (Top-Right) ───────────────── */}
        <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1 shadow-xl">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-7 h-7 rounded-lg bg-card/90 hover:bg-card text-ink border border-line-soft flex items-center justify-center text-sm font-black backdrop-blur-md cursor-pointer transition-colors shadow-md"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-7 h-7 rounded-lg bg-card/90 hover:bg-card text-ink border border-line-soft flex items-center justify-center text-sm font-black backdrop-blur-md cursor-pointer transition-colors shadow-md"
          >
            −
          </button>
        </div>

        {/* ── BOTTOM ACTIVE LOCATION CHIP ──────────────────────── */}
        <div className="absolute bottom-2.5 left-2.5 bg-card/90 backdrop-blur-md rounded-xl px-3 py-1.5 border border-line-soft flex items-center gap-3 text-[10px] text-ink shadow-xl z-10">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{salesPersons.filter((p) => p.status === "active").length} In Field</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>{salesPersons.filter((p) => p.status === "in_meeting").length} In Meeting</span>
          </div>
          {selectedPersonId && (
            <span className="text-[10px] text-emerald-400 font-semibold border-l border-line-soft pl-2.5">
              📍 {salesPersons.find((p) => p.id === selectedPersonId)?.name}:{" "}
              {salesPersons.find((p) => p.id === selectedPersonId)?.area},{" "}
              {salesPersons.find((p) => p.id === selectedPersonId)?.city}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
