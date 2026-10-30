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

test("Vehicle Steering: Forward + LEFT turns the vehicle left on screen and in world", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    // 1. Enter car and start moving forward
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = 10;

    const initialYaw = internal.carYaw;
    const initialPosX = internal.carPosition.x;

    // Press LEFT ('a')
    engine.setControlKey("a", true);
    internal.updateSedan(0.1);
    engine.setControlKey("a", false);

    assert.ok(
      internal.carYaw > initialYaw,
      `Forward + LEFT (A) must increase carYaw to steer left (got ${internal.carYaw}, initial was ${initialYaw})`,
    );
    assert.ok(
      internal.carPosition.x > initialPosX,
      `Forward + LEFT (A) must move vehicle X toward world +X (screen left) (got ${internal.carPosition.x})`,
    );
    assert.ok(
      internal.car.frontWheels[0].rotation.y > 0,
      `Front wheels must visually turn left with positive steering angle (got ${internal.car.frontWheels[0].rotation.y})`,
    );

    // Verify projection onto camera screen: +X world is screen left (negative NDC x)
    internal.updateCamera(0.016);
    const carFront = new THREE.Vector3(
      internal.carPosition.x + Math.sin(internal.carYaw) * 4,
      internal.carPosition.y,
      internal.carPosition.z + Math.cos(internal.carYaw) * 4,
    );
    const projected = carFront.clone().project(internal.camera);
    assert.ok(
      projected.x < 0,
      `Vehicle front must project to screen LEFT (NDC x < 0) when steering left (got NDC x: ${projected.x})`,
    );
  } finally {
    engine.dispose();
  }
});

test("Vehicle Steering: Forward + RIGHT turns the vehicle right on screen and in world", () => {
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

    const initialYaw = internal.carYaw;
    const initialPosX = internal.carPosition.x;

    // Press RIGHT ('d')
    engine.setControlKey("d", true);
    internal.updateSedan(0.1);
    engine.setControlKey("d", false);

    assert.ok(
      internal.carYaw < initialYaw,
      `Forward + RIGHT (D) must decrease carYaw to steer right (got ${internal.carYaw}, initial was ${initialYaw})`,
    );
    assert.ok(
      internal.carPosition.x < initialPosX,
      `Forward + RIGHT (D) must move vehicle X toward world -X (screen right) (got ${internal.carPosition.x})`,
    );
    assert.ok(
      internal.car.frontWheels[0].rotation.y < 0,
      `Front wheels must visually turn right with negative steering angle (got ${internal.car.frontWheels[0].rotation.y})`,
    );

    internal.updateCamera(0.016);
    const carFront = new THREE.Vector3(
      internal.carPosition.x + Math.sin(internal.carYaw) * 4,
      internal.carPosition.y,
      internal.carPosition.z + Math.cos(internal.carYaw) * 4,
    );
    const projected = carFront.clone().project(internal.camera);
    assert.ok(
      projected.x > 0,
      `Vehicle front must project to screen RIGHT (NDC x > 0) when steering right (got NDC x: ${projected.x})`,
    );
  } finally {
    engine.dispose();
  }
});

test("Vehicle Steering: Forward without steering preserves current heading", () => {
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
    internal.carYaw = 0.42;
    internal.carSpeed = 12;

    const headingBefore = internal.carYaw;
    internal.updateSedan(0.1);
    assert.ok(Math.abs(internal.carYaw - headingBefore) < 1e-6, "Car maintains heading when no steering key is pressed");
    assert.equal(internal.car.frontWheels[0].rotation.y, 0, "Steering angle must be zero when not steering");
  } finally {
    engine.dispose();
  }
});

test("Vehicle Steering: Reverse driving steers rear consistently with control scheme", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    // 1. Reverse + LEFT: steering wheel turned left while reversing backs into the left spot
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = -5;

    engine.setControlKey("a", true);
    internal.updateSedan(0.1);
    engine.setControlKey("a", false);

    assert.ok(
      internal.carPosition.x > 0,
      `Reverse + LEFT (A) must move vehicle rear to the left (world +X) (got ${internal.carPosition.x})`,
    );
    assert.ok(
      internal.car.frontWheels[0].rotation.y > 0,
      `Front wheels must remain pointed left during reverse left steering (got ${internal.car.frontWheels[0].rotation.y})`,
    );

    // 2. Reverse + RIGHT: steering wheel turned right while reversing backs into the right spot
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = -5;

    engine.setControlKey("d", true);
    internal.updateSedan(0.1);
    engine.setControlKey("d", false);

    assert.ok(
      internal.carPosition.x < 0,
      `Reverse + RIGHT (D) must move vehicle rear to the right (world -X) (got ${internal.carPosition.x})`,
    );
    assert.ok(
      internal.car.frontWheels[0].rotation.y < 0,
      `Front wheels must remain pointed right during reverse right steering (got ${internal.car.frontWheels[0].rotation.y})`,
    );
  } finally {
    engine.dispose();
  }
});

