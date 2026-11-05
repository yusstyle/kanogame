import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Collider, GameMaterials } from "./types";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const unitSphere = new THREE.SphereGeometry(1, 16, 12);

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  castShadow = true,
) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  castShadow = true,
) {
  const mesh = new THREE.Mesh(unitCylinder, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(radiusTop * 2, height, radiusBottom * 2);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSphere(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  radius: number,
  castShadow = true,
) {
  const mesh = new THREE.Mesh(unitSphere, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(radius, radius, radius);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// -------------------------------------------------------------
// MODULE-SCOPED SHARED MATERIALS FOR BATCHING & LOW DRAW CALLS
// -------------------------------------------------------------
export const sharedMaterials = {
  granite: new THREE.MeshStandardMaterial({
    color: "#5a6265",
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  }),
  greenBase: new THREE.MeshStandardMaterial({
    color: "#385437",
    roughness: 0.88,
  }),
  whiteMarble: new THREE.MeshStandardMaterial({
    color: "#f5f6f8",
    roughness: 0.25,
  }),
  greenDome: new THREE.MeshStandardMaterial({
    color: "#196f3d",
    roughness: 0.35,
    metalness: 0.2,
  }),
  goldAccents: new THREE.MeshStandardMaterial({
    color: "#d4ac0d",
    roughness: 0.2,
    metalness: 0.75,
  }),
  goldDome: new THREE.MeshStandardMaterial({
    color: "#e5b73b",
    roughness: 0.15,
    metalness: 0.85,
  }),
  stoneCream: new THREE.MeshStandardMaterial({
    color: "#e8e5dc",
    roughness: 0.45,
  }),
  stainedGlass: new THREE.MeshStandardMaterial({
    color: "#2471a3",
    roughness: 0.2,
    metalness: 0.3,
    emissive: "#1b4f72",
    emissiveIntensity: 0.35,
  }),
  glassBlue: new THREE.MeshStandardMaterial({
    color: "#1a5276",
    roughness: 0.15,
    metalness: 0.65,
  }),
  bronzeTrim: new THREE.MeshStandardMaterial({
    color: "#b9770e",
    roughness: 0.35,
    metalness: 0.7,
  }),
  glassGreen: new THREE.MeshStandardMaterial({
    color: "#117864",
    roughness: 0.2,
    metalness: 0.55,
  }),
  darkSpandrel: new THREE.MeshStandardMaterial({
    color: "#192428",
    roughness: 0.4,
  }),
  facadeWhite: new THREE.MeshStandardMaterial({
    color: "#f0f2f5",
    roughness: 0.35,
  }),
  mallGlass: new THREE.MeshStandardMaterial({
    color: "#2980b9",
    roughness: 0.15,
    metalness: 0.7,
  }),
  orangeAccent: new THREE.MeshStandardMaterial({
    color: "#d35400",
    roughness: 0.3,
  }),
  stoneBeige: new THREE.MeshStandardMaterial({
    color: "#eae4d8",
    roughness: 0.4,
  }),
  glassTint: new THREE.MeshStandardMaterial({
    color: "#2c3e50",
    roughness: 0.2,
    metalness: 0.5,
  }),
  poolBlue: new THREE.MeshStandardMaterial({
    color: "#1abc9c",
    roughness: 0.1,
    metalness: 0.3,
  }),
  stuccoWhite: new THREE.MeshStandardMaterial({
    color: "#f7f9fa",
    roughness: 0.25,
  }),
  cedarWood: new THREE.MeshStandardMaterial({
    color: "#784212",
    roughness: 0.55,
  }),
  poolWater: new THREE.MeshStandardMaterial({
    color: "#00a896",
    roughness: 0.1,
    metalness: 0.2,
  }),
  nnpcGreen: new THREE.MeshStandardMaterial({
    color: "#196f3d",
    roughness: 0.3,
  }),
  nnpcYellow: new THREE.MeshStandardMaterial({
    color: "#f1c40f",
    roughness: 0.25,
  }),
  lawn: new THREE.MeshStandardMaterial({
    color: "#2d6a4f",
    roughness: 0.9,
  }),
  water: new THREE.MeshStandardMaterial({
    color: "#0077b6",
    roughness: 0.1,
    metalness: 0.35,
  }),
  trussGreen: new THREE.MeshStandardMaterial({
    color: "#1e8449",
    roughness: 0.4,
  }),
  tollBlue: new THREE.MeshStandardMaterial({
    color: "#154360",
    roughness: 0.3,
  }),
  signGreen: new THREE.MeshStandardMaterial({
    color: "#1e8449",
    roughness: 0.2,
  }),
  airportWhite: new THREE.MeshStandardMaterial({
    color: "#f4f6f7",
    roughness: 0.25,
  }),
  terminalGlass: new THREE.MeshStandardMaterial({
    color: "#2471a3",
    roughness: 0.15,
    metalness: 0.7,
  }),
  palmFoliage: new THREE.MeshStandardMaterial({
    color: "#2e7d32",
    roughness: 0.65,
  }),
  palmTrunk: new THREE.MeshStandardMaterial({
    color: "#5d4037",
    roughness: 0.9,
  }),
  poleMat: new THREE.MeshStandardMaterial({
    color: "#bdc3c7",
    roughness: 0.35,
    metalness: 0.8,
  }),
};

// Prebuilt shared geometries for InstancedMesh
function buildSharedPalmCrownGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const frond = new THREE.BoxGeometry(3.6, 0.1, 0.7);
    const m = new THREE.Matrix4();
    const rotZ = new THREE.Matrix4().makeRotationZ(-0.35);
    const rotY = new THREE.Matrix4().makeRotationY(angle);
    const trans = new THREE.Matrix4().makeTranslation(Math.cos(angle) * 1.6, 9.2, Math.sin(angle) * 1.6);
    m.multiply(trans).multiply(rotY).multiply(rotZ);
    frond.applyMatrix4(m);
    geos.push(frond);
  }
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

const sharedPalmTrunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 9, 10);
sharedPalmTrunkGeo.translate(0, 4.5, 0);
const sharedPalmCrownGeo = buildSharedPalmCrownGeometry();

function buildStreetlightPoleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pole = new THREE.CylinderGeometry(0.12, 0.18, 9, 8);
  pole.translate(0, 4.5, 0);
  parts.push(pole);

  const panel = new THREE.BoxGeometry(1.4, 0.1, 0.9);
  panel.translate(0, 9.2, 0);
  parts.push(panel);

  const armL = new THREE.BoxGeometry(1.8, 0.1, 0.2);
  armL.translate(-1.2, 8.6, 0);
  parts.push(armL);

  const armR = new THREE.BoxGeometry(1.8, 0.1, 0.2);
  armR.translate(1.2, 8.6, 0);
  parts.push(armR);

  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

function buildStreetlightLampGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lampL = new THREE.BoxGeometry(0.8, 0.2, 0.4);
  lampL.translate(-1.8, 8.4, 0);
  parts.push(lampL);

  const lampR = new THREE.BoxGeometry(0.8, 0.2, 0.4);
  lampR.translate(1.8, 8.4, 0);
  parts.push(lampR);

  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

const sharedStreetlightPoleGeo = buildStreetlightPoleGeometry();
const sharedStreetlightLampGeo = buildStreetlightLampGeometry();

// -------------------------------------------------------------
// 1. ASO ROCK GRANITE INSELBERG MONOLITH
// -------------------------------------------------------------
export function createAsoRockMonolith(materials: GameMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = "AsoRockMonolith";

  const tiers = [
    { y: 35, width: 220, height: 70, depth: 140, color: sharedMaterials.granite },
    { y: 65, width: 180, height: 60, depth: 110, color: sharedMaterials.granite },
    { y: 92, width: 140, height: 45, depth: 85, color: sharedMaterials.granite },
    { y: 115, width: 95, height: 35, depth: 60, color: sharedMaterials.granite },
  ];

  tiers.forEach((t) => {
    const ridge = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), t.color);
    ridge.position.set(0, t.y, 0);
    ridge.scale.set(t.width * 0.5, t.height * 0.5, t.depth * 0.5);
    ridge.castShadow = true;
    ridge.receiveShadow = true;
    group.add(ridge);
  });

  // Lush foothills around base
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const rad = 110 + (i % 2) * 25;
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), sharedMaterials.greenBase);
    hill.position.set(Math.cos(angle) * rad, 12, Math.sin(angle) * (rad * 0.65));
    hill.scale.set(38 + (i % 3) * 10, 24, 34 + (i % 2) * 8);
    hill.receiveShadow = true;
    group.add(hill);
  }

  return group;
}

