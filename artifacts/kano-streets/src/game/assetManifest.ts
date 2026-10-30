import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

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
  humanoidCharacterMale: {
    id: "black-m-1-casual",
    name: "Realistic African Adult Male Human Character (Rigged)",
    creator: "Google Research & University of Central Florida (VALID Avatar Project) / c-frame",
    sourceUrl: "https://github.com/c-frame/valid-avatars-glb",
    license: "CC BY 4.0 / MIT",
    attribution: "VALID: Validated Avatar Library for Inclusion and Diversity (Google / UCF)",
    path: "/assets/characters/Black_M_1_Casual.glb",
    modifications: "Optimized glTF 2.0 binary with Meshopt compression and WebP PBR textures. Wired with standard 84-joint humanoid skeleton (Hips, Spine, Shoulders, Limbs, Head) and ARKit-compatible facial blend shapes.",
  },
  humanoidCharacterFemale: {
    id: "black-f-1-casual",
    name: "Realistic African Adult Female Human Character (Rigged)",
    creator: "Google Research & University of Central Florida (VALID Avatar Project) / c-frame",
    sourceUrl: "https://github.com/c-frame/valid-avatars-glb",
    license: "CC BY 4.0 / MIT",
    attribution: "VALID: Validated Avatar Library for Inclusion and Diversity (Google / UCF)",
    path: "/assets/characters/Black_F_1_Casual.glb",
    modifications: "Optimized glTF 2.0 binary with Meshopt compression and WebP PBR textures. Wired with standard 84-joint humanoid skeleton.",
  },
  humanoidAnimations: {
    id: "humanoid-animations",
    name: "Humanoid Skeletal Locomotion Mocap Animations (Idle, Walk, Run, Drive)",
    creator: "Mixamo / Networked-A-Frame / Antigravity",
    sourceUrl: "https://github.com/networked-aframe/naf-valid-avatars",
    license: "CC0 / Royalty Free / MIT Compatible",
    attribution: "Locomotion mocap clips retargeted to VALID humanoid rig",
    path: "/assets/characters/humanoid_animations.json",
    modifications: "Retargeted 84 humanoid bone rotations, Z-axis forward removal for in-place locomotion, synchronized run clip, and driver seated pose.",
  },
  sedan: {
    id: "graphite-four-door-sedan",
    name: "Graphite Four-Door Sedan",
    creator: "Khronos glTF Blender Community / Replit Asset Pool",
    sourceUrl: "https://github.com/KhronosGroup/glTF-Sample-Models",
    license: "CC0 / Royalty Free",
    attribution: "Standard automotive mesh asset",
    path: "/assets/graphite-four-door-sedan.glb",
    modifications: "Rotated 90 degrees around Y to align with +Z forward vector; ground offset Y+0.31m for wheel contact; integrated with paint tinting, player garage liveries, traffic fleet cloning, and procedural fallback.",
  },
  ironGate: {
    id: "large-iron-gate",
    name: "Large Iron Gate (1k)",
    creator: "Poly Haven",
    sourceUrl: "https://polyhaven.com/a/large_iron_gate",
    license: "CC0 1.0 Universal (Public Domain)",
    attribution: "Poly Haven (polyhaven.com)",
    path: "/assets/large_iron_gate/large_iron_gate_1k.gltf",
    modifications: "Scaled to 0.70x to fit traditional Hausa Zaure gatehouse portals and modern compound archway dimensions; shadow casting enabled; procedural wrought-iron gate fallback preserved.",
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
  sheenWoodLeatherSofa: {
    id: "sheen-wood-leather-sofa",
    name: "Realistic Modern Living Room Sectional Sofa",
    creator: "Khronos Group / Fran Calvente & Eric Chadwick",
    sourceUrl: "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenWoodLeatherSofa",
    license: "CC BY 4.0 / CC0",
    attribution: "Khronos glTF Sample Assets (Fran Calvente, optimized by Eric Chadwick / DGG)",
    path: "/assets/furniture/SheenWoodLeatherSofa.glb",
    modifications: "Oriented to face room interior; ground offset aligned with floor level; integrated with procedural fallback.",
  },
  sheenChair: {
    id: "sheen-chair",
    name: "Realistic Upholstered Accent Armchair",
    creator: "Khronos Group / Wayfair LLC",
    sourceUrl: "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair",
    license: "CC0 1.0 Universal (Public Domain)",
    attribution: "Khronos glTF Sample Assets / Wayfair LLC",
    path: "/assets/furniture/SheenChair.glb",
    modifications: "Fitted to living room conversation nook; shadow casting enabled; procedural armchair fallback preserved.",
  },
  vintageDayBed: {
    id: "vintage-day-bed",
    name: "Realistic Upholstered Bed with Pillows & Natural Duvet",
    creator: "Poly Haven / Aron Łyczek",
    sourceUrl: "https://polyhaven.com/a/vintage_day_bed",
    license: "CC0 1.0 Universal (Public Domain)",
    attribution: "Poly Haven (polyhaven.com / Aron Łyczek)",
    path: "/assets/furniture/vintage_day_bed/vintage_day_bed_1k.gltf",
    modifications: "Calibrated to master bedroom dimensions; cast/receive shadows enabled; procedural bed assembly fallback preserved.",
  },
  marketStall: {
    id: "kano-market-stall",
    name: "Traditional Kano Market Produce Stall",
    creator: "Kano Streets Project",
    sourceUrl: "https://github.com/yusstyle/kanogame",
    license: "MIT",
    attribution: "Kano Streets Project (Hausa savanna market recreation)",
    path: "procedural://market-stall",
    modifications: "Modeled with tiered timber display trays, fresh Attarugu red peppers, Albasa onions, yams, spice bowls, burlap grain sacks, weathered canvas canopy, and suspended solar lantern.",
  },
  roadsideKiosk: {
    id: "kano-roadside-kiosks",
    name: "Authentic Northern Nigerian Roadside Kiosks (Mai Shayi, POS, Cold Drinks)",
    creator: "Kano Streets Project",
    sourceUrl: "https://github.com/yusstyle/kanogame",
    license: "MIT",
    attribution: "Kano Streets Project (Kano commercial street life recreation)",
    path: "procedural://roadside-kiosks",
    modifications: "Three authentic variants: Mai Shayi tea & bread stall with kettle and milk cans; POS agent financial kiosk with solar panel and security grille; Cold drinks & pure water kiosk.",
  },
  newJerseyBarrier: {
    id: "highway-jersey-barrier",
    name: "New Jersey Flared Concrete Highway Safety Barrier",
    creator: "Kano Streets Project",
    sourceUrl: "https://github.com/yusstyle/kanogame",
    license: "MIT",
    attribution: "Standard highway civil engineering profile recreation",
    path: "procedural://jersey-barrier",
    modifications: "Engineered with standard flared tire-redirecting base, chamfered transit, beveled cap, interlocking connection lugs, and alternating 45-degree yellow/black hazard chevrons.",
  },
  solarStreetlight: {
    id: "sahel-solar-streetlight",
    name: "Sahelian Solar LED Highway Luminaire & Mast",
    creator: "Kano Streets Project",
    sourceUrl: "https://github.com/yusstyle/kanogame",
    license: "MIT",
    attribution: "Kano Streets Project (Modern municipal infrastructure recreation)",
    path: "procedural://solar-streetlight",
    modifications: "Modeled with flanged base, anchor bolt lugs, lower battery enclosure, cantilever curved mast with tension support strut, daylight photocell sensor, and tilted monocrystalline solar panel.",
  },
};

