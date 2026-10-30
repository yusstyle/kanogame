import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { EconomySystem } from "./economySystem";
import { GameEngine } from "./GameEngine";
import {
  BUSINESS_TIERS,
  PROPERTY_RENOVATIONS,
  VEHICLE_CATALOG,
  ACHIEVEMENT_CATALOG,
  ACTIVE_SEASON_CONFIG,
} from "./empireCatalog";
import type { GameSnapshot } from "./types";

function setupMockDOM() {
  const store = new Map<string, string>();

  const fakeLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get _store() {
      return store;
    },
  };

  const fakeContext = {
    canvas: { width: 512, height: 512 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
    font: "",
    textAlign: "center",
    textBaseline: "middle",
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    scale: () => {},
    rotate: () => {},
    translate: () => {},
    transform: () => {},
    setTransform: () => {},
    resetTransform: () => {},
  };

  const fakeCanvas = {
    width: 512,
    height: 512,
    parentElement: { clientWidth: 1280, clientHeight: 720 },
    getContext: () => fakeContext,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    requestPointerLock: () => {},
    style: {},
  };

  const fakeDocument = {
    createElement: (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      return { style: {}, addEventListener: () => {}, removeEventListener: () => {} };
    },
    pointerLockElement: null,
    exitPointerLock: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }

  const fakeWindow = {
    devicePixelRatio: 1.5,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: fakeLocalStorage,
  };

  (globalThis as any).document = fakeDocument;
  (globalThis as any).window = fakeWindow;
  (globalThis as any).ResizeObserver = FakeResizeObserver;
  (globalThis as any).requestAnimationFrame = () => 1;
  (globalThis as any).cancelAnimationFrame = () => {};

  return fakeLocalStorage;
}

function createMockRendererFactory() {
  return () => {
    return {
      setPixelRatio: () => {},
      setSize: () => {},
      dispose: () => {},
      render: () => {},
      shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
      domElement: (globalThis as any).document.createElement("canvas"),
    } as unknown as THREE.WebGLRenderer;
  };
}

test("Test 1: Dual Currency & Atomic Wallet Balance Checks", () => {
  setupMockDOM();
  const economy = new EconomySystem();

  // Initial developer test balance for premium coins is 250
  assert.equal(economy.premiumCoins, 250, "Default premium coins should be 250");

  // Attempt purchase exceeding funds
  const overspendCash = economy.purchaseBusiness("dawanau-grain-depot", 100000);
  assert.equal(overspendCash.success, false, "Should block purchase when player cash is insufficient");

  // Atomic deduction with valid cash
  const initialCash = 5000000;
  const buyRes = economy.purchaseBusiness("dawanau-grain-depot", initialCash);
  assert.equal(buyRes.success, true, "Should succeed with sufficient cash");
  assert.equal(buyRes.cost, 4500000);

  // Check audit ledger record
  const latestTx = economy.transactionHistory[economy.transactionHistory.length - 1];
  assert.ok(latestTx, "Transaction history should record the purchase");
  assert.equal(latestTx.currency, "cash");
  assert.equal(latestTx.amount, -4500000);
  assert.equal(latestTx.balanceAfter, 500000);

  // Verify premium coins cannot go negative
  const overspendCoins = economy.purchaseVehicle("veh_truck", 500000, 50, "premium_coins");
  assert.equal(overspendCoins.success, false, "Should block vehicle purchase when coins insufficient");
  assert.equal(economy.premiumCoins, 250, "Coins balance should remain untouched on failed transaction");
});

