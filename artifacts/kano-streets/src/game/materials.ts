import * as THREE from "three";
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

export function createMaterials(): GameMaterials {
  const plasterMap = noiseTexture("#b49a72", "#f0d9a5", 4600, 42, [2, 2]);
  const clayMap = noiseTexture("#a77950", "#e2b27a", 3900, 87, [2, 2]);
  const concreteMap = noiseTexture("#9b958a", "#e2d8c4", 3700, 19, [2, 2]);
  const asphaltMap = noiseTexture("#343638", "#94908a", 9800, 111, [6, 6]);
  const earthMap = noiseTexture("#9d8057", "#d1ad70", 9000, 73, [9, 9]);
  const stoneMap = noiseTexture("#847763", "#c6b996", 4200, 31, [2, 2]);

  return {
    ground: standard("#c1a16e", 1, earthMap),
    asphalt: standard("#454644", 0.96, asphaltMap),
    sidewalk: standard("#b7a88b", 0.92, concreteMap),
    drain: standard("#373936", 0.94, stoneMap),
    plaster: standard("#e0c695", 0.93, plasterMap),
    ochre: standard("#b9905c", 0.96, clayMap),
    clay: standard("#98734f", 0.98, clayMap),
    concrete: standard("#aaa396", 0.93, concreteMap),
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
  };
}

export { makeSignMaterial };
