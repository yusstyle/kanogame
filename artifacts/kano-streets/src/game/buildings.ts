import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeSignMaterial } from "./materials";
import type { BuildingKind, Collider, GameMaterials, PlotAsset } from "./types";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const roundCylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
const texturedBoxGeometryCache = new Map<string, THREE.BufferGeometry>();

function getTexturedBoxGeometry(width: number, height: number, depth: number, tileSize: number) {
  const key = [width, height, depth, tileSize].map((value) => value.toFixed(3)).join(":");
  const cached = texturedBoxGeometryCache.get(key);
  if (cached) return cached;

  const geometry = unitBox.clone();
  const index = geometry.index;
  const uv = geometry.getAttribute("uv");
  if (!index) return geometry;

  const faceSizes: [number, number][] = [
    [depth, height],
    [depth, height],
    [depth, width],
    [depth, width],
    [width, height],
    [width, height],
  ];
  geometry.groups.forEach((group, face) => {
    const [faceWidth, faceHeight] = faceSizes[face];
    const repeatU = faceWidth / tileSize;
    const repeatV = faceHeight / tileSize;
    const visited = new Set<number>();
    for (let offset = group.start; offset < group.start + group.count; offset += 1) {
      const vertex = index.getX(offset);
      if (visited.has(vertex)) continue;
      visited.add(vertex);
      uv.setXY(vertex, uv.getX(vertex) * repeatU, uv.getY(vertex) * repeatV);
    }
  });
  uv.needsUpdate = true;
  texturedBoxGeometryCache.set(key, geometry);
  return geometry;
}

function addArchFrame(
  root: THREE.Group,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  outerWidth: number,
  outerHeight: number,
  innerWidth: number,
  innerHeight: number,
  depth = 0.14,
) {
  const shape = new THREE.Shape();
  shape.moveTo(-outerWidth / 2, 0);
  shape.lineTo(-outerWidth / 2, outerHeight * 0.63);
  shape.quadraticCurveTo(0, outerHeight * 1.08, outerWidth / 2, outerHeight * 0.63);
  shape.lineTo(outerWidth / 2, 0);
  shape.closePath();

  const opening = new THREE.Path();
  opening.moveTo(-innerWidth / 2, 0.02);
  opening.lineTo(-innerWidth / 2, innerHeight * 0.62);
  opening.quadraticCurveTo(0, innerHeight * 1.08, innerWidth / 2, innerHeight * 0.62);
  opening.lineTo(innerWidth / 2, 0.02);
  opening.closePath();
  shape.holes.push(opening);

  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.025, bevelThickness: 0.025 }),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}


let cachedGateMetalGeom: THREE.BufferGeometry | null = null;
let cachedGateTrimGeom: THREE.BufferGeometry | null = null;
let cachedGateOchreGeom: THREE.BufferGeometry | null = null;
let cachedGateDarkTrimGeom: THREE.BufferGeometry | null = null;

function makeBoxPartGeom(x: number, y: number, z: number, w: number, h: number, d: number, rotZ = 0): THREE.BufferGeometry {
  const g = unitBox.clone();
  const m = new THREE.Matrix4();
  if (rotZ !== 0) {
    m.makeRotationZ(rotZ);
    g.applyMatrix4(m);
  }
  m.makeScale(w, h, d);
  g.applyMatrix4(m);
  m.makeTranslation(x, y, z);
  g.applyMatrix4(m);
  return g;
}

function getSharedGateGeometries() {
  if (cachedGateMetalGeom) {
    return {
      metal: cachedGateMetalGeom,
      trim: cachedGateTrimGeom!,
      ochre: cachedGateOchreGeom!,
      darkTrim: cachedGateDarkTrimGeom!,
    };
  }

  cachedGateMetalGeom = makeBoxPartGeom(0, 0.86, 0, 1.82, 1.62, 0.14);

  const trimParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i += 2) {
    const x = -0.76 + i * 0.19;
    trimParts.push(makeBoxPartGeom(x, 0.84, 0.09, 0.05, 1.54, 0.09));
  }
  trimParts.push(makeBoxPartGeom(0, 0.22, 0.1, 1.88, 0.09, 0.11));
  trimParts.push(makeBoxPartGeom(0, 1.55, 0.1, 1.88, 0.08, 0.11));
  cachedGateTrimGeom = mergeGeometries(trimParts, false);
  for (const p of trimParts) p.dispose();

  const ochreParts: THREE.BufferGeometry[] = [];
  for (let i = 1; i < 9; i += 2) {
    const x = -0.76 + i * 0.19;
    ochreParts.push(makeBoxPartGeom(x, 0.84, 0.09, 0.05, 1.54, 0.09));
  }
  for (const x of [-0.48, 0, 0.48]) {
    ochreParts.push(makeBoxPartGeom(x, 0.88, 0.12, 0.14, 0.14, 0.08, Math.PI / 4));
  }
  cachedGateOchreGeom = mergeGeometries(ochreParts, false);
  for (const p of ochreParts) p.dispose();

  cachedGateDarkTrimGeom = makeBoxPartGeom(0, 0.04, 0.01, 2.1, 0.12, 0.68);

  return {
    metal: cachedGateMetalGeom,
    trim: cachedGateTrimGeom,
    ochre: cachedGateOchreGeom,
    darkTrim: cachedGateDarkTrimGeom,
  };
}

