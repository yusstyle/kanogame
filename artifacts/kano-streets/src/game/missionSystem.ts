import * as THREE from "three";
import type {
  ActiveMissionInfo,
  CareerMission,
  MissionCategory,
  MissionStage,
  VehicleType,
} from "./types";

export const CAREER_MISSIONS_CATALOG: {
  id: string;
  title: string;
  category: MissionCategory;
  district: string;
  description: string;
  recommendedVehicle: VehicleType;
  reward: number;
  enterpriseBonusId?: string;
  bonusAmount?: number;
  stagesCount: number;
}[] = [
  {
    id: "local-delivery-electronics",
    title: "Express Courier: Sabon Gari to Bompai",
    category: "local_delivery",
    district: "SABON GARI → AIRPORT ROAD",
    description: "Collect a consigned carton of smartphones and solar chargers from Sabon Gari Plaza and deliver it to Airport View Apartments (Unit 2B).",
    recommendedVehicle: "van",
    reward: 22000,
    stagesCount: 2,
  },
  {
    id: "freight-machine-parts",
    title: "Heavy Freight: Kawu Depot to Arewa Workshop",
    category: "freight",
    district: "KAWU INDUSTRIAL DISTRICT",
    description: "Load heavy industrial transmission gears and crated machinery parts at Kawu Central Freight Terminal and transport them to Arewa Heavy Vehicle Repairs.",
    recommendedVehicle: "truck",
    reward: 35000,
    stagesCount: 2,
  },
  {
    id: "passenger-worker-shuttle",
    title: "Commuter Transit: Industrial Shift Shuttle",
    category: "passenger",
    district: "KAWU INDUSTRIAL → SABON GARI",
    description: "Pick up evening shift factory technicians from Kawu Workers Canteen and transport them safely through the city to Sabon Gari Kasuwa Market.",
    recommendedVehicle: "minibus",
    reward: 28000,
    stagesCount: 2,
  },
  {
    id: "workshop-fleet-overhaul",
    title: "Fleet Overhaul: Refurbished Engine Assembly",
    category: "workshop",
    district: "KAWU INDUSTRIAL → SANI AUTO",
    description: "Collect a freshly machined diesel cylinder head and transmission block from Arewa Heavy Workshop and haul it to Sani Vulcanizer for final tuning.",
    recommendedVehicle: "pickup",
    reward: 30000,
    stagesCount: 2,
  },
  {
    id: "supply-produce-suya",
    title: "Wholesale Supply: Dawanau Provisions to Arewa Suya Lounge",
    category: "business_supply",
    district: "KAWU INDUSTRIAL → AIRPORT ROAD",
    description: "Haul wholesale bags of northern suya spice blend, dry onions, and butchered beef quarters from Dawanau Grain Depot directly to Arewa Fast Food & Suya Lounge.",
    recommendedVehicle: "truck",
    reward: 45000,
    enterpriseBonusId: "arewa-suya-franchise",
    bonusAmount: 15000,
    stagesCount: 2,
  },
];

export class MissionSystem {
  public missions: CareerMission[] = [];
  public activeMissionId: string | null = null;
  public completedMissionIds: Set<string> = new Set();
  public careerEarnings = 0;

  constructor() {
    this.initMissions();
  }

