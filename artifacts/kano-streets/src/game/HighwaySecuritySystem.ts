import type { ActiveMissionInfo } from "./types";
import type { CityId } from "./cityRegistry";

export interface WorldPosition2D {
  x: number;
  z: number;
}

export interface HighwayEncounterClue {
  id: string;
  name: string;
  position: WorldPosition2D;
}

export interface HighwayEncounterZone {
  id: string;
  cityId: CityId;
  name: string;
  district: string;
  road: string;
  position: WorldPosition2D;
  activationRadius: number;
  stopRadius: number;
  clues: HighwayEncounterClue[];
  rescuePosition: WorldPosition2D;
}

export type HighwayIncidentStage =
  | "encounter"
  | "reported"
  | "investigating"
  | "rescue_ready"
  | "rescued"
  | "cooldown";

export type PoliceResponseStatus = "not_reported" | "unavailable";

export interface HighwayIncident {
  id: string;
  zoneId: string;
  stage: HighwayIncidentStage;
  missingPerson: {
    id: string;
    name: string;
    role: "passenger";
  };
  lastKnownLocation: {
    cityId: CityId;
    district: string;
    road: string;
    x: number;
    z: number;
  };
  cluesFound: string[];
  policeStatus: PoliceResponseStatus;
  cooldownRemainingSeconds: number;
}

export interface HighwayIncidentHistory {
  id: string;
  missingPersonName: string;
  zoneId: string;
  outcome: "rescued";
  policeStatus: PoliceResponseStatus;
  lastKnownLocation: HighwayIncident["lastKnownLocation"];
  rewardCash: number;
  reputationGain: number;
}

export interface HighwaySecurityCooldown {
  remainingSeconds: number;
  requiresExit: boolean;
}

export interface HighwaySecuritySave {
  version: 1;
  reputation: number;
  nextIncidentNumber: number;
  activeIncident: HighwayIncident | null;
  incidentHistory: HighwayIncidentHistory[];
  zoneCooldowns: Record<string, HighwaySecurityCooldown>;
}

export interface HighwaySecurityEvent {
  type: "incident_started" | "incident_reported" | "clue_found" | "rescued";
  message: string;
  rewardCash?: number;
  reputationGain?: number;
}

const RESCUE_REWARD_CASH = 25_000;
const RESCUE_REPUTATION_GAIN = 10;
const ZONE_COOLDOWN_SECONDS = 180;
const RESCUED_DISPLAY_SECONDS = 8;

export const HIGHWAY_ENCOUNTER_ZONES: readonly HighwayEncounterZone[] = [
  {
    id: "abuja-southern-expressway-outer",
    cityId: "abuja",
    name: "Outer Asokoro Hills",
    district: "Asokoro Hillside",
    road: "Southern Airport Expressway",
    position: { x: 600, z: 450 },
    activationRadius: 34,
    stopRadius: 14,
    clues: [
      {
        id: "dropped-travel-ticket",
        name: "Dropped travel ticket",
        position: { x: 614, z: 470 },
      },
      {
        id: "shuttle-route-note",
        name: "Shuttle route note",
        position: { x: 630, z: 482 },
      },
    ],
    rescuePosition: { x: 646, z: 492 },
  },
];

const PASSENGER_NAMES = ["Amina Yusuf", "Musa Bello", "Hauwa Ibrahim"];

function distanceSquared(a: WorldPosition2D, b: WorldPosition2D): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function copyLocation(location: HighwayIncident["lastKnownLocation"]) {
  return { ...location };
}

function isIncidentStage(value: unknown): value is HighwayIncidentStage {
  return value === "encounter" ||
    value === "reported" ||
    value === "investigating" ||
    value === "rescue_ready" ||
    value === "rescued" ||
    value === "cooldown";
}

function isPoliceResponseStatus(value: unknown): value is PoliceResponseStatus {
  return value === "not_reported" || value === "unavailable";
}

