import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { getAbujaElevation } from "./abujaLandscape";

function safeMergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared);
  if (!merged) {
    throw new Error("safeMergeGeometries in abujaVegetation failed to merge geometries");
  }
  return merged;
}

// -------------------------------------------------------------
// PBR MATERIALS FOR ABUJA VEGETATION & FLORA
// -------------------------------------------------------------
const vegetationMaterials = {
  // Royal Palm Trunk: Ringed pale grey-white trunk
  royalPalmTrunk: new THREE.MeshStandardMaterial({
    color: "#cfc7bc",
    roughness: 0.85,
    metalness: 0.05,
  }),
  // Royal Palm Foliage: Rich emerald feathery fronds
  royalPalmCrown: new THREE.MeshStandardMaterial({
    color: "#1e5c2b",
    roughness: 0.65,
    metalness: 0.05,
  }),
  // African Fan Palm Trunk: Textured dark fibrous bark
  fanPalmTrunk: new THREE.MeshStandardMaterial({
    color: "#5c4d3c",
    roughness: 0.90,
  }),
  // African Fan Palm Foliage: Dense fan-shaped circular leaves
  fanPalmCrown: new THREE.MeshStandardMaterial({
    color: "#2a6838",
    roughness: 0.70,
  }),
  // Umbrella Acacia Bark: Twisted savannah acacia trunk
  acaciaBark: new THREE.MeshStandardMaterial({
    color: "#4a3c31",
    roughness: 0.92,
  }),
  // Umbrella Acacia Canopy: Feathery savannah green flat-top foliage
  acaciaFoliage: new THREE.MeshStandardMaterial({
    color: "#4e7339",
    roughness: 0.80,
  }),
  // Flamboyant Flame Tree Trunk: Smooth tropical hardwood bark
  flamboyantTrunk: new THREE.MeshStandardMaterial({
    color: "#5e5247",
    roughness: 0.85,
  }),
  // Flamboyant Canopy: Brilliant scarlet-orange tropical blossoms
  flamboyantCrown: new THREE.MeshStandardMaterial({
    color: "#d33a1e", // Intense Delonix regia flame orange-red
    roughness: 0.75,
  }),
  // Savannah Shrub / Bush Foliage
  shrubFoliage: new THREE.MeshStandardMaterial({
    color: "#2d5a32",
    roughness: 0.85,
  }),
  // Flowering Bougainvillea Shrub Foliage
  flowerShrub: new THREE.MeshStandardMaterial({
    color: "#c0397b", // Vibrant magenta bougainvillea
    roughness: 0.75,
  }),
  // Savannah Granite Boulders
  graniteBoulder: new THREE.MeshStandardMaterial({
    color: "#7a7268",
    roughness: 0.88,
    metalness: 0.1,
    flatShading: true,
  }),
};

// -------------------------------------------------------------
// GEOMETRY GENERATORS FOR SPECIES
// -------------------------------------------------------------

/** Royal Palm (Roystonea regia): Tall slender ringed trunk with feather crown */
function buildRoyalPalmTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Swollen trunk base and midsection
  const base = new THREE.CylinderGeometry(0.34, 0.44, 3, 10);
  base.translate(0, 1.5, 0);
  parts.push(base);

  const mid = new THREE.CylinderGeometry(0.28, 0.34, 5.5, 10);
  mid.translate(0, 5.75, 0);
  parts.push(mid);

  // Bright green crownshaft top
  const crownshaft = new THREE.CylinderGeometry(0.24, 0.28, 2.2, 10);
  crownshaft.translate(0, 9.6, 0);
  parts.push(crownshaft);

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

function buildRoyalPalmCrownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 12 Gracefully arching feather fronds radiating outward
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const droop = 0.28 + (i % 3) * 0.08;
    const frond = new THREE.BoxGeometry(0.45, 0.08, 4.2);
    frond.rotateX(droop);
    frond.rotateY(angle);
    frond.translate(Math.sin(angle) * 1.8, 10.6 - droop * 1.2, Math.cos(angle) * 1.8);
    parts.push(frond);
  }
  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** African Fan Palm (Borassus aethiopum): Stouter trunk with rounded fan fronds */
function buildFanPalmTrunkGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.36, 0.48, 8, 10);
  trunk.translate(0, 4.0, 0);
  return trunk;
}

function buildFanPalmCrownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Dense spherical crown of circular fan fronds
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const fan = new THREE.CylinderGeometry(1.4, 0.2, 0.1, 8);
    fan.rotateZ(Math.PI / 2.8);
    fan.rotateY(angle);
    fan.translate(Math.sin(angle) * 1.4, 8.4, Math.cos(angle) * 1.4);
    parts.push(fan);
  }
  const centerTuft = new THREE.SphereGeometry(1.2, 8, 6);
  centerTuft.scale(1.2, 0.9, 1.2);
  centerTuft.translate(0, 8.8, 0);
  parts.push(centerTuft);

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Umbrella Acacia (Acacia tortilis): Spreading flat-top silhouette */
function buildAcaciaTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Main twisted trunk
  const trunk = new THREE.CylinderGeometry(0.32, 0.46, 5.2, 8);
  trunk.rotateZ(0.08);
  trunk.translate(0, 2.6, 0);
  parts.push(trunk);

  // Spreading branches
  const branchL = new THREE.CylinderGeometry(0.18, 0.26, 3.8, 6);
  branchL.rotateZ(-Math.PI / 3.5);
  branchL.translate(-1.6, 5.2, 0);
  parts.push(branchL);

  const branchR = new THREE.CylinderGeometry(0.18, 0.24, 3.6, 6);
  branchR.rotateZ(Math.PI / 3.8);
  branchR.rotateY(Math.PI / 4);
  branchR.translate(1.4, 5.0, 0.8);
  parts.push(branchR);

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

function buildAcaciaFoliageGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Spreading horizontal umbrella canopies
  const mainCanopy = new THREE.CylinderGeometry(4.8, 3.8, 0.9, 10);
  mainCanopy.translate(0, 6.8, 0);
  parts.push(mainCanopy);

  const topLayer = new THREE.CylinderGeometry(3.2, 4.4, 0.7, 10);
  topLayer.translate(0, 7.4, 0);
  parts.push(topLayer);

  const sideTierL = new THREE.CylinderGeometry(2.6, 2.0, 0.6, 8);
  sideTierL.translate(-2.4, 6.3, 0.4);
  parts.push(sideTierL);

  const sideTierR = new THREE.CylinderGeometry(2.4, 1.8, 0.6, 8);
  sideTierR.translate(2.2, 6.1, -0.6);
  parts.push(sideTierR);

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Flamboyant Tree (Delonix regia): Spreading umbrella crown with scarlet blooms */
function buildFlamboyantTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.35, 0.52, 4.8, 8);
  trunk.translate(0, 2.4, 0);
  parts.push(trunk);

  // 3 Major radial boughs
  for (let b = 0; b < 3; b++) {
    const angle = (b / 3) * Math.PI * 2;
    const bough = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 6);
    bough.rotateZ(Math.PI / 3.6);
    bough.rotateY(angle);
    bough.translate(Math.sin(angle) * 1.5, 4.6, Math.cos(angle) * 1.5);
    parts.push(bough);
  }

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

function buildFlamboyantCrownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Vibrant spreading umbrella mass of scarlet blossoms
  const baseDome = new THREE.CylinderGeometry(5.4, 4.2, 1.2, 12);
  baseDome.translate(0, 6.2, 0);
  parts.push(baseDome);

  const upperDome = new THREE.SphereGeometry(3.6, 10, 6);
  upperDome.scale(1.2, 0.4, 1.2);
  upperDome.translate(0, 6.8, 0);
  parts.push(upperDome);

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Low savannah bush & flowering shrubs */
function buildShrubGeometry(): THREE.BufferGeometry {
  const bush = new THREE.DodecahedronGeometry(1.2, 1);
  bush.scale(1.4, 0.85, 1.2);
  bush.translate(0, 0.8, 0);
  return bush;
}

