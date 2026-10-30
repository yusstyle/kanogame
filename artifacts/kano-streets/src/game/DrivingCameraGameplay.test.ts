import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GameEngine } from "./GameEngine";
import { EconomySystem } from "./economySystem";
import type { VehicleType } from "./types";

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
    closePath() {},
    fill() {},
    stroke() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  const fakeDocument = {
    pointerLockElement: null as HTMLCanvasElement | null,
    createElement: () => ({
      width: 1280,
      height: 720,
      getContext: () => context,
      addEventListener() {},
      removeEventListener() {},
      style: {},
    }),
    addEventListener() {},
    removeEventListener() {},
    exitPointerLock() {
      this.pointerLockElement = null;
    },
  };
  const storageMap = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => storageMap.set(key, String(value)),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };
  const fakeWindow = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false }),
    localStorage: fakeLocalStorage,
  };
  class FakeResizeObserver {
    observe() {}
    unobserve() {}
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
    width: 1280,
    height: 720,
    style: {},
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
    domElement: canvas,
    pixelRatio: 1,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    setPixelRatio(value: number) { this.pixelRatio = value; },
    setSize() {},
    setClearColor() {},
    render() {},
    dispose() {},
    info: { render: { calls: 0, triangles: 0 } },
  };

  const rendererFactory = () => renderer as unknown as THREE.WebGLRenderer;

  return { canvas, rendererFactory, storageMap };
}

const { canvas, rendererFactory } = installBrowserStubs();

test("1. V cycles the intended camera views while driving", () => {
  let lastSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    { onSnapshot: (s) => { lastSnapshot = s; }, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.cameraMode = "third-person";

    // Initial driving camera mode: Third-Person Chase
    assert.equal(engine.getCameraMode(), "third-person");

    // 1st V press: switches to Road-Focused Driving Camera
    const view2 = engine.toggleCameraMode();
    assert.equal(view2, "road-focused");
    assert.equal(engine.getCameraMode(), "road-focused");
    assert.ok(internal.statusMessage.includes("Road-Focused"));

    // 2nd V press: switches to Cockpit (Driver's Eye) View
    const view3 = engine.toggleCameraMode();
    assert.equal(view3, "first-person");
    assert.equal(engine.getCameraMode(), "first-person");
    assert.ok(internal.statusMessage.includes("Cockpit"));

    // 3rd V press: cycles back to Third-Person Chase Camera
    const view1 = engine.toggleCameraMode();
    assert.equal(view1, "third-person");
    assert.equal(engine.getCameraMode(), "third-person");
    assert.ok(internal.statusMessage.includes("Chase Camera"));
  } finally {
    engine.dispose();
  }
});

test("2. Camera orientation remains correct while driving forward", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0; // Heading forward along +Z
    internal.carSpeed = 12;

    // A. Third-Person Chase View
    internal.cameraMode = "third-person";
    for (let i = 0; i < 30; i++) internal.updateCamera(0.016);

    // Camera position must be behind the car (negative Z relative to car)
    assert.ok(
      internal.camera.position.z < internal.carPosition.z,
      `Chase camera Z (${internal.camera.position.z.toFixed(2)}) must be behind car Z (${internal.carPosition.z.toFixed(2)})`,
    );
    // Camera elevation must be above vehicle
    assert.ok(
      internal.camera.position.y > internal.carPosition.y + 1.0,
      `Chase camera Y (${internal.camera.position.y.toFixed(2)}) must be elevated above car`,
    );
    // Sensible FOV in range 65-75 degrees
    assert.ok(
      internal.camera.fov >= 65 && internal.camera.fov <= 75,
      `Chase FOV (${internal.camera.fov.toFixed(1)}) must be within 65-75 deg`,
    );

    // B. Road-Focused View
    internal.cameraMode = "road-focused";
    for (let i = 0; i < 30; i++) internal.updateCamera(0.016);

    // Road-focused camera must be higher and further back than chase view
    assert.ok(
      internal.camera.position.z < internal.carPosition.z,
      `Road-focused camera Z must be behind car`,
    );
    assert.ok(
      internal.camera.position.y > 1.4,
      `Road-focused camera Y must provide elevated perspective`,
    );
    assert.ok(
      internal.camera.fov >= 68 && internal.camera.fov <= 78,
      `Road-focused FOV (${internal.camera.fov.toFixed(1)}) must provide wide overview`,
    );
  } finally {
    engine.dispose();
  }
});

