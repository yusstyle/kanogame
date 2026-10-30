import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  FURNITURE_CATALOGUE,
  getFurnitureCatalogItem,
  getCatalogItemsByCategory,
  isFurnitureCompatibleWithRoom,
} from "./furnitureCatalogue";
import { EconomySystem } from "./economySystem";
import { BuildingInteriorManager } from "./BuildingInteriors";
import { buildFurnitureMesh } from "./furnitureRenderer";
import { createMaterials } from "./materials";
import { KANO_LANDMARKS, getNearestLandmark } from "./landmarks";
import type { FurnitureInstance } from "./types";

// Setup Mock DOM for canvas texture generation in Node.js test environment
const fakeContext = {
  fillStyle: "",
  globalAlpha: 1,
  font: "12px sans-serif",
  textAlign: "center",
  textBaseline: "middle",
  fillRect() {},
  strokeRect() {},
  clearRect() {},
  fillText() {},
  measureText() {
    return { width: 100, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 };
  },
  drawImage() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {},
  arc() {},
  fill() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  createRadialGradient() {
    return { addColorStop() {} };
  },
};
const fakeDocument = {
  pointerLockElement: null as HTMLCanvasElement | null,
  createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext }),
  addEventListener() {},
  removeEventListener() {},
  exitPointerLock() {
    this.pointerLockElement = null;
  },
};
const fakeStorageMap = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (key: string) => fakeStorageMap.get(key) ?? null,
  setItem: (key: string, val: string) => fakeStorageMap.set(key, String(val)),
  removeItem: (key: string) => fakeStorageMap.delete(key),
  clear: () => fakeStorageMap.clear(),
};
const fakeWindow = {
  devicePixelRatio: 1.5,
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  removeEventListener() {},
  localStorage: fakeLocalStorage,
};
Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: fakeLocalStorage });

test("Milestone 9: Furniture Catalogue Structure & Pricing Balance", () => {
  assert.ok(FURNITURE_CATALOGUE.length >= 30, `Expected at least 30 items, got ${FURNITURE_CATALOGUE.length}`);

  const categories = new Set(FURNITURE_CATALOGUE.map((i) => i.category));
  assert.ok(categories.has("living"), "Includes living room category");
  assert.ok(categories.has("bedroom"), "Includes bedroom category");
  assert.ok(categories.has("kitchen"), "Includes kitchen category");
  assert.ok(categories.has("study"), "Includes study/office category");
  assert.ok(categories.has("decor"), "Includes decor & lighting category");

  for (const item of FURNITURE_CATALOGUE) {
    assert.ok(item.id.length > 0, "Item has non-empty ID");
    assert.ok(item.name.length > 0, "Item has non-empty name");
    assert.ok(item.price >= 20_000, `Item ${item.id} price (₦${item.price}) meets realistic minimum`);
    assert.ok(item.price <= 2_000_000, `Item ${item.id} price (₦${item.price}) within balanced range`);
    assert.ok(item.dimensions.width > 0, `Item ${item.id} has positive width`);
    assert.ok(item.dimensions.depth > 0, `Item ${item.id} has positive depth`);
    assert.ok(item.dimensions.height > 0, `Item ${item.id} has positive height`);
    assert.ok(item.compatibleRooms.length > 0, `Item ${item.id} specifies compatible rooms`);
    assert.ok(["basic", "standard", "premium"].includes(item.tier), `Item ${item.id} has valid tier`);
  }

  // Lookup helpers
  const sofa = getFurnitureCatalogItem("sofa_luxury_leather");
  assert.ok(sofa, "Lookup existing item");
  assert.equal(sofa?.tier, "premium");
  assert.equal(sofa?.category, "living");

  const kitchenItems = getCatalogItemsByCategory("kitchen");
  assert.ok(kitchenItems.length >= 5, "Kitchen category has items");

  assert.equal(isFurnitureCompatibleWithRoom("sofa_luxury_leather", "bompai-penthouse", "Double-Height Living Salon"), true);
  assert.equal(isFurnitureCompatibleWithRoom("bed_single_wood", "bompai-penthouse", "Kitchen"), false);
  assert.equal(isFurnitureCompatibleWithRoom("bed_single_wood", "unit-2b", "Master Bedroom"), true);
});

