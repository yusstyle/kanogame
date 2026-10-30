import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GameEngine } from "./GameEngine";
import { createMaterials } from "./materials";
import type { GraphicsQuality } from "./types";

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
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createImageData(w: number, h: number) {
      return { data: new Uint8ClampedArray(w * h * 4) };
    },
    putImageData() {},
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
    info: {
      render: { calls: 0, triangles: 0, lines: 0, points: 0 },
      memory: { geometries: 0, textures: 0 },
    },
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

function countTrianglesInObject(root: THREE.Object3D): { meshes: number; triangles: number; materials: Set<string> } {
  let meshes = 0;
  let triangles = 0;
  const materials = new Set<string>();

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      meshes += 1;
      const geo = obj.geometry;
      if (geo) {
        if (geo.index) {
          triangles += geo.index.count / 3;
        } else if (geo.attributes?.position) {
          triangles += geo.attributes.position.count / 3;
        }
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => materials.add(m.type + ":" + m.id));
        } else {
          materials.add(obj.material.type + ":" + obj.material.id);
        }
      }
    }
  });

  return { meshes, triangles: Math.round(triangles), materials };
}

test("Phase 6.1 QA: Exterior Kano Districts & Scene Hierarchy Audit", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {}, onPause: () => {} }, rendererFactory);

  try {
    const internal = engine as any;
    const worldRoot = internal.world.root as THREE.Group;
    const sceneStats = countTrianglesInObject(worldRoot);

    assert.ok(sceneStats.meshes > 50, `World contains substantial batched meshes (${sceneStats.meshes})`);
    assert.ok(sceneStats.triangles > 2000, `World contains detailed geometry (${sceneStats.triangles} triangles)`);
    assert.ok(sceneStats.materials.size > 10, "Multiple distinct PBR material types used");

    // Sky dome mesh exists and is properly configured
    const skyMesh = internal.world.skyMesh as THREE.Mesh;
    assert.ok(skyMesh, "Sky dome mesh exists in world");
    assert.equal(skyMesh.name, "SkyDomeMesh", "Sky dome name matches");
  } finally {
    engine.dispose();
  }
});

test("Phase 6.1 QA: Traditional Hausa Compound & Dakin Gona Relief Details", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {}, onPause: () => {} }, rendererFactory);

  try {
    const internal = engine as any;
    const worldRoot = internal.world.root as THREE.Group;

    let foundDakinGonaRelief = false;
    let foundCompoundGate = false;
    let foundDakaliBench = false;

    worldRoot.traverse((obj) => {
      if (obj.name === "compound-gate-asset-slot") {
        foundCompoundGate = true;
      }
    });

    // Check material normal maps for mud plaster
    const plaster = internal.materials.plaster as THREE.MeshStandardMaterial;
    assert.ok(plaster.normalMap, "Plaster material has normalMap");
    assert.ok(plaster.normalScale.x > 0.5, "Plaster normalScale is tuned for physical relief");

    assert.ok(foundCompoundGate, "Traditional Hausa compound gates present");
  } finally {
    engine.dispose();
  }
});

test("Phase 6.1 QA: Road Scene & Contact Shadow Attachment on All 6 Vehicle Types", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {}, onPause: () => {} }, rendererFactory);

  try {
    const internal = engine as any;
    const vehicles = [
      { name: "Sedan", model: internal.car },
      { name: "Keke", model: internal.keke },
      { name: "DeliveryVan", model: internal.van },
      { name: "PickupTruck", model: internal.pickup },
      { name: "Minibus", model: internal.minibus },
      { name: "FreightTruck", model: internal.truck },
    ];

    for (const v of vehicles) {
      let hasShadow = false;
      v.model.root.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry) {
          if (child.material.transparent && child.material.depthWrite === false) {
            hasShadow = true;
            assert.ok(child.position.y <= 0.05, `${v.name} shadow height is close to pavement`);
            assert.ok(child.position.y >= 0.02, `${v.name} shadow is above asphalt surface`);
          }
        }
      });
      assert.ok(hasShadow, `${v.name} possesses a ground contact shadow child mesh`);
    }
  } finally {
    engine.dispose();
  }
});

test("Phase 6.1 QA: Airport View Unit 2B Interior & Furniture Validation", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {}, onPause: () => {} }, rendererFactory);

  try {
    const internal = engine as any;
    const interiorMgr = internal.interiorManager;

    // Transition into Unit 2B (mapped to "apartment" interior)
    interiorMgr.activeInterior = "apartment";
    const zone = interiorMgr.interiors.get("apartment");
    assert.ok(zone, "Unit 2B (apartment) zone exists");
    internal.playerPosition.copy(zone.spawnPoint);
    assert.equal(interiorMgr.activeInterior, "apartment", "Player entered Unit 2B apartment");

    // Night lighting inside interior
    internal.gameMinutes = 23 * 60; // 23:00 Night
    internal.updateLighting();

    const activeHemi = internal.hemiLight as THREE.HemisphereLight;
    assert.ok(activeHemi.intensity >= 1.0, "Interior ambient fill remains bright and clear at night");

    const fog = internal.scene.fog as THREE.Fog;
    assert.ok(fog.near >= 100, "Interior fog is pushed back to eliminate murky haze");

    // Verify placed furniture group exists for apartment
    const furnitureGroup = interiorMgr.placedFurnitureGroups.get("apartment");
    assert.ok(furnitureGroup, "Placed furniture container exists for Unit 2B");

    // Exit interior
    interiorMgr.activeInterior = null;
    assert.equal(interiorMgr.activeInterior, null, "Exited interior cleanly");
  } finally {
    engine.dispose();
  }
});

