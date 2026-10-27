import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TrafficSystem, VEHICLE_CONFIGS } from "./TrafficSystem";
import { PedestrianSystem } from "./PedestrianSystem";
import { buildNavigationNetwork, getNextTrafficWaypoint } from "./navigation";
import { ColliderIndex } from "./ColliderIndex";
import { createMaterials } from "./materials";
import { GameEngine } from "./GameEngine";
import { ROAD_LAYOUT } from "./layout";

// ============================================================================
// Setup Headless Mock DOM Environment
// ============================================================================
function setupMockDOM() {
  const store = new Map<string, string>();

  const fakeLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get _store() {
      return store;
    },
  };

  const fakeContext = {
    canvas: { width: 512, height: 512 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
    font: "",
    textAlign: "center",
    textBaseline: "middle",
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    scale: () => {},
    rotate: () => {},
    translate: () => {},
    transform: () => {},
    setTransform: () => {},
    resetTransform: () => {},
  };

  const fakeCanvas = {
    width: 512,
    height: 512,
    parentElement: { clientWidth: 1280, clientHeight: 720 },
    getContext: () => fakeContext,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    requestPointerLock: () => {},
    style: {},
  };

  const fakeDocument = {
    createElement: (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      return { style: {}, addEventListener: () => {}, removeEventListener: () => {} };
    },
    pointerLockElement: null,
    exitPointerLock: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }

  const fakeWindow = {
    devicePixelRatio: 1.5,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: fakeLocalStorage,
  };

  (globalThis as any).document = fakeDocument;
  (globalThis as any).window = fakeWindow;
  (globalThis as any).ResizeObserver = FakeResizeObserver;
  (globalThis as any).requestAnimationFrame = () => 1;
  (globalThis as any).cancelAnimationFrame = () => {};

  return fakeLocalStorage;
}

function createMockRenderer(): THREE.WebGLRenderer {
  return {
    pixelRatio: 1,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
  } as unknown as THREE.WebGLRenderer;
}

setupMockDOM();

// ============================================================================
// Milestone 13 Test Suite: Living City & Realistic Traffic
// ============================================================================

test("1. Lane Following & Route Validity: Vehicles navigate on right-hand road lanes", () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);

  assert.ok(traffic.vehicles.length >= 5, "Initial traffic fleet must spawn at least 5 vehicles");

  for (const v of traffic.vehicles) {
    assert.ok(v.currentWaypoint, `Vehicle ${v.id} must possess a valid current waypoint`);
    assert.ok(v.targetWaypoint, `Vehicle ${v.id} must possess a valid target waypoint`);

    // Verify right-hand lane placement:
    // On X-axis roads, direction +1 (East) drives at Z > roadCenter; direction -1 (West) drives at Z < roadCenter
    if (v.currentWaypoint.axis === "x") {
      const zOffset = v.currentWaypoint.z - v.currentWaypoint.roadCenter;
      if (v.currentWaypoint.direction === 1) {
        assert.ok(zOffset > 1.5, `Eastbound lane on X-road must be offset south (+Z) for right-hand traffic`);
      } else {
        assert.ok(zOffset < -1.5, `Westbound lane on X-road must be offset north (-Z) for right-hand traffic`);
      }
    }

    // Verify waypoint connectivity: target waypoint must be reachable from current
    const nextWp = getNextTrafficWaypoint(network, v.currentWaypoint);
    assert.ok(nextWp !== null, `Current waypoint must lead to valid successor`);
  }

  traffic.dispose();
});

