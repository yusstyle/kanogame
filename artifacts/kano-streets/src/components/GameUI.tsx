import { useEffect, useState, useCallback } from 'react';
import './GameUI.css';
import TouchControls from './TouchControls';
import type { ActiveMissionInfo, CareerPathChoice, SocialContact, StorySnapshotInfo, VehicleType, FurnitureInstance, PropertyId, HomeNavInfo, NeedsState, FreelanceSnapshotInfo, PlayerHomeEntry, BusinessId, CurrencyType, EmpireOverviewSnapshot, CameraMode, CameraDebugInfo } from '../game/types';
import { KANO_LANDMARKS, getGpsLandmark, computeGpsGuidance } from '../game/landmarks';
import { CAREER_MISSIONS_CATALOG } from '../game/missionSystem';
import CityMapModal from './CityMapModal';
import FurnitureShopModal from './FurnitureShopModal';
import FurnishingOverlay from './FurnishingOverlay';
import EmpireModal from './EmpireModal';
import SmartphoneModal from './SmartphoneModal';
import AccountModal from './AccountModal';
import { authService, type UserProfile } from '../game/authService';

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
  cameraMode?: CameraMode;
  cameraDebug?: CameraDebugInfo;
  premiumCoins?: number;
  isEmpireModalOpen?: boolean;
  isSmartphoneOpen?: boolean;
  onToggleSmartphone?: (force?: boolean) => unknown;
  onCaptureScreenshot?: () => string | null;
  onInteractSocial?: (contactId: string, choiceId: string) => any;
  empireOverview?: EmpireOverviewSnapshot;
  vehicleCondition?: number;
  hasSeenOnboarding?: boolean;
  onDismissOnboarding?: () => void;
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
  onToggleEmpireModal?: (force?: boolean) => unknown;
  onUpgradeBusiness?: (id: BusinessId) => { success: boolean; cost?: number; newLevel?: number; message: string };
  onMaintainBusiness?: (id: BusinessId) => { success: boolean; cost?: number; message: string; newCondition?: number };
  onRenovateProperty?: (id: PropertyId, useCoins?: boolean) => { success: boolean; costCash: number; costCoins: number; newLevel: number; message: string };
  onPurchaseVehicle?: (vehicleId: string, currency?: CurrencyType) => { success: boolean; message: string; costCash?: number; costCoins?: number };
  onPurchaseVehicleSkin?: (skinId: string, vehicleId: string, currency?: CurrencyType) => { success: boolean; message: string; costCash?: number; costCoins?: number };
  onClaimAchievement?: (achievementId: string) => { success: boolean; rewardCash: number; rewardCoins: number; message: string };
  onClaimSeasonalChallenge?: (challengeId: string) => { success: boolean; rewardCash: number; rewardCoins: number; message: string };
  onClaimSeasonalMilestone?: () => { success: boolean; rewardCoins: number; rewardTitle?: string; message: string };
  onAcceptMission?: (id: string) => boolean;
  onCancelMission?: () => boolean;
  onExamineIndenture?: () => boolean;
  onChooseInvestigation?: (choice: "elders" | "bank") => unknown;
  onChooseCareer?: (choice: CareerPathChoice) => unknown;
  onResolveChapter1?: () => unknown;
  onCycleWeather?: () => void;
  onToggleAudioMute?: () => void;
  onToggleCameraMode?: () => void;
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
  hasSeenOnboarding,
  onDismissOnboarding,
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
  cameraMode = "third-person",
  cameraDebug,
  premiumCoins = 250,
  isEmpireModalOpen,
  isSmartphoneOpen,
  onToggleSmartphone,
  onCaptureScreenshot,
  onInteractSocial,
  vehicleCondition,
  empireOverview,
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
  onToggleEmpireModal,
  onUpgradeBusiness,
  onMaintainBusiness,
  onRenovateProperty,
  onPurchaseVehicle,
  onPurchaseVehicleSkin,
  onClaimAchievement,
  onClaimSeasonalChallenge,
  onClaimSeasonalMilestone,
  onAcceptMission,
  onCancelMission,
  onExamineIndenture,
  onChooseInvestigation,
  onChooseCareer,
  onResolveChapter1,
  onCycleWeather,
  onToggleAudioMute,
  onToggleCameraMode,
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
  const [showEmpire, setShowEmpire] = useState(false);
  const [showSmartphone, setShowSmartphone] = useState(false);

  useEffect(() => {
    if (typeof isSmartphoneOpen === "boolean") {
      setShowSmartphone(isSmartphoneOpen);
    }
  }, [isSmartphoneOpen]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(authService.getState().user);
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const [showCameraDebug, setShowCameraDebug] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        setShowCameraDebug((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showOnboardingToast = !hasSeenOnboarding && !dismissedLocally;

  const handleDismissOnboarding = useCallback(() => {
    setDismissedLocally(true);
    onDismissOnboarding?.();
  }, [onDismissOnboarding]);

  useEffect(() => {
    const unsub = authService.subscribe((s) => {
      setCurrentUser(s.user);
    });
    return unsub;
  }, []);

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
      } else if (e.key === 'k' || e.key === 'K') {
        if (onToggleEmpireModal) onToggleEmpireModal();
        else setShowEmpire((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        if (onToggleSmartphone) onToggleSmartphone();
        else setShowSmartphone((prev) => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        onCycleWeather?.();
      } else if (e.key === 'u' || e.key === 'U') {
        onToggleAudioMute?.();
      } else if (e.key === 'o' || e.key === 'O') {
        setShowAccountModal((prev) => !prev);
      } else if (e.key === 'Escape' && (showSmartphone || isSmartphoneOpen)) {
        if (onToggleSmartphone) onToggleSmartphone(false);
        else setShowSmartphone(false);
      } else if (e.key === 'Escape' && showOnboardingToast) {
        handleDismissOnboarding();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, onCycleWeather, onToggleAudioMute, onToggleEmpireModal, onToggleSmartphone, showSmartphone, isSmartphoneOpen, gpsTarget, onFindMyHome, onSetGPSTarget, showOnboardingToast, handleDismissOnboarding]);

  if (screen === 'menu') {
    return (
      <div className="ks-ui ks-menu">
        <div className="ks-menu-top">
          <div className="ks-brand">
            <BrandMark />
            <span>KANO / FIELD NOTES</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              className="ks-menu-account-btn"
              onClick={() => setShowAccountModal(true)}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(217, 119, 6, 0.35)",
                color: "#f8fafc",
                borderRadius: "6px",
                padding: "0.35rem 0.75rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: currentUser ? "#10b981" : "#fbbf24" }} />
              <span>{currentUser ? currentUser.displayName : "Guest (Sign In)"}</span>
            </button>
            <span className="ks-build-tag"><i /> OPEN WORLD PROTOTYPE</span>
          </div>
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
            <div className="ks-control-line"><span className="ks-control-label">CAMERA</span><span><Key>V</Key> <small>1st / 3rd Person</small></span></div>
            <div className="ks-control-line"><span className="ks-control-label">EMPIRE</span><span><Key>K</Key> <small>Commerce & Fleet</small></span></div>
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
        <AccountModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />
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
            <button
              className="ks-hud-directory-btn ks-hud-camera-btn"
              onClick={onToggleCameraMode}
              title={`Toggle Camera Perspective [V] (Current: ${cameraMode === "first-person" ? "1st Person" : cameraMode === "road-focused" ? "Road-Focused" : "3rd Person"})`}
              aria-label="Toggle Camera Perspective"
            >
              <Key>V</Key>
              <span>{cameraMode === "first-person" ? "👁️ 1ST PERS" : cameraMode === "road-focused" ? "🛣️ ROAD VIEW" : "🎥 3RD PERS"}</span>
            </button>
            <button
              className="ks-hud-directory-btn ks-hud-debug-btn"
              onClick={() => setShowCameraDebug((prev) => !prev)}
              title="Toggle Camera & Occlusion Diagnostics [F9]"
              aria-label="Toggle Camera Diagnostics"
              style={{
                background: showCameraDebug ? "rgba(16, 185, 129, 0.25)" : undefined,
                borderColor: showCameraDebug ? "#10b981" : undefined,
                color: showCameraDebug ? "#34d399" : undefined,
              }}
            >
              <Key>F9</Key>
              <span>{showCameraDebug ? "🔍 DIAG ON" : "🔍 DIAG"}</span>
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
            <button
              className="ks-hud-directory-btn ks-hud-empire-btn"
              onClick={() => {
                if (onToggleEmpireModal) onToggleEmpireModal();
                else setShowEmpire((prev) => !prev);
              }}
              title="Manage Commercial Enterprises, Fleet & Harmattan Season [K]"
              aria-label="Toggle Empire & Commercial Economy Hub"
              style={{
                borderColor: "rgba(245, 158, 11, 0.5)",
                background: "rgba(217, 119, 6, 0.15)",
                color: "#fef3c7",
              }}
            >
              <Key>K</Key>
              <span>EMPIRE</span>
            </button>
            <button
              className={`ks-hud-directory-btn ks-hud-phone-btn ${showSmartphone || isSmartphoneOpen ? "active" : ""}`}
              onClick={() => {
                if (onToggleSmartphone) onToggleSmartphone();
                else setShowSmartphone((prev) => !prev);
              }}
              title="Toggle Unified Smartphone Handset Interface [P]"
              aria-label="Toggle Smartphone Handset"
              style={{
                borderColor: showSmartphone || isSmartphoneOpen ? "#f59e0b" : "rgba(245, 158, 11, 0.4)",
                background: showSmartphone || isSmartphoneOpen ? "rgba(245, 158, 11, 0.25)" : "rgba(15, 23, 42, 0.6)",
                color: "#fbbf24",
              }}
            >
              <Key>P</Key>
              <span>📱 PHONE</span>
            </button>
            <button
              className="ks-hud-directory-btn ks-hud-account-btn"
              onClick={() => setShowAccountModal(true)}
              title={currentUser ? `Account: ${currentUser.displayName} [O]` : "Player Account / Sign In [O]"}
              aria-label="Toggle Player Account Modal"
              style={{
                borderColor: currentUser ? "rgba(16, 185, 129, 0.5)" : "rgba(217, 119, 6, 0.4)",
                background: currentUser ? "rgba(16, 185, 129, 0.15)" : "rgba(30, 41, 59, 0.6)",
                color: currentUser ? "#6ee7b7" : "#e2e8f0",
              }}
            >
              <Key>O</Key>
              <span>👤 {currentUser ? currentUser.displayName.split(" ")[0] : "ACCOUNT"}</span>
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

          {/* First-Time Player Onboarding Toast */}
          {showOnboardingToast && (
            <aside className="ks-onboarding-toast" role="region" aria-label="First-time player guide">
              <div className="ks-onboarding-header">
                <div className="ks-onboarding-title-badge">
                  <span className="ks-onboarding-icon" aria-hidden="true">🧭</span>
                  <strong>Welcome to Kano. Your story starts here.</strong>
                </div>
                <button
                  className="ks-onboarding-close-btn"
                  onClick={handleDismissOnboarding}
                  title="Dismiss welcome guide"
                  aria-label="Close welcome guide"
                >
                  ✕
                </button>
              </div>
              <p className="ks-onboarding-body">
                Explore the neighborhood, find a Keke to drive, or open your career missions <Key>J</Key> to start earning money and building your empire.
              </p>
              <div className="ks-onboarding-actions">
                <button
                  className="ks-onboarding-action-btn ks-onboarding-primary"
                  onClick={() => {
                    handleDismissOnboarding();
                    setShowMissions(true);
                  }}
                  title="Open Logistics & Career Missions board"
                >
                  <Key>J</Key>
                  <span>Missions</span>
                </button>
                <button
                  className="ks-onboarding-action-btn ks-onboarding-secondary"
                  onClick={handleDismissOnboarding}
                  title="Acknowledge and dismiss guide"
                >
                  Got It
                </button>
              </div>
            </aside>
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
            <span className="ks-wallet-item ks-coins-badge" style={{ background: "rgba(217, 119, 6, 0.2)", borderColor: "rgba(245, 158, 11, 0.5)" }} title="Simulated Kano Gold (Developer Test Balance)">
              <small style={{ color: "#fbbf24" }}>🪙 KANO GOLD</small>
              <strong style={{ color: "#fef08a" }}>{(premiumCoins ?? 250).toLocaleString()} COINS</strong>
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
              <span><Key>V</Key> CAMERA ({cameraMode === 'first-person' ? '1ST' : cameraMode === 'road-focused' ? 'ROAD' : '3RD'})</span>
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

          {(showEmpire || isEmpireModalOpen) && (
            <EmpireModal
              onClose={() => {
                setShowEmpire(false);
                onToggleEmpireModal?.(false);
              }}
              cash={cash}
              premiumCoins={premiumCoins}
              empireOverview={empireOverview}
              onUpgradeBusiness={onUpgradeBusiness}
              onMaintainBusiness={onMaintainBusiness}
              onRenovateProperty={onRenovateProperty}
              onPurchaseVehicle={onPurchaseVehicle}
              onPurchaseVehicleSkin={onPurchaseVehicleSkin}
              onClaimAchievement={onClaimAchievement}
              onClaimSeasonalChallenge={onClaimSeasonalChallenge}
              onClaimSeasonalMilestone={onClaimSeasonalMilestone}
            />
          )}

          {(showSmartphone || isSmartphoneOpen) && (
            <SmartphoneModal
              onClose={() => {
                setShowSmartphone(false);
                onToggleSmartphone?.(false);
              }}
              snapshot={{
                mode,
                vehicleType,
                location,
                speedKmh,
                interactionPrompt,
                statusMessage,
                cash,
                trafficFine,
                hasApartmentRental,
                activeInterior: activeInterior as any,
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
                selectedHomePropertyId,
                homeNavInfo,
                playerHomes,
                needs,
                cameraMode,
                cameraDebug,
                premiumCoins,
                empireOverview,
                vehicleCondition,
              }}
              onSetGPSTarget={onSetGPSTarget}
              onAcceptMission={onAcceptMission}
              onCancelMission={onCancelMission}
              onOpenDirectory={() => setShowDirectory(true)}
              onOpenEmpire={() => {
                if (onToggleEmpireModal) onToggleEmpireModal(true);
                else setShowEmpire(true);
              }}
              onToggleAudioMute={onToggleAudioMute}
              onCycleWeather={onCycleWeather}
              onQualityChange={onQualityChange}
              graphicsQuality={graphicsQuality}
              onFindMyHome={onFindMyHome}
              onCaptureScreenshot={onCaptureScreenshot}
              onInteractSocial={onInteractSocial}
              onUpgradeBusiness={onUpgradeBusiness}
              onMaintainBusiness={onMaintainBusiness}
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
          {/* Camera & Occlusion Debug Diagnostic Overlay */}
          {showCameraDebug && (
            <div className="camera-debug-overlay">
              <div className="camera-debug-header">
                <span>📷 CAMERA & OCCLUSION DIAGNOSTICS</span>
                <button className="camera-debug-close" onClick={() => setShowCameraDebug(false)}>✕</button>
              </div>
              <div className="camera-debug-body">
                <div className="camera-debug-row">
                  <span className="camera-debug-label">Camera View:</span>
                  <span className="camera-debug-val">{cameraDebug?.cameraMode?.toUpperCase() || cameraMode?.toUpperCase() || "THIRD-PERSON"}</span>
                </div>
                <div className="camera-debug-row">
                  <span className="camera-debug-label">Mode / Context:</span>
                  <span className="camera-debug-val">{mode?.toUpperCase()} {cameraDebug?.isIndoors ? `(INDOORS: ${cameraDebug.activeInterior || "Unit 2B"})` : "(OUTDOORS)"}</span>
                </div>
                {cameraDebug?.activeVehicle && (
                  <div className="camera-debug-row">
                    <span className="camera-debug-label">Active Vehicle:</span>
                    <span className="camera-debug-val">{cameraDebug.activeVehicle.toUpperCase()}</span>
                  </div>
                )}
                {cameraDebug?.isSeated && (
                  <div className="camera-debug-row">
                    <span className="camera-debug-label">Posture:</span>
                    <span className="camera-debug-val highlight">SEATED ON CHAIR / BENCH</span>
                  </div>
                )}
                <div className="camera-debug-row">
                  <span className="camera-debug-label">Camera World Pos:</span>
                  <span className="camera-debug-val">
                    {cameraDebug ? `(${cameraDebug.cameraWorldPos.x.toFixed(2)}, ${cameraDebug.cameraWorldPos.y.toFixed(2)}, ${cameraDebug.cameraWorldPos.z.toFixed(2)})` : "—"}
                  </span>
                </div>
                <div className="camera-debug-row">
                  <span className="camera-debug-label">Look Direction:</span>
                  <span className="camera-debug-val">
                    {cameraDebug ? `(${cameraDebug.cameraLookDir.x.toFixed(2)}, ${cameraDebug.cameraLookDir.y.toFixed(2)}, ${cameraDebug.cameraLookDir.z.toFixed(2)})` : "—"}
                  </span>
                </div>
                <div className="camera-debug-row">
                  <span className="camera-debug-label">Player/Vehicle Pos:</span>
                  <span className="camera-debug-val">
                    {cameraDebug ? `(${cameraDebug.playerVehicleWorldPos.x.toFixed(2)}, ${cameraDebug.playerVehicleWorldPos.y.toFixed(2)}, ${cameraDebug.playerVehicleWorldPos.z.toFixed(2)})` : "—"}
                  </span>
                </div>
                <div className="camera-debug-divider" />
                <div className="camera-debug-row">
                  <span className="camera-debug-label">Nearest Mesh:</span>
                  <span className="camera-debug-val highlight">{cameraDebug?.nearestObstructingMesh ? cameraDebug.nearestObstructingMesh.name : "None (Clear View)"}</span>
                </div>
                {cameraDebug?.nearestObstructingMesh && (
                  <>
                    <div className="camera-debug-row">
                      <span className="camera-debug-label">Mesh Category:</span>
                      <span className="camera-debug-val badge">{cameraDebug.nearestObstructingMesh.category}</span>
                    </div>
                    <div className="camera-debug-row">
                      <span className="camera-debug-label">Distance to Box:</span>
                      <span className="camera-debug-val">{cameraDebug.nearestObstructingMesh.distanceToBox.toFixed(2)} m</span>
                    </div>
                    <div className="camera-debug-row">
                      <span className="camera-debug-label">Distance to Center:</span>
                      <span className="camera-debug-val">{cameraDebug.nearestObstructingMesh.distanceToCenter.toFixed(2)} m</span>
                    </div>
                    <div className="camera-debug-row">
                      <span className="camera-debug-label">Camera Inside Box:</span>
                      <span className={`camera-debug-val ${cameraDebug.nearestObstructingMesh.isInsideBoundingBox ? "warn" : "ok"}`}>
                        {cameraDebug.nearestObstructingMesh.isInsideBoundingBox ? "⚠️ YES (OCCLUDING)" : "✅ NO (CLEAR)"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
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
            <button
              className="ks-button ks-button-secondary"
              onClick={() => setShowAccountModal(true)}
              style={{
                marginTop: "0.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "0.6rem 1rem",
                background: "rgba(30, 41, 59, 0.7)",
                border: "1px solid rgba(217, 119, 6, 0.3)",
                color: "#f8fafc",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              <span>{currentUser ? `Account: ${currentUser.displayName}` : "Player Account / Sign In"}</span>
              <span className="ks-button-arrow" aria-hidden="true">👤</span>
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
      <AccountModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />
    </div>
  );
}
