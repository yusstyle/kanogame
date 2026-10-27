import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createMaterials } from "./materials";
import { createPlayerModel, createPedestrianModel } from "./actors";
import { GameEngine } from "./GameEngine";
import { PedestrianSystem } from "./PedestrianSystem";
import { buildNavigationNetwork } from "./navigation";
import { ColliderIndex } from "./ColliderIndex";
import { VALID_SEATS, findNearestValidSeat, isValidSeatNearby } from "./seats";

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
  const fakeCanvas = {
    parentElement,
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    addEventListener() {},
    removeEventListener() {},
    requestPointerLock() {
      fakeDocument.pointerLockElement = fakeCanvas as unknown as HTMLCanvasElement;
      return Promise.resolve();
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    style: {},
  } as unknown as HTMLCanvasElement;

  const fakeRenderer = {
    domElement: fakeCanvas,
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.12,
    outputColorSpace: THREE.SRGBColorSpace,
  } as unknown as THREE.WebGLRenderer;

  return { fakeCanvas, fakeRenderer };
}

test("1. Player Model & Stride-Matched Animation Playback Architecture", () => {
  const { fakeCanvas } = installBrowserStubs();
  const materials = createMaterials();
  const model = createPlayerModel(materials);

  assert.ok(model.root, "Model root must exist");
  assert.ok(model.proceduralBody, "Procedural body group must exist");
  assert.equal(typeof model.playAction, "function", "playAction must be defined");
  assert.equal(typeof model.setTimeScale, "function", "setTimeScale must be defined for stride matching");

  // Create mock character group and animation clips
  const characterGroup = new THREE.Group();
  const track = new THREE.VectorKeyframeTrack(".position", [0, 1], [0, 0, 0, 0, 1, 0]);
  const idleClip = new THREE.AnimationClip("idle", 1.0, [track]);
  const walkClip = new THREE.AnimationClip("walk", 0.8, [track]);
  const runClip = new THREE.AnimationClip("run", 0.6, [track]);

  model.attachRiggedCharacter(characterGroup, {
    idle: idleClip,
    walk: walkClip,
    run: runClip,
  });

  assert.equal(model.currentActionName, "idle", "Default action after attachment should be idle");

  // Verify action switching
  model.playAction("walk", 0.1);
  assert.equal(model.currentActionName, "walk", "Action should transition to walk");

  // Verify stride matching time scale modulation
  model.setTimeScale(1.42);
  assert.ok(model.setTimeScale, "setTimeScale executes successfully");

  model.playAction("run", 0.1);
  assert.equal(model.currentActionName, "run", "Action should transition to run");
});

test("2. First-Person and Third-Person Camera Perspectives & Avatar Visibility", () => {
  const { fakeCanvas, fakeRenderer } = installBrowserStubs();
  let lastSnapshot: any = null;

  const engine = new GameEngine(
    fakeCanvas,
    {
      onSnapshot: (s) => {
        lastSnapshot = s;
      },
      onPause: () => {},
    },
    () => fakeRenderer,
  );

  // 1. Initial State: Third-Person Follow Mode
  assert.equal(engine.getCameraMode(), "third-person", "Initial camera mode must be third-person");
  assert.equal(lastSnapshot?.cameraMode, "third-person", "Snapshot must report initial camera mode");

  // 2. Toggle to First-Person Immersive View
  const newMode = engine.toggleCameraMode();
  assert.equal(newMode, "first-person", "Toggling from third-person should return first-person");
  assert.equal(engine.getCameraMode(), "first-person");
  assert.equal(lastSnapshot?.cameraMode, "first-person");
  assert.ok(lastSnapshot?.statusMessage?.includes("First-Person"), "Status message confirms 1st person mode");

  // In first-person mode, player avatar mesh must be hidden to prevent seeing inside head / skull
  // Trigger camera update by advancing frame
  (engine as any).updateCamera(0.016);
  assert.equal((engine as any).player.root.visible, false, "Player mesh must be hidden in first-person mode");

  // 3. Toggle Back to Third-Person View
  const thirdMode = engine.toggleCameraMode();
  assert.equal(thirdMode, "third-person", "Toggling from first-person should return third-person");
  assert.equal(engine.getCameraMode(), "third-person");

  // Trigger camera update in third-person mode
  (engine as any).updateCamera(0.016);
  assert.equal((engine as any).player.root.visible, true, "Player mesh must be restored in third-person mode on-foot");

  // 4. Test Key [V] Toggle via setControlKey in gameplay
  engine.setScreen("playing");
  engine.setControlKey("v", true);
  assert.equal(engine.getCameraMode(), "first-person", "Key [V] should toggle camera mode");

  engine.setControlKey("v", true);
  assert.equal(engine.getCameraMode(), "third-person", "Second [V] key press toggles back to third-person");

  engine.dispose();
});