test("Test 2: Commercial Enterprise Progression & Revenue Scaling (Levels 1 to 3)", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  let playerCash = 6000000;

  // Buy Sabon Gari Electronics Stall
  const buyRes = economy.purchaseBusiness("sabon-gari-shop", playerCash);
  assert.equal(buyRes.success, true);
  playerCash -= buyRes.cost;

  const bizLvl1 = economy.businesses.get("sabon-gari-shop");
  assert.ok(bizLvl1);
  assert.equal(bizLvl1.level, 1);
  assert.equal(bizLvl1.dailyRevenue, 15000);
  assert.equal(bizLvl1.dailyCost, 5000);

  // Upgrade to Level 2 (Wholesale Accessories Distributor)
  const upRes1 = economy.upgradeBusiness("sabon-gari-shop", playerCash);
  assert.equal(upRes1.success, true);
  assert.equal(upRes1.newLevel, 2);
  playerCash -= upRes1.cost;

  const bizLvl2 = economy.businesses.get("sabon-gari-shop");
  assert.equal(bizLvl2?.level, 2);
  assert.equal(bizLvl2?.dailyRevenue, 35000);
  assert.equal(bizLvl2?.dailyCost, 10000);

  // Upgrade to Level 3 (Arewa Regional Tech Hub)
  const upRes2 = economy.upgradeBusiness("sabon-gari-shop", playerCash);
  assert.equal(upRes2.success, true);
  assert.equal(upRes2.newLevel, 3);
  playerCash -= upRes2.cost;

  const bizLvl3 = economy.businesses.get("sabon-gari-shop");
  assert.equal(bizLvl3?.level, 3);
  assert.equal(bizLvl3?.dailyRevenue, 75000);
  assert.equal(bizLvl3?.dailyCost, 20000);

  // Attempting beyond Level 3 should fail
  const upRes3 = economy.upgradeBusiness("sabon-gari-shop", playerCash);
  assert.equal(upRes3.success, false);
  assert.ok(upRes3.message.includes("maximum Level 3 flagship status"));

  // Check high-tier enterprise Dawanau Grain Depot
  const depotRes = economy.purchaseBusiness("dawanau-grain-depot", playerCash);
  assert.equal(depotRes.success, true);
  const depot = economy.businesses.get("dawanau-grain-depot");
  assert.equal(depot?.level, 1);
  assert.equal(depot?.dailyRevenue, 220000);
});

test("Test 3: Property Modernization & Equity Valuation", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  let playerCash = 1000000;

  // Set Unit 2B as rented
  const unit2b = economy.properties.get("unit-2b");
  assert.ok(unit2b);
  unit2b.isRented = true;
  assert.equal(unit2b.renovationLevel, 0);

  // Renovate Tier 1 using Street Cash
  const renRes1 = economy.renovateProperty("unit-2b", playerCash, economy.premiumCoins, false);
  assert.equal(renRes1.success, true);
  assert.equal(renRes1.newLevel, 1);
  assert.equal(renRes1.costCash, 350000);
  playerCash -= renRes1.costCash;

  const unit2bRen1 = economy.properties.get("unit-2b");
  assert.equal(unit2bRen1?.renovationLevel, 1);
  assert.ok(unit2bRen1?.renovationTitle?.includes("Solar Inverter"));
  assert.equal(unit2bRen1?.currentValuation, unit2b.purchasePrice + 1000000);

  // Renovate Tier 2 using Kano Gold Premium Coins
  const coinsBefore = economy.premiumCoins;
  const renRes2 = economy.renovateProperty("unit-2b", playerCash, economy.premiumCoins, true);
  assert.equal(renRes2.success, true);
  assert.equal(renRes2.newLevel, 2);
  assert.equal(renRes2.costCoins, 80);
  assert.equal(economy.premiumCoins, coinsBefore - 80);

  const unit2bRen2 = economy.properties.get("unit-2b");
  assert.equal(unit2bRen2?.renovationLevel, 2);
  assert.ok(unit2bRen2?.renovationTitle?.includes("Smart AC Suite"));
  assert.equal(unit2bRen2?.currentValuation, unit2b.purchasePrice + 2500000);
});

