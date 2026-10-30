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

test("Phase 6.7: Pedestrian Grounding, Foot Planting & Hub Clustering", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();

  const mockSurfaceHeight = (x: number, z: number) => {
    // Sidewalk height 0.085m, road 0.018m, terrain 0
    if (Math.abs(x - 14) < 4) return 0.085;
    if (Math.abs(z - 31) < 10) return 0.045;
    return 0;
  };

  const pedSys = new PedestrianSystem(scene, materials, network, colliderIndex, mockSurfaceHeight);
  pedSys.setQuality("balanced");

  assert.ok(pedSys.pedestrians.length >= 18, "Balanced quality should spawn at least 18 pedestrians");

  // Verify all pedestrians are upright and accurately grounded to surface height
  for (const p of pedSys.pedestrians) {
    const expectedGround = mockSurfaceHeight(p.position.x, p.position.z);
    if (p.state === "sitting") {
      assert.ok(
        Math.abs(p.position.y - (expectedGround + 0.35)) < 0.01,
        `Seated elder ${p.name} must rest on clay dakali ledge (+0.35m)`,
      );
    } else {
      assert.ok(
        Math.abs(p.position.y - expectedGround) < 0.01,
        `Pedestrian ${p.name} in state "${p.state}" must have feet planted at surface height ${expectedGround}, got ${p.position.y}`,
      );
    }
  }

  // Update pedestrians across 30 animation frames and verify grounding is strictly maintained
  const playerPos = new THREE.Vector3(0, 0, 0);
  for (let frame = 0; frame < 30; frame++) {
    pedSys.update(0.05, playerPos, null);
    for (const p of pedSys.pedestrians) {
      const currentSurface = mockSurfaceHeight(p.position.x, p.position.z);
      if (p.state === "sitting") {
        assert.ok(
          Math.abs(p.position.y - (currentSurface + 0.35)) < 0.01,
          `Seated elder ${p.name} must remain stably seated on dakali ledge`,
        );
      } else {
        assert.ok(
          Math.abs(p.position.y - currentSurface) < 0.01,
          `Pedestrian ${p.name} must remain grounded at surface height ${currentSurface}`,
        );
      }
    }
  }

  // Verify hub clustering: check that vendors, elders, and workers populate active Kano landmarks
  const hasKasuwaVendor = pedSys.pedestrians.some(
    (p) => p.state === "vendor" && Math.hypot(p.position.x - (-31), p.position.z - 31) < 20,
  );
  assert.ok(hasKasuwaVendor, "Sabon Gari Kasuwa must have active market vendors");

  const hasDandaliElder = pedSys.pedestrians.some(
    (p) => p.id.startsWith("dakali_elder_") && Math.hypot(p.position.x - (-72), p.position.z - (-72)) < 25,
  );
  assert.ok(hasDandaliElder, "Dandali Square must have seated clan elders on clay dakali");

  pedSys.dispose();
});

test("Phase 6.7: Traffic Anti-Gridlock & Intersection Clearance", () => {
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);
  const scene = new THREE.Scene();

  const trafficSys = new TrafficSystem(scene, materials, network, colliderIndex, () => 0.018);
  trafficSys.setQuality("balanced");

  assert.ok(trafficSys.vehicles.length >= 6, "Balanced fleet should have at least 6 active vehicles");

  // Verify all 10 parked vehicles are in designated bays clear of traffic
  assert.equal(trafficSys.parkedVehicles.length, 10, "Should spawn all 10 authentic parked vehicles");
  for (const pv of trafficSys.parkedVehicles) {
    assert.ok(pv.locationName.length > 0, "Parked vehicle must have identifiable location name");
    const hits = colliderIndex.query(pv.position.x, pv.position.z, 0.5);
    assert.ok(hits.length > 0, `Parked vehicle ${pv.id} at ${pv.locationName} must register a collider`);
  }

  // Test anti-gridlock priority inside intersection box
  const testVehicle = trafficSys.vehicles[0];
  const intersectionWp = network.trafficWaypointList.find((wp) => wp.isIntersection);
  assert.ok(intersectionWp, "Must have an intersection waypoint in network");

  testVehicle.targetWaypoint = intersectionWp;
  // Place vehicle inside junction box (2.5m from intersection center, past the 5.5m stop line)
  testVehicle.position.set(intersectionWp.x + 2.0, 0.018, intersectionWp.z + 1.5);
  testVehicle.speed = 5.0;

  // Run update with red light signal on this axis (isXGreen = false, isZGreen = false)
  const playerPos = new THREE.Vector3(100, 0, 100);
  trafficSys.update(0.1, playerPos, null, 0);

  // Anti-Gridlock guarantee: Vehicle inside junction box must NOT drop to speed 0 and stall
  assert.ok(
    testVehicle.speed > 2.0,
    `Vehicle inside intersection box must clear junction with priority, got speed ${testVehicle.speed}`,
  );

  trafficSys.dispose();
});