test("Vehicle Steering: All 6 vehicle types (Sedan, Keke, Van, Pickup, Minibus, Truck) obey consistent steering", () => {
  const browser = installBrowserStubs();
  const engine = new GameEngine(
    browser.canvas,
    { onSnapshot: () => {} },
    browser.rendererFactory,
  );
  const internal = engine as any;

  try {
    const vehicles = [
      {
        name: "keke",
        setSpeed: (s: number) => { internal.kekeSpeed = s; },
        getYaw: () => internal.kekeYaw,
        setYaw: (y: number) => { internal.kekeYaw = y; },
        update: (dt: number) => internal.updateKeke(dt),
        getSteerVisual: () => internal.keke.frontFork.rotation.y,
      },
      {
        name: "van",
        setSpeed: (s: number) => { internal.vanSpeed = s; },
        getYaw: () => internal.vanYaw,
        setYaw: (y: number) => { internal.vanYaw = y; },
        update: (dt: number) => internal.updateVan(dt),
        getSteerVisual: () => internal.van.frontWheels[0].rotation.y,
      },
      {
        name: "pickup",
        setSpeed: (s: number) => { internal.pickupSpeed = s; },
        getYaw: () => internal.pickupYaw,
        setYaw: (y: number) => { internal.pickupYaw = y; },
        update: (dt: number) => internal.updatePickup(dt),
        getSteerVisual: () => internal.pickup.frontWheels[0].rotation.y,
      },
      {
        name: "minibus",
        setSpeed: (s: number) => { internal.minibusSpeed = s; },
        getYaw: () => internal.minibusYaw,
        setYaw: (y: number) => { internal.minibusYaw = y; },
        update: (dt: number) => internal.updateMinibus(dt),
        getSteerVisual: () => internal.minibus.frontWheels[0].rotation.y,
      },
      {
        name: "truck",
        setSpeed: (s: number) => { internal.truckSpeed = s; },
        getYaw: () => internal.truckYaw,
        setYaw: (y: number) => { internal.truckYaw = y; },
        update: (dt: number) => internal.updateTruck(dt),
        getSteerVisual: () => internal.truck.frontWheels[0].rotation.y,
      },
    ];

    for (const v of vehicles) {
      // Test Forward + Left
      v.setSpeed(8);
      v.setYaw(0);
      engine.setControlKey("a", true);
      v.update(0.1);
      engine.setControlKey("a", false);
      assert.ok(v.getYaw() > 0, `${v.name} yaw must increase when steering left (got ${v.getYaw()})`);
      assert.ok(v.getSteerVisual() > 0, `${v.name} wheel/fork must turn left when steering left`);

      // Test Forward + Right
      v.setSpeed(8);
      v.setYaw(0);
      engine.setControlKey("d", true);
      v.update(0.1);
      engine.setControlKey("d", false);
      assert.ok(v.getYaw() < 0, `${v.name} yaw must decrease when steering right (got ${v.getYaw()})`);
      assert.ok(v.getSteerVisual() < 0, `${v.name} wheel/fork must turn right when steering right`);
    }
  } finally {
    engine.dispose();
  }
});

test("Vehicle Steering: Chase camera follows vehicle without 180-degree flip during reverse", () => {
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

    // Driving forward camera position
    internal.carSpeed = 10;
    internal.updateCamera(0.1);
    const forwardCamZ = internal.camera.position.z;
    assert.ok(forwardCamZ < 0, `Forward chase camera must be behind the vehicle at negative Z (got ${forwardCamZ})`);

    // Reversing camera position
    internal.carSpeed = -5;
    internal.updateCamera(0.1);
    const reverseCamZ = internal.camera.position.z;
    assert.ok(
      reverseCamZ < 0,
      `Reverse chase camera must remain behind the vehicle at negative Z, not flip to positive Z (got ${reverseCamZ})`,
    );
  } finally {
    engine.dispose();
  }
});