test("3. Left and right steering still behave correctly across all views", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";

    // 1. Third-Person Chase & Road-Focused views: verify front wheel turn & screen projection
    for (const m of ["third-person", "road-focused"] as const) {
      internal.cameraMode = m;
      internal.carPosition.set(0, 0, 0);
      internal.carYaw = 0;
      internal.carSpeed = 10;
      internal.drivingFollowYaw = 0;

      // Settle camera behind neutral car
      for (let s = 0; s < 25; s++) internal.updateCamera(0.016);

      // Steering left (A): yaw increases, vehicle front projects to screen left
      engine.setControlKey("a", true);
      internal.updateSedan(0.1);
      engine.setControlKey("a", false);

      assert.ok(internal.carYaw > 0, `Mode ${m}: Steering left must increase carYaw`);

      internal.updateCamera(0.016);
      const carFront = new THREE.Vector3(
        internal.carPosition.x + Math.sin(internal.carYaw) * 4,
        internal.carPosition.y + 0.5,
        internal.carPosition.z + Math.cos(internal.carYaw) * 4,
      );
      const projectedLeft = carFront.clone().project(internal.camera);
      assert.ok(
        projectedLeft.x < 0,
        `Mode ${m}: Steered front of car must project to screen left (NDC x < 0, got ${projectedLeft.x.toFixed(3)})`,
      );

      // Steering right (D): yaw decreases, vehicle front projects to screen right
      internal.carPosition.set(0, 0, 0);
      internal.carYaw = 0;
      internal.carSpeed = 10;
      internal.drivingFollowYaw = 0;

      // Settle camera behind neutral car
      for (let s = 0; s < 25; s++) internal.updateCamera(0.016);

      engine.setControlKey("d", true);
      internal.updateSedan(0.1);
      engine.setControlKey("d", false);

      assert.ok(internal.carYaw < 0, `Mode ${m}: Steering right must decrease carYaw`);

      internal.updateCamera(0.016);
      const carFrontRight = new THREE.Vector3(
        internal.carPosition.x + Math.sin(internal.carYaw) * 4,
        internal.carPosition.y + 0.5,
        internal.carPosition.z + Math.cos(internal.carYaw) * 4,
      );
      const projectedRight = carFrontRight.clone().project(internal.camera);
      assert.ok(
        projectedRight.x > 0,
        `Mode ${m}: Steered front of car must project to screen right (NDC x > 0, got ${projectedRight.x.toFixed(3)})`,
      );
    }

    // 2. Cockpit view: verify driver orientation turns with steering
    internal.cameraMode = "first-person";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = 10;

    engine.setControlKey("a", true);
    internal.updateSedan(0.1);
    engine.setControlKey("a", false);
    assert.ok(internal.carYaw > 0, "Cockpit: Steer left must increase carYaw");

    engine.setControlKey("d", true);
    internal.updateSedan(0.2);
    engine.setControlKey("d", false);
    assert.ok(internal.carYaw < 0, "Cockpit: Steer right must decrease carYaw");
  } finally {
    engine.dispose();
  }
});

test("4. Reverse does not cause a camera flip", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;

    // Forward motion
    internal.carSpeed = 10;
    for (let i = 0; i < 10; i++) internal.updateCamera(0.016);
    const forwardCamZ = internal.camera.position.z;
    assert.ok(forwardCamZ < 0, "Forward camera must be behind the car at negative Z");

    // Reverse motion
    internal.carSpeed = -6;
    for (let i = 0; i < 15; i++) internal.updateCamera(0.016);
    const reverseCamZ = internal.camera.position.z;
    assert.ok(
      reverseCamZ < 0,
      `Reverse camera must remain behind vehicle at negative Z without 180-deg flip (got ${reverseCamZ.toFixed(2)})`,
    );

    // Camera look direction must maintain positive Z component (facing forward)
    const forwardDir = new THREE.Vector3();
    internal.camera.getWorldDirection(forwardDir);
    assert.ok(
      forwardDir.z > 0,
      `Camera forward vector must continue pointing along +Z, not flip backwards (got ${forwardDir.z.toFixed(2)})`,
    );
  } finally {
    engine.dispose();
  }
});

test("5. Camera follow remains stable during turns without jitter or snapping", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = 10;
    internal.drivingFollowYaw = 0;

    // Simulate sustained turning left through 90 degrees
    let prevFollowYaw = 0;
    for (let frame = 0; frame < 60; frame++) {
      engine.setControlKey("a", true);
      internal.updateSedan(0.016);
      engine.setControlKey("a", false);
      internal.updateCamera(0.016);

      const currentFollowYaw = internal.drivingFollowYaw;
      assert.ok(!Number.isNaN(currentFollowYaw), "Follow yaw must not be NaN");
      assert.ok(
        Math.abs(currentFollowYaw - prevFollowYaw) < 0.25,
        `Follow yaw frame-to-frame delta must be smooth, got ${(currentFollowYaw - prevFollowYaw).toFixed(3)}`,
      );
      prevFollowYaw = currentFollowYaw;
    }
  } finally {
    engine.dispose();
  }
});

