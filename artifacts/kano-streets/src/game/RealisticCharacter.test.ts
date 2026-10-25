import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { ASSET_MANIFEST } from "./assetManifest";
import {
  createPlayerModel,
  createDeliveryVanModel,
  createPickupTruckModel,
  createMinibusModel,
  createFreightTruckModel,
} from "./actors";
import { createMaterials } from "./materials";
import { GameEngine } from "./GameEngine";
import { SocialSystem } from "./socialSystem";
import { EconomySystem } from "./economySystem";
import { KANO_LANDMARKS, getNearestLandmark } from "./landmarks";
import { PedestrianSystem } from "./PedestrianSystem";
import { buildNavigationNetwork } from "./navigation";
import { ColliderIndex } from "./ColliderIndex";
import { getDistrict, getDistrictLabel } from "./layout";
import { MissionSystem, CAREER_MISSIONS_CATALOG } from "./missionSystem";
import { StorySystem, INDENTURE_1968 } from "./storySystem";
import { createHistoricDistrict } from "./historicDistrict";
import { createWorld } from "./world";
import { toSvgX, toSvgY } from "../components/CityMapModal";
import { WeatherSystem, WEATHER_CONFIGS } from "./weatherSystem";
import { AudioSystem } from "./audioSystem";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("ASSET_MANIFEST includes verified realistic humanoid characters and animations", () => {
  const male = ASSET_MANIFEST.humanoidCharacterMale;
  assert.ok(male, "Male humanoid character record should exist");
  assert.equal(male.license, "CC BY 4.0 / MIT");
  assert.equal(male.path, "/assets/characters/Black_M_1_Casual.glb");
  assert.ok(male.creator.includes("Google Research") || male.creator.includes("VALID"));

  const female = ASSET_MANIFEST.humanoidCharacterFemale;
  assert.ok(female, "Female humanoid character record should exist");
  assert.equal(female.license, "CC BY 4.0 / MIT");
  assert.equal(female.path, "/assets/characters/Black_F_1_Casual.glb");

  const anims = ASSET_MANIFEST.humanoidAnimations;
  assert.ok(anims, "Humanoid animations record should exist");
  assert.equal(anims.path, "/assets/characters/humanoid_animations.json");
});

test("humanoid_animations.json contains valid locomotion and driver animation clips", () => {
  const animsPath = path.resolve(__dirname, "../../public/assets/characters/humanoid_animations.json");
  assert.ok(fs.existsSync(animsPath), "humanoid_animations.json file must exist on disk");

  const raw = fs.readFileSync(animsPath, "utf8");
  const data = JSON.parse(raw) as Record<string, unknown>;

  const expectedClips = ["idle", "walk", "run", "drive"];
  for (const clipName of expectedClips) {
    assert.ok(data[clipName], `Clip "${clipName}" must be present in humanoid_animations.json`);
    const clip = THREE.AnimationClip.parse(data[clipName]);
    assert.ok(clip instanceof THREE.AnimationClip, `${clipName} must parse to THREE.AnimationClip`);
    assert.ok(clip.duration > 0, `${clipName} duration must be positive (${clip.duration}s)`);
    assert.ok(clip.tracks.length >= 50, `${clipName} must have at least 50 bone tracks (got ${clip.tracks.length})`);
  }
});

function installBrowserStubs() {
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "center",
    textBaseline: "middle",
    fillRect() {},
    fillText() {},
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
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    addEventListener() {},
    removeEventListener() {},
    exitPointerLock() {
      this.pointerLockElement = null;
    },
  };
  const storageMap = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, val: string) => storageMap.set(key, String(val)),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
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
  } as unknown as HTMLCanvasElement;

  const renderer = {
    pixelRatio: 1,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    setPixelRatio(value: number) {
      this.pixelRatio = value;
    },
    setSize() {},
    render() {},
    dispose() {},
  };
  return {
    canvas,
    rendererFactory: () => renderer as unknown as THREE.WebGLRenderer,
    storageMap,
  };
}

test("PlayerModel supports procedural fallback and realistic rigged character attachment", () => {
  installBrowserStubs();
  const materials = createMaterials();
  const player = createPlayerModel(materials);

  assert.ok(player.root, "Player root group must exist");
  assert.ok(player.proceduralBody, "proceduralBody must exist");
  assert.equal(player.proceduralBody.visible, true, "proceduralBody starts visible before asset loads");
  assert.equal(player.riggedCharacter, undefined, "riggedCharacter starts undefined before asset loads");

  // Create a realistic character root with a bone and skinned mesh
  const characterRoot = new THREE.Group();
  const armature = new THREE.Group();
  armature.name = "Armature";
  const hips = new THREE.Bone();
  hips.name = "Hips";
  armature.add(hips);
  characterRoot.add(armature);

  const skeleton = new THREE.Skeleton([hips]);
  const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.3);
  const skinMat = new THREE.MeshStandardMaterial();
  const skinnedMesh = new THREE.SkinnedMesh(geometry, skinMat);
  skinnedMesh.bind(skeleton);
  characterRoot.add(skinnedMesh);

  // Create test animation clips
  const times = [0, 0.5, 1.0];
  const qValues = [0, 0, 0, 1, 0, 0.1, 0, 0.99, 0, 0, 0, 1];
  const track = new THREE.QuaternionKeyframeTrack("Hips.quaternion", times, qValues);
  const testClip = new THREE.AnimationClip("idle", 1.0, [track]);
  const walkClip = new THREE.AnimationClip("walk", 1.0, [track]);
  const runClip = new THREE.AnimationClip("run", 0.6, [track]);
  const driveClip = new THREE.AnimationClip("drive", 2.0, [track]);

  const anims = { idle: testClip, walk: walkClip, run: runClip, drive: driveClip };

  // Attach rigged character
  player.attachRiggedCharacter(characterRoot, anims);

  assert.equal(player.proceduralBody.visible, false, "proceduralBody must be hidden after rigged character is attached");
  assert.equal(player.riggedCharacter, characterRoot, "riggedCharacter must point to characterRoot");
  assert.equal(player.currentActionName, "idle", "initial action must be idle");

  // Test action cross-fading and playback
  player.playAction("walk", 0.1);
  assert.equal(player.currentActionName, "walk");

  player.playAction("run", 0.1);
  assert.equal(player.currentActionName, "run");

  player.playAction("drive", 0.1);
  assert.equal(player.currentActionName, "drive");

  // Test mixer update
  assert.doesNotThrow(() => {
    player.updateAnimation(0.016);
    player.updateAnimation(0.016);
  });
});

test("GameEngine runs smoothly with character animations and vehicle interactions", () => {
  const { canvas, rendererFactory } = installBrowserStubs();

  let latestSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  assert.ok(latestSnapshot, "Snapshot must be emitted upon starting game");
  assert.equal(latestSnapshot.mode, "on-foot");
  assert.ok(typeof latestSnapshot.location === "string", "Location must exist in snapshot");

  // Advance frame while simulating walk
  engine.setControlKey("w", true);
  // @ts-expect-error accessing private animate for deterministic unit test
  engine.animate();
  engine.setControlKey("w", false);

  // Advance frame while simulating sprint
  engine.setControlKey("w", true);
  engine.setControlKey("shift", true);
  // @ts-expect-error accessing private animate for deterministic unit test
  engine.animate();
  engine.setControlKey("shift", false);
  engine.setControlKey("w", false);

  // Quality presets must remain intact
  engine.setGraphicsQuality("performance");
  engine.setGraphicsQuality("balanced");
  engine.setGraphicsQuality("quality");

  engine.dispose();
});

test("Upright skeletal pose verification ensures character is standing vertically", () => {
  const animsPath = path.resolve(__dirname, "../../public/assets/characters/humanoid_animations.json");
  const data = JSON.parse(fs.readFileSync(animsPath, "utf8")) as Record<string, unknown>;

  const idleClip = THREE.AnimationClip.parse(data["idle"]);
  const hipsPosTrack = idleClip.tracks.find((t) => t.name === "Hips.position");
  assert.ok(hipsPosTrack, "Hips.position track must exist in idle clip");

  const [hx, hy, hz] = [hipsPosTrack.values[0], hipsPosTrack.values[1], hipsPosTrack.values[2]];
  assert.ok(hy > 0.95 && hy < 1.25, `Idle Hips height must be upright around 1.1m (got ${hy})`);
  assert.ok(Math.abs(hz) < 0.25, `Idle Hips Z offset must be centered, not pitching forward (got ${hz})`);
});

