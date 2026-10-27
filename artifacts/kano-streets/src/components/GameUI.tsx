import { useEffect, useState } from 'react';
import './GameUI.css';
import TouchControls from './TouchControls';
import type { ActiveMissionInfo, CareerPathChoice, SocialContact, StorySnapshotInfo, VehicleType, FurnitureInstance, PropertyId, HomeNavInfo, NeedsState, FreelanceSnapshotInfo, PlayerHomeEntry } from '../game/types';
import { KANO_LANDMARKS, getGpsLandmark, computeGpsGuidance } from '../game/landmarks';
import { CAREER_MISSIONS_CATALOG } from '../game/missionSystem';
import CityMapModal from './CityMapModal';
import FurnitureShopModal from './FurnitureShopModal';
import FurnishingOverlay from './FurnishingOverlay';

export type Screen = 'menu' | 'playing' | 'paused';
export type Mode = 'on-foot' | 'driving';
export type GraphicsQuality = 'performance' | 'balanced' | 'quality';

export interface GameUIProps {
  screen: Screen;
  mode: Mode;
  vehicleType?: VehicleType | null;
  location: string;
  speedKmh: number;
  interactionPrompt: string | null;
  statusMessage: string | null;
  cash?: number;
  trafficFine?: number;
  hasApartmentRental?: boolean;
  activeInterior?: string | null;
  timeString?: string;
  gameScore?: number;
  featuredContact?: SocialContact | null;
  ownedProperties?: string[];
  ownedBusinesses?: string[];
  dailyIncome?: number;
  dayCount?: number;
  gpsTarget?: string | null;
  activeMission?: ActiveMissionInfo | null;
  availableMissionsCount?: number;
  playerCoords?: { x: number; z: number };
  playerHeading?: number;
  storyInfo?: StorySnapshotInfo | null;
  weatherPreset?: string;
  weatherDisplayName?: string;
  audioMuted?: boolean;
  isFurnishingMode?: boolean;
  furnishingTargetName?: string | null;
  unplacedFurnitureCount?: number;
  placedFurnitureCount?: number;
  isFurnitureShopOpen?: boolean;
  selectedHomePropertyId?: PropertyId | null;
  homeNavInfo?: HomeNavInfo | null;
  playerHomes?: PlayerHomeEntry[];
  needs?: NeedsState;
  freelanceInfo?: FreelanceSnapshotInfo;
  graphicsQuality: GraphicsQuality;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onControlKey: (key: string, pressed: boolean) => void;
  onSetGPSTarget?: (id: string | null) => void;
  onSetSelectedHome?: (propertyId: PropertyId) => unknown;
  onTeleportHome?: (destination?: "entrance" | "interior") => unknown;
  onFindMyHome?: () => unknown;
  onLeaseProperty?: (propertyId?: PropertyId) => { success: boolean; message: string };
  onPurchaseProperty?: (propertyId: PropertyId) => { success: boolean; message: string };
  onAcceptMission?: (id: string) => boolean;
  onCancelMission?: () => boolean;
  onExamineIndenture?: () => boolean;
  onChooseInvestigation?: (choice: "elders" | "bank") => unknown;
  onChooseCareer?: (choice: CareerPathChoice) => unknown;
  onResolveChapter1?: () => unknown;
  onCycleWeather?: () => void;
  onToggleAudioMute?: () => void;
  onOpenFurnitureShop?: () => void;
  onCloseFurnitureShop?: () => void;
  onPurchaseFurniture?: (catalogId: string) => { success: boolean; message: string };
  onToggleFurnishingMode?: () => { success: boolean; message: string };
  onPlaceFurnitureItem?: (
    instanceId: string,
    room: string,
    floor: number,
    position: { x: number; y: number; z: number },
    rotationY: number,
  ) => { success: boolean; message: string };
  onMoveFurnitureItem?: (
    instanceId: string,
    position: { x: number; y: number; z: number },
    rotationY: number,
  ) => { success: boolean; message: string };
  onStoreFurnitureItem?: (instanceId: string) => { success: boolean; message: string };
  onRotateFurnitureItem?: (instanceId: string, deltaYaw: number) => { success: boolean; message: string };
  getUnplacedFurniture?: () => FurnitureInstance[];
  getPlacedFurniture?: (propertyId?: PropertyId) => FurnitureInstance[];
  onQualityChange: (quality: GraphicsQuality) => void;
}

