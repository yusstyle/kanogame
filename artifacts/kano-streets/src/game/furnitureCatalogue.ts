/**
 * Kano Streets — Centralized Furniture & Electronics Catalogue
 *
 * Authoritative catalogue defining all purchasable home furnishings,
 * consumer electronics, appliances, and decor items in Nigerian Naira (₦).
 */

import type { PropertyId } from "./types";

export type FurnitureCategory = "living" | "bedroom" | "kitchen" | "study" | "decor";
export type QualityTier = "basic" | "standard" | "premium";
export type FunctionalType = "seating" | "tv" | "computer" | "bed" | "appliance" | "lighting" | "decor";

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  tier: QualityTier;
  price: number; // in Nigerian Naira (₦)
  description: string;
  dimensions: {
    width: number;  // meters
    depth: number;  // meters
    height: number; // meters
  };
  functionalType: FunctionalType;
  compatibleRooms: string[];
  upgradeEffect?: string;
  colorOptions?: string[];
  defaultColor: string;
  modelMeshKey: string;
}

export const FURNITURE_CATALOGUE: FurnitureCatalogItem[] = [
  // =========================================================================
  // 1. LIVING ROOM
  // =========================================================================
  {
    id: "sofa_fabric_basic",
    name: "Dan-Kano Fabric Armchair",
    category: "living",
    tier: "basic",
    price: 45_000,
    description: "Comfortable single-seat upholstered armchair with durable local fabric and wooden legs.",
    dimensions: { width: 1.0, depth: 0.9, height: 0.85 },
    functionalType: "seating",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon", "Reception Zaure & Veranda"],
    upgradeEffect: "Restful seating restoring player energy on foot.",
    defaultColor: "#3d526e",
    modelMeshKey: "armchair_single",
  },
  {
    id: "sofa_sectional_fabric",
    name: "Arewa Comfort Sectional Sofa",
    category: "living",
    tier: "standard",
    price: 280_000,
    description: "L-shaped 4-seater modular sofa with plush cushions and neutral earthy upholstery.",
    dimensions: { width: 2.6, depth: 1.8, height: 0.85 },
    functionalType: "seating",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon"],
    upgradeEffect: "Spacious seating allowing player and guests to relax.",
    defaultColor: "#2c3e50",
    modelMeshKey: "sofa_sectional",
  },
  {
    id: "sofa_luxury_leather",
    name: "Royal Italian Leather Sectional",
    category: "living",
    tier: "premium",
    price: 950_000,
    description: "Handcrafted deep-brown Italian leather sectional with chrome feet and adjustable headrests.",
    dimensions: { width: 3.2, depth: 2.2, height: 0.9 },
    functionalType: "seating",
    compatibleRooms: ["Family Parlour", "Double-Height Living Salon"],
    upgradeEffect: "Prestige seating elevating property reputation.",
    defaultColor: "#3e2723",
    modelMeshKey: "sofa_luxury",
  },
  {
    id: "table_coffee_glass",
    name: "Tempered Glass & Teak Coffee Table",
    category: "living",
    tier: "standard",
    price: 65_000,
    description: "Minimalist coffee table with a smoke-tinted tempered glass top and polished teak timber base.",
    dimensions: { width: 1.4, depth: 0.8, height: 0.45 },
    functionalType: "decor",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon", "Skyline Rooftop Terrace"],
    defaultColor: "#5d4037",
    modelMeshKey: "coffee_table",
  },
  {
    id: "tv_smart_43",
    name: "43\" 4K UHD Smart TV & Stand",
    category: "living",
    tier: "basic",
    price: 160_000,
    description: "High-definition flat screen television on a compact wooden media console with cable routing.",
    dimensions: { width: 1.3, depth: 0.5, height: 1.1 },
    functionalType: "tv",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon", "Master Bedroom"],
    upgradeEffect: "Interactive TV broadcasting Kano State news and sports.",
    defaultColor: "#111111",
    modelMeshKey: "tv_stand_43",
  },
  {
    id: "tv_qled_65",
    name: "65\" Curved OLED Media Console",
    category: "living",
    tier: "standard",
    price: 520_000,
    description: "Wide curved display on a floating dark walnut console with surround-sound speakers.",
    dimensions: { width: 1.8, depth: 0.55, height: 1.3 },
    functionalType: "tv",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon", "Master Penthouse Suite"],
    upgradeEffect: "Crystal-clear entertainment broadcast with surround audio.",
    defaultColor: "#0f172a",
    modelMeshKey: "tv_console_65",
  },
  {
    id: "tv_cinema_wall_75",
    name: "75\" QLED Home Cinema Media Wall",
    category: "living",
    tier: "premium",
    price: 1_250_000,
    description: "State-of-the-art acoustic slat timber wall unit with integrated 75-inch 4K HDR QLED screen.",
    dimensions: { width: 2.4, depth: 0.5, height: 1.9 },
    functionalType: "tv",
    compatibleRooms: ["Family Parlour", "Double-Height Living Salon"],
    upgradeEffect: "Top-tier home cinema display for premier sports and films.",
    defaultColor: "#1a1a1a",
    modelMeshKey: "tv_media_wall_75",
  },
  {
    id: "rug_northern_kashim",
    name: "Traditional Kano Geometric Rug",
    category: "living",
    tier: "standard",
    price: 85_000,
    description: "Hand-knotted authentic Northern wool carpet featuring geometric diamond and cross motifs.",
    dimensions: { width: 2.8, depth: 2.0, height: 0.04 },
    functionalType: "decor",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon", "Dakin Karatu (Study / Prayer)"],
    defaultColor: "#8b2616",
    modelMeshKey: "rug_geometric",
  },
  {
    id: "lamp_arc_brass",
    name: "Polished Brass Arch Floor Lamp",
    category: "living",
    tier: "basic",
    price: 35_000,
    description: "Gracefully curved brass arched standing lamp with a warm glowing linen lampshade.",
    dimensions: { width: 0.7, depth: 0.7, height: 1.85 },
    functionalType: "lighting",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon", "Master Suite"],
    upgradeEffect: "Soft ambient evening illumination.",
    defaultColor: "#d4af37",
    modelMeshKey: "floor_lamp",
  },

  // =========================================================================
  // 2. BEDROOM
  // =========================================================================
  {
    id: "bed_single_wood",
    name: "Single Solid Pine Bed & Mattress",
    category: "bedroom",
    tier: "basic",
    price: 95_000,
    description: "Sturdy single bed frame with orthopedic spring mattress, white linens, and pillows.",
    dimensions: { width: 1.2, depth: 2.1, height: 0.9 },
    functionalType: "bed",
    compatibleRooms: ["Children / Guest Bedroom", "Guest Bedroom & Bath", "Master Bedroom"],
    upgradeEffect: "Restful sleep advancing game clock to morning.",
    defaultColor: "#a1887f",
    modelMeshKey: "bed_single",
  },
  {
    id: "bed_queen_comfort",
    name: "Queen Comfort Bed with Carved Frame",
    category: "bedroom",
    tier: "standard",
    price: 290_000,
    description: "Queen-size solid hardwood bed with carved Northern accents, dual pillows, and patterned duvet.",
    dimensions: { width: 1.8, depth: 2.2, height: 1.15 },
    functionalType: "bed",
    compatibleRooms: ["Master Bedroom", "Master Suite & Ensuite", "Guest Bedroom & Bath"],
    upgradeEffect: "Full energy rejuvenation and overnight rest.",
    defaultColor: "#4e342e",
    modelMeshKey: "bed_queen",
  },
  {
    id: "bed_king_royal",
    name: "King Royal Suite Bed with Upholstered Headboard",
    category: "bedroom",
    tier: "premium",
    price: 850_000,
    description: "Luxury 6x6 king-size bed with velvet tufted headboard, Egyptian cotton sheets, and memory foam.",
    dimensions: { width: 2.2, depth: 2.3, height: 1.4 },
    functionalType: "bed",
    compatibleRooms: ["Master Suite & Ensuite", "Master Penthouse Suite"],
    upgradeEffect: "Premium sleeping experience restoring maximum player energy.",
    defaultColor: "#1e293b",
    modelMeshKey: "bed_king",
  },
  {
    id: "nightstand_teak",
    name: "Twin Teak Nightstands & Lamps",
    category: "bedroom",
    tier: "basic",
    price: 55_000,
    description: "Pair of two-drawer teak bedside cabinets equipped with touch-activated night lamps.",
    dimensions: { width: 0.6, depth: 0.5, height: 0.75 },
    functionalType: "lighting",
    compatibleRooms: ["Master Bedroom", "Master Suite & Ensuite", "Master Penthouse Suite"],
    defaultColor: "#6d4c41",
    modelMeshKey: "nightstand_pair",
  },
  {
    id: "wardrobe_sliding_mirror",
    name: "3-Door Mirrored Executive Wardrobe",
    category: "bedroom",
    tier: "standard",
    price: 320_000,
    description: "Spacious full-height wardrobe with smooth sliding mirrored doors, clothes rails, and shelving.",
    dimensions: { width: 2.2, depth: 0.65, height: 2.3 },
    functionalType: "decor",
    compatibleRooms: ["Master Bedroom", "Master Suite & Ensuite", "Master Penthouse Suite"],
    defaultColor: "#374151",
    modelMeshKey: "wardrobe_mirrored",
  },
  {
    id: "vanity_dresser_mirror",
    name: "Vanity Dressing Table & Lighted Mirror",
    category: "bedroom",
    tier: "standard",
    price: 180_000,
    description: "Cosmetic dressing console with velvet stool, makeup drawers, and LED halo ring mirror.",
    dimensions: { width: 1.3, depth: 0.55, height: 1.6 },
    functionalType: "decor",
    compatibleRooms: ["Master Bedroom", "Master Suite & Ensuite", "Master Penthouse Suite"],
    defaultColor: "#f1f5f9",
    modelMeshKey: "vanity_dresser",
  },

  // =========================================================================
  // 3. KITCHEN & DINING
  // =========================================================================
  {
    id: "dining_table_wood_4",
    name: "4-Seater Solid Pine Dining Set",
    category: "kitchen",
    tier: "basic",
    price: 140_000,
    description: "Compact dining table with four sturdy timber chairs, suitable for everyday family meals.",
    dimensions: { width: 1.5, depth: 1.1, height: 0.85 },
    functionalType: "seating",
    compatibleRooms: ["Kitchen & Dining", "Formal Dining Room", "Gourmet Island Kitchen"],
    defaultColor: "#8d6e63",
    modelMeshKey: "dining_set_4",
  },
  {
    id: "dining_table_mahogany_8",
    name: "8-Seater Polished Mahogany Dining Suite",
    category: "kitchen",
    tier: "premium",
    price: 680_000,
    description: "Grand formal dining table crafted from genuine Nigerian mahogany with 8 carved high-back chairs.",
    dimensions: { width: 2.6, depth: 1.3, height: 0.9 },
    functionalType: "seating",
    compatibleRooms: ["Formal Dining Room", "Gourmet Island Kitchen"],
    defaultColor: "#3e2723",
    modelMeshKey: "dining_set_8",
  },
  {
    id: "fridge_single_door",
    name: "Direct-Cool Single Door Refrigerator",
    category: "kitchen",
    tier: "basic",
    price: 175_000,
    description: "Energy-efficient 190L silver finish refrigerator with fast cooling and stabilizer protection.",
    dimensions: { width: 0.7, depth: 0.7, height: 1.6 },
    functionalType: "appliance",
    compatibleRooms: ["Kitchen & Dining", "Executive Kitchen & Store", "Gourmet Island Kitchen"],
    upgradeEffect: "Stock cold drinks and Zobo refreshments.",
    defaultColor: "#94a3b8",
    modelMeshKey: "fridge_single",
  },
  {
    id: "fridge_french_door",
    name: "Inverter French-Door Smart Refrigerator",
    category: "kitchen",
    tier: "premium",
    price: 580_000,
    description: "Stainless steel multi-door smart fridge with water dispenser, ice maker, and multi-air cooling.",
    dimensions: { width: 1.1, depth: 0.85, height: 1.9 },
    functionalType: "appliance",
    compatibleRooms: ["Executive Kitchen & Store", "Gourmet Island Kitchen"],
    upgradeEffect: "Instant cold refreshment station for player stamina.",
    defaultColor: "#cbd5e1",
    modelMeshKey: "fridge_french",
  },
  {
    id: "cooker_gas_oven",
    name: "4-Burner Stainless Steel Cooker Range",
    category: "kitchen",
    tier: "standard",
    price: 240_000,
    description: "Freestanding gas cooker with 4 high-power brass burners, glass cover lid, and rotisserie oven.",
    dimensions: { width: 0.8, depth: 0.7, height: 0.95 },
    functionalType: "appliance",
    compatibleRooms: ["Kitchen & Dining", "Executive Kitchen & Store", "Gourmet Island Kitchen"],
    defaultColor: "#475569",
    modelMeshKey: "gas_cooker",
  },
  {
    id: "microwave_counter_prep",
    name: "Countertop Microwave & Espresso Station",
    category: "kitchen",
    tier: "standard",
    price: 120_000,
    description: "Compact microwave oven and Italian espresso machine mounted on a butcher-block counter.",
    dimensions: { width: 1.2, depth: 0.6, height: 0.9 },
    functionalType: "appliance",
    compatibleRooms: ["Kitchen & Dining", "Executive Kitchen & Store", "Gourmet Island Kitchen"],
    defaultColor: "#334155",
    modelMeshKey: "espresso_counter",
  },

  // =========================================================================
  // 4. STUDY & TECHNOLOGY
  // =========================================================================
  {
    id: "desk_study_simple",
    name: "Compact Study Desk & Swivel Chair",
    category: "study",
    tier: "basic",
    price: 75_000,
    description: "Laminated wooden writing desk with cable grommet, side shelf, and breathable mesh task chair.",
    dimensions: { width: 1.2, depth: 0.65, height: 0.85 },
    functionalType: "computer",
    compatibleRooms: ["Dakin Karatu (Study / Prayer)", "Upper Mezzanine Gallery", "Living Room"],
    upgradeEffect: "Contextual desk work interaction.",
    defaultColor: "#475569",
    modelMeshKey: "desk_simple",
  },
  {
    id: "desk_executive_mahogany",
    name: "Executive Northern Mahogany Workstation",
    category: "study",
    tier: "standard",
    price: 290_000,
    description: "Substantial dark mahogany partner desk with brass handles, green leather blotter, and leather captain chair.",
    dimensions: { width: 1.9, depth: 0.95, height: 0.88 },
    functionalType: "computer",
    compatibleRooms: ["Dakin Karatu (Study / Prayer)", "Upper Mezzanine Gallery"],
    upgradeEffect: "High-level commercial business contract drafting desk.",
    defaultColor: "#271c19",
    modelMeshKey: "desk_executive",
  },
  {
    id: "pc_office_workstation",
    name: "Dual-Monitor Business PC Workstation",
    category: "study",
    tier: "standard",
    price: 420_000,
    description: "Dual 27-inch IPS monitors, slim tower, keyboard, mouse, and dedicated optical fiber router.",
    dimensions: { width: 1.4, depth: 0.7, height: 0.65 },
    functionalType: "computer",
    compatibleRooms: ["Dakin Karatu (Study / Prayer)", "Upper Mezzanine Gallery"],
    upgradeEffect: "Complete remote freelance logistics contracts for ₦25,000 net income.",
    defaultColor: "#0284c7",
    modelMeshKey: "pc_workstation",
  },
  {
    id: "pc_gaming_liquid_rig",
    name: "Water-Cooled RTX RGB Gaming Battlestation",
    category: "study",
    tier: "premium",
    price: 1_450_000,
    description: "Custom liquid-cooled PC in tempered glass case with addressable RGB fans, curved 34\" ultrawide gaming monitor, mechanical keyboard, and esports chair.",
    dimensions: { width: 1.6, depth: 0.8, height: 1.3 },
    functionalType: "computer",
    compatibleRooms: ["Upper Mezzanine Gallery", "Living Room", "Dakin Karatu (Study / Prayer)"],
    upgradeEffect: "Compete in local esports tournaments and earn cash prizes.",
    defaultColor: "#06b6d4",
    modelMeshKey: "pc_gaming_rig",
  },
  {
    id: "console_ps5_gaming_tv",
    name: "PS5 Pro Entertainment & 55\" Display",
    category: "study",
    tier: "standard",
    price: 680_000,
    description: "Dual white gaming consoles, charging dock, wireless controllers, and low-latency 55-inch HDR screen.",
    dimensions: { width: 1.6, depth: 0.5, height: 1.2 },
    functionalType: "tv",
    compatibleRooms: ["Living Room", "Family Parlour", "Upper Mezzanine Gallery", "Children / Guest Bedroom"],
    upgradeEffect: "Interactive console gaming mini-activity.",
    defaultColor: "#2563eb",
    modelMeshKey: "console_ps5_setup",
  },
  {
    id: "bookshelf_solid_oak",
    name: "Floor-to-Ceiling Library Bookshelf",
    category: "study",
    tier: "standard",
    price: 150_000,
    description: "Solid oak multi-tiered bookcase stocked with historic Northern treatises, Quranic volumes, and novels.",
    dimensions: { width: 1.4, depth: 0.4, height: 2.2 },
    functionalType: "decor",
    compatibleRooms: ["Dakin Karatu (Study / Prayer)", "Upper Mezzanine Gallery", "Family Parlour"],
    defaultColor: "#78350f",
    modelMeshKey: "bookshelf_tall",
  },

  // =========================================================================
  // 5. DECORATIONS & UPGRADES
  // =========================================================================
  {
    id: "plant_indoor_monstera",
    name: "Potted Areca Palm & Indoor Monstera",
    category: "decor",
    tier: "basic",
    price: 25_000,
    description: "Ceramic glazed pot with lush tropical green foliage, adding oxygen and vibrant life to indoor rooms.",
    dimensions: { width: 0.6, depth: 0.6, height: 1.3 },
    functionalType: "decor",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon", "Executive Balcony", "Skyline Rooftop Terrace"],
    defaultColor: "#15803d",
    modelMeshKey: "indoor_plant",
  },
  {
    id: "art_kano_landscape",
    name: "Framed Painting: Ancient Kano & Dala Hill",
    category: "decor",
    tier: "standard",
    price: 75_000,
    description: "Gallery-wrapped oil on canvas celebrating the ancient red-mud walls and historic Sahelian horizon.",
    dimensions: { width: 1.6, depth: 0.08, height: 1.0 },
    functionalType: "decor",
    compatibleRooms: ["Living Room", "Family Parlour", "Double-Height Living Salon", "Grand Entrance Foyer", "Master Suite & Ensuite"],
    defaultColor: "#b45309",
    modelMeshKey: "wall_art_kano",
  },
  {
    id: "curtains_silk_drapes",
    name: "Silk-Blend Blackout Drapes & Brass Rod",
    category: "decor",
    tier: "standard",
    price: 60_000,
    description: "Floor-length heavy cream silk curtains with antique brass curtain rings and decorative finials.",
    dimensions: { width: 2.0, depth: 0.15, height: 2.4 },
    functionalType: "decor",
    compatibleRooms: ["Living Room", "Master Bedroom", "Family Parlour", "Master Suite & Ensuite"],
    defaultColor: "#fef3c7",
    modelMeshKey: "silk_curtains",
  },
  {
    id: "lighting_crystal_chandelier",
    name: "Modern Tiered Crystal Chandelier",
    category: "decor",
    tier: "premium",
    price: 380_000,
    description: "Multifaceted crystal pendant chandelier casting brilliant refractions across high living ceilings.",
    dimensions: { width: 1.1, depth: 1.1, height: 1.2 },
    functionalType: "lighting",
    compatibleRooms: ["Double-Height Living Salon", "Family Parlour", "Grand Entrance Foyer"],
    upgradeEffect: "Radiant golden room lighting with luxury sparkle.",
    defaultColor: "#fef08a",
    modelMeshKey: "crystal_chandelier",
  },
];

/**
 * Returns a catalog item by its unique ID.
 */
export function getFurnitureCatalogItem(id: string): FurnitureCatalogItem | undefined {
  return FURNITURE_CATALOGUE.find((item) => item.id === id);
}

/**
 * Returns all catalog items matching a specific category.
 */
export function getCatalogItemsByCategory(category: FurnitureCategory): FurnitureCatalogItem[] {
  return FURNITURE_CATALOGUE.filter((item) => item.category === category);
}

/**
 * Validates whether an item is compatible with a given property and room.
 */
export function isFurnitureCompatibleWithRoom(
  catalogId: string,
  _propertyId: PropertyId,
  roomName?: string,
): boolean {
  const item = getFurnitureCatalogItem(catalogId);
  if (!item) return false;
  if (!roomName || item.compatibleRooms.length === 0) return true;
  return item.compatibleRooms.some((r) => roomName.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(roomName.toLowerCase()));
}
