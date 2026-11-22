import * as THREE from "three";
import { markWorldResourceShared } from "./worldResourceLifecycle";
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
// PROCEDURAL PBR TEXTURES FOR NIGERIAN SAVANNAH & TROPICAL FLORA
// -------------------------------------------------------------

/**
 * 1. High-Fidelity Feather Palm Frond Texture with Individual Leaflets & Alpha Cutouts
 * Replaces rigid rectangular box planks with delicate, botanical pinnate fronds.
 */
function createFeatherPalmFrondTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  ctx.clearRect(0, 0, 512, 256);

  // Central Rachis (spine)
  ctx.strokeStyle = "#8da336";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(10, 128);
  ctx.lineTo(495, 128);
  ctx.stroke();

  // Draw 56 pairs of feathered leaflets branching outward from spine
  const numPairs = 56;
  let seed = 48192;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const leafGreens = ["#194514", "#235a1a", "#2f6f22", "#3e852d", "#285e1d"];

  for (let i = 0; i < numPairs; i++) {
    const t = i / numPairs;
    const xBase = 18 + t * 470;

    // Leaflet length envelope: short near crown, longest at 35%, tapering to needle at tip
    const lenProfile = Math.sin(Math.pow(t, 0.65) * Math.PI);
    const leafletLen = 16 + lenProfile * 96 + (rnd() - 0.5) * 8;

    // Forward sweep angle towards tip
    const sweep = 16 + t * 22;

    // Upper leaflet
    ctx.strokeStyle = leafGreens[Math.floor(rnd() * leafGreens.length)];
    ctx.lineWidth = 2.4 - t * 0.9;
    ctx.beginPath();
    ctx.moveTo(xBase, 128);
    ctx.quadraticCurveTo(
      xBase + sweep * 0.45,
      128 - leafletLen * 0.55,
      xBase + sweep,
      128 - leafletLen,
    );
    ctx.stroke();

    // Lower leaflet
    ctx.strokeStyle = leafGreens[Math.floor(rnd() * leafGreens.length)];
    ctx.beginPath();
    ctx.moveTo(xBase, 128);
    ctx.quadraticCurveTo(
      xBase + sweep * 0.45,
      128 + leafletLen * 0.55,
      xBase + sweep,
      128 + leafletLen,
    );
    ctx.stroke();
  }

  // Second pass: fine leaflet density & vein highlights
  for (let i = 4; i < numPairs - 4; i += 2) {
    const t = i / numPairs;
    const xBase = 22 + t * 464;
    const lenProfile = Math.sin(Math.pow(t, 0.65) * Math.PI);
    const leafletLen = (14 + lenProfile * 94) * 0.88;
    const sweep = 18 + t * 18;

    ctx.strokeStyle = "#509436";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(xBase, 128);
    ctx.quadraticCurveTo(xBase + sweep * 0.4, 128 - leafletLen * 0.5, xBase + sweep, 128 - leafletLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(xBase, 128);
    ctx.quadraticCurveTo(xBase + sweep * 0.4, 128 + leafletLen * 0.5, xBase + sweep, 128 + leafletLen);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * 2. Authentic Ringed Royal Palm Trunk Texture
 * Light warm stone-grey trunk with horizontal leaf scar rings
 */
function createRingedPalmBarkTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  // Smooth warm grey limestone base
  ctx.fillStyle = "#b8b2a7";
  ctx.fillRect(0, 0, 256, 512);

  let seed = 28193;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Fine vertical grain
  for (let i = 0; i < 4000; i++) {
    const x = rnd() * 256;
    const y = rnd() * 512;
    ctx.fillStyle = rnd() > 0.5 ? "rgba(75, 68, 60, 0.08)" : "rgba(220, 215, 205, 0.12)";
    ctx.fillRect(x, y, 1.2, 4 + rnd() * 12);
  }

  // Characteristic horizontal leaf-scar rings every ~28px
  for (let y = 14; y < 512; y += 28) {
    const yVar = y + (rnd() - 0.5) * 3;
    // Dark depression line
    ctx.strokeStyle = "rgba(68, 60, 52, 0.55)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, yVar);
    ctx.lineTo(256, yVar);
    ctx.stroke();

    // Subtle sunlit lip above the scar
    ctx.strokeStyle = "rgba(235, 230, 222, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, yVar - 1.8);
    ctx.lineTo(256, yVar - 1.8);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  return tex;
}

/**
 * 3. Organic Delonix Regia (Flamboyant) Canopy Texture with Foliage & Blossoms
 */
function createFlamboyantCanopyTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  ctx.clearRect(0, 0, 512, 512);

  let seed = 73619;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Multiple organic leafy clumps forming a full natural canopy card
  const centers = [
    { x: 256, y: 256, r: 210 },
    { x: 180, y: 200, r: 150 },
    { x: 330, y: 220, r: 160 },
    { x: 230, y: 340, r: 140 },
    { x: 320, y: 330, r: 130 },
  ];

  // Base bipinnate feathery leaflets
  for (const c of centers) {
    for (let i = 0; i < 900; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = Math.pow(rnd(), 0.75) * c.r;
      const lx = c.x + Math.cos(ang) * dist;
      const ly = c.y + Math.sin(ang) * dist;
      if (lx < 8 || lx > 504 || ly < 8 || ly > 504) continue;

      ctx.fillStyle = rnd() > 0.4 ? "#26541e" : "#173b14";
      ctx.beginPath();
      ctx.ellipse(lx, ly, 3.2 + rnd() * 2.8, 1.6 + rnd() * 1.4, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Brilliant Delonix regia scarlet & vermilion floral sprays
  const flameColors = ["#8f3825", "#a8492e", "#bf5a36", "#d07045", "#793a2d"];
  // Delonix flowers are seasonal clusters among the foliage, not a solid red canopy.
  for (let f = 0; f < 360; f++) {
    const ang = rnd() * Math.PI * 2;
    const dist = Math.pow(rnd(), 0.85) * 215;
    const fx = 256 + Math.cos(ang) * dist;
    const fy = 256 + Math.sin(ang) * dist;
    if (fx < 8 || fx > 504 || fy < 8 || fy > 504) continue;

    ctx.fillStyle = flameColors[Math.floor(rnd() * flameColors.length)];
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2 + rnd() * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 4. Organic Umbrella Acacia Foliage Texture
 */
function createAcaciaFoliageTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  ctx.clearRect(0, 0, 512, 512);

  let seed = 51928;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const greens = ["#22481a", "#2f5c24", "#3b6e2d", "#1c3d15", "#487e35"];
  for (let i = 0; i < 3500; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = Math.pow(rnd(), 0.7) * 230;
    const x = 256 + Math.cos(ang) * dist;
    const y = 256 + Math.sin(ang) * dist;
    if (x < 6 || x > 506 || y < 6 || y > 506) continue;

    ctx.fillStyle = greens[Math.floor(rnd() * greens.length)];
    ctx.beginPath();
    ctx.ellipse(x, y, 3.0 + rnd() * 3.0, 1.4 + rnd() * 1.6, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 5. Organic Shrub Texture
 */
function createShrubTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = "#1c3d19";
  ctx.fillRect(0, 0, 256, 256);

  let seed = 92831;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const greens = ["#285423", "#163314", "#34682e", "#1e441a", "#3e7536"];
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    ctx.fillStyle = greens[Math.floor(rnd() * greens.length)];
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2 + rnd() * 2.5, 1.2 + rnd() * 1.5, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * 6. Authentic Flowering Bougainvillea Texture
 */
function createBougainvilleaTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = "#183815";
  ctx.fillRect(0, 0, 256, 256);

  let seed = 48192;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    ctx.fillStyle = rnd() > 0.5 ? "#245220" : "#143012";
    ctx.beginPath();
    ctx.arc(x, y, 1.8 + rnd() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const bractColors = ["#8f1545", "#aa1c54", "#b8265e", "#701037", "#c4326a"];
  for (let b = 0; b < 1400; b++) {
    const bx = rnd() * 256;
    const by = rnd() * 256;
    const rad = 1.4 + rnd() * 2.6;
    ctx.fillStyle = bractColors[Math.floor(rnd() * bractColors.length)];
    ctx.beginPath();
    ctx.ellipse(bx, by, rad * 1.3, rad * 0.8, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function createBarkTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = "#46392f";
  ctx.fillRect(0, 0, 128, 256);

  let seed = 12398;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 45; i++) {
    const bx = rnd() * 128;
    ctx.fillStyle = rnd() > 0.5 ? "#2a221b" : "#5a4a3e";
    ctx.fillRect(bx, 0, 1.5 + rnd() * 2.5, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

// -------------------------------------------------------------
// PHOTOREALISTIC PBR MATERIALS FOR ABUJA VEGETATION & FLORA
// -------------------------------------------------------------
export const vegetationMaterials = {
  royalPalmTrunk: new THREE.MeshStandardMaterial({
    map: createRingedPalmBarkTexture(),
    color: "#d0c8be",
    roughness: 0.82,
    metalness: 0.02,
  }),
  royalPalmCrownshaft: new THREE.MeshStandardMaterial({
    color: "#1e4719",
    roughness: 0.45,
    metalness: 0.04,
  }),
  royalPalmCrown: new THREE.MeshStandardMaterial({
    map: createFeatherPalmFrondTexture(),
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
    roughness: 0.62,
    metalness: 0.03,
  }),
  fanPalmTrunk: new THREE.MeshStandardMaterial({
    map: createBarkTexture(),
    color: "#46382c",
    roughness: 0.92,
  }),
  fanPalmCrown: new THREE.MeshStandardMaterial({
    map: createShrubTexture(),
    color: "#224c26",
    roughness: 0.68,
  }),
  acaciaBark: new THREE.MeshStandardMaterial({
    map: createBarkTexture(),
    color: "#382b20",
    roughness: 0.95,
  }),
  acaciaFoliage: new THREE.MeshStandardMaterial({
    map: createAcaciaFoliageTexture(),
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
    color: "#d4deb8",
    roughness: 0.75,
  }),
  flamboyantTrunk: new THREE.MeshStandardMaterial({
    map: createBarkTexture(),
    color: "#4a3d33",
    roughness: 0.88,
  }),
  flamboyantCrown: new THREE.MeshStandardMaterial({
    map: createFlamboyantCanopyTexture(),
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
    roughness: 0.68,
  }),
  shrubFoliage: new THREE.MeshStandardMaterial({
    map: createShrubTexture(),
    color: "#ffffff",
    roughness: 0.82,
  }),
  bougainvilleaFlowers: new THREE.MeshStandardMaterial({
    map: createBougainvilleaTexture(),
    color: "#ffffff",
    roughness: 0.72,
  }),
  graniteBoulder: new THREE.MeshStandardMaterial({
    color: "#676156",
    roughness: 0.92,
    metalness: 0.08,
  }),
};
Object.values(vegetationMaterials).forEach(markWorldResourceShared);

// -------------------------------------------------------------
// GEOMETRY GENERATORS FOR SPECIES (ORGANIC PHOTOREALISTIC FORMS)
// -------------------------------------------------------------

/** Royal Palm (Roystonea regia): Ringed columnar trunk with flared base & crownshaft */
function buildRoyalPalmTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const radial = 16;

  // 1. Flared basal root collar (0m to 1.8m)
  const base = new THREE.CylinderGeometry(0.42, 0.62, 1.8, radial);
  base.translate(0, 0.9, 0);
  parts.push(base);

  // 2. Swollen lower-middle trunk with gentle organic bow (1.8m to 6.2m)
  const lowerMid = new THREE.CylinderGeometry(0.46, 0.42, 4.4, radial);
  lowerMid.rotateZ(0.018);
  lowerMid.translate(0.04, 4.0, 0);
  parts.push(lowerMid);

  // 3. Graceful tapering upper trunk (6.2m to 11.2m)
  const upperMid = new THREE.CylinderGeometry(0.32, 0.46, 5.0, radial);
  upperMid.rotateZ(-0.014);
  upperMid.translate(0.02, 8.7, 0);
  parts.push(upperMid);

  // 4. Prominent smooth emerald-green crownshaft sheath (11.2m to 13.4m)
  const crownshaft = new THREE.CylinderGeometry(0.26, 0.32, 2.2, radial);
  crownshaft.translate(0, 12.3, 0);
  parts.push(crownshaft);

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Royal Palm Feathered Crown: 24 gracefully arching pinnate fronds in 3 natural tiers
 * Built as curved double-sided quad strips with correct UV alignment along frond spine
 */
function buildRoyalPalmCrownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const frondCount = 24;
  const segments = 12;

  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2 + (i % 3) * 0.12;
    const tier = i % 3; // 0 = upper erect, 1 = middle spreading, 2 = lower drooping

    const baseY = tier === 0 ? 13.2 : tier === 1 ? 12.6 : 12.0;
    const droopPower = tier === 0 ? 1.4 : tier === 1 ? 2.6 : 4.6;
    const maxReach = tier === 0 ? 4.2 : tier === 1 ? 5.2 : 4.6;
    const archLift = tier === 0 ? 1.1 : tier === 1 ? 0.7 : 0.3;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const reach = 0.25 + Math.sin(t * Math.PI * 0.5) * (maxReach - 0.25);
      const yArch = Math.sin(t * Math.PI * 0.45) * archLift;
      const yDroop = Math.pow(t, 2.1) * droopPower;
      const curY = baseY + yArch - yDroop;

      // Leaflet spread width profile: narrow at base, broadest at 35%, tapering to needle tip
      const curWidth = Math.sin(Math.pow(t, 0.6) * Math.PI) * 1.05 + 0.08;

      const px = sinA * reach;
      const pz = cosA * reach;

      // Normal vector perpendicular to spine in horizontal plane with natural leaf tilt
      const nx = cosA;
      const nz = -sinA;

      const halfW = curWidth * 0.5;
      positions.push(px - nx * halfW, curY, pz - nz * halfW);
      positions.push(px + nx * halfW, curY, pz + nz * halfW);

      // Correct UV orientation: U is length t (0 to 1), V is width (0 to 1)
      uvs.push(t, 0);
      uvs.push(t, 1);

      if (s < segments) {
        const b = s * 2;
        indices.push(b, b + 1, b + 2);
        indices.push(b + 1, b + 3, b + 2);
      }
    }

    const frondGeo = new THREE.BufferGeometry();
    frondGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    frondGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    frondGeo.setIndex(indices);
    frondGeo.computeVertexNormals();
    parts.push(frondGeo);
  }

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** African Fan Palm (Borassus aethiopum): Realistic fibrous tapered trunk */
function buildFanPalmTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const radial = 14;

  // Lower stout trunk base
  const lower = new THREE.CylinderGeometry(0.48, 0.60, 4.2, radial);
  lower.translate(0, 2.1, 0);
  parts.push(lower);

  // Upper tapering columnar trunk
  const upper = new THREE.CylinderGeometry(0.38, 0.48, 4.4, radial);
  upper.translate(0, 6.4, 0);
  parts.push(upper);

  // Crown collar with persistent spiny leaf bases
  const collar = new THREE.CylinderGeometry(0.52, 0.38, 1.6, radial);
  collar.translate(0, 9.2, 0);
  parts.push(collar);

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** African Fan Palm Crown: Pleated palmate fan fronds radiating on curved petioles */
function buildFanPalmCrownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const count = 18;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const droop = 0.28 + (i % 3) * 0.18;

    // Long spiny petiole rachis
    const petiole = new THREE.CylinderGeometry(0.04, 0.08, 2.4, 8);
    petiole.rotateZ(droop);
    petiole.rotateY(angle);
    petiole.translate(Math.sin(angle) * 1.1, 9.8, Math.cos(angle) * 1.1);
    parts.push(petiole);

    // Natural pleated semicircular fan blade (16 segments radiating outward)
    const fanSegments = 16;
    const fanPositions: number[] = [];
    const fanIndices: number[] = [];
    const fanUvs: number[] = [];

    const fanRadius = 1.65;
    const centerPt = new THREE.Vector3(
      Math.sin(angle) * 2.8,
      9.9 - droop * 1.1,
      Math.cos(angle) * 2.8
    );

    fanPositions.push(centerPt.x, centerPt.y, centerPt.z);
    fanUvs.push(0.5, 0.5);

    const startAng = angle - Math.PI * 0.45;
    const spanAng = Math.PI * 0.9;

    for (let k = 0; k <= fanSegments; k++) {
      const fAng = startAng + (k / fanSegments) * spanAng;
      const pleatY = (k % 2 === 0 ? 0.08 : -0.08);
      const tipX = centerPt.x + Math.sin(fAng) * fanRadius;
      const tipY = centerPt.y + pleatY - (droop * 0.4);
      const tipZ = centerPt.z + Math.cos(fAng) * fanRadius;
      fanPositions.push(tipX, tipY, tipZ);
      fanUvs.push(0.5 + Math.sin(fAng) * 0.48, 0.5 + Math.cos(fAng) * 0.48);

      if (k > 0) {
        fanIndices.push(0, k, k + 1);
        fanIndices.push(0, k + 1, k); // double-sided
      }
    }

    const fanGeo = new THREE.BufferGeometry();
    fanGeo.setAttribute("position", new THREE.Float32BufferAttribute(fanPositions, 3));
    fanGeo.setAttribute("uv", new THREE.Float32BufferAttribute(fanUvs, 2));
    fanGeo.setIndex(fanIndices);
    fanGeo.computeVertexNormals();
    parts.push(fanGeo);
  }

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Umbrella Acacia (Acacia tortilis / Vachellia): Sinuous gnarled savannah trunk with natural forks */
function buildAcaciaTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const radial = 10;

  // Sinuous lower trunk with natural tilt and buttress
  const trunk = new THREE.CylinderGeometry(0.36, 0.52, 4.6, radial);
  trunk.rotateZ(0.14);
  trunk.rotateY(0.2);
  trunk.translate(0.35, 2.3, 0);
  parts.push(trunk);

  // Bough 1: Spreading west-northwest with upward reach
  const bough1 = new THREE.CylinderGeometry(0.12, 0.24, 4.4, radial);
  bough1.rotateZ(-Math.PI / 3.4);
  bough1.rotateY(0.45);
  bough1.translate(-1.9, 4.8, 0.7);
  parts.push(bough1);

  // Bough 2: Spreading east-southeast
  const bough2 = new THREE.CylinderGeometry(0.12, 0.22, 4.0, radial);
  bough2.rotateZ(Math.PI / 3.2);
  bough2.rotateY(-0.55);
  bough2.translate(1.8, 4.7, -0.8);
  parts.push(bough2);

  // Bough 3: Upright spreading central fork
  const bough3 = new THREE.CylinderGeometry(0.11, 0.20, 3.6, radial);
  bough3.rotateX(-0.28);
  bough3.translate(0.3, 5.4, -1.2);
  parts.push(bough3);

  // Bough 4: Secondary branch fork
  const bough4 = new THREE.CylinderGeometry(0.10, 0.17, 2.8, radial);
  bough4.rotateZ(-0.35);
  bough4.rotateX(0.3);
  bough4.translate(-1.1, 5.9, 1.4);
  parts.push(bough4);

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Acacia Canopy: Layered, rounded foliage clusters under a broad umbrella silhouette */
function buildAcaciaFoliageGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const pads = [
    { x: 0, y: 7.4, z: 0, s: 6.2 },
    { x: -2.6, y: 6.8, z: 1.0, s: 4.8 },
    { x: 2.5, y: 6.6, z: -1.1, s: 4.4 },
    { x: 0.4, y: 7.1, z: -2.2, s: 4.0 },
    { x: -0.9, y: 8.0, z: 0.6, s: 3.6 },
    { x: 1.8, y: 7.3, z: 1.8, s: 3.4 },
  ];

  pads.forEach((p) => {
    // Overlapping ellipsoids read as small leaf masses from both street and
    // aerial views, without the flat crossed cards that formed dark X shapes.
    const crown = new THREE.SphereGeometry(1, 14, 10);
    crown.scale(p.s * 0.52, Math.max(1.0, p.s * 0.20), p.s * 0.40);
    crown.rotateY((p.x + p.z) * 0.07);
    crown.translate(p.x, p.y, p.z);
    parts.push(crown);
  });

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Flamboyant Flame Tree (Delonix regia): Spreading umbrella with climbing limbs */
function buildFlamboyantTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const radial = 12;

  // Broad buttressed root base
  const base = new THREE.CylinderGeometry(0.50, 1.1, 1.6, radial);
  base.translate(0, 0.8, 0);
  parts.push(base);

  const trunk = new THREE.CylinderGeometry(0.42, 0.50, 2.6, radial);
  trunk.translate(0, 2.6, 0);
  parts.push(trunk);

  const limbAngles = [0.3, 1.9, 3.5, 5.1];
  limbAngles.forEach((ang, idx) => {
    const len = 3.8 + (idx % 2) * 0.7;
    const limb = new THREE.CylinderGeometry(0.12, 0.23, len, 10);
    limb.rotateZ(Math.PI / 3.1);
    limb.rotateY(ang);
    limb.translate(Math.sin(ang) * (len * 0.42), 4.4 + (idx % 2) * 0.3, Math.cos(ang) * (len * 0.42));
    parts.push(limb);
  });

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Flamboyant Tree Canopy: Spreading foliage canopy with Delonix blossom clusters */
function buildFlamboyantCrownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const clusters = [
    { x: 0, y: 6.8, z: 0, s: 5.6 },
    { x: 2.7, y: 6.1, z: 1.3, s: 4.4 },
    { x: -2.5, y: 6.2, z: 1.4, s: 4.2 },
    { x: -2.3, y: 6.0, z: -2.0, s: 4.4 },
    { x: 2.5, y: 6.1, z: -1.8, s: 4.2 },
    { x: 0.3, y: 7.5, z: 0.4, s: 3.8 },
    { x: 3.6, y: 5.5, z: -0.2, s: 3.4 },
    { x: -3.5, y: 5.6, z: 0.3, s: 3.4 },
  ];

  clusters.forEach((c) => {
    const hPlane = new THREE.CylinderGeometry(c.s * 0.5, c.s * 0.5, 0.05, 12);
    hPlane.scale(1.0, 1.0, 0.85);
    hPlane.translate(c.x, c.y, c.z);
    parts.push(hPlane);

    const cardA = new THREE.PlaneGeometry(c.s * 0.95, c.s * 0.52);
    cardA.rotateX(0.22);
    cardA.translate(c.x, c.y, c.z);
    parts.push(cardA);

    const cardB = new THREE.PlaneGeometry(c.s * 0.95, c.s * 0.52);
    cardB.rotateY(Math.PI / 2);
    cardB.rotateX(-0.22);
    cardB.translate(c.x, c.y, c.z);
    parts.push(cardB);
  });

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Low savannah organic bush: Built from smooth multi-billowed leafy volumes (no dodecahedrons) */
function buildShrubGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const lobes = [
    { x: 0, y: 0.65, z: 0, sx: 1.1, sy: 0.7, sz: 1.0 },
    { x: 0.42, y: 0.55, z: 0.28, sx: 0.85, sy: 0.6, sz: 0.8 },
    { x: -0.38, y: 0.52, z: -0.24, sx: 0.8, sy: 0.58, sz: 0.75 },
    { x: 0.12, y: 0.78, z: -0.32, sx: 0.75, sy: 0.55, sz: 0.7 },
    { x: -0.25, y: 0.58, z: 0.35, sx: 0.72, sy: 0.52, sz: 0.68 },
  ];

  lobes.forEach((l) => {
    const lobe = new THREE.SphereGeometry(0.75, 12, 10);
    lobe.scale(l.sx, l.sy, l.sz);
    lobe.translate(l.x, l.y, l.z);
    parts.push(lobe);
  });

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Flowering Bougainvillea Bush: Cascading leafy mound with smooth organic volumes (no dodecahedrons) */
function buildBougainvilleaGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const lobes = [
    { x: 0, y: 0.75, z: 0, sx: 1.2, sy: 0.75, sz: 1.1 },
    { x: 0.55, y: 0.65, z: 0.35, sx: 0.9, sy: 0.65, sz: 0.85 },
    { x: -0.50, y: 0.60, z: -0.28, sx: 0.85, sy: 0.6, sz: 0.8 },
    { x: 0.22, y: 0.88, z: -0.38, sx: 0.8, sy: 0.58, sz: 0.75 },
    { x: -0.22, y: 0.68, z: 0.45, sx: 0.78, sy: 0.55, sz: 0.72 },
  ];

  lobes.forEach((l) => {
    const lobe = new THREE.SphereGeometry(0.72, 12, 10);
    lobe.scale(l.sx, l.sy, l.sz);
    lobe.translate(l.x, l.y, l.z);
    parts.push(lobe);
  });

  const merged = safeMergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Weathered Nigerian granite boulder */
function buildBoulderGeometry(): THREE.BufferGeometry {
  const rock = new THREE.SphereGeometry(1.3, 10, 8);
  rock.scale(1.3, 0.72, 1.15);
  rock.translate(0, 0.75, 0);
  rock.computeVertexNormals();
  return rock;
}

// Pre-create shared geometries once for fast instancing
const geoRoyalPalmTrunk = buildRoyalPalmTrunkGeometry();
const geoRoyalPalmCrown = buildRoyalPalmCrownGeometry();
const geoFanPalmTrunk = buildFanPalmTrunkGeometry();
const geoFanPalmCrown = buildFanPalmCrownGeometry();
const geoAcaciaTrunk = buildAcaciaTrunkGeometry();
const geoAcaciaFoliage = buildAcaciaFoliageGeometry();
const geoFlamboyantTrunk = buildFlamboyantTrunkGeometry();
const geoFlamboyantCrown = buildFlamboyantCrownGeometry();
const geoShrub = buildShrubGeometry();
const geoBougainvillea = buildBougainvilleaGeometry();
const geoBoulder = buildBoulderGeometry();
[
  geoRoyalPalmTrunk,
  geoRoyalPalmCrown,
  geoFanPalmTrunk,
  geoFanPalmCrown,
  geoAcaciaTrunk,
  geoAcaciaFoliage,
  geoFlamboyantTrunk,
  geoFlamboyantCrown,
  geoShrub,
  geoBougainvillea,
  geoBoulder,
].forEach(markWorldResourceShared);
export interface TreeInstanceData {
  x: number;
  z: number;
  scale?: number;
  rotation?: number;
}

/**
 * Builds the comprehensive Abuja Environmental Vegetation System:
 * Instanced Royal Palms, African Fan Palms, Umbrella Acacias, Flamboyant Flame Trees,
 * Savannah Shrubs, Flowering Bougainvillea, and Granite Boulders.
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
      const s = inst.scale ?? (0.85 + (i % 7) * 0.05);
      const seed = Math.sin(inst.x * 127.1 + inst.z * 311.7 + (i + 1) * 74.7);
      const variation = seed - Math.floor(seed);
      const radialScale = 0.92 + variation * 0.16;
      const heightScale = 0.94 + ((variation * 7.13) % 1) * 0.12;
      const r = (inst.rotation ?? ((i * 1.37) % (Math.PI * 2))) + (variation - 0.5) * 0.18;

      dummy.position.set(inst.x, y, inst.z);
      dummy.scale.set(s * radialScale, s * heightScale, s * radialScale);
      dummy.rotation.set(0, r, 0);
      dummy.updateMatrix();

      trunkMesh.setMatrixAt(i, dummy.matrix);
      crownMesh.setMatrixAt(i, dummy.matrix);
      const trunkTone = 0.96 + variation * 0.08;
      const crownTone = 0.90 + variation * 0.16;
      trunkMesh.setColorAt(i, new THREE.Color(trunkTone, trunkTone * 0.99, trunkTone * 0.97));
      crownMesh.setColorAt(i, new THREE.Color(crownTone, crownTone * 1.02, crownTone * 0.94));
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
    if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true;
    if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;
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
      const s = inst.scale ?? (0.8 + (i % 5) * 0.08);
      const seed = Math.sin(inst.x * 127.1 + inst.z * 311.7 + (i + 1) * 41.3);
      const variation = seed - Math.floor(seed);
      const r = inst.rotation ?? ((i * 1.57) % (Math.PI * 2));

      dummy.position.set(inst.x, y, inst.z);
      dummy.scale.set(s * (0.9 + variation * 0.2), s * (0.94 + variation * 0.12), s * (0.9 + variation * 0.2));
      dummy.rotation.set(0, r, 0);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
      const tone = 0.88 + variation * 0.18;
      mesh.setColorAt(i, new THREE.Color(tone, tone * 1.03, tone * 0.94));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  // -------------------------------------------------------------
  // REALISTIC DISTRIBUTION ACROSS ABUJA DISTRICTS
  // -------------------------------------------------------------
  const royalPalms: TreeInstanceData[] = [];
  const fanPalms: TreeInstanceData[] = [];
  const acacias: TreeInstanceData[] = [];
  const flamboyants: TreeInstanceData[] = [];
  const shrubs: TreeInstanceData[] = [];
  const bougainvilleas: TreeInstanceData[] = [];
  const boulders: TreeInstanceData[] = [];

  // 1. Shehu Shagari Way (North-South Arterial) Medians & Sidewalk Verges
  for (let z = -140; z <= 140; z += 18) {
    if (Math.abs(z) < 42) continue;
    if (z % 36 === 0) {
      royalPalms.push({ x: 0, z, scale: 1.05 });
    }
    if (z % 36 === 18) {
      flamboyants.push({ x: -21.5, z, scale: 0.95 });
      flamboyants.push({ x: 21.5, z, scale: 0.95 });
    } else {
      royalPalms.push({ x: -21.5, z, scale: 1.0 });
      royalPalms.push({ x: 21.5, z, scale: 1.0 });
    }
    // Keep median planting inside its 2.4m island, clear of the yellow lane lines.
    shrubs.push({ x: 0, z: z + 6, scale: 0.34 });
    bougainvilleas.push({ x: 0, z: z + 12, scale: 0.32 });
  }

  // 2. Constitution Avenue (East-West Arterial) Medians & Verges
  for (let x = -130; x <= 130; x += 20) {
    if (Math.abs(x) < 42) continue;
    // Plant on the outer verges instead of the carriageway center line or paving.
    fanPalms.push({ x, z: -20.5, scale: 0.95 });
    fanPalms.push({ x, z: 20.5, scale: 0.95 });

    shrubs.push({ x: x + 8, z: 20.2, scale: 0.48 });
    bougainvilleas.push({ x: x - 8, z: -20.2, scale: 0.46 });
  }

  // 3. Central Monumental Roundabout Perimeter Landscaping
  for (let a = 0; a < 16; a++) {
    const angle = (a / 16) * Math.PI * 2;
    const rx = Math.cos(angle) * 26.5;
    const rz = Math.sin(angle) * 26.5;
    if (a % 2 === 0) {
      royalPalms.push({ x: rx, z: rz, scale: 1.1 });
    } else {
      flamboyants.push({ x: rx, z: rz, scale: 0.9 });
    }
    shrubs.push({ x: Math.cos(angle) * 24.5, z: Math.sin(angle) * 24.5, scale: 0.65 });
  }

  // 4. Millennium Park & Botanical Garden Groves (x: 0, z: 50)
  for (let px = -35; px <= 35; px += 14) {
    for (let pz = 22; pz <= 78; pz += 14) {
      if (Math.hypot(px, pz - 50) < 14) continue;
      if (Math.abs(px) < 5 || Math.abs(pz - 50) < 5) continue;

      const seed = Math.abs(px * 13 + pz * 17);
      if (seed % 4 === 0) {
        flamboyants.push({ x: px, z: pz, scale: 1.0 + (seed % 3) * 0.08 });
      } else if (seed % 4 === 1) {
        royalPalms.push({ x: px, z: pz, scale: 1.05 });
      } else if (seed % 4 === 2) {
        acacias.push({ x: px, z: pz, scale: 0.95 });
      } else {
        bougainvilleas.push({ x: px, z: pz, scale: 1.1 });
      }
    }
  }

  // 5. Maitama Villa & Diplomatic Zone Lush Landscaping (x: -65, z: -35)
  for (let vx = -85; vx <= -45; vx += 10) {
    for (let vz = -55; vz <= -15; vz += 10) {
      if (Math.abs(vx - (-65)) < 16 && Math.abs(vz - (-35)) < 14) continue;
      const seed = Math.abs(vx * 7 + vz * 11);
      if (seed % 3 === 0) {
        royalPalms.push({ x: vx, z: vz, scale: 1.0 + (seed % 4) * 0.05 });
      } else if (seed % 3 === 1) {
        flamboyants.push({ x: vx, z: vz, scale: 0.95 });
      } else {
        bougainvilleas.push({ x: vx, z: vz, scale: 0.85 });
      }
    }
  }

  // 6. Natural Aso Rock Granite Boulder Foothills (x: 40, z: -495)
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2;
    const r = 55 + (i % 4) * 12;
    boulders.push({
      x: 40 + Math.cos(ang) * r,
      z: -495 + Math.sin(ang) * (r * 0.7),
      scale: 0.8 + (i % 5) * 0.25,
      rotation: i * 0.85,
    });
    if (i % 2 === 0) {
      acacias.push({
        x: 40 + Math.cos(ang) * (r + 14),
        z: -495 + Math.sin(ang) * ((r + 14) * 0.7),
        scale: 0.9 + (i % 3) * 0.1,
      });
    }
  }

  // Assemble into root group
  const rp = createDualInstanced(
    geoRoyalPalmTrunk,
    vegetationMaterials.royalPalmTrunk,
    geoRoyalPalmCrown,
    vegetationMaterials.royalPalmCrown,
    royalPalms,
    "RoyalPalm",
  );
  if (rp) { root.add(rp[0]); root.add(rp[1]); }

  const fp = createDualInstanced(
    geoFanPalmTrunk,
    vegetationMaterials.fanPalmTrunk,
    geoFanPalmCrown,
    vegetationMaterials.fanPalmCrown,
    fanPalms,
    "FanPalm",
  );
  if (fp) { root.add(fp[0]); root.add(fp[1]); }

  const ac = createDualInstanced(
    geoAcaciaTrunk,
    vegetationMaterials.acaciaBark,
    geoAcaciaFoliage,
    vegetationMaterials.acaciaFoliage,
    acacias,
    "Acacia",
  );
  if (ac) { root.add(ac[0]); root.add(ac[1]); }

  const fl = createDualInstanced(
    geoFlamboyantTrunk,
    vegetationMaterials.flamboyantTrunk,
    geoFlamboyantCrown,
    vegetationMaterials.flamboyantCrown,
    flamboyants,
    "Flamboyant",
  );
  if (fl) { root.add(fl[0]); root.add(fl[1]); }

  const shMesh = createSingleInstanced(geoShrub, vegetationMaterials.shrubFoliage, shrubs, "AbujaShrubs");
  if (shMesh) root.add(shMesh);

  const bgMesh = createSingleInstanced(geoBougainvillea, vegetationMaterials.bougainvilleaFlowers, bougainvilleas, "AbujaBougainvillea");
  if (bgMesh) root.add(bgMesh);

  const bdMesh = createSingleInstanced(geoBoulder, vegetationMaterials.graniteBoulder, boulders, "AbujaBoulders");
  if (bdMesh) root.add(bdMesh);

  return root;
}
