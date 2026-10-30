import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { GameEngine } from "./GameEngine";

function installBrowserStubs() {
  const context = {
    fillStyle: "",
    strokeStyle: "",
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
    setPixelRatio(value: number) { this.pixelRatio = value; },
    setSize() {},
    render() {},
    dispose() {},
  };
  return {
    canvas,
    document: fakeDocument,
    window: fakeWindow,
    renderer,
    rendererFactory: () => renderer as unknown as THREE.WebGLRenderer,
  };
}

test("On-Foot: Forward (W) and Backward (S) move along camera view line", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "on-foot";
    internal.cameraYaw = 0; // Camera faces toward +Z

    // 1. Forward (W)
    internal.playerPosition.set(0, 0, 0);
    internal.playerYaw = 0;
    engine.setControlKey("w", true);
    for (let i = 0; i < 5; i++) internal.updatePlayer(0.05);
    engine.setControlKey("w", false);

    assert.ok(internal.playerPosition.z > 0, "Forward (W) moves along camera facing direction (+Z)");
    assert.equal(internal.playerPosition.x, 0, "Forward (W) has zero sideways movement");
    assert.ok(Math.abs(internal.playerYaw - 0) < 0.05, "Character faces forward (yaw ~ 0)");

    // 2. Backward (S)
    internal.playerPosition.set(0, 0, 0);
    internal.playerYaw = 0;
    engine.setControlKey("s", true);
    for (let i = 0; i < 10; i++) internal.updatePlayer(0.05);
    engine.setControlKey("s", false);

    assert.ok(internal.playerPosition.z < 0, "Backward (S) moves backward relative to camera (-Z)");
    assert.equal(internal.playerPosition.x, 0, "Backward (S) has zero sideways movement");
    assert.ok(
      Math.abs(Math.abs(internal.playerYaw) - Math.PI) < 0.15,
      `Character faces backward towards camera (yaw ~ PI) (got ${internal.playerYaw})`,
    );
  } finally {
    engine.dispose();
  }
});

test("On-Foot: Left (A) and Right (D) strafe to camera-relative left and right", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "on-foot";
    internal.cameraYaw = 0;

    // Settle camera before movement
    internal.playerPosition.set(0, 0, 0);
    for (let i = 0; i < 15; i++) internal.updateCamera(0.05);

    // 1. Strafe Left ('a')
    engine.setControlKey("a", true);
    for (let i = 0; i < 5; i++) internal.updatePlayer(0.05);
    engine.setControlKey("a", false);

    // In Three.js with camera looking at +Z, world +X is screen left (NDC x < 0)
    assert.ok(internal.playerPosition.x > 0, "Left (A) moves toward world +X (screen left)");
    assert.equal(internal.playerPosition.z, 0, "Left (A) has zero forward/backward movement");
    assert.ok(
      internal.playerYaw > 1.4 && internal.playerYaw < 1.7,
      `Character must face left towards PI/2 (got ${internal.playerYaw})`,
    );

    // Screen projection check against fixed vantage
    internal.camera.updateMatrixWorld();
    const pLeft = internal.playerPosition.clone().project(internal.camera);
    assert.ok(pLeft.x < -0.01, `Player must project to screen LEFT (NDC x < 0) (got ${pLeft.x})`);

    // Reset and settle camera
    internal.playerPosition.set(0, 0, 0);
    internal.playerYaw = 0;
    for (let i = 0; i < 15; i++) internal.updateCamera(0.05);

    // 2. Strafe Right ('d')
    engine.setControlKey("d", true);
    for (let i = 0; i < 5; i++) internal.updatePlayer(0.05);
    engine.setControlKey("d", false);

    // In Three.js with camera looking at +Z, world -X is screen right (NDC x > 0)
    assert.ok(internal.playerPosition.x < 0, "Right (D) moves toward world -X (screen right)");
    assert.equal(internal.playerPosition.z, 0, "Right (D) has zero forward/backward movement");
    assert.ok(
      internal.playerYaw < -1.4 && internal.playerYaw > -1.7,
      `Character must face right towards -PI/2 (got ${internal.playerYaw})`,
    );

    internal.camera.updateMatrixWorld();
    const pRight = internal.playerPosition.clone().project(internal.camera);
    assert.ok(pRight.x > 0.01, `Player must project to screen RIGHT (NDC x > 0) (got ${pRight.x})`);
  } finally {
    engine.dispose();
  }
});

test("On-Foot: Diagonal movement (W+A, W+D, S+A, S+D) combines directions with normalized speed", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "on-foot";
    internal.cameraYaw = 0;

    // 1. Forward-Left (W + A)
    internal.playerPosition.set(0, 0, 0);
    internal.playerYaw = 0;
    engine.setControlKey("w", true);
    engine.setControlKey("a", true);
    for (let i = 0; i < 5; i++) internal.updatePlayer(0.05);
    engine.setControlKey("w", false);
    engine.setControlKey("a", false);

    assert.ok(internal.playerPosition.z > 0, "W+A moves forward (+Z)");
    assert.ok(internal.playerPosition.x > 0, "W+A moves left (+X)");
    assert.ok(
      internal.playerYaw > 0.6 && internal.playerYaw < 0.9,
      `Character must face forward-left (~PI/4 = 0.785) (got ${internal.playerYaw})`,
    );

    // 2. Forward-Right (W + D)
    internal.playerPosition.set(0, 0, 0);
    internal.playerYaw = 0;
    engine.setControlKey("w", true);
    engine.setControlKey("d", true);
    for (let i = 0; i < 5; i++) internal.updatePlayer(0.05);
    engine.setControlKey("w", false);
    engine.setControlKey("d", false);

    assert.ok(internal.playerPosition.z > 0, "W+D moves forward (+Z)");
    assert.ok(internal.playerPosition.x < 0, "W+D moves right (-X)");
    assert.ok(
      internal.playerYaw < -0.6 && internal.playerYaw > -0.9,
      `Character must face forward-right (~-PI/4 = -0.785) (got ${internal.playerYaw})`,
    );

    // Speed normalization check: diagonal velocity must not exceed base speed
    const diagonalDistance = Math.hypot(internal.playerPosition.x, internal.playerPosition.z);
    internal.playerPosition.set(0, 0, 0);
    engine.setControlKey("w", true);
    for (let i = 0; i < 5; i++) internal.updatePlayer(0.05);
    engine.setControlKey("w", false);
    const straightDistance = Math.abs(internal.playerPosition.z);

    assert.ok(
      Math.abs(diagonalDistance - straightDistance) < 0.01,
      `Diagonal speed must be normalized to equal straight speed (diagonal: ${diagonalDistance}, straight: ${straightDistance})`,
    );
  } finally {
    engine.dispose();
  }
});

