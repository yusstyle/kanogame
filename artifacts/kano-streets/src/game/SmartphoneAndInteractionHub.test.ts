import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { GameEngine } from "./GameEngine";
import { ATM_DAILY_LIMIT, ATM_WITHDRAWAL_AMOUNT, EconomySystem } from "./economySystem";
import { SocialSystem } from "./socialSystem";
import type { GameSnapshot } from "./types";
import { computeGpsGuidance, getGpsLandmark } from "./landmarks";

function installBrowserStubs() {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect() {},
    fillText() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  const fakeDocument = {
    pointerLockElement: null as HTMLCanvasElement | null,
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    addEventListener() {},
    removeEventListener() {},
    exitPointerLock() {
      this.pointerLockElement = null;
    },
  };
  const fakeWindow = {
    devicePixelRatio: 1.5,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
    localStorage: fakeLocalStorage,
  };
  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: FakeResizeObserver });
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: () => 1 });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: () => {} });

  const parentElement = { clientWidth: 1280, clientHeight: 720 };
  const canvas = {
    parentElement,
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    hasPointerCapture: () => false,
    releasePointerCapture() {},
    requestPointerLock() {
      fakeDocument.pointerLockElement = canvas as unknown as HTMLCanvasElement;
    },
    toDataURL: (type = "image/png") => `data:${type};base64,mockRenderedFrame`,
  } as unknown as HTMLCanvasElement;

  const renderer = {
    pixelRatio: 1,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    domElement: { style: {} },
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
  };

  return { canvas, renderer, fakeDocument };
}

test("Milestone 2.1: Key P and toggleSmartphone Handset State Synchronization", () => {
  const { canvas, renderer } = installBrowserStubs();
  let latestSnapshot: GameSnapshot | null = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onSave: () => {},
    },
    () => renderer as any,
  );

  engine.setScreen("playing");
  assert.equal(latestSnapshot?.isSmartphoneOpen, false, "Smartphone should initially be closed");

  // Press P via setControlKey
  engine.setControlKey("p", true);
  assert.equal(latestSnapshot?.isSmartphoneOpen, true, "Pressing 'p' should open the smartphone");

  // Press P again to toggle off
  engine.setControlKey("p", true);
  assert.equal(latestSnapshot?.isSmartphoneOpen, false, "Pressing 'p' again should close the smartphone");

  // Explicit toggleSmartphone(true) and toggleSmartphone(false)
  engine.toggleSmartphone(true);
  assert.equal(latestSnapshot?.isSmartphoneOpen, true, "Explicit toggleSmartphone(true) should open handset");

  engine.toggleSmartphone(false);
  assert.equal(latestSnapshot?.isSmartphoneOpen, false, "Explicit toggleSmartphone(false) should close handset");

  engine.dispose();
});

test("Milestone 2.2: Authoritative Arewa Bank & 24/7 ATM Limits in Smartphone Data", () => {
  const { canvas, renderer } = installBrowserStubs();
  let latestSnapshot: GameSnapshot | null = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onSave: () => {},
    },
    () => renderer as any,
  );

  engine.setScreen("playing");

  // Snapshot exposes authoritative ATM limit and daily usage
  assert.equal(latestSnapshot?.atmDailyLimit, ATM_DAILY_LIMIT, "Snapshot should expose authoritative ATM daily limit");
  assert.equal(latestSnapshot?.dailyAtmWithdrawn, 0, "Initial daily ATM withdrawn should be 0");

  // Stand at outdoor ATM cash point (86.2, 0, -13.9) and press 'E'
  (engine as any).playerPosition.set(86.2, 0, -13.9);
  engine.setControlKey("e", true); // First withdrawal ₦20,000
  assert.equal(latestSnapshot?.dailyAtmWithdrawn, 20000, "Daily withdrawn should be ₦20,000");

  engine.setControlKey("e", true); // Second withdrawal ₦20,000 -> hits ₦40,000 cap
  assert.equal(latestSnapshot?.dailyAtmWithdrawn, 40000, "Daily withdrawn should reach cap ₦40,000");

  engine.setControlKey("e", true); // Third withdrawal attempt -> blocked
  assert.equal(latestSnapshot?.dailyAtmWithdrawn, 40000, "Daily withdrawn should stay at 40000");
  assert.ok(
    latestSnapshot?.statusMessage?.toLowerCase().includes("limit reached"),
    `Status message should cite limit reached, got: ${latestSnapshot?.statusMessage}`,
  );

  engine.dispose();
});