// -------------------------------------------------------------
// 2. THREE ARMS ZONE CIVIC COMPLEX / NATIONAL ASSEMBLY
// -------------------------------------------------------------
export function createThreeArmsCivicComplex(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "ThreeArmsCivicComplex";

  // 1. Grand Tiered Podium Steps
  addBox(root, sharedMaterials.whiteMarble, 0, 0.6, 0, 56, 1.2, 42);
  addBox(root, sharedMaterials.whiteMarble, 0, 1.8, 0, 50, 1.2, 36);
  colliders.push({ x, z, halfX: 25, halfZ: 18, height: 3.5 });

  // 2. Main Hall Edifice
  addBox(root, sharedMaterials.whiteMarble, 0, 7.5, 0, 44, 10, 30);
  colliders.push({ x, z, halfX: 22, halfZ: 15, height: 16 });

  // 3. Colonnade Facade (Front Entrance)
  for (let c = -18; c <= 18; c += 4.5) {
    addCylinder(root, sharedMaterials.whiteMarble, c, 7.5, 15.5, 0.45, 0.45, 10);
  }

  // 4. Portico Pediment with Nigerian Coat of Arms relief
  addBox(root, sharedMaterials.whiteMarble, 0, 13.5, 15.5, 42, 2.2, 3);
  addBox(root, sharedMaterials.goldAccents, 0, 13.5, 17.1, 4, 1.4, 0.2);

  // 5. Soaring Central Green Dome
  addCylinder(root, sharedMaterials.whiteMarble, 0, 14.5, 0, 7.5, 7.5, 4);
  const dome = addSphere(root, sharedMaterials.greenDome, 0, 17.5, 0, 8.5);
  dome.scale.set(8.5, 9.5, 8.5);

  // Golden Spire & Lantern
  addCylinder(root, sharedMaterials.goldAccents, 0, 27.5, 0, 0.2, 0.6, 6);

  // Nigerian National Flags on Ceremonial Flagpoles
  for (const fx of [-15, 15]) {
    addCylinder(root, materials.metal, fx, 8, 18, 0.08, 0.08, 16);
    addBox(root, sharedMaterials.greenDome, fx + 1.2, 14.5, 18, 0.8, 1.4, 0.04);
    addBox(root, sharedMaterials.whiteMarble, fx + 2.0, 14.5, 18, 0.8, 1.4, 0.04);
    addBox(root, sharedMaterials.greenDome, fx + 2.8, 14.5, 18, 0.8, 1.4, 0.04);
  }

  return root;
}

