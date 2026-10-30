import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { PedestrianSystem } from "./PedestrianSystem";
import { ColliderIndex } from "./ColliderIndex";
import { createMaterials } from "./materials";
import { buildNavigationNetwork } from "./navigation";
import { createPedestrianModel } from "./actors";

function installBrowserStubs() {
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
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
    pointerLockElement: null,
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    addEventListener() {},
    removeEventListener() {},
  };
  const fakeWindow = {
    devicePixelRatio: 1.5,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
}

test("Stage 3: Seated Elders Posture & Realistic Avatar Preservation", async () => {
  installBrowserStubs();
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const navigation = buildNavigationNetwork();

  const colliderIndex = new ColliderIndex([]);
  const peds = new PedestrianSystem(
    scene,
    materials,
    navigation,
    colliderIndex,
    () => 0, // Flat surface for test
  );

  // 1. Verify elders are spawned in sitting state at Dandali Square
  const elder0 = peds.pedestrians.find((p) => p.name === "Alhaji Bello Dan-Iya");
  const elder1 = peds.pedestrians.find((p) => p.name === "Malam Sanusi Kurmi");

  assert.ok(elder0, "Alhaji Bello Dan-Iya exists in crowd");
  assert.ok(elder1, "Malam Sanusi Kurmi exists in crowd");
  assert.equal(elder0.state, "sitting", "Elder 0 initial state is sitting");
  assert.equal(elder1.state, "sitting", "Elder 1 initial state is sitting");

  // 2. Perform realistic avatar upgrade
  await peds.upgradeWithRealisticAvatars();

  // 3. Confirm seated elders retained their procedural seated body
  assert.equal(
    elder0.model.riggedCharacter,
    undefined,
    "Alhaji Bello Dan-Iya does NOT attach standing rigged avatar",
  );
  assert.equal(
    elder1.model.riggedCharacter,
    undefined,
    "Malam Sanusi Kurmi does NOT attach standing rigged avatar",
  );
  assert.equal(elder0.model.proceduralBody.visible, true, "Elder 0 procedural body is visible");
  assert.equal(elder1.model.proceduralBody.visible, true, "Elder 1 procedural body is visible");

  // 4. Run update loop near Dandali Square (-72, 0, -78.2) and verify procedural seated pose
  const nearDandali = new THREE.Vector3(-72, 0, -78.2);
  const dt = 1 / 30;
  for (let i = 0; i < 30; i++) {
    peds.update(dt, nearDandali, null);
  }

  // The procedural seating sets leg rotation x to Math.PI * 0.42
  const expectedLegAngle = Math.PI * 0.42;
  assert.ok(
    Math.abs(elder0.model.leftLeg.rotation.x - expectedLegAngle) < 0.05,
    `Elder 0 left leg is seated at ~${expectedLegAngle} rad, got ${elder0.model.leftLeg.rotation.x}`,
  );
  assert.ok(
    Math.abs(elder0.model.rightLeg.rotation.x - expectedLegAngle) < 0.05,
    `Elder 0 right leg is seated at ~${expectedLegAngle} rad, got ${elder0.model.rightLeg.rotation.x}`,
  );
  assert.ok(
    Math.abs(elder1.model.leftLeg.rotation.x - expectedLegAngle) < 0.05,
    `Elder 1 left leg is seated at ~${expectedLegAngle} rad, got ${elder1.model.leftLeg.rotation.x}`,
  );
  assert.equal(elder0.state, "sitting", "Elder 0 remains seated");
  assert.equal(elder1.state, "sitting", "Elder 1 remains seated");

  // 5. Verify fallback handling in animateSitting if riggedCharacter was forcibly attached
  const fakeRigged = new THREE.Group();
  elder0.model.attachRiggedCharacter(fakeRigged, {});
  assert.equal(elder0.model.riggedCharacter, fakeRigged);

  // Update pedestrian system; animateSitting must detect sitting state and keep procedural body visible
  peds.update(dt, nearDandali, null);
  assert.equal(elder0.model.proceduralBody.visible, true, "Procedural body forced visible when sitting");
  assert.equal(elder0.model.riggedCharacter.visible, false, "Rigged body hidden to prevent standing on bench");
  assert.ok(
    Math.abs(elder0.model.leftLeg.rotation.x - expectedLegAngle) < 0.05,
    "Procedural seated pose applied even when riggedCharacter was attached",
  );
});