test("Phase 6.7: Northern Nigerian Street Details & Storm Drainage Culvert Slabs", () => {
  const materials = createMaterials();
  const world = createWorld(materials);

  assert.ok(world.root, "World root group must be created");
  assert.ok(world.colliders.length > 200, "World should contain full city colliders");

  // Verify precast concrete culvert slabs (Gadar Magudana) exist over storm gutters
  let culvertSlabCount = 0;
  world.root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material === materials.concrete) {
      if (Math.abs(child.position.y - 0.088) < 0.02) {
        culvertSlabCount++;
      }
    }
  });

  assert.ok(
    culvertSlabCount >= 5,
    `Must have at least 5 reinforced concrete storm drainage culvert slabs spanning gutters, found ${culvertSlabCount}`,
  );

  // Verify roadside community standpipe water collection points (Famfo)
  let waterDrumFound = false;
  let bibCockTapFound = false;
  world.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Blue drum cylinder at y=0.52 with height 1.04
      if (Math.abs(child.position.y - 0.52) < 0.05 && child.scale.y > 0.9 && child.scale.y < 1.2) {
        waterDrumFound = true;
      }
      // Bib cock tap box at y=0.92
      if (Math.abs(child.position.y - 0.92) < 0.05) {
        bibCockTapFound = true;
      }
    }
  });

  assert.ok(waterDrumFound, "Roadside community blue water drum (Famfo) must be present in world");
  assert.ok(bibCockTapFound, "Roadside standpipe brass tap must be present in world");
});

test("Phase 6.7: Atmospheric Immersion, Market Audio Distance Falloff & Headlights", () => {
  const audio = new AudioSystem(false, 0.7);

  // Test Market Murmur distance falloff calculation
  // 1. Right inside Sabon Gari Kasuwa market (x: -31, z: 31) -> Full Gain ~0.22
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: { x: -31, z: 31 },
    timeOfDayHours: 12.0,
    isInterior: false,
  });
  const gainAtMarket = audio.getMarketGain();
  assert.ok(gainAtMarket >= 0.20, `Gain inside Kasuwa should be ~0.22, got ${gainAtMarket}`);

  // 2. Midway away at 40m distance
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: { x: -31 + 40, z: 31 },
    timeOfDayHours: 12.0,
    isInterior: false,
  });
  const gainAtMidway = audio.getMarketGain();
  assert.ok(
    gainAtMidway > 0.05 && gainAtMidway < gainAtMarket,
    `Gain at 40m distance should attenuate smoothly, got ${gainAtMidway}`,
  );

  // 3. Far away beyond 75m -> Gain drops to 0
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: { x: 70, z: -70 },
    timeOfDayHours: 12.0,
    isInterior: false,
  });
  const gainFarAway = audio.getMarketGain();
  assert.equal(gainFarAway, 0, `Market gain beyond 70m should be completely silent, got ${gainFarAway}`);

  // 4. Indoors -> Muffled to ~15%
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: { x: -31, z: 31 },
    timeOfDayHours: 12.0,
    isInterior: true,
  });
  const gainIndoors = audio.getMarketGain();
  assert.ok(
    gainIndoors < gainAtMarket * 0.2,
    `Indoors market murmur should be muffled through thick compound walls, got ${gainIndoors}`,
  );

  // 5. Late night (23:00) -> Subdued
  audio.update(0.1, {
    mode: "on-foot",
    playerPosition: { x: -31, z: 31 },
    timeOfDayHours: 23.0,
    isInterior: false,
  });
  const gainNight = audio.getMarketGain();
  assert.ok(
    gainNight < gainAtMarket * 0.3,
    `Late night market murmur should be subdued after shops close, got ${gainNight}`,
  );

  audio.dispose();

  // Test gradual headlight activation curve in GameEngine
  const engine = new GameEngine(canvas, { onSnapshot: () => {} }, rendererFactory);
  engine.setGraphicsQuality("balanced");

  // Enter vehicle
  (engine as any).mode = "driving";
  (engine as any).activeVehicle = "sedan";
  assert.equal(engine.mode, "driving", "Should enter driving mode");

  // Midday (12.0h): Headlight off
  engine.gameMinutes = 12 * 60;
  (engine as any).updateLighting();
  assert.equal((engine as any).vehicleHeadlight.visible, false, "Vehicle headlight should be off at midday");

  // Dusk (18.5h): Headlight active with gradual twilight intensity
  engine.gameMinutes = 18.5 * 60;
  (engine as any).updateLighting();
  assert.equal((engine as any).vehicleHeadlight.visible, true, "Vehicle headlight should activate during dusk");
  const duskIntensity = (engine as any).vehicleHeadlight.intensity;
  assert.ok(
    duskIntensity > 0.5 && duskIntensity < 3.8,
    `Dusk headlight intensity should be gradual between 0.5 and 3.8, got ${duskIntensity}`,
  );

  // Deep night (23.0h): Headlight full intensity (3.8)
  engine.gameMinutes = 23 * 60;
  (engine as any).updateLighting();
  assert.equal((engine as any).vehicleHeadlight.visible, true, "Vehicle headlight should be visible at night");
  const nightIntensity = (engine as any).vehicleHeadlight.intensity;
  assert.ok(
    Math.abs(nightIntensity - 3.8) < 0.05,
    `Deep night headlight intensity should reach full 3.8, got ${nightIntensity}`,
  );

  engine.dispose();
});
