import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Collider, GameMaterials } from "./types";
import { getAbujaElevation } from "./abujaLandscape";
import type { StreamingChunk, DistrictType } from "./abujaStreaming";
import { abujaPbrMaterials } from "./abujaMaterials";
import { getAbujaInfrastructureMaterials } from "./abujaInfrastructure";
import { markWorldResourceShared } from "./worldResourceLifecycle";

const lod1WindowGeometry = markWorldResourceShared(new THREE.BoxGeometry(1, 1, 0.12));

function safeMergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared);
  if (!merged) {
    throw new Error("safeMergeGeometries failed to merge district geometries");
  }
  return merged;
}

// -------------------------------------------------------------
// HELPER FUNCTIONS FOR BATCHED GEOMETRY ACCUMULATION
// -------------------------------------------------------------
function pushBox(
  bucket: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  bucket.push(g);
}

function pushCylinder(
  bucket: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  rt: number,
  rb: number,
  h: number,
  seg = 12,
) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y + h / 2, z);
  bucket.push(g);
}

function buildLod1WindowMatrices(shells: THREE.BufferGeometry[]) {
  const matrices: THREE.Matrix4[] = [];
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();

  const addWindows = (
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
    width: number,
    depth: number,
  ) => {
    const rows = Math.min(6, Math.max(1, Math.floor((maxY - minY - 2.4) / 4.2)));
    const rowSpacing = (maxY - minY - 2.4) / (rows + 1);
    const windowHeight = Math.min(2.0, rowSpacing * 0.56);

    for (const side of [-1, 1]) {
      const span = side === 1 ? width : depth;
      const columns = Math.min(6, Math.max(2, Math.floor(span / 5.5)));
      const columnSpacing = span / (columns + 1);
      const windowWidth = columnSpacing * 0.58;

      for (let row = 0; row < rows; row += 1) {
        const centerY = minY + 1.2 + rowSpacing * (row + 1);
        for (let column = 0; column < columns; column += 1) {
          const centerAlong = side === 1
            ? minX + columnSpacing * (column + 1)
            : minZ + columnSpacing * (column + 1);
          const centerX = side === 1 ? centerAlong : (side > 0 ? maxX + 0.07 : minX - 0.07);
          const centerZ = side === 1 ? (side > 0 ? maxZ + 0.07 : minZ - 0.07) : centerAlong;
          const paneScale = side === 1
            ? scale.set(windowWidth, windowHeight, 0.12)
            : scale.set(0.12, windowHeight, windowWidth);
          matrix.compose(position.set(centerX, centerY, centerZ), rotation, paneScale);
          matrices.push(matrix.clone());
        }
      }
    }
  };

  shells.forEach((shell) => {
    shell.computeBoundingBox();
    const bounds = shell.boundingBox;
    if (!bounds) return;

    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const depth = bounds.max.z - bounds.min.z;
    if (width < 10 || height < 7 || depth < 10) return;

    addWindows(bounds.min.x, bounds.max.x, bounds.min.y, bounds.max.y, bounds.min.z, bounds.max.z, width, depth);
  });

  return matrices;
}

/**
 * 1. Nigerian Elevated Steel Tank Tower with "Storex" Polyethylene Water Storage Tank
 */
function pushWaterTankTower(
  buckets: { [key: string]: THREE.BufferGeometry[] },
  x: number,
  by: number,
  z: number,
  towerHeight = 4.2,
  tankRadius = 1.15,
  tankHeight = 2.2,
) {
  const legW = 0.12;
  const spread = tankRadius * 1.25;
  const offsets = [
    [-spread, -spread],
    [spread, -spread],
    [-spread, spread],
    [spread, spread],
  ];

  // 4 steel angle-iron vertical legs
  offsets.forEach(([ox, oz]) => {
    pushBox(buckets.steelTower, x + ox, by, z + oz, legW, towerHeight, legW);
  });

  // Intermediate horizontal cross-bracing
  const midY = by + towerHeight * 0.5;
  pushBox(buckets.steelTower, x, midY, z - spread, spread * 2, 0.08, 0.08);
  pushBox(buckets.steelTower, x, midY, z + spread, spread * 2, 0.08, 0.08);
  pushBox(buckets.steelTower, x - spread, midY, z, 0.08, 0.08, spread * 2);
  pushBox(buckets.steelTower, x + spread, midY, z, 0.08, 0.08, spread * 2);

  // Top platform deck
  pushBox(buckets.steelTower, x, by + towerHeight, z, spread * 2 + 0.35, 0.15, spread * 2 + 0.35);

  // Heavy ribbed Storex water tank cylinder
  pushCylinder(buckets.waterTank, x, by + towerHeight + 0.15, z, tankRadius, tankRadius * 0.98, tankHeight, 16);
  // Conical top lid
  pushCylinder(buckets.waterTank, x, by + towerHeight + 0.15 + tankHeight, z, 0.25, tankRadius, 0.35, 16);
}

/**
 * 2. Soundproof Diesel Generator House ("Mikano" / "CAT" Silent Genset)
 */
function pushGeneratorHouse(
  buckets: { [key: string]: THREE.BufferGeometry[] },
  x: number,
  by: number,
  z: number,
) {
  // Concrete anti-vibration mounting plinth
  pushBox(buckets.concrete, x, by, z, 3.6, 0.35, 2.2);
  // Industrial silent genset green enclosure
  pushBox(buckets.generator, x, by + 0.35, z, 3.0, 1.7, 1.6);
  // Exhaust flue pipe
  pushCylinder(buckets.steelTower, x - 1.1, by + 2.05, z - 0.4, 0.07, 0.07, 1.4, 8);
}

/**
 * 3. Security Perimeter Razor Wire & Electric Fence Strands along Wall Coping
 */
function pushRazorWireFence(
  buckets: { [key: string]: THREE.BufferGeometry[] },
  x1: number,
  y: number,
  z1: number,
  x2: number,
  z2: number,
) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 1.0) return;
  const midX = (x1 + x2) / 2;
  const midZ = (z1 + z2) / 2;
  const isX = Math.abs(dx) > Math.abs(dz);

  // Y-bracket metal security posts every 6 meters
  const postCount = Math.max(2, Math.floor(len / 6));
  for (let p = 0; p <= postCount; p++) {
    const t = p / postCount;
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    pushBox(buckets.steelTower, px, y, pz, 0.05, 0.55, 0.05);
  }

  // 3 taut horizontal electric fence wire strands
  for (let s = 0; s < 3; s++) {
    const wireY = y + 0.12 + s * 0.16;
    if (isX) {
      pushBox(buckets.razorWire, midX, wireY, midZ, len, 0.025, 0.025);
    } else {
      pushBox(buckets.razorWire, midX, wireY, midZ, 0.025, 0.025, len);
    }
  }
}

/**
 * Builds an expanded 256m x 256m streaming chunk populated with authentic Nigerian urban architecture
 */