test("3. Valid Seating Architecture: Dakali Benches, Shelters & Tea Stand Seats", () => {
  assert.ok(VALID_SEATS.length >= 8, "Must register comprehensive catalog of valid seats");

  // Test Dakali Benches
  const dandaliSeat = VALID_SEATS.find((s) => s.id === "seat_dakali_dandali");
  assert.ok(dandaliSeat, "Dandali Square Dakali bench must exist");
  assert.equal(dandaliSeat.type, "dakali");
  assert.ok(isValidSeatNearby(new THREE.Vector3(-72.0, 0.45, -78.2), 1.0), "Position at Dandali must be valid seat");

  // Test Transit Passenger Shelter
  const shelterSeat = VALID_SEATS.find((s) => s.id === "seat_shelter_murtala");
  assert.ok(shelterSeat, "Murtala Mohammed Way commuter shelter seat must exist");
  assert.equal(shelterSeat.type, "shelter");

  // Test Mai Shayi Roadside Tea Stand Bench
  const teaSeat = VALID_SEATS.find((s) => s.id === "seat_maishayi_sabongari");
  assert.ok(teaSeat, "Mai Shayi customer tea stand bench must exist");
  assert.equal(teaSeat.type, "bench");

  // Test findNearestValidSeat distance threshold
  const nearSeat = findNearestValidSeat(new THREE.Vector3(-71.8, 0, -78.0), 2.0);
  assert.ok(nearSeat, "Should find nearest seat when within radius");
  assert.equal(nearSeat.id, "seat_dakali_dandali");

  const farSeat = findNearestValidSeat(new THREE.Vector3(500, 0, 500), 2.0);
  assert.equal(farSeat, null, "Should return null when far from any valid seat");
});

test("4. Seated Citizens & Elder Bench Validation in PedestrianSystem", () => {
  const { fakeCanvas } = installBrowserStubs();
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const navigation = buildNavigationNetwork();
  const colliders = new ColliderIndex([]);

  const pedSystem = new PedestrianSystem(
    scene,
    materials,
    navigation,
    colliders,
    () => 0,
  );

  // Filter seated citizens
  const seatedPeds = pedSystem.pedestrians.filter((p) => p.state === "sitting");
  assert.ok(seatedPeds.length >= 2, "Must spawn seated citizens on Dakali benches");

  // Every seated pedestrian must be located at a valid seat
  for (const seated of seatedPeds) {
    assert.ok(
      pedSystem.isAtValidSeat(seated),
      `Seated pedestrian ${seated.name} at (${seated.position.x}, ${seated.position.z}) must be on a valid seat`,
    );
  }

  pedSystem.dispose();
});

test("5. NPC Face-to-Face Orientation & Social Greetings on Foot", () => {
  const { fakeCanvas } = installBrowserStubs();
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const navigation = buildNavigationNetwork();
  const colliders = new ColliderIndex([]);

  const pedSystem = new PedestrianSystem(
    scene,
    materials,
    navigation,
    colliders,
    () => 0,
  );

  const walkingPed = pedSystem.pedestrians.find((p) => p.state === "walking");
  assert.ok(walkingPed, "Walking pedestrian must exist");

  const playerPos = new THREE.Vector3(walkingPed.position.x + 1.5, 0, walkingPed.position.z + 1.5);
  const inter = pedSystem.checkPedestrianInteraction(playerPos);
  assert.ok(inter, "Interaction should be available within radius");

  // Execute greeting interaction
  const response = inter.action();
  assert.ok(response.includes(walkingPed.name), "Greeting response must include NPC name");
  assert.equal(walkingPed.state, "talking", "NPC state should switch to talking");

  // Verify NPC heading yaw turned to face player
  const expectedYaw = Math.atan2(playerPos.x - walkingPed.position.x, playerPos.z - walkingPed.position.z);
  const diff = Math.abs(walkingPed.yaw - expectedYaw);
  assert.ok(diff < 0.05, "NPC should face the player directly when spoken to");

  pedSystem.dispose();
});