test("Milestone 9: Sabon Gari Showroom Landmark & GPS Reachability", () => {
  const showroom = KANO_LANDMARKS.find((lm) => lm.id === "furniture-showroom");
  assert.ok(showroom, "Showroom landmark is registered");
  assert.equal(showroom?.x, -22);
  assert.equal(showroom?.z, 22);
  assert.equal(showroom?.category, "commercial");
  assert.equal(showroom?.district, "SABON GARI COMMERCIAL");

  // GPS nearest lookup from nearby Sabon Gari coordinates (-20, 20)
  const nearest = getNearestLandmark(-20, 20);
  assert.ok(nearest);
  assert.equal(nearest?.landmark.id, "furniture-showroom");
  assert.ok(nearest?.distance <= 4);
});

test("Milestone 9: Showroom 3D Interior, Vignettes & Musa Dan-Ladi NPC", () => {
  const materials = createMaterials();
  const interiorManager = new BuildingInteriorManager(materials);

  const zone = interiorManager.interiors.get("furniture-showroom");
  assert.ok(zone, "Showroom interior zone registered");
  assert.equal(zone?.name, "Arewa Royal Furniture & Electronics Showroom");
  assert.equal(zone?.districtLabel, "SABON GARI · FURNITURE SHOWROOM");

  // Outdoor door connects to Sabon Gari at (-22, 0, 16.5)
  assert.equal(zone?.outdoorDoorPosition.x, -22);
  assert.equal(zone?.outdoorDoorPosition.z, 16.5);

  // Musa Dan-Ladi customer service desk interaction
  assert.ok(zone?.checkInteraction, "Interaction check exists");
  const musaCounterPos = new THREE.Vector3(460, -60, 2.9);
  const inter = zone?.checkInteraction(musaCounterPos, {
    cash: 500_000,
    trafficFine: 0,
    hasApartmentRental: true,
  });
  assert.ok(inter, "Interaction triggered at Musa's counter");
  assert.match(inter?.prompt ?? "", /Musa Dan-Ladi/);

  const actionRes = inter?.action();
  assert.equal(actionRes?.openFurnitureShop, true, "Triggers shop catalogue open");
  assert.match(actionRes?.statusMessage ?? "", /Musa Dan-Ladi/);

  // Vignette exploration check
  const livingVignettePos = new THREE.Vector3(460 - 5.0, -60, 0);
  const vignetteInter = zone?.checkInteraction(livingVignettePos, {
    cash: 500_000,
    trafficFine: 0,
    hasApartmentRental: true,
  });
  assert.ok(vignetteInter);
  assert.match(vignetteInter?.prompt ?? "", /Living Room Showcase/);
});

test("Milestone 9: Economy Purchase Transactions, Naira Deduction & Idempotency", () => {
  const economy = new EconomySystem();
  let playerCash = 500_000;

  // 1. Successful purchase
  const buyRes = economy.purchaseFurniture("sofa_sectional_fabric", playerCash);
  assert.equal(buyRes.success, true);
  assert.ok(buyRes.instance);
  assert.equal(buyRes.instance?.catalogId, "sofa_sectional_fabric");
  assert.equal(buyRes.cost, 280_000);
  playerCash -= buyRes.cost!;
  assert.equal(playerCash, 220_000);

  // Inventory has 1 unplaced item
  const unplaced = economy.getUnplacedFurniture();
  assert.equal(unplaced.length, 1);
  assert.equal(unplaced[0].instanceId, buyRes.instance?.instanceId);
  assert.equal(unplaced[0].isPlaced, false);

  // 2. Insufficient funds rejection
  const tooExpensiveRes = economy.purchaseFurniture("bed_king_royal", playerCash); // ₦850,000
  assert.equal(tooExpensiveRes.success, false);
  assert.match(tooExpensiveRes.message, /Insufficient funds/);
  assert.equal(playerCash, 220_000, "Cash unchanged on failure");

  // 3. Invalid catalog ID rejection
  const invalidRes = economy.purchaseFurniture("non_existent_item", playerCash);
  assert.equal(invalidRes.success, false);
  assert.match(invalidRes.message, /Item not found in furniture catalogue/);
});

