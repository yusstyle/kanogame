import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { GameEngine } from "./GameEngine";
import { WORLD_BOUNDS, WORLD_BOUNDS_NORTH } from "./layout";

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
    rendererFactory: () => renderer as unknown as THREE.WebGLRenderer,
  };
}

test("Stage 1: Northern World Boundary & Vehicle Access Verification", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    {
      onSnapshot: () => {},
      onPause: () => {},
    },
    browser.rendererFactory,
  );

  const internal = engine as unknown as {
    collides: (x: number, z: number, radius: number, skipVehicle?: boolean) => boolean;
    carCollidesAt: (x: number, z: number, yaw: number) => boolean;
    kekeCollidesAt: (x: number, z: number, yaw: number) => boolean;
    boxCollidesAt: (x: number, z: number, yaw: number, halfWidth: number, halfLength: number) => boolean;
    playerPosition: THREE.Vector3;
    handleInteract: () => void;
    statusMessage: string | null;
  };

  // 1. Verify constant boundary limits
  assert.equal(WORLD_BOUNDS, 136, "Central boundary half-width is 136m");
  assert.equal(WORLD_BOUNDS_NORTH, -230, "Northern boundary extends to -230m");

  // 2. On-foot movement tests
  // Reachable northern points along clear arterial road
  assert.equal(
    internal.collides(0, -140, 0.43, true),
    false,
    "Player can walk along the road at z = -140 (Kawu Logistics Dispatch Board level)",
  );
  assert.equal(
    internal.collides(0, -175, 0.43, true),
    false,
    "Player can walk along central freight road at z = -175 (Freight Terminal)",
  );
  assert.equal(
    internal.collides(0, -225, 0.43, true),
    false,
    "Player can walk into northern boundary staging zone at z = -225",
  );

  // Impassable boundaries
  assert.equal(
    internal.collides(0, -231, 0.43, true),
    true,
    "Player is stopped past the northern boundary (z < -230)",
  );
  assert.equal(
    internal.collides(0, 137, 0.43, true),
    true,
    "Player is stopped past the southern boundary (z > 136)",
  );
  assert.equal(
    internal.collides(137, 0, 0.43, true),
    true,
    "Player is stopped past the eastern boundary (x > 136)",
  );
  assert.equal(
    internal.collides(-137, 0, 0.43, true),
    true,
    "Player is stopped past the western boundary (x < -136)",
  );

  // 3. Vehicle collision tests (all 6 types)
  // Type 1: Sedan (carCollidesAt)
  assert.equal(internal.carCollidesAt(0, -140, 0), false, "Sedan can drive at z = -140");
  assert.equal(internal.carCollidesAt(0, -200, 0), false, "Sedan can drive at z = -200");
  assert.equal(internal.carCollidesAt(0, -231, 0), true, "Sedan stopped at northern edge");
  assert.equal(internal.carCollidesAt(0, 137, 0), true, "Sedan stopped at southern edge");
  assert.equal(internal.carCollidesAt(137, 0, 0), true, "Sedan stopped at eastern edge");

  // Type 2: Keke Napep (kekeCollidesAt)
  assert.equal(internal.kekeCollidesAt(0, -140, 0), false, "Keke can drive at z = -140");
  assert.equal(internal.kekeCollidesAt(0, -200, 0), false, "Keke can drive at z = -200");
  assert.equal(internal.kekeCollidesAt(0, -231, 0), true, "Keke stopped at northern edge");
  assert.equal(internal.kekeCollidesAt(0, 137, 0), true, "Keke stopped at southern edge");
  assert.equal(internal.kekeCollidesAt(137, 0, 0), true, "Keke stopped at eastern edge");

  // Types 3-6: Commercial Vehicles (boxCollidesAt)
  // Van (1.05, 2.3)
  assert.equal(internal.boxCollidesAt(0, -140, 0, 1.05, 2.3), false, "Van can drive at z = -140");
  assert.equal(internal.boxCollidesAt(0, -231, 0, 1.05, 2.3), true, "Van stopped at northern edge");
  assert.equal(internal.boxCollidesAt(0, 137, 0, 1.05, 2.3), true, "Van stopped at southern edge");
  assert.equal(internal.boxCollidesAt(137, 0, 0, 1.05, 2.3), true, "Van stopped at eastern edge");

  // Pickup (1.05, 2.5)
  assert.equal(internal.boxCollidesAt(0, -140, 0, 1.05, 2.5), false, "Pickup can drive at z = -140");
  assert.equal(internal.boxCollidesAt(0, -231, 0, 1.05, 2.5), true, "Pickup stopped at northern edge");

  // Minibus (1.05, 2.6)
  assert.equal(internal.boxCollidesAt(0, -140, 0, 1.05, 2.6), false, "Minibus can drive at z = -140");
  assert.equal(internal.boxCollidesAt(0, -231, 0, 1.05, 2.6), true, "Minibus stopped at northern edge");

  // Freight Truck (1.15, 3.2)
  assert.equal(internal.boxCollidesAt(0, -140, 0, 1.15, 3.2), false, "Truck can drive at z = -140");
  assert.equal(internal.boxCollidesAt(0, -231, 0, 1.15, 3.2), true, "Truck stopped at northern edge");

  // 4. Test Kawu Logistics Dispatch Board reachability and interaction
  internal.playerPosition.set(-8, 0, -140);
  internal.handleInteract();
  assert.ok(
    internal.statusMessage?.includes("Kawu Logistics Dispatch Board"),
    `Dispatch board interaction works: "${internal.statusMessage}"`,
  );
});

