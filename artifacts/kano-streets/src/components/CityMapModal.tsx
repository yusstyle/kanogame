import { useState, useMemo, useEffect } from "react";
import { KANO_LANDMARKS, getGpsLandmark, getCityLandmarks, computeGpsGuidance, type LandmarkCategory, type LandmarkLocation } from "../game/landmarks";
import { ABUJA_LANDMARKS } from "../game/abujaLandmarks";
import type { CityId, TravelMethod } from "../game/cityRegistry";
import { INDENTURE_1968 } from "../game/storySystem";
import { PROPERTY_REGISTRY } from "../game/propertyRegistry";
import { normalizePropertyId } from "../game/economySystem";
import type { CareerPathChoice, InvestigationChoice, StorySnapshotInfo, HomeNavInfo, PropertyId, PlayerHomeEntry } from "../game/types";

export interface CityMapModalProps {
  onClose: () => void;
  playerCoords?: { x: number; z: number };
  playerHeading?: number;
  gpsTarget?: string | null;
  onSetGPSTarget?: (id: string | null) => void;
  storyInfo?: StorySnapshotInfo | null;
  selectedHomePropertyId?: PropertyId | null;
  homeNavInfo?: HomeNavInfo | null;
  playerHomes?: PlayerHomeEntry[];
  ownedProperties?: string[];
  hasApartmentRental?: boolean;
  cash?: number;
  onSetSelectedHome?: (propertyId: PropertyId) => unknown;
  onTeleportHome?: (destination?: "entrance" | "interior") => unknown;
  onFindMyHome?: () => unknown;
  onLeaseProperty?: (propertyId?: PropertyId) => { success: boolean; message: string };
  onPurchaseProperty?: (propertyId: PropertyId) => { success: boolean; message: string };
  onExamineIndenture?: () => boolean;
  onChooseInvestigation?: (choice: "elders" | "bank") => unknown;
  onChooseCareer?: (choice: CareerPathChoice) => unknown;
  onResolveChapter1?: () => unknown;
  currentCity?: CityId;
  onTravelToCity?: (city: CityId, method?: TravelMethod) => unknown;
}

type TabType = "map" | "homes" | "directory" | "story";

export function toSvgX(worldX: number): number {
  return Math.round(((worldX + 136) / 272) * 800);
}

export function toSvgY(worldZ: number): number {
  return Math.round(((worldZ + 230) / 366) * 1000);
}

export function getPropertyStreetDescription(id: PropertyId): string {
  switch (id) {
    case "unit-2b":
      return "Airport Road Commercial Corridor · Opposite Central Banking Plaza, Near Police Post";
    case "bompai-penthouse":
      return "Bompai Avenue · Luxury Heights Executive Quarter, North-East Corner";
    case "albaraka-villa":
      return "Residential Quarter · Gated Perimeter Villa Estates, Southern Gate";
    default:
      return "Kano City Residential District";
  }
}

const CATEGORY_COLORS: Record<LandmarkCategory, { bg: string; border: string; text: string; icon: string }> = {
  historic: { bg: "#78350f", border: "#d97706", text: "#fef3c7", icon: "🏛️" },
  commercial: { bg: "#ca8a04", border: "#f59e0b", text: "#fef9c3", icon: "🛍️" },
  residence: { bg: "#15803d", border: "#22c55e", text: "#f0fdf4", icon: "🏡" },
  industrial: { bg: "#334155", border: "#64748b", text: "#f8fafc", icon: "🏭" },
  civic: { bg: "#1e40af", border: "#3b82f6", text: "#eff6ff", icon: "🏢" },
  worship: { bg: "#065f46", border: "#10b981", text: "#ecfdf5", icon: "🕌" },
  security: { bg: "#831843", border: "#f43f5e", text: "#fff1f2", icon: "👮" },
};

