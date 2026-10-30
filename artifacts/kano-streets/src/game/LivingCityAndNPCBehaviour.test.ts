import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PedestrianSystem, getDiurnalPhase } from "./PedestrianSystem";
import { TrafficSystem, VEHICLE_CONFIGS } from "./TrafficSystem";
import { AudioSystem } from "./audioSystem";
import { createMaterials } from "./materials";
import { buildNavigationNetwork } from "./navigation";
import { ColliderIndex } from "./ColliderIndex";
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
    requestPointerLock() {},
    style: {},
  } as unknown as HTMLCanvasElement;

  const renderer = {
    pixelRatio: 1,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
  };

  return {
    canvas,
    rendererFactory: () => renderer as unknown as THREE.WebGLRenderer,
  };
}

const { canvas, rendererFactory } = installBrowserStubs();

test("Phase 8 - Goal 1: Pedestrians maintain stable upright posture across all animations and states", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();
  const surfaceHeight = () => 0;

  const system = new PedestrianSystem(scene, materials, network, colliderIndex, surfaceHeight);
  system.setQuality("quality");

  const playerPos = new THREE.Vector3(0, 0, 0);

  // Step simulation for 60 frames (1 second)
  for (let step = 0; step < 60; step++) {
    system.update(0.016, playerPos, null);
  }

  assert.ok(system.pedestrians.length >= 18, `Should have active crowd of pedestrians`);

  for (const p of system.pedestrians) {
    // Model root rotation must have pitch=0, roll=0 (completely upright)
    assert.equal(
      p.model.root.rotation.x,
      0,
      `Pedestrian ${p.name} root pitch (rotation.x) must be 0, got ${p.model.root.rotation.x}`,
    );
    assert.equal(
      p.model.root.rotation.z,
      0,
      `Pedestrian ${p.name} root roll (rotation.z) must be 0, got ${p.model.root.rotation.z}`,
    );

    // Procedural body must also remain upright
    assert.equal(
      p.model.proceduralBody.rotation.x,
      0,
      `Pedestrian ${p.name} proceduralBody pitch must be 0`,
    );
    assert.equal(
      p.model.proceduralBody.rotation.z,
      0,
      `Pedestrian ${p.name} proceduralBody roll must be 0`,
    );

    // Rigged character (if present) must also be upright
    if (p.model.riggedCharacter) {
      assert.equal(
        p.model.riggedCharacter.rotation.x,
        0,
        `Pedestrian ${p.name} riggedCharacter pitch must be 0`,
      );
      assert.equal(
        p.model.riggedCharacter.rotation.z,
        0,
        `Pedestrian ${p.name} riggedCharacter roll must be 0`,
      );
    }
  }

  system.dispose();
});

test("Phase 8 - Goal 2: Pedestrians maintain exact ground contact without floating or sinking", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();
  // Elevation function simulating natural Kano undulations
  const surfaceHeight = (x: number, z: number) => Math.sin(x * 0.05) * 0.5 + Math.cos(z * 0.05) * 0.3;

  const system = new PedestrianSystem(scene, materials, network, colliderIndex, surfaceHeight);
  system.setQuality("balanced");

  const playerPos = new THREE.Vector3(0, 0, 0);

  for (let step = 0; step < 30; step++) {
    system.update(0.016, playerPos, null);
  }

  for (const p of system.pedestrians) {
    const expectedGroundY = surfaceHeight(p.position.x, p.position.z);
    if (p.state === "sitting") {
      // Sitting pedestrians are placed on clay bench (+0.35m)
      assert.ok(
        Math.abs(p.position.y - (expectedGroundY + 0.35)) < 0.001,
        `Sitting elder ${p.name} position.y must be groundY + 0.35`,
      );
    } else {
      assert.ok(
        Math.abs(p.position.y - expectedGroundY) < 0.001,
        `Pedestrian ${p.name} position.y (${p.position.y.toFixed(3)}) must exactly equal surfaceHeight (${expectedGroundY.toFixed(3)})`,
      );
    }
  }

  system.dispose();
});