test("Test 4: Commercial Fleet Garage & Livery Uniqueness", () => {
  setupMockDOM();
  const economy = new EconomySystem();

  // Default owned vehicle is the starter sedan
  assert.ok(economy.ownedVehicles.has("veh_sedan"));
  assert.equal(economy.ownedVehicles.size, 1);

  // Purchase Keke NAPEP with cash
  const buyKeke = economy.purchaseVehicle("veh_keke", 450000, economy.premiumCoins, "cash");
  assert.equal(buyKeke.success, true);
  assert.ok(economy.ownedVehicles.has("veh_keke"));

  // Attempt duplicate purchase of same vehicle
  const dupKeke = economy.purchaseVehicle("veh_keke", 450000, economy.premiumCoins, "cash");
  assert.equal(dupKeke.success, false, "Should prevent duplicate vehicle purchases");

  // Purchase vehicle with premium coins
  const buyPickup = economy.purchaseVehicle("veh_pickup", 0, economy.premiumCoins, "premium_coins");
  assert.equal(buyPickup.success, true);
  assert.ok(economy.ownedVehicles.has("veh_pickup"));

  // Unlock custom livery skin with coins
  const skinRes = economy.purchaseVehicleSkin("skin_sedan_indigo", "veh_sedan", 50000, economy.premiumCoins, "premium_coins");
  assert.equal(skinRes.success, true);
  assert.ok(economy.unlockedVehicleSkins.has("skin_sedan_indigo"));

  // Duplicate skin purchase should be rejected
  const dupSkin = economy.purchaseVehicleSkin("skin_sedan_indigo", "veh_sedan", 50000, economy.premiumCoins, "premium_coins");
  assert.equal(dupSkin.success, false);
});

test("Test 5: Seasonal Harmattan Framework & Progression", () => {
  setupMockDOM();
  const economy = new EconomySystem();

  assert.equal(economy.seasonalProgress.activeSeasonId, ACTIVE_SEASON_CONFIG.id);
  assert.equal(economy.seasonalProgress.completedChallenges.length, 0);

  // Record progress for challenge: upgrade business
  economy.recordSeasonalProgress("harmattan_challenge_upgrade");
  assert.ok(economy.seasonalProgress.completedChallenges.includes("harmattan_challenge_upgrade"));

  // Claim challenge reward
  const claim1 = economy.claimSeasonalChallenge("harmattan_challenge_upgrade");
  assert.equal(claim1.success, true);
  assert.equal(claim1.rewardCoins, 50);
  assert.ok(economy.seasonalProgress.claimedRewards.includes("harmattan_challenge_upgrade"));

  // Prevent duplicate claim
  const dupClaim = economy.claimSeasonalChallenge("harmattan_challenge_upgrade");
  assert.equal(dupClaim.success, false, "Cannot double-claim a seasonal challenge");

  // Attempt milestone before all requirements met
  const earlyMilestone = economy.claimSeasonalMilestone();
  assert.equal(earlyMilestone.success, false, "Milestone blocked until challenge quota reached");

  // Complete remaining challenges to unlock milestone
  ACTIVE_SEASON_CONFIG.challenges.forEach((c) => {
    if (!economy.seasonalProgress.completedChallenges.includes(c.id)) {
      economy.seasonalProgress.completedChallenges.push(c.id);
    }
  });

  const milestoneRes = economy.claimSeasonalMilestone();
  assert.equal(milestoneRes.success, true);
  assert.ok(milestoneRes.rewardCoins > 0);
  assert.equal(economy.seasonalProgress.milestoneClaimed, true);

  // Prevent duplicate milestone claim
  const dupMilestone = economy.claimSeasonalMilestone();
  assert.equal(dupMilestone.success, false);
});

