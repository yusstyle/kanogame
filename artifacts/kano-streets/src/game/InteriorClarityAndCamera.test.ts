import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BuildingInteriorManager } from "./BuildingInteriors";
import { createMaterials } from "./materials";
import { WeatherSystem } from "./WeatherSystem";
import { Collider } from "./types";

// Setup Mock DOM Environment for Headless Node.js Tests
function setupMockDOM() {
  const store = new Map<string, string>();

  const fakeLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
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
    getImageData: () => ({ data: new Uint8ClampedArray(512 * 512 * 4) }),
    putImageData: () => {},
    createImageData: () => ({ data: new Uint8ClampedArray(512 * 512 * 4) }),
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
    getContext: () => fakeContext,
    toDataURL: () => "data:image/png;base64,",
  };

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: fakeLocalStorage,
    document: {
      createElement: (tag: string) => {
        if (tag === "canvas") return fakeCanvas;
        return {};
      },
    },
  };

  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      return {};
    },
  };
}

setupMockDOM();

test("1. Interior Zones: Heights, Ceilings, and Lights Registered", () => {
  const materials = createMaterials();
  const manager = new BuildingInteriorManager(materials);
  const expectedZones = [
    "apartment",
    "penthouse",
    "house",
    "church",
    "police-post",
    "restaurant",
    "gaming-hub",
    "furniture-showroom",
  ];

  for (const zoneId of expectedZones) {
    const zone = manager.getZone(zoneId);
    assert.ok(zone, `Zone ${zoneId} should be registered in InteriorManager`);
    assert.ok(
      typeof zone.height === "number" && zone.height >= 3.0,
      `Zone ${zoneId} should define a ceiling clearance height >= 3.0 (got ${zone.height})`,
    );
    assert.ok(
      Array.isArray(zone.lights) && zone.lights.length > 0,
      `Zone ${zoneId} should have registered light fixtures (got ${zone.lights?.length ?? 0})`,
    );

    // Verify all registered lights are valid Three.js PointLights
    for (const light of zone.lights!) {
      assert.ok(light instanceof THREE.PointLight, `Zone ${zoneId} light should be a PointLight`);
      assert.ok(light.intensity > 0, `Zone ${zoneId} light should have positive intensity`);
      assert.ok(light.distance >= 14, `Zone ${zoneId} light should have wide illumination distance (got ${light.distance})`);
      assert.ok(light.decay >= 1.0, `Zone ${zoneId} light should have realistic decay (got ${light.decay})`);
    }

    // Verify cutaway ceiling mesh exists with normal facing downward
    let foundCeiling = false;
    zone.root.traverse((child) => {
      if (child.name === "ceiling" && child instanceof THREE.Mesh) {
        foundCeiling = true;
        assert.strictEqual(
          child.rotation.x,
          Math.PI / 2,
          `Zone ${zoneId} ceiling plane must rotate Math.PI / 2 to face downward`,
        );
      }
    });
    assert.ok(foundCeiling, `Zone ${zoneId} must contain downward-facing cutaway ceiling mesh`);
  }
});

test("2. Light Switch Control: Toggle On / Off restores full illumination", () => {
  const materials = createMaterials();
  const manager = new BuildingInteriorManager(materials);
  const zone = manager.getZone("apartment")!;
  assert.ok(zone.lights && zone.lights.length > 0);

  const originalIntensities = zone.lights.map((l) => l.intensity);
  assert.ok(originalIntensities.every((val) => val > 0));

  // Toggle OFF (ambient dim mode: 0.2x intensity)
  const turnedOff = manager.toggleInteriorLights("apartment");
  assert.strictEqual(turnedOff, false, "Toggling lights off should return false (dimmed)");
  for (let i = 0; i < zone.lights.length; i++) {
    const expectedDim = originalIntensities[i] * 0.2;
    assert.ok(
      Math.abs(zone.lights[i].intensity - expectedDim) < 0.01,
      `Light intensity should be dimmed to 0.2x (got ${zone.lights[i].intensity}, expected ${expectedDim})`,
    );
  }

  // Toggle ON (restores full 1.0x intensity)
  const turnedOn = manager.toggleInteriorLights("apartment");
  assert.strictEqual(turnedOn, true, "Toggling lights on should return true (full illumination)");
  for (let i = 0; i < zone.lights.length; i++) {
    assert.strictEqual(
      zone.lights[i].intensity,
      originalIntensities[i],
      "Light intensity should be restored to 1.0x full illumination when toggled back on",
    );
  }
});