export default function CityMapModal({
  onClose,
  playerCoords = { x: -4, z: -4 },
  playerHeading = 0,
  gpsTarget,
  onSetGPSTarget,
  storyInfo,
  selectedHomePropertyId,
  homeNavInfo,
  playerHomes,
  ownedProperties = [],
  hasApartmentRental = false,
  cash = 100000,
  onSetSelectedHome,
  onTeleportHome,
  onFindMyHome,
  onLeaseProperty,
  onPurchaseProperty,
  onChooseInvestigation,
  onChooseCareer,
  onResolveChapter1,
  currentCity = "kano",
  onTravelToCity,
}: CityMapModalProps) {
  const [viewingCity, setViewingCity] = useState<CityId>(currentCity);
  const [activeTab, setActiveTab] = useState<TabType>("map");
  const [categoryFilter, setCategoryFilter] = useState<LandmarkCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkLocation | null>(null);

  // Map zoom and centering state
  const [isMapZoomed, setIsMapZoomed] = useState<boolean>(false);
  const [mapZoomTarget, setMapZoomTarget] = useState<{ x: number; z: number; name: string } | null>(null);

  // Local state for instantaneous UI response when switching primary home
  const [currentSelectedHomeId, setCurrentSelectedHomeId] = useState<PropertyId | null>(
    selectedHomePropertyId ?? homeNavInfo?.propertyId ?? null,
  );

  useEffect(() => {
    if (selectedHomePropertyId !== undefined) {
      setCurrentSelectedHomeId(selectedHomePropertyId);
    } else if (homeNavInfo?.propertyId) {
      setCurrentSelectedHomeId(homeNavInfo.propertyId);
    }
  }, [selectedHomePropertyId, homeNavInfo?.propertyId]);

  // Derive eligible homes dynamically from actual property records
  const eligibleHomes = useMemo<PlayerHomeEntry[]>(() => {
    // 1. If playerHomes was passed via props and is populated, sync selection state
    if (playerHomes && playerHomes.length > 0) {
      return playerHomes.map((h) => ({
        ...h,
        isSelectedHome: currentSelectedHomeId ? h.propertyId === currentSelectedHomeId : h.isSelectedHome,
      }));
    }

    // 2. Otherwise derive dynamically from property records and normalized ownership
    const list: PlayerHomeEntry[] = [];
    const normalizedOwned = (ownedProperties ?? []).map(normalizePropertyId).filter(Boolean) as PropertyId[];
    const effectiveSelectedId = currentSelectedHomeId ?? (hasApartmentRental ? "unit-2b" : (normalizedOwned[0] ?? null));

    // Unit 2B (Airport Road)
    const hasU2bLease = Boolean(hasApartmentRental);
    const hasU2bOwnership = normalizedOwned.includes("unit-2b");
    if (hasU2bLease || hasU2bOwnership) {
      const reg = PROPERTY_REGISTRY["unit-2b"];
      const dist = Math.round(Math.hypot(playerCoords.x - reg.entranceDoor.x, playerCoords.z - reg.entranceDoor.z));
      list.push({
        propertyId: "unit-2b",
        name: reg.name,
        district: reg.district,
        status: hasU2bOwnership ? "OWNED" : "LEASED",
        isSelectedHome: effectiveSelectedId === "unit-2b" || (!effectiveSelectedId && list.length === 0),
        entranceCoords: { x: reg.entranceDoor.x, z: reg.entranceDoor.z },
        distanceMeters: dist,
        description: reg.description,
        landmarkId: "apartment",
      });
    }

    // Bompai Penthouse
    if (normalizedOwned.includes("bompai-penthouse")) {
      const reg = PROPERTY_REGISTRY["bompai-penthouse"];
      const dist = Math.round(Math.hypot(playerCoords.x - reg.entranceDoor.x, playerCoords.z - reg.entranceDoor.z));
      list.push({
        propertyId: "bompai-penthouse",
        name: reg.name,
        district: reg.district,
        status: "OWNED",
        isSelectedHome: effectiveSelectedId === "bompai-penthouse",
        entranceCoords: { x: reg.entranceDoor.x, z: reg.entranceDoor.z },
        distanceMeters: dist,
        description: reg.description,
        landmarkId: "bompai-flats",
      });
    }

    // Al-Baraka Villa
    if (normalizedOwned.includes("albaraka-villa")) {
      const reg = PROPERTY_REGISTRY["albaraka-villa"];
      const dist = Math.round(Math.hypot(playerCoords.x - reg.entranceDoor.x, playerCoords.z - reg.entranceDoor.z));
      list.push({
        propertyId: "albaraka-villa",
        name: reg.name,
        district: reg.district,
        status: "OWNED",
        isSelectedHome: effectiveSelectedId === "albaraka-villa",
        entranceCoords: { x: reg.entranceDoor.x, z: reg.entranceDoor.z },
        distanceMeters: dist,
        description: reg.description,
        landmarkId: "villa",
      });
    }

    return list;
  }, [playerHomes, ownedProperties, hasApartmentRental, currentSelectedHomeId, playerCoords]);

  // Development diagnostic warning when property records exist but 0 homes resolved
  const devDiagnosticMessage = useMemo(() => {
    const hasAnyRecord = Boolean(hasApartmentRental || (ownedProperties && ownedProperties.length > 0));
    if (hasAnyRecord && eligibleHomes.length === 0) {
      return `Discrepancy detected: Player has property records (hasApartmentRental=${hasApartmentRental}, ownedProperties=[${ownedProperties?.join(", ")}]), but 0 eligible homes were resolved in the Home List. Check property ID matching.`;
    }
    return null;
  }, [hasApartmentRental, ownedProperties, eligibleHomes.length]);

  const activeSelectedHome = useMemo(() => {
    return eligibleHomes.find((h) => h.isSelectedHome) ?? eligibleHomes[0] ?? null;
  }, [eligibleHomes]);

  const handleSelectHome = (propertyId: PropertyId) => {
    setCurrentSelectedHomeId(propertyId);
    onSetSelectedHome?.(propertyId);
  };

  const handleShowHomeOnMap = (home: PlayerHomeEntry) => {
    handleSelectHome(home.propertyId);
    setMapZoomTarget({
      x: home.entranceCoords.x,
      z: home.entranceCoords.z,
      name: home.name,
    });
    setIsMapZoomed(true);
    setSelectedLandmark({
      id: "my-home",
      name: `My Home · ${home.name}`,
      district: home.district,
      x: home.entranceCoords.x,
      z: home.entranceCoords.z,
      category: "residence",
      description: `Primary residence entrance door at (${home.entranceCoords.x}, ${home.entranceCoords.z}). Distance: ${home.distanceMeters}m from current position.`,
    });
    setActiveTab("map");
  };

  const handleGuideMeThere = (home: PlayerHomeEntry) => {
    handleSelectHome(home.propertyId);
    if (onFindMyHome) {
      onFindMyHome();
    } else {
      onSetGPSTarget?.("my-home");
    }
    onClose();
  };

  const defaultViewBox = "0 0 800 1000";
  const svgViewBox = useMemo(() => {
    if (!isMapZoomed || !mapZoomTarget) return defaultViewBox;
    const centerSvgX = toSvgX(mapZoomTarget.x);
    const centerSvgY = toSvgY(mapZoomTarget.z);
    const zoomW = 300;
    const zoomH = 380;
    const minX = Math.max(0, Math.min(800 - zoomW, centerSvgX - zoomW / 2));
    const minY = Math.max(0, Math.min(1000 - zoomH, centerSvgY - zoomH / 2));
    return `${minX} ${minY} ${zoomW} ${zoomH}`;
  }, [isMapZoomed, mapZoomTarget]);

  const activeLandmarkList = getCityLandmarks(viewingCity);
  const filteredLandmarks = activeLandmarkList.filter((lm) => {
    const matchesCategory = categoryFilter === "all" || lm.category === categoryFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      lm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lm.district.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeGpsLandmark = getGpsLandmark(gpsTarget, homeNavInfo);
  const playerSvgX = toSvgX(playerCoords.x);
  const playerSvgY = toSvgY(playerCoords.z);

  const getDistanceToPlayer = (x: number, z: number) => {
    return Math.round(Math.hypot(x - playerCoords.x, z - playerCoords.z));
  };

  return (
    <div className="ks-directory-layer" role="dialog" aria-modal="true" aria-labelledby="ks-city-map-title">
      <div className="ks-directory-panel ks-city-map-panel">
        {/* Header with Navigation Tabs */}
        <div className="ks-directory-header">
          <div>
            <div className="ks-edition">KANO OPEN WORLD EXPLORATION</div>
            <h2 id="ks-city-map-title">City Map, Directory &amp; Business Empire Story</h2>
          </div>
          <div className="ks-map-tabs">
            <button
              className={`ks-map-tab-btn ${activeTab === "map" ? "active" : ""}`}
              onClick={() => setActiveTab("map")}
            >
              🗺️ Visual Map
            </button>
            <button
              className={`ks-map-tab-btn ${activeTab === "homes" ? "active" : ""}`}
              onClick={() => setActiveTab("homes")}
            >
              🏡 My Properties / Home List {eligibleHomes.length > 0 ? `(${eligibleHomes.length})` : ""}
            </button>
            <button
              className={`ks-map-tab-btn ${activeTab === "directory" ? "active" : ""}`}
              onClick={() => setActiveTab("directory")}
            >
              📋 Directory ({activeLandmarkList.length})
            </button>
            <button
              className={`ks-map-tab-btn ${activeTab === "story" ? "active" : ""}`}
              onClick={() => setActiveTab("story")}
            >
              📜 The Unknown Legacy {storyInfo?.isComplete ? "✓" : "⚡"}
            </button>
            <button className="ks-directory-close" onClick={onClose} aria-label="Close Map">
              ✕
            </button>
          </div>
        </div>

        {/* Multi-City Region Expansion Selector */}
        <div className="ks-city-selector-bar">
          <button
            className={`ks-city-pill ${viewingCity === "kano" ? "active" : ""}`}
            onClick={() => { setViewingCity("kano"); setSelectedLandmark(null); setIsMapZoomed(false); }}
          >
            🏛️ Kano State {currentCity === "kano" ? "· (Current)" : ""}
          </button>
          <button
            className={`ks-city-pill ${viewingCity === "abuja" ? "active" : ""}`}
            onClick={() => { setViewingCity("abuja"); setSelectedLandmark(null); setIsMapZoomed(false); }}
          >
            ⭐ Abuja FCT {currentCity === "abuja" ? "· (Current)" : ""}
          </button>
          <button className="ks-city-pill disabled" title="Coming in future expansion milestone">
            🌊 Lagos (Planned)
          </button>
          <button className="ks-city-pill disabled" title="Coming in future expansion milestone">
            ⛰️ Jos (Planned)
          </button>
          <button className="ks-city-pill disabled" title="Coming in future expansion milestone">
            🚂 Kaduna (Planned)
          </button>
        </div>

        {viewingCity !== currentCity && (
          <div className="ks-intercity-travel-banner">
            <span>Viewing <strong>{viewingCity.toUpperCase()}</strong> map. You are currently in {currentCity.toUpperCase()}.</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="ks-intercity-travel-btn"
                onClick={() => {
                  onTravelToCity?.(viewingCity, "highway");
                  onClose();
                }}
              >
                🚗 Drive via Highway A2 (Free)
              </button>
              <button
                className="ks-intercity-flight-btn"
                onClick={() => {
                  onTravelToCity?.(viewingCity, "flight");
                  onClose();
                }}
              >
                ✈️ Fly (₦35,000)
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Interactive Open-World Vector/SVG Map */}
        {activeTab === "map" && (
          <div className="ks-map-view-wrapper">
            <div className="ks-map-hud-bar">
              <div className="ks-map-player-coord">
                <strong>PLAYER COORD:</strong>
                <span>
                  X: {playerCoords.x}m · Z: {playerCoords.z}m
                </span>
              </div>
              {activeGpsLandmark && (() => {
                const guidance = computeGpsGuidance(
                  playerCoords,
                  { x: activeGpsLandmark.x, z: activeGpsLandmark.z },
                  activeGpsLandmark.name,
                  activeGpsLandmark.district,
                );
                return (
                  <div className="ks-map-active-gps" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong>ACTIVE GPS:</strong>
                    <span>{activeGpsLandmark.name}</span>
                    <span style={{ color: "#34d399", fontWeight: "bold" }}>
                      ({guidance.distanceMeters}m · {guidance.directionCardinal})
                    </span>
                    <span style={{ color: "#cbd5e1", fontSize: "11px" }}>
                      · {guidance.instructionText}
                    </span>
                    <button className="ks-gps-clear-btn" onClick={() => onSetGPSTarget?.(null)}>
                      Clear ✕
                    </button>
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {isMapZoomed ? (
                  <button
                    className="ks-gps-btn"
                    style={{ background: "#475569", borderColor: "#94a3b8", padding: "3px 8px", fontSize: "11px" }}
                    onClick={() => {
                      setIsMapZoomed(false);
                      setMapZoomTarget(null);
                    }}
                    title="Zoom out to whole city map"
                  >
                    🔍 Whole City View (100%)
                  </button>
                ) : activeSelectedHome ? (
                  <button
                    className="ks-gps-btn"
                    style={{ background: "#059669", borderColor: "#10b981", padding: "3px 8px", fontSize: "11px", fontWeight: "bold" }}
                    onClick={() => {
                      setIsMapZoomed(true);
                      setMapZoomTarget({
                        x: activeSelectedHome.entranceCoords.x,
                        z: activeSelectedHome.entranceCoords.z,
                        name: activeSelectedHome.name,
                      });
                    }}
                    title="Zoom in directly on your house entrance"
                  >
                    🔍 Zoom in on My House (2.5x)
                  </button>
                ) : null}
              </div>
            </div>

            {/* MY HOME Quick Nav Card / Advisor Banner */}
            {activeSelectedHome ? (() => {
              const homeGuidance = computeGpsGuidance(
                playerCoords,
                activeSelectedHome.entranceCoords,
                activeSelectedHome.name,
                activeSelectedHome.district,
              );
              const streetDesc = getPropertyStreetDescription(activeSelectedHome.propertyId);
              return (
                <div
                  className="ks-map-home-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                    background: "linear-gradient(90deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 95, 70, 0.28) 100%)",
                    border: "1px solid #10b981",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    margin: "6px 12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "22px" }}>🏠</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <strong style={{ color: "#34d399", fontSize: "13px", letterSpacing: "0.5px" }}>
                          MY HOUSE: {activeSelectedHome.name}
                        </strong>
                        <span style={{ background: "#059669", color: "#ecfdf5", fontSize: "10px", padding: "1px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                          {activeSelectedHome.status === "LEASED" ? "LEASED" : "OWNED"}
                        </span>
                        <span style={{ background: "#047857", color: "#d1fae5", fontSize: "10px", padding: "1px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                          PRIMARY
                        </span>
                      </div>
                      <small style={{ color: "#cbd5e1", fontSize: "11px", display: "block" }}>
                        {streetDesc} · Physical Entrance: ({activeSelectedHome.entranceCoords.x}, {activeSelectedHome.entranceCoords.z})
                      </small>
                      <small style={{ color: "#34d399", fontSize: "11px", fontWeight: "bold" }}>
                        🧭 {homeGuidance.instructionText}
                      </small>
                      {eligibleHomes.length > 1 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                          <span style={{ color: "#94a3b8", fontSize: "11px" }}>Switch Home:</span>
                          {eligibleHomes.map((h) => (
                            <button
                              key={h.propertyId}
                              onClick={() => {
                                handleSelectHome(h.propertyId);
                                if (isMapZoomed) {
                                  setMapZoomTarget({ x: h.entranceCoords.x, z: h.entranceCoords.z, name: h.name });
                                }
                              }}
                              style={{
                                background: h.isSelectedHome ? "#10b981" : "rgba(255, 255, 255, 0.1)",
                                color: h.isSelectedHome ? "#ffffff" : "#cbd5e1",
                                border: h.isSelectedHome ? "1px solid #34d399" : "1px solid rgba(255, 255, 255, 0.2)",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "10px",
                                cursor: "pointer",
                                fontWeight: h.isSelectedHome ? "bold" : "normal",
                              }}
                            >
                              {h.isSelectedHome ? `★ ${h.name.split("·")[0]}` : h.name.split("·")[0]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      className="ks-gps-btn"
                      style={{ padding: "5px 12px", fontSize: "11px", background: "#059669", borderColor: "#10b981", fontWeight: "bold" }}
                      onClick={() => handleShowHomeOnMap(activeSelectedHome)}
                    >
                      🗺️ Show My House on Map ↗
                    </button>
                    <button
                      className={`ks-gps-btn ${gpsTarget === "my-home" ? "active" : ""}`}
                      onClick={() => handleGuideMeThere(activeSelectedHome)}
                      style={{ padding: "5px 12px", fontSize: "11px", fontWeight: "bold" }}
                    >
                      {gpsTarget === "my-home" ? "🧭 Guiding Active ✓" : "🧭 Guide Me There ↗"}
                    </button>
                    <button
                      className="ks-gps-btn"
                      style={{ padding: "5px 12px", fontSize: "11px", background: "#0f766e" }}
                      onClick={() => setActiveTab("homes")}
                    >
                      Home List ({eligibleHomes.length}) ↗
                    </button>
                    {onTeleportHome && (
                      <button
                        className="ks-gps-btn"
                        style={{ padding: "5px 12px", fontSize: "11px", background: "#4f46e5", borderColor: "#6366f1", fontWeight: "bold" }}
                        onClick={() => {
                          onTeleportHome("entrance");
                          onClose();
                        }}
                        title="Fast travel test shortcut to home entrance"
                      >
                        ⚡ Teleport Home (Dev)
                      </button>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div
                className="ks-map-no-home-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  background: "rgba(217, 119, 6, 0.15)",
                  border: "1px solid #f59e0b",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  margin: "6px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>ℹ️</span>
                  <div>
                    <strong style={{ color: "#f59e0b", fontSize: "13px" }}>
                      You don't own or lease a home yet. Visit the property listings to buy or lease one.
                    </strong>
                    <div style={{ color: "#cbd5e1", fontSize: "11px" }}>
                      Lease Unit 2B at Airport View Apartments (₦75,000/mo) or purchase Bompai Penthouse (₦35M) / Al-Baraka Villa (₦65M).
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="ks-gps-btn"
                    style={{ padding: "4px 10px", fontSize: "11px", background: "#d97706" }}
                    onClick={() => {
                      onSetGPSTarget?.("apartment");
                      onClose();
                    }}
                  >
                    Route to Unit 2B (Airport Road) ↗
                  </button>
                  <button
                    className="ks-gps-btn"
                    style={{ padding: "4px 10px", fontSize: "11px" }}
                    onClick={() => setActiveTab("directory")}
                  >
                    Browse Directory ↗
                  </button>
                </div>
              </div>
            )}

            <div className="ks-map-svg-container">
              <svg viewBox={svgViewBox} className="ks-world-svg-map">
                <defs>
                  {/* Subtle Grid Pattern */}
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
                  </pattern>
                  {/* Pulse Animation for Player */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Background base */}
                <rect width="800" height="1000" fill="#e8ded1" />
                <rect width="800" height="1000" fill="url(#grid)" />

                {/* District Zones */}
                {/* 1. Kawu Industrial District (z <= -120) */}
                <rect
                  x="0"
                  y="0"
                  width="800"
                  height={toSvgY(-120)}
                  fill="#f1f5f9"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  opacity="0.9"
                />
                <text x="30" y="35" className="ks-district-svg-label industrial">
                  KAWU INDUSTRIAL &amp; LOGISTICS DISTRICT
                </text>

                {/* 2. Historic Kano & Dala District (x < 0, z between -120 and 0) */}
                <rect
                  x="0"
                  y={toSvgY(-120)}
                  width={toSvgX(0)}
                  height={toSvgY(0) - toSvgY(-120)}
                  fill="#fef3c7"
                  stroke="#d97706"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <text x="30" y={toSvgY(-120) + 35} className="ks-district-svg-label historic">
                  DALA · OLD HISTORIC KANO
                </text>

                {/* Ancient Wall line indicator */}
                <line
                  x1={toSvgX(-124)}
                  y1={toSvgY(-93)}
                  x2={toSvgX(0)}
                  y2={toSvgY(-93)}
                  stroke="#92400e"
                  strokeWidth="5"
                  strokeDasharray="6,4"
                />
                <text x={toSvgX(-120)} y={toSvgY(-93) - 8} className="ks-wall-svg-label">
                  BADALA ANCIENT CITY WALL
                </text>

                {/* 3. Sabon Gari Commercial District (x < 0, z >= 0) */}
                <rect
                  x="0"
                  y={toSvgY(0)}
                  width={toSvgX(0)}
                  height={1000 - toSvgY(0)}
                  fill="#fef9c3"
                  stroke="#ca8a04"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <text x="30" y={toSvgY(0) + 35} className="ks-district-svg-label commercial">
                  SABON GARI COMMERCIAL CORRIDOR
                </text>

                {/* 4. Airport Road Modern District (x >= 0, z between -120 and 0) */}
                <rect
                  x={toSvgX(0)}
                  y={toSvgY(-120)}
                  width={800 - toSvgX(0)}
                  height={toSvgY(0) - toSvgY(-120)}
                  fill="#e0f2fe"
                  stroke="#0284c7"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <text x={toSvgX(0) + 25} y={toSvgY(-120) + 35} className="ks-district-svg-label modern">
                  AIRPORT ROAD · BANKING &amp; CIVIC SUITES
                </text>

                {/* 5. Residential Quarter (x >= 0, z >= 0) */}
                <rect
                  x={toSvgX(0)}
                  y={toSvgY(0)}
                  width={800 - toSvgX(0)}
                  height={1000 - toSvgY(0)}
                  fill="#dcfce7"
                  stroke="#16a34a"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <text x={toSvgX(0) + 25} y={toSvgY(0) + 35} className="ks-district-svg-label residential">
                  RESIDENTIAL ESTATES &amp; VILLAS
                </text>

                {/* Connected Arterial Roads */}
                {/* Horizontal: Murtala Mohammed Way (z = 0) */}
                <line x1="0" y1={toSvgY(0)} x2="800" y2={toSvgY(0)} stroke="#262626" strokeWidth="20" />
                <line
                  x1="0"
                  y1={toSvgY(0)}
                  x2="800"
                  y2={toSvgY(0)}
                  stroke="#facc15"
                  strokeWidth="1.5"
                  strokeDasharray="10,8"
                />
                <text x="320" y={toSvgY(0) - 12} className="ks-road-svg-label">
                  Murtala Mohammed Way
                </text>

                {/* Horizontal: Sabon Gari Avenue (z = -62) */}
                <line x1="0" y1={toSvgY(-62)} x2="800" y2={toSvgY(-62)} stroke="#333333" strokeWidth="15" />
                <line
                  x1="0"
                  y1={toSvgY(-62)}
                  x2="800"
                  y2={toSvgY(-62)}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  strokeDasharray="8,6"
                />
                <text x="320" y={toSvgY(-62) - 10} className="ks-road-svg-label">
                  Sabon Gari Avenue
                </text>

                {/* Horizontal: Secondary Ring Roads (z = 62, 124, -124) */}
                <line x1="0" y1={toSvgY(62)} x2="800" y2={toSvgY(62)} stroke="#3d3d3d" strokeWidth="12" />
                <line x1="0" y1={toSvgY(124)} x2="800" y2={toSvgY(124)} stroke="#474747" strokeWidth="10" />
                <line x1="0" y1={toSvgY(-124)} x2="800" y2={toSvgY(-124)} stroke="#3d3d3d" strokeWidth="14" />

                {/* Vertical: Airport Road (x = 62) */}
                <line x1={toSvgX(62)} y1="0" x2={toSvgX(62)} y2="1000" stroke="#262626" strokeWidth="22" />
                <line
                  x1={toSvgX(62)}
                  y1="0"
                  x2={toSvgX(62)}
                  y2="1000"
                  stroke="#facc15"
                  strokeWidth="1.5"
                  strokeDasharray="10,8"
                />
                <text x={toSvgX(62) + 14} y="550" className="ks-road-svg-label vertical">
                  Airport Road
                </text>

                {/* Vertical: Bompai Road (x = 0) */}
                <line x1={toSvgX(0)} y1="0" x2={toSvgX(0)} y2="1000" stroke="#333333" strokeWidth="16" />
                <line
                  x1={toSvgX(0)}
                  y1="0"
                  x2={toSvgX(0)}
                  y2="1000"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  strokeDasharray="8,6"
                />
                <text x={toSvgX(0) + 12} y="550" className="ks-road-svg-label vertical">
                  Bompai Road
                </text>

                {/* Vertical: West & East Roads (x = -62, -124, 124) */}
                <line x1={toSvgX(-62)} y1="0" x2={toSvgX(-62)} y2="1000" stroke="#3d3d3d" strokeWidth="14" />
                <line x1={toSvgX(-124)} y1="0" x2={toSvgX(-124)} y2="1000" stroke="#474747" strokeWidth="10" />
                <line x1={toSvgX(124)} y1="0" x2={toSvgX(124)} y2="1000" stroke="#474747" strokeWidth="10" />

                {/* Northern Expansion Highway (to Kawu Freight Terminal at z = -200) */}
                <line x1={toSvgX(0)} y1={toSvgY(-124)} x2={toSvgX(0)} y2={toSvgY(-220)} stroke="#1e293b" strokeWidth="18" />

                {/* Active GPS Route Line from Player to Landmark */}
                {/* Active GPS or Map Zoom Navigation Route Line */}
                {(() => {
                  const lineTarget = activeGpsLandmark ?? (isMapZoomed && mapZoomTarget ? mapZoomTarget : null);
                  if (!lineTarget) return null;
                  return (
                    <line
                      x1={playerSvgX}
                      y1={playerSvgY}
                      x2={toSvgX(lineTarget.x)}
                      y2={toSvgY(lineTarget.z)}
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeDasharray="8,6"
                      className="ks-gps-svg-line"
                    />
                  );
                })()}

                {/* Landmark Pins */}
                {activeLandmarkList.map((lm) => {
                  const lx = toSvgX(lm.x);
                  const ly = toSvgY(lm.z);
                  const isGpsActive = gpsTarget === lm.id;
                  const isSelected = selectedLandmark?.id === lm.id;
                  const colors = CATEGORY_COLORS[lm.category];

                  return (
                    <g
                      key={lm.id}
                      className="ks-map-pin"
                      onClick={() => setSelectedLandmark(lm)}
                      transform={`translate(${lx}, ${ly})`}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Pulse ring for GPS target */}
                      {isGpsActive && (
                        <circle r="18" fill="none" stroke="#10b981" strokeWidth="3" className="ks-pin-pulse" />
                      )}
                      {/* Pin base circle */}
                      <circle
                        r={isSelected ? "13" : "10"}
                        fill={isGpsActive ? "#10b981" : colors.bg}
                        stroke={isSelected ? "#ffffff" : colors.border}
                        strokeWidth="2.5"
                      />
                      {/* Pin label on hover / select */}
                      <text
                        x="0"
                        y="-14"
                        textAnchor="middle"
                        className={`ks-pin-text ${isSelected || isGpsActive ? "prominent" : ""}`}
                      >
                        {lm.name}
                      </text>
                    </g>
                  );
                })}

                {/* Dedicated Player Residences / Homes on Map */}
                {(() => {
                  const activeBeaconPropertyId = mapZoomTarget
                    ? (eligibleHomes.find((h) => h.entranceCoords.x === mapZoomTarget.x && h.entranceCoords.z === mapZoomTarget.z)?.propertyId ?? currentSelectedHomeId)
                    : (currentSelectedHomeId ?? homeNavInfo?.propertyId ?? (eligibleHomes[0]?.propertyId));

                  if (eligibleHomes.length > 0) {
                    return eligibleHomes.map((home) => {
                      const isTargetBeacon = home.propertyId === activeBeaconPropertyId;
                      const hx = toSvgX(home.entranceCoords.x);
                      const hy = toSvgY(home.entranceCoords.z);
                      const streetDesc = getPropertyStreetDescription(home.propertyId);

                      if (isTargetBeacon) {
                        return (
                          <g
                            key={home.propertyId}
                            className="ks-map-pin ks-home-pin ks-home-beacon"
                            onClick={() =>
                              setSelectedLandmark({
                                id: "my-home",
                                name: `My Home · ${home.name}`,
                                district: home.district,
                                x: home.entranceCoords.x,
                                z: home.entranceCoords.z,
                                category: "residence",
                                description: `${streetDesc} · Primary entrance door at (${home.entranceCoords.x}, ${home.entranceCoords.z}). Distance: ${home.distanceMeters}m from current position.`,
                              })
                            }
                            transform={`translate(${hx}, ${hy})`}
                            style={{ cursor: "pointer" }}
                          >
                            {/* Large Double-Pulsing Beacon Rings */}
                            <circle r="36" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2.5" strokeDasharray="6,4" className="ks-pin-pulse" />
                            <circle r="24" fill="none" stroke="#f59e0b" strokeWidth="3" className="ks-pin-pulse" />

                            {/* Solid Vibrant Pin Head with Gold Border */}
                            <circle r="15" fill="#059669" stroke="#fef08a" strokeWidth="3" filter="url(#glow)" />
                            <text x="0" y="5" textAnchor="middle" fontSize="13" fill="#ffffff">🏠</text>

                            {/* Prominent High-Contrast Callout Banner */}
                            <g transform="translate(0, -32)">
                              <rect
                                x="-95"
                                y="-22"
                                width="190"
                                height="25"
                                rx="6"
                                fill="#0f172a"
                                stroke="#f59e0b"
                                strokeWidth="2"
                              />
                              <text x="0" y="-6" textAnchor="middle" fill="#fef08a" fontSize="11" fontWeight="bold" letterSpacing="0.5px">
                                ★ MY HOUSE: {home.name.replace(/ \([^)]*\)/, "")}
                              </text>
                            </g>

                            {/* Entrance Coordinates Badge below */}
                            <g transform="translate(0, 26)">
                              <rect
                                x="-60"
                                y="-10"
                                width="120"
                                height="16"
                                rx="4"
                                fill="rgba(15, 23, 42, 0.88)"
                                stroke="#34d399"
                                strokeWidth="1"
                              />
                              <text x="0" y="2" textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="bold">
                                Door: ({home.entranceCoords.x}, {home.entranceCoords.z})
                              </text>
                            </g>
                          </g>
                        );
                      }

                      // Secondary owned/leased home
                      return (
                        <g
                          key={home.propertyId}
                          className="ks-map-pin ks-secondary-home-pin"
                          onClick={() => handleShowHomeOnMap(home)}
                          transform={`translate(${hx}, ${hy})`}
                          style={{ cursor: "pointer" }}
                        >
                          <circle r="12" fill="#065f46" stroke="#34d399" strokeWidth="2" />
                          <text x="0" y="4" textAnchor="middle" fontSize="10">🏠</text>
                          <text x="0" y="-16" textAnchor="middle" className="ks-pin-text prominent" fill="#a7f3d0">
                            {home.name.split(" ")[0]}
                          </text>
                        </g>
                      );
                    });
                  }

                  // Fallback if eligibleHomes is empty but homeNavInfo is present
                  if (homeNavInfo) {
                    return (
                      <g
                        className="ks-map-pin ks-home-pin ks-home-beacon"
                        onClick={() =>
                          setSelectedLandmark({
                            id: "my-home",
                            name: `My Home · ${homeNavInfo.name}`,
                            district: homeNavInfo.district,
                            x: homeNavInfo.entranceCoords.x,
                            z: homeNavInfo.entranceCoords.z,
                            category: "residence",
                            description: `Primary residence entrance at (${homeNavInfo.entranceCoords.x}, ${homeNavInfo.entranceCoords.z}). Distance: ${homeNavInfo.distanceMeters}m from current position.`,
                          })
                        }
                        transform={`translate(${toSvgX(homeNavInfo.entranceCoords.x)}, ${toSvgY(homeNavInfo.entranceCoords.z)})`}
                        style={{ cursor: "pointer" }}
                      >
                        <circle r="36" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2.5" strokeDasharray="6,4" className="ks-pin-pulse" />
                        <circle r="24" fill="none" stroke="#f59e0b" strokeWidth="3" className="ks-pin-pulse" />
                        <circle r="15" fill="#059669" stroke="#fef08a" strokeWidth="3" />
                        <text x="0" y="5" textAnchor="middle" fontSize="13" fill="#ffffff">🏠</text>
                        <g transform="translate(0, -32)">
                          <rect x="-95" y="-22" width="190" height="25" rx="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                          <text x="0" y="-6" textAnchor="middle" fill="#fef08a" fontSize="11" fontWeight="bold">
                            ★ MY HOUSE: {homeNavInfo.name}
                          </text>
                        </g>
                      </g>
                    );
                  }

                  return null;
                })()}

                {/* Live Player Position Marker with Directional Needle */}
                <g transform={`translate(${playerSvgX}, ${playerSvgY})`} filter="url(#glow)">
                  <circle r="12" fill="rgba(16, 185, 129, 0.35)" />
                  <circle r="7" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
                  {/* Directional heading needle */}
                  <line
                    x1="0"
                    y1="0"
                    x2={-Math.sin(playerHeading) * 16}
                    y2={-Math.cos(playerHeading) * 16}
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <text x="0" y="24" textAnchor="middle" className="ks-player-pin-label">
                    YOU (LIVE)
                  </text>
                </g>
              </svg>
            </div>

            {/* Selected Landmark Details Box */}
            {selectedLandmark && (
              <div className="ks-selected-landmark-card">
                <div className="ks-card-main">
                  <div className="ks-selected-card-header">
                    <span className={`ks-cat-tag ${selectedLandmark.category}`}>
                      {CATEGORY_COLORS[selectedLandmark.category].icon} {selectedLandmark.category.toUpperCase()}
                    </span>
                    <span className="ks-dist-tag">
                      {getDistanceToPlayer(selectedLandmark.x, selectedLandmark.z)}m away
                    </span>
                  </div>
                  <h3>{selectedLandmark.name}</h3>
                  <p>{selectedLandmark.description}</p>
                  <small className="ks-card-coords">
                    {selectedLandmark.district} · Map Coords: ({selectedLandmark.x}, {selectedLandmark.z})
                  </small>
                </div>
                <div className="ks-card-actions">
                  {gpsTarget === selectedLandmark.id ? (
                    <button className="ks-gps-btn active" onClick={() => onSetGPSTarget?.(null)}>
                      Clear GPS Waypoint ✓
                    </button>
                  ) : (
                    <button
                      className="ks-gps-btn"
                      onClick={() => {
                        onSetGPSTarget?.(selectedLandmark.id);
                      }}
                    >
                      Set GPS Destination ↗
                    </button>
                  )}
                  <button className="ks-close-subcard-btn" onClick={() => setSelectedLandmark(null)}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Dedicated MY PROPERTIES / HOME LIST */}
        {activeTab === "homes" && (
          <div className="ks-directory-tab-content ks-homes-tab-content">
            <div className="ks-directory-controls" style={{ padding: "14px 20px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#f8fafc", fontFamily: "'Fraunces', Georgia, serif" }}>
                    🏡 MY PROPERTIES / HOME LIST
                  </h3>
                  <small style={{ color: "#94a3b8", fontSize: "12px" }}>
                    Dynamic registry of all properties owned or leased by you across Kano.
                  </small>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span style={{ background: "#065f46", color: "#34d399", padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" }}>
                    {eligibleHomes.length} Registered {eligibleHomes.length === 1 ? "Property" : "Properties"}
                  </span>
                </div>
              </div>

              {devDiagnosticMessage && (
                <div
                  className="ks-dev-diagnostic-banner"
                  style={{
                    background: "#7f1d1d",
                    border: "1px solid #ef4444",
                    color: "#fef2f2",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    marginTop: "8px",
                  }}
                >
                  ⚠️ <strong>DEV DIAGNOSTIC:</strong> {devDiagnosticMessage}
                </div>
              )}
            </div>

            <div className="ks-directory-list">
              {eligibleHomes.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div
                    className="ks-directory-card ks-home-list-empty"
                    style={{
                      background: "linear-gradient(135deg, rgba(217, 119, 6, 0.15) 0%, rgba(180, 83, 9, 0.22) 100%)",
                      border: "1.5px solid #f59e0b",
                      borderRadius: "10px",
                      padding: "20px 24px",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "10px" }}>
                      <span style={{ fontSize: "32px" }}>🏡</span>
                      <div>
                        <h3 style={{ color: "#fef3c7", fontSize: "17px", margin: "0 0 4px 0", fontFamily: "'Fraunces', Georgia, serif" }}>
                          No Active Residential Deed or Lease On File
                        </h3>
                        <p style={{ color: "#cbd5e1", fontSize: "13px", margin: 0 }}>
                          You do not currently hold an active lease or freehold Certificate of Occupancy. Available Player Funds: <strong style={{ color: "#34d399", fontSize: "14px" }}>₦{cash.toLocaleString()}</strong>.
                        </p>
                      </div>
                    </div>
                    <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 12px 0" }}>
                      Select any of the 3 Kano residential properties below to lease or purchase directly with your funds, or route to the building entrance door in the city:
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "14px" }}>
                    {/* Unit 2B Card */}
                    {(() => {
                      const reg = PROPERTY_REGISTRY["unit-2b"];
                      const dist = Math.round(Math.hypot(playerCoords.x - reg.entranceDoor.x, playerCoords.z - reg.entranceDoor.z));
                      const canAffordLease = cash >= 75000;
                      return (
                        <div
                          className="ks-directory-card"
                          style={{
                            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
                            border: "1.5px solid #0284c7",
                            borderRadius: "10px",
                            padding: "16px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <span style={{ background: "rgba(14, 165, 233, 0.2)", color: "#38bdf8", border: "1px solid #0284c7", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
                                AVAILABLE TO LEASE
                              </span>
                              <span className="ks-dist-tag">{dist}m away</span>
                            </div>
                            <h4 style={{ margin: "0 0 6px 0", color: "#f8fafc", fontSize: "16px" }}>{reg.name}</h4>
                            <p style={{ color: "#cbd5e1", fontSize: "12px", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                              {reg.description}
                            </p>
                            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "8px", borderRadius: "6px", fontSize: "11px", color: "#94a3b8", marginBottom: "12px" }}>
                              <div>📍 <strong>Location:</strong> {getPropertyStreetDescription("unit-2b")}</div>
                              <div>🚪 <strong>Entrance:</strong> Coordinates ({reg.entranceDoor.x}, {reg.entranceDoor.z})</div>
                              <div style={{ marginTop: "4px", color: "#38bdf8", fontWeight: "bold" }}>
                                💰 Rent: ₦75,000 / month · Freehold Buy: ₦18,000,000
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button
                              className="ks-gps-btn"
                              style={{
                                background: canAffordLease ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "#475569",
                                borderColor: canAffordLease ? "#38bdf8" : "#64748b",
                                color: "#ffffff",
                                fontWeight: "bold",
                                fontSize: "12px",
                                padding: "8px 12px",
                                flex: "1 1 140px",
                                cursor: canAffordLease ? "pointer" : "not-allowed",
                              }}
                              disabled={!canAffordLease}
                              onClick={() => {
                                if (onLeaseProperty) {
                                  onLeaseProperty("unit-2b");
                                }
                              }}
                              title={canAffordLease ? "Sign monthly lease for Unit 2B (₦75,000)" : "Insufficient cash (Requires ₦75,000)"}
                            >
                              {canAffordLease ? "🔑 LEASE UNIT 2B (₦75,000) ↗" : "Need ₦75k to Lease"}
                            </button>
                            <button
                              className="ks-gps-btn"
                              style={{ padding: "6px 10px", fontSize: "11px", background: "#059669", borderColor: "#10b981" }}
                              onClick={() => {
                                setMapZoomTarget({ x: reg.entranceDoor.x, z: reg.entranceDoor.z, name: reg.name });
                                setIsMapZoomed(true);
                                setActiveTab("map");
                              }}
                            >
                              🗺️ View on Map ↗
                            </button>
                            <button
                              className="ks-gps-btn"
                              style={{ padding: "6px 10px", fontSize: "11px" }}
                              onClick={() => {
                                onSetGPSTarget?.("apartment");
                                onClose();
                              }}
                            >
                              🧭 Route ↗
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Bompai Penthouse Card */}
                    {(() => {
                      const reg = PROPERTY_REGISTRY["bompai-penthouse"];
                      const dist = Math.round(Math.hypot(playerCoords.x - reg.entranceDoor.x, playerCoords.z - reg.entranceDoor.z));
                      const canAffordBuy = cash >= reg.purchasePrice;
                      return (
                        <div
                          className="ks-directory-card"
                          style={{
                            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
                            border: "1.5px solid #d97706",
                            borderRadius: "10px",
                            padding: "16px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <span style={{ background: "rgba(234, 179, 8, 0.2)", color: "#facc15", border: "1px solid #ca8a04", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
                                FOR SALE (FREEHOLD)
                              </span>
                              <span className="ks-dist-tag">{dist}m away</span>
                            </div>
                            <h4 style={{ margin: "0 0 6px 0", color: "#f8fafc", fontSize: "16px" }}>{reg.name}</h4>
                            <p style={{ color: "#cbd5e1", fontSize: "12px", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                              {reg.description}
                            </p>
                            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "8px", borderRadius: "6px", fontSize: "11px", color: "#94a3b8", marginBottom: "12px" }}>
                              <div>📍 <strong>Location:</strong> {getPropertyStreetDescription("bompai-penthouse")}</div>
                              <div>🚪 <strong>Entrance:</strong> Coordinates ({reg.entranceDoor.x}, {reg.entranceDoor.z})</div>
                              <div style={{ marginTop: "4px", color: "#facc15", fontWeight: "bold" }}>
                                💰 Deed Purchase: ₦35,000,000
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button
                              className="ks-gps-btn"
                              style={{
                                background: canAffordBuy ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)" : "#475569",
                                borderColor: canAffordBuy ? "#f59e0b" : "#64748b",
                                color: "#ffffff",
                                fontWeight: "bold",
                                fontSize: "12px",
                                padding: "8px 12px",
                                flex: "1 1 140px",
                                cursor: canAffordBuy ? "pointer" : "not-allowed",
                              }}
                              disabled={!canAffordBuy}
                              onClick={() => {
                                if (onPurchaseProperty) {
                                  onPurchaseProperty("bompai-penthouse");
                                }
                              }}
                            >
                              {canAffordBuy ? "🏛️ PURCHASE (₦35M) ↗" : "Need ₦35M to Buy"}
                            </button>
                            <button
                              className="ks-gps-btn"
                              style={{ padding: "6px 10px", fontSize: "11px", background: "#059669", borderColor: "#10b981" }}
                              onClick={() => {
                                setMapZoomTarget({ x: reg.entranceDoor.x, z: reg.entranceDoor.z, name: reg.name });
                                setIsMapZoomed(true);
                                setActiveTab("map");
                              }}
                            >
                              🗺️ View on Map ↗
                            </button>
                            <button
                              className="ks-gps-btn"
                              style={{ padding: "6px 10px", fontSize: "11px" }}
                              onClick={() => {
                                onSetGPSTarget?.("bompai-flats");
                                onClose();
                              }}
                            >
                              🧭 Route ↗
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Al-Baraka Villa Card */}
                    {(() => {
                      const reg = PROPERTY_REGISTRY["albaraka-villa"];
                      const dist = Math.round(Math.hypot(playerCoords.x - reg.entranceDoor.x, playerCoords.z - reg.entranceDoor.z));
                      const canAffordBuy = cash >= reg.purchasePrice;
                      return (
                        <div
                          className="ks-directory-card"
                          style={{
                            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
                            border: "1.5px solid #10b981",
                            borderRadius: "10px",
                            padding: "16px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <span style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid #10b981", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
                                FOR SALE (FREEHOLD)
                              </span>
                              <span className="ks-dist-tag">{dist}m away</span>
                            </div>
                            <h4 style={{ margin: "0 0 6px 0", color: "#f8fafc", fontSize: "16px" }}>{reg.name}</h4>
                            <p style={{ color: "#cbd5e1", fontSize: "12px", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                              {reg.description}
                            </p>
                            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "8px", borderRadius: "6px", fontSize: "11px", color: "#94a3b8", marginBottom: "12px" }}>
                              <div>📍 <strong>Location:</strong> {getPropertyStreetDescription("albaraka-villa")}</div>
                              <div>🚪 <strong>Entrance:</strong> Coordinates ({reg.entranceDoor.x}, {reg.entranceDoor.z})</div>
                              <div style={{ marginTop: "4px", color: "#34d399", fontWeight: "bold" }}>
                                💰 Deed Purchase: ₦65,000,000
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button
                              className="ks-gps-btn"
                              style={{
                                background: canAffordBuy ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : "#475569",
                                borderColor: canAffordBuy ? "#10b981" : "#64748b",
                                color: "#ffffff",
                                fontWeight: "bold",
                                fontSize: "12px",
                                padding: "8px 12px",
                                flex: "1 1 140px",
                                cursor: canAffordBuy ? "pointer" : "not-allowed",
                              }}
                              disabled={!canAffordBuy}
                              onClick={() => {
                                if (onPurchaseProperty) {
                                  onPurchaseProperty("albaraka-villa");
                                }
                              }}
                            >
                              {canAffordBuy ? "🏡 PURCHASE (₦65M) ↗" : "Need ₦65M to Buy"}
                            </button>
                            <button
                              className="ks-gps-btn"
                              style={{ padding: "6px 10px", fontSize: "11px", background: "#059669", borderColor: "#10b981" }}
                              onClick={() => {
                                setMapZoomTarget({ x: reg.entranceDoor.x, z: reg.entranceDoor.z, name: reg.name });
                                setIsMapZoomed(true);
                                setActiveTab("map");
                              }}
                            >
                              🗺️ View on Map ↗
                            </button>
                            <button
                              className="ks-gps-btn"
                              style={{ padding: "6px 10px", fontSize: "11px" }}
                              onClick={() => {
                                onSetGPSTarget?.("villa");
                                onClose();
                              }}
                            >
                              🧭 Route ↗
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                eligibleHomes.map((home) => {
                  const isCurrentGps = gpsTarget === "my-home" ? home.isSelectedHome : (gpsTarget === home.propertyId || gpsTarget === home.landmarkId);
                  const streetDesc = getPropertyStreetDescription(home.propertyId);
                  const guidance = computeGpsGuidance(
                    playerCoords,
                    home.entranceCoords,
                    home.name,
                    home.district,
                  );

                  return (
                    <div
                      key={home.propertyId}
                      className="ks-directory-card ks-home-entry-card"
                      style={{
                        background: home.isSelectedHome
                          ? "linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 95, 70, 0.35) 100%)"
                          : "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)",
                        border: home.isSelectedHome ? "2px solid #10b981" : "1px solid rgba(255, 255, 255, 0.15)",
                        boxShadow: home.isSelectedHome ? "0 0 18px rgba(16, 185, 129, 0.3)" : "none",
                        borderRadius: "10px",
                        padding: "16px",
                      }}
                    >
                      <div className="ks-card-main">
                        <div className="ks-card-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <span
                              style={{
                                background: home.status === "LEASED" ? "rgba(14, 165, 233, 0.2)" : "rgba(234, 179, 8, 0.2)",
                                color: home.status === "LEASED" ? "#38bdf8" : "#facc15",
                                border: home.status === "LEASED" ? "1px solid #0284c7" : "1px solid #ca8a04",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: "bold",
                                letterSpacing: "0.5px",
                              }}
                            >
                              {home.status === "LEASED" ? "LEASED (ACTIVE RENTAL)" : "OWNED (FREEHOLD DEED)"}
                            </span>
                            {home.isSelectedHome && (
                              <span
                                style={{
                                  background: "#059669",
                                  color: "#ecfdf5",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                ⭐ MY HOME (PRIMARY)
                              </span>
                            )}
                          </div>
                          <span className="ks-dist-tag" style={{ fontSize: "12px", fontWeight: "bold" }}>
                            {guidance.distanceMeters}m away
                          </span>
                        </div>

                        <h3 style={{ margin: "10px 0 4px", fontSize: "17px", color: home.isSelectedHome ? "#34d399" : "#f8fafc" }}>
                          {home.name}
                        </h3>
                        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#cbd5e1", lineHeight: 1.4 }}>
                          {home.description}
                        </p>

                        {/* Location & Street Details Box */}
                        <div
                          style={{
                            background: "rgba(15, 23, 42, 0.6)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "6px",
                            padding: "8px 10px",
                            margin: "8px 0",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ color: "#94a3b8", marginBottom: "3px" }}>
                            📍 <strong style={{ color: "#e2e8f0" }}>Street / Area:</strong> {streetDesc}
                          </div>
                          <div style={{ color: "#94a3b8" }}>
                            🚪 <strong style={{ color: "#e2e8f0" }}>Physical Entrance:</strong> Map Location (X: <span style={{ color: "#34d399", fontWeight: "bold" }}>{home.entranceCoords.x}</span>, Z: <span style={{ color: "#34d399", fontWeight: "bold" }}>{home.entranceCoords.z}</span>)
                          </div>
                        </div>

                        {/* Simple Directions & Live Distance */}
                        <div
                          style={{
                            background: guidance.isArrived ? "rgba(16, 185, 129, 0.2)" : "rgba(6, 95, 70, 0.2)",
                            border: `1px solid ${guidance.isArrived ? "#34d399" : "#10b981"}`,
                            borderRadius: "6px",
                            padding: "6px 10px",
                            margin: "6px 0 10px 0",
                            fontSize: "12px",
                            color: guidance.isArrived ? "#34d399" : "#a7f3d0",
                            fontWeight: 500,
                          }}
                        >
                          {guidance.isArrived ? (
                            <span>🎉 <strong>ARRIVED:</strong> You are standing right at the entrance door! Press [E] to Enter.</span>
                          ) : (
                            <span>🧭 <strong>DIRECTIONS:</strong> Head {guidance.directionCardinal} · {guidance.distanceMeters}m directly to the entrance door. ({guidance.instructionText})</span>
                          )}
                        </div>
                      </div>

                      {/* Prominent Action Buttons */}
                      <div className="ks-card-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                        <button
                          className="ks-gps-btn ks-show-on-map-btn"
                          style={{
                            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                            borderColor: "#34d399",
                            color: "#ffffff",
                            fontWeight: "bold",
                            fontSize: "12px",
                            padding: "8px 14px",
                            flex: "1 1 180px",
                          }}
                          onClick={() => handleShowHomeOnMap(home)}
                          title="Open visual map, center on this entrance door, and zoom in with a large pulsing beacon"
                        >
                          🗺️ SHOW MY HOUSE ON MAP ↗
                        </button>

                        <button
                          className={`ks-gps-btn ${isCurrentGps ? "active" : ""}`}
                          style={{
                            background: isCurrentGps
                              ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                              : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                            borderColor: isCurrentGps ? "#34d399" : "#38bdf8",
                            fontWeight: "bold",
                            fontSize: "12px",
                            padding: "8px 14px",
                            flex: "1 1 180px",
                          }}
                          onClick={() => handleGuideMeThere(home)}
                          title="Activate live GPS navigation needle and simple turn-by-turn guidance to this door"
                        >
                          {isCurrentGps ? "🧭 GUIDING ACTIVE (WAYPOINT SET ✓)" : "🧭 GUIDE ME THERE ↗"}
                        </button>

                        {!home.isSelectedHome && (
                          <button
                            className="ks-gps-btn"
                            style={{
                              background: "#334155",
                              borderColor: "#64748b",
                              color: "#e2e8f0",
                              fontSize: "12px",
                              padding: "8px 12px",
                              flex: "1 1 150px",
                            }}
                            onClick={() => handleSelectHome(home.propertyId)}
                            title="Set as your primary home for GPS and life simulation"
                          >
                            ★ Set as Primary Home
                          </button>
                        )}

                        {onTeleportHome && (
                          <button
                            className="ks-gps-btn"
                            style={{
                              background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                              borderColor: "#818cf8",
                              color: "#ffffff",
                              fontSize: "12px",
                              padding: "8px 14px",
                              fontWeight: "bold",
                              flex: "1 1 160px",
                            }}
                            onClick={() => {
                              if (!home.isSelectedHome) {
                                handleSelectHome(home.propertyId);
                              }
                              onTeleportHome("entrance");
                              onClose();
                            }}
                            title="Instantaneous fast-travel dev shortcut: places player safely right at this entrance door"
                          >
                            ⚡ TELEPORT HOME (DEV)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Searchable Landmark Directory */}
        {activeTab === "directory" && (
          <div className="ks-directory-tab-content">
            {/* Filter controls */}
            <div className="ks-directory-controls">
              <input
                type="text"
                className="ks-directory-search"
                placeholder="Search landmarks, markets, workshops, or compounds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="ks-category-filter-pills">
                {(["all", "historic", "commercial", "residence", "industrial", "civic"] as const).map((cat) => (
                  <button
                    key={cat}
                    className={`ks-filter-pill ${categoryFilter === cat ? "active" : ""}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Landmarks List */}
            <div className="ks-directory-list">
              {/* MY PROPERTIES / HOME LIST Section in Directory */}
              <div style={{ gridColumn: "1 / -1", margin: "4px 0 8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", color: "#34d399", letterSpacing: "0.5px" }}>
                    🏡 MY PROPERTIES / HOME LIST ({eligibleHomes.length})
                  </h4>
                  <button
                    onClick={() => setActiveTab("homes")}
                    style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: "11px", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Manage Homes ↗
                  </button>
                </div>

                {devDiagnosticMessage && (
                  <div
                    className="ks-dev-diagnostic-banner"
                    style={{
                      background: "#7f1d1d",
                      border: "1px solid #ef4444",
                      color: "#fef2f2",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    ⚠️ <strong>DEV DIAGNOSTIC:</strong> {devDiagnosticMessage}
                  </div>
                )}

                {eligibleHomes.length === 0 ? (
                  <div
                    className="ks-directory-card"
                    style={{
                      background: "rgba(217, 119, 6, 0.12)",
                      border: "1.5px solid #f59e0b",
                    }}
                  >
                    <div className="ks-card-main">
                      <div className="ks-card-header-row">
                        <span className="ks-cat-tag residence">ℹ️ RESIDENCE GUIDE</span>
                      </div>
                      <h3>You don't own or lease a home yet. Visit the property listings to buy or lease one.</h3>
                      <p>You can lease Unit 2B at Airport View Apartments for ₦75,000/month or purchase Bompai Penthouse (₦35M) or Al-Baraka Villa (₦65M).</p>
                      <small className="ks-card-coords">
                        Airport Road · Sabon Gari · Residential Quarter
                      </small>
                    </div>
                    <div className="ks-card-actions">
                      <button
                        className="ks-gps-btn"
                        style={{ background: "#d97706" }}
                        onClick={() => {
                          onSetGPSTarget?.("apartment");
                          onClose();
                        }}
                      >
                        Route to Unit 2B ↗
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                    {eligibleHomes.map((home) => {
                      const isCurrentGps = gpsTarget === "my-home" ? home.isSelectedHome : (gpsTarget === home.propertyId || gpsTarget === home.landmarkId);
                      return (
                        <div
                          key={home.propertyId}
                          className="ks-directory-card ks-home-dir-card"
                          style={{
                            background: home.isSelectedHome
                              ? "linear-gradient(90deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 95, 70, 0.28) 100%)"
                              : "linear-gradient(90deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.6) 100%)",
                            border: home.isSelectedHome ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.15)",
                            margin: 0,
                          }}
                        >
                          <div className="ks-card-main">
                            <div className="ks-card-header-row">
                              <span className="ks-cat-tag residence">
                                {home.status === "LEASED" ? "LEASED" : "OWNED"}
                              </span>
                              {home.isSelectedHome && (
                                <span style={{ background: "#059669", color: "#ecfdf5", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
                                  ⭐ MY HOME
                                </span>
                              )}
                              <span className="ks-dist-tag">{home.distanceMeters}m away</span>
                            </div>
                            <h3 style={{ fontSize: "14px", margin: "4px 0" }}>{home.name}</h3>
                            <small className="ks-card-coords">
                              {home.district} · Entrance: ({home.entranceCoords.x}, {home.entranceCoords.z})
                            </small>
                          </div>
                          <div className="ks-card-actions" style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button
                              className="ks-gps-btn"
                              style={{ background: "#059669", borderColor: "#10b981", fontSize: "11px", padding: "4px 8px" }}
                              onClick={() => handleShowHomeOnMap(home)}
                            >
                              Show on Map ↗
                            </button>
                            <button
                              className={`ks-gps-btn ${isCurrentGps ? "active" : ""}`}
                              style={{ fontSize: "11px", padding: "4px 8px" }}
                              onClick={() => handleGuideMeThere(home)}
                            >
                              {isCurrentGps ? "Guiding Active ✓" : "Guide Me There ↗"}
                            </button>
                            {onTeleportHome && (
                              <button
                                className="ks-gps-btn"
                                style={{ background: "#4f46e5", borderColor: "#6366f1", fontSize: "11px", padding: "4px 8px" }}
                                onClick={() => {
                                  if (!home.isSelectedHome) {
                                    handleSelectHome(home.propertyId);
                                  }
                                  onTeleportHome("entrance");
                                  onClose();
                                }}
                              >
                                Teleport [Dev]
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ borderBottom: "1px solid rgba(244, 238, 223, 0.15)", margin: "10px 0 16px" }} />
              </div>

              {filteredLandmarks.map((lm) => {
                const isGpsActive = gpsTarget === lm.id;
                const distance = getDistanceToPlayer(lm.x, lm.z);
                const colors = CATEGORY_COLORS[lm.category];

                let propertyId: PropertyId | null = null;
                let isPropertyAccessible = false;
                const normalizedOwnedDir = (ownedProperties ?? []).map(normalizePropertyId).filter(Boolean) as PropertyId[];
                if (lm.id === "apartment") {
                  propertyId = "unit-2b";
                  isPropertyAccessible = Boolean(hasApartmentRental || normalizedOwnedDir.includes("unit-2b"));
                } else if (lm.id === "bompai-flats") {
                  propertyId = "bompai-penthouse";
                  isPropertyAccessible = Boolean(normalizedOwnedDir.includes("bompai-penthouse"));
                } else if (lm.id === "villa") {
                  propertyId = "albaraka-villa";
                  isPropertyAccessible = Boolean(normalizedOwnedDir.includes("albaraka-villa"));
                }
                const isSelectedHome = propertyId && (currentSelectedHomeId ? currentSelectedHomeId === propertyId : selectedHomePropertyId === propertyId);

                return (
                  <div key={lm.id} className="ks-directory-card">
                    <div className="ks-card-main">
                      <div className="ks-card-header-row">
                        <span className={`ks-cat-tag ${lm.category}`}>
                          {colors.icon} {lm.category.toUpperCase()}
                        </span>
                        {isPropertyAccessible && (
                          <span style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
                            {isSelectedHome ? "⭐ PRIMARY HOME" : "OWNED / LEASED"}
                          </span>
                        )}
                        <span className="ks-dist-tag">{distance}m away</span>
                      </div>
                      <h3>{lm.name}</h3>
                      <p>{lm.description}</p>
                      <small className="ks-card-coords">
                        {lm.district} · Coordinates: ({lm.x}, {lm.z})
                      </small>
                    </div>
                    <div className="ks-card-actions">
                      {!isPropertyAccessible && propertyId === "unit-2b" && (
                        <button
                          className="ks-gps-btn"
                          style={{
                            background: cash >= 75000 ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "#475569",
                            borderColor: cash >= 75000 ? "#38bdf8" : "#64748b",
                            color: "#ffffff",
                            fontWeight: "bold",
                            fontSize: "11px",
                            padding: "4px 8px",
                          }}
                          disabled={cash < 75000}
                          onClick={() => onLeaseProperty?.("unit-2b")}
                        >
                          {cash >= 75000 ? "🔑 Lease (₦75k) ↗" : "Need ₦75k"}
                        </button>
                      )}
                      {!isPropertyAccessible && propertyId === "bompai-penthouse" && (
                        <button
                          className="ks-gps-btn"
                          style={{
                            background: cash >= 35_000_000 ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)" : "#475569",
                            borderColor: cash >= 35_000_000 ? "#f59e0b" : "#64748b",
                            color: "#ffffff",
                            fontWeight: "bold",
                            fontSize: "11px",
                            padding: "4px 8px",
                          }}
                          disabled={cash < 35_000_000}
                          onClick={() => onPurchaseProperty?.("bompai-penthouse")}
                        >
                          {cash >= 35_000_000 ? "🏛️ Buy (₦35M) ↗" : "Need ₦35M"}
                        </button>
                      )}
                      {!isPropertyAccessible && propertyId === "albaraka-villa" && (
                        <button
                          className="ks-gps-btn"
                          style={{
                            background: cash >= 65_000_000 ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : "#475569",
                            borderColor: cash >= 65_000_000 ? "#10b981" : "#64748b",
                            color: "#ffffff",
                            fontWeight: "bold",
                            fontSize: "11px",
                            padding: "4px 8px",
                          }}
                          disabled={cash < 65_000_000}
                          onClick={() => onPurchaseProperty?.("albaraka-villa")}
                        >
                          {cash >= 65_000_000 ? "🏡 Buy (₦65M) ↗" : "Need ₦65M"}
                        </button>
                      )}
                      {isPropertyAccessible && !isSelectedHome && propertyId && (
                        <button
                          className="ks-gps-btn"
                          style={{ background: "#0d9488" }}
                          onClick={() => {
                            if (propertyId) handleSelectHome(propertyId);
                          }}
                        >
                          SET AS MY HOME
                        </button>
                      )}
                      {isGpsActive ? (
                        <button className="ks-gps-btn active" onClick={() => onSetGPSTarget?.(null)}>
                          Active Waypoint ✓
                        </button>
                      ) : (
                        <button
                          className="ks-gps-btn"
                          onClick={() => {
                            onSetGPSTarget?.(lm.id);
                            onClose();
                          }}
                        >
                          Set GPS Pin ↗
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: The Unknown Legacy - Story Progression & 1968 Indenture Archive */}
        {activeTab === "story" && (
          <div className="ks-story-tab-content">
            <div className="ks-story-header-card">
              <div className="ks-story-title-row">
                <div>
                  <span className="ks-story-badge">ORIGINAL STORY CAMPAIGN</span>
                  <h2>{storyInfo?.chapterTitle || "Chapter 1: Roots in the Ancient Dust"}</h2>
                </div>
                <div className="ks-story-stage-status">
                  <small>CURRENT STAGE</small>
                  <strong>{storyInfo?.stageName || "The Summons"}</strong>
                </div>
              </div>
              <div className="ks-story-objective-banner">
                <strong>PRIMARY OBJECTIVE:</strong> {storyInfo?.currentObjective}
              </div>
            </div>

            {/* Inspectable 1968 Indenture Document */}
            <div className="ks-indenture-scroll-card">
              <div className="ks-scroll-header">
                <div className="ks-scroll-seal">📜 HISTORIC ARCHIVE</div>
                <h3>{INDENTURE_1968.title}</h3>
                <small className="ks-scroll-date">REGISTERED: {INDENTURE_1968.date}</small>
              </div>

              <div className="ks-scroll-parties">
                <strong>SIGNATORY PARTIES:</strong>
                <ul>
                  {INDENTURE_1968.parties.map((party, idx) => (
                    <li key={idx}>{party}</li>
                  ))}
                </ul>
              </div>

              <div className="ks-scroll-body">
                <pre>{INDENTURE_1968.content}</pre>
              </div>

              <div className="ks-scroll-seals">
                <strong>AUTHENTICATION SEALS:</strong>
                <div className="ks-seals-grid">
                  {INDENTURE_1968.seals.map((seal, idx) => (
                    <span key={idx} className="ks-seal-chip">
                      🛡️ {seal}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Decision 1: Title Investigation (Clan Elders vs Arewa Bank) */}
            <div className="ks-decision-section">
              <h3>DECISION 1: ANCESTRAL TITLE INVESTIGATION</h3>
              <p>
                How will you verify the 1968 Trans-Saharan Partnership Indenture to clear the Dan-Kano compound title?
              </p>

              {storyInfo?.investigationChoice ? (
                <div className="ks-decision-result-card">
                  <strong>INVESTIGATION PATH COMPLETED:</strong>{" "}
                  {storyInfo.investigationChoice === "elders"
                    ? "Traditional Clan Elders at Dandali Community Square (+25 Elder Trust earned)"
                    : "Arewa Commercial Bank Colonial Ledger Audit (+₦10,000 Credit line granted)"}
                </div>
              ) : (
                <div className="ks-choices-grid">
                  <div className="ks-choice-card">
                    <h4>Option A: Consult Dandali Clan Elders</h4>
                    <p>
                      Seek the council of traditional clan elders seated under the grand neem tree at Dandali Square (-72, -72).
                    </p>
                    <div className="ks-choice-perk">Reward: +25 Elder Trust &amp; Oral Commercial Testimony</div>
                    <button
                      className="ks-choice-btn"
                      onClick={() => onChooseInvestigation?.("elders")}
                    >
                      Choose Clan Elders Path ↗
                    </button>
                  </div>

                  <div className="ks-choice-card">
                    <h4>Option B: Modern Financial Audit at Arewa Bank</h4>
                    <p>
                      Audit the colonial registry ledgers preserved inside Arewa Commercial Bank (80, -22).
                    </p>
                    <div className="ks-choice-perk">Reward: +₦10,000 Bank Credit &amp; Commercial Ledger Archive</div>
                    <button
                      className="ks-choice-btn"
                      onClick={() => onChooseInvestigation?.("bank")}
                    >
                      Choose Bank Audit Path ↗
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Decision 2: Commercial Career Foundation */}
            <div className="ks-decision-section">
              <h3>DECISION 2: FOUNDATIONS OF YOUR BUSINESS EMPIRE</h3>
              <p>
                Select your foundational commercial focus to expand your enterprise across Kano and the Sahel:
              </p>

              {storyInfo?.careerPathChoice ? (
                <div className="ks-decision-result-card career">
                  <strong>CHOSEN CAREER FOUNDATION:</strong>{" "}
                  {storyInfo.careerPathChoice.toUpperCase()}
                  <p className="ks-career-perk-summary">
                    {storyInfo.careerPathChoice === "transport" &&
                      "Active Perk: +15% freight payout bonus on all haulage contracts."}
                    {storyInfo.careerPathChoice === "trading" &&
                      "Active Perk: +15% profit margin on all Kurmi & Sabon Gari market retail goods."}
                    {storyInfo.careerPathChoice === "technology" &&
                      "Active Perk: +20% revenue from gaming stations & tech consulting services."}
                    {storyInfo.careerPathChoice === "property" &&
                      "Active Perk: 10% acquisition discount on all commercial & residential properties."}
                  </p>
                </div>
              ) : (
                <div className="ks-choices-grid four-col">
                  {/* Path 1: Transport */}
                  <div className="ks-choice-card">
                    <h4>🚚 Transport &amp; Logistics</h4>
                    <p>Partner with Kawu Freight Depot and Bala Driver for heavy haulage operations.</p>
                    <div className="ks-choice-perk">+15% Freight Contract Payout Bonus</div>
                    <button
                      className="ks-choice-btn"
                      disabled={!storyInfo?.canChooseCareer}
                      onClick={() => onChooseCareer?.("transport")}
                    >
                      Commit to Transport ↗
                    </button>
                  </div>

                  {/* Path 2: Trading */}
                  <div className="ks-choice-card">
                    <h4>🏺 Trading &amp; Retail</h4>
                    <p>Partner with Kasuwar Kurmi artisans and Sabon Gari traders for textile and craft outlets.</p>
                    <div className="ks-choice-perk">+15% Retail Goods Profit Margin</div>
                    <button
                      className="ks-choice-btn"
                      disabled={!storyInfo?.canChooseCareer}
                      onClick={() => onChooseCareer?.("trading")}
                    >
                      Commit to Trading ↗
                    </button>
                  </div>

                  {/* Path 3: Technology */}
                  <div className="ks-choice-card">
                    <h4>💻 Technology &amp; Services</h4>
                    <p>Partner with Zainab Bello at Kano Cyber Hub for esports tournaments and tech consulting.</p>
                    <div className="ks-choice-perk">+20% Gaming &amp; Tech Revenue</div>
                    <button
                      className="ks-choice-btn"
                      disabled={!storyInfo?.canChooseCareer}
                      onClick={() => onChooseCareer?.("technology")}
                    >
                      Commit to Tech ↗
                    </button>
                  </div>

                  {/* Path 4: Property */}
                  <div className="ks-choice-card">
                    <h4>🏢 Property &amp; Construction</h4>
                    <p>Partner with Amina Lawal Architecture for property acquisitions and luxury flats.</p>
                    <div className="ks-choice-perk">10% Real Estate Purchase Discount</div>
                    <button
                      className="ks-choice-btn"
                      disabled={!storyInfo?.canChooseCareer}
                      onClick={() => onChooseCareer?.("property")}
                    >
                      Commit to Property ↗
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Chapter 1 Conclusion & Vault Key */}
            <div className="ks-story-conclusion-card">
              <h3>CHAPTER 1 RESOLUTION</h3>
              {storyInfo?.isComplete ? (
                <div className="ks-conclusion-achieved">
                  <div className="ks-key-artifact">
                    <span className="ks-key-icon">🗝️</span>
                    <div>
                      <strong>BRONZE SAHEL VAULT KEY (1968)</strong>
                      <p>
                        Engraved with ancient Ajami script. Malam Kabiru whispers that it unlocks a subterranean merchant chamber under Dala Hill. Chapter 2: "Shadows Over the Sahel" awaits.
                      </p>
                    </div>
                  </div>
                  <div className="ks-completion-stamp">✓ CHAPTER 1 COMPLETED · ₦50,000 SECURED</div>
                </div>
              ) : (
                <div className="ks-conclusion-pending">
                  <p>
                    Complete the Investigation and establish your Career Foundation, then return to Malam Kabiru at Dan-Kano Zaure (-85, -68) to claim your ₦50,000 legacy settlement and the Bronze Vault Key!
                  </p>
                  <button
                    className="ks-button ks-button-primary"
                    disabled={!storyInfo?.careerPathChoice}
                    onClick={() => onResolveChapter1?.()}
                  >
                    Seal Dan-Kano Deed &amp; Claim Settlement (₦50,000) ↗
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
