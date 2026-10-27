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
export type VehicleType = "sedan" | "keke" | "van" | "pickup" | "minibus" | "truck";

export type GameScreen = "menu" | "playing" | "paused";

export type InteriorId = "house" | "apartment" | "penthouse" | "church" | "police-post" | "restaurant" | "gaming-hub" | "furniture-showroom";

export type PropertyId = "unit-2b" | "bompai-penthouse" | "albaraka-villa";
export type BusinessId = "sabon-gari-shop" | "arewa-suya-franchise" | "cyber-hub-station" | "dawanau-grain-depot";

export interface FurnitureInstance {
  instanceId: string;
  catalogId: string;
  purchasedAt: number;
  purchasePrice: number;
  assignedPropertyId?: PropertyId;
  room?: string;
  floor: number;
  position: { x: number; y: number; z: number };
  rotationY: number;
  isPlaced: boolean;
}

export type MissionCategory =
  | "local_delivery"
  | "freight"
  | "passenger"
  | "workshop"
  | "business_supply";

export type MissionState = "available" | "in_progress" | "completed" | "failed";

export interface MissionStage {
  step: number;
  instruction: string;
  targetName: string;
  targetCoords: { x: number; z: number };
  targetRadius: number;
  actionPrompt: string;
  completionToast: string;
}

export interface CareerMission {
  id: string;
  title: string;
  category: MissionCategory;
  district: string;
  description: string;
  recommendedVehicle: VehicleType;
  reward: number;
  enterpriseBonusId?: BusinessId;
  bonusAmount?: number;
  stages: MissionStage[];
  currentStageIndex: number;
  state: MissionState;
}

export interface ActiveMissionInfo {
  id: string;
  title: string;
  category: MissionCategory;
  instruction: string;
  targetName: string;
  targetCoords: { x: number; z: number };
  distanceMeters: number;
  reward: number;
  step: number;
  totalSteps: number;
}

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
  renovationLevel?: number;
  maxRenovationLevel?: number;
  renovationCostCash?: number;
  renovationCostCoins?: number;
  renovationTitle?: string;
  currentValuation?: number;
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
  level?: number;
  maxLevel?: number;
  upgradeCost?: number;
  levelTitle?: string;
  perks?: string[];
}

export type CurrencyType = "cash" | "premium_coins" | "coins";

export interface TransactionRecord {
  id: string;
  timestamp: number;
  currency: CurrencyType;
  amount: number;
  type:
    | "business_income"
    | "property_upkeep"
    | "purchase"
    | "upgrade"
    | "renovation"
    | "mission_reward"
    | "freelance"
    | "seasonal_reward"
    | "achievement_reward"
    | "fine_payment";
  description: string;
  balanceAfter: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: "empire" | "logistics" | "wealth" | "exploration" | "lifestyle";
  rewardCash: number;
  rewardCoins: number;
  icon: string;
  targetValue: number;
  unit?: string;
}

export interface PlayerAchievementState {
  progress: number;
  isUnlocked: boolean;
  unlockedAt?: number;
  isClaimed: boolean;
  claimedAt?: number;
}

export interface SeasonalChallenge {
  id: string;
  title: string;
  description: string;
  requirementText: string;
  targetCount: number;
  currentCount?: number;
  isCompleted?: boolean;
  isClaimed?: boolean;
  rewardCash: number;
  rewardCoins: number;
  rewardCosmeticId?: string;
  rewardCosmeticName?: string;
}

export interface SeasonDefinition {
  id: string;
  name: string;
  theme: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  challenges: SeasonalChallenge[];
  seasonMilestoneReward?: {
    name: string;
    requiredChallengesCount: number;
    rewardCoins: number;
    rewardTitle: string;
    isClaimed?: boolean;
  };
}

export interface VehicleCatalogItem {
  id: string;
  name: string;
  type: VehicleType;
  description: string;
  priceCash: number;
  priceCoins?: number;
  isPremiumExclusive?: boolean;
  isOwned: boolean;
  specs: {
    topSpeedKmh: number;
    acceleration: string;
    durability: string;
    cargoCapacity: string;
  };
  availableSkins?: {
    id: string;
    name: string;
    paintColor: string;
    priceCash?: number;
    priceCoins?: number;
    isUnlocked: boolean;
  }[];
}

