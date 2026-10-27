import { useState } from "react";
import "./EmpireModal.css";
import type {
  BusinessId,
  CurrencyType,
  EmpireOverviewSnapshot,
  PropertyId,
} from "../game/types";

export interface EmpireModalProps {
  onClose: () => void;
  cash?: number;
  premiumCoins?: number;
  empireOverview?: EmpireOverviewSnapshot;
  onUpgradeBusiness?: (id: BusinessId) => { success: boolean; cost?: number; newLevel?: number; message: string };
  onRenovateProperty?: (id: PropertyId, useCoins?: boolean) => { success: boolean; costCash: number; costCoins: number; newLevel: number; message: string };
  onPurchaseVehicle?: (vehicleId: string, currency?: CurrencyType) => { success: boolean; message: string; costCash?: number; costCoins?: number };
  onPurchaseVehicleSkin?: (skinId: string, vehicleId: string, currency?: CurrencyType) => { success: boolean; message: string; costCash?: number; costCoins?: number };
  onClaimAchievement?: (achievementId: string) => { success: boolean; rewardCash: number; rewardCoins: number; message: string };
  onClaimSeasonalChallenge?: (challengeId: string) => { success: boolean; rewardCash: number; rewardCoins: number; message: string };
  onClaimSeasonalMilestone?: () => { success: boolean; rewardCoins: number; rewardTitle?: string; message: string };
}

type TabType = "enterprises" | "properties" | "fleet" | "season" | "legacy" | "ledger";

