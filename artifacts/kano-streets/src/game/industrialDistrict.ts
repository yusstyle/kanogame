import * as THREE from "three";
import { makeSignMaterial } from "./materials";
import type { Collider, GameMaterials, PlotAsset } from "./types";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  castShadow = true,
) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCyl(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
) {
  const mesh = new THREE.Mesh(unitCyl, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(r * 2, h, r * 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// 1. Kawu Central Freight Terminal & Logistics Depot (-42, 0, -175)
function buildKawuFreightTerminal(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-42, 0, -175);
  const cx = -42;
  const cz = -175;

  const w = 26;
  const d = 16;
  const h = 9.2;

  const zincMat = materials.corrugatedZinc || materials.metal;
  const concreteMat = materials.concrete;
  const trimMat = materials.darkTrim;
  const shutterMat = materials.metal;

  // Main Warehouse Structure
  addBox(group, concreteMat, 0, h / 2, 0, w, h, d);
  colliders.push({ x: cx, z: cz, halfX: w / 2, halfZ: d / 2, height: h });

  // Pitched Corrugated Zinc Roof with Overhang
  const roof = addBox(group, zincMat, 0, h + 1.2, 0, w + 1.6, 2.2, d + 1.6);
  roof.rotation.z = 0.04;

  // Signage across warehouse fascia
  const signMat = makeSignMaterial(
    "KAWU CENTRAL FREIGHT & LOGISTICS DEPOT\nINTERSTATE BULK HAULAGE & CARGO STAGING TERMINAL",
    "#1b3a4b",
  );
  addBox(group, signMat, 0, h - 1.2, d / 2 + 0.15, 18.5, 1.8, 0.12);

  // Raised Loading Docks along front (1.2m elevation)
  addBox(group, concreteMat, 0, 0.6, d / 2 + 2.2, w - 2, 1.2, 4.2);
  colliders.push({ x: cx, z: cz + d / 2 + 2.2, halfX: (w - 2) / 2, halfZ: 2.1, height: 1.2 });

  // 3 Roll-Up Industrial Shutter Doors with Bay Numbers
  for (let bay = -1; bay <= 1; bay++) {
    const bx = bay * 7.0;
    addBox(group, shutterMat, bx, 4.2, d / 2 + 0.08, 4.5, 5.5, 0.12);
    // Bay number badge
    const bayNumMat = makeSignMaterial(`BAY 0${bay + 2}`, "#ffb703");
    addBox(group, bayNumMat, bx, 7.3, d / 2 + 0.16, 2.4, 0.65, 0.06);
    // Yellow hazard warning curb striping along loading edge
    addBox(group, materials.karotaYellow || materials.clay, bx, 1.22, d / 2 + 4.25, 4.6, 0.06, 0.15);
  }

  // Stacks of Wooden Freight Pallets & Shrink-Wrapped Cargo Boxes
  for (const px of [-10, -5, 6, 10]) {
    for (let tier = 0; tier < 3; tier++) {
      addBox(group, materials.wood, px, 1.35 + tier * 0.35, d / 2 + 2.2, 1.6, 0.28, 1.6);
    }
    addBox(group, materials.cloth, px, 2.65, d / 2 + 2.2, 1.4, 0.85, 1.4);
  }

  // Forklift staging area on side
  addBox(group, materials.karotaYellow || materials.clay, -w / 2 - 2.5, 0.04, 0, 4.2, 0.04, 8.5, false);

  // High-powered floodlights mounted under warehouse eaves
  for (const lx of [-9, 0, 9]) {
    addBox(group, materials.metal, lx, h - 0.2, d / 2 + 0.6, 0.45, 0.35, 0.6);
  }

  return group;
}

// 2. Dawanau Grain & Wholesale Produce Distribution Depot (45, 0, -175)
function buildDawanauGrainDepot(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(45, 0, -175);
  const cx = 45;
  const cz = -175;

  const w = 24;
  const d = 15;
  const h = 8.5;

  const ochrePlaster = materials.ochre || materials.plaster;
  const zincMat = materials.corrugatedZinc || materials.metal;
  const concreteMat = materials.concrete;

  // Main Agricultural Warehouse Body
  addBox(group, ochrePlaster, 0, h / 2, 0, w, h, d);
  colliders.push({ x: cx, z: cz, halfX: w / 2, halfZ: d / 2, height: h });

  // Pitched Roof
  addBox(group, zincMat, 0, h + 0.9, 0, w + 1.2, 1.8, d + 1.2);

  // Fascia Sign
  const signMat = makeSignMaterial(
    "DAWANAU GRAIN & PRODUCE WHOLESALE DISTRIBUTORS\nSORGHUM · MILLET · SOYBEANS · MAIZE · NORTHERN SUPPLY DEPOT",
    "#2d6a4f",
  );
  addBox(group, signMat, 0, h - 1.1, d / 2 + 0.15, 19.0, 1.7, 0.12);

  // Covered Drive-Under Loading Canopy
  const canopyW = 16;
  const canopyD = 6;
  addBox(group, zincMat, 0, 5.6, d / 2 + canopyD / 2, canopyW, 0.25, canopyD);
  for (const colX of [-canopyW / 2 + 0.5, canopyW / 2 - 0.5]) {
    addCyl(group, materials.metal, colX, 2.7, d / 2 + canopyD - 0.4, 0.2, 5.4);
    colliders.push({ x: cx + colX, z: cz + d / 2 + canopyD - 0.4, halfX: 0.35, halfZ: 0.35, height: 5.4 });
  }

  // Large Double Sliding Wooden Barn Doors
  addBox(group, materials.wood, 0, 2.8, d / 2 + 0.08, 6.5, 4.8, 0.15);

  // Stacks of Burlap Grain Sacks on timber dunnage
  const sackMat = materials.cloth;
  for (const sx of [-8, -4, 4, 8]) {
    for (let layer = 0; layer < 4; layer++) {
      addBox(group, sackMat, sx, 0.35 + layer * 0.42, d / 2 + 1.8, 2.2, 0.38, 1.8);
    }
  }

  // Weighbridge Platform (Scale for Heavy Freight Trucks)
  addBox(group, materials.metal, 0, 0.06, d / 2 + 10.5, 5.2, 0.12, 12.0);
  // Weighbridge Scale Booth
  addBox(group, concreteMat, 4.2, 1.8, d / 2 + 10.5, 2.5, 3.2, 3.2);
  colliders.push({ x: cx + 4.2, z: cz + d / 2 + 10.5, halfX: 1.3, halfZ: 1.6, height: 3.2 });
  const scaleSign = makeSignMaterial("CERTIFIED WEIGHBRIDGE\nMAX: 60 TONNES", "#14213d");
  addBox(group, scaleSign, 4.2, 2.6, d / 2 + 8.85, 2.2, 0.85, 0.06);

  return group;
}

// 3. Arewa Heavy Vehicle Repairs & Fleet Workshop (-38, 0, -135)
function buildArewaHeavyWorkshop(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-38, 0, -135);
  const cx = -38;
  const cz = -135;

  const w = 22;
  const d = 15;
  const h = 7.8;

  const zincMat = materials.corrugatedZinc || materials.metal;
  const concreteMat = materials.concrete;

  // Workshop Building Enclosure (3 walls + open front bay)
  addBox(group, concreteMat, 0, h / 2, -d / 2 + 0.4, w, h, 0.8); // Back wall
  addBox(group, concreteMat, -w / 2 + 0.4, h / 2, 0, 0.8, h, d); // Left wall
  addBox(group, concreteMat, w / 2 - 0.4, h / 2, 0, 0.8, h, d); // Right wall
  colliders.push({ x: cx, z: cz - d / 2 + 0.4, halfX: w / 2, halfZ: 0.5, height: h });
  colliders.push({ x: cx - w / 2 + 0.4, z: cz, halfX: 0.5, halfZ: d / 2, height: h });
  colliders.push({ x: cx + w / 2 - 0.4, z: cz, halfX: 0.5, halfZ: d / 2, height: h });

  // Industrial Cantilever Truss Roof
  addBox(group, zincMat, 0, h + 0.6, 0, w + 1.0, 1.2, d + 1.2);

  // Workshop Fascia Sign
  const signMat = makeSignMaterial(
    "AREWA HEAVY VEHICLE REPAIRS & FLEET WORKSHOP\nDIESEL INJECTION · TRANSMISSION OVERHAUL · SUSPENSION & CHASSIS WELDING",
    "#b02a37",
  );
  addBox(group, signMat, 0, h - 0.8, d / 2 - 0.1, 18.0, 1.5, 0.1);

  // Concrete Inspection Pit (recessed bay visual)
  addBox(group, materials.black, 0, 0.02, 0, 3.2, 0.04, 9.0, false);
  addBox(group, materials.karotaYellow || materials.clay, -1.75, 0.04, 0, 0.18, 0.06, 9.2, false);
  addBox(group, materials.karotaYellow || materials.clay, 1.75, 0.04, 0, 0.18, 0.06, 9.2, false);

  // Overhead Heavy Engine Gantry Crane Frame
  const gantryMat = materials.karotaYellow || materials.clay;
  addBox(group, gantryMat, 0, 6.2, 0, 8.5, 0.35, 0.45);
  addBox(group, materials.metal, 0, 5.6, 0, 0.5, 0.9, 0.5); // Hoist block
  for (const gx of [-4.2, 4.2]) {
    addCyl(group, gantryMat, gx, 3.1, 0, 0.25, 6.2);
  }

  // Oil Drum Racks (red, blue, and black industrial drums)
  const drumColors = ["#8b0000", "#1d3557", "#2b2d42"];
  for (let r = 0; r < 6; r++) {
    const drumMat = new THREE.MeshStandardMaterial({
      color: drumColors[r % 3],
      roughness: 0.45,
      metalness: 0.4,
    });
    addCyl(group, drumMat, -w / 2 + 1.8, 0.55, -d / 2 + 2.0 + r * 1.2, 0.32, 1.05);
  }

  // Stacks of Heavy Truck Tires
  for (let t = 0; t < 5; t++) {
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.32, 14),
      materials.black,
    );
    tire.rotation.x = Math.PI / 2;
    tire.position.set(w / 2 - 2.0, 0.18 + t * 0.34, -d / 2 + 2.5);
    tire.castShadow = true;
    group.add(tire);
  }

  return group;
}

