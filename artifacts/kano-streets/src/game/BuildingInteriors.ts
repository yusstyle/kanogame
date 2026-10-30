import * as THREE from "three";
import { makeSignMaterial } from "./materials";
import type { Collider, GameMaterials, InteriorId, PropertyId, BusinessId, FurnitureInstance } from "./types";
import { PROPERTY_REGISTRY } from "./propertyRegistry";
import { buildFurnitureMesh, type RenderedFurnitureResult } from "./furnitureRenderer";
import { loadGLTFModel } from "./assetManifest";

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
  if (h <= 2.2 && w < 4.0 && d < 4.0) {
    mesh.userData.isFurniture = true;
  }
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
  if (h <= 2.2) {
    mesh.userData.isFurniture = true;
  }
  parent.add(mesh);
  return mesh;
}

function fitModelToBounds(
  model: THREE.Group,
  targetWidth: number,
  targetDepth: number,
  targetHeight: number,
  targetCenterX: number,
  targetCenterZ: number,
  groundY = 0,
  rotY = 0,
) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, rotY, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);

  const bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());

  if (size.x > 0.001 && size.y > 0.001 && size.z > 0.001) {
    const scale = Math.min(
      targetWidth / size.x,
      targetDepth / size.z,
      targetHeight / size.y,
    );
    model.scale.set(scale, scale, scale);
    model.updateMatrixWorld(true);

    const scaledBbox = new THREE.Box3().setFromObject(model);
    const scaledCenter = scaledBbox.getCenter(new THREE.Vector3());

    model.position.x = targetCenterX - scaledCenter.x;
    model.position.y = groundY - scaledBbox.min.y;
    model.position.z = targetCenterZ - scaledCenter.z;
    model.updateMatrixWorld(true);
  }
}

function addCeiling(
  parent: THREE.Object3D,
  material: THREE.Material,
  y: number,
  w: number,
  d: number,
) {
  const geo = new THREE.PlaneGeometry(w, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "ceiling";
  mesh.position.set(0, y, 0);
  mesh.rotation.x = Math.PI / 2; // Downward facing normal (-Y) into room; culls from above for cutaway
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addPerimeterWall(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rotY: number,
) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "perimeter_wall";
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY; // Normal points inward into room; culls from behind for architectural cutaway
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addDoorCasing(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rotY = 0,
  casingW = 0.08,
  casingD = 0.05,
) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  // Left jamb
  addBox(group, material, -w / 2 - casingW / 2, h / 2, 0, casingW, h, casingD, false);
  // Right jamb
  addBox(group, material, w / 2 + casingW / 2, h / 2, 0, casingW, h, casingD, false);
  // Top header casing
  addBox(group, material, 0, h + casingW / 2, 0, w + casingW * 2, casingW, casingD, false);

  parent.add(group);
  return group;
}

function addArchitecturalCurtains(
  parent: THREE.Object3D,
  rodMat: THREE.Material,
  fabricMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rotY = 0,
) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  // Ceiling curtain track / rod
  addBox(group, rodMat, 0, h + 0.05, 0, w + 0.5, 0.04, 0.06, false);

  // Left drapery panel (layered pleats)
  const panelW = 0.65;
  const leftX = -w / 2 + panelW / 2;
  const pleatCount = 4;
  for (let i = 0; i < pleatCount; i++) {
    const px = leftX - panelW / 2 + (i + 0.5) * (panelW / pleatCount);
    const pz = i % 2 === 0 ? 0.03 : -0.02;
    addBox(group, fabricMat, px, h / 2, pz, (panelW / pleatCount) * 0.95, h, 0.08, false);
  }

  // Right drapery panel (layered pleats)
  const rightX = w / 2 - panelW / 2;
  for (let i = 0; i < pleatCount; i++) {
    const px = rightX - panelW / 2 + (i + 0.5) * (panelW / pleatCount);
    const pz = i % 2 === 0 ? 0.03 : -0.02;
    addBox(group, fabricMat, px, h / 2, pz, (panelW / pleatCount) * 0.95, h, 0.08, false);
  }

  parent.add(group);
  return group;
}

function addPowerOutlet(
  parent: THREE.Object3D,
  faceplateMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rotY = 0,
) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  // Faceplate
  addBox(group, faceplateMat, 0, 0, 0, 0.14, 0.14, 0.015, false);

  parent.add(group);
  return group;
}

function addWallArtwork(
  parent: THREE.Object3D,
  frameMat: THREE.Material,
  canvasMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rotY = 0,
) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  // Outer frame
  addBox(group, frameMat, 0, 0, 0, w, h, 0.04, false);
  // Recessed canvas / artwork
  addBox(group, canvasMat, 0, 0, 0.015, w - 0.08, h - 0.08, 0.02, false);

  parent.add(group);
  return group;
}

