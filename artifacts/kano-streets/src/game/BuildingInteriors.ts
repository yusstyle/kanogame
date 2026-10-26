import * as THREE from "three";
import { makeSignMaterial } from "./materials";
import type { Collider, GameMaterials, InteriorId, PropertyId, BusinessId, FurnitureInstance } from "./types";
import { PROPERTY_REGISTRY } from "./propertyRegistry";
import { buildFurnitureMesh, type RenderedFurnitureResult } from "./furnitureRenderer";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  castShadow = true,
) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCyl(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
) {
  const mesh = new THREE.Mesh(unitCyl, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(r * 2, h, r * 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export interface InteractiveDoor {
  id: string;
  name: string;
  interiorId: InteriorId;
  doorMesh: THREE.Mesh;
  pivotGroup: THREE.Group;
  isOpen: boolean;
  closedYaw: number;
  openYaw: number;
  collider: Collider;
  position: THREE.Vector3;
}

export interface InteriorZone {
  id: InteriorId;
  name: string;
  districtLabel: string;
  root: THREE.Group;
  colliders: Collider[];
  spawnPoint: THREE.Vector3;
  spawnYaw: number;
  exitPoint: THREE.Vector3;
  outdoorDoorPosition: THREE.Vector3;
  outdoorDoorYaw: number;
  lights?: THREE.PointLight[];
  checkInteraction?: (
    playerPos: THREE.Vector3,
    state: {
      cash: number;
      trafficFine: number;
      hasApartmentRental: boolean;
      score?: number;
      ownedProperties?: string[];
      ownedBusinesses?: string[];
    },
  ) => {
    prompt: string;
    action: () => {
      statusMessage: string;
      cashDelta?: number;
      clearFine?: boolean;
      rentApartment?: boolean;
      scoreDelta?: number;
      socialContactId?: string;
      purchasedProperty?: PropertyId;
      purchasedBusiness?: BusinessId;
      openFurnitureShop?: boolean;
      timeDeltaMinutes?: number;
    };
  } | null;
}

export class BuildingInteriorManager {
  public readonly root = new THREE.Group();
  public interiors = new Map<InteriorId, InteriorZone>();
  public activeInterior: InteriorId | null = null;
  public outdoorSavedPosition = new THREE.Vector3(-4, 0, -4);
  public outdoorSavedYaw = 0;
  public interactiveDoors: InteractiveDoor[] = [];
  public lightsOn = true;
  public placedFurnitureGroups = new Map<InteriorId, THREE.Group>();
  public placedFurnitureItems = new Map<string, RenderedFurnitureResult>();

  constructor(private readonly materials: GameMaterials) {
    this.root.name = "building-interiors-root";
    this.buildHouseInterior();
    this.buildApartmentInterior();
    this.buildPenthouseInterior();
    this.buildChurchInterior();
    this.buildPolicePostInterior();
    this.buildRestaurantInterior();
    this.buildGamingHubInterior();
    this.buildFurnitureShowroomInterior();
  }

  private addInteractiveDoor(
    parent: THREE.Group,
    interiorId: InteriorId,
    id: string,
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    worldCx: number,
    worldCz: number,
    swingOutwards = false,
    colliders?: Collider[],
  ): InteractiveDoor {
    const pivot = new THREE.Group();
    pivot.position.set(x - w / 2, y, z);
    parent.add(pivot);

    const doorMesh = new THREE.Mesh(unitBox, material);
    doorMesh.position.set(w / 2, h / 2, 0);
    doorMesh.scale.set(w, h, d);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    pivot.add(doorMesh);

    // Brass handle
    const handle = new THREE.Mesh(unitBox, this.materials.goldTrim || this.materials.trim);
    handle.position.set(w - 0.12, h * 0.5, 0.08);
    handle.scale.set(0.06, 0.14, 0.12);
    pivot.add(handle);

    const collider: Collider = {
      x: worldCx + x,
      z: worldCz + z,
      halfX: w / 2,
      halfZ: 0.35,
      height: h,
    };

    if (colliders) {
      colliders.push(collider);
    }

    const door: InteractiveDoor = {
      id,
      name,
      interiorId,
      doorMesh,
      pivotGroup: pivot,
      isOpen: false,
      closedYaw: 0,
      openYaw: swingOutwards ? -Math.PI / 2 : Math.PI / 2,
      collider,
      position: new THREE.Vector3(worldCx + x, -60 + y, worldCz + z),
    };

    this.interactiveDoors.push(door);
    return door;
  }

  public toggleDoor(doorId: string): { success: boolean; isOpen: boolean; message: string } {
    const door = this.interactiveDoors.find((d) => d.id === doorId);
    if (!door) return { success: false, isOpen: false, message: "Door not found" };

    door.isOpen = !door.isOpen;
    door.pivotGroup.rotation.y = door.isOpen ? door.openYaw : door.closedYaw;

    // Shift collider out of way when open
    if (door.isOpen) {
      door.collider.x = 9999;
    } else {
      door.collider.x = door.position.x;
    }

    const stateWord = door.isOpen ? "opened" : "closed";
    return { success: true, isOpen: door.isOpen, message: `${door.name} is now ${stateWord}.` };
  }

  public getNearbyDoor(playerPos: THREE.Vector3, threshold = 2.2): InteractiveDoor | null {
    if (!this.activeInterior) return null;
    for (const door of this.interactiveDoors) {
      if (door.interiorId !== this.activeInterior) continue;
      if (playerPos.distanceTo(door.position) <= threshold) {
        return door;
      }
    }
    return null;
  }

  public toggleInteriorLights(zoneId?: InteriorId): boolean {
    const targetId = zoneId ?? this.activeInterior;
    if (!targetId) return this.lightsOn;
    const zone = this.interiors.get(targetId);
    if (!zone || !zone.lights) return this.lightsOn;

    this.lightsOn = !this.lightsOn;
    const intensityFactor = this.lightsOn ? 1.0 : 0.2;
    zone.lights.forEach((light) => {
      light.intensity = (light.userData.baseIntensity ?? 1.8) * intensityFactor;
    });
    return this.lightsOn;
  }

  public getSurfaceHeight(interiorId: InteriorId, x: number, z: number): number {
    if (interiorId === "penthouse") {
      // Penthouse center at cx = 300, cz = 80
      const relX = x - 300;
      const relZ = z - 80;

      // Staircase: x in [-1.5, 2.0], z in [1.0, 5.5] ascending from Floor 1 (y = -59.9) to Floor 2 (y = -56.5)
      if (relX >= -1.5 && relX <= 2.2 && relZ >= 0.8 && relZ <= 5.8) {
        const progress = Math.min(1, Math.max(0, (relZ - 0.8) / 4.8));
        return -59.9 + progress * 3.4;
      }

      // Upper Mezzanine, Master Suite & Rooftop Terrace (Floor 2)
      if (relZ >= 0.8 && (relX <= -1.5 || relX >= 2.0 || relZ >= 5.5)) {
        return -56.5;
      }

      // Lower Level Floor 1 (Living Salon, Foyer, Kitchen)
      return -59.9;
    }

    // Default base floor for all single-storey interiors
    return -59.9;
  }

  // =========================================================================
  // 1. Al-Baraka Executive Villa (Gated Northern Family Estate)
  // =========================================================================
  private buildHouseInterior() {
    const cx = 220;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const lights: THREE.PointLight[] = [];
    const width = 20;
    const depth = 18;
    const height = 4.0;

    const floorMat = this.materials.tileFloor || this.materials.concrete;
    const wallMat = this.materials.white;
    const woodMat = this.materials.wood;

    // 1. Floor & Ceiling Slabs
    addBox(group, floorMat, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, wallMat, 0, height, 0, width, 0.1, depth, false);

    // 2. Perimeter Exterior Walls
    addBox(group, wallMat, 0, height / 2, -depth / 2, width, height, 0.25); // North Wall
    addBox(group, wallMat, 0, height / 2, depth / 2, width, height, 0.25);  // South Wall (Front)
    addBox(group, wallMat, -width / 2, height / 2, 0, 0.25, height, depth); // West Wall
    addBox(group, wallMat, width / 2, height / 2, 0, 0.25, height, depth);  // East Wall

    // 3. Front Shaded Veranda & Reception Zaure (z: 5.5 to 9.0)
    addBox(group, this.materials.ochre, 0, 0.08, 7.2, 8.0, 0.16, 3.6, false);
    // Sculpted Clay Seating Dakali Benches on Veranda
    addBox(group, this.materials.clay, -3.2, 0.45, 7.2, 1.2, 0.7, 3.2);
    addBox(group, this.materials.clay, 3.2, 0.45, 7.2, 1.2, 0.7, 3.2);
    colliders.push(
      { x: cx - 3.2, z: cz + 7.2, halfX: 0.6, halfZ: 1.6, height: 0.8 },
      { x: cx + 3.2, z: cz + 7.2, halfX: 0.6, halfZ: 1.6, height: 0.8 },
    );

    // Double Mahogany Entrance Doors
    addBox(group, woodMat, -0.7, 1.2, depth / 2 - 0.08, 1.2, 2.4, 0.12);
    addBox(group, woodMat, 0.7, 1.2, depth / 2 - 0.08, 1.2, 2.4, 0.12);

    // 4. Grand Family Parlour (Palour) (x: -8 to 0, z: -1 to 5.5)
    // Rich Northern Patterned Carpet
    addBox(group, this.materials.carpetRed || this.materials.clothRed, -4.0, 0.05, 2.2, 7.2, 0.02, 6.2, false);
    // 8-Seater Northern Modular Sectional Sofa Set
    addBox(group, this.materials.darkTrim, -4.0, 0.48, 4.2, 5.8, 0.52, 1.1); // Back sofa
    addBox(group, this.materials.darkTrim, -7.0, 0.48, 2.2, 1.1, 0.52, 4.8); // Left sofa
    addBox(group, this.materials.darkTrim, -1.0, 0.48, 2.2, 1.1, 0.52, 3.2); // Right sofa
    // Carved mahogany coffee table
    addBox(group, woodMat, -4.0, 0.35, 2.2, 2.2, 0.38, 1.4);
    // Brass Kano Ornamental Urns & Water Pots
    addCyl(group, this.materials.goldTrim || this.materials.trim, -7.2, 0.55, 5.0, 0.35, 1.1);
    addCyl(group, this.materials.goldTrim || this.materials.trim, -0.8, 0.55, 5.0, 0.35, 1.1);

    // 75-inch Flat Screen Media Wall & Credenza (West Wall)
    addBox(group, woodMat, -9.6, 0.5, 2.2, 0.6, 0.65, 4.4);
    addBox(group, this.materials.black, -9.7, 1.8, 2.2, 0.1, 1.6, 2.8);

    // 5. Formal Dining Room & Closed Family Kitchen (x: 1 to 9.5, z: 0 to 5.5)
    // Partition Wall between Parlour and Dining
    addBox(group, wallMat, 0.8, height / 2, 2.5, 0.2, height, 6.0);
    // 8-Seater Solid Mahogany Dining Table & Chairs
    addBox(group, woodMat, 5.0, 0.78, 2.8, 3.4, 0.08, 1.8);
    for (const dx of [-1.2, 0, 1.2]) {
      addBox(group, this.materials.darkTrim, 5.0 + dx, 0.48, 1.6, 0.45, 0.5, 0.45);
      addBox(group, this.materials.darkTrim, 5.0 + dx, 0.48, 4.0, 0.45, 0.5, 0.45);
    }
    // Kitchen Partition & Counters (x: 4 to 9.5, z: -1 to 0)
    addBox(group, wallMat, 5.0, height / 2, 0, 9.5, height, 0.2);
    addBox(group, this.materials.concrete, 6.5, 0.95, -2.5, 1.0, 1.0, 4.0);
    addBox(group, this.materials.metal, 6.5, 1.02, -2.5, 1.1, 0.08, 4.2); // Stainless counter
    addBox(group, this.materials.metal, 8.5, 1.3, -4.0, 1.2, 2.2, 1.0);  // Refrigerator

    // 6. Central Corridor Wall (z: -1 to -8)
    addBox(group, wallMat, 0.8, height / 2, -4.5, 0.2, height, 7.0);

    // 7. Dakin Karatu (Private Study & Prayer Room) (x: -9 to -4, z: -1 to -4.5)
    addBox(group, wallMat, -4.0, height / 2, -1.0, 10.0, height, 0.2);
    addBox(group, wallMat, -4.0, height / 2, -4.5, 10.0, height, 0.2);
    // Prayer Carpets & Bookshelves
    addBox(group, this.materials.carpetRed || this.materials.cloth, -6.5, 0.05, -2.8, 3.6, 0.02, 2.4, false);
    addBox(group, woodMat, -9.6, 1.5, -2.8, 0.5, 2.6, 2.8); // Bookcase

    // 8. Master Bedroom Suite & Ensuite Bath (x: -9.5 to 0.5, z: -4.5 to -8.5)
    // King-Size Bed with Padded Headboard
    addBox(group, woodMat, -5.5, 0.45, -6.5, 2.6, 0.52, 2.8);
    addBox(group, this.materials.white, -5.5, 0.75, -6.5, 2.4, 0.25, 2.6); // Mattress
    addBox(group, this.materials.cloth, -5.5, 0.82, -6.0, 2.4, 0.15, 1.6); // Quilt
    addBox(group, woodMat, -5.5, 1.4, -7.85, 2.8, 1.4, 0.15); // Headboard
    // Ensuite Bath Partition (x: -1.5 to 0.5, z: -5.5 to -8.5)
    addBox(group, wallMat, -1.5, height / 2, -6.5, 0.2, height, 4.0);
    addBox(group, this.materials.tileFloor || this.materials.white, -0.5, 0.45, -7.5, 1.2, 0.6, 0.8); // Bathtub

    // 9. Rear Compound Utility Yard & 25kVA Generator House (z: -8.8 to -12.0)
    // Soundproof Diesel Generator
    addBox(group, this.materials.metal, 5.5, 0.9, -8.5, 2.4, 1.5, 1.6);
    addBox(group, this.materials.darkTrim, 5.5, 1.7, -8.5, 2.5, 0.12, 1.7); // Generator cover
    addCyl(group, this.materials.black, 4.5, 1.9, -8.5, 0.08, 0.7); // Exhaust pipe
    // Borehole Pressure Tank
    addCyl(group, this.materials.bankBlue || this.materials.metal, 7.8, 1.2, -8.5, 0.5, 2.2);

    // Interactive Doors
    this.addInteractiveDoor(group, "house", "villa_master_door", "Master Bedroom Door", -4.0, 0, -4.5, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "house", "villa_study_door", "Dakin Karatu Door", -4.0, 0, -1.0, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "house", "villa_rear_yard_door", "Rear Compound Yard Door", 0.8, 0, -8.8, 1.2, 2.4, 0.1, woodMat, cx, cz, true, colliders);

    // Indoor Lighting
    const parlourLight = new THREE.PointLight("#fff0d4", 2.4, 18, 1.2);
    parlourLight.position.set(-4.0, height - 0.6, 2.2);
    parlourLight.userData.baseIntensity = 2.4;
    group.add(parlourLight);
    lights.push(parlourLight);

    const masterLight = new THREE.PointLight("#ffe0b2", 1.8, 12, 1.3);
    masterLight.position.set(-5.5, height - 0.7, -6.5);
    masterLight.userData.baseIntensity = 1.8;
    group.add(masterLight);
    lights.push(masterLight);

    const diningLight = new THREE.PointLight("#fff5e6", 1.8, 12, 1.3);
    diningLight.position.set(5.0, height - 0.6, 2.8);
    diningLight.userData.baseIntensity = 1.8;
    group.add(diningLight);
    lights.push(diningLight);

    // Colliders (shifted to world coordinates cx, cz)
    colliders.push(
      // Perimeter Boundary Walls
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      // Parlour Sectional Sofa
      { x: cx - 4.0, z: cz + 4.2, halfX: 2.9, halfZ: 0.6, height: 1.2 },
      { x: cx - 7.0, z: cz + 2.2, halfX: 0.6, halfZ: 2.4, height: 1.2 },
      { x: cx - 1.0, z: cz + 2.2, halfX: 0.6, halfZ: 1.6, height: 1.2 },
      // Dining Table
      { x: cx + 5.0, z: cz + 2.8, halfX: 1.8, halfZ: 1.0, height: 1.2 },
      // Kitchen Counter
      { x: cx + 6.5, z: cz - 2.5, halfX: 0.6, halfZ: 2.1, height: 1.2 },
      // Central Partition Walls
      { x: cx + 0.8, z: cz + 2.5, halfX: 0.2, halfZ: 3.0, height },
      { x: cx + 0.8, z: cz - 4.5, halfX: 0.2, halfZ: 3.5, height },
      { x: cx - 4.0, z: cz - 1.0, halfX: 5.0, halfZ: 0.2, height },
      { x: cx - 4.0, z: cz - 4.5, halfX: 5.0, halfZ: 0.2, height },
      // Master Bed
      { x: cx - 5.5, z: cz - 6.5, halfX: 1.4, halfZ: 1.5, height: 1.4 },
      // 25kVA Generator House & Water Tank
      { x: cx + 5.5, z: cz - 8.5, halfX: 1.3, halfZ: 0.9, height: 1.8 },
      { x: cx + 7.8, z: cz - 8.5, halfX: 0.6, halfZ: 0.6, height: 2.4 },
    );

    this.interiors.set("house", {
      id: "house",
      name: "Al-Baraka Executive Villa",
      districtLabel: "RESIDENTIAL QUARTER · INDOORS",
      root: group,
      colliders,
      lights,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.8),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(44, 0, 45),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        // 1. Generator Inspection in Utility Yard at (cx + 5.5, cz - 8.5)
        const distGen = pos.distanceTo(new THREE.Vector3(cx + 5.5, cy + 0.1, cz - 8.5));
        if (distGen <= 2.4) {
          return {
            prompt: "Inspect 25kVA Soundproof Diesel Generator & Borehole",
            action: () => ({
              statusMessage: "Al-Baraka Generator House: 25kVA Lister-Petter soundproof generator operational. Diesel tank: 92% full. Borehole pressure: Nominal (4.2 Bar).",
            }),
          };
        }

        // 2. Safe / Deed Desk in Study at (cx - 6.5, cz - 2.8)
        const distStudy = pos.distanceTo(new THREE.Vector3(cx - 6.5, cy + 0.1, cz - 2.8));
        if (distStudy <= 2.2) {
          if (state.ownedProperties?.includes("albaraka-villa")) {
            return {
              prompt: "Al-Baraka Villa: Certificate of Occupancy Safe",
              action: () => ({
                statusMessage: "Official Kano State Certificate of Occupancy held for Al-Baraka Executive Villa (Plot 44, Gated Residential Quarter). Freehold title verified.",
              }),
            };
          }
        }

        // 3. Parlour Chandelier / Light Switch at (cx - 0.5, cz + 4.5)
        const distSwitch = pos.distanceTo(new THREE.Vector3(cx - 0.5, cy + 0.1, cz + 4.5));
        if (distSwitch <= 1.8) {
          return {
            prompt: this.lightsOn ? "Switch Off Parlour Lighting" : "Switch On Parlour Lighting",
            action: () => {
              const on = this.toggleInteriorLights("house");
              return { statusMessage: on ? "Al-Baraka Villa: Warm interior illumination active." : "Al-Baraka Villa: Interior lights switched off." };
            },
          };
        }

        return null;
      },
    });
  }

  // =========================================================================
  // 2. Multi-Storey Penthouse Interior (Bompai Heights Luxury Penthouse)
  // =========================================================================
  private buildPenthouseInterior() {
    const cx = 300;
    const cy = -60;
    const cz = 80;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const lights: THREE.PointLight[] = [];
    const width = 18;
    const depth = 16;
    const totalHeight = 6.8;
    const floor2Elevation = 3.4;

    const marbleMat = this.materials.tileFloor || this.materials.white;
    const wallMat = this.materials.white;
    const woodMat = this.materials.wood;
    const glassMat = this.materials.glassLit || this.materials.glass;
    const darkMat = this.materials.darkTrim;

    // 1. Lower Floor (Floor 1, y = 0) & Double-Height Ceiling Slab (y = 6.8)
    addBox(group, marbleMat, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, wallMat, 0, totalHeight, 0, width, 0.1, depth, false);

    // 2. Perimeter Walls
    addBox(group, wallMat, 0, totalHeight / 2, -depth / 2, width, totalHeight, 0.25); // North Wall
    addBox(group, wallMat, 0, totalHeight / 2, depth / 2, width, totalHeight, 0.25);  // South Wall (Foyer & Terrace)
    addBox(group, wallMat, -width / 2, totalHeight / 2, 0, 0.25, totalHeight, depth); // West Wall
    addBox(group, wallMat, width / 2, totalHeight / 2, 0, 0.25, totalHeight, depth);  // East Wall

    // 3. Lower Level: Grand Foyer (z: 5.5 to 8.0, x: -2.5 to 2.5)
    // Double Entry Doors
    addBox(group, woodMat, -0.65, 1.2, depth / 2 - 0.08, 1.2, 2.4, 0.12);
    addBox(group, woodMat, 0.65, 1.2, depth / 2 - 0.08, 1.2, 2.4, 0.12);

    // 4. Lower Level: Panoramic Living Salon (x: -8 to 1, z: -7 to 3)
    // Floor-to-Ceiling Panoramic Glass Window Wall on North side
    addBox(group, glassMat, -3.5, totalHeight / 2, -depth / 2 + 0.12, 9.0, totalHeight - 0.5, 0.1);
    // Luxury Cream Leather Sectional Suite
    addBox(group, this.materials.white, -3.5, 0.48, -4.5, 5.4, 0.52, 1.1);
    addBox(group, this.materials.white, -6.0, 0.48, -2.5, 1.1, 0.52, 3.8);
    // Polished Black Marble Coffee Table
    addBox(group, this.materials.black, -3.5, 0.35, -2.5, 2.2, 0.38, 1.2);
    // 85-inch Entertainment Wall
    addBox(group, darkMat, -8.7, 0.5, -2.5, 0.5, 0.65, 4.4);
    addBox(group, this.materials.black, -8.8, 2.0, -2.5, 0.1, 1.8, 3.2);

    // 5. Lower Level: Gourmet Island Kitchen & Dining Suite (x: 2 to 8, z: -7 to 0)
    // Central Granite Chef Island
    addBox(group, darkMat, 5.0, 0.95, -3.5, 2.2, 1.0, 3.8);
    addBox(group, marbleMat, 5.0, 1.02, -3.5, 2.4, 0.08, 4.0); // Granite top
    // 3 Leather Bar Stools
    for (const dz of [-1.2, 0, 1.2]) {
      addCyl(group, this.materials.metal, 3.4, 0.65, -3.5 + dz, 0.22, 0.65);
    }
    // Double-Door Stainless Refrigerator
    addBox(group, this.materials.metal, 7.8, 1.35, -6.5, 1.4, 2.3, 1.2);

    // 6. Lower Level: Guest Bedroom & Bathroom (x: 2 to 8, z: 1 to 7)
    addBox(group, wallMat, 5.0, 3.4 / 2, 0.5, 6.0, 3.4, 0.2); // Partition wall
    addBox(group, woodMat, 5.0, 0.45, 3.5, 2.2, 0.52, 2.4); // Guest bed
    addBox(group, this.materials.white, 5.0, 0.72, 3.5, 2.1, 0.22, 2.3);

    // 7. Grand Stepped Wooden Staircase (x: 0 to 2.2, z: 1.0 to 5.5, y: 0 to 3.4)
    const stepCount = 10;
    const stepDepth = 4.5 / stepCount;
    const stepRise = floor2Elevation / stepCount;
    for (let i = 0; i < stepCount; i++) {
      const sy = (i + 0.5) * stepRise;
      const sz = 1.0 + (i + 0.5) * stepDepth;
      addBox(group, woodMat, 1.0, sy, sz, 2.0, stepRise, stepDepth);
      colliders.push({
        x: cx + 1.0,
        z: cz + sz,
        halfX: 1.0,
        halfZ: stepDepth / 2,
        height: sy + 1.2,
      });
    }

    // 8. Upper Mezzanine Level Floor Slab (y = 3.4, z: 0 to 8, x: -8 to 8)
    addBox(group, marbleMat, 0, floor2Elevation, 4.0, width, 0.15, 8.0, false);

    // 9. Upper Mezzanine Gallery & Library (x: 1.5 to 8, z: 0.5 to 5.5)
    // Safety Glass Balustrade Overlooking Living Salon Below
    addBox(group, glassMat, 4.5, floor2Elevation + 0.6, 0.2, 6.5, 1.1, 0.08);
    addBox(group, this.materials.metal, 4.5, floor2Elevation + 1.15, 0.2, 6.5, 0.06, 0.08);
    // Executive Desk & Laptop
    addBox(group, woodMat, 5.0, floor2Elevation + 0.75, 2.8, 2.4, 0.08, 1.2);
    addBox(group, this.materials.metal, 5.0, floor2Elevation + 0.82, 2.8, 0.45, 0.04, 0.35); // Laptop

    // 10. Upper Level: Master Penthouse Suite (x: -8 to -1, z: 0 to 5.5)
    addBox(group, wallMat, -1.0, floor2Elevation + (totalHeight - floor2Elevation) / 2, 2.8, 0.2, totalHeight - floor2Elevation, 5.5);
    // King-Size Master Bed
    addBox(group, woodMat, -5.0, floor2Elevation + 0.45, 2.8, 2.6, 0.55, 2.8);
    addBox(group, this.materials.white, -5.0, floor2Elevation + 0.75, 2.8, 2.4, 0.25, 2.6);
    addBox(group, darkMat, -5.0, floor2Elevation + 1.4, 1.35, 2.8, 1.4, 0.15); // Headboard
    // Executive Wall Safe
    addBox(group, this.materials.metal, -8.7, floor2Elevation + 1.2, 2.8, 0.4, 0.6, 0.6);

    // 11. Upper Level: Private Skyline Rooftop Terrace (z: 5.5 to 8.0, x: -8 to 8)
    // Terrace Partition Wall & Glass Sliding Doors
    addBox(group, wallMat, 0, floor2Elevation + (totalHeight - floor2Elevation) / 2, 5.5, width, totalHeight - floor2Elevation, 0.2);
    // Teak Outdoor Lounge Chairs & Table
    addBox(group, woodMat, -4.0, floor2Elevation + 0.35, 6.8, 1.8, 0.35, 1.0);
    addBox(group, this.materials.cloth, -4.0, floor2Elevation + 0.55, 6.8, 1.6, 0.15, 0.9);

    // Interactive Doors
    this.addInteractiveDoor(group, "penthouse", "penthouse_master_door", "Master Penthouse Suite Door", -1.0, floor2Elevation, 4.5, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "penthouse", "penthouse_guest_door", "Guest Bedroom Door", 5.0, 0, 0.5, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "penthouse", "penthouse_terrace_door", "Rooftop Skyline Terrace Door", 0, floor2Elevation, 5.5, 1.4, 2.4, 0.08, glassMat, cx, cz, true, colliders);

    // Luxury Chandelier & Lighting
    const salonChandelier = new THREE.PointLight("#fff5d0", 2.8, 22, 1.1);
    salonChandelier.position.set(-3.5, totalHeight - 1.2, -1.0);
    salonChandelier.userData.baseIntensity = 2.8;
    group.add(salonChandelier);
    lights.push(salonChandelier);

    const masterLight = new THREE.PointLight("#ffe0b2", 1.8, 12, 1.2);
    masterLight.position.set(-5.0, totalHeight - 1.2, 2.8);
    masterLight.userData.baseIntensity = 1.8;
    group.add(masterLight);
    lights.push(masterLight);

    const kitchenLight = new THREE.PointLight("#fff0d4", 1.8, 12, 1.2);
    kitchenLight.position.set(5.0, 3.4 - 0.5, -3.5);
    kitchenLight.userData.baseIntensity = 1.8;
    group.add(kitchenLight);
    lights.push(kitchenLight);

    // Colliders (shifted to world coordinates cx, cz)
    colliders.push(
      // Perimeter Boundary Walls
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height: totalHeight },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height: totalHeight },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height: totalHeight },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height: totalHeight },
      // Living Room Sofa & Media Wall
      { x: cx - 3.5, z: cz - 4.5, halfX: 2.8, halfZ: 0.6, height: 1.2 },
      { x: cx - 6.0, z: cz - 2.5, halfX: 0.6, halfZ: 2.0, height: 1.2 },
      { x: cx - 8.7, z: cz - 2.5, halfX: 0.3, halfZ: 2.3, height: 2.2 },
      // Kitchen Island
      { x: cx + 5.0, z: cz - 3.5, halfX: 1.3, halfZ: 2.1, height: 1.2 },
      // Guest Bedroom Partition & Bed
      { x: cx + 5.0, z: cz + 0.5, halfX: 3.0, halfZ: 0.2, height: 3.4 },
      { x: cx + 5.0, z: cz + 3.5, halfX: 1.2, halfZ: 1.3, height: 1.2 },
      // Upper Floor Partition Wall & Master Bed
      { x: cx - 1.0, z: cz + 2.8, halfX: 0.2, halfZ: 2.8, height: totalHeight },
      { x: cx - 5.0, z: cz + 2.8, halfX: 1.4, halfZ: 1.5, height: totalHeight },
      // Terrace Wall
      { x: cx, z: cz + 5.5, halfX: width / 2, halfZ: 0.2, height: totalHeight },
    );

    this.interiors.set("penthouse", {
      id: "penthouse",
      name: "Bompai Heights Luxury Penthouse",
      districtLabel: "BOMPAI AVENUE · PENTHOUSE",
      root: group,
      colliders,
      lights,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.6),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 0.9),
      outdoorDoorPosition: new THREE.Vector3(18, 0, 39.5),
      outdoorDoorYaw: Math.PI,
      checkInteraction: (pos, state) => {
        // 1. Executive Wall Safe in Master Suite (cx - 8.7, cz + 2.8, y = -56.5)
        const distSafe = pos.distanceTo(new THREE.Vector3(cx - 8.7, cy + floor2Elevation + 0.1, cz + 2.8));
        if (distSafe <= 2.4) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Bompai Heights Penthouse: Executive Deed Safe",
              action: () => ({
                statusMessage: "Executive Safe: Freehold Title Deed #BH-PENT-08 verified. 12-Panel Solar Inverter Battery Bank: 100% capacity.",
              }),
            };
          }
        }

        // 2. Rooftop Skyline Terrace Vista (cx, cz + 6.8, y = -56.5)
        const distTerrace = pos.distanceTo(new THREE.Vector3(cx, cy + floor2Elevation + 0.1, cz + 6.8));
        if (distTerrace <= 2.4) {
          return {
            prompt: "Look Out Across Kano City Skyline",
            action: () => ({
              statusMessage: "Bompai Skyline Terrace: 360° panoramic view spanning from Dala Hill to Airport Road. The ancient and modern city stretches below.",
            }),
          };
        }

        // 3. Penthouse Lighting Chandelier Switch (cx - 1.0, cz - 1.0)
        const distSwitch = pos.distanceTo(new THREE.Vector3(cx - 1.0, cy + 0.1, cz - 1.0));
        if (distSwitch <= 2.0) {
          return {
            prompt: this.lightsOn ? "Switch Off Penthouse Chandelier" : "Switch On Penthouse Chandelier",
            action: () => {
              const on = this.toggleInteriorLights("penthouse");
              return { statusMessage: on ? "Bompai Penthouse: Luxury crystal chandelier illuminated." : "Bompai Penthouse: Lights dimmed to ambient mode." };
            },
          };
        }

        return null;
      },
    });
  }

  // =========================================================================
  // 3. Multi-Storey Apartment Interior (Unit 2B - Airport View Apartments)
  // =========================================================================
  private buildApartmentInterior() {
    const cx = 260;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const lights: THREE.PointLight[] = [];
    const width = 14;
    const depth = 12;
    const height = 3.5;

    const floorMat = this.materials.tileFloor || this.materials.concrete;
    const wallMat = this.materials.white;
    const woodMat = this.materials.wood;
    const glassMat = this.materials.glassLit || this.materials.glass;
    const darkMat = this.materials.darkTrim;

    // Floor & Ceiling Slabs
    addBox(group, floorMat, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, wallMat, 0, height, 0, width, 0.1, depth, false);

    // Perimeter Walls
    addBox(group, wallMat, 0, height / 2, -depth / 2, width, height, 0.25); // North Wall
    addBox(group, wallMat, 0, height / 2, depth / 2, width, height, 0.25);  // South Wall (Entry)
    addBox(group, wallMat, -width / 2, height / 2, 0, 0.25, height, depth); // West Wall
    addBox(group, wallMat, width / 2, height / 2, 0, 0.25, height, depth);  // East Wall

    // 1. Entrance Vestibule & Hallway (z: 3.5 to 5.5, x: -1.5 to 1.5)
    addBox(group, woodMat, 0, 1.1, depth / 2 - 0.08, 1.2, 2.2, 0.1); // Front Door

    // 2. Open-Concept Living Room (x: -6.0 to 0, z: -3.5 to 2.0)
    addBox(group, this.materials.cloth, -3.2, 0.48, -0.8, 3.4, 0.52, 1.1); // Sofa
    addBox(group, this.materials.cloth, -5.4, 0.48, 0.6, 1.0, 0.52, 2.2);  // Sofa L-extension
    addBox(group, woodMat, -3.2, 0.35, 0.6, 1.6, 0.36, 0.9);              // Coffee Table
    addBox(group, this.materials.clothRed, -3.2, 0.05, 0.2, 4.0, 0.02, 3.4, false); // Area Rug
    // Entertainment Wall
    addBox(group, darkMat, -3.2, 0.45, -3.8, 3.4, 0.6, 0.5);
    addBox(group, this.materials.black, -3.2, 1.6, -3.85, 2.4, 1.3, 0.08);

    // 3. Private Executive Balcony (x: -6.0 to 0, z: -5.8 to -4.0)
    addBox(group, this.materials.concrete, -3.2, 0.05, -4.8, 5.6, 0.08, 1.6, false);
    // Balcony Metal Railing
    addBox(group, this.materials.metal, -3.2, 0.55, -5.7, 5.6, 1.1, 0.08);
    // Sliding Glass Door
    addBox(group, glassMat, -3.2, 1.4, -4.0, 3.2, 2.4, 0.08);

    // 4. Open-Plan Kitchen & Dining Area (x: 1.0 to 6.2, z: -3.5 to 2.0)
    // L-Shaped Kitchen Counter & Cabinets
    addBox(group, this.materials.concrete, 5.2, 0.95, -1.8, 1.2, 1.0, 3.6);
    addBox(group, this.materials.metal, 5.2, 1.02, -1.8, 1.3, 0.08, 3.8); // Steel top
    // Dining Table & Chairs
    addBox(group, woodMat, 2.6, 0.76, 0.2, 1.8, 0.08, 1.2);
    for (const sx of [-0.65, 0.65]) {
      for (const sz of [-0.45, 0.45]) {
        addCyl(group, this.materials.metal, 2.6 + sx, 0.38, 0.2 + sz, 0.035, 0.72);
      }
    }

    // 5. Rental Desk & Deed Inspection Station (x: 4.0, z: -3.2)
    addBox(group, woodMat, 2.8, 0.5, -3.2, 1.8, 0.85, 0.9);
    const signMat = makeSignMaterial("UNIT 2B · LEASE & DEED DESK\n₦75,000 / MO · ₦18,000,000 FREEHOLD", "#1e3c28");
    addBox(group, signMat, 2.8, 1.35, -3.2, 1.6, 0.65, 0.08);

    // 6. Master Bedroom (x: -6.0 to -1.0, z: 2.2 to 5.5)
    addBox(group, wallMat, -1.0, height / 2, 3.8, 0.2, height, 3.6); // Partition Wall
    // Queen Bed
    addBox(group, woodMat, -3.8, 0.42, 3.8, 2.2, 0.48, 2.4);
    addBox(group, this.materials.white, -3.8, 0.68, 3.8, 2.1, 0.22, 2.3);
    addBox(group, darkMat, -3.8, 1.2, 5.1, 2.4, 1.2, 0.12); // Headboard

    // 7. Bathroom & Toilet (x: 1.5 to 6.2, z: 2.2 to 5.5)
    addBox(group, wallMat, 1.2, height / 2, 3.8, 0.2, height, 3.6); // Partition Wall
    // Vanity Sink & Mirror
    addBox(group, this.materials.tileFloor || this.materials.white, 3.0, 0.85, 4.8, 1.2, 0.85, 0.6);
    addBox(group, glassMat, 3.0, 1.65, 5.15, 0.9, 0.8, 0.04); // Mirror
    // Shower Stall
    addBox(group, glassMat, 5.0, 1.2, 3.8, 1.4, 2.4, 1.4);

    // Interactive Doors
    this.addInteractiveDoor(group, "apartment", "apt_bedroom_door", "Master Bedroom Door", -1.0, 0, 2.2, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "apartment", "apt_bathroom_door", "Bathroom Door", 1.2, 0, 2.2, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "apartment", "apt_balcony_door", "Balcony Sliding Door", -3.2, 0, -4.0, 1.4, 2.4, 0.08, glassMat, cx, cz, true, colliders);

    // Warm Lighting
    const aptLivingLight = new THREE.PointLight("#fff5e6", 2.2, 14, 1.2);
    aptLivingLight.position.set(-3.2, height - 0.6, -0.8);
    aptLivingLight.userData.baseIntensity = 2.2;
    group.add(aptLivingLight);
    lights.push(aptLivingLight);

    const aptBedLight = new THREE.PointLight("#ffe0b2", 1.6, 10, 1.3);
    aptBedLight.position.set(-3.8, height - 0.7, 3.8);
    aptBedLight.userData.baseIntensity = 1.6;
    group.add(aptBedLight);
    lights.push(aptBedLight);

    // Colliders (shifted to world coordinates cx, cz)
    colliders.push(
      // Perimeter Boundary Walls
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      // Living Room Sofa & Media Credenza
      { x: cx - 3.2, z: cz - 0.8, halfX: 1.8, halfZ: 0.6, height: 1.2 },
      { x: cx - 5.4, z: cz + 0.6, halfX: 0.6, halfZ: 1.2, height: 1.2 },
      { x: cx - 3.2, z: cz - 3.8, halfX: 1.8, halfZ: 0.3, height: 1.8 },
      // Balcony Railing
      { x: cx - 3.2, z: cz - 5.7, halfX: 2.8, halfZ: 0.1, height: 1.2 },
      // Kitchen Counter
      { x: cx + 5.2, z: cz - 1.8, halfX: 0.7, halfZ: 1.9, height: 1.2 },
      // Dining Table
      { x: cx + 2.6, z: cz + 0.2, halfX: 1.0, halfZ: 0.7, height: 1.1 },
      // Rental Desk
      { x: cx + 4.0, z: cz - 3.2, halfX: 1.0, halfZ: 0.6, height: 1.8 },
      // Bedroom Partition & Bed
      { x: cx - 1.0, z: cz + 3.8, halfX: 0.2, halfZ: 1.8, height },
      { x: cx - 3.8, z: cz + 3.8, halfX: 1.2, halfZ: 1.3, height: 1.2 },
      // Bathroom Partition
      { x: cx + 1.2, z: cz + 3.8, halfX: 0.2, halfZ: 1.8, height },
      { x: cx + 5.0, z: cz + 3.8, halfX: 0.8, halfZ: 0.8, height: 2.2 },
    );

    this.interiors.set("apartment", {
      id: "apartment",
      name: "Airport View Apartments · Unit 2B",
      districtLabel: "AIRPORT ROAD · APARTMENTS",
      root: group,
      colliders,
      lights,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.6),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(48, 0, -43.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        // Distance to rental & deed desk (cx + 4.0, cz - 3.2)
        const d = pos.distanceTo(new THREE.Vector3(cx + 2.8, cy + 0.1, cz - 3.2));
        if (d <= 2.2) {
          if (state.ownedProperties?.includes("unit-2b")) {
            return {
              prompt: "Unit 2B: Freehold Deed of Ownership Held",
              action: () => ({
                statusMessage: "You hold the official Certificate of Occupancy for Unit 2B Airport View Apartments. Freehold property with zero monthly rent.",
              }),
            };
          }
          if (state.hasApartmentRental) {
            return {
              prompt: "Purchase Unit 2B Freehold Ownership (₦18,000,000)",
              action: () => {
                if (state.cash < 18000000) {
                  return { statusMessage: "Insufficient capital: Freehold deed of ownership requires ₦18,000,000." };
                }
                return {
                  statusMessage: "Congratulations! Freehold Certificate of Occupancy acquired for Unit 2B Airport View Apartments!",
                  cashDelta: -18000000,
                  purchasedProperty: "unit-2b",
                };
              },
            };
          }
          return {
            prompt: `Rent Apartment Unit 2B (₦75,000 / month)`,
            action: () => {
              if (state.cash < 75000) {
                return { statusMessage: "Insufficient funds: You need ₦75,000 to rent this apartment." };
              }
              return {
                statusMessage: "Lease Confirmed! You have rented Unit 2B (Airport View Apartments).",
                cashDelta: -75000,
                rentApartment: true,
              };
            },
          };
        }
        return null;
      },
    });
  }

  // =========================================================================
  // 4. St. Stephen's Anglican Church Interior
  // =========================================================================
  private buildChurchInterior() {
    const cx = 300;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const width = 14;
    const depth = 22;
    const height = 7.5;

    // Stone Floor & Timber Roof
    addBox(group, this.materials.stone, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, this.materials.wood, 0, height, 0, width, 0.2, depth, false);

    // Vaulted wooden roof trusses
    for (let z = -depth / 2 + 3; z <= depth / 2 - 3; z += 3.8) {
      addBox(group, this.materials.wood, 0, height - 0.5, z, width - 0.4, 0.35, 0.25, false);
      addBox(group, this.materials.wood, -width / 2 + 1.2, height / 2, z, 0.25, height, 0.25, false);
      addBox(group, this.materials.wood, width / 2 - 1.2, height / 2, z, 0.25, height, 0.25, false);
    }

    // Walls
    addBox(group, this.materials.plaster, 0, height / 2, -depth / 2, width, height, 0.3); // Altar wall (North)
    addBox(group, this.materials.plaster, 0, height / 2, depth / 2, width, height, 0.3);  // Entrance wall (South)
    addBox(group, this.materials.plaster, -width / 2, height / 2, 0, 0.3, height, depth); // West
    addBox(group, this.materials.plaster, width / 2, height / 2, 0, 0.3, height, depth);  // East

    // Central Crimson Carpet Aisle
    addBox(group, this.materials.carpetRed || this.materials.clothRed, 0, 0.06, 1.5, 2.4, 0.02, depth - 5, false);

    // 8 Rows of Wooden Church Pews (Seating)
    const pewRows = 6;
    for (let i = 0; i < pewRows; i++) {
      const z = -4.5 + i * 2.4;
      for (const side of [-1, 1]) {
        const x = side * 3.4;
        // Pew Bench
        addBox(group, this.materials.wood, x, 0.45, z, 3.6, 0.1, 0.45);
        addBox(group, this.materials.wood, x, 0.85, z - 0.2, 3.6, 0.65, 0.08); // Backrest
        addBox(group, this.materials.wood, x + side * 1.75, 0.48, z, 0.1, 0.85, 0.55); // Side upright
        addBox(group, this.materials.wood, x - side * 1.75, 0.48, z, 0.1, 0.85, 0.55);

        colliders.push({ x: cx + x, z: cz + z, halfX: 1.9, halfZ: 0.35, height: 1.1 });
      }
    }

    // Congregation Figures (Sunday Service Worship)
    const congPositions = [
      { x: -3.4, z: -4.5 },
      { x: 3.4, z: -4.5 },
      { x: -2.8, z: -2.1 },
      { x: 3.8, z: -2.1 },
      { x: -3.8, z: 0.3 },
      { x: 3.2, z: 2.7 },
    ];
    congPositions.forEach((pos, idx) => {
      const npcMat = idx % 2 === 0 ? this.materials.white : this.materials.clothRed;
      addBox(group, npcMat, pos.x, 0.85, pos.z, 0.45, 0.75, 0.42);
      addCyl(group, this.materials.clay, pos.x, 1.45, pos.z, 0.16, 0.32);
    });

    // Elevated Chancel Platform & Altar
    addBox(group, this.materials.stone, 0, 0.25, -depth / 2 + 3.8, 10, 0.5, 5.2, false);
    // Altar Table
    addBox(group, this.materials.wood, 0, 0.85, -depth / 2 + 2.5, 4.2, 0.7, 1.4);
    addBox(group, this.materials.white, 0, 1.22, -depth / 2 + 2.5, 4.4, 0.06, 1.5, false); // Linen cloth
    // Golden Latin Cross on Altar Back Wall
    addBox(group, this.materials.goldTrim || this.materials.trim, 0, 3.8, -depth / 2 + 0.25, 0.22, 2.4, 0.1);
    addBox(group, this.materials.goldTrim || this.materials.trim, 0, 4.4, -depth / 2 + 0.25, 1.4, 0.22, 0.1);

    // Pulpit / Lectern with Open Bible
    addBox(group, this.materials.wood, -3.2, 1.1, -depth / 2 + 4.2, 1.0, 1.2, 0.9);
    addBox(group, this.materials.white, -3.2, 1.75, -depth / 2 + 4.2, 0.5, 0.08, 0.4); // Bible

    // Stained Glass Windows
    for (const z of [-6, 0, 6]) {
      const glassMat = (z + 6) % 4 === 0 ? this.materials.clothRed : this.materials.glassLit;
      addBox(group, glassMat, -width / 2 + 0.1, 3.8, z, 0.1, 2.8, 1.6);
      addBox(group, glassMat, width / 2 - 0.1, 3.8, z, 0.1, 2.8, 1.6);
    }

    // Entrance Double Doors
    addBox(group, this.materials.wood, -0.65, 1.3, depth / 2 - 0.1, 1.2, 2.6, 0.15);
    addBox(group, this.materials.wood, 0.65, 1.3, depth / 2 - 0.1, 1.2, 2.6, 0.15);

    // Church Chandelier Lighting
    const sanctuaryLight = new THREE.PointLight("#ffe8c4", 2.2, 22, 1.2);
    sanctuaryLight.position.set(0, height - 1.2, 0);
    group.add(sanctuaryLight);

    const altarLight = new THREE.PointLight("#fff5d0", 2.0, 12, 1.0);
    altarLight.position.set(0, 4.5, -depth / 2 + 3);
    group.add(altarLight);

    colliders.push(
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      // Altar Table
      { x: cx, z: cz - depth / 2 + 2.5, halfX: 2.2, halfZ: 0.8, height: 1.5 },
      // Pulpit
      { x: cx - 3.2, z: cz - depth / 2 + 4.2, halfX: 0.6, halfZ: 0.5, height: 1.8 },
    );

    this.interiors.set("church", {
      id: "church",
      name: "St. Stephen's Anglican Church",
      districtLabel: "SABON GARI · CHURCH NAVE",
      root: group,
      colliders,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 2.2),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.2),
      outdoorDoorPosition: new THREE.Vector3(-48, 0, 49.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        // Altar prayer railing (cx, cz - depth / 2 + 4.8)
        const d = pos.distanceTo(new THREE.Vector3(cx, cy + 0.1, cz - depth / 2 + 4.8));
        if (d <= 2.4) {
          return {
            prompt: "Kneel in Prayer / Church Offering (Ôéª1,000)",
            action: () => {
              if (state.cash < 1000) {
                return { statusMessage: "You offer a silent prayer of gratitude and hope." };
              }
              return {
                statusMessage: "Offering given (Ôéª1,000). Pastor: 'Peace and blessings be upon your household.'",
                cashDelta: -1000,
              };
            },
          };
        }
        return null;
      },
    });
  }

  // 4. Airport Road Police & KAROTA Station Office
  private buildPolicePostInterior() {
    const cx = 340;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const width = 11;
    const depth = 8;
    const height = 3.4;

    // Floor & Ceiling
    addBox(group, this.materials.concrete, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, this.materials.white, 0, height, 0, width, 0.1, depth, false);

    // Walls
    addBox(group, this.materials.policeNavy || this.materials.darkTrim, 0, height / 2, -depth / 2, width, height, 0.2);
    addBox(group, this.materials.white, 0, height / 2, depth / 2, width, height, 0.2);
    addBox(group, this.materials.white, -width / 2, height / 2, 0, 0.2, height, depth);
    addBox(group, this.materials.white, width / 2, height / 2, 0, 0.2, height, depth);

    // Front Police Reception Desk
    addBox(group, this.materials.wood, -1.8, 0.55, -0.6, 3.4, 1.1, 0.9);
    addBox(group, this.materials.black, -1.8, 1.25, -0.6, 0.5, 0.35, 0.35); // Computer monitor
    addBox(group, this.materials.wood, -1.8, 0.45, -1.4, 0.55, 0.55, 0.55); // Officer chair

    // Nigerian National Flag (Green-White-Green)
    addCyl(group, this.materials.goldTrim || this.materials.metal, -4.2, 1.5, -3.2, 0.04, 3.0);
    addBox(group, this.materials.kekeGreen, -4.2, 2.5, -2.7, 0.02, 0.8, 0.35, false);
    addBox(group, this.materials.white, -4.2, 2.5, -2.35, 0.02, 0.8, 0.35, false);
    addBox(group, this.materials.kekeGreen, -4.2, 2.5, -2.0, 0.02, 0.8, 0.35, false);

    // Official Notice Board
    const noticeSign = makeSignMaterial("NIGERIAN POLICE FORCE\nAIRPORT ROAD DIVISION", "#141b2d");
    addBox(group, noticeSign, 0, 2.4, -depth / 2 + 0.12, 4.2, 0.9, 0.08);

    // KAROTA Traffic Fine Settlement Desk
    const karotaSign = makeSignMaterial("KAROTA TRAFFIC PENALTY\nRESOLUTION DESK", "#156228");
    addBox(group, this.materials.karotaGreen || this.materials.kekeGreen, 2.8, 0.55, -1.2, 2.4, 1.1, 0.9);
    addBox(group, karotaSign, 2.8, 1.6, -1.2, 2.2, 0.65, 0.08);

    // Exit Door
    addBox(group, this.materials.wood, 0, 1.1, depth / 2 - 0.08, 1.2, 2.2, 0.1);

    const stationLight = new THREE.PointLight("#e8f0ff", 1.8, 14, 1.2);
    stationLight.position.set(0, height - 0.6, 0);
    group.add(stationLight);

    colliders.push(
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      // Police Counter
      { x: cx - 1.8, z: cz - 0.6, halfX: 1.8, halfZ: 0.55, height: 1.2 },
      // KAROTA Desk
      { x: cx + 2.8, z: cz - 1.2, halfX: 1.3, halfZ: 0.55, height: 1.8 },
    );

    this.interiors.set("police-post", {
      id: "police-post",
      name: "Airport Road Police & KAROTA Station",
      districtLabel: "AIRPORT ROAD · SECURITY POST",
      root: group,
      colliders,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.6),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(28, 0, -12.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        // Distance to KAROTA desk (cx + 2.8, cz - 1.2)
        const d = pos.distanceTo(new THREE.Vector3(cx + 2.8, cy + 0.1, cz - 1.2));
        if (d <= 2.2) {
          if (state.trafficFine <= 0) {
            return {
              prompt: "Inspect Vehicle Clearance",
              action: () => ({
                statusMessage: "KAROTA Officer: All your vehicle documents and records are clear. Safe driving!",
              }),
            };
          }
          return {
            prompt: `Pay KAROTA Fine (Ôéª${state.trafficFine.toLocaleString()}) & Clear Vehicle Notice`,
            action: () => {
              if (state.cash < state.trafficFine) {
                return { statusMessage: `Insufficient cash: You need Ôéª${state.trafficFine.toLocaleString()} to clear this fine.` };
              }
              const fineAmount = state.trafficFine;
              return {
                statusMessage: `Penalty Paid (Ôéª${fineAmount}). Official KAROTA clearance receipt issued!`,
                cashDelta: -fineAmount,
                clearFine: true,
              };
            },
          };
        }

        // Distance to Police Desk (cx - 1.8, cz - 0.6)
        const dp = pos.distanceTo(new THREE.Vector3(cx - 1.8, cy + 0.1, cz - 0.6));
        if (dp <= 2.2) {
          return {
            prompt: "Speak with Duty Officer",
            action: () => ({
              statusMessage: "Duty Officer: 'Airport Road Division reporting. Area is under active patrol. Report any security concerns.'",
            }),
          };
        }

        return null;
      },
    });
  }

  // 5. Arewa Fast Food & Suya Lounge Interior
  private buildRestaurantInterior() {
    const cx = 380;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const width = 14;
    const depth = 11;
    const height = 3.8;

    // Floor (Polished Terrazzo Tiles) & Ceiling
    addBox(group, this.materials.tileFloor || this.materials.concrete, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, this.materials.white, 0, height, 0, width, 0.1, depth, false);

    // Perimeter Walls in Warm Terracotta
    const wallMat = this.materials.warmOrange || this.materials.ochre;
    addBox(group, wallMat, 0, height / 2, -depth / 2, width, height, 0.25);
    addBox(group, this.materials.white, 0, height / 2, depth / 2, width, height, 0.25);
    addBox(group, this.materials.white, -width / 2, height / 2, 0, 0.25, height, depth);
    addBox(group, this.materials.white, width / 2, height / 2, 0, 0.25, height, depth);

    // Service Counter & Food Warmer (North-West)
    const counterX = -3.2;
    const counterZ = -2.6;
    addBox(group, this.materials.wood, counterX, 0.55, counterZ, 5.2, 1.1, 1.2);
    addBox(group, this.materials.darkTrim, counterX, 1.12, counterZ, 5.4, 0.08, 1.3);
    addBox(group, this.materials.black, counterX - 1.4, 1.3, counterZ, 0.5, 0.35, 0.4);
    addBox(group, this.materials.glassLit, counterX + 1.1, 1.35, counterZ, 2.2, 0.45, 0.7);
    const menuSign = makeSignMaterial("AREWA KITCHEN SPECIALS · JOLLOF RICE Ôéª3,500 · KANO SUYA Ôéª2,500 · CHAPMAN Ôéª1,200", "#4c1a0e");
    addBox(group, menuSign, counterX, 2.8, -depth / 2 + 0.15, 6.2, 0.9, 0.08);

    // Chef / Server Behind Counter
    const chefMat = this.materials.white;
    addBox(group, chefMat, counterX, 0.9, counterZ - 1.1, 0.48, 0.75, 0.35);
    addCyl(group, this.materials.clay, counterX, 1.55, counterZ - 1.1, 0.15, 0.3);
    addCyl(group, chefMat, counterX, 1.82, counterZ - 1.1, 0.2, 0.25);

    // 4 Dining Booths with Upholstered Bench Seats & Wooden Tables
    const boothConfigs = [
      { x: 3.5, z: -3.0, hasAmina: true },
      { x: 3.5, z: 0.0, hasAmina: false },
      { x: 3.5, z: 3.0, hasAmina: false },
      { x: -3.5, z: 2.5, hasAmina: false },
    ];
    boothConfigs.forEach((b) => {
      addBox(group, this.materials.wood, b.x, 0.42, b.z, 2.4, 0.08, 1.2);
      addCyl(group, this.materials.metal, b.x, 0.2, b.z, 0.1, 0.4);
      for (const side of [-1, 1]) {
        const bz = b.z + side * 0.95;
        addBox(group, this.materials.clothRed, b.x, 0.4, bz, 2.4, 0.45, 0.5);
        addBox(group, this.materials.clothRed, b.x, 0.85, bz + side * 0.2, 2.4, 0.55, 0.15);
      }
      addCyl(group, this.materials.white, b.x - 0.4, 0.48, b.z, 0.22, 0.04);
      addCyl(group, this.materials.white, b.x + 0.4, 0.48, b.z, 0.22, 0.04);
      addCyl(group, this.materials.glassLit, b.x, 0.54, b.z, 0.08, 0.18);

      colliders.push({ x: cx + b.x, z: cz + b.z, halfX: 1.4, halfZ: 1.3, height: 1.4 });

      if (b.hasAmina) {
        addBox(group, this.materials.clothRed, b.x, 0.72, b.z - 0.95, 0.44, 0.65, 0.32);
        addCyl(group, this.materials.clay, b.x, 1.25, b.z - 0.95, 0.14, 0.28);
      }
    });

    // Exit Door
    addBox(group, this.materials.wood, 0, 1.1, depth / 2 - 0.08, 1.4, 2.4, 0.1);

    const restoLight1 = new THREE.PointLight("#ffe2b8", 2.0, 16, 1.1);
    restoLight1.position.set(-2, height - 0.6, -1);
    group.add(restoLight1);

    const restoLight2 = new THREE.PointLight("#ffcca0", 1.8, 16, 1.1);
    restoLight2.position.set(3, height - 0.6, 1);
    group.add(restoLight2);

    colliders.push(
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + counterX, z: cz + counterZ, halfX: 2.8, halfZ: 0.7, height: 1.4 },
    );

    this.interiors.set("restaurant", {
      id: "restaurant",
      name: "Arewa Fast Food & Suya Lounge",
      districtLabel: "AIRPORT ROAD · AREWA LOUNGE",
      root: group,
      colliders,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.8),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(16, 0, -36.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        const distCounter = pos.distanceTo(new THREE.Vector3(cx + counterX, cy + 0.1, cz + counterZ));
        if (distCounter <= 2.5) {
          return {
            prompt: "Order Kano Suya & Jollof Platter (Ôéª3,500)",
            action: () => {
              if (state.cash < 3500) {
                return { statusMessage: "Insufficient cash: You need Ôéª3,500 for the special platter." };
              }
              return {
                statusMessage: "Delicious Kano Beef Suya & Jollof Rice served! Recharged and energized.",
                cashDelta: -3500,
              };
            },
          };
        }

        const distAmina = pos.distanceTo(new THREE.Vector3(cx + 3.5, cy + 0.1, cz - 3.0));
        if (distAmina <= 2.2) {
          return {
            prompt: "Talk with Amina Lawal (Architect)",
            action: () => ({
              statusMessage: "Amina Lawal: 'Sannu! I am taking a break from drafting villa blueprints. Beautiful evening in Kano!'",
              socialContactId: "amina",
            }),
          };
        }

        const distFranchise = pos.distanceTo(new THREE.Vector3(cx - 3.2, cy + 0.1, cz + 2.5));
        if (distFranchise <= 2.2) {
          if (state.ownedBusinesses?.includes("arewa-suya-franchise")) {
            return {
              prompt: "Arewa Suya Franchise Share: Active Partner",
              action: () => ({
                statusMessage: "You are an equity partner in Arewa Suya Lounge. Yields ~Ôéª30,000/day net profit.",
              }),
            };
          }
          return {
            prompt: "Invest: Acquire Arewa Suya Franchise Share (Ôéª1,200,000)",
            action: () => {
              if (state.cash < 1200000) {
                return { statusMessage: "Insufficient capital: Arewa Suya franchise equity requires Ôéª1,200,000." };
              }
              return {
                statusMessage: "Franchise Partnership Agreement signed! You now earn ~Ôéª30,000/day net profit.",
                cashDelta: -1200000,
                purchasedBusiness: "arewa-suya-franchise",
              };
            },
          };
        }

        return null;
      },
    });
  }

  // 6. Kano Cyber & PS5 Game Hub Interior
  private buildGamingHubInterior() {
    const cx = 420;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const width = 13;
    const depth = 10;
    const height = 3.6;

    addBox(group, this.materials.black, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, this.materials.black, 0, height, 0, width, 0.1, depth, false);

    const cyanMat = this.materials.neonCyan || this.materials.glassLit;
    const magentaMat = this.materials.neonMagenta || this.materials.glassLit;
    addBox(group, this.materials.darkTrim, 0, height / 2, -depth / 2, width, height, 0.25);
    addBox(group, this.materials.darkTrim, 0, height / 2, depth / 2, width, height, 0.25);
    addBox(group, this.materials.darkTrim, -width / 2, height / 2, 0, 0.25, height, depth);
    addBox(group, this.materials.darkTrim, width / 2, height / 2, 0, 0.25, height, depth);

    addBox(group, cyanMat, 0, height - 0.4, -depth / 2 + 0.15, width - 1, 0.08, 0.04);
    addBox(group, magentaMat, 0, height - 0.4, depth / 2 - 0.15, width - 1, 0.08, 0.04);

    const boardSign = makeSignMaterial("KANO ESPORTS LEADERBOARD · 1. Z-BELLO 9,840 PTS · 2. KANO-DRIFTER 8,920 PTS · 3. YOU", "#0a1224");
    addBox(group, boardSign, 0, 2.5, -depth / 2 + 0.16, 7.2, 1.4, 0.08);

    const row1X = -3.2;
    addBox(group, this.materials.darkTrim, row1X, 0.45, -0.6, 1.2, 0.75, 5.2);
    for (let i = 0; i < 3; i++) {
      const pz = -2.2 + i * 1.6;
      addBox(group, cyanMat, row1X, 1.15, pz, 0.1, 0.55, 0.95);
      addBox(group, magentaMat, row1X + 0.25, 0.85, pz, 0.35, 0.04, 0.6);
      addBox(group, cyanMat, row1X - 0.4, 0.55, pz, 0.45, 0.6, 0.2);
      addBox(group, this.materials.black, row1X + 0.95, 0.55, pz, 0.6, 1.1, 0.6);

      colliders.push({ x: cx + row1X, z: cz + pz, halfX: 0.8, halfZ: 0.7, height: 1.4 });
    }

    const row2X = 3.2;
    addBox(group, this.materials.darkTrim, row2X, 0.45, -0.6, 1.2, 0.75, 5.2);
    for (let i = 0; i < 3; i++) {
      const pz = -2.2 + i * 1.6;
      addBox(group, magentaMat, row2X, 1.15, pz, 0.1, 0.55, 0.95);
      addBox(group, this.materials.white, row2X - 0.25, 0.85, pz, 0.35, 0.12, 0.15);
      addBox(group, this.materials.black, row2X - 0.95, 0.55, pz, 0.6, 1.1, 0.6);

      if (i === 0) {
        addBox(group, this.materials.neonCyan || this.materials.cloth, row2X - 0.95, 0.75, pz, 0.44, 0.65, 0.32);
        addCyl(group, this.materials.clay, row2X - 0.95, 1.25, pz, 0.14, 0.28);
      }

      colliders.push({ x: cx + row2X, z: cz + pz, halfX: 0.8, halfZ: 0.7, height: 1.4 });
    }

    const arcX = -4.5;
    const arcZ = 3.4;
    addBox(group, this.materials.bankBlue || this.materials.black, arcX, 1.0, arcZ, 1.0, 1.9, 0.9);
    addBox(group, cyanMat, arcX, 1.2, arcZ - 0.38, 0.7, 0.65, 0.08);
    colliders.push({ x: cx + arcX, z: cz + arcZ, halfX: 0.6, halfZ: 0.6, height: 2.0 });

    const cyberLight1 = new THREE.PointLight("#18d6e8", 2.2, 14, 1.2);
    cyberLight1.position.set(-2.5, height - 0.6, -1);
    group.add(cyberLight1);

    const cyberLight2 = new THREE.PointLight("#e8188e", 2.2, 14, 1.2);
    cyberLight2.position.set(2.5, height - 0.6, 1);
    group.add(cyberLight2);

    addBox(group, this.materials.wood, 0, 1.1, depth / 2 - 0.08, 1.4, 2.4, 0.1);

    colliders.push(
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
    );

    this.interiors.set("gaming-hub", {
      id: "gaming-hub",
      name: "Kano Cyber & PS5 Game Hub",
      districtLabel: "AIRPORT ROAD · GAMING HUB",
      root: group,
      colliders,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.8),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(80, 0, -40.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        const distConsole = pos.distanceTo(new THREE.Vector3(cx + row1X + 0.8, cy + 0.1, cz - 0.6));
        if (distConsole <= 2.2) {
          return {
            prompt: "Play Kano Street Drift Tournament (Ôéª1,000 Entry)",
            action: () => {
              if (state.cash < 1000) {
                return { statusMessage: "Insufficient cash: You need Ôéª1,000 for tournament entry fee." };
              }
              const score = Math.floor(7000 + Math.random() * 2800);
              const won = score >= 8200;
              if (won) {
                return {
                  statusMessage: `Championship Victory! Score: ${score.toLocaleString()} pts! Won 1st Place & Ôéª5,000 prize!`,
                  cashDelta: 4000,
                  scoreDelta: score,
                };
              }
              return {
                statusMessage: `Good Race! Score: ${score.toLocaleString()} pts. Finished in Top 5!`,
                cashDelta: -1000,
                scoreDelta: score,
              };
            },
          };
        }

        const distZainab = pos.distanceTo(new THREE.Vector3(cx + row2X - 0.95, cy + 0.1, cz - 2.2));
        if (distZainab <= 2.2) {
          return {
            prompt: "Chat with Zainab Bello (Esports Champion)",
            action: () => ({
              statusMessage: "Zainab Bello: 'Yo! You want to test your reflexes on the Kano Drift circuit? Let us see what you got!'",
              socialContactId: "zainab",
            }),
          };
        }

        const distRigBiz = pos.distanceTo(new THREE.Vector3(cx, cy + 0.1, cz - depth / 2 + 1.8));
        if (distRigBiz <= 2.2) {
          if (state.ownedBusinesses?.includes("cyber-hub-station")) {
            return {
              prompt: "PS5 Tournament Rig Station: Active Enterprise",
              action: () => ({
                statusMessage: "You own 2 commercial tournament PS5 stations at the Cyber Hub. Yields ~Ôéª18,000/day net profit.",
              }),
            };
          }
          return {
            prompt: "Acquire Dual PS5 Tournament Rig Station (Ôéª800,000)",
            action: () => {
              if (state.cash < 800000) {
                return { statusMessage: "Insufficient funds: Dual PS5 Tournament rig setup requires Ôéª800,000." };
              }
              return {
                statusMessage: "Tournament Rig stations acquired! Generating ~Ôéª18,000/day commercial esports revenue.",
                cashDelta: -800000,
                purchasedBusiness: "cyber-hub-station",
              };
            },
          };
        }

        return null;
      },
    });
  }

  // =========================================================================
  // 8. Arewa Royal Furniture & Electronics Showroom (Sabon Gari)
  // =========================================================================
  private buildFurnitureShowroomInterior() {
    const cx = 460;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const lights: THREE.PointLight[] = [];

    const width = 18.0;
    const depth = 14.0;
    const height = 4.2;

    // Polished Italian Ivory Porcelain Tile Flooring
    addBox(group, this.materials.white, 0, 0.05, 0, width, 0.1, depth, false);

    // Warm Sahelian Plaster Perimeter Walls with Dark Walnut Baseboard
    // North Back Wall
    addBox(group, this.materials.plaster, 0, height / 2, -depth / 2, width, height, 0.3);
    addBox(group, this.materials.darkTrim, 0, 0.25, -depth / 2 + 0.16, width, 0.4, 0.04);
    // South Front Wall with Double Entrance Door Opening
    addBox(group, this.materials.plaster, -width / 4 - 0.9, height / 2, depth / 2, width / 2 - 1.8, height, 0.3);
    addBox(group, this.materials.plaster, width / 4 + 0.9, height / 2, depth / 2, width / 2 - 1.8, height, 0.3);
    addBox(group, this.materials.plaster, 0, height - 0.6, depth / 2, 3.6, 1.2, 0.3);
    // West & East Side Walls
    addBox(group, this.materials.plaster, -width / 2, height / 2, 0, 0.3, height, depth);
    addBox(group, this.materials.plaster, width / 2, height / 2, 0, 0.3, height, depth);
    addBox(group, this.materials.darkTrim, -width / 2 + 0.16, 0.25, 0, 0.04, 0.4, depth);
    addBox(group, this.materials.darkTrim, width / 2 - 0.16, 0.25, 0, 0.04, 0.4, depth);

    // Modern Commercial Grid Ceiling with Track Downlights
    addBox(group, this.materials.roof, 0, height, 0, width, 0.2, depth, false);

    // Showroom Lighting Fixtures
    for (const lx of [-5, 0, 5]) {
      for (const lz of [-4, 0, 4]) {
        const light = new THREE.PointLight("#fff9eb", 1.8, 12);
        light.position.set(cx + lx, cy + height - 0.4, cz + lz);
        light.userData.baseIntensity = 1.8;
        this.root.add(light);
        lights.push(light);

        addBox(group, this.materials.metal, lx, height - 0.1, lz, 0.4, 0.1, 0.4);
      }
    }

    // Grand Showroom Signboard inside Entrance
    const insideSign = makeSignMaterial("AREWA ROYAL FURNITURE & ELECTRONICS SHOWROOM\nKANO COMMERCE · QUALITY GUARANTEE", "#0d2035");
    addBox(group, insideSign, 0, height - 0.8, -depth / 2 + 0.2, 11.5, 0.9, 0.06);

    // Entrance Runner Carpet
    addBox(group, this.materials.clothRed, 0, 0.1, 4.2, 3.0, 0.04, 5.0, false);

    // -----------------------------------------------------------------------
    // Zone 1: Executive Living Room Suite Vignette (West Side, x ~ -5.0)
    // -----------------------------------------------------------------------
    const z1x = -5.0;
    const z1z = 0;
    // Raised Teak Wood Stage
    addBox(group, this.materials.wood, z1x, 0.12, z1z, 6.2, 0.14, 5.8);
    // Acoustic Wood Slat Media Backdrop Wall
    for (let i = -2.8; i <= 2.8; i += 0.25) {
      addBox(group, this.materials.wood, z1x - 2.8, height / 2, z1z + i, 0.15, height - 0.2, 0.12);
    }
    // 75-inch 4K Smart TV on Media Wall
    addBox(group, this.materials.black, z1x - 2.65, 2.2, z1z, 0.08, 1.35, 2.4);
    addBox(group, this.materials.neonCyan || this.materials.glassLit, z1x - 2.6, 2.2, z1z, 0.04, 1.25, 2.25);
    // Media Console Table
    addBox(group, this.materials.darkTrim, z1x - 2.4, 0.55, z1z, 0.6, 0.65, 3.0);
    // Royal Sectional Sofa in Premium Navy Fabric
    addBox(group, this.materials.cloth, z1x + 0.6, 0.4, z1z - 0.8, 1.4, 0.45, 2.8);
    addBox(group, this.materials.cloth, z1x + 0.6, 0.85, z1z - 2.0, 1.4, 0.55, 0.4);
    addBox(group, this.materials.cloth, z1x - 0.6, 0.4, z1z + 0.8, 2.6, 0.45, 1.2);
    // Marble Top Center Table
    addBox(group, this.materials.white, z1x - 0.4, 0.35, z1z - 0.6, 1.2, 0.32, 1.6);
    // Brass Standing Floor Lamp
    addCyl(group, this.materials.goldTrim || this.materials.trim, z1x + 1.8, 1.3, z1z + 1.8, 0.04, 2.2);
    addCyl(group, this.materials.white, z1x + 1.8, 2.25, z1z + 1.8, 0.35, 0.4);

    // -----------------------------------------------------------------------
    // Zone 2: Northern Royal Master Bedroom Suite Vignette (North-West, x ~ -4.8, z ~ -4.5)
    // -----------------------------------------------------------------------
    const z2x = -4.8;
    const z2z = -4.5;
    // Plush Bedroom Area Rug
    addBox(group, this.materials.cloth, z2x, 0.12, z2z, 5.8, 0.06, 4.4, false);
    // King-Size Royal Bed Frame & Headboard
    addBox(group, this.materials.darkTrim, z2x, 0.45, z2z, 2.6, 0.55, 2.4);
    addBox(group, this.materials.white, z2x, 0.7, z2z, 2.4, 0.35, 2.2);
    addBox(group, this.materials.clothRed, z2x, 0.82, z2z - 0.2, 2.2, 0.12, 1.8);
    // Padded Royal Headboard with Gold Trim
    addBox(group, this.materials.clothRed, z2x, 1.4, z2z - 1.25, 2.7, 1.4, 0.2);
    addBox(group, this.materials.goldTrim || this.materials.trim, z2x, 1.4, z2z - 1.2, 2.8, 1.5, 0.05);
    // Matching Nightstands with Bedside Touch Lamps
    for (const sx of [-1.65, 1.65]) {
      addBox(group, this.materials.wood, z2x + sx, 0.4, z2z - 1.0, 0.65, 0.6, 0.6);
      addCyl(group, this.materials.goldTrim || this.materials.trim, z2x + sx, 0.8, z2z - 1.0, 0.08, 0.25);
      addBox(group, this.materials.white, z2x + sx, 1.0, z2z - 1.0, 0.25, 0.25, 0.25);
    }

    // -----------------------------------------------------------------------
    // Zone 3: Modern Smart Kitchen Suite Vignette (North-East, x ~ 4.8, z ~ -4.5)
    // -----------------------------------------------------------------------
    const z3x = 4.8;
    const z3z = -4.5;
    // Quartz Island Countertop
    addBox(group, this.materials.darkTrim, z3x, 0.55, z3z, 1.4, 0.88, 3.2);
    addBox(group, this.materials.white, z3x, 0.98, z3z, 1.6, 0.08, 3.4);
    // Bar Stools
    for (const bz of [-0.8, 0.8]) {
      addCyl(group, this.materials.metal, z3x - 1.1, 0.45, z3z + bz, 0.04, 0.7);
      addCyl(group, this.materials.wood, z3x - 1.1, 0.72, z3z + bz, 0.22, 0.08);
    }
    // Stainless Steel Double-Door Smart Refrigerator
    addBox(group, this.materials.metal, z3x + 2.8, 1.25, z3z - 1.2, 1.1, 2.1, 0.95);
    addBox(group, this.materials.black, z3x + 2.28, 1.35, z3z - 1.2, 0.04, 0.5, 0.35); // Touch panel
    // 4-Burner Gas Cooker with Range Hood
    addBox(group, this.materials.darkTrim, z3x + 2.8, 0.55, z3z + 0.8, 1.0, 0.88, 1.0);
    addBox(group, this.materials.metal, z3x + 2.8, 1.9, z3z + 0.8, 0.9, 0.4, 0.9);

    // -----------------------------------------------------------------------
    // Zone 4: Executive Study & High-End Gaming Rig (East Side, x ~ 5.2, z ~ 0)
    // -----------------------------------------------------------------------
    const z4x = 5.2;
    const z4z = 0;
    // Walnut Executive Desk
    addBox(group, this.materials.wood, z4x, 0.45, z4z, 1.2, 0.74, 2.4);
    // Dual Curved Ultrawide Displays
    addBox(group, this.materials.black, z4x - 0.1, 1.15, z4z - 0.55, 0.12, 0.45, 0.95);
    addBox(group, this.materials.black, z4x - 0.1, 1.15, z4z + 0.55, 0.12, 0.45, 0.95);
    addBox(group, this.materials.neonCyan || this.materials.glassLit, z4x - 0.15, 1.15, z4z - 0.55, 0.04, 0.4, 0.9);
    addBox(group, this.materials.neonCyan || this.materials.glassLit, z4x - 0.15, 1.15, z4z + 0.55, 0.04, 0.4, 0.9);
    // RGB Liquid-Cooled Gaming Tower
    addBox(group, this.materials.black, z4x + 0.25, 1.1, z4z + 0.95, 0.3, 0.55, 0.55);
    addBox(group, this.materials.neonCyan || this.materials.glassLit, z4x + 0.1, 1.1, z4z + 0.95, 0.04, 0.45, 0.45);
    // High-Back Ergonomic Office Chair
    addBox(group, this.materials.darkTrim, z4x - 0.7, 0.5, z4z, 0.65, 0.45, 0.65);
    addBox(group, this.materials.cloth, z4x - 0.95, 0.95, z4z, 0.18, 0.7, 0.6);

    // -----------------------------------------------------------------------
    // Zone 5: Central Customer Reception Desk & Musa Dan-Ladi NPC (x = 0, z = 2.0)
    // -----------------------------------------------------------------------
    const counterX = 0;
    const counterZ = 2.0;
    // Curved Front Counter
    addBox(group, this.materials.darkTrim, counterX, 0.55, counterZ, 3.4, 0.95, 1.1);
    addBox(group, this.materials.white, counterX, 1.02, counterZ, 3.6, 0.08, 1.25);
    // POS Terminal, Receipt Machine & Catalogue Stand
    addBox(group, this.materials.black, counterX - 0.8, 1.12, counterZ - 0.1, 0.28, 0.12, 0.35);
    addBox(group, this.materials.metal, counterX + 0.8, 1.18, counterZ - 0.1, 0.45, 0.25, 0.35);
    const counterSign = makeSignMaterial("CUSTOMER SERVICE & ORDERS", "#0d2035");
    addBox(group, counterSign, counterX, 0.55, counterZ + 0.64, 2.6, 0.4, 0.06);

    // 3D Sales Consultant NPC: Musa Dan-Ladi
    const musa = new THREE.Group();
    musa.position.set(counterX, 0, counterZ - 0.8);
    musa.rotation.y = 0; // facing south toward player approaching the desk
    group.add(musa);
    // Legs in dark trousers
    addBox(musa, this.materials.darkTrim, -0.16, 0.45, 0, 0.18, 0.85, 0.2);
    addBox(musa, this.materials.darkTrim, 0.16, 0.45, 0, 0.18, 0.85, 0.2);
    // Crisp Royal Blue Embroidered Kaftan
    addBox(musa, this.materials.bankBlue || this.materials.cloth, 0, 1.15, 0, 0.54, 0.75, 0.32);
    // Gold embroidery trim down kaftan center
    addBox(musa, this.materials.goldTrim || this.materials.trim, 0, 1.15, 0.17, 0.06, 0.65, 0.04);
    // Hands & arms resting gracefully on counter
    addBox(musa, this.materials.bankBlue || this.materials.cloth, -0.32, 1.1, 0.15, 0.14, 0.55, 0.16);
    addBox(musa, this.materials.bankBlue || this.materials.cloth, 0.32, 1.1, 0.15, 0.14, 0.55, 0.16);
    // Realistic skin head & warm expression
    const skinMat = new THREE.MeshStandardMaterial({ color: "#543722", roughness: 0.8 });
    addBox(musa, skinMat, 0, 1.62, 0, 0.24, 0.26, 0.24);
    // Northern Fula Cap (embroidered traditional cap)
    addBox(musa, this.materials.white, 0, 1.78, 0, 0.25, 0.12, 0.25);
    addBox(musa, this.materials.goldTrim || this.materials.trim, 0, 1.74, 0.13, 0.26, 0.04, 0.02);

    // Double Glass Entrance/Exit Doors
    this.addInteractiveDoor(
      group,
      "furniture-showroom",
      "showroom-exit-left",
      "Showroom Main Entrance (Left)",
      -0.8,
      0,
      depth / 2 - 0.1,
      1.4,
      2.6,
      0.08,
      this.materials.glassLit || this.materials.glass,
      cx,
      cz,
      false,
      colliders,
    );
    this.addInteractiveDoor(
      group,
      "furniture-showroom",
      "showroom-exit-right",
      "Showroom Main Entrance (Right)",
      0.8,
      0,
      depth / 2 - 0.1,
      1.4,
      2.6,
      0.08,
      this.materials.glassLit || this.materials.glass,
      cx,
      cz,
      true,
      colliders,
    );

    // Colliders
    colliders.push(
      // Perimeter walls
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.4, height },
      { x: cx - width / 4 - 0.9, z: cz + depth / 2, halfX: width / 4 - 0.8, halfZ: 0.4, height },
      { x: cx + width / 4 + 0.9, z: cz + depth / 2, halfX: width / 4 - 0.8, halfZ: 0.4, height },
      { x: cx - width / 2, z: cz, halfX: 0.4, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.4, halfZ: depth / 2, height },
      // Counter & Musa
      { x: cx + counterX, z: cz + counterZ, halfX: 1.9, halfZ: 0.8, height: 1.5 },
      // Vignette colliders
      { x: cx + z1x, z: cz + z1z, halfX: 3.1, halfZ: 2.9, height: 2.5 },
      { x: cx + z2x, z: cz + z2z, halfX: 2.9, halfZ: 2.2, height: 2.5 },
      { x: cx + z3x, z: cz + z3z, halfX: 2.8, halfZ: 2.2, height: 2.5 },
      { x: cx + z4x, z: cz + z4z, halfX: 2.8, halfZ: 2.2, height: 2.5 },
    );

    this.interiors.set("furniture-showroom", {
      id: "furniture-showroom",
      name: "Arewa Royal Furniture & Electronics Showroom",
      districtLabel: "SABON GARI · FURNITURE SHOWROOM",
      root: group,
      colliders,
      lights,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + 4.8),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + 5.9),
      outdoorDoorPosition: new THREE.Vector3(-22, 0, 16.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos) => {
        // Distance to Musa Dan-Ladi at the customer service counter
        const distCounter = pos.distanceTo(new THREE.Vector3(cx + counterX, cy + 0.1, cz + counterZ + 0.9));
        if (distCounter <= 2.6) {
          return {
            prompt: "Browse Furniture Catalogue (Musa Dan-Ladi)",
            action: () => ({
              statusMessage: "Musa Dan-Ladi: 'Sannu da zuwa! Browse our royal furniture catalogue to upgrade your Kano home.'",
              openFurnitureShop: true,
            }),
          };
        }

        // Living Room Vignette Inspection
        const distZ1 = pos.distanceTo(new THREE.Vector3(cx + z1x, cy + 0.1, cz + z1z));
        if (distZ1 <= 3.2) {
          return {
            prompt: "Inspect Living Room Showcase Suite",
            action: () => ({
              statusMessage: "Showroom: 'Arewa Executive Salon Suite — handcrafted fabric armchairs, 75-inch 4K TV, and marble center tables.'",
            }),
          };
        }

        // Bedroom Vignette Inspection
        const distZ2 = pos.distanceTo(new THREE.Vector3(cx + z2x, cy + 0.1, cz + z2z));
        if (distZ2 <= 3.0) {
          return {
            prompt: "Inspect Northern Royal Bedroom Suite",
            action: () => ({
              statusMessage: "Showroom: 'Emirate Luxury King Bed Suite — carved wooden posts, gold damask pillows, and mirrored wardrobes.'",
            }),
          };
        }

        // Kitchen Vignette Inspection
        const distZ3 = pos.distanceTo(new THREE.Vector3(cx + z3x, cy + 0.1, cz + z3z));
        if (distZ3 <= 3.0) {
          return {
            prompt: "Inspect Modern Smart Kitchen Appliances",
            action: () => ({
              statusMessage: "Showroom: 'Sahelian Stainless Steel Appliances — double-door inverter refrigerators, 4-burner cookers, and quartz islands.'",
            }),
          };
        }

        // Study Vignette Inspection
        const distZ4 = pos.distanceTo(new THREE.Vector3(cx + z4x, cy + 0.1, cz + z4z));
        if (distZ4 <= 3.0) {
          return {
            prompt: "Inspect Executive Workstation & Gaming Rig",
            action: () => ({
              statusMessage: "Showroom: 'High-Performance Workstation — dual curved monitors, liquid-cooled RGB PC tower, and ergonomic mesh seating.'",
            }),
          };
        }

        return null;
      },
    });
  }

  public updatePlacedFurniture(interiorId: InteriorId, instances: FurnitureInstance[]) {
    const zone = this.interiors.get(interiorId);
    if (!zone) return;

    let group = this.placedFurnitureGroups.get(interiorId);
    if (!group) {
      group = new THREE.Group();
      group.name = `placed-furniture-${interiorId}`;
      zone.root.add(group);
      this.placedFurnitureGroups.set(interiorId, group);
    }

    // Clear existing children in the furniture group
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // Remove old furniture colliders from zone
    zone.colliders = zone.colliders.filter((c) => !(c as any).isFurniture);

    // Clear placed items for this interior
    for (const [id] of this.placedFurnitureItems.entries()) {
      if (instances.every((inst) => inst.instanceId !== id)) {
        this.placedFurnitureItems.delete(id);
      }
    }

    // Build and add 3D meshes and colliders
    const cx = zone.root.position.x;
    const cz = zone.root.position.z;

    instances.forEach((instance) => {
      const rendered = buildFurnitureMesh(instance, this.materials, cx, cz);
      group.add(rendered.group);
      rendered.colliders.forEach((c) => {
        (c as any).isFurniture = true;
        (c as any).furnitureInstanceId = instance.instanceId;
        zone.colliders.push(c);
      });
      this.placedFurnitureItems.set(instance.instanceId, rendered);
    });
  }

  public getFurnitureInteraction(playerPos: THREE.Vector3): {
    prompt: string;
    action: () => {
      statusMessage: string;
      cashDelta?: number;
      timeDeltaMinutes?: number;
      scoreDelta?: number;
    };
  } | null {
    if (!this.activeInterior) return null;
    const zone = this.interiors.get(this.activeInterior);
    if (!zone) return null;

    let closest: {
      dist: number;
      interaction: NonNullable<RenderedFurnitureResult["interaction"]>;
    } | null = null;

    for (const item of this.placedFurnitureItems.values()) {
      if (!item.interaction) continue;
      const itemWorldPos = new THREE.Vector3();
      item.group.getWorldPosition(itemWorldPos);
      const dist = playerPos.distanceTo(itemWorldPos);
      if (dist <= 2.4 && (!closest || dist < closest.dist)) {
        closest = { dist, interaction: item.interaction };
      }
    }

    return closest ? closest.interaction : null;
  }

  public getActiveZone(): InteriorZone | null {
    if (!this.activeInterior) return null;
    return this.interiors.get(this.activeInterior) ?? null;
  }
}
