import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { EconomySystem } from "./economySystem";
import { LifeSimulationSystem } from "./lifeSimulation";
import { FreelanceSystem, FREELANCE_CONTRACT_CATALOG } from "./freelanceSystem";
import { getPropertyRegistryEntry } from "./propertyRegistry";
import { getGpsLandmark } from "./landmarks";
import { GameEngine } from "./GameEngine";
import type { GameSnapshot } from "./types";

function setupMockDOM() {
  if (typeof globalThis.document === "undefined") {
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
      measureText: (text: string) => ({ width: text.length * 10, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }),
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
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    };

    (globalThis as any).document = fakeDocument;
    (globalThis as any).window = fakeWindow;
    (globalThis as any).ResizeObserver = FakeResizeObserver;
    (globalThis as any).requestAnimationFrame = () => 1;
    (globalThis as any).cancelAnimationFrame = () => {};
  }
}

test("Milestone 10: My Home Selection, Auto-Suggest & Save Persistence", () => {
  const economy = new EconomySystem();

  // Initially player owns/leases nothing
  assert.equal(economy.selectedHomePropertyId, null, "Default selected home is null");
  assert.equal(economy.resolveSelectedHome(false), null, "Cannot resolve home when none owned");

  // Player leases Unit 2B (Airport View Apartments)
  const unit2b = economy.properties.get("unit-2b");
  assert.ok(unit2b);
  unit2b.isRented = true;

  // Single eligible residence -> auto-suggest/set to unit-2b without manual intervention
  const autoHome = economy.resolveSelectedHome(true);
  assert.equal(autoHome, "unit-2b", "Auto-selects Unit 2B when it is the sole leased residence");
  assert.equal(economy.selectedHomePropertyId, "unit-2b");

  // Player purchases Bompai Penthouse
  const pentPurchase = economy.purchaseProperty("bompai-penthouse", 40_000_000);
  assert.ok(pentPurchase.success);

  // Player now has 2 eligible homes; existing choice should NOT be overwritten
  assert.equal(economy.resolveSelectedHome(true), "unit-2b", "Preserves existing valid selection");

  // Player explicitly switches home to Bompai Penthouse
  const setPent = economy.setSelectedHome("bompai-penthouse", true);
  assert.ok(setPent.success);
  assert.equal(economy.selectedHomePropertyId, "bompai-penthouse");

  // Attempting to set unowned Al-Baraka Villa as home should fail
  const setVillaUnowned = economy.setSelectedHome("albaraka-villa", true);
  assert.equal(setVillaUnowned.success, false, "Must reject unowned property as home");
  assert.equal(economy.selectedHomePropertyId, "bompai-penthouse", "Home selection unchanged after rejected attempt");

  // Mock localStorage for save/load verification
  const storageMap: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storageMap[k] ?? null,
      setItem: (k: string, v: string) => {
        storageMap[k] = v;
      },
    },
  };

  const saved = economy.saveToStorage(
    250_000,
    0,
    true,
    [],
    0,
    undefined,
    "clear",
    false,
    economy.selectedHomePropertyId,
  );
  assert.ok(saved, "Save must succeed");

  // Create fresh economy instance and reload
  const reloadedEconomy = new EconomySystem();
  const loadedData = reloadedEconomy.loadFromStorage();
  assert.ok(loadedData, "Save data loaded successfully");
  assert.equal(reloadedEconomy.selectedHomePropertyId, "bompai-penthouse", "Home selection survives reload");
});

test("Milestone 10: Find My Home GPS Points to Exact Entrance (Not Building Center)", () => {
  // Test Unit 2B coordinates
  const unit2bReg = getPropertyRegistryEntry("unit-2b");
  assert.ok(unit2bReg);
  // Building center is (48, -50), but entrance door is (48, -43.5)
  assert.deepEqual(unit2bReg.exteriorCoords, { x: 48, z: -50 }, "Exterior building center");
  assert.equal(unit2bReg.entranceDoor.x, 48);
  assert.equal(unit2bReg.entranceDoor.z, -43.5, "Unit 2B entrance door is at z = -43.5");

  // Test Penthouse coordinates
  const pentReg = getPropertyRegistryEntry("bompai-penthouse");
  assert.ok(pentReg);
  // Building center is (18, 42), entrance door is (18, 39.5)
  assert.deepEqual(pentReg.exteriorCoords, { x: 18, z: 42 });
  assert.equal(pentReg.entranceDoor.x, 18);
  assert.equal(pentReg.entranceDoor.z, 39.5, "Penthouse entrance door is at z = 39.5");

  // Test Villa coordinates
  const villaReg = getPropertyRegistryEntry("albaraka-villa");
  assert.ok(villaReg);
  // Building center is (44, 39), entrance door is (44, 45)
  assert.deepEqual(villaReg.exteriorCoords, { x: 44, z: 39 });
  assert.equal(villaReg.entranceDoor.x, 44);
  assert.equal(villaReg.entranceDoor.z, 45, "Villa entrance door is at z = 45");

  // Verify getGpsLandmark resolves 'my-home' using homeNavInfo entrance
  const mockHomeNav = {
    propertyId: "unit-2b" as const,
    name: "Airport View Apartments · Unit 2B",
    district: "AIRPORT ROAD",
    distanceMeters: 45,
    entranceCoords: { x: 48, z: -43.5 },
    isInsideHome: false,
  };

  const resolvedLm = getGpsLandmark("my-home", mockHomeNav);
  assert.ok(resolvedLm);
  assert.equal(resolvedLm.id, "my-home");
  assert.equal(resolvedLm.x, 48);
  assert.equal(resolvedLm.z, -43.5, "GPS waypoint routes to exact entrance, NOT building center (-50)");
  assert.ok(resolvedLm.name.includes("My Home"));
});

