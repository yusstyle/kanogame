import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BuildingInteriorManager } from "./BuildingInteriors";
import { LifeSimulationSystem } from "./lifeSimulation";
import { EconomySystem } from "./economySystem";
import { GameEngine } from "./GameEngine";
import { createMaterials } from "./materials";
import { PROPERTY_REGISTRY } from "./propertyRegistry";
import { ColliderIndex } from "./ColliderIndex";
import { buildNavigationNetwork } from "./navigation";
import { PedestrianSystem } from "./PedestrianSystem";
import { buildFurnitureMesh } from "./furnitureRenderer";
import type { FurnitureInstance } from "./types";

// ============================================================================
// Setup Mock DOM Environment for Headless Node.js Tests
// ============================================================================
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

  return { store };
}

function createMockRenderer(): THREE.WebGLRenderer {
  return {
    pixelRatio: 1,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
  } as unknown as THREE.WebGLRenderer;
}

setupMockDOM();

// ============================================================================
// Test Suite: Kano Streets Milestone 12 - Immersive Life & Realistic Interiors
// ============================================================================

test("1. Enterable Homes: Interior zones for Unit 2B, Penthouse, and Villa exist with valid spawn and exit points", () => {
  const materials = createMaterials();
  const interiorManager = new BuildingInteriorManager(materials);

  const residentialIds = ["apartment", "penthouse", "house"] as const;
  for (const id of residentialIds) {
    const zone = interiorManager.interiors.get(id);
    assert.ok(zone, `Interior zone '${id}' must be registered`);
    assert.ok(zone.name.length > 0, `Interior zone '${id}' must have a descriptive name`);
    assert.ok(zone.districtLabel.length > 0, `Interior zone '${id}' must have a district label`);

    // Verify spawn point is inside underground interior realm (y <= -50)
    assert.ok(zone.spawnPoint.y <= -50, `Spawn point y (${zone.spawnPoint.y}) must be situated in interior coordinates`);
    assert.ok(zone.exitPoint.y <= -50, `Exit point y (${zone.exitPoint.y}) must be situated in interior coordinates`);

    // Verify outdoor door position is grounded at street level (y >= -1 && y <= 5)
    assert.ok(
      zone.outdoorDoorPosition.y >= -1 && zone.outdoorDoorPosition.y <= 10,
      `Outdoor door position y (${zone.outdoorDoorPosition.y}) must be at ground street level`,
    );

    // Verify colliders are generated for the interior
    assert.ok(zone.colliders.length >= 8, `Interior zone '${id}' must have wall/partition colliders (found ${zone.colliders.length})`);

    // Verify lights exist for residential interiors
    assert.ok(zone.lights && zone.lights.length >= 3, `Interior zone '${id}' must feature multi-room lighting`);
  }
});

test("2. Doorways & Clearances: Interactive doors open and close, clearing passageways", () => {
  const materials = createMaterials();
  const interiorManager = new BuildingInteriorManager(materials);

  // We should have interactive doors in apartment, penthouse, and house
  const doors = interiorManager.interactiveDoors;
  assert.ok(doors.length >= 3, `Expected at least 3 interactive room doors, found ${doors.length}`);

  const aptDoor = doors.find((d) => d.interiorId === "apartment");
  assert.ok(aptDoor, "Expected at least one interactive door in Unit 2B apartment");

  // Initial state: closed, collider at active door position
  assert.equal(aptDoor.isOpen, false, "Door should start closed");
  const closedX = aptDoor.position.x;
  assert.equal(aptDoor.collider.x, closedX, "Closed door collider must match door position");

  // Toggle open
  const openRes = interiorManager.toggleDoor(aptDoor.id);
  assert.equal(openRes.success, true);
  assert.equal(aptDoor.isOpen, true, "Door state should be open");
  assert.equal(aptDoor.collider.x, 9999, "Open door must move collider out of doorway to allow free passage");

  // Toggle closed
  const closeRes = interiorManager.toggleDoor(aptDoor.id);
  assert.equal(closeRes.success, true);
  assert.equal(aptDoor.isOpen, false, "Door state should be closed");
  assert.equal(aptDoor.collider.x, closedX, "Closed door must restore collider to block doorway");
});

