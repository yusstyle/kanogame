import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createMarketStall, createPlot } from "./buildings";
import { getDistrict, ROAD_LAYOUT, ROAD_CENTERS, WORLD_BOUNDS, WORLD_EXTENT, type RoadSpec } from "./layout";
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

function addStreetSign(root: THREE.Group, colliders: Collider[], x: number, z: number, label: string, yaw: number) {
  const pole = new THREE.Group();
  pole.position.set(x, 0, z);
  pole.rotation.y = yaw;
  root.add(pole);
  addCylinder(pole, new THREE.MeshStandardMaterial({ color: "#545349", roughness: 0.8 }), 0, 1.5, 0, 0.06, 0.06, 3.0);
  addBox(pole, makeSignMaterial(label, "#c5ae82"), 0, 2.56, 0, 1.55, 0.45, 0.1);
  colliders.push({ x, z, halfX: 0.18, halfZ: 0.18, height: 3 });
}

function addRoad(
  root: THREE.Group,
  materials: GameMaterials,
  road: RoadSpec,
) {
  const { axis, center, width } = road;
  const horizontal = axis === "x";
  const length = WORLD_EXTENT;
  const roadCenterX = horizontal ? 0 : center;
  const roadCenterZ = horizontal ? center : 0;
  const roadWidth = horizontal ? length : width;
  const roadDepth = horizontal ? width : length;
  addPlane(root, materials.asphalt, roadCenterX, roadCenterZ, roadWidth, roadDepth, 0.018);

  const sidewalkWidth = 3.0;
  const curbHeight = 0.14;
  const roadHalf = width / 2;
  const intersections = ROAD_LAYOUT
    .filter((crossing) => crossing.axis !== axis)
    .map((crossing) => [
      crossing.center - crossing.width / 2 - sidewalkWidth,
      crossing.center + crossing.width / 2 + sidewalkWidth,
    ] as [number, number]);
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
        addBox(root, materials.curb, midpoint, curbHeight / 2, curbZ, segmentLength, curbHeight, 0.24, false);
        const drainZ = center + side * (roadHalf + 0.35);
        addBox(root, materials.drain, midpoint, 0.025, drainZ, segmentLength, 0.035, 0.24, false);
        for (let mark = start + 2; mark < end; mark += 3.3) {
          addBox(root, materials.metal, mark, 0.049, drainZ, 0.06, 0.02, 0.19, false);
        }
      } else {
        const sidewalkX = center + side * (roadHalf + sidewalkWidth / 2);
        const curbX = center + side * (roadHalf + 0.08);
        addBox(root, materials.sidewalk, sidewalkX, 0.015, midpoint, sidewalkWidth, 0.14, segmentLength);
        addBox(root, materials.curb, curbX, curbHeight / 2, midpoint, curbHeight, curbHeight, segmentLength, false);
        const drainX = center + side * (roadHalf + 0.35);
        addBox(root, materials.drain, drainX, 0.025, midpoint, 0.24, 0.035, segmentLength, false);
        for (let mark = start + 2; mark < end; mark += 3.3) {
          addBox(root, materials.metal, drainX, 0.049, mark, 0.19, 0.02, 0.06, false);
        }
      }
    }
  }

  const lineMat = materials.roadMarking;
  for (let offset = -length / 2 + 3; offset < length / 2; offset += 7.5) {
    if (intersections.some(([start, end]) => offset >= start - 3 && offset <= end + 3)) continue;
    if (horizontal) {
      addBox(root, lineMat, offset, 0.035, center, 3.1, 0.018, 0.11, false);
    } else {
      addBox(root, lineMat, center, 0.035, offset, 0.11, 0.018, 3.1, false);
    }
  }

  const edgeOffset = width / 2 - 0.72;
  for (const side of [-1, 1]) {
    if (horizontal) {
      addBox(root, materials.roadMarking, 0, 0.034, center + side * edgeOffset, length, 0.018, 0.075, false);
    } else {
      addBox(root, materials.roadMarking, center + side * edgeOffset, 0.034, 0, 0.075, 0.018, length, false);
    }
  }

  if (road.arterial && width >= 14) {
    for (const offset of [-0.18, 0.18]) {
      if (horizontal) {
        addBox(root, materials.roadMarking, 0, 0.036, center + offset, length, 0.022, 0.055, false);
      } else {
        addBox(root, materials.roadMarking, center + offset, 0.036, 0, 0.055, 0.022, length, false);
      }
    }
  }
}