const gltfCache = new Map<string, THREE.Group>();
const gltfLoaderInstance = typeof window !== "undefined" ? new GLTFLoader() : null;

if (gltfLoaderInstance) {
  gltfLoaderInstance.setMeshoptDecoder(MeshoptDecoder);
}

export interface LoadedHumanoidCharacter {
  characterRoot: THREE.Group;
  animations: Record<string, THREE.AnimationClip>;
}

const humanoidModelCache = new Map<string, THREE.Group>();
let humanoidAnimationsCache: Record<string, THREE.AnimationClip> | null = null;

export async function loadHumanoidAnimations(
  path = "/assets/characters/humanoid_animations.json",
): Promise<Record<string, THREE.AnimationClip> | null> {
  if (typeof window === "undefined") return null;
  if (humanoidAnimationsCache) return humanoidAnimationsCache;

  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    const clips: Record<string, THREE.AnimationClip> = {};
    for (const [name, clipJson] of Object.entries(data)) {
      clips[name] = THREE.AnimationClip.parse(
        clipJson as Parameters<typeof THREE.AnimationClip.parse>[0],
      );
    }
    humanoidAnimationsCache = clips;
    return clips;
  } catch (e) {
    console.warn(`[AssetLoader] Could not load humanoid animations from "${path}":`, e);
    return null;
  }
}

export async function loadHumanoidCharacter(
  modelPath = "/assets/characters/Black_M_1_Casual.glb",
  animationsPath = "/assets/characters/humanoid_animations.json",
): Promise<LoadedHumanoidCharacter | null> {
  if (!gltfLoaderInstance || typeof window === "undefined") {
    return null;
  }

  try {
    let baseModel = humanoidModelCache.get(modelPath);
    if (!baseModel) {
      const gltf = await gltfLoaderInstance.loadAsync(modelPath);
      baseModel = gltf.scene;
      baseModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat) => {
              mat.depthWrite = true;
            });
          }
        }
      });
      humanoidModelCache.set(modelPath, baseModel);
    }

    const characterRoot = cloneSkeleton(baseModel) as THREE.Group;
    const animations = await loadHumanoidAnimations(animationsPath);

    return {
      characterRoot,
      animations: animations || {},
    };
  } catch (error) {
    console.warn(`[AssetLoader] Could not load humanoid character from "${modelPath}":`, error);
    return null;
  }
}

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

