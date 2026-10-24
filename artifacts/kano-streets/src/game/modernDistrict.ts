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

// 1. Four-Storey Modern Apartment Building (Airport Road)
export function createFourStoreyApartment(materials: GameMaterials): PlotAsset {
  const root = new THREE.Group();
  const colliders: Collider[] = [];
  root.name = "four-storey-apartment";

  const width = 14.5;
  const depth = 11.2;
  const height = 15.2; // 4 full storeys + parapet

  // Main Concrete Tower Body
  addBox(root, materials.white, 0, height / 2, 0, width, height, depth);

  // Warm ochre architectural vertical accent fins
  for (const x of [-width / 2 + 0.4, width / 2 - 0.4]) {
    addBox(root, materials.ochre, x, height / 2, depth / 2 + 0.15, 0.8, height, 0.3);
  }

  // Four Storeys of Windows, Balconies & AC Units
  const floorHeights = [2.2, 5.8, 9.4, 13.0];
  floorHeights.forEach((fy, floorIdx) => {
    // Balconies on Floors 2, 3, 4
    if (floorIdx > 0) {
      for (const side of [-1, 1]) {
        const bx = side * 3.8;
        // Balcony slab
        addBox(root, materials.concrete, bx, fy - 0.85, depth / 2 + 1.1, 4.2, 0.22, 2.2);
        // Modern glass/aluminum railing
        addBox(root, materials.glassLit, bx, fy - 0.35, depth / 2 + 2.15, 4.1, 0.85, 0.08);
        addBox(root, materials.metal, bx, fy + 0.08, depth / 2 + 2.15, 4.2, 0.06, 0.08);
        // Sliding glass doors to balcony
        addBox(root, materials.glass, bx, fy + 0.45, depth / 2 + 0.08, 2.6, 2.4, 0.06);

        // Exterior AC outdoor compressor units
        addBox(root, materials.white, side * 1.4, fy - 0.4, depth / 2 + 0.35, 0.75, 0.55, 0.45);
        addBox(root, materials.black, side * 1.4, fy - 0.4, depth / 2 + 0.59, 0.4, 0.4, 0.04);
      }
    } else {
      // Ground Floor Entrance Lobby
      // Entrance glass canopy
      addBox(root, materials.glass, 0, 3.4, depth / 2 + 1.8, 5.2, 0.12, 3.4);
      addBox(root, materials.metal, -2.4, 1.7, depth / 2 + 3.2, 0.12, 3.4, 0.12);
      addBox(root, materials.metal, 2.4, 1.7, depth / 2 + 3.2, 0.12, 3.4, 0.12);

      // Main Glass Entrance Doors (Enterable Doorway!)
      addBox(root, materials.glassLit, 0, 1.5, depth / 2 + 0.08, 3.2, 2.7, 0.08);
      addBox(root, materials.darkTrim, 0, 1.5, depth / 2 + 0.12, 0.1, 2.7, 0.1); // Door frame

      // Signboard
      const aptSign = makeSignMaterial("AIRPORT VIEW APARTMENTS · UNIT 2B", "#1b3345");
      addBox(root, aptSign, 0, 3.9, depth / 2 + 0.15, 7.8, 0.72, 0.12);
    }
  });

  // Roof Penthouse, Stairwell & GeePee Water Tanks
  addBox(root, materials.concrete, -3.2, height + 1.2, -1.8, 4.2, 2.4, 3.6); // Stair penthouse
  // Dual 2000L Black GeePee Tanks
  addCyl(root, materials.black, 3.4, height + 1.2, 1.8, 0.85, 2.2);
  addCyl(root, materials.black, 3.4, height + 1.2, -1.8, 0.85, 2.2);

  // Entrance Step
  addBox(root, materials.concrete, 0, 0.15, depth / 2 + 1.2, 5.8, 0.3, 2.2, false);

  colliders.push(
    { x: 0, z: 0, halfX: width / 2 + 0.3, halfZ: depth / 2 + 0.3, height: height + 2 },
    { x: 0, z: depth / 2 + 1.0, halfX: 2.8, halfZ: 1.0, height: 3.5 },
  );

  return { root, colliders };
}

