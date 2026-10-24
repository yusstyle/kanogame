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
  const fakeWindow = {
    devicePixelRatio: 1.5,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
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