// 4. Kano State Inland Container Yard & Gatehouse (42, 0, -135)
function buildContainerYard(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(42, 0, -135);
  const cx = 42;
  const cz = -135;

  // Security Perimeter Fence / Wall
  const wallMat = materials.concrete;
  addBox(group, wallMat, 0, 1.6, -16, 26, 3.2, 0.6); // Back wall
  addBox(group, wallMat, 13, 1.6, 0, 0.6, 3.2, 32); // Outer wall
  colliders.push({ x: cx, z: cz - 16, halfX: 13, halfZ: 0.4, height: 3.2 });
  colliders.push({ x: cx + 13, z: cz, halfX: 0.4, halfZ: 16, height: 3.2 });

  // Security Customs Gatehouse & Boom Barrier
  const gatehouse = addBox(group, materials.white, -10, 1.8, 8, 3.8, 3.4, 4.2);
  colliders.push({ x: cx - 10, z: cz + 8, halfX: 2.0, halfZ: 2.2, height: 3.4 });
  const gateSign = makeSignMaterial("KANO INLAND CONTAINER TERMINAL\nCUSTOMS & SECURITY CHECKPOINT · GATE 1", "#023e8a");
  addBox(group, gateSign, -10, 2.6, 10.15, 3.4, 1.1, 0.08);

  // Red & White Boom Barrier
  const barrierMat = materials.clothRed || materials.clay;
  addBox(group, barrierMat, -4.5, 1.1, 8, 7.5, 0.14, 0.14);

  // Stacked 20ft & 40ft Intermodal Shipping Containers
  // Container Colors: Maersk Blue, Evergreen, Terracotta Rust, Golden Yellow
  const containerColors = ["#0077b6", "#2d6a4f", "#9d0208", "#e09f3e", "#03045e"];
  const stacks: [number, number, number, number, number][] = [
    // [x, y, z, colorIndex, length]
    [2, 1.35, -8, 0, 12],
    [2, 3.95, -8, 1, 12],
    [2, 6.55, -8, 2, 12],
    [-4, 1.35, -4, 3, 6],
    [-4, 3.95, -4, 4, 6],
    [8, 1.35, 2, 1, 6],
    [8, 3.95, 2, 0, 6],
  ];

  stacks.forEach(([sx, sy, sz, colorIdx, cLength]) => {
    const cMat = new THREE.MeshStandardMaterial({
      color: containerColors[colorIdx],
      roughness: 0.55,
      metalness: 0.35,
    });
    // Corrugated container box
    addBox(group, cMat, sx, sy, sz, 2.5, 2.55, cLength);
    colliders.push({ x: cx + sx, z: cz + sz, halfX: 1.35, halfZ: cLength / 2, height: 2.6 });
    // Corner casting fittings
    addBox(group, materials.black, sx, sy, sz, 2.56, 0.12, cLength + 0.04);
  });

  // Heavy Industrial Yard Floodlight Tower (14m tall)
  const towerMat = materials.metal;
  addBox(group, towerMat, 11, 7.0, -13, 0.7, 14.0, 0.7);
  colliders.push({ x: cx + 11, z: cz - 13, halfX: 0.5, halfZ: 0.5, height: 14.0 });
  addBox(group, materials.metal, 11, 13.8, -13, 2.4, 0.4, 2.4);
  for (const lx of [-0.8, 0.8]) {
    addBox(group, materials.glassLit || materials.white, 11 + lx, 14.2, -13, 0.6, 0.45, 0.5);
  }

  return group;
}

