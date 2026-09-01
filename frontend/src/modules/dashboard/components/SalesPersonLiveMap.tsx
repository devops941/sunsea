import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp,
  FaCrosshairs,
  FaRoute,
  FaTimes,
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
  routeStops: { name: string; time: string; amount: number; completed: boolean; lat: number; lng: number }[];
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
    routeStops: [
      { name: "Lakshmi Plastics", time: "09:30 AM", amount: 18500, completed: true, lat: 11.002, lng: 76.948 },
      { name: "Sri Amman Agencies", time: "11:15 AM", amount: 24000, completed: true, lat: 11.011, lng: 76.952 },
      { name: "Kovai Polymer Hub", time: "01:45 PM", amount: 25900, completed: true, lat: 11.0168, lng: 76.9558 },
      { name: "Supreme Traders", time: "04:30 PM", amount: 0, completed: false, lat: 11.025, lng: 76.968 },
    ],
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
    routeStops: [
      { name: "Kandhan Plastics", time: "09:00 AM", amount: 32000, completed: true, lat: 11.095, lng: 77.325 },
      { name: "Tiruppur Packagings", time: "10:40 AM", amount: 41500, completed: true, lat: 11.102, lng: 77.335 },
      { name: "Vijay Polymers SIDCO", time: "02:00 PM", amount: 39000, completed: true, lat: 11.1085, lng: 77.3411 },
      { name: "Universal Containers", time: "05:15 PM", amount: 0, completed: false, lat: 11.118, lng: 77.355 },
    ],
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
    routeStops: [
      { name: "Sri Kannan Chemicals", time: "10:15 AM", amount: 21000, completed: true, lat: 11.265, lng: 77.57 },
      { name: "Erode Petro Chem", time: "12:30 PM", amount: 21000, completed: true, lat: 11.2758, lng: 77.5828 },
      { name: "Greenland Polytech", time: "04:00 PM", amount: 0, completed: false, lat: 11.285, lng: 77.595 },
    ],
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
    routeStops: [
      { name: "Annamalai Agro Plastics", time: "09:45 AM", amount: 26000, completed: true, lat: 10.648, lng: 76.995 },
      { name: "Pollachi Containers", time: "11:50 AM", amount: 28800, completed: true, lat: 10.6582, lng: 77.0089 },
      { name: "South Pack Industries", time: "03:45 PM", amount: 0, completed: false, lat: 10.672, lng: 77.022 },
    ],
  },
];

type TileLayerType = "theme_default" | "satellite" | "streets";

