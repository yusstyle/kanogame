import type { VehicleType, BusinessId } from "./types";

export type ConsequenceEventType =
  | "vehicle_collision"
  | "vehicle_repair"
  | "cargo_damaged"
  | "cargo_delivered_pristine"
  | "mission_cancelled"
  | "business_upgraded"
  | "traffic_citation"
  | "tea_favor"
  | "apology_accepted";

export interface NpcIncident {
  id: string;
  type: "positive" | "negative" | "neutral";
  title: string;
  description: string;
  timestamp: number;
  resolved: boolean;
}

export interface NpcMemoryRecord {
  npcId: string;
  name: string;
  trust: number; // 0 to 100 (50 is neutral, >= 70 loyal/friendly, <= 35 wary/cold)
  incidents: NpcIncident[];
  lastInteractionTime: number;
}

export interface VehicleConditionState {
  condition: number; // 0.0 to 100.0 (100 is pristine)
  odometerKm: number;
  impactDamageCount: number;
  needsRepair: boolean;
  lastDamageTime?: number;
}

export interface ConsequenceRecord {
  id: string;
  eventType: ConsequenceEventType;
  timestamp: number;
  trigger: string;
  entityId: string; // NPC id, vehicle type, or business id
  stateChanges: {
    reputationDelta?: number;
    conditionDelta?: number;
    cashDelta?: number;
    incidentTitle?: string;
  };
  persisted: boolean;
  resolved: boolean;
  recoveryAction?: string;
}

export class ConsequenceSystem {
  public npcMemories: Map<string, NpcMemoryRecord> = new Map();
  public vehicleConditions: Map<VehicleType, VehicleConditionState> = new Map();
  public consequenceLog: ConsequenceRecord[] = [];
  public activeCargoDamaged = false;
  private readonly processedIds: Set<string> = new Set();

  constructor() {
    this.initDefaultVehicleConditions();
    this.initDefaultNpcMemories();
  }

  private initDefaultVehicleConditions() {
    const vehicles: VehicleType[] = ["sedan", "keke", "van", "pickup", "minibus", "truck"];
    for (const v of vehicles) {
      this.vehicleConditions.set(v, {
        condition: 100.0,
        odometerKm: 0,
        impactDamageCount: 0,
        needsRepair: false,
      });
    }
  }

  private initDefaultNpcMemories() {
    const npcs: { id: string; name: string; defaultTrust?: number }[] = [
      { id: "garba_mechanic", name: "Garba Mechanic", defaultTrust: 50 },
      { id: "habiba_mai_shayi", name: "Habiba Mai Shayi", defaultTrust: 55 },
      { id: "chinedu_okeke", name: "Chinedu Okeke", defaultTrust: 55 },
      { id: "malam_danladi", name: "Malam Danladi", defaultTrust: 50 },
      { id: "aliyu_sambo", name: "Aliyu Sambo", defaultTrust: 50 },
      { id: "danladi_patrol", name: "Sergeant Danladi", defaultTrust: 50 },
      { id: "malam_kabiru_dankano", name: "Malam Kabiru Dan-Kano", defaultTrust: 50 },
      { id: "balarabe_craftsman", name: "Balarabe Craftsman", defaultTrust: 50 },
      { id: "maimuna_mai_masa", name: "Maimuna Mai Masa", defaultTrust: 55 },
    ];

    for (const n of npcs) {
      this.npcMemories.set(n.id, {
        npcId: n.id,
        name: n.name,
        trust: n.defaultTrust ?? 50,
        incidents: [],
        lastInteractionTime: 0,
      });
    }
  }

  public normalizeNpcId(nameOrId: string): string {
    const clean = nameOrId.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (clean.includes("garba") || clean.includes("mechanic")) return "garba_mechanic";
    if (clean.includes("habiba") || clean.includes("shayi")) return "habiba_mai_shayi";
    if (clean.includes("chinedu") || clean.includes("okeke")) return "chinedu_okeke";
    if (clean.includes("malam_danladi") || clean.includes("terminal") || clean.includes("freight")) return "malam_danladi";
    if (clean.includes("aliyu") || clean.includes("sambo")) return "aliyu_sambo";
    if (clean.includes("sergeant") || clean.includes("danladi_patrol") || clean.includes("patrol")) return "danladi_patrol";
    if (clean.includes("kabiru") || clean.includes("dan_kano") || clean.includes("dankano")) return "malam_kabiru_dankano";
    if (clean.includes("balarabe") || clean.includes("craftsman")) return "balarabe_craftsman";
    if (clean.includes("maimuna") || clean.includes("masa")) return "maimuna_mai_masa";
    return clean;
  }