function box(
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
  const tileSize = material.userData.textureTileSize;
  const geometry = typeof tileSize === "number"
    ? getTexturedBoxGeometry(width, height, depth, tileSize)
    : unitBox;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  rotationX = 0,
) {
  const mesh = new THREE.Mesh(roundCylinder, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(radius, height, radius);
  mesh.rotation.x = rotationX;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCourtyard(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  modern = false,
  variant = 0,
): THREE.Group {
  const height = modern ? 1.62 + (variant % 2) * 0.13 : 1.78 + (variant % 3) * 0.07;
  const sideMaterial = modern
    ? variant % 2 ? materials.concrete : materials.compoundWall
    : variant % 3 === 0 ? materials.compoundWall : materials.clay;

  box(root, sideMaterial, -6.75, height / 2, 0, 0.42, height, 14.4);
  box(root, sideMaterial, 6.75, height / 2, 0, 0.42, height, 14.4);
  box(root, sideMaterial, 0, height / 2, -7.0, 13.9, height, 0.42);
  box(root, sideMaterial, -4.2, height / 2, 7.0, 5.5, height, 0.42);
  box(root, sideMaterial, 4.2, height / 2, 7.0, 5.5, height, 0.42);

  box(root, materials.trim, -6.75, height + 0.05, 0, 0.5, 0.1, 14.55);
  box(root, materials.trim, 6.75, height + 0.05, 0, 0.5, 0.1, 14.55);
  box(root, materials.trim, 0, height + 0.05, -7.0, 14.05, 0.1, 0.5);
  box(root, materials.trim, -4.2, height + 0.05, 7.0, 5.62, 0.1, 0.5);
  box(root, materials.trim, 4.2, height + 0.05, 7.0, 5.62, 0.1, 0.5);

  for (const x of [-6.72, 6.72]) {
    for (const z of [-6.95, 6.95]) {
      box(root, materials.trim, x, height * 0.56, z, 0.58, height * 1.12, 0.58);
      box(root, materials.darkTrim, x, height * 1.14, z, 0.72, 0.16, 0.72);
    }
  }

  addArchFrame(root, modern ? materials.concrete : materials.trim, 0, 0, 7.03, 3.25, 2.55, 2.05, 2.06, 0.28);

  if (!modern) {
    // Traditional Hausa Zaure Gatehouse Portal Architecture
    // 1. Stepped clay pilasters / flanking entrance buttresses
    for (const px of [-1.75, 1.75]) {
      box(root, materials.clay, px, height * 0.75, 7.18, 0.52, height * 1.5, 0.48);
      // Traditional decorative pinnacle (Zankwaye) crowning the portal buttress
      const portalPinnacle = box(root, materials.ochre, px, height * 1.5 + 0.35, 7.18, 0.28, 0.65, 0.28);
      portalPinnacle.rotation.y = Math.PI / 4;
    }
    // 2. Heavy horizontal desert timber lintel beam (Garafuni) spanning above the entrance
    box(root, materials.wood, 0, height * 1.4, 7.22, 3.8, 0.22, 0.26);
    // 3. Hausa geometric plaster relief motif (Dakin Gona northern star / diamond crest)
    const crest = box(root, materials.trim, 0, height * 1.4 + 0.38, 7.24, 0.45, 0.45, 0.12);
    crest.rotation.z = Math.PI / 4;
    // 4. Zaure rain canopy projection with authentic wooden drainage spout (Zannuwa)
    box(root, materials.compoundWall, 0, height * 1.52, 7.36, 4.0, 0.16, 0.55);
    cylinder(root, materials.wood, 0, height * 1.54, 7.62, 0.045, 0.045, 0.45);
  } else {
    // Modern Kano Compound Gatehouse Columns & Security Sconces
    for (const px of [-1.75, 1.75]) {
      box(root, materials.concrete, px, height * 0.72, 7.18, 0.55, height * 1.44, 0.52);
      box(root, materials.trim, px, height * 1.45, 7.18, 0.68, 0.14, 0.65);
      // Modern exterior security wall lantern
      box(root, materials.black, px, height * 1.05, 7.48, 0.14, 0.24, 0.14);
      box(root, materials.lampGlow || materials.glassLit, px, height * 1.03, 7.48, 0.1, 0.16, 0.1, false);
    }
    box(root, materials.concrete, 0, height * 1.42, 7.18, 3.8, 0.22, 0.36);
  }

  const gateSlot = new THREE.Group();
  gateSlot.name = "compound-gate-asset-slot";
  gateSlot.userData.noMerge = true;
  gateSlot.position.set(0, 0, 7.14);
  const proceduralGate = new THREE.Group();
  proceduralGate.name = "procedural-gate-fallback";
  proceduralGate.userData.noMerge = true;
  gateSlot.add(proceduralGate);
  root.add(gateSlot);

  const gateGeoms = getSharedGateGeometries();
  const mMetal = new THREE.Mesh(gateGeoms.metal, materials.metal);
  mMetal.castShadow = true;
  mMetal.receiveShadow = true;
  proceduralGate.add(mMetal);

  const mTrim = new THREE.Mesh(gateGeoms.trim, materials.trim);
  mTrim.castShadow = true;
  mTrim.receiveShadow = true;
  proceduralGate.add(mTrim);

  const mOchre = new THREE.Mesh(gateGeoms.ochre, materials.ochre);
  mOchre.castShadow = true;
  mOchre.receiveShadow = true;
  proceduralGate.add(mOchre);

  const mDark = new THREE.Mesh(gateGeoms.darkTrim, materials.darkTrim);
  mDark.castShadow = false;
  mDark.receiveShadow = true;
  proceduralGate.add(mDark);
  proceduralGate.traverse((c) => { c.userData.noMerge = true; });

  // Traditional Hausa exterior mud benches (Dakali) for roadside conversation
  box(root, materials.compoundWall, -4.2, 0.22, 7.34, 2.6, 0.44, 0.44);
  box(root, materials.compoundWall, 4.2, 0.22, 7.34, 2.6, 0.44, 0.44);

  // Parapet pinnacles (Zankwaye) on compound front corners
  for (const cornerX of [-6.75, 6.75]) {
    const pinnacle = box(root, materials.ochre, cornerX, height + 0.28, 7.0, 0.24, 0.52, 0.24);
    pinnacle.rotation.y = Math.PI / 4;
  }

  // Wooden parapet roof rainwater spouts (Zannuwa)
  for (const spoutX of [-3.8, 3.8]) {
    cylinder(root, materials.wood, spoutX, height + 0.08, 7.28, 0.045, 0.045, 0.55);
  }

  colliders.push(
    { x: -6.75, z: 0, halfX: 0.32, halfZ: 7.22, height },
    { x: 6.75, z: 0, halfX: 0.32, halfZ: 7.22, height },
    { x: 0, z: -7, halfX: 6.95, halfZ: 0.32, height },
    { x: -4.2, z: 7, halfX: 2.82, halfZ: 0.32, height },
    { x: 4.2, z: 7, halfX: 2.82, halfZ: 0.32, height },
    { x: -1.45, z: 7.04, halfX: 0.38, halfZ: 0.42, height: 2.95 },
    { x: 1.45, z: 7.04, halfX: 0.38, halfZ: 0.42, height: 2.95 },
    { x: 0, z: 7.14, halfX: 0.96, halfZ: 0.24, height: 1.8 },
  );
  return gateSlot;
}

function addWindow(
  root: THREE.Group,
  materials: GameMaterials,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  isFront = true,
) {
  const frameDepth = 0.13;
  // Recessed dark frame
  box(root, materials.darkTrim, x, y, z, width + 0.24, height + 0.22, frameDepth);
  // Window glazing
  box(root, materials.glassLit || materials.glass, x, y, z + (isFront ? 0.08 : 0), width, height, 0.08);
  // Projecting upper lintel / sunshade canopy hood
  box(root, materials.trim, x, y + height / 2 + 0.09, z + 0.14, width + 0.32, 0.08, 0.24);
  // Lower window sill with drip reveal
  box(root, materials.trim, x, y - height / 2 - 0.09, z + 0.14, width + 0.32, 0.08, 0.22);
  // Center wooden mullion
  box(root, materials.wood, x, y, z + 0.14, 0.045, height + 0.12, 0.045);
  // Wrought iron burglar security bars
  const barMat = materials.burglarBars || materials.metal;
  const numBars = Math.max(2, Math.floor(width / 0.38));
  const spacing = width / numBars;
  for (let b = 1; b < numBars; b += 1) {
    box(root, barMat, x - width / 2 + b * spacing, y, z + 0.15, 0.03, height, 0.03, false);
  }
}

function addTraditionalHouse(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  variant = 0,
) {
  const z = -1.35;
  const front = z + 3.15;
  const facade = variant % 3 === 0 ? materials.plaster : variant % 3 === 1 ? materials.ochre : materials.concrete;
  const doorX = variant % 2 === 0 ? 0 : 0.38;
  box(root, facade, 0, 1.62, z, 7.1, 3.24, 6.3);
  box(root, materials.clay, 0, 3.31, z, 7.5, 0.24, 6.7);

  for (const x of [-3.38, 3.38]) {
    box(root, materials.ochre, x, 1.62, front + 0.04, 0.3, 3.34, 0.26);
    box(root, materials.ochre, x, 0.33, z - 0.02, 0.3, 0.66, 6.58);
  }

  box(root, materials.trim, 0, 2.95, front + 0.05, 7.2, 0.16, 0.2);
  addArchFrame(root, materials.ochre, doorX, 0.08, front + 0.08, 1.72, 2.55, 1.18, 2.14, 0.18);
  box(root, materials.wood, doorX, 1.08, front + 0.13, 1.09, 2.02, 0.14);
  box(root, materials.darkTrim, doorX + 0.36, 1.08, front + 0.23, 0.06, 0.07, 0.05);
  box(root, materials.ochre, doorX, 2.32, front + 0.16, 1.94, 0.13, 0.34);

  // Hausa Dakin Gona engraved geometric wall relief patterns on front facade
  for (const rx of [-1.8, 1.8]) {
    const reliefDiamond = box(root, materials.trim, rx, 1.75, front + 0.05, 0.65, 0.65, 0.05);
    reliefDiamond.rotation.z = Math.PI / 4;
    const innerRelief = box(root, materials.ochre, rx, 1.75, front + 0.08, 0.36, 0.36, 0.04);
    innerRelief.rotation.z = Math.PI / 4;
  }

  // Shaded entry veranda and carved-looking Hausa-inspired geometric band.
  box(root, materials.clay, doorX, 2.68, front + 0.98, 2.62, 0.13, 1.92);
  for (const x of [doorX - 1.12, doorX + 1.12]) {
    cylinder(root, materials.trim, x, 1.27, front + 1.54, 0.105, 0.105, 2.48);
    box(root, materials.trim, x, 2.53, front + 1.54, 0.34, 0.12, 0.34);
  }
  for (let i = 0; i < 9; i += 1) {
    const motif = box(
      root,
      i % 2 ? materials.trim : materials.clay,
      -2.4 + i * 0.6,
      3.05,
      front + 0.18,
      0.19,
      0.19,
      0.11,
    );
    motif.rotation.z = Math.PI / 4;
  }

  for (const x of [-2.35, 2.35]) {
    const windowWidth = variant % 3 === 2 ? 1.08 : 1.22;
    addArchFrame(root, materials.ochre, x, 1.23, front + 0.04, windowWidth + 0.36, 1.54, windowWidth, 1.32, 0.1);
    addWindow(root, materials, x, 1.92, front + 0.1, windowWidth, 1.05);
    for (const barX of [x - 0.33, x, x + 0.33]) {
      box(root, materials.metal, barX, 1.92, front + 0.21, 0.055, 0.94, 0.055);
    }
    box(root, materials.metal, x, 1.92, front + 0.22, 1.02, 0.05, 0.05);
    if (variant % 2 === 1) {
      box(root, materials.clay, x, 1.26, front + 0.23, windowWidth + 0.32, 0.14, 0.34);
    }
  }

  cylinder(root, materials.darkTrim, doorX, 2.68, front + 0.17, 0.29, 0.09, Math.PI / 2);
  cylinder(root, materials.trim, doorX, 2.68, front + 0.23, 0.18, 0.04, Math.PI / 2);
  box(root, materials.trim, 0, 3.52, z, 7.36, 0.18, 6.62);
  box(root, facade, 0, 3.76, z, 6.92, 0.3, 6.18);
  for (let i = 0; i < 7; i += 1) {
    const x = -2.9 + i * 0.97;
    const crenel = box(root, materials.trim, x, 3.96, z + 3.12, 0.34, 0.24, 0.24);
    crenel.rotation.z = variant % 2 ? 0 : Math.PI / 4;
  }

  // Traditional Hausa wooden roof rainwater drainage spouts (Zannuwa)
  for (const spoutX of [-2.4, 0, 2.4]) {
    cylinder(root, materials.wood, spoutX, 3.65, front + 0.28, 0.045, 0.045, 0.55);
  }

  // Front exterior mud conversation bench (Dakali)
  box(root, materials.clay, -2.3, 0.22, front + 0.32, 1.7, 0.42, 0.4);
  box(root, materials.clay, 2.3, 0.22, front + 0.32, 1.7, 0.42, 0.4);

  colliders.push({ x: 0, z, halfX: 3.66, halfZ: 3.25, height: 3.9 });
}

function addModernHome(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  accent: boolean,
  variant = 0,
) {
  const z = -1.15;
  const front = z + 3.12;
  const concrete = accent ? materials.concrete : materials.plaster;
  box(root, concrete, 0, 2.65, z, 7.7, 5.3, 6.25);
  box(root, materials.roof, 0, 5.38, z, 8.05, 0.25, 6.58);
  box(root, materials.concrete, 0, 5.69, z, 7.75, 0.36, 6.28);
  box(root, materials.trim, 0, 5.9, z, 7.2, 0.08, 5.9);

  for (const floorY of [1.65, 4.0]) {
    const windowWidth = floorY > 3 ? 1.7 : 1.55;
    for (const x of [-2.25, 0, 2.25]) {
      addWindow(root, materials, x, floorY, front + 0.07, windowWidth, 1.28);
      box(root, materials.concrete, x, floorY - 0.83, front + 0.22, windowWidth + 0.42, 0.18, 0.48);
    }
  }

  box(root, materials.wood, 0, 1.2, front + 0.12, 1.18, 2.3, 0.2);
  box(root, materials.concrete, 0, 3.14, front + 0.45, 6.9, 0.22, 0.8);
  for (const x of [-3.58, 3.58]) {
    box(root, materials.concrete, x, 2.72, front + 0.24, 0.25, 5.3, 0.34);
  }

  box(root, materials.metal, -2.95, 3.25, front + 0.25, 0.55, 0.48, 0.42);
  box(root, materials.glass, -2.95, 3.25, front + 0.48, 0.4, 0.28, 0.06);
  box(root, materials.concrete, 0, 3.53, front + 0.75, 7.7, 0.12, 1.55);

  if (variant % 3 !== 0) {
    box(root, materials.concrete, 0, 3.26, front + 1.14, 4.85, 0.18, 2.1);
    box(root, materials.metal, 0, 3.72, front + 2.0, 4.85, 0.06, 0.07, false);
    for (let i = 0; i <= 8; i += 1) {
      box(root, materials.metal, -2.38 + i * 0.595, 3.48, front + 2.0, 0.045, 0.52, 0.045, false);
    }
  }

  if (variant % 4 === 1) {
    // Raised roof service tank and compact stair bulkhead.
    box(root, materials.concrete, 2.45, 6.14, z - 1.8, 1.9, 0.32, 1.8);
    cylinder(root, materials.metal, 2.45, 7.05, z - 1.8, 0.72, 0.72, 1.55);
    cylinder(root, materials.metal, 2.45, 7.86, z - 1.8, 0.74, 0.58, 0.12);
  } else if (variant % 4 === 2) {
    for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) {
      const panel = box(root, materials.darkTrim, x, 6.15, z - 1.45, 0.82, 0.08, 1.45, false);
      panel.rotation.x = -0.1;
    }
  }

  // Modern residential external split-unit AC condenser unit
  box(root, materials.white, 3.15, 3.85, front + 0.28, 0.72, 0.52, 0.34);
  cylinder(root, materials.darkTrim, 3.15, 3.85, front + 0.46, 0.18, 0.04, Math.PI / 2);

  // Rooftop black GeePee water storage tank on support plinth
  box(root, materials.concrete, -2.4, 6.15, z - 1.2, 1.5, 0.3, 1.5);
  cylinder(root, materials.black, -2.4, 7.05, z - 1.2, 0.62, 0.62, 1.45);
  colliders.push({ x: 0, z, halfX: 3.95, halfZ: 3.24, height: 6 });
}

function addShop(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  name: string,
  signTone: string,
  variant = 0,
) {
  const z = -0.65;
  const front = z + 2.65;
  box(root, materials.ochre, 0, 1.8, z, 8.4, 3.6, 5.3);
  box(root, materials.roof, 0, 3.68, z, 8.7, 0.2, 5.55);
  box(root, materials.trim, 0, 3.94, z, 8.1, 0.28, 5.0);

  for (const x of [-2.6, 0, 2.6]) {
    const storefront = box(root, materials.wood, x, 1.48, front + 0.08, 2.28, 2.45, 0.22);
    storefront.material = materials.wood;
    box(root, materials.glassLit, x, 1.65, front + 0.22, 1.9, 1.54, 0.07);
    box(root, materials.wood, x, 0.42, front + 0.25, 2.22, 0.13, 0.16);
    if (variant % 2 === 1) {
      for (let slat = 0; slat < 7; slat += 1) {
        box(root, materials.metal, x, 0.75 + slat * 0.22, front + 0.3, 1.78, 0.035, 0.055, false);
      }
    }
  }

  const signMat = makeSignMaterial(name, signTone);
  box(root, signMat, 0, 3.23, front + 0.17, 7.0, 0.63, 0.15);

  if (variant % 2 === 1 && materials.corrugatedZinc) {
    // Corrugated zinc metal awning commonly seen in Sabon Gari commercial shops
    box(root, materials.corrugatedZinc, 0, 2.7, front + 0.88, 7.7, 0.08, 1.6);
    box(root, materials.metal, 0, 2.74, front + 1.65, 7.7, 0.08, 0.08);
  } else {
    for (let i = 0; i < 7; i += 1) {
      const stripeMat = i % 2 === 0 ? materials.cloth : materials.clothRed;
      box(root, stripeMat, -3.3 + i * 1.1, 2.7, front + 0.88, 1.08, 0.13, 1.55);
      box(root, stripeMat, -3.3 + i * 1.1, 2.49, front + 1.56, 1.08, 0.52, 0.13);
    }
  }

  for (const x of [-3.8, 3.8]) {
    box(root, materials.metal, x, 1.35, front + 1.38, 0.09, 2.7, 0.09);
  }

  colliders.push({ x: 0, z, halfX: 4.3, halfZ: 2.8, height: 4.1 });
}

function addCommercialBuilding(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  name: string,
  variant: number,
) {
  const z = -1.2;
  const front = z + 3.2;
  const facade = variant % 3 === 0 ? materials.concrete : variant % 3 === 1 ? materials.plaster : materials.ochre;
  box(root, facade, 0, 3.45, z, 10.8, 6.9, 7.1);
  box(root, materials.roof, 0, 6.98, z, 11.15, 0.26, 7.45);
  box(root, materials.trim, 0, 7.17, z, 10.6, 0.16, 7.05);

  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    box(root, materials.concrete, x, 2.0, front + 0.12, 0.27, 4.0, 0.34);
    box(root, materials.glassLit, x, 2.05, front + 0.2, 2.45, 2.75, 0.1);
    box(root, materials.metal, x, 3.85, front + 0.3, 2.38, 0.08, 0.07, false);
    addWindow(root, materials, x, 5.37, front + 0.13, 1.62, 1.25);
    box(root, materials.concrete, x, 4.53, front + 0.3, 1.98, 0.17, 0.48);
    for (const side of [-0.56, 0, 0.56]) {
      box(root, materials.metal, x + side, 5.37, front + 0.27, 0.035, 1.13, 0.035, false);
    }
  }

  const sign = makeSignMaterial(name, variant % 2 ? "#d09a62" : "#b96d43");
  box(root, sign, 0, 3.16, front + 0.29, 9.6, 0.68, 0.15);

  // A continuous upper-floor balcony with individual railing uprights.
  box(root, materials.concrete, 0, 4.54, front + 0.72, 10.2, 0.18, 1.3);
  box(root, materials.metal, 0, 5.03, front + 1.31, 10.05, 0.055, 0.065, false);
  for (let i = 0; i <= 18; i += 1) {
    box(root, materials.metal, -4.94 + i * 0.55, 4.82, front + 1.31, 0.045, 0.42, 0.045, false);
  }
  for (let x = -4.7; x <= 4.71; x += 1.18) {
    box(root, materials.trim, x, 7.43, z, 0.25, 0.42, 0.25);
  }
  colliders.push({ x: 0, z, halfX: 5.55, halfZ: 3.72, height: 7.7 });
}