/** Weathered granite savannah boulder */
function buildBoulderGeometry(): THREE.BufferGeometry {
  const rock = new THREE.DodecahedronGeometry(1.8, 0);
  rock.scale(1.4, 0.9, 1.2);
  rock.translate(0, 0.9, 0);
  return rock;
}

// Pre-create shared geometries once
const geoRoyalPalmTrunk = buildRoyalPalmTrunkGeometry();
const geoRoyalPalmCrown = buildRoyalPalmCrownGeometry();
const geoFanPalmTrunk = buildFanPalmTrunkGeometry();
const geoFanPalmCrown = buildFanPalmCrownGeometry();
const geoAcaciaTrunk = buildAcaciaTrunkGeometry();
const geoAcaciaFoliage = buildAcaciaFoliageGeometry();
const geoFlamboyantTrunk = buildFlamboyantTrunkGeometry();
const geoFlamboyantCrown = buildFlamboyantCrownGeometry();
const geoShrub = buildShrubGeometry();
const geoBoulder = buildBoulderGeometry();

export interface TreeInstanceData {
  x: number;
  z: number;
  scale?: number;
  rotation?: number;
}

/**
 * Builds the comprehensive Abuja Environmental Vegetation System:
 * Instanced Royal Palms, African Fan Palms, Umbrella Acacias, Flamboyant Flame Trees,
 * Savannah Shrubs, Bougainvillea, and Granite Boulders.
 */