  private initMissions() {
    this.missions = [
      {
        id: "local-delivery-electronics",
        title: "Express Courier: Sabon Gari to Bompai",
        category: "local_delivery",
        district: "SABON GARI → AIRPORT ROAD",
        description: "Collect a consigned carton of smartphones and solar chargers from Sabon Gari Plaza and deliver it to Airport View Apartments (Unit 2B).",
        recommendedVehicle: "van",
        reward: 22000,
        stages: [
          {
            step: 1,
            instruction: "Collect electronics consignment at Sabon Gari Plaza",
            targetName: "Sabon Gari Commercial Plaza",
            targetCoords: { x: -22, z: 48 },
            targetRadius: 4.8,
            actionPrompt: "Collect Electronics Consignment [E]",
            completionToast: "Consignment loaded into cargo hold! Drive to Airport View Apartments (Unit 2B).",
          },
          {
            step: 2,
            instruction: "Deliver electronics consignment to Airport View Apartments (Unit 2B)",
            targetName: "Airport View Apartments (Unit 2B)",
            targetCoords: { x: 48, z: -50 },
            targetRadius: 4.8,
            actionPrompt: "Deliver Consignment to Unit 2B [E]",
            completionToast: "Electronics delivery safely signed for! Contract complete.",
          },
        ],
        currentStageIndex: 0,
        state: "available",
      },
      {
        id: "freight-machine-parts",
        title: "Heavy Freight: Kawu Depot to Arewa Workshop",
        category: "freight",
        district: "KAWU INDUSTRIAL DISTRICT",
        description: "Load heavy industrial transmission gears and crated machinery parts at Kawu Central Freight Terminal and transport them to Arewa Heavy Vehicle Repairs.",
        recommendedVehicle: "truck",
        reward: 35000,
        stages: [
          {
            step: 1,
            instruction: "Load heavy machinery parts at Kawu Central Freight Terminal (Bay 02)",
            targetName: "Kawu Freight Terminal (Bay 02)",
            targetCoords: { x: -42, z: -175 },
            targetRadius: 5.5,
            actionPrompt: "Load Heavy Machinery Crates [E]",
            completionToast: "Heavy machinery secured to flatbed with ratchet straps! Haul cargo to Arewa Heavy Workshop.",
          },
          {
            step: 2,
            instruction: "Deliver machinery crates to Arewa Heavy Vehicle Repairs",
            targetName: "Arewa Heavy Vehicle Repairs Workshop",
            targetCoords: { x: -38, z: -135 },
            targetRadius: 5.5,
            actionPrompt: "Unload Machinery Crates at Workshop [E]",
            completionToast: "Industrial transmission parts unloaded by workshop gantry! Freight contract verified.",
          },
        ],
        currentStageIndex: 0,
        state: "available",
      },
      {
        id: "passenger-worker-shuttle",
        title: "Commuter Transit: Industrial Shift Shuttle",
        category: "passenger",
        district: "KAWU INDUSTRIAL → SABON GARI",
        description: "Pick up evening shift factory technicians from Kawu Workers Canteen and transport them safely through the city to Sabon Gari Kasuwa Market.",
        recommendedVehicle: "minibus",
        reward: 28000,
        stages: [
          {
            step: 1,
            instruction: "Pick up factory shift crew at Kawu Workers Canteen Transit Stop",
            targetName: "Kawu Workers Canteen Transit Hub",
            targetCoords: { x: -15, z: -155 },
            targetRadius: 5.2,
            actionPrompt: "Board Industrial Shift Passengers [E]",
            completionToast: "Shift crew boarded! Drive safely along the highway to Sabon Gari Kasuwa Market.",
          },
          {
            step: 2,
            instruction: "Disembark passengers at Sabon Gari Open-Air Kasuwa Market",
            targetName: "Sabon Gari Kasuwa Market",
            targetCoords: { x: -31, z: 31 },
            targetRadius: 5.5,
            actionPrompt: "Disembark Passengers at Kasuwa Terminal [E]",
            completionToast: "All passengers arrived safely at Kasuwa Market! Fares and transit contract paid.",
          },
        ],
        currentStageIndex: 0,
        state: "available",
      },
      {
        id: "workshop-fleet-overhaul",
        title: "Fleet Overhaul: Refurbished Engine Assembly",
        category: "workshop",
        district: "KAWU INDUSTRIAL → SANI AUTO",
        description: "Collect a freshly machined diesel cylinder head and transmission block from Arewa Heavy Workshop and haul it to Sani Vulcanizer for final tuning.",
        recommendedVehicle: "pickup",
        reward: 30000,
        stages: [
          {
            step: 1,
            instruction: "Collect refurbished engine assembly from Arewa Heavy Vehicle Repairs",
            targetName: "Arewa Heavy Repairs (Bay 1)",
            targetCoords: { x: -38, z: -135 },
            targetRadius: 5.2,
            actionPrompt: "Load Refurbished Engine Assembly [E]",
            completionToast: "Engine assembly loaded into truck bed! Transport to Sani Vulcanizer Workshop.",
          },
          {
            step: 2,
            instruction: "Deliver engine assembly to Sani Auto Tuning Workshop",
            targetName: "Sani Auto Workshop",
            targetCoords: { x: -16, z: -22 },
            targetRadius: 4.8,
            actionPrompt: "Deliver Engine Assembly to Sani Workshop [E]",
            completionToast: "Engine components delivered to Master Sani! Mechanical fleet overhaul complete.",
          },
        ],
        currentStageIndex: 0,
        state: "available",
      },
      {
        id: "supply-produce-suya",
        title: "Wholesale Supply: Dawanau Provisions to Arewa Suya Lounge",
        category: "business_supply",
        district: "KAWU INDUSTRIAL → AIRPORT ROAD",
        description: "Haul wholesale bags of northern suya spice blend, dry onions, and butchered beef quarters from Dawanau Grain Depot directly to Arewa Fast Food & Suya Lounge.",
        recommendedVehicle: "truck",
        reward: 45000,
        enterpriseBonusId: "arewa-suya-franchise",
        bonusAmount: 15000,
        stages: [
          {
            step: 1,
            instruction: "Load wholesale spice & meat supplies at Dawanau Grain & Produce Depot",
            targetName: "Dawanau Grain & Produce Depot",
            targetCoords: { x: 45, z: -175 },
            targetRadius: 5.5,
            actionPrompt: "Load Wholesale Meat & Spice Consignment [E]",
            completionToast: "Burlap sacks and cold provisions loaded! Transport supplies to Arewa Fast Food & Suya Lounge.",
          },
          {
            step: 2,
            instruction: "Deliver wholesale provisions to Arewa Fast Food & Suya Lounge",
            targetName: "Arewa Fast Food & Suya Lounge",
            targetCoords: { x: 16, z: -42 },
            targetRadius: 4.8,
            actionPrompt: "Deliver Supplies to Arewa Suya Kitchen [E]",
            completionToast: "Kitchen provisions verified and stocked by Suya chef! Supply contract complete.",
          },
        ],
        currentStageIndex: 0,
        state: "available",
      },
    ];
  }

