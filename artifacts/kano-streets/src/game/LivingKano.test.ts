import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { createMotorcycleModel } from "./actors";
import { ColliderIndex } from "./ColliderIndex";
import { createMaterials } from "./materials";
import { buildNavigationNetwork } from "./navigation";
import { PedestrianSystem } from "./PedestrianSystem";
import { TrafficSystem } from "./TrafficSystem";
import { createWorld } from "./world";
import type { Collider } from "./types";

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
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  const fakeDocument = {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
}

function setupTestEnvironment() {
  installBrowserStubs();
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const sampleColliders: Collider[] = [
    { x: -80, z: -80, halfX: 5, halfZ: 5, height: 4 },
    { x: 30, z: 30, halfX: 2, halfZ: 2, height: 3 },
  ];
  const colliderIndex = new ColliderIndex(sampleColliders);
  return { scene, materials, network, colliderIndex };
}

test("TrafficSystem spawns fleet, follows lanes, and avoids collisions", () => {
  const env = setupTestEnvironment();
  const traffic = new TrafficSystem(env.scene, env.materials, env.network, env.colliderIndex);

  try {
    assert.equal(traffic.vehicles.length, 6, "Spawns balanced fleet of 6 vehicles");

    // Check mixed fleet contains both sedans and kekes
    const sedans = traffic.vehicles.filter((v) => v.type === "sedan");
    const kekes = traffic.vehicles.filter((v) => v.type === "keke");
    assert.ok(sedans.length > 0, "Contains AI sedans");
    assert.ok(kekes.length > 0, "Contains AI Keke Napeps");

    // Quality scaling
    traffic.setQuality("performance");
    assert.equal(traffic.vehicles.length, 4, "Performance quality scales to 4 vehicles");
    traffic.setQuality("quality");
    assert.equal(traffic.vehicles.length, 8, "Quality preset scales to 8 vehicles");

    // Update traffic
    const testVehicle = traffic.vehicles[0];
    const playerPos = testVehicle.position.clone().add(new THREE.Vector3(0, 0, 20));
    traffic.update(0.1, playerPos, null);

    assert.ok(
      testVehicle.wheelSpin !== 0,
      "Vehicle wheels spin during driving update",
    );

    // Test player avoidance
    const forwardVec = new THREE.Vector3(Math.sin(testVehicle.yaw), 0, Math.cos(testVehicle.yaw));
    const obstaclePos = testVehicle.position.clone().addScaledVector(forwardVec, 3.5);

    // Place player right in front of vehicle
    traffic.update(0.1, obstaclePos, null);
    assert.ok(
      testVehicle.speed < testVehicle.cruisingSpeed,
      "Vehicle brakes when player obstructs the forward lane",
    );
  } finally {
    traffic.dispose();
  }
});

test("PedestrianSystem spawns vendors, walkers, and navigates sidewalks", () => {
  const env = setupTestEnvironment();
  const pedestrians = new PedestrianSystem(
    env.scene,
    env.materials,
    env.network,
    env.colliderIndex,
  );

  try {
    assert.ok(pedestrians.pedestrians.length >= 10, "Crowd has vendors and walkers");

    // Vendors check: 5 fixed stalls in Sabon Gari
    const vendors = pedestrians.pedestrians.filter((p) => p.state === "vendor");
    assert.equal(vendors.length, 5, "All 5 Sabon Gari market vendors are stationed");

    // Walkers check
    const walkers = pedestrians.pedestrians.filter((p) => p.state === "walking");
    assert.ok(walkers.length > 0, "Walkers exist on sidewalks");

    // Animation & movement check
    const walker = walkers[0];
    const playerPos = walker.position.clone();
    const initialPhase = walker.walkPhase;

    pedestrians.update(0.15, playerPos, null);

    assert.notEqual(walker.walkPhase, initialPhase, "Walk animation phase advances");
    assert.ok(
      Math.abs(walker.model.leftArm.rotation.x) > 0 || Math.abs(walker.model.leftLeg.rotation.x) > 0,
      "Limbs swing dynamically",
    );

    // Quality scaling check
    pedestrians.setQuality("performance");
    assert.ok(pedestrians.pedestrians.length <= 12, "Performance quality throttles crowd size");
  } finally {
    pedestrians.dispose();
  }
});

test("Milestone I: Visual realism, motorcycles, utility infrastructure, and materials", () => {
  const env = setupTestEnvironment();

  // Test materials
  assert.ok(env.materials.asphalt, "Asphalt material generated");
  assert.ok(env.materials.corrugatedZinc, "Corrugated zinc material generated");
  assert.ok(env.materials.motorcycleRed, "Motorcycle red paint generated");

  // Test motorcycle model
  const bike = createMotorcycleModel(env.materials, "#b82e24");
  assert.ok(bike.root instanceof THREE.Group, "Motorcycle model has root group");
  assert.ok(bike.frontFork instanceof THREE.Group, "Motorcycle has steerable front fork");
  assert.ok(bike.frontWheel instanceof THREE.Mesh, "Motorcycle has front wheel");
  assert.ok(bike.rearWheel instanceof THREE.Mesh, "Motorcycle has rear wheel");

  // Test world generation includes roadside props and culverts
  const world = createWorld(env.materials);
  assert.ok(world.colliders.length > 250, "World colliders include roadside infrastructure");
  assert.ok(world.root.children.length > 0, "World root has scenery children");
});