test("Milestone 2.3: Kano Connect Contacts Directory & Dialogue Progression", () => {
  const social = new SocialSystem();

  // Verify full cast of Kano Connect NPCs
  const garba = social.getContact("garba");
  const habiba = social.getContact("habiba");
  const chinedu = social.getContact("chinedu");
  const amina = social.getContact("amina");
  const zainab = social.getContact("zainab");
  const danladi = social.getContact("danladi");
  const kabiru = social.getContact("kabiru");

  assert.ok(garba, "Master Garba must exist in Kano Connect contacts");
  assert.ok(habiba, "Habiba Mai Shayi must exist in Kano Connect contacts");
  assert.ok(chinedu, "Chinedu Okeke must exist in Kano Connect contacts");
  assert.ok(amina, "Amina Lawal must exist in Kano Connect contacts");
  assert.ok(zainab, "Zainab Bello must exist in Kano Connect contacts");
  assert.ok(danladi, "Sergeant Danladi must exist in Kano Connect contacts");
  assert.ok(kabiru, "Malam Kabiru Dan-Kano must exist in Kano Connect contacts");

  // Interact with Master Garba
  const garbaChoices = social.getChoices("garba", 50000, false);
  assert.ok(garbaChoices.some((c) => c.id === "inspect_engine"), "Garba should have inspect_engine choice");
  const garbaOutcome = social.interact("garba", "inspect_engine", 50000, false);
  assert.ok(garbaOutcome, "Garba interaction must succeed");
  assert.ok(garbaOutcome.response.includes("oil"), "Garba should give fleet maintenance advice");
  assert.ok(garba.affection > 35, "Garba affection must increase after consultation");

  // Interact with Habiba Mai Shayi
  const habibaChoices = social.getChoices("habiba", 50000, false);
  assert.ok(habibaChoices.some((c) => c.id === "ginger_recipe"), "Habiba should have ginger_recipe choice");
  const habibaOutcome = social.interact("habiba", "ginger_recipe", 50000, false);
  assert.ok(habibaOutcome, "Habiba interaction must succeed");
  assert.ok(habibaOutcome.response.includes("ginger"), "Habiba should discuss her spiced tea recipe");

  // Interact with Malam Kabiru Dan-Kano
  const kabiruChoices = social.getChoices("kabiru", 50000, false);
  assert.ok(kabiruChoices.some((c) => c.id === "sahel_history"), "Kabiru should have sahel_history choice");
  const kabiruOutcome = social.interact("kabiru", "sahel_history", 50000, false);
  assert.ok(kabiruOutcome, "Kabiru interaction must succeed");
  assert.ok(kabiruOutcome.response.includes("1968"), "Kabiru should speak about the 1968 groundnut pyramids");
});

test("Milestone 2.4: Yan-Dutse GPS Navigation Waypoints & Guidance Calculation", () => {
  const { canvas, renderer } = installBrowserStubs();
  let latestSnapshot: GameSnapshot | null = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onSave: () => {},
    },
    () => renderer as any,
  );

  engine.setScreen("playing");

  // Set waypoint to Kawu Logistics Workshop (-20, 0, -145)
  engine.setGPSTarget("arewa-heavy-workshop");
  assert.equal(latestSnapshot?.gpsTarget, "arewa-heavy-workshop", "Snapshot should reflect GPS target");

  const landmark = getGpsLandmark("arewa-heavy-workshop");
  assert.ok(landmark, "Landmark should resolve from landmark catalog");

  const guidance = computeGpsGuidance({ x: 0, z: 0 }, { x: landmark.x, z: landmark.z }, landmark.name, landmark.district);
  assert.ok(guidance.distanceMeters > 100, `Distance to Kawu workshop should be > 100m, got: ${guidance.distanceMeters}`);
  assert.ok(guidance.directionCardinal, "Guidance should include directionCardinal");

  engine.dispose();
});