function isHighwaySecuritySave(value: unknown): value is HighwaySecuritySave {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const save = value as Partial<HighwaySecuritySave>;
  if (
    save.version !== 1 ||
    !Number.isFinite(save.reputation) ||
    !Number.isInteger(save.nextIncidentNumber) ||
    !Array.isArray(save.incidentHistory) ||
    !save.zoneCooldowns ||
    typeof save.zoneCooldowns !== "object"
  ) {
    return false;
  }
  if (save.activeIncident === null) return true;

  const incident = save.activeIncident;
  return Boolean(
    incident &&
      typeof incident.id === "string" &&
      HIGHWAY_ENCOUNTER_ZONES.some((zone) => zone.id === incident.zoneId) &&
      isIncidentStage(incident.stage) &&
      incident.missingPerson?.role === "passenger" &&
      typeof incident.missingPerson.id === "string" &&
      typeof incident.missingPerson.name === "string" &&
      incident.lastKnownLocation?.cityId === "abuja" &&
      Number.isFinite(incident.lastKnownLocation.x) &&
      Number.isFinite(incident.lastKnownLocation.z) &&
      Array.isArray(incident.cluesFound) &&
      isPoliceResponseStatus(incident.policeStatus) &&
      Number.isFinite(incident.cooldownRemainingSeconds)
  );
}

export class HighwaySecuritySystem {
  private reputation = 0;
  private nextIncidentNumber = 1;
  private activeIncident: HighwayIncident | null = null;
  private incidentHistory: HighwayIncidentHistory[] = [];
  private zoneCooldowns: Record<string, HighwaySecurityCooldown> = {};

  constructor(saved?: unknown) {
    if (isHighwaySecuritySave(saved)) {
      this.reputation = Math.max(0, Math.floor(saved.reputation));
      this.nextIncidentNumber = Math.max(1, saved.nextIncidentNumber);
      this.activeIncident = saved.activeIncident
        ? {
            ...saved.activeIncident,
            missingPerson: { ...saved.activeIncident.missingPerson },
            lastKnownLocation: copyLocation(saved.activeIncident.lastKnownLocation),
            cluesFound: [...saved.activeIncident.cluesFound],
          }
        : null;
      this.incidentHistory = saved.incidentHistory
        .filter((entry) => entry && entry.outcome === "rescued")
        .slice(-12)
        .map((entry) => ({
          ...entry,
          lastKnownLocation: copyLocation(entry.lastKnownLocation),
        }));
      this.zoneCooldowns = Object.fromEntries(
        Object.entries(saved.zoneCooldowns)
          .filter(([id, cooldown]) =>
            HIGHWAY_ENCOUNTER_ZONES.some((zone) => zone.id === id) &&
            cooldown &&
            Number.isFinite(cooldown.remainingSeconds) &&
            typeof cooldown.requiresExit === "boolean",
          )
          .map(([id, cooldown]) => [
            id,
            {
              remainingSeconds: Math.max(0, cooldown.remainingSeconds),
              requiresExit: cooldown.requiresExit,
            },
          ]),
      );
    }
  }

  public update(
    cityId: CityId,
    position: WorldPosition2D,
    dt: number,
  ): HighwaySecurityEvent | null {
    const elapsed = Math.max(0, Math.min(dt, 0.25));
    for (const [zoneId, cooldown] of Object.entries(this.zoneCooldowns)) {
      cooldown.remainingSeconds = Math.max(0, cooldown.remainingSeconds - elapsed);
      const zone = HIGHWAY_ENCOUNTER_ZONES.find((candidate) => candidate.id === zoneId);
      const hasLeftZone = !zone ||
        cityId !== zone.cityId ||
        distanceSquared(position, zone.position) > (zone.activationRadius * 1.5) ** 2;
      if (cooldown.remainingSeconds === 0 && cooldown.requiresExit && hasLeftZone) {
        delete this.zoneCooldowns[zoneId];
      }
    }

    if (this.activeIncident?.stage === "rescued") {
      this.activeIncident.cooldownRemainingSeconds = Math.max(
        0,
        this.activeIncident.cooldownRemainingSeconds - elapsed,
      );
      if (this.activeIncident.cooldownRemainingSeconds === 0) {
        this.activeIncident.stage = "cooldown";
      }
    }

    if (this.activeIncident?.stage === "cooldown") {
      if (!this.zoneCooldowns[this.activeIncident.zoneId]) {
        this.activeIncident = null;
      }
      return null;
    }

    if (this.activeIncident || cityId !== "abuja") return null;

    const zone = HIGHWAY_ENCOUNTER_ZONES.find((candidate) =>
      candidate.cityId === cityId &&
      !this.zoneCooldowns[candidate.id] &&
      distanceSquared(position, candidate.position) <= candidate.activationRadius ** 2,
    );
    if (!zone) return null;

    const incidentNumber = this.nextIncidentNumber++;
    const name = PASSENGER_NAMES[(incidentNumber - 1) % PASSENGER_NAMES.length];
    this.activeIncident = {
      id: `highway-incident-${incidentNumber}`,
      zoneId: zone.id,
      stage: "encounter",
      missingPerson: {
        id: `highway-passenger-${incidentNumber}`,
        name,
        role: "passenger",
      },
      lastKnownLocation: {
        cityId: zone.cityId,
        district: zone.district,
        road: zone.road,
        x: zone.position.x,
        z: zone.position.z,
      },
      cluesFound: [],
      policeStatus: "not_reported",
      cooldownRemainingSeconds: 0,
    };
    return {
      type: "incident_started",
      message: `Road obstruction reported on ${zone.road}. Passenger ${name} is missing; last seen near ${zone.name}.`,
    };
  }