export function buildAbujaVegetationSystem(bounds: number): THREE.Group {
  const root = new THREE.Group();
  root.name = "AbujaVegetationSystem";

  const dummy = new THREE.Object3D();

  // Helper to set up an InstancedMesh pair (trunk + crown)
  function createDualInstanced(
    trunkGeo: THREE.BufferGeometry,
    trunkMat: THREE.Material,
    crownGeo: THREE.BufferGeometry,
    crownMat: THREE.Material,
    instances: TreeInstanceData[],
    namePrefix: string,
  ): [THREE.InstancedMesh, THREE.InstancedMesh] | null {
    const count = instances.length;
    if (count === 0) return null;

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, count);
    trunkMesh.name = `${namePrefix}TrunkInstances`;
    crownMesh.name = `${namePrefix}CrownInstances`;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    trunkMesh.userData.noMerge = true;
    crownMesh.userData.noMerge = true;

    for (let i = 0; i < count; i++) {
      const inst = instances[i];
      const y = getAbujaElevation(inst.x, inst.z);
      const s = inst.scale ?? (0.85 + (i % 7) * 0.06);
      const r = inst.rotation ?? ((i * 1.37) % (Math.PI * 2));

      dummy.position.set(inst.x, y, inst.z);
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, r, 0);
      dummy.updateMatrix();

      trunkMesh.setMatrixAt(i, dummy.matrix);
      crownMesh.setMatrixAt(i, dummy.matrix);
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
    return [trunkMesh, crownMesh];
  }

  // Helper for single geometry InstancedMesh
  function createSingleInstanced(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    instances: TreeInstanceData[],
    name: string,
  ): THREE.InstancedMesh | null {
    const count = instances.length;
    if (count === 0) return null;

    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.noMerge = true;

    for (let i = 0; i < count; i++) {
      const inst = instances[i];
      const y = getAbujaElevation(inst.x, inst.z);
      const s = inst.scale ?? (0.8 + (i % 5) * 0.1);
      const r = inst.rotation ?? ((i * 1.57) % (Math.PI * 2));

      dummy.position.set(inst.x, y, inst.z);
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, r, 0);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  // -------------------------------------------------------------
  // PLACEMENT DISTRIBUTION
  // -------------------------------------------------------------
  const royalPalms: TreeInstanceData[] = [];
  const fanPalms: TreeInstanceData[] = [];
  const acacias: TreeInstanceData[] = [];
  const flamboyants: TreeInstanceData[] = [];
  const shrubs: TreeInstanceData[] = [];
  const flowerBushes: TreeInstanceData[] = [];
  const boulders: TreeInstanceData[] = [];

  // 1. Shehu Shagari Way (North-South Arterial) Medians & Sidewalk Verges
  for (let z = -140; z <= 140; z += 18) {
    if (Math.abs(z) < 26) continue; // Skip central roundabout
    // Avenue Royal Palms in central median
    if (z % 36 === 0) {
      royalPalms.push({ x: 0, z, scale: 1.05 });
    }
    // Avenue Flamboyant trees along East/West sidewalk verges
    if (z % 36 === 18) {
      flamboyants.push({ x: -17, z, scale: 0.95 });
      flamboyants.push({ x: 17, z, scale: 0.95 });
    } else {
      royalPalms.push({ x: -17, z, scale: 1.0 });
      royalPalms.push({ x: 17, z, scale: 1.0 });
    }
    // Median Shrubbery & Flowering Bushes
    shrubs.push({ x: -0.6, z: z + 6, scale: 0.7 });
    flowerBushes.push({ x: 0.6, z: z + 12, scale: 0.75 });
  }

  // 2. Constitution Avenue (East-West Arterial) Medians & Verges
  for (let x = -130; x <= 130; x += 20) {
    if (Math.abs(x) < 26) continue;
    if (x % 40 === 0) {
      fanPalms.push({ x, z: 0, scale: 1.0 });
    }
    fanPalms.push({ x, z: -15, scale: 0.95 });
    fanPalms.push({ x, z: 15, scale: 0.95 });

    shrubs.push({ x: x + 8, z: 0, scale: 0.7 });
    flowerBushes.push({ x: x - 8, z: -15.5, scale: 0.65 });
  }

  // 3. Central Monumental Roundabout Perimeter Ring
  for (let a = 0; a < 16; a++) {
    const angle = (a / 16) * Math.PI * 2;
    // Outer landscaping perimeter around roundabout
    const rx = Math.cos(angle) * 26.5;
    const rz = Math.sin(angle) * 26.5;
    if (a % 2 === 0) {
      royalPalms.push({ x: rx, z: rz, scale: 1.1 });
    } else {
      flamboyants.push({ x: rx, z: rz, scale: 0.85 });
    }
    shrubs.push({ x: Math.cos(angle) * 24.5, z: Math.sin(angle) * 24.5, scale: 0.6 });
  }

  // 4. Millennium Park & Recreational Garden Groves (x: 0, z: 50)
  for (let px = -35; px <= 35; px += 14) {
    for (let pz = 22; pz <= 78; pz += 14) {
      if (Math.hypot(px, pz - 50) < 14) continue; // Skip fountain basin
      if (Math.abs(px) < 5 || Math.abs(pz - 50) < 5) continue; // Skip central walkways

      const seed = Math.abs(px * 13 + pz * 17);
      if (seed % 4 === 0) {
        flamboyants.push({ x: px, z: pz, scale: 1.05 + (seed % 3) * 0.1 });
      } else if (seed % 4 === 1) {
        royalPalms.push({ x: px, z: pz, scale: 1.1 });
      } else if (seed % 4 === 2) {
        acacias.push({ x: px, z: pz, scale: 0.95 });
      } else {
        fanPalms.push({ x: px, z: pz, scale: 0.9 });
      }
      shrubs.push({ x: px + 3, z: pz - 2, scale: 0.8 });
      flowerBushes.push({ x: px - 2, z: pz + 3, scale: 0.75 });
    }
  }

  // 5. Three Arms Civic Zone & National Assembly Grounds (x: 0, z: -105)
  for (const ax of [-38, -32, 32, 38]) {
    for (const az of [-125, -115, -95, -85]) {
      royalPalms.push({ x: ax, z: az, scale: 1.0 });
      shrubs.push({ x: ax + (ax > 0 ? 3 : -3), z: az, scale: 0.7 });
    }
  }

  // 6. Maitama Luxury District (Rolling Northwest Hills: x: -110 to -45, z: -110 to -45)
  for (let mx = -130; mx <= -45; mx += 22) {
    for (let mz = -130; mz <= -45; mz += 24) {
      if (Math.abs(mx - (-90)) < 15 || Math.abs(mz - (-90)) < 15) continue; // Road clearance
      if (Math.abs(mx - (-65)) < 26 && Math.abs(mz - (-35)) < 22) continue; // Villa compound
      acacias.push({ x: mx + (mz % 5), z: mz, scale: 1.1 });
      if ((mx + mz) % 3 === 0) {
        flamboyants.push({ x: mx - 6, z: mz + 6, scale: 0.95 });
      }
      boulders.push({ x: mx + 8, z: mz - 8, scale: 1.3 });
      shrubs.push({ x: mx + 4, z: mz + 4, scale: 0.85 });
    }
  }

  // 7. Southern Savannah Parkland & Highway A2 Approaches (z: -160 to -120)
  for (let sx = -90; sx <= 90; sx += 25) {
    if (Math.abs(sx) < 22) continue; // Highway clearance
    acacias.push({ x: sx, z: -145, scale: 1.15 });
    acacias.push({ x: sx + 10, z: -170, scale: 1.25 });
    boulders.push({ x: sx - 8, z: -155, scale: 1.4 });
    shrubs.push({ x: sx + 6, z: -150, scale: 0.9 });
  }

  // 8. Northern Foothills Approaching Aso Rock (z: -210 to -175)
  for (let nx = -100; nx <= 120; nx += 22) {
    acacias.push({ x: nx, z: -195 + (nx % 4) * 5, scale: 1.2 });
    boulders.push({ x: nx + 7, z: -205, scale: 1.8 });
    boulders.push({ x: nx - 6, z: -185, scale: 1.5 });
    shrubs.push({ x: nx + 3, z: -190, scale: 1.0 });
    shrubs.push({ x: nx - 5, z: -200, scale: 0.9 });
  }

  // 9. Instantiate all species batches
  const rp = createDualInstanced(geoRoyalPalmTrunk, vegetationMaterials.royalPalmTrunk, geoRoyalPalmCrown, vegetationMaterials.royalPalmCrown, royalPalms, "RoyalPalm");
  if (rp) { root.add(rp[0]); root.add(rp[1]); }

  const fp = createDualInstanced(geoFanPalmTrunk, vegetationMaterials.fanPalmTrunk, geoFanPalmCrown, vegetationMaterials.fanPalmCrown, fanPalms, "FanPalm");
  if (fp) { root.add(fp[0]); root.add(fp[1]); }

  const ac = createDualInstanced(geoAcaciaTrunk, vegetationMaterials.acaciaBark, geoAcaciaFoliage, vegetationMaterials.acaciaFoliage, acacias, "Acacia");
  if (ac) { root.add(ac[0]); root.add(ac[1]); }

  const fl = createDualInstanced(geoFlamboyantTrunk, vegetationMaterials.flamboyantTrunk, geoFlamboyantCrown, vegetationMaterials.flamboyantCrown, flamboyants, "Flamboyant");
  if (fl) { root.add(fl[0]); root.add(fl[1]); }

  const sh = createSingleInstanced(geoShrub, vegetationMaterials.shrubFoliage, shrubs, "SavannahShrubInstances");
  if (sh) root.add(sh);

  const fb = createSingleInstanced(geoShrub, vegetationMaterials.flowerShrub, flowerBushes, "FlowerBushInstances");
  if (fb) root.add(fb);

  const bd = createSingleInstanced(geoBoulder, vegetationMaterials.graniteBoulder, boulders, "SavannahBoulderInstances");
  if (bd) root.add(bd);

  return root;
}