// 5. Workers Canteen & Mai Shayi Transit Hub (-15, 0, -155)
function buildWorkersCanteen(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-15, 0, -155);
  const cx = -15;
  const cz = -155;

  const w = 11;
  const d = 7;
  const h = 3.6;

  const woodMat = materials.wood;
  const zincMat = materials.corrugatedZinc || materials.metal;

  // Canteen Kiosk Body
  addBox(group, materials.plaster, 0, h / 2, -d / 4, w, h, d / 2);
  colliders.push({ x: cx, z: cz - d / 4, halfX: w / 2, halfZ: d / 4, height: h });

  // Overhanging Zinc Veranda Canopy
  addBox(group, zincMat, 0, h + 0.3, d / 4, w + 1.2, 0.15, d);
  for (const px of [-w / 2 + 0.6, w / 2 - 0.6]) {
    addCyl(group, woodMat, px, h / 2, d * 0.7 - 0.4, 0.12, h);
  }

  // Signboard
  const signMat = makeSignMaterial(
    "KAWU WORKERS CANTEEN & MAI SHAYI\nHOT TEA · BUTTER BREAD · KOSAI · MASA · COLD SODA",
    "#854d0e",
  );
  addBox(group, signMat, 0, h + 0.8, d * 0.4, 8.5, 1.2, 0.08);

  // Countertop with Brass Tea Kettles & Crate Stacks
  addBox(group, woodMat, 0, 1.05, 0.8, w - 1.5, 0.9, 0.65);
  // Brass kettles
  const brassMat = materials.goldTrim || materials.metal;
  for (const kx of [-1.5, 0, 1.5]) {
    addCyl(group, brassMat, kx, 1.7, 0.8, 0.22, 0.45);
  }

  // Dining Benches & Long Table under Veranda
  addBox(group, woodMat, 0, 0.78, 2.5, 5.5, 0.08, 0.85); // Table
  addBox(group, woodMat, 0, 0.45, 1.8, 5.5, 0.06, 0.35); // Front bench
  addBox(group, woodMat, 0, 0.45, 3.2, 5.5, 0.06, 0.35); // Rear bench

  return group;
}

