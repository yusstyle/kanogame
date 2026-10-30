import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createMaterials } from "./materials";
import { createPlot, createMarketStall, createRoadsideKiosk } from "./buildings";
import { createCarModel } from "./actors";
import { TrafficSystem } from "./TrafficSystem";
import { buildNavigationNetwork } from "./navigation";
import { ColliderIndex } from "./ColliderIndex";
import { ASSET_MANIFEST } from "./assetManifest";

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
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
}

test("Phase 6.3 Assets: ASSET_MANIFEST records verified provenance, licenses, and modifications", () => {
  const verifiedIds = [
    "graphite-four-door-sedan",
    "large-iron-gate",
    "worn-plaster-wall",
    "keke-napep",
    "kano-market-stall",
    "kano-roadside-kiosks",
    "highway-jersey-barrier",
    "sahel-solar-streetlight",
    "sheen-wood-leather-sofa",
    "sheen-chair",
    "vintage-day-bed",
  ];

  for (const id of verifiedIds) {
    const record = Object.values(ASSET_MANIFEST).find((r) => r.id === id);
    assert.ok(record, `Asset record with id "${id}" must exist in ASSET_MANIFEST`);
    assert.ok(record.name.length > 0, `Record ${id} must have a descriptive name`);
    assert.ok(record.creator.length > 0, `Record ${id} must have a verified creator`);
    assert.ok(record.sourceUrl.length > 0, `Record ${id} must have a valid source URL`);
    assert.ok(record.license.length > 0, `Record ${id} must state a verified license`);
    assert.ok(record.modifications.length > 0, `Record ${id} must describe integration modifications`);
  }
});

test("Phase 6.3 Buildings: Hausa Compound builds authentic Zaure Gatehouse portal and initializes gateSlot", () => {
  installBrowserStubs();
  const materials = createMaterials();
  const plot = createPlot("traditional", materials, 0);

  assert.ok(plot.root instanceof THREE.Group, "Plot root must be a THREE.Group");
  assert.ok(plot.gateSlot instanceof THREE.Group, "Plot must have a gateSlot for external/procedural gates");
  assert.equal(plot.gateSlot.name, "compound-gate-asset-slot");

  // Verify gateSlot contains procedural gate fallback
  const proceduralFallback = plot.gateSlot.getObjectByName("procedural-gate-fallback");
  assert.ok(proceduralFallback, "gateSlot must contain procedural fallback gate");

  // Verify Zaure gatehouse portal architecture exists in hierarchy
  let hasZaureCrest = false;
  let hasPinnacle = false;
  plot.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material === materials.trim && child.position.z > 7.1) {
        hasZaureCrest = true;
      }
      if (child.material === materials.ochre && child.position.y > 3.0) {
        hasPinnacle = true;
      }
    }
  });

  assert.ok(hasZaureCrest, "Zaure gatehouse portal must include traditional Dakin Gona crest molding");
  assert.ok(hasPinnacle, "Zaure gatehouse portal must include earthen Zankwaye pinnacles");

  // Ensure collision boundaries allow clear entrance passage
  const doorwayCollider = plot.colliders.find(
    (c) => Math.abs(c.x) < 0.1 && c.z > 7.0,
  );
  assert.ok(doorwayCollider, "Gateway must have doorway clearance collider");
});

test("Phase 6.3 Environment: Market Stall features authentic Northern produce, timber framing & burlap sacks", () => {
  installBrowserStubs();
  const materials = createMaterials();
  const stall = createMarketStall(materials, 0);

  assert.ok(stall.root instanceof THREE.Group);
  assert.equal(stall.colliders.length, 1);
  assert.equal(stall.colliders[0].halfX, 1.72);
  assert.equal(stall.colliders[0].halfZ, 0.65);

  let produceSpheres = 0;
  let hasTimberPosts = false;
  let hasSacks = false;

  stall.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry instanceof THREE.SphereGeometry) {
        produceSpheres += 1;
      }
      if (child.material === materials.wood && child.position.y > 1.5) {
        hasTimberPosts = true;
      }
      if (child.material === materials.burlapSack || child.material === materials.cloth) {
        if (child.position.y < 0.5) hasSacks = true;
      }
    }
  });

  assert.ok(produceSpheres >= 10, "Market stall must display at least 10 produce items (peppers, onions)");
  assert.ok(hasTimberPosts, "Market stall must have structural timber posts");
  assert.ok(hasSacks, "Market stall must have lower burlap grain sacks");
});