  public getIncident(): HighwayIncident | null {
    return this.activeIncident;
  }

  public getInteractionPrompt(cityId: CityId, position: WorldPosition2D): string | null {
    const incident = this.activeIncident;
    if (!incident || cityId !== incident.lastKnownLocation.cityId) return null;
    const zone = HIGHWAY_ENCOUNTER_ZONES.find((candidate) => candidate.id === incident.zoneId);
    if (!zone) return null;

    if (
      incident.stage === "encounter" &&
      distanceSquared(position, zone.position) <= 18 ** 2
    ) {
      return `Report missing passenger ${incident.missingPerson.name} to emergency services [E]`;
    }

    if (incident.stage === "reported" || incident.stage === "investigating") {
      const clue = zone.clues.find((candidate) => !incident.cluesFound.includes(candidate.id));
      if (clue && distanceSquared(position, clue.position) <= 6 ** 2) {
        return `Inspect ${clue.name} [E]`;
      }
    }

    if (
      incident.stage === "rescue_ready" &&
      distanceSquared(position, zone.rescuePosition) <= 7 ** 2
    ) {
      return `Rescue ${incident.missingPerson.name} [E]`;
    }
    return null;
  }

  public interactAt(
    cityId: CityId,
    position: WorldPosition2D,
  ): HighwaySecurityEvent | null {
    const incident = this.activeIncident;
    if (!incident || cityId !== incident.lastKnownLocation.cityId) return null;
    const zone = HIGHWAY_ENCOUNTER_ZONES.find((candidate) => candidate.id === incident.zoneId);
    if (!zone) return null;

    if (
      incident.stage === "encounter" &&
      distanceSquared(position, zone.position) <= 18 ** 2
    ) {
      incident.stage = "reported";
      incident.policeStatus = "unavailable";
      return {
        type: "incident_reported",
        message: `Emergency report recorded for ${incident.missingPerson.name}. Abuja police dispatch and patrol response are unavailable in the current game world.`,
      };
    }

    if (incident.stage === "reported" || incident.stage === "investigating") {
      const clue = zone.clues.find((candidate) => !incident.cluesFound.includes(candidate.id));
      if (clue && distanceSquared(position, clue.position) <= 6 ** 2) {
        incident.cluesFound.push(clue.id);
        const complete = incident.cluesFound.length === zone.clues.length;
        incident.stage = complete ? "rescue_ready" : "investigating";
        return {
          type: "clue_found",
          message: complete
            ? `${clue.name} logged. Search area located; rescue ${incident.missingPerson.name}.`
            : `${clue.name} logged. Continue the missing-person investigation.`,
        };
      }
    }

    if (
      incident.stage === "rescue_ready" &&
      distanceSquared(position, zone.rescuePosition) <= 7 ** 2
    ) {
      incident.stage = "rescued";
      incident.cooldownRemainingSeconds = RESCUED_DISPLAY_SECONDS;
      this.reputation += RESCUE_REPUTATION_GAIN;
      this.incidentHistory.push({
        id: incident.id,
        missingPersonName: incident.missingPerson.name,
        zoneId: incident.zoneId,
        outcome: "rescued",
        policeStatus: incident.policeStatus,
        lastKnownLocation: copyLocation(incident.lastKnownLocation),
        rewardCash: RESCUE_REWARD_CASH,
        reputationGain: RESCUE_REPUTATION_GAIN,
      });
      this.incidentHistory = this.incidentHistory.slice(-12);
      this.zoneCooldowns[zone.id] = {
        remainingSeconds: ZONE_COOLDOWN_SECONDS,
        requiresExit: true,
      };
      return {
        type: "rescued",
        message: `${incident.missingPerson.name} rescued and returned safely. +₦${RESCUE_REWARD_CASH.toLocaleString()} · +${RESCUE_REPUTATION_GAIN} community reputation.`,
        rewardCash: RESCUE_REWARD_CASH,
        reputationGain: RESCUE_REPUTATION_GAIN,
      };
    }

    return null;
  }

