import { useState } from "react";
import { KANO_LANDMARKS, type LandmarkCategory, type LandmarkLocation } from "../game/landmarks";
import { INDENTURE_1968 } from "../game/storySystem";
import type { CareerPathChoice, InvestigationChoice, StorySnapshotInfo } from "../game/types";

export interface CityMapModalProps {
  onClose: () => void;
  playerCoords?: { x: number; z: number };
  playerHeading?: number;
  gpsTarget?: string | null;
  onSetGPSTarget?: (id: string | null) => void;
  storyInfo?: StorySnapshotInfo | null;
  onExamineIndenture?: () => boolean;
  onChooseInvestigation?: (choice: "elders" | "bank") => unknown;
  onChooseCareer?: (choice: CareerPathChoice) => unknown;
  onResolveChapter1?: () => unknown;
}

type TabType = "map" | "directory" | "story";

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
  onChooseInvestigation,
  onChooseCareer,
  onResolveChapter1,
}: CityMapModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("map");
  const [categoryFilter, setCategoryFilter] = useState<LandmarkCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkLocation | null>(null);

  const filteredLandmarks = KANO_LANDMARKS.filter((lm) => {
    const matchesCategory = categoryFilter === "all" || lm.category === categoryFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      lm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lm.district.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeGpsLandmark = gpsTarget ? KANO_LANDMARKS.find((l) => l.id === gpsTarget) : null;
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

        {/* Tab 2: Searchable Landmark Directory */}
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
              {filteredLandmarks.map((lm) => {
                const isGpsActive = gpsTarget === lm.id;
                const distance = getDistanceToPlayer(lm.x, lm.z);
                const colors = CATEGORY_COLORS[lm.category];

                return (
                  <div key={lm.id} className="ks-directory-card">
                    <div className="ks-card-main">
                      <div className="ks-card-header-row">
                        <span className={`ks-cat-tag ${lm.category}`}>
                          {colors.icon} {lm.category.toUpperCase()}
                        </span>
                        <span className="ks-dist-tag">{distance}m away</span>
                      </div>
                      <h3>{lm.name}</h3>
                      <p>{lm.description}</p>
                      <small className="ks-card-coords">
                        {lm.district} · Coordinates: ({lm.x}, {lm.z})
                      </small>
                    </div>
                    <div className="ks-card-actions">
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