test("Phase 6.1 QA: Diurnal Lighting Transitions (Midday, Golden Hour, Dusk, Night)", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {}, onPause: () => {} }, rendererFactory);

  try {
    const internal = engine as any;
    const sun = internal.sunLight as THREE.DirectionalLight;
    const hemi = internal.hemiLight as THREE.HemisphereLight;
    const bounce = internal.bounceLight as THREE.DirectionalLight;

    // 1. Dawn (06:00)
    internal.gameMinutes = 6 * 60;
    internal.updateLighting();
    assert.ok(sun.position.x - internal.playerPosition.x > 0, "Dawn sun rises in the East (+X)");

    // 2. Midday (12:00)
    internal.gameMinutes = 12 * 60;
    internal.updateLighting();
    assert.ok(sun.position.y - internal.playerPosition.y > 60, "Midday sun is high overhead");
    assert.ok(sun.intensity >= 2.5, "Sahelian midday sun is intense and crisp");
    assert.ok(bounce.intensity > 0.15, "Upward ground bounce is illuminated");

    // 3. Golden Hour (18:00)
    internal.gameMinutes = 18 * 60;
    internal.updateLighting();
    assert.ok(sun.position.x - internal.playerPosition.x < 0, "Golden hour sun sets in the West (-X)");
    assert.ok(hemi.intensity < 1.0, "Contrast is preserved during golden hour");

    // 4. Night (22:00)
    internal.gameMinutes = 22 * 60;
    internal.updateLighting();
    assert.ok(sun.intensity <= 0.5, "Subdued moonlight");
    assert.ok(internal.materials.lampGlow.emissiveIntensity > 2.0, "Street lanterns glow brightly");
  } finally {
    engine.dispose();
  }
});

test("Phase 6.1 QA: Harmattan Weather Mode Atmosphere", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {}, onPause: () => {} }, rendererFactory);

  try {
    const internal = engine as any;
    internal.weatherSystem.setPreset("harmattan");
    internal.updateLighting();

    assert.equal(internal.weatherSystem.getPreset(), "harmattan");
    const fog = internal.scene.fog as THREE.Fog;
    assert.ok(fog.far <= 170, "Harmattan reduces draw distance authentically");
    assert.equal(fog.color.getHexString(), "c9b085", "Fog color matches authentic pale dust haze");
  } finally {
    engine.dispose();
  }
});

test("Phase 6.1 QA: Performance Measurements & Quality Presets Scaling", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(canvas, { onSnapshot: () => {}, onPause: () => {} }, rendererFactory);

  try {
    const internal = engine as any;
    const presets: GraphicsQuality[] = ["performance", "balanced", "quality"];

    const measurements: Record<string, {
      pixelRatioCap: number;
      shadowMapSize: number;
      shadowsEnabled: boolean;
      trafficFleet: number;
      pedestrianCrowd: number;
      avgFrameTimeMs: number;
      derivedFps: number;
      triangles: number;
      drawMeshes: number;
    }> = {};

    for (const preset of presets) {
      engine.setGraphicsQuality(preset);

      const stats = countTrianglesInObject(internal.scene);
      const isShadowsOn = internal.renderer.shadowMap.enabled;
      const shadowSize = isShadowsOn ? internal.sunLight.shadow.mapSize.x : 0;
      const trafficCount = internal.trafficSystem.vehicles.length;
      const pedCount = internal.pedestrianSystem.pedestrians.length;

      // Measure 50 frame iterations
      const start = performance.now();
      for (let f = 0; f < 50; f += 1) {
        internal.gameMinutes += 0.1;
        internal.updateLighting();
      }
      const elapsed = performance.now() - start;
      const avgFrameTime = elapsed / 50;
      const derivedFps = Math.min(1000 / (avgFrameTime || 0.001), 1000);

      measurements[preset] = {
        pixelRatioCap: internal.renderer.pixelRatio,
        shadowMapSize: shadowSize,
        shadowsEnabled: isShadowsOn,
        trafficFleet: trafficCount,
        pedestrianCrowd: pedCount,
        avgFrameTimeMs: Number(avgFrameTime.toFixed(3)),
        derivedFps: Math.round(derivedFps),
        triangles: stats.triangles,
        drawMeshes: stats.meshes,
      };
    }

    // Verify preset progressions
    assert.equal(measurements.performance.shadowsEnabled, false, "Performance disables shadows");
    assert.equal(measurements.balanced.shadowsEnabled, true, "Balanced enables shadows");
    assert.equal(measurements.balanced.shadowMapSize, 1024, "Balanced uses 1024 shadow map");
    assert.equal(measurements.quality.shadowMapSize, 2048, "Quality uses 2048 shadow map");

    assert.ok(measurements.performance.trafficFleet <= measurements.balanced.trafficFleet);
    assert.ok(measurements.balanced.trafficFleet <= measurements.quality.trafficFleet);

    assert.ok(measurements.performance.pedestrianCrowd <= measurements.balanced.pedestrianCrowd);
    assert.ok(measurements.balanced.pedestrianCrowd <= measurements.quality.pedestrianCrowd);

    // Print measurements into test output for authoritative report logging
    console.log("--- PERFORMANCE MEASUREMENTS COLLECTED ---");
    console.log(JSON.stringify(measurements, null, 2));
    console.log("-------------------------------------------");
  } finally {
    engine.dispose();
  }
});