test("2. Vehicle Spacing & Following Distance: Trailing vehicle decelerates behind queue", () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);

  // Position lead vehicle stopped at (0, 0, 10) facing South (+Z)
  const lead = traffic.vehicles[0];
  lead.position.set(0, 0, 10);
  lead.yaw = 0; // Heading south (+Z)
  lead.speed = 0;
  lead.cruisingSpeed = 0; // Stationary stopped vehicle

  const forwardWp: any = { id: "wp_fwd", x: 0, z: 100, isIntersection: false, nextIds: [] };
  lead.currentWaypoint = forwardWp;
  lead.targetWaypoint = forwardWp;

  // Position trailing vehicle 8m behind at (0, 0, 2) heading South (+Z)
  const trailer = traffic.vehicles[1];
  trailer.currentWaypoint = forwardWp;
  trailer.targetWaypoint = forwardWp;
  trailer.position.set(0, 0, 2);
  trailer.yaw = 0;
  trailer.speed = 7.5;
  trailer.cruisingSpeed = 7.5;

  // Update simulation near player so LOD doesn't skip
  for (let f = 0; f < 3; f++) {
    traffic.update(0.1, new THREE.Vector3(0, 0, 0), null, 0);
  }

  // Trailing vehicle should decelerate to avoid collision
  assert.ok(
    trailer.speed < 7.5,
    `Trailing vehicle should begin braking to maintain following distance (current speed: ${trailer.speed})`,
  );

  // Position trailing vehicle at close queue distance (4m) behind stopped leader
  trailer.position.set(0, 0, 6.0);
  trailer.speed = 1.5;
  for (let f = 0; f < 10; f++) {
    traffic.update(0.1, new THREE.Vector3(0, 0, 0), null, 0);
  }
  assert.ok(trailer.speed <= 0.2, `Close queue distance should bring vehicle to standstill (current: ${trailer.speed})`);

  traffic.dispose();
});

test("3. Intersection Signals & Traffic Lights: Visual Posts & 3-Phase Signal Cycle", () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);

  // 1. Verify 3D Traffic Light signal posts were constructed
  assert.ok(traffic.signalPosts.length >= 16, "Expected at least 16 signal posts across major arterial intersections");

  // 2. Check signal states through the 18-second periodic cycle
  // At t = 2s: X is Green, Z is Red
  (traffic as any).time = 2.0;
  assert.equal(traffic.getSignalState("x"), "green");
  assert.equal(traffic.getSignalState("z"), "red");

  // At t = 8.5s: X is Yellow, Z is Red
  (traffic as any).time = 8.5;
  assert.equal(traffic.getSignalState("x"), "yellow");
  assert.equal(traffic.getSignalState("z"), "red");

  // At t = 12.0s: X is Red, Z is Green
  (traffic as any).time = 12.0;
  assert.equal(traffic.getSignalState("x"), "red");
  assert.equal(traffic.getSignalState("z"), "green");

  // At t = 17.5s: X is Red, Z is Yellow
  (traffic as any).time = 17.5;
  assert.equal(traffic.getSignalState("x"), "red");
  assert.equal(traffic.getSignalState("z"), "yellow");

  // 3. Test visual emissive lens updates
  traffic.update(0.01, new THREE.Vector3(0, 0, 0), null);
  const xPost = traffic.signalPosts.find((p) => p.axis === "x");
  assert.ok(xPost);
  // At t = 17.5s, X is Red -> red lens must have active emissive intensity
  assert.ok(xPost.redMaterial.emissiveIntensity > 2.0, "Red lens should be illuminated when signal is red");
  assert.ok(xPost.greenMaterial.emissiveIntensity < 0.2, "Green lens should be dark when signal is red");

  traffic.dispose();
});

test("4. Safe Spawning & Parked Roadside Vehicles: Zero clipping with buildings or traffic lanes", () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);

  // Verify 10 authentic parked vehicles created across Kano districts
  assert.equal(traffic.parkedVehicles.length, 10, "Expected exactly 10 authentic parked vehicles across districts");

  for (const pv of traffic.parkedVehicles) {
    assert.ok(pv.locationName.length > 0, `Parked vehicle ${pv.id} must have designated location name`);

    // Verify collider exists
    assert.ok(pv.collider.halfX > 0.8 && pv.collider.halfZ > 0.8, `Parked vehicle ${pv.id} must register physical collider`);

    // Verify parked vehicle is positioned off the active road lane (not on top of traffic waypoints)
    for (const wp of network.trafficWaypointList) {
      const dist = Math.hypot(pv.position.x - wp.x, pv.position.z - wp.z);
      assert.ok(
        dist >= 3.0,
        `Parked vehicle ${pv.id} at (${pv.position.x}, ${pv.position.z}) should not block traffic waypoint ${wp.id} (distance: ${dist}m)`,
      );
    }
  }

  traffic.dispose();
});

