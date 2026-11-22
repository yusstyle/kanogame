import { abujaPbrMaterials } from "./abujaMaterials";
import { ABUJA_ASO_ROCK_POSITION } from "./abujaLandmarks";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Collider, GameMaterials } from "./types";
import { sharedMaterials } from "./abujaDistrict";

function safeMergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared);
  if (!merged) {
    throw new Error("safeMergeGeometries failed to merge geometries");
  }
  return merged;
}

/**
 * Calculates continuous terrain elevation for Abuja.
 * Smoothly flattens out to 0 on road corridors, junctions, and building compounds
 * while rising naturally into rolling savannah knolls and inselberg foothills.
 */
export function getAbujaElevation(x: number, z: number): number {
  // 1. Level Road Corridors & Roundabout
  // Shehu Shagari Way (North-South arterial: width 28m + sidewalks)
  const distNS = Math.abs(x);
  // Constitution Avenue (East-West arterial: width 24m + sidewalks)
  const distEW = Math.abs(z);
  // Central Roundabout (radius ~24m)
  const distCenter = Math.hypot(x, z);
  if (distCenter < 28) return 0.02;

  // Secondary Avenues
  const distMaitamaRoad = Math.abs(x - (-90));
  const distCbdRoad = Math.abs(x - 90);
  const distWuseRoad = Math.abs(z - 90);
  const distCivicRoad = Math.abs(z - (-90));

  // Expanded District Arterials (N-S at -450 & +450, E-W at -450 & +450)
  const distOuterWestRoad = Math.abs(x - (-450));
  const distOuterEastRoad = Math.abs(x - 450);
  const distOuterNorthRoad = Math.abs(z - (-450));
  const distOuterSouthRoad = Math.abs(z - 450);

  // If inside any road / sidewalk corridor, keep flat
  if (distNS < 20 || distEW < 18) return 0.02;
  if (distMaitamaRoad < 13 || distCbdRoad < 14 || distWuseRoad < 13 || distCivicRoad < 14) return 0.02;
  if (distOuterWestRoad < 15 || distOuterEastRoad < 15 || distOuterNorthRoad < 15 || distOuterSouthRoad < 15) return 0.02;

  // Toll plaza approach (z <= -140, |x| <= 26)
  if (z <= -140 && distNS < 28) return 0.02;

  // 2. Level Building Plots
  // National Assembly (0, -105)
  if (Math.abs(x) < 32 && Math.abs(z - (-105)) < 26) return 0.02;
  // National Mosque (48, -42)
  if (Math.abs(x - 48) < 28 && Math.abs(z - (-42)) < 28) return 0.02;
  // Christian Centre (48, 42)
  if (Math.abs(x - 48) < 26 && Math.abs(z - 42) < 26) return 0.02;
  // CBN Tower (90, -35) & NNPC Towers (90, 40)
  if (Math.abs(x - 90) < 24 && Math.abs(z) < 65) return 0.02;
  // Wuse Mall & Hotel (-60 to -40, 60 to 160)
  if (x > -80 && x < -35 && z > 50 && z < 165) return 0.02;
  // Maitama Villa (-65, -35)
  if (Math.abs(x - (-65)) < 30 && Math.abs(z - (-35)) < 26) return 0.02;
  // Commercial cluster (Market, Fuel Station, Airport Shuttle: z 110-135)
  if (z > 105 && z < 135 && x > -30 && x < 105) return 0.02;

  // Distance from nearest road corridor to compute smooth ramp-up blend factor
  const minCorridorDist = Math.min(
    Math.max(0, distNS - 20),
    Math.max(0, distEW - 18),
    Math.max(0, distMaitamaRoad - 13),
    Math.max(0, distCbdRoad - 14),
    Math.max(0, distWuseRoad - 13),
    Math.max(0, distCivicRoad - 14),
    Math.max(0, distOuterWestRoad - 15),
    Math.max(0, distOuterEastRoad - 15),
    Math.max(0, distOuterNorthRoad - 15),
    Math.max(0, distOuterSouthRoad - 15),
  );
  const ramp = Math.min(1.0, minCorridorDist / 18.0); // 0 at road edge, 1 at 18m away
  const blend = ramp * ramp * (3 - 2 * ramp); // smoothstep

  // Natural undulating savannah wave equations
  let h = 0;

  // Low frequency broad savannah swell
  h += Math.sin(x * 0.018 + 0.4) * Math.cos(z * 0.016 - 0.2) * 2.8;
  h += Math.sin((x + z) * 0.025) * 1.6;

  // Northwest rolling knolls (Maitama hills direction)
  if (x < -40 && z < -40) {
    const dNW = Math.hypot(x - (-120), z - (-120));
    h += Math.max(0, 1 - dNW / 100) * 6.5;
  }

  // Southeast gentle elevation (Asokoro / Guzape direction)
  if (x > 30 && z > 60) {
    const dSE = Math.hypot(x - 110, z - 130);
    h += Math.max(0, 1 - dSE / 90) * 5.2;
  }

  // Northern inselberg foothills (approaching Aso Rock at z < -180)
  if (z < -160) {
    const fZ = (-z - 160) / 100;
    h += fZ * fZ * 14.0;
  }

  return Math.max(0.02, h * blend);
}

