import type {
  PropertyId,
  BusinessId,
  PropertyInfo,
  BusinessInfo,
  VehicleUpgrade,
  StoryProgressData,
  FurnitureInstance,
  CurrencyType,
  TransactionRecord,
  AchievementDefinition,
  PlayerAchievementState,
  SeasonalChallenge,
  SeasonDefinition,
  VehicleCatalogItem,
  EmpireOverviewSnapshot,
  BusinessCategory,
  DailyFinancialStatement,
  MonthlyFinancialSummary,
} from "./types";
import { getFurnitureCatalogItem } from "./furnitureCatalogue";
import {
  BUSINESS_TIERS,
  PROPERTY_RENOVATIONS,
  VEHICLE_CATALOG,
  ACHIEVEMENT_CATALOG,
  ACTIVE_SEASON_CONFIG,
  UPCOMING_SEASON_PREVIEW,
  BUSINESS_METADATA,
} from "./empireCatalog";

export interface SaveData {
  version: number;
  cash: number;
  premiumCoins?: number; // Clearly marked dev/test balance
  trafficFine: number;
  hasApartmentRental: boolean;
  ownedProperties: PropertyId[];
  ownedBusinesses: BusinessId[];
  businessLevels?: Record<string, number>;
  propertyRenovations?: Record<string, number>;
  businessConditions?: Record<string, number>;
  businessReputations?: Record<string, number>;
  businessSatisfaction?: Record<string, number>;
  businessLastMaintainedDay?: Record<string, number>;
  financialHistory?: DailyFinancialStatement[];
  businessNotifications?: string[];
  ownedVehicles?: string[];
  unlockedVehicleSkins?: string[];
  achievements?: Record<string, PlayerAchievementState>;
  seasonalProgress?: {
    activeSeasonId: string;
    completedChallenges: string[];
    claimedRewards: string[];
    milestoneClaimed: boolean;
    distanceDriven: number;
  };
  transactionHistory?: TransactionRecord[];
  prestige?: { level: number; points: number };
  dayCount: number;
  vehicleUpgrade: VehicleUpgrade;
  completedMissions?: string[];
  careerEarnings?: number;
  storyProgress?: StoryProgressData;
  weatherPreset?: string;
  audioMuted?: boolean;
  furnitureInventory?: FurnitureInstance[];
  selectedHomePropertyId?: PropertyId | null;
  needs?: {
    hunger: number;
    energy: number;
    hygiene: number;
  };
  completedFreelanceContracts?: string[];
  freelanceEarnings?: number;
  dailyAtmWithdrawn?: number;
  lastAtmWithdrawalDay?: number;
  hasSeenOnboarding?: boolean;
  npcMemory?: Record<string, import("./consequenceSystem").NpcMemoryRecord>;
  vehicleConditions?: Record<string, import("./consequenceSystem").VehicleConditionState>;
  consequencesHistory?: import("./consequenceSystem").ConsequenceRecord[];
  currentCity?: import("./cityRegistry").CityId;
  cityPositions?: Partial<Record<import("./cityRegistry").CityId, { x: number; y: number; z: number; yaw: number }>>;
  savedAt: number;
}

export function normalizePropertyId(rawId: unknown): PropertyId | null {
  if (typeof rawId !== "string" || !rawId.trim()) return null;
  const s = rawId.toLowerCase().trim();
  const clean = s.replace(/[-_\s]/g, "");
  if (clean === "unit2b" || clean.includes("unit2b") || clean.includes("apartment") || clean.includes("airport")) {
    return "unit-2b";
  }
  if (clean === "bompaipenthouse" || clean.includes("bompai") || clean.includes("penthouse")) {
    return "bompai-penthouse";
  }
  if (clean === "albarakavilla" || clean.includes("baraka") || clean.includes("villa")) {
    return "albaraka-villa";
  }
  return null;
}

export const ATM_DAILY_LIMIT = 40000;
export const ATM_WITHDRAWAL_AMOUNT = 20000;

export class EconomySystem {
  public properties: Map<PropertyId, PropertyInfo> = new Map();
  public businesses: Map<BusinessId, BusinessInfo> = new Map();
  public selectedHomePropertyId: PropertyId | null = null;
  public premiumCoins = 250; // Clearly labelled dev/test balance
  public businessLevels: Map<BusinessId, number> = new Map();
  public propertyRenovations: Map<PropertyId, number> = new Map();
  // Phase A Business Management Foundations:
  public businessConditions: Map<BusinessId, number> = new Map();
  public businessReputations: Map<BusinessId, number> = new Map();
  public businessSatisfaction: Map<BusinessId, number> = new Map();
  public businessLastMaintainedDay: Map<BusinessId, number> = new Map();
  public financialHistory: DailyFinancialStatement[] = [];
  public businessNotifications: string[] = [];
  public ownedVehicles: Set<string> = new Set(["veh_sedan"]);
  public unlockedVehicleSkins: Set<string> = new Set(["skin_sedan_stock"]);
  public achievements: Map<string, PlayerAchievementState> = new Map();
  public seasonalProgress = {
    activeSeasonId: ACTIVE_SEASON_CONFIG.id,
    completedChallenges: [] as string[],
    claimedRewards: [] as string[],
    milestoneClaimed: false,
    distanceDriven: 0,
  };
  public transactionHistory: TransactionRecord[] = [];
  public prestige = { level: 1, points: 0 };
  public furnitureInventory: FurnitureInstance[] = [];

  public vehicleUpgrade: VehicleUpgrade = {
    engineStage: 0,
    paintColor: "#4a5568", // Stock graphite
    suspensionUpgraded: false,
  };
  public dayCount = 1;
  private lastProcessedDay = 1;
  public dailyAtmWithdrawn = 0;
  public lastAtmWithdrawalDay = 1;
  public hasSeenOnboarding = false;

  public dismissOnboarding(): void {
    this.hasSeenOnboarding = true;
  }

  constructor() {
    this.initProperties();
    this.initBusinesses();
    this.initAchievements();
  }

  private initProperties() {
    const props: PropertyInfo[] = [
      {
        id: "unit-2b",
        name: "Airport View Apartments · Unit 2B",
        location: "AIRPORT ROAD (48, -50)",
        rentMonthly: 75000,
        purchasePrice: 18000000,
        isRented: false,
        isOwned: false,
        dailyUpkeep: 1200,
        description: "Modern 2-bedroom executive apartment with private balcony, split AC, and reliable borehole water supply.",
        renovationLevel: 0,
        maxRenovationLevel: 2,
        renovationCostCash: 350000,
        renovationCostCoins: 40,
        renovationTitle: "Standard Executive Apartment",
        currentValuation: 18000000,
      },
      {
        id: "bompai-penthouse",
        name: "Bompai Heights Luxury Penthouse",
        location: "BOMPAI AVENUE (18, 42)",
        purchasePrice: 35000000,
        isRented: false,
        isOwned: false,
        dailyUpkeep: 2500,
        description: "Top-floor 4-bedroom luxury flat with 360° panoramic views of Kano, 12-panel solar backup, and covered carport.",
        renovationLevel: 0,
        maxRenovationLevel: 2,
        renovationCostCash: 1200000,
        renovationCostCoins: 60,
        renovationTitle: "Standard Panoramic Penthouse",
        currentValuation: 35000000,
      },
      {
        id: "albaraka-villa",
        name: "Al-Baraka Executive Villa",
        location: "RESIDENTIAL QUARTER (44, 39)",
        purchasePrice: 65000000,
        isRented: false,
        isOwned: false,
        dailyUpkeep: 4500,
        description: "Prestigious gated family residence with landscaped front veranda, dedicated generator house, and security guard post.",
        renovationLevel: 0,
        maxRenovationLevel: 2,
        renovationCostCash: 2500000,
        renovationCostCoins: 90,
        renovationTitle: "Standard Gated Villa & Compound",
        currentValuation: 65000000,
      },
    ];
    props.forEach((p) => this.properties.set(p.id, p));
  }

  public addBusinessNotification(message: string): void {
    this.businessNotifications.unshift(message);
    if (this.businessNotifications.length > 20) {
      this.businessNotifications.length = 20;
    }
  }