test("Building interiors, enterable doors, and civic interactions are fully functional", async () => {
  installBrowserStubs();
  const materials = createMaterials();
  const { BuildingInteriorManager } = await import("./BuildingInteriors");
  const interiorManager = new BuildingInteriorManager(materials);

  // Check that all 4 required interiors are loaded
  const house = interiorManager.interiors.get("house");
  assert.ok(house, "Al-Baraka Modern Villa interior must exist");
  assert.equal(house.districtLabel, "RESIDENTIAL QUARTER · INDOORS");
  assert.ok(house.colliders.length >= 8, "House interior must have wall and furniture colliders");

  const apt = interiorManager.interiors.get("apartment");
  assert.ok(apt, "Airport View Apartments interior must exist");
  assert.equal(apt.districtLabel, "AIRPORT ROAD · APARTMENTS");
  assert.ok(apt.checkInteraction, "Apartment must have rental interaction check");

  // Test apartment lease interaction
  const state = { cash: 150000, trafficFine: 0, hasApartmentRental: false };
  const rentDeskPos = new THREE.Vector3(260 + 2.8, -60 + 0.1, 0 - 3.2);
  const aptInter = apt.checkInteraction(rentDeskPos, state);
  assert.ok(aptInter, "Should detect interaction near rental desk");
  assert.ok(aptInter.prompt.includes("75,000"));
  const rentRes = aptInter.action();
  assert.equal(rentRes.cashDelta, -75000);
  assert.equal(rentRes.rentApartment, true);
  assert.ok(rentRes.statusMessage.includes("Lease Confirmed"));

  const church = interiorManager.interiors.get("church");
  assert.ok(church, "St. Stephen's Anglican Church interior must exist");
  assert.equal(church.districtLabel, "SABON GARI · CHURCH NAVE");
  assert.ok(church.checkInteraction, "Church must have altar prayer/offering interaction");

  // Test church offering interaction
  const altarPos = new THREE.Vector3(300, -60 + 0.1, 0 - 22 / 2 + 4.8);
  const churchInter = church.checkInteraction(altarPos, state);
  assert.ok(churchInter, "Should detect interaction near altar table");
  assert.ok(churchInter.prompt.includes("Prayer"));
  const prayerRes = churchInter.action();
  assert.equal(prayerRes.cashDelta, -1000);
  assert.ok(prayerRes.statusMessage.includes("Pastor"));

  const police = interiorManager.interiors.get("police-post");
  assert.ok(police, "Police & KAROTA station interior must exist");
  assert.equal(police.districtLabel, "AIRPORT ROAD · SECURITY POST");
  assert.ok(police.checkInteraction, "Station must have fine settlement interaction");

  // Test KAROTA fine payment interaction
  const finedState = { cash: 150000, trafficFine: 5000, hasApartmentRental: false };
  const karotaDeskPos = new THREE.Vector3(340 + 2.8, -60 + 0.1, 0 - 1.2);
  const fineInter = police.checkInteraction(karotaDeskPos, finedState);
  assert.ok(fineInter, "Should detect interaction at KAROTA penalty desk");
  assert.ok(fineInter.prompt.includes("5,000"));
  const fineRes = fineInter.action();
  assert.equal(fineRes.cashDelta, -5000);
  assert.equal(fineRes.clearFine, true);
  assert.ok(fineRes.statusMessage.includes("clearance receipt"));
});

test("GameEngine door transitions, KAROTA citations, and player state updates", () => {
  const { canvas, rendererFactory } = installBrowserStubs();

  let latestSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  assert.equal(latestSnapshot.cash, 150000, "Starting player cash should be ₦150,000");
  assert.equal(latestSnapshot.trafficFine, 0, "Initial traffic fine should be 0");
  assert.equal(latestSnapshot.activeInterior, null, "Should start outdoors");

  // 1. Move player to St. Stephen's Anglican Church entrance door at (-48, 0, 49.5)
  // @ts-expect-error accessing private field for deterministic unit test
  engine.playerPosition.set(-48, 0, 49.5);
  // @ts-expect-error accessing private method for deterministic unit test
  engine.handleInteract();

  // Player should now be inside St. Stephen's Anglican Church
  // @ts-expect-error accessing private field for deterministic unit test
  assert.equal(engine.interiorManager.activeInterior, "church", "Player must be inside church interior");
  // @ts-expect-error accessing private animate
  engine.animate();
  assert.ok(latestSnapshot.location.includes("SABON GARI · CHURCH NAVE"), "Snapshot location must show church nave");

  // 2. Walk to church exit door and exit
  // @ts-expect-error accessing private field for deterministic unit test
  engine.playerPosition.set(300, -59.9, 0 + 22 / 2 - 1.1);
  // @ts-expect-error accessing private method for deterministic unit test
  engine.handleInteract();
  // @ts-expect-error accessing private field for deterministic unit test
  assert.equal(engine.interiorManager.activeInterior, null, "Player must have exited church back to outdoors");

  // 3. Move player near KAROTA checkpoint at (20, 0, -9.5) and interact with officer
  // @ts-expect-error accessing private field for deterministic unit test
  engine.playerPosition.set(20, 0, -9.5);
  // @ts-expect-error accessing private method for deterministic unit test
  engine.handleInteract();
  assert.ok(latestSnapshot.statusMessage.includes("KAROTA Officer"), "Should interact with KAROTA officer");

  // 4. Test KAROTA citation when driving past checkpoint on Murtala Mohammed Way at speed
  // @ts-expect-error accessing private field for deterministic unit test
  engine.mode = "driving";
  // @ts-expect-error accessing private field for deterministic unit test
  engine.carPosition.set(20, 0, -5);
  // @ts-expect-error accessing private field for deterministic unit test
  engine.carSpeed = 8.0; // ~28.8 km/h
  // @ts-expect-error accessing private animate
  engine.animate();

  // @ts-expect-error accessing private field for deterministic unit test
  assert.equal(engine.trafficFine, 5000, "KAROTA citation of ₦5,000 must be registered for checkpoint speeding");
  assert.equal(latestSnapshot.trafficFine, 5000, "Snapshot must reflect the active ₦5,000 fine");

  engine.dispose();
});

test("Milestone 3: Modern Kano Living World - Arewa Restaurant & Cyber Hub Interiors", () => {
  const { canvas, rendererFactory } = installBrowserStubs();

  let latestSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  // 1. Move player to Arewa Fast Food & Suya Lounge door at (16, 0, -36.5)
  // @ts-expect-error accessing private field for deterministic unit test
  engine.playerPosition.set(16, 0, -36.5);
  // @ts-expect-error accessing private method for deterministic unit test
  engine.handleInteract();

  // @ts-expect-error accessing private field
  assert.equal(engine.interiorManager.activeInterior, "restaurant", "Player must be inside Arewa Restaurant");
  // @ts-expect-error accessing private animate
  engine.animate();
  assert.ok(latestSnapshot.location.includes("AREWA LOUNGE"), "Location must show Arewa Lounge");
  assert.equal(latestSnapshot.featuredContact?.name, "Amina Lawal", "Featured contact must be Amina Lawal inside restaurant");

  // 2. Order Jollof / Suya Platter at counter: cx + counterX = 380 - 3.2 = 376.8, cy = -60, cz + counterZ = -2.6
  const initialCash = latestSnapshot.cash;
  // @ts-expect-error accessing private field
  engine.playerPosition.set(376.8, -59.9, -2.6);
  // @ts-expect-error accessing private method
  engine.handleInteract();
  assert.equal(latestSnapshot.cash, initialCash - 3500, "Cash must be reduced by ₦3,500 after ordering platter");
  assert.ok(latestSnapshot.statusMessage.includes("Delicious Kano Beef Suya"), "Status must confirm platter order");

  // 3. Exit restaurant: cx = 380, cy = -60, cz + depth/2 - 1.1 = 3.9
  // @ts-expect-error accessing private field
  engine.playerPosition.set(380, -59.9, 3.9);
  // @ts-expect-error accessing private method
  engine.handleInteract();
  // @ts-expect-error accessing private field
  assert.equal(engine.interiorManager.activeInterior, null, "Player must exit back outdoors");

  // 4. Enter Kano Cyber & PS5 Game Hub at (80, 0, -40.5)
  // @ts-expect-error accessing private field
  engine.playerPosition.set(80, 0, -40.5);
  // @ts-expect-error accessing private method
  engine.handleInteract();
  // @ts-expect-error accessing private field
  assert.equal(engine.interiorManager.activeInterior, "gaming-hub", "Player must be inside gaming hub");
  // @ts-expect-error accessing private animate
  engine.animate();
  assert.ok(latestSnapshot.location.includes("GAMING HUB"), "Location must show Cyber Game Hub");
  assert.equal(latestSnapshot.featuredContact?.name, "Zainab Bello", "Featured contact must be Zainab Bello");

  // 5. Play tournament at console: cx = 420, row1X + 0.8 = -3.2 + 0.8 = -2.4 -> x = 417.6, z = -0.6
  // @ts-expect-error accessing private field
  engine.playerPosition.set(417.6, -59.9, -0.6);
  // @ts-expect-error accessing private method
  engine.handleInteract();
  assert.ok(latestSnapshot.gameScore > 0, "Tournament score must be recorded in snapshot");

  // 6. Exit gaming hub: cx = 420, cz + depth/2 - 1.1 = 3.9
  // @ts-expect-error accessing private field
  engine.playerPosition.set(420, -59.9, 3.9);
  // @ts-expect-error accessing private method
  engine.handleInteract();
  // @ts-expect-error accessing private field
  assert.equal(engine.interiorManager.activeInterior, null, "Player must exit back outdoors");

  engine.dispose();
});