// 6. Kawu Central Logistics Dispatch & Career Mission Board (-8, 0, -140)
function buildLogisticsDispatchBoard(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-8, 0, -140);
  const cx = -8;
  const cz = -140;

  // Concrete Base Plinth
  addBox(group, materials.concrete, 0, 0.35, 0, 4.6, 0.7, 2.2);
  colliders.push({ x: cx, z: cz, halfX: 2.3, halfZ: 1.1, height: 0.7 });

  // Sturdy Timber Bulletin Board Canopy
  addBox(group, materials.wood, 0, 3.4, 0, 4.2, 0.18, 1.8);
  for (const px of [-1.9, 1.9]) {
    addCyl(group, materials.metal, px, 1.8, 0, 0.09, 3.2);
  }

  // Main Illuminated Mission Board Display
  const boardMat = makeSignMaterial(
    "KAWU LOGISTICS DISPATCH · CAREER MISSIONS\n[E] INTERACT TO VIEW FREIGHT & DELIVERY CONTRACTS\nINTERSTATE · LOCAL · BUSINESS SUPPLY · WORKSHOP FLEET",
    "#0f3057",
  );
  addBox(group, boardMat, 0, 1.95, 0.05, 3.6, 1.8, 0.12);
  colliders.push({ x: cx, z: cz + 0.05, halfX: 1.9, halfZ: 0.2, height: 2.8 });

  // Spotlights illuminating bulletin board
  addBox(group, materials.metal, 0, 3.25, 0.65, 0.45, 0.15, 0.35);

  return group;
}

