import * as THREE from "three";
import type { Collider, GameMaterials } from "./types";

function addBox(
  parent: THREE.Group,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Group,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments = 16,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeHistoricSignMaterial(text: string, bgColor = "#78350f", textColor = "#fef3c7"): THREE.MeshStandardMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 128);

    // Hausa geometric decorative border using standard fillRect
    ctx.fillStyle = "#d97706";
    ctx.fillRect(6, 6, 500, 116);
    ctx.fillStyle = bgColor;
    ctx.fillRect(10, 10, 492, 108);

    if (typeof ctx.strokeRect === "function") {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(12, 12, 488, 104);
    }

    if (typeof ctx.arc === "function" && typeof ctx.beginPath === "function") {
      ctx.fillStyle = "#d97706";
      for (const [cx, cy] of [[12, 12], [500, 12], [12, 116], [500, 116]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = textColor;
    ctx.font = "bold 26px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (typeof ctx.fillText === "function") {
      ctx.fillText(text, 256, 64);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.5,
    metalness: 0.1,
  });
}

// 1. Dala Hill (Tudun Dala) (-95, 0, -95) - 18m Stepped Sandstone Hill & Summit Lookout
function buildDalaHill(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-95, 0, -95);
  const cx = -95;
  const cz = -95;

  const rockMat = materials.ochre;
  const darkRockMat = materials.clay;
  const stoneMat = materials.stone;

  // Tier 1: Base footprint (32m x 32m, height 4.2m)
  addBox(group, rockMat, 0, 2.1, 0, 32, 4.2, 32);
  colliders.push({ x: cx, z: cz, halfX: 15.5, halfZ: 15.5, height: 4.5 });

  // Tier 2: Mid slope (25m x 25m, height 4.5m up to 8.7m)
  addBox(group, darkRockMat, -0.5, 6.45, -0.5, 25, 4.5, 25);
  colliders.push({ x: cx - 0.5, z: cz - 0.5, halfX: 12.0, halfZ: 12.0, height: 9.0 });

  // Tier 3: Upper slope (18m x 18m, height 4.5m up to 13.2m)
  addBox(group, rockMat, -1.0, 10.95, -1.0, 18, 4.5, 18);
  colliders.push({ x: cx - 1.0, z: cz - 1.0, halfX: 8.5, halfZ: 8.5, height: 13.5 });

  // Tier 4: Summit Terrace (11m x 11m, height 4.5m up to 17.7m)
  addBox(group, stoneMat, -1.5, 15.45, -1.5, 11, 4.5, 11);
  colliders.push({ x: cx - 1.5, z: cz - 1.5, halfX: 5.2, halfZ: 5.2, height: 18.0 });

  // Summit lookout parapet & flagstone floor
  addBox(group, stoneMat, -1.5, 17.7, -1.5, 10.4, 0.2, 10.4);
  // Parapet walls
  for (const pos of [
    { x: -1.5, z: -6.4, w: 10.4, d: 0.5 },
    { x: -1.5, z: 3.4, w: 10.4, d: 0.5 },
    { x: -6.4, z: -1.5, w: 0.5, d: 9.4 },
    { x: 3.4, z: -1.5, w: 0.5, d: 9.4 },
  ]) {
    addBox(group, materials.compoundWall, pos.x, 18.25, pos.z, pos.w, 0.9, pos.d);
  }

  // Ancient sandstone monolith / beacon pillar on summit
  addCylinder(group, stoneMat, -1.5, 19.8, -1.5, 0.8, 1.1, 3.8);
  colliders.push({ x: cx - 1.5, z: cz - 1.5, halfX: 1.0, halfZ: 1.0, height: 21.0 });

  // Beacon fire basin on top of monolith
  addCylinder(group, materials.metal, -1.5, 21.8, -1.5, 1.3, 0.7, 0.6);
  // Amber charcoal embers
  addCylinder(group, materials.roof, -1.5, 22.0, -1.5, 1.1, 1.1, 0.2);

  // Stepped pedestrian path winding up the eastern face
  // 10 landing steps ascending from ground to summit
  for (let i = 0; i < 10; i += 1) {
    const stepY = i * 1.75;
    const stepX = 14 - i * 1.4;
    const stepZ = -3 + (i % 2 === 0 ? 0.4 : -0.4);
    addBox(group, stoneMat, stepX, stepY + 0.85, stepZ, 3.2, 1.7, 2.8);
  }

  // Historic signboard at the base
  const signMat = makeHistoricSignMaterial("TUDUN DALA · HISTORIC SUMMIT LOOKOUT", "#451a03", "#fde68a");
  addBox(group, signMat, 15.5, 2.2, 3.5, 0.15, 0.9, 3.6);
  addBox(group, materials.wood, 15.5, 1.0, 2.0, 0.15, 2.0, 0.15);
  addBox(group, materials.wood, 15.5, 1.0, 5.0, 0.15, 2.0, 0.15);

  // Scatter sandstone boulders around the perimeter
  const boulderCoords = [
    { x: 14, z: 12, s: 2.2 },
    { x: -14, z: 13, s: 2.6 },
    { x: -15, z: -14, s: 3.1 },
    { x: 13, z: -15, s: 2.4 },
    { x: 16, z: -2, s: 1.8 },
  ];
  boulderCoords.forEach((b) => {
    addBox(group, rockMat, b.x, b.s / 2, b.z, b.s, b.s, b.s);
    colliders.push({ x: cx + b.x, z: cz + b.z, halfX: b.s / 2 + 0.2, halfZ: b.s / 2 + 0.2, height: b.s });
  });

  return group;
}

