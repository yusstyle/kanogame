import type { HomeNavInfo, PropertyId } from "./types";
import { PROPERTY_REGISTRY } from "./propertyRegistry";

export type LandmarkCategory = "civic" | "commercial" | "residence" | "worship" | "security" | "industrial" | "historic";

export interface LandmarkLocation {
  id: string;
  name: string;
  district: string;
  x: number;
  z: number;
  category: LandmarkCategory;
  description: string;
}

export const KANO_LANDMARKS: LandmarkLocation[] = [
  {
    id: "bank",
    name: "Arewa Commercial Bank & 24/7 ATM",
    district: "AIRPORT ROAD",
    x: 80,
    z: -22,
    category: "commercial",
    description: "3-storey corporate banking suites with outdoor 24/7 ATM cash point kiosk.",
  },
  {
    id: "restaurant",
    name: "Arewa Fast Food & Suya Lounge",
    district: "AIRPORT ROAD",
    x: 16,
    z: -42,
    category: "commercial",
    description: "Dining terrace with charcoal Suya grill, outdoor pergola, and jollof rice kitchen.",
  },
  {
    id: "gaming",
    name: "Kano Cyber & PS5 Game Hub",
    district: "AIRPORT ROAD",
    x: 80,
    z: -46,
    category: "commercial",
    description: "Esports tournament gaming centre with high-speed fibre rigs and Street Drift racing.",
  },
  {
    id: "apartment",
    name: "Airport View Apartments (Unit 2B)",
    district: "AIRPORT ROAD",
    x: 48,
    z: -50,
    category: "residence",
    description: "4-storey modern apartment building with enterable Unit 2B executive flat.",
  },
  {
    id: "bompai-flats",
    name: "Bompai Heights Luxury Flats",
    district: "BOMPAI / AIRPORT ROAD",
    x: 18,
    z: 42,
    category: "residence",
    description: "Modern 4-storey residential tower with corner glass balconies and 12-panel solar array.",
  },
  {
    id: "villa",
    name: "Al-Baraka Executive Villa",
    district: "RESIDENTIAL QUARTER",
    x: 44,
    z: 39,
    category: "residence",
    description: "Contemporary gated residence with landscaped veranda and generator house.",
  },
  {
    id: "church",
    name: "St. Stephen's Anglican Church",
    district: "SABON GARI",
    x: -48,
    z: 37,
    category: "worship",
    description: "Gothic-modern church sanctuary with bell tower, spire, altar, and choir pews.",
  },
  {
    id: "furniture-showroom",
    name: "Arewa Royal Furniture & Electronics Showroom",
    district: "SABON GARI COMMERCIAL",
    x: -22,
    z: 22,
    category: "commercial",
    description: "Multi-level home furnishing showroom featuring living room sets, Nigerian royal suites, smart electronics, and modern kitchen setups.",
  },
  {
    id: "sabon-gari-complex",
    name: "Sabon Gari Commercial Complex",
    district: "SABON GARI",
    x: -22,
    z: 48,
    category: "commercial",
    description: "Retail shopping arcade with electronics stall, textile emporium, and bookstore.",
  },
  {
    id: "market",
    name: "Sabon Gari Open-Air Kasuwa Market",
    district: "SABON GARI",
    x: -31,
    z: 31,
    category: "commercial",
    description: "Vibrant open-air food, grain, and textile market stalls with active local traders.",
  },
  {
    id: "mosque",
    name: "Community Friday Mosque",
    district: "DALA · OLD KANO",
    x: -31,
    z: -31,
    category: "worship",
    description: "Twin-minaret historic community mosque with green domes and arched prayer arcade.",
  },
  {
    id: "police",
    name: "NPF Police Post & Hilux Patrol",
    district: "AIRPORT ROAD / JUNCTION",
    x: 28,
    z: -18,
    category: "security",
    description: "Police station office, patrol Hilux pickup, and KAROTA fine settlement desk.",
  },
  {
    id: "checkpoint-karota",
    name: "KAROTA Checkpoint (Murtala Mohammed Way)",
    district: "CENTRAL JUNCTION",
    x: 20,
    z: -9.5,
    category: "security",
    description: "Traffic inspection post enforcing roadworthiness and speed limits.",
  },
  {
    id: "checkpoint-npf",
    name: "NPF Highway Patrol Checkpoint",
    district: "SABON GARI AVENUE",
    x: -10,
    z: -56,
    category: "security",
    description: "Sabon Gari Avenue security post conducting driver document verifications.",
  },
  {
    id: "expansion-gate",
    name: "Northern Industrial & Ring Road Gateway",
    district: "OUTSKIRTS EXPANSION",
    x: 0,
    z: -126,
    category: "civic",
    description: "Northern highway artery leading to Kano Ring Road and Kawu Industrial Park.",
  },
  {
    id: "kawu-freight-terminal",
    name: "Kawu Central Freight Terminal & Logistics Depot",
    district: "KAWU INDUSTRIAL",
    x: -42,
    z: -175,
    category: "industrial",
    description: "Primary interstate haulage depot with roll-up loading bays, freight docks, and pallet staging.",
  },
  {
    id: "dawanau-grain-depot",
    name: "Dawanau Grain & Wholesale Produce Depot",
    district: "KAWU INDUSTRIAL",
    x: 45,
    z: -175,
    category: "industrial",
    description: "Agricultural distribution warehouse with covered loading bays, burlap grain stacks, and weighbridge.",
  },
  {
    id: "arewa-heavy-workshop",
    name: "Arewa Heavy Vehicle Repairs & Fleet Workshop",
    district: "KAWU INDUSTRIAL",
    x: -38,
    z: -135,
    category: "industrial",
    description: "Commercial truck fleet workshop with inspection pits, engine gantry crane, and oil drum storage.",
  },
  {
    id: "container-yard",
    name: "Kano Inland Container Yard & Customs Gatehouse",
    district: "KAWU INDUSTRIAL",
    x: 42,
    z: -135,
    category: "industrial",
    description: "Intermodal freight terminal with stacked 20ft/40ft shipping containers and security checkpoint.",
  },
  {
    id: "workers-canteen",
    name: "Industrial Workers Canteen & Mai Shayi Hub",
    district: "KAWU INDUSTRIAL",
    x: -15,
    z: -155,
    category: "industrial",
    description: "Roadside canteen serving factory crew and haulage drivers with hot tea, spiced bread, and masa.",
  },
  {
    id: "logistics-dispatch-board",
    name: "Kawu Logistics Dispatch & Career Mission Board",
    district: "KAWU INDUSTRIAL",
    x: -8,
    z: -140,
    category: "industrial",
    description: "Central haulage contracts office and delivery dispatch manifest board.",
  },
  {
    id: "dala-hill",
    name: "Dala Hill Summit & Ancient Settlement Lookout",
    district: "DALA · OLD KANO",
    x: -95,
    z: -95,
    category: "historic",
    description: "Historic 18m sandstone hill, birthplace of ancient Kano settlement, with stone steps and panoramic viewing terrace.",
  },
  {
    id: "kofar-dala-gate",
    name: "Kofar Dala Gate & Ancient City Wall (Badala)",
    district: "DALA · OLD KANO",
    x: -62,
    z: -93,
    category: "historic",
    description: "Monumental defensive gate and fortified mud-brick wall with Hausa relief carvings and crenellated ramparts.",
  },
  {
    id: "dan-kano-compound",
    name: "Alhaji Dan-Kano Ancestral Compound & Zaure",
    district: "DALA · OLD KANO",
    x: -85,
    z: -68,
    category: "historic",
    description: "Historic Hausa family compound with traditional entrance Zaure, Daurin Guga pinnacles, and ancestral merchant archives.",
  },
  {
    id: "kurmi-market",
    name: "Kasuwar Kurmi Traditional Crafts & Herb Market",
    district: "DALA · OLD KANO",
    x: -75,
    z: -85,
    category: "historic",
    description: "15th-century historic marketplace featuring hand-tooled leather, brass metalwork, and traditional northern spices.",
  },
  {
    id: "kofar-mata-dye-pits",
    name: "Kofar Mata Ancient Indigo Dye Pits Heritage",
    district: "DALA · OLD KANO",
    x: -68,
    z: -105,
    category: "historic",
    description: "Ancient stone-lined circular indigo dye vats, fabric drying racks, and hand-dyed textile heritage.",
  },
  {
    id: "dandali-square",
    name: "Historic Dandali Community Square & Food Hub",
    district: "DALA · OLD KANO",
    x: -72,
    z: -72,
    category: "historic",
    description: "Vibrant neighborhood gathering square shaded by neem trees with hot Masa, Kosai, and fresh Fura da Nono food stalls.",
  },
];