test("6. Vehicle entry and exit restore the correct camera", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    engine.setScreen("playing");

    // 1. On-foot initial state
    assert.equal(internal.mode, "on-foot");
    assert.equal(engine.getCameraMode(), "third-person");

    // Skew on-foot camera look
    internal.cameraYaw = 1.2;
    internal.cameraPitch = 0.5;

    // Move close to sedan (start pos: -2, 0, -8)
    internal.playerPosition.set(-2, 0, -7.5);

    // Enter sedan via E
    engine.setControlKey("e", true);
    engine.setControlKey("e", false);

    assert.equal(internal.mode, "driving");
    assert.equal(internal.activeVehicle, "sedan");
    assert.equal(internal.cameraYaw, 0, "Entering vehicle must reset camera yaw to 0");
    assert.ok(internal.drivingFollowYaw !== undefined, "Driving follow yaw must be initialized");

    // Cycle to road-focused view while driving
    engine.toggleCameraMode();
    assert.equal(engine.getCameraMode(), "road-focused");

    // Exit vehicle via E
    engine.setControlKey("e", true);
    engine.setControlKey("e", false);

    assert.equal(internal.mode, "on-foot");
    assert.equal(
      engine.getCameraMode(),
      "third-person",
      "Exiting vehicle must restore road-focused view back to third-person on foot",
    );
    assert.equal(internal.cameraYaw, 0, "Exiting vehicle must reset camera yaw to 0");
    assert.equal(internal.drivingFollowYaw, undefined, "Driving follow yaw must be cleared on foot");
  } finally {
    engine.dispose();
  }
});

test("7. All six vehicle types can use supported driving views with proper framing", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "driving";
    const vehicleTypes: VehicleType[] = ["sedan", "keke", "van", "pickup", "minibus", "truck"];

    for (const vType of vehicleTypes) {
      internal.activeVehicle = vType;
      internal.drivingFollowYaw = 0;

      // Third-person Chase View
      internal.cameraMode = "third-person";
      internal.updateCamera(0.016);
      const chaseCam = internal.camera.position.clone();
      assert.ok(chaseCam.z < 0, `${vType} chase camera must sit behind vehicle`);
      assert.ok(chaseCam.y > 1.0, `${vType} chase camera must be elevated above vehicle`);

      // Road-Focused Overview View
      internal.cameraMode = "road-focused";
      internal.updateCamera(0.016);
      const roadCam = internal.camera.position.clone();
      assert.ok(roadCam.z < chaseCam.z, `${vType} road camera must sit further back than chase`);
      assert.ok(roadCam.y > chaseCam.y, `${vType} road camera must sit higher than chase`);

      // First-Person Cockpit View
      internal.cameraMode = "first-person";
      internal.updateCamera(0.016);
      const cockpitCam = internal.camera.position.clone();
      assert.ok(cockpitCam.y > 1.0, `${vType} cockpit camera eye must sit at driver head height`);
      assert.equal(internal.player.root.visible, false, `${vType} player avatar must be hidden in cockpit view`);
    }
  } finally {
    engine.dispose();
  }
});

test("8. On-foot camera behavior remains unchanged", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "on-foot";
    internal.cameraMode = "third-person";

    // Initial on-foot: third-person
    assert.equal(engine.getCameraMode(), "third-person");

    // Press V on foot: toggles to first-person
    const mode1 = engine.toggleCameraMode();
    assert.equal(mode1, "first-person");
    assert.equal(engine.getCameraMode(), "first-person");
    assert.ok(internal.statusMessage.includes("First-Person"));

    internal.updateCamera(0.016);
    assert.equal(internal.player.root.visible, false, "Avatar hidden in on-foot first-person");

    // Press V again on foot: toggles back to third-person
    const mode2 = engine.toggleCameraMode();
    assert.equal(mode2, "third-person");
    assert.equal(engine.getCameraMode(), "third-person");
    assert.ok(internal.statusMessage.includes("Third-Person"));

    internal.updateCamera(0.016);
    assert.equal(internal.player.root.visible, true, "Avatar restored in on-foot third-person");
  } finally {
    engine.dispose();
  }
});