function addCrosswalks(root: THREE.Group, materials: GameMaterials) {
  const horizontalRoads = ROAD_LAYOUT.filter((road) => road.axis === "x");
  const verticalRoads = ROAD_LAYOUT.filter((road) => road.axis === "z");
  const material = materials.roadMarking;
  for (const horizontal of horizontalRoads) {
    for (const vertical of verticalRoads) {
      // Reserve zebra crossings for the major-road junctions so secondary
      // intersections remain visually quiet and the markings stay readable.
      if (!horizontal.arterial || !vertical.arterial) continue;
      const x = vertical.center;
      const z = horizontal.center;
      const horizontalOffset = vertical.width / 2 + 2.5;
      const verticalOffset = horizontal.width / 2 + 2.5;

      for (const side of [-1, 1]) {
        const crossingX = x + side * horizontalOffset;
        const crossingZ = z + side * verticalOffset;
        for (let stripe = -2; stripe <= 2; stripe += 1) {
          addBox(root, material, crossingX + stripe * 0.88, 0.04, z, 0.34, 0.025, horizontal.width - 2.2, false);
          addBox(root, material, x, 0.04, crossingZ + stripe * 0.88, vertical.width - 2.2, 0.025, 0.34, false);
        }
      }
    }
  }
}

function addRoadWear(root: THREE.Group, materials: GameMaterials) {
  // Deterministic, shallow asphalt repairs and scuffs break up the perfect road
  // planes without obscuring lane markings or creating extra collision shapes.
  let state = 64123;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const wearGeometry = new THREE.CircleGeometry(1, 9);
  for (let i = 0; i < 86; i += 1) {
    const road = ROAD_LAYOUT[Math.floor(random() * ROAD_LAYOUT.length)];
    const along = (random() - 0.5) * (WORLD_EXTENT - 24);
    const lateral = (random() - 0.5) * Math.max(1, road.width - 3);
    if (ROAD_LAYOUT.some((crossing) => crossing.axis !== road.axis &&
      Math.abs(along - crossing.center) < crossing.width / 2 + 5)) continue;

    const patch = new THREE.Mesh(wearGeometry, i % 4 === 0 ? materials.asphaltPatch : materials.asphalt);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = random() * Math.PI;
    patch.position.set(
      road.axis === "x" ? along : road.center + lateral,
      0.028 + random() * 0.002,
      road.axis === "x" ? road.center + lateral : along,
    );
    patch.scale.set(0.45 + random() * 0.8, 0.26 + random() * 0.48, 1);
    patch.receiveShadow = true;
    root.add(patch);
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
  hill.position.set(-163, 1.2, -160);
  hill.scale.set(1.38, 0.32, 0.83);
  hill.castShadow = true;
  hill.receiveShadow = true;
  root.add(hill);

  for (let i = 0; i < 3; i += 1) {
    const ridge = new THREE.Mesh(new THREE.IcosahedronGeometry(7 + i, 0), materials.clay);
    ridge.position.set(-165 + i * 8, 1.2, -164 - i * 2.5);
    ridge.scale.set(1.0, 0.3, 0.62);
    ridge.receiveShadow = true;
    root.add(ridge);
  }
}

function addMarketWaterTank(root: THREE.Group, materials: GameMaterials, colliders: Collider[], x: number, z: number) {
  const tank = new THREE.Group();
  tank.position.set(x, 0, z);
  root.add(tank);
  addCylinder(tank, materials.metal, 0, 1.1, 0, 0.72, 0.72, 2.0);
  addCylinder(tank, materials.metal, 0, 2.15, 0, 0.72, 0.55, 0.12);
  addCylinder(tank, materials.metal, 0, 2.25, 0, 0.16, 0.16, 0.14);
  colliders.push({ x, z, halfX: 0.78, halfZ: 0.78, height: 2.3 });
}

function addMosque(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
) {
  const mosque = new THREE.Group();
  mosque.position.set(x, 0, z);
  root.add(mosque);

  const hallWidth = 14.5;
  const hallHeight = 7.0;
  const hallDepth = 13.5;
  addBox(mosque, materials.white, 0, hallHeight / 2, 0, hallWidth, hallHeight, hallDepth);
  addBox(mosque, materials.ochre, 0, hallHeight + 0.18, 0, hallWidth + 0.4, 0.36, hallDepth + 0.4);

  for (let px = -hallWidth / 2 + 1.2; px <= hallWidth / 2 - 0.5; px += 2.2) {
    for (const pz of [-hallDepth / 2, hallDepth / 2]) {
      const finial = addBox(mosque, materials.ochre, px, hallHeight + 0.65, pz, 0.35, 0.65, 0.35);
      finial.rotation.z = Math.PI / 4;
    }
  }

  const domeMat = new THREE.MeshStandardMaterial({ color: "#1e6b36", roughness: 0.36, metalness: 0.15 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.position.set(0, hallHeight + 0.36, 0);
  dome.castShadow = true;
  mosque.add(dome);

  addCylinder(mosque, materials.metal, 0, hallHeight + 4.3, 0, 0.1, 0.05, 1.4);
  const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 16, Math.PI * 1.5), materials.metal);
  crescent.position.set(0, hallHeight + 5.1, 0);
  crescent.rotation.y = Math.PI / 2;
  mosque.add(crescent);

  const minaretX = hallWidth / 2 + 1.8;
  const minaretZ = hallDepth / 2 - 1.8;
  const minaretHeight = 16.5;
  addCylinder(mosque, materials.white, minaretX, minaretHeight / 2, minaretZ, 1.35, 1.1, minaretHeight);
  addCylinder(mosque, materials.ochre, minaretX, minaretHeight - 2.8, minaretZ, 1.7, 1.7, 0.4);
  addCylinder(mosque, materials.metal, minaretX, minaretHeight - 2.4, minaretZ, 1.65, 1.65, 0.7);
  const miniDome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  miniDome.position.set(minaretX, minaretHeight + 0.2, minaretZ);
  miniDome.castShadow = true;
  mosque.add(miniDome);
  addCylinder(mosque, materials.metal, minaretX, minaretHeight + 1.8, minaretZ, 0.06, 0.03, 1.0);

  const frontZ = hallDepth / 2 + 0.15;
  for (const ax of [-3.8, 0, 3.8]) {
    addBox(mosque, materials.ochre, ax, 1.8, frontZ, 2.4, 3.6, 0.3);
    addBox(mosque, materials.wood, ax, 1.55, frontZ + 0.05, 1.6, 3.1, 0.12);
  }

  const mosqueSign = makeSignMaterial("MASALLACIN JUMA'A · DALA", "#1e6b36");
  addBox(mosque, mosqueSign, 0, 4.8, frontZ + 0.18, 9.2, 0.82, 0.12);

  colliders.push(
    { x, z, halfX: hallWidth / 2 + 0.5, halfZ: hallDepth / 2 + 0.5, height: hallHeight + 5 },
    { x: x + minaretX, z: z + minaretZ, halfX: 1.5, halfZ: 1.5, height: minaretHeight + 2 },
  );
}

function addKanoRoadsideProps(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
  yaw = 0,
) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  root.add(group);

  // Diesel Generator (mota wuta)
  addBox(group, new THREE.MeshStandardMaterial({ color: "#2d5236", roughness: 0.6 }), 0, 0.65, 0, 1.45, 1.1, 0.88);
  addCylinder(group, materials.metal, 0.45, 1.65, 0.25, 0.06, 0.06, 0.9);

  // Overhead GeePee Water Tank on Scaffolding
  const tankX = 2.4;
  for (const sx of [-0.65, 0.65]) {
    for (const sz of [-0.65, 0.65]) {
      addCylinder(group, materials.metal, tankX + sx, 1.6, sz, 0.045, 0.045, 3.2);
    }
  }
  addBox(group, materials.metal, tankX, 3.25, 0, 1.55, 0.12, 1.55);
  const waterTankMat = new THREE.MeshStandardMaterial({ color: "#182026", roughness: 0.4, metalness: 0.2 });
  addCylinder(group, waterTankMat, tankX, 4.25, 0, 0.72, 0.7, 1.85);

  colliders.push(
    { x, z, halfX: 0.8, halfZ: 0.6, height: 1.8 },
    { x: x + tankX, z, halfX: 0.85, halfZ: 0.85, height: 5.2 },
  );
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
    if (object.userData.noMerge) return;
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
  gateSlots: THREE.Group[];
};

