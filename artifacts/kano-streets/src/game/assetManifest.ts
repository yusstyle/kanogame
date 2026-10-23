import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface AssetRecord {
  id: string;
  name: string;
  creator: string;
  sourceUrl: string;
  license: string;
  attribution: string;
  path: string;
  modifications: string;
}

export const ASSET_MANIFEST: Record<string, AssetRecord> = {
  sedan: {
    id: "graphite-four-door-sedan",
    name: "Graphite Four-Door Sedan",
    creator: "Khronos glTF Blender Community / Replit Asset Pool",
    sourceUrl: "https://github.com/KhronosGroup/glTF-Sample-Models",
    license: "CC0 / Royalty Free",
    attribution: "Standard automotive mesh asset",
    path: "/assets/graphite-four-door-sedan.glb",
    modifications: "Rotated 90 degrees around Y to align with +Z forward vector; ground offset Y+0.31m for wheel contact; integrated into vehicle controller with procedural fallback.",
  },
  ironGate: {
    id: "large-iron-gate",
    name: "Large Iron Gate (1k)",
    creator: "Poly Haven",
    sourceUrl: "https://polyhaven.com/a/large_iron_gate",
    license: "CC0 1.0 Universal (Public Domain)",
    attribution: "Poly Haven (polyhaven.com)",
    path: "/assets/large_iron_gate/large_iron_gate_1k.gltf",
    modifications: "Scaled to 0.70x to fit Hausa compound archway dimensions; shadow casting enabled; procedural gate fallback preserved.",
  },
  wornPlaster: {
    id: "worn-plaster-wall",
    name: "Worn Plaster Wall (1k PBR Textures)",
    creator: "Poly Haven",
    sourceUrl: "https://polyhaven.com/a/worn_plaster_wall",
    license: "CC0 1.0 Universal (Public Domain)",
    attribution: "Poly Haven (polyhaven.com)",
    path: "/assets/worn_plaster_wall/",
    modifications: "Configured with SRGB diffuse map, OpenGL normal map, and linear roughness map. Repeat wrapping set to 2.4m for natural scale on compound perimeter walls.",
  },
  kekeNapep: {
    id: "keke-napep",
    name: "Kano Commercial Tricycle (Keke Napep)",
    creator: "Kano Streets Project",
    sourceUrl: "https://github.com/yusstyle/kanogame",
    license: "MIT",
    attribution: "Original Kano-inspired 3D tricycle asset",
    path: "procedural://keke-napep",
    modifications: "Fully modeled 3-wheel auto-rickshaw with yellow/green livery, canvas canopy, passenger bench, front steering fork, and authentic Kano registration.",
  },
};

const gltfCache = new Map<string, THREE.Group>();
const gltfLoaderInstance = typeof window !== "undefined" ? new GLTFLoader() : null;

/**
 * Loads a GLTF/GLB asset asynchronously.
 * Returns null if running in Node (tests) or if loading fails,
 * allowing caller to use procedural fallback smoothly.
 */
export async function loadGLTFModel(path: string): Promise<THREE.Group | null> {
  if (!gltfLoaderInstance || typeof window === "undefined") {
    return null;
  }

  const cached = gltfCache.get(path);
  if (cached) {
    return cached.clone(true);
  }

  try {
    const gltf = await gltfLoaderInstance.loadAsync(path);
    const root = gltf.scene;

    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.depthWrite = true;
            });
          } else {
            child.material.depthWrite = true;
          }
        }
      }
    });

    gltfCache.set(path, root);
    return root.clone(true);
  } catch (error) {
    console.warn(`[AssetLoader] Could not load GLTF model from "${path}", falling back to procedural model:`, error);
    return null;
  }
}

const textureCache = new Map<string, THREE.Texture>();
const textureLoaderInstance = typeof window !== "undefined" ? new THREE.TextureLoader() : null;

export function loadTexture(url: string, isColor = false, repeat: [number, number] = [1, 1]): THREE.Texture | null {
  if (!textureLoaderInstance || typeof window === "undefined") {
    return null;
  }

  const key = `${url}:${isColor}:${repeat.join(",")}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  try {
    const texture = textureLoaderInstance.load(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 4;
    textureCache.set(key, texture);
    return texture;
  } catch {
    return null;
  }
}