  public getAvailableMissions(): CareerMission[] {
    return this.missions.filter((m) => m.state === "available");
  }

  public getMission(id: string): CareerMission | undefined {
    return this.missions.find((m) => m.id === id);
  }

  public getActiveMission(): CareerMission | null {
    if (!this.activeMissionId) return null;
    return this.missions.find((m) => m.id === this.activeMissionId) ?? null;
  }

  public acceptMission(id: string): { success: boolean; message: string; gpsTarget?: { x: number; z: number } } {
    if (this.activeMissionId) {
      return { success: false, message: "You already have an active contract. Complete or cancel it first." };
    }
    const mission = this.getMission(id);
    if (!mission) {
      return { success: false, message: "Mission contract not found." };
    }
    if (this.completedMissionIds.has(id)) {
      return { success: false, message: "Contract already completed for this cycle." };
    }

    mission.state = "in_progress";
    mission.currentStageIndex = 0;
    this.activeMissionId = id;

    const firstStage = mission.stages[0];
    return {
      success: true,
      message: `Contract Accepted: ${mission.title}. ${firstStage.instruction}.`,
      gpsTarget: firstStage.targetCoords,
    };
  }

  public cancelActiveMission(): { success: boolean; message: string } {
    if (!this.activeMissionId) {
      return { success: false, message: "No active mission to cancel." };
    }
    const mission = this.getActiveMission();
    if (mission) {
      mission.state = "available";
      mission.currentStageIndex = 0;
    }
    const title = mission ? mission.title : "Mission";
    this.activeMissionId = null;
    return { success: true, message: `Contract Cancelled: ${title}.` };
  }

