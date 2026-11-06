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

  // If inside any road / sidewalk corridor, keep flat
  if (distNS < 20 || distEW < 18) return 0.02;
  if (distMaitamaRoad < 13 || distCbdRoad < 14 || distWuseRoad < 13 || distCivicRoad < 14) return 0.02;

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
  const size = bounds * 2 + 120;
  const segments = 120; // 120x120 smooth height grid
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
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Base lush savannah green
  ctx.fillStyle = "#385e3f";
  ctx.fillRect(0, 0, 512, 512);

  // Laterite reddish earth streaks & mineral speckles
  let seed = 49201;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Organic grass clump mottling
  for (let i = 0; i < 18000; i++) {
    const rx = rnd() * 512;
    const ry = rnd() * 512;
    const rVal = rnd();
    if (rVal < 0.35) {
      ctx.fillStyle = "#2a4b32"; // Deep green shadow
    } else if (rVal < 0.70) {
      ctx.fillStyle = "#466f4d"; // Sunlit blade
    } else if (rVal < 0.88) {
      ctx.fillStyle = "#5c7948"; // Golden savannah dry blade
    } else {
      ctx.fillStyle = "#6d4734"; // Subsurface laterite soil fleck
    }
    ctx.fillRect(rx, ry, 1.8, 1.8);
  }

  // Broad laterite soil mottles
  for (let i = 0; i < 40; i++) {
    const cx = rnd() * 512;
    const cy = rnd() * 512;
    const rad = 15 + rnd() * 35;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    grad.addColorStop(0, "rgba(109, 71, 52, 0.18)");
    grad.addColorStop(1, "rgba(56, 94, 63, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(32, 32);

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
  root.position.set(40, 0, -255);

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
  graniteTex.repeat.set(6, 4);

  const asoRockMat = new THREE.MeshStandardMaterial({
    map: graniteTex,
    roughness: 0.85,
    metalness: 0.12,
    flatShading: true,
  });

  const foothillMat = new THREE.MeshStandardMaterial({
    color: "#415f3e", // Savannah vegetation covering foothills
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });

  // 1. Core Inselberg Monolith Geometries (Batched)
  const rockGeos: THREE.BufferGeometry[] = [];

  // Main Central Massif (Colossal granite dome: 280m wide, 145m high, 150m deep)
  const mainDome = new THREE.DodecahedronGeometry(75, 2);
  mainDome.scale(1.9, 1.0, 1.1);
  mainDome.translate(0, 72, 0);
  rockGeos.push(mainDome);

  // Western Escarpment Ridge (sheer dramatic face)
  const westRidge = new THREE.DodecahedronGeometry(55, 2);
  westRidge.scale(1.6, 1.15, 0.9);
  westRidge.translate(-75, 58, 12);
  rockGeos.push(westRidge);

  // Eastern Shoulder & Secondary Summit
  const eastSummit = new THREE.DodecahedronGeometry(60, 2);
  eastSummit.scale(1.5, 0.95, 1.0);
  eastSummit.translate(78, 62, -15);
  rockGeos.push(eastSummit);

  // Summit Pinnacle Dome (highest point of Aso Rock)
  const summitDome = new THREE.DodecahedronGeometry(42, 2);
  summitDome.scale(1.4, 0.8, 1.0);
  summitDome.translate(-15, 125, -5);
  rockGeos.push(summitDome);

  // Southern Facing Sheer Wall (facing National Assembly & City Center)
  const southWall = new THREE.BoxGeometry(190, 80, 45);
  southWall.translate(5, 42, 38);
  rockGeos.push(southWall);

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
    const hill = new THREE.IcosahedronGeometry(1, 1);
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
    x: 40,
    z: -255,
    halfX: 130,
    halfZ: 85,
    height: 160,
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
  const lawnMesh = new THREE.Mesh(lawnGeo, sharedMaterials.lawn);
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

  // 4. Botanical Flower Beds (Vibrant tropical floral displays)
  const flowerBedCanvas = document.createElement("canvas");
  flowerBedCanvas.width = flowerBedCanvas.height = 128;
  const fCtx = flowerBedCanvas.getContext("2d")!;
  fCtx.fillStyle = "#2d5232";
  fCtx.fillRect(0, 0, 128, 128);
  // Red, gold and purple bougainvillea / marigold blooms
  const colors = ["#e74c3c", "#f39c12", "#9b59b6", "#e67e22", "#f1c40f"];
  for (let i = 0; i < 450; i++) {
    fCtx.fillStyle = colors[i % colors.length];
    fCtx.beginPath();
    fCtx.arc(Math.random() * 128, Math.random() * 128, 1.8, 0, Math.PI * 2);
    fCtx.fill();
  }
  const flowerTex = new THREE.CanvasTexture(flowerBedCanvas);
  flowerTex.wrapS = flowerTex.wrapT = THREE.RepeatWrapping;
  flowerTex.repeat.set(4, 2);
  const flowerMat = new THREE.MeshStandardMaterial({
    map: flowerTex,
    roughness: 0.8,
  });

  const bedGeos: THREE.BufferGeometry[] = [];
  const bedOffsets = [
    { x: -18, z: -18 },
    { x: 18, z: -18 },
    { x: -18, z: 18 },
    { x: 18, z: 18 },
    { x: -28, z: 0 },
    { x: 28, z: 0 },
  ];
  bedOffsets.forEach((b) => {
    const bed = new THREE.BoxGeometry(8, 0.28, 5);
    bed.translate(b.x, 0.22, b.z);
    bedGeos.push(bed);
  });
  const mergedBeds = safeMergeGeometries(bedGeos);
  for (const g of bedGeos) g.dispose();
  const bedsMesh = new THREE.Mesh(mergedBeds, flowerMat);
  bedsMesh.name = "MillenniumParkFlowerBeds";
  bedsMesh.receiveShadow = true;
  bedsMesh.userData.noMerge = true;
  root.add(bedsMesh);

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