test("Milestone 9: Furniture Placement, Movement, Rotation & Storage Workflow", () => {
  const economy = new EconomySystem();
  let playerCash = 1_000_000;

  // Grant rental access to Unit 2B for furnishing
  economy.properties.get("unit-2b")!.isRented = true;

  const buyRes = economy.purchaseFurniture("sofa_fabric_basic", playerCash);
  assert.equal(buyRes.success, true);
  const instId = buyRes.instance!.instanceId;

  // 1. Place item in Unit 2B Living Room
  const placeRes = economy.placeFurniture(
    instId,
    "unit-2b",
    1,
    "Living & Dining Room",
    { x: -1.5, y: 0.0, z: 1.0 },
    Math.PI / 4,
  );
  assert.equal(placeRes.success, true);

  const placedInUnit2B = economy.getPlacedFurniture("unit-2b");
  assert.equal(placedInUnit2B.length, 1);
  assert.equal(placedInUnit2B[0].instanceId, instId);
  assert.equal(placedInUnit2B[0].room, "Living & Dining Room");
  assert.equal(placedInUnit2B[0].position.x, -1.5);
  assert.equal(placedInUnit2B[0].position.z, 1.0);
  assert.equal(placedInUnit2B[0].rotationY, Math.PI / 4);
  assert.equal(economy.getUnplacedFurniture().length, 0);

  // 2. Cross-property isolation check
  assert.equal(economy.getPlacedFurniture("bompai-penthouse").length, 0);
  assert.equal(economy.getPlacedFurniture("albaraka-villa").length, 0);

  // 3. Move placed item
  const moveRes = economy.moveFurniture(instId, { x: 0.0, y: 0.0, z: 2.0 }, Math.PI / 2);
  assert.equal(moveRes.success, true);
  const updated = economy.getPlacedFurniture("unit-2b")[0];
  assert.equal(updated.position.x, 0.0);
  assert.equal(updated.position.z, 2.0);
  assert.equal(updated.rotationY, Math.PI / 2);

  // 4. Store item back to inventory
  const storeRes = economy.storeFurniture(instId);
  assert.equal(storeRes.success, true);
  assert.equal(economy.getPlacedFurniture("unit-2b").length, 0);
  assert.equal(economy.getUnplacedFurniture().length, 1);
  assert.equal(economy.getUnplacedFurniture()[0].isPlaced, false);
});

test("Milestone 9: 3D Procedural Mesh Generation, Dynamic Colliders & Functional Interactivity", () => {
  const materials = createMaterials();
  const dummyInstance: FurnitureInstance = {
    instanceId: "inst_test_tv",
    catalogId: "tv_cinema_wall_75",
    purchasedAt: Date.now(),
    purchasePrice: 620_000,
    assignedPropertyId: "unit-2b",
    room: "Living Room",
    floor: 1,
    position: { x: 0, y: 0, z: 0 },
    rotationY: 0,
    isPlaced: true,
  };

  const rendered = buildFurnitureMesh(dummyInstance, materials, 260, 0);
  assert.ok(rendered.group, "Generates Three.js group");
  assert.ok(rendered.colliders.length > 0, "Generates dynamic colliders");
  assert.equal(rendered.functionalType, "tv");
  assert.ok(rendered.interaction, "Has interaction handler");
  assert.match(rendered.interaction?.prompt ?? "", /Stream.*Cinema/);

  const actionRes = rendered.interaction?.action();
  assert.match(actionRes?.statusMessage ?? "", /4K HDR live broadcast|NTA Kano/);

  // Test Workstation Remote Work Payout
  const pcInstance: FurnitureInstance = {
    instanceId: "inst_test_pc",
    catalogId: "pc_office_workstation",
    purchasedAt: Date.now(),
    purchasePrice: 340_000,
    assignedPropertyId: "bompai-penthouse",
    room: "Mezzanine",
    floor: 2,
    position: { x: 2, y: 3.4, z: 2 },
    rotationY: 0,
    isPlaced: true,
  };
  const renderedPC = buildFurnitureMesh(pcInstance, materials, 300, 80);
  assert.equal(renderedPC.functionalType, "computer");
  assert.ok(renderedPC.interaction);
  const pcAction = renderedPC.interaction?.action();
  assert.equal(pcAction?.cashDelta, 25_000, "Freelance logistics work awards ₦25,000 payout");
  assert.ok(pcAction?.timeDeltaMinutes && pcAction.timeDeltaMinutes > 0);

  // Test Royal Bed Sleep & Day Advance
  const bedInstance: FurnitureInstance = {
    instanceId: "inst_test_bed",
    catalogId: "bed_king_royal",
    purchasedAt: Date.now(),
    purchasePrice: 850_000,
    assignedPropertyId: "albaraka-villa",
    room: "Master Suite",
    floor: 1,
    position: { x: 4, y: 0, z: -3 },
    rotationY: 0,
    isPlaced: true,
  };
  const renderedBed = buildFurnitureMesh(bedInstance, materials, 220, 0);
  assert.equal(renderedBed.functionalType, "bed");
  assert.ok(renderedBed.interaction);
  const bedAction = renderedBed.interaction?.action();
  assert.equal(bedAction?.timeDeltaMinutes, 360, "Sleeping advances clock by 6 hours (360 mins)");
});

