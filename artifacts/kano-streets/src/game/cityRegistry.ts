import type { PropertyId } from "./types";

export type CityId = "kano" | "abuja" | "lagos" | "jos" | "kaduna";

export type EnvironmentType =
  | "large_city"
  | "federal_capital"
  | "coastal_megacity"
  | "plateau_highlands"
  | "savannah_hub"
  | "highway"
  | "rural_village"
  | "mountainous"
  | "waterfront"
  | "agricultural"
  | "industrial";

export type TravelMethod = "highway" | "flight" | "luxury_bus";

export interface TravelTerminalSpec {
  id: string;
  name: string;
  method: TravelMethod;
  destinationCity: CityId;
  departureCoords: { x: number; y: number; z: number };
  costCash: number;
  travelTimeHours: number;
  description: string;
}

export interface CityDistrictSpec {
  id: string;
  name: string;
  category: "historic" | "commercial" | "government" | "residential" | "industrial" | "parks";
  description: string;
}

export interface CitySpec {
  id: CityId;
  name: string;
  state: string;
  title: string;
  slogan: string;
  status: "playable" | "planned";
  environmentType: EnvironmentType;
  climate: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  skyColor: string;
  sunColor: string;
  sunIntensity: number;
  groundBaseColor: string;
  ambientSounds: {
    day: string;
    night: string;
    trafficHum: string;
  };
  districts: CityDistrictSpec[];
  terminals: TravelTerminalSpec[];
  defaultSpawn: { x: number; y: number; z: number; yaw: number };
  intercityHighwaySpawn: { x: number; y: number; z: number; yaw: number };
  airportSpawn: { x: number; y: number; z: number; yaw: number };
}