function BrandMark() {
  return (
    <span className="ks-brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Key({ children }: { children: string }) {
  return <kbd className="ks-key">{children}</kbd>;
}

export default function GameUI({
  screen,
  mode,
  vehicleType,
  location,
  speedKmh,
  interactionPrompt,
  statusMessage,
  cash,
  trafficFine,
  hasApartmentRental,
  activeInterior,
  timeString,
  gameScore,
  featuredContact,
  ownedProperties,
  ownedBusinesses,
  dailyIncome,
  dayCount,
  gpsTarget,
  activeMission,
  availableMissionsCount,
  playerCoords,
  playerHeading,
  storyInfo,
  weatherPreset: _weatherPreset,
  weatherDisplayName,
  audioMuted,
  isFurnishingMode,
  furnishingTargetName,
  unplacedFurnitureCount: _unplacedCount,
  placedFurnitureCount: _placedCount,
  isFurnitureShopOpen,
  selectedHomePropertyId,
  homeNavInfo,
  playerHomes,
  needs,
  freelanceInfo: _freelanceInfo,
  graphicsQuality,
  onStart,
  onPause,
  onResume,
  onReset,
  onControlKey,
  onSetGPSTarget,
  onSetSelectedHome,
  onTeleportHome,
  onFindMyHome,
  onLeaseProperty,
  onPurchaseProperty,
  onAcceptMission,
  onCancelMission,
  onExamineIndenture,
  onChooseInvestigation,
  onChooseCareer,
  onResolveChapter1,
  onCycleWeather,
  onToggleAudioMute,
  onOpenFurnitureShop,
  onCloseFurnitureShop,
  onPurchaseFurniture,
  onToggleFurnishingMode,
  onPlaceFurnitureItem,
  onMoveFurnitureItem,
  onStoreFurnitureItem,
  onRotateFurnitureItem,
  getUnplacedFurniture,
  getPlacedFurniture,
  onQualityChange,
}: GameUIProps) {
  const [showDirectory, setShowDirectory] = useState(false);
  const [showMissions, setShowMissions] = useState(false);

  const isInsideHome = activeInterior === 'apartment' || activeInterior === 'penthouse' || activeInterior === 'house';
  const currentPropertyId: PropertyId = activeInterior === 'apartment' ? 'unit-2b' : activeInterior === 'penthouse' ? 'bompai-penthouse' : 'albaraka-villa';
  const canFurnish = isInsideHome && Boolean(hasApartmentRental || (ownedProperties && ownedProperties.includes(currentPropertyId)));
  const isInsideShowroom = activeInterior === 'furniture-showroom';

  useEffect(() => {
    if (screen !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'm' || e.key === 'M') {
        setShowDirectory((prev) => !prev);
      } else if (e.key === 'h' || e.key === 'H') {
        if (gpsTarget === "my-home") onSetGPSTarget?.(null);
        else if (onFindMyHome) onFindMyHome();
        else onSetGPSTarget?.("my-home");
      } else if (e.key === 'j' || e.key === 'J') {
        setShowMissions((prev) => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        onCycleWeather?.();
      } else if (e.key === 'u' || e.key === 'U') {
        onToggleAudioMute?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, onCycleWeather, onToggleAudioMute, gpsTarget, onFindMyHome, onSetGPSTarget]);

  if (screen === 'menu') {
    return (
      <div className="ks-ui ks-menu">
        <div className="ks-menu-top">
          <div className="ks-brand">
            <BrandMark />
            <span>KANO / FIELD NOTES</span>
          </div>
          <span className="ks-build-tag"><i /> OPEN WORLD PROTOTYPE</span>
        </div>

        <main className="ks-menu-content">
          <div className="ks-edition">A SMALL PLACE, WIDE OPEN</div>
          <h1>Kano<br /><em>Streets</em></h1>
          <p className="ks-menu-intro">
            Take the long way home. Walk the lanes, find a ride, and see what’s around the next corner.
          </p>
          <button className="ks-button ks-button-primary" onClick={onStart}>
            <span>Enter the neighborhood</span>
            <span className="ks-button-arrow" aria-hidden="true">↗</span>
          </button>
          <div className="ks-menu-controls ks-desktop-controls">
            <div className="ks-control-line"><span className="ks-control-label">MOVE</span><span><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> <small>or arrows</small></span></div>
            <div className="ks-control-line"><span className="ks-control-label">LOOK</span><span><Key>MOUSE</Key></span></div>
            <div className="ks-control-line"><span className="ks-control-label">INTERACT</span><span><Key>E</Key></span></div>
            <div className="ks-control-line"><span className="ks-control-label">RUN</span><span><Key>SHIFT</Key></span></div>
            <div className="ks-control-line"><span className="ks-control-label">JUMP</span><span><Key>SPACE</Key></span></div>
            <div className="ks-control-line"><span className="ks-control-label">RESET</span><span><Key>R</Key></span></div>
          </div>
          <p className="ks-touch-menu-hint">Use the on-screen pad to move; drag open space to look.</p>
        </main>

        <div className="ks-menu-aside" aria-hidden="true">
          <div className="ks-aside-crosshair"><span /><span /></div>
          <div className="ks-aside-caption"><span>12° 00′ N</span><span>THE CITY, AT YOUR PACE</span></div>
        </div>
        <footer className="ks-menu-footer">
          <span>AN ORIGINAL NEIGHBORHOOD, INSPIRED BY KANO</span>
          <span className="ks-prototype-note">World, car &amp; character are original procedural prototype geometry — not photorealistic scans or purchased models.</span>
        </footer>
      </div>
    );
  }

  const activeGpsLandmark = getGpsLandmark(gpsTarget, homeNavInfo);

  return (
    <div className={`ks-ui ks-gameplay ${screen === 'paused' ? 'is-paused' : ''}`}>
      {screen === 'playing' && (
        <>
          <TouchControls
            mode={mode}
            onControlKey={onControlKey}
            onPause={onPause}
            onReset={onReset}
          />
          <header className="ks-hud-header">
            <div className="ks-hud-brand"><BrandMark /><span>KANO <i>/</i> STREETS</span></div>
            <div className="ks-hud-location"><span className="ks-live-dot" /> {location} <span className="ks-location-divider">/</span> FREE ROAM</div>
            <div className="ks-hud-time"><small>TIME</small> <strong>{timeString ?? "10:00"}</strong></div>
            {homeNavInfo && (
              <button
                className={`ks-hud-directory-btn ks-hud-home-btn ${gpsTarget === "my-home" ? "active" : ""}`}
                onClick={() => {
                  if (gpsTarget === "my-home") onSetGPSTarget?.(null);
                  else if (onFindMyHome) onFindMyHome();
                  else onSetGPSTarget?.("my-home");
                }}
                title={`Set GPS navigation to your primary home (${homeNavInfo.name})`}
                aria-label="Set GPS to My Home"
              >
                <Key>H</Key>
                <span>🏠 HOME ({homeNavInfo.distanceMeters}m)</span>
              </button>
            )}
            <button
              className="ks-hud-directory-btn"
              onClick={() => setShowDirectory(!showDirectory)}
              aria-label="Toggle City Directory and GPS navigation"
            >
              <Key>M</Key>
              <span>DIRECTORY</span>
            </button>
            <button
              className="ks-hud-directory-btn ks-hud-mission-btn"
              onClick={() => setShowMissions(!showMissions)}
              aria-label="Toggle Kawu Logistics Dispatch Board"
            >
              <Key>J</Key>
              <span>MISSIONS{availableMissionsCount ? ` (${availableMissionsCount})` : ''}</span>
            </button>
            <button
              className="ks-hud-directory-btn ks-hud-weather-btn"
              onClick={onCycleWeather}
              title="Change Sahel weather preset [N]"
              aria-label="Cycle Weather Atmosphere"
            >
              <Key>N</Key>
              <span>{weatherDisplayName ? weatherDisplayName.toUpperCase() : "SAHEL WEATHER"}</span>
            </button>
            <button
              className="ks-hud-directory-btn ks-hud-audio-btn"
              onClick={onToggleAudioMute}
              title={audioMuted ? "Unmute Ambient & Engine Audio [U]" : "Mute Audio [U]"}
              aria-label="Toggle Audio Mute"
            >
              <Key>U</Key>
              <span>{audioMuted ? "🔇 MUTED" : "🔊 AUDIO"}</span>
            </button>
            {canFurnish && (
              <button
                className="ks-hud-directory-btn"
                onClick={() => onToggleFurnishingMode?.()}
                title="Furnish and customize your residence [F]"
                aria-label="Toggle Home Furnishing Mode"
                style={{
                  background: isFurnishingMode ? "var(--ks-copper)" : undefined,
                  color: isFurnishingMode ? "#172421" : undefined,
                  borderColor: isFurnishingMode ? "var(--ks-copper)" : undefined,
                }}
              >
                <Key>F</Key>
                <span>FURNISH</span>
              </button>
            )}
            <button
              className="ks-hud-directory-btn"
              onClick={() => {
                if (isFurnitureShopOpen) {
                  onCloseFurnitureShop?.();
                } else {
                  onOpenFurnitureShop?.();
                }
              }}
              title="Browse Arewa Royal Furniture & Electronics Showroom"
              aria-label="Open Furniture Catalogue"
              style={{
                background: isInsideShowroom ? "rgba(34, 197, 94, 0.2)" : undefined,
                borderColor: isInsideShowroom ? "rgba(34, 197, 94, 0.5)" : undefined,
              }}
            >
              <span>🛋️ SHOP</span>
            </button>
            <span className="ks-pause-hint"><Key>ESC</Key><span>PAUSE</span></span>
          </header>

          {/* Needs Simulation HUD Bars */}
          {needs && (
            <div className="ks-hud-needs-bar" style={{ display: "flex", gap: "14px", alignItems: "center", background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "5px 12px", margin: "6px 16px", backdropFilter: "blur(6px)", width: "fit-content", pointerEvents: "auto" }}>
              <div title="Hunger Level: Eat Suya, Mai Shayi tea/bread, or home kitchen meal" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                <span>🍖</span>
                <div style={{ width: "48px", height: "6px", background: "rgba(255,255,255,0.2)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${needs.hunger}%`, height: "100%", background: needs.hunger < 20 ? "#ef4444" : needs.hunger < 50 ? "#f59e0b" : "#22c55e", transition: "width 0.3s" }} />
                </div>
                <span style={{ color: needs.hunger < 20 ? "#f87171" : "#e2e8f0", fontSize: "11px", fontWeight: "bold" }}>{needs.hunger}%</span>
              </div>
              <div title="Energy Level: Sleep in your bed at home to restore to 100%" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                <span>⚡</span>
                <div style={{ width: "48px", height: "6px", background: "rgba(255,255,255,0.2)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${needs.energy}%`, height: "100%", background: needs.energy < 20 ? "#ef4444" : needs.energy < 50 ? "#f59e0b" : "#38bdf8", transition: "width 0.3s" }} />
                </div>
                <span style={{ color: needs.energy < 20 ? "#f87171" : "#e2e8f0", fontSize: "11px", fontWeight: "bold" }}>{needs.energy}%</span>
              </div>
              <div title="Hygiene Level: Shower or bathe in your residence to wash Sahel dust" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                <span>🚿</span>
                <div style={{ width: "48px", height: "6px", background: "rgba(255,255,255,0.2)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${needs.hygiene}%`, height: "100%", background: needs.hygiene < 20 ? "#ef4444" : needs.hygiene < 50 ? "#f59e0b" : "#a855f7", transition: "width 0.3s" }} />
                </div>
                <span style={{ color: needs.hygiene < 20 ? "#f87171" : "#e2e8f0", fontSize: "11px", fontWeight: "bold" }}>{needs.hygiene}%</span>
              </div>
            </div>
          )}

          {storyInfo && (
            <div
              className="ks-story-chip"
              role="status"
              onClick={() => setShowDirectory(true)}
              title="Click or press [M] to open City Map & Story Archive"
              style={{ cursor: "pointer" }}
            >
              <span className="ks-story-chip-tag">STORY: CH.1</span>
              <div className="ks-story-chip-info">
                <strong>{storyInfo.stageName}</strong>
                <span>{storyInfo.currentObjective}</span>
              </div>
              <span className="ks-story-chip-hint">Press [M]</span>
            </div>
          )}

          {activeGpsLandmark && (() => {
            const guidance = playerCoords
              ? computeGpsGuidance(playerCoords, { x: activeGpsLandmark.x, z: activeGpsLandmark.z }, activeGpsLandmark.name, activeGpsLandmark.district)
              : null;
            const isHome = gpsTarget === "my-home" || activeGpsLandmark.id === "my-home" || activeGpsLandmark.category === "residence";
            return (
              <div className="ks-gps-chip" role="status" style={{ minWidth: "290px", borderColor: isHome ? "#10b981" : undefined }}>
                <span className="ks-gps-icon">{isHome ? "🏠" : "↗"}</span>
                <div className="ks-gps-info">
                  <strong style={{ color: isHome ? "#34d399" : undefined }}>
                    {isHome ? `MY HOUSE: ${activeGpsLandmark.name}` : `GPS: ${activeGpsLandmark.name}`}
                  </strong>
                  {guidance ? (
                    guidance.isArrived ? (
                      <span style={{ color: "#34d399", fontWeight: "bold", display: "block", fontSize: "11px" }}>
                        🎉 ARRIVED AT ENTRANCE DOOR · Press [E] to Enter
                      </span>
                    ) : (
                      <span style={{ color: "#e2e8f0", fontSize: "11px", display: "block" }}>
                        📍 <strong>{guidance.distanceMeters}m</strong> · {guidance.instructionText}
                      </span>
                    )
                  ) : (
                    <small>{activeGpsLandmark.district} ({activeGpsLandmark.x}, {activeGpsLandmark.z})</small>
                  )}
                </div>
                <button
                  className="ks-gps-clear"
                  onClick={() => onSetGPSTarget?.(null)}
                  title="Clear GPS waypoint"
                >
                  ✕
                </button>
              </div>
            );
          })()}

          {activeMission && (
            <div className="ks-mission-chip" role="status">
              <span className="ks-mission-tag">{activeMission.category.replace('_', ' ').toUpperCase()}</span>
              <div className="ks-mission-info">
                <strong>{activeMission.title} · Step {activeMission.step}/{activeMission.totalSteps}</strong>
                <span>{activeMission.instruction}</span>
                <small>Target: {activeMission.targetName} ({activeMission.distanceMeters}m) · Reward: ₦{activeMission.reward.toLocaleString()}</small>
              </div>
              <button
                className="ks-mission-cancel"
                onClick={() => onCancelMission?.()}
                title="Abandon contract"
              >
                ✕
              </button>
            </div>
          )}

          <div className="ks-hud-wallet" aria-label="Player wallet and civil status">
            <span className="ks-wallet-item">
              <small>CALENDAR</small>
              <strong>DAY {dayCount ?? 1}</strong>
            </span>
            <span className="ks-wallet-item">
              <small>CASH</small>
              <strong>₦{(cash ?? 150000).toLocaleString()}</strong>
            </span>
            {dailyIncome !== undefined && dailyIncome !== 0 && (
              <span className={`ks-wallet-item ${dailyIncome > 0 ? "ks-biz-badge" : "ks-fine-alert"}`}>
                <small>DAILY NET</small>
                <strong>{dailyIncome > 0 ? "+" : ""}₦{dailyIncome.toLocaleString()}</strong>
              </span>
            )}
            {(trafficFine ?? 0) > 0 && (
              <span className="ks-wallet-item ks-fine-alert">
                <small>KAROTA CITATION</small>
                <strong>₦{(trafficFine ?? 0).toLocaleString()}</strong>
              </span>
            )}
            {hasApartmentRental && (
              <span className="ks-wallet-item ks-rent-badge">
                <small>APARTMENT</small>
                <strong>UNIT 2B LEASED</strong>
              </span>
            )}
            {ownedProperties && ownedProperties.length > 0 && (
              <span className="ks-wallet-item ks-rent-badge">
                <small>PROPERTY</small>
                <strong>{ownedProperties.length} OWNED</strong>
              </span>
            )}
            {ownedBusinesses && ownedBusinesses.length > 0 && (
              <span className="ks-wallet-item ks-biz-badge">
                <small>BUSINESS</small>
                <strong>{ownedBusinesses.length} ACTIVE</strong>
              </span>
            )}
            {activeInterior && (
              <span className="ks-wallet-item ks-interior-badge">
                <small>LOCATION</small>
                <strong>INDOORS</strong>
              </span>
            )}
            {gameScore !== undefined && gameScore > 0 && (
              <span className="ks-wallet-item ks-score-badge">
                <small>ESPORTS SCORE</small>
                <strong>{gameScore.toLocaleString()} PTS</strong>
              </span>
            )}
            {featuredContact && (
              <span className="ks-wallet-item ks-contact-badge">
                <small>{featuredContact.name.toUpperCase()}</small>
                <strong>{featuredContact.stage.toUpperCase()} ({featuredContact.affection}%)</strong>
              </span>
            )}
          </div>

          <div className="ks-mode-chip" aria-live="polite">
            <span className={`ks-mode-symbol ${mode}`} aria-hidden="true">
              {mode === 'driving'
                ? (vehicleType === 'keke'
                  ? 'K'
                  : vehicleType === 'van'
                  ? 'V'
                  : vehicleType === 'pickup'
                  ? 'P'
                  : vehicleType === 'minibus'
                  ? 'M'
                  : vehicleType === 'truck'
                  ? 'T'
                  : 'D')
                : '·'}
            </span>
            <span className="ks-mode-copy">
              <small>YOU ARE</small>
              <strong>
                {mode === 'driving'
                  ? (vehicleType === 'keke'
                    ? 'RIDING KEKE'
                    : vehicleType === 'van'
                    ? 'DRIVING VAN'
                    : vehicleType === 'pickup'
                    ? 'DRIVING PICKUP'
                    : vehicleType === 'minibus'
                    ? 'DRIVING DANFO'
                    : vehicleType === 'truck'
                    ? 'DRIVING TRUCK'
                    : 'DRIVING SEDAN')
                  : 'ON FOOT'}
              </strong>
            </span>
            {mode === 'driving' && (
              <span className="ks-speed"><strong>{Math.max(0, Math.round(speedKmh))}</strong><small>KM/H</small></span>
            )}
          </div>

          <div className="ks-hud-bottom">
            <div className="ks-driving-hint">
              <span className="ks-hint-title">{mode === 'driving' ? 'DRIVE' : 'ON FOOT'}</span>
              <span><Key>W</Key> ACCELERATE</span>
              <span><Key>S</Key> {mode === 'driving' ? 'BRAKE / REVERSE' : 'BACK'}</span>
              <span><Key>A</Key><Key>D</Key> {mode === 'driving' ? 'STEER' : 'MOVE'}</span>
              {mode === 'on-foot' && <><span><Key>SHIFT</Key> RUN</span><span><Key>SPACE</Key> JUMP</span></>}
              {mode === 'driving' && <span><Key>SPACE</Key> BRAKE</span>}
              {mode === 'on-foot' && <span><Key>E</Key> INTERACT</span>}
              {canFurnish && <span><Key>F</Key> FURNISH HOME</span>}
              <span><Key>R</Key> RESET POSITION</span>
            </div>
            {interactionPrompt && (
              <div className="ks-interaction-prompt" role="status">
                <span className="ks-interaction-key"><Key>E</Key></span>
                <span>{interactionPrompt}</span>
              </div>
            )}
          </div>
          {statusMessage && <div className="ks-status-message" role="status">{statusMessage}</div>}

          {showDirectory && (
            <CityMapModal
              onClose={() => setShowDirectory(false)}
              playerCoords={playerCoords}
              playerHeading={playerHeading}
              gpsTarget={gpsTarget}
              onSetGPSTarget={onSetGPSTarget}
              storyInfo={storyInfo}
              selectedHomePropertyId={selectedHomePropertyId}
              homeNavInfo={homeNavInfo}
              playerHomes={playerHomes}
              ownedProperties={ownedProperties}
              hasApartmentRental={hasApartmentRental}
              cash={cash}
              onSetSelectedHome={onSetSelectedHome}
              onTeleportHome={onTeleportHome}
              onFindMyHome={onFindMyHome}
              onLeaseProperty={onLeaseProperty}
              onPurchaseProperty={onPurchaseProperty}
              onExamineIndenture={onExamineIndenture}
              onChooseInvestigation={onChooseInvestigation}
              onChooseCareer={onChooseCareer}
              onResolveChapter1={onResolveChapter1}
            />
          )}

          {showMissions && (
            <div className="ks-directory-layer" role="dialog" aria-modal="true" aria-labelledby="ks-missions-title">
              <div className="ks-directory-panel ks-mission-board-panel">
                <div className="ks-directory-header">
                  <div>
                    <div className="ks-edition">KAWU CENTRAL LOGISTICS &amp; FREIGHT DISPATCH</div>
                    <h2 id="ks-missions-title">Commercial Career Contracts</h2>
                  </div>
                  <button className="ks-directory-close" onClick={() => setShowMissions(false)}>✕</button>
                </div>
                <div className="ks-directory-list">
                  {CAREER_MISSIONS_CATALOG.map((mission) => {
                    const isCurrentActive = activeMission?.id === mission.id;
                    return (
                      <div key={mission.id} className="ks-directory-card ks-mission-card">
                        <div className="ks-card-main">
                          <div className="ks-mission-card-tags">
                            <span className={`ks-cat-tag ${mission.category}`}>
                              {mission.category.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="ks-veh-tag">
                              RECOMMENDED: {mission.recommendedVehicle.toUpperCase()}
                            </span>
                            {mission.bonusAmount && (
                              <span className="ks-bonus-tag">
                                +₦{mission.bonusAmount.toLocaleString()} ENTERPRISE BONUS
                              </span>
                            )}
                          </div>
                          <h3>{mission.title}</h3>
                          <p>{mission.description}</p>
                          <small className="ks-card-coords">Route: {mission.district} · {mission.stagesCount} Stages</small>
                        </div>
                        <div className="ks-card-actions ks-mission-card-actions">
                          <div className="ks-mission-payout">
                            <small>CONTRACT VALUE</small>
                            <strong>₦{mission.reward.toLocaleString()}</strong>
                          </div>
                          {isCurrentActive ? (
                            <button className="ks-gps-btn active" disabled>
                              Active Contract ✓
                            </button>
                          ) : (
                            <button
                              className="ks-gps-btn"
                              onClick={() => {
                                onAcceptMission?.(mission.id);
                                setShowMissions(false);
                              }}
                            >
                              Accept Contract ↗
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {isFurnitureShopOpen && (
            <FurnitureShopModal
              onClose={() => onCloseFurnitureShop?.()}
              playerCash={cash ?? 0}
              onPurchaseFurniture={onPurchaseFurniture ?? ((id: string) => ({ success: false, message: "" }))}
            />
          )}

          {isFurnishingMode && canFurnish && (
            <FurnishingOverlay
              propertyName={furnishingTargetName || "Residence"}
              propertyId={currentPropertyId}
              unplacedItems={getUnplacedFurniture ? getUnplacedFurniture() : []}
              placedItems={getPlacedFurniture ? getPlacedFurniture(currentPropertyId) : []}
              onClose={() => onToggleFurnishingMode?.()}
              onPlaceItem={onPlaceFurnitureItem ?? (() => ({ success: false, message: "" }))}
              onMoveItem={onMoveFurnitureItem ?? (() => ({ success: false, message: "" }))}
              onStoreItem={onStoreFurnitureItem ?? (() => ({ success: false, message: "" }))}
              onRotateItem={onRotateFurnitureItem ?? (() => ({ success: false, message: "" }))}
            />
          )}
        </>
      )}

      {screen === 'paused' && (
        <div className="ks-pause-layer">
          <section className="ks-pause-panel" role="dialog" aria-modal="true" aria-labelledby="ks-pause-title">
            <div className="ks-edition">TAKE YOUR TIME</div>
            <h2 id="ks-pause-title">Paused<span>.</span></h2>
            <p>The neighborhood will be right where you left it.</p>
            <button className="ks-button ks-button-primary" onClick={onResume}>
              <span>Back to the streets</span><span className="ks-button-arrow" aria-hidden="true">↗</span>
            </button>
            <button className="ks-reset-button" onClick={onReset}>Start over <span aria-hidden="true">↺</span></button>
            <button
              className="ks-quality-toggle"
              onClick={() => {
                const order: GraphicsQuality[] = ['performance', 'balanced', 'quality'];
                onQualityChange(order[(order.indexOf(graphicsQuality) + 1) % order.length]);
              }}
              aria-label={`Graphics quality: ${graphicsQuality}. Click to change`}
            >
              <span>GRAPHICS QUALITY</span>
              <strong>{graphicsQuality.toUpperCase()}</strong>
              <i aria-hidden="true">↻</i>
            </button>
            <div className="ks-pause-foot"><BrandMark /><span>PROTOTYPE BUILD · KANO, NIGERIA</span></div>
          </section>
        </div>
      )}
    </div>
  );
}
