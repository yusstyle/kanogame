import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EconomySystem, normalizePropertyId } from './economySystem';
import { PROPERTY_REGISTRY } from './propertyRegistry';
import { GameEngine } from './GameEngine';

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
    fillStyle: '',
    strokeStyle: '',
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
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
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
      if (tag === 'canvas') return fakeCanvas;
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

test('Test Case 1: Fresh save with no properties derives 0 homes and allows residential catalog presentation', () => {
  const storage = setupMockDOM();
  storage.clear();

  const canvas = (globalThis as any).document.createElement('canvas');
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  // Fresh game: initial cash is 100,000, no properties owned or leased
  assert.equal(engine.hasApartmentRental, false);
  const homes = engine.getPlayerHomes();
  assert.equal(homes.length, 0);

  // Accessible properties list is empty
  const accessible = engine.economy.getAccessibleProperties(false);
  assert.equal(accessible.length, 0);

  // findMyHome returns failure with clear instruction
  const findRes = engine.findMyHome();
  assert.equal(findRes.success, false);
  assert.match(findRes.message, /No home owned or leased/);
});

test('Test Case 2: Lease Unit 2B via engine.leaseProperty deducts ₦75,000, updates tenancy, and prevents duplicate payment', () => {
  const storage = setupMockDOM();
  storage.clear();

  const canvas = (globalThis as any).document.createElement('canvas');
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  (engine as any).cash = 100_000;
  assert.equal(engine.cash, 100_000);

  // Perform lease
  const leaseResult = engine.leaseProperty('unit-2b');
  assert.equal(leaseResult.success, true);
  assert.match(leaseResult.message, /Monthly lease signed for Unit 2B/);

  // Verify financial deduction: 100,000 - 75,000 = 25,000
  assert.equal(engine.cash, 25_000);
  assert.equal(engine.hasApartmentRental, true);

  const propU2b = engine.economy.properties.get('unit-2b');
  assert.ok(propU2b);
  assert.equal(propU2b.isRented, true);
  assert.equal(propU2b.isOwned, false);

  // Player homes now contains Unit 2B with status 'LEASED'
  const homes = engine.getPlayerHomes();
  assert.equal(homes.length, 1);
  assert.equal(homes[0].propertyId, 'unit-2b');
  assert.equal(homes[0].status, 'LEASED');
  assert.equal(homes[0].isSelectedHome, true);

  // Idempotency check: attempt to lease again fails and does not deduct cash
  const duplicateLease = engine.leaseProperty('unit-2b');
  assert.equal(duplicateLease.success, false);
  assert.match(duplicateLease.message, /already hold an active monthly lease/);
  assert.equal(engine.cash, 25_000);

  // Non-leaseable property check
  const invalidLease = engine.leaseProperty('bompai-penthouse');
  assert.equal(invalidLease.success, false);
  assert.match(invalidLease.message, /Only Unit 2B.*is available for monthly lease/);
});