  private initBusinesses() {
    const bizList: BusinessInfo[] = [
      {
        id: "sabon-gari-shop",
        name: "Sabon Gari Electronics Stall",
        location: "SABON GARI PLAZA (-22, 48)",
        purchasePrice: 450000,
        dailyRevenue: 15000,
        dailyCost: 5000,
        isOwned: false,
        description: "Retail outlet selling phone accessories, power banks, and electronics. Steady foot traffic from shoppers.",
        level: 1,
        maxLevel: 3,
        upgradeCost: 250000,
        levelTitle: "Retail Electronics Stall",
        perks: ["Steady retail foot traffic in Sabon Gari market"],
        category: "retail",
        categoryTitle: "Supermarkets & Retail",
        condition: 100,
        reputation: 75,
        customerSatisfaction: 80,
        employeeCount: 2,
        inventoryStatus: "Basic Accessory Stock (65% capacity)",
        maintenanceCost: 15000,
      },
      {
        id: "arewa-suya-franchise",
        name: "Arewa Suya Lounge Franchise Share",
        location: "AIRPORT ROAD CORRIDOR (16, -42)",
        purchasePrice: 1200000,
        dailyRevenue: 40000,
        dailyCost: 10000,
        isOwned: false,
        description: "Franchise revenue share in the premier 24/7 Suya barbecue grill and fast-food dining terrace.",
        level: 1,
        maxLevel: 3,
        upgradeCost: 800000,
        levelTitle: "Airport Corridor Grill Terrace",
        perks: ["24/7 highway frontage beside Airport Road"],
        category: "restaurant",
        categoryTitle: "Restaurants & Dining",
        condition: 100,
        reputation: 80,
        customerSatisfaction: 84,
        employeeCount: 4,
        inventoryStatus: "Daily Fresh Beef Cuts & Yaji Seasonings",
        maintenanceCost: 25000,
      },
      {
        id: "cyber-hub-station",
        name: "Cyber Hub Dual PS5 Gaming Station",
        location: "KANO CYBER HUB (80, -46)",
        purchasePrice: 800000,
        dailyRevenue: 25000,
        dailyCost: 7000,
        isOwned: false,
        description: "Two dedicated tournament gaming setups leased to competitive players and local esports enthusiasts.",
        level: 1,
        maxLevel: 3,
        upgradeCost: 500000,
        levelTitle: "Dual PS5 Tournament Pod",
        perks: ["Two tournament esports pods leased to competitive local gamers"],
        category: "entertainment",
        categoryTitle: "Entertainment & Leisure",
        condition: 100,
        reputation: 78,
        customerSatisfaction: 82,
        employeeCount: 2,
        inventoryStatus: "Dual 4K Displays & High-Speed LAN",
        maintenanceCost: 20000,
      },
      {
        id: "dawanau-grain-depot",
        name: "Dawanau Wholesale Grain Depot",
        location: "DAWANAU WHOLESALE DEPOT (42, -135)",
        purchasePrice: 4500000,
        dailyRevenue: 220000,
        dailyCost: 55000,
        isOwned: false,
        description: "Premier wholesale agricultural grain silo and trans-Saharan bulk export terminal. Massive commercial revenue yield.",
        level: 1,
        maxLevel: 3,
        upgradeCost: 3000000,
        levelTitle: "Grain Silo & Bulk Wholesale Depot",
        perks: ["Major wholesale grain terminal at Dawanau market", "High-capacity bulk freight storage"],
        category: "logistics",
        categoryTitle: "Transport & Logistics",
        condition: 100,
        reputation: 85,
        customerSatisfaction: 86,
        employeeCount: 8,
        inventoryStatus: "Standard Grain Silo (4,000 Sacks Stored)",
        maintenanceCost: 80000,
      },
    ];
    bizList.forEach((b) => {
      this.businesses.set(b.id, b);
      if (!this.businessConditions.has(b.id)) {
        this.businessConditions.set(b.id, 100);
      }
      if (!this.businessReputations.has(b.id)) {
        this.businessReputations.set(b.id, b.reputation ?? 80);
      }
      if (!this.businessSatisfaction.has(b.id)) {
        this.businessSatisfaction.set(b.id, b.customerSatisfaction ?? 85);
      }
      if (!this.businessLastMaintainedDay.has(b.id)) {
        this.businessLastMaintainedDay.set(b.id, 1);
      }
    });
  }

  private initAchievements() {
    ACHIEVEMENT_CATALOG.forEach((def) => {
      if (!this.achievements.has(def.id)) {
        this.achievements.set(def.id, {
          progress: 0,
          isUnlocked: false,
          isClaimed: false,
        });
      }
    });
  }

  public syncEntityMetadata() {
    this.businesses.forEach((b) => {
      const level = this.businessLevels.get(b.id) ?? 1;
      const tiers = BUSINESS_TIERS[b.id];
      const tier = tiers?.find((t) => t.level === level) ?? tiers?.[0];
      const nextTier = tiers?.find((t) => t.level === level + 1);
      const meta = BUSINESS_METADATA[b.id];

      b.level = level;
      b.maxLevel = 3;
      b.levelTitle = tier?.title ?? "Enterprise";
      b.category = meta?.category ?? "retail";
      b.categoryTitle = meta?.categoryTitle ?? "Commerce";
      b.upgradeCost = nextTier?.upgradeCost ?? 0;
      b.perks = tier?.perks ?? [];

      const cond = this.businessConditions.get(b.id) ?? 100;
      b.condition = cond;
      b.reputation = this.businessReputations.get(b.id) ?? (tier?.baseReputation ?? 80);
      b.customerSatisfaction = this.businessSatisfaction.get(b.id) ?? (tier?.baseSatisfaction ?? 85);
      b.employeeCount = tier?.employeeCount ?? 2;
      b.inventoryStatus = tier?.inventoryStatus ?? (meta?.defaultInventory ?? "Stocked");
      b.maintenanceCost = tier?.maintenanceCost ?? 15000;
      b.lastMaintainedDay = this.businessLastMaintainedDay.get(b.id) ?? 1;

      // When condition drops below 70%, revenue is scaled slightly by condition
      const conditionMultiplier = cond < 70 ? Math.max(0.6, 0.8 + 0.2 * (cond / 100)) : 1.0;
      const baseRev = tier?.dailyRevenue ?? b.dailyRevenue;
      b.dailyRevenue = Math.round(baseRev * conditionMultiplier);
      b.dailyCost = tier?.dailyOperatingCost ?? b.dailyCost;
      b.dailyTax = Math.round(b.dailyRevenue * 0.05); // 5% fictional in-game municipal commerce levy (gameplay balancing mechanic)
      b.netProfit = b.dailyRevenue - b.dailyCost - b.dailyTax;
      b.valuation = b.purchasePrice + (level - 1) * (nextTier?.upgradeCost ?? (tier?.upgradeCost ?? 0));
    });

    this.properties.forEach((p) => {
      const tierLevel = this.propertyRenovations.get(p.id) ?? 0;
      const renoTiers = PROPERTY_RENOVATIONS[p.id];
      const currentTier = renoTiers?.find((t) => t.tier === tierLevel) ?? renoTiers?.[0];
      const nextTier = renoTiers?.find((t) => t.tier === tierLevel + 1);
      p.renovationLevel = tierLevel;
      p.maxRenovationLevel = 2;
      p.renovationTitle = currentTier?.title ?? "Standard";
      p.renovationCostCash = nextTier?.costCash ?? 0;
      p.renovationCostCoins = nextTier?.costCoins ?? 0;
      p.currentValuation = p.purchasePrice + (currentTier?.valuationBonus ?? 0);
    });
  }