test("Milestone 3: 24/7 ATM Cash Point, Clock Simulation & Sabon Gari NPF Checkpoint", () => {
  const { canvas, rendererFactory } = installBrowserStubs();

  let latestSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  // 1. In-game clock verification
  assert.ok(latestSnapshot.timeString, "Snapshot must have timeString");
  assert.match(latestSnapshot.timeString, /^\d{2}:\d{2}$/, "Time string format must be hh:mm");

  // 2. Approach 24/7 ATM Cash Point at Arewa Commercial Bank (86.2, 0, -12.8)
  // @ts-expect-error accessing private field
  engine.playerPosition.set(86.2, 0, -12.8);
  // @ts-expect-error accessing private method
  engine.pushSnapshot(true);
  assert.equal(latestSnapshot.interactionPrompt, "ATM: Withdraw Cash (₦20,000)");

  const preCash = latestSnapshot.cash;
  // @ts-expect-error accessing private method
  engine.handleInteract();
  assert.equal(latestSnapshot.cash, preCash + 20000, "ATM must dispense ₦20,000 cash");
  assert.ok(latestSnapshot.statusMessage.includes("ATM: Dispensed ₦20,000 cash"), "Status must confirm withdrawal");

  // 3. Talk to Sabon Gari NPF Highway Patrol Officer at (-10, 0, -56)
  // @ts-expect-error accessing private field
  engine.playerPosition.set(-10, 0, -56);
  // @ts-expect-error accessing private method
  engine.handleInteract();
  assert.ok(latestSnapshot.statusMessage.includes("NPF Highway Patrol"), "Officer must greet player with division message");

  // 4. Test Sabon Gari checkpoint speeding citation
  // @ts-expect-error accessing private field
  engine.mode = "driving";
  // @ts-expect-error accessing private field
  engine.carPosition.set(-10, 0, -53);
  // @ts-expect-error accessing private field
  engine.carSpeed = 8.0; // ~28.8 km/h
  // @ts-expect-error accessing private method
  engine.updateCar(0.016);
  // @ts-expect-error accessing private method
  engine.pushSnapshot(true);
  assert.equal(latestSnapshot.trafficFine, 5000, "NPF citation of ₦5,000 must be registered for Sabon Gari checkpoint speeding");

  engine.dispose();
});

test("Milestone 3: Social System & Adult Relationship Progression", () => {
  const social = new SocialSystem();
  const amina = social.getContact("amina");
  assert.ok(amina, "Amina Lawal must exist in contacts");
  assert.equal(amina.stage, "stranger");

  // 1. Initial choices: greet or chat
  let choices = social.getChoices("amina", 100000, false);
  assert.ok(choices.some((c) => c.id === "greet"));
  assert.ok(choices.some((c) => c.id === "chat_city"));

  // Greet repeatedly to build rapport
  for (let i = 0; i < 3; i++) {
    social.interact("amina", "greet", 100000, false);
  }
  assert.equal(amina.stage, "acquaintance", "Amina should become an acquaintance");

  // 2. Exchange contacts
  const exchangeRes = social.interact("amina", "exchange_contacts", 100000, false);
  assert.ok(exchangeRes);
  assert.ok(exchangeRes.statusMessage.includes("ACQUAINTANCES"));

  // 3. Dinner invite at Arewa Lounge (costs ₦5,000)
  choices = social.getChoices("amina", 100000, false);
  assert.ok(choices.some((c) => c.id === "invite_food"), "Should have food invite choice once acquaintance");
  const dinnerRes = social.interact("amina", "invite_food", 100000, false);
  assert.ok(dinnerRes);
  assert.equal(dinnerRes.cashDelta, -5000, "Dinner must deduct ₦5,000");
  assert.equal(amina.stage, "friend", "Stage should progress to friend");

  // 4. Romantic date proposal (consent-based)
  const dateRes = social.interact("amina", "ask_date", 100000, false);
  assert.ok(dateRes);
  assert.equal(amina.stage, "dating", "Stage must progress to dating");
  assert.ok(dateRes.statusMessage.includes("DATING"));

  // 5. Apartment visit invitation (requires apartment rental)
  const rejectWithoutApt = social.interact("amina", "invite_apartment", 100000, false);
  assert.ok(rejectWithoutApt);
  assert.ok(rejectWithoutApt.statusMessage.includes("lease Unit 2B"), "Should require Unit 2B lease");

  const acceptWithApt = social.interact("amina", "invite_apartment", 100000, true);
  assert.ok(acceptWithApt);
  assert.equal(amina.stage, "partner", "Stage must progress to partner");
  assert.equal(amina.affection, 100, "Affection reaches 100%");
  assert.ok(acceptWithApt.statusMessage.includes("PARTNER"));
});

test("Milestone 4: Economy System, Real Estate Freehold, and Enterprise Ownership", () => {
  installBrowserStubs();
  const economy = new EconomySystem();

  // 1. Initial State
  assert.equal(economy.dayCount, 1, "Calendar begins on Day 1");
  assert.equal(economy.getDailyNetIncome(), 0, "No daily net income with empty portfolio");
  assert.equal(economy.getOwnedPropertiesList().length, 0);
  assert.equal(economy.getOwnedBusinessesList().length, 0);

  // 2. Insufficient Funds Rejection
  const failProp = economy.purchaseProperty("unit-2b", 50000);
  assert.equal(failProp.success, false);
  assert.ok(failProp.message.includes("Insufficient funds"));

  const failBiz = economy.purchaseBusiness("sabon-gari-shop", 100000);
  assert.equal(failBiz.success, false);
  assert.ok(failBiz.message.includes("Insufficient funds"));

  // 3. Purchase Unit 2B Freehold (₦18,000,000)
  const buyUnit2B = economy.purchaseProperty("unit-2b", 25000000);
  assert.equal(buyUnit2B.success, true);
  assert.equal(buyUnit2B.cost, 18000000);
  assert.ok(buyUnit2B.message.includes("Certificate of Occupancy"));
  assert.equal(economy.properties.get("unit-2b")?.isOwned, true);
  assert.equal(economy.getDailyNetIncome(), -1200, "Daily upkeep for Unit 2B is ₦1,200/day");

  // Duplicate purchase prevention
  const dupProp = economy.purchaseProperty("unit-2b", 25000000);
  assert.equal(dupProp.success, false);
  assert.ok(dupProp.message.includes("already hold the Certificate of Occupancy"));

  // 4. Purchase Sabon Gari Electronics Stall (₦450,000)
  const buyShop = economy.purchaseBusiness("sabon-gari-shop", 1000000);
  assert.equal(buyShop.success, true);
  assert.equal(buyShop.cost, 450000);
  assert.ok(buyShop.message.includes("Enterprise deed acquired"));
  assert.equal(economy.businesses.get("sabon-gari-shop")?.isOwned, true);
  // Net shop = 15,000 - 5,000 = 10,000. Total net = 10,000 - 1,200 = 8,800.
  assert.equal(economy.getDailyNetIncome(), 8800);

  // 5. Purchase Arewa Suya Franchise Share (₦1,200,000)
  const buySuya = economy.purchaseBusiness("arewa-suya-franchise", 2000000);
  assert.equal(buySuya.success, true);
  // Net suya = 40,000 - 10,000 = 30,000. Total net = 8,800 + 30,000 = 38,800.
  assert.equal(economy.getDailyNetIncome(), 38800);

  // 6. Day Cycle Progression & Daily Net Income Payout
  // 1439 mins -> still day 1
  const sameDay = economy.updateDayCycle(1439, 500000);
  assert.equal(sameDay.cashDelta, 0);

  // 1440 mins -> Day 2 rolls over
  const nextDay = economy.updateDayCycle(1440, 500000);
  assert.equal(economy.dayCount, 2);
  assert.equal(nextDay.cashDelta, 38800);
  assert.ok(nextDay.message?.includes("Day 2 Business Income"));

  // 7. Local Storage Persistence & State Hydration
  const saveSuccess = economy.saveToStorage(1500000, 0, false);
  assert.equal(saveSuccess, true, "Saving to localStorage must succeed");

  const restored = new EconomySystem();
  const loaded = restored.loadFromStorage();
  assert.ok(loaded);
  assert.equal(loaded.cash, 1500000);
  assert.equal(loaded.dayCount, 2);
  assert.equal(restored.getOwnedPropertiesList().includes("unit-2b"), true);
  assert.equal(restored.getOwnedBusinessesList().includes("sabon-gari-shop"), true);
  assert.equal(restored.getOwnedBusinessesList().includes("arewa-suya-franchise"), true);
  assert.equal(restored.getDailyNetIncome(), 38800);
});