export const CITIES_REGISTRY: Record<CityId, CitySpec> = {
  kano: {
    id: "kano",
    name: "Kano",
    state: "Kano State",
    title: "Kano · Ancient Commercial Centre",
    slogan: "Cibiyar Kasuwanci da Al'ada · Commercial Centre of Northern Nigeria",
    status: "playable",
    environmentType: "large_city",
    climate: "Sahelian Semi-Arid · Harmattan Haze & Bright Sun",
    fogColor: "#dcd4c3",
    fogNear: 42,
    fogFar: 240,
    skyColor: "#dcd4c3",
    sunColor: "#fff4dd",
    sunIntensity: 2.1,
    groundBaseColor: "#9d8057",
    ambientSounds: {
      day: "ambient_kano_day",
      night: "ambient_kano_night",
      trafficHum: "traffic_kano_arterial",
    },
    districts: [
      { id: "dala", name: "Dala · Old Ancient Walled City", category: "historic", description: "Historic earthen architecture, narrow zaure passages, mud walls, and Gidan Rumfa royal palace." },
      { id: "sabon-gari", name: "Sabon Gari Commercial", category: "commercial", description: "Cosmopolitan trade quarter with Kasuwa open-air market, electronics plazas, and bustling commerce." },
      { id: "airport-road", name: "Airport Road & Financial Strip", category: "commercial", description: "Corporate banking plazas, ATMs, Bompai luxury apartments, and modern restaurants." },
      { id: "residential", name: "Residential Quarter & Villas", category: "residential", description: "Spacious compound residences, Al-Baraka Executive Villa, and private family gardens." },
      { id: "industrial", name: "Kawu Freight & Logistics District", category: "industrial", description: "Heavy vehicle repairs, freight terminals, and interstate haulage warehouses." },
    ],
    terminals: [
      {
        id: "kano-south-toll",
        name: "Kano - Abuja Expressway Toll Plaza (Highway A2)",
        method: "highway",
        destinationCity: "abuja",
        departureCoords: { x: 0, y: 0, z: 128 },
        costCash: 0,
        travelTimeHours: 5.5,
        description: "Direct interstate driving route south via Federal Highway A2 through Zaria and Kaduna to Abuja.",
      },
      {
        id: "kano-airport-terminal",
        name: "Mallam Aminu Kano International Airport (KAN)",
        method: "flight",
        destinationCity: "abuja",
        departureCoords: { x: 62, y: 0, z: -100 },
        costCash: 35000,
        travelTimeHours: 0.8,
        description: "Direct domestic flight to Nnamdi Azikiwe International Airport, Abuja.",
      },
    ],
    defaultSpawn: { x: 0, y: 0, z: 0, yaw: 0 },
    intercityHighwaySpawn: { x: 0, y: 0, z: 120, yaw: Math.PI },
    airportSpawn: { x: 58, y: 0, z: -94, yaw: 0 },
  },

  abuja: {
    id: "abuja",
    name: "Abuja",
    state: "Federal Capital Territory",
    title: "Abuja · Federal Capital Territory",
    slogan: "Centre of Unity · Modern Administrative & Diplomatic Metropolis",
    status: "playable",
    environmentType: "federal_capital",
    climate: "Guinean Forest-Savannah Tropical Wet & Dry · Crisp Granite Mist",
    fogColor: "#cad5cc",
    fogNear: 55,
    fogFar: 290,
    skyColor: "#c6d6cf",
    sunColor: "#fff7eb",
    sunIntensity: 2.25,
    groundBaseColor: "#5b6e58",
    ambientSounds: {
      day: "ambient_abuja_birds_fountain",
      night: "ambient_abuja_night_breeze",
      trafficHum: "traffic_abuja_expressway",
    },
    districts: [
      { id: "three-arms", name: "Three Arms Zone & Central District", category: "government", description: "Monumental National Assembly dome, Supreme Court, Central Bank Tower, and Aso Rock backdrop." },
      { id: "cbd-monuments", name: "Central Business District & Monuments", category: "commercial", description: "Soaring National Mosque golden dome, National Christian Centre spire, and NNPC corporate twin towers." },
      { id: "maitama", name: "Maitama & Asokoro Diplomatic Estates", category: "residential", description: "Ultra-luxury gated compounds, diplomatic residences, private swimming pools, and high-security villas." },
      { id: "wuse-commercial", name: "Wuse 2 Commercial & Shopping Arcade", category: "commercial", description: "Grand Jabi shopping malls, 5-star hotel towers, Continental shawarma terraces, and cafes." },
      { id: "central-park", name: "Millennium Park & Recreational Gardens", category: "parks", description: "Lush botanical gardens, ornamental water fountains, paved jogging walkways, and gazebos." },
      { id: "outskirts-expressway", name: "Federal Highway A2 & NNPC Mega Station", category: "industrial", description: "Multi-lane expressways, modern 8-pump NNPC Mega fuel station, and interstate toll gate to Kano." },
    ],
    terminals: [
      {
        id: "abuja-north-toll",
        name: "Abuja - Kano Expressway Toll Plaza (Highway A2)",
        method: "highway",
        destinationCity: "kano",
        departureCoords: { x: 0, y: 0, z: -160 },
        costCash: 0,
        travelTimeHours: 5.5,
        description: "Direct interstate driving route north via Federal Highway A2 through Kaduna and Zaria to Kano.",
      },
      {
        id: "abuja-airport-terminal",
        name: "Nnamdi Azikiwe International Airport (ABV)",
        method: "flight",
        destinationCity: "kano",
        departureCoords: { x: 100, y: 0, z: 120 },
        costCash: 35000,
        travelTimeHours: 0.8,
        description: "Direct domestic flight to Mallam Aminu Kano International Airport, Kano.",
      },
    ],
    defaultSpawn: { x: 0, y: 0, z: -40, yaw: 0 },
    intercityHighwaySpawn: { x: 0, y: 0, z: -145, yaw: 0 },
    airportSpawn: { x: 92, y: 0, z: 112, yaw: Math.PI / 2 },
  },

  lagos: {
    id: "lagos",
    name: "Lagos",
    state: "Lagos State",
    title: "Lagos · Coastal Atlantic Megacity",
    slogan: "Centre of Excellence · The Commercial Engine of Africa",
    status: "planned",
    environmentType: "coastal_megacity",
    climate: "Tropical Atlantic Maritime · Ocean Breeze & High Humidity",
    fogColor: "#b8ccd6",
    fogNear: 35,
    fogFar: 220,
    skyColor: "#b2c8d4",
    sunColor: "#fff8ee",
    sunIntensity: 2.3,
    groundBaseColor: "#4a5a54",
    ambientSounds: {
      day: "ambient_lagos_ocean_danfo",
      night: "ambient_lagos_night_buzz",
      trafficHum: "traffic_lagos_third_mainland",
    },
    districts: [
      { id: "victoria-island", name: "Victoria Island & Marina Waterfront", category: "commercial", description: "Corporate banking skyscrapers, Atlantic coastline, and luxury yachts." },
      { id: "lekki-phase1", name: "Lekki Phase 1 Residential Strip", category: "residential", description: "Contemporary gated estates, art galleries, and upscale waterfront lounges." },
      { id: "ikeja-commercial", name: "Ikeja Computer Village & Maryland", category: "commercial", description: "Bustling electronics markets, state capital administrative quarters, and transit hubs." },
    ],
    terminals: [],
    defaultSpawn: { x: 0, y: 0, z: 0, yaw: 0 },
    intercityHighwaySpawn: { x: 0, y: 0, z: 0, yaw: 0 },
    airportSpawn: { x: 0, y: 0, z: 0, yaw: 0 },
  },

  jos: {
    id: "jos",
    name: "Jos",
    state: "Plateau State",
    title: "Jos · Highland Plateau Haven",
    slogan: "Home of Peace & Tourism · Temperate Rock Formations",
    status: "planned",
    environmentType: "plateau_highlands",
    climate: "Temperate Highland Continental · Crisp Mountain Breeze & Pine Hills",
    fogColor: "#d2d8d8",
    fogNear: 50,
    fogFar: 300,
    skyColor: "#ccd7d8",
    sunColor: "#fffbe8",
    sunIntensity: 2.1,
    groundBaseColor: "#6c6a58",
    ambientSounds: {
      day: "ambient_jos_highland_wind",
      night: "ambient_jos_crickets",
      trafficHum: "traffic_jos_hilly_roads",
    },
    districts: [
      { id: "rayfield", name: "Rayfield Resort & Golf Estate", category: "residential", description: "Scenic granite lakeside mansions and pine-lined boulevards." },
      { id: "terminus", name: "Jos Terminus Central Commercial", category: "commercial", description: "Mountain market stalls, textile centers, and historic tin mining architecture." },
    ],
    terminals: [],
    defaultSpawn: { x: 0, y: 0, z: 0, yaw: 0 },
    intercityHighwaySpawn: { x: 0, y: 0, z: 0, yaw: 0 },
    airportSpawn: { x: 0, y: 0, z: 0, yaw: 0 },
  },

  kaduna: {
    id: "kaduna",
    name: "Kaduna",
    state: "Kaduna State",
    title: "Kaduna · Savannah Industrial Capital",
    slogan: "Centre of Learning · Northern Railway & Industrial Crossroads",
    status: "planned",
    environmentType: "savannah_hub",
    climate: "Tropical Savannah · Expansive Sunlit Horizons & Riverfront",
    fogColor: "#dbd4c4",
    fogNear: 45,
    fogFar: 250,
    skyColor: "#d9d0bf",
    sunColor: "#fff5de",
    sunIntensity: 2.2,
    groundBaseColor: "#8e7855",
    ambientSounds: {
      day: "ambient_kaduna_river_train",
      night: "ambient_kaduna_night",
      trafficHum: "traffic_kaduna_broad_streets",
    },
    districts: [
      { id: "ahmadu-bello-way", name: "Ahmadu Bello Commercial Boulevard", category: "commercial", description: "Tree-lined central avenue with financial banks, hotels, and retail arcades." },
      { id: "barnawa", name: "Barnawa Waterfront Residential", category: "residential", description: "Kaduna River bridge crossings, riverside parks, and residential villas." },
    ],
    terminals: [],
    defaultSpawn: { x: 0, y: 0, z: 0, yaw: 0 },
    intercityHighwaySpawn: { x: 0, y: 0, z: 0, yaw: 0 },
    airportSpawn: { x: 0, y: 0, z: 0, yaw: 0 },
  },
};

export function getCitySpec(cityId: CityId): CitySpec {
  return CITIES_REGISTRY[cityId] || CITIES_REGISTRY.kano;
}

export function getAllCities(): CitySpec[] {
  return Object.values(CITIES_REGISTRY);
}

export function getPlayableCities(): CitySpec[] {
  return Object.values(CITIES_REGISTRY).filter((c) => c.status === "playable");
}