test("9. Pause and UI keyboard shortcuts still work", () => {
  let isPaused = false;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: () => {},
      onPause: () => {
        isPaused = true;
        engine.setScreen("paused");
      },
      onResume: () => {
        isPaused = false;
        engine.setScreen("playing");
      },
    },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    engine.setScreen("playing");
    assert.equal(internal.screen, "playing");

    const makeKey = (key: string) => ({
      key,
      preventDefault: () => {},
      repeat: false,
    } as any);

    // Esc triggers pause callback
    internal.onKeyDown(makeKey("Escape"));
    assert.equal(isPaused, true);
    assert.equal(internal.screen, "paused");

    // Resuming back to playing
    engine.setScreen("playing");
    assert.equal(internal.screen, "playing");

    // K toggles empire modal
    assert.equal(internal.isEmpireModalOpen, false);
    internal.onKeyDown(makeKey("k"));
    assert.equal(internal.isEmpireModalOpen, true);

    // Esc closes empire modal first without triggering pause
    isPaused = false;
    internal.onKeyDown(makeKey("Escape"));
    assert.equal(internal.isEmpireModalOpen, false);
    assert.equal(isPaused, false);
    assert.equal(internal.screen, "playing");

    // Toggle camera with 'v' still works
    assert.equal(engine.getCameraMode(), "third-person");
    internal.onKeyDown(makeKey("v"));
    assert.equal(engine.getCameraMode(), "first-person");
  } finally {
    engine.dispose();
  }
});

test("10. Existing save data and gameplay systems remain compatible", () => {
  const economy = new EconomySystem();
  economy.saveToStorage(185000, 0, true, [], 95000);

  const restored = economy.loadFromStorage();
  assert.ok(restored);
  assert.equal(restored.cash, 185000);
  assert.equal(restored.hasApartmentRental, true);
});

test("11. Phase 7.1 Road-Focused camera look target and road visibility verification", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.cameraMode = "road-focused";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0; // facing forward along +Z
    internal.drivingFollowYaw = 0;

    for (let i = 0; i < 30; i++) internal.updateCamera(0.016);

    // 1. Camera position must be behind and above vehicle roof
    const camPos = internal.camera.position;
    assert.ok(camPos.z <= -7.5 && camPos.z >= -10.5, `Camera Z (${camPos.z.toFixed(2)}) must be 7.5-10.5m behind car`);
    assert.ok(camPos.y >= 4.5 && camPos.y <= 6.0, `Camera Y (${camPos.y.toFixed(2)}) must be elevated 4.5-6.0m above road`);

    // 2. Camera forward direction must match vehicle forward direction (+Z)
    const forwardDir = new THREE.Vector3();
    internal.camera.getWorldDirection(forwardDir);
    assert.ok(forwardDir.z > 0.9, `Camera forward Z (${forwardDir.z.toFixed(3)}) must point forward down the road`);

    // 3. Screen projection: car is in lower half of screen, road is clear ahead
    internal.camera.aspect = 1280 / 720;
    internal.camera.updateProjectionMatrix();
    internal.camera.updateMatrixWorld(true);

    const carRoofNDC = new THREE.Vector3(0, 1.45, 0).project(internal.camera);
    const carHoodNDC = new THREE.Vector3(0, 0.75, 1.9).project(internal.camera);
    const road5mNDC = new THREE.Vector3(0, 0, 5).project(internal.camera);
    const road25mNDC = new THREE.Vector3(0, 0, 25).project(internal.camera);

    assert.ok(carRoofNDC.y < -0.30, `Car roof NDC Y (${carRoofNDC.y.toFixed(3)}) must sit in lower screen area`);
    assert.ok(road5mNDC.y > carRoofNDC.y, `Road at 5m ahead (${road5mNDC.y.toFixed(3)}) must project above car roof (${carRoofNDC.y.toFixed(3)})`);
    assert.ok(road25mNDC.y > road5mNDC.y, `Road perspective must climb toward horizon (${road25mNDC.y.toFixed(3)} > ${road5mNDC.y.toFixed(3)})`);

    // 4. Low roadside obstacle does not cause camera occlusion snap
    const prevCamZ = internal.camera.position.z;
    // Add a low obstacle at z = -5, y = 0.5 (height 1.0)
    internal.colliderIndex.add({
      x: 0,
      z: -5,
      halfX: 1.0,
      halfZ: 1.0,
      height: 1.0,
    });
    for (let i = 0; i < 10; i++) internal.updateCamera(0.016);
    assert.ok(
      Math.abs(internal.camera.position.z - prevCamZ) < 0.2,
      `Low roadside prop must not push camera into car (delta: ${Math.abs(internal.camera.position.z - prevCamZ).toFixed(3)})`,
    );
  } finally {
    engine.dispose();
  }
});
