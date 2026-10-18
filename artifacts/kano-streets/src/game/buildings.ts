import * as THREE from "three";
import { makeSignMaterial } from "./materials";
import type { BuildingKind, Collider, GameMaterials, PlotAsset } from "./types";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const roundCylinder = new THREE.CylinderGeometry(1, 1, 1, 12);

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
  const mesh = new THREE.Mesh(unitBox, material);
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
) {
  const height = modern ? 1.7 : 1.88;
  const sideMaterial = modern ? materials.concrete : materials.ochre;

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

  for (const x of [-1.35, 1.35]) {
    box(root, materials.trim, x, height * 0.58, 7.0, 0.5, height * 1.16, 0.58);
    box(root, materials.darkTrim, x, height * 1.17, 7.0, 0.64, 0.16, 0.72);
  }

  const gate = new THREE.Group();
  gate.position.set(-1.12, 0, 6.75);
  gate.rotation.y = 1.08;
  box(gate, materials.metal, 0.95, 0.82, 0, 1.9, 1.55, 0.1);
  for (let i = 0; i < 9; i += 1) {
    const x = 0.12 + i * 0.205;
    box(gate, materials.trim, x, 0.82, 0, 0.035, 1.48, 0.13);
  }
  box(gate, materials.trim, 0.95, 1.27, 0, 1.9, 0.08, 0.14);
  root.add(gate);

  colliders.push(
    { x: -6.75, z: 0, halfX: 0.32, halfZ: 7.22, height },
    { x: 6.75, z: 0, halfX: 0.32, halfZ: 7.22, height },
    { x: 0, z: -7, halfX: 6.95, halfZ: 0.32, height },
    { x: -4.2, z: 7, halfX: 2.82, halfZ: 0.32, height },
    { x: 4.2, z: 7, halfX: 2.82, halfZ: 0.32, height },
    { x: -1.35, z: 7, halfX: 0.34, halfZ: 0.38, height: height * 1.16 },
    { x: 1.35, z: 7, halfX: 0.34, halfZ: 0.38, height: height * 1.16 },
  );
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
) {
  const z = -1.35;
  const front = z + 3.15;
  box(root, materials.plaster, 0, 1.62, z, 7.1, 3.24, 6.3);
  box(root, materials.clay, 0, 3.31, z, 7.5, 0.24, 6.7);

  for (const x of [-3.38, 3.38]) {
    box(root, materials.ochre, x, 1.62, front + 0.04, 0.3, 3.34, 0.26);
    box(root, materials.ochre, x, 0.33, z - 0.02, 0.3, 0.66, 6.58);
  }

  box(root, materials.trim, 0, 2.95, front + 0.05, 7.2, 0.16, 0.2);
  box(root, materials.wood, 0, 1.12, front + 0.11, 1.26, 2.15, 0.18);
  box(root, materials.darkTrim, 0.42, 1.1, front + 0.22, 0.07, 0.07, 0.06);
  box(root, materials.ochre, 0, 2.27, front + 0.16, 1.56, 0.13, 0.32);
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

  for (const x of [-2.25, 2.25]) {
    addWindow(root, materials, x, 1.92, front + 0.1, 1.22, 1.22);
    for (const barX of [x - 0.33, x, x + 0.33]) {
      box(root, materials.metal, barX, 1.92, front + 0.21, 0.055, 1.02, 0.055);
    }
    box(root, materials.metal, x, 1.92, front + 0.22, 1.12, 0.05, 0.05);
  }

  cylinder(root, materials.darkTrim, 0, 2.7, front + 0.17, 0.29, 0.09, Math.PI / 2);
  cylinder(root, materials.trim, 0, 2.7, front + 0.23, 0.18, 0.04, Math.PI / 2);
  box(root, materials.trim, 0, 3.52, z, 7.36, 0.18, 6.62);
  box(root, materials.plaster, 0, 3.76, z, 6.92, 0.3, 6.18);

  colliders.push({ x: 0, z, halfX: 3.66, halfZ: 3.25, height: 3.9 });
}

function addModernHome(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  accent: boolean,
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
  colliders.push({ x: 0, z, halfX: 3.95, halfZ: 3.24, height: 6 });
}

function addShop(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  name: string,
  signTone: string,
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
  }

  const signMat = makeSignMaterial(name, signTone);
  box(root, signMat, 0, 3.23, front + 0.17, 7.0, 0.63, 0.15);

  for (let i = 0; i < 7; i += 1) {
    const stripeMat = i % 2 === 0 ? materials.cloth : materials.clothRed;
    box(root, stripeMat, -3.3 + i * 1.1, 2.7, front + 0.88, 1.08, 0.13, 1.55);
    box(root, stripeMat, -3.3 + i * 1.1, 2.49, front + 1.56, 1.08, 0.52, 0.13);
  }

  for (const x of [-3.8, 3.8]) {
    box(root, materials.metal, x, 1.35, front + 1.38, 0.09, 2.7, 0.09);
  }

  colliders.push({ x: 0, z, halfX: 4.3, halfZ: 2.8, height: 4.1 });
}

export function createPlot(
  kind: BuildingKind,
  materials: GameMaterials,
  variant = 0,
  sign = "KASUWA",
): PlotAsset {
  const root = new THREE.Group();
  const colliders: Collider[] = [];

  if (kind !== "shop") addCourtyard(root, materials, colliders, kind === "modern");

  if (kind === "traditional") {
    addTraditionalHouse(root, materials, colliders);
  } else if (kind === "modern") {
    addModernHome(root, materials, colliders, variant % 2 === 0);
  } else {
    addShop(root, materials, colliders, sign, variant % 2 === 0 ? "#c7a16c" : "#c46f47");
  }

  return { root, colliders };
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