test("Phase 8 - Goal 3: Obstacle and vehicle avoidance detects blocks and prevents pedestrian collision", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([
    { x: 10, z: 10, halfX: 2, halfZ: 2, height: 3 },
  ]);
  const scene = new THREE.Scene();

  const system = new PedestrianSystem(scene, materials, network, colliderIndex);

  // Position inside the static building collider
  assert.equal(
    system.isPositionBlocked(10, 10, 0.35),
    true,
    "Position inside building collider must be detected as blocked",
  );

  // Clear position away from collider
  assert.equal(
    system.isPositionBlocked(25, 25, 0.35),
    false,
    "Clear sidewalk position must not be blocked",
  );

  // Simulate nearby traffic vehicle at (20, 20)
  system.setTrafficVehicles([
    { position: new THREE.Vector3(20, 0, 20), speed: 5, yaw: 0 },
  ]);

  assert.equal(
    system.isPositionBlocked(20.5, 20.5, 0.35),
    true,
    "Position directly overlapping traffic vehicle must be detected as blocked",
  );

  // Position outside vehicle clearance radius
  assert.equal(
    system.isPositionBlocked(25, 20, 0.35),
    false,
    "Position clear of vehicle must not be blocked",
  );

  system.dispose();
});

test("Phase 8 - Goal 4: Pedestrian-to-pedestrian personal space prevents crowding and overlapping", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();

  const system = new PedestrianSystem(scene, materials, network, colliderIndex);

  // Filter walkers
  const walkers = system.pedestrians.filter((p) => p.state === "walking");
  assert.ok(walkers.length >= 2, "Must have at least 2 walkers");

  // Intentionally place two pedestrians very close (< 0.5m apart) walking parallel in Z
  const p1 = walkers[0];
  const p2 = walkers[1];
  p1.position.set(0, 0, 0);
  p2.position.set(0.3, 0, 0);
  p1.yaw = 0;
  p2.yaw = 0;
  p1.speed = 1.0;
  p2.speed = 1.0;
  p1.targetWaypoint = null;
  p2.targetWaypoint = null;

  const initialDist = p1.position.distanceTo(p2.position);
  assert.ok(initialDist < 0.5, "Initially placed very close");

  // Step simulation for 15 frames
  for (let s = 0; s < 15; s++) {
    system.update(0.016, p1.position.clone(), null);
  }

  const finalDist = p1.position.distanceTo(p2.position);
  assert.ok(
    finalDist > initialDist,
    `Separation force must push pedestrians apart: initial=${initialDist.toFixed(3)}m, final=${finalDist.toFixed(3)}m`,
  );

  system.dispose();
});

test("Phase 8 - Goal 5: Diurnal routine phases transition destinations dynamically without teleportation", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();

  const system = new PedestrianSystem(scene, materials, network, colliderIndex);

  // Verify diurnal phase resolver
  assert.equal(getDiurnalPhase(7.5), "commute", "07:30 must be commute phase");
  assert.equal(getDiurnalPhase(12.0), "work", "12:00 must be work phase");
  assert.equal(getDiurnalPhase(18.5), "leisure", "18:30 must be leisure phase");
  assert.equal(getDiurnalPhase(23.0), "rest", "23:00 must be rest phase");
  assert.equal(getDiurnalPhase(3.0), "rest", "03:00 must be rest phase");

  // Find Ibrahim Garba
  const ibrahim = system.pedestrians.find((p) => p.name === "Ibrahim Garba");
  assert.ok(ibrahim, "Ibrahim Garba must be present in pedestrian crowd");
  assert.ok(ibrahim.schedule, "Ibrahim must have a routine schedule");

  // Set morning commute (08:00)
  system.setTimeOfDay(8.0);
  const posBefore = ibrahim.position.clone();
  system.update(0.016, ibrahim.position.clone(), null);

  assert.equal(ibrahim.schedulePhase, "commute");
  assert.equal(ibrahim.destinationName, "Murtala Mohammed Way Transit Stop");
  // Position must not have teleported
  assert.ok(
    ibrahim.position.distanceTo(posBefore) < 0.1,
    "Position must not teleport when schedule phase changes",
  );

  // Transition to afternoon work (12:00)
  system.setTimeOfDay(12.0);
  system.update(0.016, ibrahim.position.clone(), null);
  assert.equal(ibrahim.schedulePhase, "work");
  assert.equal(ibrahim.destinationName, "Arewa Commercial Bank Plaza");

  // Transition to evening leisure (19:00)
  system.setTimeOfDay(19.0);
  system.update(0.016, ibrahim.position.clone(), null);
  assert.equal(ibrahim.schedulePhase, "leisure");
  assert.equal(ibrahim.destinationName, "Dandali Community Square");

  // Transition to night rest (23:00)
  system.setTimeOfDay(23.0);
  system.update(0.016, ibrahim.position.clone(), null);
  assert.equal(ibrahim.schedulePhase, "rest");
  assert.equal(ibrahim.destinationName, "Bompai Heights Luxury Flats");
  assert.equal(ibrahim.schedulePhase, "rest");
  assert.equal(ibrahim.destinationName, "Bompai Heights Luxury Flats");

  system.dispose();
});

