import * as THREE from "three";
import { makeSignMaterial } from "./materials";
import type { Collider, GameMaterials, InteriorId } from "./types";

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
  checkInteraction?: (
    playerPos: THREE.Vector3,
    state: {
      cash: number;
      trafficFine: number;
      hasApartmentRental: boolean;
      score?: number;
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
    };
  } | null;
}

export class BuildingInteriorManager {
  public readonly root = new THREE.Group();
  public interiors = new Map<InteriorId, InteriorZone>();
  public activeInterior: InteriorId | null = null;
  public outdoorSavedPosition = new THREE.Vector3(-4, 0, -4);
  public outdoorSavedYaw = 0;

  constructor(private readonly materials: GameMaterials) {
    this.root.name = "building-interiors-root";
    this.buildHouseInterior();
    this.buildApartmentInterior();
    this.buildChurchInterior();
    this.buildPolicePostInterior();
    this.buildRestaurantInterior();
    this.buildGamingHubInterior();
  }

  // 1. Modern Villa Interior (Al-Baraka Villa)
  private buildHouseInterior() {
    const cx = 220;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const width = 12;
    const depth = 10;
    const height = 3.6;

    // Floor (Marble Tiles) & Ceiling
    addBox(group, this.materials.tileFloor || this.materials.sidewalk, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, this.materials.white, 0, height, 0, width, 0.1, depth, false);

    // Perimeter Walls
    addBox(group, this.materials.white, 0, height / 2, -depth / 2, width, height, 0.2); // North
    addBox(group, this.materials.white, 0, height / 2, depth / 2, width, height, 0.2);  // South
    addBox(group, this.materials.white, -width / 2, height / 2, 0, 0.2, height, depth); // West
    addBox(group, this.materials.white, width / 2, height / 2, 0, 0.2, height, depth);  // East

    // Living Room Area
    // Large L-Shaped Sectional Sofa
    addBox(group, this.materials.darkTrim, -2.5, 0.45, -2.2, 3.2, 0.5, 1.1);
    addBox(group, this.materials.darkTrim, -3.6, 0.45, -0.6, 1.0, 0.5, 2.2);
    addBox(group, this.materials.darkTrim, -2.5, 0.85, -2.65, 3.2, 0.5, 0.25);
    addBox(group, this.materials.darkTrim, -4.0, 0.85, -0.6, 0.25, 0.5, 2.2);
    // Coffee table
    addBox(group, this.materials.wood, -2.4, 0.32, -0.7, 1.6, 0.35, 0.9);
    // Decorative Kano area rug
    addBox(group, this.materials.clothRed, -2.4, 0.06, -1.1, 3.8, 0.02, 3.2, false);

    // Entertainment Credenza & 65" TV
    addBox(group, this.materials.wood, 2.8, 0.45, -4.5, 3.2, 0.6, 0.65);
    addBox(group, this.materials.black, 2.8, 1.5, -4.6, 2.4, 1.3, 0.08); // TV Screen
    addBox(group, this.materials.metal, 2.8, 0.8, -4.55, 0.8, 0.08, 0.15); // Soundbar

    // Ceiling Fan
    addCyl(group, this.materials.metal, 0, height - 0.35, 0, 0.15, 0.4);
    for (let i = 0; i < 4; i++) {
      const blade = addBox(group, this.materials.wood, 0, height - 0.45, 0, 1.4, 0.02, 0.18, false);
      blade.rotation.y = (i * Math.PI) / 2;
    }

    // Kitchenette Breakfast Bar
    addBox(group, this.materials.concrete, 3.2, 0.95, 1.2, 0.8, 1.0, 3.4);
    addBox(group, this.materials.darkTrim, 3.2, 1.02, 1.2, 1.0, 0.08, 3.6); // Granite top
    addCyl(group, this.materials.wood, 2.3, 0.65, 0.2, 0.25, 0.65); // Stool 1
    addCyl(group, this.materials.wood, 2.3, 0.65, 2.2, 0.25, 0.65); // Stool 2

    // Bedroom Partition Wall & Bed
    addBox(group, this.materials.white, -1.8, height / 2, 2.6, 0.2, height, 4.6);
    // Queen Bed
    addBox(group, this.materials.wood, -3.8, 0.38, 2.6, 2.2, 0.45, 2.4);
    addBox(group, this.materials.white, -3.8, 0.62, 2.6, 2.1, 0.22, 2.3); // Mattress
    addBox(group, this.materials.cloth, -3.8, 0.68, 3.2, 2.1, 0.14, 1.2); // Blanket
    addBox(group, this.materials.white, -3.4, 0.78, 1.7, 0.65, 0.18, 0.45); // Pillow 1
    addBox(group, this.materials.white, -4.2, 0.78, 1.7, 0.65, 0.18, 0.45); // Pillow 2
    addBox(group, this.materials.wood, -3.8, 1.15, 1.35, 2.4, 1.1, 0.12); // Headboard

    // Front Exit Door
    const doorMesh = addBox(group, this.materials.wood, 0, 1.1, depth / 2 - 0.08, 1.2, 2.2, 0.1);
    doorMesh.name = "exit-door";
    addBox(group, this.materials.goldTrim || this.materials.trim, 0.42, 1.1, depth / 2 - 0.02, 0.08, 0.15, 0.08); // Brass handle

    // Indoor Warm Lighting
    const roomLight = new THREE.PointLight("#fff0d4", 1.8, 14, 1.2);
    roomLight.position.set(0, height - 0.6, 0);
    group.add(roomLight);

    const bedLight = new THREE.PointLight("#ffe0b2", 1.0, 7, 1.4);
    bedLight.position.set(-3.8, height - 0.8, 2.6);
    group.add(bedLight);

    // Colliders (shifted to world coordinates cx, cz)
    colliders.push(
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      // Sectional sofa collider
      { x: cx - 2.5, z: cz - 2.2, halfX: 1.7, halfZ: 0.7, height: 1.2 },
      { x: cx - 3.6, z: cz - 0.6, halfX: 0.6, halfZ: 1.2, height: 1.2 },
      // TV Credenza
      { x: cx + 2.8, z: cz - 4.5, halfX: 1.7, halfZ: 0.5, height: 1.8 },
      // Breakfast counter
      { x: cx + 3.2, z: cz + 1.2, halfX: 0.6, halfZ: 1.8, height: 1.2 },
      // Bedroom wall
      { x: cx - 1.8, z: cz + 2.6, halfX: 0.2, halfZ: 2.3, height },
      // Bed
      { x: cx - 3.8, z: cz + 2.6, halfX: 1.2, halfZ: 1.3, height: 1.2 },
    );

    this.interiors.set("house", {
      id: "house",
      name: "Al-Baraka Modern Villa",
      districtLabel: "RESIDENTIAL QUARTER · INDOORS",
      root: group,
      colliders,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.6),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(44, 0, 45),
      outdoorDoorYaw: 0,
    });
  }

  // 2. Multi-Storey Apartment Interior (Unit 2B - Airport View Apartments)
  private buildApartmentInterior() {
    const cx = 260;
    const cy = -60;
    const cz = 0;
    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    this.root.add(group);

    const colliders: Collider[] = [];
    const width = 11;
    const depth = 9;
    const height = 3.4;

    // Floor & Ceiling
    addBox(group, this.materials.tileFloor || this.materials.concrete, 0, 0, 0, width, 0.1, depth, false);
    addBox(group, this.materials.white, 0, height, 0, width, 0.1, depth, false);

    // Walls
    addBox(group, this.materials.white, 0, height / 2, -depth / 2, width, height, 0.2); // North
    addBox(group, this.materials.white, 0, height / 2, depth / 2, width, height, 0.2);  // South
    addBox(group, this.materials.white, -width / 2, height / 2, 0, 0.2, height, depth); // West
    addBox(group, this.materials.white, width / 2, height / 2, 0, 0.2, height, depth);  // East

    // Living Room & Balcony
    addBox(group, this.materials.cloth, -2.2, 0.45, -2.2, 2.6, 0.5, 1.0);
    addBox(group, this.materials.cloth, -2.2, 0.85, -2.65, 2.6, 0.5, 0.25);
    addBox(group, this.materials.wood, -2.2, 0.3, -0.9, 1.4, 0.35, 0.8);

    // Balcony Sliding Glass Door (East Wall)
    addBox(group, this.materials.glassLit, 5.38, 1.4, -1.5, 0.08, 2.4, 2.6);
    addBox(group, this.materials.metal, 5.38, 1.4, -1.5, 0.12, 2.45, 0.08); // Frame divider

    // Dining Set
    addBox(group, this.materials.wood, 2.2, 0.74, 1.8, 1.6, 0.08, 1.2);
    for (const sx of [-0.65, 0.65]) {
      for (const sz of [-0.45, 0.45]) {
        addCyl(group, this.materials.metal, 2.2 + sx, 0.36, 1.8 + sz, 0.035, 0.72);
      }
    }
    // Dining chairs
    addBox(group, this.materials.darkTrim, 2.2, 0.45, 0.8, 0.45, 0.45, 0.45);
    addBox(group, this.materials.darkTrim, 2.2, 0.45, 2.8, 0.45, 0.45, 0.45);

    // Rental Desk / Signboard
    const deskMat = this.materials.wood;
    addBox(group, deskMat, 2.8, 0.5, -3.2, 1.6, 0.85, 0.9);
    const signMat = makeSignMaterial("UNIT 2B · RENTAL DESK\n₦75,000 / MO", "#1e3c28");
    addBox(group, signMat, 2.8, 1.35, -3.2, 1.4, 0.65, 0.08);

    // Bedroom Partition & Bed
    addBox(group, this.materials.white, -1.6, height / 2, 2.2, 0.2, height, 4.4);
    addBox(group, this.materials.wood, -3.4, 0.38, 2.4, 2.0, 0.45, 2.2);
    addBox(group, this.materials.white, -3.4, 0.62, 2.4, 1.9, 0.22, 2.1);

    // Exit Door
    addBox(group, this.materials.wood, 0, 1.1, depth / 2 - 0.08, 1.2, 2.2, 0.1);

    // Warm Light
    const aptLight = new THREE.PointLight("#fff5e6", 1.8, 13, 1.3);
    aptLight.position.set(0, height - 0.6, 0);
    group.add(aptLight);

    colliders.push(
      { x: cx, z: cz - depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx, z: cz + depth / 2, halfX: width / 2, halfZ: 0.3, height },
      { x: cx - width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      { x: cx + width / 2, z: cz, halfX: 0.3, halfZ: depth / 2, height },
      // Sofa
      { x: cx - 2.2, z: cz - 2.2, halfX: 1.4, halfZ: 0.65, height: 1.1 },
      // Dining table
      { x: cx + 2.2, z: cz + 1.8, halfX: 0.9, halfZ: 0.7, height: 1.0 },
      // Rental Desk
      { x: cx + 2.8, z: cz - 3.2, halfX: 0.9, halfZ: 0.6, height: 1.8 },
      // Bedroom Wall & Bed
      { x: cx - 1.6, z: cz + 2.2, halfX: 0.2, halfZ: 2.3, height },
      { x: cx - 3.4, z: cz + 2.4, halfX: 1.1, halfZ: 1.2, height: 1.1 },
    );

    this.interiors.set("apartment", {
      id: "apartment",
      name: "Airport View Apartments · Unit 2B",
      districtLabel: "AIRPORT ROAD · APARTMENTS",
      root: group,
      colliders,
      spawnPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.6),
      spawnYaw: Math.PI,
      exitPoint: new THREE.Vector3(cx, cy + 0.1, cz + depth / 2 - 1.1),
      outdoorDoorPosition: new THREE.Vector3(48, 0, -43.5),
      outdoorDoorYaw: 0,
      checkInteraction: (pos, state) => {
        // Distance to rental desk (cx + 2.8, cz - 3.2)
        const d = pos.distanceTo(new THREE.Vector3(cx + 2.8, cy + 0.1, cz - 3.2));
        if (d <= 2.2) {
          if (state.hasApartmentRental) {
            return {
              prompt: "Apartment Rented · View Lease Status",
              action: () => ({
                statusMessage: "You are the official tenant of Unit 2B. Rent paid for current month.",
              }),
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

  // 3. St. Stephen's Anglican Church Interior
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
            prompt: "Kneel in Prayer / Church Offering (₦1,000)",
            action: () => {
              if (state.cash < 1000) {
                return { statusMessage: "You offer a silent prayer of gratitude and hope." };
              }
              return {
                statusMessage: "Offering given (₦1,000). Pastor: 'Peace and blessings be upon your household.'",
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
            prompt: `Pay KAROTA Fine (₦${state.trafficFine.toLocaleString()}) & Clear Vehicle Notice`,
            action: () => {
              if (state.cash < state.trafficFine) {
                return { statusMessage: `Insufficient cash: You need ₦${state.trafficFine.toLocaleString()} to clear this fine.` };
              }
              const fineAmount = state.trafficFine;
              return {
                statusMessage: `Penalty Paid (₦${fineAmount}). Official KAROTA clearance receipt issued!`,
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
    const menuSign = makeSignMaterial("AREWA KITCHEN SPECIALS · JOLLOF RICE ₦3,500 · KANO SUYA ₦2,500 · CHAPMAN ₦1,200", "#4c1a0e");
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
            prompt: "Order Kano Suya & Jollof Platter (₦3,500)",
            action: () => {
              if (state.cash < 3500) {
                return { statusMessage: "Insufficient cash: You need ₦3,500 for the special platter." };
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
            prompt: "Play Kano Street Drift Tournament (₦1,000 Entry)",
            action: () => {
              if (state.cash < 1000) {
                return { statusMessage: "Insufficient cash: You need ₦1,000 for tournament entry fee." };
              }
              const score = Math.floor(7000 + Math.random() * 2800);
              const won = score >= 8200;
              if (won) {
                return {
                  statusMessage: `Championship Victory! Score: ${score.toLocaleString()} pts! Won 1st Place & ₦5,000 prize!`,
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

        return null;
      },
    });
  }

  public getActiveZone(): InteriorZone | null {
    if (!this.activeInterior) return null;
    return this.interiors.get(this.activeInterior) ?? null;
  }
}
