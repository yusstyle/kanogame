import React, { useState, useEffect, useRef } from "react";
import "./SmartphoneModal.css";
import type {
  GameSnapshot,
  SocialContact,
  PropertyId,
  BusinessId,
  GraphicsQuality,
} from "../game/types";
import { KANO_LANDMARKS, getGpsLandmark } from "../game/landmarks";
import { CAREER_MISSIONS_CATALOG } from "../game/missionSystem";

export type PhoneAppId =
  | "home"
  | "bank"
  | "contacts"
  | "maps"
  | "missions"
  | "empire"
  | "camera"
  | "settings";

export interface SmartphoneModalProps {
  onClose: () => void;
  snapshot: GameSnapshot;
  onSetGPSTarget?: (id: string | null) => void;
  onAcceptMission?: (id: string) => boolean;
  onCancelMission?: () => boolean;
  onOpenDirectory?: () => void;
  onOpenEmpire?: () => void;
  onToggleAudioMute?: () => void;
  onCycleWeather?: () => void;
  onQualityChange?: (quality: GraphicsQuality) => void;
  graphicsQuality?: GraphicsQuality;
  onFindMyHome?: () => unknown;
  onCaptureScreenshot?: () => string | null;
  onInteractSocial?: (contactId: string, choiceId: string) => any;
  onUpgradeBusiness?: (id: BusinessId) => { success: boolean; cost?: number; newLevel?: number; message: string };
  onMaintainBusiness?: (id: BusinessId) => { success: boolean; cost?: number; message: string; newCondition?: number };
}

interface PhotoRecord {
  id: string;
  time: string;
  location: string;
  weather: string;
  dataUrl?: string;
}