export function buildStreamingChunk(
  cx: number,
  cz: number,
  chunkSize: number,
  districtType: DistrictType,
  districtName: string,
  materials: GameMaterials,
): StreamingChunk {
  const minX = cx * chunkSize;
  const maxX = minX + chunkSize;
  const minZ = cz * chunkSize;
  const maxZ = minZ + chunkSize;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const id = `chunk_${cx}_${cz}`;
  const group = new THREE.Group();
  group.name = `ChunkGroup_${id}`;

  const lod0Group = new THREE.Group();
  lod0Group.name = `${id}_LOD0`;
  const lod1Group = new THREE.Group();
  lod1Group.name = `${id}_LOD1`;

  group.add(lod0Group);
  group.add(lod1Group);

  const colliders: Collider[] = [];

  // -------------------------------------------------------------
  // 1. LOCAL CONNECTED ROADS & SIDEWALKS FOR THIS CHUNK (PBR TEXTURED)
  // -------------------------------------------------------------
  const roadGeos: THREE.BufferGeometry[] = [];
  const sidewalkGeos: THREE.BufferGeometry[] = [];
  const curbGeos: THREE.BufferGeometry[] = [];
  const whiteMarkingGeos: THREE.BufferGeometry[] = [];
  const yellowMarkingGeos: THREE.BufferGeometry[] = [];

  const addGroundStrip = (
    target: THREE.BufferGeometry[],
    x: number,
    z: number,
    width: number,
    depth: number,
    y = 0.055,
  ) => {
    const strip = new THREE.PlaneGeometry(width, depth);
    strip.rotateX(-Math.PI / 2);
    strip.translate(x, y, z);
    target.push(strip);
  };
  const addCurb = (x: number, z: number, width: number, depth: number) => {
    const curb = new THREE.BoxGeometry(width, 0.18, depth);
    curb.translate(x, 0.09, z);
    curbGeos.push(curb);
  };

  // Primary N-S Arterials (x = -450, 0, 450)
  [-450, 0, 450].forEach((rx) => {
    if (rx >= minX - 14 && rx <= maxX + 14) {
      const road = new THREE.PlaneGeometry(24, chunkSize);
      road.rotateX(-Math.PI / 2);
      // The terrain is y=0.02 in these corridors. Raise the asphalt above it.
      road.translate(rx, 0.04, centerZ);
      roadGeos.push(road);

      for (const sx of [-15, 15]) {
        const sw = new THREE.BoxGeometry(3.2, 0.14, chunkSize);
        sw.translate(rx + sx, 0.07, centerZ);
        sidewalkGeos.push(sw);
      }
      for (const side of [-1, 1]) {
        addCurb(rx + side * 12.15, centerZ, 0.3, chunkSize);
        addGroundStrip(whiteMarkingGeos, rx + side * 11.35, centerZ, 0.18, chunkSize);
      }
      for (const side of [-1, 1]) {
        addGroundStrip(yellowMarkingGeos, rx + side * 0.22, centerZ, 0.18, chunkSize);
      }
      for (let mz = minZ + 5; mz < maxZ - 4; mz += 14) {
        if (Math.abs(mz) < 18 || Math.abs(mz - 450) < 18 || Math.abs(mz + 450) < 18) continue;
        for (const side of [-1, 1]) {
          addGroundStrip(whiteMarkingGeos, rx + side * 5.8, mz, 0.16, 7.5);
        }
      }
    }
  });

  // Primary E-W Arterials (z = -450, 0, 450)
  [-450, 0, 450].forEach((rz) => {
    if (rz >= minZ - 12 && rz <= maxZ + 12) {
      const road = new THREE.PlaneGeometry(chunkSize, 22);
      road.rotateX(-Math.PI / 2);
      road.translate(centerX, 0.04, rz);
      roadGeos.push(road);

      for (const sz of [-14, 14]) {
        const sw = new THREE.BoxGeometry(chunkSize, 0.14, 3.2);
        sw.translate(centerX, 0.07, rz + sz);
        sidewalkGeos.push(sw);
      }
      for (const side of [-1, 1]) {
        addCurb(centerX, rz + side * 11.15, chunkSize, 0.3);
        addGroundStrip(whiteMarkingGeos, centerX, rz + side * 10.35, chunkSize, 0.18);
        addGroundStrip(yellowMarkingGeos, centerX, rz + side * 0.22, chunkSize, 0.18);
      }
      for (let mx = minX + 5; mx < maxX - 4; mx += 14) {
        if (Math.abs(mx) < 18 || Math.abs(mx - 450) < 18 || Math.abs(mx + 450) < 18) continue;
        for (const side of [-1, 1]) {
          addGroundStrip(whiteMarkingGeos, mx, rz + side * 5.3, 7.5, 0.16);
        }
      }
    }
  });

  // Secondary grid connection streets through district sectors
  const localStreetX = minX + 64;
  const localStreetZ = minZ + 64;
  const localRoad1 = new THREE.PlaneGeometry(14, chunkSize);
  localRoad1.rotateX(-Math.PI / 2);
  localRoad1.translate(localStreetX, 0.04, centerZ);
  roadGeos.push(localRoad1);

  const localRoad2 = new THREE.PlaneGeometry(chunkSize, 14);
  localRoad2.rotateX(-Math.PI / 2);
  localRoad2.translate(centerX, 0.04, localStreetZ);
  roadGeos.push(localRoad2);
  for (const side of [-1, 1]) {
    const curb1 = new THREE.BoxGeometry(0.3, 0.18, chunkSize);
    curb1.translate(localStreetX + side * 7.15, 0.09, centerZ);
    curbGeos.push(curb1);
    const walk1 = new THREE.BoxGeometry(2.4, 0.14, chunkSize);
    walk1.translate(localStreetX + side * 8.5, 0.07, centerZ);
    sidewalkGeos.push(walk1);
    addGroundStrip(whiteMarkingGeos, localStreetX + side * 6.55, centerZ, 0.16, chunkSize);

    const curb2 = new THREE.BoxGeometry(chunkSize, 0.18, 0.3);
    curb2.translate(centerX, 0.09, localStreetZ + side * 7.15);
    curbGeos.push(curb2);
    const walk2 = new THREE.BoxGeometry(chunkSize, 0.14, 2.4);
    walk2.translate(centerX, 0.07, localStreetZ + side * 8.5);
    sidewalkGeos.push(walk2);
    addGroundStrip(whiteMarkingGeos, centerX, localStreetZ + side * 6.55, chunkSize, 0.16);
  }
  addGroundStrip(yellowMarkingGeos, localStreetX - 0.18, centerZ, 0.14, chunkSize);
  addGroundStrip(yellowMarkingGeos, localStreetX + 0.18, centerZ, 0.14, chunkSize);
  addGroundStrip(yellowMarkingGeos, centerX, localStreetZ - 0.18, chunkSize, 0.14);
  addGroundStrip(yellowMarkingGeos, centerX, localStreetZ + 0.18, chunkSize, 0.14);

  const infraMats = getAbujaInfrastructureMaterials();

  if (roadGeos.length > 0) {
    const mergedRoads = safeMergeGeometries(roadGeos);
    for (const g of roadGeos) g.dispose();
    const roadMesh = new THREE.Mesh(mergedRoads, infraMats.asphalt);
    roadMesh.receiveShadow = true;
    roadMesh.name = `${id}_Roads`;
    roadMesh.userData.noMerge = true;
    lod0Group.add(roadMesh);

    const roadLOD1 = roadMesh.clone();
    roadLOD1.userData.noMerge = true;
    lod1Group.add(roadLOD1);
  }

  if (sidewalkGeos.length > 0) {
    const mergedSidewalks = safeMergeGeometries(sidewalkGeos);
    for (const g of sidewalkGeos) g.dispose();
    const swMesh = new THREE.Mesh(mergedSidewalks, infraMats.sidewalk);
    swMesh.receiveShadow = true;
    swMesh.name = `${id}_Sidewalks`;
    swMesh.userData.noMerge = true;
    lod0Group.add(swMesh);
  }

  if (curbGeos.length > 0) {
    const mergedCurbs = safeMergeGeometries(curbGeos);
    for (const g of curbGeos) g.dispose();
    const curbMesh = new THREE.Mesh(mergedCurbs, infraMats.curb);
    curbMesh.receiveShadow = true;
    curbMesh.name = `${id}_Curbs`;
    curbMesh.userData.noMerge = true;
    lod0Group.add(curbMesh);
  }

  const addMarkingsMesh = (geos: THREE.BufferGeometry[], material: THREE.Material, label: string) => {
    if (geos.length === 0) return;
    const merged = safeMergeGeometries(geos);
    for (const geometry of geos) geometry.dispose();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `${id}_${label}`;
    mesh.userData.noMerge = true;
    lod0Group.add(mesh);
    lod1Group.add(mesh.clone());
  };
  addMarkingsMesh(whiteMarkingGeos, infraMats.whiteMarking, "WhiteRoadMarkings");
  addMarkingsMesh(yellowMarkingGeos, infraMats.yellowMarking, "YellowRoadMarkings");

  // -------------------------------------------------------------
  // 2. DISTRICT-SPECIFIC ARCHITECTURAL BUILDINGS (BATCHED BY MATERIAL)
  // -------------------------------------------------------------
  const lod0BuildingGeos: { [mat: string]: THREE.BufferGeometry[] } = {
    stucco: [],
    sandcrete: [],
    stone: [],
    glassBlue: [],
    glassGreen: [],
    signage: [],
    shopfront: [],
    ac: [],
    roof: [],
    corrugatedRoof: [],
    waterTank: [],
    generator: [],
    steelTower: [],
    razorWire: [],
    marble: [],
    granite: [],
    bronze: [],
    gate: [],
    paver: [],
    concrete: [],
  };
  const lod1BuildingGeos: THREE.BufferGeometry[] = [];

  let seed = Math.abs((cx * 73856093) ^ (cz * 19349663));
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const isCentralCore = (cx === -1 || cx === 0) && (cz === -1 || cz === 0);

  if (!isCentralCore) {
    if (districtType === "maitama_luxury") {
      // -------------------------------------------------------------
      // MAITAMA: Luxury Gated Diplomatic Duplex Villas & Embassies
      // -------------------------------------------------------------
      const plots = [
        { x: minX + 48, z: minZ + 48 },
        { x: minX + 176, z: minZ + 48 },
        { x: minX + 48, z: minZ + 176 },
        { x: minX + 176, z: minZ + 176 },
      ];

      plots.forEach((pt, pIdx) => {
        const by = getAbujaElevation(pt.x, pt.z);
        const w = 26 + rnd() * 6;
        const d = 22 + rnd() * 6;
        const cw = w + 16;
        const cd = d + 16;
        const archetype = (pIdx + Math.abs(cx + cz)) % 3;

        // 3.2m High Sandcrete Security Perimeter Wall enclosing plot
        // North wall
        pushBox(lod0BuildingGeos.stucco, pt.x, by, pt.z - cd / 2, cw, 3.2, 0.4);
        // West wall
        pushBox(lod0BuildingGeos.stucco, pt.x - cw / 2 + 0.2, by, pt.z, 0.4, 3.2, cd);
        // East wall
        pushBox(lod0BuildingGeos.stucco, pt.x + cw / 2 - 0.2, by, pt.z, 0.4, 3.2, cd);
        // South wall with 6.2m entrance gate opening
        const sideWallW = (cw - 6.2) / 2;
        pushBox(lod0BuildingGeos.stucco, pt.x - 3.1 - sideWallW / 2, by, pt.z + cd / 2, sideWallW, 3.2, 0.4);
        pushBox(lod0BuildingGeos.stucco, pt.x + 3.1 + sideWallW / 2, by, pt.z + cd / 2, sideWallW, 3.2, 0.4);

        // Charcoal granite wall coping
        pushBox(lod0BuildingGeos.granite, pt.x, by + 3.2, pt.z - cd / 2, cw + 0.4, 0.2, 0.6);
        pushBox(lod0BuildingGeos.granite, pt.x - cw / 2 + 0.2, by + 3.2, pt.z, 0.6, 0.2, cd);
        pushBox(lod0BuildingGeos.granite, pt.x + cw / 2 - 0.2, by + 3.2, pt.z, 0.6, 0.2, cd);
        pushBox(lod0BuildingGeos.granite, pt.x - 3.1 - sideWallW / 2, by + 3.2, pt.z + cd / 2, sideWallW + 0.2, 0.2, 0.6);
        pushBox(lod0BuildingGeos.granite, pt.x + 3.1 + sideWallW / 2, by + 3.2, pt.z + cd / 2, sideWallW + 0.2, 0.2, 0.6);

        // Y-bracket razor wire & electric fence along all 4 wall top copings
        pushRazorWireFence(lod0BuildingGeos, pt.x - cw / 2, by + 3.4, pt.z - cd / 2, pt.x + cw / 2, pt.z - cd / 2);
        pushRazorWireFence(lod0BuildingGeos, pt.x - cw / 2, by + 3.4, pt.z - cd / 2, pt.x - cw / 2, pt.z + cd / 2);
        pushRazorWireFence(lod0BuildingGeos, pt.x + cw / 2, by + 3.4, pt.z - cd / 2, pt.x + cw / 2, pt.z + cd / 2);
        pushRazorWireFence(lod0BuildingGeos, pt.x - cw / 2, by + 3.4, pt.z + cd / 2, pt.x - 3.1, pt.z + cd / 2);
        pushRazorWireFence(lod0BuildingGeos, pt.x + 3.1, by + 3.4, pt.z + cd / 2, pt.x + cw / 2, pt.z + cd / 2);

        // Monumental Ledger Stone Gate Pillars with Caps & Carriage Lamps
        pushBox(lod0BuildingGeos.stone, pt.x - 3.5, by, pt.z + cd / 2, 1.3, 3.8, 1.3);
        pushBox(lod0BuildingGeos.stone, pt.x + 3.5, by, pt.z + cd / 2, 1.3, 3.8, 1.3);
        pushBox(lod0BuildingGeos.granite, pt.x - 3.5, by + 3.8, pt.z + cd / 2, 1.5, 0.25, 1.5);
        pushBox(lod0BuildingGeos.granite, pt.x + 3.5, by + 3.8, pt.z + cd / 2, 1.5, 0.25, 1.5);
        // Carriage lamp fixtures on pillar caps
        pushBox(lod0BuildingGeos.bronze, pt.x - 3.5, by + 4.05, pt.z + cd / 2, 0.4, 0.5, 0.4);
        pushBox(lod0BuildingGeos.bronze, pt.x + 3.5, by + 4.05, pt.z + cd / 2, 0.4, 0.5, 0.4);

        // Black Automated Sliding Metal Gate with pedestrian wicket door
        pushBox(lod0BuildingGeos.gate, pt.x, by, pt.z + cd / 2, 6.0, 2.9, 0.15);
        // Wicket door frame outline
        pushBox(lod0BuildingGeos.bronze, pt.x + 2.0, by, pt.z + cd / 2 + 0.05, 1.1, 2.2, 0.05);

        // Security Guard Booth ("Maiguard" post) with Viewing Window & Canopy
        pushBox(lod0BuildingGeos.sandcrete, pt.x + 5.2, by, pt.z + cd / 2 - 1.6, 2.2, 3.0, 2.2);
        pushBox(lod0BuildingGeos.glassBlue, pt.x + 5.2, by + 1.2, pt.z + cd / 2 - 0.5, 1.4, 1.0, 0.2);
        pushBox(lod0BuildingGeos.granite, pt.x + 5.2, by + 3.0, pt.z + cd / 2 - 1.6, 2.6, 0.2, 2.6);

        // Interlocking Paver Driveway
        pushBox(lod0BuildingGeos.paver, pt.x, by + 0.04, pt.z + cd / 4, 6.5, 0.08, cd / 2);

        // Rear Service Yard: Elevated Storex Water Tank Tower & Silent Diesel Generator
        const yardX = pt.x - cw / 2 + 4.5;
        const yardZ = pt.z - cd / 2 + 4.5;
        pushWaterTankTower(lod0BuildingGeos as any, yardX, by, yardZ, 4.2, 1.15, 2.2);
        pushGeneratorHouse(lod0BuildingGeos as any, yardX + 4.5, by, yardZ);

        if (archetype === 0) {
          // Archetype 0: Contemporary Cantilever Luxury Villa
          pushBox(lod0BuildingGeos.sandcrete, pt.x, by, pt.z - 2, w, 4.2, d);
          pushBox(lod0BuildingGeos.stone, pt.x - w / 2 + 1.5, by, pt.z - 2, 3.0, 4.2, d + 0.4);
          pushBox(lod0BuildingGeos.glassBlue, pt.x + 2, by + 0.5, pt.z - 2 + d / 2 + 0.1, w - 8, 3.2, 0.2);

          // First floor cantilever projection
          pushBox(lod0BuildingGeos.stucco, pt.x + 1, by + 4.2, pt.z - 1, w - 2, 4.0, d + 2);
          pushBox(lod0BuildingGeos.glassBlue, pt.x + 1, by + 4.8, pt.z - 1 + (d + 2) / 2 + 0.1, w - 6, 2.8, 0.2);
          // Cantilevered terrace balcony with bronze railings
          pushBox(lod0BuildingGeos.bronze, pt.x + 1, by + 4.2, pt.z + d / 2 + 1, w - 4, 1.1, 0.2);
          pushBox(lod0BuildingGeos.bronze, pt.x + 1, by + 7.6, pt.z + d / 2 + 1, w, 0.3, 1.8);

          // Parapet roof
          pushBox(lod0BuildingGeos.granite, pt.x + 1, by + 8.2, pt.z - 1, w, 0.6, d + 2.2);

          // Split AC Condenser Units on flank walls
          pushBox(lod0BuildingGeos.ac, pt.x - w / 2 - 0.4, by + 2.2, pt.z - 2, 0.5, 0.8, 1.2);
          pushBox(lod0BuildingGeos.ac, pt.x - w / 2 - 0.4, by + 5.5, pt.z - 2, 0.5, 0.8, 1.2);

          // Double Carport Canopy
          pushBox(lod0BuildingGeos.bronze, pt.x + w / 2 - 3, by + 3.2, pt.z + 4, 6.5, 0.3, 6);
          pushCylinder(lod0BuildingGeos.granite, pt.x + w / 2 - 6, by, pt.z + 6.8, 0.1, 0.1, 3.2);
          pushCylinder(lod0BuildingGeos.granite, pt.x + w / 2, by, pt.z + 6.8, 0.1, 0.1, 3.2);

        } else if (archetype === 1) {
          // Archetype 1: Diplomatic Embassy Residence (Neoclassical Marble)
          pushBox(lod0BuildingGeos.marble, pt.x, by, pt.z - 2, w, 9.0, d);

          // Grand 4-Column Classical Entrance Portico
          pushBox(lod0BuildingGeos.marble, pt.x, by, pt.z + d / 2 - 1.2, 10, 9.5, 3.5);
          for (let col = -3.8; col <= 3.8; col += 2.5) {
            pushCylinder(lod0BuildingGeos.marble, pt.x + col, by, pt.z + d / 2 + 0.4, 0.35, 0.4, 8.8);
          }
          pushBox(lod0BuildingGeos.marble, pt.x, by + 8.8, pt.z + d / 2 + 0.4, 11, 1.2, 4.0);

          // Balcony with decorative balustrade above portico
          pushBox(lod0BuildingGeos.bronze, pt.x, by + 10.0, pt.z + d / 2 + 0.4, 10.5, 1.0, 3.8);

          // Rhythmic recessed windows
          for (let fx = -w / 2 + 3; fx <= w / 2 - 3; fx += 5.5) {
            if (Math.abs(fx) < 5) continue;
            pushBox(lod0BuildingGeos.glassBlue, pt.x + fx, by + 1.2, pt.z + d / 2 - 1.9, 2.2, 2.8, 0.2);
            pushBox(lod0BuildingGeos.glassBlue, pt.x + fx, by + 5.5, pt.z + d / 2 - 1.9, 2.2, 2.6, 0.2);
          }

          // Terracotta hipped roof
          pushBox(lod0BuildingGeos.roof, pt.x, by + 9.0, pt.z - 2, w + 1.8, 2.8, d + 1.8);

          // Split AC units
          pushBox(lod0BuildingGeos.ac, pt.x + w / 2 + 0.2, by + 2.5, pt.z - 4, 0.4, 0.8, 1.2);
          pushBox(lod0BuildingGeos.ac, pt.x + w / 2 + 0.2, by + 6.0, pt.z - 4, 0.4, 0.8, 1.2);

        } else {
          // Archetype 2: Tropical Modern Gated Duplex with Wooden Pergola
          pushBox(lod0BuildingGeos.sandcrete, pt.x, by, pt.z - 2, w, 8.2, d);
          pushBox(lod0BuildingGeos.stone, pt.x - 2, by, pt.z + d / 2 - 2, 7.0, 8.2, 0.6);

          // First floor recessed bedroom balcony with tinted glass
          pushBox(lod0BuildingGeos.glassBlue, pt.x - 2, by + 4.5, pt.z + d / 2 - 1.8, 6.2, 2.8, 0.2);
          pushBox(lod0BuildingGeos.bronze, pt.x - 2, by + 4.2, pt.z + d / 2 - 1.6, 6.4, 1.0, 0.2);

          // Wooden Pergola Terrace
          pushBox(lod0BuildingGeos.bronze, pt.x + 4, by + 8.2, pt.z, 8.0, 0.3, d * 0.7);

          // AC units
          pushBox(lod0BuildingGeos.ac, pt.x - w / 2 - 0.3, by + 2.5, pt.z, 0.4, 0.8, 1.2);
          pushBox(lod0BuildingGeos.ac, pt.x - w / 2 - 0.3, by + 5.5, pt.z, 0.4, 0.8, 1.2);
        }

        // Add simplified bounding box to LOD 1
        pushBox(lod1BuildingGeos, pt.x, by, pt.z, cw, 10, cd);
        colliders.push({
          x: pt.x,
          z: pt.z,
          halfX: cw * 0.5,
          halfZ: cd * 0.5,
          height: 12,
        });
      });

    } else if (districtType === "wuse_commercial") {
      // -------------------------------------------------------------
      // WUSE 2: Multi-Story Commercial Plazas, Hotels & Banking Towers
      // -------------------------------------------------------------
      const plots = [
        { x: minX + 50, z: minZ + 50 },
        { x: minX + 175, z: minZ + 50 },
        { x: minX + 50, z: minZ + 175 },
        { x: minX + 175, z: minZ + 175 },
      ];

      plots.forEach((pt, pIdx) => {
        const by = getAbujaElevation(pt.x, pt.z);
        const w = 34 + rnd() * 8;
        const d = 28 + rnd() * 6;
        const archetype = (pIdx + Math.abs(cx + cz)) % 3;

        if (archetype === 0) {
          // Archetype 0: Multi-Storey Commercial Plaza (Banex / Emab Style)
          const h = 18;
          // Ground floor illuminated retail shopfronts under canopy
          pushBox(lod0BuildingGeos.sandcrete, pt.x, by, pt.z, w + 4, 4.5, d + 2);
          pushBox(lod0BuildingGeos.shopfront, pt.x, by + 0.2, pt.z + d / 2 + 1.1, w, 3.6, 0.2);
          pushBox(lod0BuildingGeos.bronze, pt.x, by + 4.3, pt.z + d / 2 + 2, w + 6, 0.3, 3.2);

          // Authentic Nigerian Commercial Signage Banner across facade
          pushBox(lod0BuildingGeos.signage, pt.x, by + 4.6, pt.z + d / 2 + 1.15, w - 2, 2.4, 0.2);

          // Upper office floors with blue curtain glass
          pushBox(lod0BuildingGeos.stucco, pt.x, by + 4.5, pt.z, w, 13.5, d);
          pushBox(lod0BuildingGeos.glassBlue, pt.x, by + 7.5, pt.z + d / 2 + 0.1, w - 4, 9.5, 0.2);

          // Rhythmic exterior wall-mounted AC condenser units
          for (let fl = 0; fl < 3; fl++) {
            pushBox(lod0BuildingGeos.ac, pt.x - w / 3, by + 6.0 + fl * 4.0, pt.z + d / 2 + 0.3, 1.2, 0.8, 0.4);
            pushBox(lod0BuildingGeos.ac, pt.x + w / 3, by + 6.0 + fl * 4.0, pt.z + d / 2 + 0.3, 1.2, 0.8, 0.4);
          }

          // Rooftop mechanical plant & Storex water tank tower
          pushBox(lod0BuildingGeos.concrete, pt.x, by + 18.0, pt.z, w * 0.45, 3.2, d * 0.45);
          pushWaterTankTower(lod0BuildingGeos as any, pt.x + w * 0.32, by + 18.0, pt.z, 2.8, 1.0, 1.8);

          // Back service alley with heavy silent generator house
          pushGeneratorHouse(lod0BuildingGeos as any, pt.x, by, pt.z - d / 2 - 3.5);

          // Customer parking apron with interlocking pavers
          pushBox(lod0BuildingGeos.paver, pt.x, by + 0.04, pt.z + d / 2 + 7, w + 6, 0.08, 10);
          pushBox(lod0BuildingGeos.granite, pt.x, by + 0.1, pt.z + d / 2 + 12, w + 4, 0.2, 0.3);

          pushBox(lod1BuildingGeos, pt.x, by, pt.z, w + 4, h + 2, d + 4);
          colliders.push({ x: pt.x, z: pt.z, halfX: (w + 4) * 0.5, halfZ: (d + 2) * 0.5, height: h + 2 });

        } else if (archetype === 1) {
          // Archetype 1: Corporate Banking & Financial Tower (First Abuja Bank / Zenith)
          const towerH = 34 + rnd() * 8;
          // Grand double-height banking hall podium
          pushBox(lod0BuildingGeos.marble, pt.x, by, pt.z, w + 6, 6.0, d + 4);
          pushBox(lod0BuildingGeos.shopfront, pt.x, by + 0.2, pt.z + d / 2 + 2.1, w, 4.8, 0.2);
          pushBox(lod0BuildingGeos.signage, pt.x, by + 5.2, pt.z + d / 2 + 2.15, w * 0.8, 1.8, 0.2);

          // Tower curtain glass body
          pushBox(lod0BuildingGeos.glassGreen, pt.x, by + 6.0, pt.z, w, towerH, d);

          // Vertical bronze mullion fins (Brise-Soleil)
          pushBox(lod0BuildingGeos.bronze, pt.x - w / 2, by + 6.0, pt.z, 0.6, towerH, d + 0.2);
          pushBox(lod0BuildingGeos.bronze, pt.x + w / 2, by + 6.0, pt.z, 0.6, towerH, d + 0.2);

          // Rooftop communications mast & water tank
          pushCylinder(lod0BuildingGeos.bronze, pt.x, by + 6.0 + towerH, pt.z, 0.2, 0.4, 6.0);
          pushWaterTankTower(lod0BuildingGeos as any, pt.x - w * 0.3, by + 6.0 + towerH, pt.z, 2.5, 1.2, 2.0);

          // Service yard generator
          pushGeneratorHouse(lod0BuildingGeos as any, pt.x - w / 2 - 3, by, pt.z);

          // Front drop-off driveway
          pushBox(lod0BuildingGeos.paver, pt.x, by + 0.04, pt.z + d / 2 + 7, w + 8, 0.08, 10);

          pushBox(lod1BuildingGeos, pt.x, by, pt.z, w + 6, towerH + 6, d + 6);
          colliders.push({ x: pt.x, z: pt.z, halfX: (w + 6) * 0.5, halfZ: (d + 4) * 0.5, height: towerH + 6 });

        } else {
          // Archetype 2: Mixed-Use Retail & Dining Arcade (Suya Spot & Plaza)
          const h = 12;
          pushBox(lod0BuildingGeos.stone, pt.x, by, pt.z, w + 2, 4.2, d);
          pushBox(lod0BuildingGeos.bronze, pt.x, by + 3.8, pt.z + d / 2 + 2, w + 4, 0.3, 3.6);
          pushBox(lod0BuildingGeos.signage, pt.x, by + 4.2, pt.z + d / 2 + 0.2, w * 0.75, 1.8, 0.2);

          // Upper floors
          pushBox(lod0BuildingGeos.stucco, pt.x, by + 4.2, pt.z, w, 7.8, d);
          pushBox(lod0BuildingGeos.glassBlue, pt.x, by + 5.5, pt.z + d / 2 + 0.1, w - 2, 2.0, 0.2);
          pushBox(lod0BuildingGeos.glassBlue, pt.x, by + 9.0, pt.z + d / 2 + 0.1, w - 2, 2.0, 0.2);

          // External access staircase
          pushBox(lod0BuildingGeos.granite, pt.x + w / 2 + 1.5, by, pt.z, 3.0, 8.5, 2.5);

          // Split AC units
          pushBox(lod0BuildingGeos.ac, pt.x - w / 4, by + 5.0, pt.z + d / 2 + 0.3, 1.0, 0.8, 0.3);
          pushBox(lod0BuildingGeos.ac, pt.x + w / 4, by + 5.0, pt.z + d / 2 + 0.3, 1.0, 0.8, 0.3);

          // Rooftop water tank
          pushWaterTankTower(lod0BuildingGeos as any, pt.x, by + 12.0, pt.z, 2.5, 1.1, 1.9);

          pushBox(lod1BuildingGeos, pt.x, by, pt.z, w + 4, h + 2, d + 4);
          colliders.push({ x: pt.x, z: pt.z, halfX: (w + 4) * 0.5, halfZ: (d + 2) * 0.5, height: h + 2 });
        }
      });

    } else if (districtType === "garki_administrative") {
      // -------------------------------------------------------------
      // GARKI: Federal Ministry Secretariats & Civil Service Housing
      // -------------------------------------------------------------
      const plots = [
        { x: minX + 50, z: minZ + 50, ministry: true },
        { x: minX + 175, z: minZ + 50, ministry: false },
        { x: minX + 50, z: minZ + 175, ministry: false },
        { x: minX + 175, z: minZ + 175, ministry: true },
      ];

      plots.forEach((pt) => {
        const by = getAbujaElevation(pt.x, pt.z);
        if (pt.ministry) {
          // Monumental Federal Ministry Secretariat Complex
          const w = 48;
          const d = 34;
          const h = 24;

          // Charcoal granite base plinth
          pushBox(lod0BuildingGeos.granite, pt.x, by, pt.z, w + 4, 3.5, d + 4);

          // Main administrative edifice in cream marble
          pushBox(lod0BuildingGeos.marble, pt.x, by + 3.5, pt.z, w, 20.5, d);

          // Rhythmic recessed vertical solar window bays with bronze fins
          for (let wx = -18; wx <= 18; wx += 6) {
            pushBox(lod0BuildingGeos.glassBlue, pt.x + wx, by + 5.0, pt.z + d / 2 + 0.1, 3.5, 16, 0.2);
            pushBox(lod0BuildingGeos.bronze, pt.x + wx, by + 5.0, pt.z + d / 2 + 0.3, 0.4, 16, 0.4);
          }

          // Grand entrance portico
          pushBox(lod0BuildingGeos.marble, pt.x, by, pt.z + d / 2 + 2, 14, 8.0, 4.5);

          // Federal Ministry Official Signage Banner
          pushBox(lod0BuildingGeos.signage, pt.x, by + 8.2, pt.z + d / 2 + 4.3, 12, 2.0, 0.2);

          // Rooftop mechanical plant, Storex water tank & flagpoles
          pushBox(lod0BuildingGeos.concrete, pt.x, by + 24.0, pt.z, 18, 3.0, 14);
          pushWaterTankTower(lod0BuildingGeos as any, pt.x + 6, by + 24.0, pt.z, 2.5, 1.2, 2.0);
          pushCylinder(lod0BuildingGeos.bronze, pt.x - 4, by + 24.0, pt.z, 0.1, 0.1, 6.0);
          pushCylinder(lod0BuildingGeos.bronze, pt.x + 4, by + 24.0, pt.z, 0.1, 0.1, 6.0);

          // Heavy industrial silent generator
          pushGeneratorHouse(lod0BuildingGeos as any, pt.x - w / 2 - 3.5, by, pt.z);

          // Paved parking apron
          pushBox(lod0BuildingGeos.paver, pt.x, by + 0.04, pt.z + d / 2 + 9, w + 10, 0.08, 12);

          pushBox(lod1BuildingGeos, pt.x, by, pt.z, w + 4, h + 2, d + 4);
          colliders.push({ x: pt.x, z: pt.z, halfX: (w + 4) * 0.5, halfZ: (d + 4) * 0.5, height: h + 2 });

        } else {
          // Garki Civil Service Housing Terraces (Authentic FHA Residential Blocks)
          for (let e = -1; e <= 1; e += 2) {
            const ex = pt.x + e * 18;
            const ew = 26;
            const ed = 16;
            const eh = 11;

            // Sandcrete stucco body
            pushBox(lod0BuildingGeos.sandcrete, ex, by, pt.z, ew, eh, ed);

            // Cantilevered residential balconies with bronze railings
            pushBox(lod0BuildingGeos.bronze, ex, by + 3.8, pt.z + ed / 2 + 0.8, ew - 4, 1.0, 1.6);
            pushBox(lod0BuildingGeos.bronze, ex, by + 7.4, pt.z + ed / 2 + 0.8, ew - 4, 1.0, 1.6);

            // Windows
            pushBox(lod0BuildingGeos.glassBlue, ex - 6, by + 4.2, pt.z + ed / 2 + 0.1, 2.4, 2.2, 0.2);
            pushBox(lod0BuildingGeos.glassBlue, ex + 6, by + 4.2, pt.z + ed / 2 + 0.1, 2.4, 2.2, 0.2);
            pushBox(lod0BuildingGeos.glassBlue, ex - 6, by + 7.8, pt.z + ed / 2 + 0.1, 2.4, 2.2, 0.2);
            pushBox(lod0BuildingGeos.glassBlue, ex + 6, by + 7.8, pt.z + ed / 2 + 0.1, 2.4, 2.2, 0.2);

            // Corrugated zinc utility roof
            pushBox(lod0BuildingGeos.corrugatedRoof, ex, by + eh, pt.z, ew + 1.5, 2.2, ed + 1.5);

            // Rooftop Storex water tank tower
            pushWaterTankTower(lod0BuildingGeos as any, ex, by + eh + 2.2, pt.z, 2.5, 1.0, 1.8);

            // Split AC condenser units on each flat
            pushBox(lod0BuildingGeos.ac, ex - 6, by + 2.5, pt.z + ed / 2 + 0.2, 0.8, 0.7, 0.3);
            pushBox(lod0BuildingGeos.ac, ex + 6, by + 2.5, pt.z + ed / 2 + 0.2, 0.8, 0.7, 0.3);
            pushBox(lod0BuildingGeos.ac, ex - 6, by + 6.5, pt.z + ed / 2 + 0.2, 0.8, 0.7, 0.3);
            pushBox(lod0BuildingGeos.ac, ex + 6, by + 6.5, pt.z + ed / 2 + 0.2, 0.8, 0.7, 0.3);

            // Ground level backup generator
            pushGeneratorHouse(lod0BuildingGeos as any, ex + ew / 2 + 2.5, by, pt.z);

            pushBox(lod1BuildingGeos, ex, by, pt.z, ew + 2, eh + 2, ed + 2);
            colliders.push({ x: ex, z: pt.z, halfX: (ew + 2) * 0.5, halfZ: (ed + 2) * 0.5, height: eh + 2 });
          }
        }
      });

    } else if (districtType === "asokoro_hillside") {
      // -------------------------------------------------------------
      // ASOKORO: Serpentine Hillside Gated Mansions & Granite Outcrops
      // -------------------------------------------------------------
      const plots = [
        { x: minX + 60, z: minZ + 60 },
        { x: minX + 170, z: minZ + 170 },
      ];

      plots.forEach((pt) => {
        const by = getAbujaElevation(pt.x, pt.z);
        const w = 38;
        const d = 28;
        const h = 14;

        // Stepped charcoal granite retaining plinths on hillside
        pushBox(lod0BuildingGeos.granite, pt.x, by, pt.z, w + 14, 3.0, d + 12);

        // Ground floor with stacked ledger stone
        pushBox(lod0BuildingGeos.stone, pt.x, by + 3.0, pt.z, w, 4.5, d);

        // Cantilevered first floor panoramic glass lounge
        pushBox(lod0BuildingGeos.glassBlue, pt.x - 2, by + 7.5, pt.z + 1, w - 4, 4.2, d + 2);

        // Infinity balcony terrace with bronze railings
        pushBox(lod0BuildingGeos.bronze, pt.x - 2, by + 7.5, pt.z + d / 2 + 2, w - 2, 1.1, 1.2);
        pushBox(lod0BuildingGeos.bronze, pt.x - 2, by + 11.7, pt.z + 1, w, 0.4, d + 2.5);

        // Split AC units
        pushBox(lod0BuildingGeos.ac, pt.x + w / 2 - 2, by + 4.5, pt.z, 0.5, 0.8, 1.2);
        pushBox(lod0BuildingGeos.ac, pt.x + w / 2 - 2, by + 8.5, pt.z, 0.5, 0.8, 1.2);

        // Elevated Storex water tank & generator
        pushWaterTankTower(lod0BuildingGeos as any, pt.x - w / 2 - 2, by + 3.0, pt.z - 4, 3.8, 1.2, 2.2);
        pushGeneratorHouse(lod0BuildingGeos as any, pt.x - w / 2 - 2, by + 3.0, pt.z + 4);

        // Security perimeter wall, razor wire & gate
        pushBox(lod0BuildingGeos.stucco, pt.x, by + 3.0, pt.z + d / 2 + 5, w + 14, 3.2, 0.4);
        pushRazorWireFence(lod0BuildingGeos, pt.x - (w + 14) / 2, by + 6.2, pt.z + d / 2 + 5, pt.x + (w + 14) / 2, pt.z + d / 2 + 5);
        pushBox(lod0BuildingGeos.gate, pt.x, by + 3.0, pt.z + d / 2 + 5, 5.5, 2.8, 0.15);

        pushBox(lod1BuildingGeos, pt.x, by, pt.z, w + 14, h + 4, d + 12);
        colliders.push({ x: pt.x, z: pt.z, halfX: (w + 14) * 0.5, halfZ: (d + 12) * 0.5, height: h + 4 });
      });

    } else if (districtType === "aso_rock_ranges") {
      // -------------------------------------------------------------
      // NORTH: Aso Rock Geological Ranges & Undulating Outcrops
      // -------------------------------------------------------------
      const ridges = [
        { x: minX + 70, z: minZ + 80, rad: 55, h: 42 },
        { x: minX + 180, z: minZ + 160, rad: 70, h: 52 },
      ];

      ridges.forEach((rg) => {
        const by = getAbujaElevation(rg.x, rg.z);
        pushCylinder(lod0BuildingGeos.granite, rg.x, by, rg.z, rg.rad * 0.35, rg.rad * 0.9, rg.h, 16);
        pushBox(lod1BuildingGeos, rg.x, by, rg.z, rg.rad * 1.6, rg.h, rg.rad * 1.6);
        colliders.push({ x: rg.x, z: rg.z, halfX: rg.rad * 0.8, halfZ: rg.rad * 0.8, height: rg.h });
      });

    } else {
      // -------------------------------------------------------------
      // HIGHWAY OUTSKIRTS: Transit Corridors, Filling Stations & Depots
      // -------------------------------------------------------------
      const dw = 32;
      const dd = 24;
      const dh = 9;
      const dx = minX + 110;
      const dz = minZ + 110;
      const by = getAbujaElevation(dx, dz);

      pushBox(lod0BuildingGeos.sandcrete, dx, by, dz, dw, dh, dd);
      pushBox(lod0BuildingGeos.corrugatedRoof, dx, by + dh, dz, dw + 2, 2.0, dd + 2);
      pushWaterTankTower(lod0BuildingGeos as any, dx - dw / 2 - 3, by, dz, 3.5, 1.0, 1.8);
      pushGeneratorHouse(lod0BuildingGeos as any, dx + dw / 2 + 3, by, dz);

      pushBox(lod1BuildingGeos, dx, by, dz, dw, dh, dd);
      colliders.push({ x: dx, z: dz, halfX: dw * 0.5, halfZ: dd * 0.5, height: dh });
    }
  }

  // The four 256m central chunks hold the principal civic landmarks, but also
  // cover large areas between them. Add a small amount of setback office and
  // mixed-use infill there so the CBD does not read as isolated monuments on
  // empty ground. Candidate sites avoid the arterial grid and named landmarks.
  if (isCentralCore) {
    const candidates = [32, 128, 224].flatMap((ox) =>
      [32, 128, 224].map((oz) => ({ x: minX + ox, z: minZ + oz })),
    );
    const landmarkKeepouts = [
      { x: 0, z: -105, r: 58 }, // National Assembly
      { x: 48, z: -42, r: 48 }, // National Mosque
      { x: 48, z: 42, r: 48 }, // National Christian Centre
      { x: 90, z: -35, r: 44 }, // CBN tower
      { x: 90, z: 40, r: 50 }, // NNPC towers
      { x: 0, z: 50, r: 56 }, // Millennium Park
      { x: -55, z: 88, r: 48 }, // Wuse mall
      { x: -55, z: 140, r: 44 }, // Hotel
      { x: 35, z: 120, r: 38 }, // NNPC station
      { x: 90, z: 120, r: 38 }, // Airport terminal
    ];

    candidates.forEach((pt, index) => {
      const w = 30 + rnd() * 10;
      const d = 24 + rnd() * 8;
      const halfW = w * 0.5;
      const halfD = d * 0.5;
      const by = getAbujaElevation(pt.x, pt.z);
      const nearRoad =
        Math.abs(pt.x) < halfW + 18 ||
        Math.abs(pt.z) < halfD + 18 ||
        Math.abs(pt.x - 90) < halfW + 16 ||
        Math.abs(pt.x + 90) < halfW + 16 ||
        Math.abs(pt.z - 90) < halfD + 16 ||
        Math.abs(pt.z + 90) < halfD + 16 ||
        Math.abs(pt.x - (minX + 64)) < halfW + 8 ||
        Math.abs(pt.z - (minZ + 64)) < halfD + 8;
      const nearLandmark = landmarkKeepouts.some(
        (landmark) => Math.hypot(pt.x - landmark.x, pt.z - landmark.z) < landmark.r + Math.max(halfW, halfD),
      );
      if (nearRoad || nearLandmark || by > 14) return;

      const archetype = (Math.abs(cx + cz) + index) % 3;
      const floorCount = archetype === 1 ? 7 : archetype === 2 ? 4 : 5;
      const floorHeight = archetype === 2 ? 3.2 : 3.6;
      const towerHeight = floorCount * floorHeight;
      const bodyKey = archetype === 1 ? "glassGreen" : archetype === 2 ? "sandcrete" : "stucco";

      // Grounded stone plinth, recessed retail/entry frontage, and upper mass.
      pushBox(lod0BuildingGeos.granite, pt.x, by, pt.z, w + 5, 1.2, d + 5);
      pushBox(lod0BuildingGeos[bodyKey], pt.x, by + 1.2, pt.z, w, towerHeight, d);
      if (archetype === 2) {
        pushBox(lod0BuildingGeos.shopfront, pt.x, by + 0.3, pt.z + halfD + 0.12, w - 5, 2.7, 0.16);
        pushBox(lod0BuildingGeos.signage, pt.x, by + 3.05, pt.z + halfD + 0.16, w - 8, 1.25, 0.16);
      } else {
        pushBox(lod0BuildingGeos.marble, pt.x, by + 0.25, pt.z + halfD + 0.12, w - 8, 3.0, 0.16);
        pushBox(lod0BuildingGeos.glassBlue, pt.x, by + 0.55, pt.z + halfD + 0.22, w - 10, 2.3, 0.12);
      }

      // Repeated window bays are grouped into the district's material batches.
      const windowRows = archetype === 2 ? 3 : floorCount - 1;
      for (let row = 0; row < windowRows; row++) {
        const floorY = by + 4.2 + row * floorHeight;
        for (let col = -2; col <= 2; col++) {
          if (archetype === 1) {
            pushBox(lod0BuildingGeos.bronze, pt.x + col * 5.2, floorY, pt.z + halfD + 0.14, 0.22, floorHeight - 0.5, 0.28);
          } else {
            pushBox(lod0BuildingGeos.glassBlue, pt.x + col * 5.2, floorY, pt.z + halfD + 0.13, 2.8, 2.2, 0.16);
            pushBox(lod0BuildingGeos.bronze, pt.x + col * 5.2, floorY - 0.12, pt.z + halfD + 0.22, 3.1, 0.12, 0.28);
          }
        }
      }

      // A shaded entry canopy and a stepped roof plant make the skyline vary.
      pushBox(lod0BuildingGeos.bronze, pt.x, by + 4.0, pt.z + halfD + 1.1, 12, 0.28, 2.2);
      pushBox(lod0BuildingGeos.concrete, pt.x, by + 1.2 + towerHeight, pt.z, w * 0.52, 2.4, d * 0.5);
      pushBox(lod0BuildingGeos.granite, pt.x, by + 3.6 + towerHeight, pt.z, w * 0.56, 0.3, d * 0.54);
      pushBox(lod0BuildingGeos.paver, pt.x, by + 0.04, pt.z + halfD + 7, w + 8, 0.08, 9);

      pushBox(lod1BuildingGeos, pt.x, by, pt.z, w + 5, towerHeight + 4, d + 5);
      colliders.push({ x: pt.x, z: pt.z, halfX: halfW + 2.5, halfZ: halfD + 2.5, height: towerHeight + 4 });
    });
  }

  const lod1WindowMatrices = buildLod1WindowMatrices(lod1BuildingGeos);

  // -------------------------------------------------------------
  // 3. MERGE BATCHED BUILDING GEOMETRIES INTO LOW DRAW CALL MESHES
  // -------------------------------------------------------------
  const materialMap: { [key: string]: THREE.Material } = {
    stucco: abujaPbrMaterials.stuccoWhite,
    sandcrete: abujaPbrMaterials.sandcreteWarm,
    stone: abujaPbrMaterials.ledgerStoneMaitama,
    glassBlue: abujaPbrMaterials.glassCurtainBlue,
    glassGreen: abujaPbrMaterials.glassCurtainGreen,
    signage: abujaPbrMaterials.signageAtlas,
    shopfront: abujaPbrMaterials.shopfrontDisplay,
    ac: abujaPbrMaterials.acCondenser,
    roof: abujaPbrMaterials.terracottaRoof,
    corrugatedRoof: abujaPbrMaterials.corrugatedZincRoof,
    waterTank: abujaPbrMaterials.waterTankStorex,
    generator: abujaPbrMaterials.generatorEnclosure,
    steelTower: abujaPbrMaterials.steelTowerGray,
    razorWire: abujaPbrMaterials.razorWireSilver,
    marble: abujaPbrMaterials.marbleCream,
    granite: abujaPbrMaterials.graniteCharcoal,
    bronze: abujaPbrMaterials.bronzeSunshade,
    gate: abujaPbrMaterials.compoundGateBlack,
    paver: abujaPbrMaterials.paverInterlocking,
    concrete: materials.concrete,
  };

  for (const key of Object.keys(lod0BuildingGeos)) {
    const geos = lod0BuildingGeos[key];
    if (geos.length > 0) {
      const merged = safeMergeGeometries(geos);
      for (const g of geos) g.dispose();
      const mesh = new THREE.Mesh(merged, materialMap[key]);
      mesh.castShadow = false; // Preserves shadow map fill rate and eliminates shadow draw calls
      mesh.receiveShadow = true;
      mesh.name = `${id}_Bld_${key}`;
      mesh.userData.noMerge = true;
      lod0Group.add(mesh);
    }
  }

  if (lod1BuildingGeos.length > 0) {
    const mergedLOD1 = safeMergeGeometries(lod1BuildingGeos);
    for (const g of lod1BuildingGeos) g.dispose();
    const lod1Mesh = new THREE.Mesh(mergedLOD1, materials.concrete);
    lod1Mesh.receiveShadow = false;
    lod1Mesh.castShadow = false;
    lod1Mesh.name = `${id}_LOD1_Shell`;
    lod1Mesh.userData.noMerge = true;
    lod1Group.add(lod1Mesh);

    if (lod1WindowMatrices.length > 0) {
      const windowMesh = new THREE.InstancedMesh(
        lod1WindowGeometry,
        abujaPbrMaterials.glassCurtainBlue,
        lod1WindowMatrices.length,
      );
      lod1WindowMatrices.forEach((matrix, index) => windowMesh.setMatrixAt(index, matrix));
      windowMesh.instanceMatrix.needsUpdate = true;
      windowMesh.computeBoundingSphere();
      windowMesh.name = `${id}_LOD1_FacadeWindows`;
      windowMesh.castShadow = false;
      windowMesh.receiveShadow = false;
      windowMesh.userData.noMerge = true;
      lod1Group.add(windowMesh);
    }
  }

  return {
    id,
    cx,
    cz,
    minX,
    maxX,
    minZ,
    maxZ,
    center: new THREE.Vector3(centerX, 0, centerZ),
    districtType,
    districtName,
    group,
    lod0Group,
    lod1Group,
    colliders,
    currentLod: 0,
    isVisible: true,
  };
}
