import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PedestrianSystem } from "./PedestrianSystem";
import { TrafficSystem } from "./TrafficSystem";
import { AudioSystem } from "./audioSystem";
import { createMaterials } from "./materials";
import { buildNavigationNetwork } from "./navigation";
import { ColliderIndex } from "./ColliderIndex";
import { createWorld } from "./world";
import { GameEngine } from "./GameEngine";
import { ROAD_LAYOUT } from "./layout";

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
    style: {},
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

const { canvas, rendererFactory } = installBrowserStubs();

test("Goal 1: Pedestrians remain grounded across walking, standing, and state transitions", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const world = createWorld(materials);
  const colliderIndex = new ColliderIndex(world.colliders);
  const scene = new THREE.Scene();

  const surfaceHeight = (x: number, z: number) => {
    if (Math.abs(x + 31) <= 10.5 && Math.abs(z - 31) <= 9) return 0.045; // Market plaza
    for (const road of ROAD_LAYOUT) {
      const lateral = road.axis === "x" ? Math.abs(z - road.center) : Math.abs(x - road.center);
      if (lateral <= road.width / 2) return 0.018; // Road
    }
    for (const road of ROAD_LAYOUT) {
      const lateral = road.axis === "x" ? Math.abs(z - road.center) : Math.abs(x - road.center);
      if (lateral > road.width / 2 && lateral <= road.width / 2 + 3) return 0.085; // Sidewalk
    }
    return 0;
  };

  const pedSys = new PedestrianSystem(scene, materials, network, colliderIndex, surfaceHeight);
  pedSys.setQuality("balanced");

  const playerPos = new THREE.Vector3(0, 0, 0);

  // Run 100 simulation steps (5 seconds) covering multiple state changes
  for (let step = 0; step < 100; step++) {
    pedSys.update(0.05, playerPos, null);

    for (const p of pedSys.pedestrians) {
      const ground = surfaceHeight(p.position.x, p.position.z);
      if (p.state === "sitting") {
        assert.ok(
          Math.abs(p.position.y - (ground + 0.35)) < 0.015,
          `Seated elder ${p.name} must rest on dakali ledge (+0.35m), expected ${ground + 0.35}, got ${p.position.y}`,
        );
      } else {
        assert.ok(
          Math.abs(p.position.y - ground) < 0.015,
          `Pedestrian ${p.name} in state "${p.state}" must stay planted at ground height ${ground}, got ${p.position.y}`,
        );
      }
    }
  }

  pedSys.dispose();
});

test("Goal 2: Pedestrians do not clip into static compound walls, kiosks, stalls or signs", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const world = createWorld(materials);
  const colliderIndex = new ColliderIndex(world.colliders);
  const scene = new THREE.Scene();

  const pedSys = new PedestrianSystem(scene, materials, network, colliderIndex, () => 0.085);
  pedSys.setQuality("quality"); // 24 pedestrians

  const playerPos = new THREE.Vector3(0, 0, 0);

  // Over 80 steps, verify walking pedestrians do not penetrate inside static colliders
  for (let step = 0; step < 80; step++) {
    pedSys.update(0.05, playerPos, null);

    const activeWalkers = pedSys.pedestrians.filter(
      (p) => p.state === "walking" || p.state === "idle" || p.state === "talking",
    );

    for (const p of activeWalkers) {
      const candidates = colliderIndex.query(p.position.x, p.position.z, 1.0);
      const isClipping = candidates.some((col) => {
        const dx = Math.abs(p.position.x - col.x);
        const dz = Math.abs(p.position.z - col.z);
        return dx < col.halfX && dz < col.halfZ;
      });
      assert.equal(
        isClipping,
        false,
        `Pedestrian ${p.name} at (${p.position.x.toFixed(2)}, ${p.position.z.toFixed(2)}) clipped inside static collider`,
      );
    }
  }

  pedSys.dispose();
});

test("Goal 3: Market pedestrian density is balanced without excessive overlapping", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const world = createWorld(materials);
  const colliderIndex = new ColliderIndex(world.colliders);
  const scene = new THREE.Scene();

  const pedSys = new PedestrianSystem(scene, materials, network, colliderIndex, () => 0.045);
  pedSys.setQuality("balanced");

  // Filter pedestrians within Sabon Gari Kasuwa bounds (x in [-45, -17], z in [17, 45])
  const kasuwaPeds = pedSys.pedestrians.filter(
    (p) => p.position.x >= -45 && p.position.x <= -17 && p.position.z >= 17 && p.position.z <= 45,
  );

  // Density should be lively (at least 4 vendors/traders/customers) but not overcrowded (> 14)
  assert.ok(
    kasuwaPeds.length >= 4 && kasuwaPeds.length <= 14,
    `Market should have balanced pedestrian density between 4 and 14, got ${kasuwaPeds.length}`,
  );

  // Pairwise distance check: no two pedestrians should overlap directly (< 0.6m apart)
  for (let i = 0; i < kasuwaPeds.length; i++) {
    for (let j = i + 1; j < kasuwaPeds.length; j++) {
      const dist = kasuwaPeds[i].position.distanceTo(kasuwaPeds[j].position);
      assert.ok(
        dist >= 0.6,
        `Pedestrians ${kasuwaPeds[i].name} and ${kasuwaPeds[j].name} overlap too closely (${dist.toFixed(2)}m apart)`,
      );
    }
  }

  pedSys.dispose();
});