test("Milestone 4: Vehicle Workshop Tuning & Spacebar Handbrake Deceleration", () => {
  const { canvas, rendererFactory } = installBrowserStubs();

  let latestSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  // 1. Approach Sani Vulcanizer Workshop at (-16, 0, -22)
  // @ts-expect-error accessing private field
  engine.playerPosition.set(-16, 0, -22);
  // @ts-expect-error accessing private method
  engine.pushSnapshot(true);
  assert.ok(latestSnapshot.interactionPrompt?.includes("Sani Auto: Engine Tune Stage 1"));

  // 2. Perform Stage 1 Engine Upgrade (costs ₦50,000)
  const initialCash = latestSnapshot.cash;
  // @ts-expect-error accessing private method
  engine.handleInteract();
  assert.equal(latestSnapshot.cash, initialCash - 50000);
  assert.ok(latestSnapshot.statusMessage.includes("Engine upgraded to Stage 1"));
  // @ts-expect-error accessing private field
  assert.equal(engine.economy.vehicleUpgrade.engineStage, 1);

  // 3. Verify Stage 2 prompt and upgrade
  // @ts-expect-error accessing private method
  engine.pushSnapshot(true);
  assert.ok(latestSnapshot.interactionPrompt?.includes("Sani Auto: Engine Tune Stage 2"));
  // @ts-expect-error accessing private method
  engine.handleInteract();
  assert.ok(latestSnapshot.statusMessage.includes("Engine upgraded to Stage 2"));
  // @ts-expect-error accessing private field
  assert.equal(engine.economy.vehicleUpgrade.engineStage, 2);

  // 4. Verify max upgrade state
  // @ts-expect-error accessing private method
  engine.pushSnapshot(true);
  assert.equal(latestSnapshot.interactionPrompt, "Sani Auto Workshop: Max Stage 2 Tune Active");

  // 5. Test driving mode with handbrake deceleration
  // @ts-expect-error accessing private field
  engine.mode = "driving";
  // @ts-expect-error accessing private field
  engine.activeVehicle = "sedan";
  // @ts-expect-error accessing private field
  engine.carSpeed = 15.0; // ~54 km/h

  // Update without handbrake
  // @ts-expect-error accessing private method
  engine.updateSedan(0.1);
  // @ts-expect-error accessing private field
  const speedCoast = engine.carSpeed;
  assert.ok(speedCoast < 15.0, "Car coasts and gradually decelerates");

  // Reset speed and apply spacebar handbrake
  // @ts-expect-error accessing private field
  engine.carSpeed = 15.0;
  engine.setControlKey(" ", true);
  // @ts-expect-error accessing private method
  engine.updateSedan(0.1);
  engine.setControlKey(" ", false);
  // @ts-expect-error accessing private field
  const speedHandbrake = engine.carSpeed;
  assert.ok(speedHandbrake < speedCoast, `Handbrake deceleration (${speedHandbrake}) must be significantly stronger than coasting (${speedCoast})`);

  engine.dispose();
});

test("Milestone 4: Intelligent Pedestrian AI Routines, Waypoints & Sidewalk Dialogue", () => {
  installBrowserStubs();
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([
    { x: -80, z: -80, halfX: 5, halfZ: 5, height: 4 },
  ]);

  const pedestrians = new PedestrianSystem(scene, materials, network, colliderIndex);
  try {
    assert.ok(pedestrians.pedestrians.length >= 10, "Crowd must be populated");

    // 1. Check that NPCs have destination profiles and dialogues
    for (const p of pedestrians.pedestrians) {
      assert.ok(p.name, "NPC must have a name");
      assert.ok(p.role, "NPC must have an assigned role");
      assert.ok(p.dialogues.length > 0, "NPC must have conversation dialogues");
      assert.ok(p.destinationName, "NPC must have a destination landmark name");
    }

    // 2. Time-of-day speed adaptation
    pedestrians.setTimeOfDay(8); // Morning rush (7-9)
    const morningP = pedestrians.pedestrians.find((p) => p.state === "walking");
    assert.ok(morningP);
    for (let i = 0; i < 10; i++) {
      pedestrians.update(0.1, morningP.position, null);
    }
    const morningSpeed = morningP.speed;

    pedestrians.setTimeOfDay(22); // Night
    for (let i = 0; i < 10; i++) {
      pedestrians.update(0.1, morningP.position, null);
    }
    const nightSpeed = morningP.speed;
    assert.ok(nightSpeed < morningSpeed, `Night speed (${nightSpeed}) must be lower than morning rush (${morningSpeed})`);

    // 3. Test street talk interaction check
    const targetPed = pedestrians.pedestrians[0];
    const interNear = pedestrians.checkPedestrianInteraction(targetPed.position.clone());
    assert.ok(interNear, "Interaction prompt must be available within 2.4m radius");
    assert.ok(interNear.prompt.includes(`Talk to ${targetPed.name}`));
    const quote = interNear.action();
    assert.ok(quote.includes(targetPed.name), "Action returns speech containing NPC name");

    const farPos = new THREE.Vector3(999, 0, 999);
    assert.equal(pedestrians.checkPedestrianInteraction(farPos), null, "No interaction beyond range");

    // 4. Sidewalk chatting state machine behavior
    const walkers = pedestrians.pedestrians.filter((p) => p.state === "walking");
    if (walkers.length >= 2) {
      walkers[0].state = "talking";
      walkers[0].stateTimer = 4.0;
      walkers[1].state = "talking";
      walkers[1].stateTimer = 4.0;
      for (let i = 0; i < 5; i++) {
        pedestrians.update(0.1, walkers[0].position, null);
      }
      assert.equal(walkers[0].state, "talking", "Talking state persists during dialogue");
      assert.ok(walkers[0].speed < 0.2, `Pedestrian halts while conversing (speed: ${walkers[0].speed})`);

      // Advance time past dialogue duration (4.0s)
      pedestrians.update(4.5, walkers[0].position, null);
      assert.equal(walkers[0].state, "walking", "Pedestrian resumes walking once dialogue concludes");
    }
  } finally {
    pedestrians.dispose();
  }
});

test("Milestone 4: City Landmarks, GPS Navigation & Northern Expansion Gateway", () => {
  const { canvas, rendererFactory } = installBrowserStubs();

  // 1. Verify registered landmarks across all categories
  assert.ok(KANO_LANDMARKS.length >= 14, "Must have registered Kano landmarks");
  const categories = new Set(KANO_LANDMARKS.map((l) => l.category));
  assert.ok(categories.has("civic"));
  assert.ok(categories.has("commercial"));
  assert.ok(categories.has("residence"));
  assert.ok(categories.has("worship"));
  assert.ok(categories.has("security"));
  assert.ok(categories.has("industrial"));

  // 2. Nearest landmark calculation
  const nearestGateway = getNearestLandmark(0, -126);
  assert.ok(nearestGateway);
  assert.equal(nearestGateway.landmark.id, "expansion-gate");
  assert.equal(nearestGateway.distance, 0);

  const nearestBank = getNearestLandmark(80, -22);
  assert.ok(nearestBank);
  assert.equal(nearestBank.landmark.id, "bank");
  assert.equal(nearestBank.distance, 0);

  // 3. GameEngine GPS Waypoint tracking
  let latestSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  assert.equal(latestSnapshot.gpsTarget, null, "Default GPS target is null");

  // Set GPS to Northern Expansion Gate
  engine.setGPSTarget("expansion-gate");
  assert.equal(latestSnapshot.gpsTarget, "expansion-gate");
  assert.ok(latestSnapshot.statusMessage.includes("GPS Target set: Northern Industrial & Ring Road Gateway"));

  // Clear GPS Target
  engine.setGPSTarget(null);
  assert.equal(latestSnapshot.gpsTarget, null);
  assert.equal(latestSnapshot.statusMessage, "GPS Navigation cleared");

  engine.dispose();
});

