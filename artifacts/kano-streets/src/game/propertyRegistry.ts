import * as THREE from "three";
import type { InteriorId, PropertyId } from "./types";

export interface PropertyRoomSpec {
  name: string;
  floor: number;
  description: string;
}

export interface PropertyRegistryEntry {
  id: PropertyId;
  name: string;
  type: "apartment" | "penthouse" | "villa";
  interiorId: InteriorId;
  district: string;
  exteriorCoords: { x: number; z: number };
  entranceDoor: { x: number; y: number; z: number; yaw: number };
  interiorSpawn: { x: number; y: number; z: number; yaw: number };
  interiorExit: { x: number; y: number; z: number };
  purchasePrice: number;
  rentMonthly?: number;
  dailyUpkeep: number;
  rooms: PropertyRoomSpec[];
  features: string[];
  description: string;
}

export const PROPERTY_REGISTRY: Record<PropertyId, PropertyRegistryEntry> = {
  "unit-2b": {
    id: "unit-2b",
    name: "Airport View Apartments · Unit 2B",
    type: "apartment",
    interiorId: "apartment",
    district: "AIRPORT ROAD",
    exteriorCoords: { x: 48, z: -50 },
    entranceDoor: { x: 48, y: 0, z: -43.5, yaw: 0 },
    interiorSpawn: { x: 260, y: -59.9, z: 3.4, yaw: Math.PI },
    interiorExit: { x: 260, y: -59.9, z: 4.1 },
    purchasePrice: 18_000_000,
    rentMonthly: 75_000,
    dailyUpkeep: 1_200,
    rooms: [
      { name: "Entrance Hallway", floor: 1, description: "Tiled entry vestibule with shoe rack and coat hooks" },
      { name: "Living Room", floor: 1, description: "Comfortable lounge with fabric sofa, coffee table, and media wall" },
      { name: "Executive Balcony", floor: 1, description: "Private balcony with sliding glass door looking over Airport Road" },
      { name: "Kitchen & Dining", floor: 1, description: "Compact open-plan kitchen with dining table and cabinets" },
      { name: "Master Bedroom", floor: 1, description: "Double bedroom with queen-size bed and built-in closet" },
      { name: "Ensuite Bathroom", floor: 1, description: "Tiled shower, ceramic sink, and modern sanitary ware" },
    ],
    features: [
      "Split-Unit Air Conditioning",
      "Private Sunset Balcony",
      "Dedicated Parking Bay",
      "Borehole Water Backup",
      "Deed Safe / Rental Desk",
    ],
    description: "Modern 2-bedroom executive apartment with private balcony, split AC, and reliable borehole water supply.",
  },

  "bompai-penthouse": {
    id: "bompai-penthouse",
    name: "Bompai Heights Luxury Penthouse",
    type: "penthouse",
    interiorId: "penthouse",
    district: "BOMPAI AVENUE",
    exteriorCoords: { x: 18, z: 42 },
    entranceDoor: { x: 18, y: 0, z: 39.5, yaw: Math.PI },
    interiorSpawn: { x: 300, y: -59.9, z: 86.4, yaw: Math.PI },
    interiorExit: { x: 300, y: -59.9, z: 87.2 },
    purchasePrice: 35_000_000,
    dailyUpkeep: 2_500,
    rooms: [
      { name: "Grand Entrance Foyer", floor: 1, description: "High-gloss polished granite foyer with private security safe" },
      { name: "Double-Height Living Salon", floor: 1, description: "Panoramic ceiling with crystal lighting and plush leather sectional seating" },
      { name: "Gourmet Island Kitchen", floor: 1, description: "Granite cooking island with barstools, double-door fridge, and pantry" },
      { name: "Guest Bedroom & Bath", floor: 1, description: "Furnished downstairs guest room with full modern bathroom" },
      { name: "Grand Staircase", floor: 1, description: "Polished timber stairs ascending to the upper mezzanine level" },
      { name: "Upper Mezzanine Gallery", floor: 2, description: "Overlook lounge and study library open to the floor below" },
      { name: "Master Penthouse Suite", floor: 2, description: "King-size master bedroom with luxury headboard and dressing room" },
      { name: "Skyline Rooftop Terrace", floor: 2, description: "Spacious private outdoor terrace with 360° views over Kano city" },
    ],
    features: [
      "Multi-Storey Mezzanine Floorplan",
      "Panoramic Floor-to-Ceiling Glass",
      "Private Rooftop Skyline Terrace",
      "12-Panel Solar Inverter Backup",
      "Executive Wall Safe",
      "Double Covered Carport",
    ],
    description: "Top-floor 4-bedroom luxury flat with 360° panoramic views of Kano, 12-panel solar backup, and covered carport.",
  },

  "albaraka-villa": {
    id: "albaraka-villa",
    name: "Al-Baraka Executive Villa",
    type: "villa",
    interiorId: "house",
    district: "RESIDENTIAL QUARTER",
    exteriorCoords: { x: 44, z: 39 },
    entranceDoor: { x: 44, y: 0, z: 45, yaw: 0 },
    interiorSpawn: { x: 220, y: -59.9, z: 7.2, yaw: Math.PI },
    interiorExit: { x: 220, y: -59.9, z: 7.9 },
    purchasePrice: 65_000_000,
    dailyUpkeep: 4_500,
    rooms: [
      { name: "Reception Zaure & Veranda", floor: 1, description: "Traditional shaded entrance veranda with sculpted clay seating Dakali" },
      { name: "Grand Family Parlour", floor: 1, description: "Expansive Northern living room with brass crafts and 75-inch media wall" },
      { name: "Formal Dining Room", floor: 1, description: "8-seater solid mahogany dining table with carved wooden chairs" },
      { name: "Executive Kitchen & Store", floor: 1, description: "Spacious family kitchen with gas range and walk-in dry goods pantry" },
      { name: "Children / Guest Bedroom", floor: 1, description: "Twin-bed guest room with wardrobe and desk" },
      { name: "Master Suite & Ensuite", floor: 1, description: "King-size bedroom suite with walk-in wardrobe and luxury bathroom" },
      { name: "Dakin Karatu (Study / Prayer)", floor: 1, description: "Quiet private study and prayer room with traditional carpets and bookshelves" },
      { name: "Compound Utility Yard", floor: 1, description: "Enclosed rear yard housing the 25kVA generator house and water storage" },
    ],
    features: [
      "Perimeter Security Wall & Heavy Steel Gate",
      "Private Zaure Veranda with Dakali",
      "Dedicated 25kVA Soundproof Generator House",
      "Automatic Borehole Pumping Station",
      "Multi-Room Northern Family Architecture",
      "Private Security Guard Post",
    ],
    description: "Prestigious gated family residence with landscaped front veranda, dedicated generator house, and security guard post.",
  },
};

export function getPropertyRegistryEntry(id: PropertyId): PropertyRegistryEntry | undefined {
  return PROPERTY_REGISTRY[id];
}

export function getPropertyByInteriorId(interiorId: InteriorId): PropertyRegistryEntry | undefined {
  return Object.values(PROPERTY_REGISTRY).find((entry) => entry.interiorId === interiorId);
}

export function getPropertyByEntrance(
  pos: THREE.Vector3,
  threshold = 3.6,
): PropertyRegistryEntry | undefined {
  for (const entry of Object.values(PROPERTY_REGISTRY)) {
    const door = entry.entranceDoor;
    const distSq = (pos.x - door.x) ** 2 + (pos.z - door.z) ** 2;
    if (distSq <= threshold * threshold) {
      return entry;
    }
  }
  return undefined;
}