export default function EmpireModal({
  onClose,
  cash = 150000,
  premiumCoins = 250,
  empireOverview,
  onUpgradeBusiness,
  onRenovateProperty,
  onPurchaseVehicle,
  onPurchaseVehicleSkin,
  onClaimAchievement,
  onClaimSeasonalChallenge,
  onClaimSeasonalMilestone,
}: EmpireModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("enterprises");
  const [statusFeedback, setStatusFeedback] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const notify = (message: string, type: "success" | "error" | "info" = "info") => {
    setStatusFeedback({ message, type });
    setTimeout(() => {
      setStatusFeedback((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const handleUpgradeBiz = (bizId: BusinessId, name: string, cost: number) => {
    if (cash < cost) {
      notify(`Insufficient cash! Upgrading ${name} requires ₦${cost.toLocaleString()}.`, "error");
      return;
    }
    setConfirmDialog({
      title: `Expand Commercial Enterprise`,
      description: `Upgrade ${name} to the next commercial tier for ₦${cost.toLocaleString()}? This will expand daily production and net earnings.`,
      onConfirm: () => {
        setConfirmDialog(null);
        if (onUpgradeBusiness) {
          const res = onUpgradeBusiness(bizId);
          notify(res.message, res.success ? "success" : "error");
        }
      },
    });
  };

  const handleRenovateProp = (propId: PropertyId, name: string, costCash: number, costCoins: number, useCoins = false) => {
    if (useCoins) {
      if (premiumCoins < costCoins) {
        notify(`Insufficient Kano Gold! Upgrading ${name} requires 🪙${costCoins.toLocaleString()} Coins.`, "error");
        return;
      }
    } else {
      if (cash < costCash) {
        notify(`Insufficient cash! Upgrading ${name} requires ₦${costCash.toLocaleString()}.`, "error");
        return;
      }
    }

    setConfirmDialog({
      title: `Executive Residence Renovation`,
      description: `Commission high-spec renovation for ${name} using ${useCoins ? `🪙${costCoins.toLocaleString()} Kano Gold` : `₦${costCash.toLocaleString()} Cash`}? This unlocks clean solar/inverter backup and increases equity valuation.`,
      onConfirm: () => {
        setConfirmDialog(null);
        if (onRenovateProperty) {
          const res = onRenovateProperty(propId, useCoins);
          notify(res.message, res.success ? "success" : "error");
        }
      },
    });
  };

  const handleBuyVehicle = (vehId: string, name: string, costCash?: number, costCoins?: number, currency: CurrencyType = "cash") => {
    if (currency === "coins" && costCoins) {
      if (premiumCoins < costCoins) {
        notify(`Insufficient Kano Gold! 🪙${costCoins.toLocaleString()} required.`, "error");
        return;
      }
    } else if (costCash) {
      if (cash < costCash) {
        notify(`Insufficient Cash! ₦${costCash.toLocaleString()} required.`, "error");
        return;
      }
    }

    setConfirmDialog({
      title: `Acquire Fleet Vehicle`,
      description: `Purchase ${name} for your Kano commercial fleet using ${currency === "coins" ? `🪙${costCoins?.toLocaleString()} Kano Gold` : `₦${costCash?.toLocaleString()} Cash`}?`,
      onConfirm: () => {
        setConfirmDialog(null);
        if (onPurchaseVehicle) {
          const res = onPurchaseVehicle(vehId, currency);
          notify(res.message, res.success ? "success" : "error");
        }
      },
    });
  };

  const handleBuySkin = (skinId: string, vehId: string, skinName: string, costCash?: number, costCoins?: number, currency: CurrencyType = "coins") => {
    setConfirmDialog({
      title: `Unlock Custom Livery`,
      description: `Unlock ${skinName} livery using ${currency === "coins" ? `🪙${costCoins?.toLocaleString()} Kano Gold` : `₦${costCash?.toLocaleString()} Cash`}?`,
      onConfirm: () => {
        setConfirmDialog(null);
        if (onPurchaseVehicleSkin) {
          const res = onPurchaseVehicleSkin(skinId, vehId, currency);
          notify(res.message, res.success ? "success" : "error");
        }
      },
    });
  };

  const handleClaimAch = (achId: string) => {
    if (onClaimAchievement) {
      const res = onClaimAchievement(achId);
      notify(res.message, res.success ? "success" : "error");
    }
  };

  const handleClaimChallenge = (challengeId: string) => {
    if (onClaimSeasonalChallenge) {
      const res = onClaimSeasonalChallenge(challengeId);
      notify(res.message, res.success ? "success" : "error");
    }
  };

  const handleClaimMilestone = () => {
    if (onClaimSeasonalMilestone) {
      const res = onClaimSeasonalMilestone();
      notify(res.message, res.success ? "success" : "error");
    }
  };

  const overview = empireOverview;

  return (
    <div className="ks-empire-modal-backdrop" onClick={onClose}>
      <div className="ks-empire-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="ks-empire-header">
          <div className="ks-empire-title-group">
            <span className="ks-empire-badge">MILESTONE 15</span>
            <h2>EMPIRE & COMMERCIAL LOGISTICS</h2>
            <p className="ks-empire-subtitle">
              Expand enterprises, commission executive renovations, upgrade your commercial fleet, and claim seasonal Sahel rewards.
            </p>
          </div>

          <div className="ks-empire-wallets">
            <div className="ks-empire-wallet-pill cash" title="Street Cash earned through honest contracts, deliveries, and enterprise dividends">
              <span className="wallet-label">STREET CASH</span>
              <strong className="wallet-value">₦{cash.toLocaleString()}</strong>
            </div>
            <div className="ks-empire-wallet-pill coins" title="Kano Gold (Simulated Developer Test Coins) for cosmetics and optional expedited renovations">
              <span className="wallet-label">🪙 KANO GOLD</span>
              <strong className="wallet-value">{premiumCoins.toLocaleString()} COINS</strong>
            </div>
            <button className="ks-empire-close-btn" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>
        </header>

        {/* Global Alert / Status Feedback */}
        {statusFeedback && (
          <div className={`ks-empire-feedback ${statusFeedback.type}`}>
            <span>{statusFeedback.type === "success" ? "✅" : statusFeedback.type === "error" ? "⚠️" : "ℹ️"}</span>
            <p>{statusFeedback.message}</p>
          </div>
        )}

        {/* Overview Metric Ribbon */}
        {overview && (
          <div className="ks-empire-stats-ribbon">
            <div className="stat-card">
              <small>TOTAL NET WORTH</small>
              <strong>₦{overview.totalNetWorth.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <small>DAILY GROSS REVENUE</small>
              <strong className="text-emerald">+₦{overview.totalDailyRevenue.toLocaleString()}/day</strong>
            </div>
            <div className="stat-card">
              <small>DAILY OPERATING COSTS</small>
              <strong className="text-amber">-₦{(overview.totalDailyOperatingCost + overview.totalDailyPropertyUpkeep).toLocaleString()}/day</strong>
            </div>
            <div className="stat-card highlight">
              <small>NET DAILY PROFIT</small>
              <strong className={overview.netDailyProfit >= 0 ? "text-emerald" : "text-rose"}>
                {overview.netDailyProfit >= 0 ? "+" : ""}₦{overview.netDailyProfit.toLocaleString()}/day
              </strong>
            </div>
            <div className="stat-card prestige">
              <small>PRESTIGE LEVEL</small>
              <strong>{overview.achievements.prestige.title} (Lvl {overview.achievements.prestige.level})</strong>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="ks-empire-nav-tabs">
          <button
            className={`tab-btn ${activeTab === "enterprises" ? "active" : ""}`}
            onClick={() => setActiveTab("enterprises")}
          >
            🏢 Enterprises ({overview?.businesses.filter((b) => b.isOwned).length ?? 0}/{overview?.businesses.length ?? 6})
          </button>
          <button
            className={`tab-btn ${activeTab === "properties" ? "active" : ""}`}
            onClick={() => setActiveTab("properties")}
          >
            🏡 Residences & Renovations ({overview?.properties.filter((p) => p.isOwned || p.isRented).length ?? 0})
          </button>
          <button
            className={`tab-btn ${activeTab === "fleet" ? "active" : ""}`}
            onClick={() => setActiveTab("fleet")}
          >
            🚗 Commercial Fleet & Liveries ({overview?.fleet.ownedVehicles.length ?? 1})
          </button>
          <button
            className={`tab-btn ${activeTab === "season" ? "active" : ""}`}
            onClick={() => setActiveTab("season")}
          >
            🌟 Harmattan Season ({overview?.season.points ?? 0} pts)
          </button>
          <button
            className={`tab-btn ${activeTab === "legacy" ? "active" : ""}`}
            onClick={() => setActiveTab("legacy")}
          >
            🏆 Achievements ({overview?.achievements.unlockedCount ?? 0}/{overview?.achievements.totalCount ?? 7})
          </button>
          <button
            className={`tab-btn ${activeTab === "ledger" ? "active" : ""}`}
            onClick={() => setActiveTab("ledger")}
          >
            📜 Audit Ledger
          </button>
        </nav>

        {/* Tab Body */}
        <div className="ks-empire-body">
          {/* TAB 1: ENTERPRISES */}
          {activeTab === "enterprises" && (
            <div className="ks-tab-content enterprises-tab">
              <div className="tab-banner">
                <h3>Kano Commercial Syndicates & Supply Hubs</h3>
                <p>
                  Build your business footprint across Northern Nigeria's commercial capital. Upgrade enterprises from small stalls to multi-facility hubs with high-volume logistics and automated cold chains.
                </p>
              </div>

              <div className="enterprises-grid">
                {overview?.businesses.map((biz) => {
                  const level = biz.level ?? 1;
                  const isMax = level >= (biz.maxLevel ?? 3);
                  return (
                    <div key={biz.id} className={`empire-card ${biz.isOwned ? "owned" : "locked"}`}>
                      <div className="card-header">
                        <div className="title-area">
                          <h4>{biz.name}</h4>
                          <span className="district-tag">{biz.location}</span>
                        </div>
                        <div className="level-badge">
                          {biz.isOwned ? (
                            <span className={`badge-lvl lvl-${level}`}>LEVEL {level} / 3</span>
                          ) : (
                            <span className="badge-lvl unowned">FOR SALE</span>
                          )}
                        </div>
                      </div>

                      <p className="card-desc">{biz.description}</p>

                      {biz.isOwned ? (
                        <>
                          <div className="enterprise-stats-box">
                            <div className="stat-row">
                              <span>Tier Title:</span>
                              <strong>{biz.levelTitle || `Level ${level}`}</strong>
                            </div>
                            <div className="stat-row">
                              <span>Gross Revenue:</span>
                              <strong className="text-emerald">+₦{biz.dailyRevenue.toLocaleString()}/day</strong>
                            </div>
                            <div className="stat-row">
                              <span>Operating Cost:</span>
                              <strong className="text-amber">-₦{biz.dailyCost.toLocaleString()}/day</strong>
                            </div>
                            <div className="stat-row highlight">
                              <span>Net Daily Profit:</span>
                              <strong className="text-emerald">₦{(biz.dailyRevenue - biz.dailyCost).toLocaleString()}/day</strong>
                            </div>
                          </div>

                          {biz.perks && biz.perks.length > 0 && (
                            <div className="perks-list">
                              <small>ACTIVE CAPABILITIES:</small>
                              <ul>
                                {biz.perks.map((p, i) => (
                                  <li key={i}>✓ {p}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="card-actions">
                            {!isMax ? (
                              <button
                                className="action-btn upgrade-btn"
                                onClick={() => handleUpgradeBiz(biz.id, biz.name, biz.upgradeCost ?? 0)}
                                disabled={cash < (biz.upgradeCost ?? 0)}
                              >
                                <span>Expand to Level {level + 1}</span>
                                <strong>₦{(biz.upgradeCost ?? 0).toLocaleString()}</strong>
                              </button>
                            ) : (
                              <div className="max-tag">⭐ MAXIMUM COMMERCIAL PRESTIGE ACHIEVED</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="unowned-footer">
                          <div className="price-tag">
                            <small>PURCHASE ACQUISITION COST</small>
                            <strong>₦{biz.purchasePrice.toLocaleString()}</strong>
                          </div>
                          <p className="hint">Visit the business site in {biz.location} or acquire via commercial contract.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: RESIDENCES & RENOVATIONS */}
          {activeTab === "properties" && (
            <div className="ks-tab-content properties-tab">
              <div className="tab-banner">
                <h3>Residential Real Estate & Energy Modernization</h3>
                <p>
                  Elevate your residential properties with Tier 1 Clean Solar/Inverter microgrids and Tier 2 Executive Sahel Luxury suites. Upgrades substantially increase your portfolio equity valuation and resilience.
                </p>
              </div>

              <div className="properties-grid">
                {overview?.properties.map((prop) => {
                  const renLvl = prop.renovationLevel ?? 0;
                  const isMax = renLvl >= (prop.maxRenovationLevel ?? 2);
                  const isAccessible = prop.isOwned || (prop.id === "unit-2b" && prop.isRented);

                  return (
                    <div key={prop.id} className={`empire-card property-card ${isAccessible ? "owned" : "locked"}`}>
                      <div className="card-header">
                        <div className="title-area">
                          <h4>{prop.name}</h4>
                          <span className="district-tag">{prop.location}</span>
                        </div>
                        <div className="level-badge">
                          <span className={`badge-lvl ren-${renLvl}`}>
                            {renLvl === 0 ? "STANDARD BASE" : renLvl === 1 ? "☀️ SOLAR/INVERTER" : "👑 EXECUTIVE LUXURY"}
                          </span>
                        </div>
                      </div>

                      <p className="card-desc">{prop.description}</p>

                      <div className="enterprise-stats-box">
                        <div className="stat-row">
                          <span>Status:</span>
                          <strong>{prop.isOwned ? "Freehold Owned" : prop.isRented ? "Active Monthly Lease" : "Not Acquired"}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Portfolio Valuation:</span>
                          <strong className="text-emerald">₦{(prop.currentValuation ?? prop.purchasePrice).toLocaleString()}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Daily Facility Upkeep:</span>
                          <strong className="text-amber">₦{prop.dailyUpkeep.toLocaleString()}/day</strong>
                        </div>
                        <div className="stat-row">
                          <span>Renovation Grade:</span>
                          <strong>{prop.renovationTitle || "Tier 0 Standard"}</strong>
                        </div>
                      </div>

                      {isAccessible ? (
                        <div className="card-actions renovation-actions">
                          {!isMax ? (
                            <>
                              <div className="renovation-prompt">
                                <small>UPGRADE TO {renLvl === 0 ? "TIER 1 (SOLAR & INVERTER)" : "TIER 2 (EXECUTIVE SAHEL SUITE)"}</small>
                              </div>
                              <div className="btn-dual-row">
                                <button
                                  className="action-btn upgrade-btn"
                                  onClick={() => handleRenovateProp(prop.id, prop.name, prop.renovationCostCash ?? 0, prop.renovationCostCoins ?? 0, false)}
                                  disabled={cash < (prop.renovationCostCash ?? 0)}
                                >
                                  <span>Cash Renovation</span>
                                  <strong>₦{(prop.renovationCostCash ?? 0).toLocaleString()}</strong>
                                </button>
                                <button
                                  className="action-btn coins-btn"
                                  onClick={() => handleRenovateProp(prop.id, prop.name, prop.renovationCostCash ?? 0, prop.renovationCostCoins ?? 0, true)}
                                  disabled={premiumCoins < (prop.renovationCostCoins ?? 0)}
                                >
                                  <span>🪙 Fast Inverter</span>
                                  <strong>🪙{(prop.renovationCostCoins ?? 0).toLocaleString()} Coins</strong>
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="max-tag">⭐ MAXIMUM EXECUTIVE RENOVATION ACTIVE</div>
                          )}
                        </div>
                      ) : (
                        <div className="unowned-footer">
                          <div className="price-tag">
                            <small>PURCHASE PRICE</small>
                            <strong>₦{prop.purchasePrice.toLocaleString()}</strong>
                          </div>
                          <p className="hint">Visit entrance doors in Kano to sign lease or deed.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: FLEET & LIVERIES */}
          {activeTab === "fleet" && (
            <div className="ks-tab-content fleet-tab">
              <div className="tab-banner">
                <h3>Commercial Vehicle Fleet & Livery Showroom</h3>
                <p>
                  Acquire and expand your transport operations. From agile Keke tricycles to heavy freight haulers, each vehicle offers distinct cargo payload and handling characteristics.
                </p>
              </div>

              <div className="fleet-grid">
                {overview?.fleet.catalog.map((veh) => {
                  const isOwned = overview.fleet.ownedVehicles.includes(veh.id);

                  return (
                    <div key={veh.id} className={`empire-card fleet-card ${isOwned ? "owned" : "locked"}`}>
                      <div className="card-header">
                        <div className="title-area">
                          <h4>{veh.name}</h4>
                          <span className="district-tag">{veh.type.toUpperCase()}</span>
                        </div>
                        <div className="level-badge">
                          <span className={`badge-lvl ${isOwned ? "lvl-2" : "unowned"}`}>
                            {isOwned ? "IN GARAGE" : "AVAILABLE"}
                          </span>
                        </div>
                      </div>

                      <p className="card-desc">{veh.description}</p>

                      <div className="enterprise-stats-box">
                        <div className="stat-row">
                          <span>Top Speed:</span>
                          <strong>{veh.specs.topSpeedKmh} km/h</strong>
                        </div>
                        <div className="stat-row">
                          <span>Cargo Capacity:</span>
                          <strong>{veh.specs.cargoCapacity}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Acceleration:</span>
                          <strong>{veh.specs.acceleration}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Durability:</span>
                          <strong>{veh.specs.durability}</strong>
                        </div>
                      </div>

                      {/* Livery customization */}
                      {isOwned && veh.availableSkins && (
                        <div className="livery-box">
                          <small>AVAILABLE LIVERIES & SKINS:</small>
                          <div className="skins-list">
                            {veh.availableSkins.map((skin) => {
                              const isSkinUnlocked = overview.fleet.unlockedSkins.includes(skin.id);
                              return (
                                <div key={skin.id} className={`skin-item ${isSkinUnlocked ? "unlocked" : "locked"}`}>
                                  <div className="skin-info">
                                    <span className="skin-name">{skin.name}</span>
                                    <small className="skin-desc">Color: {skin.paintColor}</small>
                                  </div>
                                  {isSkinUnlocked ? (
                                    <span className="skin-owned-pill">EQUIPPED</span>
                                  ) : (
                                    <button
                                      className="skin-buy-btn"
                                      onClick={() => handleBuySkin(skin.id, veh.id, skin.name, skin.priceCash, skin.priceCoins, "coins")}
                                      disabled={premiumCoins < (skin.priceCoins ?? 50)}
                                    >
                                      🪙 {skin.priceCoins} Coins
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!isOwned && (
                        <div className="card-actions fleet-actions">
                          <div className="btn-dual-row">
                            {veh.priceCash > 0 && (
                              <button
                                className="action-btn upgrade-btn"
                                onClick={() => handleBuyVehicle(veh.id, veh.name, veh.priceCash, undefined, "cash")}
                                disabled={cash < veh.priceCash}
                              >
                                <span>Buy Fleet Unit</span>
                                <strong>₦{veh.priceCash.toLocaleString()}</strong>
                              </button>
                            )}
                            {veh.priceCoins && veh.priceCoins > 0 && (
                              <button
                                className="action-btn coins-btn"
                                onClick={() => handleBuyVehicle(veh.id, veh.name, undefined, veh.priceCoins, "coins")}
                                disabled={premiumCoins < veh.priceCoins}
                              >
                                <span>🪙 Kano Gold</span>
                                <strong>🪙{veh.priceCoins.toLocaleString()} Coins</strong>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: HARMATTAN SEASON */}
          {activeTab === "season" && overview?.season && (
            <div className="ks-tab-content season-tab">
              <div className="season-hero-banner">
                <div className="hero-content">
                  <span className="season-tag">ACTIVE SEASON PASS</span>
                  <h2>{overview.season.activeSeason.name}</h2>
                  <p>{overview.season.activeSeason.theme}</p>
                  <div className="season-date-row">
                    <span>Active Period: {overview.season.activeSeason.startDate} to {overview.season.activeSeason.endDate}</span>
                    <span className="live-pill">● LIVE CONTENT</span>
                  </div>
                </div>

                <div className="season-milestone-box">
                  <div className="milestone-title">SEASON GRAND MILESTONE</div>
                  <div className="points-display">
                    <strong>{overview.season.completedChallenges.length}</strong> / {overview.season.activeSeason.seasonMilestoneReward?.requiredChallengesCount ?? 4} CHALLENGES
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min(100, (overview.season.completedChallenges.length / (overview.season.activeSeason.seasonMilestoneReward?.requiredChallengesCount ?? 4)) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>Reward: 🪙{overview.season.activeSeason.seasonMilestoneReward?.rewardCoins ?? 100} Coins + '{overview.season.activeSeason.seasonMilestoneReward?.rewardTitle ?? "Sahel Royal Emissary"}' Title</small>
                  <button
                    className="claim-milestone-btn"
                    onClick={handleClaimMilestone}
                    disabled={
                      overview.season.completedChallenges.length < (overview.season.activeSeason.seasonMilestoneReward?.requiredChallengesCount ?? 4) ||
                      overview.season.milestoneClaimed
                    }
                  >
                    {overview.season.milestoneClaimed ? "MILESTONE CLAIMED ✓" : "CLAIM GRAND MILESTONE"}
                  </button>
                </div>
              </div>

              <div className="challenges-section">
                <h3>Seasonal Challenges & Expeditions</h3>
                <div className="challenges-grid">
                  {overview.season.activeSeason.challenges.map((c) => {
                    const isCompleted = overview.season.completedChallenges.includes(c.id);
                    const isClaimed = overview.season.claimedChallenges.includes(c.id);

                    return (
                      <div key={c.id} className={`challenge-card ${isClaimed ? "claimed" : isCompleted ? "ready" : "in-progress"}`}>
                        <div className="ch-header">
                          <h4>{c.title}</h4>
                          <span className="ch-pts">+{c.rewardCoins} COINS</span>
                        </div>
                        <p className="ch-desc">{c.description}</p>
                        <div className="ch-footer">
                          <div className="ch-rewards">
                            <span>₦{c.rewardCash.toLocaleString()}</span>
                            <span>🪙 {c.rewardCoins} Coins</span>
                          </div>
                          {isClaimed ? (
                            <span className="claimed-badge">CLAIMED ✓</span>
                          ) : isCompleted ? (
                            <button className="claim-ch-btn" onClick={() => handleClaimChallenge(c.id)}>
                              CLAIM REWARD
                            </button>
                          ) : (
                            <span className="progress-status">IN PROGRESS</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming Season Preview */}
              <div className="upcoming-preview-box">
                <span className="preview-tag">COMING Q2 2026</span>
                <h4>{overview.season.upcomingPreview.name}</h4>
                <p>{overview.season.upcomingPreview.theme}. Featuring ceremonial royal horse parades, ancient zaure cultural architecture, and heritage logistics routes.</p>
              </div>
            </div>
          )}

          {/* TAB 5: LEGACY & ACHIEVEMENTS */}
          {activeTab === "legacy" && overview?.achievements && (
            <div className="ks-tab-content legacy-tab">
              <div className="tab-banner prestige-banner">
                <div className="prestige-info">
                  <h3>Kano Commercial Legacy & Prestige</h3>
                  <p>Track your verifiable achievements across logistics, commerce, and architecture.</p>
                </div>
                <div className="prestige-badge-large">
                  <span className="prestige-lvl">LEVEL {overview.achievements.prestige.level}</span>
                  <strong className="prestige-title">{overview.achievements.prestige.title}</strong>
                  <small>{overview.achievements.prestige.points} Prestige Score</small>
                </div>
              </div>

              <div className="achievements-grid">
                {overview.achievements.catalog.map((ach) => {
                  const state = overview.achievements.playerState[ach.id];
                  const isUnlocked = state?.isUnlocked;
                  const isClaimed = state?.isClaimed;

                  return (
                    <div key={ach.id} className={`achievement-card ${isClaimed ? "claimed" : isUnlocked ? "unlocked" : "locked"}`}>
                      <div className="ach-icon">{ach.icon}</div>
                      <div className="ach-details">
                        <h4>{ach.title}</h4>
                        <p>{ach.description}</p>
                        <div className="ach-rewards-row">
                          <span className="reward-item">₦{ach.rewardCash.toLocaleString()}</span>
                          <span className="reward-item">🪙 {ach.rewardCoins} Coins</span>
                          <span className="reward-item">⭐ +25 Prestige</span>
                        </div>
                      </div>
                      <div className="ach-action">
                        {isClaimed ? (
                          <span className="claimed-badge">COMPLETED ✓</span>
                        ) : isUnlocked ? (
                          <button className="claim-ach-btn" onClick={() => handleClaimAch(ach.id)}>
                            CLAIM
                          </button>
                        ) : (
                          <span className="locked-badge">LOCKED</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LEDGER */}
          {activeTab === "ledger" && (
            <div className="ks-tab-content ledger-tab">
              <div className="tab-banner">
                <h3>Financial Audit & Transaction Ledger</h3>
                <p>
                  Immutable chronological audit record of all debits, credits, enterprise dividends, and renovation investments. Ensures economy integrity and safe cloud profile reconciliation.
                </p>
              </div>

              <div className="ledger-table-wrap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>TIMESTAMP</th>
                      <th>CATEGORY</th>
                      <th>DESCRIPTION</th>
                      <th>CURRENCY</th>
                      <th>AMOUNT</th>
                      <th>BALANCE AFTER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview?.transactionHistory && overview.transactionHistory.length > 0 ? (
                      overview.transactionHistory.map((tx) => (
                        <tr key={tx.id} className={tx.amount >= 0 ? "credit-row" : "debit-row"}>
                          <td className="time-cell">{new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                          <td className="cat-cell"><span className="cat-pill">{tx.type.toUpperCase()}</span></td>
                          <td className="desc-cell">{tx.description}</td>
                          <td className="curr-cell">{tx.currency === "coins" ? "🪙 Kano Gold" : "₦ Street Cash"}</td>
                          <td className={`amount-cell ${tx.amount >= 0 ? "positive" : "negative"}`}>
                            {tx.amount >= 0 ? "+" : ""}{tx.currency === "coins" ? `${tx.amount} Coins` : `₦${tx.amount.toLocaleString()}`}
                          </td>
                          <td className="balance-cell">
                            {tx.currency === "coins" ? `${tx.balanceAfter} Coins` : `₦${tx.balanceAfter.toLocaleString()}`}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-ledger">
                          No transactions recorded yet in current session. Upgrade enterprises or earn revenue to view the audit log.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Disclaimer */}
        <footer className="ks-empire-footer">
          <div className="disclaimer-note">
            <span>🛡️ INTEGRITY NOTICE:</span> All transactions are simulated client-side with atomic balance validation. Kano Gold (🪙) is a developer test currency without real-world cash value or external payment collection.
          </div>
          <button className="ks-empire-close-pill" onClick={onClose}>
            BACK TO KANO STREETS [ESC]
          </button>
        </footer>

        {/* Confirmation Dialog Overlay */}
        {confirmDialog && (
          <div className="ks-confirm-backdrop">
            <div className="ks-confirm-box">
              <h3>{confirmDialog.title}</h3>
              <p>{confirmDialog.description}</p>
              <div className="confirm-buttons">
                <button className="btn-cancel" onClick={() => setConfirmDialog(null)}>
                  Cancel
                </button>
                <button className="btn-confirm" onClick={confirmDialog.onConfirm}>
                  Confirm Transaction
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