test("Milestone 9: Save & Reload Persistence in kano_streets_save_v1 with Backward Compatibility", () => {
  fakeStorageMap.clear();

  const economy1 = new EconomySystem();
  economy1.properties.get("unit-2b")!.isRented = true;

  economy1.purchaseFurniture("sofa_sectional_fabric", 1_000_000);
  economy1.purchaseFurniture("tv_smart_43", 1_000_000);

  const items = economy1.furnitureInventory;
  assert.equal(items.length, 2);

  // Place first item in Unit 2B
  economy1.placeFurniture(items[0].instanceId, "unit-2b", 1, "Living Room", { x: -2.0, y: 0, z: 1.5 }, Math.PI / 2);

  // Save to storage
  const saved = economy1.saveToStorage(600_000, 0, true);
  assert.equal(saved, true);

  const rawJson = fakeStorageMap.get("kano_streets_save_v1");
  assert.ok(rawJson);
  const parsed = JSON.parse(rawJson!);
  assert.ok(Array.isArray(parsed.furnitureInventory));
  assert.equal(parsed.furnitureInventory.length, 2);
  assert.equal(parsed.furnitureInventory[0].isPlaced, true);
  assert.equal(parsed.furnitureInventory[0].assignedPropertyId, "unit-2b");
  assert.equal(parsed.furnitureInventory[0].position.x, -2.0);
  assert.equal(parsed.furnitureInventory[1].isPlaced, false);

  // Reload into a fresh EconomySystem
  const economy2 = new EconomySystem();
  const loaded = economy2.loadFromStorage();
  assert.ok(loaded);
  assert.equal(loaded?.cash, 600_000);
  assert.equal(economy2.furnitureInventory.length, 2);

  const reloadedPlaced = economy2.getPlacedFurniture("unit-2b");
  assert.equal(reloadedPlaced.length, 1);
  assert.equal(reloadedPlaced[0].catalogId, "sofa_sectional_fabric");
  assert.equal(reloadedPlaced[0].position.x, -2.0);
  assert.equal(reloadedPlaced[0].rotationY, Math.PI / 2);

  const reloadedUnplaced = economy2.getUnplacedFurniture();
  assert.equal(reloadedUnplaced.length, 1);
  assert.equal(reloadedUnplaced[0].catalogId, "tv_smart_43");

  // Backward compatibility test: load legacy save without furnitureInventory
  fakeStorageMap.set(
    "kano_streets_save_v1",
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      cash: 250_000,
      trafficFine: 0,
      hasApartmentRental: true,
      ownedProperties: ["unit-2b"],
      ownedBusinesses: [],
    }),
  );

  const economyLegacy = new EconomySystem();
  const legacyLoaded = economyLegacy.loadFromStorage();
  assert.ok(legacyLoaded);
  assert.equal(legacyLoaded?.cash, 250_000);
  assert.deepEqual(economyLegacy.furnitureInventory, [], "Defaults gracefully to empty inventory");
});