test("Milestone 10: Teleport Home Fast-Travel & Strict Access Control", () => {
  setupMockDOM();
  const renderer = {
    pixelRatio: 1,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
  } as unknown as THREE.WebGLRenderer;

  let latestSnapshot!: GameSnapshot;
  const canvas = (globalThis as any).document.createElement("canvas");
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (snap) => {
        latestSnapshot = snap;
      },
      onPause: () => {},
    },
    () => renderer,
  );

  // 1. When player owns no property: Teleport Home is STRICTLY blocked
  const failedTeleport = engine.teleportHome("entrance");
  assert.equal(failedTeleport.success, false, "Must block teleport when no home is set");
  assert.ok(failedTeleport.message.includes("Cannot Teleport"));

  // 2. Lease Unit 2B
  (engine as any).cash = 100_000;
  (engine as any).hasApartmentRental = true;
  const prop = engine.economy.properties.get("unit-2b");
  if (prop) prop.isRented = true;
  engine.economy.resolveSelectedHome(true);
  assert.equal(engine.economy.selectedHomePropertyId, "unit-2b");

  // Move player far away to Old Kano (-80, -80)
  (engine as any).playerPosition.set(-80, 0, -80);
  const homeNav = engine.getHomeNavInfo();
  assert.ok(homeNav);
  assert.equal(homeNav.propertyId, "unit-2b");
  assert.equal(homeNav.entranceCoords.x, 48);
  assert.equal(homeNav.entranceCoords.z, -43.5);
  assert.ok(homeNav.distanceMeters > 100);

  // 3. Teleport to entrance
  const teleportEntrance = engine.teleportHome("entrance");
  assert.ok(teleportEntrance.success, "Teleport to entrance succeeded");
  const playerPos = (engine as any).playerPosition;
  assert.equal(playerPos.x, 48, "Placed at entrance X");
  assert.equal(playerPos.z, -43.5, "Placed at entrance Z");

  // 4. Teleport inside interior
  const teleportInterior = engine.teleportHome("interior");
  assert.ok(teleportInterior.success, "Teleport inside succeeded");
  assert.equal(latestSnapshot.activeInterior, "apartment", "Active interior is apartment");

  engine.dispose();
});

test("Milestone 10: Life Simulation Needs Decay, Food & Sleep Replenishment", () => {
  const lifeSim = new LifeSimulationSystem();

  // Baseline values
  assert.equal(lifeSim.hunger, 85);
  assert.equal(lifeSim.energy, 90);
  assert.equal(lifeSim.hygiene, 85);

  // Initial speed multiplier is well-nourished bonus or normal
  assert.equal(lifeSim.getSpeedMultiplier(), 1.05);

  // Simulate 120 seconds of walking outdoors (approx 2 in-game hours)
  lifeSim.update(120, false, false, false);
  assert.ok(lifeSim.hunger < 85, "Hunger decays over time");
  assert.ok(lifeSim.energy < 90, "Energy decays over time");
  assert.ok(lifeSim.hygiene < 85, "Hygiene decays over time");

  // Simulate heavy sprinting: energy burns faster
  const energyBeforeSprint = lifeSim.energy;
  lifeSim.update(60, true, false, false);
  const energyDecaySprint = energyBeforeSprint - lifeSim.energy;

  const energyBeforeWalk = lifeSim.energy;
  lifeSim.update(60, false, false, false);
  const energyDecayWalk = energyBeforeWalk - lifeSim.energy;

  assert.ok(energyDecaySprint > energyDecayWalk, "Sprinting burns energy faster than walking");

  // Test Non-Punitive Speed Penalty when exhausted
  lifeSim.energy = 15;
  assert.equal(lifeSim.getSpeedMultiplier(), 0.85, "Gentle 15% speed penalty when energy < 20%");
  assert.ok(lifeSim.getStatusPrompt()?.includes("Fatigued"));

  // Test Sleep in Bed: restores energy to 100%
  const sleepRes = lifeSim.sleep(6);
  assert.ok(sleepRes.success);
  assert.equal(lifeSim.energy, 100, "Sleep fully restores energy to 100%");

  // Test Food: Eat Kano Suya restores hunger
  lifeSim.hunger = 40;
  const eatRes = lifeSim.eatFood(45, "Kano Suya Platter");
  assert.ok(eatRes.success);
  assert.equal(lifeSim.hunger, 85, "Food restores hunger (+45)");

  // Test Shower: restores hygiene to 100%
  lifeSim.hygiene = 30;
  const showerRes = lifeSim.shower("Ensuite Shower");
  assert.ok(showerRes.success);
  assert.equal(lifeSim.hygiene, 100, "Shower restores hygiene to 100%");
});