test("3. Light Switch Control: Residential lighting switches toggle dimming", () => {
  const materials = createMaterials();
  const interiorManager = new BuildingInteriorManager(materials);

  const zone = interiorManager.interiors.get("apartment");
  assert.ok(zone && zone.lights);
  const initialIntensity = zone.lights[0].intensity;
  assert.ok(initialIntensity > 0, "Light must have positive initial intensity");

  // Toggle lights off/dimmed
  const stateAfterToggle = interiorManager.toggleInteriorLights("apartment");
  assert.equal(stateAfterToggle, false, "Lights should now be off/dimmed");
  assert.ok(
    zone.lights[0].intensity < initialIntensity,
    `Toggled light intensity (${zone.lights[0].intensity}) should be dimmed compared to full (${initialIntensity})`,
  );

  // Toggle lights back on
  const stateAfterSecondToggle = interiorManager.toggleInteriorLights("apartment");
  assert.equal(stateAfterSecondToggle, true, "Lights should now be restored to full brightness");
  assert.equal(zone.lights[0].intensity, initialIntensity, "Restored intensity should match full initial brightness");
});

test("4. Penthouse Multi-Storey Architecture: Grand Staircase height progression", () => {
  const materials = createMaterials();
  const interiorManager = new BuildingInteriorManager(materials);

  // Floor 1 (y = -59.9) at bottom of stairs (relX = 0, relZ = 0.8 => worldX = 300, worldZ = 80.8)
  const floor1H = interiorManager.getSurfaceHeight("penthouse", 300, 80.8);
  assert.ok(Math.abs(floor1H - (-59.9)) < 0.2, `Floor 1 height should be ~ -59.9m, got ${floor1H}`);

  // Midway up the grand staircase (relX = 0, relZ = 3.2 => worldX = 300, worldZ = 83.2)
  const midStairH = interiorManager.getSurfaceHeight("penthouse", 300, 83.2);
  assert.ok(midStairH > floor1H, `Mid staircase height (${midStairH}) must be higher than Floor 1 (${floor1H})`);

  // Floor 2 Mezzanine Gallery & Master Penthouse Suite (relX = 0, relZ = 5.6 => worldX = 300, worldZ = 85.6)
  const floor2H = interiorManager.getSurfaceHeight("penthouse", 300, 85.6);
  assert.ok(floor2H > -57.0, `Floor 2 height (${floor2H}) should be elevated at Floor 2 elevation (~ -56.5m)`);
});

test("5. Life Simulation: Sitting, Watching TV, Washing Hands, and Drinking Beverages", () => {
  const lifeSim = new LifeSimulationSystem({
    hunger: 50,
    energy: 50,
    hygiene: 50,
  });

  // 1. Sit and rest (+20% energy)
  const sitRes = lifeSim.sitAndRest("Sectional Sofa", 20);
  assert.equal(sitRes.success, true);
  assert.equal(sitRes.energyGained, 20);
  assert.equal(lifeSim.energy, 70);

  // 2. Watch TV (+15% energy)
  const tvRes = lifeSim.watchTelevision("Arewa24 Smart TV", 15);
  assert.equal(tvRes.success, true);
  assert.equal(tvRes.energyGained, 15);
  assert.equal(lifeSim.energy, 85);

  // 3. Wash hands (+35% hygiene)
  const washRes = lifeSim.washHands("Bathroom Vanity Sink", 35);
  assert.equal(washRes.success, true);
  assert.equal(washRes.hygieneGained, 35);
  assert.equal(lifeSim.hygiene, 85);

  // 4. Drink beverage (+25% hunger, +10% energy)
  const drinkRes = lifeSim.drinkBeverage("Chilled Zobo", 25, 10);
  assert.equal(drinkRes.success, true);
  assert.equal(lifeSim.hunger, 75);
  assert.equal(lifeSim.energy, 95);

  // 5. Shower (100% hygiene)
  const showerRes = lifeSim.shower("Rain Shower");
  assert.equal(showerRes.success, true);
  assert.equal(lifeSim.hygiene, 100);

  // 6. Sleep in bed (100% energy)
  lifeSim.energy = 20;
  const sleepRes = lifeSim.sleep(8);
  assert.equal(sleepRes.success, true);
  assert.equal(lifeSim.energy, 100);
});

test("6. Life Simulation Dynamics: Decay rates, physical exertion & speed multipliers", () => {
  const lifeSim = new LifeSimulationSystem({
    hunger: 100,
    energy: 100,
    hygiene: 100,
  });

  // High stats give bonus speed multiplier
  assert.equal(lifeSim.getSpeedMultiplier(), 1.05, "Well-nourished player should have 1.05x speed multiplier");

  // Exertion test: update 60 seconds of running outdoors
  lifeSim.update(60, true, false, false);
  assert.ok(lifeSim.energy < 100, "Running should deplete energy");
  assert.ok(lifeSim.hunger < 100, "Hunger should deplete over time");
  assert.ok(lifeSim.hygiene < 100, "Outdoor dust should deplete hygiene");

  // Low stats give gentle penalty
  lifeSim.energy = 15;
  assert.equal(lifeSim.getSpeedMultiplier(), 0.85, "Fatigued player should have gentle 0.85x speed multiplier");
});