// 2. Kofar Dala Gate & Ancient City Wall (Badala) (-62, 0, -93)
function buildKofarDalaGate(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-62, 0, -93);
  const cx = -62;
  const cz = -93;

  const wallMat = materials.compoundWall;
  const earthenMat = materials.clay;
  const woodMat = materials.wood;

  // Massive Mud-Brick Defensive Walls (Ganuwar Birnin Kano)
  // Wall 1: South Section (z from +5 to +26, length 21m, thickness 2.6m, height 5.4m)
  addBox(group, wallMat, 0, 2.7, 15.5, 2.6, 5.4, 21.0);
  colliders.push({ x: cx, z: cz + 15.5, halfX: 1.4, halfZ: 10.6, height: 5.5 });

  // Wall 2: North Section (z from -5 to -26, length 21m, thickness 2.6m, height 5.4m)
  addBox(group, wallMat, 0, 2.7, -15.5, 2.6, 5.4, 21.0);
  colliders.push({ x: cx, z: cz - 15.5, halfX: 1.4, halfZ: 10.6, height: 5.5 });

  // Crenellated pointed parapet (merlons) along both wall tops
  for (let z = 5; z <= 25; z += 2.2) {
    addBox(group, earthenMat, 0, 5.8, z, 2.6, 0.8, 1.1);
  }
  for (let z = -25; z <= -5; z += 2.2) {
    addBox(group, earthenMat, 0, 5.8, z, 2.6, 0.8, 1.1);
  }

  // Fortified Gate Bastion Towers flanking the 10m gateway
  // South Bastion Tower (5m x 5m, height 8.6m) at z = +4.5
  addBox(group, earthenMat, 0, 4.3, 4.5, 4.8, 8.6, 4.2);
  colliders.push({ x: cx, z: cz + 4.5, halfX: 2.5, halfZ: 2.2, height: 8.8 });

  // North Bastion Tower (5m x 5m, height 8.6m) at z = -4.5
  addBox(group, earthenMat, 0, 4.3, -4.5, 4.8, 8.6, 4.2);
  colliders.push({ x: cx, z: cz - 4.5, halfX: 2.5, halfZ: 2.2, height: 8.8 });

  // Daurin Guga Pinnacles on Bastion Rooftops
  for (const bx of [-2.0, 2.0]) {
    for (const bz of [-1.6, 1.6]) {
      addCylinder(group, materials.ochre, bx, 9.2, 4.5 + bz, 0.15, 0.35, 1.2);
      addCylinder(group, materials.ochre, bx, 9.2, -4.5 + bz, 0.15, 0.35, 1.2);
    }
  }

  // Monumental Overhead Arch spanning the 10m road (clearance 5.8m high)
  addBox(group, earthenMat, 0, 7.2, 0, 4.2, 2.8, 10.0);
  // Arched underside trim
  addBox(group, woodMat, 0, 5.7, 0, 4.3, 0.3, 10.0);

  // Large Arched Gate Signboard
  const gateSignMat = makeHistoricSignMaterial("KOFAR DALA · HISTORIC CITY GATE", "#451a03", "#fef3c7");
  addBox(group, gateSignMat, 2.2, 7.2, 0, 0.18, 1.1, 8.2);
  addBox(group, gateSignMat, -2.2, 7.2, 0, 0.18, 1.1, 8.2);

  // Folded Heavy Iron-Studded Timber Gate Doors (folded open against stone portals)
  addBox(group, woodMat, 0, 2.8, 3.2, 0.4, 5.2, 2.8);
  addBox(group, woodMat, 0, 2.8, -3.2, 0.4, 5.2, 2.8);
  // Iron bands
  for (const gy of [1.2, 2.8, 4.4]) {
    addBox(group, materials.metal, 0, gy, 3.2, 0.46, 0.15, 2.85);
    addBox(group, materials.metal, 0, gy, -3.2, 0.46, 0.15, 2.85);
  }

  // Guard walk timber bridge over the arch
  addBox(group, woodMat, 0, 8.7, 0, 3.2, 0.2, 10.0);
  // Parapets
  addBox(group, materials.metal, 1.5, 9.2, 0, 0.1, 0.8, 10.0);
  addBox(group, materials.metal, -1.5, 9.2, 0, 0.1, 0.8, 10.0);

  return group;
}