  public getNpcMemory(nameOrId: string): NpcMemoryRecord {
    const id = this.normalizeNpcId(nameOrId);
    let mem = this.npcMemories.get(id);
    if (!mem) {
      mem = {
        npcId: id,
        name: nameOrId,
        trust: 50,
        incidents: [],
        lastInteractionTime: 0,
      };
      this.npcMemories.set(id, mem);
    }
    return mem;
  }

  public modifyNpcTrust(
    nameOrId: string,
    delta: number,
    incident?: { title: string; description: string; type: "positive" | "negative" | "neutral" },
  ): { newTrust: number; incidentAdded: boolean } {
    const mem = this.getNpcMemory(nameOrId);
    mem.trust = Math.max(0, Math.min(100, mem.trust + delta));
    mem.lastInteractionTime = Date.now();

    let incidentAdded = false;
    if (incident) {
      const incId = `inc_${mem.npcId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newInc: NpcIncident = {
        id: incId,
        type: incident.type,
        title: incident.title,
        description: incident.description,
        timestamp: Date.now(),
        resolved: false,
      };
      mem.incidents.unshift(newInc);
      if (mem.incidents.length > 6) {
        mem.incidents.pop(); // Bounded memory history
      }
      incidentAdded = true;
    }

    return { newTrust: mem.trust, incidentAdded };
  }

  public recordConsequence(csq: ConsequenceRecord): boolean {
    if (this.processedIds.has(csq.id)) {
      return false; // Idempotent: already processed
    }
    this.processedIds.add(csq.id);
    this.consequenceLog.unshift(csq);
    if (this.consequenceLog.length > 40) {
      this.consequenceLog.pop(); // Bounded consequence log
    }
    return true;
  }

  public getVehicleCondition(type: VehicleType): VehicleConditionState {
    let state = this.vehicleConditions.get(type);
    if (!state) {
      state = {
        condition: 100.0,
        odometerKm: 0,
        impactDamageCount: 0,
        needsRepair: false,
      };
      this.vehicleConditions.set(type, state);
    }
    return state;
  }

  public onVehicleCollision(
    type: VehicleType,
    impactSpeed: number,
    hasActiveCargo: boolean,
  ): {
    conditionLoss: number;
    newCondition: number;
    cargoDamaged: boolean;
    consequence?: ConsequenceRecord;
    message: string;
  } {
    const state = this.getVehicleCondition(type);
    const speed = Math.abs(impactSpeed);

    // Minor scrape vs moderate vs severe impact scaling
    let loss = 0;
    if (speed < 3.0) {
      loss = Math.round((speed * 0.8) * 10) / 10;
    } else if (speed < 7.0) {
      loss = Math.round((3.0 + (speed - 3.0) * 2.2) * 10) / 10;
    } else {
      loss = Math.round((12.0 + (speed - 7.0) * 3.5) * 10) / 10;
    }

    loss = Math.max(0.5, Math.min(38, loss));
    state.condition = Math.max(5.0, Math.round((state.condition - loss) * 10) / 10);
    state.impactDamageCount += 1;
    state.needsRepair = state.condition < 85.0;
    state.lastDamageTime = Date.now();

    let cargoRattled = false;
    if (hasActiveCargo && speed > 5.2) {
      cargoRattled = true;
      this.activeCargoDamaged = true;
    }

    const csqId = `csq_coll_${type}_${Date.now()}`;
    const csq: ConsequenceRecord = {
      id: csqId,
      eventType: "vehicle_collision",
      timestamp: Date.now(),
      trigger: `Impact at ${(speed * 3.6).toFixed(1)} km/h`,
      entityId: type,
      stateChanges: {
        conditionDelta: -loss,
        incidentTitle: `${type.toUpperCase()} collision damage: -${loss}%`,
      },
      persisted: true,
      resolved: false,
      recoveryAction: "Overhaul chassis at Arewa Heavy Vehicle Repairs (-38, -135)",
    };
    this.recordConsequence(csq);

    let message = "";
    if (state.condition < 35.0) {
      message = `Severe Impact! ${type.toUpperCase()} radiator leaking (Condition: ${state.condition}%). Slower top speed!`;
    } else if (state.condition < 70.0) {
      message = `Collision: ${type.toUpperCase()} body dented (Condition: ${state.condition}%).`;
    } else {
      message = `${type.toUpperCase()} scraped obstacle (Condition: ${state.condition}%).`;
    }

    if (cargoRattled) {
      message += " Consigned cargo was rattled by the heavy impact!";
    }

    return {
      conditionLoss: loss,
      newCondition: state.condition,
      cargoDamaged: cargoRattled,
      consequence: csq,
      message,
    };
  }

  public getRepairQuote(type: VehicleType): {
    cost: number;
    originalCost: number;
    discount: number;
    needsRepair: boolean;
    condition: number;
  } {
    const state = this.getVehicleCondition(type);
    if (state.condition >= 98.0) {
      return { cost: 0, originalCost: 0, discount: 0, needsRepair: false, condition: state.condition };
    }

    const baseRatePerPercent: Record<VehicleType, number> = {
      keke: 120,
      sedan: 220,
      van: 260,
      pickup: 300,
      minibus: 340,
      truck: 480,
    };

    const rate = baseRatePerPercent[type] || 250;
    const damagePercent = Math.max(2, 100 - state.condition);
    const originalCost = Math.round(damagePercent * rate);

    const garbaMem = this.getNpcMemory("garba_mechanic");
    const hasDiscount = garbaMem.trust >= 65;
    const discount = hasDiscount ? Math.round(originalCost * 0.2) : 0;
    const cost = originalCost - discount;

    return {
      cost,
      originalCost,
      discount,
      needsRepair: true,
      condition: state.condition,
    };
  }

  public repairVehicle(type: VehicleType, playerCash: number): { success: boolean; cost: number; message: string } {
    const quote = this.getRepairQuote(type);
    if (!quote.needsRepair) {
      return { success: false, cost: 0, message: "Vehicle is already in pristine mechanical condition." };
    }
    if (playerCash < quote.cost) {
      return {
        success: false,
        cost: quote.cost,
        message: `Insufficient cash for repairs. Master Garba requires ₦${quote.cost.toLocaleString()}.`,
      };
    }

    const state = this.getVehicleCondition(type);
    state.condition = 100.0;
    state.needsRepair = false;

    // Boost Garba trust for bringing business and paying honestly
    this.modifyNpcTrust("garba_mechanic", 8, {
      title: "Fleet Service Complete",
      description: `Overhauled ${type.toUpperCase()} chassis and engine components in Bay 1.`,
      type: "positive",
    });

    const csqId = `csq_rep_${type}_${Date.now()}`;
    this.recordConsequence({
      id: csqId,
      eventType: "vehicle_repair",
      timestamp: Date.now(),
      trigger: "Master Garba Bay 1 Overhaul",
      entityId: type,
      stateChanges: {
        conditionDelta: 100 - quote.condition,
        cashDelta: -quote.cost,
        reputationDelta: 8,
        incidentTitle: `Vehicle repaired to 100% condition`,
      },
      persisted: true,
      resolved: true,
    });

    const discountMsg = quote.discount > 0 ? ` (20% Master Garba Trade Discount: saved ₦${quote.discount.toLocaleString()})` : "";
    return {
      success: true,
      cost: quote.cost,
      message: `Master Garba overhauled your ${type.toUpperCase()} to 100% condition! Paid ₦${quote.cost.toLocaleString()}${discountMsg}.`,
    };
  }

  public onMissionCargoPickup(): void {
    this.activeCargoDamaged = false;
  }

  public onMissionCargoDelivery(
    missionId: string,
    recipientNpcName: string,
    baseReward: number,
  ): {
    payout: number;
    penalty: number;
    bonus: number;
    cargoDamaged: boolean;
    dialogue: string;
    consequence: ConsequenceRecord;
  } {
    const cargoDamaged = this.activeCargoDamaged;
    this.activeCargoDamaged = false;

    if (cargoDamaged) {
      const penalty = Math.round(baseReward * 0.25);
      const payout = baseReward - penalty;

      this.modifyNpcTrust(recipientNpcName, -12, {
        title: "Damaged Cargo Delivered",
        description: `Delivered consignment with impact damage. ₦${penalty.toLocaleString()} deducted for damaged goods.`,
        type: "negative",
      });

      const csqId = `csq_cargo_dmg_${missionId}_${Date.now()}`;
      const csq: ConsequenceRecord = {
        id: csqId,
        eventType: "cargo_damaged",
        timestamp: Date.now(),
        trigger: "Rough driving during consignment transit",
        entityId: recipientNpcName,
        stateChanges: {
          cashDelta: -penalty,
          reputationDelta: -12,
          incidentTitle: "Damaged cargo payout penalty",
        },
        persisted: true,
        resolved: false,
        recoveryAction: "Deliver the next consignment with zero collisions to rebuild trust",
      };
      this.recordConsequence(csq);

      const dialogue = `${recipientNpcName}: 'Subhanallah! Several items in this carton are shattered or dented from hard impacts! We had to deduct ₦${penalty.toLocaleString()} for damaged stock. Drive with greater care!'`;
      return { payout, penalty, bonus: 0, cargoDamaged: true, dialogue, consequence: csq };
    } else {
      const bonus = Math.round(baseReward * 0.15);
      const payout = baseReward + bonus;

      this.modifyNpcTrust(recipientNpcName, 12, {
        title: "Pristine Cargo Delivery",
        description: `Consignment delivered without a single scratch! Awarded ₦${bonus.toLocaleString()} handling bonus.`,
        type: "positive",
      });

      const csqId = `csq_cargo_ok_${missionId}_${Date.now()}`;
      const csq: ConsequenceRecord = {
        id: csqId,
        eventType: "cargo_delivered_pristine",
        timestamp: Date.now(),
        trigger: "Smooth transit with zero collision damage",
        entityId: recipientNpcName,
        stateChanges: {
          cashDelta: bonus,
          reputationDelta: 12,
          incidentTitle: "Pristine delivery handling bonus",
        },
        persisted: true,
        resolved: true,
      };
      this.recordConsequence(csq);

      const dialogue = `${recipientNpcName}: 'Alhamdulillah! The consignment arrived in immaculate condition! Here is a ₦${bonus.toLocaleString()} pristine handling bonus for exceptional driving.'`;
      return { payout, penalty: 0, bonus, cargoDamaged: false, dialogue, consequence: csq };
    }
  }

  public onMissionCancelled(recipientNpcName: string, hadCargoLoaded: boolean): void {
    if (hadCargoLoaded) {
      this.modifyNpcTrust(recipientNpcName, -10, {
        title: "Contract Abandoned After Pickup",
        description: "Accepted consigned freight but cancelled transit before delivery.",
        type: "negative",
      });
      this.recordConsequence({
        id: `csq_abandon_${Date.now()}`,
        eventType: "mission_cancelled",
        timestamp: Date.now(),
        trigger: "Cancelled in-progress delivery after loading goods",
        entityId: recipientNpcName,
        stateChanges: { reputationDelta: -10, incidentTitle: "Freight dispatch commitment broken" },
        persisted: true,
        resolved: false,
        recoveryAction: "Complete a new dispatch contract to restore commercial standing",
      });
    }
    this.activeCargoDamaged = false;
  }

  public onBusinessUpgraded(businessId: BusinessId, newLevel: number): ConsequenceRecord {
    const csqId = `csq_biz_upg_${businessId}_lvl${newLevel}_${Date.now()}`;
    const csq: ConsequenceRecord = {
      id: csqId,
      eventType: "business_upgraded",
      timestamp: Date.now(),
      trigger: `Upgraded to Tier ${newLevel}`,
      entityId: businessId,
      stateChanges: { incidentTitle: `Expanded enterprise to Tier ${newLevel}` },
      persisted: true,
      resolved: true,
    };
    this.recordConsequence(csq);
    return csq;
  }

  public getNpcGreetingAndDialogue(
    npcName: string,
    defaultDialogues: string[],
    isVehicleDamaged = false,
  ): {
    greeting: string;
    quote: string;
    trustStatus: "loyal" | "friendly" | "neutral" | "wary" | "hostile";
    perkOffered?: "free_tea" | "repair_discount" | "courier_bonus";
  } {
    const mem = this.getNpcMemory(npcName);
    const firstName = npcName.split(" ")[0];

    let trustStatus: "loyal" | "friendly" | "neutral" | "wary" | "hostile" = "neutral";
    if (mem.trust >= 80) trustStatus = "loyal";
    else if (mem.trust >= 65) trustStatus = "friendly";
    else if (mem.trust <= 25) trustStatus = "hostile";
    else if (mem.trust <= 40) trustStatus = "wary";

    // Master Garba Mechanic
    if (mem.npcId === "garba_mechanic") {
      if (trustStatus === "loyal" || trustStatus === "friendly") {
        return {
          greeting: `Maraba, my reliable brother! Always an honor to see you in Kawu Industrial.`,
          quote: isVehicleDamaged
            ? `Pull that vehicle into Bay 1 right away! You get our 20% Master Mechanic trade discount.`
            : `Your engine sounds clean and true. Keep the oil fresh and nothing can stop you on the northern routes.`,
          trustStatus,
          perkOffered: "repair_discount",
        };
      } else if (trustStatus === "wary" || trustStatus === "hostile") {
        return {
          greeting: `Hold on! Watch your speed around my workshop gate.`,
          quote: `I remember how recklessly you collided near here. If you want us to service your gear, drive like a professional!`,
          trustStatus,
        };
      }
    }

    // Habiba Mai Shayi
    if (mem.npcId === "habiba_mai_shayi") {
      if (trustStatus === "loyal" || trustStatus === "friendly") {
        return {
          greeting: `Sannu da zuwa, our favorite driver! Welcome to the canteen!`,
          quote: `You work so hard for this city! Take a cup of hot spiced ginger tea on the house to restore your energy.`,
          trustStatus,
          perkOffered: "free_tea",
        };
      } else if (trustStatus === "wary" || trustStatus === "hostile") {
        return {
          greeting: `Order first if you want a seat at the canteen benches.`,
          quote: `We only have time for respectful patrons who honor their commitments to the working crew.`,
          trustStatus,
        };
      }
    }

    // Chinedu Okeke
    if (mem.npcId === "chinedu_okeke") {
      if (trustStatus === "loyal" || trustStatus === "friendly") {
        return {
          greeting: `Barka, my friend! The pride of Sabon Gari commercial couriers!`,
          quote: `Word is spreading across the market about how safely you transport fragile electronics. You are always welcome in my store.`,
          trustStatus,
          perkOffered: "courier_bonus",
        };
      } else if (trustStatus === "wary" || trustStatus === "hostile") {
        return {
          greeting: `Good day. What brings you back to Sabon Gari Plaza?`,
          quote: `I have not forgotten that battered consignment with cracked glass. In commerce, trust is fragile like glass. Handle cargo with care next time!`,
          trustStatus,
        };
      }
    }

    // Default NPC fallback with memory attitude
    const quote = defaultDialogues[Math.floor(Math.random() * defaultDialogues.length)];
    if (trustStatus === "loyal" || trustStatus === "friendly") {
      return {
        greeting: `Assalamu Alaikum, ${firstName}! Great to see a trusted friend.`,
        quote,
        trustStatus,
      };
    } else if (trustStatus === "wary" || trustStatus === "hostile") {
      return {
        greeting: `Greetings. Watch your step around here.`,
        quote: `People in this neighborhood remember actions more than words.`,
        trustStatus,
      };
    }

    return {
      greeting: `Assalamu Alaikum!`,
      quote,
      trustStatus: "neutral",
    };
  }

  public getConsequencesHistory(): ConsequenceRecord[] {
    return [...this.consequenceLog];
  }

  public serialize(): {
    npcMemory: Record<string, NpcMemoryRecord>;
    vehicleConditions: Record<string, VehicleConditionState>;
    consequencesHistory: ConsequenceRecord[];
  } {
    const memObj: Record<string, NpcMemoryRecord> = {};
    this.npcMemories.forEach((v, k) => {
      memObj[k] = { ...v, incidents: [...v.incidents] };
    });

    const vehObj: Record<string, VehicleConditionState> = {};
    this.vehicleConditions.forEach((v, k) => {
      vehObj[k] = { ...v };
    });

    return {
      npcMemory: memObj,
      vehicleConditions: vehObj,
      consequencesHistory: [...this.consequenceLog],
    };
  }

  public deserialize(data?: {
    npcMemory?: Record<string, NpcMemoryRecord>;
    vehicleConditions?: Record<string, VehicleConditionState>;
    consequencesHistory?: ConsequenceRecord[];
  }): void {
    if (!data) return;

    if (data.npcMemory && typeof data.npcMemory === "object") {
      for (const [k, v] of Object.entries(data.npcMemory)) {
        if (v && typeof v.trust === "number") {
          this.npcMemories.set(k, {
            npcId: v.npcId ?? k,
            name: v.name ?? k,
            trust: Math.max(0, Math.min(100, v.trust)),
            incidents: Array.isArray(v.incidents) ? v.incidents.slice(0, 6) : [],
            lastInteractionTime: v.lastInteractionTime ?? 0,
          });
        }
      }
    }

    if (data.vehicleConditions && typeof data.vehicleConditions === "object") {
      for (const [k, v] of Object.entries(data.vehicleConditions)) {
        if (v && typeof v.condition === "number") {
          this.vehicleConditions.set(k as VehicleType, {
            condition: Math.max(0, Math.min(100, v.condition)),
            odometerKm: v.odometerKm ?? 0,
            impactDamageCount: v.impactDamageCount ?? 0,
            needsRepair: Boolean(v.needsRepair || v.condition < 85),
            lastDamageTime: v.lastDamageTime,
          });
        }
      }
    }

    if (Array.isArray(data.consequencesHistory)) {
      this.consequenceLog = data.consequencesHistory.slice(0, 40);
      for (const c of this.consequenceLog) {
        this.processedIds.add(c.id);
      }
    }
  }
}