// -------------------------------------------------------------
// 3. ABUJA NATIONAL MOSQUE WITH GOLDEN DOME & 4 PENCIL MINARETS
// -------------------------------------------------------------
export function createAbujaNationalMosque(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "AbujaNationalMosque";

  // Main Prayer Hall
  addBox(root, sharedMaterials.whiteMarble, 0, 6, 0, 36, 12, 36);
  colliders.push({ x, z, halfX: 18, halfZ: 18, height: 16 });

  // Golden Central Dome
  addCylinder(root, sharedMaterials.whiteMarble, 0, 13.5, 0, 9, 9, 3);
  const dome = addSphere(root, sharedMaterials.goldDome, 0, 17, 0, 9.5);
  dome.scale.set(9.5, 8.5, 9.5);
  addCylinder(root, sharedMaterials.goldDome, 0, 25.5, 0, 0.1, 0.4, 4);

  // 4 Soaring Corner Pencil Minarets
  const corners = [
    [-17, -17],
    [17, -17],
    [-17, 17],
    [17, 17],
  ];

  corners.forEach(([mx, mz]) => {
    addCylinder(root, sharedMaterials.whiteMarble, mx, 14, mz, 1.1, 1.4, 28);
    addCylinder(root, sharedMaterials.goldDome, mx, 25, mz, 1.8, 1.8, 0.8);
    addCylinder(root, sharedMaterials.goldDome, mx, 30, mz, 0.05, 1.2, 7);
    colliders.push({ x: x + mx, z: z + mz, halfX: 1.5, halfZ: 1.5, height: 32 });
  });

  return root;
}