export function getNearestLandmark(x: number, z: number): { landmark: LandmarkLocation; distance: number } | null {
  if (KANO_LANDMARKS.length === 0) return null;
  let nearest: LandmarkLocation = KANO_LANDMARKS[0];
  let minDistance = Infinity;

  for (const lm of KANO_LANDMARKS) {
    const dist = Math.hypot(lm.x - x, lm.z - z);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = lm;
    }
  }

  return { landmark: nearest, distance: Math.round(minDistance) };
}

export function getGpsLandmark(
  id: string | null | undefined,
  homeNavInfo?: HomeNavInfo | null,
): LandmarkLocation | null {
  if (!id) return null;
  if (id === "my-home" && homeNavInfo) {
    return {
      id: "my-home",
      name: `My Home (${homeNavInfo.name})`,
      district: homeNavInfo.district,
      x: homeNavInfo.entranceCoords.x,
      z: homeNavInfo.entranceCoords.z,
      category: "residence",
      description: `Primary residence entrance door at (${homeNavInfo.entranceCoords.x}, ${homeNavInfo.entranceCoords.z})`,
    };
  }

  // Check Property Registry entries by PropertyId
  const propReg = PROPERTY_REGISTRY[id as PropertyId];
  if (propReg) {
    return {
      id: propReg.id,
      name: propReg.name,
      district: propReg.district,
      x: propReg.entranceDoor.x,
      z: propReg.entranceDoor.z,
      category: "residence",
      description: `${propReg.description} (Entrance door at ${propReg.entranceDoor.x}, ${propReg.entranceDoor.z})`,
    };
  }

  // Handle landmark aliases for residential properties
  if (id === "apartment") {
    const reg = PROPERTY_REGISTRY["unit-2b"];
    return {
      id: "apartment",
      name: reg.name,
      district: reg.district,
      x: reg.entranceDoor.x,
      z: reg.entranceDoor.z,
      category: "residence",
      description: reg.description,
    };
  }
  if (id === "bompai-flats") {
    const reg = PROPERTY_REGISTRY["bompai-penthouse"];
    return {
      id: "bompai-flats",
      name: reg.name,
      district: reg.district,
      x: reg.entranceDoor.x,
      z: reg.entranceDoor.z,
      category: "residence",
      description: reg.description,
    };
  }
  if (id === "villa") {
    const reg = PROPERTY_REGISTRY["albaraka-villa"];
    return {
      id: "villa",
      name: reg.name,
      district: reg.district,
      x: reg.entranceDoor.x,
      z: reg.entranceDoor.z,
      category: "residence",
      description: reg.description,
    };
  }

  return KANO_LANDMARKS.find((l) => l.id === id) ?? null;
}