test("Milestone 2.5: Context-Sensitive World Interactions Across Entities", () => {
  const { canvas, renderer } = installBrowserStubs();
  let latestSnapshot: GameSnapshot | null = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onSave: () => {},
    },
    () => renderer as any,
  );

  engine.setScreen("playing");

  // 1. Position near Sedan at CAR_START (-2, 0, -8)
  (engine as any).playerPosition.set(-2, 0, -8);
  (engine as any).pushSnapshot(true);
  assert.ok(
    latestSnapshot?.interactionPrompt?.includes("Sedan"),
    `Near sedan prompt should be Drive Sedan, got: ${latestSnapshot?.interactionPrompt}`,
  );

  // 2. Position near ATM at (86.2, 0, -13.9)
  (engine as any).playerPosition.set(86.2, 0, -13.9);
  (engine as any).pushSnapshot(true);
  assert.ok(
    latestSnapshot?.interactionPrompt?.includes("ATM"),
    `Near ATM prompt should offer cash withdrawal, got: ${latestSnapshot?.interactionPrompt}`,
  );

  // 3. Position near Mai Shayi at (-15, 0, -155)
  (engine as any).playerPosition.set(-15, 0, -155);
  (engine as any).pushSnapshot(true);
  assert.ok(
    latestSnapshot?.interactionPrompt?.includes("Mai Shayi"),
    `Near Mai Shayi prompt should offer tea and egg bread, got: ${latestSnapshot?.interactionPrompt}`,
  );

  // 4. Enter vehicle and test exit prompt / repair prompt
  (engine as any).mode = "driving";
  (engine as any).activeVehicle = "sedan";
  (engine as any).carPosition.set(0, 0, 0);
  (engine as any).pushSnapshot(true);
  assert.equal(latestSnapshot?.interactionPrompt, "Exit Sedan", "Driving vehicle should offer Exit Sedan prompt");

  // Move vehicle to Master Garba's repair bay at (-38, 0, -135)
  (engine as any).carPosition.set(-38, 0, -135);
  (engine as any).pushSnapshot(true);
  assert.ok(
    latestSnapshot?.interactionPrompt?.includes("Arewa Heavy Repairs") ||
    latestSnapshot?.interactionPrompt?.includes("Master Garba"),
    `At Garba repair bay prompt should indicate repair bay, got: ${latestSnapshot?.interactionPrompt}`,
  );

  engine.dispose();
});

test("Milestone 2.6: Anti-Exploit Relationship Protection on Contact Greetings", () => {
  const social = new SocialSystem();
  const amina = social.getContact("amina");
  assert.ok(amina, "Amina contact should exist");
  const initialAffection = amina.affection;

  // 1. First 3 greetings award diminishing returns
  const outcome1 = social.interact("amina", "greet", 5000, true);
  assert.ok(outcome1);
  assert.equal(outcome1.affectionDelta, 5, "First greeting should award 5 affection");
  assert.equal(amina.affection, initialAffection + 5);

  const outcome2 = social.interact("amina", "greet", 5000, true);
  assert.ok(outcome2);
  assert.equal(outcome2.affectionDelta, 3, "Second greeting awards 3 affection");

  const outcome3 = social.interact("amina", "greet", 5000, true);
  assert.ok(outcome3);
  assert.equal(outcome3.affectionDelta, 2, "Third greeting awards 2 affection");
  assert.equal(amina.stage, "acquaintance", "Amina reaches acquaintance at 20 affection");

  // 2. 4th greeting hits anti-exploit cap: 0 affection gained
  const outcome4 = social.interact("amina", "greet", 5000, true);
  assert.ok(outcome4);
  assert.equal(outcome4.affectionDelta, 0, "Spammed greeting must award 0 affection");
  assert.equal(amina.affection, initialAffection + 10, "Affection must NOT increase on spammed greeting");
  assert.ok(
    outcome4.statusMessage.includes("limit reached") || outcome4.response.includes("caught up"),
    `Outcome should indicate daily limit: ${outcome4.statusMessage}`,
  );
});

test("Milestone 2.7: WebGL Canvas Screenshot Capture API", () => {
  const { canvas, renderer } = installBrowserStubs();
  let latestSnapshot: GameSnapshot | null = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onSave: () => {},
    },
    () => renderer as any,
  );

  engine.setScreen("playing");

  const screenshot = engine.captureScreenshot();
  assert.ok(screenshot, "captureScreenshot should return a string");
  assert.ok(screenshot.startsWith("data:image/jpeg"), "Screenshot should be a valid JPEG data URL");

  engine.dispose();
});

test("Milestone 2.8: GPS Waypoint Setting and Cancellation Flow", () => {
  const { canvas, renderer } = installBrowserStubs();
  let latestSnapshot: GameSnapshot | null = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onSave: () => {},
    },
    () => renderer as any,
  );

  engine.setScreen("playing");

  // Set waypoint to Kurmi Market ("kurmi-market")
  engine.setGPSTarget("kurmi-market");
  assert.equal(latestSnapshot?.gpsTarget, "kurmi-market", "Snapshot should have kurmi-market as GPS target");
  assert.ok(latestSnapshot?.statusMessage?.includes("Kasuwar Kurmi"), "Status message should reflect target set");

  // Cancel waypoint
  engine.setGPSTarget(null);
  assert.equal(latestSnapshot?.gpsTarget, null, "Snapshot GPS target should be cleared to null");
  assert.equal(latestSnapshot?.statusMessage, "GPS Navigation cleared", "Status message should reflect navigation cleared");

  engine.dispose();
});