// 2. Modern Residential Villa (Al-Baraka Villa)
export function createModernVilla(materials: GameMaterials): PlotAsset {
  const root = new THREE.Group();
  const colliders: Collider[] = [];
  root.name = "modern-villa";

  const houseW = 12.2;
  const houseD = 9.8;
  const houseH = 4.2;

  // Main House Structure
  addBox(root, materials.white, 0, houseH / 2, 0, houseW, houseH, houseD);

  // Hip Roof with stone-coated dark grey tiles
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(houseW * 0.72, 2.6, 4),
    materials.roof,
  );
  roof.position.set(0, houseH + 1.3, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1.0, 0.95);
  roof.castShadow = true;
  root.add(roof);

  // Front Covered Veranda & Porch Steps
  addBox(root, materials.tileFloor || materials.concrete, 0, 0.25, houseD / 2 + 1.6, 6.4, 0.5, 3.2);
  addBox(root, materials.concrete, -2.8, 2.0, houseD / 2 + 2.8, 0.45, 3.6, 0.45); // Pillar 1
  addBox(root, materials.concrete, 2.8, 2.0, houseD / 2 + 2.8, 0.45, 3.6, 0.45);  // Pillar 2
  addBox(root, materials.roof, 0, 4.0, houseD / 2 + 1.6, 7.2, 0.35, 3.6); // Porch roof

  // Enterable Front Entrance Door
  addBox(root, materials.wood, 0, 1.45, houseD / 2 + 0.08, 1.4, 2.5, 0.1);
  addBox(root, materials.goldTrim || materials.trim, 0.5, 1.45, houseD / 2 + 0.15, 0.08, 0.18, 0.08); // Brass handle

  // Front Windows with Security Grilles
  for (const x of [-4.2, 4.2]) {
    addBox(root, materials.glass, x, 1.85, houseD / 2 + 0.08, 2.0, 1.5, 0.08);
    // Security grilles
    for (let g = 0; g < 4; g++) {
      addBox(root, materials.metal, x - 0.7 + g * 0.46, 1.85, houseD / 2 + 0.14, 0.03, 1.5, 0.03, false);
    }
  }

  // Signboard
  const villaSign = makeSignMaterial("AL-BARAKA VILLA · NO 44", "#2c3b2d");
  addBox(root, villaSign, 0, 3.2, houseD / 2 + 0.15, 3.8, 0.55, 0.08);

  // Corner Generator House (Mota Wuta)
  addBox(root, materials.concrete, 6.2, 1.1, -4.2, 2.2, 2.2, 2.2);
  addBox(root, new THREE.MeshStandardMaterial({ color: "#1e5229", roughness: 0.5 }), 6.2, 0.65, -4.2, 1.4, 1.0, 1.0); // Green generator
  addCyl(root, materials.metal, 6.8, 2.5, -4.2, 0.06, 0.8); // Exhaust chimney

  colliders.push(
    { x: 0, z: 0, halfX: houseW / 2 + 0.2, halfZ: houseD / 2 + 0.2, height: 6 },
    { x: 0, z: houseD / 2 + 1.6, halfX: 3.3, halfZ: 1.6, height: 4 },
    { x: 6.2, z: -4.2, halfX: 1.2, halfZ: 1.2, height: 2.4 },
  );

  return { root, colliders };
}