// 3. Kasuwar Kurmi Traditional Crafts & Herb Market (-75, 0, -85)
function buildKurmiMarket(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-75, 0, -85);
  const cx = -75;
  const cz = -85;

  const woodMat = materials.wood;
  const fabricMat = materials.clothRed;
  const ochreCloth = materials.ochre;
  const darkCloth = materials.cloth;

  // Market Gateway & Shaded Bazaars
  // Central market awning promenade (18m long x 10m wide)
  // Timber pillars
  const pillarCoords = [
    [-8, -4], [-8, 4],
    [-2, -4], [-2, 4],
    [4, -4], [4, 4],
    [8, -4], [8, 4],
  ];
  pillarCoords.forEach(([px, pz]) => {
    addCylinder(group, woodMat, px, 1.8, pz, 0.12, 0.15, 3.6);
  });

  // Roof timber beams
  addBox(group, woodMat, 0, 3.6, -4, 18, 0.18, 0.2);
  addBox(group, woodMat, 0, 3.6, 4, 18, 0.18, 0.2);
  for (const bx of [-8, -2, 4, 8]) {
    addBox(group, woodMat, bx, 3.65, 0, 0.2, 0.18, 8.2);
  }

  // Multi-colored striped awning canopies
  const canopies = [
    { x: -5, z: 0, mat: fabricMat },
    { x: 1, z: 0, mat: ochreCloth },
    { x: 6, z: 0, mat: darkCloth },
  ];
  canopies.forEach((c) => {
    addBox(group, c.mat, c.x, 3.75, c.z, 5.8, 0.08, 8.1);
  });

  // Stall 1: Leatherwork & Traditional Bags (-6, 0, -3.2)
  addBox(group, woodMat, -6, 0.5, -3.2, 3.4, 1.0, 1.5);
  colliders.push({ x: cx - 6, z: cz - 3.2, halfX: 1.8, halfZ: 0.9, height: 2.5 });
  // Leather goods displays
  addBox(group, materials.roof, -6, 1.15, -3.2, 3.0, 0.3, 1.2);
  // Hanging leather satchels
  for (const lx of [-6.8, -6.0, -5.2]) {
    addBox(group, materials.roof, lx, 2.5, -3.2, 0.45, 0.6, 0.1);
  }

  // Stall 2: Brass & Metal Craftwork (0, 0, -3.2)
  addBox(group, woodMat, 0, 0.5, -3.2, 3.4, 1.0, 1.5);
  colliders.push({ x: cx, z: cz - 3.2, halfX: 1.8, halfZ: 0.9, height: 2.5 });
  // Brass display teapots and bowls
  for (const mx of [-0.8, 0, 0.8]) {
    addCylinder(group, materials.metal, mx, 1.25, -3.2, 0.22, 0.28, 0.5);
  }

  // Stall 3: Traditional Spices & Medicinal Herbs (6, 0, -3.2)
  addBox(group, woodMat, 6, 0.5, -3.2, 3.4, 1.0, 1.5);
  colliders.push({ x: cx + 6, z: cz - 3.2, halfX: 1.8, halfZ: 0.9, height: 2.5 });
  // Burlap spice sacks
  for (const sx of [5.2, 6.0, 6.8]) {
    addCylinder(group, materials.compoundWall, sx, 0.7, -2.0, 0.35, 0.38, 0.8);
  }

  // Stall 4: Carved Calabashes & Pottery (-6, 0, 3.2)
  addBox(group, woodMat, -6, 0.5, 3.2, 3.4, 1.0, 1.5);
  colliders.push({ x: cx - 6, z: cz + 3.2, halfX: 1.8, halfZ: 0.9, height: 2.5 });
  // Calabash half-spheres
  for (const cx2 of [-6.8, -6.0, -5.2]) {
    addCylinder(group, materials.ochre, cx2, 1.15, 3.2, 0.32, 0.15, 0.3);
  }

  // Stall 5: Woven Guinea Brocade & Caps (0, 0, 3.2)
  addBox(group, woodMat, 0, 0.5, 3.2, 3.4, 1.0, 1.5);
  colliders.push({ x: cx, z: cz + 3.2, halfX: 1.8, halfZ: 0.9, height: 2.5 });
  // Folded fabrics
  addBox(group, materials.white, -0.6, 1.15, 3.2, 0.9, 0.3, 1.1);
  addBox(group, materials.kekeGreen, 0.6, 1.15, 3.2, 0.9, 0.3, 1.1);

  // Stall 6: Blacksmith Tools & Anvil (6, 0, 3.2)
  addBox(group, woodMat, 6, 0.5, 3.2, 3.4, 1.0, 1.5);
  colliders.push({ x: cx + 6, z: cz + 3.2, halfX: 1.8, halfZ: 0.9, height: 2.5 });
  // Heavy cast iron anvil
  addBox(group, materials.black, 6, 1.25, 3.2, 0.8, 0.5, 0.4);

  // Market entrance arched sign
  const marketSignMat = makeHistoricSignMaterial("KASUWAR KURMI · 15TH CENTURY TRADITIONAL MARKET", "#78350f", "#fef3c7");
  addBox(group, marketSignMat, 0, 4.2, -4.2, 9.6, 0.85, 0.12);

  return group;
}