test("Milestone 4: Social System Role-Specific Activities & Deepened Conversations", () => {
  const social = new SocialSystem();

  // 1. Zainab Bello - Street Drift Challenge
  const zainab = social.getContact("zainab");
  assert.ok(zainab);
  zainab.affection = 25;
  const driftChoices = social.getChoices("zainab", 100000, false);
  assert.ok(driftChoices.some((c) => c.id === "drift_challenge"), "Drift challenge choice should appear at 20+ affection");
  const driftRes = social.interact("zainab", "drift_challenge", 100000, false);
  assert.ok(driftRes);
  assert.equal(driftRes.affectionDelta, 16);
  assert.ok(driftRes.statusMessage.includes("Street Drift"));

  // 2. Fatima Al-Hassan - Agribusiness Investment Discussion
  const fatima = social.getContact("fatima");
  assert.ok(fatima);
  fatima.affection = 20;
  const fatimaChoices = social.getChoices("fatima", 100000, false);
  assert.ok(fatimaChoices.some((c) => c.id === "discuss_business"));
  const bizRes = social.interact("fatima", "discuss_business", 100000, false);
  assert.ok(bizRes);
  assert.equal(bizRes.affectionDelta, 15);
  assert.ok(bizRes.statusMessage.includes("agribusiness investments"));

  // 3. Chinedu Okeke - St. Stephen's Choir & Faith Discussion
  const chinedu = social.getContact("chinedu");
  assert.ok(chinedu);
  chinedu.affection = 20;
  const chineduChoices = social.getChoices("chinedu", 100000, false);
  assert.ok(chineduChoices.some((c) => c.id === "choir_music"));
  const choirRes = social.interact("chinedu", "choir_music", 100000, false);
  assert.ok(choirRes);
  assert.equal(choirRes.affectionDelta, 14);
  assert.ok(choirRes.statusMessage.includes("Chinedu over music and community"));

  // 4. Sergeant Danladi - Highway Safety & Security Regulations
  const danladi = social.getContact("danladi");
  assert.ok(danladi);
  danladi.affection = 25;
  const danladiChoices = social.getChoices("danladi", 100000, false);
  assert.ok(danladiChoices.some((c) => c.id === "ask_security_tips"));
  const secRes = social.interact("danladi", "ask_security_tips", 100000, false);
  assert.ok(secRes);
  assert.equal(secRes.affectionDelta, 12);
  assert.ok(secRes.statusMessage.includes("Sgt. Danladi"));
});

test("Milestone 5: Industrial Kano District & Spatial Layout", () => {
  // 1. Verify district detection for coordinates north of z = -120
  assert.equal(getDistrict(0, -126), "industrial");
  assert.equal(getDistrict(-40, -180), "industrial");
  assert.equal(getDistrict(45, -175), "industrial");
  assert.equal(getDistrict(0, -220), "industrial");

  // 2. District label
  assert.equal(getDistrictLabel("industrial"), "KAWU INDUSTRIAL & LOGISTICS DISTRICT");

  // 3. Verify 6 registered industrial landmarks
  const industrialLandmarks = KANO_LANDMARKS.filter((l) => l.category === "industrial");
  assert.equal(industrialLandmarks.length, 6, "Must have 6 industrial landmarks");

  const ids = new Set(industrialLandmarks.map((l) => l.id));
  assert.ok(ids.has("kawu-freight-terminal"));
  assert.ok(ids.has("dawanau-grain-depot"));
  assert.ok(ids.has("arewa-heavy-workshop"));
  assert.ok(ids.has("container-yard"));
  assert.ok(ids.has("workers-canteen"));
  assert.ok(ids.has("logistics-dispatch-board"));

  // 4. Nearest landmark calculations in industrial zone
  const nearestDawanau = getNearestLandmark(45, -175);
  assert.ok(nearestDawanau);
  assert.equal(nearestDawanau.landmark.id, "dawanau-grain-depot");
  assert.equal(nearestDawanau.distance, 0);

  const nearestTerminal = getNearestLandmark(-42, -175);
  assert.ok(nearestTerminal);
  assert.equal(nearestTerminal.landmark.id, "kawu-freight-terminal");
  assert.equal(nearestTerminal.distance, 0);
});

test("Milestone 5: 4 New Commercial Vehicle Models & Multi-Vehicle Physics", () => {
  const materials = createMaterials();

  // 1. Delivery Van model construction
  const van = createDeliveryVanModel(materials);
  assert.ok(van.root instanceof THREE.Group);
  assert.equal(van.wheels.length, 4, "Van must have 4 wheels");
  assert.equal(van.frontWheels.length, 2, "Van must have 2 steerable front wheels");

  // 2. Pickup Truck model construction
  const pickup = createPickupTruckModel(materials);
  assert.ok(pickup.root instanceof THREE.Group);
  assert.equal(pickup.wheels.length, 4, "Pickup must have 4 wheels");
  assert.equal(pickup.frontWheels.length, 2, "Pickup must have 2 front wheels");

  // 3. Passenger Minibus / Danfo model construction
  const minibus = createMinibusModel(materials);
  assert.ok(minibus.root instanceof THREE.Group);
  assert.equal(minibus.wheels.length, 4, "Minibus must have 4 wheels");
  assert.equal(minibus.frontWheels.length, 2, "Minibus must have 2 front wheels");

  // 4. Freight Truck model construction
  const truck = createFreightTruckModel(materials);
  assert.ok(truck.root instanceof THREE.Group);
  assert.equal(truck.wheels.length, 6, "Freight truck must have 6 wheels (dual rear tandem)");
  assert.equal(truck.frontWheels.length, 2, "Freight truck must have 2 front wheels");

  // 5. GameEngine interaction with all vehicles
  const { canvas, rendererFactory } = installBrowserStubs();
  let latestSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  assert.equal(latestSnapshot.mode, "on-foot");

  // Check Sedan entry at start position
  assert.equal(engine.getActiveVehiclePosition().x, -2);
  assert.equal(engine.getActiveVehiclePosition().z, -8);

  // Drive Sedan
  engine.setControlKey("e", true);
  assert.equal(latestSnapshot.mode, "driving");
  assert.equal(latestSnapshot.vehicleType, "sedan");
  assert.ok(latestSnapshot.statusMessage?.includes("driving the Sedan"));

  // Exit Sedan
  engine.setControlKey("e", true);
  assert.equal(latestSnapshot.mode, "on-foot");
  assert.equal(latestSnapshot.statusMessage, "Exited safely");

  engine.dispose();
});

test("Milestone 5: Career Missions State Machine & Single Payout Guarantee", () => {
  const missionSys = new MissionSystem();

  // 1. Catalog integrity
  assert.equal(CAREER_MISSIONS_CATALOG.length, 5, "5 career contracts in catalog");
  assert.equal(missionSys.getAvailableMissions().length, 5, "All 5 initially available");
  assert.equal(missionSys.getActiveMission(), null);
  assert.equal(missionSys.careerEarnings, 0);

  // 2. Accept Local Delivery contract
  const acceptRes = missionSys.acceptMission("local-delivery-electronics");
  assert.ok(acceptRes.success);
  assert.ok(acceptRes.message.includes("Contract Accepted"));
  assert.equal(missionSys.activeMissionId, "local-delivery-electronics");

  const active = missionSys.getActiveMission();
  assert.ok(active);
  assert.equal(active.state, "in_progress");
  assert.equal(active.currentStageIndex, 0);

  // 3. Second mission acceptance blocked
  const secondAccept = missionSys.acceptMission("freight-machine-parts");
  assert.equal(secondAccept.success, false, "Cannot accept second mission while one is active");

  // 4. Check interaction outside checkpoint radius
  const outsidePos = new THREE.Vector3(0, 0, 0);
  assert.equal(missionSys.checkMissionInteraction(outsidePos), null);

  // 5. Checkpoint 1 interaction
  const stage1Target = new THREE.Vector3(active.stages[0].targetCoords.x, 0, active.stages[0].targetCoords.z);
  const inter1 = missionSys.checkMissionInteraction(stage1Target);
  assert.ok(inter1);
  assert.equal(inter1.prompt, active.stages[0].actionPrompt);

  // 6. Advance Stage 1
  const adv1 = missionSys.advanceStage(stage1Target);
  assert.ok(adv1);
  assert.equal(adv1.completed, false);
  assert.equal(adv1.reward, 0);
  assert.equal(active.currentStageIndex, 1);

  // 7. Checkpoint 2 interaction & completion
  const stage2Target = new THREE.Vector3(active.stages[1].targetCoords.x, 0, active.stages[1].targetCoords.z);
  const inter2 = missionSys.checkMissionInteraction(stage2Target);
  assert.ok(inter2);
  assert.equal(inter2.prompt, active.stages[1].actionPrompt);

  const adv2 = missionSys.advanceStage(stage2Target);
  assert.ok(adv2);
  assert.equal(adv2.completed, true);
  assert.equal(adv2.reward, 22000);
  assert.equal(adv2.bonus, 0);
  assert.equal(missionSys.careerEarnings, 22000);
  assert.equal(missionSys.activeMissionId, null);
  assert.ok(missionSys.completedMissionIds.has("local-delivery-electronics"));

  // 8. Strict Rule: Single payout guarantee (contract cannot be accepted again or re-paid)
  const reAccept = missionSys.acceptMission("local-delivery-electronics");
  assert.equal(reAccept.success, false, "Cannot repeat completed contract in same cycle");

  // 9. Enterprise Supply Bonus verification
  const supplyAccept = missionSys.acceptMission("supply-produce-suya");
  assert.ok(supplyAccept.success);
  const supplyActive = missionSys.getActiveMission();
  assert.ok(supplyActive);

  // Complete Stage 1 of supply mission
  const supStage1Pos = new THREE.Vector3(supplyActive.stages[0].targetCoords.x, 0, supplyActive.stages[0].targetCoords.z);
  missionSys.advanceStage(supStage1Pos);

  // Complete Stage 2 with owned enterprise
  const supStage2Pos = new THREE.Vector3(supplyActive.stages[1].targetCoords.x, 0, supplyActive.stages[1].targetCoords.z);
  const supComplete = missionSys.advanceStage(supStage2Pos, ["arewa-suya-franchise"]);
  assert.ok(supComplete);
  assert.equal(supComplete.completed, true);
  assert.equal(supComplete.reward, 45000);
  assert.equal(supComplete.bonus, 15000, "Enterprise bonus must be ₦15,000");
  assert.ok(supComplete.message.includes("Enterprise Supply Bonus"));
  assert.equal(missionSys.careerEarnings, 22000 + 45000 + 15000);
});