test("Test 6: Persistent Achievements & Legacy Prestige Scaling", () => {
  setupMockDOM();
  const economy = new EconomySystem();

  // Evaluate achievements with qualifying stats
  const unlocked = economy.checkAndUnlockAchievements({
    cash: 1500000,
    dayCount: 5,
    ownedBusinesses: ["sabon-gari-shop"],
    ownedProperties: ["unit-2b"],
    completedMissions: 5,
    maxBusinessLevel: 2,
    hasSolar: true,
  });

  assert.ok(unlocked.length > 0, "Qualifying criteria should unlock achievements");
  assert.ok(economy.achievements.get("ach_first_enterprise")?.isUnlocked);
  assert.ok(economy.achievements.get("ach_millionaire")?.isUnlocked);

  // Claim achievement
  const claimAch = economy.claimAchievement("ach_first_enterprise");
  assert.equal(claimAch.success, true);
  assert.ok(claimAch.rewardCash > 0);
  assert.ok(claimAch.rewardCoins > 0);
  assert.ok(economy.achievements.get("ach_first_enterprise")?.isClaimed);

  // Duplicate claim prevention
  const dupAch = economy.claimAchievement("ach_first_enterprise");
  assert.equal(dupAch.success, false);

  // Prestige points scaling
  assert.ok(economy.prestige.points >= 25);
  assert.ok(economy.getPrestigeTitle().length > 0);
});

test("Test 7: Legacy Save Migration & Non-Destructive Backup", () => {
  const fakeStore = setupMockDOM();

  // Emulate an old Milestone 14 save missing premiumCoins, achievements, and businessLevels
  const legacySave = {
    cash: 250000,
    trafficFine: 0,
    hasApartmentRental: true,
    dayCount: 4,
    ownedProperties: ["unit-2b"],
    ownedBusinesses: ["sabon-gari-shop"],
  };
  fakeStore.setItem("kano_streets_save_v1", JSON.stringify(legacySave));

  // Instantiate system and load
  const economy = new EconomySystem();
  const loaded = economy.loadFromStorage();
  assert.ok(loaded, "Legacy save should load successfully");

  // Verify non-destructive backup was created
  assert.ok(fakeStore.getItem("kano_streets_save_v1_backup"), "Safe backup must be created before migration");

  // Verify safe defaults populated
  assert.equal(economy.premiumCoins, 250, "Legacy save should receive safe default of 250 test coins");
  assert.equal(economy.businessLevels.get("sabon-gari-shop"), 1, "Default level 1 assigned to owned business");
  assert.ok(economy.ownedVehicles.has("veh_sedan"), "Starter sedan assigned to garage fleet");
  assert.equal(economy.prestige.level, 1, "Default prestige initialized to Level 1");

  // Save updated state and reload to verify idempotence
  economy.saveToStorage(loaded.cash, loaded.trafficFine, loaded.hasApartmentRental);
  const reloaded = economy.loadFromStorage();
  assert.ok(reloaded);
  assert.equal(reloaded.premiumCoins, 250);
});

test("Test 8: GameEngine Empire Integration & [K] Key Shortcut", () => {
  setupMockDOM();
  let latestSnapshot: GameSnapshot | null = null;
  const canvas = (globalThis as any).document.createElement("canvas");

  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (snap) => {
        latestSnapshot = snap;
      },
      onPause: () => {},
    },
    createMockRendererFactory() as any,
  );

  engine.setScreen("playing");
  assert.ok(latestSnapshot, "Snapshot should be received");
  assert.equal((latestSnapshot as GameSnapshot).premiumCoins, 250);
  assert.equal((latestSnapshot as GameSnapshot).isEmpireModalOpen, false);
  assert.ok((latestSnapshot as GameSnapshot).empireOverview);

  // Toggle modal via method
  const isOpen = engine.toggleEmpireModal(true);
  assert.equal(isOpen, true);
  assert.equal((latestSnapshot as GameSnapshot).isEmpireModalOpen, true);

  // Toggle via key 'k'
  engine.setControlKey("k", true);
  assert.equal((latestSnapshot as GameSnapshot).isEmpireModalOpen, false);

  // Test engine upgrade hook
  const bizUpRes = engine.upgradeBusiness("sabon-gari-shop");
  assert.ok(bizUpRes);

  engine.dispose();
});
