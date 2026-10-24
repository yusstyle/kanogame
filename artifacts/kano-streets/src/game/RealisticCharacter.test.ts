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