test("7. Full GameEngine Integration: Entering Unit 2B, Seating avatar pose, and Station Interaction", () => {
  (globalThis as any).window.localStorage.clear();
  const container = (globalThis as any).document.createElement("canvas");
  let lastSnapshot: any = null;

  const engine = new GameEngine(
    container,
    {
      onSnapshot: (s) => {
        lastSnapshot = s;
      },
      onShowMap: () => {},
    },
    createMockRenderer,
  );

  // Give player cash and lease Unit 2B
  (engine as any).cash = 200000;
  const leaseRes = engine.leaseProperty("unit-2b");
  assert.equal(leaseRes.success, true);

  // Teleport player inside Unit 2B
  const travelRes = engine.teleportHome("interior");
  assert.equal(travelRes.success, true);
  assert.equal((engine as any).interiorManager.activeInterior, "apartment");

  // Move player to Living Room Sofa at (cx - 3.4, cy + 0.1, cz - 0.6) => (256.6, -60, -0.6)
  (engine as any).playerPosition.set(256.6, -60, -0.6);
  (engine as any).lifeSim.energy = 50;

  // Simulate pressing 'E' to interact
  (engine as any).handleInteract();

  // Verify player is now seated and energy refreshed
  assert.equal((engine as any).isSeated, true, "Player should be in seated state after interacting with sofa");
  assert.ok((engine as any).lifeSim.energy >= 70, "Energy should have increased from resting on sofa");

  // Simulate movement key 'w' which should immediately unseat the player
  engine.setControlKey("w", true);
  assert.equal((engine as any).isSeated, false, "Moving forward should automatically stand the player up");
  engine.setControlKey("w", false);

  // Move to in front of Smart TV at (cx - 3.4, cy + 0.1, cz - 1.5) => (256.6, -60, -1.5)
  (engine as any).playerPosition.set(256.6, -60, -1.5);
  (engine as any).handleInteract();
  assert.equal((engine as any).isSeated, true, "Player should be seated while watching TV");

  // Stand up again
  engine.setControlKey("s", true);
  assert.equal((engine as any).isSeated, false);
  engine.setControlKey("s", false);

  // Move to bathroom vanity sink at (cx + 3.2, cy + 0.1, cz + 5.0) => (263.2, -60, 5.0) to wash hands
  (engine as any).playerPosition.set(263.2, -60, 5.0);
  (engine as any).lifeSim.hygiene = 40;
  (engine as any).handleInteract();
  assert.ok((engine as any).lifeSim.hygiene >= 75, "Washing hands at vanity sink should restore hygiene");

  // Move to bedroom bed at (cx - 4.2, cy + 0.1, cz + 3.8) => (255.8, -60, 3.8) to sleep
  (engine as any).playerPosition.set(255.8, -60, 3.8);
  (engine as any).lifeSim.energy = 30;
  (engine as any).handleInteract();
  assert.equal((engine as any).lifeSim.energy, 100, "Sleeping in queen bed should restore energy to 100%");

  // Move to study workstation at (cx + 2.0, cy + 0.1, cz - 3.4) => (262.0, -60, -3.4) to execute freelance contract
  (engine as any).playerPosition.set(262.0, -60, -3.4);
  const initialCash = (engine as any).cash;
  (engine as any).handleInteract();
  assert.ok((engine as any).cash > initialCash, "Completing freelance contract should award payment in Naira");

  // Move to exit door at (cx, cy + 0.1, cz + depth / 2 - 1.1) => (260, -60, 4.9) and exit
  (engine as any).playerPosition.set(260, -60, 4.9);
  (engine as any).handleInteract();
  assert.equal((engine as any).interiorManager.activeInterior, null, "Player should be back outdoors in Kano city");

  engine.dispose();
});