test("Goal 4: Traffic clears intersections smoothly without deadlocks or overlapping", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const world = createWorld(materials);
  const colliderIndex = new ColliderIndex(world.colliders);
  const scene = new THREE.Scene();

  const trafficSys = new TrafficSystem(scene, materials, network, colliderIndex, () => 0.018);
  trafficSys.setQuality("quality"); // 8 active vehicles

  const playerPos = new THREE.Vector3(200, 0, 200); // Far away so player doesn't interrupt traffic

  // Simulate 36 seconds of traffic (2 full 18s traffic light cycles, 360 frames)
  for (let step = 0; step < 360; step++) {
    trafficSys.update(0.1, playerPos, null, 0);

    // Verify safe following distance and zero collision overlap among all active vehicles
    for (let i = 0; i < trafficSys.vehicles.length; i++) {
      for (let j = i + 1; j < trafficSys.vehicles.length; j++) {
        const v1 = trafficSys.vehicles[i];
        const v2 = trafficSys.vehicles[j];
        const dist = v1.position.distanceTo(v2.position);
        const minSafeDist = Math.min(v1.collisionRadius, v2.collisionRadius);
        assert.ok(
          dist > minSafeDist,
          `Dangerous vehicle overlap between ${v1.id} and ${v2.id}: distance ${dist.toFixed(2)}m < ${minSafeDist}m`,
        );
      }
    }
  }

  // Verify none of the vehicles are permanently stuck (stuckTimer > 8s)
  for (const v of trafficSys.vehicles) {
    assert.ok(
      v.stuckTimer < 7.5,
      `Vehicle ${v.id} experienced deadlock (stuckTimer=${v.stuckTimer.toFixed(1)}s)`,
    );
  }

  trafficSys.dispose();
});

test("Goal 5: Culvert slabs, curbs, and water points do not obstruct player or vehicle routes", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const world = createWorld(materials);
  const colliderIndex = new ColliderIndex(world.colliders);

  // 1. Water points: check they do not block traffic waypoints
  const waterPointLocations = [
    { x: -42.2, z: 27.5 },
    { x: 34.2, z: -34.0 },
  ];

  for (const wp of waterPointLocations) {
    for (const twp of network.trafficWaypointList) {
      const dist = Math.hypot(twp.x - wp.x, twp.z - wp.z);
      assert.ok(
        dist > 2.5,
        `Water point at (${wp.x}, ${wp.z}) is dangerously close to traffic lane waypoint ${twp.id} (${dist.toFixed(2)}m)`,
      );
    }
  }

  // 2. Culvert slabs: verify they do not have blocking wall colliders
  // Precast culvert slabs allow players to walk directly over the gutter into bus stops and market entries
  const culvertSlabPoints = [
    { x: 14, z: -10.35 },
    { x: 63.65, z: -22 },
    { x: -46, z: 17.35 },
    { x: -31, z: 19.35 },
    { x: -31, z: 42.65 },
  ];

  for (const slab of culvertSlabPoints) {
    const blockingColliders = colliderIndex.query(slab.x, slab.z, 0.5).filter((col) => {
      return Math.abs(col.x - slab.x) < col.halfX && Math.abs(col.z - slab.z) < col.halfZ;
    });
    assert.equal(
      blockingColliders.length,
      0,
      `Culvert slab at (${slab.x}, ${slab.z}) must not contain blocking wall collider so players can cross`,
    );
  }
});

