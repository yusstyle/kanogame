import { vegetationMaterials } from "./abujaVegetation";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Collider, GameMaterials } from "./types";
import { abujaPbrMaterials } from "./abujaMaterials";
import { markWorldResourceShared } from "./worldResourceLifecycle";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const unitSphere = new THREE.SphereGeometry(1, 16, 12);
const unitCone = new THREE.ConeGeometry(1, 1, 16);
[unitBox, unitCylinder, unitSphere, unitCone].forEach(markWorldResourceShared);

function addCone(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  castShadow = true,
) {
  const mesh = new THREE.Mesh(unitCone, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(radius, height, radius);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

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
    color: "#ded9cf",
    roughness: 0.78,
    metalness: 0.02,
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
    roughness: 0.28,
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
  hazardYellow: new THREE.MeshStandardMaterial({
    color: "#f1c40f",
    roughness: 0.35,
    metalness: 0.1,
  }),
  ledGreen: new THREE.MeshStandardMaterial({
    color: "#2ecc71",
    emissive: "#27ae60",
    emissiveIntensity: 0.85,
    roughness: 0.2,
  }),
  barrierRed: new THREE.MeshStandardMaterial({
    color: "#c0392b",
    roughness: 0.3,
  }),
};
Object.values(sharedMaterials).forEach(markWorldResourceShared);

// Prebuilt shared geometries for InstancedMesh
function buildSharedPalmCrownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const frondCount = 14;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2;
    const droop = 0.35 + (i % 2) * 0.25;

    // Segment 1: Rachis ascending outward from crown
    const seg1 = new THREE.BoxGeometry(0.28, 0.05, 2.2);
    seg1.rotateX(droop * 0.4);
    seg1.rotateY(angle);
    seg1.translate(Math.sin(angle) * 1.0, 9.4, Math.cos(angle) * 1.0);
    parts.push(seg1);

    // Segment 2: Arched frond body
    const seg2 = new THREE.BoxGeometry(0.48, 0.04, 2.4);
    seg2.rotateX(droop * 0.85);
    seg2.rotateY(angle);
    seg2.translate(Math.sin(angle) * 2.5, 9.5 - droop * 0.6, Math.cos(angle) * 2.5);
    parts.push(seg2);

    // Segment 3: Drooping feathered tip
    const seg3 = new THREE.BoxGeometry(0.32, 0.03, 2.0);
    seg3.rotateX(droop * 1.35);
    seg3.rotateY(angle);
    seg3.translate(Math.sin(angle) * 3.8, 8.8 - droop * 1.5, Math.cos(angle) * 3.8);
    parts.push(seg3);
  }
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return merged || new THREE.BufferGeometry();
}

const sharedPalmTrunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 9, 10);
sharedPalmTrunkGeo.translate(0, 4.5, 0);
const sharedPalmCrownGeo = buildSharedPalmCrownGeometry();
markWorldResourceShared(sharedPalmTrunkGeo);
markWorldResourceShared(sharedPalmCrownGeo);

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
markWorldResourceShared(sharedStreetlightPoleGeo);
markWorldResourceShared(sharedStreetlightLampGeo);

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

  // 1. Grand Tiered Podium Steps & Terraces
  addBox(root, abujaPbrMaterials.marbleCream, 0, 0.6, 0, 60, 1.2, 46);
  addBox(root, abujaPbrMaterials.marbleCream, 0, 1.8, 0, 54, 1.2, 40);
  addBox(root, abujaPbrMaterials.marbleCream, 0, 3.0, 0, 48, 1.2, 34);
  colliders.push({ x, z, halfX: 28, halfZ: 21, height: 4.5 });

  // 2. Main Hall Edifice with Recessed Windows
  addBox(root, abujaPbrMaterials.marbleCream, 0, 9.5, 0, 44, 12, 30);
  colliders.push({ x, z, halfX: 22, halfZ: 15, height: 18 });

  // Recessed dark bronze window bays on sides
  for (let bz = -10; bz <= 10; bz += 5) {
    for (const side of [-1, 1]) {
      const glassX = side * 22.08;
      const frameX = side * 22.18;
      addBox(root, abujaPbrMaterials.glassCurtainBlue, glassX, 9.5, bz, 0.12, 6.1, 2.25);
      addBox(root, abujaPbrMaterials.bronzeSunshade, frameX, 9.5, bz - 1.17, 0.14, 7, 0.16);
      addBox(root, abujaPbrMaterials.bronzeSunshade, frameX, 9.5, bz + 1.17, 0.14, 7, 0.16);
      addBox(root, abujaPbrMaterials.bronzeSunshade, frameX, 6.05, bz, 0.14, 0.16, 2.48);
      addBox(root, abujaPbrMaterials.bronzeSunshade, frameX, 12.95, bz, 0.14, 0.16, 2.48);
    }
  }

  // 3. Front portico with stone bases, tapered shafts and capitals.
  // The former square piers read as a row of boxes at street level.
  for (let c = -18; c <= 18; c += 3.6) {
    addCylinder(root, abujaPbrMaterials.marbleCream, c, 3.9, 15.6, 0.76, 0.76, 0.45);
    addCylinder(root, abujaPbrMaterials.marbleCream, c, 9.45, 15.6, 0.58, 0.68, 10.8);
    addCylinder(root, abujaPbrMaterials.marbleCream, c, 15.0, 15.6, 0.76, 0.76, 0.45);
  }

  // Glazed entrance doors and recessed front window bays behind the colonnade.
  addBox(root, abujaPbrMaterials.bronzeSunshade, 0, 7.5, 15.02, 5.4, 7.2, 0.28);
  addBox(root, abujaPbrMaterials.glassCurtainBlue, 0, 7.6, 15.2, 4.3, 6.1, 0.12);
  for (const wx of [-15, -10, -5, 5, 10, 15]) {
    addBox(root, abujaPbrMaterials.glassCurtainBlue, wx, 9.7, 15.18, 2.4, 5.6, 0.12);
    addBox(root, abujaPbrMaterials.bronzeSunshade, wx, 12.75, 15.42, 3.0, 0.18, 0.58);
  }

  // 4. Entablature & Portico Pediment with Nigerian Coat of Arms relief
  addBox(root, abujaPbrMaterials.marbleCream, 0, 16.2, 15.6, 44, 2.4, 3.2);
  // A true triangular portico pediment replaces the stacked horizontal slabs.
  const pedimentShape = new THREE.Shape();
  pedimentShape.moveTo(-21, 0);
  pedimentShape.lineTo(21, 0);
  pedimentShape.lineTo(0, 5.6);
  pedimentShape.closePath();
  const pedimentGeometry = new THREE.ExtrudeGeometry(pedimentShape, {
    depth: 2.6,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.12,
    bevelThickness: 0.12,
  });
  pedimentGeometry.translate(0, 17.1, 14.2);
  const pediment = new THREE.Mesh(pedimentGeometry, abujaPbrMaterials.marbleCream);
  pediment.name = "NationalAssemblyPorticoPediment";
  pediment.castShadow = true;
  pediment.receiveShadow = true;
  pediment.userData.noMerge = true;
  root.add(pediment);
  // Golden Coat of Arms emblem
  addBox(root, sharedMaterials.goldAccents, 0, 18.2, 17.2, 4.5, 2.2, 0.3);

  // 5. Soaring Central Green Dome & Drum
  addCylinder(root, abujaPbrMaterials.marbleCream, 0, 17.5, 0, 8.5, 8.5, 4);
  // Arched clerestory window slots around drum
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    addBox(root, abujaPbrMaterials.glassCurtainBlue, Math.sin(ang) * 8.6, 17.5, Math.cos(ang) * 8.6, 1.6, 2.8, 0.4);
  }

  // Use only the upper hemisphere so the roof reads as a dome, not a sphere
  // buried in the hall. Its spring line rests on the clerestory drum.
  const domeGeometry = new THREE.SphereGeometry(9.2, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeometry.scale(1, 1.04, 1);
  domeGeometry.translate(0, 19.5, 0);
  const dome = new THREE.Mesh(domeGeometry, sharedMaterials.greenDome);
  dome.name = "NationalAssemblyGreenDome";
  dome.castShadow = true;
  dome.receiveShadow = true;
  dome.userData.noMerge = true;
  root.add(dome);

  // Golden Spire & Lantern Cupola
  addCylinder(root, sharedMaterials.goldAccents, 0, 29.8, 0, 0.18, 0.3, 2.2);

  // Ceremonial Forecourt with Reflecting Pool & Monumental Flagpoles
  addBox(root, abujaPbrMaterials.graniteCharcoal, 0, 0.15, 26, 32, 0.3, 10);
  addBox(root, sharedMaterials.water, 0, 0.25, 26, 28, 0.2, 7.5);

  for (const fx of [-16, 16]) {
    addCylinder(root, materials.metal, fx, 9, 23, 0.09, 0.09, 18);
    // Green-White-Green flag
    addBox(root, sharedMaterials.greenDome, fx + 1.2, 16.5, 23, 0.8, 1.4, 0.04);
    addBox(root, sharedMaterials.whiteMarble, fx + 2.0, 16.5, 23, 0.8, 1.4, 0.04);
    addBox(root, sharedMaterials.greenDome, fx + 2.8, 16.5, 23, 0.8, 1.4, 0.04);
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

  // 1. Terraced Stone Podium
  addBox(root, materials.stone, 0, 0.5, 0, 48, 1.0, 48);
  addBox(root, sharedMaterials.whiteMarble, 0, 1.2, 0, 42, 0.4, 42);
  colliders.push({ x, z, halfX: 21, halfZ: 21, height: 2 });

  // 2. Main Prayer Hall Structure (Tiered architectural massing)
  addBox(root, sharedMaterials.whiteMarble, 0, 7.5, 0, 36, 12, 36);
  colliders.push({ x, z, halfX: 18, halfZ: 18, height: 16 });

  // Decorative roofline cornice and parapet
  addBox(root, sharedMaterials.whiteMarble, 0, 13.8, 0, 37.6, 0.6, 37.6);
  addBox(root, sharedMaterials.goldAccents, 0, 14.2, 0, 36.8, 0.2, 36.8);

  // Arched Islamic Window Panels on all 4 facades
  for (const side of [-1, 1]) {
    // North & South Facades
    for (let wx = -12; wx <= 12; wx += 6) {
      addBox(root, sharedMaterials.glassBlue, wx, 7.5, side * 18.15, 2.2, 6.5, 0.2);
      addBox(root, sharedMaterials.goldAccents, wx, 11.0, side * 18.2, 2.4, 0.3, 0.2);
    }
    // East & West Facades
    for (let wz = -12; wz <= 12; wz += 6) {
      addBox(root, sharedMaterials.glassBlue, side * 18.15, 7.5, wz, 0.2, 6.5, 2.2);
      addBox(root, sharedMaterials.goldAccents, side * 18.2, 11.0, wz, 0.2, 0.3, 2.4);
    }
  }

  // Grand Arched Entrance Portico (Facing West toward Boulevard)
  addBox(root, sharedMaterials.whiteMarble, -19.5, 6, 0, 3.0, 9, 14);
  addBox(root, sharedMaterials.goldAccents, -21.1, 4.5, 0, 0.2, 6, 5); // Main portal arch

  // 3. Central Dome Drum with Arched Clerestory Windows
  addCylinder(root, sharedMaterials.whiteMarble, 0, 15.2, 0, 9.2, 9.4, 2.4);
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6;
    addBox(root, sharedMaterials.glassBlue, Math.sin(ang) * 9.3, 15.2, Math.cos(ang) * 9.3, 1.4, 1.6, 0.3);
  }

  // Monumental Golden Central Dome
  const dome = addSphere(root, sharedMaterials.goldDome, 0, 18.5, 0, 9.5);
  dome.scale.set(9.5, 8.5, 9.5);
  // Gold Spire & Crescent Finial
  addCylinder(root, sharedMaterials.goldDome, 0, 27.5, 0, 0.15, 0.5, 5);
  addSphere(root, sharedMaterials.goldDome, 0, 30.2, 0, 0.45);

  // 4. Four Slender Pencil Minarets with Classical Islamic Balconies & Spires
  const corners = [
    [-17.5, -17.5],
    [17.5, -17.5],
    [-17.5, 17.5],
    [17.5, 17.5],
  ];

  corners.forEach(([mx, mz]) => {
    // Plinth base
    addBox(root, materials.stone, mx, 1.5, mz, 3.2, 3.0, 3.2);
    addBox(root, sharedMaterials.whiteMarble, mx, 3.3, mz, 2.6, 0.6, 2.6);

    // Lower octagonal minaret shaft
    addCylinder(root, sharedMaterials.whiteMarble, mx, 11.5, mz, 1.3, 1.5, 16);

    // First Balcony (Sherfeh) with corbelled base & gold balustrade
    addCylinder(root, sharedMaterials.whiteMarble, mx, 19.8, mz, 2.1, 1.4, 0.8);
    addCylinder(root, sharedMaterials.goldAccents, mx, 20.4, mz, 2.1, 2.1, 0.6);

    // Upper minaret shaft
    addCylinder(root, sharedMaterials.whiteMarble, mx, 24.5, mz, 1.05, 1.25, 8);

    // Upper lantern gallery & second balcony
    addCylinder(root, sharedMaterials.whiteMarble, mx, 28.8, mz, 1.6, 1.1, 0.6);
    addCylinder(root, sharedMaterials.goldAccents, mx, 29.3, mz, 1.6, 1.6, 0.5);

    // Conical Golden Spire & Crescent Finial
    addCylinder(root, sharedMaterials.goldDome, mx, 32.5, mz, 0.05, 1.1, 6);
    addSphere(root, sharedMaterials.goldDome, mx, 35.6, mz, 0.25);

    colliders.push({ x: x + mx, z: z + mz, halfX: 1.6, halfZ: 1.6, height: 36 });
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

  // Podium (Cantilevered Banking Hall & Grand Entrance)
  addBox(root, abujaPbrMaterials.graniteCharcoal, 0, 3.5, 0, 38, 7, 28);
  addBox(root, abujaPbrMaterials.glassCurtainBlue, 0, 3.5, 14.2, 24, 5, 0.4); // Glass entrance
  addBox(root, abujaPbrMaterials.bronzeSunshade, 0, 6.8, 17, 26, 0.6, 6); // Canopy
  colliders.push({ x, z, halfX: 20, halfZ: 15, height: 8 });

  // Central Core Tower
  addBox(root, abujaPbrMaterials.graniteCharcoal, 0, 26, 0, 16, 45, 16);

  // Dual Sweeping Curved Aerodynamic Wings (Segmented Curtain Wall)
  const segments = 5;
  for (let s = 0; s < segments; s++) {
    const frac = s / (segments - 1);
    const angle = (frac - 0.5) * 0.45;
    const offsetZ = (frac - 0.5) * 14;

    // West curved sail wing
    const segW = addBox(root, abujaPbrMaterials.glassCurtainBlue, -12 - Math.sin(frac * Math.PI) * 2.5, 26, offsetZ, 10, 42 - s * 1.5, 4);
    segW.rotation.y = angle;

    // Bronze horizontal spandrels
    const spW = addBox(root, abujaPbrMaterials.bronzeSunshade, -12 - Math.sin(frac * Math.PI) * 2.5, 26, offsetZ, 10.4, 1.2, 4.2);
    spW.rotation.y = angle;

    // East curved sail wing
    const segE = addBox(root, abujaPbrMaterials.glassCurtainBlue, 12 + Math.sin(frac * Math.PI) * 2.5, 26, -offsetZ, 10, 42 - s * 1.5, 4);
    segE.rotation.y = -angle;

    const spE = addBox(root, abujaPbrMaterials.bronzeSunshade, 12 + Math.sin(frac * Math.PI) * 2.5, 26, -offsetZ, 10.4, 1.2, 4.2);
    spE.rotation.y = -angle;
  }

  colliders.push({ x, z, halfX: 18, halfZ: 14, height: 49 });

  // Rooftop Helipad with "H" Marking & Beacon
  addCylinder(root, materials.concrete, 0, 49, 0, 6.5, 6.5, 0.8);
  addBox(root, materials.white, 0, 49.5, 0, 1.4, 0.1, 5.0);
  addBox(root, materials.white, 0, 49.5, 0, 5.0, 0.1, 1.4);
  // Red aviation beacon
  addCylinder(root, sharedMaterials.orangeAccent, 0, 51, 0, 0.2, 0.2, 2.5);

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

  // Ground Plaza Podium
  addBox(root, abujaPbrMaterials.graniteCharcoal, 0, 3, 0, 42, 6, 26);
  colliders.push({ x, z, halfX: 22, halfZ: 14, height: 7 });

  // Towers: Authentic Octagonal Monoliths with Deep Green Solar Reflective Glass
  const towerPositions = [-12, 12];
  towerPositions.forEach((tx) => {
    // Octagonal main shafts (two crossed boxes with beveled corners)
    addBox(root, abujaPbrMaterials.glassCurtainGreen, tx, 27, 0, 12, 48, 12);
    addBox(root, abujaPbrMaterials.glassCurtainGreen, tx, 27, 0, 14, 48, 8.5);
    addBox(root, abujaPbrMaterials.glassCurtainGreen, tx, 27, 0, 8.5, 48, 14);

    // Dark charcoal horizontal floor spandrel rings
    for (let fl = 8; fl <= 48; fl += 6) {
      addBox(root, abujaPbrMaterials.graniteCharcoal, tx, fl, 0, 12.4, 0.9, 12.4);
    }

    // Rooftop mechanical penthouse
    addBox(root, abujaPbrMaterials.graniteCharcoal, tx, 52, 0, 9, 3, 9);
    addCylinder(root, materials.metal, tx, 54.5, 0, 0.15, 0.3, 3);

    colliders.push({ x: x + tx, z, halfX: 7, halfZ: 7, height: 53 });
  });

  // Glazed Monumental Skybridges at Floors 7 & 9 (heights 28m and 38m)
  for (const bridgeY of [28, 38]) {
    addBox(root, abujaPbrMaterials.glassCurtainGreen, 0, bridgeY, 0, 12, 4.2, 5);
    addBox(root, abujaPbrMaterials.bronzeSunshade, 0, bridgeY - 2.2, 0, 12, 0.6, 5.2);
    addBox(root, abujaPbrMaterials.bronzeSunshade, 0, bridgeY + 2.2, 0, 12, 0.6, 5.2);
  }

  // Entrance Plaza Monument & Water Fountain
  addBox(root, abujaPbrMaterials.marbleCream, 0, 0.4, 16, 8, 0.8, 8);
  addCylinder(root, sharedMaterials.water, 0, 0.6, 16, 3.2, 3.2, 0.4);
  // Corporate emblem obelisk
  addBox(root, sharedMaterials.goldAccents, 0, 2.5, 16, 0.8, 3.5, 0.8);

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

  // Main 3-Storey Retail Complex Structure
  addBox(root, abujaPbrMaterials.stuccoWhite, 0, 8, 0, 56, 16, 36);
  colliders.push({ x, z, halfX: 28, halfZ: 18, height: 18 });

  // Ground Floor Illuminated Storefront Arcade
  addBox(root, abujaPbrMaterials.shopfrontDisplay, 0, 3.2, 18.2, 48, 6.2, 0.4);

  // Upper Level Branded Commercial Signage Atlas Banner
  addBox(root, abujaPbrMaterials.signageAtlas, 0, 14.5, 18.2, 48, 2.6, 0.4);

  // Central Curved Glass Atrium Canopy & Entry Vestibule
  addBox(root, abujaPbrMaterials.glassCurtainBlue, 0, 9.5, 18.6, 22, 15, 1.2);
  addBox(root, abujaPbrMaterials.bronzeSunshade, 0, 4.2, 22.5, 24, 0.8, 8); // Entrance portico

  // Rooftop Dining Terrace with Pergolas & Parasols
  addBox(root, abujaPbrMaterials.paverInterlocking, 0, 16.2, 0, 52, 0.4, 32);
  for (let px = -18; px <= 18; px += 12) {
    addCylinder(root, materials.metal, px, 18, -6, 0.08, 0.08, 3.6);
    addCone(root, sharedMaterials.orangeAccent, px, 20.2, -6, 2.8, 1.2);
  }

  // Parking Bays in Front Forecourt
  addBox(root, abujaPbrMaterials.paverInterlocking, 0, 0.08, 25, 52, 0.16, 8);

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

  // Stepped Multi-Tier Hotel Wings (Ground + 5 Tiered Storeys)
  addBox(root, abujaPbrMaterials.marbleCream, 0, 5, 0, 46, 10, 28);
  addBox(root, abujaPbrMaterials.marbleCream, 0, 13.5, 0, 38, 7, 24);
  addBox(root, abujaPbrMaterials.marbleCream, 0, 19.5, 0, 30, 5, 20);
  colliders.push({ x, z, halfX: 23, halfZ: 14, height: 23 });

  // Guest Room Balconies with Frosted Blue Glass Railings
  for (let b = -16; b <= 16; b += 5.5) {
    // Floor 2 Balcony
    addBox(root, abujaPbrMaterials.glassCurtainBlue, b, 9.5, 14.3, 4.5, 1.1, 0.3);
    // Floor 3 Balcony
    addBox(root, abujaPbrMaterials.glassCurtainBlue, b, 16.5, 12.3, 4.5, 1.1, 0.3);
  }

  // Grand Curved Porte-Cochere (Vehicle Drive-Through Drop-off Canopy)
  addBox(root, abujaPbrMaterials.bronzeSunshade, 0, 5.2, 19, 20, 0.8, 10);
  addCylinder(root, abujaPbrMaterials.marbleCream, -8.5, 2.5, 23, 0.45, 0.45, 5);
  addCylinder(root, abujaPbrMaterials.marbleCream, 8.5, 2.5, 23, 0.45, 0.45, 5);

  // Resort Court with Turquoise Swimming Pool & Sun Deck
  addBox(root, abujaPbrMaterials.paverInterlocking, 0, 0.2, 30, 26, 0.4, 12);
  addBox(root, sharedMaterials.poolWater, 0, 0.35, 30, 20, 0.3, 8.5);

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

  const batches: { [key: string]: THREE.BufferGeometry[] } = {
    stucco: [],
    stone: [],
    glass: [],
    roof: [],
    bronze: [],
    paver: [],
    granite: [],
    gate: [],
    gold: [],
    metal: [],
    pool: [],
  };

  function pushLocalBox(bucket: THREE.BufferGeometry[], bx: number, by: number, bz: number, w: number, h: number, d: number) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(bx, by, bz);
    bucket.push(g);
  }

  function pushLocalCyl(bucket: THREE.BufferGeometry[], bx: number, by: number, bz: number, rt: number, rb: number, h: number) {
    const g = new THREE.CylinderGeometry(rt, rb, h, 12);
    g.translate(bx, by, bz);
    bucket.push(g);
  }

  // 1. Villa Structure
  pushLocalBox(batches.stone, -3, 3.5, -4, 16, 7, 16);
  pushLocalBox(batches.stucco, 6, 3.5, -4, 10, 7, 14);
  colliders.push({ x: x - 1, z: z - 4, halfX: 13, halfZ: 8.5, height: 12 });

  // First Floor
  pushLocalBox(batches.stucco, -2, 9.5, -3, 19, 5, 17);
  pushLocalBox(batches.glass, -2, 9.5, 5.6, 14, 4.2, 0.4);
  pushLocalBox(batches.roof, -2, 12.4, -3, 21, 0.8, 19);
  pushLocalBox(batches.glass, -2, 7.8, 6.2, 15, 1.2, 0.2);

  // Carport
  pushLocalBox(batches.bronze, 8.5, 4.2, 4, 8, 0.4, 7.5);
  pushLocalCyl(batches.metal, 12, 2.1, 7.2, 0.12, 0.12, 4.2);
  pushLocalCyl(batches.metal, 5, 2.1, 7.2, 0.12, 0.12, 4.2);

  // Driveway & Pool
  pushLocalBox(batches.paver, 8.5, 0.08, 8, 8.5, 0.16, 12);
  pushLocalBox(batches.paver, -6, 0.2, 8, 12, 0.4, 8);
  pushLocalBox(batches.pool, -6, 0.35, 8, 9.5, 0.3, 5.5);

  // Compound Walls
  pushLocalBox(batches.stucco, -14, 1.6, 2, 0.6, 3.2, 30);
  pushLocalBox(batches.stucco, 14, 1.6, 2, 0.6, 3.2, 30);
  pushLocalBox(batches.stucco, 0, 1.6, -13, 28, 3.2, 0.6);
  pushLocalBox(batches.stucco, -7.5, 1.6, 17, 13, 3.2, 0.6);
  pushLocalBox(batches.stucco, 9.5, 1.6, 17, 9, 3.2, 0.6);

  // Wall Coping
  pushLocalBox(batches.granite, -14, 3.3, 2, 0.8, 0.2, 30.2);
  pushLocalBox(batches.granite, 14, 3.3, 2, 0.8, 0.2, 30.2);
  pushLocalBox(batches.granite, 0, 3.3, -13, 28.2, 0.2, 0.8);

  // Gate Pillars & Lanterns
  pushLocalBox(batches.stone, -1.2, 1.9, 17, 1.2, 3.8, 1.2);
  pushLocalBox(batches.stone, 5.2, 1.9, 17, 1.2, 3.8, 1.2);
  pushLocalBox(batches.gold, -1.2, 3.9, 17, 0.4, 0.4, 0.4);
  pushLocalBox(batches.gold, 5.2, 3.9, 17, 0.4, 0.4, 0.4);

  // Gate & Booth
  pushLocalBox(batches.gate, 2, 1.5, 17, 5.2, 2.8, 0.2);
  pushLocalBox(batches.stucco, 6.8, 1.6, 15.2, 2.2, 3.2, 2.2);
  pushLocalBox(batches.glass, 6.8, 2.0, 16.35, 1.4, 1.0, 0.2);
  colliders.push({ x: x + 6.8, z: z + 15.2, halfX: 1.2, halfZ: 1.2, height: 3.5 });

  const matMap: { [key: string]: THREE.Material } = {
    stucco: abujaPbrMaterials.stuccoWhite,
    stone: abujaPbrMaterials.ledgerStoneMaitama,
    glass: abujaPbrMaterials.glassCurtainBlue,
    roof: abujaPbrMaterials.terracottaRoof,
    bronze: abujaPbrMaterials.bronzeSunshade,
    paver: abujaPbrMaterials.paverInterlocking,
    granite: abujaPbrMaterials.graniteCharcoal,
    gate: abujaPbrMaterials.compoundGateBlack,
    gold: sharedMaterials.goldAccents,
    metal: materials.metal,
    pool: sharedMaterials.poolWater,
  };

  for (const [key, geos] of Object.entries(batches)) {
    if (geos.length > 0) {
      const merged = mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g));
      for (const g of geos) g.dispose();
      if (merged) {
        const mesh = new THREE.Mesh(merged, matMap[key]);
        mesh.castShadow = key !== "glass" && key !== "pool";
        mesh.receiveShadow = true;
        root.add(mesh);
      }
    }
  }

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
    // Concrete raised stall plinth
    addBox(root, abujaPbrMaterials.paverInterlocking, 0, 0.25, m, 38, 0.5, 12);

    // Green structural steel truss columns
    for (let cx = -16; cx <= 16; cx += 8) {
      addCylinder(root, sharedMaterials.trussGreen, cx, 2.8, m - 5.2, 0.16, 0.16, 5.6);
      addCylinder(root, sharedMaterials.trussGreen, cx, 2.8, m + 5.2, 0.16, 0.16, 5.6);
    }

    // Vaulted pitched corrugated roof
    addBox(root, roofZinc, 0, 5.8, m, 40, 0.3, 13);

    // Colorful authentic market vendor stalls
    const stallColors = [materials.wood, sharedMaterials.orangeAccent, sharedMaterials.goldAccents, sharedMaterials.greenDome];
    for (let sx = -14; sx <= 14; sx += 5.6) {
      const mat = stallColors[Math.abs(sx | 0) % stallColors.length];
      addBox(root, mat, sx, 1.1, m - 1.8, 3.8, 1.4, 2.4);
      addBox(root, mat, sx, 1.1, m + 1.8, 3.8, 1.4, 2.4);
    }

    // Wuse Kasuwa market entrance sign
    addBox(root, abujaPbrMaterials.signageAtlas, 0, 5.0, m + 6.2, 16, 1.4, 0.2);

    colliders.push({ x, z: z + m, halfX: 19.5, halfZ: 6.2, height: 6.5 });
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

  // 1. Structural Steel Gantry Canopy with Cantilevered Eaves
  addBox(root, sharedMaterials.tollBlue, 0, 6.2, 0, 36, 1.2, 14);
  addBox(root, sharedMaterials.hazardYellow, 0, 5.5, 0, 36.4, 0.25, 14.4); // Yellow safety fascia rim

  // 2. 5 Reinforced Concrete Toll Island Booths
  const islandX = [-14, -7, 0, 7, 14];
  islandX.forEach((bx) => {
    // Concrete island with beveled bullnoses
    addBox(root, materials.concrete, bx, 0.2, 0, 1.8, 0.4, 15);
    // Yellow & black hazard stripes on island noses
    addBox(root, sharedMaterials.hazardYellow, bx, 0.22, 7.2, 1.84, 0.42, 0.6);
    addBox(root, materials.black, bx, 0.23, 6.9, 1.85, 0.43, 0.2);
    addBox(root, sharedMaterials.hazardYellow, bx, 0.22, -7.2, 1.84, 0.42, 0.6);
    addBox(root, materials.black, bx, 0.23, -6.9, 1.85, 0.43, 0.2);

    // Stainless steel safety protection bollards
    for (const bz of [-7.0, 7.0]) {
      addCylinder(root, materials.metal, bx, 0.7, bz, 0.14, 0.14, 1.0);
    }

    // Modern aluminum toll booth
    addBox(root, sharedMaterials.whiteMarble, bx, 2.0, 0, 1.4, 2.8, 3.2);
    addBox(root, sharedMaterials.glassBlue, bx, 2.3, 0, 1.45, 1.3, 1.9); // Tinted cashier window
    addBox(root, materials.metal, bx, 1.5, 0, 1.5, 0.1, 2.2); // Service counter ledge

    colliders.push({ x: x + bx, z, halfX: 1.1, halfZ: 4.5, height: 6.5 });
  });

  // 3. 4 Lanes: Lane Clearance Indicators & Articulated Barrier Arms
  const laneX = [-10.5, -3.5, 3.5, 10.5];
  laneX.forEach((lx, idx) => {
    // Overhead green LED lane status indicator
    addBox(root, sharedMaterials.darkSpandrel, lx, 5.4, 6.2, 2.2, 0.6, 0.3);
    addBox(root, sharedMaterials.ledGreen, lx, 5.4, 6.35, 1.6, 0.35, 0.05);

    // Overhead lane designation board
    addBox(root, sharedMaterials.tollBlue, lx, 5.85, 6.25, 2.8, 0.4, 0.1);

    // Articulated red-and-white toll barrier arm (pivoted from island)
    const islandPivotX = lx > 0 ? lx - 3.5 : lx + 3.5;
    addCylinder(root, materials.metal, islandPivotX, 0.7, 1.5, 0.12, 0.12, 1.2);
    const armLen = 4.8;
    const armX = islandPivotX + (lx > 0 ? 2.4 : -2.4);
    addBox(root, sharedMaterials.barrierRed, armX, 0.95, 1.5, armLen, 0.12, 0.12);
    for (let st = -1.8; st <= 1.8; st += 0.9) {
      addBox(root, sharedMaterials.whiteMarble, armX + st, 0.96, 1.5, 0.35, 0.13, 0.13);
    }
  });

  // 4. Large Overhead Interstate Route Sign
  addBox(root, sharedMaterials.signGreen, 0, 8.4, -0.2, 30, 2.4, 0.4);
  addBox(root, materials.white, 0, 8.4, 0.05, 29.5, 2.1, 0.1);
  addBox(root, sharedMaterials.signGreen, 0, 8.4, 0.12, 29.1, 1.8, 0.05);

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
// 16. MODERN DUAL-LANTERN SOLAR STREETLIGHT (WITH PHOTOREALISTIC ILLUMINATION POOLS)
// -------------------------------------------------------------
let cachedLightPoolMat: THREE.MeshBasicMaterial | null = null;
function getStreetlightPoolMaterial(): THREE.MeshBasicMaterial {
  if (cachedLightPoolMat) return cachedLightPoolMat;
  if (typeof document === "undefined") return new THREE.MeshBasicMaterial();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0.0, "rgba(255, 215, 145, 0.48)");
  grad.addColorStop(0.35, "rgba(255, 195, 120, 0.28)");
  grad.addColorStop(0.7, "rgba(255, 175, 90, 0.08)");
  grad.addColorStop(1.0, "rgba(255, 160, 60, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  cachedLightPoolMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  markWorldResourceShared(cachedLightPoolMat);
  return cachedLightPoolMat;
}

