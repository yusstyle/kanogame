export type Collider = {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  height?: number;
};

export type BuildingKind =
  | "traditional"
  | "modern"
  | "shop"
  | "commercial"
  | "apartment"
  | "church"
  | "police"
  | "villa"
  | "bank"
  | "restaurant"
  | "gaming"
  | "plaza";

export type GraphicsQuality = "performance" | "balanced" | "quality";

export type PlotAsset = {
  root: import("three").Group;
  colliders: Collider[];
  gateSlot?: import("three").Group;
};

export type GameMode = "on-foot" | "driving";
export type VehicleType = "sedan" | "keke";

export type GameScreen = "menu" | "playing" | "paused";

export type InteriorId = "house" | "apartment" | "church" | "police-post" | "restaurant" | "gaming-hub";

export type PropertyId = "unit-2b" | "bompai-penthouse" | "albaraka-villa";
export type BusinessId = "sabon-gari-shop" | "arewa-suya-franchise" | "cyber-hub-station";

export interface PropertyInfo {
  id: PropertyId;
  name: string;
  location: string;
  rentMonthly?: number;
  purchasePrice: number;
  isRented: boolean;
  isOwned: boolean;
  dailyUpkeep: number;
  description: string;
}

export interface BusinessInfo {
  id: BusinessId;
  name: string;
  location: string;
  purchasePrice: number;
  dailyRevenue: number;
  dailyCost: number;
  isOwned: boolean;
  description: string;
}

export interface VehicleUpgrade {
  engineStage: number;
  paintColor: string;
  suspensionUpgraded: boolean;
}

export type RelationshipStage = "stranger" | "acquaintance" | "friend" | "dating" | "partner";

export type SocialContact = {
  id: string;
  name: string;
  profession: string;
  district: string;
  stage: RelationshipStage;
  affection: number; // 0 to 100
  description: string;
  avatarSeed?: number;
};

export type GameSnapshot = {
  mode: GameMode;
  vehicleType?: VehicleType | null;
  location: string;
  speedKmh: number;
  interactionPrompt: string | null;
  statusMessage: string | null;
  cash?: number;
  trafficFine?: number;
  hasApartmentRental?: boolean;
  activeInterior?: InteriorId | null;
  timeString?: string;
  gameScore?: number;
  featuredContact?: SocialContact | null;
  ownedProperties?: string[];
  ownedBusinesses?: string[];
  dailyIncome?: number;
  dayCount?: number;
  gpsTarget?: string | null;
};

export type GameMaterials = {
  ground: import("three").MeshStandardMaterial;
  asphalt: import("three").MeshStandardMaterial;
  asphaltPatch: import("three").MeshStandardMaterial;
  sidewalk: import("three").MeshStandardMaterial;
  curb: import("three").MeshStandardMaterial;
  roadMarking: import("three").MeshStandardMaterial;
  drain: import("three").MeshStandardMaterial;
  plaster: import("three").MeshStandardMaterial;
  compoundWall: import("three").MeshStandardMaterial;
  ochre: import("three").MeshStandardMaterial;
  clay: import("three").MeshStandardMaterial;
  concrete: import("three").MeshStandardMaterial;
  roof: import("three").MeshStandardMaterial;
  trim: import("three").MeshStandardMaterial;
  darkTrim: import("three").MeshStandardMaterial;
  wood: import("three").MeshStandardMaterial;
  metal: import("three").MeshStandardMaterial;
  glass: import("three").MeshStandardMaterial;
  glassLit: import("three").MeshStandardMaterial;
  cloth: import("three").MeshStandardMaterial;
  clothRed: import("three").MeshStandardMaterial;
  foliage: import("three").MeshStandardMaterial;
  foliageLight: import("three").MeshStandardMaterial;
  bark: import("three").MeshStandardMaterial;
  stone: import("three").MeshStandardMaterial;
  white: import("three").MeshStandardMaterial;
  black: import("three").MeshStandardMaterial;
  kekeYellow: import("three").MeshStandardMaterial;
  kekeGreen: import("three").MeshStandardMaterial;
  corrugatedZinc?: import("three").MeshStandardMaterial;
  roadDust?: import("three").MeshStandardMaterial;
  motorcycleRed?: import("three").MeshStandardMaterial;
  motorcycleBlue?: import("three").MeshStandardMaterial;
  carpetRed?: import("three").MeshStandardMaterial;
  tileFloor?: import("three").MeshStandardMaterial;
  policeNavy?: import("three").MeshStandardMaterial;
  karotaYellow?: import("three").MeshStandardMaterial;
  karotaGreen?: import("three").MeshStandardMaterial;
  goldTrim?: import("three").MeshStandardMaterial;
  neonCyan?: import("three").MeshStandardMaterial;
  neonMagenta?: import("three").MeshStandardMaterial;
  bankBlue?: import("three").MeshStandardMaterial;
  warmOrange?: import("three").MeshStandardMaterial;
};
