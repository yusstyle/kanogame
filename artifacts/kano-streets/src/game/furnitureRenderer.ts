/**
 * Kano Streets — 3D Furniture Procedural Renderer
 *
 * Generates modular, optimized Three.js 3D meshes and colliders for placed
 * furniture and consumer electronics, matching catalogue specifications.
 */

import * as THREE from "three";
import type { Collider, GameMaterials, FurnitureInstance } from "./types";
import { getFurnitureCatalogItem } from "./furnitureCatalogue";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

function addBox(
  parent: THREE.Group,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  shadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

function addCyl(
  parent: THREE.Group,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  shadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(unitCyl, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(r * 2, h, r * 2);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

export interface RenderedFurnitureResult {
  group: THREE.Group;
  colliders: Collider[];
  instanceId: string;
  catalogId: string;
  functionalType: string;
  interaction?: {
    prompt: string;
    action: () => {
      statusMessage: string;
      cashDelta?: number;
      timeDeltaMinutes?: number;
      scoreDelta?: number;
    };
  };
}

/**
 * Builds the 3D visual mesh group, dynamic colliders, and contextual interaction
 * for a specific placed furniture instance.
 */
export function buildFurnitureMesh(
  instance: FurnitureInstance,
  materials: GameMaterials,
  worldCx: number,
  worldCz: number,
): RenderedFurnitureResult {
  const group = new THREE.Group();
  group.name = `furniture_${instance.instanceId}`;
  group.position.set(instance.position.x, instance.position.y, instance.position.z);
  group.rotation.y = instance.rotationY;

  const catalogItem = getFurnitureCatalogItem(instance.catalogId);
  const colliders: Collider[] = [];
  const key = catalogItem?.modelMeshKey ?? "generic_furniture";
  const name = catalogItem?.name ?? "Furniture";

  // World-space center for colliders
  const cos = Math.cos(instance.rotationY);
  const sin = Math.sin(instance.rotationY);
  const worldX = worldCx + instance.position.x;
  const worldZ = worldCz + instance.position.z;

  const woodMat = materials.wood;
  const darkMat = materials.darkTrim;
  const metalMat = materials.metal;
  const clothMat = materials.cloth;
  const clothRedMat = materials.clothRed;
  const whiteMat = materials.white;
  const blackMat = materials.black;
  const glassMat = materials.glassLit || materials.glass;
  const goldMat = materials.goldTrim || materials.trim;
  const cyanMat = materials.neonCyan || materials.glassLit;

  let interaction: RenderedFurnitureResult["interaction"] = undefined;

  switch (key) {
    // -----------------------------------------------------------------------
    // LIVING ROOM
    // -----------------------------------------------------------------------
    case "armchair_single": {
      // Seat
      addBox(group, clothMat, 0, 0.28, 0, 0.9, 0.35, 0.85);
      // Backrest
      addBox(group, clothMat, 0, 0.65, -0.32, 0.9, 0.55, 0.22);
      // Armrests
      addBox(group, darkMat, -0.42, 0.48, 0, 0.16, 0.38, 0.85);
      addBox(group, darkMat, 0.42, 0.48, 0, 0.16, 0.38, 0.85);
      // Legs
      for (const lx of [-0.38, 0.38]) {
        for (const lz of [-0.35, 0.35]) {
          addCyl(group, woodMat, lx, 0.1, lz, 0.035, 0.2);
        }
      }
      colliders.push({ x: worldX, z: worldZ, halfX: 0.5, halfZ: 0.5, height: 1.0 });
      interaction = {
        prompt: `Sit & Rest on ${name}`,
        action: () => ({
          statusMessage: `You sat down on the ${name}. Enjoying peaceful moments at home in Kano.`,
          scoreDelta: 10,
        }),
      };
      break;
    }

    case "sofa_sectional": {
      // Main section (2-seater)
      addBox(group, clothMat, -0.4, 0.28, 0, 1.8, 0.36, 0.95);
      addBox(group, clothMat, -0.4, 0.68, -0.38, 1.8, 0.55, 0.24);
      // Chaise lounge
      addBox(group, clothMat, 0.8, 0.28, 0.4, 0.85, 0.36, 1.7);
      addBox(group, clothMat, 0.8, 0.68, -0.38, 0.85, 0.55, 0.24);
      // Accent cushions
      addBox(group, clothRedMat, -0.9, 0.48, -0.22, 0.38, 0.35, 0.15);
      addBox(group, goldMat, 0.1, 0.48, -0.22, 0.38, 0.35, 0.15);
      colliders.push({ x: worldX, z: worldZ, halfX: 1.3, halfZ: 0.9, height: 1.0 });
      interaction = {
        prompt: `Relax on ${name}`,
        action: () => ({
          statusMessage: `You reclined comfortably across the ${name}. Energy refreshed.`,
          scoreDelta: 15,
        }),
      };
      break;
    }

    case "sofa_luxury": {
      // Premium brown leather L-sectional
      addBox(group, darkMat, -0.6, 0.32, 0, 2.2, 0.4, 1.1);
      addBox(group, darkMat, -0.6, 0.75, -0.42, 2.2, 0.55, 0.26);
      // Long Chaise
      addBox(group, darkMat, 0.9, 0.32, 0.55, 1.0, 0.4, 2.1);
      addBox(group, darkMat, 0.9, 0.75, -0.42, 1.0, 0.55, 0.26);
      // Chrome feet
      for (const fx of [-1.6, 0.4, 1.3]) {
        for (const fz of [-0.45, 0.45, 1.45]) {
          addCyl(group, metalMat, fx, 0.06, fz, 0.04, 0.12);
        }
      }
      colliders.push({ x: worldX, z: worldZ, halfX: 1.6, halfZ: 1.1, height: 1.1 });
      interaction = {
        prompt: `Lounge on ${name}`,
        action: () => ({
          statusMessage: `Lounging on the ${name}. The epitome of luxury living in Kano.`,
          scoreDelta: 25,
        }),
      };
      break;
    }

    case "coffee_table": {
      // Low wooden frame with glass top
      addBox(group, woodMat, 0, 0.32, 0, 1.35, 0.06, 0.75);
      addBox(group, glassMat, 0, 0.36, 0, 1.3, 0.02, 0.7);
      for (const tx of [-0.6, 0.6]) {
        for (const tz of [-0.32, 0.32]) {
          addCyl(group, woodMat, tx, 0.16, tz, 0.035, 0.32);
        }
      }
      colliders.push({ x: worldX, z: worldZ, halfX: 0.7, halfZ: 0.4, height: 0.5 });
      break;
    }

    case "tv_stand_43": {
      // Media stand
      addBox(group, woodMat, 0, 0.26, 0, 1.25, 0.48, 0.42);
      // TV Base & Screen
      addBox(group, darkMat, 0, 0.52, 0, 0.35, 0.04, 0.25);
      addBox(group, blackMat, 0, 0.88, 0, 1.1, 0.65, 0.06);
      // Screen power LED
      addBox(group, cyanMat, 0.5, 0.56, 0.04, 0.02, 0.02, 0.02);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.65, halfZ: 0.25, height: 1.3 });
      interaction = {
        prompt: `Watch News & Sports on ${name}`,
        action: () => ({
          statusMessage: `Watching NTA Kano & Arewa 24 News. Premier League match highlights broadcasted!`,
          scoreDelta: 15,
        }),
      };
      break;
    }

    case "tv_console_65": {
      // Sleek walnut console
      addBox(group, darkMat, 0, 0.28, 0, 1.75, 0.52, 0.48);
      // Curved 65" screen
      addBox(group, blackMat, 0, 0.98, 0, 1.55, 0.85, 0.05);
      // Soundbar
      addBox(group, metalMat, 0, 0.57, 0.06, 1.2, 0.07, 0.1);
      // Dual side tower speakers
      addBox(group, blackMat, -0.98, 0.62, 0, 0.22, 1.15, 0.25);
      addBox(group, blackMat, 0.98, 0.62, 0, 0.22, 1.15, 0.25);
      colliders.push({ x: worldX, z: worldZ, halfX: 1.1, halfZ: 0.3, height: 1.5 });
      interaction = {
        prompt: `Watch 4K Cinema on ${name}`,
        action: () => ({
          statusMessage: `65" OLED Theater: Immersive surround sound sports commentary filling the room!`,
          scoreDelta: 20,
        }),
      };
      break;
    }

    case "tv_media_wall_75": {
      // Acoustic wood slat wall unit
      addBox(group, darkMat, 0, 1.1, -0.15, 2.35, 2.1, 0.15);
      // Slat accents
      for (let s = -1.05; s <= 1.05; s += 0.25) {
        addBox(group, woodMat, s, 1.1, -0.06, 0.08, 2.05, 0.04);
      }
      // Floating lowboard
      addBox(group, blackMat, 0, 0.32, 0.12, 2.2, 0.38, 0.45);
      // Massive 75" display
      addBox(group, blackMat, 0, 1.25, 0.02, 1.85, 1.05, 0.04);
      // Ambient backlight glow behind screen
      const ambientLight = new THREE.PointLight("#fffae8", 1.2, 5);
      ambientLight.position.set(0, 1.25, 0.2);
      group.add(ambientLight);
      colliders.push({ x: worldX, z: worldZ, halfX: 1.2, halfZ: 0.35, height: 2.2 });
      interaction = {
        prompt: `Stream 75" QLED Home Cinema Broadcast`,
        action: () => ({
          statusMessage: `75" QLED Media Wall: 4K HDR live broadcast playing. The pinnacle of home entertainment!`,
          scoreDelta: 30,
        }),
      };
      break;
    }

    case "rug_geometric": {
      // Flat decorative carpet
      addBox(group, materials.carpetRed || clothRedMat, 0, 0.015, 0, 2.7, 0.02, 1.95, false);
      // Fringe borders
      addBox(group, whiteMat, 0, 0.02, -0.99, 2.7, 0.01, 0.05, false);
      addBox(group, whiteMat, 0, 0.02, 0.99, 2.7, 0.01, 0.05, false);
      break;
    }

    case "floor_lamp": {
      // Arched brass lamp
      addCyl(group, goldMat, 0, 0.03, 0, 0.25, 0.05);
      addCyl(group, goldMat, 0, 0.9, 0, 0.025, 1.75);
      addCyl(group, whiteMat, 0, 1.75, 0, 0.22, 0.32);
      const lampLight = new THREE.PointLight("#fff5db", 1.8, 8, 1.2);
      lampLight.position.set(0, 1.75, 0);
      group.add(lampLight);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.3, halfZ: 0.3, height: 1.9 });
      break;
    }

    // -----------------------------------------------------------------------
    // BEDROOM
    // -----------------------------------------------------------------------
    case "bed_single": {
      // Frame
      addBox(group, woodMat, 0, 0.25, 0, 1.15, 0.35, 2.05);
      // Mattress & duvet
      addBox(group, whiteMat, 0, 0.48, 0.08, 1.05, 0.22, 1.85);
      // Pillow
      addBox(group, whiteMat, 0, 0.58, -0.75, 0.75, 0.12, 0.38);
      // Headboard
      addBox(group, woodMat, 0, 0.65, -1.02, 1.15, 0.75, 0.08);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.6, halfZ: 1.05, height: 0.9 });
      interaction = {
        prompt: `Sleep & Rest in ${name} (Advance to Morning)`,
        action: () => ({
          statusMessage: `You slept peacefully in the ${name}. Day has advanced and energy is fully restored!`,
          timeDeltaMinutes: 360,
          scoreDelta: 20,
        }),
      };
      break;
    }

    case "bed_queen": {
      // Queen Frame
      addBox(group, darkMat, 0, 0.26, 0, 1.75, 0.38, 2.15);
      // Mattress
      addBox(group, whiteMat, 0, 0.52, 0.08, 1.65, 0.24, 1.95);
      // Dual pillows
      addBox(group, whiteMat, -0.42, 0.64, -0.78, 0.65, 0.12, 0.38);
      addBox(group, whiteMat, 0.42, 0.64, -0.78, 0.65, 0.12, 0.38);
      // Carved headboard
      addBox(group, woodMat, 0, 0.85, -1.06, 1.8, 1.15, 0.1);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.9, halfZ: 1.1, height: 1.15 });
      interaction = {
        prompt: `Sleep in Queen Suite (Advance to Morning)`,
        action: () => ({
          statusMessage: `Rejuvenating overnight rest in the Queen Suite. Waking up fresh to a new day in Kano!`,
          timeDeltaMinutes: 360,
          scoreDelta: 25,
        }),
      };
      break;
    }

    case "bed_king": {
      // King royal frame
      addBox(group, darkMat, 0, 0.28, 0, 2.15, 0.4, 2.25);
      // Luxury mattress & duvet
      addBox(group, whiteMat, 0, 0.58, 0.08, 2.05, 0.28, 2.05);
      // 4 plush pillows
      for (const px of [-0.55, 0.55]) {
        addBox(group, whiteMat, px, 0.72, -0.85, 0.7, 0.14, 0.38);
        addBox(group, clothRedMat, px, 0.74, -0.55, 0.5, 0.12, 0.28);
      }
      // Velvet upholstered headboard
      addBox(group, clothMat, 0, 0.98, -1.12, 2.25, 1.4, 0.14);
      addBox(group, goldMat, 0, 0.98, -1.19, 2.3, 1.45, 0.04);
      colliders.push({ x: worldX, z: worldZ, halfX: 1.15, halfZ: 1.15, height: 1.4 });
      interaction = {
        prompt: `Sleep in Royal King Suite (Advance to Morning)`,
        action: () => ({
          statusMessage: `Royal King Suite: Slept like an executive. Morning has broken over Kano metropolis!`,
          timeDeltaMinutes: 360,
          scoreDelta: 35,
        }),
      };
      break;
    }

    case "nightstand_pair": {
      // Left and right nightstands
      for (const sx of [-0.6, 0.6]) {
        addBox(group, woodMat, sx, 0.3, 0, 0.5, 0.58, 0.45);
        addCyl(group, goldMat, sx, 0.64, 0, 0.02, 0.15);
        addCyl(group, whiteMat, sx, 0.78, 0, 0.14, 0.18);
      }
      colliders.push({ x: worldX, z: worldZ, halfX: 0.9, halfZ: 0.3, height: 0.9 });
      break;
    }

    case "wardrobe_mirrored": {
      // Tall 3-door wardrobe with mirror
      addBox(group, darkMat, 0, 1.15, 0, 2.15, 2.25, 0.65);
      addBox(group, glassMat, 0, 1.15, 0.34, 0.72, 2.05, 0.02);
      addBox(group, woodMat, -0.72, 1.15, 0.34, 0.7, 2.05, 0.02);
      addBox(group, woodMat, 0.72, 1.15, 0.34, 0.7, 2.05, 0.02);
      colliders.push({ x: worldX, z: worldZ, halfX: 1.1, halfZ: 0.35, height: 2.3 });
      interaction = {
        prompt: `Inspect Executive Wardrobe`,
        action: () => ({
          statusMessage: `Executive Wardrobe: Traditional Babbar Riga and tailored business attire pressed and hung.`,
          scoreDelta: 10,
        }),
      };
      break;
    }

    case "vanity_dresser": {
      // Dresser console
      addBox(group, whiteMat, 0, 0.42, 0, 1.25, 0.75, 0.52);
      // Vanity stool
      addBox(group, clothRedMat, 0, 0.24, 0.42, 0.45, 0.42, 0.45);
      // Halo mirror
      addCyl(group, goldMat, 0, 1.15, -0.22, 0.44, 0.04);
      addCyl(group, glassMat, 0, 1.15, -0.2, 0.4, 0.02);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.65, halfZ: 0.4, height: 1.6 });
      break;
    }

    // -----------------------------------------------------------------------
    // KITCHEN & DINING
    // -----------------------------------------------------------------------
    case "dining_set_4": {
      // Table
      addBox(group, woodMat, 0, 0.42, 0, 1.45, 0.06, 1.05);
      for (const lx of [-0.62, 0.62]) {
        for (const lz of [-0.42, 0.42]) {
          addCyl(group, metalMat, lx, 0.2, lz, 0.035, 0.4);
        }
      }
      // 4 Chairs
      for (const side of [-0.45, 0.45]) {
        addBox(group, darkMat, side, 0.44, -0.68, 0.38, 0.48, 0.38);
        addBox(group, darkMat, side, 0.44, 0.68, 0.38, 0.48, 0.38);
      }
      colliders.push({ x: worldX, z: worldZ, halfX: 0.8, halfZ: 0.6, height: 0.9 });
      interaction = {
        prompt: `Sit for Dining Meal`,
        action: () => ({
          statusMessage: `You sat at the family dining table. Enjoying home-cooked Tuwo Shinkafa and Miyan Kuka!`,
          scoreDelta: 15,
        }),
      };
      break;
    }

    case "dining_set_8": {
      // Grand 8-seater
      addBox(group, woodMat, 0, 0.44, 0, 2.55, 0.08, 1.25);
      addCyl(group, metalMat, -0.85, 0.21, 0, 0.12, 0.42);
      addCyl(group, metalMat, 0.85, 0.21, 0, 0.12, 0.42);
      // Chairs along edges
      for (let c = -0.9; c <= 0.9; c += 0.6) {
        addBox(group, darkMat, c, 0.48, -0.78, 0.42, 0.55, 0.4);
        addBox(group, darkMat, c, 0.48, 0.78, 0.42, 0.55, 0.4);
      }
      colliders.push({ x: worldX, z: worldZ, halfX: 1.35, halfZ: 0.75, height: 1.0 });
      interaction = {
        prompt: `Host Banquet at Mahogany Dining Suite`,
        action: () => ({
          statusMessage: `Hosting an 8-seater banquet. Northern hospitality at its finest in your Kano residence!`,
          scoreDelta: 25,
        }),
      };
      break;
    }

    case "fridge_single": {
      // Single door fridge
      addBox(group, materials.bankBlue || metalMat, 0, 0.8, 0, 0.68, 1.58, 0.65);
      addBox(group, metalMat, 0.26, 0.85, 0.35, 0.04, 0.35, 0.05); // Handle
      colliders.push({ x: worldX, z: worldZ, halfX: 0.35, halfZ: 0.35, height: 1.6 });
      interaction = {
        prompt: `Open Refrigerator for Cold Refreshment`,
        action: () => ({
          statusMessage: `You opened the fridge and poured a chilled glass of fresh Zobo & ginger! Thirst quenched.`,
          scoreDelta: 10,
        }),
      };
      break;
    }

    case "fridge_french": {
      // Premium stainless French-door fridge
      addBox(group, metalMat, 0, 0.95, 0, 1.05, 1.85, 0.82);
      // Dual French doors
      addBox(group, whiteMat, -0.25, 1.25, 0.43, 0.48, 0.95, 0.04);
      addBox(group, whiteMat, 0.25, 1.25, 0.43, 0.48, 0.95, 0.04);
      // Bottom freezer drawer
      addBox(group, whiteMat, 0, 0.4, 0.43, 0.98, 0.65, 0.04);
      // Ice/water dispenser
      addBox(group, blackMat, -0.25, 1.25, 0.46, 0.22, 0.32, 0.03);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.55, halfZ: 0.45, height: 1.9 });
      interaction = {
        prompt: `Dispense Chilled Water & Fresh Zobo`,
        action: () => ({
          statusMessage: `Dispensed chilled purified water and fresh hibiscus Zobo from the smart door. Energized!`,
          scoreDelta: 20,
        }),
      };
      break;
    }

    case "gas_cooker": {
      // 4-burner cooker
      addBox(group, metalMat, 0, 0.48, 0, 0.78, 0.92, 0.68);
      // Glass oven door
      addBox(group, blackMat, 0, 0.4, 0.35, 0.65, 0.48, 0.03);
      // 4 Burner grates
      for (const bx of [-0.22, 0.22]) {
        for (const bz of [-0.18, 0.18]) {
          addCyl(group, blackMat, bx, 0.95, bz, 0.08, 0.03);
        }
      }
      colliders.push({ x: worldX, z: worldZ, halfX: 0.4, halfZ: 0.35, height: 1.0 });
      break;
    }

    case "espresso_counter": {
      addBox(group, woodMat, 0, 0.45, 0, 1.15, 0.88, 0.58);
      addBox(group, blackMat, -0.25, 0.98, 0, 0.45, 0.26, 0.32); // Microwave
      addBox(group, metalMat, 0.32, 1.05, 0, 0.28, 0.38, 0.28); // Espresso machine
      colliders.push({ x: worldX, z: worldZ, halfX: 0.6, halfZ: 0.3, height: 1.3 });
      interaction = {
        prompt: `Brew Hot Northern Spiced Espresso`,
        action: () => ({
          statusMessage: `Fresh espresso brewed with Northern ginger, cloves, and cardamom. Energy boosted!`,
          scoreDelta: 15,
        }),
      };
      break;
    }

    // -----------------------------------------------------------------------
    // STUDY & TECHNOLOGY
    // -----------------------------------------------------------------------
    case "desk_simple": {
      // Desk
      addBox(group, woodMat, 0, 0.42, 0, 1.2, 0.06, 0.65);
      addBox(group, metalMat, -0.55, 0.2, 0, 0.05, 0.4, 0.6);
      addBox(group, metalMat, 0.55, 0.2, 0, 0.05, 0.4, 0.6);
      // Chair
      addBox(group, darkMat, 0, 0.38, 0.45, 0.45, 0.42, 0.45);
      // Laptop
      addBox(group, metalMat, 0, 0.46, -0.05, 0.38, 0.03, 0.28);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.65, halfZ: 0.45, height: 0.9 });
      interaction = {
        prompt: `Use Study Desk & Laptop`,
        action: () => ({
          statusMessage: `Logged into online banking and property ledger. All domestic accounts verified!`,
          scoreDelta: 15,
        }),
      };
      break;
    }

    case "desk_executive": {
      // Heavy partner desk
      addBox(group, darkMat, 0, 0.44, 0, 1.85, 0.84, 0.92);
      // Green leather blotter
      addBox(group, materials.karotaGreen || clothMat, 0, 0.88, 0.05, 1.1, 0.02, 0.65);
      // Executive chair
      addBox(group, darkMat, 0, 0.55, 0.65, 0.65, 0.75, 0.6);
      colliders.push({ x: worldX, z: worldZ, halfX: 1.0, halfZ: 0.65, height: 1.0 });
      interaction = {
        prompt: `Conduct Executive Business at Desk`,
        action: () => ({
          statusMessage: `Drafted enterprise expansion documents from your executive desk. Business reputation +20!`,
          scoreDelta: 20,
        }),
      };
      break;
    }

    case "pc_workstation": {
      // Dual monitors & desk
      addBox(group, darkMat, 0, 0.42, 0, 1.4, 0.06, 0.7);
      for (const sx of [-0.32, 0.32]) {
        addBox(group, blackMat, sx, 0.74, -0.15, 0.58, 0.38, 0.04);
      }
      addBox(group, metalMat, 0.52, 0.25, 0.1, 0.22, 0.48, 0.45); // Tower PC
      colliders.push({ x: worldX, z: worldZ, halfX: 0.75, halfZ: 0.4, height: 1.0 });
      interaction = {
        prompt: `Complete Remote Logistics Contract (Earn ₦25,000)`,
        action: () => ({
          statusMessage: `Completed dispatch routing for Kano–Kaduna highway freight. Earned ₦25,000 remote contract fee!`,
          cashDelta: 25000,
          timeDeltaMinutes: 45,
          scoreDelta: 25,
        }),
      };
      break;
    }

    case "pc_gaming_rig": {
      // RGB Gaming setup
      addBox(group, blackMat, 0, 0.42, 0, 1.55, 0.06, 0.78);
      // Ultrawide curved display
      addBox(group, blackMat, 0, 0.82, -0.12, 1.1, 0.45, 0.08);
      // Glowing RGB Tower
      addBox(group, cyanMat, 0.62, 0.75, -0.05, 0.25, 0.55, 0.48);
      // RGB glow
      const rgbLight = new THREE.PointLight("#00f7ff", 1.8, 4);
      rgbLight.position.set(0.62, 0.75, 0.1);
      group.add(rgbLight);
      // Esports chair
      addBox(group, clothRedMat, 0, 0.55, 0.6, 0.55, 0.78, 0.55);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.85, halfZ: 0.55, height: 1.2 });
      interaction = {
        prompt: `Play Ranked Esports Match on Gaming Rig`,
        action: () => ({
          statusMessage: `Victory in Kano Street Drift Esports! +5,000 Tournament Prize Cash!`,
          cashDelta: 5000,
          scoreDelta: 40,
        }),
      };
      break;
    }

    case "console_ps5_setup": {
      // TV console + PS5
      addBox(group, darkMat, 0, 0.26, 0, 1.55, 0.48, 0.45);
      addBox(group, blackMat, 0, 0.85, 0, 1.35, 0.75, 0.05); // 55" TV
      // White console
      addBox(group, whiteMat, 0.55, 0.55, 0.05, 0.14, 0.38, 0.28);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.8, halfZ: 0.3, height: 1.3 });
      interaction = {
        prompt: `Play Football Match on PS5 Console`,
        action: () => ({
          statusMessage: `Played Kano Pillars vs Enyimba on PS5. 3-1 Championship win!`,
          scoreDelta: 20,
        }),
      };
      break;
    }

    case "bookshelf_tall": {
      // Bookshelf
      addBox(group, woodMat, 0, 1.1, 0, 1.35, 2.15, 0.38);
      // Colorful book rows
      for (let y = 0.4; y <= 1.8; y += 0.45) {
        addBox(group, darkMat, 0, y, 0, 1.25, 0.03, 0.35);
        for (let bx = -0.55; bx <= 0.55; bx += 0.18) {
          const bMat = bx > 0 ? clothRedMat : materials.bankBlue || cyanMat;
          addBox(group, bMat, bx, y + 0.16, 0, 0.14, 0.28, 0.3);
        }
      }
      colliders.push({ x: worldX, z: worldZ, halfX: 0.7, halfZ: 0.22, height: 2.2 });
      interaction = {
        prompt: `Read Northern Kano History Book`,
        action: () => ({
          statusMessage: `Browsing the Kano Chronicles (Tarikh Kano): 'Bagauda came to Kano in the 10th century and ruled 66 years.'`,
          scoreDelta: 15,
        }),
      };
      break;
    }

    // -----------------------------------------------------------------------
    // DECOR & UPGRADES
    // -----------------------------------------------------------------------
    case "indoor_plant": {
      addCyl(group, whiteMat, 0, 0.22, 0, 0.22, 0.42);
      addCyl(group, materials.kekeGreen || materials.karotaGreen || woodMat, 0, 0.75, 0, 0.38, 0.75);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.3, halfZ: 0.3, height: 1.3 });
      break;
    }

    case "wall_art_kano": {
      addBox(group, goldMat, 0, 0.5, 0, 1.58, 0.98, 0.06);
      addBox(group, materials.ochre || materials.clay, 0, 0.5, 0.035, 1.45, 0.85, 0.02);
      break;
    }

    case "silk_curtains": {
      addBox(group, goldMat, 0, 1.2, 0, 1.95, 0.04, 0.04);
      addBox(group, whiteMat, -0.7, 0.55, 0.02, 0.45, 1.25, 0.06);
      addBox(group, whiteMat, 0.7, 0.55, 0.02, 0.45, 1.25, 0.06);
      break;
    }

    case "crystal_chandelier": {
      addCyl(group, goldMat, 0, 0.5, 0, 0.12, 0.6);
      addCyl(group, glassMat, 0, 0.15, 0, 0.52, 0.32);
      const chLight = new THREE.PointLight("#ffefa8", 2.4, 14, 1.1);
      chLight.position.set(0, 0, 0);
      group.add(chLight);
      break;
    }

    default: {
      // Fallback generic furniture box
      addBox(group, woodMat, 0, 0.4, 0, 1.0, 0.8, 0.8);
      colliders.push({ x: worldX, z: worldZ, halfX: 0.5, halfZ: 0.4, height: 0.8 });
      break;
    }
  }

  return {
    group,
    colliders,
    instanceId: instance.instanceId,
    catalogId: instance.catalogId,
    functionalType: catalogItem?.functionalType ?? "decor",
    interaction,
  };
}