// 4. Alhaji Dan-Kano Ancestral Trading Compound & Zaure (-85, 0, -68)
function buildDanKanoCompound(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-85, 0, -68);
  const cx = -85;
  const cz = -68;

  const wallMat = materials.compoundWall;
  const earthenMat = materials.clay;
  const woodMat = materials.wood;

  // Compound Dimensions: 22m wide x 18m deep
  const halfW = 11;
  const halfD = 9;

  // Perimeter Earthen Compound Walls (3.8m high)
  // Back Wall (north): x from -11 to +11 at z = -9
  addBox(group, wallMat, 0, 1.9, -halfD, 22, 3.8, 0.8);
  colliders.push({ x: cx, z: cz - halfD, halfX: 11.2, halfZ: 0.5, height: 4.0 });

  // West Wall: z from -9 to +9 at x = -11
  addBox(group, wallMat, -halfW, 1.9, 0, 0.8, 3.8, 18);
  colliders.push({ x: cx - halfW, z: cz, halfX: 0.5, halfZ: 9.2, height: 4.0 });

  // East Wall: z from -9 to +9 at x = +11
  addBox(group, wallMat, halfW, 1.9, 0, 0.8, 3.8, 18);
  colliders.push({ x: cx + halfW, z: cz, halfX: 0.5, halfZ: 9.2, height: 4.0 });

  // Front Wall (south): split by Zaure entrance (width 8m at center)
  // West flank
  addBox(group, wallMat, -7.5, 1.9, halfD, 7.0, 3.8, 0.8);
  colliders.push({ x: cx - 7.5, z: cz + halfD, halfX: 3.6, halfZ: 0.5, height: 4.0 });
  // East flank
  addBox(group, wallMat, 7.5, 1.9, halfD, 7.0, 3.8, 0.8);
  colliders.push({ x: cx + 7.5, z: cz + halfD, halfX: 3.6, halfZ: 0.5, height: 4.0 });

  // Daurin Guga Decorative Pinnacles on every corner and parapet
  for (const px of [-halfW, halfW]) {
    for (const pz of [-halfD, halfD]) {
      addCylinder(group, materials.ochre, px, 4.4, pz, 0.15, 0.35, 1.2);
    }
  }

  // Monumental Entrance ZAURE (7.2m wide x 5.5m deep x 4.6m high) at center front
  // The Zaure is the historic Hausa vestibule where the family elder sits and archives are kept
  addBox(group, earthenMat, 0, 2.3, halfD, 7.6, 4.6, 5.6);
  colliders.push({ x: cx, z: cz + halfD, halfX: 3.9, halfZ: 2.9, height: 4.8 });

  // Arched Front Portal Opening through Zaure
  addBox(group, woodMat, 0, 1.7, halfD + 2.85, 2.4, 3.4, 0.2);
  // Heavy carved wood door panels
  addBox(group, woodMat, -0.6, 1.7, halfD + 2.9, 1.1, 3.2, 0.15);
  addBox(group, woodMat, 0.6, 1.7, halfD + 2.9, 1.1, 3.2, 0.15);

  // Zaure Arch Signboard
  const zaureSignMat = makeHistoricSignMaterial("GIDAN DAN-KANO · ANCESTRAL TRADING HOUSE", "#451a03", "#fef3c7");
  addBox(group, zaureSignMat, 0, 4.1, halfD + 2.95, 6.8, 0.8, 0.15);

  // Clay sitting bench (Dakali) on front veranda for visitors and elders
  addBox(group, earthenMat, -2.6, 0.45, halfD + 3.2, 2.2, 0.9, 0.8);
  addBox(group, earthenMat, 2.6, 0.45, halfD + 3.2, 2.2, 0.9, 0.8);

  // Interior Zaure Story Station:
  // Grandfather's Cedarwood Document Chest & Brass Seal Desk (accessible on porch)
  addBox(group, woodMat, 2.5, 0.8, halfD + 1.2, 1.4, 0.8, 0.9);
  // Cedarwood antique chest
  addBox(group, materials.roof, 2.5, 1.4, halfD + 1.2, 1.1, 0.45, 0.65);
  // Brass merchant seal on top of chest
  addCylinder(group, materials.metal, 2.5, 1.7, halfD + 1.2, 0.15, 0.15, 0.12);

  // Courtyard inner residence building (12m x 6m x 4m)
  addBox(group, wallMat, 0, 2.0, -4.5, 12, 4.0, 6.0);
  colliders.push({ x: cx, z: cz - 4.5, halfX: 6.2, halfZ: 3.2, height: 4.2 });

  // Shaded Neem Tree in courtyard
  addCylinder(group, materials.wood, -5.5, 2.2, -1.0, 0.35, 0.45, 4.4);
  const foliageMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 8, 8),
    materials.foliage,
  );
  foliageMesh.position.set(-5.5, 5.2, -1.0);
  group.add(foliageMesh);

  // Clay water cooling jars (Randa) in courtyard
  for (const rz of [-2.0, -0.8]) {
    addCylinder(group, earthenMat, -4.0, 0.6, rz, 0.4, 0.5, 1.2);
  }

  return group;
}

