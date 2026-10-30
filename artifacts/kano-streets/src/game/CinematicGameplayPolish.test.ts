import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { GameEngine } from "./GameEngine";

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

test("Phase 6.5 Polish: Dynamic Vehicle Suspension pitch and body roll respond to acceleration, braking and steering", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {} }, rendererFactory);
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = 0;

    // 1. Acceleration Squat: Press W (Throttle)
    engine.setControlKey("w", true);
    for (let i = 0; i < 10; i++) {
      internal.updateCar(0.05);
    }
    engine.setControlKey("w", false);
    assert.ok(
      internal.vehicleChassisPitch < 0,
      `Chassis pitch must squat backward during acceleration (pitch: ${internal.vehicleChassisPitch})`,
    );

    // 2. Braking Dive: Car is moving forward, press S (Brakes)
    internal.carSpeed = 12.0;
    engine.setControlKey("s", true);
    for (let i = 0; i < 10; i++) {
      internal.updateCar(0.05);
    }
    engine.setControlKey("s", false);
    assert.ok(
      internal.vehicleChassisPitch > 0,
      `Chassis pitch must dive forward during braking (pitch: ${internal.vehicleChassisPitch})`,
    );

    // 3. Centrifugal Body Roll: Steer Left while moving at speed
    internal.carSpeed = 10.0;
    engine.setControlKey("a", true);
    for (let i = 0; i < 10; i++) {
      internal.updateCar(0.05);
    }
    engine.setControlKey("a", false);
    assert.ok(
      internal.vehicleChassisRoll < 0,
      `Chassis must roll outward when steering left (roll: ${internal.vehicleChassisRoll})`,
    );

    // 4. Recovery to Level: Cruising without inputs damps pitch & roll back towards zero
    for (let i = 0; i < 30; i++) {
      internal.updateCar(0.05);
    }
    assert.ok(
      Math.abs(internal.vehicleChassisPitch) < 0.005,
      `Chassis pitch must return towards zero when settled (pitch: ${internal.vehicleChassisPitch})`,
    );
    assert.ok(
      Math.abs(internal.vehicleChassisRoll) < 0.005,
      `Chassis roll must return towards zero when settled (roll: ${internal.vehicleChassisRoll})`,
    );

    // 5. Vehicle Exit Reset: Exiting vehicle cleanly zeroes pitch and roll
    internal.toggleVehicle();
    assert.equal(internal.mode, "on-foot");
    assert.equal(internal.vehicleChassisPitch, 0);
    assert.equal(internal.vehicleChassisRoll, 0);
    assert.equal(internal.car.root.rotation.x, 0);
    assert.equal(internal.car.root.rotation.z, 0);
  } finally {
    engine.dispose();
  }
});

test("Phase 6.5 Polish: Cinematic Chase Camera dynamically adapts FOV, distance and trailing yaw with vehicle speed", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {} }, rendererFactory);
  const internal = engine as any;

  try {
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    internal.carPosition.set(0, 0, 0);
    internal.carYaw = 0;
    internal.carSpeed = 0;

    // Baseline stationary camera
    internal.updateCamera(0.016);
    const stationaryFov = internal.camera.fov;
    const stationaryDist = internal.camera.position.distanceTo(internal.carPosition);

    // High speed driving (18.0 m/s ~ 65 km/h)
    internal.carSpeed = 18.0;
    for (let i = 0; i < 20; i++) {
      internal.updateCamera(0.05);
    }

    const highSpeedFov = internal.camera.fov;
    const highSpeedDist = internal.camera.position.distanceTo(internal.carPosition);

    assert.ok(
      highSpeedFov > stationaryFov,
      `Camera FOV must expand at high speed for cinematic sensation (stationary: ${stationaryFov}, high-speed: ${highSpeedFov})`,
    );
    assert.ok(
      highSpeedDist > stationaryDist,
      `Camera follow distance must pull back at high speed (stationary: ${stationaryDist}, high-speed: ${highSpeedDist})`,
    );

    // Elastic follow yaw trailing lag
    internal.carYaw = 0.5; // Vehicle rapidly turns heading
    internal.updateCamera(0.016);
    assert.ok(
      internal.drivingFollowYaw < internal.carYaw,
      `Camera drivingFollowYaw must elastically trail vehicle yaw (drivingFollowYaw: ${internal.drivingFollowYaw}, carYaw: ${internal.carYaw})`,
    );
  } finally {
    engine.dispose();
  }
});

test("Phase 6.5 Polish: Diurnal Streetlight & Window Glow transition smoothly across twilight without abrupt popping", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {} }, rendererFactory);
  const internal = engine as any;

  try {
    // 1. Midday (12:00) - Sun high overhead, lamps unlit
    internal.gameMinutes = 12 * 60;
    internal.updateLighting();
    const middayIntensity = internal.materials.lampGlow.emissiveIntensity;
    assert.ok(middayIntensity <= 0.25, `Midday lamp emissive must be minimal (got ${middayIntensity})`);

    // 2. Sunset Golden Hour (18:00) - Dusk ramp begins smoothly
    internal.gameMinutes = 18 * 60;
    internal.updateLighting();
    const goldenHourIntensity = internal.materials.lampGlow.emissiveIntensity;
    assert.ok(
      goldenHourIntensity > middayIntensity,
      `Golden hour lamp intensity must rise smoothly above midday (got ${goldenHourIntensity})`,
    );

    // 3. Late Dusk (19:00) - Continuous photocell warm-up
    internal.gameMinutes = 19 * 60;
    internal.updateLighting();
    const duskIntensity = internal.materials.lampGlow.emissiveIntensity;
    assert.ok(
      duskIntensity > goldenHourIntensity && duskIntensity < 2.5,
      `Dusk intensity must smoothly progress between golden hour and night (got ${duskIntensity})`,
    );

    // 4. Starlit Night (22:00) - Full illumination
    internal.gameMinutes = 22 * 60;
    internal.updateLighting();
    const nightIntensity = internal.materials.lampGlow.emissiveIntensity;
    assert.ok(
      nightIntensity > 2.0,
      `Night lamp intensity must reach full brightness (> 2.0, got ${nightIntensity})`,
    );
  } finally {
    engine.dispose();
  }
});

