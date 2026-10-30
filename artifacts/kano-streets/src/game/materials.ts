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
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return undefined;

  // Base galvanized metal tone
  context.fillStyle = "#78838a";
  context.fillRect(0, 0, 256, 256);

  // Sinusoidal corrugation wave gradient (waves of 16px)
  for (let x = 0; x < 256; x += 16) {
    const grad = context.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, "#4a5359");
    grad.addColorStop(0.35, "#88949b");
    grad.addColorStop(0.5, "#b5c1c8"); // Highlight crest
    grad.addColorStop(0.7, "#7f8b92");
    grad.addColorStop(1, "#4a5359"); // Trough shadow
    context.fillStyle = grad;
    context.fillRect(x, 0, 16, 256);
  }

  // Galvanized zinc spangle crystallization micro-flakes
  const random = seededRandom(107);
  for (let i = 0; i < 2200; i += 1) {
    const px = random() * 256;
    const py = random() * 256;
    const size = 1 + random() * 2.5;
    context.fillStyle = random() > 0.5 ? "#cdd7dc" : "#5a6369";
    context.globalAlpha = 0.12 + random() * 0.18;
    context.fillRect(px, py, size, size);
  }

  // Subtle Sahelian dust oxidation wash along horizontal sheet overlaps
  for (let y = 0; y < 256; y += 64) {
    const dustGrad = context.createLinearGradient(0, y, 0, y + 14);
    dustGrad.addColorStop(0, "rgba(180, 138, 92, 0.25)");
    dustGrad.addColorStop(1, "rgba(180, 138, 92, 0)");
    context.fillStyle = dustGrad;
    context.fillRect(0, y, 256, 14);
  }
  context.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  texture.anisotropy = 4;
  return texture;
}

function createHazardChevronTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  ctx.fillStyle = "#e5b222"; // High-visibility highway amber
  ctx.fillRect(0, 0, 256, 64);

  // 45-degree alternating diagonal black hazard stripes
  ctx.fillStyle = "#1e1e1a";
  if (typeof ctx.closePath === "function" && typeof ctx.fill === "function") {
    for (let x = -64; x < 256 + 64; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 16 - 32, 64);
      ctx.lineTo(x - 32, 64);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Fallback for minimal canvas mock stubs in test runners
    for (let x = 0; x < 256; x += 32) {
      ctx.fillRect(x, 0, 16, 64);
    }
  }

  // Weathering and surface grit
  const random = seededRandom(552);
  for (let i = 0; i < 500; i += 1) {
    ctx.fillStyle = "#9a8b6e";
    ctx.globalAlpha = 0.12 + random() * 0.18;
    ctx.fillRect(random() * 256, random() * 64, 1.5, 1.5);
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(4, 1);
  return texture;
}

function createBurlapSackTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  ctx.fillStyle = "#a88e68";
  ctx.fillRect(0, 0, 128, 128);

  // Crosshatch jute weave
  const random = seededRandom(773);
  ctx.strokeStyle = "#7c6444";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 128; i += 4) {
    ctx.globalAlpha = 0.3 + random() * 0.25;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
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

function createTileFloorTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  try {
    // Base bright porcelain tile with subtle warm cream tone
    ctx.fillStyle = "#f3efe6";
    ctx.fillRect(0, 0, 512, 512);

    // Subtle stone flecks & marbling
    const random = seededRandom(503);
    for (let i = 0; i < 6000; i += 1) {
      const size = 0.5 + random() * 1.5;
      ctx.globalAlpha = 0.03 + random() * 0.08;
      ctx.fillStyle = random() > 0.5 ? "#ffffff" : "#d8cfbf";
      ctx.fillRect(random() * 512, random() * 512, size, size);
    }

    // Crisp modern 4x4 ceramic tile grout lines (128px per tile)
    if (typeof ctx.beginPath === "function" && typeof ctx.stroke === "function") {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#d6cec0";
      ctx.lineWidth = 3.0;
      for (let i = 128; i < 512; i += 128) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(512, i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  } catch {
    // Graceful fallback for minimal mock DOM test environments
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 4;
  return texture;
}

function createWovenRugTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  try {
    // Outer border & base field: rich dark charcoal frame
    ctx.fillStyle = "#2d2621";
    ctx.fillRect(0, 0, 512, 512);

    // Secondary warm terracotta geometric frame
    ctx.fillStyle = "#9c573d";
    ctx.fillRect(16, 16, 480, 480);

    // Inner field: warm natural linen ivory
    ctx.fillStyle = "#f5f0e8";
    ctx.fillRect(36, 36, 440, 440);

    // Geometric fretwork & diamond motif
    if (typeof ctx.strokeRect === "function") {
      ctx.strokeStyle = "#382e26";
      ctx.lineWidth = 3.5;
      ctx.strokeRect(52, 52, 408, 408);
    }

    // Center diamond motif
    if (
      typeof ctx.beginPath === "function" &&
      typeof ctx.closePath === "function" &&
      typeof ctx.lineTo === "function" &&
      typeof ctx.stroke === "function"
    ) {
      ctx.strokeStyle = "#382e26";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(256, 120);
      ctx.lineTo(392, 256);
      ctx.lineTo(256, 392);
      ctx.lineTo(120, 256);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = "#9c573d";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(256, 160);
      ctx.lineTo(352, 256);
      ctx.lineTo(256, 352);
      ctx.lineTo(160, 256);
      ctx.closePath();
      ctx.stroke();
    }

    // Woven textile cross-hatch noise
    const random = seededRandom(777);
    for (let i = 0; i < 8000; i += 1) {
      const size = 0.5 + random() * 1.5;
      ctx.globalAlpha = 0.04 + random() * 0.09;
      ctx.fillStyle = random() > 0.5 ? "#ffffff" : "#4a3b2c";
      ctx.fillRect(random() * 512, random() * 512, size, size);
    }
    ctx.globalAlpha = 1;
  } catch {
    // Graceful fallback for minimal mock DOM test environments
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

function createWoodGrainTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  // Base warm walnut timber
  ctx.fillStyle = "#785336";
  ctx.fillRect(0, 0, 256, 256);

  // Longitudinal grain streaks
  const random = seededRandom(331);
  for (let y = 0; y < 256; y += 2) {
    ctx.globalAlpha = 0.06 + random() * 0.16;
    ctx.fillStyle = random() > 0.45 ? "#946844" : "#563820";
    ctx.fillRect(0, y, 256, 1.5 + random() * 2);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = 4;
  return texture;
}

function createInteriorStippleTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  try {
    ctx.fillStyle = "#f7f3ec";
    ctx.fillRect(0, 0, 256, 256);

    const random = seededRandom(1049);
    for (let i = 0; i < 7000; i += 1) {
      const size = 0.5 + random() * 1.5;
      ctx.globalAlpha = 0.025 + random() * 0.055;
      ctx.fillStyle = random() > 0.5 ? "#ffffff" : "#ded7cb";
      ctx.fillRect(random() * 256, random() * 256, size, size);
    }
    ctx.globalAlpha = 1;
  } catch {
    // Fallback for minimal mock environments
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 4;
  return texture;
}

function createFabricWeaveTexture(baseHex: string, darkHex: string, seed: number) {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  try {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    const random = seededRandom(seed);
    if (typeof ctx.beginPath === "function" && typeof ctx.stroke === "function") {
      ctx.lineWidth = 1.0;
      for (let i = 0; i < 256; i += 4) {
        ctx.globalAlpha = 0.06 + random() * 0.08;
        ctx.strokeStyle = darkHex;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 256);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(256, i);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 3500; i += 1) {
      const size = 0.5 + random() * 1.5;
      ctx.globalAlpha = 0.03 + random() * 0.08;
      ctx.fillStyle = random() > 0.5 ? "#ffffff" : darkHex;
      ctx.fillRect(random() * 256, random() * 256, size, size);
    }
    ctx.globalAlpha = 1;
  } catch {
    // Fallback for minimal mock environments
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.anisotropy = 4;
  return texture;
}

function createMarbleTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  try {
    ctx.fillStyle = "#f8f6f0";
    ctx.fillRect(0, 0, 512, 512);

    const random = seededRandom(941);
    if (typeof ctx.beginPath === "function" && typeof ctx.stroke === "function") {
      for (let v = 0; v < 8; v += 1) {
        let x = random() * 512;
        let y = random() * 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = v % 2 === 0 ? "#ded5c5" : "#c4baa9";
        ctx.lineWidth = 1.2 + random() * 1.8;
        ctx.globalAlpha = 0.12 + random() * 0.18;
        for (let seg = 0; seg < 6; seg += 1) {
          x += (random() - 0.45) * 80;
          y += (random() - 0.45) * 80;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    for (let i = 0; i < 4000; i += 1) {
      const size = 0.5 + random() * 1.2;
      ctx.globalAlpha = 0.02 + random() * 0.05;
      ctx.fillStyle = random() > 0.5 ? "#ffffff" : "#c8bfb0";
      ctx.fillRect(random() * 512, random() * 512, size, size);
    }
    ctx.globalAlpha = 1;
  } catch {
    // Fallback for minimal mock environments
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 4;
  return texture;
}

function createBrushedMetalTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  try {
    ctx.fillStyle = "#8a8f8b";
    ctx.fillRect(0, 0, 256, 256);
    const random = seededRandom(419);
    for (let y = 0; y < 256; y += 1) {
      ctx.globalAlpha = 0.04 + random() * 0.12;
      ctx.fillStyle = random() > 0.48 ? "#b5bab6" : "#626663";
      ctx.fillRect(0, y, 256, 1);
    }
    ctx.globalAlpha = 1;
  } catch {
    // Fallback for minimal mock environments
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 4;
  return texture;
}

function createProceduralNormalTexture(
  width: number,
  height: number,
  heightSampler: (x: number, y: number) => number,
  strength: number,
  repeatX: number,
  repeatY: number,
): THREE.Texture | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.createImageData !== "function" || typeof ctx.putImageData !== "function") {
      return undefined;
    }
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y += 1) {
      const yPrev = (y - 1 + height) % height;
      const yNext = (y + 1) % height;
      for (let x = 0; x < width; x += 1) {
        const xPrev = (x - 1 + width) % width;
        const xNext = (x + 1) % width;

        const left = heightSampler(xPrev, y);
        const right = heightSampler(xNext, y);
        const down = heightSampler(x, yPrev);
        const up = heightSampler(x, yNext);

        const dx = (right - left) * strength;
        const dy = (down - up) * strength;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        const idx = (y * width + x) * 4;
        data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return undefined;
  }
}

function createPlasterNormalTexture(): THREE.Texture | undefined {
  const rand = seededRandom(773);
  const table = new Float32Array(128 * 128);
  for (let i = 0; i < table.length; i++) table[i] = rand();
  return createProceduralNormalTexture(
    128,
    128,
    (x, y) => {
      const w1 = Math.sin((x / 128) * Math.PI * 4) * 0.2 + Math.cos((y / 128) * Math.PI * 4) * 0.2;
      const n = table[(y % 128) * 128 + (x % 128)];
      return w1 + n * 0.6;
    },
    1.6,
    4,
    4,
  );
}

function createAsphaltNormalTexture(): THREE.Texture | undefined {
  const rand = seededRandom(331);
  const table = new Float32Array(128 * 128);
  for (let i = 0; i < table.length; i++) table[i] = rand();
  return createProceduralNormalTexture(
    128,
    128,
    (x, y) => {
      const grit = table[(y % 128) * 128 + (x % 128)];
      const ridge = Math.sin((x / 128) * Math.PI * 16) * 0.08;
      return grit * 0.85 + ridge;
    },
    1.4,
    8,
    8,
  );
}

function createCorrugatedZincNormalTexture(): THREE.Texture | undefined {
  return createProceduralNormalTexture(
    64,
    64,
    (x) => {
      const angle = (x / 64) * Math.PI * 8;
      return Math.sin(angle) * 0.5 + 0.5;
    },
    3.0,
    4,
    2,
  );
}

function createConcreteNormalTexture(): THREE.Texture | undefined {
  const rand = seededRandom(919);
  const table = new Float32Array(128 * 128);
  for (let i = 0; i < table.length; i++) table[i] = rand();
  return createProceduralNormalTexture(
    128,
    128,
    (x, y) => table[(y % 128) * 128 + (x % 128)],
    1.2,
    4,
    4,
  );
}

export function createKanoEnvironmentMap(
  skyColorHex = "#608fae",
  dustHorizonHex = "#d8cca8",
  groundHex = "#7a4e2d",
): THREE.Texture {
  if (typeof document === "undefined") {
    const tex = new THREE.Texture();
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const tex = new THREE.Texture();
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  try {
    // 1. Sky to horizon gradient
    if (typeof ctx.createLinearGradient === "function") {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 128);
      skyGrad.addColorStop(0, skyColorHex);
      skyGrad.addColorStop(0.55, "#82a8be");
      skyGrad.addColorStop(0.85, dustHorizonHex);
      skyGrad.addColorStop(1, dustHorizonHex);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 512, 128);

      // 2. Solar glare spot
      if (typeof ctx.createRadialGradient === "function") {
        const sunX = 180;
        const sunY = 55;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
        sunGrad.addColorStop(0, "rgba(255, 250, 230, 0.95)");
        sunGrad.addColorStop(0.2, "rgba(255, 235, 180, 0.45)");
        sunGrad.addColorStop(0.6, "rgba(235, 190, 140, 0.12)");
        sunGrad.addColorStop(1, "rgba(200, 160, 120, 0)");
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, 512, 128);
      }

      // 3. Ground gradient (warm laterite earth bounce)
      const groundGrad = ctx.createLinearGradient(0, 128, 0, 256);
      groundGrad.addColorStop(0, dustHorizonHex);
      groundGrad.addColorStop(0.18, groundHex);
      groundGrad.addColorStop(1, "#362215");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 128, 512, 128);
    }
  } catch {
    // Fallback for minimal stubs
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
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
  const tileMap = createTileFloorTexture();
  const rugMap = createWovenRugTexture();
  const woodGrainMap = createWoodGrainTexture();
  const interiorStippleMap = createInteriorStippleTexture();
  const hazardChevronMap = createHazardChevronTexture();
  const burlapMap = createBurlapSackTexture();
  const fabricLinenMap = createFabricWeaveTexture("#b59d70", "#635035", 613);
  const fabricTerracottaMap = createFabricWeaveTexture("#a65334", "#4a1e12", 829);
  const marbleMap = createMarbleTexture();
  const brushedMetalMap = createBrushedMetalTexture();

  // Procedural normal maps for physical micro-relief
  const plasterNormal = createPlasterNormalTexture();
  const asphaltNormal = createAsphaltNormalTexture();
  const zincNormal = createCorrugatedZincNormalTexture();
  const concreteNormal = createConcreteNormalTexture();

  // PBR Texture Maps (Poly Haven CC0 Worn Plaster Wall 1k)
  const plasterDiff = loadTexture("/assets/worn_plaster_wall/worn_plaster_wall_diff_1k.jpg", true, [2.4, 2.4]);
  const plasterNor = loadTexture("/assets/worn_plaster_wall/worn_plaster_wall_nor_gl_1k.jpg", false, [2.4, 2.4]);
  const plasterRough = loadTexture("/assets/worn_plaster_wall/worn_plaster_wall_rough_1k.jpg", false, [2.4, 2.4]);

  const plaster = standard("#e0c695", 0.93, plasterDiff || plasterMap, relief(plasterMap, 0.055));
  if (plasterNor) {
    plaster.normalMap = plasterNor;
    plaster.normalScale = new THREE.Vector2(0.7, 0.7);
  } else if (plasterNormal) {
    plaster.normalMap = plasterNormal;
    plaster.normalScale = new THREE.Vector2(0.65, 0.65);
  }
  if (plasterRough) {
    plaster.roughnessMap = plasterRough;
  }
  plaster.userData.textureTileSize = 1.8;

  const compoundWall = standard("#d8c092", 0.94, plasterDiff || plasterMap);
  if (plasterNor) {
    compoundWall.normalMap = plasterNor;
    compoundWall.normalScale = new THREE.Vector2(0.85, 0.85);
  } else if (plasterNormal) {
    compoundWall.normalMap = plasterNormal;
    compoundWall.normalScale = new THREE.Vector2(0.75, 0.75);
  }
  if (plasterRough) {
    compoundWall.roughnessMap = plasterRough;
  }
  compoundWall.userData.textureTileSize = 2.4;

  const interiorWall = standard("#f7f3ec", 0.72, interiorStippleMap, {
    ...(interiorStippleMap ? relief(interiorStippleMap, 0.015) : {}),
    roughness: 0.72,
  });
  if (plasterNor) {
    interiorWall.normalMap = plasterNor;
    interiorWall.normalScale = new THREE.Vector2(0.25, 0.25);
  } else if (plasterNormal) {
    interiorWall.normalMap = plasterNormal;
    interiorWall.normalScale = new THREE.Vector2(0.3, 0.3);
  }

  const ceilingMat = standard("#fbf9f5", 0.88, interiorStippleMap, {
    ...(interiorStippleMap ? relief(interiorStippleMap, 0.01) : {}),
    roughness: 0.88,
  });

  const asphalt = standard("#f4f0e8", 0.93, asphaltMap, relief(asphaltMap, 0.035));
  if (asphaltNormal) {
    asphalt.normalMap = asphaltNormal;
    asphalt.normalScale = new THREE.Vector2(0.55, 0.55);
  }

  const sidewalk = standard("#b7a88b", 0.9, sidewalkMap || concreteMap, relief(concreteMap, 0.035));
  if (concreteNormal) {
    sidewalk.normalMap = concreteNormal;
    sidewalk.normalScale = new THREE.Vector2(0.4, 0.4);
  }

  const curb = standard("#c0b39a", 0.9, concreteMap);
  if (concreteNormal) {
    curb.normalMap = concreteNormal;
    curb.normalScale = new THREE.Vector2(0.35, 0.35);
  }

  const concrete = standard("#aaa396", 0.92, concreteMap, relief(concreteMap, 0.05));
  if (concreteNormal) {
    concrete.normalMap = concreteNormal;
    concrete.normalScale = new THREE.Vector2(0.4, 0.4);
  }

  const ochre = standard("#b9905c", 0.95, clayMap, relief(clayMap, 0.06));
  if (plasterNormal) {
    ochre.normalMap = plasterNormal;
    ochre.normalScale = new THREE.Vector2(0.7, 0.7);
  }

  const clay = standard("#98734f", 0.96, clayMap, relief(clayMap, 0.075));
  if (plasterNormal) {
    clay.normalMap = plasterNormal;
    clay.normalScale = new THREE.Vector2(0.85, 0.85);
  }

  const corrugatedZinc = standard("#8e989f", 0.42, zincMap, { metalness: 0.72, roughness: 0.42 });
  if (zincNormal) {
    corrugatedZinc.normalMap = zincNormal;
    corrugatedZinc.normalScale = new THREE.Vector2(1.1, 1.1);
  }

  const rustedZinc = standard("#7d5e4b", 0.68, zincMap, { metalness: 0.52, roughness: 0.68 });
  if (zincNormal) {
    rustedZinc.normalMap = zincNormal;
    rustedZinc.normalScale = new THREE.Vector2(1.1, 1.1);
  }

  return {
    ground: standard("#c1a16e", 1, earthMap),
    asphalt,
    asphaltPatch: standard("#ffffff", 0.99, asphaltPatchMap, relief(asphaltPatchMap, 0.05)),
    sidewalk,
    curb,
    curbStriped: standard("#e2ded4", 0.88, stripedCurbBwMap),
    curbYellowStriped: standard("#d8af18", 0.88, stripedCurbYelMap),
    solarPanel: standard("#18293d", 0.18, solarMap, { metalness: 0.76, roughness: 0.18 }),
    terracotta: standard("#a45934", 0.94, clayMap, relief(clayMap, 0.07)),
    burglarBars: standard("#1f2324", 0.42, undefined, { metalness: 0.78, roughness: 0.42 }),
    roadMarking: standard("#d9c89e", 0.82),
    drain: standard("#373936", 0.94, stoneMap, relief(stoneMap, 0.04)),
    plaster,
    compoundWall,
    ochre,
    clay,
    concrete,
    roof: standard("#766e60", 0.97, concreteMap),
    trim: standard("#e6d4ad", 0.88),
    darkTrim: standard("#4a3b2f", 0.82),
    wood: standard("#785336", 0.68, woodGrainMap, woodGrainMap ? relief(woodGrainMap, 0.025) : {}),
    metal: standard("#828783", 0.28, brushedMetalMap, {
      metalness: 0.85,
      roughness: 0.28,
      ...(brushedMetalMap ? relief(brushedMetalMap, 0.015) : {}),
    }),
    glass: standard("#28414a", 0.1, undefined, {
      metalness: 0.25,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
    }),
    glassLit: standard("#d4b987", 0.45, undefined, {
      emissive: "#705b39",
      emissiveIntensity: 0.14,
      metalness: 0.1,
      roughness: 0.45,
    }),
    cloth: standard("#b59d70", 0.9, fabricLinenMap, fabricLinenMap ? relief(fabricLinenMap, 0.03) : {}),
    clothRed: standard("#a65334", 0.91, fabricTerracottaMap, fabricTerracottaMap ? relief(fabricTerracottaMap, 0.03) : {}),
    foliage: standard("#526849", 0.98),
    foliageLight: standard("#758355", 0.98),
    bark: standard("#69523b", 0.98),
    stone: standard("#9c8d71", 1, stoneMap),
    white: standard("#f6f1e8", 0.76),
    interiorWall,
    ceilingMat,
    black: standard("#282b2a", 0.72),
    kekeYellow: standard("#e2aa28", 0.32, undefined, { metalness: 0.22, roughness: 0.32 }),
    kekeGreen: standard("#22753a", 0.36, undefined, { metalness: 0.18, roughness: 0.36 }),
    corrugatedZinc,
    roadDust: standard("#b0946d", 0.98, earthMap),
    motorcycleRed: standard("#b82e24", 0.28, undefined, { metalness: 0.22, roughness: 0.28 }),
    motorcycleBlue: standard("#24558f", 0.28, undefined, { metalness: 0.22, roughness: 0.28 }),
    carpetRed: standard("#781e18", 0.94),
    tileFloor: standard("#ebe5d8", 0.26, tileMap, {
      ...(tileMap ? relief(tileMap, 0.035) : {}),
      roughness: 0.26,
      metalness: 0.06,
    }),
    patternedRug: standard("#ffffff", 0.92, rugMap, { roughness: 0.92 }),
    woodFloor: standard("#7a5336", 0.45, woodGrainMap, {
      ...(woodGrainMap ? relief(woodGrainMap, 0.02) : {}),
      roughness: 0.45,
    }),
    marbleWhite: standard("#f8f6f0", 0.22, marbleMap, {
      ...(marbleMap ? relief(marbleMap, 0.015) : {}),
      roughness: 0.22,
      metalness: 0.08,
    }),
    policeNavy: standard("#141b2d", 0.34, undefined, { metalness: 0.28, roughness: 0.34 }),
    karotaYellow: standard("#d8af18", 0.42, undefined, { roughness: 0.42 }),
    karotaGreen: standard("#156228", 0.45, undefined, { roughness: 0.45 }),
    goldTrim: standard("#c9a23b", 0.35, undefined, { metalness: 0.62, roughness: 0.35 }),
    neonCyan: standard("#18d6e8", 0.2, undefined, { emissive: "#0cb2c4", emissiveIntensity: 0.85 }),
    neonMagenta: standard("#e8188e", 0.2, undefined, { emissive: "#c40c72", emissiveIntensity: 0.85 }),
    bankBlue: standard("#123862", 0.32, undefined, { metalness: 0.32, roughness: 0.32 }),
    warmOrange: standard("#e26a22", 0.42, undefined, { roughness: 0.42 }),
    lampGlow: standard("#ffeaa7", 0.2, undefined, { emissive: "#ffb142", emissiveIntensity: 1.6 }),
    headlightBeam: standard("#fff8e7", 0.1, undefined, {
      emissive: "#ffeeaa",
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.35,
    }),
    weatheredBrick: standard("#8a4732", 0.92, clayMap, relief(clayMap, 0.08)),
    rustedZinc,
    hazardBarrier: standard("#e5b222", 0.65, hazardChevronMap),
    burlapSack: standard("#9e825c", 0.95, burlapMap),
    signGreenHighway: standard("#165b32", 0.35, undefined, { metalness: 0.15, roughness: 0.35 }),
  };
}

export { makeSignMaterial };
