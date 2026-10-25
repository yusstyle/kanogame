import type { PropertyId, BusinessId, PropertyInfo, BusinessInfo, VehicleUpgrade } from "./types";

export interface SaveData {
  version: number;
  cash: number;
  trafficFine: number;
  hasApartmentRental: boolean;
  ownedProperties: PropertyId[];
  ownedBusinesses: BusinessId[];
  dayCount: number;
  vehicleUpgrade: VehicleUpgrade;
  completedMissions?: string[];
  careerEarnings?: number;
  savedAt: number;
}

export class EconomySystem {
  public properties: Map<PropertyId, PropertyInfo> = new Map();
  public businesses: Map<BusinessId, BusinessInfo> = new Map();
  public vehicleUpgrade: VehicleUpgrade = {
    engineStage: 0,
    paintColor: "#4a5568", // Stock graphite
    suspensionUpgraded: false,
  };
  public dayCount = 1;
  private lastProcessedDay = 1;

  constructor() {
    this.initProperties();
    this.initBusinesses();
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
      },
    ];
    props.forEach((p) => this.properties.set(p.id, p));
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
      },
    ];
    bizList.forEach((b) => this.businesses.set(b.id, b));
  }

  public getDailyNetIncome(): number {
    let income = 0;
    this.businesses.forEach((b) => {
      if (b.isOwned) {
        income += b.dailyRevenue - b.dailyCost;
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
      const net = this.getDailyNetIncome();
      if (net !== 0) {
        const sign = net > 0 ? "+" : "";
        const msg = net > 0
          ? `Day ${currentDay} Business Income: Collected ${sign}₦${net.toLocaleString()} net profit from your Kano enterprises!`
          : `Day ${currentDay} Expenses: Paid ₦${Math.abs(net).toLocaleString()} in property upkeep and maintenance.`;
        return { cashDelta: net, message: msg };
      }
    }
    return { cashDelta: 0, message: null };
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
    const netDaily = biz.dailyRevenue - biz.dailyCost;
    return {
      success: true,
      cost: biz.purchasePrice,
      message: `Enterprise deed acquired for ${biz.name}! Yielding ~₦${netDaily.toLocaleString()}/day net profit.`,
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

  public getOwnedBusinessesList(): BusinessId[] {
    const list: BusinessId[] = [];
    this.businesses.forEach((b, id) => {
      if (b.isOwned) list.push(id);
    });
    return list;
  }

  public saveToStorage(
    cash: number,
    trafficFine: number,
    hasApartmentRental: boolean,
    completedMissions?: string[],
    careerEarnings?: number,
  ): boolean {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
      const data: SaveData = {
        version: 1,
        cash,
        trafficFine,
        hasApartmentRental,
        ownedProperties: this.getOwnedPropertiesList(),
        ownedBusinesses: this.getOwnedBusinessesList(),
        dayCount: this.dayCount,
        vehicleUpgrade: { ...this.vehicleUpgrade },
        completedMissions: completedMissions ?? [],
        careerEarnings: careerEarnings ?? 0,
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
      const data = JSON.parse(raw) as SaveData;
      if (!data || (data.version !== undefined && data.version !== 1)) return null;

      // Restore owned properties & businesses
      if (Array.isArray(data.ownedProperties)) {
        data.ownedProperties.forEach((id) => {
          const p = this.properties.get(id);
          if (p) p.isOwned = true;
        });
      }
      if (Array.isArray(data.ownedBusinesses)) {
        data.ownedBusinesses.forEach((id) => {
          const b = this.businesses.get(id);
          if (b) b.isOwned = true;
        });
      }
      if (data.vehicleUpgrade) {
        this.vehicleUpgrade = { ...data.vehicleUpgrade };
      }
      if (data.dayCount) {
        this.dayCount = data.dayCount;
        this.lastProcessedDay = data.dayCount;
      }
      return data;
    } catch {
      return null;
    }
  }
}

