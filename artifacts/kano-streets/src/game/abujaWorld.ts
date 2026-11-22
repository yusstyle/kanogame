import * as THREE from "three";
import { buildAbujaInfrastructure } from "./abujaInfrastructure";
import {
  buildRollingSavannahTerrain,
  createRealisticAsoRock,
  createMillenniumParkLandscape,
} from "./abujaLandscape";
import { buildAbujaVegetationSystem } from "./abujaVegetation";
import { AbujaStreamingManager } from "./abujaStreaming";
import { buildStreamingChunk } from "./abujaDistrictsExpanded";
import {
  createThreeArmsCivicComplex,
  createAbujaNationalMosque,
  createNationalChristianCentre,
  createCbnCurvedTower,
  createNnpcTwinTowers,
  createGrandShoppingMall,
  createAbujaLuxuryHotel,
  createMaitamaLuxuryVilla,
  createNnpcMegaFuelStation,
  createWuseMarketPavilions,
  createIntercityTollPlaza,
  createAirportTerminalShuttle,
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
  streamingManager: AbujaStreamingManager;
}

export function createAbujaSkyTexture(): THREE.Texture {
  if (typeof document === "undefined") {
    return new THREE.Texture();
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  // Natural tropical sky vertical atmospheric gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, "#0f4a86"); // Tropical deep azure zenith
  grad.addColorStop(0.3, "#1e68a8"); // Upper sky
  grad.addColorStop(0.55, "#4289bf"); // Mid sky
  grad.addColorStop(0.78, "#8bbce2"); // Lower atmospheric scattering
  grad.addColorStop(0.92, "#bfd6e8"); // Soft luminous horizon
  grad.addColorStop(0.98, "#dad3c5"); // Warm savannah horizon dust
  grad.addColorStop(1.0, "#9e917d");  // Ground horizon wash
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle solar glow and corona
  const sunX = 360;
  const sunY = 140;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 180);
  sunGrad.addColorStop(0.0, "rgba(255, 255, 245, 0.95)");
  sunGrad.addColorStop(0.08, "rgba(255, 245, 215, 0.75)");
  sunGrad.addColorStop(0.35, "rgba(255, 225, 175, 0.25)");
  sunGrad.addColorStop(0.7, "rgba(255, 215, 160, 0.08)");
  sunGrad.addColorStop(1.0, "rgba(255, 215, 160, 0.0)");
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Soft atmospheric cumulus clouds near horizon
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  const cloudBands = [
    { y: 340, w: 90, h: 14, count: 6 },
    { y: 380, w: 120, h: 18, count: 5 },
    { y: 415, w: 140, h: 20, count: 5 },
  ];
  for (const band of cloudBands) {
    for (let c = 0; c < band.count; c++) {
      const cx = (c * (512 / band.count) + (band.y % 40) * 3) % 512;
      ctx.beginPath();
      ctx.ellipse(cx, band.y, band.w * 0.5, band.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createAbujaWorld(materials: GameMaterials): AbujaWorldResult {
  const root = new THREE.Group();
  root.name = "AbujaWorldRoot";
  const colliders: Collider[] = [];
  const staticBatches: THREE.Mesh[] = [];
  const bounds = 1024; // Expanded 2,048m x 2,048m Metropolis Territory

  // 1. Sky Dome tailored for Abuja (Atmospheric tropical sky with visible horizon)
  const skyGeo = new THREE.SphereGeometry(1800, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    map: createAbujaSkyTexture(),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = "AbujaSkyDome";
  root.add(skyMesh);

  // 2. Rolling Savannah Terrain Base with Laterite Earth & Undulating Elevation
  const rollingTerrain = buildRollingSavannahTerrain(bounds);
  root.add(rollingTerrain);

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

  // 6. Colossal Realistic Aso Rock Monolith Northeast Horizon
  const asoRock = createRealisticAsoRock(materials, colliders);
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
  const centralPark = createMillenniumParkLandscape(materials, colliders, 0, 50);
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

  // 14. Nigerian Savannah Vegetation System (Royal Palms, Fan Palms, Acacias, Flamboyants, Shrubs, Boulders)
  const vegetationSystem = buildAbujaVegetationSystem(bounds);
  root.add(vegetationSystem);

  // Modern Solar Streetlights on Major Boulevard Median
  const streetlightPositions: { x: number; y: number; z: number }[] = [];
  for (let zPos = -140; zPos <= 140; zPos += 20) {
    if (Math.abs(zPos) < 26) continue; // skip roundabout
    if (zPos % 40 === 0) {
      streetlightPositions.push({ x: 0, y: 0, z: zPos });
    }
  }
  const streetlightInstances = createModernSolarStreetlightInstances(streetlightPositions, materials);
  streetlightInstances.userData.noMerge = true;
  root.add(streetlightInstances);

  // 15. Spatial World Streaming System (64 District Chunks across 2,048m x 2,048m)
  const streamingManager = new AbujaStreamingManager();
  for (let cx = -4; cx <= 3; cx++) {
    for (let cz = -4; cz <= 3; cz++) {
      const { type, name } = streamingManager.getDistrictClassification(cx, cz);
      const chunk = buildStreamingChunk(cx, cz, streamingManager.chunkSize, type, name, materials);
      streamingManager.registerChunk(chunk);
      colliders.push(...chunk.colliders);
    }
  }
  streamingManager.root.userData.noMerge = true;
  root.add(streamingManager.root);

  // 16. Peripheral Metropolis Boundaries & Security Checkpoints (at +/- 1,034m)
  const boundaryThickness = 6;
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
      height: 16,
    });
  });

  // Batch static geometries into high-performance 64m chunks
  mergeStaticMeshesByCell(root, staticBatches);

  return { root, colliders, bounds, staticBatches, skyMesh, gateSlots: [], streamingManager };
}