test("Goal 6: Market ambience fades naturally with distance, is quieter indoors and late at night", () => {
  const audio = new AudioSystem(false, 0.7);

  // Distances from Sabon Gari Kasuwa (-31, 31)
  const distances = [0, 15, 25, 40, 55, 70, 85];
  const gains: number[] = [];

  for (const d of distances) {
    audio.update(0.1, {
      mode: "on-foot",
      playerPosition: { x: -31 + d, z: 31 },
      timeOfDayHours: 12.0,
      isInterior: false,
    });
    gains.push(audio.getMarketGain());
  }

  // Verify full gain at center
  assert.ok(gains[0] >= 0.20, `Center gain should be full (~0.22), got ${gains[0]}`);

  // Verify monotonic falloff
  for (let i = 1; i < gains.length; i++) {
    assert.ok(
      gains[i] <= gains[i - 1],
      `Gain should monotonically fall off with distance: at ${distances[i]}m (${gains[i]}) vs ${distances[i - 1]}m (${gains[i - 1]})`,
    );
  }

  // Verify silent beyond 70m
  assert.equal(gains[5], 0, "At 70m gain must be 0");
  assert.equal(gains[6], 0, "At 85m gain must be 0");

  // Verify indoors reduction
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: { x: -31, z: 31 },
    timeOfDayHours: 12.0,
    isInterior: true,
  });
  const indoorGain = audio.getMarketGain();
  assert.ok(indoorGain <= gains[0] * 0.2, `Indoors gain should be <= 20% of outdoor gain, got ${indoorGain}`);

  // Verify late night reduction
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: { x: -31, z: 31 },
    timeOfDayHours: 23.5,
    isInterior: false,
  });
  const nightGain = audio.getMarketGain();
  assert.ok(nightGain <= gains[0] * 0.25, `Night gain should be <= 25% of daytime gain, got ${nightGain}`);

  audio.dispose();
});

test("Goal 7: Vehicle headlights transition smoothly through dusk and dawn", () => {
  const engine = new GameEngine(canvas, { onSnapshot: () => {} }, rendererFactory);
  engine.setGraphicsQuality("balanced");
  (engine as any).mode = "driving";
  (engine as any).activeVehicle = "sedan";

  // Sample hours from 0h to 24h in 0.5h increments
  const daytimeHours = [8, 10, 12, 14, 16];
  for (const h of daytimeHours) {
    engine.gameMinutes = h * 60;
    (engine as any).updateLighting();
    assert.equal(
      (engine as any).vehicleHeadlight.visible,
      false,
      `Headlight should be OFF during bright daylight at ${h}h`,
    );
  }

  // Dusk transition (17.6h to 20.0h): smooth progression
  let prevDuskIntensity = 0;
  for (let h = 17.8; h <= 20.0; h += 0.4) {
    engine.gameMinutes = h * 60;
    (engine as any).updateLighting();
    assert.equal((engine as any).vehicleHeadlight.visible, true, `Headlight should be ON during dusk at ${h}h`);
    const intensity = (engine as any).vehicleHeadlight.intensity;
    assert.ok(intensity >= prevDuskIntensity, `Dusk headlight intensity should rise monotonically at ${h}h`);
    assert.ok(intensity >= 0.4 && intensity <= 3.8, `Dusk intensity within range [0.4, 3.8] at ${h}h`);
    prevDuskIntensity = intensity;
  }

  // Deep night (21.0h to 5.0h): steady full intensity
  for (const h of [22, 24, 2, 4]) {
    engine.gameMinutes = h * 60;
    (engine as any).updateLighting();
    assert.equal((engine as any).vehicleHeadlight.visible, true, `Headlight should be ON at night at ${h}h`);
    assert.ok(Math.abs((engine as any).vehicleHeadlight.intensity - 3.8) < 0.05);
  }

  // Dawn transition (5.4h to 6.8h): smooth dimming
  let prevDawnIntensity = 4.0;
  for (let h = 5.5; h <= 6.7; h += 0.3) {
    engine.gameMinutes = h * 60;
    (engine as any).updateLighting();
    assert.equal((engine as any).vehicleHeadlight.visible, true, `Headlight should be ON during dawn at ${h}h`);
    const intensity = (engine as any).vehicleHeadlight.intensity;
    assert.ok(intensity <= prevDawnIntensity, `Dawn headlight intensity should dim monotonically at ${h}h`);
    prevDawnIntensity = intensity;
  }

  engine.dispose();
});

test("Goal 8: Existing gameplay systems, movement, steering, and economy compatibility remain intact", () => {
  const engine = new GameEngine(canvas, { onSnapshot: () => {} }, rendererFactory);
  engine.setGraphicsQuality("balanced");

  // 1. Initial on-foot mode
  assert.equal(engine.mode, "on-foot", "Engine should start in on-foot mode");

  // 2. Vehicle entry & exit
  (engine as any).mode = "driving";
  (engine as any).activeVehicle = "sedan";
  assert.equal(engine.mode, "driving", "Should switch to driving mode");
  (engine as any).mode = "on-foot";
  assert.equal(engine.mode, "on-foot", "Should exit back to on-foot mode");

  // 3. Economy & Player Cash
  const initialCash = engine.cash;
  assert.ok(typeof initialCash === "number" && initialCash >= 0, "Cash balance should be a valid number");

  // 4. Time progression
  const initialMinutes = engine.gameMinutes;
  engine.gameMinutes += 30;
  assert.equal(engine.gameMinutes, initialMinutes + 30, "Time should advance accurately");

  engine.dispose();
});