// 3. Christian Church (St. Stephen's Anglican Church, Sabon Gari)
export function createChristianChurch(materials: GameMaterials): PlotAsset {
  const root = new THREE.Group();
  const colliders: Collider[] = [];
  root.name = "christian-church";

  const naveW = 14.5;
  const naveD = 22.0;
  const naveH = 9.5;

  // Main Church Nave
  addBox(root, materials.plaster, 0, naveH / 2, 0, naveW, naveH, naveD);

  // Gable Pitched Roof
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(naveW * 0.75, 4.2, 4),
    materials.roof,
  );
  roof.position.set(0, naveH + 2.1, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.0, 1.0, naveD / naveW);
  roof.castShadow = true;
  root.add(roof);

  // Church Bell Tower (North-West Corner)
  const towerW = 4.4;
  const towerH = 18.5;
  const towerX = -naveW / 2 - towerW / 2 + 0.8;
  const towerZ = naveD / 2 - towerW / 2;
  addBox(root, materials.plaster, towerX, towerH / 2, towerZ, towerW, towerH, towerW);
  // Belfry Arches & Bell
  addBox(root, materials.stone, towerX, towerH - 2.5, towerZ, towerW + 0.4, 0.4, towerW + 0.4);
  addCyl(root, materials.goldTrim || materials.metal, towerX, towerH - 1.2, towerZ, 0.35, 0.7); // Bell
  // Spire on top of tower
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.5, 4), materials.roof);
  spire.position.set(towerX, towerH + 2.7, towerZ);
  spire.rotation.y = Math.PI / 4;
  spire.castShadow = true;
  root.add(spire);

  // Large Gold/Brass Latin Cross on Top of Spire
  addBox(root, materials.goldTrim || materials.trim, towerX, towerH + 6.2, towerZ, 0.18, 1.8, 0.1);
  addBox(root, materials.goldTrim || materials.trim, towerX, towerH + 6.7, towerZ, 1.1, 0.18, 0.1);

  // Gable Facade Cross (Above Main Entrance)
  addBox(root, materials.goldTrim || materials.trim, 0, naveH + 1.2, naveD / 2 + 0.15, 0.22, 2.4, 0.12);
  addBox(root, materials.goldTrim || materials.trim, 0, naveH + 1.8, naveD / 2 + 0.15, 1.4, 0.22, 0.12);

  // Arched Entrance Portico & Double Wooden Doors (Enterable!)
  addBox(root, materials.stone, 0, 0.25, naveD / 2 + 1.8, 6.2, 0.5, 3.4);
  addBox(root, materials.stone, -2.4, 2.2, naveD / 2 + 3.1, 0.55, 4.0, 0.55);
  addBox(root, materials.stone, 2.4, 2.2, naveD / 2 + 3.1, 0.55, 4.0, 0.55);
  addBox(root, materials.plaster, 0, 4.6, naveD / 2 + 1.8, 6.8, 0.8, 3.6);

  // Double Carved Wooden Entrance Doors
  addBox(root, materials.wood, -0.75, 1.8, naveD / 2 + 0.12, 1.4, 3.2, 0.14);
  addBox(root, materials.wood, 0.75, 1.8, naveD / 2 + 0.12, 1.4, 3.2, 0.14);
  addBox(root, materials.goldTrim || materials.trim, -0.15, 1.8, naveD / 2 + 0.22, 0.08, 0.25, 0.08); // Left handle
  addBox(root, materials.goldTrim || materials.trim, 0.15, 1.8, naveD / 2 + 0.22, 0.08, 0.25, 0.08);  // Right handle

  // Stained Glass Windows (Side Walls)
  for (const z of [-6, -1, 4]) {
    for (const side of [-1, 1]) {
      const wx = side * (naveW / 2 + 0.08);
      const glassMat = (z + 6) % 3 === 0 ? materials.clothRed : materials.glassLit;
      addBox(root, glassMat, wx, 4.8, z, 0.08, 3.6, 1.6);
      addBox(root, materials.stone, wx, 2.8, z, 0.14, 0.35, 1.9); // Stone window sill
    }
  }

  // Rose Window Above Main Entrance
  const roseMat = materials.clothRed;
  addCyl(root, roseMat, 0, 6.8, naveD / 2 + 0.12, 1.4, 0.08);

  // Signboard
  const churchSign = makeSignMaterial("ST. STEPHEN'S ANGLICAN CHURCH · SABON GARI, KANO\nSUNDAY SERVICE: 9:00 AM", "#241838");
  addBox(root, churchSign, 0, 4.2, naveD / 2 + 3.3, 5.8, 0.85, 0.12);

  colliders.push(
    { x: 0, z: 0, halfX: naveW / 2 + 0.3, halfZ: naveD / 2 + 0.3, height: naveH + 3 },
    { x: towerX, z: towerZ, halfX: towerW / 2 + 0.3, halfZ: towerW / 2 + 0.3, height: towerH + 2 },
    { x: 0, z: naveD / 2 + 1.8, halfX: 3.2, halfZ: 1.7, height: 4.5 },
  );

  return { root, colliders };
}