function addPottedPlant(
  parent: THREE.Object3D,
  potMat: THREE.Material,
  standMat: THREE.Material,
  foliageMat: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Wooden tripod stand legs
  for (let a = 0; a < 3; a++) {
    const angle = (a * Math.PI * 2) / 3;
    const lx = Math.cos(angle) * 0.22;
    const lz = Math.sin(angle) * 0.22;
    addCyl(group, standMat, lx, 0.18, lz, 0.02, 0.36);
  }

  // Cylindrical Ceramic Pot
  addCyl(group, potMat, 0, 0.52, 0, 0.24, 0.42);

  // Foliage Stems & Broad Leaves
  addCyl(group, standMat, 0, 0.85, 0, 0.03, 0.4);
  const leafAngles = [0, 1.3, 2.5, 3.8, 5.0];
  leafAngles.forEach((ang, idx) => {
    const lx = Math.cos(ang) * 0.26;
    const lz = Math.sin(ang) * 0.26;
    const ly = 0.88 + idx * 0.12;
    addBox(group, foliageMat, lx, ly, lz, 0.22, 0.35, 0.04);
  });

  parent.add(group);
  return group;
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

export interface InteriorBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
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
  height?: number;
  bounds?: InteriorBounds;
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
      eatFood?: { amount: number; label: string };
      sleepInBed?: { hours: number };
      takeShower?: { label: string };
      freelanceContractAction?: boolean;
      sitDown?: { label: string; energyRestored?: number };
      watchTv?: { label: string; energyRestored?: number };
      washHands?: { label: string };
      drinkBeverage?: { label: string; hungerGain?: number; energyGain?: number };
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

    // Architectural lever handle with backplate rosette on both sides
    const handleMat = this.materials.metal || this.materials.goldTrim || this.materials.trim;
    const handleGroup = new THREE.Group();
    handleGroup.position.set(w - 0.12, h * 0.5, 0);
    addBox(handleGroup, handleMat, 0, 0, 0, 0.06, 0.16, d + 0.02, false);
    addBox(handleGroup, handleMat, -0.06, 0.03, d / 2 + 0.04, 0.12, 0.025, 0.03, false);
    addBox(handleGroup, handleMat, -0.06, 0.03, -d / 2 - 0.04, 0.12, 0.025, 0.03, false);
    pivot.add(handleGroup);

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

  public getZone(zoneId: InteriorId): InteriorZone | undefined {
    return this.interiors.get(zoneId);
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
    const wallMat = this.materials.interiorWall || this.materials.white;
    const woodMat = this.materials.wood;
    const glassMat = this.materials.glassLit || this.materials.glass;
    const metalMat = this.materials.metal;
    const darkMat = this.materials.darkTrim;
    const whiteMat = this.materials.white;
    const blackMat = this.materials.black;
    const cyanMat = this.materials.neonCyan || this.materials.glassLit;
    const goldMat = this.materials.goldTrim || this.materials.trim;

    // 1. Floor & Ceiling Slabs
    addBox(group, floorMat, 0, 0, 0, width, 0.1, depth, false);
    addCeiling(group, this.materials.ceilingMat || wallMat, height, width, depth);

    // 2. Perimeter Cutaway Walls (Single-sided inward-facing planes with walnut baseboards)
    addPerimeterWall(group, wallMat, 0, height / 2, -depth / 2, width, height, 0); // North Wall
    addPerimeterWall(group, wallMat, 0, height / 2, depth / 2, width, height, Math.PI);  // South Wall (Front)
    addPerimeterWall(group, wallMat, -width / 2, height / 2, 0, depth, height, Math.PI / 2); // West Wall
    addPerimeterWall(group, wallMat, width / 2, height / 2, 0, depth, height, -Math.PI / 2);  // East Wall
    // Baseboards for crisp floor/wall definition
    addBox(group, darkMat, 0, 0.08, -depth / 2 + 0.04, width, 0.16, 0.04, false);
    addBox(group, darkMat, 0, 0.08, depth / 2 - 0.04, width, 0.16, 0.04, false);
    addBox(group, darkMat, -width / 2 + 0.04, 0.08, 0, 0.04, 0.16, depth, false);
    addBox(group, darkMat, width / 2 - 0.04, 0.08, 0, 0.04, 0.16, depth, false);

    // Partition wall baseboards
    addBox(group, darkMat, 0.8, 0.08, -4.5, 0.24, 0.16, 7.0, false);

    // 3. Front Shaded Veranda & Reception Zaure (z: 5.5 to 9.0)
    addBox(group, this.materials.ochre, 0, 0.08, 7.2, 8.0, 0.16, 3.6, false);
    // Sculpted Clay Seating Dakali Benches on Veranda
    addBox(group, this.materials.clay, -3.2, 0.45, 7.2, 1.2, 0.7, 3.2);
    addBox(group, this.materials.clay, 3.2, 0.45, 7.2, 1.2, 0.7, 3.2);
    colliders.push(
      { x: cx - 3.2, z: cz + 7.2, halfX: 0.6, halfZ: 1.6, height: 0.8 },
      { x: cx + 3.2, z: cz + 7.2, halfX: 0.6, halfZ: 1.6, height: 0.8 },
    );

    // Double Mahogany Entrance Doors with casing & wrought iron hardware
    addDoorCasing(group, darkMat, 0, 0, depth / 2 - 0.08, 2.6, 2.4, 0);
    addBox(group, woodMat, -0.7, 1.2, depth / 2 - 0.08, 1.2, 2.4, 0.12);
    addBox(group, woodMat, 0.7, 1.2, depth / 2 - 0.08, 1.2, 2.4, 0.12);
    addBox(group, metalMat, -0.15, 1.2, depth / 2 - 0.02, 0.08, 0.25, 0.04, false);
    addBox(group, metalMat, 0.15, 1.2, depth / 2 - 0.02, 0.08, 0.25, 0.04, false);
    // Illuminated Exit Sign above door
    const exitSignMat = makeSignMaterial("EXIT TO RESIDENTIAL QUARTER", "#065f46");
    addBox(group, exitSignMat, 0, 2.65, depth / 2 - 0.08, 1.8, 0.4, 0.06);

    // 4. Grand Family Parlour (Palour) (x: -9.5 to 0.5, z: -1.0 to 5.5)
    // Rich Traditional Northern Patterned Area Carpet (replaces giant flat red slab)
    addBox(group, this.materials.patternedRug || this.materials.cloth, -4.2, 0.02, 2.2, 5.8, 0.02, 4.4, false);
    // 8-Seater Northern Modular Sectional Sofa Set with layered contoured cushions
    addBox(group, darkMat, -4.2, 0.20, 4.4, 6.2, 0.14, 1.1); // Plinth
    addBox(group, this.materials.cloth, -4.2, 0.42, 4.4, 6.0, 0.32, 1.05); // Seat
    addBox(group, this.materials.cloth, -4.2, 0.78, 4.8, 6.0, 0.45, 0.25); // Back
    addBox(group, darkMat, -7.5, 0.20, 2.2, 1.1, 0.14, 5.0);
    addBox(group, this.materials.cloth, -7.5, 0.42, 2.2, 1.05, 0.32, 4.8);
    addBox(group, this.materials.cloth, -7.9, 0.78, 2.2, 0.25, 0.45, 4.8);
    addBox(group, darkMat, -0.9, 0.20, 2.2, 1.1, 0.14, 3.4);
    addBox(group, this.materials.cloth, -0.9, 0.42, 2.2, 1.05, 0.32, 3.2);
    // Scatter cushions
    addBox(group, this.materials.clothRed, -5.5, 0.65, 4.2, 0.45, 0.35, 0.15);
    addBox(group, goldMat, -2.8, 0.65, 4.2, 0.45, 0.35, 0.15);
    addBox(group, goldMat, -7.4, 0.65, 3.6, 0.15, 0.35, 0.45);
    // Carved mahogany coffee table with brass filigree trays & marble inlay
    addBox(group, darkMat, -4.2, 0.18, 2.2, 2.2, 0.10, 1.2); // Frame
    addBox(group, this.materials.marbleWhite || woodMat, -4.2, 0.36, 2.2, 2.4, 0.06, 1.4);
    addBox(group, goldMat, -4.2, 0.42, 2.2, 0.8, 0.04, 0.6); // Brass filigree tray
    // Brass Kano Ornamental Urns & Water Pots
    addCyl(group, goldMat, -7.6, 0.55, 5.0, 0.35, 1.1);
    addCyl(group, goldMat, -0.8, 0.55, 5.0, 0.35, 1.1);

    // Potted plant in parlour
    addPottedPlant(group, whiteMat, woodMat, this.materials.foliage, -8.6, 0, 5.0);

    // 75-inch Flat Screen Media Wall & Credenza (West Wall)
    addBox(group, darkMat, -9.6, 0.5, 2.2, 0.6, 0.65, 4.6);
    addBox(group, blackMat, -9.7, 1.8, 2.2, 0.1, 1.6, 3.0);
    addBox(group, cyanMat, -9.64, 1.8, 2.2, 0.02, 1.45, 2.8); // QLED Screen glow
    addBox(group, goldMat, -9.6, 1.8, 0.6, 0.06, 1.7, 0.06);  // Brass corner trim
    addBox(group, goldMat, -9.6, 1.8, 3.8, 0.06, 1.7, 0.06);
    addPowerOutlet(group, whiteMat, -9.4, 0.65, 0.8, Math.PI / 2);

    // Wall Switch for Parlour Chandelier
    addBox(group, whiteMat, -0.5, 1.4, 4.5, 0.1, 0.14, 0.04);
    addBox(group, darkMat, -0.5, 1.4, 4.47, 0.03, 0.05, 0.02, false);

    // 5. Formal Dining Room (x: 1.0 to 9.5, z: 0.5 to 5.5)
    // Partition Wall between Parlour and Dining with Arched Passage
    addBox(group, wallMat, 0.8, height / 2, 4.0, 0.2, height, 3.0);
    addBox(group, wallMat, 0.8, height / 2, 1.0, 0.2, height, 1.0);
    addBox(group, wallMat, 0.8, 3.2, 2.5, 0.2, 1.6, 2.0); // Arch lintel
    // 8-Seater Solid Mahogany Dining Table & Chairs
    addBox(group, darkMat, 5.2, 0.72, 2.8, 3.4, 0.06, 1.6); // Table apron
    addBox(group, woodMat, 5.2, 0.78, 2.8, 3.6, 0.08, 1.8); // Top
    for (const dx of [-1.3, 0, 1.3]) {
      addBox(group, this.materials.cloth, 5.2 + dx, 0.48, 1.5, 0.45, 0.08, 0.45);
      addBox(group, darkMat, 5.2 + dx, 0.75, 1.25, 0.45, 0.45, 0.04);
      addBox(group, this.materials.cloth, 5.2 + dx, 0.48, 4.1, 0.45, 0.08, 0.45);
      addBox(group, darkMat, 5.2 + dx, 0.75, 4.35, 0.45, 0.45, 0.04);
    }
    // Sideboard buffet credenza with brass serving dishes
    addBox(group, woodMat, 8.8, 0.5, 2.8, 0.6, 0.9, 3.2);
    addBox(group, goldMat, 8.8, 1.02, 2.8, 0.4, 0.12, 1.4); // Serving platters

    // 6. Executive Family Kitchen & Store (x: 1.0 to 9.5, z: -5.0 to 0.5)
    // Kitchen Partition Wall with Doorway
    addBox(group, wallMat, 5.2, height / 2, 0.5, 9.5, height, 0.2);
    // L-Shaped Kitchen Counter & Cabinets with recessed toe kick
    addBox(group, darkMat, 6.8, 0.05, -2.5, 1.1, 0.10, 4.0); // Toe kick
    addBox(group, this.materials.white, 6.8, 0.52, -2.5, 1.2, 0.85, 4.2);
    addBox(group, darkMat, 6.8, 0.98, -2.5, 1.3, 0.08, 4.4); // Granite top
    // Double stainless sink & swivel tap
    addBox(group, metalMat, 6.8, 0.99, -1.5, 0.8, 0.02, 1.2);
    addCyl(group, metalMat, 7.2, 1.28, -1.5, 0.04, 0.32);
    // 4-Burner gas cooker & range hood
    addBox(group, darkMat, 6.8, 0.95, -3.6, 1.1, 0.95, 0.85);
    addBox(group, blackMat, 6.8, 1.02, -3.6, 0.85, 0.04, 0.75);
    addBox(group, metalMat, 6.8, 2.4, -3.6, 0.9, 0.5, 0.7); // Extractor hood
    // Upper wall cabinets
    addBox(group, woodMat, 7.2, 2.3, -2.0, 0.6, 0.85, 2.5);
    // French-Door Stainless Refrigerator with vertical tubular handles
    addBox(group, darkMat, 8.8, 0.04, -4.2, 1.1, 0.08, 1.0); // Kickplate
    addBox(group, metalMat, 8.8, 1.25, -4.2, 1.2, 2.3, 1.1);
    addBox(group, darkMat, 8.15, 1.4, -4.4, 0.03, 0.8, 0.03); // Handles
    addBox(group, darkMat, 8.15, 1.4, -4.0, 0.03, 0.8, 0.03);
    addPowerOutlet(group, whiteMat, 7.5, 1.25, 0.35, 0);

    // 7. Central Corridor Wall (z: -1.0 to -8.5)
    addBox(group, wallMat, 0.8, height / 2, -4.5, 0.2, height, 7.0);

    // 8. Dakin Karatu (Private Study & Prayer Room) (x: -9.5 to -4.0, z: -1.0 to -4.5)
    addBox(group, wallMat, -4.0, height / 2, -1.0, 10.0, height, 0.2);
    addBox(group, wallMat, -4.0, height / 2, -4.5, 10.0, height, 0.2);
    addDoorCasing(group, darkMat, -4.0, 0, -1.0, 1.1, 2.4, Math.PI / 2);
    // Authentic Kano Prayer Carpets
    addBox(group, this.materials.carpetRed || this.materials.cloth, -6.5, 0.05, -2.0, 3.6, 0.02, 1.8, false);
    // Polished Mahogany Study Desk & Chair
    addBox(group, woodMat, -6.5, 0.75, -3.4, 2.0, 0.08, 0.9);
    addBox(group, darkMat, -6.5, 0.88, -3.6, 0.2, 0.18, 0.15); // Stand
    addBox(group, cyanMat, -6.5, 1.18, -3.6, 0.85, 0.5, 0.04); // Monitor glow
    addBox(group, blackMat, -6.5, 0.8, -3.2, 0.5, 0.02, 0.2);  // Keyboard
    addBox(group, darkMat, -6.5, 0.48, -2.7, 0.55, 0.55, 0.55); // Chair
    // Floor-to-ceiling carved cedar bookshelves
    addBox(group, woodMat, -9.6, 1.8, -2.8, 0.6, 3.2, 3.0);

    // 9. Master Bedroom Suite & Ensuite Bath (x: -9.5 to 0.5, z: -4.5 to -8.5)
    addDoorCasing(group, darkMat, -4.0, 0, -4.5, 1.1, 2.4, Math.PI / 2);
    // King-Size Bed with Carved Hardwood Headboard & Fluting
    addBox(group, darkMat, -5.5, 0.22, -6.5, 2.6, 0.14, 2.8); // Plinth
    addBox(group, whiteMat, -5.5, 0.50, -6.5, 2.4, 0.28, 2.6); // Deep mattress
    addBox(group, this.materials.cloth, -5.5, 0.68, -6.0, 2.4, 0.14, 1.6); // Coverlet
    addBox(group, this.materials.clothRed, -5.5, 0.70, -5.4, 2.4, 0.06, 0.45); // Runner
    addBox(group, darkMat, -5.5, 1.4, -7.85, 2.8, 1.4, 0.15); // Headboard
    addBox(group, this.materials.cloth, -5.5, 1.4, -7.78, 2.6, 1.2, 0.05); // Padded insert
    addWallArtwork(group, darkMat, this.materials.clothRed, -5.5, 2.6, -7.86, 2.0, 0.9, 0);
    // Twin Nightstands & Lamps
    addBox(group, woodMat, -7.4, 0.4, -6.5, 0.6, 0.65, 0.5);
    addBox(group, woodMat, -3.6, 0.4, -6.5, 0.6, 0.65, 0.5);
    addBox(group, goldMat, -7.4, 0.85, -6.5, 0.25, 0.35, 0.25);
    addBox(group, goldMat, -3.6, 0.85, -6.5, 0.25, 0.35, 0.25);
    // 3-Door Wardrobe with Full-Length Mirror
    addBox(group, woodMat, -8.8, 1.5, -6.5, 0.65, 2.8, 2.2);
    addBox(group, glassMat, -8.45, 1.5, -6.5, 0.04, 2.6, 1.0);
    // Ensuite Bath Partition (x: -2.0 to 0.5, z: -5.5 to -8.5)
    addBox(group, wallMat, -2.0, height / 2, -6.5, 0.2, height, 4.0);
    // Bathtub & Shower
    addBox(group, whiteMat, -0.8, 0.45, -7.2, 1.4, 0.6, 1.8);
    addBox(group, metalMat, -0.8, 1.25, -7.8, 0.1, 0.4, 0.2); // Faucet & Shower
    // Ceramic Toilet & Cistern
    addBox(group, whiteMat, -0.8, 0.42, -5.8, 0.5, 0.42, 0.65);
    addBox(group, whiteMat, -0.8, 0.85, -5.55, 0.55, 0.5, 0.25);
    // Vanity Basin & Mirror
    addBox(group, whiteMat, -1.8, 0.85, -6.5, 0.5, 0.85, 1.0);
    addBox(group, glassMat, -1.95, 1.65, -6.5, 0.04, 0.8, 0.8);

    // 10. Children / Guest Bedroom (x: 1.0 to 5.0, z: -4.5 to -8.5)
    addBox(group, wallMat, 5.0, height / 2, -6.5, 0.2, height, 4.0);
    addBox(group, woodMat, 3.0, 0.42, -6.5, 1.8, 0.45, 2.2); // Twin bed
    addBox(group, whiteMat, 3.0, 0.68, -6.5, 1.7, 0.22, 2.1);
    addBox(group, woodMat, 4.5, 1.2, -6.5, 0.5, 2.2, 1.4);  // Wardrobe

    // 11. Rear Compound Utility Yard & 25kVA Generator House (z: -8.8 to -12.0)
    // Soundproof 25kVA Lister-Petter Diesel Generator
    addBox(group, metalMat, 5.5, 0.9, -8.5, 2.4, 1.5, 1.6);
    addBox(group, darkMat, 5.5, 1.7, -8.5, 2.5, 0.12, 1.7); // Generator cover
    addCyl(group, blackMat, 4.5, 1.9, -8.5, 0.08, 0.7);      // Exhaust pipe
    // Control dials on generator
    addBox(group, whiteMat, 4.25, 1.1, -8.5, 0.04, 0.4, 0.6);
    // Automatic Borehole Pressure Tank
    addCyl(group, this.materials.bankBlue || metalMat, 7.8, 1.2, -8.5, 0.5, 2.2);

    // Interactive Doors
    this.addInteractiveDoor(group, "house", "villa_master_door", "Master Bedroom Door", -4.0, 0, -4.5, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "house", "villa_study_door", "Dakin Karatu Door", -4.0, 0, -1.0, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "house", "villa_rear_yard_door", "Rear Compound Yard Door", 0.8, 0, -8.8, 1.2, 2.4, 0.1, woodMat, cx, cz, true, colliders);

    // Multi-Room Atmospheric Point Lights
    const parlourLight = new THREE.PointLight("#fff2da", 3.2, 24, 1.05);
    parlourLight.position.set(-4.2, height - 0.5, 2.2);
    parlourLight.userData.baseIntensity = 3.2;
    group.add(parlourLight);
    lights.push(parlourLight);

    const masterLight = new THREE.PointLight("#ffe5c4", 2.5, 20, 1.05);
    masterLight.position.set(-5.5, height - 0.5, -6.5);
    masterLight.userData.baseIntensity = 2.5;
    group.add(masterLight);
    lights.push(masterLight);

    const diningLight = new THREE.PointLight("#fff6ea", 2.6, 20, 1.05);
    diningLight.position.set(5.2, height - 0.5, 2.8);
    diningLight.userData.baseIntensity = 2.6;
    group.add(diningLight);
    lights.push(diningLight);

    const studyLight = new THREE.PointLight("#fff0e0", 2.4, 18, 1.05);
    studyLight.position.set(-6.5, height - 0.5, -2.8);
    studyLight.userData.baseIntensity = 2.4;
    group.add(studyLight);
    lights.push(studyLight);

    const kitchenLight = new THREE.PointLight("#fffbe8", 2.5, 20, 1.05);
    kitchenLight.position.set(6.8, height - 0.5, -2.5);
    kitchenLight.userData.baseIntensity = 2.5;
    group.add(kitchenLight);
    lights.push(kitchenLight);

    const foyerLight = new THREE.PointLight("#ffeec8", 2.2, 18, 1.05);
    foyerLight.position.set(0, height - 0.5, 3.5);
    foyerLight.userData.baseIntensity = 2.2;
    group.add(foyerLight);
    lights.push(foyerLight);

    // Colliders (shifted to world coordinates cx, cz)
    colliders.push(
      // Perimeter Boundary Walls (isPerimeterWall: true permits elevated camera to frame room without clipping)
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height, isPerimeterWall: true },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height, isPerimeterWall: true },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height, isPerimeterWall: true },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height, isPerimeterWall: true },
      // Parlour Sectional Sofa
      { x: cx - 4.2, z: cz + 4.4, halfX: 3.1, halfZ: 0.6, height: 1.2 },
      { x: cx - 7.5, z: cz + 2.2, halfX: 0.6, halfZ: 2.5, height: 1.2 },
      { x: cx - 0.9, z: cz + 2.2, halfX: 0.6, halfZ: 1.7, height: 1.2 },
      // Dining Table
      { x: cx + 5.2, z: cz + 2.8, halfX: 1.9, halfZ: 1.0, height: 1.2 },
      // Kitchen Counter & Refrigerator
      { x: cx + 6.8, z: cz - 2.5, halfX: 0.7, halfZ: 2.2, height: 1.2 },
      { x: cx + 8.8, z: cz - 4.2, halfX: 0.7, halfZ: 0.6, height: 2.3 },
      // Central & Room Partition Walls
      { x: cx + 0.8, z: cz + 2.5, halfX: 0.2, halfZ: 3.0, height },
      { x: cx + 0.8, z: cz - 4.5, halfX: 0.2, halfZ: 3.5, height },
      { x: cx - 4.0, z: cz - 1.0, halfX: 5.0, halfZ: 0.2, height },
      { x: cx - 4.0, z: cz - 4.5, halfX: 5.0, halfZ: 0.2, height },
      // Study Desk
      { x: cx - 6.5, z: cz - 3.4, halfX: 1.1, halfZ: 0.5, height: 1.2 },
      // Master Bed & Wardrobe
      { x: cx - 5.5, z: cz - 6.5, halfX: 1.4, halfZ: 1.5, height: 1.4 },
      { x: cx - 8.8, z: cz - 6.5, halfX: 0.4, halfZ: 1.2, height: 2.8 },
      // Guest Bed
      { x: cx + 3.0, z: cz - 6.5, halfX: 1.0, halfZ: 1.2, height: 1.2 },
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
      height: 4.0,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.8),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(44, 0, 45),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        // 1. Veranda Dakali Seating (cx - 3.2 or cx + 3.2, cz + 7.2)
        const distDakaliL = pos.distanceTo(new THREE.Vector3(cx - 3.2, cy + 0.1, cz + 7.2));
        const distDakaliR = pos.distanceTo(new THREE.Vector3(cx + 3.2, cy + 0.1, cz + 7.2));
        if (distDakaliL <= 2.2 || distDakaliR <= 2.2) {
          return {
            prompt: "Sit on Shaded Dakali Bench with Elders",
            action: () => ({
              statusMessage: "Seated on the cool earthen Dakali bench on Al-Baraka's zaure veranda. Enjoying community fellowship.",
              sitDown: { label: "Al-Baraka Zaure Dakali Bench", energyRestored: 20 },
              timeDeltaMinutes: 15,
            }),
          };
        }

        // 2. Family Parlour Sectional Sofa (cx - 4.2, cz + 3.5)
        const distParlourSofa = pos.distanceTo(new THREE.Vector3(cx - 4.2, cy + 0.1, cz + 3.5));
        if (distParlourSofa <= 2.4) {
          return {
            prompt: "Sit on Family Parlour Sectional Sofa",
            action: () => ({
              statusMessage: "Relaxing on the 8-seater northern sectional sofa in the family parlour. Comfortably resting.",
              sitDown: { label: "Al-Baraka Family Parlour Sofa", energyRestored: 20 },
              timeDeltaMinutes: 15,
            }),
          };
        }

        // 3. Parlour 75" QLED Media Wall (cx - 8.0, cz + 2.2)
        const distTv = pos.distanceTo(new THREE.Vector3(cx - 8.0, cy + 0.1, cz + 2.2));
        if (distTv <= 2.4) {
          return {
            prompt: "Watch 75\" QLED Media Wall (Arewa24 / NTA Kano)",
            action: () => ({
              statusMessage: "75\" QLED Media Wall: Broadcasting Arewa24 evening dramas and Kano state documentary. Sound resonates warmly.",
              watchTv: { label: "Al-Baraka 75\" QLED Media Wall", energyRestored: 20 },
              timeDeltaMinutes: 30,
            }),
          };
        }

        // 4. Parlour Chandelier / Light Switch (cx - 0.5, cz + 4.5)
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

        // 5. Formal Dining Room (cx + 5.2, cz + 2.8)
        const distDining = pos.distanceTo(new THREE.Vector3(cx + 5.2, cy + 0.1, cz + 2.8));
        if (distDining <= 2.2) {
          return {
            prompt: "Sit at Formal Dining Table for Family Meal",
            action: () => ({
              statusMessage: "Enjoyed a hearty family dinner of fragrant Tuwo Shinkafa, Miyan Kuka, and tender spiced beef!",
              eatFood: { amount: 50, label: "Family Mahogany Dining Feast" },
              sitDown: { label: "Formal Dining Suite", energyRestored: 15 },
              timeDeltaMinutes: 30,
            }),
          };
        }

        // 6. Family Kitchen cooking (cx + 6.8, cz - 2.5)
        const distKitchen = pos.distanceTo(new THREE.Vector3(cx + 6.8, cy + 0.1, cz - 2.5));
        if (distKitchen <= 2.2) {
          if (state.ownedProperties?.includes("albaraka-villa")) {
            return {
              prompt: "Prepare Home Meal in Kitchen",
              action: () => ({
                statusMessage: "Prepared and enjoyed a fresh hot northern meal in the spacious family kitchen. Hunger satisfied!",
                eatFood: { amount: 50, label: "Home Cooked Family Meal" },
                timeDeltaMinutes: 30,
              }),
            };
          }
        }

        // 7. Refrigerator refreshment (cx + 8.8, cz - 4.2)
        const distFridge = pos.distanceTo(new THREE.Vector3(cx + 8.8, cy + 0.1, cz - 4.2));
        if (distFridge <= 2.2) {
          if (state.ownedProperties?.includes("albaraka-villa")) {
            return {
              prompt: "Grab Chilled Kunu or Zobo from Refrigerator",
              action: () => ({
                statusMessage: "Poured a tall chilled glass of traditional Kunu Aya from the stainless refrigerator. Cool and replenishing!",
                drinkBeverage: { label: "Chilled Kunu Aya", hungerGain: 25, energyGain: 10 },
                timeDeltaMinutes: 5,
              }),
            };
          }
        }

        // 8. Dakin Karatu Study Desk (cx - 6.5, cz - 3.4)
        const distStudy = pos.distanceTo(new THREE.Vector3(cx - 6.5, cy + 0.1, cz - 3.4));
        if (distStudy <= 2.2) {
          if (state.ownedProperties?.includes("albaraka-villa")) {
            return {
              prompt: "Sit at Dakin Karatu Desk: Remote Freelance & Archive Research",
              action: () => ({
                statusMessage: "Al-Baraka Executive Desk: Accessing remote client contracts and consulting family estate archives.",
                freelanceContractAction: true,
              }),
            };
          }
        }

        // 9. Dakin Karatu Traditional Prayer Carpet (cx - 6.5, cz - 2.0)
        const distCarpet = pos.distanceTo(new THREE.Vector3(cx - 6.5, cy + 0.1, cz - 2.0));
        if (distCarpet <= 2.0) {
          return {
            prompt: "Rest on Traditional Prayer Carpet in Dakin Karatu",
            action: () => ({
              statusMessage: "Meditating and resting in the peaceful stillness of Dakin Karatu. Soul and mind refreshed.",
              sitDown: { label: "Dakin Karatu Prayer Carpet", energyRestored: 20 },
              timeDeltaMinutes: 20,
            }),
          };
        }

        // 10. Master Suite Bed (cx - 5.5, cz - 6.5)
        const distBed = pos.distanceTo(new THREE.Vector3(cx - 5.5, cy + 0.1, cz - 6.5));
        if (distBed <= 2.4) {
          if (state.ownedProperties?.includes("albaraka-villa")) {
            return {
              prompt: "Sleep & Rest in Master Suite Bed (Advance 6 Hours)",
              action: () => ({
                statusMessage: "Resting peacefully in the Master Suite of Al-Baraka Villa. Energy fully restored to 100%!",
                sleepInBed: { hours: 6 },
                timeDeltaMinutes: 360,
              }),
            };
          }
        }

        // 11. Guest / Children Bed (cx + 3.0, cz - 6.5)
        const distGuestBed = pos.distanceTo(new THREE.Vector3(cx + 3.0, cy + 0.1, cz - 6.5));
        if (distGuestBed <= 2.2) {
          if (state.ownedProperties?.includes("albaraka-villa")) {
            return {
              prompt: "Rest in Guest Bed (Advance 6 Hours)",
              action: () => ({
                statusMessage: "Rested in the peaceful guest bedroom. Energy fully replenished to 100%!",
                sleepInBed: { hours: 6 },
                timeDeltaMinutes: 360,
              }),
            };
          }
        }

        // 12. Ensuite Bathtub & Shower (cx - 0.8, cz - 7.2)
        const distBath = pos.distanceTo(new THREE.Vector3(cx - 0.8, cy + 0.1, cz - 7.2));
        if (distBath <= 2.2) {
          if (state.ownedProperties?.includes("albaraka-villa")) {
            return {
              prompt: "Take Warm Bath & Shower in Ensuite",
              action: () => ({
                statusMessage: "Refreshing bath and shower taken in the ensuite! Hygiene restored to 100%.",
                takeShower: { label: "Al-Baraka Ensuite Bathroom" },
              }),
            };
          }
        }

        // 13. Ensuite Vanity Basin Sink (cx - 1.8, cz - 6.5)
        const distSink = pos.distanceTo(new THREE.Vector3(cx - 1.8, cy + 0.1, cz - 6.5));
        if (distSink <= 2.0) {
          if (state.ownedProperties?.includes("albaraka-villa")) {
            return {
              prompt: "Wash Hands at Vanity Basin",
              action: () => ({
                statusMessage: "Washed hands at the marble vanity basin. Fresh and clean!",
                washHands: { label: "Al-Baraka Ensuite Vanity Basin" },
              }),
            };
          }
        }

        // 14. Generator House in Utility Yard (cx + 5.5, cz - 8.5)
        const distGen = pos.distanceTo(new THREE.Vector3(cx + 5.5, cy + 0.1, cz - 8.5));
        if (distGen <= 2.4) {
          return {
            prompt: "Inspect 25kVA Soundproof Diesel Generator & Borehole",
            action: () => ({
              statusMessage: "Al-Baraka Generator House: 25kVA Lister-Petter soundproof generator operational. Diesel tank: 92% full. Voltage: 230V stable. Borehole pressure: Nominal (4.2 Bar).",
            }),
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
    const wallMat = this.materials.interiorWall || this.materials.white;
    const woodMat = this.materials.wood;
    const glassMat = this.materials.glassLit || this.materials.glass;
    const darkMat = this.materials.darkTrim;
    const metalMat = this.materials.metal;
    const whiteMat = this.materials.white;
    const blackMat = this.materials.black;
    const cyanMat = this.materials.neonCyan || this.materials.glassLit;

    // 1. Lower Floor (Floor 1, y = 0) & Double-Height Ceiling Slab (y = 6.8)
    addBox(group, marbleMat, 0, 0, 0, width, 0.1, depth, false);
    addCeiling(group, this.materials.ceilingMat || wallMat, totalHeight, width, depth);

    // 2. Perimeter Cutaway Walls (Single-sided inward-facing planes with dark trim baseboards)
    addPerimeterWall(group, wallMat, 0, totalHeight / 2, -depth / 2, width, totalHeight, 0); // North Wall
    addPerimeterWall(group, wallMat, 0, totalHeight / 2, depth / 2, width, totalHeight, Math.PI);  // South Wall (Foyer & Terrace)
    addPerimeterWall(group, wallMat, -width / 2, totalHeight / 2, 0, depth, totalHeight, Math.PI / 2); // West Wall
    addPerimeterWall(group, wallMat, width / 2, totalHeight / 2, 0, depth, totalHeight, -Math.PI / 2);  // East Wall
    addBox(group, darkMat, 0, 0.08, -depth / 2 + 0.04, width, 0.16, 0.04, false);
    addBox(group, darkMat, 0, 0.08, depth / 2 - 0.04, width, 0.16, 0.04, false);
    addBox(group, darkMat, -width / 2 + 0.04, 0.08, 0, 0.04, 0.16, depth, false);
    addBox(group, darkMat, width / 2 - 0.04, 0.08, 0, 0.04, 0.16, depth, false);

    // 3. Lower Level: Grand Foyer (z: 5.5 to 8.0, x: -2.5 to 2.5)
    // Double Entry Doors with door casing
    addDoorCasing(group, darkMat, 0, 0, depth / 2 - 0.08, 2.5, 2.4, 0);
    addBox(group, woodMat, -0.65, 1.2, depth / 2 - 0.08, 1.2, 2.4, 0.12);
    addBox(group, woodMat, 0.65, 1.2, depth / 2 - 0.08, 1.2, 2.4, 0.12);
    addBox(group, metalMat, -0.15, 1.2, depth / 2 - 0.02, 0.06, 0.22, 0.04, false);
    addBox(group, metalMat, 0.15, 1.2, depth / 2 - 0.02, 0.06, 0.22, 0.04, false);
    // Illuminated Exit Sign above doors
    const exitSignMat = makeSignMaterial("EXIT TO BOMPAI AVENUE", "#065f46");
    addBox(group, exitSignMat, 0, 2.55, depth / 2 - 0.08, 1.8, 0.38, 0.06);
    // Console Credenza in Foyer
    addBox(group, darkMat, 0, 0.5, 6.8, 1.8, 0.85, 0.45);
    addBox(group, this.materials.goldTrim || metalMat, 0, 1.1, 6.8, 0.35, 0.35, 0.25); // Sculpture
    // Wall Switch in Foyer
    addBox(group, whiteMat, -1.0, 1.4, depth / 2 - 0.2, 0.1, 0.14, 0.04);
    addBox(group, darkMat, -1.0, 1.4, depth / 2 - 0.23, 0.03, 0.05, 0.02, false);

    // 4. Lower Level: Panoramic Living Salon (x: -8.5 to 1.0, z: -7.0 to 3.0)
    // Floor-to-Ceiling Panoramic Glass Window Wall on North side
    addBox(group, glassMat, -3.5, totalHeight / 2, -depth / 2 + 0.12, 9.5, totalHeight - 0.5, 0.1);
    // Luxury Cream Sectional Suite with contoured cushions
    addBox(group, darkMat, -3.5, 0.18, -4.5, 5.4, 0.12, 1.1); // Plinth
    addBox(group, whiteMat, -3.5, 0.44, -4.5, 5.2, 0.28, 1.05); // Seat
    addBox(group, this.materials.cloth, -3.5, 0.78, -4.9, 5.2, 0.44, 0.22); // Back
    addBox(group, darkMat, -6.0, 0.18, -2.5, 1.1, 0.12, 3.8);
    addBox(group, whiteMat, -6.0, 0.44, -2.5, 1.05, 0.28, 3.6);
    addBox(group, this.materials.cloth, -6.4, 0.78, -2.5, 0.22, 0.44, 3.6);
    // Accent pillows
    addBox(group, this.materials.goldTrim || darkMat, -4.5, 0.65, -4.2, 0.4, 0.35, 0.15);
    addBox(group, this.materials.goldTrim || darkMat, -2.5, 0.65, -4.2, 0.4, 0.35, 0.15);
    // Polished Carrara & Black Marble Coffee Table
    addBox(group, darkMat, -3.5, 0.18, -2.5, 2.0, 0.10, 1.0);
    addBox(group, this.materials.marbleWhite || blackMat, -3.5, 0.36, -2.5, 2.2, 0.06, 1.2);
    addBox(group, glassMat, -3.5, 0.44, -2.5, 0.4, 0.12, 0.4); // Centerpiece
    // Potted plant in living salon
    addPottedPlant(group, whiteMat, darkMat, this.materials.foliage, -1.2, 0, -6.2);
    // Wall artwork in salon
    addWallArtwork(group, darkMat, this.materials.clothRed, -8.7, 4.2, -2.5, 3.2, 1.6, Math.PI / 2);
    // 85-inch Entertainment Wall with wood slats and OLED screen
    addBox(group, darkMat, -8.7, 1.4, -2.5, 0.25, 2.6, 4.4);
    addBox(group, blackMat, -8.6, 1.8, -2.5, 0.08, 1.6, 3.2);
    addBox(group, cyanMat, -8.55, 1.8, -2.5, 0.02, 1.45, 3.0); // OLED Screen glow
    addBox(group, metalMat, -8.55, 0.85, -2.5, 0.12, 0.08, 2.2); // Soundbar
    addPowerOutlet(group, whiteMat, -8.5, 0.55, -4.2, Math.PI / 2);

    // 5. Lower Level: Gourmet Island Kitchen (x: 2.0 to 8.5, z: -7.0 to 0.5)
    // Central Granite Chef Island with recessed toe-kick
    addBox(group, darkMat, 5.0, 0.05, -3.5, 2.2, 0.10, 3.8); // Toe-kick
    addBox(group, darkMat, 5.0, 0.52, -3.5, 2.4, 0.85, 4.0);
    addBox(group, this.materials.marbleWhite || blackMat, 5.0, 0.98, -3.5, 2.6, 0.08, 4.2); // Marble/Granite top
    addBox(group, blackMat, 5.0, 1.03, -4.5, 0.8, 0.02, 0.9);  // Induction hob
    // 3 Leather Bar Stools with metallic footrests
    for (const dz of [-1.2, 0, 1.2]) {
      addCyl(group, metalMat, 3.4, 0.35, -3.5 + dz, 0.03, 0.70);
      addCyl(group, metalMat, 3.4, 0.20, -3.5 + dz, 0.22, 0.03); // Footrest ring
      addBox(group, darkMat, 3.4, 0.72, -3.5 + dz, 0.4, 0.08, 0.4);
    }
    // Full-height cabinetry wall & double oven
    addBox(group, woodMat, 8.2, 1.6, -3.5, 0.8, 3.0, 5.0);
    addBox(group, metalMat, 7.8, 1.4, -2.0, 0.1, 1.1, 0.8); // Double built-in oven
    // Double-Door Stainless Smart Refrigerator with Ice Dispenser & kickplate
    addBox(group, darkMat, 7.8, 0.04, -6.5, 1.3, 0.08, 1.2);
    addBox(group, metalMat, 7.8, 1.35, -6.5, 1.4, 2.4, 1.3);
    addBox(group, darkMat, 7.1, 1.4, -6.8, 0.03, 0.9, 0.03); // Tubular handles
    addBox(group, darkMat, 7.1, 1.4, -6.2, 0.03, 0.9, 0.03);
    // Undermount double sink & faucet
    addBox(group, metalMat, 5.0, 0.99, -2.4, 0.7, 0.02, 1.2);
    addCyl(group, metalMat, 5.0, 1.25, -2.4, 0.03, 0.35); // Gooseneck tap
    addPowerOutlet(group, whiteMat, 7.7, 1.15, -0.2, Math.PI);

    // 6. Lower Level: Guest Bedroom & Bathroom Suite (x: 2.0 to 8.5, z: 1.0 to 7.0)
    addBox(group, wallMat, 5.0, 3.4 / 2, 0.5, 6.5, 3.4, 0.2); // Partition wall
    // Guest Bed
    addBox(group, woodMat, 5.0, 0.45, 3.8, 2.2, 0.52, 2.4);
    addBox(group, whiteMat, 5.0, 0.72, 3.8, 2.1, 0.22, 2.3);
    addBox(group, this.materials.cloth, 5.0, 0.78, 4.2, 2.1, 0.12, 1.4); // Duvet
    // Guest Wardrobe
    addBox(group, woodMat, 7.8, 1.2, 3.8, 0.6, 2.4, 1.6);
    // Guest Bathroom partition & fixtures (z: 1.0 to 2.4, x: 5.5 to 8.5)
    addBox(group, wallMat, 5.0, 3.4 / 2, 2.0, 0.2, 3.4, 3.0);
    addBox(group, whiteMat, 6.8, 0.85, 1.2, 1.0, 0.85, 0.5); // Vanity sink
    addBox(group, glassMat, 6.8, 1.65, 0.95, 0.8, 0.75, 0.04); // Mirror
    addBox(group, whiteMat, 8.0, 0.42, 1.4, 0.5, 0.42, 0.65); // Toilet
    addBox(group, glassMat, 3.5, 1.2, 1.4, 1.4, 2.4, 1.4);    // Shower stall

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

    // 9. Upper Mezzanine Gallery & Executive Study (x: 1.5 to 8.5, z: 0.5 to 5.5)
    // Safety Glass Balustrade Overlooking Living Salon Below
    addBox(group, glassMat, 4.5, floor2Elevation + 0.6, 0.2, 6.5, 1.1, 0.08);
    addBox(group, metalMat, 4.5, floor2Elevation + 1.15, 0.2, 6.5, 0.06, 0.08);
    // Executive Mahogany Desk & Dual-Monitor Workstation
    addBox(group, woodMat, 5.0, floor2Elevation + 0.75, 2.8, 2.4, 0.08, 1.2);
    addBox(group, darkMat, 4.5, floor2Elevation + 0.9, 2.6, 0.15, 0.2, 0.15); // Stand L
    addBox(group, cyanMat, 4.5, floor2Elevation + 1.2, 2.6, 0.85, 0.5, 0.04);  // Monitor 1
    addBox(group, darkMat, 5.5, floor2Elevation + 0.9, 2.6, 0.15, 0.2, 0.15); // Stand R
    addBox(group, cyanMat, 5.5, floor2Elevation + 1.2, 2.6, 0.85, 0.5, 0.04);  // Monitor 2
    addBox(group, blackMat, 5.0, floor2Elevation + 0.8, 3.1, 0.55, 0.02, 0.22); // Keyboard
    addBox(group, darkMat, 5.0, floor2Elevation + 0.5, 3.6, 0.65, 0.65, 0.65);  // Executive chair
    // Floating Library Bookshelves
    addBox(group, woodMat, 8.2, floor2Elevation + 1.6, 2.8, 0.5, 2.6, 3.2);

    // 10. Upper Level: Master Penthouse Suite (x: -8.5 to -1.0, z: 0 to 5.5)
    addBox(group, wallMat, -1.0, floor2Elevation + (totalHeight - floor2Elevation) / 2, 2.8, 0.2, totalHeight - floor2Elevation, 5.5);
    addDoorCasing(group, darkMat, -1.0, floor2Elevation, 1.2, 1.1, 2.4, Math.PI / 2);
    // King-Size Master Bed with velvet tufted headboard & fluting
    addBox(group, darkMat, -5.0, floor2Elevation + 0.22, 2.8, 2.6, 0.14, 2.8); // Plinth
    addBox(group, whiteMat, -5.0, floor2Elevation + 0.48, 2.8, 2.4, 0.28, 2.6); // Deep mattress
    addBox(group, this.materials.cloth, -5.0, floor2Elevation + 0.65, 3.2, 2.4, 0.14, 1.6); // Silk Duvet
    addBox(group, this.materials.clothRed, -5.0, floor2Elevation + 0.68, 3.8, 2.4, 0.06, 0.45); // Runner
    // 4 Layered Pillows
    addBox(group, whiteMat, -5.5, floor2Elevation + 0.72, 1.8, 0.8, 0.14, 0.45);
    addBox(group, whiteMat, -4.5, floor2Elevation + 0.72, 1.8, 0.8, 0.14, 0.45);
    addBox(group, this.materials.goldTrim || darkMat, -5.5, floor2Elevation + 0.82, 2.0, 0.6, 0.12, 0.35);
    addBox(group, this.materials.goldTrim || darkMat, -4.5, floor2Elevation + 0.82, 2.0, 0.6, 0.12, 0.35);
    addBox(group, darkMat, -5.0, floor2Elevation + 1.4, 1.35, 2.8, 1.4, 0.15); // Headboard
    addBox(group, this.materials.cloth, -5.0, floor2Elevation + 1.4, 1.42, 2.6, 1.2, 0.05); // Tufted insert
    // Wall artwork above master bed
    addWallArtwork(group, darkMat, this.materials.clothRed, -5.0, floor2Elevation + 2.5, 1.34, 2.2, 0.9, 0);
    // Nightstands with lamps
    addBox(group, woodMat, -6.8, floor2Elevation + 0.4, 1.5, 0.6, 0.65, 0.5);
    addBox(group, woodMat, -3.2, floor2Elevation + 0.4, 1.5, 0.6, 0.65, 0.5);
    addBox(group, this.materials.lampGlow || whiteMat, -6.8, floor2Elevation + 0.85, 1.5, 0.25, 0.35, 0.25);
    addBox(group, this.materials.lampGlow || whiteMat, -3.2, floor2Elevation + 0.85, 1.5, 0.25, 0.35, 0.25);
    addPowerOutlet(group, whiteMat, -6.8, floor2Elevation + 0.55, 1.34, 0);
    addPowerOutlet(group, whiteMat, -3.2, floor2Elevation + 0.55, 1.34, 0);
    // Mirrored Walk-in Dressing Wardrobe
    addBox(group, woodMat, -8.2, floor2Elevation + 1.4, 2.8, 0.65, 2.5, 2.4);
    addBox(group, glassMat, -7.85, floor2Elevation + 1.4, 2.8, 0.04, 2.3, 2.2);
    // Executive Electronic Wall Safe
    addBox(group, metalMat, -8.7, floor2Elevation + 1.2, 4.5, 0.4, 0.6, 0.6);
    addBox(group, cyanMat, -8.45, floor2Elevation + 1.2, 4.5, 0.02, 0.15, 0.15); // Keypad glow
    // Master Ensuite Luxury Bathroom (x: -1.0 to -3.5, z: 0.5 to 2.5, upper level)
    addBox(group, wallMat, -3.5, floor2Elevation + 1.4, 1.5, 0.2, 2.8, 2.2);
    addBox(group, whiteMat, -2.2, floor2Elevation + 0.4, 1.2, 1.6, 0.55, 0.8); // Soaking tub
    addBox(group, glassMat, -2.2, floor2Elevation + 1.2, 2.2, 1.4, 2.2, 1.0);  // Rain shower

    // 11. Upper Level: Private Skyline Rooftop Terrace (z: 5.5 to 8.0, x: -8.5 to 8.5)
    addBox(group, wallMat, 0, floor2Elevation + (totalHeight - floor2Elevation) / 2, 5.5, width, totalHeight - floor2Elevation, 0.2);
    // Teak Outdoor Lounge Chairs & Beverage Table
    addBox(group, woodMat, -4.0, floor2Elevation + 0.35, 6.8, 1.8, 0.35, 1.0);
    addBox(group, this.materials.cloth, -4.0, floor2Elevation + 0.55, 6.8, 1.6, 0.15, 0.9);
    addBox(group, woodMat, -2.2, floor2Elevation + 0.3, 6.8, 0.7, 0.3, 0.7); // Table
    // Perimeter glass balustrade
    addBox(group, glassMat, 0, floor2Elevation + 0.55, 7.9, width - 0.4, 1.1, 0.08);

    // Interactive Doors
    this.addInteractiveDoor(group, "penthouse", "penthouse_master_door", "Master Penthouse Suite Door", -1.0, floor2Elevation, 4.5, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "penthouse", "penthouse_guest_door", "Guest Bedroom Door", 5.0, 0, 0.5, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "penthouse", "penthouse_terrace_door", "Rooftop Skyline Terrace Door", 0, floor2Elevation, 5.5, 1.4, 2.4, 0.08, glassMat, cx, cz, true, colliders);

    // Multi-Room Atmospheric Point Lights
    const salonChandelier = new THREE.PointLight("#fff5e2", 3.6, 28, 1.05);
    salonChandelier.position.set(-3.5, totalHeight - 1.2, -1.0);
    salonChandelier.userData.baseIntensity = 3.6;
    group.add(salonChandelier);
    lights.push(salonChandelier);

    const masterLight = new THREE.PointLight("#ffe8cc", 2.6, 20, 1.05);
    masterLight.position.set(-5.0, totalHeight - 1.2, 2.8);
    masterLight.userData.baseIntensity = 2.6;
    group.add(masterLight);
    lights.push(masterLight);

    const kitchenLight = new THREE.PointLight("#fff2dc", 2.5, 18, 1.05);
    kitchenLight.position.set(5.0, 3.4 - 0.5, -3.5);
    kitchenLight.userData.baseIntensity = 2.5;
    group.add(kitchenLight);
    lights.push(kitchenLight);

    const guestLight = new THREE.PointLight("#fff6ea", 2.4, 18, 1.05);
    guestLight.position.set(5.0, 3.4 - 0.5, 3.5);
    guestLight.userData.baseIntensity = 2.4;
    group.add(guestLight);
    lights.push(guestLight);

    const galleryLight = new THREE.PointLight("#fbfcfe", 2.6, 22, 1.05);
    galleryLight.position.set(5.0, totalHeight - 1.2, 2.8);
    galleryLight.userData.baseIntensity = 2.6;
    group.add(galleryLight);
    lights.push(galleryLight);

    const stairLight = new THREE.PointLight("#fffaee", 2.2, 18, 1.05);
    stairLight.position.set(0.2, 3.8, 3.2);
    stairLight.userData.baseIntensity = 2.2;
    group.add(stairLight);
    lights.push(stairLight);

    // Colliders (shifted to world coordinates cx, cz)
    colliders.push(
      // Perimeter Boundary Walls
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height: totalHeight, isPerimeterWall: true },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height: totalHeight, isPerimeterWall: true },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height: totalHeight, isPerimeterWall: true },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height: totalHeight, isPerimeterWall: true },
      // Living Room Sofa & Media Wall
      { x: cx - 3.5, z: cz - 4.5, halfX: 2.8, halfZ: 0.6, height: 1.2 },
      { x: cx - 6.0, z: cz - 2.5, halfX: 0.6, halfZ: 2.0, height: 1.2 },
      { x: cx - 8.7, z: cz - 2.5, halfX: 0.3, halfZ: 2.3, height: 2.2 },
      // Kitchen Island & Refrigerator
      { x: cx + 5.0, z: cz - 3.5, halfX: 1.4, halfZ: 2.1, height: 1.2 },
      { x: cx + 7.8, z: cz - 6.5, halfX: 0.8, halfZ: 0.8, height: 2.4 },
      // Guest Bedroom Partition & Bed
      { x: cx + 5.0, z: cz + 0.5, halfX: 3.2, halfZ: 0.2, height: 3.4 },
      { x: cx + 5.0, z: cz + 3.8, halfX: 1.2, halfZ: 1.3, height: 1.2 },
      // Upper Floor Partition Wall & Master Bed
      { x: cx - 1.0, z: cz + 2.8, halfX: 0.2, halfZ: 2.8, height: totalHeight },
      { x: cx - 5.0, z: cz + 2.8, halfX: 1.4, halfZ: 1.5, height: totalHeight },
      // Upper Gallery Desk
      { x: cx + 5.0, z: cz + 2.8, halfX: 1.3, halfZ: 0.7, height: totalHeight },
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
      height: totalHeight,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + 1.8),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 0.9),
      outdoorDoorPosition: new THREE.Vector3(18, 0, 39.5),
      outdoorDoorYaw: Math.PI,
      checkInteraction: (pos, state) => {
        // 1. Penthouse Lighting Chandelier Switch (cx - 1.0, cz - 1.0, lower level)
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

        // 2. Salon Italian Leather Sectional (cx - 3.5, cz - 4.5, lower level)
        const distSalonSofa = pos.distanceTo(new THREE.Vector3(cx - 3.5, cy + 0.1, cz - 4.5));
        if (distSalonSofa <= 2.4) {
          return {
            prompt: "Sit & Lounge on Italian Leather Sectional",
            action: () => ({
              statusMessage: "Reclined on the Italian leather sectional. The city lights of Kano stretch outside the double-height glass.",
              sitDown: { label: "Bompai Penthouse Leather Sectional", energyRestored: 20 },
              timeDeltaMinutes: 15,
            }),
          };
        }

        // 3. Salon 85" Curved OLED Cinema TV (cx - 3.5, cz - 2.5, lower level)
        const distTv = pos.distanceTo(new THREE.Vector3(cx - 3.5, cy + 0.1, cz - 2.5));
        if (distTv <= 2.4) {
          return {
            prompt: "Watch 85\" Curved OLED Cinema TV",
            action: () => ({
              statusMessage: "85\" Curved OLED Theater: Immersive surround sound broadcast of international news and sports highlights!",
              watchTv: { label: "Bompai 85\" Curved OLED", energyRestored: 20 },
              timeDeltaMinutes: 30,
            }),
          };
        }

        // 4. Granite Island Barstools (cx + 3.5, cz - 3.5, lower level)
        const distBarstool = pos.distanceTo(new THREE.Vector3(cx + 3.5, cy + 0.1, cz - 3.5));
        if (distBarstool <= 2.0) {
          return {
            prompt: "Sit at Granite Kitchen Island Bar",
            action: () => ({
              statusMessage: "Perched on the leather barstool at the granite chef island. Enjoying the open gourmet kitchen.",
              sitDown: { label: "Granite Island Barstool", energyRestored: 15 },
              timeDeltaMinutes: 10,
            }),
          };
        }

        // 5. Gourmet Island Kitchen cooking (cx + 5.0, cz - 3.5, lower level)
        const distKitchen = pos.distanceTo(new THREE.Vector3(cx + 5.0, cy + 0.1, cz - 3.5));
        if (distKitchen <= 2.2) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Prepare Meal at Gourmet Island Cooker",
              action: () => ({
                statusMessage: "Prepared and savoured a gourmet 5-star meal at the granite island! Hunger fully satisfied.",
                eatFood: { amount: 55, label: "Gourmet Island Meal" },
                timeDeltaMinutes: 30,
              }),
            };
          }
        }

        // 6. French-Door Smart Refrigerator (cx + 7.5, cz - 6.5, lower level)
        const distFridge = pos.distanceTo(new THREE.Vector3(cx + 7.5, cy + 0.1, cz - 6.5));
        if (distFridge <= 2.2) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Grab Iced Beverage from Smart Refrigerator",
              action: () => ({
                statusMessage: "Poured an iced sparkling fruit beverage from the smart refrigerator dispenser. Cool and energizing!",
                drinkBeverage: { label: "Iced Sparkling Fruit Beverage", hungerGain: 30, energyGain: 10 },
                timeDeltaMinutes: 5,
              }),
            };
          }
        }

        // 7. Guest Bedroom Bed (cx + 5.0, cz + 3.8, lower level)
        const distGuestBed = pos.distanceTo(new THREE.Vector3(cx + 5.0, cy + 0.1, cz + 3.8));
        if (distGuestBed <= 2.2) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Rest in Guest Suite Bed (Advance 6 Hours)",
              action: () => ({
                statusMessage: "Rested comfortably in the guest suite. Energy restored to 100%!",
                sleepInBed: { hours: 6 },
                timeDeltaMinutes: 360,
              }),
            };
          }
        }

        // 8. Guest Bathroom Shower (cx + 3.5, cz + 1.4, lower level)
        const distGuestShower = pos.distanceTo(new THREE.Vector3(cx + 3.5, cy + 0.1, cz + 1.4));
        if (distGuestShower <= 2.2) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Take Rain Shower in Guest Bathroom",
              action: () => ({
                statusMessage: "Hot rain shower taken! Sahel dust washed away and hygiene restored to 100%.",
                takeShower: { label: "Bompai Guest Rain Shower" },
              }),
            };
          }
        }

        // 9. Guest Bathroom Vanity Sink (cx + 6.8, cz + 1.2, lower level)
        const distGuestSink = pos.distanceTo(new THREE.Vector3(cx + 6.8, cy + 0.1, cz + 1.2));
        if (distGuestSink <= 2.0) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Wash Hands at Guest Vanity Basin",
              action: () => ({
                statusMessage: "Freshened up at the marble guest vanity basin. Clean and revitalized!",
                washHands: { label: "Guest Marble Vanity Sink" },
              }),
            };
          }
        }

        // 10. Upper Mezzanine Executive Workstation (cx + 5.0, cz + 2.8, y = -56.5)
        const distWorkstation = pos.distanceTo(new THREE.Vector3(cx + 5.0, cy + floor2Elevation + 0.1, cz + 2.8));
        if (distWorkstation <= 2.4) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Use Executive Workstation: High-Value Remote Contracts & Ledger Audit",
              action: () => ({
                statusMessage: "Bompai Executive Study: Dual-monitor workstation running financial logistics models and client contracts.",
                freelanceContractAction: true,
              }),
            };
          }
        }

        // 11. Master Penthouse Suite Bed (cx - 5.0, cz + 2.8, y = -56.5)
        const distMasterBed = pos.distanceTo(new THREE.Vector3(cx - 5.0, cy + floor2Elevation + 0.1, cz + 2.8));
        if (distMasterBed <= 2.4) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Sleep & Rest in Master Penthouse Suite (Advance 6 Hours)",
              action: () => ({
                statusMessage: "Overnight rest in the Master Penthouse suite with panoramic Kano city lights below. Energy 100%!",
                sleepInBed: { hours: 6 },
                timeDeltaMinutes: 360,
              }),
            };
          }
        }

        // 12. Executive Wall Safe (cx - 8.7, cz + 3.5, y = -56.5)
        const distSafe = pos.distanceTo(new THREE.Vector3(cx - 8.7, cy + floor2Elevation + 0.1, cz + 3.5));
        if (distSafe <= 2.4) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Access Executive Deed Safe (Title Deed & 12-Panel Solar Status)",
              action: () => ({
                statusMessage: "Executive Safe: Freehold Title Deed #BH-PENT-08 verified. 12-Panel Solar Inverter Battery Bank: 100% capacity (Nominal 48V, 200Ah).",
              }),
            };
          }
        }

        // 13. Master Ensuite Luxury Bath & Shower (cx - 2.2, cz + 1.8, y = -56.5)
        const distMasterBath = pos.distanceTo(new THREE.Vector3(cx - 2.2, cy + floor2Elevation + 0.1, cz + 1.8));
        if (distMasterBath <= 2.2) {
          if (state.ownedProperties?.includes("bompai-penthouse")) {
            return {
              prompt: "Take Luxury Soaking Bath & Shower in Master Ensuite",
              action: () => ({
                statusMessage: "Soaked peacefully in the master ensuite freestanding tub with scented bath oils. Hygiene 100%!",
                takeShower: { label: "Master Penthouse Luxury Ensuite" },
              }),
            };
          }
        }

        // 14. Skyline Rooftop Terrace Vista & Seating (y = -56.5)
        const isNearTerrace =
          Math.abs(pos.x - (cx - 2.0)) <= 4.5 &&
          Math.abs(pos.z - (cz + 6.8)) <= 2.5 &&
          Math.abs(pos.y - (cy + floor2Elevation + 0.1)) <= 1.5;
        if (isNearTerrace) {
          return {
            prompt: "Sit on Terrace & Admire Kano City Skyline",
            action: () => ({
              statusMessage: "Bompai Skyline Terrace: Reclined on teak lounge chairs. 360° panoramic view spanning from Dala Hill to Airport Road.",
              sitDown: { label: "Skyline Rooftop Terrace", energyRestored: 25 },
              timeDeltaMinutes: 20,
            }),
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
    const wallMat = this.materials.interiorWall || this.materials.white;
    const woodMat = this.materials.wood;
    const glassMat = this.materials.glassLit || this.materials.glass;
    const darkMat = this.materials.darkTrim;
    const metalMat = this.materials.metal;
    const whiteMat = this.materials.white;
    const blackMat = this.materials.black;
    const cyanMat = this.materials.neonCyan || this.materials.glassLit;

    // Floor & Ceiling Slabs
    addBox(group, floorMat, 0, 0, 0, width, 0.1, depth, false);
    addCeiling(group, this.materials.ceilingMat || wallMat, height, width, depth);

    // Perimeter Cutaway Walls (Single-sided inward-facing planes for unobstructed architectural cutaway)
    addPerimeterWall(group, wallMat, 0, height / 2, -depth / 2, width, height, 0); // North Wall
    addPerimeterWall(group, wallMat, 0, height / 2, depth / 2, width, height, Math.PI);  // South Wall (Entry)
    addPerimeterWall(group, wallMat, -width / 2, height / 2, 0, depth, height, Math.PI / 2); // West Wall
    addPerimeterWall(group, wallMat, width / 2, height / 2, 0, depth, height, -Math.PI / 2);  // East Wall
    // Baseboards for crisp floor/wall definition
    addBox(group, darkMat, 0, 0.08, -depth / 2 + 0.04, width, 0.16, 0.04, false);
    addBox(group, darkMat, 0, 0.08, depth / 2 - 0.04, width, 0.16, 0.04, false);
    addBox(group, darkMat, -width / 2 + 0.04, 0.08, 0, 0.04, 0.16, depth, false);
    addBox(group, darkMat, width / 2 - 0.04, 0.08, 0, 0.04, 0.16, depth, false);

    // Partition Wall Baseboards
    addBox(group, darkMat, -1.2, 0.08, 3.9, 0.24, 0.16, 3.8, false);
    addBox(group, darkMat, 1.2, 0.08, 3.9, 0.24, 0.16, 3.8, false);

    // 1. Entrance Vestibule & Hallway (z: 3.6 to 5.8, x: -1.2 to 1.2)
    addDoorCasing(group, darkMat, 0, 0, depth / 2 - 0.08, 1.2, 2.2, 0);
    addBox(group, woodMat, 0, 1.1, depth / 2 - 0.08, 1.2, 2.2, 0.1); // Front Door
    // Chrome lever handle on entrance door
    addBox(group, metalMat, 0.45, 1.1, depth / 2 - 0.02, 0.12, 0.025, 0.04, false);
    // Illuminated Exit Sign above door
    const exitSignMat = makeSignMaterial("EXIT TO AIRPORT ROAD", "#065f46");
    addBox(group, exitSignMat, 0, 2.45, depth / 2 - 0.08, 1.6, 0.38, 0.06);
    // Welcome mat
    addBox(group, darkMat, 0, 0.04, 4.8, 1.2, 0.02, 0.8, false);
    // Wooden shoe cabinet with slatted doors
    addBox(group, woodMat, 1.0, 0.45, 4.8, 0.35, 0.8, 1.2);
    addBox(group, darkMat, 0.82, 0.45, 4.8, 0.02, 0.74, 1.14, false);
    // Wall coat pegs with brass hooks
    addBox(group, woodMat, -1.0, 1.6, 4.8, 0.08, 0.15, 1.0);
    for (const hx of [-0.3, 0, 0.3]) {
      addBox(group, metalMat, -1.05, 1.6, 4.8 + hx, 0.05, 0.06, 0.03, false);
    }
    // Wall light switch
    addBox(group, whiteMat, -0.6, 1.4, 3.8, 0.1, 0.14, 0.04);
    addBox(group, darkMat, -0.6, 1.4, 3.77, 0.03, 0.05, 0.02, false); // Rocker switch

    // 2. Open-Concept Living Room (x: -6.8 to -0.6, z: -3.8 to 2.2)
    // Procedural Fallback Group for Sofa
    const proceduralSofa = new THREE.Group();
    proceduralSofa.name = "proceduralSofa";
    group.add(proceduralSofa);

    // Tapered Metal Legs for Sofa (grounding clearance & contact shadow)
    for (const lx of [-5.0, -3.4, -1.8]) {
      for (const lz of [-1.1, -0.1]) {
        addCyl(proceduralSofa, darkMat, lx, 0.06, lz, 0.035, 0.12);
      }
    }
    // Chaise lounge legs
    addCyl(proceduralSofa, darkMat, -5.6, 0.06, 1.8, 0.035, 0.12);
    addCyl(proceduralSofa, darkMat, -5.0, 0.06, 1.8, 0.035, 0.12);

    // Sofa Base Plinth
    addBox(proceduralSofa, darkMat, -3.4, 0.16, -0.6, 3.4, 0.08, 1.1);
    addBox(proceduralSofa, darkMat, -5.3, 0.16, 0.8, 1.0, 0.08, 2.0);

    // Deep Comfortable Seat Cushions (3 distinct segmented cushions with contoured welt bevel)
    addBox(proceduralSofa, this.materials.cloth, -4.5, 0.28, -0.55, 1.05, 0.16, 0.95);
    addBox(proceduralSofa, this.materials.cloth, -4.5, 0.38, -0.55, 0.98, 0.06, 0.88); // Bevel contour
    addBox(proceduralSofa, this.materials.cloth, -3.4, 0.28, -0.55, 1.05, 0.16, 0.95);
    addBox(proceduralSofa, this.materials.cloth, -3.4, 0.38, -0.55, 0.98, 0.06, 0.88);
    addBox(proceduralSofa, this.materials.cloth, -2.3, 0.28, -0.55, 1.05, 0.16, 0.95);
    addBox(proceduralSofa, this.materials.cloth, -2.3, 0.38, -0.55, 0.98, 0.06, 0.88);
    // Chaise cushion
    addBox(proceduralSofa, this.materials.cloth, -5.3, 0.28, 0.8, 0.95, 0.16, 1.8);
    addBox(proceduralSofa, this.materials.cloth, -5.3, 0.38, 0.8, 0.88, 0.06, 1.72);

    // Ergonomic Padded Backrest with rear support and plush front cushion
    addBox(proceduralSofa, darkMat, -3.4, 0.65, -1.12, 3.4, 0.46, 0.14);
    addBox(proceduralSofa, this.materials.cloth, -3.4, 0.65, -1.02, 3.32, 0.42, 0.14);
    addBox(proceduralSofa, darkMat, -5.76, 0.65, 0.8, 0.14, 0.46, 1.8);
    addBox(proceduralSofa, this.materials.cloth, -5.66, 0.65, 0.8, 0.14, 0.42, 1.72);

    // Sculpted Armrests with rounded top padding
    addBox(proceduralSofa, darkMat, -1.6, 0.48, -0.55, 0.22, 0.32, 1.05);
    addBox(proceduralSofa, this.materials.cloth, -1.6, 0.65, -0.55, 0.20, 0.04, 1.0);

    // Designer Scatter Cushions (Authentic Kano terracotta, Sahelian gold, and linen)
    addBox(proceduralSofa, this.materials.goldTrim || woodMat, -4.4, 0.58, -0.85, 0.42, 0.38, 0.14);
    addBox(proceduralSofa, this.materials.clothRed, -2.4, 0.58, -0.85, 0.42, 0.38, 0.14);
    addBox(proceduralSofa, this.materials.cloth, -5.3, 0.58, 0.1, 0.14, 0.38, 0.42);

    // Asynchronously prototype realistic 3D Sectional Sofa
    loadGLTFModel("/assets/furniture/SheenWoodLeatherSofa.glb").then((model) => {
      if (!model) return;
      fitModelToBounds(model, 3.2, 1.35, 1.05, -3.4, -0.55, 0.02, 0);
      proceduralSofa.visible = false;
      group.add(model);
    });

    // Framed Contemporary Artwork on wall above sofa
    addWallArtwork(group, darkMat, this.materials.clothRed, -3.4, 2.1, -1.2, 2.4, 1.2, 0);

    // Designer Armchair in Living Room Conversation Nook (positioned naturally on rug, clears hallway)
    const chairX = -2.05;
    const chairZ = 0.55;
    const chairRotY = -Math.PI * 0.55;

    const proceduralArmchair = new THREE.Group();
    proceduralArmchair.name = "proceduralArmchair";
    proceduralArmchair.position.set(chairX, 0, chairZ);
    proceduralArmchair.rotation.y = chairRotY;
    group.add(proceduralArmchair);

    addCyl(proceduralArmchair, darkMat, -0.32, 0.06, 0.32, 0.03, 0.12);
    addCyl(proceduralArmchair, darkMat, 0.32, 0.06, 0.32, 0.03, 0.12);
    addCyl(proceduralArmchair, darkMat, -0.32, 0.06, -0.32, 0.03, 0.12);
    addCyl(proceduralArmchair, darkMat, 0.32, 0.06, -0.32, 0.03, 0.12);
    addBox(proceduralArmchair, darkMat, 0, 0.18, 0, 0.82, 0.08, 0.82); // Chair base
    addBox(proceduralArmchair, this.materials.cloth, 0, 0.32, 0, 0.74, 0.18, 0.74); // Seat
    addBox(proceduralArmchair, this.materials.cloth, 0, 0.65, 0.35, 0.74, 0.44, 0.14); // Back
    addBox(proceduralArmchair, woodMat, -0.41, 0.52, 0, 0.10, 0.24, 0.74); // Polished walnut arms
    addBox(proceduralArmchair, woodMat, 0.41, 0.52, 0, 0.10, 0.24, 0.74);

    proceduralArmchair.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.isFurniture = true;
        child.userData.roomObject = "armchair";
        if (child.material) {
          child.material = Array.isArray(child.material)
            ? child.material.map((m) => m.clone())
            : child.material.clone();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            m.transparent = true;
            m.userData = m.userData || {};
            m.userData.baseOpacity = m.opacity ?? 1.0;
          });
        }
      }
    });

    // Asynchronously prototype realistic 3D Accent Armchair
    loadGLTFModel("/assets/furniture/SheenChair.glb").then((model) => {
      if (!model) return;
      fitModelToBounds(model, 0.88, 0.88, 0.86, chairX, chairZ, 0.02, chairRotY);
      model.name = "realisticArmchair";
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.isFurniture = true;
          child.userData.roomObject = "armchair";
          if (child.material) {
            child.material = Array.isArray(child.material)
              ? child.material.map((m) => m.clone())
              : child.material.clone();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              m.transparent = true;
              m.userData = m.userData || {};
              m.userData.baseOpacity = m.opacity ?? 1.0;
            });
          }
        }
      });
      proceduralArmchair.visible = false;
      group.add(model);
    });

    // Designer Woven Geometric Area Rug (authentic Nigerian terracotta/linen borders)
    addBox(group, this.materials.patternedRug || this.materials.cloth, -3.4, 0.015, 0.4, 3.2, 0.02, 2.4, false);

    // Architectural Coffee Table
    for (const cx of [-4.0, -2.8]) {
      for (const cz of [0.1, 0.7]) {
        addCyl(group, darkMat, cx, 0.17, cz, 0.025, 0.34);
      }
    }
    // Lower Walnut Magazine Shelf
    addBox(group, woodMat, -3.4, 0.12, 0.4, 1.35, 0.03, 0.75);
    // Carrara Marble Beveled Top
    addBox(group, darkMat, -3.4, 0.33, 0.4, 1.40, 0.02, 0.80); // Under-bevel apron
    addBox(group, this.materials.marbleWhite || glassMat, -3.4, 0.36, 0.4, 1.45, 0.04, 0.85);
    // Tabletop accessories: ceramic tray, art book, decorative bowl
    addBox(group, darkMat, -3.6, 0.39, 0.35, 0.35, 0.02, 0.25);
    addBox(group, this.materials.white, -3.2, 0.39, 0.45, 0.28, 0.025, 0.22);
    addCyl(group, metalMat, -3.4, 0.40, 0.55, 0.08, 0.05);

    // Floating Entertainment Media Console
    addBox(group, darkMat, -3.4, 0.45, -3.7, 3.4, 0.52, 0.48);
    // Polished granite console top
    addBox(group, this.materials.marbleWhite || darkMat, -3.4, 0.72, -3.7, 3.45, 0.04, 0.50);
    // Slatted cabinet door division lines & brushed metal pulls
    for (const dx of [-4.5, -3.9, -3.4, -2.9, -2.3]) {
      addBox(group, woodMat, dx, 0.45, -3.45, 0.02, 0.48, 0.02);
    }
    addBox(group, metalMat, -3.4, 0.45, -3.44, 0.12, 0.02, 0.03); // Handle
    // Duplex power outlet behind console
    addPowerOutlet(group, whiteMat, -4.6, 0.45, -3.95, 0);

    // 55" Thin-Bezel Smart OLED TV on pedestal stand
    addBox(group, metalMat, -3.4, 0.75, -3.7, 0.4, 0.02, 0.25); // Metal base
    addCyl(group, metalMat, -3.4, 0.83, -3.7, 0.04, 0.16); // Center neck
    addBox(group, blackMat, -3.4, 1.45, -3.7, 2.2, 1.15, 0.04); // Frame
    addBox(group, cyanMat, -3.4, 1.45, -3.67, 2.12, 1.08, 0.02); // Ambient screen
    // Compact Soundbar
    addBox(group, metalMat, -3.4, 0.76, -3.48, 1.2, 0.06, 0.08);

    // Potted Fiddle Leaf Fig Plant in Ceramic Planter
    addPottedPlant(group, whiteMat, woodMat, this.materials.foliage, -5.8, 0, -2.4);

    // Designer Floor Lamp
    addCyl(group, metalMat, -5.6, 0.02, -3.4, 0.2, 0.03);
    addCyl(group, metalMat, -5.6, 0.95, -3.4, 0.025, 1.9);
    addCyl(group, this.materials.lampGlow || whiteMat, -5.6, 1.85, -3.4, 0.25, 0.35);

    // 3. Private Executive Balcony & Draped Window Opening (x: -6.8 to -1.0, z: -5.8 to -4.0)
    addBox(group, this.materials.concrete, -3.4, 0.05, -4.8, 5.6, 0.08, 1.6, false);
    // Balcony Railing: Glass balustrade with bronze handrail
    addBox(group, darkMat, -3.4, 0.55, -5.7, 5.6, 1.1, 0.08); // Railing base & post
    addBox(group, glassMat, -3.4, 0.65, -5.7, 5.4, 0.85, 0.04); // Glass balustrade

    // Sliding Glass Door Aluminum Perimeter Frame & Mullions
    addBox(group, darkMat, -3.4, 2.42, -4.0, 3.2, 0.06, 0.12); // Top header
    addBox(group, darkMat, -3.4, 0.04, -4.0, 3.2, 0.06, 0.12); // Bottom track sill
    addBox(group, darkMat, -5.0, 1.2, -4.0, 0.06, 2.4, 0.12);  // Left jamb
    addBox(group, darkMat, -1.8, 1.2, -4.0, 0.06, 2.4, 0.12);  // Right jamb
    addBox(group, darkMat, -3.4, 1.2, -4.0, 0.06, 2.4, 0.08);  // Center mullion
    addBox(group, metalMat, -3.32, 1.15, -3.94, 0.03, 0.35, 0.03); // Sliding pull handle
    addBox(group, glassMat, -3.4, 1.2, -4.0, 3.1, 2.3, 0.04); // Glass pane

    // Floor-to-Ceiling Pleated Linen Curtains flanking balcony doors
    addArchitecturalCurtains(group, darkMat, this.materials.cloth, -3.4, 0, -3.95, 3.2, 2.4, 0);

    // Teak Bistro Set on Balcony
    addBox(group, woodMat, -3.4, 0.45, -4.8, 0.8, 0.06, 0.8);
    addBox(group, darkMat, -4.2, 0.42, -4.8, 0.42, 0.42, 0.42);
    addBox(group, darkMat, -2.6, 0.42, -4.8, 0.42, 0.42, 0.42);

    // 4. Open-Plan Kitchen & Dining (x: 0.8 to 6.8, z: -3.8 to 2.2)
    // L-Shaped Kitchen Base with Recessed Toe-Kick (grounding contact shadow)
    addBox(group, darkMat, 5.8, 0.05, -1.4, 1.2, 0.10, 4.0); // 10cm recessed toe-kick
    addBox(group, this.materials.white, 5.8, 0.52, -1.4, 1.35, 0.85, 4.2); // Base cabinets
    addBox(group, darkMat, 5.8, 0.98, -1.4, 1.45, 0.06, 4.3); // Granite countertop
    // Cabinet door borders and brushed metal bar handles
    for (const hz of [-3.0, -2.4, -1.8, -1.0, -0.4, 0.2]) {
      addBox(group, metalMat, 5.1, 0.65, hz, 0.02, 0.18, 0.03);
    }
    // Stainless steel undermount double sink & high-arc gooseneck faucet
    addBox(group, metalMat, 5.8, 0.99, -0.6, 0.65, 0.02, 0.95);
    addCyl(group, metalMat, 6.1, 1.18, -0.6, 0.025, 0.32);
    addBox(group, metalMat, 5.98, 1.32, -0.6, 0.22, 0.03, 0.03); // Spout
    addBox(group, metalMat, 6.1, 1.10, -0.5, 0.02, 0.08, 0.02);  // Single lever mixer
    // 4-Burner induction cooktop with glowing burner rings
    addBox(group, blackMat, 5.8, 1.02, -2.4, 0.75, 0.03, 0.75);
    // Wall-mounted upper cabinets with under-cabinet downlight strip
    addBox(group, woodMat, 6.2, 2.4, -1.4, 0.7, 0.9, 4.2);
    addBox(group, this.materials.lampGlow || whiteMat, 5.88, 1.94, -1.4, 0.04, 0.02, 4.0, false);
    // Duplex power outlets on kitchen backsplash
    addPowerOutlet(group, whiteMat, 6.5, 1.25, -1.4, Math.PI / 2);
    // French-Door Stainless Refrigerator with dual upper doors and bottom freezer drawer
    addBox(group, darkMat, 4.2, 0.04, -3.6, 0.95, 0.08, 0.85); // Recessed kickplate
    addBox(group, metalMat, 4.2, 1.08, -3.6, 0.95, 2.00, 0.85); // Refrigerator body
    // Full-length vertical tubular handles on upper french doors
    addBox(group, darkMat, 3.7, 1.35, -3.75, 0.03, 0.75, 0.03);
    addBox(group, darkMat, 3.7, 1.35, -3.45, 0.03, 0.75, 0.03);
    // Bottom freezer drawer horizontal pull handle
    addBox(group, darkMat, 3.7, 0.45, -3.6, 0.03, 0.03, 0.50);
    // Countertop espresso maker & electric kettle
    addBox(group, metalMat, 5.8, 1.20, -3.2, 0.5, 0.36, 0.38);
    addCyl(group, metalMat, 5.8, 1.12, -0.05, 0.10, 0.22);

    // Dining Table & Chairs
    for (const tx of [1.9, 3.3]) {
      for (const tz of [0.0, 1.0]) {
        addCyl(group, woodMat, tx, 0.36, tz, 0.035, 0.72);
      }
    }
    // Solid walnut table with beveled top edge and apron
    addBox(group, darkMat, 2.6, 0.70, 0.5, 1.6, 0.04, 1.1); // Apron frame
    addBox(group, woodMat, 2.6, 0.74, 0.5, 1.7, 0.04, 1.2);  // Tabletop
    // Centerpiece ceramic decorative bowl
    addCyl(group, this.materials.white, 2.6, 0.80, 0.5, 0.18, 0.08);

    // 4 Modern Open-Back Dining Chairs
    const chairPositions = [
      { x: 2.1, z: -0.2, rot: 0 },
      { x: 3.1, z: -0.2, rot: 0 },
      { x: 2.1, z: 1.2, rot: Math.PI },
      { x: 3.1, z: 1.2, rot: Math.PI },
    ];
    for (const c of chairPositions) {
      const chairGroup = new THREE.Group();
      chairGroup.name = "diningChair";
      for (const legX of [-0.18, 0.18]) {
        for (const legZ of [-0.18, 0.18]) {
          addCyl(chairGroup, darkMat, c.x + legX, 0.22, c.z + legZ, 0.02, 0.44);
        }
      }
      addBox(chairGroup, this.materials.cloth.clone(), c.x, 0.46, c.z, 0.44, 0.06, 0.44); // Woven fabric seat cushion
      const backZ = c.rot === 0 ? c.z - 0.2 : c.z + 0.2;
      addBox(chairGroup, darkMat, c.x - 0.18, 0.65, backZ, 0.03, 0.35, 0.03);
      addBox(chairGroup, darkMat, c.x + 0.18, 0.65, backZ, 0.03, 0.35, 0.03);
      addBox(chairGroup, darkMat, c.x, 0.8, backZ, 0.42, 0.06, 0.03);
      chairGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.isFurniture = true;
          child.userData.roomObject = "chair";
          if (child.material) {
            child.material = Array.isArray(child.material) ? child.material.map((m) => m.clone()) : child.material.clone();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              m.transparent = true;
              m.userData = m.userData || {};
              m.userData.baseOpacity = m.opacity ?? 1.0;
            });
          }
        }
      });
      group.add(chairGroup);
      colliders.push({ x: cx + c.x, z: cz + c.z, halfX: 0.24, halfZ: 0.24, height: 0.82 });
    }

    // 5. Study & Workstation (x: 0.8 to 3.8, z: -3.8 to -1.8)
    addBox(group, woodMat, 2.4, 0.75, -3.4, 1.6, 0.08, 0.85); // Desk
    addBox(group, darkMat, 2.4, 0.88, -3.6, 0.2, 0.18, 0.15); // Monitor stand
    addBox(group, cyanMat, 2.4, 1.15, -3.6, 0.8, 0.48, 0.04); // Glowing screen
    addBox(group, blackMat, 2.4, 0.8, -3.25, 0.5, 0.02, 0.2); // Keyboard
    const swivelChair = addBox(group, darkMat.clone(), 2.4, 0.5, -2.7, 0.55, 0.55, 0.55); // Swivel chair
    swivelChair.name = "swivelChair";
    swivelChair.userData.isFurniture = true;
    swivelChair.userData.roomObject = "chair";
    if (swivelChair.material) {
      const swMat = swivelChair.material as THREE.Material;
      swMat.transparent = true;
      swMat.userData = { baseOpacity: 1.0 };
    }
    colliders.push({ x: cx + 2.4, z: cz - 2.7, halfX: 0.30, halfZ: 0.30, height: 0.80 });
    addBox(group, woodMat, 2.4, 2.1, -3.8, 1.5, 0.7, 0.28); // Bookshelf
    const deskSignMat = makeSignMaterial(
      "UNIT 2B · LEASE & DEED WORKSTATION\n₦75,000 / MO · ₦18,000,000 FREEHOLD",
      "#1e3c28",
    );
    addBox(group, deskSignMat, 2.4, 1.72, -3.8, 1.6, 0.45, 0.06);
    addPowerOutlet(group, whiteMat, 3.2, 0.65, -3.95, 0);

    // 6. Master Bedroom (x: -6.8 to -1.2, z: 2.0 to 5.8)
    addBox(group, wallMat, -1.2, height / 2, 3.9, 0.2, height, 3.8); // Partition Wall
    addDoorCasing(group, darkMat, -1.2, 0, 2.2, 1.1, 2.4, Math.PI / 2);

    // Master Bed Procedural Fallback Group
    const proceduralBed = new THREE.Group();
    proceduralBed.name = "proceduralBed";
    group.add(proceduralBed);

    // Raised Wooden Bed Frame on 4 Corner Legs (shadow gap)
    for (const bx of [-5.2, -3.2]) {
      for (const bz of [2.8, 4.8]) {
        addCyl(proceduralBed, darkMat, bx, 0.08, bz, 0.04, 0.16);
      }
    }
    addBox(proceduralBed, darkMat, -4.2, 0.22, 3.8, 2.25, 0.14, 2.25); // Plinth base

    // Deep Tufted Mattress with rounded top profile
    addBox(proceduralBed, whiteMat, -4.2, 0.42, 3.8, 2.15, 0.26, 2.15);
    addBox(proceduralBed, whiteMat, -4.2, 0.56, 3.8, 2.08, 0.04, 2.08); // Pillow top

    // Folded Duvet with Contrast Terracotta Sahelian Bed Runner
    addBox(proceduralBed, this.materials.cloth, -4.2, 0.6, 4.2, 2.16, 0.08, 1.3);
    addBox(proceduralBed, this.materials.clothRed, -4.2, 0.61, 4.6, 2.18, 0.07, 0.45);

    // 4 Layered Pillows
    addBox(proceduralBed, whiteMat, -4.75, 0.65, 3.0, 0.75, 0.12, 0.45);
    addBox(proceduralBed, whiteMat, -3.65, 0.65, 3.0, 0.75, 0.12, 0.45);
    addBox(proceduralBed, this.materials.goldTrim || woodMat, -4.75, 0.74, 3.2, 0.6, 0.1, 0.35);
    addBox(proceduralBed, this.materials.goldTrim || woodMat, -3.65, 0.74, 3.2, 0.6, 0.1, 0.35);

    // Padded Headboard with Walnut Border & Fluted Channels
    addBox(proceduralBed, darkMat, -4.2, 1.05, 4.95, 2.45, 1.45, 0.1);
    addBox(proceduralBed, this.materials.cloth, -4.2, 1.05, 4.9, 2.25, 1.25, 0.06);
    for (const hx of [-0.6, -0.2, 0.2, 0.6]) {
      addBox(proceduralBed, darkMat, -4.2 + hx, 1.05, 4.88, 0.02, 1.2, 0.02, false); // Fluting
    }

    // Asynchronously prototype realistic 3D Bed (Vintage Day Bed with Duvet & Pillows)
    loadGLTFModel("/assets/furniture/vintage_day_bed/vintage_day_bed_1k.gltf").then((model) => {
      if (!model) return;
      fitModelToBounds(model, 2.25, 2.25, 1.25, -4.2, 4.25, 0.02, Math.PI);
      proceduralBed.visible = false;
      group.add(model);
    });
    // Framed art above bed
    addWallArtwork(group, darkMat, this.materials.cloth, -4.2, 2.2, 4.96, 1.8, 0.8, Math.PI);

    // Floating Nightstands with Bedside Touch Lamps
    addBox(group, woodMat, -5.7, 0.38, 4.7, 0.55, 0.45, 0.45);
    addBox(group, metalMat, -5.7, 0.38, 4.47, 0.1, 0.02, 0.02, false); // Pull
    addBox(group, woodMat, -2.7, 0.38, 4.7, 0.55, 0.45, 0.45);
    addBox(group, metalMat, -2.7, 0.38, 4.47, 0.1, 0.02, 0.02, false);
    addCyl(group, metalMat, -5.7, 0.66, 4.7, 0.03, 0.12);
    addCyl(group, metalMat, -2.7, 0.66, 4.7, 0.03, 0.12);
    addCyl(group, this.materials.lampGlow || whiteMat, -5.7, 0.82, 4.7, 0.14, 0.2);
    addCyl(group, this.materials.lampGlow || whiteMat, -2.7, 0.82, 4.7, 0.14, 0.2);
    // Duplex power outlets beside nightstands
    addPowerOutlet(group, whiteMat, -5.7, 0.55, 4.96, Math.PI);
    addPowerOutlet(group, whiteMat, -2.7, 0.55, 4.96, Math.PI);

    // Mirrored 2-Door Wardrobe
    addBox(group, woodMat, -6.4, 1.4, 3.0, 0.65, 2.4, 1.8);
    addBox(group, glassMat, -6.05, 1.4, 3.0, 0.04, 2.2, 1.6); // Mirror door
    addBox(group, metalMat, -6.03, 1.4, 2.4, 0.02, 0.6, 0.02); // Mirror handle

    // 7. Ensuite Bathroom (x: 1.2 to 6.8, z: 2.0 to 5.8)
    addBox(group, wallMat, 1.2, height / 2, 3.9, 0.2, height, 3.8); // Partition Wall
    addDoorCasing(group, darkMat, 1.2, 0, 2.2, 1.1, 2.4, -Math.PI / 2);

    // Ceramic Vanity Washbasin & Lighted Mirror
    addBox(group, this.materials.tileFloor || whiteMat, 3.2, 0.85, 5.2, 1.2, 0.85, 0.6);
    addBox(group, metalMat, 3.2, 1.15, 5.1, 0.08, 0.25, 0.15); // Chrome tap
    addBox(group, glassMat, 3.2, 1.85, 5.45, 0.9, 0.85, 0.04); // Lighted mirror
    addBox(group, this.materials.lampGlow || whiteMat, 3.2, 1.85, 5.44, 0.96, 0.91, 0.02, false); // Backlight glow frame
    // Ceramic Toilet & Cistern
    addBox(group, whiteMat, 5.0, 0.42, 5.2, 0.5, 0.42, 0.65);
    addBox(group, whiteMat, 5.0, 0.85, 5.45, 0.55, 0.5, 0.25);
    addCyl(group, metalMat, 5.0, 1.11, 5.45, 0.03, 0.02); // Dual flush button
    // Walk-in Glass Shower Stall
    addBox(group, glassMat, 5.4, 1.3, 3.0, 1.6, 2.4, 1.6);
    addBox(group, metalMat, 5.4, 2.2, 3.0, 0.25, 0.08, 0.25); // Rain head
    // Towel rack with towels
    addBox(group, metalMat, 2.0, 1.3, 5.47, 0.6, 0.04, 0.06);
    addBox(group, whiteMat, 2.0, 1.25, 5.45, 0.55, 0.35, 0.08);

    // Interactive Doors
    this.addInteractiveDoor(group, "apartment", "apt_bedroom_door", "Master Bedroom Door", -1.2, 0, 2.2, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "apartment", "apt_bathroom_door", "Bathroom Door", 1.2, 0, 2.2, 1.1, 2.4, 0.08, woodMat, cx, cz, false, colliders);
    this.addInteractiveDoor(group, "apartment", "apt_balcony_door", "Balcony Sliding Door", -3.4, 0, -4.0, 1.4, 2.4, 0.08, glassMat, cx, cz, true, colliders);

    // Multi-Room Atmospheric Point Lights with Warm Natural Color Temperatures
    // 1. Living room warm ambient pendant (3000K)
    const aptLivingLight = new THREE.PointLight("#fff5e6", 2.9, 22, 1.15);
    aptLivingLight.position.set(-3.4, height - 0.5, -0.6);
    aptLivingLight.userData.baseIntensity = 2.9;
    group.add(aptLivingLight);
    lights.push(aptLivingLight);

    // 2. Balcony window daylight bounce light entering into living area
    const aptBalconyBounce = new THREE.PointLight("#fff9eb", 1.8, 16, 1.2);
    aptBalconyBounce.position.set(-3.4, 2.2, -3.6);
    aptBalconyBounce.userData.baseIntensity = 1.8;
    group.add(aptBalconyBounce);
    lights.push(aptBalconyBounce);

    // 3. Bedroom cozy bedtime light (2700K)
    const aptBedLight = new THREE.PointLight("#ffe8cc", 2.5, 18, 1.15);
    aptBedLight.position.set(-4.2, height - 0.5, 3.8);
    aptBedLight.userData.baseIntensity = 2.5;
    group.add(aptBedLight);
    lights.push(aptBedLight);

    // 4. Kitchen bright culinary light (3200K)
    const aptKitchenLight = new THREE.PointLight("#fff8ec", 2.5, 18, 1.15);
    aptKitchenLight.position.set(3.6, height - 0.5, -0.6);
    aptKitchenLight.userData.baseIntensity = 2.5;
    group.add(aptKitchenLight);
    lights.push(aptKitchenLight);

    // 5. Bathroom clean vanity light (4500K)
    const aptBathLight = new THREE.PointLight("#ffffff", 2.2, 14, 1.15);
    aptBathLight.position.set(3.8, height - 0.5, 4.0);
    aptBathLight.userData.baseIntensity = 2.2;
    group.add(aptBathLight);
    lights.push(aptBathLight);

    // 6. Entrance Foyer warm greeting light
    const aptFoyerLight = new THREE.PointLight("#fff2dc", 2.2, 16, 1.15);
    aptFoyerLight.position.set(0, height - 0.5, 4.5);
    aptFoyerLight.userData.baseIntensity = 2.2;
    group.add(aptFoyerLight);
    lights.push(aptFoyerLight);

    // Colliders (shifted to world coordinates cx, cz)
    colliders.push(
      // Perimeter Boundary Walls (isPerimeterWall: true permits elevated camera to frame room without clipping)
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height, isPerimeterWall: true },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height, isPerimeterWall: true },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height, isPerimeterWall: true },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height, isPerimeterWall: true },
      // Bedroom & Bathroom Partition Walls
      { x: cx - 1.2, z: cz + 3.9, halfX: 0.15, halfZ: 1.9, height },
      { x: cx + 1.2, z: cz + 3.9, halfX: 0.15, halfZ: 1.9, height },
      // Living Room Sofa & Chaise
      { x: cx - 3.4, z: cz - 0.6, halfX: 1.8, halfZ: 0.6, height: 1.2 },
      { x: cx - 5.6, z: cz + 0.8, halfX: 0.6, halfZ: 1.2, height: 1.2 },
      { x: cx - 3.4, z: cz + 0.8, halfX: 0.85, halfZ: 0.5, height: 0.6 },
      // Living Room Designer Accent Armchair (clears hallway, prevents camera & player clipping)
      { x: cx + chairX, z: cz + chairZ, halfX: 0.44, halfZ: 0.44, height: 0.90 },
      // Media Credenza & TV
      { x: cx - 3.4, z: cz - 3.8, halfX: 1.9, halfZ: 0.3, height: 2.0 },
      // Balcony Railing
      { x: cx - 3.4, z: cz - 5.7, halfX: 2.9, halfZ: 0.1, height: 1.2 },
      // Kitchen Counter & Refrigerator
      { x: cx + 5.8, z: cz - 1.4, halfX: 0.8, halfZ: 2.2, height: 1.2 },
      { x: cx + 4.2, z: cz - 3.6, halfX: 0.5, halfZ: 0.5, height: 2.2 },
      // Dining Table
      { x: cx + 2.6, z: cz + 0.5, halfX: 1.0, halfZ: 0.7, height: 1.1 },
      // Study Desk
      { x: cx + 2.4, z: cz - 3.4, halfX: 0.9, halfZ: 0.5, height: 1.2 },
      // Master Bed & Wardrobe
      { x: cx - 4.2, z: cz + 3.8, halfX: 1.2, halfZ: 1.3, height: 1.4 },
      { x: cx - 6.4, z: cz + 3.0, halfX: 0.4, halfZ: 1.0, height: 2.4 },
      // Shower Stall & Vanity
      { x: cx + 5.4, z: cz + 3.0, halfX: 0.9, halfZ: 0.9, height: 2.4 },
      { x: cx + 4.2, z: cz + 5.2, halfX: 1.8, halfZ: 0.4, height: 1.2 },
    );

    this.interiors.set("apartment", {
      id: "apartment",
      name: "Airport View Apartments · Unit 2B",
      districtLabel: "AIRPORT ROAD · APARTMENTS",
      root: group,
      colliders,
      lights,
      height: 3.5,
      bounds: {
        minX: cx - width / 2,
        maxX: cx + width / 2,
        minZ: cz - depth / 2,
        maxZ: cz + depth / 2,
        minY: cy,
        maxY: cy + height,
      },
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + 1.8),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(48, 0, -43.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        // 1. Light switch near entrance vestibule (cx - 0.6, cz + 3.8)
        const distSwitch = pos.distanceTo(new THREE.Vector3(cx - 0.6, cy + 0.1, cz + 3.8));
        if (distSwitch <= 1.8) {
          return {
            prompt: this.lightsOn ? "Switch Off Apartment Lighting" : "Switch On Apartment Lighting",
            action: () => {
              const on = this.toggleInteriorLights("apartment");
              return { statusMessage: on ? "Unit 2B: Warm interior illumination active." : "Unit 2B: Interior lights dimmed." };
            },
          };
        }

        // 2a. Living room accent armchair seating (cx + chairX, cz + chairZ)
        const distArmchair = pos.distanceTo(new THREE.Vector3(cx + chairX, cy + 0.1, cz + chairZ));
        if (distArmchair <= 1.4) {
          return {
            prompt: "Sit & Rest on Accent Armchair",
            action: () => ({
              statusMessage: "Settled comfortably into the living room accent armchair. Peaceful moments at home.",
              sitDown: { label: "Unit 2B Accent Armchair", energyRestored: 20 },
              timeDeltaMinutes: 15,
            }),
          };
        }

        // 2b. Living room sofa seating (cx - 3.4, cz - 0.6)
        const distSofa = pos.distanceTo(new THREE.Vector3(cx - 3.4, cy + 0.1, cz - 0.6));
        if (distSofa <= 2.0) {
          return {
            prompt: "Sit & Rest on Living Room Sofa",
            action: () => ({
              statusMessage: "Relaxed comfortably on the living room sofa. Energy refreshed!",
              sitDown: { label: "Unit 2B Living Room Sofa", energyRestored: 20 },
              timeDeltaMinutes: 15,
            }),
          };
        }

        // 3. Living room TV media wall (cx - 3.4, cz - 3.2)
        const distTv = pos.distanceTo(new THREE.Vector3(cx - 3.4, cy + 0.1, cz - 3.2));
        if (distTv <= 2.4) {
          return {
            prompt: "Watch Kano State TV & News on 55\" Smart TV",
            action: () => ({
              statusMessage: "Watching Kano State TV on the 55\" Smart TV. News and NPFL match highlights broadcasting!",
              watchTv: { label: "Unit 2B Smart TV", energyRestored: 15 },
              timeDeltaMinutes: 30,
            }),
          };
        }

        // 4. Balcony bistro seating (cx - 3.4, cz - 4.8)
        const distBalcony = pos.distanceTo(new THREE.Vector3(cx - 3.4, cy + 0.1, cz - 4.8));
        if (distBalcony <= 2.2) {
          return {
            prompt: "Sit on Balcony Bistro Chair & Enjoy Sunset Breeze",
            action: () => ({
              statusMessage: "Stepped onto the private balcony looking over Airport Road. The evening Harmattan breeze is cool.",
              sitDown: { label: "Unit 2B Sunset Balcony", energyRestored: 15 },
              timeDeltaMinutes: 15,
            }),
          };
        }

        // 5. Kitchen meal preparation (cx + 5.2, cz - 1.4)
        const distKitchen = pos.distanceTo(new THREE.Vector3(cx + 5.2, cy + 0.1, cz - 1.4));
        if (distKitchen <= 1.6) {
          return {
            prompt: "Prepare & Eat Fresh Meal in Kitchen",
            action: () => ({
              statusMessage: "Cooked a delicious hot meal of rice, spicy dodo, and grilled chicken in the kitchen!",
              eatFood: { amount: 45, label: "Apartment Home Meal" },
              timeDeltaMinutes: 25,
            }),
          };
        }

        // 6. Kitchen refrigerator refreshment (cx + 4.2, cz - 3.6)
        const distFridge = pos.distanceTo(new THREE.Vector3(cx + 4.2, cy + 0.1, cz - 3.6));
        if (distFridge <= 1.4) {
          return {
            prompt: "Take Chilled Zobo from Refrigerator",
            action: () => ({
              statusMessage: "Grabbed a chilled bottle of spiced Zobo from the refrigerator! Refreshing and revitalizing.",
              drinkBeverage: { label: "Chilled Zobo Drink", hungerGain: 25, energyGain: 10 },
              timeDeltaMinutes: 5,
            }),
          };
        }

        // 7. Study / Workstation desk & PC (cx + 2.0, cz - 3.4)
        const distWorkstation = pos.distanceTo(new THREE.Vector3(cx + 2.0, cy + 0.1, cz - 3.4));
        if (distWorkstation <= 1.8) {
          if (state.ownedProperties?.includes("unit-2b")) {
            return {
              prompt: "Workstation: Check Remote Freelance Contracts & Title Deed",
              action: () => ({
                statusMessage: "Unit 2B Executive Desk: Accessing remote client contracts. Freehold title held.",
                freelanceContractAction: true,
              }),
            };
          }
          if (state.hasApartmentRental) {
            return {
              prompt: "Workstation: Remote Freelance Contracts (or Buy Freehold for ₦18,000,000)",
              action: () => {
                if (state.cash >= 18000000) {
                  return {
                    statusMessage: "Congratulations! Freehold Certificate of Occupancy acquired for Unit 2B Airport View Apartments!",
                    cashDelta: -18000000,
                    purchasedProperty: "unit-2b",
                  };
                }
                return {
                  statusMessage: "Unit 2B Workstation: Checking remote client contracts.",
                  freelanceContractAction: true,
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

        // 8. Bedroom Master Bed (cx - 4.2, cz + 3.8)
        const distBed = pos.distanceTo(new THREE.Vector3(cx - 4.2, cy + 0.1, cz + 3.8));
        if (distBed <= 2.4) {
          if (state.hasApartmentRental || state.ownedProperties?.includes("unit-2b")) {
            return {
              prompt: "Sleep & Rest in Master Bedroom (Advance 6 Hours)",
              action: () => ({
                statusMessage: "Resting comfortably in Unit 2B bedroom. Morning has broken and energy is 100%!",
                sleepInBed: { hours: 6 },
                timeDeltaMinutes: 360,
              }),
            };
          }
        }

        // 9. Ensuite Bathroom Shower (cx + 5.2, cz + 3.0)
        const distShower = pos.distanceTo(new THREE.Vector3(cx + 5.2, cy + 0.1, cz + 3.0));
        if (distShower <= 2.2) {
          if (state.hasApartmentRental || state.ownedProperties?.includes("unit-2b")) {
            return {
              prompt: "Take Hot Shower in Ensuite Bathroom",
              action: () => ({
                statusMessage: "Took a refreshing hot shower! Sahel dust washed away and hygiene restored to 100%.",
                takeShower: { label: "Unit 2B Ensuite Shower" },
              }),
            };
          }
        }

        // 10. Ensuite Bathroom Vanity Sink (cx + 3.2, cz + 5.0)
        const distSink = pos.distanceTo(new THREE.Vector3(cx + 3.2, cy + 0.1, cz + 5.0));
        if (distSink <= 2.0) {
          if (state.hasApartmentRental || state.ownedProperties?.includes("unit-2b")) {
            return {
              prompt: "Wash Hands at Vanity Basin Sink",
              action: () => ({
                statusMessage: "Washed hands with scented soap at the ceramic vanity sink. Feeling clean and fresh!",
                washHands: { label: "Unit 2B Ceramic Vanity Sink" },
              }),
            };
          }
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
    const lights: THREE.PointLight[] = [];
    const width = 14;
    const depth = 22;
    const height = 7.5;

    // Stone Floor & Timber Roof with Downward-Facing Cutaway Ceiling
    addBox(group, this.materials.stone, 0, 0, 0, width, 0.1, depth, false);
    addCeiling(group, this.materials.wood, height, width, depth);

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
    const sanctuaryLight = new THREE.PointLight("#fff2dc", 3.4, 28, 1.05);
    sanctuaryLight.position.set(0, height - 1.2, 0);
    sanctuaryLight.userData.baseIntensity = 3.4;
    group.add(sanctuaryLight);
    lights.push(sanctuaryLight);

    const altarLight = new THREE.PointLight("#fff8e0", 2.8, 18, 1.05);
    altarLight.position.set(0, 4.8, -depth / 2 + 3);
    altarLight.userData.baseIntensity = 2.8;
    group.add(altarLight);
    lights.push(altarLight);

    const entranceLight = new THREE.PointLight("#ffe8cc", 2.5, 20, 1.05);
    entranceLight.position.set(0, height - 1.5, depth / 2 - 4);
    entranceLight.userData.baseIntensity = 2.5;
    group.add(entranceLight);
    lights.push(entranceLight);

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
      lights,
      height: 7.5,
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
    const lights: THREE.PointLight[] = [];
    const width = 11;
    const depth = 8;
    const height = 3.4;

    // Floor & Ceiling
    addBox(group, this.materials.concrete, 0, 0, 0, width, 0.1, depth, false);
    addCeiling(group, this.materials.ceilingMat || this.materials.white, height, width, depth);

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

    const stationLight = new THREE.PointLight("#f1f5f9", 2.8, 20, 1.05);
    stationLight.position.set(0, height - 0.5, 0);
    stationLight.userData.baseIntensity = 2.8;
    group.add(stationLight);
    lights.push(stationLight);

    const deskLight = new THREE.PointLight("#f8fafc", 2.4, 16, 1.05);
    deskLight.position.set(-2.0, height - 0.5, -1.0);
    deskLight.userData.baseIntensity = 2.4;
    group.add(deskLight);
    lights.push(deskLight);

    const karotaLight = new THREE.PointLight("#f1f5f9", 2.4, 16, 1.05);
    karotaLight.position.set(2.8, height - 0.5, -1.2);
    karotaLight.userData.baseIntensity = 2.4;
    group.add(karotaLight);
    lights.push(karotaLight);

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
      lights,
      height: 3.4,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + 1.8),
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
    const lights: THREE.PointLight[] = [];
    const width = 14;
    const depth = 11;
    const height = 3.8;

    // Floor (Polished Terrazzo Tiles) & Ceiling
    addBox(group, this.materials.tileFloor || this.materials.concrete, 0, 0, 0, width, 0.1, depth, false);
    addCeiling(group, this.materials.ceilingMat || this.materials.white, height, width, depth);

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

    const restoLight1 = new THREE.PointLight("#ffe8c4", 2.9, 22, 1.05);
    restoLight1.position.set(-2.5, height - 0.5, -1);
    restoLight1.userData.baseIntensity = 2.9;
    group.add(restoLight1);
    lights.push(restoLight1);

    const restoLight2 = new THREE.PointLight("#ffd5a4", 2.7, 22, 1.05);
    restoLight2.position.set(3.0, height - 0.5, 1.5);
    restoLight2.userData.baseIntensity = 2.7;
    group.add(restoLight2);
    lights.push(restoLight2);

    const grillGlow = new THREE.PointLight("#ff8c42", 2.3, 16, 1.05);
    grillGlow.position.set(counterX, 2.0, counterZ);
    grillGlow.userData.baseIntensity = 2.3;
    group.add(grillGlow);
    lights.push(grillGlow);

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
      lights,
      height: 3.8,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.8),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(16, 0, -36.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        const distCounter = pos.distanceTo(new THREE.Vector3(cx + counterX, cy + 0.1, cz + counterZ));
        if (distCounter <= 2.5) {
          return {
            prompt: "Order Kano Suya & Jollof Platter (₦3,500)",
            action: () => {
              if (state.cash < 3500) {
                return { statusMessage: "Insufficient cash: You need ₦3,500 for the special platter." };
              }
              return {
                statusMessage: "Delicious Kano Beef Suya & Jollof Rice served! Hunger fully satisfied and recharged.",
                cashDelta: -3500,
                eatFood: { amount: 65, label: "Kano Beef Suya & Jollof Platter" },
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
    const lights: THREE.PointLight[] = [];
    const width = 13;
    const depth = 10;
    const height = 3.6;

    addBox(group, this.materials.black, 0, 0, 0, width, 0.1, depth, false);
    addCeiling(group, this.materials.darkTrim, height, width, depth);

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

    const ambientWhite = new THREE.PointLight("#f8fafc", 2.4, 22, 1.05);
    ambientWhite.position.set(0, height - 0.4, 0);
    ambientWhite.userData.baseIntensity = 2.4;
    group.add(ambientWhite);
    lights.push(ambientWhite);

    const cyberLight1 = new THREE.PointLight("#18d6e8", 2.8, 18, 1.05);
    cyberLight1.position.set(-2.5, height - 0.5, -1);
    cyberLight1.userData.baseIntensity = 2.8;
    group.add(cyberLight1);
    lights.push(cyberLight1);

    const cyberLight2 = new THREE.PointLight("#e8188e", 2.8, 18, 1.05);
    cyberLight2.position.set(2.5, height - 0.5, 1);
    cyberLight2.userData.baseIntensity = 2.8;
    group.add(cyberLight2);
    lights.push(cyberLight2);

    const cashierLight = new THREE.PointLight("#e0f2fe", 2.2, 16, 1.05);
    cashierLight.position.set(0, height - 0.5, depth / 2 - 2.5);
    cashierLight.userData.baseIntensity = 2.2;
    group.add(cashierLight);
    lights.push(cashierLight);

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
      lights,
      height: 3.6,
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
    addCeiling(group, this.materials.ceilingMat || this.materials.roof, height, width, depth);

    // Showroom Lighting Fixtures
    for (const lx of [-5, 0, 5]) {
      for (const lz of [-4, 0, 4]) {
        const light = new THREE.PointLight("#fff9eb", 2.4, 16, 1.05);
        light.position.set(cx + lx, cy + height - 0.4, cz + lz);
        light.userData.baseIntensity = 2.4;
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
      height: 4.2,
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

  public getFurnitureInteraction(playerPos: THREE.Vector3): NonNullable<RenderedFurnitureResult["interaction"]> | null {
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

  public restoreInteriorFurnitureOpacity(interiorId: InteriorId) {
    const zone = this.interiors.get(interiorId);
    if (!zone) return;
    zone.root.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.isFurniture) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (mat && "opacity" in mat) {
            const baseOpacity = (mat.userData?.baseOpacity as number) ?? 1.0;
            mat.opacity = baseOpacity;
            mat.transparent = false;
          }
        }
      }
    });
  }

  public getActiveZone(): InteriorZone | null {
    if (!this.activeInterior) return null;
    return this.interiors.get(this.activeInterior) ?? null;
  }
}
