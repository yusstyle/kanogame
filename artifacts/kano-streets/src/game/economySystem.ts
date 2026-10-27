import type { PropertyId, BusinessId, PropertyInfo, BusinessInfo, VehicleUpgrade, StoryProgressData, FurnitureInstance } from "./types";
import { getFurnitureCatalogItem } from "./furnitureCatalogue";

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

export class EconomySystem {
  public properties: Map<PropertyId, PropertyInfo> = new Map();
  public businesses: Map<BusinessId, BusinessInfo> = new Map();
  public selectedHomePropertyId: PropertyId | null = null;
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
    if (!this.selectedHomePropertyId) {
      this.selectedHomePropertyId = id;
    }
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
    // If the currently selected home is valid and accessible, preserve it
    if (this.selectedHomePropertyId && accessible.some((p) => p.id === this.selectedHomePropertyId)) {
      return this.selectedHomePropertyId;
    }
    // Auto-suggest/set first accessible home
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

  public furnitureInventory: FurnitureInstance[] = [];

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
      if (!data || (data.version !== undefined && data.version !== 1)) return null;

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
      if (data.selectedHomePropertyId !== undefined) {
        data.selectedHomePropertyId = normalizePropertyId(data.selectedHomePropertyId);
        this.selectedHomePropertyId = data.selectedHomePropertyId;
      }
      return data;
    } catch {
      return null;
    }
  }
}