test("8. Persistence & Backward Compatibility: kano_streets_save_v1 preserves all state", () => {
  (globalThis as any).window.localStorage.clear();
  const container = (globalThis as any).document.createElement("canvas");
  const engine1 = new GameEngine(
    container,
    {
      onSnapshot: () => {},
      onShowMap: () => {},
    },
    createMockRenderer,
  );

  // Lease Unit 2B, purchase Bompai Penthouse, customize needs
  (engine1 as any).cash = 50000000;
  const leaseRes = engine1.leaseProperty("unit-2b");
  assert.equal(leaseRes.success, true);
  const buyPenthouseRes = engine1.purchaseProperty("bompai-penthouse");
  assert.equal(buyPenthouseRes.success, true);
  (engine1 as any).lifeSim.hunger = 72;
  (engine1 as any).lifeSim.energy = 84;
  (engine1 as any).lifeSim.hygiene = 91;

  // Purchase furniture item and place it
  const buyRes = engine1.purchaseFurniture("sofa_sectional_fabric");
  assert.equal(buyRes.success, true);
  const unplaced = engine1.getUnplacedFurniture();
  assert.ok(unplaced.length > 0, "Should have purchased furniture in inventory");
  const itemToPlace = unplaced[0];

  const placeRes = (engine1 as any).economy.placeFurniture(
    itemToPlace.instanceId,
    "bompai-penthouse",
    1,
    "Double-Height Living Salon",
    { x: 300, y: -60, z: 80 },
    0,
  );
  assert.equal(placeRes.success, true);

  // Save game
  engine1.saveGame();
  engine1.dispose();

  // Instantiate second engine instance (simulating page reload)
  const engine2 = new GameEngine(
    container,
    {
      onSnapshot: () => {},
      onShowMap: () => {},
    },
    createMockRenderer,
  );

  // Verify restored properties
  const homes = engine2.getPlayerHomes();
  assert.ok(homes.some((h) => h.propertyId === "unit-2b"), "Unit 2B lease must be preserved on reload");
  assert.ok(homes.some((h) => h.propertyId === "bompai-penthouse"), "Bompai Penthouse ownership must be preserved on reload");

  // Verify placed furniture restored
  const placedPenthouse = engine2.getPlacedFurniture("bompai-penthouse");
  assert.equal(placedPenthouse.length, 1, "Placed furniture in Bompai Penthouse must persist across reloads");
  assert.equal(placedPenthouse[0].catalogId, "sofa_sectional_fabric");

  // Verify life simulation needs restored
  const snapshotNeeds = (engine2 as any).lifeSim.getSnapshot();
  assert.equal(snapshotNeeds.hunger, 72);
  assert.equal(snapshotNeeds.energy, 84);
  assert.equal(snapshotNeeds.hygiene, 91);

  engine2.dispose();
});

test("9. NPC Routines, Collision Avoidance & Grounding: Pedestrian System Verification", () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  // Add terrain surface height variation
  const surfaceHeight = (x: number, z: number) => {
    return Math.sin(x * 0.05) * 0.2;
  };

  const pedestrianSystem = new PedestrianSystem(scene, materials, network, colliderIndex, surfaceHeight);

  // Check pedestrians count
  assert.ok(pedestrianSystem.pedestrians.length > 0, "Pedestrians must be spawned");

  // Verify every pedestrian is grounded and has valid routine
  for (const p of pedestrianSystem.pedestrians) {
    assert.ok(p.name.length > 0, "Pedestrian must have a name");
    assert.ok(p.role.length > 0, "Pedestrian must have an assigned role");
    assert.ok(p.dialogues.length > 0, "Pedestrian must have authentic dialogues");

    // Verify grounding
    const expectedGround = surfaceHeight(p.position.x, p.position.z);
    if (p.state === "sitting") {
      // Sitting elders are elevated on dakali ledge (+0.35m)
      assert.ok(
        Math.abs(p.position.y - (expectedGround + 0.35)) < 0.1,
        `Seated elder ${p.name} must be resting on Dakali ledge elevation`,
      );
    } else {
      assert.ok(
        Math.abs(p.position.y - expectedGround) < 0.1,
        `Pedestrian ${p.name} must be grounded at surface height`,
      );
    }

    // Verify no static collision at spawn point
    const collisions = colliderIndex.query(p.position.x, p.position.z, 0.4);
    assert.equal(collisions.length, 0, `Pedestrian ${p.name} must not spawn intersecting static colliders`);
  }

  // Verify time of day schedule updates
  const walkers = pedestrianSystem.pedestrians.filter((p) => p.state === "walking");
  assert.ok(walkers.length > 0, "Expected walking pedestrians");

  const walker = walkers[0];
  pedestrianSystem.setTimeOfDay(8); // Commute rush
  // Run a couple frames with player near walker so LOD doesn't skip
  for (let f = 0; f < 5; f++) {
    pedestrianSystem.update(0.1, walker.position, null);
  }
  assert.equal(walker.schedulePhase, "commute", "Morning time should set schedulePhase to commute");

  pedestrianSystem.setTimeOfDay(22); // Rest hours
  for (let f = 0; f < 5; f++) {
    pedestrianSystem.update(0.1, walker.position, null);
  }
  assert.equal(walker.schedulePhase, "rest", "Late night time should set schedulePhase to rest");

  pedestrianSystem.dispose();
});