// -------------------------------------------------------------
// 4. NATIONAL CHRISTIAN ECUMENICAL CENTRE
// -------------------------------------------------------------
export function createNationalChristianCentre(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "NationalChristianCentre";

  // Cathedral nave
  addBox(root, sharedMaterials.stoneCream, 0, 8, 0, 24, 16, 42);
  colliders.push({ x, z, halfX: 12, halfZ: 21, height: 18 });

  // Triangular soaring apex
  for (let i = 0; i < 6; i++) {
    const w = 24 - i * 3.5;
    const h = 2.8;
    addBox(root, sharedMaterials.stoneCream, 0, 16 + i * 2.4, 0, w, h, 38 - i * 5);
  }

  // Soaring Spire Pinnacle
  addCylinder(root, sharedMaterials.stoneCream, 0, 36, -14, 0.1, 2.2, 18);
  // Stained glass rose window facade
  addBox(root, sharedMaterials.stainedGlass, 0, 11, 21.2, 10, 10, 0.4);

  return root;
}

// -------------------------------------------------------------
// 5. CENTRAL BANK OF NIGERIA (CBN) CURVED TOWER
// -------------------------------------------------------------
export function createCbnCurvedTower(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "CbnCurvedTower";

  // Curved Multi-Wing Skyscraper (Central Core + 2 Curved Wings)
  addBox(root, sharedMaterials.glassBlue, 0, 22, 0, 28, 44, 20);
  addBox(root, sharedMaterials.bronzeTrim, 0, 22, 0, 28.6, 44.4, 2.5);

  // North curved wing
  const wingNorth = addBox(root, sharedMaterials.glassBlue, -5, 18, -12, 18, 36, 12);
  wingNorth.rotation.y = 0.25;

  // South curved wing
  const wingSouth = addBox(root, sharedMaterials.glassBlue, 5, 18, 12, 18, 36, 12);
  wingSouth.rotation.y = -0.25;

  // Rooftop Helipad with "H" Marking
  addCylinder(root, materials.concrete, 0, 44.5, 0, 6, 6, 0.8);
  addBox(root, materials.white, 0, 45, 0, 1.2, 0.1, 4.5);
  addBox(root, materials.white, 0, 45, 0, 4.5, 0.1, 1.2);

  colliders.push({ x, z, halfX: 16, halfZ: 15, height: 46 });

  return root;
}

// -------------------------------------------------------------
// 6. NNPC TWIN CORPORATE TOWERS & ELEVATED SKYBRIDGE
// -------------------------------------------------------------
export function createNnpcTwinTowers(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "NnpcTwinTowers";

  // Tower A (West)
  addCylinder(root, sharedMaterials.glassGreen, -10, 24, 0, 6.5, 6.5, 48);
  addCylinder(root, sharedMaterials.darkSpandrel, -10, 48.5, 0, 5.5, 5.5, 1.5);
  colliders.push({ x: x - 10, z, halfX: 7, halfZ: 7, height: 49 });

  // Tower B (East)
  addCylinder(root, sharedMaterials.glassGreen, 10, 24, 0, 6.5, 6.5, 48);
  addCylinder(root, sharedMaterials.darkSpandrel, 10, 48.5, 0, 5.5, 5.5, 1.5);
  colliders.push({ x: x + 10, z, halfX: 7, halfZ: 7, height: 49 });

  // Skybridge connecting at floor 8 (height 30m)
  addBox(root, sharedMaterials.glassGreen, 0, 30, 0, 12, 3.8, 4.5);
  addBox(root, materials.metal, 0, 28, 0, 12, 0.6, 4.5);

  // Ground Plaza & Entrance Canopy
  addBox(root, materials.concrete, 0, 2.5, 0, 32, 5, 20);

  return root;
}