// 5. Kofar Mata Indigo Dye Pits Heritage (-68, 0, -105)
function buildDyePits(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-68, 0, -105);
  const cx = -68;
  const cz = -105;

  const stoneMat = materials.stone;
  const earthenMat = materials.clay;
  const woodMat = materials.wood;

  // Deep indigo dye liquid material
  const indigoLiquidMat = new THREE.MeshStandardMaterial({
    color: "#1e3a8a",
    roughness: 0.15,
    metalness: 0.1,
  });

  // Raised stone terrace (16m x 12m, 0.6m high)
  addBox(group, earthenMat, 0, 0.3, 0, 16, 0.6, 12);
  colliders.push({ x: cx, z: cz, halfX: 8.2, halfZ: 6.2, height: 1.0 });

  // 8 Circular Sunken Dye Vats arranged in 2 rows of 4
  const vatCoords = [
    [-5.5, -3.2], [-1.8, -3.2], [1.8, -3.2], [5.5, -3.2],
    [-5.5, 3.2], [-1.8, 3.2], [1.8, 3.2], [5.5, 3.2],
  ];

  vatCoords.forEach(([vx, vz]) => {
    // Stone vat lip
    addCylinder(group, stoneMat, vx, 0.65, vz, 1.2, 1.25, 0.4, 16);
    // Dark indigo liquid surface
    addCylinder(group, indigoLiquidMat, vx, 0.62, vz, 1.05, 1.05, 0.38, 16);
    // Wooden stirring paddle resting across rim
    addBox(group, woodMat, vx, 0.88, vz, 2.6, 0.08, 0.12);
  });

  // Timber Fabric Drying Racks with hanging indigo-dyed cotton cloths
  for (const rx of [-6.0, 0, 6.0]) {
    // Vertical poles
    addCylinder(group, woodMat, rx, 2.2, -5.4, 0.1, 0.12, 4.4);
    addCylinder(group, woodMat, rx, 2.2, 5.4, 0.1, 0.12, 4.4);
    // Horizontal crossbar
    addBox(group, woodMat, rx, 4.2, 0, 0.15, 0.15, 10.8);
    // Hanging indigo tie-dye textile sheets
    addBox(group, indigoLiquidMat, rx, 2.7, -1.8, 0.05, 2.8, 2.2);
    addBox(group, indigoLiquidMat, rx, 2.7, 1.8, 0.05, 2.8, 2.2);
  }

  // Heritage Information Signboard
  const dyeSignMat = makeHistoricSignMaterial("KOFAR MATA INDIGO DYE PITS · 500-YEAR HERITAGE", "#1e3a8a", "#fef3c7");
  addBox(group, dyeSignMat, 0, 2.2, 5.8, 7.8, 0.8, 0.15);
  addBox(group, woodMat, -3.2, 1.0, 5.8, 0.15, 2.0, 0.15);
  addBox(group, woodMat, 3.2, 1.0, 5.8, 0.15, 2.0, 0.15);

  return group;
}