export interface GpsGuidance {
  targetName: string;
  district: string;
  targetCoords: { x: number; z: number };
  distanceMeters: number;
  directionCardinal: string;
  instructionText: string;
  isArrived: boolean;
}

export function computeGpsGuidance(
  playerPos: { x: number; z: number },
  targetPos: { x: number; z: number },
  targetName: string,
  district: string,
): GpsGuidance {
  const dx = targetPos.x - playerPos.x;
  const dz = targetPos.z - playerPos.z;
  const distance = Math.round(Math.hypot(dx, dz));

  let cardinal = "";
  // In Kano Streets coordinate layout:
  // -Z is North (Airport Road, Kawu Industrial)
  // +Z is South (Murtala Mohammed Way, Residential Quarter, Sabon Gari)
  // +X is East (Modern District, Bompai)
  // -X is West (Historic Kano, Dala, Kurmi)
  if (Math.abs(dz) > 2.2 * Math.abs(dx)) {
    cardinal = dz < 0 ? "North" : "South";
  } else if (Math.abs(dx) > 2.2 * Math.abs(dz)) {
    cardinal = dx > 0 ? "East" : "West";
  } else {
    const ns = dz < 0 ? "North" : "South";
    const ew = dx > 0 ? "East" : "West";
    cardinal = `${ns}-${ew}`;
  }

  let instruction = "";
  const isArrived = distance <= 3.8;

  if (isArrived) {
    instruction = `Arrived at Entrance Door! Press [E] to Enter.`;
  } else if (distance <= 10) {
    instruction = `Almost there (${distance}m)! Entrance door is right ahead facing ${cardinal}.`;
  } else {
    instruction = `Head ${cardinal} · ${distance}m to physical entrance door (${targetPos.x}, ${targetPos.z}).`;
  }

  return {
    targetName,
    district,
    targetCoords: targetPos,
    distanceMeters: distance,
    directionCardinal: cardinal,
    instructionText: instruction,
    isArrived,
  };
}