  public addTransactionRecord(
    currency: CurrencyType,
    amount: number,
    type: TransactionRecord["type"],
    description: string,
    balanceAfter: number,
  ) {
    const record: TransactionRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      currency,
      amount,
      type,
      description,
      balanceAfter,
    };
    this.transactionHistory.unshift(record);
    if (this.transactionHistory.length > 50) {
      this.transactionHistory.length = 50;
    }
  }

  public maintainBusiness(
    id: BusinessId,
    playerCash: number,
  ): { success: boolean; cost: number; message: string; newCondition: number } {
    const biz = this.businesses.get(id);
    if (!biz) return { success: false, cost: 0, message: "Business enterprise not found.", newCondition: 0 };
    if (!biz.isOwned) return { success: false, cost: 0, message: `You must own ${biz.name} before commissioning maintenance.`, newCondition: 0 };

    const currentCond = this.businessConditions.get(id) ?? 100;
    if (currentCond >= 100) {
      return {
        success: false,
        cost: 0,
        message: `${biz.name} facilities, equipment and storefront are already in mint 100% operational condition.`,
        newCondition: 100,
      };
    }

    const cost = biz.maintenanceCost ?? 15000;
    if (playerCash < cost) {
      return {
        success: false,
        cost: 0,
        message: `Insufficient funds: Routine maintenance for ${biz.name} requires ₦${cost.toLocaleString()} (Available: ₦${playerCash.toLocaleString()}).`,
        newCondition: currentCond,
      };
    }

    this.businessConditions.set(id, 100);
    const currRep = this.businessReputations.get(id) ?? 80;
    const currSat = this.businessSatisfaction.get(id) ?? 85;
    this.businessReputations.set(id, Math.min(100, currRep + 4));
    this.businessSatisfaction.set(id, Math.min(100, currSat + 6));
    this.businessLastMaintainedDay.set(id, this.dayCount);
    this.syncEntityMetadata();

    this.addTransactionRecord(
      "cash",
      -cost,
      "maintenance",
      `Commissioned facility overhaul & equipment maintenance for ${biz.name}`,
      playerCash - cost,
    );

    const msg = `Maintenance complete! ${biz.name} facilities restored to 100% operational condition. Customer satisfaction boosted!`;
    this.addBusinessNotification(msg);

    return {
      success: true,
      cost,
      message: msg,
      newCondition: 100,
    };
  }

  public getFinancialStatement(currentCash: number): DailyFinancialStatement {
    this.syncEntityMetadata();
    let grossRev = 0;
    let bizCosts = 0;
    let taxes = 0;
    let bizVal = 0;

    this.businesses.forEach((b) => {
      if (b.isOwned) {
        grossRev += b.dailyRevenue;
        bizCosts += b.dailyCost;
        taxes += b.dailyTax ?? Math.round(b.dailyRevenue * 0.05);
        bizVal += b.valuation ?? b.purchasePrice;
      }
    });

    let propUpkeep = 0;
    let propVal = 0;
    this.properties.forEach((p) => {
      if (p.isOwned) {
        propVal += p.currentValuation ?? p.purchasePrice;
        propUpkeep += p.dailyUpkeep;
      } else if (p.isRented) {
        propUpkeep += p.dailyUpkeep;
      }
    });

    const totalExpenses = bizCosts + propUpkeep;
    const netProfit = grossRev - totalExpenses;
    const salaries = Math.round(bizCosts * 0.4);
    const inventoryExp = Math.round(bizCosts * 0.35);
    const month = Math.floor((this.dayCount - 1) / 30) + 1;

    return {
      day: this.dayCount,
      month,
      calendarPeriod: `Day ${this.dayCount}, Month ${month} (Harmattan Season)`,
      grossRevenue: grossRev,
      businessOperatingCosts: bizCosts,
      employeeSalaries: salaries,
      inventoryExpenses: inventoryExp,
      propertyUpkeep: propUpkeep,
      municipalTaxes: taxes,
      totalExpenses,
      netProfit,
      netCashFlow: netProfit,
      liquidCash: currentCash,
      propertyValuation: propVal,
      businessValuation: bizVal,
      totalEmpireNetWorth: currentCash + propVal + bizVal,
      timestamp: Date.now(),
    };
  }

  public getMonthlyFinancialSummary(currentCash: number): MonthlyFinancialSummary {
    const daily = this.getFinancialStatement(currentCash);
    const month = daily.month;
    const daysInMonth = 30;

    return {
      month,
      periodName: `Month ${month} Fiscal Summary`,
      totalRevenue: daily.grossRevenue * daysInMonth,
      totalOperatingCosts: daily.businessOperatingCosts * daysInMonth,
      totalSalaries: daily.employeeSalaries * daysInMonth,
      totalInventoryExpenses: daily.inventoryExpenses * daysInMonth,
      totalPropertyUpkeep: daily.propertyUpkeep * daysInMonth,
      totalTaxes: daily.municipalTaxes * daysInMonth,
      totalExpenses: daily.totalExpenses * daysInMonth,
      totalNetProfit: daily.netProfit * daysInMonth,
      averageDailyProfit: daily.netProfit,
      endingNetWorth: daily.totalEmpireNetWorth,
    };
  }

  public getDailyNetIncome(): number {
    let income = 0;
    this.businesses.forEach((b) => {
      if (b.isOwned) {
        const level = this.businessLevels.get(b.id) ?? 1;
        const tiers = BUSINESS_TIERS[b.id];
        const tier = tiers?.find((t) => t.level === level) ?? tiers?.[0];
        const rev = tier ? tier.dailyRevenue : b.dailyRevenue;
        const cost = tier ? tier.dailyOperatingCost : b.dailyCost;
        income += rev - cost;
      }
    });
    this.properties.forEach((p) => {
      if (p.isOwned || p.isRented) {
        income -= p.dailyUpkeep;
      }
    });
    return income;
  }

  public updateDayCycle(gameMinutes: number, currentCash: number): { cashDelta: number; message: string | null } {
    const currentDay = Math.floor(gameMinutes / 1440) + 1;
    this.dayCount = currentDay;

    if (currentDay > this.lastProcessedDay) {
      this.lastProcessedDay = currentDay;

      // Simulate natural operational wear (2% per day) on owned businesses
      this.businesses.forEach((b) => {
        if (b.isOwned) {
          const currentCond = this.businessConditions.get(b.id) ?? 100;
          const newCond = Math.max(30, currentCond - 2);
          this.businessConditions.set(b.id, newCond);
          if (newCond < 70) {
            const currSat = this.businessSatisfaction.get(b.id) ?? 80;
            this.businessSatisfaction.set(b.id, Math.max(50, currSat - 1));
          }
        }
      });
      this.syncEntityMetadata();

      const statement = this.getFinancialStatement(currentCash);
      this.financialHistory.unshift(statement);
      if (this.financialHistory.length > 30) {
        this.financialHistory.length = 30;
      }

      const net = this.getDailyNetIncome();
      if (net !== 0) {
        const sign = net > 0 ? "+" : "";
        const msg = net > 0
          ? `Day ${currentDay} Business Income: Collected ${sign}₦${net.toLocaleString()} net profit from your Kano enterprises!`
          : `Day ${currentDay} Expenses: Paid ₦${Math.abs(net).toLocaleString()} in property upkeep and maintenance.`;
        this.addTransactionRecord(
          "cash",
          net,
          net > 0 ? "business_income" : "property_upkeep",
          msg,
          Math.max(0, currentCash + net),
        );
        this.addBusinessNotification(`Day ${currentDay} Statement: Gross ₦${statement.grossRevenue.toLocaleString()}, Costs ₦${statement.totalExpenses.toLocaleString()}, Net Profit ${sign}₦${net.toLocaleString()}`);
        return { cashDelta: net, message: msg };
      }
    }
    return { cashDelta: 0, message: null };
  }

  public withdrawFromAtm(amount = ATM_WITHDRAWAL_AMOUNT): {
    success: boolean;
    dispensed: number;
    message: string;
    remainingDailyLimit: number;
  } {
    if (this.lastAtmWithdrawalDay !== this.dayCount) {
      this.dailyAtmWithdrawn = 0;
      this.lastAtmWithdrawalDay = this.dayCount;
    }

    const remaining = Math.max(0, ATM_DAILY_LIMIT - this.dailyAtmWithdrawn);
    if (amount > remaining || remaining === 0) {
      return {
        success: false,
        dispensed: 0,
        message: `ATM: Daily withdrawal limit reached (₦${ATM_DAILY_LIMIT.toLocaleString()} max per day). Remaining today: ₦${remaining.toLocaleString()}. Return tomorrow!`,
        remainingDailyLimit: remaining,
      };
    }

    this.dailyAtmWithdrawn += amount;
    this.lastAtmWithdrawalDay = this.dayCount;
    const newRemaining = Math.max(0, ATM_DAILY_LIMIT - this.dailyAtmWithdrawn);

    return {
      success: true,
      dispensed: amount,
      message: `ATM: Dispensed ₦${amount.toLocaleString()} cash from Arewa Commercial Bank account. Remaining daily limit: ₦${newRemaining.toLocaleString()}.`,
      remainingDailyLimit: newRemaining,
    };
  }

  public purchaseProperty(id: PropertyId, playerCash: number): { success: boolean; cost: number; message: string } {
    const prop = this.properties.get(id);
    if (!prop) return { success: false, cost: 0, message: "Property not found." };
    if (prop.isOwned) return { success: false, cost: 0, message: `You already hold the Certificate of Occupancy for ${prop.name}.` };
    if (playerCash < prop.purchasePrice) {
      return {
        success: false,
        cost: 0,
        message: `Insufficient funds: ${prop.name} requires ₦${prop.purchasePrice.toLocaleString()} to purchase (Current: ₦${playerCash.toLocaleString()}).`,
      };
    }

    prop.isOwned = true;
    prop.isRented = false;
    if (!this.selectedHomePropertyId) {
      this.selectedHomePropertyId = id;
    }
    this.addTransactionRecord("cash", -prop.purchasePrice, "purchase", `Purchased ${prop.name} freehold deed`, playerCash - prop.purchasePrice);
    this.prestige.points += 100;
    this.checkPrestigeLevel();
    this.recordSeasonalProgress("harmattan_challenge_property");

    return {
      success: true,
      cost: prop.purchasePrice,
      message: `Congratulations! Certificate of Occupancy deed acquired for ${prop.name}! You are now the official owner.`,
    };
  }

  public purchaseBusiness(id: BusinessId, playerCash: number): { success: boolean; cost: number; message: string } {
    const biz = this.businesses.get(id);
    if (!biz) return { success: false, cost: 0, message: "Business enterprise not found." };
    if (biz.isOwned) return { success: false, cost: 0, message: `You already own ${biz.name}.` };
    if (playerCash < biz.purchasePrice) {
      return {
        success: false,
        cost: 0,
        message: `Insufficient funds: ${biz.name} requires ₦${biz.purchasePrice.toLocaleString()} to purchase.`,
      };
    }

    biz.isOwned = true;
    this.businessLevels.set(id, 1);
    this.syncEntityMetadata();

    const netDaily = biz.dailyRevenue - biz.dailyCost;
    this.addTransactionRecord("cash", -biz.purchasePrice, "purchase", `Acquired enterprise: ${biz.name}`, playerCash - biz.purchasePrice);
    this.prestige.points += 75;
    this.checkPrestigeLevel();

    return {
      success: true,
      cost: biz.purchasePrice,
      message: `Enterprise deed acquired for ${biz.name}! Yielding ~₦${netDaily.toLocaleString()}/day net profit.`,
    };
  }

  public upgradeBusiness(
    id: BusinessId,
    playerCash: number,
  ): { success: boolean; cost: number; newLevel: number; message: string } {
    const biz = this.businesses.get(id);
    if (!biz) return { success: false, cost: 0, newLevel: 0, message: "Business not found." };
    if (!biz.isOwned) return { success: false, cost: 0, newLevel: 0, message: `You must own ${biz.name} before upgrading it.` };

    const currentLevel = this.businessLevels.get(id) ?? 1;
    if (currentLevel >= 3) {
      return { success: false, cost: 0, newLevel: currentLevel, message: `${biz.name} is already at maximum Level 3 flagship status!` };
    }

    const nextLevel = currentLevel + 1;
    const tiers = BUSINESS_TIERS[id];
    const nextTier = tiers?.find((t) => t.level === nextLevel);
    if (!nextTier) {
      return { success: false, cost: 0, newLevel: currentLevel, message: "Next upgrade tier not configured." };
    }

    if (playerCash < nextTier.upgradeCost) {
      return {
        success: false,
        cost: 0,
        newLevel: currentLevel,
        message: `Insufficient funds: Upgrading ${biz.name} to Level ${nextLevel} (${nextTier.title}) requires ₦${nextTier.upgradeCost.toLocaleString()} (Available: ₦${playerCash.toLocaleString()}).`,
      };
    }

    // Atomic upgrade
    this.businessLevels.set(id, nextLevel);
    this.syncEntityMetadata();
    this.addTransactionRecord("cash", -nextTier.upgradeCost, "upgrade", `Upgraded ${biz.name} to Level ${nextLevel} (${nextTier.title})`, playerCash - nextTier.upgradeCost);

    this.prestige.points += 50;
    this.checkPrestigeLevel();
    this.recordSeasonalProgress("harmattan_challenge_upgrade");

    return {
      success: true,
      cost: nextTier.upgradeCost,
      newLevel: nextLevel,
      message: `Expansion complete! ${biz.name} upgraded to Level ${nextLevel}: ${nextTier.title}! Net profit increased to ₦${(nextTier.dailyRevenue - nextTier.dailyOperatingCost).toLocaleString()}/day.`,
    };
  }

  public renovateProperty(
    id: PropertyId,
    playerCash: number,
    playerCoins: number,
    useCoins = false,
  ): { success: boolean; costCash: number; costCoins: number; newLevel: number; message: string } {
    const prop = this.properties.get(id);
    if (!prop) return { success: false, costCash: 0, costCoins: 0, newLevel: 0, message: "Property not found." };
    if (!prop.isOwned && !(id === "unit-2b" && prop.isRented)) {
      return { success: false, costCash: 0, costCoins: 0, newLevel: 0, message: "You must own or lease this property before undertaking renovations." };
    }

    const currentTier = this.propertyRenovations.get(id) ?? 0;
    if (currentTier >= 2) {
      return { success: false, costCash: 0, costCoins: 0, newLevel: currentTier, message: `${prop.name} has reached maximum Executive Renovation Tier 2!` };
    }

    const nextTierNum = currentTier + 1;
    const tiers = PROPERTY_RENOVATIONS[id];
    const nextTier = tiers?.find((t) => t.tier === nextTierNum);
    if (!nextTier) {
      return { success: false, costCash: 0, costCoins: 0, newLevel: currentTier, message: "Renovation tier configuration not found." };
    }

    if (useCoins) {
      if (playerCoins < nextTier.costCoins) {
        return {
          success: false,
          costCash: 0,
          costCoins: 0,
          newLevel: currentTier,
          message: `Insufficient Premium Coins: ${nextTier.title} requires 🪙${nextTier.costCoins} Coins (Available: 🪙${playerCoins}).`,
        };
      }
    } else {
      if (playerCash < nextTier.costCash) {
        return {
          success: false,
          costCash: 0,
          costCoins: 0,
          newLevel: currentTier,
          message: `Insufficient Street Cash: ${nextTier.title} requires ₦${nextTier.costCash.toLocaleString()} (Available: ₦${playerCash.toLocaleString()}).`,
        };
      }
    }

    // Atomic execution
    this.propertyRenovations.set(id, nextTierNum);
    this.syncEntityMetadata();

    if (useCoins) {
      this.premiumCoins -= nextTier.costCoins;
      this.addTransactionRecord("premium_coins", -nextTier.costCoins, "renovation", `Installed ${nextTier.title} at ${prop.name}`, this.premiumCoins);
    } else {
      this.addTransactionRecord("cash", -nextTier.costCash, "renovation", `Installed ${nextTier.title} at ${prop.name}`, playerCash - nextTier.costCash);
    }

    this.prestige.points += 75;
    this.checkPrestigeLevel();

    return {
      success: true,
      costCash: useCoins ? 0 : nextTier.costCash,
      costCoins: useCoins ? nextTier.costCoins : 0,
      newLevel: nextTierNum,
      message: `Renovation completed! ${prop.name} upgraded with ${nextTier.title}! Property valuation enhanced.`,
    };
  }

  public purchaseVehicle(
    vehicleId: string,
    playerCash: number,
    playerCoins: number,
    currency: CurrencyType = "cash",
  ): { success: boolean; cost: number; message: string } {
    const item = VEHICLE_CATALOG.find((v) => v.id === vehicleId);
    if (!item) return { success: false, cost: 0, message: "Vehicle not found in showroom catalogue." };
    if (this.ownedVehicles.has(vehicleId)) {
      return { success: false, cost: 0, message: `You already own the ${item.name} in your Kano garage.` };
    }

    if (currency === "premium_coins") {
      const priceCoins = item.priceCoins ?? 100;
      if (playerCoins < priceCoins) {
        return {
          success: false,
          cost: 0,
          message: `Insufficient Premium Coins: ${item.name} requires 🪙${priceCoins} Coins (Available: 🪙${playerCoins}).`,
        };
      }
      this.premiumCoins -= priceCoins;
      this.ownedVehicles.add(vehicleId);
      this.addTransactionRecord("premium_coins", -priceCoins, "purchase", `Purchased ${item.name}`, this.premiumCoins);
      this.prestige.points += 40;
      this.checkPrestigeLevel();
      return { success: true, cost: priceCoins, message: `Acquired ${item.name} with 🪙${priceCoins} Premium Coins! Delivered to garage.` };
    }

    if (playerCash < item.priceCash) {
      return {
        success: false,
        cost: 0,
        message: `Insufficient Street Cash: ${item.name} requires ₦${item.priceCash.toLocaleString()} (Available: ₦${playerCash.toLocaleString()}).`,
      };
    }

    this.ownedVehicles.add(vehicleId);
    this.addTransactionRecord("cash", -item.priceCash, "purchase", `Purchased ${item.name}`, playerCash - item.priceCash);
    this.prestige.points += 40;
    this.checkPrestigeLevel();

    return {
      success: true,
      cost: item.priceCash,
      message: `Purchased ${item.name} for ₦${item.priceCash.toLocaleString()}! Keys registered in your fleet.`,
    };
  }

  public purchaseVehicleSkin(
    skinId: string,
    vehicleId: string,
    playerCash: number,
    playerCoins: number,
    currency: CurrencyType = "cash",
  ): { success: boolean; cost: number; message: string } {
    const veh = VEHICLE_CATALOG.find((v) => v.id === vehicleId);
    const skin = veh?.availableSkins?.find((s) => s.id === skinId);
    if (!veh || !skin) return { success: false, cost: 0, message: "Vehicle skin not found." };
    if (this.unlockedVehicleSkins.has(skinId)) {
      return { success: false, cost: 0, message: `You already unlocked the ${skin.name} livery.` };
    }

    if (currency === "premium_coins") {
      const priceCoins = skin.priceCoins ?? 20;
      if (playerCoins < priceCoins) {
        return { success: false, cost: 0, message: `Insufficient Premium Coins: ${skin.name} requires 🪙${priceCoins} Coins.` };
      }
      this.premiumCoins -= priceCoins;
      this.unlockedVehicleSkins.add(skinId);
      this.vehicleUpgrade.paintColor = skin.paintColor;
      this.addTransactionRecord("premium_coins", -priceCoins, "purchase", `Unlocked skin: ${skin.name}`, this.premiumCoins);
      return { success: true, cost: priceCoins, message: `Unlocked and applied ${skin.name} custom livery!` };
    }

    const priceCash = skin.priceCash ?? 30000;
    if (playerCash < priceCash) {
      return { success: false, cost: 0, message: `Insufficient Street Cash: ${skin.name} requires ₦${priceCash.toLocaleString()}.` };
    }

    this.unlockedVehicleSkins.add(skinId);
    this.vehicleUpgrade.paintColor = skin.paintColor;
    this.addTransactionRecord("cash", -priceCash, "purchase", `Unlocked skin: ${skin.name}`, playerCash - priceCash);

    return { success: true, cost: priceCash, message: `Unlocked and applied ${skin.name} custom livery!` };
  }

  public claimAchievement(
    achievementId: string,
  ): { success: boolean; rewardCash: number; rewardCoins: number; message: string } {
    const def = ACHIEVEMENT_CATALOG.find((a) => a.id === achievementId);
    const state = this.achievements.get(achievementId);
    if (!def || !state) return { success: false, rewardCash: 0, rewardCoins: 0, message: "Achievement not found." };
    if (!state.isUnlocked) return { success: false, rewardCash: 0, rewardCoins: 0, message: "Achievement requirements have not yet been met." };
    if (state.isClaimed) return { success: false, rewardCash: 0, rewardCoins: 0, message: "Achievement rewards have already been claimed." };

    state.isClaimed = true;
    state.claimedAt = Date.now();
    this.premiumCoins += def.rewardCoins;
    this.prestige.points += 25;
    this.checkPrestigeLevel();

    this.addTransactionRecord("premium_coins", def.rewardCoins, "achievement_reward", `Achievement reward: ${def.title}`, this.premiumCoins);

    return {
      success: true,
      rewardCash: def.rewardCash,
      rewardCoins: def.rewardCoins,
      message: `Achievement Claimed! '${def.title}' rewarded +₦${def.rewardCash.toLocaleString()} and +🪙${def.rewardCoins} Coins!`,
    };
  }

  public recordSeasonalProgress(challengeId: string, countDelta = 1): boolean {
    const challenge = ACTIVE_SEASON_CONFIG.challenges.find((c) => c.id === challengeId);
    if (!challenge) return false;
    if (this.seasonalProgress.completedChallenges.includes(challengeId)) return false;

    if (challengeId === "harmattan_challenge_cruiser") {
      this.seasonalProgress.distanceDriven = (this.seasonalProgress.distanceDriven || 0) + countDelta;
      if (this.seasonalProgress.distanceDriven >= challenge.targetCount) {
        this.seasonalProgress.completedChallenges.push(challengeId);
        return true;
      }
      return false;
    }

    this.seasonalProgress.completedChallenges.push(challengeId);
    return true;
  }

  public claimSeasonalChallenge(
    challengeId: string,
  ): { success: boolean; rewardCash: number; rewardCoins: number; message: string } {
    const challenge = ACTIVE_SEASON_CONFIG.challenges.find((c) => c.id === challengeId);
    if (!challenge) return { success: false, rewardCash: 0, rewardCoins: 0, message: "Seasonal challenge not found." };
    if (!this.seasonalProgress.completedChallenges.includes(challengeId)) {
      return { success: false, rewardCash: 0, rewardCoins: 0, message: "Challenge requirements not yet completed." };
    }
    if (this.seasonalProgress.claimedRewards.includes(challengeId)) {
      return { success: false, rewardCash: 0, rewardCoins: 0, message: "Seasonal challenge reward already claimed." };
    }

    this.seasonalProgress.claimedRewards.push(challengeId);
    this.premiumCoins += challenge.rewardCoins;
    this.prestige.points += 30;
    this.checkPrestigeLevel();

    this.addTransactionRecord("premium_coins", challenge.rewardCoins, "seasonal_reward", `Harmattan Season reward: ${challenge.title}`, this.premiumCoins);

    return {
      success: true,
      rewardCash: challenge.rewardCash,
      rewardCoins: challenge.rewardCoins,
      message: `Seasonal Challenge Claimed: ${challenge.title}! +₦${challenge.rewardCash.toLocaleString()} and +🪙${challenge.rewardCoins} Coins!`,
    };
  }

  public claimSeasonalMilestone(): { success: boolean; rewardCoins: number; rewardTitle?: string; message: string } {
    const milestone = ACTIVE_SEASON_CONFIG.seasonMilestoneReward;
    if (!milestone) return { success: false, rewardCoins: 0, message: "No active season milestone." };
    if (this.seasonalProgress.milestoneClaimed) {
      return { success: false, rewardCoins: 0, message: "Seasonal milestone award already claimed." };
    }
    if (this.seasonalProgress.completedChallenges.length < milestone.requiredChallengesCount) {
      return {
        success: false,
        rewardCoins: 0,
        message: `Requires ${milestone.requiredChallengesCount} completed challenges (Current: ${this.seasonalProgress.completedChallenges.length}).`,
      };
    }

    this.seasonalProgress.milestoneClaimed = true;
    this.premiumCoins += milestone.rewardCoins;
    this.prestige.points += 100;
    this.checkPrestigeLevel();

    this.addTransactionRecord("premium_coins", milestone.rewardCoins, "seasonal_reward", `Claimed ${milestone.name}`, this.premiumCoins);

    return {
      success: true,
      rewardCoins: milestone.rewardCoins,
      rewardTitle: milestone.rewardTitle,
      message: `Grand Seasonal Award Claimed! +🪙${milestone.rewardCoins} Coins and the '${milestone.rewardTitle}' prestige title!`,
    };
  }

  public checkAndUnlockAchievements(context: {
    cash: number;
    dayCount: number;
    ownedBusinesses: BusinessId[];
    ownedProperties: PropertyId[];
    completedMissions: number;
    maxBusinessLevel: number;
    hasSolar?: boolean;
    restedOnDakali?: boolean;
  }): string[] {
    const newlyUnlocked: string[] = [];

    ACHIEVEMENT_CATALOG.forEach((def) => {
      let state = this.achievements.get(def.id);
      if (!state) {
        state = { progress: 0, isUnlocked: false, isClaimed: false };
        this.achievements.set(def.id, state);
      }
      if (state.isUnlocked) return;

      let qualified = false;
      switch (def.id) {
        case "ach_first_enterprise":
          state.progress = context.ownedBusinesses.length;
          qualified = context.ownedBusinesses.length >= 1;
          break;
        case "ach_empire_builder":
          state.progress = context.maxBusinessLevel;
          qualified = context.maxBusinessLevel >= 3;
          break;
        case "ach_multi_conglomerate":
          state.progress = context.ownedBusinesses.length;
          qualified = context.ownedBusinesses.length >= 3;
          break;
        case "ach_real_estate_owner":
          state.progress = context.ownedProperties.length;
          qualified = context.ownedProperties.length >= 1;
          break;
        case "ach_kano_tycoon":
          state.progress = context.ownedProperties.length;
          qualified = context.ownedProperties.length >= 3;
          break;
        case "ach_solar_pioneer":
          qualified = Boolean(context.hasSolar);
          state.progress = qualified ? 1 : 0;
          break;
        case "ach_freight_master":
          state.progress = context.completedMissions;
          qualified = context.completedMissions >= 5;
          break;
        case "ach_millionaire":
          state.progress = context.cash;
          qualified = context.cash >= 1000000;
          break;
        case "ach_trans_saharan":
          qualified = context.ownedBusinesses.includes("dawanau-grain-depot");
          state.progress = qualified ? 1 : 0;
          break;
        case "ach_fellowship":
          qualified = Boolean(context.restedOnDakali);
          state.progress = qualified ? 1 : 0;
          break;
      }

      if (qualified) {
        state.isUnlocked = true;
        state.unlockedAt = Date.now();
        newlyUnlocked.push(def.title);
      }
    });

    return newlyUnlocked;
  }

  private checkPrestigeLevel() {
    const points = this.prestige.points;
    if (points >= 600) this.prestige.level = 4; // Kano Commercial Baron
    else if (points >= 350) this.prestige.level = 3; // Prominent Merchant
    else if (points >= 150) this.prestige.level = 2; // Rising Entrepreneur
    else this.prestige.level = 1; // Street Hustler
  }

  public getPrestigeTitle(): string {
    const level = this.prestige.level;
    if (level >= 4) return "Kano Commercial Baron";
    if (level === 3) return "Prominent Merchant";
    if (level === 2) return "Rising Entrepreneur";
    return "Street Hustler";
  }

  public getEmpireOverview(currentCash: number): EmpireOverviewSnapshot {
    this.syncEntityMetadata();

    let grossRevenue = 0;
    let operatingCosts = 0;
    let businessValuation = 0;

    this.businesses.forEach((b) => {
      if (b.isOwned) {
        grossRevenue += b.dailyRevenue;
        operatingCosts += b.dailyCost;
        businessValuation += b.purchasePrice + ((b.level ?? 1) - 1) * (b.upgradeCost ?? 0);
      }
    });

    let propertyValuation = 0;
    this.properties.forEach((p) => {
      if (p.isOwned) {
        propertyValuation += p.currentValuation ?? p.purchasePrice;
        operatingCosts += p.dailyUpkeep;
      } else if (p.isRented) {
        operatingCosts += p.dailyUpkeep;
      }
    });

    const netDaily = grossRevenue - operatingCosts;
    const netWorth = currentCash + propertyValuation + businessValuation;

    let unlockedAch = 0;
    this.achievements.forEach((a) => {
      if (a.isUnlocked) unlockedAch += 1;
    });

    const playerAchievementState: Record<string, PlayerAchievementState> = {};
    this.achievements.forEach((val, key) => {
      playerAchievementState[key] = { ...val };
    });

    let propUpkeep = 0;
    this.properties.forEach((p) => {
      if (p.isOwned || p.isRented) propUpkeep += p.dailyUpkeep;
    });

    let bizCosts = 0;
    this.businesses.forEach((b) => {
      if (b.isOwned) bizCosts += b.dailyCost;
    });

    const statement = this.getFinancialStatement(currentCash);
    const monthly = this.getMonthlyFinancialSummary(currentCash);

    return {
      streetCash: currentCash,
      premiumCoins: this.premiumCoins,
      dailyNetIncome: netDaily,
      dailyGrossRevenue: grossRevenue,
      dailyOperatingExpenses: operatingCosts,
      totalPropertyValuation: propertyValuation,
      totalBusinessValuation: businessValuation,
      netWorth,
      totalNetWorth: netWorth,
      totalDailyRevenue: grossRevenue,
      totalDailyOperatingCost: bizCosts,
      totalDailyPropertyUpkeep: propUpkeep,
      netDailyProfit: netDaily,
      ownedBusinessesCount: this.getOwnedBusinessesList().length,
      ownedPropertiesCount: this.getOwnedPropertiesList().length,
      ownedVehiclesCount: this.ownedVehicles.size,
      unlockedAchievementsCount: unlockedAch,
      totalAchievementsCount: ACHIEVEMENT_CATALOG.length,
      prestigeLevel: this.prestige.level,
      prestigePoints: this.prestige.points,
      activeSeasonId: ACTIVE_SEASON_CONFIG.id,
      activeSeasonName: ACTIVE_SEASON_CONFIG.name,
      businesses: Array.from(this.businesses.values()),
      properties: Array.from(this.properties.values()),
      fleet: {
        ownedVehicles: Array.from(this.ownedVehicles),
        unlockedSkins: Array.from(this.unlockedVehicleSkins),
        catalog: VEHICLE_CATALOG,
      },
      season: {
        activeSeason: ACTIVE_SEASON_CONFIG,
        upcomingPreview: UPCOMING_SEASON_PREVIEW,
        points: this.seasonalProgress.completedChallenges.length * 50,
        completedChallenges: this.seasonalProgress.completedChallenges,
        claimedChallenges: this.seasonalProgress.claimedRewards,
        milestoneClaimed: this.seasonalProgress.milestoneClaimed,
      },
      achievements: {
        catalog: ACHIEVEMENT_CATALOG,
        playerState: playerAchievementState,
        unlockedCount: unlockedAch,
        totalCount: ACHIEVEMENT_CATALOG.length,
        prestige: {
          points: this.prestige.points,
          level: this.prestige.level,
          title: this.getPrestigeTitle(),
        },
      },
      transactionHistory: [...this.transactionHistory],
      financialStatement: statement,
      monthlySummary: monthly,
      recentFinancialStatements: [...this.financialHistory],
      businessEventNotifications: [...this.businessNotifications],
    };
  }

  public upgradeVehicleEngine(playerCash: number): { success: boolean; cost: number; message: string } {
    if (this.vehicleUpgrade.engineStage >= 2) {
      return { success: false, cost: 0, message: "Engine is already at maximum Stage 2 Racing Tune." };
    }
    const cost = this.vehicleUpgrade.engineStage === 0 ? 50000 : 95000;
    if (playerCash < cost) {
      return { success: false, cost: 0, message: `Insufficient cash: Engine Stage ${this.vehicleUpgrade.engineStage + 1} requires ₦${cost.toLocaleString()}.` };
    }

    this.vehicleUpgrade.engineStage += 1;
    this.addTransactionRecord("cash", -cost, "upgrade", `Engine Stage ${this.vehicleUpgrade.engineStage} Tune`, playerCash - cost);

    return {
      success: true,
      cost,
      message: `Engine upgraded to Stage ${this.vehicleUpgrade.engineStage}! Acceleration and top speed boosted.`,
    };
  }

  public customPaintVehicle(color: string, colorName: string, playerCash: number): { success: boolean; cost: number; message: string } {
    const cost = 25000;
    if (playerCash < cost) {
      return { success: false, cost: 0, message: `Custom metallic paint requires ₦${cost.toLocaleString()}.` };
    }
    this.vehicleUpgrade.paintColor = color;
    this.addTransactionRecord("cash", -cost, "purchase", `Custom Paint: ${colorName}`, playerCash - cost);

    return {
      success: true,
      cost,
      message: `Vehicle repainted in custom ${colorName}! Surface cured and polished.`,
    };
  }

  public getOwnedPropertiesList(): PropertyId[] {
    const list: PropertyId[] = [];
    this.properties.forEach((p, id) => {
      if (p.isOwned) list.push(id);
    });
    return list;
  }

  public getAccessibleProperties(hasApartmentRental = false): PropertyInfo[] {
    const list: PropertyInfo[] = [];
    this.properties.forEach((p) => {
      if (p.isOwned || (p.id === "unit-2b" && (p.isRented || hasApartmentRental))) {
        list.push(p);
      }
    });
    return list;
  }

  public resolveSelectedHome(hasApartmentRental = false): PropertyId | null {
    if (hasApartmentRental) {
      const u2b = this.properties.get("unit-2b");
      if (u2b) u2b.isRented = true;
    }
    const accessible = this.getAccessibleProperties(hasApartmentRental);
    if (accessible.length === 0) {
      this.selectedHomePropertyId = null;
      return null;
    }
    if (this.selectedHomePropertyId && accessible.some((p) => p.id === this.selectedHomePropertyId)) {
      return this.selectedHomePropertyId;
    }
    this.selectedHomePropertyId = accessible[0].id;
    return this.selectedHomePropertyId;
  }

  public setSelectedHome(propertyId: PropertyId, hasApartmentRental = false): { success: boolean; message: string } {
    if (hasApartmentRental && propertyId === "unit-2b") {
      const u2b = this.properties.get("unit-2b");
      if (u2b) u2b.isRented = true;
    }
    const accessible = this.getAccessibleProperties(hasApartmentRental);
    const target = accessible.find((p) => p.id === propertyId);
    if (!target) {
      return { success: false, message: "Cannot set as home: you do not own or lease this property." };
    }
    this.selectedHomePropertyId = propertyId;
    return { success: true, message: `${target.name} set as primary home!` };
  }

  public getOwnedBusinessesList(): BusinessId[] {
    const list: BusinessId[] = [];
    this.businesses.forEach((b, id) => {
      if (b.isOwned) list.push(id);
    });
    return list;
  }

  public purchaseFurniture(
    catalogId: string,
    playerCash: number,
  ): { success: boolean; cost: number; instance?: FurnitureInstance; message: string } {
    const item = getFurnitureCatalogItem(catalogId);
    if (!item) {
      return { success: false, cost: 0, message: "Item not found in furniture catalogue." };
    }
    if (playerCash < item.price) {
      return {
        success: false,
        cost: 0,
        message: `Insufficient funds: ${item.name} requires ₦${item.price.toLocaleString()} (Current: ₦${playerCash.toLocaleString()}).`,
      };
    }

    const instanceId = `furn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const instance: FurnitureInstance = {
      instanceId,
      catalogId,
      purchasedAt: Date.now(),
      purchasePrice: item.price,
      floor: 1,
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      isPlaced: false,
    };

    this.furnitureInventory.push(instance);
    this.addTransactionRecord("cash", -item.price, "purchase", `Purchased furniture: ${item.name}`, playerCash - item.price);

    return {
      success: true,
      cost: item.price,
      instance,
      message: `Purchased ${item.name} for ₦${item.price.toLocaleString()}! Delivered to your property inventory.`,
    };
  }

  public placeFurniture(
    instanceId: string,
    propertyId: PropertyId,
    floor: number,
    room: string,
    pos: { x: number; y: number; z: number },
    rotationY: number,
  ): { success: boolean; message: string } {
    const instance = this.furnitureInventory.find((f) => f.instanceId === instanceId);
    if (!instance) {
      return { success: false, message: "Furniture item not found in inventory." };
    }

    const prop = this.properties.get(propertyId);
    if (!prop || (!prop.isOwned && !(propertyId === "unit-2b" && (prop.isRented || prop.isOwned)))) {
      return { success: false, message: "You must own or lease this property before furnishing it." };
    }

    instance.assignedPropertyId = propertyId;
    instance.floor = floor;
    instance.room = room;
    instance.position = { ...pos };
    instance.rotationY = rotationY;
    instance.isPlaced = true;

    const itemName = getFurnitureCatalogItem(instance.catalogId)?.name ?? "Furniture";
    return {
      success: true,
      message: `Placed ${itemName} in ${room}!`,
    };
  }

  public moveFurniture(
    instanceId: string,
    pos: { x: number; y: number; z: number },
    rotationY: number,
  ): { success: boolean; message: string } {
    const instance = this.furnitureInventory.find((f) => f.instanceId === instanceId);
    if (!instance || !instance.isPlaced) {
      return { success: false, message: "Placed furniture item not found." };
    }
    instance.position = { ...pos };
    instance.rotationY = rotationY;
    const itemName = getFurnitureCatalogItem(instance.catalogId)?.name ?? "Furniture";
    return { success: true, message: `Repositioned ${itemName}.` };
  }

  public storeFurniture(instanceId: string): { success: boolean; message: string } {
    const instance = this.furnitureInventory.find((f) => f.instanceId === instanceId);
    if (!instance) {
      return { success: false, message: "Furniture item not found." };
    }
    instance.isPlaced = false;
    instance.assignedPropertyId = undefined;
    instance.room = undefined;
    const itemName = getFurnitureCatalogItem(instance.catalogId)?.name ?? "Item";
    return {
      success: true,
      message: `${itemName} returned to inventory storage.`,
    };
  }

  public getPlacedFurniture(propertyId: PropertyId): FurnitureInstance[] {
    return this.furnitureInventory.filter((f) => f.isPlaced && f.assignedPropertyId === propertyId);
  }

  public getUnplacedFurniture(): FurnitureInstance[] {
    return this.furnitureInventory.filter((f) => !f.isPlaced);
  }

  public saveToStorage(
    cash: number,
    trafficFine: number,
    hasApartmentRental: boolean,
    completedMissions?: string[],
    careerEarnings?: number,
    storyProgress?: StoryProgressData,
    weatherPreset?: string,
    audioMuted?: boolean,
    selectedHomePropertyId?: PropertyId | null,
    needs?: { hunger: number; energy: number; hygiene: number },
    completedFreelanceContracts?: string[],
    freelanceEarnings?: number,
    consequencesData?: {
      npcMemory?: Record<string, import("./consequenceSystem").NpcMemoryRecord>;
      vehicleConditions?: Record<string, import("./consequenceSystem").VehicleConditionState>;
      consequencesHistory?: import("./consequenceSystem").ConsequenceRecord[];
    },
    currentCity?: import("./cityRegistry").CityId,
    cityPositions?: Partial<Record<import("./cityRegistry").CityId, { x: number; y: number; z: number; yaw: number }>>,
  ): boolean {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
      const bizLevelsObj: Record<string, number> = {};
      this.businessLevels.forEach((v, k) => {
        bizLevelsObj[k] = v;
      });

      const propRenovationsObj: Record<string, number> = {};
      this.propertyRenovations.forEach((v, k) => {
        propRenovationsObj[k] = v;
      });

      const achievementsObj: Record<string, PlayerAchievementState> = {};
      this.achievements.forEach((v, k) => {
        achievementsObj[k] = { ...v };
      });

      const bizConditionsObj: Record<string, number> = {};
      this.businessConditions.forEach((v, k) => {
        bizConditionsObj[k] = v;
      });

      const bizReputationsObj: Record<string, number> = {};
      this.businessReputations.forEach((v, k) => {
        bizReputationsObj[k] = v;
      });

      const bizSatisfactionObj: Record<string, number> = {};
      this.businessSatisfaction.forEach((v, k) => {
        bizSatisfactionObj[k] = v;
      });

      const bizLastMaintainedObj: Record<string, number> = {};
      this.businessLastMaintainedDay.forEach((v, k) => {
        bizLastMaintainedObj[k] = v;
      });

      const data: SaveData = {
        version: 1, // Keep version 1 for maximum backwards compatibility
        cash,
        premiumCoins: this.premiumCoins,
        trafficFine,
        hasApartmentRental,
        ownedProperties: this.getOwnedPropertiesList(),
        ownedBusinesses: this.getOwnedBusinessesList(),
        businessLevels: bizLevelsObj,
        propertyRenovations: propRenovationsObj,
        businessConditions: bizConditionsObj,
        businessReputations: bizReputationsObj,
        businessSatisfaction: bizSatisfactionObj,
        businessLastMaintainedDay: bizLastMaintainedObj,
        financialHistory: this.financialHistory.slice(0, 30),
        businessNotifications: this.businessNotifications.slice(0, 20),
        ownedVehicles: Array.from(this.ownedVehicles),
        unlockedVehicleSkins: Array.from(this.unlockedVehicleSkins),
        achievements: achievementsObj,
        seasonalProgress: { ...this.seasonalProgress },
        transactionHistory: this.transactionHistory.map((t) => ({ ...t })),
        prestige: { ...this.prestige },
        dayCount: this.dayCount,
        vehicleUpgrade: { ...this.vehicleUpgrade },
        completedMissions: completedMissions ?? [],
        careerEarnings: careerEarnings ?? 0,
        storyProgress: storyProgress ? { ...storyProgress } : undefined,
        weatherPreset,
        audioMuted,
        furnitureInventory: this.furnitureInventory.map((f) => ({
          ...f,
          position: { ...f.position },
        })),
        selectedHomePropertyId: selectedHomePropertyId !== undefined ? selectedHomePropertyId : this.selectedHomePropertyId,
        needs: needs ? { ...needs } : undefined,
        completedFreelanceContracts: completedFreelanceContracts ? [...completedFreelanceContracts] : [],
        freelanceEarnings: freelanceEarnings ?? 0,
        dailyAtmWithdrawn: this.dailyAtmWithdrawn,
        lastAtmWithdrawalDay: this.lastAtmWithdrawalDay,
        hasSeenOnboarding: this.hasSeenOnboarding,
        npcMemory: consequencesData?.npcMemory,
        vehicleConditions: consequencesData?.vehicleConditions,
        consequencesHistory: consequencesData?.consequencesHistory,
        currentCity,
        cityPositions,
        savedAt: Date.now(),
      };
      window.localStorage.setItem("kano_streets_save_v1", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  public loadFromStorage(): SaveData | null {
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem("kano_streets_save_v1");
      if (!raw) return null;

      // Safe non-destructive backup before parsing or migration
      try {
        if (!window.localStorage.getItem("kano_streets_save_v1_backup")) {
          window.localStorage.setItem("kano_streets_save_v1_backup", raw);
        }
      } catch {
        // Ignore backup storage limits if quota exceeded
      }

      const data = JSON.parse(raw) as SaveData;
      if (!data || (data.version !== undefined && data.version !== 1 && data.version !== 2)) return null;

      // Restore Premium Coins test balance
      if (typeof data.premiumCoins === "number" && !isNaN(data.premiumCoins)) {
        this.premiumCoins = Math.max(0, data.premiumCoins);
      } else {
        this.premiumCoins = 250;
      }

      // Restore owned properties with ID normalization
      if (Array.isArray(data.ownedProperties)) {
        const normOwned: PropertyId[] = [];
        data.ownedProperties.forEach((rawId) => {
          const normId = normalizePropertyId(rawId);
          if (normId) {
            const p = this.properties.get(normId);
            if (p) p.isOwned = true;
            if (!normOwned.includes(normId)) normOwned.push(normId);
          }
        });
        data.ownedProperties = normOwned;
      }

      // Restore furniture inventory early so placed furniture can inform property occupancy
      if (Array.isArray(data.furnitureInventory)) {
        this.furnitureInventory = data.furnitureInventory
          .filter((f) => f && f.instanceId && f.catalogId)
          .map((f) => {
            const assignedNorm = normalizePropertyId(f.assignedPropertyId) ?? f.assignedPropertyId;
            return {
              instanceId: f.instanceId,
              catalogId: f.catalogId,
              purchasedAt: f.purchasedAt || Date.now(),
              purchasePrice: f.purchasePrice || 0,
              assignedPropertyId: assignedNorm,
              room: f.room,
              floor: f.floor || 1,
              position: f.position ? { ...f.position } : { x: 0, y: 0, z: 0 },
              rotationY: f.rotationY || 0,
              isPlaced: Boolean(f.isPlaced),
            };
          });
      } else {
        this.furnitureInventory = [];
      }

      // Detect placed furniture in Unit 2B (strong signal of prior lease/furnishing)
      const hasPlacedInU2b = this.furnitureInventory.some(
        (f) => f.isPlaced && f.assignedPropertyId === "unit-2b",
      );

      // Check all possible rental flags from current and legacy saves
      const rawData = data as unknown as Record<string, unknown>;
      const hasRental = Boolean(
        data.hasApartmentRental ||
        rawData.apartmentRental ||
        rawData.isRented ||
        rawData.apartmentRented ||
        hasPlacedInU2b ||
        (Array.isArray(rawData.rentedProperties) &&
          rawData.rentedProperties.some((id) => normalizePropertyId(id) === "unit-2b")) ||
        (Array.isArray(data.ownedProperties) &&
          data.ownedProperties.some((id) => normalizePropertyId(id) === "unit-2b" && !this.properties.get("unit-2b")?.isOwned)),
      );

      if (hasRental) {
        const u2b = this.properties.get("unit-2b");
        if (u2b) u2b.isRented = true;
        data.hasApartmentRental = true;
      }

      if (Array.isArray(data.ownedBusinesses)) {
        data.ownedBusinesses.forEach((id) => {
          const b = this.businesses.get(id);
          if (b) {
            b.isOwned = true;
            if (!this.businessLevels.has(b.id)) {
              this.businessLevels.set(b.id, 1);
            }
          }
        });
      }

      // Restore business progression levels
      if (data.businessLevels && typeof data.businessLevels === "object") {
        Object.entries(data.businessLevels).forEach(([id, level]) => {
          if (this.businesses.has(id as BusinessId) && typeof level === "number" && level >= 1) {
            this.businessLevels.set(id as BusinessId, Math.min(3, Math.max(1, Math.floor(level))));
          }
        });
      }

      // Restore Phase A Business Management state
      if (data.businessConditions && typeof data.businessConditions === "object") {
        Object.entries(data.businessConditions).forEach(([id, cond]) => {
          if (this.businesses.has(id as BusinessId) && typeof cond === "number") {
            this.businessConditions.set(id as BusinessId, Math.max(0, Math.min(100, Math.floor(cond))));
          }
        });
      }
      if (data.businessReputations && typeof data.businessReputations === "object") {
        Object.entries(data.businessReputations).forEach(([id, rep]) => {
          if (this.businesses.has(id as BusinessId) && typeof rep === "number") {
            this.businessReputations.set(id as BusinessId, Math.max(0, Math.min(100, Math.floor(rep))));
          }
        });
      }
      if (data.businessSatisfaction && typeof data.businessSatisfaction === "object") {
        Object.entries(data.businessSatisfaction).forEach(([id, sat]) => {
          if (this.businesses.has(id as BusinessId) && typeof sat === "number") {
            this.businessSatisfaction.set(id as BusinessId, Math.max(0, Math.min(100, Math.floor(sat))));
          }
        });
      }
      if (data.businessLastMaintainedDay && typeof data.businessLastMaintainedDay === "object") {
        Object.entries(data.businessLastMaintainedDay).forEach(([id, day]) => {
          if (this.businesses.has(id as BusinessId) && typeof day === "number") {
            this.businessLastMaintainedDay.set(id as BusinessId, Math.max(1, Math.floor(day)));
          }
        });
      }
      if (Array.isArray(data.financialHistory)) {
        this.financialHistory = data.financialHistory.filter((f) => f && typeof f.netProfit === "number").slice(0, 30);
      }
      if (Array.isArray(data.businessNotifications)) {
        this.businessNotifications = data.businessNotifications.filter((n) => typeof n === "string").slice(0, 20);
      }

      // Restore property renovations
      if (data.propertyRenovations && typeof data.propertyRenovations === "object") {
        Object.entries(data.propertyRenovations).forEach(([id, tier]) => {
          const normId = normalizePropertyId(id);
          if (normId && typeof tier === "number" && tier >= 0) {
            this.propertyRenovations.set(normId, Math.min(2, Math.max(0, Math.floor(tier))));
          }
        });
      }

      // Restore owned vehicles and skins
      if (Array.isArray(data.ownedVehicles)) {
        data.ownedVehicles.forEach((vId) => {
          if (typeof vId === "string") this.ownedVehicles.add(vId);
        });
      }
      this.ownedVehicles.add("veh_sedan"); // Always hold starter sedan

      if (Array.isArray(data.unlockedVehicleSkins)) {
        data.unlockedVehicleSkins.forEach((sId) => {
          if (typeof sId === "string") this.unlockedVehicleSkins.add(sId);
        });
      }
      this.unlockedVehicleSkins.add("skin_sedan_stock");

      // Restore achievements
      if (data.achievements && typeof data.achievements === "object") {
        Object.entries(data.achievements).forEach(([id, state]) => {
          if (state && typeof state === "object") {
            this.achievements.set(id, {
              progress: state.progress || 0,
              isUnlocked: Boolean(state.isUnlocked),
              unlockedAt: state.unlockedAt,
              isClaimed: Boolean(state.isClaimed),
              claimedAt: state.claimedAt,
            });
          }
        });
      }

      // Restore seasonal progress
      if (data.seasonalProgress && typeof data.seasonalProgress === "object") {
        this.seasonalProgress = {
          activeSeasonId: data.seasonalProgress.activeSeasonId || ACTIVE_SEASON_CONFIG.id,
          completedChallenges: Array.isArray(data.seasonalProgress.completedChallenges)
            ? [...data.seasonalProgress.completedChallenges]
            : [],
          claimedRewards: Array.isArray(data.seasonalProgress.claimedRewards)
            ? [...data.seasonalProgress.claimedRewards]
            : [],
          milestoneClaimed: Boolean(data.seasonalProgress.milestoneClaimed),
          distanceDriven: Number(data.seasonalProgress.distanceDriven) || 0,
        };
      }

      // Restore transaction history
      if (Array.isArray(data.transactionHistory)) {
        this.transactionHistory = data.transactionHistory
          .filter((t) => t && typeof t.amount === "number")
          .map((t) => ({ ...t }));
      }

      // Restore prestige
      if (data.prestige && typeof data.prestige.level === "number") {
        this.prestige = {
          level: Math.max(1, data.prestige.level),
          points: Math.max(0, data.prestige.points || 0),
        };
      }

      if (data.vehicleUpgrade) {
        this.vehicleUpgrade = { ...data.vehicleUpgrade };
      }
      if (data.dayCount) {
        this.dayCount = data.dayCount;
        this.lastProcessedDay = data.dayCount;
      }
      if (typeof data.dailyAtmWithdrawn === "number") {
        this.dailyAtmWithdrawn = data.dailyAtmWithdrawn;
      }
      if (typeof data.lastAtmWithdrawalDay === "number") {
        this.lastAtmWithdrawalDay = data.lastAtmWithdrawalDay;
      }
      if (typeof data.hasSeenOnboarding === "boolean") {
        this.hasSeenOnboarding = data.hasSeenOnboarding;
      } else {
        const isVeteran = (typeof data.dayCount === "number" && data.dayCount > 1) ||
          (typeof data.cash === "number" && data.cash > 50000) ||
          !!data.hasApartmentRental ||
          (Array.isArray(data.completedMissions) && data.completedMissions.length > 0) ||
          (Array.isArray(data.ownedProperties) && data.ownedProperties.length > 0) ||
          (Array.isArray(data.ownedBusinesses) && data.ownedBusinesses.length > 0);
        this.hasSeenOnboarding = isVeteran;
      }
      if (data.selectedHomePropertyId !== undefined) {
        data.selectedHomePropertyId = normalizePropertyId(data.selectedHomePropertyId);
        this.selectedHomePropertyId = data.selectedHomePropertyId;
      }

      this.syncEntityMetadata();
      return data;
    } catch {
      return null;
    }
  }
}