// -------------------------------------------------------------
// 7. GRAND JABI LAKE / CEDDI PLAZA SHOPPING MALL
// -------------------------------------------------------------
export function createGrandShoppingMall(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "GrandShoppingMall";

  // Main 3-Storey Mall Building
  addBox(root, sharedMaterials.facadeWhite, 0, 7.5, 0, 52, 15, 34);
  colliders.push({ x, z, halfX: 26, halfZ: 17, height: 16 });

  // Atrium Glass Curtain Wall
  addBox(root, sharedMaterials.mallGlass, 0, 8.5, 17.2, 28, 12, 0.6);

  // Modern Entrance Canopy & Grand Staircase
  addBox(root, sharedMaterials.orangeAccent, 0, 4.5, 21, 18, 0.8, 8);
  addBox(root, materials.concrete, 0, 0.8, 20, 22, 1.6, 7);

  // Retail Store Signs & Cinema Marquee
  addBox(root, sharedMaterials.orangeAccent, -14, 13.5, 17.3, 10, 2.2, 0.4);
  addBox(root, materials.metal, 14, 13.5, 17.3, 10, 2.2, 0.4);

  return root;
}

// -------------------------------------------------------------
// 8. ABUJA 5-STAR LUXURY HOTEL & SUITES (TRANSCORP STYLE)
// -------------------------------------------------------------
export function createAbujaLuxuryHotel(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "AbujaLuxuryHotel";

  // Stepped Hotel Wings (Ground + 5 Tiered Storeys)
  addBox(root, sharedMaterials.stoneBeige, 0, 5, 0, 44, 10, 28);
  addBox(root, sharedMaterials.stoneBeige, 0, 13.5, 0, 36, 7, 24);
  addBox(root, sharedMaterials.stoneBeige, 0, 19.5, 0, 28, 5, 20);
  colliders.push({ x, z, halfX: 22, halfZ: 14, height: 22 });

  // Balconies with illuminated glass railings
  for (let b = -16; b <= 16; b += 5.5) {
    addBox(root, sharedMaterials.glassTint, b, 12, 14.2, 4.2, 1.2, 0.3);
    addBox(root, sharedMaterials.glassTint, b, 17, 12.2, 4.2, 1.2, 0.3);
  }

  // Outdoor Turquoise Swimming Pool in Hotel Court
  addBox(root, materials.concrete, 0, 0.2, 22, 16, 0.4, 10);
  addBox(root, sharedMaterials.poolBlue, 0, 0.3, 22, 13, 0.3, 7.5);

  return root;
}