/**
 * Builds realistic rolling savannah terrain with procedural PBR micro-texture
 */
export function buildRollingSavannahTerrain(bounds: number): THREE.Mesh {
  const size = Math.max(bounds * 2 + 120, 2200);
  const segments = 128; // 128x128 smooth height grid across expanded territory
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = getAbujaElevation(vx, vz);
    pos.setY(i, vy);
  }
  geo.computeVertexNormals();

    // Savannah PBR Grass Texture with Laterite Earth Soil Bleed
  // Photorealistic continuous gradients without discrete single-pixel flecks
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Deep lush Nigerian savannah base
  ctx.fillStyle = "#335436";
  ctx.fillRect(0, 0, 512, 512);

  let seed = 49201;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Multi-tier continuous turf tone washes (broad organic radial gradients)
  for (let i = 0; i < 90; i++) {
    const cx = rnd() * 512;
    const cy = rnd() * 512;
    const rad = 20 + rnd() * 60;
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
    const rVal = rnd();
    if (rVal < 0.4) {
      grad.addColorStop(0, "rgba(35, 68, 38, 0.45)"); // Deep emerald shadow
    } else if (rVal < 0.75) {
      grad.addColorStop(0, "rgba(75, 115, 68, 0.40)"); // Sunlit savannah blade tone
    } else {
      grad.addColorStop(0, "rgba(95, 118, 62, 0.35)"); // Golden dry savannah blade
    }
    grad.addColorStop(1, "rgba(51, 84, 54, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Organic laterite reddish soil bleeds and gentle earth streaks
  for (let i = 0; i < 35; i++) {
    const cx = rnd() * 512;
    const cy = rnd() * 512;
    const rad = 15 + rnd() * 45;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    grad.addColorStop(0, "rgba(115, 75, 52, 0.28)");
    grad.addColorStop(0.7, "rgba(95, 65, 45, 0.12)");
    grad.addColorStop(1, "rgba(51, 84, 54, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft fine blade directionality (drawn as smooth linear brush strokes)
  ctx.strokeStyle = "rgba(40, 80, 42, 0.08)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 300; i++) {
    const sx = rnd() * 512;
    const sy = rnd() * 512;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 6 + rnd() * 12, sy + (rnd() - 0.5) * 4);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(36, 36);
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "AbujaRollingSavannahTerrain";
  mesh.receiveShadow = true;
  mesh.userData.noMerge = true;
  return mesh;
}

/**
 * Creates realistic Aso Rock Monolith:
 * Colossal inselberg monolith with sheer vertical granite faces,
 * rounded granite domes, geological weathering crevices, and layered foothills.
 */
export function createRealisticAsoRock(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const root = new THREE.Group();
  root.name = "RealisticAsoRockMonolith";
  // Keep the escarpment behind the Three Arms skyline instead of putting the
  // foreground camera almost against the rock face.
  root.position.set(
    ABUJA_ASO_ROCK_POSITION.x,
    getAbujaElevation(ABUJA_ASO_ROCK_POSITION.x, ABUJA_ASO_ROCK_POSITION.z),
    ABUJA_ASO_ROCK_POSITION.z,
  );

  // Weathered Nigerian Granite PBR Material
  const graniteCanvas = document.createElement("canvas");
  graniteCanvas.width = graniteCanvas.height = 512;
  const gCtx = graniteCanvas.getContext("2d")!;
  gCtx.fillStyle = "#736b63"; // Weathered biotite granite grey
  gCtx.fillRect(0, 0, 512, 512);

  let seed = 88319;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Vertical water-erosion streaks (characteristic dark rain washes on Aso Rock)
  for (let i = 0; i < 45; i++) {
    const sx = rnd() * 512;
    const width = 2 + rnd() * 8;
    const grad = gCtx.createLinearGradient(sx, 0, sx + width, 0);
    grad.addColorStop(0, "rgba(45, 41, 38, 0)");
    grad.addColorStop(0.5, "rgba(42, 39, 36, 0.45)");
    grad.addColorStop(1, "rgba(45, 41, 38, 0)");
    gCtx.fillStyle = grad;
    gCtx.fillRect(sx, 0, width, 512);
  }

  // Crystalline quartz and feldspar grain
  for (let i = 0; i < 12000; i++) {
    const gx = rnd() * 512;
    const gy = rnd() * 512;
    const gv = rnd();
    gCtx.fillStyle = gv > 0.6 ? "#8c847a" : (gv > 0.3 ? "#544e47" : "#a89f94");
    gCtx.fillRect(gx, gy, 1.6, 1.6);
  }

  const graniteTex = new THREE.CanvasTexture(graniteCanvas);
  graniteTex.colorSpace = THREE.SRGBColorSpace;
  graniteTex.wrapS = graniteTex.wrapT = THREE.RepeatWrapping;
  graniteTex.repeat.set(2, 1);

  const asoRockMat = new THREE.MeshStandardMaterial({
    map: graniteTex,
    roughness: 0.85,
    metalness: 0.02,
    flatShading: false,
  });

  const foothillMat = new THREE.MeshStandardMaterial({
    color: "#354a32", // Natural tropical savannah hillside grass & granite soil
    roughness: 0.95,
    metalness: 0.02,
    flatShading: false,
  });

  // 1. Core Inselberg Monolith Geometries (Batched). A subdivided rock surface
  // keeps the skyline rounded but gives the summit and shoulders natural breaks.
  const rockGeos: THREE.BufferGeometry[] = [];

  // Main mass: a broad inselberg with a less spherical profile and irregular
  // skyline. The deterministic displacement is baked once into the shared mesh.
  const mainDome = new THREE.IcosahedronGeometry(1, 4);
  const mainPos = mainDome.getAttribute("position");
  for (let i = 0; i < mainPos.count; i++) {
    const nx = mainPos.getX(i);
    const ny = mainPos.getY(i);
    const nz = mainPos.getZ(i);
    const ridge = Math.sin(nx * 5.4 + nz * 2.1) * 0.035 + Math.sin(nz * 7.1 - nx * 1.7) * 0.025;
    const crown = 1 - Math.max(0, ny) * 0.16;
    const radial = (1 + ridge) * crown;
    mainPos.setXYZ(i, nx * 137 * radial, 70 + ny * 76 * (1 + ridge * 0.7), nz * 105 * radial);
  }
  mainPos.needsUpdate = true;
  mainDome.computeVertexNormals();
  rockGeos.push(mainDome);

  // Lower shoulders create overlapping geological ridges instead of a single dome.
  const westRidge = new THREE.IcosahedronGeometry(1, 3);
  westRidge.scale(74, 62, 76);
  westRidge.translate(-88, 47, 10);
  westRidge.computeVertexNormals();
  rockGeos.push(westRidge);

  const eastSummit = new THREE.IcosahedronGeometry(1, 3);
  eastSummit.scale(72, 66, 78);
  eastSummit.translate(82, 50, -16);
  eastSummit.computeVertexNormals();
  rockGeos.push(eastSummit);

  // Offset summit shoulder breaks the rounded, single-peak outline.
  const summitDome = new THREE.IcosahedronGeometry(1, 3);
  summitDome.scale(58, 44, 54);
  summitDome.translate(-20, 116, -7);
  summitDome.computeVertexNormals();
  rockGeos.push(summitDome);

  const mergedRock = safeMergeGeometries(rockGeos);
  for (const g of rockGeos) g.dispose();

  const monolithMesh = new THREE.Mesh(mergedRock, asoRockMat);
  monolithMesh.name = "AsoRockMassifMerged";
  monolithMesh.castShadow = true;
  monolithMesh.receiveShadow = true;
  monolithMesh.userData.noMerge = true;
  root.add(monolithMesh);

  // 2. Layered Talus Foothills & Granite Outcrops
  const foothillGeos: THREE.BufferGeometry[] = [];
  const boulderGeos: THREE.BufferGeometry[] = [];

  // Staggered green talus mounds
  const foothillOffsets = [
    { x: -130, z: 45, sx: 55, sy: 22, sz: 45 },
    { x: -80, z: 65, sx: 60, sy: 28, sz: 50 },
    { x: -20, z: 75, sx: 70, sy: 32, sz: 55 },
    { x: 45, z: 70, sx: 65, sy: 26, sz: 48 },
    { x: 105, z: 55, sx: 55, sy: 24, sz: 45 },
    { x: 145, z: 25, sx: 50, sy: 20, sz: 40 },
    { x: -160, z: -10, sx: 52, sy: 25, sz: 45 },
    { x: 165, z: -25, sx: 52, sy: 22, sz: 42 },
  ];

  foothillOffsets.forEach((f) => {
    const hill = new THREE.DodecahedronGeometry(1, 2);
    hill.scale(f.sx, f.sy, f.sz);
    hill.translate(f.x, f.sy * 0.45, f.z);
    foothillGeos.push(hill);
  });

  // Giant granite talus boulders around the base
  for (let b = 0; b < 18; b++) {
    const bx = -140 + b * 16 + (b % 3) * 5;
    const bz = 40 + (b % 4) * 12;
    const bs = 4 + (b % 5) * 2.2;
    const boulder = new THREE.DodecahedronGeometry(bs, 0);
    boulder.translate(bx, bs * 0.45, bz);
    boulderGeos.push(boulder);
  }

  const mergedFoothills = safeMergeGeometries(foothillGeos);
  for (const g of foothillGeos) g.dispose();
  const foothillsMesh = new THREE.Mesh(mergedFoothills, foothillMat);
  foothillsMesh.name = "AsoRockFoothillsMerged";
  foothillsMesh.receiveShadow = true;
  foothillsMesh.userData.noMerge = true;
  root.add(foothillsMesh);

  const mergedBoulders = safeMergeGeometries(boulderGeos);
  for (const g of boulderGeos) g.dispose();
  const bouldersMesh = new THREE.Mesh(mergedBoulders, asoRockMat);
  bouldersMesh.name = "AsoRockBouldersMerged";
  bouldersMesh.castShadow = true;
  bouldersMesh.receiveShadow = true;
  bouldersMesh.userData.noMerge = true;
  root.add(bouldersMesh);

  // Large perimeter collider to prevent player escaping map boundaries behind rock
  colliders.push({
    x: ABUJA_ASO_ROCK_POSITION.x,
    z: ABUJA_ASO_ROCK_POSITION.z,
    halfX: 170,
    halfZ: 135,
    height: 150,
  });

  return root;
}

/**
 * Creates Millennium Park & Recreational Gardens:
 * Combines Italianate terraced garden promenades with lush naturalistic Nigerian parkland,
 * multi-tier fountains, pergolas, botanical floral beds, and walking pathways.
 */
export function createMillenniumParkLandscape(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.name = "MillenniumParkLandscape";
  root.position.set(x, 0, z);

  const parkW = 86;
  const parkD = 72;

  // 1. Manicured Italianate Lawn Base
  const lawnGeo = new THREE.BoxGeometry(parkW, 0.18, parkD);
  const lawnMesh = new THREE.Mesh(lawnGeo, abujaPbrMaterials.estateLawn);
  lawnMesh.position.set(0, 0.09, 0);
  lawnMesh.receiveShadow = true;
  lawnMesh.userData.noMerge = true;
  root.add(lawnMesh);

  // 2. Decorative Travertine Paver Walkways (Batched)
  const pathGeos: THREE.BufferGeometry[] = [];

  // Grand Central Promenade (North-South: 7m wide)
  const mainPromenade = new THREE.BoxGeometry(7, 0.08, parkD);
  mainPromenade.translate(0, 0.16, 0);
  pathGeos.push(mainPromenade);

  // Transverse Axis Promenade (East-West: 6m wide)
  const crossPromenade = new THREE.BoxGeometry(parkW, 0.08, 6);
  crossPromenade.translate(0, 0.16, 0);
  pathGeos.push(crossPromenade);

  // Outer Perimeter Walking Circuit
  for (const px of [-parkW * 0.42, parkW * 0.42]) {
    const sidePath = new THREE.BoxGeometry(3.5, 0.06, parkD - 8);
    sidePath.translate(px, 0.15, 0);
    pathGeos.push(sidePath);
  }
  for (const pz of [-parkD * 0.42, parkD * 0.42]) {
    const endPath = new THREE.BoxGeometry(parkW - 8, 0.06, 3.5);
    endPath.translate(0, 0.15, pz);
    pathGeos.push(endPath);
  }

  // Circular Fountain Plaza
  const plazaRing = new THREE.CylinderGeometry(14, 14, 0.08, 32);
  plazaRing.translate(0, 0.16, 0);
  pathGeos.push(plazaRing);

  const mergedPaths = safeMergeGeometries(pathGeos);
  for (const g of pathGeos) g.dispose();
  const pathsMesh = new THREE.Mesh(mergedPaths, materials.sidewalk);
  pathsMesh.name = "MillenniumParkWalkwaysMerged";
  pathsMesh.receiveShadow = true;
  pathsMesh.userData.noMerge = true;
  root.add(pathsMesh);

  // 3. Manfredi Nicoletti Monumental Fountain Feature (Center of Park)
  // Outer granite basin
  const outerBasin = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.4, 0.65, 32), materials.concrete);
  outerBasin.position.set(0, 0.45, 0);
  outerBasin.receiveShadow = true;
  outerBasin.castShadow = true;
  root.add(outerBasin);

  const poolWater = new THREE.Mesh(
    new THREE.CylinderGeometry(10.2, 10.2, 0.4, 32),
    sharedMaterials.water,
  );
  poolWater.position.set(0, 0.55, 0);
  root.add(poolWater);

  // Tier 2 Raised Basin
  const midBasin = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.5, 0.9, 24), materials.concrete);
  midBasin.position.set(0, 1.1, 0);
  midBasin.castShadow = true;
  root.add(midBasin);

  const midWater = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.3, 24), sharedMaterials.water);
  midWater.position.set(0, 1.45, 0);
  root.add(midWater);

  // Tier 3 Sculptural Spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 4.2, 8), materials.metal);
  spire.position.set(0, 3.2, 0);
  spire.castShadow = true;
  root.add(spire);

  colliders.push({ x, z, halfX: 11.5, halfZ: 11.5, height: 4 });

  // 4. Botanical Flower Beds (Authentic Nigerian Tropical Displays)
  const bedGeos: THREE.BufferGeometry[] = [];
  const curbGeos: THREE.BufferGeometry[] = [];
  const bedOffsets = [
    { x: -18, z: -18 },
    { x: 18, z: -18 },
    { x: -18, z: 18 },
    { x: 18, z: 18 },
    { x: -28, z: 0 },
    { x: 28, z: 0 },
  ];
  bedOffsets.forEach((b) => {
    // Raised loamy soil bed with botanical flowers
    const bed = new THREE.BoxGeometry(7.6, 0.28, 4.6);
    bed.translate(b.x, 0.20, b.z);
    bedGeos.push(bed);

    // Precast concrete border retaining curb frame
    const curbN = new THREE.BoxGeometry(8.2, 0.22, 0.35);
    curbN.translate(b.x, 0.21, b.z - 2.45);
    const curbS = new THREE.BoxGeometry(8.2, 0.22, 0.35);
    curbS.translate(b.x, 0.21, b.z + 2.45);
    const curbW = new THREE.BoxGeometry(0.35, 0.22, 5.25);
    curbW.translate(b.x - 3.95, 0.21, b.z);
    const curbE = new THREE.BoxGeometry(0.35, 0.22, 5.25);
    curbE.translate(b.x + 3.95, 0.21, b.z);
    curbGeos.push(curbN, curbS, curbW, curbE);
  });

  const mergedBeds = safeMergeGeometries(bedGeos);
  for (const g of bedGeos) g.dispose();
  const bedsMesh = new THREE.Mesh(mergedBeds, abujaPbrMaterials.botanicalFlowerBed);
  bedsMesh.name = "MillenniumParkFlowerBeds";
  bedsMesh.receiveShadow = true;
  bedsMesh.userData.noMerge = true;
  root.add(bedsMesh);

  const mergedCurbs = safeMergeGeometries(curbGeos);
  for (const g of curbGeos) g.dispose();
  const flowerCurbMesh = new THREE.Mesh(mergedCurbs, materials.curb);
  flowerCurbMesh.name = "MillenniumParkFlowerCurbs";
  flowerCurbMesh.receiveShadow = true;
  flowerCurbMesh.userData.noMerge = true;
  root.add(flowerCurbMesh);
  // 5. Wooden Pergolas & Garden Pavilions
  for (const gz of [-24, 24]) {
    const pergola = new THREE.Group();
    pergola.position.set(0, 0, gz);
    // 6 Columns
    for (let c = -5; c <= 5; c += 2.5) {
      const colL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), materials.wood);
      colL.position.set(c, 1.6, -2);
      colL.castShadow = true;
      pergola.add(colL);
      const colR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), materials.wood);
      colR.position.set(c, 1.6, 2);
      colR.castShadow = true;
      pergola.add(colR);
    }
    // Cross beams
    for (let b = -5.5; b <= 5.5; b += 1.1) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 4.8), materials.wood);
      beam.position.set(b, 3.25, 0);
      pergola.add(beam);
    }
    root.add(pergola);
    colliders.push({ x, z: z + gz, halfX: 6.0, halfZ: 2.5, height: 3.5 });
  }

  return root;
}
