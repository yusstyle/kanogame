import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { ColliderIndex } from "./ColliderIndex";
import { GameEngine } from "./GameEngine";
import { getDistrict, ROAD_LAYOUT, WORLD_BOUNDS, WORLD_EXTENT } from "./layout";
import type { Collider } from "./types";

function installBrowserStubs() {
  const context = {
    fillStyle: "",
    globalAlpha: 1,
    font: "",
    textAlign: "center",
    textBaseline: "middle",
    fillRect() {},
    fillText() {},
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

test("modular city layout joins all four Kano-inspired districts", () => {
  const horizontal = ROAD_LAYOUT.filter((road) => road.axis === "x");
  const vertical = ROAD_LAYOUT.filter((road) => road.axis === "z");
  assert.equal(horizontal.length, 5);
  assert.equal(vertical.length, 5);
  assert.equal(horizontal.length * vertical.length, 25);
  assert.equal(WORLD_EXTENT, WORLD_BOUNDS * 2);
  assert.equal(getDistrict(-4, -4), "dala");
  assert.equal(getDistrict(-4, 4), "sabon-gari");
  assert.equal(getDistrict(4, -4), "airport-road");
  assert.equal(getDistrict(4, 4), "residential");
});

test("spatial collider index returns nearby obstacles without scanning the city", () => {
  const nearby: Collider = { x: 23.5, z: 2, halfX: 1, halfZ: 1, height: 2 };
  const distant: Collider = { x: 80, z: 80, halfX: 5, halfZ: 5, height: 8 };
  const index = new ColliderIndex([nearby, distant], 24);

  assert.ok(index.query(24, 2, 0.5).includes(nearby));
  assert.ok(!index.query(0, 0, 2).includes(distant));
  assert.ok(index.query(80, 80, 1).includes(distant));
});

test("expanded world preserves walking, collisions, vehicle switching, and quality controls", () => {
  const browser = installBrowserStubs();
  const snapshots: { mode: string; location: string; speedKmh: number }[] = [];
  const engine = new GameEngine(
    browser.canvas,
    {
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onPause: () => {},
    },
    browser.rendererFactory,
  );
  const internal = engine as unknown as {
    world: { colliders: Collider[]; bounds: number; root: THREE.Group };
    playerPosition: THREE.Vector3;
    carPosition: THREE.Vector3;
    carSpeed: number;
    carYaw: number;
    mode: string;
    updatePlayer: (dt: number) => void;
    updateCar: (dt: number) => void;
    collides: (x: number, z: number, radius: number) => boolean;
    carCollidesAt: (x: number, z: number, yaw: number) => boolean;
  };

  try {
    assert.equal(internal.world.bounds, WORLD_BOUNDS);
    assert.ok(internal.world.colliders.length > 250, "the expanded blocks have collision coverage");
    let visibleMeshes = 0;
    internal.world.root.traverse((object) => {
      if (object instanceof THREE.Mesh) visibleMeshes += 1;
    });
    assert.ok(visibleMeshes > 100 && visibleMeshes < 1800, "static geometry is batched into a bounded mesh count");

    const startZ = internal.playerPosition.z;
    engine.setScreen("playing");
    engine.setControlKey("w", true);
    internal.updatePlayer(1 / 30);
    engine.setControlKey("w", false);
    if (internal.playerPosition.z <= startZ) {
      console.error("Blocked spawn movement", {
        start: internal.playerPosition.toArray(),
        obstacles: internal.world.colliders.filter((item) =>
          Math.abs(item.x + 4) < item.halfX + 2 &&
          Math.abs(item.z + 4) < item.halfZ + 2,
        ),
      });
    }
    assert.ok(internal.playerPosition.z > startZ, "W moves the character forward");

    const wall = internal.world.colliders[0];
    assert.ok(internal.collides(wall.x, wall.z, 0.45), "the character collides with a building or compound wall");
    assert.ok(internal.carCollidesAt(wall.x, wall.z, 0), "the car collides with the same static obstacle");

    engine.setControlKey("e", true);
    assert.equal(internal.mode, "driving", "E enters the nearby car");
    engine.setControlKey("e", false);
    engine.setControlKey("w", true);
    internal.updateCar(0.12);
    engine.setControlKey("w", false);
    assert.ok(internal.carSpeed > 0, "the car accelerates");
    const oldYaw = internal.carYaw;
    engine.setControlKey("d", true);
    internal.updateCar(0.12);
    engine.setControlKey("d", false);
    assert.notEqual(internal.carYaw, oldYaw, "the car steers while moving");
    engine.setControlKey("e", true);
    assert.equal(internal.mode, "on-foot", "E exits safely");

    engine.setGraphicsQuality("performance");
    assert.equal(browser.renderer.pixelRatio, 1);
    engine.setGraphicsQuality("quality");
    assert.equal(browser.renderer.pixelRatio, 1.5);
    assert.equal(snapshots.at(-1)?.location, "DALA · OLD KANO");
  } finally {
    engine.dispose();
  }
});