  public checkMissionInteraction(playerPos: THREE.Vector3): { prompt: string; stage: MissionStage } | null {
    const active = this.getActiveMission();
    if (!active || active.state !== "in_progress") return null;

    const stage = active.stages[active.currentStageIndex];
    if (!stage) return null;

    const dist = Math.hypot(playerPos.x - stage.targetCoords.x, playerPos.z - stage.targetCoords.z);
    if (dist <= stage.targetRadius) {
      return { prompt: stage.actionPrompt, stage };
    }
    return null;
  }

  public advanceStage(
    playerPos: THREE.Vector3,
    ownedBusinesses: string[] = [],
  ): {
    completed: boolean;
    reward: number;
    bonus: number;
    message: string;
    nextGpsTarget?: { x: number; z: number } | null;
  } | null {
    const active = this.getActiveMission();
    if (!active || active.state !== "in_progress") return null;

    const currentStage = active.stages[active.currentStageIndex];
    const dist = Math.hypot(playerPos.x - currentStage.targetCoords.x, playerPos.z - currentStage.targetCoords.z);
    if (dist > currentStage.targetRadius) {
      return null;
    }

    // Advance to next stage or complete
    if (active.currentStageIndex + 1 < active.stages.length) {
      active.currentStageIndex += 1;
      const nextStage = active.stages[active.currentStageIndex];
      return {
        completed: false,
        reward: 0,
        bonus: 0,
        message: `${currentStage.completionToast} Next: ${nextStage.instruction}.`,
        nextGpsTarget: nextStage.targetCoords,
      };
    }

    // Final Stage Complete
    active.state = "completed";
    this.completedMissionIds.add(active.id);
    this.activeMissionId = null;

    let bonus = 0;
    if (active.enterpriseBonusId && ownedBusinesses.includes(active.enterpriseBonusId)) {
      bonus = active.bonusAmount ?? 0;
    }

    const totalPayout = active.reward + bonus;
    this.careerEarnings += totalPayout;

    const bonusText = bonus > 0 ? ` (Includes ₦${bonus.toLocaleString()} Owned Enterprise Supply Bonus!)` : "";
    const msg = `MISSION COMPLETE: ${active.title}! Paid ₦${totalPayout.toLocaleString()}${bonusText}`;

    return {
      completed: true,
      reward: active.reward,
      bonus,
      message: msg,
      nextGpsTarget: null,
    };
  }

  public getActiveMissionSnapshot(playerPos: THREE.Vector3): ActiveMissionInfo | null {
    const active = this.getActiveMission();
    if (!active || active.state !== "in_progress") return null;

    const stage = active.stages[active.currentStageIndex];
    if (!stage) return null;

    const dist = Math.round(
      Math.hypot(playerPos.x - stage.targetCoords.x, playerPos.z - stage.targetCoords.z),
    );

    return {
      id: active.id,
      title: active.title,
      category: active.category,
      instruction: stage.instruction,
      targetName: stage.targetName,
      targetCoords: stage.targetCoords,
      distanceMeters: dist,
      reward: active.reward,
      step: active.currentStageIndex + 1,
      totalSteps: active.stages.length,
    };
  }

  public getCompletedMissionsList(): string[] {
    return Array.from(this.completedMissionIds);
  }

  public loadProgress(completedIds: string[], earnings = 0) {
    if (Array.isArray(completedIds)) {
      completedIds.forEach((id) => {
        this.completedMissionIds.add(id);
        const m = this.getMission(id);
        if (m) m.state = "completed";
      });
    }
    this.careerEarnings = earnings;
  }
}

