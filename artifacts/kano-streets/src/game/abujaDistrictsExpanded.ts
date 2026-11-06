import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Collider, GameMaterials } from "./types";
import { sharedMaterials } from "./abujaDistrict";
import { getAbujaElevation } from "./abujaLandscape";
import type { StreamingChunk, DistrictType } from "./abujaStreaming";

function safeMergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared);
  if (!merged) {
    throw new Error("safeMergeGeometries failed to merge district geometries");
  }
  return merged;
}

// -------------------------------------------------------------
// PBR TEXTURES & SHARED MATERIALS FOR EXPANDED DISTRICTS
// -------------------------------------------------------------
function buildCommercialFacadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#2c3e50"; // Tinted curtain glass background
  ctx.fillRect(0, 0, 256, 256);

  // Window grid with architectural mullions
  ctx.fillStyle = "#1a252f";
  ctx.strokeStyle = "#7f8c8d";
  ctx.lineWidth = 3;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = c * 32 + 3;
      const y = r * 32 + 3;
      // Glass pane reflection gradient
      const grad = ctx.createLinearGradient(x, y, x + 26, y + 26);
      grad.addColorStop(0, "#34495e");
      grad.addColorStop(0.5, "#5d6d7e");
      grad.addColorStop(1, "#2c3e50");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, 26, 26);
      ctx.strokeRect(x, y, 26, 26);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

function buildResidentialVillaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ecf0f1"; // Warm Nigerian stucco plaster
  ctx.fillRect(0, 0, 256, 256);

  // Modern louvered windows and balcony balustrades
  ctx.fillStyle = "#2c3e50";
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = c * 64 + 12;
      const y = r * 64 + 14;
      ctx.fillRect(x, y, 40, 36);
      // Horizontal louvers
      ctx.strokeStyle = "#bdc3c7";
      ctx.lineWidth = 1.5;
      for (let ly = y + 4; ly < y + 36; ly += 6) {
        ctx.beginPath();
        ctx.moveTo(x, ly);
        ctx.lineTo(x + 40, ly);
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

const commercialGlassMat = new THREE.MeshStandardMaterial({
  map: buildCommercialFacadeTexture(),
  roughness: 0.25,
  metalness: 0.7,
});

const residentialVillaMat = new THREE.MeshStandardMaterial({
  map: buildResidentialVillaTexture(),
  roughness: 0.82,
  metalness: 0.05,
});

const ministryGraniteMat = new THREE.MeshStandardMaterial({
  color: "#95a5a6",
  roughness: 0.75,
  metalness: 0.15,
});

const terracottaRoofMat = new THREE.MeshStandardMaterial({
  color: "#b03a2e",
  roughness: 0.85,
});

const roadAsphaltMat = new THREE.MeshStandardMaterial({
  color: "#272a2e",
  roughness: 0.82,
});

const sidewalkPavingMat = new THREE.MeshStandardMaterial({
  color: "#bdc3c7",
  roughness: 0.70,
});

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
  // 1. LOCAL CONNECTED ROADS & SIDEWALKS FOR THIS CHUNK
  // -------------------------------------------------------------
  const roadGeos: THREE.BufferGeometry[] = [];
  const sidewalkGeos: THREE.BufferGeometry[] = [];

  // Determine if major avenues pass through this chunk
  // Primary N-S Arterials (x = 0, x = -450, x = 450)
  [-450, 0, 450].forEach((rx) => {
    if (rx >= minX - 14 && rx <= maxX + 14) {
      const road = new THREE.PlaneGeometry(24, chunkSize);
      road.rotateX(-Math.PI / 2);
      road.translate(rx, 0.015, centerZ);
      roadGeos.push(road);

      // Flanking sidewalks
      for (const sx of [-15, 15]) {
        const sw = new THREE.BoxGeometry(3.2, 0.14, chunkSize);
        sw.translate(rx + sx, 0.07, centerZ);
        sidewalkGeos.push(sw);
      }
    }
  });

  // Primary E-W Arterials (z = 0, z = -450, z = 450)
  [-450, 0, 450].forEach((rz) => {
    if (rz >= minZ - 12 && rz <= maxZ + 12) {
      const road = new THREE.PlaneGeometry(chunkSize, 22);
      road.rotateX(-Math.PI / 2);
      road.translate(centerX, 0.015, rz);
      roadGeos.push(road);

      // Flanking sidewalks
      for (const sz of [-14, 14]) {
        const sw = new THREE.BoxGeometry(chunkSize, 0.14, 3.2);
        sw.translate(centerX, 0.07, rz + sz);
        sidewalkGeos.push(sw);
      }
    }
  });

  // Secondary grid connection streets through district sectors
  const localStreetX = minX + 64;
  const localStreetZ = minZ + 64;
  const localRoad1 = new THREE.PlaneGeometry(14, chunkSize);
  localRoad1.rotateX(-Math.PI / 2);
  localRoad1.translate(localStreetX, 0.015, centerZ);
  roadGeos.push(localRoad1);

  const localRoad2 = new THREE.PlaneGeometry(chunkSize, 14);
  localRoad2.rotateX(-Math.PI / 2);
  localRoad2.translate(centerX, 0.015, localStreetZ);
  roadGeos.push(localRoad2);

  if (roadGeos.length > 0) {
    const mergedRoads = safeMergeGeometries(roadGeos);
    for (const g of roadGeos) g.dispose();
    const roadMesh = new THREE.Mesh(mergedRoads, roadAsphaltMat);
    roadMesh.receiveShadow = true;
    roadMesh.name = `${id}_Roads`;
    roadMesh.userData.noMerge = true;
    lod0Group.add(roadMesh);

    // Also include in LOD 1
    const roadLOD1 = roadMesh.clone();
    roadLOD1.userData.noMerge = true;
    lod1Group.add(roadLOD1);
  }

  if (sidewalkGeos.length > 0) {
    const mergedSidewalks = safeMergeGeometries(sidewalkGeos);
    for (const g of sidewalkGeos) g.dispose();
    const swMesh = new THREE.Mesh(mergedSidewalks, sidewalkPavingMat);
    swMesh.receiveShadow = true;
    swMesh.name = `${id}_Sidewalks`;
    swMesh.userData.noMerge = true;
    lod0Group.add(swMesh);
  }

  // -------------------------------------------------------------
  // 2. DISTRICT-SPECIFIC ARCHITECTURAL BUILDINGS
  // -------------------------------------------------------------
  const lod0BuildingGeos: { [mat: string]: THREE.BufferGeometry[] } = {
    commercial: [],
    residential: [],
    ministry: [],
    roof: [],
    concrete: [],
  };
  const lod1BuildingGeos: THREE.BufferGeometry[] = [];

  // Seeded deterministic PRNG for procedural building layout
  let seed = Math.abs(cx * 73856093 ^ cz * 19349663);
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Skip buildings in central core chunks (preserved foundations from existing world)
  const isCentralCore = (cx === -1 || cx === 0) && (cz === -1 || cz === 0);

  if (!isCentralCore) {
    if (districtType === "maitama_luxury") {
      // -------------------------------------------------------------
      // MAITAMA: Luxury Gated Diplomatic Duplex Villas & Embasies
      // -------------------------------------------------------------
      const plots = [
        { x: minX + 45, z: minZ + 45 },
        { x: minX + 185, z: minZ + 45 },
        { x: minX + 45, z: minZ + 185 },
        { x: minX + 185, z: minZ + 185 },
      ];

      plots.forEach((pt) => {
        const by = getAbujaElevation(pt.x, pt.z);
        const w = 32 + rnd() * 12;
        const d = 26 + rnd() * 10;
        const h = 12 + rnd() * 6; // 2-3 Storey luxury mansion

        // Perimeter compound wall with security coping
        const wallH = 3.2;
        const wallBoxL = new THREE.BoxGeometry(w + 12, wallH, 0.4);
        wallBoxL.translate(pt.x, by + wallH / 2, pt.z - d / 2 - 6);
        lod0BuildingGeos.concrete.push(wallBoxL);

        const wallBoxR = new THREE.BoxGeometry(w + 12, wallH, 0.4);
        wallBoxR.translate(pt.x, by + wallH / 2, pt.z + d / 2 + 6);
        lod0BuildingGeos.concrete.push(wallBoxR);

        // Main Villa Body
        const villaBody = new THREE.BoxGeometry(w, h, d);
        villaBody.translate(pt.x, by + h / 2, pt.z);
        lod0BuildingGeos.residential.push(villaBody);

        // Terracotta pitched roof
        const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.72, 4.2, 4);
        roof.rotateY(Math.PI / 4);
        roof.translate(pt.x, by + h + 2.1, pt.z);
        lod0BuildingGeos.roof.push(roof);

        // LOD 1 Simplified Box
        const lod1Box = new THREE.BoxGeometry(w, h + 3, d);
        lod1Box.translate(pt.x, by + (h + 3) / 2, pt.z);
        lod1BuildingGeos.push(lod1Box);

        colliders.push({
          x: pt.x,
          z: pt.z,
          halfX: w * 0.5 + 2,
          halfZ: d * 0.5 + 2,
          height: h + 4,
        });
      });

    } else if (districtType === "wuse_commercial") {
      // -------------------------------------------------------------
      // WUSE 2: Multi-Story Commercial Plazas, Hotels & Banking Towers
      // -------------------------------------------------------------
      const plots = [
        { x: minX + 48, z: minZ + 48, h: 28 },
        { x: minX + 175, z: minZ + 48, h: 36 },
        { x: minX + 48, z: minZ + 175, h: 42 },
        { x: minX + 175, z: minZ + 175, h: 24 },
      ];

      plots.forEach((pt) => {
        const by = getAbujaElevation(pt.x, pt.z);
        const w = 36 + rnd() * 10;
        const d = 32 + rnd() * 8;
        const h = pt.h + rnd() * 10; // 6-12 Storey commercial towers

        // Podium Ground Floor Retail
        const podiumH = 6;
        const podium = new THREE.BoxGeometry(w + 8, podiumH, d + 6);
        podium.translate(pt.x, by + podiumH / 2, pt.z);
        lod0BuildingGeos.concrete.push(podium);

        // Tower Body (Glass facade)
        const towerH = h - podiumH;
        const tower = new THREE.BoxGeometry(w, towerH, d);
        tower.translate(pt.x, by + podiumH + towerH / 2, pt.z);
        lod0BuildingGeos.commercial.push(tower);

        // Rooftop HVAC Mechanical Plant
        const hvac = new THREE.BoxGeometry(w * 0.5, 3.5, d * 0.4);
        hvac.translate(pt.x, by + h + 1.75, pt.z);
        lod0BuildingGeos.concrete.push(hvac);

        // LOD 1 simplified tower shell
        const lod1Shell = new THREE.BoxGeometry(w + 4, h, d + 4);
        lod1Shell.translate(pt.x, by + h / 2, pt.z);
        lod1BuildingGeos.push(lod1Shell);

        colliders.push({
          x: pt.x,
          z: pt.z,
          halfX: (w + 8) * 0.5,
          halfZ: (d + 6) * 0.5,
          height: h + 2,
        });
      });

    } else if (districtType === "garki_administrative") {
      // -------------------------------------------------------------
      // GARKI: Federal Ministry Edifices & Terraced Housing Estates
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
          // Broad monumental ministry block
          const w = 48;
          const d = 36;
          const h = 20;
          const block = new THREE.BoxGeometry(w, h, d);
          block.translate(pt.x, by + h / 2, pt.z);
          lod0BuildingGeos.ministry.push(block);

          const lod1Block = new THREE.BoxGeometry(w, h, d);
          lod1Block.translate(pt.x, by + h / 2, pt.z);
          lod1BuildingGeos.push(lod1Block);

          colliders.push({ x: pt.x, z: pt.z, halfX: w * 0.5, halfZ: d * 0.5, height: h });
        } else {
          // 4-Block Housing Estate
          for (let e = -1; e <= 1; e += 2) {
            const ew = 28;
            const ed = 18;
            const eh = 10;
            const ex = pt.x + e * 18;
            const estate = new THREE.BoxGeometry(ew, eh, ed);
            estate.translate(ex, by + eh / 2, pt.z);
            lod0BuildingGeos.residential.push(estate);

            const lod1Estate = new THREE.BoxGeometry(ew, eh, ed);
            lod1Estate.translate(ex, by + eh / 2, pt.z);
            lod1BuildingGeos.push(lod1Estate);

            colliders.push({ x: ex, z: pt.z, halfX: ew * 0.5, halfZ: ed * 0.5, height: eh });
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

        const villa = new THREE.BoxGeometry(w, h, d);
        villa.translate(pt.x, by + h / 2, pt.z);
        lod0BuildingGeos.residential.push(villa);

        // Granite hillside terrace podium
        const podium = new THREE.BoxGeometry(w + 14, 2.5, d + 12);
        podium.translate(pt.x, by + 1.25, pt.z);
        lod0BuildingGeos.concrete.push(podium);

        const lod1Mansion = new THREE.BoxGeometry(w + 6, h + 2, d + 6);
        lod1Mansion.translate(pt.x, by + (h + 2) / 2, pt.z);
        lod1BuildingGeos.push(lod1Mansion);

        colliders.push({ x: pt.x, z: pt.z, halfX: (w + 14) * 0.5, halfZ: (d + 12) * 0.5, height: h + 2 });
      });

    } else if (districtType === "aso_rock_ranges") {
      // -------------------------------------------------------------
      // NORTHERN RANGES: Granitic Inselberg Outcrops
      // -------------------------------------------------------------
      for (let r = 0; r < 3; r++) {
        const rx = minX + 50 + r * 65;
        const rz = minZ + 60 + (r % 2) * 90;
        const by = getAbujaElevation(rx, rz);
        const rad = 35 + rnd() * 25;
        const rh = 45 + rnd() * 40;

        const mountain = new THREE.DodecahedronGeometry(rad, 1);
        mountain.scale(1.4, rh / rad, 1.2);
        mountain.translate(rx, by + rh * 0.4, rz);
        lod0BuildingGeos.concrete.push(mountain);

        const lod1Mtn = mountain.clone();
        lod1BuildingGeos.push(lod1Mtn);

        colliders.push({ x: rx, z: rz, halfX: rad * 1.2, halfZ: rad * 1.1, height: rh });
      }

    } else {
      // -------------------------------------------------------------
      // HIGHWAY OUTSKIRTS & LOGISTICS DEPOTS
      // -------------------------------------------------------------
      const dw = 45;
      const dd = 30;
      const dh = 10;
      const dx = centerX + 40;
      const dz = centerZ + 40;
      const by = getAbujaElevation(dx, dz);

      const depot = new THREE.BoxGeometry(dw, dh, dd);
      depot.translate(dx, by + dh / 2, dz);
      lod0BuildingGeos.concrete.push(depot);

      const lod1Depot = depot.clone();
      lod1BuildingGeos.push(lod1Depot);

      colliders.push({ x: dx, z: dz, halfX: dw * 0.5, halfZ: dd * 0.5, height: dh });
    }
  }

  // -------------------------------------------------------------
  // 3. MERGE BATCHED BUILDING GEOMETRIES INTO SINGLE DRAW CALLS
  // -------------------------------------------------------------
  if (lod0BuildingGeos.commercial.length > 0) {
    const merged = safeMergeGeometries(lod0BuildingGeos.commercial);
    for (const g of lod0BuildingGeos.commercial) g.dispose();
    const mesh = new THREE.Mesh(merged, commercialGlassMat);
    mesh.castShadow = false; // Preserves integrated GPU shadow fill rate
    mesh.receiveShadow = true;
    mesh.name = `${id}_BldCommercial`;
    mesh.userData.noMerge = true;
    lod0Group.add(mesh);
  }

  if (lod0BuildingGeos.residential.length > 0) {
    const merged = safeMergeGeometries(lod0BuildingGeos.residential);
    for (const g of lod0BuildingGeos.residential) g.dispose();
    const mesh = new THREE.Mesh(merged, residentialVillaMat);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `${id}_BldResidential`;
    mesh.userData.noMerge = true;
    lod0Group.add(mesh);
  }

  if (lod0BuildingGeos.ministry.length > 0) {
    const merged = safeMergeGeometries(lod0BuildingGeos.ministry);
    for (const g of lod0BuildingGeos.ministry) g.dispose();
    const mesh = new THREE.Mesh(merged, ministryGraniteMat);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `${id}_BldMinistry`;
    mesh.userData.noMerge = true;
    lod0Group.add(mesh);
  }

  if (lod0BuildingGeos.roof.length > 0) {
    const merged = safeMergeGeometries(lod0BuildingGeos.roof);
    for (const g of lod0BuildingGeos.roof) g.dispose();
    const mesh = new THREE.Mesh(merged, terracottaRoofMat);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `${id}_BldRoofs`;
    mesh.userData.noMerge = true;
    lod0Group.add(mesh);
  }

  if (lod0BuildingGeos.concrete.length > 0) {
    const merged = safeMergeGeometries(lod0BuildingGeos.concrete);
    for (const g of lod0BuildingGeos.concrete) g.dispose();
    const mesh = new THREE.Mesh(merged, materials.concrete);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `${id}_BldConcrete`;
    mesh.userData.noMerge = true;
    lod0Group.add(mesh);
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