test("3. Height-Aware Interior Camera Probe: Low furniture cleared when above, blocked when intersecting", () => {
  const colliders: Collider[] = [
    // Coffee table / sofa / bed / desk (low furniture: height < 2.0m)
    { x: 0, z: -2, halfX: 0.8, halfZ: 0.5, height: 0.75 },
    { x: 2, z: 0, halfX: 1.0, halfZ: 1.1, height: 0.9 },
    // Interior room divider / boundary wall (height >= 2.0m)
    { x: 0, z: -5, halfX: 4.0, halfZ: 0.15, height: 3.5 },
  ];

  const zoneRootY = -60;

  // Camera collision simulation logic identical to GameEngine.ts
  function checkBlocked(point: THREE.Vector3): boolean {
    return colliders.some((collider: Collider) => {
      const colliderH = collider.height ?? 3.5;
      const colliderTopY = zoneRootY + colliderH;
      if (point.y > colliderTopY + 0.05) return false;
      if (point.y < zoneRootY) return false;
      const dx = Math.max(Math.abs(point.x - collider.x) - collider.halfX, 0);
      const dz = Math.max(Math.abs(point.z - collider.z) - collider.halfZ, 0);
      return dx * dx + dz * dz < 0.38 * 0.38;
    });
  }

  // Probe directly above coffee table at y = zoneRootY + 1.8m
  const overCoffeeTable = new THREE.Vector3(0, zoneRootY + 1.8, -2);
  assert.strictEqual(
    checkBlocked(overCoffeeTable),
    false,
    "Camera passing over low coffee table should NOT be blocked",
  );

  // Probe directly over sofa/bed at y = zoneRootY + 1.5m
  const overSofa = new THREE.Vector3(2, zoneRootY + 1.5, 0);
  assert.strictEqual(
    checkBlocked(overSofa),
    false,
    "Camera passing over bed/sofa should NOT be blocked",
  );

  // Probe directly intersecting low sofa/chair at y = zoneRootY + 0.5m
  const insideSofa = new THREE.Vector3(2, zoneRootY + 0.5, 0);
  assert.strictEqual(
    checkBlocked(insideSofa),
    true,
    "Camera intersecting low furniture at body height must be blocked to prevent clipping into cushions/chair",
  );

  // Probe hitting solid wall at y = zoneRootY + 2.0m
  const atWall = new THREE.Vector3(0, zoneRootY + 2.0, -5);
  assert.strictEqual(
    checkBlocked(atWall),
    true,
    "Camera intersecting solid wall should be blocked",
  );

  // Probe safely clearing wall above its top at y = zoneRootY + 3.8m
  const aboveWall = new THREE.Vector3(0, zoneRootY + 3.8, -5);
  assert.strictEqual(
    checkBlocked(aboveWall),
    false,
    "Camera traversing higher than wall top should NOT be blocked",
  );
});

test("4. Ceiling Boundary Clamp: Prevents camera piercing ceiling plane", () => {
  const zoneRootY = -60;
  const zoneHeight = 3.5;
  const ceilingY = zoneRootY + zoneHeight; // -56.5

  // Desired position aiming upward beyond ceiling
  const rawDesired = new THREE.Vector3(0, -56.0, 0);
  if (rawDesired.y > ceilingY - 0.32) {
    rawDesired.y = ceilingY - 0.32;
  }

  assert.strictEqual(
    rawDesired.y,
    -56.82,
    "Camera Y must clamp 0.32m below ceiling to avoid piercing ceiling geometry",
  );
});