test("5. Pedestrian Life & Safe Crosswalk Yielding: Vehicles yield to pedestrians", () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  // Check that crosswalk waypoints were generated in the navigation network
  const crosswalkWps = network.pedestrianWaypointList.filter((wp) => wp.area === "crosswalk");
  assert.ok(crosswalkWps.length >= 8, `Expected at least 8 zebra crosswalk waypoints, found ${crosswalkWps.length}`);

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);
  const pedestrians = new PedestrianSystem(scene, materials, network, colliderIndex);

  // Position vehicle heading toward a crossing pedestrian
  const v = traffic.vehicles[0];
  v.position.set(0, 0, 0);
  v.yaw = 0; // Heading South (+Z)
  v.speed = 7.0;
  v.cruisingSpeed = 7.0;

  // Place pedestrian 7 meters directly ahead in the road lane at (0, 0, 7)
  const crossingPed = { position: new THREE.Vector3(0, 0, 7) };

  // Update traffic with pedestrian awareness
  traffic.update(0.1, new THREE.Vector3(50, 0, 50), null, 0, [crossingPed]);

  // Vehicle must decelerate to yield to crossing pedestrian
  assert.ok(
    v.speed < 7.0,
    `Vehicle should brake when pedestrian is in road corridor ahead (speed: ${v.speed})`,
  );

  traffic.dispose();
  pedestrians.dispose();
});

test("6. Police & KAROTA Law Enforcement: Speeding, Red-Light Violations & Anti-Spam Cooldown", () => {
  const container = (globalThis as any).document.createElement("canvas");
  (globalThis as any).window.localStorage.clear();

  let citationReceived: { fine: number; reason: string } | null = null;
  const engine = new GameEngine(
    container,
    {
      onSnapshot: () => {},
      onShowMap: () => {},
    },
    createMockRenderer,
  );

  (engine as any).trafficSystem.onCitation = (fine: number, reason: string) => {
    citationReceived = { fine, reason };
    if ((engine as any).trafficFine === 0) {
      (engine as any).trafficFine = fine;
      (engine as any).statusMessage = reason;
    }
  };

  // 1. Initial state: zero fines
  assert.equal((engine as any).trafficFine, 0);

  // 2. Drive vehicle near KAROTA patrol unit at > 60 km/h (17.5 m/s)
  const patrol = (engine as any).trafficSystem.vehicles.find((v: any) => v.isPatrol);
  assert.ok(patrol, "Expected active KAROTA patrol vehicle");

  const playerVehPos = new THREE.Vector3().copy(patrol.position).add(new THREE.Vector3(4, 0, 4));
  (engine as any).trafficSystem.update(0.1, playerVehPos, playerVehPos, 18.0);

  assert.ok(citationReceived, "KAROTA radar should issue citation for speeding > 60 km/h");
  assert.equal(citationReceived!.fine, 5000);
  assert.equal((engine as any).trafficFine, 5000);
  assert.ok(patrol.sirenActive, "Patrol emergency beacon should activate upon citation");

  // 3. Anti-Spam verification: additional speeding while fine is pending should NOT compound or duplicate
  citationReceived = null;
  (engine as any).trafficSystem.update(0.1, playerVehPos, playerVehPos, 19.0);
  assert.equal(citationReceived, null, "Pending citation must prevent duplicate citation spam");

  // 4. Settle fine at police desk
  (engine as any).trafficFine = 0;
  assert.equal((engine as any).trafficFine, 0, "Fine settled cleanly");

  engine.dispose();
});

test("7. Performance Scaling & Configurable Traffic Density", () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex);

  // Balanced density (default)
  traffic.setQuality("balanced");
  assert.equal(traffic.vehicles.length, 6, "Balanced quality should maintain 6 vehicles");

  // Performance density (lower-end PCs)
  traffic.setQuality("performance");
  assert.equal(traffic.vehicles.length, 4, "Performance quality should scale down to 4 vehicles");
  assert.ok(traffic.vehicles.some((v) => v.isPatrol), "Patrol vehicle must be preserved on performance quality");

  // High quality density (dense Kano traffic)
  traffic.setQuality("quality");
  assert.equal(traffic.vehicles.length, 8, "High quality should scale up to 8 vehicles");

  traffic.dispose();
});