// 6. Historic Dandali Community Square & Food Hub (-72, 0, -72)
function buildDandaliSquare(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-72, 0, -72);
  const cx = -72;
  const cz = -72;

  const earthenMat = materials.clay;
  const stoneMat = materials.stone;
  const woodMat = materials.wood;

  // Paved central plaza terrace (14m x 14m, 0.15m high)
  addBox(group, stoneMat, 0, 0.08, 0, 14, 0.16, 14);

  // Perimeter Clay Seating Ledge (Dakali) where elders sit in the evening
  for (const [bx, bz, bw, bd] of [
    [0, -6.6, 13.0, 0.8],
    [0, 6.6, 13.0, 0.8],
    [-6.6, 0, 0.8, 12.0],
  ]) {
    addBox(group, earthenMat, bx, 0.45, bz, bw, 0.7, bd);
    colliders.push({ x: cx + bx, z: cz + bz, halfX: bw / 2, halfZ: bd / 2, height: 0.8 });
  }

  // Central Shaded Neem Tree
  addCylinder(group, woodMat, 0, 2.4, 0, 0.4, 0.55, 4.8);
  const treeFoliage = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 8, 8),
    materials.foliage,
  );
  treeFoliage.position.set(0, 5.6, 0);
  group.add(treeFoliage);

  // Circular clay bench around central tree
  addCylinder(group, earthenMat, 0, 0.4, 0, 1.8, 2.0, 0.6, 12);
  colliders.push({ x: cx, z: cz, halfX: 1.8, halfZ: 1.8, height: 0.8 });

  // Food Stall 1: Mai Masa & Kosai (Northern fried rice cakes & bean fritters) (-4.2, 0, 4.5)
  addBox(group, woodMat, -4.2, 0.5, 4.5, 2.8, 0.9, 1.4);
  colliders.push({ x: cx - 4.2, z: cz + 4.5, halfX: 1.5, halfZ: 0.8, height: 2.2 });
  // Cast iron indent frying pan for masa
  addCylinder(group, materials.black, -4.2, 1.05, 4.5, 0.5, 0.45, 0.15);
  // Red Yaji pepper bowls
  addCylinder(group, materials.clothRed, -3.2, 1.05, 4.5, 0.2, 0.15, 0.18);
  // Awning
  addBox(group, materials.clothRed, -4.2, 2.3, 4.5, 3.2, 0.08, 1.8);

  // Food Stall 2: Mai Kilishi Screen (Spiced dried beef) (4.2, 0, 4.5)
  addBox(group, woodMat, 4.2, 0.5, 4.5, 2.8, 0.9, 1.4);
  colliders.push({ x: cx + 4.2, z: cz + 4.5, halfX: 1.5, halfZ: 0.8, height: 2.2 });
  // Wooden drying screen with kilishi strips
  addBox(group, materials.roof, 4.2, 1.4, 4.5, 2.4, 0.8, 0.1);
  // Awning
  addBox(group, materials.ochre, 4.2, 2.3, 4.5, 3.2, 0.08, 1.8);

  // Fura da Nono calabashes (millet & cow milk) on wooden stool
  addCylinder(group, materials.ochre, 1.8, 0.4, 4.5, 0.35, 0.2, 0.4);

  // Dandali Square Signboard
  const dandaliSignMat = makeHistoricSignMaterial("DANDALI · HISTORIC COMMUNITY SQUARE", "#78350f", "#fde68a");
  addBox(group, dandaliSignMat, 0, 3.2, -6.6, 6.2, 0.75, 0.12);

  return group;
}

// Master District Assembler
export function createHistoricDistrict(
  root: THREE.Group,
  materials: GameMaterials,
  colliders: Collider[],
): THREE.Group {
  const districtGroup = new THREE.Group();
  districtGroup.name = "historic-kano-district";

  // 1. Dala Hill (-95, 0, -95)
  districtGroup.add(buildDalaHill(materials, colliders));

  // 2. Kofar Dala Gate & Badala Wall (-62, 0, -93)
  districtGroup.add(buildKofarDalaGate(materials, colliders));

  // 3. Kasuwar Kurmi Traditional Market (-75, 0, -85)
  districtGroup.add(buildKurmiMarket(materials, colliders));

  // 4. Alhaji Dan-Kano Ancestral Trading House (-85, 0, -68)
  districtGroup.add(buildDanKanoCompound(materials, colliders));

  // 5. Kofar Mata Indigo Dye Pits (-68, 0, -105)
  districtGroup.add(buildDyePits(materials, colliders));

  // 6. Historic Dandali Community Square (-72, 0, -72)
  districtGroup.add(buildDandaliSquare(materials, colliders));

  root.add(districtGroup);
  return districtGroup;
}