test("Phase 8 - Goal 6: Traffic maintains following distance and decelerates queue smoothly", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);
  traffic.setQuality("balanced");

  assert.ok(traffic.vehicles.length >= 4, "Must have active vehicle fleet");

  const lead = traffic.vehicles[0];
  const trail = traffic.vehicles[1];

  // Align trail directly behind lead
  trail.position.set(lead.position.x, lead.position.y, lead.position.z - 8.0);
  trail.yaw = lead.yaw;
  trail.speed = lead.cruisingSpeed;
  lead.speed = 0; // Lead stopped at a junction

  // Update traffic for a few frames
  for (let s = 0; s < 10; s++) {
    traffic.update(0.016, new THREE.Vector3(100, 0, 100), null, 0);
  }

  assert.ok(
    trail.speed < trail.cruisingSpeed,
    `Trailing vehicle must decelerate when approaching stopped lead: speed=${trail.speed.toFixed(2)} vs cruising=${trail.cruisingSpeed.toFixed(2)}`,
  );

  traffic.dispose();
});

test("Phase 8 - Goal 7: Traffic yields smoothly to pedestrians crossing the road", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);
  const vehicle = traffic.vehicles[0];
  vehicle.speed = vehicle.cruisingSpeed;

  // Place pedestrian directly in the lane 6m ahead of the vehicle
  const forward = new THREE.Vector3(Math.sin(vehicle.yaw), 0, Math.cos(vehicle.yaw));
  const pedPos = vehicle.position.clone().addScaledVector(forward, 6.0);

  // Update with pedestrian in path for several frames to allow smooth braking deceleration
  for (let f = 0; f < 25; f++) {
    traffic.update(
      0.016,
      vehicle.position.clone(),
      null,
      0,
      [{ position: pedPos }],
    );
  }

  assert.ok(
    vehicle.speed < vehicle.cruisingSpeed * 0.6,
    `Vehicle must decelerate when pedestrian is in forward path, got speed ${vehicle.speed.toFixed(2)}`,
  );

  traffic.dispose();
});

test("Phase 8 - Goal 8: Traffic forward lookahead decelerates before contacting parked vehicles", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);

  assert.ok(traffic.parkedVehicles.length > 0, "Must have parked vehicles registered");
  const parked = traffic.parkedVehicles[0];

  const vehicle = traffic.vehicles[0];
  vehicle.speed = vehicle.cruisingSpeed;

  // Position vehicle pointing directly at parked vehicle 5m away
  vehicle.position.set(parked.position.x, parked.position.y, parked.position.z - 5.0);
  vehicle.yaw = 0; // Looking along +Z toward parked vehicle

  for (let f = 0; f < 25; f++) {
    traffic.update(0.016, vehicle.position.clone(), null, 0);
  }

  assert.ok(
    vehicle.speed < vehicle.cruisingSpeed * 0.7,
    `Vehicle must decelerate before hitting parked vehicle ahead, got ${vehicle.speed.toFixed(2)}`,
  );

  traffic.dispose();
});