  public shouldStopVehicle(
    cityId: CityId,
    position: WorldPosition2D,
    speed: number,
    yaw: number,
  ): boolean {
    const incident = this.activeIncident;
    if (!incident || incident.stage !== "encounter" || cityId !== incident.lastKnownLocation.cityId) {
      return false;
    }
    const zone = HIGHWAY_ENCOUNTER_ZONES.find((candidate) => candidate.id === incident.zoneId);
    if (!zone || Math.abs(speed) < 0.1) return false;

    const dx = zone.position.x - position.x;
    const dz = zone.position.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > zone.stopRadius || distance === 0) return false;

    const headingX = Math.sin(yaw) * Math.sign(speed);
    const headingZ = Math.cos(yaw) * Math.sign(speed);
    return (dx * headingX + dz * headingZ) / distance > 0.35;
  }

  public getActiveMissionSnapshot(
    cityId: CityId,
    position: WorldPosition2D,
  ): ActiveMissionInfo | null {
    const incident = this.activeIncident;
    if (
      !incident ||
      incident.lastKnownLocation.cityId !== cityId ||
      incident.stage === "rescued" ||
      incident.stage === "cooldown"
    ) {
      return null;
    }
    const zone = HIGHWAY_ENCOUNTER_ZONES.find((candidate) => candidate.id === incident.zoneId);
    if (!zone) return null;

    let target: WorldPosition2D;
    let targetName: string;
    let instruction: string;
    let step: number;
    if (incident.stage === "encounter") {
      target = zone.position;
      targetName = `${zone.name} · ${zone.road}`;
      instruction = `Report ${incident.missingPerson.name} missing. Last known location: ${incident.lastKnownLocation.district}, ${incident.lastKnownLocation.road}.`;
      step = 1;
    } else if (incident.stage === "reported" || incident.stage === "investigating") {
      const clue = zone.clues.find((candidate) => !incident.cluesFound.includes(candidate.id));
      if (!clue) return null;
      target = clue.position;
      targetName = clue.name;
      instruction = `Investigate the last known location of ${incident.missingPerson.name}.`;
      step = incident.cluesFound.length + 2;
    } else {
      target = zone.rescuePosition;
      targetName = `${incident.missingPerson.name} · ${zone.name}`;
      instruction = `Reach the search location and bring ${incident.missingPerson.name} to safety.`;
      step = zone.clues.length + 2;
    }

    return {
      id: incident.id,
      title: `Missing Passenger: ${incident.missingPerson.name}`,
      category: "passenger",
      instruction,
      targetName,
      targetCoords: { ...target },
      distanceMeters: Math.round(Math.hypot(position.x - target.x, position.z - target.z)),
      reward: RESCUE_REWARD_CASH,
      step,
      totalSteps: zone.clues.length + 2,
    };
  }

  public getReputation(): number {
    return this.reputation;
  }

  public getIncidentHistory(): HighwayIncidentHistory[] {
    return this.incidentHistory.map((entry) => ({
      ...entry,
      lastKnownLocation: copyLocation(entry.lastKnownLocation),
    }));
  }

  public serialize(): HighwaySecuritySave {
    return {
      version: 1,
      reputation: this.reputation,
      nextIncidentNumber: this.nextIncidentNumber,
      activeIncident: this.activeIncident
        ? {
            ...this.activeIncident,
            missingPerson: { ...this.activeIncident.missingPerson },
            lastKnownLocation: copyLocation(this.activeIncident.lastKnownLocation),
            cluesFound: [...this.activeIncident.cluesFound],
          }
        : null,
      incidentHistory: this.getIncidentHistory(),
      zoneCooldowns: Object.fromEntries(
        Object.entries(this.zoneCooldowns).map(([id, cooldown]) => [id, { ...cooldown }]),
      ),
    };
  }
}
