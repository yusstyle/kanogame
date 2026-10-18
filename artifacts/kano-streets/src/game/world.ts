import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createMarketStall, createPlot } from "./buildings";
import { makeSignMaterial } from "./materials";
import type { BuildingKind, Collider, GameMaterials } from "./types";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const canopyGeometry = new THREE.SphereGeometry(1, 12, 9);

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

function addPlane(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  z: number,
  width: number,
  depth: number,
  y: number,
) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
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
  bottomRadius: number,
  topRadius: number,
  height: number,
) {
  const mesh = new THREE.Mesh(unitCylinder, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(bottomRadius * 2, height, topRadius * 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create Kano sky");

  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#627c88");
  gradient.addColorStop(0.43, "#9baab0");
  gradient.addColorStop(0.76, "#dbc39b");
  gradient.addColorStop(1, "#d9b97e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 48; i += 1) {
    const x = ((i * 173) % 1024) - 80;
    const y = 80 + ((i * 59) % 170);
    const radius = 24 + ((i * 13) % 74);
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, "rgba(244,227,194,0.12)");
    cloud.addColorStop(1, "rgba(244,227,194,0)");
    context.fillStyle = cloud;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function transformCollider(collider: Collider, x: number, z: number, yaw: number): Collider {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return {
    x: x + cosine * collider.x + sine * collider.z,
    z: z - sine * collider.x + cosine * collider.z,
    halfX: Math.abs(cosine) * collider.halfX + Math.abs(sine) * collider.halfZ,
    halfZ: Math.abs(sine) * collider.halfX + Math.abs(cosine) * collider.halfZ,
    height: collider.height,
  };
}

function makeTree(
  root: THREE.Group,
  materials: GameMaterials,
  x: number,
  z: number,
  scale = 1,
  palm = false,
): Collider {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  root.add(tree);

  addCylinder(tree, materials.bark, 0, 1.8, 0, 0.3, 0.18, 3.6);

  if (palm) {
    addCylinder(tree, materials.bark, 0, 2.1, 0, 0.24, 0.16, 4.2);
    for (let i = 0; i < 7; i += 1) {
      const angle = (Math.PI * 2 * i) / 7;
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(0.27, 3.1, 5, 1, false),
        i % 2 ? materials.foliage : materials.foliageLight,
      );
      frond.position.set(Math.sin(angle) * 0.65, 4.14, Math.cos(angle) * 0.65);
      frond.rotation.z = Math.cos(angle) * 0.72;
      frond.rotation.x = Math.sin(angle) * 0.72;
      frond.rotation.y = angle;
      frond.castShadow = true;
      tree.add(frond);
    }
  } else {
    const crownPositions: [number, number, number, number][] = [
      [0, 4.5, 0, 2.15],
      [-1.05, 4.15, 0.18, 1.34],
      [0.96, 4.18, -0.08, 1.42],
      [0.08, 4.38, 0.95, 1.3],
      [-0.18, 4.2, -0.88, 1.33],
    ];
    crownPositions.forEach(([cx, cy, cz, radius], i) => {
      const canopy = new THREE.Mesh(
        canopyGeometry,
        i % 2 ? materials.foliageLight : materials.foliage,
      );
      canopy.position.set(cx, cy, cz);
      canopy.scale.set(radius, radius * 0.78, radius);
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      tree.add(canopy);
    });
  }

  addBox(tree, materials.ochre, 0, 0.1, 0, 1.15, 0.2, 1.15, false);
  return { x, z, halfX: 0.48 * scale, halfZ: 0.48 * scale, height: (palm ? 7.5 : 6.4) * scale };
}

function makeStreetlight(
  root: THREE.Group,
  materials: GameMaterials,
  x: number,
  z: number,
  yaw = 0,
): Collider {
  const pole = new THREE.Group();
  pole.position.set(x, 0, z);
  pole.rotation.y = yaw;
  root.add(pole);

  addCylinder(pole, materials.metal, 0, 3.0, 0, 0.12, 0.1, 6.0);
  addBox(pole, materials.metal, 0, 5.9, 0.48, 0.12, 0.13, 1.05);
  addBox(pole, materials.metal, 0, 5.83, 0.98, 0.42, 0.2, 0.55);
  addBox(pole, materials.glassLit, 0, 5.78, 0.98, 0.28, 0.08, 0.4);
  return { x, z, halfX: 0.34, halfZ: 0.34, height: 6.1 };
}

function addStreetSign(root: THREE.Group, x: number, z: number, label: string, yaw: number) {
  const pole = new THREE.Group();
  pole.position.set(x, 0, z);
  pole.rotation.y = yaw;
  root.add(pole);
  addCylinder(pole, new THREE.MeshStandardMaterial({ color: "#545349", roughness: 0.8 }), 0, 1.5, 0, 0.06, 0.06, 3.0);
  addBox(pole, makeSignMaterial(label, "#c5ae82"), 0, 2.56, 0, 1.55, 0.45, 0.1);
}

function addRoad(
  root: THREE.Group,
  materials: GameMaterials,
  axis: "x" | "z",
  center: number,
  length: number,
  width: number,
) {
  const horizontal = axis === "x";
  const roadCenterX = horizontal ? 0 : center;
  const roadCenterZ = horizontal ? center : 0;
  const roadWidth = horizontal ? length : width;
  const roadDepth = horizontal ? width : length;
  addPlane(root, materials.asphalt, roadCenterX, roadCenterZ, roadWidth, roadDepth, 0.018);

  const sidewalkWidth = 3.0;
  const curbHeight = 0.14;
  const roadHalf = width / 2;
  const intersections: [number, number][] = horizontal
    ? [[-12.5, 12.5]]
    : [[-45.5, -26.5], [-12.5, 12.5], [26.5, 45.5]];
  const segments: [number, number][] = [];
  let cursor = -length / 2;
  for (const [cutStart, cutEnd] of intersections) {
    const start = Math.max(-length / 2, cutStart);
    const end = Math.min(length / 2, cutEnd);
    if (start > cursor) segments.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < length / 2) segments.push([cursor, length / 2]);

  for (const side of [-1, 1]) {
    for (const [start, end] of segments) {
      const segmentLength = end - start;
      const midpoint = (start + end) / 2;
      if (horizontal) {
        const sidewalkZ = center + side * (roadHalf + sidewalkWidth / 2);
        const curbZ = center + side * (roadHalf + 0.08);
        addBox(root, materials.sidewalk, midpoint, 0.015, sidewalkZ, segmentLength, 0.14, sidewalkWidth);
        addBox(root, materials.white, midpoint, curbHeight / 2, curbZ, segmentLength, curbHeight, 0.24, false);
        const drainZ = center + side * (roadHalf + 0.35);
        addBox(root, materials.drain, midpoint, 0.025, drainZ, segmentLength, 0.035, 0.24, false);
        for (let mark = start + 2; mark < end; mark += 3.3) {
          addBox(root, materials.metal, mark, 0.049, drainZ, 0.06, 0.02, 0.19, false);
        }
      } else {
        const sidewalkX = center + side * (roadHalf + sidewalkWidth / 2);
        const curbX = center + side * (roadHalf + 0.08);
        addBox(root, materials.sidewalk, sidewalkX, 0.015, midpoint, sidewalkWidth, 0.14, segmentLength);
        addBox(root, materials.white, curbX, curbHeight / 2, midpoint, curbHeight, curbHeight, segmentLength, false);
        const drainX = center + side * (roadHalf + 0.35);
        addBox(root, materials.drain, drainX, 0.025, midpoint, 0.24, 0.035, segmentLength, false);
        for (let mark = start + 2; mark < end; mark += 3.3) {
          addBox(root, materials.metal, drainX, 0.049, mark, 0.19, 0.02, 0.06, false);
        }
      }
    }
  }

  const lineMat = materials.cloth;
  for (let offset = -length / 2 + 3; offset < length / 2; offset += 7.5) {
    if (horizontal) {
      addBox(root, lineMat, offset, 0.035, center, 3.1, 0.018, 0.11, false);
    } else {
      addBox(root, lineMat, center, 0.035, offset, 0.11, 0.018, 3.1, false);
    }
  }

  const edgeOffset = width / 2 - 0.72;
  for (const side of [-1, 1]) {
    if (horizontal) {
      addBox(root, materials.cloth, 0, 0.034, center + side * edgeOffset, length, 0.018, 0.075, false);
    } else {
      addBox(root, materials.cloth, center + side * edgeOffset, 0.034, 0, 0.075, 0.018, length, false);
    }
  }
}

function addMarketPlaza(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  centerX: number,
  centerZ: number,
) {
  addPlane(root, materials.sidewalk, centerX, centerZ, 21, 18, 0.045);
  for (let i = 0; i < 4; i += 1) {
    const stall = createMarketStall(materials, i);
    const x = centerX + (i % 2 ? 5.1 : -5.1);
    const z = centerZ + (i < 2 ? -4.2 : 4.2);
    stall.root.position.set(x, 0.08, z);
    root.add(stall.root);
    colliders.push(...stall.colliders.map((item) => ({ ...item, x: item.x + x, z: item.z + z })));
  }

  addBox(root, materials.wood, centerX, 0.62, centerZ, 3.4, 1.1, 0.95);
  addBox(root, materials.cloth, centerX, 1.25, centerZ, 3.65, 0.15, 1.2);
  colliders.push({ x: centerX, z: centerZ, halfX: 1.8, halfZ: 0.7, height: 1.5 });
}

function addDistantHill(root: THREE.Group, materials: GameMaterials) {
  const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(16, 1), materials.stone);
  hill.position.set(-82, 1.2, -76);
  hill.scale.set(1.38, 0.32, 0.83);
  hill.castShadow = true;
  hill.receiveShadow = true;
  root.add(hill);

  for (let i = 0; i < 3; i += 1) {
    const ridge = new THREE.Mesh(new THREE.IcosahedronGeometry(7 + i, 0), materials.clay);
    ridge.position.set(-84 + i * 8, 1.2, -78 - i * 2.5);
    ridge.scale.set(1.0, 0.3, 0.62);
    ridge.receiveShadow = true;
    root.add(ridge);
  }
}

function addMarketWaterTank(root: THREE.Group, materials: GameMaterials, x: number, z: number) {
  const tank = new THREE.Group();
  tank.position.set(x, 0, z);
  root.add(tank);
  addCylinder(tank, materials.metal, 0, 1.1, 0, 0.72, 0.72, 2.0);
  addCylinder(tank, materials.metal, 0, 2.15, 0, 0.72, 0.55, 0.12);
  addCylinder(tank, materials.metal, 0, 2.25, 0, 0.16, 0.16, 0.14);
}

function mergeStaticMeshesByCell(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const buckets = new Map<
    string,
    {
      material: THREE.Material;
      geometries: THREE.BufferGeometry[];
      sources: THREE.Mesh[];
      castShadow: boolean;
      receiveShadow: boolean;
    }
  >();
  const cellSize = 64;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material;
    if (Array.isArray(material) || material.transparent || material.depthWrite === false) return;
    if (material instanceof THREE.MeshBasicMaterial) return;

    const position = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
    const cellX = Math.floor(position.x / cellSize);
    const cellZ = Math.floor(position.z / cellSize);
    const key = `${material.uuid}:${cellX}:${cellZ}:${Number(object.castShadow)}:${Number(object.receiveShadow)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material,
        geometries: [],
        sources: [],
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow,
      };
      buckets.set(key, bucket);
    }

    let geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    if (geometry.index) {
      const nonIndexed = geometry.toNonIndexed();
      geometry.dispose();
      geometry = nonIndexed;
    }
    bucket.geometries.push(geometry);
    bucket.sources.push(object);
  });

  for (const [key, bucket] of buckets) {
    const geometry =
      bucket.geometries.length === 1
        ? bucket.geometries[0]
        : mergeGeometries(bucket.geometries, false);
    for (const part of bucket.geometries) {
      if (part !== geometry) part.dispose();
    }
    if (!geometry) {
      console.warn(`Static mesh batching skipped for cell ${key}`);
      continue;
    }
    geometry.computeBoundingSphere();
    const batch = new THREE.Mesh(geometry, bucket.material);
    batch.castShadow = bucket.castShadow;
    batch.receiveShadow = bucket.receiveShadow;
    batch.name = `neighborhood-static-${key.slice(-8)}`;
    root.add(batch);
    for (const mesh of bucket.sources) mesh.parent?.remove(mesh);
  }

  root.updateMatrixWorld(true);
}

export type WorldResult = {
  root: THREE.Group;
  colliders: Collider[];
  bounds: number;
};

export function createWorld(materials: GameMaterials): WorldResult {
  const root = new THREE.Group();
  const colliders: Collider[] = [];
  const bounds = 64;
  const cityExtent = 130;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(260, 32, 20),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  sky.frustumCulled = false;
  root.add(sky);

  addPlane(root, materials.ground, 0, 0, cityExtent, cityExtent, 0);

  const roads: [ "x" | "z", number, number, number ][] = [
    ["x", 0, cityExtent, 18],
    ["x", -36, cityExtent, 12],
    ["x", 36, cityExtent, 12],
    ["z", 0, cityExtent, 16],
  ];
  roads.forEach(([axis, center, length, width]) => addRoad(root, materials, axis, center, length, width));

  // House plots are compact compounds along the continuous street grid. The
  // open central corner is kept for shops and a small market court.
  const xPositions = [-52, -35, -20, 20, 35, 52];
  const zPositions = [-54, -18, 18, 54];
  const kinds: BuildingKind[] = ["traditional", "modern", "traditional", "traditional", "modern", "traditional"];
  let variant = 0;
  for (let zi = 0; zi < zPositions.length; zi += 1) {
    for (let xi = 0; xi < xPositions.length; xi += 1) {
      const x = xPositions[xi];
      const z = zPositions[zi];
      if ((x === -20 || x === 20) && (z === -18 || z === 18)) continue;
      if (x === -35 && z === 18) continue;

      const kind = kinds[(xi + zi * 2) % kinds.length];
      const plot = createPlot(kind, materials, variant++);
      const yaw = z > 0 ? Math.PI : 0;
      plot.root.position.set(x, 0, z);
      plot.root.rotation.y = yaw;
      root.add(plot.root);
      colliders.push(...plot.colliders.map((item) => transformCollider(item, x, z, yaw)));
    }
  }

  const shops = [
    [-20, -16, 0, "SHAGO"],
    [20, -16, 0, "KASUWA"],
    [-20, 16, Math.PI, "SABON GARI"],
    [20, 16, Math.PI, "TEA & PROVISIONS"],
  ] as const;
  shops.forEach(([x, z, yaw, name], index) => {
    const shop = createPlot("shop", materials, index, name);
    shop.root.position.set(x, 0, z);
    shop.root.rotation.y = yaw;
    root.add(shop.root);
    colliders.push(...shop.colliders.map((item) => transformCollider(item, x, z, yaw)));
  });

  addMarketPlaza(root, materials, colliders, -35, 18);
  addMarketWaterTank(root, materials, 46, -49);
  addMarketWaterTank(root, materials, -48, 50);

  const trees = [
    [-10.1, -55, 0.92, false], [-10.1, -24, 0.85, true], [-10.1, 24, 0.9, false],
    [-10.1, 55, 0.8, true], [10.1, -55, 0.85, false], [10.1, -24, 0.92, false],
    [10.1, 24, 0.86, true], [10.1, 55, 0.9, false],
    [-54, 10.1, 0.9, false], [-24, 10.1, 0.82, true], [24, 10.1, 0.88, false],
    [54, 10.1, 0.86, true], [-54, -10.1, 0.84, true], [-24, -10.1, 0.9, false],
    [24, -10.1, 0.84, true], [54, -10.1, 0.92, false],
    [-54, 30.1, 0.88, false], [-24, 30.1, 0.8, true], [24, 30.1, 0.9, false],
    [54, 30.1, 0.82, true], [-54, -30.1, 0.9, false], [-24, -30.1, 0.82, true],
    [24, -30.1, 0.88, false], [54, -30.1, 0.84, true],
  ] as const;
  trees.forEach(([x, z, scale, palm]) => {
    const collider = makeTree(root, materials, x, z, scale, palm);
    colliders.push(collider);
  });

  const lights = [
    [-10.8, -48], [-10.8, 0], [-10.8, 48], [10.8, -48], [10.8, 0], [10.8, 48],
    [-48, 10.8], [0, 10.8], [48, 10.8], [-48, -10.8], [0, -10.8], [48, -10.8],
    [-48, 30.8], [0, 30.8], [48, 30.8], [-48, -30.8], [0, -30.8], [48, -30.8],
  ] as const;
  lights.forEach(([x, z], index) => {
    const collider = makeStreetlight(root, materials, x, z, index % 2 ? Math.PI / 2 : 0);
    colliders.push(collider);
  });

  addStreetSign(root, -9.8, -8.3, "DALA ROAD", 0);
  addStreetSign(root, 9.4, 8.5, "KASUWA LANE", Math.PI);

  // Small neighborhood benches and public water points.
  const benchLocations = [[-8.6, 28], [8.6, -28], [-44, 8.8], [44, -8.8]] as const;
  benchLocations.forEach(([x, z], index) => {
    const bench = new THREE.Group();
    bench.position.set(x, 0, z);
    bench.rotation.y = index % 2 ? Math.PI / 2 : 0;
    root.add(bench);
    addBox(bench, materials.wood, 0, 0.52, 0, 1.75, 0.16, 0.5);
    addBox(bench, materials.wood, 0, 0.93, -0.2, 1.75, 0.68, 0.12);
    for (const side of [-0.65, 0.65]) {
      addBox(bench, materials.metal, side, 0.28, 0, 0.1, 0.56, 0.1);
    }
    colliders.push({ x, z, halfX: 0.58, halfZ: 1.05, height: 1.35 });
  });

  addDistantHill(root, materials);

  // Subtle yard dust mounds break up large empty sand planes without blocking
  // the roads. They are flattened, low-detail procedural terrain meshes.
  const moundLocations = [
    [-59, -59], [59, 59], [-60, 4], [60, -5], [-42, 60], [40, -60],
    [-3, 60], [4, -60], [-60, 38], [60, -39], [-59, -39], [59, 39],
  ] as const;
  moundLocations.forEach(([x, z], i) => {
    const mound = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 0),
      i % 3 === 0 ? materials.stone : materials.ochre,
    );
    mound.position.set(x, -0.04, z);
    mound.scale.set(1.8 + (i % 3) * 0.45, 0.14, 1.2 + (i % 2) * 0.35);
    mound.receiveShadow = true;
    root.add(mound);
  });

  mergeStaticMeshesByCell(root);

  return { root, colliders, bounds };
}