test("Phase 8 - Goal 9: Traffic stuck recovery engages reverse gear and avoids gridlock", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  // Place collider directly covering vehicle
  const colliderIndex = new ColliderIndex([
    { x: 0, z: 0, halfX: 3, halfZ: 3, height: 3 },
  ]);
  const scene = new THREE.Scene();

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);
  const v = traffic.vehicles[0];
  v.position.set(0, 0, 0);
  v.speed = 0;

  // Simulate being stuck for 3 seconds
  for (let s = 0; s < 180; s++) {
    traffic.update(0.016, v.position.clone(), null, 0);
    if (v.isRecovering) break;
  }

  assert.ok(
    v.isRecovering || v.recoveryAttempts > 0,
    "Stuck vehicle must engage recovery mode when blocked",
  );

  traffic.dispose();
});

test("Phase 8 - Goal 10: Street life and food vendor audio sizzle modulates with distance and time of day", () => {
  const audio = new AudioSystem(false, 0.7);

  // Arewa Suya Lounge is at (16, -42)
  const suyaLoc = { x: 16, z: -42 };

  // Near Suya Lounge during evening dining hours (20:00)
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: suyaLoc,
    timeOfDayHours: 20.0,
    isInterior: false,
  });

  const eveningGain = audio.getStreetBustleGain();
  assert.ok(
    eveningGain >= 0.15,
    `Evening bustle gain near Suya Lounge should be strong (>= 0.15), got ${eveningGain.toFixed(3)}`,
  );

  // 60m away from any food hub
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: { x: 100, z: 100 },
    timeOfDayHours: 20.0,
    isInterior: false,
  });

  const distantGain = audio.getStreetBustleGain();
  assert.equal(distantGain, 0, "Street bustle gain must be 0 beyond 45m falloff range");

  // Indoors reduction
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: suyaLoc,
    timeOfDayHours: 20.0,
    isInterior: true,
  });

  const indoorGain = audio.getStreetBustleGain();
  assert.ok(
    indoorGain < eveningGain * 0.25,
    `Indoors gain should be muffled (<= 25% of outdoor), got ${indoorGain.toFixed(3)}`,
  );

  audio.dispose();
});

test("Phase 8 - Goal 11: Regression safety - driving views, camera V key, F9 diagnostics, and interiors", () => {
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {}, onResume: () => {} },
    rendererFactory,
  );
  const internal = engine as any;

  try {
    // 1. Verify F9 camera debug info
    const debug = engine.getCameraDebugInfo();
    assert.ok(debug, "Camera debug info must be populated");
    assert.equal(typeof debug.cameraMode, "string");
    assert.equal(typeof debug.isIndoors, "boolean");

    // 2. Verify driving view V-cycling
    internal.mode = "driving";
    internal.activeVehicle = "sedan";
    assert.equal(engine.getCameraMode(), "third-person");

    engine.toggleCameraMode();
    assert.equal(engine.getCameraMode(), "road-focused", "First V toggle switches to road-focused");

    engine.toggleCameraMode();
    assert.equal(engine.getCameraMode(), "first-person", "Second V toggle switches to cockpit");

    engine.toggleCameraMode();
    assert.equal(engine.getCameraMode(), "third-person", "Third V toggle wraps back to chase");

    // 3. Fast travel inside Unit 2B
    engine.leaseProperty("unit-2b");
    const tpResult = engine.teleportHome("interior");
    assert.ok(tpResult.success, "Teleport home must succeed");
    assert.equal(internal.interiorManager.activeInterior, "apartment");
    assert.ok(internal.playerPosition.y < -50, "Player must be inside Unit 2B apartment floor");
  } finally {
    engine.dispose();
  }
});