export default function SmartphoneModal({
  onClose,
  snapshot,
  onSetGPSTarget,
  onAcceptMission,
  onCancelMission,
  onOpenDirectory,
  onOpenEmpire,
  onToggleAudioMute,
  onCycleWeather,
  onQualityChange,
  graphicsQuality = "balanced",
  onFindMyHome,
  onCaptureScreenshot,
  onInteractSocial,
  onUpgradeBusiness,
  onMaintainBusiness,
}: SmartphoneModalProps) {
  const [activeApp, setActiveApp] = useState<PhoneAppId>("home");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, { from: "npc" | "player"; text: string; time: string }[]>>({});
  const [photoGallery, setPhotoGallery] = useState<PhotoRecord[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lastGreetingTimes = useRef<Record<string, number>>({});
  const [mapFilter, setMapFilter] = useState<"all" | "residence" | "industrial" | "commercial" | "historic">("all");
  const [empireSubTab, setEmpireSubTab] = useState<"overview" | "enterprises" | "financials" | "ledger">("overview");

  const cash = snapshot.cash ?? 0;
  const dailyIncome = snapshot.dailyIncome ?? 0;
  const timeString = snapshot.timeString ?? "14:30";
  const dailyAtmWithdrawn = snapshot.dailyAtmWithdrawn ?? 0;
  const atmLimit = snapshot.atmDailyLimit ?? 40000;
  const remainingAtmLimit = Math.max(0, atmLimit - dailyAtmWithdrawn);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  };

  // Contacts dataset
  const contacts: SocialContact[] = snapshot.socialContacts && snapshot.socialContacts.length > 0
    ? snapshot.socialContacts
    : [
        {
          id: "garba",
          name: "Master Garba",
          profession: "Chief Mechanic & Fleet Fabricator",
          district: "KAWU INDUSTRIAL · REPAIR BAY",
          stage: "acquaintance",
          affection: 45,
          description: "Proprietor of Arewa Heavy Vehicle Repairs. Master of diesel trucks, gearboxes, and suspension tuning.",
        },
        {
          id: "habiba",
          name: "Habiba Mai Shayi",
          profession: "Tea Master & Proprietress",
          district: "KAWU INDUSTRIAL · CANTEEN",
          stage: "acquaintance",
          affection: 50,
          description: "Serves steaming spiced ginger tea, cloves, and fried egg toast to Kano haulage drivers.",
        },
        {
          id: "chinedu",
          name: "Chinedu Okeke",
          profession: "Merchant & Choir Member",
          district: "SABON GARI · COMPLEX",
          stage: "friend",
          affection: 60,
          description: "Electronics importer at Sabon Gari Commercial Complex and choir tenor at St. Stephen's.",
        },
        {
          id: "amina",
          name: "Amina Lawal",
          profession: "Architectural Designer",
          district: "AIRPORT ROAD · BOMPAI",
          stage: "friend",
          affection: 55,
          description: "Specializes in contemporary Northern Nigerian villa designs and sustainable Sahelian architecture.",
        },
        {
          id: "zainab",
          name: "Zainab Bello",
          profession: "Esports Champion & Student",
          district: "AIRPORT ROAD · CYBER HUB",
          stage: "acquaintance",
          affection: 35,
          description: "Reigning champion of the Kano Street Drift tournament at Cyber Hub.",
        },
        {
          id: "danladi",
          name: "Sergeant Danladi",
          profession: "NPF Highway Patrol Officer",
          district: "AIRPORT ROAD · POLICE POST",
          stage: "acquaintance",
          affection: 40,
          description: "Vigilant police patrol sergeant dedicated to keeping transit corridors safe.",
        },
        {
          id: "kabiru",
          name: "Malam Kabiru Dan-Kano",
          profession: "Clan Elder & Ancestral Custodian",
          district: "DALA · ANCESTRAL ZAURE",
          stage: "acquaintance",
          affection: 50,
          description: "Keeper of the 1968 Sahel Vault Key and guardian of Dan-Kano family history.",
        },
      ];

  // Dynamic context-sensitive message generator
  const getContextMessage = (contactId: string): string => {
    switch (contactId) {
      case "garba":
        if (snapshot.vehicleCondition !== undefined && snapshot.vehicleCondition < 80) {
          return `Sannu driver! Your ${snapshot.vehicleType ?? "vehicle"} sounds strained. Condition is down to ${Math.round(snapshot.vehicleCondition)}%. Bring it by the repair bay at Kawu before the suspension gives out!`;
        }
        return "Everything running smooth on the highway. Remember to check fluid levels when hauling heavy freight.";
      case "habiba":
        return "Barka da yini! The tea kettle is boiling with fresh ginger and wild honey. Drop by the canteen whenever you need an energy boost!";
      case "chinedu":
        if (snapshot.activeMission?.category === "local_delivery") {
          return "I see you have an active logistics contract! Handle those crates with care over the Sabon Gari speed humps.";
        }
        return "New electronics inventory arrived at the complex this morning. Smart TVs, Bluetooth amps, and inverter panels available!";
      case "amina":
        return "I just finished the elevation drawings for the Bompai residential terrace. Would love to show you over Chapman at Arewa Lounge!";
      case "zainab":
        return "Tournament night at the Cyber Hub this Friday. Think you can beat my lap time around Murtala Mohammed Way?";
      case "danladi":
        if (snapshot.trafficFine && snapshot.trafficFine > 0) {
          return `Good day citizen. You have an outstanding KAROTA citation of ₦${snapshot.trafficFine.toLocaleString()}. Settle it at the station desk to maintain clear road status.`;
        }
        return "Sabon Gari highway corridor is peaceful today. Drive with care and obey road markings.";
      case "kabiru":
        return "The Dan-Kano lineage has persevered through generations of trade. Keep your word and your business will thrive across the Sahel.";
      default:
        return "Sannu! Great to stay in touch through Kano Connect.";
    }
  };

  const handleSendGreeting = (c: SocialContact) => {
    const now = Date.now();
    const lastTime = lastGreetingTimes.current[c.id] || 0;
    const isCooldownActive = now - lastTime < 30000;

    let outcome: any = null;
    if (onInteractSocial) {
      outcome = onInteractSocial(c.id, "greet");
    }

    const greetingText = `Peace be upon you ${c.name.split(" ")[0]}! Just checking in from ${snapshot.location}.`;
    const replies: Record<string, string> = {
      garba: "Nagode! Drive carefully out there on the industrial bypass.",
      habiba: "Yauwa! Come drink some hot ginger tea whenever you are passing Kawu.",
      chinedu: "My brother! Business is booming. Good to hear from you!",
      amina: "So lovely of you to check in! Let us catch up soon.",
      zainab: "Hey there! Ready to drift anytime you are around Cyber Hub.",
      danladi: "Received. Maintain defensive driving and stay safe.",
      kabiru: "Alhamdulillah. May your efforts be rewarded with honor.",
    };

    let reply = replies[c.id] ?? "Thank you for reaching out!";
    if (outcome && outcome.response) {
      reply = outcome.response;
    } else if (isCooldownActive) {
      reply = `${c.name.split(" ")[0]}: "We already spoke just a moment ago! Always great to hear from you."`;
    }

    setChatMessages((prev) => {
      const existing = prev[c.id] ?? [
        { from: "npc", text: getContextMessage(c.id), time: "Earlier" },
      ];
      return {
        ...prev,
        [c.id]: [
          ...existing,
          { from: "player", text: greetingText, time: timeString },
          { from: "npc", text: reply, time: timeString },
        ],
      };
    });

    if (isCooldownActive || (outcome && outcome.affectionDelta === 0)) {
      showToast(`${c.name.split(" ")[0]} greeted (Cooldown active — no extra affection)`);
    } else {
      lastGreetingTimes.current[c.id] = now;
      showToast(`Message sent to ${c.name}! Affection increased`);
    }
  };

  // Camera shutter action
  const handleTakePhoto = () => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 250);
    const capturedDataUrl = onCaptureScreenshot ? onCaptureScreenshot() : null;
    const newPhoto: PhotoRecord = {
      id: `photo-${Date.now()}`,
      time: timeString,
      location: snapshot.location,
      weather: snapshot.weatherDisplayName ?? "Clear",
      dataUrl: capturedDataUrl || undefined,
    };
    setPhotoGallery((prev) => [newPhoto, ...prev]);
    showToast(
      capturedDataUrl
        ? `Snapshot saved from Kano camera!`
        : `Photo recorded at ${snapshot.location}!`
    );
  };

  // Quick navigation to landmark
  const handleNavigateTo = (landmarkId: string, name: string) => {
    if (landmarkId === "my-home") {
      if (onFindMyHome) onFindMyHome();
      else onSetGPSTarget?.("my-home");
    } else {
      onSetGPSTarget?.(landmarkId);
    }
    showToast(`GPS Route set to ${name}`);
  };

  const currentLandmark = snapshot.gpsTarget ? getGpsLandmark(snapshot.gpsTarget) : null;

  return (
    <div className="ks-smartphone-backdrop" onClick={onClose}>
      {/* Flash overlay for camera */}
      {isFlashing && <div className="ks-phone-camera-flash" />}

      {/* Handset Frame */}
      <div
        className="ks-smartphone-frame"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Kano Smartphone Interface"
      >
        {/* Hardware side buttons */}
        <div className="ks-phone-hw-btn ks-hw-vol-up" />
        <div className="ks-phone-hw-btn ks-hw-vol-down" />
        <div className="ks-phone-hw-btn ks-hw-power" />

        {/* Screen Display */}
        <div className={`ks-phone-screen ${flashlightOn ? "flashlight-active" : ""}`}>
          {/* Top Status Bar */}
          <div className="ks-phone-status-bar">
            <div className="ks-status-left">
              <span className="ks-phone-time">{timeString}</span>
              <span className="ks-phone-carrier">MTN-NG 5G</span>
            </div>
            <div className="ks-dynamic-island">
              <div className="ks-island-camera" />
            </div>
            <div className="ks-status-right">
              <span className="ks-signal-bars">
                <span /><span /><span /><span />
              </span>
              <span className="ks-battery-text">89%</span>
              <span className="ks-battery-icon">
                <span className="ks-battery-level" style={{ width: "89%" }} />
              </span>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="ks-phone-toast" role="alert">
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Navigation Bar / App Header */}
          <div className="ks-phone-nav-header">
            {activeApp !== "home" ? (
              <button
                type="button"
                className="ks-phone-back-btn"
                onClick={() => {
                  if (selectedContactId) setSelectedContactId(null);
                  else setActiveApp("home");
                }}
              >
                ‹ {selectedContactId ? "Contacts" : "Home"}
              </button>
            ) : (
              <div className="ks-phone-home-header">
                <span className="ks-phone-brand-title">KANO CONNECT · OS 2.4</span>
              </div>
            )}

            <div className="ks-phone-app-title">
              {activeApp === "home" && "Yan-Kano"}
              {activeApp === "bank" && "Arewa Commercial Bank"}
              {activeApp === "contacts" && (selectedContactId ? "Chat Thread" : "Kano Connect")}
              {activeApp === "maps" && "Yan-Dutse Maps"}
              {activeApp === "missions" && "Kawu Logistics Dispatch"}
              {activeApp === "empire" && "Empire Portfolio"}
              {activeApp === "camera" && "Yan-Kano Camera"}
              {activeApp === "settings" && "Quick Settings"}
            </div>

            <button
              type="button"
              className="ks-phone-close-btn"
              onClick={onClose}
              title="Close Phone (P or Esc)"
            >
              ✕
            </button>
          </div>

          {/* App Body Content */}
          <div className="ks-phone-body">
            {/* -------------------- 1. HOME SCREEN -------------------- */}
            {activeApp === "home" && (
              <div className="ks-phone-home-view">
                {/* Clock & Weather Widget */}
                <div className="ks-home-widget-clock">
                  <div className="ks-widget-time">{timeString}</div>
                  <div className="ks-widget-date">Kano City · {snapshot.location}</div>
                  <div className="ks-widget-weather">
                    <span>{snapshot.weatherDisplayName ?? "Clear Sahel Sky"}</span>
                    <span className="ks-weather-temp">32°C</span>
                  </div>
                </div>

                {/* Quick Glance Balance Card */}
                <div className="ks-home-glance-card" onClick={() => setActiveApp("bank")}>
                  <div className="ks-glance-header">
                    <span>AREWA COMMERCIAL BANK</span>
                    <span className="ks-glance-badge">ACTIVE</span>
                  </div>
                  <div className="ks-glance-balance">₦{cash.toLocaleString()}</div>
                  <div className="ks-glance-footer">
                    <span>Daily Yield: ₦{dailyIncome.toLocaleString()}/day</span>
                    <span className="ks-glance-arrow">View ›</span>
                  </div>
                </div>

                {/* Quick Mission Glance (if active) */}
                {snapshot.activeMission ? (
                  <div className="ks-home-mission-card" onClick={() => setActiveApp("missions")}>
                    <div className="ks-mission-pill">ACTIVE DISPATCH</div>
                    <div className="ks-mission-title">{snapshot.activeMission.title}</div>
                    <div className="ks-mission-step">{snapshot.activeMission.instruction}</div>
                    <div className="ks-mission-reward">Payout: ₦{snapshot.activeMission.reward.toLocaleString()}</div>
                  </div>
                ) : null}

                {/* App Grid (6 Primary Apps) */}
                <div className="ks-app-grid">
                  <button
                    type="button"
                    className="ks-app-icon-item"
                    onClick={() => setActiveApp("bank")}
                  >
                    <div className="ks-app-icon icon-bank">₦</div>
                    <span className="ks-app-label">Arewa Bank</span>
                  </button>

                  <button
                    type="button"
                    className="ks-app-icon-item"
                    onClick={() => setActiveApp("contacts")}
                  >
                    <div className="ks-app-icon icon-contacts">💬</div>
                    <span className="ks-app-label">Kano Connect</span>
                  </button>

                  <button
                    type="button"
                    className="ks-app-icon-item"
                    onClick={() => setActiveApp("maps")}
                  >
                    <div className="ks-app-icon icon-maps">🧭</div>
                    <span className="ks-app-label">Yan-Dutse GPS</span>
                  </button>

                  <button
                    type="button"
                    className="ks-app-icon-item"
                    onClick={() => setActiveApp("missions")}
                  >
                    <div className="ks-app-icon icon-missions">📦</div>
                    <span className="ks-app-label">Kawu Dispatch</span>
                  </button>

                  <button
                    type="button"
                    className="ks-app-icon-item"
                    onClick={() => setActiveApp("empire")}
                  >
                    <div className="ks-app-icon icon-empire">🏢</div>
                    <span className="ks-app-label">Empire Hub</span>
                  </button>

                  <button
                    type="button"
                    className="ks-app-icon-item"
                    onClick={() => setActiveApp("camera")}
                  >
                    <div className="ks-app-icon icon-camera">📷</div>
                    <span className="ks-app-label">Camera</span>
                  </button>
                </div>

                {/* Quick Device Toggles */}
                <div className="ks-home-quick-tools">
                  <button
                    type="button"
                    className={`ks-tool-chip ${snapshot.audioMuted ? "muted" : ""}`}
                    onClick={onToggleAudioMute}
                  >
                    {snapshot.audioMuted ? "🔇 Unmute" : "🔊 Sound FX"}
                  </button>

                  <button
                    type="button"
                    className="ks-tool-chip"
                    onClick={onCycleWeather}
                  >
                    ⛅ Cycle Weather
                  </button>

                  <button
                    type="button"
                    className={`ks-tool-chip ${flashlightOn ? "active" : ""}`}
                    onClick={() => {
                      setFlashlightOn((prev) => !prev);
                      showToast(flashlightOn ? "Torch turned OFF" : "Torch turned ON");
                    }}
                  >
                    🔦 {flashlightOn ? "Torch ON" : "Torch"}
                  </button>

                  <button
                    type="button"
                    className="ks-tool-chip"
                    onClick={() => setActiveApp("settings")}
                  >
                    ⚙️ Settings
                  </button>
                </div>
              </div>
            )}

            {/* -------------------- 2. AREWA BANK APP -------------------- */}
            {activeApp === "bank" && (
              <div className="ks-phone-app-view ks-bank-app">
                {/* Virtual Debit Card */}
                <div className="ks-bank-card">
                  <div className="ks-bank-card-top">
                    <span className="ks-bank-brand">AREWA COMMERCIAL BANK</span>
                    <span className="ks-bank-chip">■</span>
                  </div>
                  <div className="ks-bank-card-number">•••• •••• •••• 5821</div>
                  <div className="ks-bank-card-bottom">
                    <div>
                      <div className="ks-bank-label">AVAILABLE CASH BALANCE</div>
                      <div className="ks-bank-amount">₦{cash.toLocaleString()}</div>
                    </div>
                    <div className="ks-bank-holder">KANO CITIZEN</div>
                  </div>
                </div>

                {/* ATM Daily Allowance Tracker */}
                <div className="ks-bank-section-card">
                  <div className="ks-card-subhead">24/7 ATM WITHDRAWAL LIMIT</div>
                  <div className="ks-atm-limit-row">
                    <div>
                      <div className="ks-atm-title">Daily Allowance: ₦{atmLimit.toLocaleString()}</div>
                      <div className="ks-atm-sub">Withdrawn Today: ₦{dailyAtmWithdrawn.toLocaleString()}</div>
                    </div>
                    <div className="ks-atm-remaining">
                      <span>Remaining:</span>
                      <strong>₦{remainingAtmLimit.toLocaleString()}</strong>
                    </div>
                  </div>
                  <div className="ks-progress-bar-bg">
                    <div
                      className="ks-progress-bar-fill"
                      style={{ width: `${Math.min(100, (dailyAtmWithdrawn / atmLimit) * 100)}%` }}
                    />
                  </div>
                  <p className="ks-atm-hint">
                    Visit the 24/7 ATM kiosk at Arewa Bank Headquarters (Airport Road) to withdraw up to ₦20,000 per transaction.
                  </p>
                  <button
                    type="button"
                    className="ks-btn-action"
                    onClick={() => handleNavigateTo("bank", "Arewa Commercial Bank & 24/7 ATM")}
                  >
                    Set GPS to Nearest ATM (Arewa Bank HQ)
                  </button>
                </div>

                {/* Cashflow Breakdown */}
                <div className="ks-bank-section-card">
                  <div className="ks-card-subhead">EMPIRE CASHFLOW OVERVIEW</div>
                  <div className="ks-flow-row">
                    <span>Daily Gross Revenue:</span>
                    <span className="ks-flow-pos">+₦{(snapshot.empireOverview?.totalDailyRevenue ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="ks-flow-row">
                    <span>Daily Operating Costs:</span>
                    <span className="ks-flow-neg">-₦{(snapshot.empireOverview?.totalDailyOperatingCost ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="ks-flow-row">
                    <span>Daily Property Upkeep:</span>
                    <span className="ks-flow-neg">-₦{(snapshot.empireOverview?.totalDailyPropertyUpkeep ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="ks-flow-divider" />
                  <div className="ks-flow-row total">
                    <span>Net Daily Yield:</span>
                    <span className={dailyIncome >= 0 ? "ks-flow-pos" : "ks-flow-neg"}>
                      ₦{dailyIncome.toLocaleString()} / day
                    </span>
                  </div>
                </div>

                {/* Statement History */}
                <div className="ks-bank-section-card">
                  <div className="ks-card-subhead">RECENT ACCOUNT ACTIVITY</div>
                  {snapshot.empireOverview?.transactionHistory && snapshot.empireOverview.transactionHistory.length > 0 ? (
                    <div className="ks-statement-list">
                      {snapshot.empireOverview.transactionHistory.slice(0, 6).map((tx) => (
                        <div key={tx.id} className="ks-statement-item">
                          <div>
                            <div className="ks-statement-desc">{tx.description}</div>
                            <div className="ks-statement-type">{tx.type.replace(/_/g, " ").toUpperCase()}</div>
                          </div>
                          <div className={`ks-statement-amount ${tx.amount >= 0 ? "pos" : "neg"}`}>
                            {tx.amount >= 0 ? "+" : ""}₦{Math.abs(tx.amount).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ks-empty-msg">No statement transactions recorded today.</p>
                  )}
                </div>
              </div>
            )}

            {/* -------------------- 3. KANO CONNECT (CONTACTS & CHAT) -------------------- */}
            {activeApp === "contacts" && (
              <div className="ks-phone-app-view ks-contacts-app">
                {!selectedContactId ? (
                  <div className="ks-contact-list">
                    <div className="ks-contact-search-banner">
                      <span>{contacts.length} VERIFIED DIRECTORY CONTACTS</span>
                    </div>

                    {contacts.map((c) => {
                      const msgs = chatMessages[c.id];
                      const lastMsg = msgs && msgs.length > 0
                        ? msgs[msgs.length - 1].text
                        : getContextMessage(c.id);

                      return (
                        <div
                          key={c.id}
                          className="ks-contact-row"
                          onClick={() => setSelectedContactId(c.id)}
                        >
                          <div className="ks-contact-avatar">
                            {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div className="ks-contact-info">
                            <div className="ks-contact-name-row">
                              <span className="ks-contact-name">{c.name}</span>
                              <span className="ks-contact-stage-badge">{c.stage.toUpperCase()}</span>
                            </div>
                            <div className="ks-contact-prof">{c.profession} · {c.district}</div>
                            <div className="ks-contact-preview">{lastMsg}</div>
                          </div>
                          <div className="ks-contact-meta">
                            <span className="ks-affection-score">{c.affection}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Individual Chat Thread
                  (() => {
                    const c = contacts.find((item) => item.id === selectedContactId);
                    if (!c) return null;
                    const msgs = chatMessages[c.id] ?? [
                      { from: "npc", text: getContextMessage(c.id), time: "10:15" },
                    ];

                    return (
                      <div className="ks-chat-thread-view">
                        <div className="ks-chat-thread-header">
                          <div className="ks-chat-avatar">
                            {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <div className="ks-chat-name">{c.name}</div>
                            <div className="ks-chat-sub">{c.profession} · Rapport: {c.affection}%</div>
                          </div>
                        </div>

                        {/* Message Bubbles */}
                        <div className="ks-chat-bubbles-scroll">
                          {msgs.map((m, idx) => (
                            <div key={idx} className={`ks-chat-bubble ${m.from}`}>
                              <div className="ks-bubble-text">{m.text}</div>
                              <div className="ks-bubble-time">{m.time}</div>
                            </div>
                          ))}
                        </div>

                        {/* Interactive Chat Actions */}
                        <div className="ks-chat-actions-bar">
                          <button
                            type="button"
                            className="ks-btn-action small"
                            onClick={() => handleSendGreeting(c)}
                          >
                            Send Greeting 💬
                          </button>

                          {c.id === "garba" && (
                            <button
                              type="button"
                              className="ks-btn-action small secondary"
                              onClick={() => handleNavigateTo("arewa-heavy-workshop", "Arewa Heavy Repairs (Master Garba)")}
                            >
                              GPS to Repair Bay 🔧
                            </button>
                          )}

                          {c.id === "habiba" && (
                            <button
                              type="button"
                              className="ks-btn-action small secondary"
                              onClick={() => handleNavigateTo("workers-canteen", "Mai Shayi Canteen (Habiba)")}
                            >
                              GPS to Tea Canteen ☕
                            </button>
                          )}

                          {c.id === "chinedu" && (
                            <button
                              type="button"
                              className="ks-btn-action small secondary"
                              onClick={() => handleNavigateTo("sabon-gari-complex", "Sabon Gari Commercial Complex")}
                            >
                              GPS to Market Stall 🛍️
                            </button>
                          )}

                          {c.id === "amina" && (
                            <button
                              type="button"
                              className="ks-btn-action small secondary"
                              onClick={() => handleNavigateTo("restaurant", "Arewa Suya Lounge & Terrace")}
                            >
                              Meet at Suya Lounge 🍽️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* -------------------- 4. YAN-DUTSE MAPS & GPS -------------------- */}
            {activeApp === "maps" && (
              <div className="ks-phone-app-view ks-maps-app">
                {/* Active Waypoint Card */}
                <div className="ks-gps-active-card">
                  <div className="ks-card-subhead">CURRENT GPS ROUTE</div>
                  {snapshot.gpsTarget ? (
                    <div className="ks-gps-active-info">
                      <div className="ks-gps-target-name">{currentLandmark?.name ?? snapshot.gpsTarget}</div>
                      <div className="ks-gps-target-district">{currentLandmark?.district ?? "Kano Transit Route"}</div>
                      <button
                        type="button"
                        className="ks-btn-action small secondary"
                        onClick={() => {
                          onSetGPSTarget?.(null);
                          showToast("GPS Waypoint Cleared");
                        }}
                      >
                        Cancel Waypoint ✕
                      </button>
                    </div>
                  ) : (
                    <div className="ks-gps-inactive">
                      <span>No active route. Tap any landmark below to set GPS guidance.</span>
                    </div>
                  )}
                </div>

                {/* Category Filters */}
                <div className="ks-map-filter-tabs">
                  <button
                    type="button"
                    className={`ks-filter-tab ${mapFilter === "all" ? "active" : ""}`}
                    onClick={() => setMapFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`ks-filter-tab ${mapFilter === "residence" ? "active" : ""}`}
                    onClick={() => setMapFilter("residence")}
                  >
                    Homes
                  </button>
                  <button
                    type="button"
                    className={`ks-filter-tab ${mapFilter === "industrial" ? "active" : ""}`}
                    onClick={() => setMapFilter("industrial")}
                  >
                    Industrial
                  </button>
                  <button
                    type="button"
                    className={`ks-filter-tab ${mapFilter === "commercial" ? "active" : ""}`}
                    onClick={() => setMapFilter("commercial")}
                  >
                    Commercial
                  </button>
                  <button
                    type="button"
                    className={`ks-filter-tab ${mapFilter === "historic" ? "active" : ""}`}
                    onClick={() => setMapFilter("historic")}
                  >
                    Historic
                  </button>
                </div>

                {/* Primary Home Shortcut */}
                <div className="ks-landmark-entry primary-home" onClick={() => handleNavigateTo("my-home", "My Primary Home")}>
                  <div>
                    <div className="ks-landmark-name">🏠 My Primary Home</div>
                    <div className="ks-landmark-desc">
                      {snapshot.selectedHomePropertyId
                        ? `Designated Residence: ${snapshot.selectedHomePropertyId.toUpperCase()}`
                        : "Primary residential flat or villa"}
                    </div>
                  </div>
                  <button type="button" className="ks-btn-action tiny">Navigate</button>
                </div>

                {/* Landmark Directory */}
                <div className="ks-landmark-list">
                  {KANO_LANDMARKS.filter((l) => mapFilter === "all" || l.category === mapFilter).map((l) => (
                    <div
                      key={l.id}
                      className={`ks-landmark-entry ${snapshot.gpsTarget === l.id ? "active-dest" : ""}`}
                      onClick={() => handleNavigateTo(l.id, l.name)}
                    >
                      <div className="ks-landmark-text">
                        <div className="ks-landmark-name">{l.name}</div>
                        <div className="ks-landmark-desc">{l.district} · {l.description}</div>
                      </div>
                      <button
                        type="button"
                        className={`ks-btn-action tiny ${snapshot.gpsTarget === l.id ? "secondary" : ""}`}
                      >
                        {snapshot.gpsTarget === l.id ? "Selected" : "Set GPS"}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Full Map Trigger */}
                <button
                  type="button"
                  className="ks-btn-action outline"
                  style={{ marginTop: "0.8rem" }}
                  onClick={() => {
                    onOpenDirectory?.();
                    onClose();
                  }}
                >
                  Open Full District Vector Map (Key M)
                </button>
              </div>
            )}

            {/* -------------------- 5. KAWU LOGISTICS DISPATCH (MISSIONS) -------------------- */}
            {activeApp === "missions" && (
              <div className="ks-phone-app-view ks-missions-app">
                {/* Active Mission Manifest */}
                <div className="ks-mission-section-card">
                  <div className="ks-card-subhead">ACTIVE FREIGHT MANIFEST</div>
                  {snapshot.activeMission ? (
                    <div className="ks-active-mission-detail">
                      <div className="ks-manifest-badge">
                        {snapshot.activeMission.category.replace(/_/g, " ").toUpperCase()}
                      </div>
                      <div className="ks-manifest-title">{snapshot.activeMission.title}</div>
                      <div className="ks-manifest-step-box">
                        <strong>Current Task:</strong> {snapshot.activeMission.instruction}
                      </div>
                      <div className="ks-manifest-progress">
                        Stage {snapshot.activeMission.step} of {snapshot.activeMission.totalSteps}
                      </div>
                      <div className="ks-manifest-target">
                        Target Destination: <strong>{snapshot.activeMission.targetName}</strong> ({Math.round(snapshot.activeMission.distanceMeters)}m away)
                      </div>
                      <div className="ks-manifest-payout">
                        Contract Bounty: <strong>₦{snapshot.activeMission.reward.toLocaleString()}</strong>
                      </div>
                      <button
                        type="button"
                        className="ks-btn-action small danger"
                        onClick={() => {
                          onCancelMission?.();
                          showToast("Logistics contract cancelled");
                        }}
                      >
                        Abandon Contract ✕
                      </button>
                    </div>
                  ) : (
                    <div className="ks-no-mission">
                      <span>No active freight or delivery contracts in progress.</span>
                      <p>Select an available dispatch contract below to begin transport:</p>
                    </div>
                  )}
                </div>

                {/* Available Contracts Directory */}
                <div className="ks-mission-section-card">
                  <div className="ks-card-subhead">AVAILABLE HAULAGE CONTRACTS</div>
                  <div className="ks-available-contracts-list">
                    {CAREER_MISSIONS_CATALOG.filter((m) => m.id !== snapshot.activeMission?.id).map((m) => (
                      <div key={m.id} className="ks-contract-card">
                        <div className="ks-contract-header">
                          <span className="ks-contract-cat">{m.category.replace(/_/g, " ").toUpperCase()}</span>
                          <span className="ks-contract-reward">₦{m.reward.toLocaleString()}</span>
                        </div>
                        <div className="ks-contract-title">{m.title}</div>
                        <div className="ks-contract-desc">{m.description}</div>
                        <div className="ks-contract-footer">
                          <span>Vehicle: <strong>{m.recommendedVehicle.toUpperCase()}</strong></span>
                          <button
                            type="button"
                            className="ks-btn-action tiny"
                            onClick={() => {
                              const ok = onAcceptMission?.(m.id);
                              if (ok) showToast(`Accepted: ${m.title}`);
                            }}
                          >
                            Accept Job
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* -------------------- 6. EMPIRE PORTFOLIO -------------------- */}
            {activeApp === "empire" && (
              <div className="ks-phone-app-view ks-empire-app">
                {/* Sub-tab Navigation */}
                <div className="ks-empire-subtabs">
                  <button
                    type="button"
                    className={`ks-subtab-btn ${empireSubTab === "overview" ? "active" : ""}`}
                    onClick={() => setEmpireSubTab("overview")}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    className={`ks-subtab-btn ${empireSubTab === "enterprises" ? "active" : ""}`}
                    onClick={() => setEmpireSubTab("enterprises")}
                  >
                    Enterprises ({snapshot.empireOverview?.businesses?.filter((b) => b.isOwned).length ?? 0})
                  </button>
                  <button
                    type="button"
                    className={`ks-subtab-btn ${empireSubTab === "financials" ? "active" : ""}`}
                    onClick={() => setEmpireSubTab("financials")}
                  >
                    P&L Statements
                  </button>
                  <button
                    type="button"
                    className={`ks-subtab-btn ${empireSubTab === "ledger" ? "active" : ""}`}
                    onClick={() => setEmpireSubTab("ledger")}
                  >
                    Audit Ledger
                  </button>
                </div>

                {/* Sub-tab 1: OVERVIEW */}
                {empireSubTab === "overview" && (
                  <>
                    <div className="ks-empire-worth-banner">
                      <div className="ks-worth-label">TOTAL COMMERCIAL NET WORTH</div>
                      <div className="ks-worth-value">
                        ₦{(snapshot.empireOverview?.totalNetWorth ?? cash).toLocaleString()}
                      </div>
                      <div className="ks-worth-sub">
                        {snapshot.ownedProperties?.length ?? 0} Properties · {snapshot.ownedBusinesses?.length ?? 0} Enterprises
                      </div>
                    </div>

                    <div className="ks-empire-balance-strip">
                      <div className="ks-bal-pill">
                        <small>LIQUID CASH</small>
                        <strong>₦{cash.toLocaleString()}</strong>
                      </div>
                      <div className="ks-bal-pill">
                        <small>COMMERCIAL VALUATION</small>
                        <strong>₦{(snapshot.empireOverview?.totalBusinessValuation ?? 0).toLocaleString()}</strong>
                      </div>
                      <div className="ks-bal-pill">
                        <small>REAL ESTATE EQUITY</small>
                        <strong>₦{(snapshot.empireOverview?.totalPropertyValuation ?? 0).toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="ks-empire-section-card">
                      <div className="ks-card-subhead">TODAY'S CASH FLOW RUN RATE</div>
                      <div className="ks-cashflow-stats">
                        <div className="ks-flow-row">
                          <span>Gross Commercial Revenue:</span>
                          <span className="ks-flow-pos">+₦{(snapshot.empireOverview?.totalDailyRevenue ?? 0).toLocaleString()}/day</span>
                        </div>
                        <div className="ks-flow-row">
                          <span>Enterprise Operating Costs:</span>
                          <span className="ks-flow-neg">-₦{(snapshot.empireOverview?.totalDailyOperatingCost ?? 0).toLocaleString()}/day</span>
                        </div>
                        <div className="ks-flow-row">
                          <span>Property Daily Upkeep:</span>
                          <span className="ks-flow-neg">-₦{(snapshot.empireOverview?.totalDailyPropertyUpkeep ?? 0).toLocaleString()}/day</span>
                        </div>
                        <div className="ks-flow-row highlight">
                          <span>Net Daily Profit:</span>
                          <strong className={(snapshot.empireOverview?.netDailyProfit ?? 0) >= 0 ? "ks-flow-pos" : "ks-flow-neg"}>
                            {(snapshot.empireOverview?.netDailyProfit ?? 0) >= 0 ? "+" : ""}₦{(snapshot.empireOverview?.netDailyProfit ?? 0).toLocaleString()}/day
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Residential Assets List */}
                    <div className="ks-empire-section-card">
                      <div className="ks-card-subhead">RESIDENTIAL ASSETS</div>
                      {snapshot.empireOverview?.properties && snapshot.empireOverview.properties.length > 0 ? (
                        <div className="ks-property-tile-list">
                          {snapshot.empireOverview.properties.map((p) => (
                            <div key={p.id} className="ks-property-tile">
                              <div className="ks-tile-top">
                                <span className="ks-tile-name">{p.name}</span>
                                <span className={`ks-tile-status ${p.isOwned ? "owned" : p.isRented ? "leased" : "sale"}`}>
                                  {p.isOwned ? "CERTIFICATE OF OCCUPANCY" : p.isRented ? "ACTIVE LEASE" : "FOR SALE"}
                                </span>
                              </div>
                              <div className="ks-tile-sub">{p.location}</div>
                              <div className="ks-tile-finances">
                                <div>Valuation: ₦{p.purchasePrice.toLocaleString()}</div>
                                <div>Daily Upkeep: ₦{p.dailyUpkeep.toLocaleString()}/day</div>
                              </div>
                              <button
                                type="button"
                                className="ks-btn-action tiny outline"
                                onClick={() => handleNavigateTo(p.id === "unit-2b" ? "apartment" : p.id === "bompai-penthouse" ? "bompai-flats" : "villa", p.name)}
                              >
                                GPS Waypoint
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="ks-empty-msg">No properties currently acquired.</p>
                      )}
                    </div>
                  </>
                )}

                {/* Sub-tab 2: ENTERPRISES */}
                {empireSubTab === "enterprises" && (
                  <div className="ks-empire-enterprises-view">
                    {snapshot.empireOverview?.businesses && snapshot.empireOverview.businesses.length > 0 ? (
                      <div className="ks-biz-mgmt-list">
                        {snapshot.empireOverview.businesses.map((b) => {
                          const isOwned = b.isOwned;
                          const cond = b.condition ?? 100;
                          const tax = b.dailyTax ?? Math.round(b.dailyRevenue * 0.05);
                          const net = b.dailyRevenue - b.dailyCost - tax;
                          return (
                            <div key={b.id} className={`ks-biz-mgmt-card ${isOwned ? "owned" : "locked"}`}>
                              <div className="ks-biz-card-head">
                                <div className="ks-biz-title-area">
                                  <span className="ks-biz-cat-badge">{b.categoryTitle || "Commercial"}</span>
                                  <h4 className="ks-biz-title">{b.name}</h4>
                                </div>
                                <span className={`ks-tile-status ${isOwned ? "owned" : "sale"}`}>
                                  {isOwned ? `TIER ${b.level ?? 1}` : "AVAILABLE"}
                                </span>
                              </div>

                              <div className="ks-biz-location">{b.location}</div>
                              <p className="ks-biz-desc">{b.description}</p>

                              {isOwned ? (
                                <>
                                  {/* Condition Bar */}
                                  <div className="ks-biz-condition-row">
                                    <div className="ks-cond-label">
                                      <small>PREMISE CONDITION</small>
                                      <strong className={cond > 75 ? "text-emerald" : cond > 40 ? "text-amber" : "text-rose"}>
                                        {cond}%
                                      </strong>
                                    </div>
                                    <div className="ks-cond-track">
                                      <div
                                        className="ks-cond-fill"
                                        style={{
                                          width: `${cond}%`,
                                          backgroundColor: cond > 75 ? "#10b981" : cond > 40 ? "#f59e0b" : "#ef4444",
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Management Stats Grid */}
                                  <div className="ks-biz-stats-grid">
                                    <div className="ks-stat-cell">
                                      <small>GROSS REVENUE</small>
                                      <strong className="text-emerald">+₦{b.dailyRevenue.toLocaleString()}/day</strong>
                                    </div>
                                    <div className="ks-stat-cell">
                                      <small>OPERATING COSTS</small>
                                      <strong className="text-amber">-₦{b.dailyCost.toLocaleString()}/day</strong>
                                    </div>
                                    <div className="ks-stat-cell">
                                      <small>COMMERCE LEVY</small>
                                      <strong className="text-amber">-₦{tax.toLocaleString()}/day</strong>
                                    </div>
                                    <div className="ks-stat-cell highlight">
                                      <small>NET PROFIT</small>
                                      <strong className="text-emerald">₦{net.toLocaleString()}/day</strong>
                                    </div>
                                    <div className="ks-stat-cell">
                                      <small>STAFF</small>
                                      <strong>{b.employeeCount ?? 2} Employees</strong>
                                    </div>
                                    <div className="ks-stat-cell">
                                      <small>SATISFACTION</small>
                                      <strong>{b.customerSatisfaction ?? 85}% ({b.reputation ?? 80}% Rep)</strong>
                                    </div>
                                  </div>

                                  <div className="ks-biz-inventory-line">
                                    <span>📦 Inventory:</span> <strong>{b.inventoryStatus || "Optimal Stock"}</strong>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="ks-biz-actions-row">
                                    {cond < 100 && (
                                      <button
                                        type="button"
                                        className="ks-btn-action tiny secondary"
                                        disabled={cash < (b.maintenanceCost ?? 15000)}
                                        onClick={() => {
                                          if (onMaintainBusiness) {
                                            const res = onMaintainBusiness(b.id);
                                            showToast(res.message);
                                          }
                                        }}
                                      >
                                        🔧 Routine Maintenance (₦{(b.maintenanceCost ?? 15000).toLocaleString()})
                                      </button>
                                    )}

                                    {(b.level ?? 1) < (b.maxLevel ?? 3) ? (
                                      <button
                                        type="button"
                                        className="ks-btn-action tiny primary"
                                        disabled={cash < (b.upgradeCost ?? 0)}
                                        onClick={() => {
                                          if (onUpgradeBusiness) {
                                            const res = onUpgradeBusiness(b.id);
                                            showToast(res.message);
                                          }
                                        }}
                                      >
                                        ⭐ Expand to Tier {(b.level ?? 1) + 1} (₦{(b.upgradeCost ?? 0).toLocaleString()})
                                      </button>
                                    ) : (
                                      <span className="ks-max-badge">⭐ MAX TIER ACHIEVED</span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="ks-biz-unowned-strip">
                                  <span>Acquisition Price: <strong>₦{b.purchasePrice.toLocaleString()}</strong></span>
                                  <small>Visit location in {b.location} to acquire deed.</small>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="ks-empty-msg">No commercial businesses catalog loaded.</p>
                    )}
                  </div>
                )}

                {/* Sub-tab 3: P&L STATEMENTS */}
                {empireSubTab === "financials" && (
                  <div className="ks-empire-financials-view">
                    <div className="ks-statement-head-banner">
                      <span className="ks-stmt-period">
                        {snapshot.empireOverview?.financialStatement?.calendarPeriod ?? `Day ${snapshot.dayCount ?? 1} Financial Statement`}
                      </span>
                      <h3>PROFIT & LOSS STATEMENT</h3>
                    </div>

                    <div className="ks-statement-table-box">
                      <div className="ks-stmt-row">
                        <span>Commercial Enterprise Revenue:</span>
                        <strong className="text-emerald">+₦{(snapshot.empireOverview?.financialStatement?.grossRevenue ?? 0).toLocaleString()}</strong>
                      </div>
                      <div className="ks-stmt-row">
                        <span>Operating Costs (Rent/Overhead):</span>
                        <strong className="text-amber">-₦{(snapshot.empireOverview?.financialStatement?.businessOperatingCosts ?? 0).toLocaleString()}</strong>
                      </div>
                      <div className="ks-stmt-row">
                        <span>Staff Salaries Allocation:</span>
                        <span className="ks-stmt-subtext">~₦{(snapshot.empireOverview?.financialStatement?.employeeSalaries ?? 0).toLocaleString()} (Included in Costs)</span>
                      </div>
                      <div className="ks-stmt-row">
                        <span>Inventory / Stock Allocation:</span>
                        <span className="ks-stmt-subtext">~₦{(snapshot.empireOverview?.financialStatement?.inventoryExpenses ?? 0).toLocaleString()} (Included in Costs)</span>
                      </div>
                      <div className="ks-stmt-row">
                        <span>Residential Upkeep (Boreholes & Solar):</span>
                        <strong className="text-amber">-₦{(snapshot.empireOverview?.financialStatement?.propertyUpkeep ?? 0).toLocaleString()}</strong>
                      </div>
                      <div className="ks-stmt-row">
                        <span>Municipal Commerce Levy (5%):</span>
                        <strong className="text-amber">-₦{(snapshot.empireOverview?.financialStatement?.municipalTaxes ?? 0).toLocaleString()}</strong>
                      </div>
                      <div className="ks-stmt-row total-expenses">
                        <span>Total Operational Outflows:</span>
                        <strong className="text-rose">-₦{(snapshot.empireOverview?.financialStatement?.totalExpenses ?? 0).toLocaleString()}</strong>
                      </div>
                      <div className="ks-stmt-row net-profit-row">
                        <span>NET DAILY PROFIT (Retained Earnings):</span>
                        <strong className={(snapshot.empireOverview?.financialStatement?.netProfit ?? 0) >= 0 ? "text-emerald" : "text-rose"}>
                          {(snapshot.empireOverview?.financialStatement?.netProfit ?? 0) >= 0 ? "+" : ""}₦{(snapshot.empireOverview?.financialStatement?.netProfit ?? 0).toLocaleString()}/day
                        </strong>
                      </div>
                    </div>

                    {/* 30-Day Monthly Projection */}
                    <div className="ks-empire-section-card">
                      <div className="ks-card-subhead">MONTHLY PROJECTION (30-DAY FISCAL RUN RATE)</div>
                      <div className="ks-monthly-grid">
                        <div className="ks-month-col">
                          <small>PROJECTED REVENUE</small>
                          <strong className="text-emerald">+₦{(snapshot.empireOverview?.monthlySummary?.totalRevenue ?? 0).toLocaleString()}</strong>
                        </div>
                        <div className="ks-month-col">
                          <small>PROJECTED EXPENSES</small>
                          <strong className="text-amber">-₦{(snapshot.empireOverview?.monthlySummary?.totalExpenses ?? 0).toLocaleString()}</strong>
                        </div>
                        <div className="ks-month-col highlight">
                          <small>PROJECTED NET PROFIT</small>
                          <strong className="text-emerald">₦{(snapshot.empireOverview?.monthlySummary?.totalNetProfit ?? 0).toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 4: AUDIT LEDGER */}
                {empireSubTab === "ledger" && (
                  <div className="ks-empire-ledger-view">
                    {/* Event Notifications Feed */}
                    {snapshot.empireOverview?.businessEventNotifications && snapshot.empireOverview.businessEventNotifications.length > 0 && (
                      <div className="ks-notifs-section">
                        <div className="ks-card-subhead">BUSINESS EVENT NOTIFICATIONS</div>
                        <div className="ks-notifs-feed">
                          {snapshot.empireOverview.businessEventNotifications.map((n, i) => (
                            <div key={i} className="ks-notif-item">
                              <span className="ks-notif-icon">📢</span>
                              <span className="ks-notif-text">{n}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="ks-card-subhead">TRANSACTION AUDIT LEDGER</div>
                    {snapshot.empireOverview?.transactionHistory && snapshot.empireOverview.transactionHistory.length > 0 ? (
                      <div className="ks-ledger-list">
                        {snapshot.empireOverview.transactionHistory.map((tx) => (
                          <div key={tx.id} className="ks-ledger-item">
                            <div className="ks-ledger-left">
                              <div className="ks-ledger-type-line">
                                <span className="ks-ledger-type-badge">{tx.type.toUpperCase()}</span>
                                <span className="ks-ledger-time">
                                  {new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <div className="ks-ledger-desc">{tx.description}</div>
                            </div>
                            <div className="ks-ledger-right">
                              <div className={`ks-ledger-amt ${tx.amount >= 0 ? "positive" : "negative"}`}>
                                {tx.amount >= 0 ? "+" : ""}{tx.currency === "coins" ? `${tx.amount} Coins` : `₦${tx.amount.toLocaleString()}`}
                              </div>
                              <div className="ks-ledger-bal">Bal: ₦{tx.balanceAfter.toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="ks-empty-msg">No transactions recorded yet in current session.</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="ks-btn-action outline"
                  onClick={() => {
                    onOpenEmpire?.();
                    onClose();
                  }}
                >
                  Open Full Desktop Empire Modal (Key K)
                </button>
              </div>
            )}

            {/* -------------------- 7. YAN-KANO CAMERA -------------------- */}
            {activeApp === "camera" && (
              <div className="ks-phone-app-view ks-camera-app">
                <div className="ks-viewfinder">
                  {/* Viewfinder Rule of Thirds Grid */}
                  <div className="ks-viewfinder-grid" />
                  <div className="ks-viewfinder-crosshair" />

                  {/* Metadata display */}
                  <div className="ks-viewfinder-top">
                    <span>4K 60FPS</span>
                    <span>ISO 100</span>
                    <span>1/250s</span>
                    <span>f/1.8</span>
                  </div>

                  <div className="ks-viewfinder-bottom">
                    <span>{snapshot.location}</span>
                    <span>{timeString}</span>
                  </div>
                </div>

                {/* Shutter Controls */}
                <div className="ks-camera-controls">
                  <div className="ks-gallery-preview">
                    {photoGallery.length > 0 && photoGallery[0].dataUrl ? (
                      <img src={photoGallery[0].dataUrl} alt="Last shot" className="ks-gallery-thumb" />
                    ) : photoGallery.length > 0 ? (
                      <span className="ks-photo-count">{photoGallery.length} Photos</span>
                    ) : (
                      <span className="ks-photo-count">0 Photos</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="ks-shutter-btn"
                    onClick={handleTakePhoto}
                    title="Capture Photo"
                  >
                    <div className="ks-shutter-inner" />
                  </button>

                  <div className="ks-camera-dummy-btn" />
                </div>

                {/* Photo Gallery Scroll */}
                {photoGallery.length > 0 && (
                  <div className="ks-photo-gallery-list">
                    <div className="ks-card-subhead">SAVED PHOTO LOG ({photoGallery.length})</div>
                    {photoGallery.map((p) => (
                      <div key={p.id} className="ks-photo-row">
                        {p.dataUrl && (
                          <img src={p.dataUrl} alt={p.location} className="ks-photo-row-thumb" />
                        )}
                        <div className="ks-photo-meta">
                          <span className="ks-photo-loc">📷 {p.location}</span>
                          <span className="ks-photo-sub">{p.weather} · {p.time}</span>
                        </div>
                        {p.dataUrl && (
                          <a
                            href={p.dataUrl}
                            download={`kano-shot-${p.id}.jpg`}
                            className="ks-btn-action tiny secondary ks-photo-dl"
                            title="Download full quality screenshot"
                          >
                            💾 Save
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -------------------- 8. QUICK SETTINGS -------------------- */}
            {activeApp === "settings" && (
              <div className="ks-phone-app-view ks-settings-app">
                <div className="ks-settings-card">
                  <div className="ks-card-subhead">SYSTEM PREFERENCES</div>

                  <div className="ks-setting-item">
                    <div>
                      <div className="ks-setting-label">Audio & Radio Atmosphere</div>
                      <div className="ks-setting-sub">Toggle sound effects and ambient Kano radio</div>
                    </div>
                    <button
                      type="button"
                      className={`ks-btn-action tiny ${snapshot.audioMuted ? "secondary" : ""}`}
                      onClick={onToggleAudioMute}
                    >
                      {snapshot.audioMuted ? "Muted" : "Active"}
                    </button>
                  </div>

                  <div className="ks-setting-item">
                    <div>
                      <div className="ks-setting-label">Weather System</div>
                      <div className="ks-setting-sub">Current: {snapshot.weatherDisplayName ?? "Clear"}</div>
                    </div>
                    <button
                      type="button"
                      className="ks-btn-action tiny"
                      onClick={onCycleWeather}
                    >
                      Cycle Preset
                    </button>
                  </div>

                  <div className="ks-setting-item">
                    <div>
                      <div className="ks-setting-label">Graphics Quality</div>
                      <div className="ks-setting-sub">Mode: {graphicsQuality.toUpperCase()}</div>
                    </div>
                    <select
                      className="ks-setting-select"
                      value={graphicsQuality}
                      onChange={(e) => onQualityChange?.(e.target.value as GraphicsQuality)}
                    >
                      <option value="performance">Performance</option>
                      <option value="balanced">Balanced</option>
                      <option value="quality">Quality</option>
                    </select>
                  </div>

                  <div className="ks-setting-item">
                    <div>
                      <div className="ks-setting-label">LED Flashlight</div>
                      <div className="ks-setting-sub">Illuminates dark streets and zaure corridors</div>
                    </div>
                    <button
                      type="button"
                      className={`ks-btn-action tiny ${flashlightOn ? "active" : "secondary"}`}
                      onClick={() => setFlashlightOn((prev) => !prev)}
                    >
                      {flashlightOn ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>

                <div className="ks-settings-card">
                  <div className="ks-card-subhead">HANDSET HARDWARE SPECS</div>
                  <div className="ks-spec-row">
                    <span>Model:</span>
                    <strong>Arewa Note 12 Pro (5G)</strong>
                  </div>
                  <div className="ks-spec-row">
                    <span>OS Version:</span>
                    <strong>Kano Connect OS 2.4</strong>
                  </div>
                  <div className="ks-spec-row">
                    <span>Active District:</span>
                    <strong>{snapshot.location}</strong>
                  </div>
                  <div className="ks-spec-row">
                    <span>Coordinates:</span>
                    <strong>X: {snapshot.playerCoords?.x ?? 0}, Z: {snapshot.playerCoords?.z ?? 0}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Dock (Always visible on Home, Home Indicator on sub-apps) */}
          {activeApp === "home" ? (
            <div className="ks-phone-dock">
              <button
                type="button"
                className="ks-dock-btn"
                onClick={() => setActiveApp("contacts")}
                title="Kano Connect"
              >
                📞
              </button>
              <button
                type="button"
                className="ks-dock-btn"
                onClick={() => setActiveApp("contacts")}
                title="Messages"
              >
                💬
              </button>
              <button
                type="button"
                className="ks-dock-btn"
                onClick={() => setActiveApp("maps")}
                title="Yan-Dutse Maps"
              >
                🗺️
              </button>
              <button
                type="button"
                className="ks-dock-btn"
                onClick={() => setActiveApp("bank")}
                title="Arewa Bank"
              >
                🏦
              </button>
            </div>
          ) : (
            <div className="ks-phone-home-bar-area" onClick={() => setActiveApp("home")}>
              <div className="ks-phone-home-indicator" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

