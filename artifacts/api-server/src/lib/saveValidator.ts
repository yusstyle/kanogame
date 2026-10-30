import crypto from "node:crypto";
import { z } from "@workspace/api-zod";

export const ALLOWED_PROPERTIES = ["unit-2b", "bompai-penthouse", "albaraka-villa"] as const;
export const ALLOWED_BUSINESSES = [
  "sabon-gari-shop",
  "arewa-suya-franchise",
  "cyber-hub-station",
  "dawanau-grain-depot",
] as const;
export const ALLOWED_VEHICLES = [
  "veh_sedan",
  "veh_keke",
  "veh_van",
  "veh_pickup",
  "veh_minibus",
  "veh_truck",
] as const;
export const ALLOWED_WEATHER = [
  "clear",
  "harmattan",
  "sunset_glow",
  "cool_night",
] as const;

export const MAX_PAYLOAD_BYTES = 500 * 1024; // 500 KB explicit limit

/**
 * Validates the SaveData payload strictly.
 */
export const SaveDataSchema = z
  .object({
    version: z.number().int().min(1).max(2).default(1),
    cash: z.number().finite().min(0).max(1_000_000_000),
    premiumCoins: z.number().finite().min(0).max(100_000).optional(),
    trafficFine: z.number().finite().min(0).max(500_000).default(0),
    hasApartmentRental: z.boolean().default(false),
    ownedProperties: z
      .array(z.enum(ALLOWED_PROPERTIES))
      .max(3)
      .refine((arr) => new Set(arr).size === arr.length, {
        message: "Duplicate property IDs are not allowed",
      }),
    ownedBusinesses: z
      .array(z.enum(ALLOWED_BUSINESSES))
      .max(4)
      .refine((arr) => new Set(arr).size === arr.length, {
        message: "Duplicate business IDs are not allowed",
      }),
    businessLevels: z
      .record(z.enum(ALLOWED_BUSINESSES), z.number().int().min(1).max(3))
      .optional(),
    propertyRenovations: z
      .record(z.enum(ALLOWED_PROPERTIES), z.number().int().min(0).max(2))
      .optional(),
    ownedVehicles: z
      .array(z.enum(ALLOWED_VEHICLES))
      .max(6)
      .refine((arr) => new Set(arr).size === arr.length, {
        message: "Duplicate vehicle IDs are not allowed",
      })
      .optional(),
    unlockedVehicleSkins: z.array(z.string().max(50)).max(50).optional(),
    achievements: z
      .record(
        z.string().max(64),
        z.object({
          progress: z.number().finite().min(0).optional(),
          isUnlocked: z.boolean().optional(),
          unlockedAt: z.number().optional(),
          isClaimed: z.boolean().optional(),
          claimedAt: z.number().optional(),
        }),
      )
      .optional(),
    seasonalProgress: z
      .object({
        activeSeasonId: z.string().max(64),
        completedChallenges: z.array(z.string().max(64)).max(50),
        claimedRewards: z.array(z.string().max(64)).max(50),
        milestoneClaimed: z.boolean(),
        distanceDriven: z.number().finite().min(0).optional(),
      })
      .optional(),
    transactionHistory: z
      .array(
        z.object({
          id: z.string().max(64),
          timestamp: z.number().finite(),
          type: z.string().max(32),
          description: z.string().max(128),
          amount: z.number().finite(),
          resultingBalance: z.number().finite(),
          currency: z.enum(["naira", "coins"]),
        }),
      )
      .max(100)
      .optional(),
    prestige: z
      .object({
        level: z.number().int().min(1).max(1000),
        points: z.number().finite().min(0),
      })
      .optional(),
    dayCount: z.number().int().min(1).max(100_000),
    vehicleUpgrade: z
      .object({
        engineStage: z.number().int().min(0).max(10),
        paintColor: z.string().max(32),
        suspensionUpgraded: z.boolean(),
      })
      .optional(),
    completedMissions: z.array(z.string().max(64)).max(100).optional(),
    careerEarnings: z.number().finite().min(0).optional(),
    storyProgress: z
      .object({
        chapter: z.number().int().min(1).max(10),
        discoveredIndenture: z.boolean(),
        investigationChoice: z.string().nullable().optional(),
        careerChoice: z.string().nullable().optional(),
        completedChapter1: z.boolean(),
      })
      .optional(),
    weatherPreset: z.enum(ALLOWED_WEATHER).optional(),
    audioMuted: z.boolean().optional(),
    furnitureInventory: z
      .array(
        z.object({
          instanceId: z.string().max(64),
          catalogId: z.string().max(64),
          purchasedAt: z.number().finite().optional(),
          purchasePrice: z.number().finite().optional(),
          assignedPropertyId: z.string().max(64).nullable().optional(),
          room: z.string().max(64).nullable().optional(),
          floor: z.number().int().optional(),
          position: z
            .object({
              x: z.number().finite(),
              y: z.number().finite(),
              z: z.number().finite(),
            })
            .optional(),
          rotationY: z.number().finite().optional(),
          isPlaced: z.boolean().optional(),
        }),
      )
      .max(250)
      .optional(),
    selectedHomePropertyId: z.string().max(64).nullable().optional(),
    needs: z
      .object({
        hunger: z.number().finite().min(0).max(100),
        energy: z.number().finite().min(0).max(100),
        hygiene: z.number().finite().min(0).max(100),
      })
      .optional(),
    completedFreelanceContracts: z.array(z.string().max(64)).max(100).optional(),
    freelanceEarnings: z.number().finite().min(0).optional(),
    dailyAtmWithdrawn: z.number().finite().min(0).max(1_000_000).optional(),
    lastAtmWithdrawalDay: z.number().int().min(1).max(100_000).optional(),
    hasSeenOnboarding: z.boolean().optional(),
    savedAt: z.number().finite().min(0),
  })
  .strict(); // Disallows unexpected root keys

export type ValidatedSaveData = z.infer<typeof SaveDataSchema>;

/**
 * Checks for prototype pollution keys in arbitrary objects.
 */
export function hasPrototypePollution(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (Array.isArray(obj)) {
    return obj.some(hasPrototypePollution);
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record);
  for (const key of keys) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return true;
    }
    if (typeof record[key] === "object" && hasPrototypePollution(record[key])) {
      return true;
    }
  }
  return false;
}

/**
 * Deterministically sorts object keys recursively for canonical checksum calculation.
 */
function sortKeys(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map(sortKeys);
  }
  if (val !== null && typeof val === "object") {
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(val as Record<string, unknown>).sort();
    for (const key of keys) {
      sortedObj[key] = sortKeys((val as Record<string, unknown>)[key]);
    }
    return sortedObj;
  }
  return val;
}

/**
 * Computes a deterministic SHA-256 checksum over the validated payload.
 * NOTE: This is for data transmission & storage integrity verification, NOT client anti-cheat.
 */
export function computePayloadChecksum(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(sortKeys(payload));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