const warmLanternMat = new THREE.MeshStandardMaterial({
  color: "#fff4d0",
  emissive: "#ffb84d",
  emissiveIntensity: 2.2,
  roughness: 0.2,
});
markWorldResourceShared(warmLanternMat);

export function createModernSolarStreetlight(materials: GameMaterials): THREE.Group {
  const pole = new THREE.Group();
  pole.name = "ModernSolarStreetlight";
  const poleMesh = new THREE.Mesh(sharedStreetlightPoleGeo, sharedMaterials.poleMat);
  poleMesh.castShadow = true;
  poleMesh.receiveShadow = true;
  const lampMesh = new THREE.Mesh(sharedStreetlightLampGeo, warmLanternMat);
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
  const lampMesh = new THREE.InstancedMesh(sharedStreetlightLampGeo, warmLanternMat, count);
  poleMesh.castShadow = true;
  poleMesh.receiveShadow = true;
  lampMesh.castShadow = false;
  lampMesh.receiveShadow = false;
  poleMesh.name = "StreetlightPoleInstances";
  lampMesh.name = "StreetlightLampInstances";

  // Warm ground illumination pools beneath each streetlight
  const poolGeo = new THREE.PlaneGeometry(12.5, 12.5);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMesh = new THREE.InstancedMesh(poolGeo, getStreetlightPoolMaterial(), count);
  poolMesh.name = "StreetlightGroundLightPools";

  const dummy = new THREE.Object3D();
  const poolDummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const p = positions[i];
    dummy.position.set(p.x, p.y || 0, p.z);
    dummy.rotation.y = p.rotationY || 0;
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    lampMesh.setMatrixAt(i, dummy.matrix);

    poolDummy.position.set(p.x, (p.y || 0) + 0.025, p.z);
    poolDummy.updateMatrix();
    poolMesh.setMatrixAt(i, poolDummy.matrix);
  }
  poleMesh.instanceMatrix.needsUpdate = true;
  lampMesh.instanceMatrix.needsUpdate = true;
  poolMesh.instanceMatrix.needsUpdate = true;

  group.add(poleMesh);
  group.add(lampMesh);
  group.add(poolMesh);
  return group;
}
