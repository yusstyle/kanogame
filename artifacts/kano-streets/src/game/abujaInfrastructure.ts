import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Collider } from "./types";

// -------------------------------------------------------------
// PROCEDURAL PBR TEXTURE GENERATORS (CC0 / ZERO EXTERNAL ASSET)
// -------------------------------------------------------------
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

let cachedAsphaltMat: THREE.MeshStandardMaterial | null = null;
let cachedSidewalkMat: THREE.MeshStandardMaterial | null = null;
let cachedCurbMat: THREE.MeshStandardMaterial | null = null;
let cachedVergeMat: THREE.MeshStandardMaterial | null = null;
let cachedWhiteMarkingMat: THREE.MeshStandardMaterial | null = null;
let cachedYellowMarkingMat: THREE.MeshStandardMaterial | null = null;
let cachedGutterMat: THREE.MeshStandardMaterial | null = null;

export function getAbujaInfrastructureMaterials() {
  if (cachedAsphaltMat) {
    return {
      asphalt: cachedAsphaltMat,
      sidewalk: cachedSidewalkMat!,
      curb: cachedCurbMat!,
      verge: cachedVergeMat!,
      whiteMarking: cachedWhiteMarkingMat!,
      yellowMarking: cachedYellowMarkingMat!,
      gutter: cachedGutterMat!,
    };
  }

  // 1. Asphalt PBR Texture (Deep Graphite with Mineral Aggregate & Surface Grain)
  const aspCanvas = document.createElement("canvas");
  aspCanvas.width = aspCanvas.height = 512;
  const aspCtx = aspCanvas.getContext("2d")!;
  aspCtx.fillStyle = "#222528";
  aspCtx.fillRect(0, 0, 512, 512);

  const randAsp = seededRandom(409);
  // Mineral flecks & fine gravel
  for (let i = 0; i < 12000; i++) {
    const sz = 0.4 + randAsp() * 1.6;
    aspCtx.globalAlpha = 0.06 + randAsp() * 0.18;
    aspCtx.fillStyle = randAsp() > 0.45 ? "#474b52" : "#131416";
    aspCtx.fillRect(randAsp() * 512, randAsp() * 512, sz, sz);
  }
  // Subtle tire wear longitudinal polishing
  aspCtx.globalAlpha = 0.08;
  aspCtx.fillStyle = "#161719";
  for (let w = 0; w < 6; w++) {
    const yPos = randAsp() * 512;
    aspCtx.fillRect(0, yPos, 512, 28 + randAsp() * 32);
  }
  aspCtx.globalAlpha = 1;

  const asphaltTex = new THREE.CanvasTexture(aspCanvas);
  asphaltTex.colorSpace = THREE.SRGBColorSpace;
  asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.repeat.set(6, 48);
  asphaltTex.anisotropy = 4;

  // Bump map for asphalt surface roughness
  const aspBumpCanvas = document.createElement("canvas");
  aspBumpCanvas.width = aspBumpCanvas.height = 256;
  const aspBumpCtx = aspBumpCanvas.getContext("2d")!;
  aspBumpCtx.fillStyle = "#808080";
  aspBumpCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    aspBumpCtx.fillStyle = randAsp() > 0.5 ? "#a0a0a0" : "#606060";
    aspBumpCtx.fillRect(randAsp() * 256, randAsp() * 256, 1.2, 1.2);
  }
  const asphaltBump = new THREE.CanvasTexture(aspBumpCanvas);
  asphaltBump.wrapS = asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.repeat.set(6, 48);

  cachedAsphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    bumpMap: asphaltBump,
    bumpScale: 0.015,
    roughness: 0.82,
    metalness: 0.06,
  });

  // 2. Modern Sidewalk Interlocking Paver Texture
  const sideCanvas = document.createElement("canvas");
  sideCanvas.width = sideCanvas.height = 512;
  const sideCtx = sideCanvas.getContext("2d")!;
  sideCtx.fillStyle = "#c2c6cb";
  sideCtx.fillRect(0, 0, 512, 512);

  // Paver grid (64x32 px per tile)
  const tileW = 64;
  const tileH = 32;
  const randTile = seededRandom(881);
  for (let y = 0; y < 512; y += tileH) {
    const xOffset = ((y / tileH) % 2) * (tileW / 2);
    for (let x = -tileW; x < 512 + tileW; x += tileW) {
      const shade = 185 + Math.floor(randTile() * 25);
      sideCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 4})`;
      sideCtx.fillRect(x + xOffset + 1.5, y + 1.5, tileW - 3, tileH - 3);

      // Fine granite speckle inside each paver
      sideCtx.fillStyle = "rgba(40,45,50,0.12)";
      for (let s = 0; s < 18; s++) {
        sideCtx.fillRect(
          x + xOffset + 3 + randTile() * (tileW - 6),
          y + 3 + randTile() * (tileH - 6),
          1.2,
          1.2,
        );
      }
    }
  }
  // Grout joint lines
  sideCtx.strokeStyle = "#72777d";
  sideCtx.lineWidth = 1.8;
  for (let y = 0; y <= 512; y += tileH) {
    sideCtx.beginPath();
    sideCtx.moveTo(0, y);
    sideCtx.lineTo(512, y);
    sideCtx.stroke();
  }

  const sidewalkTex = new THREE.CanvasTexture(sideCanvas);
  sidewalkTex.colorSpace = THREE.SRGBColorSpace;
  sidewalkTex.wrapS = sidewalkTex.wrapT = THREE.RepeatWrapping;
  sidewalkTex.repeat.set(4, 32);
  sidewalkTex.anisotropy = 4;

  cachedSidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.72,
    metalness: 0.05,
  });

  // 3. Precast Concrete Curb Texture
  const curbCanvas = document.createElement("canvas");
  curbCanvas.width = 256;
  curbCanvas.height = 256;
  const curbCtx = curbCanvas.getContext("2d")!;
  curbCtx.fillStyle = "#dce0e3";
  curbCtx.fillRect(0, 0, 256, 256);
  // Curb section joints every 64px
  curbCtx.strokeStyle = "#9da2a6";
  curbCtx.lineWidth = 2;
  for (let y = 0; y <= 256; y += 64) {
    curbCtx.beginPath();
    curbCtx.moveTo(0, y);
    curbCtx.lineTo(256, y);
    curbCtx.stroke();
  }
  const curbTex = new THREE.CanvasTexture(curbCanvas);
  curbTex.colorSpace = THREE.SRGBColorSpace;
  curbTex.wrapS = curbTex.wrapT = THREE.RepeatWrapping;
  curbTex.repeat.set(1, 24);

  cachedCurbMat = new THREE.MeshStandardMaterial({
    map: curbTex,
    roughness: 0.58,
    metalness: 0.08,
  });

  // 4. Natural Laterite Soil / Compacted Gravel Verge Transition
  const vergeCanvas = document.createElement("canvas");
  vergeCanvas.width = vergeCanvas.height = 256;
  const vergeCtx = vergeCanvas.getContext("2d")!;
  vergeCtx.fillStyle = "#6e4a36";
  vergeCtx.fillRect(0, 0, 256, 256);
  const randVerge = seededRandom(613);
  for (let i = 0; i < 4000; i++) {
    const sz = 0.8 + randVerge() * 2.2;
    vergeCtx.fillStyle = randVerge() > 0.5 ? "#8c5d43" : "#513626";
    vergeCtx.fillRect(randVerge() * 256, randVerge() * 256, sz, sz);
  }
  const vergeTex = new THREE.CanvasTexture(vergeCanvas);
  vergeTex.colorSpace = THREE.SRGBColorSpace;
  vergeTex.wrapS = vergeTex.wrapT = THREE.RepeatWrapping;
  vergeTex.repeat.set(2, 24);

  cachedVergeMat = new THREE.MeshStandardMaterial({
    map: vergeTex,
    roughness: 0.95,
    metalness: 0.02,
  });

  // 5. Thermoplastic Road Markings (White & Yellow)
  cachedWhiteMarkingMat = new THREE.MeshStandardMaterial({
    color: "#fcfdfe",
    roughness: 0.35,
    metalness: 0.05,
  });

  cachedYellowMarkingMat = new THREE.MeshStandardMaterial({
    color: "#f5b041",
    roughness: 0.38,
    metalness: 0.05,
  });

  // 6. Cast-Iron Stormwater Gutter Grates
  cachedGutterMat = new THREE.MeshStandardMaterial({
    color: "#2a2d30",
    roughness: 0.42,
    metalness: 0.75,
  });

  return {
    asphalt: cachedAsphaltMat,
    sidewalk: cachedSidewalkMat,
    curb: cachedCurbMat,
    verge: cachedVergeMat,
    whiteMarking: cachedWhiteMarkingMat,
    yellowMarking: cachedYellowMarkingMat,
    gutter: cachedGutterMat,
  };
}

// -------------------------------------------------------------
// BATCHED GEOMETRY BUILDER FOR ROADS, SIDEWALKS & MARKINGS
// -------------------------------------------------------------
export interface InfrastructureResult {
  group: THREE.Group;
  colliders: Collider[];
}

export function buildAbujaInfrastructure(bounds = 220): InfrastructureResult {
  const group = new THREE.Group();
  group.name = "AbujaInfrastructureSystem";
  const colliders: Collider[] = [];

  const mats = getAbujaInfrastructureMaterials();

  const roadGeometries: THREE.BufferGeometry[] = [];
  const sidewalkGeometries: THREE.BufferGeometry[] = [];
  const curbGeometries: THREE.BufferGeometry[] = [];
  const vergeGeometries: THREE.BufferGeometry[] = [];
  const whiteMarkingGeos: THREE.BufferGeometry[] = [];
  const yellowMarkingGeos: THREE.BufferGeometry[] = [];
  const gutterGeos: THREE.BufferGeometry[] = [];

  const rotMinusX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

  // Helper: Add flat horizontal plane to geometry array
  function addPlane(
    targetArray: THREE.BufferGeometry[],
    cx: number,
    y: number,
    cz: number,
    widthX: number,
    lengthZ: number,
  ) {
    const g = new THREE.PlaneGeometry(widthX, lengthZ);
    const m = new THREE.Matrix4().makeTranslation(cx, y, cz).multiply(rotMinusX);
    g.applyMatrix4(m);
    targetArray.push(g);
  }

  // Helper: Add 3D box (curb, median, barrier)
  function addBoxGeo(
    targetArray: THREE.BufferGeometry[],
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
  ) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(cx, cy, cz);
    targetArray.push(g);
  }

  // =============================================================
  // 1. ROAD CARRIAGEWAYS (Shehu Shagari Way & Constitution Ave)
  // =============================================================

  // Shehu Shagari Way (North-South: 28m wide, x from -14 to +14)
  // Split into North segment (z: -bounds to -22) and South segment (z: +22 to +bounds)
  const nLen = bounds - 22;
  addPlane(roadGeometries, 0, 0.01, -22 - nLen / 2, 28, nLen);
  addPlane(roadGeometries, 0, 0.01, 22 + nLen / 2, 28, nLen);

  // Constitution Avenue (East-West: 24m wide, z from -12 to +12)
  // Split into West segment (x: -bounds to -22) and East segment (x: +22 to +bounds)
  addPlane(roadGeometries, -22 - nLen / 2, 0.01, 0, nLen, 24);
  addPlane(roadGeometries, 22 + nLen / 2, 0.01, 0, nLen, 24);

  // Central Roundabout Circulating Carriageway (outer ring: r=20 to r=34)
  const roundaboutRoad = new THREE.RingGeometry(20, 34, 48);
  roundaboutRoad.applyMatrix4(rotMinusX);
  roundaboutRoad.translate(0, 0.01, 0);
  roadGeometries.push(roundaboutRoad);

  // Secondary Avenues
  // Maitama Boulevard (x = -90, width 16, z: -bounds to +bounds)
  addPlane(roadGeometries, -90, 0.01, 0, 16, bounds * 1.6);
  // CBD Herbert Macaulay Way (x = 90, width 18, z: -bounds to +bounds)
  addPlane(roadGeometries, 90, 0.01, 0, 18, bounds * 1.6);
  // Wuse 2 Commercial Link (z = 90, width 16, x: -bounds to +bounds)
  addPlane(roadGeometries, 0, 0.01, 90, bounds * 1.6, 16);
  // Three Arms Civic Avenue (z = -90, width 18, x: -bounds to +bounds)
  addPlane(roadGeometries, 0, 0.01, -90, bounds * 1.6, 18);

  // =============================================================
  // 2. CONTINUOUS PEDESTRIAN SIDEWALKS & BEVELED CURBS
  // =============================================================

  // Shehu Shagari Way Sidewalks (width 3.4m on East & West)
  // West sidewalk: x from -17.4 to -14.0 (center -15.7, width 3.4)
  // East sidewalk: x from 14.0 to 17.4 (center 15.7, width 3.4)
  addPlane(sidewalkGeometries, -15.7, 0.16, -24 - nLen / 2, 3.4, nLen);
  addPlane(sidewalkGeometries, 15.7, 0.16, -24 - nLen / 2, 3.4, nLen);
  addPlane(sidewalkGeometries, -15.7, 0.16, 24 + nLen / 2, 3.4, nLen);
  addPlane(sidewalkGeometries, 15.7, 0.16, 24 + nLen / 2, 3.4, nLen);

  // Shehu Shagari Way Curbs (0.35m wide, 0.18m high)
  addBoxGeo(curbGeometries, -14.15, 0.09, -24 - nLen / 2, 0.35, 0.18, nLen);
  addBoxGeo(curbGeometries, 14.15, 0.09, -24 - nLen / 2, 0.35, 0.18, nLen);
  addBoxGeo(curbGeometries, -14.15, 0.09, 24 + nLen / 2, 0.35, 0.18, nLen);
  addBoxGeo(curbGeometries, 14.15, 0.09, 24 + nLen / 2, 0.35, 0.18, nLen);

  // Shehu Shagari Way Stormwater Gutters (0.5m wide concave channel at road edge)
  addBoxGeo(gutterGeos, -13.7, 0.015, -24 - nLen / 2, 0.55, 0.03, nLen);
  addBoxGeo(gutterGeos, 13.7, 0.015, -24 - nLen / 2, 0.55, 0.03, nLen);
  addBoxGeo(gutterGeos, -13.7, 0.015, 24 + nLen / 2, 0.55, 0.03, nLen);
  addBoxGeo(gutterGeos, 13.7, 0.015, 24 + nLen / 2, 0.55, 0.03, nLen);

  // Constitution Avenue Sidewalks (width 3.0m on North & South)
  // North sidewalk: z from -15.0 to -12.0 (center -13.5, width 3.0)
  // South sidewalk: z from 12.0 to 15.0 (center 13.5, width 3.0)
  addPlane(sidewalkGeometries, -24 - nLen / 2, 0.16, -13.5, nLen, 3.0);
  addPlane(sidewalkGeometries, -24 - nLen / 2, 0.16, 13.5, nLen, 3.0);
  addPlane(sidewalkGeometries, 24 + nLen / 2, 0.16, -13.5, nLen, 3.0);
  addPlane(sidewalkGeometries, 24 + nLen / 2, 0.16, 13.5, nLen, 3.0);

  // Constitution Avenue Curbs
  addBoxGeo(curbGeometries, -24 - nLen / 2, 0.09, -12.15, nLen, 0.18, 0.35);
  addBoxGeo(curbGeometries, -24 - nLen / 2, 0.09, 12.15, nLen, 0.18, 0.35);
  addBoxGeo(curbGeometries, 24 + nLen / 2, 0.09, -12.15, nLen, 0.18, 0.35);
  addBoxGeo(curbGeometries, 24 + nLen / 2, 0.09, 12.15, nLen, 0.18, 0.35);

  // Central Roundabout Sidewalk Ring (radius 34 to 38.5)
  const roundaboutWalk = new THREE.RingGeometry(34, 38.5, 48);
  roundaboutWalk.applyMatrix4(rotMinusX);
  roundaboutWalk.translate(0, 0.16, 0);
  sidewalkGeometries.push(roundaboutWalk);

  // Central Roundabout Outer Curb Ring (at r=34)
  const roundOuterCurb = new THREE.CylinderGeometry(34.2, 34.2, 0.18, 48, 1, true);
  roundOuterCurb.translate(0, 0.09, 0);
  curbGeometries.push(roundOuterCurb);

  // Central Roundabout Inner Island Curb (at r=20, beveled concrete, height 0.35m)
  const roundInnerCurb = new THREE.CylinderGeometry(20.0, 20.4, 0.35, 48);
  roundInnerCurb.translate(0, 0.175, 0);
  curbGeometries.push(roundInnerCurb);

  // Secondary Avenues Sidewalks & Curbs
  // Maitama Boulevard (x = -90)
  addPlane(sidewalkGeometries, -99.5, 0.16, 0, 2.5, bounds * 1.5);
  addPlane(sidewalkGeometries, -80.5, 0.16, 0, 2.5, bounds * 1.5);
  addBoxGeo(curbGeometries, -98.15, 0.09, 0, 0.3, 0.18, bounds * 1.5);
  addBoxGeo(curbGeometries, -81.85, 0.09, 0, 0.3, 0.18, bounds * 1.5);

  // CBD Herbert Macaulay Way (x = 90)
  addPlane(sidewalkGeometries, 79.5, 0.16, 0, 2.8, bounds * 1.5);
  addPlane(sidewalkGeometries, 100.5, 0.16, 0, 2.8, bounds * 1.5);
  addBoxGeo(curbGeometries, 80.85, 0.09, 0, 0.3, 0.18, bounds * 1.5);
  addBoxGeo(curbGeometries, 99.15, 0.09, 0, 0.3, 0.18, bounds * 1.5);

  // Wuse 2 Commercial Link (z = 90)
  addPlane(sidewalkGeometries, 0, 0.16, 80.5, bounds * 1.5, 2.5);
  addPlane(sidewalkGeometries, 0, 0.16, 99.5, bounds * 1.5, 2.5);
  addBoxGeo(curbGeometries, 0, 0.09, 81.85, bounds * 1.5, 0.18, 0.3);
  addBoxGeo(curbGeometries, 0, 0.09, 98.15, bounds * 1.5, 0.18, 0.3);

  // Three Arms Civic Avenue (z = -90)
  addPlane(sidewalkGeometries, 0, 0.16, -99.5, bounds * 1.5, 2.8);
  addPlane(sidewalkGeometries, 0, 0.16, -80.5, bounds * 1.5, 2.8);
  addBoxGeo(curbGeometries, 0, 0.09, -99.15, bounds * 1.5, 0.18, 0.3);
  addBoxGeo(curbGeometries, 0, 0.09, -80.85, bounds * 1.5, 0.18, 0.3);

  // =============================================================
  // 3. ROADSIDE LATERITE SOIL / GRAVEL TRANSITION VERGES
  // =============================================================
  // Transition strips flanking the sidewalks into the savannah lawn
  addPlane(vergeGeometries, -19.0, 0.08, -24 - nLen / 2, 3.0, nLen);
  addPlane(vergeGeometries, 19.0, 0.08, -24 - nLen / 2, 3.0, nLen);
  addPlane(vergeGeometries, -19.0, 0.08, 24 + nLen / 2, 3.0, nLen);
  addPlane(vergeGeometries, 19.0, 0.08, 24 + nLen / 2, 3.0, nLen);

  addPlane(vergeGeometries, -24 - nLen / 2, 0.08, -16.5, nLen, 2.8);
  addPlane(vergeGeometries, -24 - nLen / 2, 0.08, 16.5, nLen, 2.8);
  addPlane(vergeGeometries, 24 + nLen / 2, 0.08, -16.5, nLen, 2.8);
  addPlane(vergeGeometries, 24 + nLen / 2, 0.08, 16.5, nLen, 2.8);

  // =============================================================
  // 4. LANDSCAPED MEDIANS (NON-CLIPPING)
  // =============================================================
  // Medians cleanly stop before the central roundabout (at z = ±26) and secondary junctions
  const medianGreenMat = new THREE.MeshStandardMaterial({
    color: "#285834",
    roughness: 0.88,
  });

  // North Median: z from -bounds to -26, breaking for Civic Ave at z = -90
  const medN1Len = 90 - 26 - 12; // from -26 to -78 = 52m
  const medN1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, medN1Len), medianGreenMat);
  medN1.position.set(0, 0.11, -26 - medN1Len / 2);
  group.add(medN1);

  const medN2Len = bounds - 90 - 12; // from -102 to -220
  const medN2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, medN2Len), medianGreenMat);
  medN2.position.set(0, 0.11, -102 - medN2Len / 2);
  group.add(medN2);

  // South Median: z from +26 to +bounds, breaking for Wuse 2 at z = +90
  const medS1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, medN1Len), medianGreenMat);
  medS1.position.set(0, 0.11, 26 + medN1Len / 2);
  group.add(medS1);

  const medS2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, medN2Len), medianGreenMat);
  medS2.position.set(0, 0.11, 102 + medN2Len / 2);
  group.add(medS2);

  // East-West Medians
  const medEWLen = 90 - 26 - 12;
  const medW1 = new THREE.Mesh(new THREE.BoxGeometry(medEWLen, 0.22, 2.2), medianGreenMat);
  medW1.position.set(-26 - medEWLen / 2, 0.11, 0);
  group.add(medW1);

  const medE1 = new THREE.Mesh(new THREE.BoxGeometry(medEWLen, 0.22, 2.2), medianGreenMat);
  medE1.position.set(26 + medEWLen / 2, 0.11, 0);
  group.add(medE1);

  // Median Curbs
  addBoxGeo(curbGeometries, -1.25, 0.08, -26 - medN1Len / 2, 0.18, 0.16, medN1Len);
  addBoxGeo(curbGeometries, 1.25, 0.08, -26 - medN1Len / 2, 0.18, 0.16, medN1Len);
  addBoxGeo(curbGeometries, -1.25, 0.08, 26 + medN1Len / 2, 0.18, 0.16, medN1Len);
  addBoxGeo(curbGeometries, 1.25, 0.08, 26 + medN1Len / 2, 0.18, 0.16, medN1Len);

  // =============================================================
  // 5. THERMOPLASTIC ROAD MARKINGS (White & Yellow)
  // =============================================================

  // 5A. Solid Outer Carriageway Edge Lines (0.2m wide, continuous)
  for (const lzSeg of [
    { start: -bounds + 10, end: -24 },
    { start: 24, end: bounds - 10 },
  ]) {
    const len = Math.abs(lzSeg.end - lzSeg.start);
    const midZ = (lzSeg.start + lzSeg.end) / 2;
    // Outer edge lines on Shehu Shagari Way (x = -13.6 and +13.6)
    addPlane(whiteMarkingGeos, -13.55, 0.025, midZ, 0.22, len);
    addPlane(whiteMarkingGeos, 13.55, 0.025, midZ, 0.22, len);
    // Inner median solid edge lines (x = -1.45 and +1.45)
    addPlane(yellowMarkingGeos, -1.45, 0.025, midZ, 0.2, len);
    addPlane(yellowMarkingGeos, 1.45, 0.025, midZ, 0.2, len);
  }

  for (const lxSeg of [
    { start: -bounds + 10, end: -24 },
    { start: 24, end: bounds - 10 },
  ]) {
    const len = Math.abs(lxSeg.end - lxSeg.start);
    const midX = (lxSeg.start + lxSeg.end) / 2;
    // Outer edge lines on Constitution Ave (z = -11.6 and +11.6)
    addPlane(whiteMarkingGeos, midX, 0.025, -11.55, len, 0.22);
    addPlane(whiteMarkingGeos, midX, 0.025, 11.55, len, 0.22);
    // Inner median lines
    addPlane(yellowMarkingGeos, midX, 0.025, -1.35, len, 0.2);
    addPlane(yellowMarkingGeos, midX, 0.025, 1.35, len, 0.2);
  }

  // 5B. Dashed Lane Dividers (0.2m × 3.5m dashes spaced 6.5m)
  for (let lz = -bounds + 12; lz < bounds - 12; lz += 7) {
    if (Math.abs(lz) < 24) continue; // skip roundabout
    // 4 lanes per carriageway: dividers at x = -9.5, -5.5 and +5.5, +9.5
    for (const lx of [-9.5, -5.5, 5.5, 9.5]) {
      addPlane(whiteMarkingGeos, lx, 0.025, lz, 0.2, 3.8);
    }
  }

  for (let lx = -bounds + 12; lx < bounds - 12; lx += 7) {
    if (Math.abs(lx) < 24) continue;
    for (const lz of [-7.5, -4.0, 4.0, 7.5]) {
      addPlane(whiteMarkingGeos, lx, 0.025, lz, 3.8, 0.2);
    }
  }

  // 5C. Zebra Pedestrian Crosswalks at Roundabout Approaches & Secondary Junctions
  // 4 Crossings at Roundabout entrances (z = ±24 and x = ±24)
  function addZebraCrossingZ(cz: number, xMin: number, xMax: number) {
    const width = xMax - xMin;
    const stripeCount = Math.floor(width / 1.1);
    for (let s = 0; s < stripeCount; s++) {
      const sx = xMin + 0.5 + s * 1.1;
      addPlane(whiteMarkingGeos, sx, 0.028, cz, 0.5, 3.6);
    }
  }

  function addZebraCrossingX(cx: number, zMin: number, zMax: number) {
    const length = zMax - zMin;
    const stripeCount = Math.floor(length / 1.1);
    for (let s = 0; s < stripeCount; s++) {
      const sz = zMin + 0.5 + s * 1.1;
      addPlane(whiteMarkingGeos, cx, 0.028, sz, 3.6, 0.5);
    }
  }

  // Roundabout approaches
  addZebraCrossingZ(-24, -13.5, -1.8);
  addZebraCrossingZ(-24, 1.8, 13.5);
  addZebraCrossingZ(24, -13.5, -1.8);
  addZebraCrossingZ(24, 1.8, 13.5);

  addZebraCrossingX(-24, -11.5, -1.5);
  addZebraCrossingX(-24, 1.5, 11.5);
  addZebraCrossingX(24, -11.5, -1.5);
  addZebraCrossingX(24, 1.5, 11.5);

  // 5D. Roundabout Circulatory Lane Markings
  // Dashed lane ring at radius = 27m
  const numRoundaboutDashes = 32;
  for (let i = 0; i < numRoundaboutDashes; i++) {
    const angle = (i / numRoundaboutDashes) * Math.PI * 2;
    const rx = Math.cos(angle) * 27;
    const rz = Math.sin(angle) * 27;
    const dash = new THREE.PlaneGeometry(0.25, 2.5);
    const m = new THREE.Matrix4()
      .makeTranslation(rx, 0.026, rz)
      .multiply(rotMinusX)
      .multiply(new THREE.Matrix4().makeRotationZ(angle + Math.PI / 2));
    dash.applyMatrix4(m);
    whiteMarkingGeos.push(dash);
  }

  // Roundabout Shark-Tooth Yield Markings at Entry Points
  for (const entryPos of [
    { x: -7.5, z: -21.5, rot: 0 },
    { x: 7.5, z: 21.5, rot: Math.PI },
    { x: -21.5, z: 6.0, rot: Math.PI / 2 },
    { x: 21.5, z: -6.0, rot: -Math.PI / 2 },
  ]) {
    for (let t = -3; t <= 3; t += 1.2) {
      addPlane(whiteMarkingGeos, entryPos.x + t, 0.028, entryPos.z, 0.6, 0.7);
    }
  }

  // =============================================================
  // 6. MERGE GEOMETRIES & ASSEMBLE BATTERIES
  // =============================================================

  // 1. Roads Mesh
  if (roadGeometries.length > 0) {
    const mergedRoad = mergeGeometries(roadGeometries);
    for (const g of roadGeometries) g.dispose();
    const roadMesh = new THREE.Mesh(mergedRoad, mats.asphalt);
    roadMesh.name = "AbujaRoadsBatched";
    roadMesh.receiveShadow = true;
    roadMesh.userData.noMerge = true;
    group.add(roadMesh);
  }

  // 2. Sidewalks Mesh
  if (sidewalkGeometries.length > 0) {
    const mergedWalk = mergeGeometries(sidewalkGeometries);
    for (const g of sidewalkGeometries) g.dispose();
    const sidewalkMesh = new THREE.Mesh(mergedWalk, mats.sidewalk);
    sidewalkMesh.name = "AbujaSidewalksBatched";
    sidewalkMesh.receiveShadow = true;
    sidewalkMesh.userData.noMerge = true;
    group.add(sidewalkMesh);
  }

  // 3. Curbs Mesh
  if (curbGeometries.length > 0) {
    const mergedCurbs = mergeGeometries(curbGeometries);
    for (const g of curbGeometries) g.dispose();
    const curbMesh = new THREE.Mesh(mergedCurbs, mats.curb);
    curbMesh.name = "AbujaCurbsBatched";
    curbMesh.castShadow = true;
    curbMesh.receiveShadow = true;
    curbMesh.userData.noMerge = true;
    group.add(curbMesh);
  }

  // 4. Stormwater Gutters Mesh
  if (gutterGeos.length > 0) {
    const mergedGutters = mergeGeometries(gutterGeos);
    for (const g of gutterGeos) g.dispose();
    const gutterMesh = new THREE.Mesh(mergedGutters, mats.gutter);
    gutterMesh.name = "AbujaStormGuttersBatched";
    gutterMesh.receiveShadow = true;
    gutterMesh.userData.noMerge = true;
    group.add(gutterMesh);
  }

  // 5. Laterite Verge Mesh
  if (vergeGeometries.length > 0) {
    const mergedVerges = mergeGeometries(vergeGeometries);
    for (const g of vergeGeometries) g.dispose();
    const vergeMesh = new THREE.Mesh(mergedVerges, mats.verge);
    vergeMesh.name = "AbujaLateriteVergesBatched";
    vergeMesh.receiveShadow = true;
    vergeMesh.userData.noMerge = true;
    group.add(vergeMesh);
  }

  // 6. White Road Markings Mesh
  if (whiteMarkingGeos.length > 0) {
    const mergedWhite = mergeGeometries(whiteMarkingGeos);
    for (const g of whiteMarkingGeos) g.dispose();
    const whiteMesh = new THREE.Mesh(mergedWhite, mats.whiteMarking);
    whiteMesh.name = "AbujaRoadMarkingsWhiteBatched";
    whiteMesh.receiveShadow = true;
    whiteMesh.userData.noMerge = true;
    group.add(whiteMesh);
  }

  // 7. Yellow Road Markings Mesh
  if (yellowMarkingGeos.length > 0) {
    const mergedYellow = mergeGeometries(yellowMarkingGeos);
    for (const g of yellowMarkingGeos) g.dispose();
    const yellowMesh = new THREE.Mesh(mergedYellow, mats.yellowMarking);
    yellowMesh.name = "AbujaRoadMarkingsYellowBatched";
    yellowMesh.receiveShadow = true;
    yellowMesh.userData.noMerge = true;
    group.add(yellowMesh);
  }

  return { group, colliders };
}
