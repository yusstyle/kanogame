import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { ASSET_MANIFEST } from "./assetManifest";
import { createPlayerModel } from "./actors";
import { createMaterials } from "./materials";
import { GameEngine } from "./GameEngine";
import { SocialSystem } from "./socialSystem";
import { EconomySystem } from "./economySystem";
import { KANO_LANDMARKS, getNearestLandmark } from "./landmarks";
import { PedestrianSystem } from "./PedestrianSystem";
import { buildNavigationNetwork } from "./navigation";
import { ColliderIndex } from "./ColliderIndex";

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

  // 1. Verify 14 registered landmarks across all categories
  assert.equal(KANO_LANDMARKS.length, 14, "Must have 14 registered Kano landmarks");
  const categories = new Set(KANO_LANDMARKS.map((l) => l.category));
  assert.ok(categories.has("civic"));
  assert.ok(categories.has("commercial"));
  assert.ok(categories.has("residence"));
  assert.ok(categories.has("worship"));
  assert.ok(categories.has("security"));

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
