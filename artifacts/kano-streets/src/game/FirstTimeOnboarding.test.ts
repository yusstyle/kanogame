import test from "node:test";
import assert from "node:assert/strict";
import { EconomySystem } from "./economySystem";
import { SaveDataSchema } from "../../../api-server/src/lib/saveValidator";

test("Stage 5: First-Time Player Onboarding Lifecycle & Persistence", () => {
  const mockStorage: Record<string, string> = {};
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
    },
  };

  // 1. Fresh economy system starts with hasSeenOnboarding = false
  const econ = new EconomySystem();
  assert.strictEqual(econ.hasSeenOnboarding, false, "New game starts with onboarding unseen");

  // 2. Saving a new game writes hasSeenOnboarding: false
  econ.saveToStorage(50000, 0, false);
  const rawSave = mockStorage["kano_streets_save_v1"];
  assert.ok(rawSave, "Save created in localStorage");
  const parsed1 = JSON.parse(rawSave);
  assert.strictEqual(parsed1.hasSeenOnboarding, false, "Saved payload contains hasSeenOnboarding = false");

  // 3. Dismissing onboarding marks it as seen and persists
  econ.dismissOnboarding();
  assert.strictEqual(econ.hasSeenOnboarding, true, "dismissOnboarding() sets hasSeenOnboarding to true");

  econ.saveToStorage(50000, 0, false);
  const parsed2 = JSON.parse(mockStorage["kano_streets_save_v1"]);
  assert.strictEqual(parsed2.hasSeenOnboarding, true, "Saved payload contains hasSeenOnboarding = true");

  // 4. Loading restores hasSeenOnboarding: true
  const freshEcon = new EconomySystem();
  freshEcon.loadFromStorage();
  assert.strictEqual(freshEcon.hasSeenOnboarding, true, "loadFromStorage restores hasSeenOnboarding = true");
});

test("Stage 5: Returning Veteran Player Fallback & Legacy Save Safety", () => {
  const mockStorage: Record<string, string> = {};
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
    },
  };

  // Scenario A: Veteran player save from Milestone 15 (no hasSeenOnboarding property, dayCount = 5, cash = 150000)
  const legacyVeteranSave = {
    version: 1,
    cash: 150000,
    trafficFine: 0,
    hasApartmentRental: true,
    dayCount: 5,
    completedMissions: ["cargo_flour_1"],
    ownedVehicles: ["veh_sedan", "veh_keke"],
    savedAt: Date.now(),
  };
  mockStorage["kano_streets_save_v1"] = JSON.stringify(legacyVeteranSave);

  const econVeteran = new EconomySystem();
  econVeteran.loadFromStorage();
  assert.strictEqual(
    econVeteran.hasSeenOnboarding,
    true,
    "Returning veteran player loading legacy save does not see onboarding toast",
  );

  // Scenario B: Brand new player legacy save (dayCount = 1, default cash 50000, no missions, no rentals)
  const freshLegacySave = {
    version: 1,
    cash: 50000,
    trafficFine: 0,
    hasApartmentRental: false,
    dayCount: 1,
    completedMissions: [],
    ownedVehicles: ["veh_sedan"],
    savedAt: Date.now(),
  };
  mockStorage["kano_streets_save_v1"] = JSON.stringify(freshLegacySave);

  const econFresh = new EconomySystem();
  econFresh.loadFromStorage();
  assert.strictEqual(
    econFresh.hasSeenOnboarding,
    false,
    "Brand new player loading legacy save with no progress sees onboarding guide",
  );
});

test("Stage 5: SaveDataSchema Compatibility with Onboarding", () => {
  const validWithOnboarding = {
    version: 1,
    cash: 50000,
    trafficFine: 0,
    hasApartmentRental: false,
    ownedProperties: [],
    ownedBusinesses: [],
    dayCount: 1,
    hasSeenOnboarding: true,
    savedAt: Date.now(),
  };

  const parsed = SaveDataSchema.safeParse(validWithOnboarding);
  assert.ok(parsed.success, "SaveDataSchema accepts payload with hasSeenOnboarding: true");

  const validWithoutOnboarding = {
    version: 1,
    cash: 50000,
    trafficFine: 0,
    hasApartmentRental: false,
    ownedProperties: [],
    ownedBusinesses: [],
    dayCount: 1,
    savedAt: Date.now(),
  };

  const parsedLegacy = SaveDataSchema.safeParse(validWithoutOnboarding);
  assert.ok(parsedLegacy.success, "SaveDataSchema accepts legacy payload where hasSeenOnboarding is omitted");
});

test("Stage 5: GameSnapshot Propagation of hasSeenOnboarding", () => {
  const econ = new EconomySystem();
  assert.strictEqual(econ.hasSeenOnboarding, false, "Initial economy has onboarding unseen");

  // Verify dismissing triggers state change
  econ.dismissOnboarding();
  assert.strictEqual(econ.hasSeenOnboarding, true, "dismissOnboarding sets hasSeenOnboarding to true");
});