export function createWorld(materials: GameMaterials): WorldResult {
  const root = new THREE.Group();
  const colliders: Collider[] = [];
  const gateSlots: THREE.Group[] = [];
  const bounds = WORLD_BOUNDS;
  const cityExtent = WORLD_EXTENT;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(260, 32, 20),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  sky.frustumCulled = false;
  root.add(sky);

  addPlane(root, materials.ground, 0, 0, cityExtent, cityExtent, 0);
  ROAD_LAYOUT.forEach((road) => addRoad(root, materials, road));
  addCrosswalks(root, materials);
  addRoadWear(root, materials);

  const blockCenters = ROAD_CENTERS.slice(0, -1).map((center, index) =>
    (center + ROAD_CENTERS[index + 1]) / 2,
  );
  const parcelOffsets: [number, number][] = [
    [-8.25, -9.75],
    [-8.25, 9.75],
    [8.25, -9.75],
    [8.25, 9.75],
  ];
  const shopNames = [
    "KASUWA PROVISIONS", "AREWA TEXTILES", "DALA MOTOR PARTS", "MAISHA GRAIN",
    "SABON GARI STORES", "KANO BOOKS", "NORTH STAR PHARMACY", "TEA & BREAD",
  ];
  let variant = 0;
  for (let zi = 0; zi < blockCenters.length; zi += 1) {
    for (let xi = 0; xi < blockCenters.length; xi += 1) {
      const blockX = blockCenters[xi];
      const blockZ = blockCenters[zi];
      const district = getDistrict(blockX, blockZ);

      // Open-air market plaza in Sabon Gari
      if (xi === 1 && zi === 2) {
        addMarketPlaza(root, materials, colliders, blockX, blockZ);
        continue;
      }

      // Community Friday Mosque in Dala / Old Kano
      if (xi === 1 && zi === 1) {
        addMosque(root, materials, colliders, blockX, blockZ);
        continue;
      }

      for (let slot = 0; slot < parcelOffsets.length; slot += 1) {
        const [offsetX, offsetZ] = parcelOffsets[slot];
        const x = blockX + offsetX;
        const z = blockZ + offsetZ;
        const selector = (xi * 7 + zi * 11 + slot * 5 + variant) % 12;
        let kind: BuildingKind;
        switch (district) {
          case "dala":
            kind = selector % 5 === 0 ? "modern" : "traditional";
            break;
          case "sabon-gari":
            kind = selector % 4 === 0 ? "commercial" : selector % 3 === 0 ? "shop" : selector % 2 ? "traditional" : "modern";
            break;
          case "airport-road":
            kind = selector % 3 === 0 ? "shop" : selector % 3 === 1 ? "commercial" : "modern";
            break;
          case "residential":
            kind = selector % 3 === 0 ? "traditional" : "modern";
            break;
        }

        const sign = shopNames[(variant * 3 + slot) % shopNames.length];
        const plot = createPlot(kind, materials, variant, sign);
        if (plot.gateSlot) {
          gateSlots.push(plot.gateSlot);
        }
        const faceAlongZ = (xi + zi + slot) % 2 === 0;
        const yaw = faceAlongZ
          ? offsetZ > 0 ? 0 : Math.PI
          : offsetX > 0 ? Math.PI / 2 : -Math.PI / 2;
        plot.root.position.set(x, 0, z);
        plot.root.rotation.y = yaw;
        root.add(plot.root);
        colliders.push(...plot.colliders.map((item) => transformCollider(item, x, z, yaw)));
        variant += 1;
      }
    }
  }

  addMarketWaterTank(root, materials, colliders, -43, 44);
  addKanoRoadsideProps(root, materials, colliders, -16, 26, Math.PI / 2);
  addKanoRoadsideProps(root, materials, colliders, 18, -22, 0);

  const trees: [number, number, number, boolean][] = [];
  for (const road of ROAD_LAYOUT.filter((item) => item.arterial)) {
    for (const side of [-1, 1]) {
      for (const along of [-90, -30, 30, 90]) {
        const offset = road.width / 2 + 1.65;
        trees.push(road.axis === "x"
          ? [along, road.center + side * offset, 0.82 + ((along + side) % 3) * 0.04, (along + side) % 2 === 0]
          : [road.center + side * offset, along, 0.82 + ((along + side) % 3) * 0.04, (along + side) % 2 !== 0]);
      }
    }
  }
  trees.forEach(([x, z, scale, palm]) => {
    const collider = makeTree(root, materials, x, z, scale, palm);
    colliders.push(collider);
  });

  const lightLocations: [number, number, number][] = [];
  for (const road of ROAD_LAYOUT.filter((item) => item.arterial)) {
    for (const along of [-92, -28, 28, 92]) {
      for (const side of [-1, 1]) {
        const offset = road.width / 2 + 1.3;
        lightLocations.push(road.axis === "x"
          ? [along, road.center + side * offset, 0]
          : [road.center + side * offset, along, Math.PI / 2]);
      }
    }
  }
  lightLocations.forEach(([x, z, yaw]) => {
    const collider = makeStreetlight(root, materials, x, z, yaw);
    colliders.push(collider);
  });

  addStreetSign(root, colliders, -130, -15, "DALA · OLD KANO", 0);
  addStreetSign(root, colliders, -15, 130, "SABON GARI", Math.PI / 2);
  addStreetSign(root, colliders, 78, -130, "AIRPORT ROAD", 0);
  addStreetSign(root, colliders, 130, 15, "RESIDENTIAL QUARTER", -Math.PI / 2);

  // Small neighborhood benches and public water points.
  const benchLocations = [[-44, 27], [-20, 35], [32, -34], [40, -27]] as const;
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
    colliders.push(
      transformCollider(
        { x: 0, z: 0, halfX: 0.92, halfZ: 0.34, height: 1.35 },
        x,
        z,
        bench.rotation.y,
      ),
    );
  });

  addDistantHill(root, materials);

  // Low sand shoulders and edge debris soften the map border but stay outside
  // the connected neighborhood streets and building parcels.
  const moundLocations = [
    [-130, -130], [130, 130], [-132, 4], [132, -5], [-108, 130], [108, -130],
    [-4, 130], [4, -130], [-132, 104], [132, -105], [-130, -106], [130, 106],
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

  return { root, colliders, bounds, gateSlots };
}