test("Phase 6.3 Environment: Roadside Kiosks generate Mai Shayi, POS, and Cold Drinks variants with collision bounds", () => {
  installBrowserStubs();
  const materials = createMaterials();

  const maiShayi = createRoadsideKiosk(materials, 0);
  assert.equal(maiShayi.root.name, "roadside-kiosk-0");
  assert.equal(maiShayi.colliders.length, 1);
  assert.equal(maiShayi.colliders[0].halfX, 0.85);

  const posKiosk = createRoadsideKiosk(materials, 1);
  assert.equal(posKiosk.root.name, "roadside-kiosk-1");
  assert.equal(posKiosk.colliders.length, 1);

  const drinksKiosk = createRoadsideKiosk(materials, 2);
  assert.equal(drinksKiosk.root.name, "roadside-kiosk-2");
  assert.equal(drinksKiosk.colliders.length, 1);

  // Mai Shayi must feature a tea kettle
  let hasKettle = false;
  maiShayi.root.traverse((c) => {
    if (c instanceof THREE.Mesh && c.material === materials.metal && c.position.y > 1.0) {
      hasKettle = true;
    }
  });
  assert.ok(hasKettle, "Mai Shayi kiosk must include tea kettle service");
});

test("Phase 6.3 Vehicles: Sedan attachGLTFBody supports cloning, body tinting, and wheel hiding", () => {
  installBrowserStubs();
  const materials = createMaterials();
  const car = createCarModel(materials);

  assert.equal(car.proceduralBody.visible, true);
  assert.ok(car.wheels.length >= 4);

  // Create a mock GLTF model with paint material
  const mockGLTF = new THREE.Group();
  const paintMat = new THREE.MeshStandardMaterial({ color: "#222222" });
  paintMat.name = "paint";
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), paintMat);
  mockGLTF.add(bodyMesh);

  // Attach GLTF body with custom Kano Indigo Dye livery (#1d2d50)
  car.attachGLTFBody(mockGLTF, "#1d2d50");

  assert.equal(car.proceduralBody.visible, false, "Procedural body must be hidden when GLTF is attached");
  car.wheels.forEach((w) => {
    assert.equal(w.visible, false, "Procedural wheels must be hidden when GLTF is attached");
  });
  assert.ok(car.gltfBody, "car.gltfBody must be attached to CarModel");
  assert.equal(car.root.children.includes(car.gltfBody), true, "gltfBody must be added to car root");

  // Verify paint material tint was applied
  let tintedColor: THREE.Color | null = null;
  car.gltfBody.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = child.material as THREE.MeshStandardMaterial;
      if (mat.name === "paint") {
        tintedColor = mat.color;
      }
    }
  });

  assert.ok(tintedColor, "Paint material must be present on gltfBody");
  assert.equal(tintedColor!.getHexString(), "1d2d50", "Livery color must match Kano Indigo hex #1d2d50");
});

test("Phase 6.3 Vehicles: TrafficSystem upgradeWithSedanGLTF upgrades fleet sedans safely", () => {
  installBrowserStubs();
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const network = buildNavigationNetwork();
  const colliderIndex = new ColliderIndex([]);

  const traffic = new TrafficSystem(scene, materials, network, colliderIndex, () => 0);
  traffic.setQuality("balanced");

  // Mock GLTF model
  const mockGLTF = new THREE.Group();
  const paintMat = new THREE.MeshStandardMaterial({ color: "#aaaaaa" });
  paintMat.name = "paint";
  mockGLTF.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), paintMat));

  // Call upgradeWithSedanGLTF
  traffic.upgradeWithSedanGLTF(mockGLTF);

  // Verify sedans in traffic have attachGLTFBody invoked
  let sedanFound = false;
  traffic["vehicles"].forEach((v) => {
    if (v.type === "sedan") {
      sedanFound = true;
      const carModel = v.model as any;
      assert.ok(carModel.gltfBody, "Active traffic sedan must receive gltfBody");
      assert.equal(carModel.proceduralBody.visible, false);
    }
  });

  assert.ok(sedanFound, "Traffic fleet must spawn at least one sedan");

  // Verify parked sedans also receive gltfBody with custom paint
  let parkedSedanFound = false;
  traffic.parkedVehicles.forEach((pv) => {
    if (pv.type === "sedan") {
      parkedSedanFound = true;
      const carModel = pv.model as any;
      assert.ok(carModel.gltfBody, "Parked roadside sedan must receive gltfBody");
      assert.equal(carModel.proceduralBody.visible, false);
    }
  });
  assert.ok(parkedSedanFound, "Parked roadside vehicles must include sedans");
});