test('Test Case 3: Save and reload persistence creates backup and restores lease without charging', () => {
  const storage = setupMockDOM();
  storage.clear();

  // Create engine and lease Unit 2B
  const canvas1 = (globalThis as any).document.createElement('canvas');
  const engine1 = new GameEngine(
    canvas1,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  (engine1 as any).cash = 150_000;
  engine1.leaseProperty('unit-2b');
  assert.equal(engine1.cash, 75_000);
  assert.equal(engine1.hasApartmentRental, true);

  // Ensure game is saved to localStorage
  engine1.saveGame();

  const savedRaw = storage.getItem('kano_streets_save_v1');
  assert.ok(savedRaw);
  const parsed = JSON.parse(savedRaw);
  assert.equal(parsed.hasApartmentRental, true);
  assert.equal(parsed.cash, 75_000);

  // Load in a fresh game instance
  const canvas2 = (globalThis as any).document.createElement('canvas');
  const engine2 = new GameEngine(
    canvas2,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  // Verify backup created non-destructively
  const backupRaw = storage.getItem('kano_streets_save_v1_backup');
  assert.ok(backupRaw);
  assert.equal(backupRaw, savedRaw);

  // Verify restored state in new engine instance
  assert.equal(engine2.cash, 75_000);
  assert.equal(engine2.hasApartmentRental, true);

  const u2b = engine2.economy.properties.get('unit-2b');
  assert.ok(u2b);
  assert.equal(u2b.isRented, true);

  const homes = engine2.getPlayerHomes();
  assert.equal(homes.length, 1);
  assert.equal(homes[0].propertyId, 'unit-2b');
  assert.equal(homes[0].status, 'LEASED');
});

test('Test Case 4: Purchase Bompai Penthouse and Al-Baraka Villa via engine.purchaseProperty', () => {
  const storage = setupMockDOM();
  storage.clear();

  const canvas = (globalThis as any).document.createElement('canvas');
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  (engine as any).cash = 120_000_000;

  // 1. Purchase Penthouse (₦35M)
  const buyPenthouse = engine.purchaseProperty('bompai-penthouse');
  assert.equal(buyPenthouse.success, true);
  assert.equal(engine.cash, 85_000_000);

  const propPenthouse = engine.economy.properties.get('bompai-penthouse');
  assert.ok(propPenthouse);
  assert.equal(propPenthouse.isOwned, true);

  // 2. Purchase Villa (₦65M)
  const buyVilla = engine.purchaseProperty('albaraka-villa');
  assert.equal(buyVilla.success, true);
  assert.equal(engine.cash, 20_000_000);

  const propVilla = engine.economy.properties.get('albaraka-villa');
  assert.ok(propVilla);
  assert.equal(propVilla.isOwned, true);

  // Verify getPlayerHomes returns both as OWNED
  const homes = engine.getPlayerHomes();
  assert.equal(homes.length, 2);
  const penthouseEntry = homes.find((h) => h.propertyId === 'bompai-penthouse');
  const villaEntry = homes.find((h) => h.propertyId === 'albaraka-villa');
  assert.ok(penthouseEntry);
  assert.equal(penthouseEntry.status, 'OWNED');
  assert.ok(villaEntry);
  assert.equal(villaEntry.status, 'OWNED');

  // Attempting to buy again fails idempotently
  const duplicateBuy = engine.purchaseProperty('bompai-penthouse');
  assert.equal(duplicateBuy.success, false);
  assert.match(duplicateBuy.message, /(already own|already hold the Certificate of Occupancy)/i);
});

test('Test Case 5: Multi-home switching dynamically updates active home, entrance coordinates, and GPS target', () => {
  const storage = setupMockDOM();
  storage.clear();

  const canvas = (globalThis as any).document.createElement('canvas');
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  (engine as any).cash = 200_000_000;
  engine.leaseProperty('unit-2b');
  engine.purchaseProperty('bompai-penthouse');
  engine.purchaseProperty('albaraka-villa');

  // All 3 properties are accessible
  const accessible = engine.economy.getAccessibleProperties(engine.hasApartmentRental);
  assert.equal(accessible.length, 3);

  // Switch to Unit 2B
  const setU2b = engine.setSelectedHome('unit-2b');
  assert.equal(setU2b.success, true);
  const navU2b = engine.getHomeNavInfo();
  assert.ok(navU2b);
  assert.equal(navU2b.propertyId, 'unit-2b');
  assert.equal(navU2b.entranceCoords.x, 48);
  assert.equal(navU2b.entranceCoords.z, -43.5);

  // Switch to Villa
  const setVilla = engine.setSelectedHome('albaraka-villa');
  assert.equal(setVilla.success, true);
  const navVilla = engine.getHomeNavInfo();
  assert.ok(navVilla);
  assert.equal(navVilla.propertyId, 'albaraka-villa');
  assert.equal(navVilla.entranceCoords.x, 44);
  assert.equal(navVilla.entranceCoords.z, 45);

  // Switch to Bompai Penthouse
  const setPenthouse = engine.setSelectedHome('bompai-penthouse');
  assert.equal(setPenthouse.success, true);
  const navPenthouse = engine.getHomeNavInfo();
  assert.ok(navPenthouse);
  assert.equal(navPenthouse.propertyId, 'bompai-penthouse');
  assert.equal(navPenthouse.entranceCoords.x, 18);
  assert.equal(navPenthouse.entranceCoords.z, 39.5);
});

test('Test Case 6: Legacy save migration normalizes aliases and recovers tenancy from legacy flags & placed furniture', () => {
  const storage = setupMockDOM();
  storage.clear();

  // 1. Test normalizePropertyId directly
  assert.equal(normalizePropertyId('apartment'), 'unit-2b');
  assert.equal(normalizePropertyId('unit2b'), 'unit-2b');
  assert.equal(normalizePropertyId('bompai-flats'), 'bompai-penthouse');
  assert.equal(normalizePropertyId('penthouse'), 'bompai-penthouse');
  assert.equal(normalizePropertyId('villa'), 'albaraka-villa');
  assert.equal(normalizePropertyId('al-baraka-villa'), 'albaraka-villa');
  assert.equal(normalizePropertyId('unknown-id'), null);

  // 2. Simulate legacy save with legacy IDs and legacy rental flag 'apartmentRental'
  const legacySaveWithFlag = {
    version: 1,
    cash: 50_000,
    apartmentRental: true, // Legacy flag
    ownedProperties: ['bompai-flats', 'villa'], // Legacy alias strings
    selectedHomePropertyId: 'villa', // Legacy alias
  };
  storage.setItem('kano_streets_save_v1', JSON.stringify(legacySaveWithFlag));

  const canvas1 = (globalThis as any).document.createElement('canvas');
  const engine1 = new GameEngine(
    canvas1,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  // Tenancy recovered from legacy apartmentRental
  assert.equal(engine1.hasApartmentRental, true);
  assert.equal(engine1.economy.properties.get('unit-2b')?.isRented, true);
  // Penthouse and Villa restored from aliases
  assert.equal(engine1.economy.properties.get('bompai-penthouse')?.isOwned, true);
  assert.equal(engine1.economy.properties.get('albaraka-villa')?.isOwned, true);
  // Selected home normalized to canonical ID
  assert.equal(engine1.economy.selectedHomePropertyId, 'albaraka-villa');

  // 3. Simulate legacy save where rental flag is missing but player had placed furniture in Unit 2B
  storage.clear();
  const legacySaveWithFurniture = {
    version: 1,
    cash: 80_000,
    hasApartmentRental: false,
    ownedProperties: [],
    furnitureInventory: [
      {
        instanceId: 'furn_1',
        catalogId: 'furn_executive_desk',
        assignedPropertyId: 'apartment', // legacy alias
        isPlaced: true,
        room: 'living',
        position: { x: 2, y: 0, z: 3 },
      },
    ],
  };
  storage.setItem('kano_streets_save_v1', JSON.stringify(legacySaveWithFurniture));

  const canvas2 = (globalThis as any).document.createElement('canvas');
  const engine2 = new GameEngine(
    canvas2,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  // Placed furniture in unit-2b / apartment triggers automatic tenancy recovery
  assert.equal(engine2.hasApartmentRental, true);
  assert.equal(engine2.economy.properties.get('unit-2b')?.isRented, true);
  assert.equal(engine2.economy.furnitureInventory[0].assignedPropertyId, 'unit-2b');
});

test('Test Case 7: Furniture inventory, upgrades, career and day counts remain intact through save/load cycles', () => {
  const storage = setupMockDOM();
  storage.clear();

  const canvas1 = (globalThis as any).document.createElement('canvas');
  const engine1 = new GameEngine(
    canvas1,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  (engine1 as any).cash = 500_000;
  engine1.leaseProperty('unit-2b');

  // Add furniture items to economy
  engine1.economy.furnitureInventory.push(
    {
      instanceId: 'item_rug',
      catalogId: 'furn_arewa_rug',
      purchasedAt: 1234567,
      purchasePrice: 45_000,
      assignedPropertyId: 'unit-2b',
      room: 'living',
      floor: 1,
      position: { x: 1.5, y: 0, z: -2.0 },
      rotationY: 1.57,
      isPlaced: true,
    },
    {
      instanceId: 'item_tv',
      catalogId: 'elec_smart_tv',
      purchasedAt: 1234588,
      purchasePrice: 180_000,
      assignedPropertyId: 'unit-2b',
      room: 'living',
      floor: 1,
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      isPlaced: false, // In storage
    }
  );

  // Set day count and vehicle upgrade
  engine1.economy.dayCount = 4;
  engine1.economy.vehicleUpgrade = { tier: 2, topSpeedBonus: 10, accelerationBonus: 0.5 };

  engine1.saveGame();

  // Reload into engine2
  const canvas2 = (globalThis as any).document.createElement('canvas');
  const engine2 = new GameEngine(
    canvas2,
    { onSnapshot: () => {}, onPause: () => {} },
    createMockRenderer
  );

  assert.equal(engine2.hasApartmentRental, true);
  assert.equal(engine2.economy.dayCount, 4);
  assert.equal(engine2.economy.vehicleUpgrade?.tier, 2);
  assert.equal(engine2.economy.furnitureInventory.length, 2);

  const placedRug = engine2.economy.furnitureInventory.find((f) => f.instanceId === 'item_rug');
  assert.ok(placedRug);
  assert.equal(placedRug.isPlaced, true);
  assert.equal(placedRug.position.x, 1.5);
  assert.equal(placedRug.rotationY, 1.57);

  const boxedTv = engine2.economy.furnitureInventory.find((f) => f.instanceId === 'item_tv');
  assert.ok(boxedTv);
  assert.equal(boxedTv.isPlaced, false);
});