// 4. Police & KAROTA Traffic Enforcement Station Compound (Airport Road)
export function createPoliceStation(materials: GameMaterials): PlotAsset {
  const root = new THREE.Group();
  const colliders: Collider[] = [];
  root.name = "police-station-compound";

  const stationW = 12.0;
  const stationD = 8.5;
  const stationH = 4.8;

  // Station Building
  const navyMat = materials.policeNavy || materials.darkTrim;
  addBox(root, navyMat, 0, stationH / 2, 0, stationW, stationH, stationD);
  addBox(root, materials.roof, 0, stationH + 0.2, 0, stationW + 0.6, 0.35, stationD + 0.6);

  // Official Police Signboard
  const stationSign = makeSignMaterial("NIGERIAN POLICE FORCE · AIRPORT ROAD DIVISION\n& KAROTA TRAFFIC ENFORCEMENT", "#141b2d");
  addBox(root, stationSign, 0, 3.8, stationD / 2 + 0.15, 8.8, 0.95, 0.12);

  // Entrance Steps & Enterable Door
  addBox(root, materials.concrete, 0, 0.15, stationD / 2 + 1.2, 4.2, 0.3, 2.2);
  addBox(root, materials.wood, 0, 1.45, stationD / 2 + 0.08, 1.6, 2.6, 0.12);

  // Security Perimeter Barrier Drums (Black & Yellow Stripes)
  for (let i = 0; i < 4; i++) {
    const drumX = -5.0 + i * 3.3;
    const drumMat = i % 2 === 0 ? materials.karotaYellow || materials.trim : materials.black;
    addCyl(root, drumMat, drumX, 0.55, stationD / 2 + 3.8, 0.35, 1.1);
    colliders.push({ x: drumX, z: stationD / 2 + 3.8, halfX: 0.4, halfZ: 0.4, height: 1.2 });
  }

  // Police Hilux Patrol Truck (Parked in Driveway)
  const hiluxX = 8.2;
  const hiluxZ = 2.5;
  const hilux = createPoliceHilux(materials);
  hilux.position.set(hiluxX, 0, hiluxZ);
  hilux.rotation.y = -Math.PI / 2;
  root.add(hilux);
  colliders.push({ x: hiluxX, z: hiluxZ, halfX: 1.3, halfZ: 2.7, height: 2.1 });

  // KAROTA Kiosk / Inspection Post
  const kioskX = -8.5;
  const kioskZ = 2.8;
  const karotaMat = materials.karotaGreen || materials.kekeGreen;
  const yellowMat = materials.karotaYellow || materials.trim;
  addBox(root, karotaMat, kioskX, 1.4, kioskZ, 2.6, 2.6, 2.4);
  addBox(root, yellowMat, kioskX, 2.8, kioskZ, 2.9, 0.25, 2.7);
  // KAROTA Kiosk Sign
  const kioskSign = makeSignMaterial("KAROTA KIOSK\nINSPECTION & FINES", "#156228");
  addBox(root, kioskSign, kioskX, 2.1, kioskZ + 1.25, 2.2, 0.65, 0.08);
  colliders.push({ x: kioskX, z: kioskZ, halfX: 1.4, halfZ: 1.3, height: 3.0 });

  colliders.push(
    { x: 0, z: 0, halfX: stationW / 2 + 0.3, halfZ: stationD / 2 + 0.3, height: stationH + 1 },
    { x: 0, z: stationD / 2 + 1.2, halfX: 2.2, halfZ: 1.2, height: 3 },
  );

  return { root, colliders };
}

