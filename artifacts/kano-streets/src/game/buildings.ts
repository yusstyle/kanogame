import * as THREE from "three";
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
  const gateSlot = new THREE.Group();
  gateSlot.name = "compound-gate-asset-slot";
  gateSlot.userData.noMerge = true;
  gateSlot.position.set(0, 0, 7.14);
  const proceduralGate = new THREE.Group();
  proceduralGate.name = "procedural-gate-fallback";
  proceduralGate.userData.noMerge = true;
  gateSlot.add(proceduralGate);
  root.add(gateSlot);

  box(proceduralGate, materials.metal, 0, 0.86, 0, 1.82, 1.62, 0.14);
  for (let i = 0; i < 11; i += 1) {
    const x = -0.82 + i * 0.164;
    box(proceduralGate, i % 2 ? materials.trim : materials.ochre, x, 0.84, 0.09, 0.045, 1.48, 0.09);
  }
  box(proceduralGate, materials.trim, 0, 1.55, 0.1, 1.88, 0.08, 0.11);
  for (const x of [-0.48, 0, 0.48]) {
    const stud = box(proceduralGate, materials.ochre, x, 1.79, 0.12, 0.13, 0.13, 0.08);
    stud.rotation.z = Math.PI / 4;
  }
  box(proceduralGate, materials.darkTrim, 0, 0.04, 0.01, 2.1, 0.12, 0.68, false);
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
  box(root, materials.darkTrim, x, y, z, width + 0.24, height + 0.22, frameDepth);
  box(root, materials.glass, x, y, z + (isFront ? 0.08 : 0), width, height, 0.08);
  box(root, materials.trim, x, y + height / 2 + 0.09, z + 0.1, width + 0.3, 0.08, 0.16);
  box(root, materials.trim, x, y - height / 2 - 0.09, z + 0.12, width + 0.3, 0.08, 0.18);
  box(root, materials.wood, x, y, z + 0.14, 0.045, height + 0.12, 0.045);
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
  const colliders: Collider[] = [];
  const stallTint = variant % 2 === 0 ? materials.cloth : materials.clothRed;

  box(root, materials.wood, 0, 0.85, 0.3, 3.2, 0.28, 1.05);
  box(root, materials.ochre, 0, 0.55, 0.3, 3.35, 0.18, 1.15);
  for (const x of [-1.5, 1.5]) {
    for (const z of [-0.15, 1.18]) {
      box(root, materials.wood, x, 1.65, z, 0.12, 2.95, 0.12);
    }
  }
  box(root, stallTint, 0, 3.14, 0.51, 3.55, 0.14, 2.15);
  box(root, materials.cloth, 0, 2.91, -0.54, 3.55, 0.42, 0.12);

  for (let i = 0; i < 5; i += 1) {
    const produce = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      [materials.clothRed, materials.foliageLight, materials.ochre][i % 3],
    );
    produce.position.set(-1.15 + i * 0.52, 1.1 + (i % 2) * 0.04, 0.26);
    produce.scale.set(1, 0.72, 0.82);
    produce.castShadow = true;
    root.add(produce);
  }

  colliders.push({ x: 0, z: 0.3, halfX: 1.72, halfZ: 0.65, height: 3.5 });
  return { root, colliders };
}