export function createPlot(
  kind: BuildingKind,
  materials: GameMaterials,
  variant = 0,
  sign = "KASUWA",
): PlotAsset {
  const root = new THREE.Group();
  const colliders: Collider[] = [];
  let gateSlot: THREE.Group | undefined;

  if (kind !== "shop" && kind !== "commercial") {
    gateSlot = addCourtyard(root, materials, colliders, kind === "modern", variant);
  }

  if (kind === "traditional") {
    addTraditionalHouse(root, materials, colliders, variant);
  } else if (kind === "modern") {
    addModernHome(root, materials, colliders, variant % 2 === 0, variant);
  } else if (kind === "shop") {
    addShop(root, materials, colliders, sign, variant % 2 === 0 ? "#c7a16c" : "#c46f47", variant);
  } else {
    addCommercialBuilding(root, materials, colliders, sign, variant);
  }

  return { root, colliders, gateSlot };
}

export function createMarketStall(materials: GameMaterials, variant = 0): PlotAsset {
  const root = new THREE.Group();
  root.name = `market-stall-${variant}`;
  const colliders: Collider[] = [];
  const stallTint = variant % 3 === 0
    ? materials.cloth
    : variant % 3 === 1
    ? materials.clothRed
    : materials.terracotta || materials.clothRed;

  const wood = materials.wood;
  const darkTrim = materials.darkTrim;
  const burlap = materials.burlapSack || materials.cloth;

  // 1. Heavy Timber Structural Posts with Corner Braces
  for (const x of [-1.5, 1.5]) {
    for (const z of [-0.15, 1.18]) {
      box(root, wood, x, 1.65, z, 0.12, 2.95, 0.12);
    }
    // Diagonal timber knee brace joining post to canopy beam
    const brace = box(root, wood, x, 2.75, 0.52, 0.08, 0.45, 0.08);
    brace.rotation.x = x > 0 ? 0.35 : -0.35;
  }
  // Longitudinal top perimeter rails
  box(root, wood, 0, 3.02, -0.15, 3.2, 0.09, 0.09);
  box(root, wood, 0, 3.12, 1.18, 3.2, 0.09, 0.09);

  // 2. Solid Timber Lower Cabinet & Burlap Storage Base
  box(root, wood, 0, 0.45, 0.3, 3.1, 0.72, 1.05);
  box(root, darkTrim, 0, 0.1, 0.3, 3.18, 0.18, 1.12);

  // Stacked burlap grain sacks under/beside the lower counter
  for (let s = 0; s < 3; s += 1) {
    const sack = box(root, burlap, -1.0 + s * 0.55, 0.22, 0.32, 0.48, 0.26, 0.38);
    sack.rotation.y = (s * 0.25) - 0.2;
  }

  // 3. Tiered Slanted Upper Produce Display Shelf
  const displayTray = box(root, wood, 0, 0.92, 0.32, 3.2, 0.12, 1.08);
  displayTray.rotation.x = 0.12;

  // Produce partition divider slats
  for (const dx of [-0.75, 0, 0.75]) {
    const divider = box(root, wood, dx, 0.98, 0.32, 0.04, 0.16, 1.05);
    divider.rotation.x = 0.12;
  }

  // Authentic Northern Nigerian Market Produce:
  // Compartment 1: Northern Red Chili Peppers (Attarugu)
  for (let i = 0; i < 7; i += 1) {
    const pepper = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 7, 6),
      materials.clothRed,
    );
    pepper.position.set(-1.18 + (i % 3) * 0.16, 1.02 + Math.floor(i / 3) * 0.06, 0.15 + (i % 2) * 0.22);
    pepper.scale.set(0.85, 1.35, 0.85);
    pepper.castShadow = true;
    root.add(pepper);
  }

  // Compartment 2: Golden Sahelian Onions (Albasa)
  for (let i = 0; i < 6; i += 1) {
    const onion = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 8, 6),
      materials.ochre,
    );
    onion.position.set(-0.42 + (i % 3) * 0.18, 1.04 + Math.floor(i / 3) * 0.07, 0.18 + (i % 2) * 0.22);
    onion.castShadow = true;
    root.add(onion);
  }

  // Compartment 3: Stacked Fresh Tubers / Yams
  for (let i = 0; i < 4; i += 1) {
    const yam = cylinder(root, materials.bark || darkTrim, 0.38 + (i % 2) * 0.22, 1.04 + Math.floor(i / 2) * 0.08, 0.28, 0.07, 0.42, 0);
    yam.rotation.z = Math.PI / 2;
  }

  // Compartment 4: Savanna Spice Bowl (Suya Spice & Cloves)
  cylinder(root, darkTrim, 1.15, 1.02, 0.28, 0.22, 0.12);
  cylinder(root, materials.terracotta || materials.clothRed, 1.15, 1.07, 0.28, 0.19, 0.04);

  // 4. Weathered Fabric Canopy with Overhang Valance Flaps
  box(root, stallTint, 0, 3.18, 0.51, 3.55, 0.12, 2.15);
  box(root, stallTint, 0, 2.94, -0.54, 3.55, 0.38, 0.08); // Front valance
  for (const vx of [-1.75, 1.75]) {
    box(root, stallTint, vx, 2.96, 0.51, 0.08, 0.34, 2.12); // Side valance
  }

  // Suspended Solar Market Lamp hanging from ridge pole
  cylinder(root, materials.metal, 0, 3.0, 0.45, 0.015, 0.015, 0.24); // Suspension cord
  cylinder(root, materials.lampGlow || materials.glassLit, 0, 2.86, 0.45, 0.09, 0.06, 0.12); // Glowing lamp lens
  box(root, materials.solarPanel || materials.metal, 0, 3.25, 0.85, 0.55, 0.025, 0.45); // Roof solar panel

  // 5. Merchant's Low Wooden Stool (Kujerar Itace)
  box(root, wood, 0, 0.24, -0.65, 0.42, 0.06, 0.36);
  for (const sx of [-0.16, 0.16]) {
    for (const sz of [-0.78, -0.52]) {
      cylinder(root, wood, sx, 0.12, sz, 0.03, 0.03, 0.24);
    }
  }

  colliders.push({ x: 0, z: 0.3, halfX: 1.72, halfZ: 0.65, height: 3.5 });
  return { root, colliders };
}

