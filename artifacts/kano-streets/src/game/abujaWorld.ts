import * as THREE from "three";
import {
  createAsoRockMonolith,
  createThreeArmsCivicComplex,
  createAbujaNationalMosque,
  createNationalChristianCentre,
  createCbnCurvedTower,
  createNnpcTwinTowers,
  createGrandShoppingMall,
  createAbujaLuxuryHotel,
  createMaitamaLuxuryVilla,
  createNnpcMegaFuelStation,
  createCentralParkRecreation,
  createWuseMarketPavilions,
  createIntercityTollPlaza,
  createAirportTerminalShuttle,
  createTropicalPalmTree,
  createModernSolarStreetlight,
} from "./abujaDistrict";
import { mergeStaticMeshesByCell } from "./world";
import type { Collider, GameMaterials } from "./types";

export interface AbujaWorldResult {
  root: THREE.Group;
  colliders: Collider[];
  bounds: number;
  staticBatches: THREE.Mesh[];
  skyMesh: THREE.Mesh;
  gateSlots: THREE.Group[];
}

export function createAbujaWorld(materials: GameMaterials): AbujaWorldResult {
  const root = new THREE.Group();
  root.name = "AbujaWorldRoot";
  const colliders: Collider[] = [];
  const staticBatches: THREE.Mesh[] = [];
  const bounds = 220;

  // Custom materials tailored for the Federal Capital Territory
  const grassMat = new THREE.MeshStandardMaterial({
    color: "#3a6344", // Lush Guinean forest-savannah green
    roughness: 0.92,
  });

  const boulevardAsphalt = new THREE.MeshStandardMaterial({
    color: "#232629",
    roughness: 0.78,
  });

  const medianGreen = new THREE.MeshStandardMaterial({
    color: "#2d5a36",
    roughness: 0.9,
  });

  const kerbWhite = new THREE.MeshStandardMaterial({
    color: "#eaecee",
    roughness: 0.4,
  });

  const roadLineWhite = new THREE.MeshStandardMaterial({
    color: "#fdfefe",
    roughness: 0.3,
  });

  const roadLineYellow = new THREE.MeshStandardMaterial({
    color: "#f4d03f",
    roughness: 0.35,
  });

  // 1. Sky Dome tailored for Abuja (Crisp Slate/Teal Horizon)
  const skyGeo = new THREE.SphereGeometry(380, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    color: "#c2d4cb",
    side: THREE.BackSide,
    depthWrite: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = "AbujaSkyDome";
  root.add(skyMesh);

  // 2. Expansive Terrain Base
  const terrainGeo = new THREE.PlaneGeometry(bounds * 2 + 100, bounds * 2 + 100);
  const terrainMesh = new THREE.Mesh(terrainGeo, grassMat);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.position.y = -0.05;
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // 3. Multi-Lane Expressway Network
  // Shehu Shagari Way (North-South Arterial: 28m wide, 8 lanes + median)
  const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(28, bounds * 2), boulevardAsphalt);
  nsRoad.rotation.x = -Math.PI / 2;
  nsRoad.position.set(0, 0, 0);
  nsRoad.receiveShadow = true;
  root.add(nsRoad);

  // Center Landscaped Median on N-S Highway
  const nsMedian = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, bounds * 2), medianGreen);
  nsMedian.position.set(0, 0.12, 0);
  nsMedian.receiveShadow = true;
  root.add(nsMedian);

  // Constitution Avenue (East-West Arterial: 24m wide)
  const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(bounds * 2, 24), boulevardAsphalt);
  ewRoad.rotation.x = -Math.PI / 2;
  ewRoad.position.set(0, 0, 0);
  ewRoad.receiveShadow = true;
  root.add(ewRoad);

  // Center Median on E-W Highway
  const ewMedian = new THREE.Mesh(new THREE.BoxGeometry(bounds * 2, 0.25, 2.2), medianGreen);
  ewMedian.position.set(0, 0.12, 0);
  ewMedian.receiveShadow = true;
  root.add(ewMedian);

  // Peripheral Secondary Avenues
  // Maitama Boulevard (x = -90, running north-south)
  const maitamaRoad = new THREE.Mesh(new THREE.PlaneGeometry(16, bounds * 1.6), boulevardAsphalt);
  maitamaRoad.rotation.x = -Math.PI / 2;
  maitamaRoad.position.set(-90, 0, 0);
  maitamaRoad.receiveShadow = true;
  root.add(maitamaRoad);

  // CBD Herbert Macaulay Way (x = 90, running north-south)
  const cbdRoad = new THREE.Mesh(new THREE.PlaneGeometry(18, bounds * 1.6), boulevardAsphalt);
  cbdRoad.rotation.x = -Math.PI / 2;
  cbdRoad.position.set(90, 0, 0);
  cbdRoad.receiveShadow = true;
  root.add(cbdRoad);

  // Wuse 2 Commercial Link (z = 90, running east-west)
  const wuseRoad = new THREE.Mesh(new THREE.PlaneGeometry(bounds * 1.6, 16), boulevardAsphalt);
  wuseRoad.rotation.x = -Math.PI / 2;
  wuseRoad.position.set(0, 0, 90);
  wuseRoad.receiveShadow = true;
  root.add(wuseRoad);

  // Three Arms Civic Avenue (z = -90, running east-west)
  const civicRoad = new THREE.Mesh(new THREE.PlaneGeometry(bounds * 1.6, 18), boulevardAsphalt);
  civicRoad.rotation.x = -Math.PI / 2;
  civicRoad.position.set(0, 0, -90);
  civicRoad.receiveShadow = true;
  root.add(civicRoad);

  // 4. Central Monumental Roundabout (x: 0, z: 0)
  const roundaboutRing = new THREE.Mesh(new THREE.CylinderGeometry(20, 20.2, 0.35, 32), kerbWhite);
  roundaboutRing.position.set(0, 0.18, 0);
  roundaboutRing.receiveShadow = true;
  root.add(roundaboutRing);

  const roundaboutLawn = new THREE.Mesh(new THREE.CylinderGeometry(18.5, 18.5, 0.45, 32), medianGreen);
  roundaboutLawn.position.set(0, 0.22, 0);
  roundaboutLawn.receiveShadow = true;
  root.add(roundaboutLawn);

  // Central Monumental Granite Obelisk & Water Basin
  const obeliskBase = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 6), materials.concrete);
  obeliskBase.position.set(0, 1.2, 0);
  obeliskBase.castShadow = true;
  root.add(obeliskBase);

  const obeliskSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.8, 18, 4), materials.stone);
  obeliskSpire.position.set(0, 11, 0);
  obeliskSpire.rotation.y = Math.PI / 4;
  obeliskSpire.castShadow = true;
  root.add(obeliskSpire);
  colliders.push({ x: 0, z: 0, halfX: 3.5, halfZ: 3.5, height: 20 });

  // 5. White Thermoplastic Lane Markings on Major Boulevards
  for (let lz = -bounds + 10; lz < bounds - 10; lz += 8) {
    if (Math.abs(lz) < 24) continue; // skip central roundabout
    // Left & Right Lane Dashes
    for (const lx of [-8, 8]) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 4.5), roadLineWhite);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(lx, 0.02, lz);
      root.add(dash);
    }
  }

  for (let lx = -bounds + 10; lx < bounds - 10; lx += 8) {
    if (Math.abs(lx) < 24) continue; // skip central roundabout
    for (const lz of [-6.5, 6.5]) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.3), roadLineWhite);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(lx, 0.02, lz);
      root.add(dash);
    }
  }

  // 6. Aso Rock Monolith Northeast Horizon
  const asoRock = createAsoRockMonolith(materials);
  asoRock.position.set(40, 0, -255);
  root.add(asoRock);

  // 7. Three Arms Zone & Civic Complexes
  // National Assembly Monumental Complex (x: 0, z: -105)
  const nationalAssembly = createThreeArmsCivicComplex(materials, colliders, 0, -105);
  root.add(nationalAssembly);

  // 8. Central Business District (CBD) & Religious Monuments
  // Abuja National Mosque with Golden Dome & 4 Pencil Minarets (x: 48, z: -42)
  const nationalMosque = createAbujaNationalMosque(materials, colliders, 48, -42);
  root.add(nationalMosque);

  // National Christian Ecumenical Centre (x: 48, z: 42)
  const christianCentre = createNationalChristianCentre(materials, colliders, 48, 42);
  root.add(christianCentre);

  // Central Bank of Nigeria (CBN) High-Rise Curved Tower (x: 90, z: -35)
  const cbnTower = createCbnCurvedTower(materials, colliders, 90, -35);
  root.add(cbnTower);

  // NNPC Twin Corporate Towers (x: 90, z: 40)
  const nnpcTowers = createNnpcTwinTowers(materials, colliders, 90, 40);
  root.add(nnpcTowers);

  // 9. Maitama & Asokoro Diplomatic Residential Estates
  // Maitama Luxury Villa Compound A (x: -55, z: -38)
  const maitamaVillaA = createMaitamaLuxuryVilla(materials, colliders, -55, -38);
  root.add(maitamaVillaA);

  // Maitama Luxury Villa Compound B (x: -55, z: 38)
  const maitamaVillaB = createMaitamaLuxuryVilla(materials, colliders, -55, 38);
  root.add(maitamaVillaB);

  // 10. Wuse 2 Commercial & Hospitality District
  // Grand Jabi Lake / Ceddi Plaza Shopping Mall (x: -55, z: 88)
  const shoppingMall = createGrandShoppingMall(materials, colliders, -55, 88);
  root.add(shoppingMall);

  // Abuja Continental 5-Star Luxury Hotel & Suites (x: -55, z: 140)
  const luxuryHotel = createAbujaLuxuryHotel(materials, colliders, -55, 140);
  root.add(luxuryHotel);

  // 11. Millennium Park & Recreational Gardens (x: 0, z: 50)
  const centralPark = createCentralParkRecreation(materials, colliders, 0, 50);
  root.add(centralPark);

  // 12. Public Amenities & Local Trade
  // NNPC Mega Fuel Station & QuickMart (x: 35, z: 120)
  const fuelStation = createNnpcMegaFuelStation(materials, colliders, 35, 120);
  root.add(fuelStation);

  // Wuse Kasuwa Modern Market Pavilions (x: -18, z: 120)
  const wuseMarket = createWuseMarketPavilions(materials, colliders, -18, 120);
  root.add(wuseMarket);

  // 13. Intercity Travel Gateways
  // Highway A2 Intercity Toll Plaza (Departure Drive to Kano) at North Gateway (x: 0, z: -160)
  const tollPlaza = createIntercityTollPlaza(materials, colliders, 0, -160, "KANO (420 KM)");
  root.add(tollPlaza);

  // Nnamdi Azikiwe Airport Shuttle Terminal (Fly to Kano) at (x: 90, z: 120)
  const airportTerminal = createAirportTerminalShuttle(materials, colliders, 90, 120);
  root.add(airportTerminal);

  // 14. Tropical Royal Palm Trees & Streetlights lining Boulevards
  for (let zPos = -140; zPos <= 140; zPos += 20) {
    if (Math.abs(zPos) < 26) continue; // skip roundabout
    // East and West Boulevard curbs
    for (const xPos of [-16, 16]) {
      const palm = createTropicalPalmTree(materials);
      palm.position.set(xPos, 0, zPos);
      root.add(palm);
    }
    // Solar Streetlights on Median
    if (zPos % 40 === 0) {
      const light = createModernSolarStreetlight(materials);
      light.position.set(0, 0, zPos);
      root.add(light);
    }
  }

  // East-West Avenue Palm Trees
  for (let xPos = -120; xPos <= 120; xPos += 24) {
    if (Math.abs(xPos) < 26) continue;
    for (const zPos of [-14, 14]) {
      const palm = createTropicalPalmTree(materials);
      palm.position.set(xPos, 0, zPos);
      root.add(palm);
    }
  }

  // 15. Peripheral Boundaries & Security Fences
  const boundaryThickness = 4;
  const boundPositions = [
    { x: 0, z: bounds + 10, w: bounds * 2, d: boundaryThickness },
    { x: 0, z: -bounds - 10, w: bounds * 2, d: boundaryThickness },
    { x: bounds + 10, z: 0, w: boundaryThickness, d: bounds * 2 },
    { x: -bounds - 10, z: 0, w: boundaryThickness, d: bounds * 2 },
  ];

  boundPositions.forEach((b) => {
    colliders.push({
      x: b.x,
      z: b.z,
      halfX: b.w * 0.5,
      halfZ: b.d * 0.5,
      height: 12,
    });
  });

  // Batch static geometries into high-performance 64m chunks
  mergeStaticMeshesByCell(root, staticBatches);

  return { root, colliders, bounds, staticBatches, skyMesh, gateSlots: [] };
}
