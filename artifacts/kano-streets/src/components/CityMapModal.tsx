import { useState, useMemo, useEffect } from "react";
import { KANO_LANDMARKS, getGpsLandmark, type LandmarkCategory, type LandmarkLocation } from "../game/landmarks";
import { INDENTURE_1968 } from "../game/storySystem";
import { PROPERTY_REGISTRY } from "../game/propertyRegistry";
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
  onSetSelectedHome?: (propertyId: PropertyId) => unknown;
  onTeleportHome?: (destination?: "entrance" | "interior") => unknown;
  onFindMyHome?: () => unknown;
  onExamineIndenture?: () => boolean;
  onChooseInvestigation?: (choice: "elders" | "bank") => unknown;
  onChooseCareer?: (choice: CareerPathChoice) => unknown;
  onResolveChapter1?: () => unknown;
}

type TabType = "map" | "homes" | "directory" | "story";

export function toSvgX(worldX: number): number {
  return Math.round(((worldX + 136) / 272) * 800);
}

export function toSvgY(worldZ: number): number {
  return Math.round(((worldZ + 230) / 366) * 1000);
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
  onSetSelectedHome,
  onTeleportHome,
  onFindMyHome,
  onChooseInvestigation,
  onChooseCareer,
  onResolveChapter1,
}: CityMapModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("map");
  const [categoryFilter, setCategoryFilter] = useState<LandmarkCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkLocation | null>(null);

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

    // 2. Otherwise derive dynamically from property records
    const list: PlayerHomeEntry[] = [];
    const effectiveSelectedId = currentSelectedHomeId ?? (hasApartmentRental ? "unit-2b" : (ownedProperties[0] as PropertyId | null));

    // Unit 2B (Airport Road)
    const hasU2bLease = Boolean(hasApartmentRental);
    const hasU2bOwnership = Boolean(ownedProperties && ownedProperties.includes("unit-2b"));
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
    if (ownedProperties && ownedProperties.includes("bompai-penthouse")) {
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
    if (ownedProperties && ownedProperties.includes("albaraka-villa")) {
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

  const filteredLandmarks = KANO_LANDMARKS.filter((lm) => {
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
              📋 Directory ({KANO_LANDMARKS.length})
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
              {activeGpsLandmark && (
                <div className="ks-map-active-gps">
                  <strong>ACTIVE GPS:</strong>
                  <span>{activeGpsLandmark.name}</span>
                  <em>({getDistanceToPlayer(activeGpsLandmark.x, activeGpsLandmark.z)}m away)</em>
                  <button className="ks-gps-clear-btn" onClick={() => onSetGPSTarget?.(null)}>
                    Clear ✕
                  </button>
                </div>
              )}
              <div className="ks-map-hint">Click any landmark pin to view details or lock GPS navigation</div>
            </div>

            {/* MY HOME Quick Nav Card / Advisor Banner */}
            {activeSelectedHome ? (
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
                  <span style={{ fontSize: "20px" }}>🏠</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <strong style={{ color: "#34d399", fontSize: "13px", letterSpacing: "0.5px" }}>
                        MY HOME: {activeSelectedHome.name}
                      </strong>
                      <span style={{ background: "#059669", color: "#ecfdf5", fontSize: "10px", padding: "1px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                        {activeSelectedHome.status === "LEASED" ? "LEASED" : "OWNED"}
                      </span>
                      <span style={{ background: "#047857", color: "#d1fae5", fontSize: "10px", padding: "1px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                        PRIMARY
                      </span>
                    </div>
                    <small style={{ color: "#cbd5e1", fontSize: "11px" }}>
                      {activeSelectedHome.district} · Entrance: ({activeSelectedHome.entranceCoords.x}, {activeSelectedHome.entranceCoords.z}) · {activeSelectedHome.distanceMeters}m away
                    </small>
                    {eligibleHomes.length > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                        <span style={{ color: "#94a3b8", fontSize: "11px" }}>Switch Home:</span>
                        {eligibleHomes.map((h) => (
                          <button
                            key={h.propertyId}
                            onClick={() => handleSelectHome(h.propertyId)}
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
                    className={`ks-gps-btn ${gpsTarget === "my-home" ? "active" : ""}`}
                    onClick={() => {
                      if (gpsTarget === "my-home") onSetGPSTarget?.(null);
                      else if (onFindMyHome) onFindMyHome();
                      else onSetGPSTarget?.("my-home");
                    }}
                    style={{ padding: "4px 10px", fontSize: "11px" }}
                  >
                    {gpsTarget === "my-home" ? "GPS Locked to Home ✓" : "Find My Home ↗"}
                  </button>
                  <button
                    className="ks-gps-btn"
                    style={{ padding: "4px 10px", fontSize: "11px", background: "#059669" }}
                    onClick={() => setActiveTab("homes")}
                  >
                    My Properties ({eligibleHomes.length}) ↗
                  </button>
                  {onTeleportHome && (
                    <button
                      className="ks-gps-btn"
                      style={{ padding: "4px 10px", fontSize: "11px", background: "#4f46e5", borderColor: "#6366f1" }}
                      onClick={() => {
                        onTeleportHome("entrance");
                        onClose();
                      }}
                      title="Fast travel test shortcut to home entrance"
                    >
                      Teleport Home [Dev]
                    </button>
                  )}
                </div>
              </div>
            ) : (
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
              <svg viewBox="0 0 800 1000" className="ks-world-svg-map">
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
                {activeGpsLandmark && (
                  <line
                    x1={playerSvgX}
                    y1={playerSvgY}
                    x2={toSvgX(activeGpsLandmark.x)}
                    y2={toSvgY(activeGpsLandmark.z)}
                    stroke="#10b981"
                    strokeWidth="3.5"
                    strokeDasharray="8,6"
                    className="ks-gps-svg-line"
                  />
                )}

                {/* Landmark Pins */}
                {KANO_LANDMARKS.map((lm) => {
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

                {/* Dedicated MY HOME Pin on Map */}
                {homeNavInfo && (
                  <g
                    className="ks-map-pin ks-home-pin"
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
                    <circle r="20" fill="none" stroke="#f59e0b" strokeWidth="3" className="ks-pin-pulse" />
                    <circle r="13" fill="#10b981" stroke="#fef08a" strokeWidth="2.5" />
                    <text x="0" y="4" textAnchor="middle" fontSize="12" fill="#ffffff">🏠</text>
                    <text x="0" y="-16" textAnchor="middle" className="ks-pin-text prominent" fill="#fef08a" fontWeight="bold">
                      MY HOME
                    </text>
                  </g>
                )}

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
                <div
                  className="ks-directory-card ks-home-list-empty"
                  style={{
                    background: "rgba(217, 119, 6, 0.12)",
                    border: "1.5px dashed #f59e0b",
                    padding: "24px 20px",
                    textAlign: "center",
                    gridColumn: "1 / -1",
                  }}
                >
                  <div style={{ fontSize: "36px", marginBottom: "8px" }}>🏡</div>
                  <h3 style={{ color: "#f59e0b", fontSize: "16px", margin: "0 0 6px 0" }}>
                    You don't own or lease a home yet. Visit the property listings to buy or lease one.
                  </h3>
                  <p style={{ color: "#cbd5e1", fontSize: "13px", maxWidth: "600px", margin: "0 auto 16px" }}>
                    Explore residential real estate options across the city: lease Unit 2B at Airport View Apartments for ₦75,000/month or acquire freehold deeds for Bompai Heights Luxury Penthouse (₦35M) or Al-Baraka Executive Villa (₦65M).
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      className="ks-gps-btn"
                      style={{ background: "#d97706", borderColor: "#f59e0b", padding: "8px 16px", fontSize: "12px" }}
                      onClick={() => {
                        onSetGPSTarget?.("apartment");
                        onClose();
                      }}
                    >
                      Route to Unit 2B Leasing Office (Airport Road) ↗
                    </button>
                    <button
                      className="ks-gps-btn"
                      style={{ padding: "8px 16px", fontSize: "12px" }}
                      onClick={() => setActiveTab("directory")}
                    >
                      Browse All City Landmarks &amp; Real Estate ↗
                    </button>
                  </div>
                </div>
              ) : (
                eligibleHomes.map((home) => {
                  const isCurrentGps = gpsTarget === "my-home" ? home.isSelectedHome : (gpsTarget === home.propertyId || gpsTarget === home.landmarkId);
                  return (
                    <div
                      key={home.propertyId}
                      className="ks-directory-card ks-home-entry-card"
                      style={{
                        background: home.isSelectedHome
                          ? "linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 95, 70, 0.3) 100%)"
                          : "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)",
                        border: home.isSelectedHome ? "2px solid #10b981" : "1px solid rgba(255, 255, 255, 0.15)",
                        boxShadow: home.isSelectedHome ? "0 0 15px rgba(16, 185, 129, 0.25)" : "none",
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
                          <span className="ks-dist-tag">{home.distanceMeters}m away</span>
                        </div>

                        <h3 style={{ margin: "8px 0 4px", fontSize: "16px", color: home.isSelectedHome ? "#34d399" : "#f8fafc" }}>
                          {home.name}
                        </h3>
                        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#cbd5e1" }}>
                          {home.description}
                        </p>
                        <small className="ks-card-coords" style={{ color: "#94a3b8", display: "block" }}>
                          {home.district} · Physical Entrance: ({home.entranceCoords.x}, {home.entranceCoords.z})
                        </small>
                      </div>

                      <div className="ks-card-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                        {home.isSelectedHome ? (
                          <button
                            className={`ks-gps-btn ${isCurrentGps ? "active" : ""}`}
                            style={{ flex: 1 }}
                            onClick={() => {
                              if (isCurrentGps) onSetGPSTarget?.(null);
                              else if (onFindMyHome) onFindMyHome();
                              else onSetGPSTarget?.("my-home");
                              onClose();
                            }}
                          >
                            {isCurrentGps ? "FIND MY HOME (ACTIVE GPS ✓)" : "FIND MY HOME ↗"}
                          </button>
                        ) : (
                          <button
                            className="ks-gps-btn"
                            style={{ background: "#0d9488", borderColor: "#14b8a6", flex: 1 }}
                            onClick={() => handleSelectHome(home.propertyId)}
                          >
                            SET AS MY HOME
                          </button>
                        )}

                        {!home.isSelectedHome && (
                          <button
                            className={`ks-gps-btn ${isCurrentGps ? "active" : ""}`}
                            onClick={() => {
                              if (isCurrentGps) onSetGPSTarget?.(null);
                              else onSetGPSTarget?.(home.propertyId);
                              onClose();
                            }}
                          >
                            {isCurrentGps ? "Waypoint Set ✓" : "Route to Entrance ↗"}
                          </button>
                        )}

                        {onTeleportHome && (
                          <button
                            className="ks-gps-btn"
                            style={{ background: "#4f46e5", borderColor: "#6366f1" }}
                            onClick={() => {
                              if (!home.isSelectedHome) {
                                handleSelectHome(home.propertyId);
                              }
                              onTeleportHome("entrance");
                              onClose();
                            }}
                            title="Fast-travel test dev shortcut to this property's entrance"
                          >
                            Teleport [Dev]
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
                          <div className="ks-card-actions" style={{ marginTop: "8px" }}>
                            {home.isSelectedHome ? (
                              <button
                                className={`ks-gps-btn ${isCurrentGps ? "active" : ""}`}
                                onClick={() => {
                                  if (isCurrentGps) onSetGPSTarget?.(null);
                                  else if (onFindMyHome) onFindMyHome();
                                  else onSetGPSTarget?.("my-home");
                                  onClose();
                                }}
                              >
                                {isCurrentGps ? "Active Waypoint ✓" : "FIND MY HOME ↗"}
                              </button>
                            ) : (
                              <button
                                className="ks-gps-btn"
                                style={{ background: "#0d9488" }}
                                onClick={() => handleSelectHome(home.propertyId)}
                              >
                                SET AS MY HOME
                              </button>
                            )}
                            {onTeleportHome && (
                              <button
                                className="ks-gps-btn"
                                style={{ background: "#4f46e5", borderColor: "#6366f1" }}
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
                if (lm.id === "apartment") {
                  propertyId = "unit-2b";
                  isPropertyAccessible = Boolean(hasApartmentRental || ownedProperties.includes("unit-2b"));
                } else if (lm.id === "bompai-flats") {
                  propertyId = "bompai-penthouse";
                  isPropertyAccessible = Boolean(ownedProperties.includes("bompai-penthouse"));
                } else if (lm.id === "villa") {
                  propertyId = "albaraka-villa";
                  isPropertyAccessible = Boolean(ownedProperties.includes("albaraka-villa"));
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
