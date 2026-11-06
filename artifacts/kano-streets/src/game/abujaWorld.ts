import * as THREE from "three";
import { buildAbujaInfrastructure } from "./abujaInfrastructure";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
  createTropicalPalmTreeInstances,
  createModernSolarStreetlightInstances,
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

  // 1. Savannah Grass Terrain Base with Procedural Micro-Texture (Anti-Acne PBR)
  const grassCanvas = document.createElement("canvas");
  grassCanvas.width = grassCanvas.height = 256;
  const gCtx = grassCanvas.getContext("2d")!;
  gCtx.fillStyle = "#385e3f"; // Rich Nigerian Guinean forest-savannah green
  gCtx.fillRect(0, 0, 256, 256);
  let state = 719;
  for (let i = 0; i < 5000; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const r1 = state / 4294967296;
    state = (state * 1664525 + 1013904223) >>> 0;
    const r2 = state / 4294967296;
    gCtx.fillStyle = r1 > 0.5 ? "#2a4830" : "#456e4c";
    gCtx.fillRect(r1 * 256, r2 * 256, 1.4, 1.4);
  }
  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.colorSpace = THREE.SRGBColorSpace;
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(36, 36);

  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTexture,
    roughness: 0.90,
    metalness: 0.02,
  });

  // Sky Dome tailored for Abuja (Crisp Slate/Teal Horizon)
  const skyGeo = new THREE.SphereGeometry(380, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    color: "#c2d4cb",
    side: THREE.BackSide,
    depthWrite: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = "AbujaSkyDome";
  root.add(skyMesh);

  // Expansive Terrain Base
  const terrainGeo = new THREE.PlaneGeometry(bounds * 2 + 100, bounds * 2 + 100);
  const terrainMesh = new THREE.Mesh(terrainGeo, grassMat);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.position.y = -0.05;
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // 2. Integrated Master-Planned Infrastructure System
  // (Realistic Asphalt PBR Roads, Continuous Pedestrian Sidewalks, Beveled Curbs,
  // Stormwater Drainage Gutters, Laterite Soil Verges, Zebra Crossings, Roundabout Markings, and Non-Clipping Medians)
  const infrastructure = buildAbujaInfrastructure(bounds);
  root.add(infrastructure.group);
  colliders.push(...infrastructure.colliders);

  // 3. Central Monumental Obelisk & Water Fountain Basin at (0, 0)
  const obeliskBase = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 7), materials.concrete);
  obeliskBase.position.set(0, 0.9, 0);
  obeliskBase.castShadow = true;
  obeliskBase.receiveShadow = true;
  root.add(obeliskBase);

  // Fountain water basin around obelisk
  const basinRing = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.8, 0.8, 32), materials.concrete);
  basinRing.position.set(0, 0.4, 0);
  basinRing.receiveShadow = true;
  root.add(basinRing);

  const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 0.6, 32), new THREE.MeshStandardMaterial({
    color: "#0077b6",
    roughness: 0.1,
    metalness: 0.4,
  }));
  basinWater.position.set(0, 0.45, 0);
  basinWater.receiveShadow = true;
  root.add(basinWater);

  const obeliskSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.8, 18, 4), materials.stone);
  obeliskSpire.position.set(0, 10.5, 0);
  obeliskSpire.rotation.y = Math.PI / 4;
  obeliskSpire.castShadow = true;
  root.add(obeliskSpire);
  colliders.push({ x: 0, z: 0, halfX: 4.2, halfZ: 4.2, height: 20 });

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

  // 14. High-Performance Instanced Palm Trees & Solar Streetlights
  const palmPositions: { x: number; y: number; z: number }[] = [];
  const streetlightPositions: { x: number; y: number; z: number }[] = [];

  for (let zPos = -140; zPos <= 140; zPos += 20) {
    if (Math.abs(zPos) < 26) continue; // skip roundabout
    // East and West Boulevard curbs
    for (const xPos of [-16, 16]) {
      palmPositions.push({ x: xPos, y: 0, z: zPos });
    }
    // Solar Streetlights on Median
    if (zPos % 40 === 0) {
      streetlightPositions.push({ x: 0, y: 0, z: zPos });
    }
  }

  // East-West Avenue Palm Trees
  for (let xPos = -120; xPos <= 120; xPos += 24) {
    if (Math.abs(xPos) < 26) continue;
    for (const zPos of [-14, 14]) {
      palmPositions.push({ x: xPos, y: 0, z: zPos });
    }
  }

  const palmInstances = createTropicalPalmTreeInstances(palmPositions);
  palmInstances.userData.noMerge = true;
  root.add(palmInstances);

  const streetlightInstances = createModernSolarStreetlightInstances(streetlightPositions, materials);
  streetlightInstances.userData.noMerge = true;
  root.add(streetlightInstances);

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