export const SalesPersonLiveMap: React.FC = () => {
  const { mode } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);

  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>(SALES_PERSONS_INITIAL);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "in_meeting">("all");
  const [tileLayerType, setTileLayerType] = useState<TileLayerType>("theme_default");
  const [isSimulating, setIsSimulating] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(true);

  const selectedPerson = salesPersons.find((sp) => sp.id === selectedPersonId) || null;

  // Resolve Tile Layer URL
  const getLayerUrl = (layerType: TileLayerType, currentTheme: "dark" | "light") => {
    if (layerType === "satellite") {
      return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }
    if (layerType === "streets") {
      return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    }
    // Default dynamic theme
    return currentTheme === "light"
      ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
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

      const url = getLayerUrl(tileLayerType, mode);
      const tileLayer = L.tileLayer(url, {
        maxZoom: 19,
        subdomains: "abcd",
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

  // 2. Handle Layer / Theme Switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const url = getLayerUrl(tileLayerType, mode);
    const newLayer = L.tileLayer(url, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);
    tileLayerRef.current = newLayer;
  }, [tileLayerType, mode]);

  // 3. Render Custom Markers on Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const visiblePersons = salesPersons.filter((sp) => {
      if (activeFilter === "active") return sp.status === "active";
      if (activeFilter === "in_meeting") return sp.status === "in_meeting";
      return true;
    });

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    const isLight = mode === "light";

    visiblePersons.forEach((person) => {
      const isSelected = person.id === selectedPersonId;
      const isLive = person.status === "active";

      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        iconSize: [44, 52],
        iconAnchor: [22, 50],
        html: `
          <div class="relative flex flex-col items-center cursor-pointer group select-none">
            ${
              isLive
                ? `<div class="absolute -top-1.5 w-11 h-11 rounded-full animate-ping opacity-35" style="background-color: ${person.accentColor}"></div>`
                : ""
            }
            
            <div class="relative z-10 w-9 h-9 rounded-full bg-gradient-to-br ${person.avatarColor} border-[2.5px] ${
          isSelected ? "border-white scale-110 ring-4 ring-sky-400/70 shadow-xl" : isLight ? "border-white shadow-md" : "border-slate-900 shadow-md"
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
              isLight ? "bg-white/95 text-slate-900 border-slate-200" : "bg-slate-950/85 text-white border-slate-700/80"
            } backdrop-blur-md border shadow-lg text-center whitespace-nowrap">
              <p class="text-[9px] font-black leading-none">${person.name}</p>
              <p class="text-[7.5px] font-bold" style="color: ${person.accentColor}">${person.speedKmH > 0 ? `${person.speedKmH} km/h` : "Stopped"}</p>
            </div>
          </div>
        `,
      });

      const marker = L.marker([person.lat, person.lng], { icon: customIcon }).addTo(map);

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        handleSelectPerson(person);
      });

      markersRef.current[person.id] = marker;
    });
  }, [salesPersons, selectedPersonId, activeFilter, mode]);

  // 4. Draw Route Polylines & Stop Checkpoints for Selected Person
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    if (selectedPerson && selectedPerson.routeStops && selectedPerson.routeStops.length > 0) {
      const latLngs: [number, number][] = [
        ...selectedPerson.routeStops.map((stop) => [stop.lat, stop.lng] as [number, number]),
        [selectedPerson.lat, selectedPerson.lng],
      ];

      const polyline = L.polyline(latLngs, {
        color: selectedPerson.accentColor,
        weight: 4,
        opacity: 0.9,
        dashArray: "6, 8",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      polylineRef.current = polyline;

      selectedPerson.routeStops.forEach((stop, idx) => {
        const isLight = mode === "light";
        const stopIcon = L.divIcon({
          className: "custom-stop-marker",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          html: `
            <div class="w-5 h-5 rounded-full ${
              stop.completed ? "bg-emerald-500 text-white" : isLight ? "bg-slate-200 text-slate-600 border border-slate-300" : "bg-slate-800 text-slate-400 border border-slate-600"
            } flex items-center justify-center text-[8.5px] font-black shadow-md border-2 ${isLight ? "border-white" : "border-slate-900"}">
              ${idx + 1}
            </div>
          `,
        });

        const stopMarker = L.marker([stop.lat, stop.lng], { icon: stopIcon }).addTo(map);
        stopMarker.bindTooltip(
          `<div class="text-[10px] font-bold text-slate-900">${stop.name} (${stop.time})<br/>${
            stop.amount > 0 ? `₹${stop.amount.toLocaleString("en-IN")}` : "Pending Visit"
          }</div>`,
          { direction: "top", offset: [0, -8] }
        );

        stopMarkersRef.current.push(stopMarker);
      });
    }
  }, [selectedPerson, mode]);

  // 5. Live Simulation
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

  const handleSelectPerson = (person: SalesPerson) => {
    setSelectedPersonId(person.id);
    setShowDetailDrawer(true);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([person.lat, person.lng], 13, {
        duration: 1.1,
      });
    }
  };

  const handleFitAll = () => {
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
                { key: "theme_default", label: "Auto Theme" },
                { key: "satellite", label: "Satellite" },
                { key: "streets", label: "Street" },
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
        <div ref={mapContainerRef} className="w-full h-full z-0 bg-page" />

        {/* ── TOP-LEFT FLOATING QUICK-SELECT CHIPS ─────────────── */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-120px)]">
          {salesPersons.map((person) => {
            const isSelected = person.id === selectedPersonId;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => handleSelectPerson(person)}
                className={`px-2 py-1 rounded-lg backdrop-blur-md text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
                  isSelected
                    ? "bg-sky-600 text-white border-sky-400 ring-2 ring-sky-400/40 scale-105"
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
                <span className="text-[8.5px] opacity-75 font-mono">₹{(person.todaySalesValue / 1000).toFixed(0)}k</span>
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

        {/* ── SELECTED SALESPERSON PROFILE CARD / POPUP DRAWER ── */}
        {selectedPerson && showDetailDrawer && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto sm:w-96 z-20 bg-card/95 backdrop-blur-xl border border-line-soft rounded-2xl p-3.5 shadow-2xl text-ink animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* Header: Name, Status, Close */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedPerson.avatarColor} border-2 border-white/80 shadow-md flex items-center justify-center text-white text-xs font-black shrink-0`}
                >
                  {selectedPerson.initials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[13px] font-black text-ink truncate">{selectedPerson.name}</h4>
                    <span
                      className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full border ${
                        selectedPerson.status === "active"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                      }`}
                    >
                      {selectedPerson.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[10px] text-ink-muted flex items-center gap-1 mt-0.5 truncate">
                    <FaMapMarkerAlt className="text-emerald-400 text-[9px] shrink-0" />
                    <span className="truncate">
                      {selectedPerson.area}, {selectedPerson.city}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPersonId(null)}
                className="text-ink-subtle hover:text-ink p-1 rounded hover:bg-card-2 transition-colors cursor-pointer"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            {/* Telemetry Micro-Cards */}
            <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-line-soft">
              <div className="p-1.5 rounded-lg bg-card-2 border border-line-soft text-center">
                <span className="text-[8px] font-bold text-ink-subtle uppercase tracking-wider block">Today's Sales</span>
                <span className="text-[12px] font-mono font-black text-emerald-400">
                  ₹{selectedPerson.todaySalesValue.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-card-2 border border-line-soft text-center">
                <span className="text-[8px] font-bold text-ink-subtle uppercase tracking-wider block">Visits Done</span>
                <span className="text-[12px] font-mono font-black text-sky-400">
                  {selectedPerson.completedVisits} / {selectedPerson.targetVisits}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-card-2 border border-line-soft text-center">
                <span className="text-[8px] font-bold text-ink-subtle uppercase tracking-wider block">Live Speed</span>
                <span className="text-[12px] font-mono font-black text-amber-400">
                  {selectedPerson.speedKmH} km/h
                </span>
              </div>
            </div>

            {/* Today's Route Stops List */}
            <div className="mt-2.5 pt-2 border-t border-line-soft">
              <div className="flex items-center justify-between text-[9.5px] font-bold text-ink-subtle mb-1.5">
                <span className="flex items-center gap-1 text-ink-muted">
                  <FaRoute className="text-sky-400" /> Today's Itinerary
                </span>
                <span className="text-[8.5px] text-ink-subtle">Battery: {selectedPerson.battery}%</span>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                {selectedPerson.routeStops.map((stop, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-1.5 rounded-md bg-card-2 border border-line-soft text-[10px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 ${
                          stop.completed
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-card text-ink-subtle border border-line-soft"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className={`truncate font-medium ${stop.completed ? "text-ink" : "text-ink-subtle"}`}>
                        {stop.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] text-ink-subtle font-mono">{stop.time}</span>
                      {stop.amount > 0 && (
                        <span className="text-[9.5px] font-mono font-bold text-emerald-400">
                          ₹{stop.amount.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Buttons: Call & WhatsApp */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-line-soft">
              <a
                href={`tel:${selectedPerson.phone}`}
                className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-950/20"
              >
                <FaPhoneAlt className="text-[9px]" />
                <span>Call Salesman</span>
              </a>
              <a
                href={`https://wa.me/${selectedPerson.phone.replace("+", "")}?text=Hi%20${selectedPerson.name},%20checking%20today's%20sales%20status.`}
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors border border-emerald-500/40 shadow-md shadow-emerald-950/20"
              >
                <FaWhatsapp className="text-xs" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        )}

        {/* ── BOTTOM-RIGHT STATUS SUMMARY BADGE ───────────────── */}
        {!selectedPerson && (
          <div className="absolute bottom-2.5 left-2.5 bg-card/90 backdrop-blur-md rounded-xl px-3 py-1.5 border border-line-soft flex items-center gap-3 text-[10px] text-ink shadow-xl z-10">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{salesPersons.filter((p) => p.status === "active").length} In Field</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{salesPersons.filter((p) => p.status === "in_meeting").length} In Meeting</span>
            </div>
            <span className="text-[9px] text-ink-subtle">Click any pin for profile</span>
          </div>
        )}
      </div>
    </div>
  );
};