export function createRoadsideKiosk(
  materials: GameMaterials,
  variant = 0,
): PlotAsset {
  const root = new THREE.Group();
  root.name = `roadside-kiosk-${variant}`;
  const colliders: Collider[] = [];

  const wood = materials.wood;
  const metal = materials.metal;
  const zinc = materials.corrugatedZinc || materials.metal;
  const darkTrim = materials.darkTrim;
  const yellow = materials.kekeYellow;
  const green = materials.karotaGreen || materials.kekeGreen;

  if (variant === 0) {
    // 1. "Mai Shayi" Roadside Tea, Coffee & Bread Stall
    box(root, materials.ochre, 0, 1.15, 0, 1.6, 2.3, 1.4);
    box(root, zinc, 0, 2.36, 0.1, 1.85, 0.1, 1.65);
    box(root, darkTrim, 0, 1.35, 0.71, 1.3, 1.0, 0.04, false);
    box(root, wood, 0, 0.88, 0.78, 1.4, 0.08, 0.35);

    // Aluminum tea kettle & beverage service
    cylinder(root, metal, -0.42, 1.05, 0.82, 0.12, 0.14, 0.24);
    cylinder(root, metal, -0.42, 1.2, 0.82, 0.02, 0.02, 0.12);
    for (let c = 0; c < 3; c += 1) {
      cylinder(root, materials.white, 0.42, 0.98 + c * 0.11, 0.82, 0.05, 0.05, 0.1);
    }
    box(root, wood, 0.05, 0.98, 0.82, 0.38, 0.14, 0.22);

    const sign = makeSignMaterial("MAI SHAYI & COFFEE\nFRESH HOT TEA", "#c46f47");
    box(root, sign, 0, 2.1, 0.73, 1.4, 0.32, 0.06);
  } else if (variant === 1) {
    // 2. "POS / Mobile Money & Airtime" Neighborhood Agent Kiosk
    box(root, yellow, 0, 1.15, 0, 1.5, 2.3, 1.3);
    box(root, green, 0, 1.15, 0, 1.52, 0.4, 1.32);
    box(root, zinc, 0, 2.36, 0.05, 1.75, 0.08, 1.5);

    box(root, darkTrim, 0, 1.4, 0.66, 1.1, 0.85, 0.04, false);
    box(root, materials.burglarBars || metal, 0, 1.4, 0.68, 1.05, 0.8, 0.02, false);
    box(root, wood, 0, 0.92, 0.75, 1.2, 0.08, 0.32);

    const solar = new THREE.Group();
    solar.position.set(0, 2.45, 0);
    solar.rotation.x = -0.25;
    root.add(solar);
    box(solar, materials.solarPanel || metal, 0, 0, 0, 0.85, 0.03, 0.65);

    const sign = makeSignMaterial("POS AGENT\nTRANSFER & AIRTIME", "#156228");
    box(root, sign, 0, 2.05, 0.68, 1.3, 0.35, 0.06);
  } else {
    // 3. "Kano Cold Drinks & Provisions" Kiosk
    box(root, materials.plaster, 0, 1.15, 0, 1.6, 2.3, 1.4);
    box(root, zinc, 0, 2.36, 0.1, 1.85, 0.1, 1.65);
    box(root, darkTrim, 0, 1.35, 0.71, 1.25, 0.95, 0.04, false);
    box(root, wood, 0, 0.88, 0.78, 1.35, 0.08, 0.35);

    box(root, materials.motorcycleRed || materials.clothRed, -0.38, 0.98, 0.82, 0.35, 0.22, 0.25);
    box(root, metal, 0.35, 1.5, 0.72, 0.02, 0.45, 0.02);
    for (let s = 0; s < 3; s += 1) {
      box(root, s % 2 ? yellow : materials.warmOrange || materials.clothRed, 0.35, 1.35 + s * 0.12, 0.74, 0.12, 0.08, 0.04);
    }
    const sign = makeSignMaterial("COLD DRINKS & SNACKS\nPURE WATER", "#24558f");
    box(root, sign, 0, 2.1, 0.73, 1.4, 0.32, 0.06);
  }

  colliders.push({ x: 0, z: 0, halfX: 0.85, halfZ: 0.75, height: 2.5 });
  return { root, colliders };
}