export interface EmpireOverviewSnapshot {
  streetCash: number;
  premiumCoins: number; // Clearly marked dev/test balance
  dailyNetIncome: number;
  dailyGrossRevenue: number;
  dailyOperatingExpenses: number;
  totalPropertyValuation: number;
  totalBusinessValuation: number;
  netWorth: number;
  totalNetWorth: number;
  totalDailyRevenue: number;
  totalDailyOperatingCost: number;
  totalDailyPropertyUpkeep: number;
  netDailyProfit: number;
  ownedBusinessesCount: number;
  ownedPropertiesCount: number;
  ownedVehiclesCount: number;
  unlockedAchievementsCount: number;
  totalAchievementsCount: number;
  prestigeLevel: number;
  prestigePoints: number;
  activeSeasonId: string;
  activeSeasonName: string;
  businesses: BusinessInfo[];
  properties: PropertyInfo[];
  fleet: {
    ownedVehicles: string[];
    unlockedSkins: string[];
    catalog: VehicleCatalogItem[];
  };
  season: {
    activeSeason: SeasonDefinition;
    upcomingPreview: SeasonDefinition;
    points: number;
    completedChallenges: string[];
    claimedChallenges: string[];
    milestoneClaimed: boolean;
  };
  achievements: {
    catalog: AchievementDefinition[];
    playerState: Record<string, PlayerAchievementState>;
    unlockedCount: number;
    totalCount: number;
    prestige: {
      points: number;
      level: number;
      title: string;
    };
  };
  transactionHistory: TransactionRecord[];
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

export type InvestigationChoice = "elders" | "bank" | null;
export type CareerPathChoice = "transport" | "trading" | "technology" | "property" | null;

export interface StoryProgressData {
  chapter: number;
  stage: number;
  cluesFound: string[];
  investigationChoice: InvestigationChoice;
  careerPath: CareerPathChoice;
  careerPathChoice?: CareerPathChoice;
  indentureDiscovered?: boolean;
  elderTrust?: number;
  completed: boolean;
  rewardClaimed: boolean;
  timestamp?: number;
}

export interface StorySnapshotInfo {
  chapter: number;
  chapterTitle: string;
  stage: number;
  stageTitle: string;
  stageName?: string;
  objective: string;
  currentObjective?: string;
  instruction: string;
  targetName: string;
  targetCoords: { x: number; z: number };
  targetLandmarkId?: string;
  distanceMeters: number;
  canInvestigate?: boolean;
  canChooseCareer?: boolean;
  isComplete?: boolean;
  indentureDiscovered?: boolean;
  investigationChoice: InvestigationChoice;
  careerPath: CareerPathChoice;
  careerPathChoice?: CareerPathChoice;
  completed: boolean;
  canInspectIndenture: boolean;
}

export interface NeedsState {
  hunger: number; // 0 to 100
  energy: number; // 0 to 100
  hygiene: number; // 0 to 100
}

export interface HomeNavInfo {
  propertyId: PropertyId;
  name: string;
  district: string;
  distanceMeters: number;
  entranceCoords: { x: number; z: number };
  isInsideHome: boolean;
}

export interface PlayerHomeEntry {
  propertyId: PropertyId;
  name: string;
  district: string;
  status: "OWNED" | "LEASED";
  isSelectedHome: boolean;
  entranceCoords: { x: number; z: number };
  distanceMeters: number;
  description: string;
  landmarkId: string;
}

export interface FreelanceContract {
  id: string;
  title: string;
  category: "logistics" | "software" | "trading" | "architecture" | "finance";
  client: string;
  payout: number;
  durationMinutes: number;
  description: string;
  isCompleted: boolean;
}

export interface FreelanceSnapshotInfo {
  totalContracts: number;
  completedCount: number;
  totalEarnings: number;
  nextAvailableContract: FreelanceContract | null;
}

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
  activeMission?: ActiveMissionInfo | null;
  availableMissionsCount?: number;
  playerCoords?: { x: number; z: number };
  playerHeading?: number;
  storyInfo?: StorySnapshotInfo | null;
  weatherPreset?: string;
  weatherDisplayName?: string;
  audioMuted?: boolean;
  isFurnishingMode?: boolean;
  furnishingTargetName?: string | null;
  unplacedFurnitureCount?: number;
  placedFurnitureCount?: number;
  isFurnitureShopOpen?: boolean;
  selectedHomePropertyId?: PropertyId | null;
  homeNavInfo?: HomeNavInfo | null;
  playerHomes?: PlayerHomeEntry[];
  needs?: NeedsState;
  freelanceInfo?: FreelanceSnapshotInfo;
  cameraMode?: "third-person" | "first-person";
  premiumCoins?: number;
  isEmpireModalOpen?: boolean;
  empireOverview?: EmpireOverviewSnapshot;
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
  lampGlow?: import("three").MeshStandardMaterial;
  headlightBeam?: import("three").MeshStandardMaterial;
  weatheredBrick?: import("three").MeshStandardMaterial;
  rustedZinc?: import("three").MeshStandardMaterial;
  curbStriped?: import("three").MeshStandardMaterial;
  curbYellowStriped?: import("three").MeshStandardMaterial;
  solarPanel?: import("three").MeshStandardMaterial;
  terracotta?: import("three").MeshStandardMaterial;
  burglarBars?: import("three").MeshStandardMaterial;
};