// 7. Road Network, Warning Signage, and Industrial Lighting
function buildIndustrialRoads(materials: GameMaterials, colliders: Collider[]): THREE.Group {
  const group = new THREE.Group();

  const asphaltMat = materials.asphalt;
  const curbMat = materials.curb;
  const markingMat = materials.roadMarking;

  // 1. North-South Central Industrial Arterial Road (x = 0, z = -126 to z = -215)
  const nsLen = 92;
  const nsCenterZ = -171;
  const nsW = 16;
  // Roadbed
  addBox(group, asphaltMat, 0, 0.02, nsCenterZ, nsW, 0.04, nsLen, false);
  // Center Double White Line Markings
  for (const lx of [-0.15, 0.15]) {
    addBox(group, markingMat, lx, 0.045, nsCenterZ, 0.12, 0.015, nsLen, false);
  }
  // Curbs on East & West
  for (const side of [-1, 1]) {
    addBox(group, curbMat, side * (nsW / 2 + 0.3), 0.15, nsCenterZ, 0.6, 0.25, nsLen);
    addBox(group, materials.sidewalk, side * (nsW / 2 + 1.8), 0.12, nsCenterZ, 2.4, 0.2, nsLen);
  }

  // 2. East-West Freight Boulevard (z = -175, x = -75 to x = +75)
  const ewLen = 150;
  const ewW = 14;
  // Roadbed
  addBox(group, asphaltMat, 0, 0.02, -175, ewLen, 0.04, ewW, false);
  // Center Yellow Dashed Line
  for (let seg = -ewLen / 2 + 5; seg <= ewLen / 2 - 5; seg += 8) {
    addBox(group, materials.karotaYellow || markingMat, seg, 0.045, -175, 4.0, 0.015, 0.22, false);
  }
  // Curbs on North & South
  for (const side of [-1, 1]) {
    addBox(group, curbMat, 0, 0.15, -175 + side * (ewW / 2 + 0.3), ewLen, 0.25, 0.6);
    addBox(group, materials.sidewalk, 0, 0.12, -175 + side * (ewW / 2 + 1.8), ewLen, 0.2, 2.4);
  }

  // 3. Industrial Traffic & Safety Warning Signs
  const signs = [
    {
      x: 9.5,
      z: -130,
      yaw: 0,
      text: "KAWU INDUSTRIAL PARK\nHEAVY TRUCKS USE LOW GEAR\nSPEED LIMIT 25 KM/H",
      bg: "#b02a37",
    },
    {
      x: -9.5,
      z: -150,
      yaw: Math.PI,
      text: "HANKALI! MOTOCI MASU KAYA\nCAUTION: HEAVY ARTICULATED VEHICLES CROSSING",
      bg: "#b02a37",
    },
    {
      x: 18,
      z: -170,
      yaw: -Math.PI / 2,
      text: "CERTIFIED WEIGHBRIDGE 50M\nALL COMMERCIAL FREIGHT MUST WEIGH IN",
      bg: "#14213d",
    },
    {
      x: -18,
      z: -170,
      yaw: Math.PI / 2,
      text: "KAWU CENTRAL DEPOT LOADING BAYS 1-3\nAUTHORIZED VEHICLES ONLY",
      bg: "#023e8a",
    },
  ];

  signs.forEach((s) => {
    const post = addCyl(group, materials.metal, s.x, 1.8, s.z, 0.08, 3.6);
    colliders.push({ x: s.x, z: s.z, halfX: 0.3, halfZ: 0.3, height: 3.6 });
    const signBoard = makeSignMaterial(s.text, s.bg);
    const signMesh = addBox(group, signBoard, s.x, 2.8, s.z, 2.8, 1.4, 0.08);
    signMesh.rotation.y = s.yaw;
  });

  // 4. Sodium Vapor Industrial Streetlights (taller & heavy duty)
  const streetLightPositions: [number, number, number][] = [
    [-9.5, -145, Math.PI / 2],
    [9.5, -145, -Math.PI / 2],
    [-9.5, -195, Math.PI / 2],
    [9.5, -195, -Math.PI / 2],
    [-35, -183.5, 0],
    [35, -183.5, 0],
    [-35, -166.5, Math.PI],
    [35, -166.5, Math.PI],
  ];

  streetLightPositions.forEach(([lx, lz, yaw]) => {
    const pole = addCyl(group, materials.metal, lx, 4.5, lz, 0.16, 9.0);
    colliders.push({ x: lx, z: lz, halfX: 0.35, halfZ: 0.35, height: 9.0 });
    // Outrigger arm
    const arm = addBox(group, materials.metal, lx, 8.8, lz, 0.15, 0.15, 2.2);
    arm.rotation.y = yaw;
    // Sodium amber light fixture
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: "#ffbe0b",
      emissive: "#fb5607",
      emissiveIntensity: 0.75,
    });
    addBox(group, fixtureMat, lx, 8.6, lz, 0.45, 0.25, 0.65);
  });

  return group;
}

export function createIndustrialDistrict(materials: GameMaterials): PlotAsset {
  const root = new THREE.Group();
  root.name = "industrial-district-root";
  const colliders: Collider[] = [];

  root.add(buildKawuFreightTerminal(materials, colliders));
  root.add(buildDawanauGrainDepot(materials, colliders));
  root.add(buildArewaHeavyWorkshop(materials, colliders));
  root.add(buildContainerYard(materials, colliders));
  root.add(buildWorkersCanteen(materials, colliders));
  root.add(buildLogisticsDispatchBoard(materials, colliders));
  root.add(buildIndustrialRoads(materials, colliders));

  return { root, colliders };
}

