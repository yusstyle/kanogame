import * as THREE from "three";
import { loadTexture } from "./assetManifest";
import type { GameMaterials } from "./types";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function noiseTexture(
  base: string,
  fleck: string,
  density: number,
  seed: number,
  repeats: [number, number],
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create procedural surface texture");

  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);
  const random = seededRandom(seed);
  for (let i = 0; i < density; i += 1) {
    const size = 0.35 + random() * 2.1;
    context.globalAlpha = 0.05 + random() * 0.17;
    context.fillStyle = fleck;
    context.fillRect(random() * 256, random() * 256, size, size);
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeats);
  texture.anisotropy = 4;
  return texture;
}

function standard(
  color: string,
  roughness: number,
  map?: THREE.Texture,
  extra: Partial<THREE.MeshStandardMaterialParameters> = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    ...(map ? { map } : {}),
    ...extra,
  });
}

function relief(texture: THREE.Texture, scale: number) {
  const bumpMap = texture.clone();
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.needsUpdate = true;
  return { bumpMap, bumpScale: scale };
}

function makeSignMaterial(label: string, accent = "#c7a16c") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create procedural shop sign");

  context.fillStyle = "#25352f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accent;
  context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = "#1d2722";
  context.font = "700 40px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label.toUpperCase(), 256, 65, 470);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return standard("#ffffff", 0.8, texture);
}

function createRoadAsphaltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create procedural road surface texture");

  // Base asphalt: dark tarmac with warm aggregate undertone
  context.fillStyle = "#3e3b37";
  context.fillRect(0, 0, 512, 512);

  // Micro gravel speckles
  const random = seededRandom(107);
  for (let i = 0; i < 9000; i += 1) {
    const size = 0.5 + random() * 1.8;
    context.globalAlpha = 0.08 + random() * 0.22;
    context.fillStyle = random() > 0.4 ? "#7a746c" : "#22201e";
    context.fillRect(random() * 512, random() * 512, size, size);
  }

  // Weathering tar lines & micro-cracks
  if (typeof context.beginPath === "function") {
    context.globalAlpha = 0.22;
    context.strokeStyle = "#252320";
    context.lineWidth = 1.2;
    for (let c = 0; c < 14; c += 1) {
      let x = random() * 512;
      let y = random() * 512;
      context.beginPath();
      context.moveTo(x, y);
      for (let s = 0; s < 4; s += 1) {
        x += (random() - 0.5) * 35;
        y += (random() - 0.5) * 35;
        context.lineTo(x, y);
      }
      context.stroke();
    }
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.anisotropy = 4;
  return texture;
}

function createCorrugatedZincTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  for (let x = 0; x < 128; x += 8) {
    const grad = context.createLinearGradient(x, 0, x + 8, 0);
    grad.addColorStop(0, "#545d62");
    grad.addColorStop(0.5, "#939ea4");
    grad.addColorStop(1, "#545d62");
    context.fillStyle = grad;
    context.fillRect(x, 0, 8, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  return texture;
}

function createSidewalkPaverTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  // Concrete base with warm sandy dust tone
  ctx.fillStyle = "#b7a88b";
  ctx.fillRect(0, 0, 256, 256);

  // Modular paver grid grooves (4x4 tiles of 64px each)
  ctx.strokeStyle = "#82745d";
  ctx.lineWidth = 2.5;
  for (let i = 64; i < 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Micro gravel specks & surface wear
  const random = seededRandom(241);
  for (let i = 0; i < 4000; i += 1) {
    const size = 0.5 + random() * 1.5;
    ctx.globalAlpha = 0.08 + random() * 0.18;
    ctx.fillStyle = random() > 0.45 ? "#ded2bb" : "#695e4d";
    ctx.fillRect(random() * 256, random() * 256, size, size);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 4;
  return texture;
}

function createStripedCurbTexture(color1 = "#f0ece1", color2 = "#22211e", stripeWidth = 16) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = color2;
  for (let x = 0; x < 128; x += stripeWidth * 2) {
    ctx.fillRect(x, 0, stripeWidth, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(8, 1);
  return texture;
}

function createSolarPanelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#122030";
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = "#385b80";
  ctx.lineWidth = 1.2;
  for (let i = 16; i < 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }

  // Silver busbars
  ctx.strokeStyle = "#9bb4cc";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(32, 0); ctx.lineTo(32, 128);
  ctx.moveTo(96, 0); ctx.lineTo(96, 128);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

export function createMaterials(): GameMaterials {
  const plasterMap = noiseTexture("#b49a72", "#f0d9a5", 4600, 42, [2, 2]);
  const clayMap = noiseTexture("#a77950", "#e2b27a", 3900, 87, [2, 2]);
  const concreteMap = noiseTexture("#9b958a", "#e2d8c4", 3700, 19, [2, 2]);
  const asphaltMap = createRoadAsphaltTexture();
  const asphaltPatchMap = noiseTexture("#34322e", "#6b655b", 5200, 29, [1, 1]);
  const earthMap = noiseTexture("#9d8057", "#d1ad70", 9000, 73, [9, 9]);
  const stoneMap = noiseTexture("#847763", "#c6b996", 4200, 31, [2, 2]);
  const zincMap = createCorrugatedZincTexture();
  const sidewalkMap = createSidewalkPaverTexture();
  const stripedCurbBwMap = createStripedCurbTexture("#f4f0e6", "#1c1b18", 16);
  const stripedCurbYelMap = createStripedCurbTexture("#d8af18", "#1c1b18", 16);
  const solarMap = createSolarPanelTexture();

  // PBR Texture Maps (Poly Haven CC0 Worn Plaster Wall 1k)
  const plasterDiff = loadTexture("/assets/worn_plaster_wall/worn_plaster_wall_diff_1k.jpg", true, [2.4, 2.4]);
  const plasterNor = loadTexture("/assets/worn_plaster_wall/worn_plaster_wall_nor_gl_1k.jpg", false, [2.4, 2.4]);
  const plasterRough = loadTexture("/assets/worn_plaster_wall/worn_plaster_wall_rough_1k.jpg", false, [2.4, 2.4]);

  const plaster = standard("#e0c695", 0.93, plasterDiff || plasterMap, relief(plasterMap, 0.055));
  if (plasterNor) {
    plaster.normalMap = plasterNor;
    plaster.normalScale = new THREE.Vector2(0.7, 0.7);
  }
  if (plasterRough) {
    plaster.roughnessMap = plasterRough;
  }
  plaster.userData.textureTileSize = 1.8;

  const compoundWall = standard("#d8c092", 0.94, plasterDiff || plasterMap);
  if (plasterNor) {
    compoundWall.normalMap = plasterNor;
    compoundWall.normalScale = new THREE.Vector2(0.85, 0.85);
  }
  if (plasterRough) {
    compoundWall.roughnessMap = plasterRough;
  }
  compoundWall.userData.textureTileSize = 2.4;

  return {
    ground: standard("#c1a16e", 1, earthMap),
    asphalt: standard("#f4f0e8", 0.94, asphaltMap, relief(asphaltMap, 0.035)),
    asphaltPatch: standard("#ffffff", 0.99, asphaltPatchMap, relief(asphaltPatchMap, 0.05)),
    sidewalk: standard("#b7a88b", 0.92, sidewalkMap || concreteMap, relief(concreteMap, 0.035)),
    curb: standard("#c0b39a", 0.92, concreteMap),
    curbStriped: standard("#e2ded4", 0.88, stripedCurbBwMap),
    curbYellowStriped: standard("#d8af18", 0.88, stripedCurbYelMap),
    solarPanel: standard("#18293d", 0.22, solarMap, { metalness: 0.65 }),
    terracotta: standard("#a45934", 0.94, clayMap, relief(clayMap, 0.07)),
    burglarBars: standard("#1f2324", 0.45, undefined, { metalness: 0.72, roughness: 0.45 }),
    roadMarking: standard("#d9c89e", 0.82),
    drain: standard("#373936", 0.94, stoneMap, relief(stoneMap, 0.04)),
    plaster,
    compoundWall,
    ochre: standard("#b9905c", 0.96, clayMap, relief(clayMap, 0.06)),
    clay: standard("#98734f", 0.98, clayMap, relief(clayMap, 0.075)),
    concrete: standard("#aaa396", 0.93, concreteMap, relief(concreteMap, 0.05)),
    roof: standard("#766e60", 0.97, concreteMap),
    trim: standard("#e6d4ad", 0.88),
    darkTrim: standard("#584638", 0.93),
    wood: standard("#674a32", 0.9),
    metal: standard("#494d49", 0.64, undefined, { metalness: 0.24 }),
    glass: standard("#365158", 0.28, undefined, { metalness: 0.12 }),
    glassLit: standard("#d4b987", 0.72, undefined, {
      emissive: "#705b39",
      emissiveIntensity: 0.14,
    }),
    cloth: standard("#b59d70", 0.9),
    clothRed: standard("#a65334", 0.91),
    foliage: standard("#526849", 0.98),
    foliageLight: standard("#758355", 0.98),
    bark: standard("#69523b", 0.98),
    stone: standard("#9c8d71", 1, stoneMap),
    white: standard("#e4dcc8", 0.84),
    black: standard("#282b2a", 0.72),
    kekeYellow: standard("#e2aa28", 0.38, undefined, { metalness: 0.12, roughness: 0.38 }),
    kekeGreen: standard("#22753a", 0.44, undefined, { metalness: 0.1, roughness: 0.44 }),
    corrugatedZinc: standard("#889299", 0.48, zincMap, { metalness: 0.65 }),
    roadDust: standard("#b0946d", 0.98, earthMap),
    motorcycleRed: standard("#b82e24", 0.36, undefined, { metalness: 0.18, roughness: 0.36 }),
    motorcycleBlue: standard("#24558f", 0.36, undefined, { metalness: 0.18, roughness: 0.36 }),
    carpetRed: standard("#781e18", 0.94),
    tileFloor: standard("#d4cebf", 0.32, undefined, { roughness: 0.32, metalness: 0.08 }),
    policeNavy: standard("#141b2d", 0.48, undefined, { metalness: 0.22, roughness: 0.48 }),
    karotaYellow: standard("#d8af18", 0.42, undefined, { roughness: 0.42 }),
    karotaGreen: standard("#156228", 0.45, undefined, { roughness: 0.45 }),
    goldTrim: standard("#c9a23b", 0.35, undefined, { metalness: 0.62, roughness: 0.35 }),
    neonCyan: standard("#18d6e8", 0.2, undefined, { emissive: "#0cb2c4", emissiveIntensity: 0.85 }),
    neonMagenta: standard("#e8188e", 0.2, undefined, { emissive: "#c40c72", emissiveIntensity: 0.85 }),
    bankBlue: standard("#123862", 0.38, undefined, { metalness: 0.3, roughness: 0.38 }),
    warmOrange: standard("#e26a22", 0.42, undefined, { roughness: 0.42 }),
    lampGlow: standard("#ffeaa7", 0.2, undefined, { emissive: "#ffb142", emissiveIntensity: 1.6 }),
    headlightBeam: standard("#fff8e7", 0.1, undefined, {
      emissive: "#ffeeaa",
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.35,
    }),
    weatheredBrick: standard("#8a4732", 0.92, clayMap, relief(clayMap, 0.08)),
    rustedZinc: standard("#7d5e4b", 0.72, zincMap, { metalness: 0.45, roughness: 0.72 }),
  };
}

export { makeSignMaterial };