// Marked Nigerian Police Hilux Double-Cabin Pickup
function createPoliceHilux(materials: GameMaterials): THREE.Group {
  const truck = new THREE.Group();
  truck.name = "police-hilux-patrol";

  const bodyMat = materials.policeNavy || materials.darkTrim;
  const whiteMat = materials.white;
  const blackMat = materials.black;
  const metalMat = materials.metal;

  // Chassis & Wheels
  addBox(truck, blackMat, 0, 0.4, 0, 2.1, 0.3, 4.8);
  for (const side of [-1, 1]) {
    for (const z of [-1.5, 1.5]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12), blackMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.05, 0.42, z);
      wheel.castShadow = true;
      truck.add(wheel);
    }
  }

  // Cab & Bed
  addBox(truck, bodyMat, 0, 1.05, -0.4, 2.05, 0.95, 2.8); // Double Cabin
  addBox(truck, bodyMat, 0, 0.85, 1.6, 2.0, 0.65, 1.5);   // Pickup Bed
  addBox(truck, whiteMat, 0, 1.55, -0.4, 1.85, 0.75, 1.9); // Cab Roof
  // Side Windows & Windshield
  addBox(truck, materials.glass, 0, 1.55, -1.35, 1.7, 0.55, 0.1); // Front Windshield
  addBox(truck, materials.glass, -0.95, 1.55, -0.4, 0.08, 0.5, 1.6); // Left Window
  addBox(truck, materials.glass, 0.95, 1.55, -0.4, 0.08, 0.5, 1.6);  // Right Window

  // Police Door Signage & Stripe
  const policeSign = makeSignMaterial("NPF POLICE", "#141b2d");
  addBox(truck, policeSign, -1.04, 1.05, -0.4, 0.05, 0.4, 1.2);
  addBox(truck, policeSign, 1.04, 1.05, -0.4, 0.05, 0.4, 1.2);

  // Roof Emergency Beacon Light Bar (Blue & Red Strobe)
  addBox(truck, metalMat, 0, 1.95, -0.4, 1.2, 0.06, 0.22);
  addBox(truck, new THREE.MeshStandardMaterial({ color: "#2244ff", emissive: "#1122aa", emissiveIntensity: 0.8 }), -0.35, 2.05, -0.4, 0.45, 0.15, 0.2); // Blue
  addBox(truck, new THREE.MeshStandardMaterial({ color: "#ff2222", emissive: "#aa1111", emissiveIntensity: 0.8 }), 0.35, 2.05, -0.4, 0.45, 0.15, 0.2);  // Red

  // Bullbar Bumper
  addBox(truck, metalMat, 0, 0.65, -2.45, 1.9, 0.55, 0.22);

  return truck;
}

// Visible Nigerian Police Officer Model
export function createPoliceOfficerModel(materials: GameMaterials): THREE.Group {
  const root = new THREE.Group();
  root.name = "police-officer";

  const uniformMat = materials.policeNavy || materials.darkTrim;
  const skinMat = new THREE.MeshStandardMaterial({ color: "#6a442e", roughness: 0.88 });
  const beltMat = materials.black;
  const goldMat = materials.goldTrim || materials.trim;

  // Legs & Boots
  addBox(root, uniformMat, -0.16, 0.55, 0, 0.18, 0.85, 0.22);
  addBox(root, uniformMat, 0.16, 0.55, 0, 0.18, 0.85, 0.22);
  addBox(root, beltMat, -0.16, 0.12, 0.04, 0.2, 0.24, 0.32); // Left boot
  addBox(root, beltMat, 0.16, 0.12, 0.04, 0.2, 0.24, 0.32);  // Right boot

  // Torso / Navy Tactical Shirt
  addBox(root, uniformMat, 0, 1.22, 0, 0.52, 0.65, 0.32);
  // Duty Belt & Radio
  addBox(root, beltMat, 0, 0.95, 0, 0.54, 0.12, 0.34);
  addBox(root, beltMat, 0.28, 1.05, 0, 0.1, 0.25, 0.14); // Radio pouch
  // Police Badge & Shoulder Epaulettes
  addBox(root, goldMat, -0.14, 1.35, 0.17, 0.08, 0.1, 0.02);

  // Arms
  addBox(root, uniformMat, -0.34, 1.2, 0, 0.14, 0.55, 0.18);
  addBox(root, uniformMat, 0.34, 1.2, 0, 0.14, 0.55, 0.18);
  addBox(root, skinMat, -0.34, 0.85, 0, 0.12, 0.2, 0.14); // Left hand
  addBox(root, skinMat, 0.34, 0.85, 0, 0.12, 0.2, 0.14);  // Right hand

  // Head & Black Beret with Police Crest
  addBox(root, skinMat, 0, 1.68, 0, 0.28, 0.32, 0.28);
  // Beret (Tilted over right ear)
  const beret = addCyl(root, beltMat, 0.04, 1.86, 0, 0.22, 0.14);
  beret.rotation.z = -0.15;
  addBox(root, goldMat, 0.12, 1.86, 0.18, 0.06, 0.08, 0.03); // Beret badge

  root.traverse((obj) => {
    obj.castShadow = true;
    obj.receiveShadow = true;
  });

  return root;
}