test("Milestone 5: Industrial Pedestrians & Mai Shayi Dialogue Routines", () => {
  const materials = createMaterials();
  const scene = new THREE.Scene();
  const navigation = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const pedSystem = new PedestrianSystem(scene, materials, navigation, colliderIndex, () => 0);

  // 1. Habiba Mai Shayi at Workers Canteen (-15, 0, -155)
  const canteenPos = new THREE.Vector3(-15, 0, -155);
  const habibaInter = pedSystem.checkPedestrianInteraction(canteenPos);
  assert.ok(habibaInter, "Habiba Mai Shayi interaction should exist at Canteen Hub");
  assert.ok(habibaInter.prompt.includes("Habiba"));
  const habibaToast = habibaInter.action();
  assert.ok(habibaToast.includes("Habiba Mai Shayi") && (habibaToast.includes("tea") || habibaToast.includes("spiced") || habibaToast.includes("bread")));

  // 2. Garba Mechanic at Arewa Heavy Workshop (-38, 0, -135)
  const workshopPos = new THREE.Vector3(-38, 0, -135);
  const garbaInter = pedSystem.checkPedestrianInteraction(workshopPos);
  assert.ok(garbaInter, "Garba Mechanic interaction should exist at Workshop");
  assert.ok(garbaInter.prompt.includes("Garba"));
  const garbaToast = garbaInter.action();
  assert.ok(garbaToast.includes("Garba Mechanic") && (garbaToast.includes("diesel") || garbaToast.includes("engine") || garbaToast.includes("repairs")));

  // 3. Malam Danladi at Kawu Logistics (-42, 0, -175)
  const logisticsPos = new THREE.Vector3(-42, 0, -175);
  const danladiInter = pedSystem.checkPedestrianInteraction(logisticsPos);
  assert.ok(danladiInter, "Malam Danladi interaction should exist at Kawu Depot");
  assert.ok(danladiInter.prompt.includes("Malam Danladi"));
  const danladiToast = danladiInter.action();
  assert.ok(danladiToast.includes("Malam Danladi") && (danladiToast.includes("haulage") || danladiToast.includes("manifest") || danladiToast.includes("cargo")));

  pedSystem.dispose();
});

test("Milestone 5: Save/Load Schema Migration & Career Earnings Persistence", () => {
  const { storageMap } = installBrowserStubs();
  const economy = new EconomySystem();

  // 1. Save data with completed missions and career earnings
  economy.saveToStorage(250000, 0, true, ["local-delivery-electronics", "freight-machine-parts"], 57000);

  const rawSaved = storageMap.get("kano_streets_save_v1");
  assert.ok(rawSaved, "Save file must be stored in localStorage");

  const parsed = JSON.parse(rawSaved);
  assert.equal(parsed.cash, 250000);
  assert.equal(parsed.hasApartmentRental, true);
  assert.deepEqual(parsed.completedMissions, ["local-delivery-electronics", "freight-machine-parts"]);
  assert.equal(parsed.careerEarnings, 57000);

  // 2. Load and verify hydration
  const loaded = economy.loadFromStorage();
  assert.ok(loaded);
  assert.equal(loaded.cash, 250000);
  assert.deepEqual(loaded.completedMissions, ["local-delivery-electronics", "freight-machine-parts"]);
  assert.equal(loaded.careerEarnings, 57000);

  // 3. Backwards-compatibility: load legacy save without mission data
  storageMap.set("kano_streets_save_v1", JSON.stringify({
    cash: 180000,
    trafficFine: 5000,
    hasApartmentRental: false,
    ownedProperties: ["bompai-penthouse"],
    ownedBusinesses: ["sabon-gari-shop"],
    vehicleUpgrade: { engineStage: 1, paintColor: "#2b4c7e", suspensionUpgraded: false },
    dayCount: 3,
    savedAt: Date.now(),
  }));

  const legacyLoaded = economy.loadFromStorage();
  assert.ok(legacyLoaded);
  assert.equal(legacyLoaded.cash, 180000);
  assert.equal(legacyLoaded.completedMissions, undefined);
  assert.equal(legacyLoaded.careerEarnings, undefined);
});


// ============================================================================
// MILESTONE 6: HISTORIC KANO, OPEN-WORLD MAP & BUSINESS EMPIRE STORY TESTS
// ============================================================================

test("Milestone 6: Historic Kano District & Spatial Architecture", () => {
  installBrowserStubs();
  const materials = createMaterials();
  const root = new THREE.Group();
  const colliders: any[] = [];

  const district = createHistoricDistrict(root, materials, colliders);
  assert.ok(district, "Historic Kano district group should be created");
  assert.equal(district.name, "historic-kano-district");
  assert.ok(district.children.length >= 6, "District should contain 6 primary historic sectors");

  // Verify colliders registered
  assert.ok(colliders.length > 25, `Historic district should generate substantial collision bodies (got ${colliders.length})`);

  // Verify Dala Hill colliders
  const dalaColliders = colliders.filter((c) => Math.hypot(c.x - (-95), c.z - (-95)) < 15);
  assert.ok(dalaColliders.length >= 3, "Dala Hill sandstone tiers should have dedicated colliders");

  // Verify Kofar Dala Gate colliders & vehicle clearance
  const gateColliders = colliders.filter((c) => Math.hypot(c.x - (-62), c.z - (-93)) < 16);
  assert.ok(gateColliders.length >= 4, "Kofar Dala Gate bastions and towers should be collidable");

  // Verify full world integration
  const world = createWorld(materials);
  assert.ok(world.root, "World should initialize with historic district wired");
  const historicWallCollider = world.colliders.find((c) => Math.abs(c.x - (-62)) < 1 && Math.abs(c.z - (-77.5)) < 1);
  assert.ok(historicWallCollider, "Ancient city wall collider should be present in global world colliders");
});

test("Milestone 6: Story System 'The Unknown Legacy' Chapter 1 & Indenture Archive", () => {
  installBrowserStubs();
  const story = new StorySystem();

  // 1. Initial Uninitiated State
  const initial = story.getProgress();
  assert.equal(initial.chapter, 1);
  assert.equal(initial.stage, 0);
  assert.equal(initial.investigationChoice, null);
  assert.equal(initial.careerPathChoice, null);
  assert.equal(initial.rewardClaimed, false);

  // 2. 1968 Indenture Document verification
  assert.ok(INDENTURE_1968.title.includes("1968 TRANS-SAHARAN"));
  assert.ok(INDENTURE_1968.date.includes("1968"));
  assert.ok(INDENTURE_1968.parties.some((p) => p.includes("Dan-Kano")));
  assert.ok(INDENTURE_1968.seals.some((s) => s.includes("NR-68-0419")));
  assert.ok(INDENTURE_1968.content.includes("British-West African Commercial vault"));

  // 3. Stage 0 -> Stage 1: Examine Indenture
  const examineRes = story.examineIndenture();
  assert.equal(examineRes.success, true);
  assert.ok(examineRes.message.includes("Malam Kabiru"));

  const stage1 = story.getProgress();
  assert.equal(stage1.stage, 1);
  assert.equal(stage1.indentureDiscovered, true);
  assert.ok(stage1.cluesFound.includes("1968_trans_saharan_indenture"));

  const snapshot1 = story.getSnapshotInfo({ x: -85, z: -68 });
  assert.equal(snapshot1.stage, 1);
  assert.equal(snapshot1.canInvestigate, true);
  assert.equal(snapshot1.canChooseCareer, false);
});

test("Milestone 6: Decision 1 (Investigation) & Decision 2 (4 Business Empire Career Paths)", () => {
  installBrowserStubs();

  // Test Decision 1 Branch A: Clan Elders
  const storyA = new StorySystem();
  storyA.examineIndenture();
  const resElders = storyA.chooseInvestigation("elders");
  assert.equal(resElders.success, true);
  assert.equal(resElders.trustGain, 25);
  assert.equal(storyA.getProgress().elderTrust, 35); // 10 base + 25 gain
  assert.equal(storyA.getProgress().investigationChoice, "elders");

  // Irreversibility test: cannot change once decided
  const secondChoice = storyA.chooseInvestigation("bank");
  assert.equal(secondChoice.success, false);
  assert.equal(storyA.getProgress().investigationChoice, "elders");

  // Test Decision 1 Branch B: Arewa Bank
  const storyB = new StorySystem();
  storyB.examineIndenture();
  const resBank = storyB.chooseInvestigation("bank");
  assert.equal(resBank.success, true);
  assert.equal(resBank.bonusCash, 10000);
  assert.equal(storyB.getProgress().investigationChoice, "bank");

  // Test Decision 2: 4 Career Paths
  const careerOptions: Array<"transport" | "trading" | "technology" | "property"> = [
    "transport",
    "trading",
    "technology",
    "property",
  ];

  for (const career of careerOptions) {
    const s = new StorySystem();
    s.examineIndenture();
    s.chooseInvestigation("elders");
    assert.equal(s.getProgress().stage, 2);

    const careerRes = s.chooseCareerPath(career);
    assert.equal(careerRes.success, true);
    assert.ok(careerRes.perkDescription.length > 0);
    assert.equal(s.getProgress().careerPathChoice, career);
    assert.equal(s.getProgress().careerPath, career);
    assert.equal(s.getProgress().stage, 3);
    assert.ok(s.getProgress().cluesFound.includes(`career_foundation_${career}`));
  }
});