test("On-Foot: Camera rotation correctly reorients walking direction consistently", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "on-foot";

    // Test across 4 cardinal and diagonal camera orientations
    const cameraAngles = [
      { name: "Camera North (0)", yaw: 0 },
      { name: "Camera North-East (PI/4)", yaw: Math.PI / 4 },
      { name: "Camera East (PI/2)", yaw: Math.PI / 2 },
      { name: "Camera South (PI)", yaw: Math.PI },
      { name: "Camera West (-PI/2)", yaw: -Math.PI / 2 },
    ];

    for (const { name, yaw } of cameraAngles) {
      internal.cameraYaw = yaw;
      internal.playerPosition.set(0, 0, 0);
      for (let i = 0; i < 15; i++) internal.updateCamera(0.05);

      // When pressing 'a' (Left), screen X must be negative (screen left)
      engine.setControlKey("a", true);
      for (let i = 0; i < 5; i++) internal.updatePlayer(0.05);
      engine.setControlKey("a", false);
      internal.camera.updateMatrixWorld();
      const pLeft = internal.playerPosition.clone().project(internal.camera);
      assert.ok(pLeft.x < -0.01, `${name}: Strafe Left (A) must move to screen LEFT (got NDC x: ${pLeft.x})`);

      // When pressing 'd' (Right), screen X must be positive (screen right)
      internal.playerPosition.set(0, 0, 0);
      engine.setControlKey("d", true);
      for (let i = 0; i < 5; i++) internal.updatePlayer(0.05);
      engine.setControlKey("d", false);
      internal.camera.updateMatrixWorld();
      const pRight = internal.playerPosition.clone().project(internal.camera);
      assert.ok(pRight.x > 0.01, `${name}: Strafe Right (D) must move to screen RIGHT (got NDC x: ${pRight.x})`);
    }
  } finally {
    engine.dispose();
  }
});

test("On-Foot: Releasing movement keys stops movement and preserves facing angle", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "on-foot";
    internal.cameraYaw = 0;
    internal.playerPosition.set(0, 0, 0);

    // Walk left
    engine.setControlKey("a", true);
    internal.updatePlayer(0.1);
    engine.setControlKey("a", false);

    const stoppedPos = internal.playerPosition.clone();
    const stoppedYaw = internal.playerYaw;

    // Advance 5 frames with no keys pressed
    for (let i = 0; i < 5; i++) {
      internal.updatePlayer(0.016);
    }

    assert.equal(internal.playerPosition.x, stoppedPos.x, "Position X unchanged after keys released");
    assert.equal(internal.playerPosition.z, stoppedPos.z, "Position Z unchanged after keys released");
    assert.equal(internal.playerYaw, stoppedYaw, "Facing yaw preserved after keys released");
  } finally {
    engine.dispose();
  }
});

test("On-Foot: Collision bounds prevent character walking through buildings or perimeter obstacles", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "on-foot";
    internal.cameraYaw = 0;

    // Northern boundary limit is at z = -230
    internal.playerPosition.set(0, 0, -229.8);
    engine.setControlKey("s", true); // Move backward toward negative Z
    for (let i = 0; i < 10; i++) {
      internal.updatePlayer(0.1);
    }
    engine.setControlKey("s", false);

    assert.ok(
      internal.playerPosition.z >= -230.1,
      `Character must be stopped at boundary limit (pos Z: ${internal.playerPosition.z})`,
    );
  } finally {
    engine.dispose();
  }
});

test("Cross-System Verification: Vehicle steering remains 100% correct and independent", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = 10;

    // Forward + Left
    engine.setControlKey("a", true);
    internal.updateSedan(0.1);
    engine.setControlKey("a", false);
    assert.ok(internal.carYaw > 0, "Sedan steers left when pressing 'a'");
    assert.ok(internal.carPosition.x > 0, "Sedan moves to world +X (screen left) when steering left");

    // Forward + Right
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    engine.setControlKey("d", true);
    internal.updateSedan(0.1);
    engine.setControlKey("d", false);
    assert.ok(internal.carYaw < 0, "Sedan steers right when pressing 'd'");
    assert.ok(internal.carPosition.x < 0, "Sedan moves to world -X (screen right) when steering right");

    // Reverse + Left
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = -5;
    engine.setControlKey("a", true);
    internal.updateSedan(0.1);
    engine.setControlKey("a", false);
    assert.ok(internal.carPosition.x > 0, "Sedan rear steers left when reversing with 'a'");
  } finally {
    engine.dispose();
  }
});