test("Milestone 10: Finite Remote Freelance Contracts & Anti-Farming Protection", () => {
  const freelance = new FreelanceSystem();

  // Catalog has 8 authentic Kano contracts
  assert.equal(FREELANCE_CONTRACT_CATALOG.length, 8);
  assert.equal(freelance.getAvailableContracts().length, 8);

  const firstContract = freelance.getNextAvailableContract();
  assert.ok(firstContract);
  assert.equal(firstContract.id, "freelance_dawanau_inventory");
  assert.equal(firstContract.payout, 45_000);

  // Complete first contract
  const res1 = freelance.completeContract("freelance_dawanau_inventory");
  assert.ok(res1.success);
  assert.equal(res1.payout, 45_000);
  assert.equal(freelance.totalEarnings, 45_000);
  assert.equal(freelance.getCompletedContracts().length, 1);
  assert.equal(freelance.getAvailableContracts().length, 7);

  // STRICT Anti-Farming Guarantee: Attempting to repeat completed contract must be rejected
  const repeatRes = freelance.completeContract("freelance_dawanau_inventory");
  assert.equal(repeatRes.success, false, "Must block repeat payout on completed contract");
  assert.equal(repeatRes.payout, 0);
  assert.equal(freelance.totalEarnings, 45_000, "Total earnings must not inflate from repeat attempt");
  assert.ok(repeatRes.message.includes("Repeat payout strictly blocked"));

  // Complete second contract
  const res2 = freelance.completeContract("freelance_kaduna_freight");
  assert.ok(res2.success);
  assert.equal(res2.payout, 60_000);
  assert.equal(freelance.totalEarnings, 105_000);

  // Persistence across save and load
  const completedIds = freelance.getCompletedIds();
  const reloadedFreelance = new FreelanceSystem();
  reloadedFreelance.loadSnapshot(completedIds, freelance.totalEarnings);
  assert.equal(reloadedFreelance.totalEarnings, 105_000);
  assert.equal(reloadedFreelance.getAvailableContracts().length, 6);
  assert.ok(reloadedFreelance.isContractCompleted("freelance_dawanau_inventory"));
  assert.ok(reloadedFreelance.isContractCompleted("freelance_kaduna_freight"));
});

test("Milestone 10: Save/Load Schema Backward Compatibility with Legacy Saves", () => {
  const economy = new EconomySystem();
  const storageMap: Record<string, string> = {};

  // Mock a legacy Milestone 9 save without Milestone 10 fields (no selectedHomePropertyId, needs, freelance)
  const legacySaveData = {
    version: 1,
    cash: 500_000,
    trafficFine: 0,
    hasApartmentRental: true,
    ownedProperties: ["unit-2b"],
    ownedBusinesses: ["sabon-gari-shop"],
    dayCount: 5,
    vehicleUpgrade: { engineStage: 1, paintColor: "#10b981", suspensionUpgraded: false },
    savedAt: Date.now() - 100_000,
  };
  storageMap["kano_streets_save_v1"] = JSON.stringify(legacySaveData);

  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storageMap[k] ?? null,
      setItem: (k: string, v: string) => {
        storageMap[k] = v;
      },
    },
  };

  const loaded = economy.loadFromStorage();
  assert.ok(loaded, "Legacy save loads without error");
  assert.equal(loaded.cash, 500_000);
  assert.equal(loaded.dayCount, 5);

  // Auto-resolves home gracefully from legacy owned properties
  const resolvedHome = economy.resolveSelectedHome(true);
  assert.equal(resolvedHome, "unit-2b", "Auto-resolves Unit 2B for legacy save with apartment rental");

  // Needs system initializes with default healthy values when missing in legacy save
  const lifeSim = new LifeSimulationSystem(loaded.needs);
  assert.equal(lifeSim.hunger, 85);
  assert.equal(lifeSim.energy, 90);
  assert.equal(lifeSim.hygiene, 85);

  // Freelance system initializes with empty roster and zero earnings
  const freelance = new FreelanceSystem(loaded.completedFreelanceContracts, loaded.freelanceEarnings);
  assert.equal(freelance.totalEarnings, 0);
  assert.equal(freelance.getAvailableContracts().length, 8);
});