// -------------------------------------------------------------
// 9. MAITAMA / ASOKORO LUXURY CONTEMPORARY VILLA
// -------------------------------------------------------------
export function createMaitamaLuxuryVilla(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "MaitamaLuxuryVilla";

  // 1. Two-Storey Contemporary Geometric Villa
  addBox(root, sharedMaterials.stuccoWhite, 0, 3.5, -4, 22, 7, 16);
  addBox(root, sharedMaterials.cedarWood, -3, 8.5, -2, 14, 4, 12);
  colliders.push({ x, z: z - 4, halfX: 11, halfZ: 8, height: 11 });

  // Glass Terrace Balcony
  addBox(root, materials.glass, -3, 10.5, 4.2, 13.5, 1.2, 0.3);

  // Double Covered Carport
  addBox(root, materials.metal, 7.5, 4.2, 3, 7.5, 0.4, 7);
  addCylinder(root, materials.metal, 10.8, 2, 6, 0.15, 0.15, 4);
  addCylinder(root, materials.metal, 4.2, 2, 6, 0.15, 0.15, 4);

  // Private Swimming Pool in Landscaped Garden
  addBox(root, materials.concrete, -5, 0.2, 8, 10, 0.4, 6);
  addBox(root, sharedMaterials.poolWater, -5, 0.3, 8, 8.5, 0.3, 4.8);

  // Perimeter Security Wall with Automatic Gate
  const wallMat = materials.compoundWall || materials.concrete;
  addBox(root, wallMat, -12, 1.5, 0, 0.6, 3, 26);
  addBox(root, wallMat, 12, 1.5, 0, 0.6, 3, 26);
  addBox(root, wallMat, 0, 1.5, -13, 24, 3, 0.6);
  addBox(root, wallMat, -6, 1.5, 13, 12, 3, 0.6);
  addBox(root, wallMat, 8, 1.5, 13, 8, 3, 0.6);

  // Black Modern Gate
  addBox(root, materials.darkTrim || materials.metal, 2, 1.4, 13, 4, 2.6, 0.2);

  // Security Guard Booth
  addBox(root, sharedMaterials.stuccoWhite, 4.5, 1.6, 11.5, 2.2, 3.2, 2.2);
  colliders.push({ x: x + 4.5, z: z + 11.5, halfX: 1.2, halfZ: 1.2, height: 3.5 });

  return root;
}

// -------------------------------------------------------------
// 10. NNPC MEGA FUEL STATION & CONVENIENCE MART
// -------------------------------------------------------------
export function createNnpcMegaFuelStation(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "NnpcMegaFuelStation";

  // 1. Massive 8-Pump Forecourt Canopy
  addBox(root, sharedMaterials.nnpcGreen, 0, 6.2, 0, 32, 1.2, 18);
  addBox(root, sharedMaterials.nnpcYellow, 0, 5.5, 0, 32.2, 0.3, 18.2);

  // 4 Robust Canopy Support Columns
  const cols = [
    [-11, -5],
    [11, -5],
    [-11, 5],
    [11, 5],
  ];
  cols.forEach(([cx, cz]) => {
    addCylinder(root, materials.white, cx, 3, cz, 0.5, 0.5, 6);
  });

  // 4 Dual-Island Fuel Dispensers
  for (let px = -9; px <= 9; px += 6) {
    addBox(root, materials.concrete, px, 0.25, 0, 2.2, 0.5, 8);
    addBox(root, sharedMaterials.nnpcGreen, px, 1.4, -2.2, 0.8, 1.8, 1.2);
    addBox(root, sharedMaterials.nnpcGreen, px, 1.4, 2.2, 0.8, 1.8, 1.2);
    colliders.push({ x: x + px, z, halfX: 1.2, halfZ: 4.2, height: 3 });
  }

  // 2. QuickMart Convenience Store & Lubricants Bay
  addBox(root, materials.concrete, 0, 3.5, -15, 24, 7, 10);
  addBox(root, materials.glass, 0, 3, -9.8, 18, 4.5, 0.4);
  colliders.push({ x, z: z - 15, halfX: 12.5, halfZ: 5.5, height: 7.5 });

  // 3. Digital LED Price Totem Sign
  addBox(root, materials.metal, 18, 4.5, 8, 1.2, 9, 2.4);
  addBox(root, sharedMaterials.nnpcGreen, 18, 7.5, 8, 1.3, 3, 2.5);
  colliders.push({ x: x + 18, z: z + 8, halfX: 1, halfZ: 1.5, height: 9 });

  return root;
}

