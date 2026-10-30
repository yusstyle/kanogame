import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createMaterials, createKanoEnvironmentMap } from "./materials";
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

test("Phase 6 Graphics: Environment Map & Image-Based Lighting (IBL) Initialization", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {} },
    rendererFactory,
  );

  try {
    const internal = engine as any;
    assert.ok(internal.scene.environment, "scene.environment must be assigned for PBR specular reflections");
    assert.equal(
      internal.scene.environment.mapping,
      THREE.EquirectangularReflectionMapping,
      "environment texture must use EquirectangularReflectionMapping",
    );
  } finally {
    engine.dispose();
  }
});

test("Phase 6 Graphics: Procedural Normal Maps on Architectural & Infrastructure Surfaces", () => {
  installBrowserStubs();
  const materials = createMaterials();

  assert.ok(materials.asphalt, "Asphalt material exists");
  assert.ok(materials.asphalt.normalMap, "Asphalt has procedural normalMap for micro-relief");
  assert.ok(materials.asphalt.normalScale.x > 0, "Asphalt has valid normalScale");

  assert.ok(materials.corrugatedZinc, "Corrugated zinc material exists");
  assert.ok(materials.corrugatedZinc.normalMap, "Corrugated zinc has periodic ridge normalMap");
  assert.equal(materials.corrugatedZinc.metalness, 0.72, "Corrugated zinc has metallic PBR response");

  assert.ok(materials.concrete, "Concrete material exists");
  assert.ok(materials.concrete.normalMap, "Concrete has aggregate normalMap");

  assert.ok(materials.plaster, "Plaster material exists");
  assert.ok(materials.plaster.normalMap, "Plaster has mud plaster wall normalMap");

  assert.ok(materials.glass, "Glass material exists");
  assert.ok(materials.glass.transparent, "Glass is configured with transparency");
  assert.ok(materials.glass.roughness <= 0.15, "Glass has smooth specular surface for sky reflections");
});

test("Phase 6 Graphics: Dual-Tone Hemisphere & Sahelian Directional Diurnal Lighting", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {} },
    rendererFactory,
  );

  try {
    const internal = engine as any;
    const sun = internal.sunLight;
    const hemi = internal.hemiLight;
    const bounce = internal.bounceLight;

    assert.ok(sun, "Directional sunlight exists");
    assert.ok(hemi, "Dual-tone hemisphere light exists");
    assert.ok(bounce, "Upward ground bounce light exists");

    // 1. Midday Sahelian Sun (12:00)
    internal.gameMinutes = 12 * 60;
    internal.updateLighting();

    assert.ok(sun.intensity >= 2.5, "Midday sun has intense Sahelian direct illumination");
    assert.ok(hemi.intensity < 1.1, "Hemisphere ambient fill is balanced to preserve directional contrast");
    assert.ok(bounce.intensity > 0.15, "Midday ground bounce is active");

    // 2. Golden Hour Sunset (18:00)
    internal.gameMinutes = 18 * 60;
    internal.updateLighting();
    assert.ok(sun.position.x - internal.playerPosition.x < 0, "Sunset light is in the West (-X)");

    // 3. Nighttime Starlit Sahel (22:00)
    internal.gameMinutes = 22 * 60;
    internal.updateLighting();
    assert.ok(sun.intensity <= 0.5, "Night moonlight is soft and subdued");
    assert.ok(internal.materials.lampGlow.emissiveIntensity > 1.8, "Street lanterns are brightly emissive at night");
    assert.ok(internal.materials.glassLit.emissiveIntensity > 1.0, "Interior windows glow warm at night");
  } finally {
    engine.dispose();
  }
});

test("Phase 6 Graphics: Weather Preset Atmosphere & Dynamic Sky Transitions", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {} },
    rendererFactory,
  );

  try {
    const internal = engine as any;

    // Test Harmattan Weather
    internal.weatherSystem.setPreset("harmattan");
    internal.updateLighting();
    assert.equal(internal.weatherSystem.getPreset(), "harmattan");

    const harmattanFog = internal.scene.fog as THREE.Fog;
    assert.ok(harmattanFog, "Scene has fog");
    assert.ok(harmattanFog.far <= 170, "Harmattan dust haze reduces far visibility authentically");

    // Test Clear Weather
    internal.weatherSystem.setPreset("clear");
    internal.updateLighting();
    assert.equal(internal.weatherSystem.getPreset(), "clear");
    assert.ok(harmattanFog.far >= 230, "Clear Sahel sky expands draw distance");

    // Sky dome mesh color synchronization
    if (internal.world?.skyMesh) {
      assert.ok(internal.world.skyMesh.material.color, "Sky dome mesh has color");
    }
  } finally {
    engine.dispose();
  }
});

test("Phase 6 Graphics: Ground Contact Shadows on Vehicle Chassis", () => {
  const { canvas, rendererFactory } = installBrowserStubs();
  const engine = new GameEngine(
    canvas,
    { onSnapshot: () => {}, onPause: () => {} },
    rendererFactory,
  );

  try {
    const internal = engine as any;
    const carRoot = internal.car.root as THREE.Group;
    let foundShadowPlane = false;
    carRoot.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry) {
        if (child.material.transparent && child.material.depthWrite === false) {
          foundShadowPlane = true;
        }
      }
    });
    assert.ok(foundShadowPlane, "Sedan has ground contact shadow plane beneath chassis");
  } finally {
    engine.dispose();
  }
});