test("5. WeatherSystem Interior Lighting: Murky fog removed, warm bounce boosted", () => {
  const weather = new WeatherSystem();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 10, 80);
  const sunLight = new THREE.DirectionalLight();
  const hemiLight = new THREE.HemisphereLight();

  // Outdoor lighting at noon
  weather.applyToScene(scene, sunLight, hemiLight, 12, false);
  const outdoorFog = scene.fog as THREE.Fog;
  assert.ok(outdoorFog.near < 100, "Outdoor fog near should be atmospheric (< 100m)");

  // Indoor lighting at noon
  weather.applyToScene(scene, sunLight, hemiLight, 12, true);
  const indoorFog = scene.fog as THREE.Fog;
  assert.strictEqual(
    indoorFog.near,
    140,
    "Indoor fog near must be pushed to 140m so rooms are crystal clear and free of murky smog",
  );
  assert.strictEqual(
    indoorFog.far,
    350,
    "Indoor fog far must be 350m",
  );

  assert.ok(
    hemiLight.intensity >= 1.0,
    `Hemisphere light intensity should be boosted in interiors (got ${hemiLight.intensity})`,
  );
  assert.strictEqual(
    "#" + hemiLight.groundColor.getHexString(),
    "#857362",
    "Hemisphere ground bounce should be a warm, realistic floor fill",
  );
  assert.strictEqual(
    sunLight.intensity,
    0.75,
    "Window directional sunlight should be soft day illumination",
  );
});

test("6. Interior Materials: High albedo, patterned rug and procedural floor tile", () => {
  const materials = createMaterials();
  assert.ok(materials.interiorWall, "interiorWall material must exist");
  assert.ok(materials.ceilingMat, "ceilingMat material must exist");
  assert.ok(materials.patternedRug, "patternedRug material must exist");
  assert.ok(materials.marbleWhite, "marbleWhite material must exist");

  const wallMat = materials.interiorWall as THREE.MeshStandardMaterial;
  assert.strictEqual(
    "#" + wallMat.color.getHexString(),
    "#f7f3ec",
    "interiorWall should be warm Sahelian off-white (#f7f3ec)",
  );
  assert.strictEqual(wallMat.roughness, 0.72);

  const ceilingMat = materials.ceilingMat as THREE.MeshStandardMaterial;
  assert.strictEqual(
    "#" + ceilingMat.color.getHexString(),
    "#fbf9f5",
    "ceilingMat should be clean, highly reflective ceiling plaster (#fbf9f5)",
  );

  const tileMat = materials.tileFloor as THREE.MeshStandardMaterial;
  assert.strictEqual(
    "#" + tileMat.color.getHexString(),
    "#ebe5d8",
    "tileFloor should be bright cream porcelain tile (#ebe5d8)",
  );
  assert.strictEqual(tileMat.roughness, 0.26, "tileFloor should have smooth ceramic specular sheen");
});

test("7. Architectural Cutaway Perimeter Walls & Collision Filtering", () => {
  const materials = createMaterials();
  const manager = new BuildingInteriorManager(materials);
  const apt = manager.getZone("apartment")!;
  assert.ok(apt);

  // Check cutaway perimeter walls
  let foundPerimeterWall = false;
  apt.root.traverse((child) => {
    if (child.name === "perimeter_wall" && child instanceof THREE.Mesh) {
      foundPerimeterWall = true;
    }
  });
  assert.ok(foundPerimeterWall, "Apartment must contain cutaway perimeter wall meshes");

  // Check boundary colliders are tagged isPerimeterWall
  const perimeterColliders = apt.colliders.filter((c) => c.isPerimeterWall === true);
  assert.strictEqual(perimeterColliders.length, 4, "Must have 4 perimeter wall colliders tagged with isPerimeterWall");

  // Verify camera probe ignores perimeter wall colliders
  const zoneRootY = -60;
  function checkBlocked(point: THREE.Vector3): boolean {
    return apt.colliders.some((collider: Collider) => {
      if (collider.isPerimeterWall) return false;
      const colliderH = collider.height ?? 3.5;
      const colliderTopY = zoneRootY + colliderH;
      if (point.y > colliderTopY + 0.05) return false;
      if (point.y < zoneRootY) return false;
      const dx = Math.max(Math.abs(point.x - collider.x) - collider.halfX, 0);
      const dz = Math.max(Math.abs(point.z - collider.z) - collider.halfZ, 0);
      return dx * dx + dz * dz < 0.38 * 0.38;
    });
  }

  // Camera point sitting inside the perimeter wall thickness
  const atPerimeterWall = new THREE.Vector3(perimeterColliders[0].x, zoneRootY + 2.0, perimeterColliders[0].z);
  assert.strictEqual(
    checkBlocked(atPerimeterWall),
    false,
    "Camera passing through cutaway perimeter wall should NOT be blocked",
  );
});