// -------------------------------------------------------------
// 11. MILLENNIUM PARK / CENTRAL RECREATION GARDENS
// -------------------------------------------------------------
export function createCentralParkRecreation(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "CentralParkRecreation";

  // Expansive Park Lawn Grass Base
  addBox(root, sharedMaterials.lawn, 0, 0.05, 0, 64, 0.1, 48);

  // Grand Tiered Fountain Basin
  addCylinder(root, materials.concrete, 0, 0.4, 0, 7.5, 8, 0.8);
  addCylinder(root, sharedMaterials.water, 0, 0.6, 0, 6.8, 6.8, 0.4);
  addCylinder(root, materials.concrete, 0, 1.5, 0, 3.2, 3.5, 1.6);
  addCylinder(root, sharedMaterials.water, 0, 2.1, 0, 2.8, 2.8, 0.4);
  colliders.push({ x, z, halfX: 8, halfZ: 8, height: 3 });

  // Cross Paved Walkways
  addBox(root, materials.sidewalk, 0, 0.1, 0, 64, 0.04, 5);
  addBox(root, materials.sidewalk, 0, 0.1, 0, 5, 0.04, 48);

  // 2 Shaded Wooden Park Gazebos
  for (const gz of [-16, 16]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      addCylinder(root, materials.wood, Math.cos(a) * 3.5, 2, gz + Math.sin(a) * 3.5, 0.12, 0.12, 4);
    }
    addCylinder(root, materials.roof, 0, 4.8, gz, 0.1, 4.5, 2);
    colliders.push({ x, z: z + gz, halfX: 3.8, halfZ: 3.8, height: 5 });
  }

  return root;
}

// -------------------------------------------------------------
// 12. WUSE KASUWA MODERN MARKET PAVILIONS
// -------------------------------------------------------------
export function createWuseMarketPavilions(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "WuseMarketPavilions";

  const roofZinc = materials.corrugatedZinc || materials.metal;

  // 3 Multi-Bay Steel Market Halls
  for (let m = -16; m <= 16; m += 16) {
    addBox(root, materials.concrete, 0, 0.2, m, 36, 0.4, 11);
    for (let cx = -16; cx <= 16; cx += 8) {
      addCylinder(root, sharedMaterials.trussGreen, cx, 2.5, m - 4.8, 0.14, 0.14, 5);
      addCylinder(root, sharedMaterials.trussGreen, cx, 2.5, m + 4.8, 0.14, 0.14, 5);
    }
    addBox(root, roofZinc, 0, 5.4, m, 37, 0.3, 12);

    for (let sx = -12; sx <= 12; sx += 6) {
      addBox(root, materials.wood, sx, 0.9, m, 3.8, 1.2, 2.2);
    }
    colliders.push({ x, z: z + m, halfX: 18.5, halfZ: 5.8, height: 6 });
  }

  return root;
}

// -------------------------------------------------------------
// 13. HIGHWAY A2 INTERCITY TOLL PLAZA (DEPARTURE TO KANO)
// -------------------------------------------------------------
export function createIntercityTollPlaza(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
  destinationName = "KANO (420 KM)",
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "IntercityTollPlaza";

  // 4-Lane Toll Booth Canopy
  addBox(root, sharedMaterials.tollBlue, 0, 6.5, 0, 36, 1.4, 12);

  // 5 Concrete Toll Island Booths
  for (let bx = -14; bx <= 14; bx += 7) {
    addBox(root, materials.concrete, bx, 0.3, 0, 1.8, 0.6, 14);
    addBox(root, materials.white, bx, 2.2, 0, 1.4, 3.2, 3.2);
    addBox(root, materials.glass, bx, 2.4, 0, 1.45, 1.4, 1.8);
    colliders.push({ x: x + bx, z, halfX: 1.1, halfZ: 4.5, height: 6.5 });
  }

  // Large Overhead Route Sign
  addBox(root, sharedMaterials.signGreen, 0, 8.5, -0.2, 28, 2.5, 0.4);
  // Route Text Board Frame
  addBox(root, materials.white, 0, 8.5, 0.1, 27.6, 2.1, 0.2);

  return root;
}

// -------------------------------------------------------------
// 14. NNAMDI AZIKIWE AIRPORT SHUTTLE TERMINAL
// -------------------------------------------------------------
export function createAirportTerminalShuttle(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "AirportTerminalShuttle";

  // Terminal Concourse Building
  addBox(root, sharedMaterials.airportWhite, 0, 6, 0, 38, 12, 24);
  addBox(root, sharedMaterials.terminalGlass, 0, 6, 12.2, 32, 9, 0.4);
  colliders.push({ x, z, halfX: 19, halfZ: 12, height: 14 });

  // Control Tower Silhouette
  addCylinder(root, sharedMaterials.airportWhite, 14, 14, -6, 2.4, 3, 28);
  addCylinder(root, sharedMaterials.terminalGlass, 14, 28, -6, 4.2, 3.6, 4);
  colliders.push({ x: x + 14, z: z - 6, halfX: 3.5, halfZ: 3.5, height: 30 });

  return root;
}

