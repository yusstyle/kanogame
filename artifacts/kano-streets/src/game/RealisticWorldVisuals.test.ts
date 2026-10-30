import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createMaterials } from "./materials";
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
    stroke() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
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

test("1. Materials Architecture: PBR Materials & High-Fidelity Textures", () => {
  installBrowserStubs();
  const materials = createMaterials();

  // Core road and pedestrian surfaces
  assert.ok(materials.asphalt, "Asphalt material must exist");
  assert.ok(materials.asphalt.roughness >= 0.85, "Asphalt must have realistic rough tarmac finish");
  assert.ok(materials.sidewalk, "Sidewalk material must exist");
  assert.ok(materials.sidewalk.map, "Sidewalk must have procedural modular paver texture map");

  // Safety striped curbs
  assert.ok(materials.curbStriped, "Arterial black/white safety striped curb material must exist");
  assert.ok(materials.curbStriped.map, "Striped curb must have repeating stripe texture");
  assert.ok(materials.curbYellowStriped, "Intersection black/yellow hazard curb material must exist");

  // Environmental infrastructure materials
  assert.ok(materials.solarPanel, "Photovoltaic solar panel material must exist for streetlights");
  assert.ok(materials.solarPanel.metalness && materials.solarPanel.metalness > 0.5, "Solar panel must have metallic sheen");
  assert.ok(materials.burglarBars, "Security burglar bar material must exist");
  assert.ok(materials.terracotta, "Terracotta / earthenware clay material must exist");
});

test("2. Road Networks & Infrastructure: Safety Curbs, Stop Bars & Solar Streetlights", () => {
  installBrowserStubs();
  const materials = createMaterials();
  const world = createWorld(materials);

  assert.ok(world.root, "World root group must be created");
  assert.ok(world.colliders.length > 50, "World colliders must be registered");

  // Find solar streetlights in the world
  let foundSolarPanel = false;
  let foundLuminaireLens = false;
  world.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material === materials.solarPanel) foundSolarPanel = true;
      if (child.material === materials.lampGlow || child.material === materials.glassLit) foundLuminaireLens = true;
    }
  });

  assert.ok(foundSolarPanel, "World must contain solar streetlights with photovoltaic panels");
  assert.ok(foundLuminaireLens, "World must contain illuminated streetlight luminaire lenses");
});

test("3. Architectural Vernacular: Traditional Hausa & Modern Kano Building Details", () => {
  installBrowserStubs();
  const materials = createMaterials();
  const world = createWorld(materials);

  // Check that authentic roadside vendor spots exist in the world
  // Mai Shayi stand at (-36, 18.5), Vulcanizer at (36, -11.8), Recharge kiosk at (-16, -11.8)
  const maiShayiCollider = world.colliders.find(
    (c) => Math.hypot(c.x - (-36), c.z - 18.5) < 2.0,
  );
  assert.ok(maiShayiCollider, "Mai Shayi tea stand must be positioned on Sabon Gari commercial sidewalk");

  const vulcanizerCollider = world.colliders.find(
    (c) => Math.hypot(c.x - 36, c.z - (-11.8)) < 2.0,
  );
  assert.ok(vulcanizerCollider, "Vulcanizer tire repair station must be positioned on service sidewalk");

  const rechargeCollider = world.colliders.find(
    (c) => Math.hypot(c.x - (-16), c.z - (-11.8)) < 2.0,
  );
  assert.ok(rechargeCollider, "Recharge card / POS umbrella kiosk must be positioned on commercial sidewalk");
});

test("4. Dynamic Solar Arc & Lighting Cycle: Smooth Day-Night Progression", () => {
  const { canvas, rendererFactory } = installBrowserStubs();

  let latestSnapshot: any = null;
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: (s) => {
        latestSnapshot = s;
      },
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  // @ts-expect-error accessing private field
  const sun = engine.sunLight;
  assert.ok(sun, "Directional sun light must be instantiated");

  // Test Morning Sun (07:00 AM) - Sun in East (+X relative to player)
  // @ts-expect-error accessing private field
  engine.gameMinutes = 7 * 60; // 07:00
  // @ts-expect-error accessing private method
  engine.updateLighting();

  // @ts-expect-error accessing private field
  const morningX = sun.position.x - engine.playerPosition.x;
  assert.ok(morningX > 0, "Morning sun must be positioned in the East (positive X offset)");

  // Test Midday Sun (12:00 PM) - Sun high overhead
  // @ts-expect-error accessing private field
  engine.gameMinutes = 12 * 60; // 12:00
  // @ts-expect-error accessing private method
  engine.updateLighting();

  // @ts-expect-error accessing private field
  const noonY = sun.position.y - engine.playerPosition.y;
  assert.ok(noonY > 60, "Midday sun must be high in the sky (elevation > 60m)");

  // Test Evening Sun (17:30 PM) - Sun in West (-X relative to player)
  // @ts-expect-error accessing private field
  engine.gameMinutes = 17.5 * 60; // 17:30
  // @ts-expect-error accessing private method
  engine.updateLighting();

  // @ts-expect-error accessing private field
  const eveningX = sun.position.x - engine.playerPosition.x;
  assert.ok(eveningX < 0, "Evening sun must be positioned in the West (negative X offset)");

  // Test Nighttime (22:00 PM) - Emissive street lanterns illuminated
  // @ts-expect-error accessing private field
  engine.gameMinutes = 22 * 60; // 22:00
  // @ts-expect-error accessing private method
  engine.updateLighting();

  // @ts-expect-error accessing private field
  const lampGlowMat = engine.materials.lampGlow;
  assert.ok(lampGlowMat.emissiveIntensity > 1.5, "Streetlights must have high emissive intensity at night");

  engine.dispose();
});

test("5. Graphics Presets & Performance Scaling: Low, Balanced & High Settings", () => {
  const { canvas, rendererFactory } = installBrowserStubs();

  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: () => {},
      onPause: () => {},
    },
    rendererFactory,
  );
  engine.setScreen("playing");

  // 1. Performance Preset
  engine.setGraphicsQuality("performance");
  // @ts-expect-error accessing private field
  assert.equal(engine.renderer.shadowMap.enabled, false, "Performance preset disables shadows for 60 FPS on low-end hardware");
  // @ts-expect-error accessing private field
  assert.equal(engine.trafficSystem.vehicles.length, 4, "Performance preset limits traffic fleet to 4 vehicles");

  // 2. Balanced Preset
  engine.setGraphicsQuality("balanced");
  // @ts-expect-error accessing private field
  assert.equal(engine.renderer.shadowMap.enabled, true, "Balanced preset enables shadow mapping");
  // @ts-expect-error accessing private field
  assert.equal(engine.sunLight.shadow.mapSize.x, 1024, "Balanced preset uses 1024x1024 shadow map resolution");
  // @ts-expect-error accessing private field
  assert.equal(engine.trafficSystem.vehicles.length, 6, "Balanced preset manages balanced fleet of 6 vehicles");

  // 3. Quality Preset
  engine.setGraphicsQuality("quality");
  // @ts-expect-error accessing private field
  assert.equal(engine.renderer.shadowMap.enabled, true, "Quality preset enables shadow mapping");
  // @ts-expect-error accessing private field
  assert.equal(engine.sunLight.shadow.mapSize.x, 2048, "Quality preset uses crisp 2048x2048 shadow map resolution");
  // @ts-expect-error accessing private field
  assert.equal(engine.trafficSystem.vehicles.length, 8, "Quality preset scales to full 8 vehicle fleet");

  engine.dispose();
});
