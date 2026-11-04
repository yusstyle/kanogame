import * as THREE from "three";
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
// 1. ASO ROCK GRANITE INSELBERG MONOLITH
// -------------------------------------------------------------
export function createAsoRockMonolith(materials: GameMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = "AsoRockMonolith";

  const graniteMat = new THREE.MeshStandardMaterial({
    color: "#5a6265",
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  });

  const greenBaseMat = new THREE.MeshStandardMaterial({
    color: "#385437",
    roughness: 0.88,
  });

  // Massive stepped inselberg ridges
  const tiers = [
    { y: 35, width: 220, height: 70, depth: 140, color: graniteMat },
    { y: 65, width: 180, height: 60, depth: 110, color: graniteMat },
    { y: 92, width: 140, height: 45, depth: 85, color: graniteMat },
    { y: 115, width: 95, height: 35, depth: 60, color: graniteMat },
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
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), greenBaseMat);
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

  const whiteMarble = new THREE.MeshStandardMaterial({ color: "#f5f6f8", roughness: 0.25 });
  const greenDomeMat = new THREE.MeshStandardMaterial({ color: "#196f3d", roughness: 0.35, metalness: 0.2 });
  const goldAccents = new THREE.MeshStandardMaterial({ color: "#d4ac0d", roughness: 0.2, metalness: 0.75 });

  // 1. Grand Tiered Podium Steps
  addBox(root, whiteMarble, 0, 0.6, 0, 56, 1.2, 42);
  addBox(root, whiteMarble, 0, 1.8, 0, 50, 1.2, 36);
  colliders.push({ x, z, halfX: 25, halfZ: 18, height: 3.5 });

  // 2. Main Hall Edifice
  addBox(root, whiteMarble, 0, 7.5, 0, 44, 10, 30);
  colliders.push({ x, z, halfX: 22, halfZ: 15, height: 16 });

  // 3. Colonnade Facade (Front Entrance)
  for (let c = -18; c <= 18; c += 4.5) {
    addCylinder(root, whiteMarble, c, 7.5, 15.5, 0.45, 0.45, 10);
  }

  // 4. Portico Pediment with Nigerian Coat of Arms relief
  const pediment = addBox(root, whiteMarble, 0, 13.5, 15.5, 42, 2.2, 3);
  addBox(root, goldAccents, 0, 13.5, 17.1, 4, 1.4, 0.2);

  // 5. Soaring Central Green Dome
  const domeDrum = addCylinder(root, whiteMarble, 0, 14.5, 0, 7.5, 7.5, 4);
  const dome = addSphere(root, greenDomeMat, 0, 17.5, 0, 8.5);
  dome.scale.set(8.5, 9.5, 8.5);

  // Golden Spire & Lantern
  addCylinder(root, goldAccents, 0, 27.5, 0, 0.2, 0.6, 6);

  // Nigerian National Flags on Ceremonial Flagpoles
  for (const fx of [-15, 15]) {
    addCylinder(root, materials.metal, fx, 8, 18, 0.08, 0.08, 16);
    // Green-White-Green Flag
    addBox(root, greenDomeMat, fx + 1.2, 14.5, 18, 0.8, 1.4, 0.04);
    addBox(root, whiteMarble, fx + 2.0, 14.5, 18, 0.8, 1.4, 0.04);
    addBox(root, greenDomeMat, fx + 2.8, 14.5, 18, 0.8, 1.4, 0.04);
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

  const marbleWhite = new THREE.MeshStandardMaterial({ color: "#f8f9fa", roughness: 0.2 });
  const goldDome = new THREE.MeshStandardMaterial({ color: "#e5b73b", roughness: 0.15, metalness: 0.85 });

  // Main Prayer Hall
  addBox(root, marbleWhite, 0, 6, 0, 36, 12, 36);
  colliders.push({ x, z, halfX: 18, halfZ: 18, height: 16 });

  // Golden Central Dome
  const domeDrum = addCylinder(root, marbleWhite, 0, 13.5, 0, 9, 9, 3);
  const dome = addSphere(root, goldDome, 0, 17, 0, 9.5);
  dome.scale.set(9.5, 8.5, 9.5);
  addCylinder(root, goldDome, 0, 25.5, 0, 0.1, 0.4, 4);

  // 4 Soaring Corner Pencil Minarets
  const corners = [
    [-17, -17],
    [17, -17],
    [-17, 17],
    [17, 17],
  ];

  corners.forEach(([mx, mz]) => {
    // Slender octagonal minaret shaft
    addCylinder(root, marbleWhite, mx, 14, mz, 1.1, 1.4, 28);
    // Upper balcony gallery
    addCylinder(root, goldDome, mx, 25, mz, 1.8, 1.8, 0.8);
    // Conical spire tip
    addCylinder(root, goldDome, mx, 30, mz, 0.05, 1.2, 7);
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

  const stoneCream = new THREE.MeshStandardMaterial({ color: "#e8e5dc", roughness: 0.45 });
  const stainedGlass = new THREE.MeshStandardMaterial({
    color: "#2471a3",
    roughness: 0.2,
    metalness: 0.3,
    emissive: "#1b4f72",
    emissiveIntensity: 0.35,
  });

  // Cathedral nave
  addBox(root, stoneCream, 0, 8, 0, 24, 16, 42);
  colliders.push({ x, z, halfX: 12, halfZ: 21, height: 18 });

  // Triangular soaring apex
  for (let i = 0; i < 6; i++) {
    const w = 24 - i * 3.5;
    const h = 2.8;
    addBox(root, stoneCream, 0, 16 + i * 2.4, 0, w, h, 38 - i * 5);
  }

  // Soaring Spire Pinnacle
  addCylinder(root, stoneCream, 0, 36, -14, 0.1, 2.2, 18);
  // Stained glass rose window facade
  addBox(root, stainedGlass, 0, 11, 21.2, 10, 10, 0.4);

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

  const glassBlue = new THREE.MeshStandardMaterial({
    color: "#1a5276",
    roughness: 0.15,
    metalness: 0.65,
  });
  const bronzeTrim = new THREE.MeshStandardMaterial({
    color: "#b9770e",
    roughness: 0.35,
    metalness: 0.7,
  });

  // Curved Multi-Wing Skyscraper (Central Core + 2 Curved Wings)
  addBox(root, glassBlue, 0, 22, 0, 28, 44, 20);
  addBox(root, bronzeTrim, 0, 22, 0, 28.6, 44.4, 2.5);

  // North curved wing
  const wingNorth = addBox(root, glassBlue, -5, 18, -12, 18, 36, 12);
  wingNorth.rotation.y = 0.25;

  // South curved wing
  const wingSouth = addBox(root, glassBlue, 5, 18, 12, 18, 36, 12);
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

  const glassGreen = new THREE.MeshStandardMaterial({
    color: "#117864",
    roughness: 0.2,
    metalness: 0.55,
  });
  const darkSpandrel = new THREE.MeshStandardMaterial({ color: "#192428", roughness: 0.4 });

  // Tower A (West)
  addCylinder(root, glassGreen, -10, 24, 0, 6.5, 6.5, 48);
  addCylinder(root, darkSpandrel, -10, 48.5, 0, 5.5, 5.5, 1.5);
  colliders.push({ x: x - 10, z, halfX: 7, halfZ: 7, height: 49 });

  // Tower B (East)
  addCylinder(root, glassGreen, 10, 24, 0, 6.5, 6.5, 48);
  addCylinder(root, darkSpandrel, 10, 48.5, 0, 5.5, 5.5, 1.5);
  colliders.push({ x: x + 10, z, halfX: 7, halfZ: 7, height: 49 });

  // Skybridge connecting at floor 8 (height 30m)
  addBox(root, glassGreen, 0, 30, 0, 12, 3.8, 4.5);
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

  const facadeWhite = new THREE.MeshStandardMaterial({ color: "#f0f2f5", roughness: 0.35 });
  const mallGlass = new THREE.MeshStandardMaterial({ color: "#2980b9", roughness: 0.15, metalness: 0.7 });
  const orangeAccent = new THREE.MeshStandardMaterial({ color: "#d35400", roughness: 0.3 });

  // Main 3-Storey Mall Building
  addBox(root, facadeWhite, 0, 7.5, 0, 52, 15, 34);
  colliders.push({ x, z, halfX: 26, halfZ: 17, height: 16 });

  // Atrium Glass Curtain Wall
  addBox(root, mallGlass, 0, 8.5, 17.2, 28, 12, 0.6);

  // Modern Entrance Canopy & Grand Staircase
  addBox(root, orangeAccent, 0, 4.5, 21, 18, 0.8, 8);
  addBox(root, materials.concrete, 0, 0.8, 20, 22, 1.6, 7);

  // Retail Store Signs & Cinema Marquee
  addBox(root, orangeAccent, -14, 13.5, 17.3, 10, 2.2, 0.4);
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

  const stoneBeige = new THREE.MeshStandardMaterial({ color: "#eae4d8", roughness: 0.4 });
  const glassTint = new THREE.MeshStandardMaterial({ color: "#2c3e50", roughness: 0.2, metalness: 0.5 });
  const poolBlue = new THREE.MeshStandardMaterial({ color: "#1abc9c", roughness: 0.1, metalness: 0.3 });

  // Stepped Hotel Wings (Ground + 5 Tiered Storeys)
  addBox(root, stoneBeige, 0, 5, 0, 44, 10, 28);
  addBox(root, stoneBeige, 0, 13.5, 0, 36, 7, 24);
  addBox(root, stoneBeige, 0, 19.5, 0, 28, 5, 20);
  colliders.push({ x, z, halfX: 22, halfZ: 14, height: 22 });

  // Balconies with illuminated glass railings
  for (let b = -16; b <= 16; b += 5.5) {
    addBox(root, glassTint, b, 12, 14.2, 4.2, 1.2, 0.3);
    addBox(root, glassTint, b, 17, 12.2, 4.2, 1.2, 0.3);
  }

  // Outdoor Turquoise Swimming Pool in Hotel Court
  addBox(root, materials.concrete, 0, 0.2, 22, 16, 0.4, 10);
  addBox(root, poolBlue, 0, 0.3, 22, 13, 0.3, 7.5);

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

  const stuccoWhite = new THREE.MeshStandardMaterial({ color: "#f7f9fa", roughness: 0.25 });
  const cedarWood = new THREE.MeshStandardMaterial({ color: "#784212", roughness: 0.55 });
  const poolWater = new THREE.MeshStandardMaterial({ color: "#00a896", roughness: 0.1, metalness: 0.2 });

  // 1. Two-Storey Contemporary Geometric Villa
  addBox(root, stuccoWhite, 0, 3.5, -4, 22, 7, 16);
  addBox(root, cedarWood, -3, 8.5, -2, 14, 4, 12);
  colliders.push({ x, z: z - 4, halfX: 11, halfZ: 8, height: 11 });

  // Glass Terrace Balcony
  addBox(root, materials.glass, -3, 10.5, 4.2, 13.5, 1.2, 0.3);

  // Double Covered Carport
  addBox(root, materials.metal, 7.5, 4.2, 3, 7.5, 0.4, 7);
  addCylinder(root, materials.metal, 10.8, 2, 6, 0.15, 0.15, 4);
  addCylinder(root, materials.metal, 4.2, 2, 6, 0.15, 0.15, 4);

  // Private Swimming Pool in Landscaped Garden
  addBox(root, materials.concrete, -5, 0.2, 8, 10, 0.4, 6);
  addBox(root, poolWater, -5, 0.3, 8, 8.5, 0.3, 4.8);

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
  addBox(root, stuccoWhite, 4.5, 1.6, 11.5, 2.2, 3.2, 2.2);
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

  const nnpcGreen = new THREE.MeshStandardMaterial({ color: "#196f3d", roughness: 0.3 });
  const nnpcYellow = new THREE.MeshStandardMaterial({ color: "#f1c40f", roughness: 0.25 });

  // 1. Massive 8-Pump Forecourt Canopy
  addBox(root, nnpcGreen, 0, 6.2, 0, 32, 1.2, 18);
  addBox(root, nnpcYellow, 0, 5.5, 0, 32.2, 0.3, 18.2);

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
    // Concrete safety island
    addBox(root, materials.concrete, px, 0.25, 0, 2.2, 0.5, 8);
    // 2 pump meters
    addBox(root, nnpcGreen, px, 1.4, -2.2, 0.8, 1.8, 1.2);
    addBox(root, nnpcGreen, px, 1.4, 2.2, 0.8, 1.8, 1.2);
    colliders.push({ x: x + px, z, halfX: 1.2, halfZ: 4.2, height: 3 });
  }

  // 2. QuickMart Convenience Store & Lubricants Bay
  addBox(root, materials.concrete, 0, 3.5, -15, 24, 7, 10);
  addBox(root, materials.glass, 0, 3, -9.8, 18, 4.5, 0.4);
  colliders.push({ x, z: z - 15, halfX: 12.5, halfZ: 5.5, height: 7.5 });

  // 3. Digital LED Price Totem Sign
  addBox(root, materials.metal, 18, 4.5, 8, 1.2, 9, 2.4);
  addBox(root, nnpcGreen, 18, 7.5, 8, 1.3, 3, 2.5);
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

  const lawnMat = new THREE.MeshStandardMaterial({ color: "#2d6a4f", roughness: 0.9 });
  const waterMat = new THREE.MeshStandardMaterial({ color: "#0077b6", roughness: 0.1, metalness: 0.35 });

  // Expansive Park Lawn Grass Base
  addBox(root, lawnMat, 0, 0.05, 0, 64, 0.1, 48);

  // Grand Tiered Fountain Basin
  addCylinder(root, materials.concrete, 0, 0.4, 0, 7.5, 8, 0.8);
  addCylinder(root, waterMat, 0, 0.6, 0, 6.8, 6.8, 0.4);
  addCylinder(root, materials.concrete, 0, 1.5, 0, 3.2, 3.5, 1.6);
  addCylinder(root, waterMat, 0, 2.1, 0, 2.8, 2.8, 0.4);
  colliders.push({ x, z, halfX: 8, halfZ: 8, height: 3 });

  // Cross Paved Walkways
  addBox(root, materials.sidewalk, 0, 0.1, 0, 64, 0.04, 5);
  addBox(root, materials.sidewalk, 0, 0.1, 0, 5, 0.04, 48);

  // 2 Shaded Wooden Park Gazebos
  for (const gz of [-16, 16]) {
    // Hexagonal columns
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      addCylinder(root, materials.wood, Math.cos(a) * 3.5, 2, gz + Math.sin(a) * 3.5, 0.12, 0.12, 4);
    }
    // Conical roof
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

  const trussGreen = new THREE.MeshStandardMaterial({ color: "#1e8449", roughness: 0.4 });
  const roofZinc = materials.corrugatedZinc || materials.metal;

  // 3 Multi-Bay Steel Market Halls
  for (let m = -16; m <= 16; m += 16) {
    // Concrete floor
    addBox(root, materials.concrete, 0, 0.2, m, 36, 0.4, 11);
    // Columns
    for (let cx = -16; cx <= 16; cx += 8) {
      addCylinder(root, trussGreen, cx, 2.5, m - 4.8, 0.14, 0.14, 5);
      addCylinder(root, trussGreen, cx, 2.5, m + 4.8, 0.14, 0.14, 5);
    }
    // Pitched metal canopy roof
    addBox(root, roofZinc, 0, 5.4, m, 37, 0.3, 12);

    // Vendor trade stalls inside
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

  const tollBlue = new THREE.MeshStandardMaterial({ color: "#154360", roughness: 0.3 });
  const signGreen = new THREE.MeshStandardMaterial({ color: "#1e8449", roughness: 0.2 });

  // 4-Lane Toll Booth Canopy
  addBox(root, tollBlue, 0, 6.5, 0, 36, 1.4, 12);

  // 5 Concrete Toll Island Booths
  for (let bx = -14; bx <= 14; bx += 7) {
    addBox(root, materials.concrete, bx, 0.3, 0, 1.8, 0.6, 14);
    addBox(root, materials.white, bx, 2.2, 0, 1.4, 3.2, 3.2);
    addBox(root, materials.glass, bx, 2.4, 0, 1.45, 1.4, 1.8);
    colliders.push({ x: x + bx, z, halfX: 1.1, halfZ: 4.5, height: 6.5 });
  }

  // Large Overhead Route Sign
  addBox(root, signGreen, 0, 8.5, -0.2, 28, 2.5, 0.4);
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

  const airportWhite = new THREE.MeshStandardMaterial({ color: "#f4f6f7", roughness: 0.25 });
  const terminalGlass = new THREE.MeshStandardMaterial({ color: "#2471a3", roughness: 0.15, metalness: 0.7 });

  // Terminal Concourse Building
  addBox(root, airportWhite, 0, 6, 0, 38, 12, 24);
  addBox(root, terminalGlass, 0, 6, 12.2, 32, 9, 0.4);
  colliders.push({ x, z, halfX: 19, halfZ: 12, height: 14 });

  // Control Tower Silhouette
  addCylinder(root, airportWhite, 14, 14, -6, 2.4, 3, 28);
  addCylinder(root, terminalGlass, 14, 28, -6, 4.2, 3.6, 4);
  colliders.push({ x: x + 14, z: z - 6, halfX: 3.5, halfZ: 3.5, height: 30 });

  return root;
}

// -------------------------------------------------------------
// 15. TROPICAL ROYAL PALM TREE (DISTINCT FROM KANO NEEM)
// -------------------------------------------------------------
export function createTropicalPalmTree(materials: GameMaterials): THREE.Group {
  const tree = new THREE.Group();
  const palmFoliage = new THREE.MeshStandardMaterial({ color: "#2e7d32", roughness: 0.65 });
  const palmTrunk = new THREE.MeshStandardMaterial({ color: "#5d4037", roughness: 0.9 });

  // Tall slender ringed trunk
  addCylinder(tree, palmTrunk, 0, 4.5, 0, 0.22, 0.38, 9);

  // Drooping palm fronds radiating out
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.7), palmFoliage);
    frond.position.set(Math.cos(angle) * 1.6, 9.2, Math.sin(angle) * 1.6);
    frond.rotation.y = angle;
    frond.rotation.z = -0.35;
    frond.castShadow = true;
    tree.add(frond);
  }

  return tree;
}

// -------------------------------------------------------------
// 16. MODERN DUAL-LANTERN SOLAR STREETLIGHT
// -------------------------------------------------------------
export function createModernSolarStreetlight(materials: GameMaterials): THREE.Group {
  const pole = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: "#bdc3c7", roughness: 0.35, metalness: 0.8 });

  addCylinder(pole, poleMat, 0, 4.5, 0, 0.12, 0.18, 9);
  // Solar panel on top
  addBox(pole, materials.black, 0, 9.2, 0, 1.4, 0.1, 0.9);
  // Dual-arm lantern fixtures
  addBox(pole, poleMat, -1.2, 8.6, 0, 1.8, 0.1, 0.2);
  addBox(pole, poleMat, 1.2, 8.6, 0, 1.8, 0.1, 0.2);
  addBox(pole, materials.white, -1.8, 8.4, 0, 0.8, 0.2, 0.4);
  addBox(pole, materials.white, 1.8, 8.4, 0, 0.8, 0.2, 0.4);

  return pole;
}