// -------------------------------------------------------------
// 15. TROPICAL ROYAL PALM TREE (OPTIMIZED INSTANCES & STANDALONE)
// -------------------------------------------------------------
export function createTropicalPalmTree(materials: GameMaterials): THREE.Group {
  const tree = new THREE.Group();
  tree.name = "TropicalPalmTree";
  const trunk = new THREE.Mesh(sharedPalmTrunkGeo, sharedMaterials.palmTrunk);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  const crown = new THREE.Mesh(sharedPalmCrownGeo, sharedMaterials.palmFoliage);
  crown.castShadow = true;
  crown.receiveShadow = true;
  tree.add(trunk);
  tree.add(crown);
  return tree;
}

export function createTropicalPalmTreeInstances(
  positions: { x: number; y?: number; z: number; scale?: number }[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = "TropicalPalmTreeInstances";
  const count = positions.length;
  if (count === 0) return group;

  const trunkMesh = new THREE.InstancedMesh(sharedPalmTrunkGeo, sharedMaterials.palmTrunk, count);
  const crownMesh = new THREE.InstancedMesh(sharedPalmCrownGeo, sharedMaterials.palmFoliage, count);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  trunkMesh.name = "PalmTrunkInstances";
  crownMesh.name = "PalmCrownInstances";

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const p = positions[i];
    dummy.position.set(p.x, p.y || 0, p.z);
    const s = p.scale || 1.0;
    dummy.scale.set(s, s, s);
    dummy.rotation.y = (i * 1.37) % (Math.PI * 2);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    crownMesh.setMatrixAt(i, dummy.matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  crownMesh.instanceMatrix.needsUpdate = true;

  group.add(trunkMesh);
  group.add(crownMesh);
  return group;
}

// -------------------------------------------------------------
// 16. MODERN DUAL-LANTERN SOLAR STREETLIGHT (OPTIMIZED INSTANCES)
// -------------------------------------------------------------
export function createModernSolarStreetlight(materials: GameMaterials): THREE.Group {
  const pole = new THREE.Group();
  pole.name = "ModernSolarStreetlight";
  const poleMesh = new THREE.Mesh(sharedStreetlightPoleGeo, sharedMaterials.poleMat);
  poleMesh.castShadow = true;
  poleMesh.receiveShadow = true;
  const lampMesh = new THREE.Mesh(sharedStreetlightLampGeo, materials.white);
  lampMesh.castShadow = false;
  lampMesh.receiveShadow = false;
  pole.add(poleMesh);
  pole.add(lampMesh);
  return pole;
}

export function createModernSolarStreetlightInstances(
  positions: { x: number; y?: number; z: number; rotationY?: number }[],
  materials: GameMaterials,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "ModernSolarStreetlightInstances";
  const count = positions.length;
  if (count === 0) return group;

  const poleMesh = new THREE.InstancedMesh(sharedStreetlightPoleGeo, sharedMaterials.poleMat, count);
  const lampMesh = new THREE.InstancedMesh(sharedStreetlightLampGeo, materials.white, count);
  poleMesh.castShadow = true;
  poleMesh.receiveShadow = true;
  lampMesh.castShadow = false;
  lampMesh.receiveShadow = false;
  poleMesh.name = "StreetlightPoleInstances";
  lampMesh.name = "StreetlightLampInstances";

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const p = positions[i];
    dummy.position.set(p.x, p.y || 0, p.z);
    dummy.rotation.y = p.rotationY || 0;
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    lampMesh.setMatrixAt(i, dummy.matrix);
  }
  poleMesh.instanceMatrix.needsUpdate = true;
  lampMesh.instanceMatrix.needsUpdate = true;

  group.add(poleMesh);
  group.add(lampMesh);
  return group;
}