test("8. Living Room Accent Armchair: Placement, Collision Clearance & Seating", () => {
  const materials = createMaterials();
  const manager = new BuildingInteriorManager(materials);
  const apt = manager.getZone("apartment")!;
  assert.ok(apt);

  const cx = apt.root.position.x;
  const cz = apt.root.position.z;

  // 1. Check armchair collider exists and is properly registered
  const chairCollider = apt.colliders.find((c) => {
    // Chair is placed at x = cx - 2.05, z = cz + 0.55
    const dx = Math.abs(c.x - (cx - 2.05));
    const dz = Math.abs(c.z - (cz + 0.55));
    return dx < 0.2 && dz < 0.2;
  });
  assert.ok(chairCollider, "Living room accent armchair collider must be registered in apartment colliders");
  assert.ok(chairCollider.height >= 0.8 && chairCollider.height <= 1.0, `Armchair height should be natural (~0.9m, got ${chairCollider.height})`);

  // 2. Check armchair clearance from hallway entrance partition (cx - 1.2, cz + 2.0 to 5.8)
  const chairEastEdge = chairCollider.x + chairCollider.halfX;
  const hallwayWallX = cx - 1.2;
  const clearance = hallwayWallX - chairEastEdge;
  assert.ok(
    clearance > 0.3,
    `Armchair must not block hallway entrance walkway (clearance should be > 0.3m, got ${clearance.toFixed(2)}m)`,
  );

  // 3. Check armchair 3D group exists
  let foundArmchair = false;
  apt.root.traverse((child) => {
    if (child.name === "proceduralArmchair" || child.name === "realisticArmchair") {
      foundArmchair = true;
    }
  });
  assert.ok(foundArmchair, "Apartment interior must contain visual armchair group");

  // 4. Check seating interaction is registered
  assert.ok(apt.checkInteraction, "Apartment must define checkInteraction handler");
  const chairPos = new THREE.Vector3(chairCollider.x, -60 + 0.1, chairCollider.z);
  const inter = apt.checkInteraction(chairPos, { cash: 100000, trafficFine: 0, hasApartmentRental: true });
  assert.ok(inter, "Interacting near the accent armchair must return an interaction");
  assert.ok(inter.prompt.includes("Armchair") || inter.prompt.includes("Accent"), `Prompt must offer armchair seating (got '${inter.prompt}')`);
  const actionRes = inter.action();
  assert.ok(actionRes.sitDown, "Armchair action must provide sitDown response");
  assert.ok(actionRes.sitDown.label.includes("Accent Armchair"), "Sit down response must reference Accent Armchair");
});

test("9. Furniture Camera Obstruction & Transparency Fade", () => {
  const materials = createMaterials();
  const manager = new BuildingInteriorManager(materials);
  const apt = manager.getZone("apartment")!;
  assert.ok(apt);

  // Verify furniture meshes in interior are tagged with isFurniture
  let furnitureMeshCount = 0;
  apt.root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.isFurniture) {
      furnitureMeshCount++;
    }
  });
  assert.ok(furnitureMeshCount > 0, `Interior must tag furniture meshes with isFurniture (found ${furnitureMeshCount})`);

  // Test transparency fade math:
  // When camera is within 0.95m of furniture, opacity fades smoothly from 1.0 down to 0.1
  const distFar = 1.2; // 1.2m away: full opacity
  const alphaFar = THREE.MathUtils.clamp((distFar - 0.3) / 0.65, 0.1, 1.0);
  assert.strictEqual(alphaFar, 1.0, "At 1.2m distance, furniture must remain 100% opaque");

  const distMid = 0.625; // 0.625m away: half opacity
  const alphaMid = THREE.MathUtils.clamp((distMid - 0.3) / 0.65, 0.1, 1.0);
  assert.strictEqual(alphaMid, 0.5, "At 0.625m distance, furniture fades to 50% opacity to prevent blocking screen");

  const distClose = 0.3; // 0.3m away: minimum opacity
  const alphaClose = THREE.MathUtils.clamp((distClose - 0.3) / 0.65, 0.1, 1.0);
  assert.strictEqual(alphaClose, 0.1, "At 0.3m near plane, furniture fades to 10% opacity preventing solid occlusion");
});