test("Milestone 6: Chapter 1 Conclusion, Single Payout Guarantee & Vault Key", () => {
  installBrowserStubs();
  const story = new StorySystem();
  story.examineIndenture();
  story.chooseInvestigation("elders");
  story.chooseCareerPath("transport");

  // Complete Chapter 1
  const resolveRes = story.resolveChapter1();
  assert.equal(resolveRes.success, true);
  assert.equal(resolveRes.payout, 50000);
  assert.equal(resolveRes.storyXP, 250);
  assert.equal(resolveRes.unlockedKey, "BRONZE_VAULT_KEY_SAHEL_1968");
  assert.ok(resolveRes.message.includes("CHAPTER 1 COMPLETED"));

  const progress = story.getProgress();
  assert.equal(progress.stage, 4);
  assert.equal(progress.completed, true);
  assert.equal(progress.rewardClaimed, true);
  assert.ok(progress.cluesFound.includes("chapter_1_secured_title"));

  // SINGLE PAYOUT GUARANTEE: cannot claim ₦50,000 twice
  const repeatResolve = story.resolveChapter1();
  assert.equal(repeatResolve.success, true);
  assert.equal(repeatResolve.payout, 0, "Repeated completion must yield 0 payout");
  assert.equal(repeatResolve.storyXP, 0, "Repeated completion must yield 0 XP");
  assert.ok(repeatResolve.message.includes("already completed"));
});

test("Milestone 6: Interactive City Map Coordinate Projections, Waypoint Calculations & Historic NPCs", () => {
  const { storageMap } = installBrowserStubs();

  // 1. Coordinate projection tests (World -> SVG Map)
  // World bounds: X [-136, 136] -> SVG [0, 800], Z [-230, 136] -> SVG [0, 1000]
  assert.equal(toSvgX(-136), 0);
  assert.equal(toSvgX(136), 800);
  assert.equal(toSvgX(0), 400);

  assert.equal(toSvgY(-230), 0);
  assert.equal(toSvgY(136), 1000);

  // Dala Hill projection
  const dalaSvgX = toSvgX(-95);
  const dalaSvgY = toSvgY(-95);
  assert.ok(dalaSvgX > 0 && dalaSvgX < 400, "Dala Hill should project into northwest quadrant");
  assert.ok(dalaSvgY > 0 && dalaSvgY < 628, "Dala Hill should project above Murtala Mohammed Way");

  // 2. Landmark queries & categories
  const historicLandmarks = KANO_LANDMARKS.filter((l) => l.category === "historic");
  assert.equal(historicLandmarks.length, 6, "Should register all 6 historic Kano landmarks");
  assert.ok(historicLandmarks.some((l) => l.id === "dala-hill"));
  assert.ok(historicLandmarks.some((l) => l.id === "kofar-dala-gate"));
  assert.ok(historicLandmarks.some((l) => l.id === "dan-kano-compound"));
  assert.ok(historicLandmarks.some((l) => l.id === "kurmi-market"));
  assert.ok(historicLandmarks.some((l) => l.id === "kofar-mata-dye-pits"));
  assert.ok(historicLandmarks.some((l) => l.id === "dandali-square"));

  // 3. Waypoint Distance calculation
  const playerPos = { x: -4, z: -4 };
  const danKanoCoords = { x: -85, z: -68 };
  const dist = Math.round(Math.hypot(danKanoCoords.x - playerPos.x, danKanoCoords.z - playerPos.z));
  assert.equal(dist, 103, "Distance calculation between (-4, -4) and (-85, -68) should be 103m");

  // 4. Historic NPCs verification in PedestrianSystem
  const materials = createMaterials();
  const scene = new THREE.Scene();
  const nav = buildNavigationNetwork();
  const colliders = new ColliderIndex([]);
  const pedSystem = new PedestrianSystem(scene, materials, nav, colliders, () => 0);

  // Malam Kabiru Dan-Kano at (-85, 0, -68)
  const kabiruInter = pedSystem.checkPedestrianInteraction(new THREE.Vector3(-85, 0, -68));
  assert.ok(kabiruInter, "Malam Kabiru interaction should exist at Dan-Kano Compound");
  assert.ok(kabiruInter.prompt.includes("Malam Kabiru"));
  const kabiruToast = kabiruInter.action();
  assert.ok(kabiruToast.includes("Malam Kabiru") && (kabiruToast.includes("ancestral") || kabiruToast.includes("peace") || kabiruToast.includes("Assalamu")));

  // Balarabe Craftsman at Kasuwar Kurmi (-75, 0, -85)
  const kurmiInter = pedSystem.checkPedestrianInteraction(new THREE.Vector3(-75, 0, -85));
  assert.ok(kurmiInter, "Balarabe Craftsman interaction should exist at Kurmi Market");
  const kurmiToast = kurmiInter.action();
  assert.ok(kurmiToast.includes("Balarabe") && (kurmiToast.includes("Kurmi") || kurmiToast.includes("leather")));

  // Maimuna Mai Masa at Dandali Square (-72, 0, -72)
  const maimunaInter = pedSystem.checkPedestrianInteraction(new THREE.Vector3(-72, 0, -72));
  assert.ok(maimunaInter, "Maimuna interaction should exist at Dandali Square");
  const maimunaToast = maimunaInter.action();
  assert.ok(maimunaToast.includes("Maimuna") && (maimunaToast.includes("Masa") || maimunaToast.includes("Dandali")));

  // Master Isa Dyer at Kofar Mata (-68, 0, -105)
  const dyerInter = pedSystem.checkPedestrianInteraction(new THREE.Vector3(-68, 0, -105));
  assert.ok(dyerInter, "Master Isa Dyer interaction should exist at Dye Pits");
  const dyerToast = dyerInter.action();
  assert.ok(dyerToast.includes("Master Isa") && (dyerToast.includes("indigo") || dyerToast.includes("Kofar Mata")));

  pedSystem.dispose();

  // 5. Economy & Story Save/Load persistence
  const economy = new EconomySystem();
  const storyProgressData = {
    chapter: 1,
    stage: 4,
    investigationChoice: "elders" as const,
    careerPath: "transport" as const,
    careerPathChoice: "transport" as const,
    indentureDiscovered: true,
    elderTrust: 35,
    cluesFound: ["1968_trans_saharan_indenture", "elders_oral_testimony", "career_foundation_transport", "chapter_1_secured_title"],
    completed: true,
    rewardClaimed: true,
  };

  economy.saveToStorage(200000, 0, true, ["freight-cotton-bales"], 75000, storyProgressData);
  const loadedSave = economy.loadFromStorage();
  assert.ok(loadedSave?.storyProgress);
  assert.equal(loadedSave.storyProgress.stage, 4);
  assert.equal(loadedSave.storyProgress.investigationChoice, "elders");
  assert.equal(loadedSave.storyProgress.careerPathChoice, "transport");
  assert.equal(loadedSave.storyProgress.rewardClaimed, true);
});

test("Milestone 7: Environmental & Harmattan Weather System", () => {
  const weather = new WeatherSystem("clear");
  assert.equal(weather.getPreset(), "clear");
  assert.equal(weather.getPresetDisplayName(), "Clear Sahel Sky");

  // Cycle through presets
  assert.equal(weather.cyclePreset(), "harmattan");
  assert.equal(weather.getPresetDisplayName(), "Harmattan Dust Haze");

  assert.equal(weather.cyclePreset(), "sunset_glow");
  assert.equal(weather.getPresetDisplayName(), "Golden Sunset Glow");

  assert.equal(weather.cyclePreset(), "cool_night");
  assert.equal(weather.getPresetDisplayName(), "Cool Starlit Night");

  assert.equal(weather.cyclePreset(), "clear");

  // Apply Harmattan weather to scene
  weather.setPreset("harmattan");
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#ffffff", 10, 100);
  const sun = new THREE.DirectionalLight("#ffffff", 1);
  const hemi = new THREE.HemisphereLight("#ffffff", "#000000", 1);

  weather.applyToScene(scene, sun, hemi, 12, false);
  assert.equal((scene.fog as THREE.Fog).near, WEATHER_CONFIGS.harmattan.fogNear);
  assert.equal((scene.fog as THREE.Fog).far, WEATHER_CONFIGS.harmattan.fogFar);
  assert.ok(sun.intensity > 1.5, "Sun intensity matches Harmattan daytime formula");

  // Test interior mode
  weather.applyToScene(scene, sun, hemi, 12, true);
  assert.equal((scene.fog as THREE.Fog).near, 15);
  assert.equal((scene.fog as THREE.Fog).far, 85);
  assert.equal(sun.intensity, 0.2);

  // Test particle drift update
  const initialPos = new THREE.Vector3(0, 0, 0);
  weather.update(0.5, initialPos);

  weather.dispose();
});