// Visible KAROTA Traffic Officer Model
export function createKarotaOfficerModel(materials: GameMaterials): THREE.Group {
  const root = new THREE.Group();
  root.name = "karota-officer";

  const uniformMat = new THREE.MeshStandardMaterial({ color: "#c8b99c", roughness: 0.8 }); // Khaki
  const vestMat = materials.karotaYellow || new THREE.MeshStandardMaterial({ color: "#d8af18", roughness: 0.4 }); // High-Vis Yellow
  const beretMat = materials.karotaGreen || new THREE.MeshStandardMaterial({ color: "#156228", roughness: 0.6 }); // Green Beret
  const skinMat = new THREE.MeshStandardMaterial({ color: "#744a33", roughness: 0.88 });
  const blackMat = materials.black;

  // Legs & Boots
  addBox(root, uniformMat, -0.16, 0.55, 0, 0.18, 0.85, 0.22);
  addBox(root, uniformMat, 0.16, 0.55, 0, 0.18, 0.85, 0.22);
  addBox(root, blackMat, -0.16, 0.12, 0.04, 0.2, 0.24, 0.32);
  addBox(root, blackMat, 0.16, 0.12, 0.04, 0.2, 0.24, 0.32);

  // Torso with High-Vis Yellow Reflective Vest
  addBox(root, uniformMat, 0, 1.22, 0, 0.52, 0.65, 0.32);
  addBox(root, vestMat, 0, 1.24, 0, 0.54, 0.55, 0.34); // High-Vis Vest
  // Silver Reflective Stripes across vest
  addBox(root, materials.white, 0, 1.35, 0.18, 0.5, 0.06, 0.02);
  addBox(root, materials.white, 0, 1.1, 0.18, 0.5, 0.06, 0.02);

  // Arms & Raised Left Hand Holding Stop Wand
  addBox(root, uniformMat, -0.34, 1.2, 0, 0.14, 0.55, 0.18);
  // Raised right arm signaling traffic
  const rightArm = new THREE.Group();
  rightArm.position.set(0.34, 1.45, 0);
  rightArm.rotation.x = -0.65;
  rightArm.rotation.z = -0.35;
  root.add(rightArm);
  addBox(rightArm, uniformMat, 0, -0.28, 0, 0.14, 0.55, 0.18);
  addBox(rightArm, skinMat, 0, -0.6, 0, 0.12, 0.18, 0.14);
  // Traffic Stop Wand (Red/White Baton)
  addCyl(rightArm, new THREE.MeshStandardMaterial({ color: "#dd2222", emissive: "#991111", emissiveIntensity: 0.6 }), 0, -0.85, 0.15, 0.04, 0.55);

  // Head & Green KAROTA Beret
  addBox(root, skinMat, 0, 1.68, 0, 0.28, 0.32, 0.28);
  const beret = addCyl(root, beretMat, 0.04, 1.86, 0, 0.22, 0.14);
  beret.rotation.z = -0.15;

  root.traverse((obj) => {
    obj.castShadow = true;
    obj.receiveShadow = true;
  });

  return root;
}
