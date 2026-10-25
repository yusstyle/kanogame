export interface LandmarkLocation {
  id: string;
  name: string;
  district: string;
  x: number;
  z: number;
  category: "civic" | "commercial" | "residence" | "worship" | "security" | "industrial";
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