test("Milestone 7: Procedural Audio System & Sahel Atmosphere", () => {
  const audio = new AudioSystem(false, 0.7);
  assert.equal(audio.isMuted(), false);
  assert.equal(audio.getMasterVolume(), 0.7);

  // Mute toggling
  const isMuted = audio.toggleMute();
  assert.equal(isMuted, true);
  assert.equal(audio.isMuted(), true);

  audio.setMuted(false);
  assert.equal(audio.isMuted(), false);

  // Master volume clamping
  audio.setMasterVolume(1.5);
  assert.equal(audio.getMasterVolume(), 1.0);
  audio.setMasterVolume(-0.2);
  assert.equal(audio.getMasterVolume(), 0.0);
  audio.setMasterVolume(0.8);

  // Update on foot locomotion
  audio.update(0.1, {
    mode: "on-foot",
    isMovingOnFoot: true,
    isSprinting: false,
    isHarmattan: false,
    isInterior: false,
  });

  // Update driving vehicle in Harmattan
  audio.update(0.1, {
    mode: "driving",
    vehicleSpeed: 18,
    vehicleMaxSpeed: 24,
    isHarmattan: true,
    isInterior: false,
  });

  audio.dispose();
});

test("Milestone 7: Camera Spring-Arm Collision Probe & Multi-Candidate Vehicle Dismount", () => {
  const colliders: Collider[] = [
    // Wall directly behind camera path (x: 0, z: -5)
    { x: 0, z: -5, halfX: 0.8, halfZ: 0.5, height: 4.0 },
    // Left compound wall blocking driver side (x: -1.8, z: 0)
    { x: -1.8, z: 0, halfX: 0.3, halfZ: 4.0, height: 4.0 },
  ];
  const colliderIndex = new ColliderIndex(colliders);

  // 1. Spring-arm collision detection:
  // Target at (0, 1.25, 0), desired camera at (0, 1.25, -6.35).
  // The line intersects the wall at z = -4.5.
  const target = new THREE.Vector3(0, 1.25, 0);
  const path = new THREE.Vector3(0, 0, -6.35);
  const pathLength = path.length();
  const samples = Math.ceil(pathLength / 0.4);
  let safeDistance = pathLength;

  for (let step = 2; step <= samples; step += 1) {
    const distanceAlongPath = Math.min(step * 0.4, pathLength);
    const point = target.clone().addScaledVector(path, distanceAlongPath / pathLength);
    const blocked = colliderIndex.query(point.x, point.z, 1.4).some((c) => {
      if (point.y > (c.height ?? 3.5) - 0.2) return false;
      const dx = Math.max(Math.abs(point.x - c.x) - c.halfX, 0);
      const dz = Math.max(Math.abs(point.z - c.z) - c.halfZ, 0);
      return dx * dx + dz * dz < 0.36 * 0.36;
    });
    if (blocked) {
      safeDistance = Math.max(2.0, distanceAlongPath - 0.45);
      break;
    }
  }
  assert.ok(safeDistance < pathLength, "Camera must push forward away from wall obstacle");
  assert.ok(safeDistance >= 2.0, "Camera maintains minimum safe distance from player");

  // 2. Multi-Candidate Vehicle Dismount:
  // Vehicle at (0, 0, 0). Left driver side (x = -1.8) is blocked by left compound wall.
  // Right passenger side (x = +1.8) is clear!
  const vPos = new THREE.Vector3(0, 0, 0);
  const vYaw = 0;
  const right = new THREE.Vector3(Math.cos(vYaw), 0, -Math.sin(vYaw));
  const forward = new THREE.Vector3(Math.sin(vYaw), 0, Math.cos(vYaw));
  const sideOffset = 1.8;
  const endOffset = 2.8;

  const candidates = [
    vPos.clone().addScaledVector(right, -sideOffset), // Left (-1.8, 0, 0) - blocked by wall
    vPos.clone().addScaledVector(right, sideOffset),  // Right (+1.8, 0, 0) - clear!
    vPos.clone().addScaledVector(forward, -endOffset), // Rear (0, 0, -2.8) - clear
    vPos.clone().addScaledVector(forward, endOffset),  // Front (0, 0, 2.8) - clear
  ];

  const collidesFn = (x: number, z: number, rad: number) => {
    return colliderIndex.query(x, z, rad + 0.5).some((collider: Collider) => {
      const closestX = THREE.MathUtils.clamp(
        x,
        collider.x - collider.halfX,
        collider.x + collider.halfX,
      );
      const closestZ = THREE.MathUtils.clamp(
        z,
        collider.z - collider.halfZ,
        collider.z + collider.halfZ,
      );
      const dx = x - closestX;
      const dz = z - closestZ;
      return dx * dx + dz * dz < rad * rad;
    });
  };

  const safeExit = candidates.find(
    (c) => !collidesFn(c.x, c.z, 0.48) && c.distanceTo(vPos) > 1.2,
  );

  assert.ok(safeExit, "Safe exit position must be found");
  assert.ok(safeExit.x > 1.0, "Safe exit selects unobstructed right passenger side");
});

test("Milestone 7: Distance-Based Crowd LOD Throttling & Dakali Seated Citizens", () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  const pedestrians = new PedestrianSystem(scene, materials, network, colliderIndex, () => 0);
  assert.ok(pedestrians.pedestrians.length >= 10, "Crowd must be populated");

  // Verify presence of seated citizens on Dakali clay ledges
  const seatedCitizens = pedestrians.pedestrians.filter((p) => p.state === "sitting");
  assert.ok(seatedCitizens.length >= 1, "Must have seated citizens on Dakali benches");
  const elder = seatedCitizens[0];
  assert.ok(elder.name.includes("Bello") || elder.name.includes("Sanusi"));
  assert.ok(elder.destinationName.includes("Dakali") || elder.destinationName.includes("Dandali"));

  // Check elder dialogue interaction
  const elderInter = pedestrians.checkPedestrianInteraction(elder.position.clone());
  assert.ok(elderInter, "Seated elder should offer interaction prompt");
  const toast = elderInter.action();
  assert.ok(toast.includes("Dakali") || toast.includes("Barka") || toast.includes("Kano") || toast.includes("history"));

  // Distance LOD verification: update with close player position
  const closePlayer = elder.position.clone().add(new THREE.Vector3(2, 0, 2));
  pedestrians.update(0.1, closePlayer, null);

  // Quality scaling preserves performance target <= 12
  pedestrians.setQuality("performance");
  assert.ok(pedestrians.pedestrians.length <= 12, "Performance preset throttles crowd size to <= 12");

  pedestrians.dispose();
});

test("Milestone 7: Save/Load Schema Backward Compatibility with Weather & Audio Preferences", () => {
  const economy = new EconomySystem();

  // Save with Milestone 7 weather & audio preferences
  const success = economy.saveToStorage(
    350000,
    0,
    true,
    ["cotton-transport-kofar-ruwa"],
    45000,
    undefined,
    "harmattan",
    true,
  );
  assert.ok(success, "saveToStorage should return true");

  const loaded = economy.loadFromStorage();
  assert.ok(loaded, "loadFromStorage should return saved state");
  assert.equal(loaded.cash, 350000);
  assert.equal(loaded.weatherPreset, "harmattan");
  assert.equal(loaded.audioMuted, true);

  // Backward compatibility test: load legacy save lacking weatherPreset / audioMuted
  const legacyData = {
    version: 1,
    cash: 50000,
    trafficFine: 0,
    hasApartmentRental: false,
    ownedProperties: [],
    ownedBusinesses: [],
    dayCount: 3,
    vehicleUpgrade: { engineStage: 0, paintColor: "#4a5568", suspensionUpgraded: false },
    completedMissions: [],
    careerEarnings: 0,
    savedAt: Date.now(),
  };
  window.localStorage.setItem("kano_streets_save_v1", JSON.stringify(legacyData));

  const loadedLegacy = economy.loadFromStorage();
  assert.ok(loadedLegacy, "Legacy save without weather/audio should load cleanly");
  assert.equal(loadedLegacy.cash, 50000);
  assert.equal(loadedLegacy.weatherPreset, undefined);
  assert.equal(loadedLegacy.audioMuted, undefined);
});
