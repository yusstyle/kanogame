import test from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import { ConsequenceSystem } from "./consequenceSystem";
import { EconomySystem } from "./economySystem";
import type { VehicleType } from "./types";

test("ConsequenceSystem - Vehicle Condition, Collision Damage & Sluggish Handling", () => {
  const csq = new ConsequenceSystem();

  // Initial condition should be 100%
  const initialSedan = csq.getVehicleCondition("sedan");
  assert.strictEqual(initialSedan.condition, 100.0);
  assert.strictEqual(initialSedan.needsRepair, false);

  // Low speed scrape (2.0 m/s ~ 7.2 km/h)
  const scrapeRes = csq.onVehicleCollision("sedan", 2.0, false);
  assert.strictEqual(scrapeRes.cargoDamaged, false);
  assert.ok(scrapeRes.conditionLoss > 0 && scrapeRes.conditionLoss <= 3.0);
  assert.strictEqual(scrapeRes.newCondition, 100 - scrapeRes.conditionLoss);

  // Severe high speed impact (12.0 m/s ~ 43 km/h) with active delivery cargo
  const severeRes = csq.onVehicleCollision("sedan", 12.0, true);
  assert.strictEqual(severeRes.cargoDamaged, true, "Cargo should be rattled and damaged on high speed impact");
  assert.ok(severeRes.conditionLoss >= 15.0);
  assert.ok(severeRes.newCondition < 85.0);
  assert.strictEqual(csq.getVehicleCondition("sedan").needsRepair, true);

  // Additional heavy impacts to test sluggish thresholds
  csq.onVehicleCollision("sedan", 15.0, false);
  csq.onVehicleCollision("sedan", 15.0, false);
  const damagedSedan = csq.getVehicleCondition("sedan");
  assert.ok(damagedSedan.condition < 35.0, "Condition should drop into severe tier (<35%)");

  // Verify condition clamp minimum
  for (let i = 0; i < 10; i++) {
    csq.onVehicleCollision("sedan", 20.0, false);
  }
  assert.ok(csq.getVehicleCondition("sedan").condition >= 5.0, "Vehicle condition should never drop below 5% floor");
});

test("ConsequenceSystem - Arewa Heavy Repairs, Master Garba Quotation & Trade Discount", () => {
  const csq = new ConsequenceSystem();

  // Pristine vehicle needs no repair
  const pristineQuote = csq.getRepairQuote("truck");
  assert.strictEqual(pristineQuote.needsRepair, false);
  assert.strictEqual(pristineQuote.cost, 0);

  // Damage the truck
  csq.onVehicleCollision("truck", 10.0, false);
  const damagedTruck = csq.getVehicleCondition("truck");
  assert.ok(damagedTruck.condition < 80);

  // Neutral Garba quote (trust = 50, no discount)
  const neutralQuote = csq.getRepairQuote("truck");
  assert.strictEqual(neutralQuote.needsRepair, true);
  assert.ok(neutralQuote.cost > 0);
  assert.strictEqual(neutralQuote.discount, 0);
  assert.strictEqual(neutralQuote.cost, neutralQuote.originalCost);

  // Test insufficient cash rejection
  const failedRepair = csq.repairVehicle("truck", 500);
  assert.strictEqual(failedRepair.success, false);
  assert.ok(failedRepair.message.includes("Insufficient cash"));

  // Boost Garba trust to >= 65 to earn 20% trade discount
  csq.modifyNpcTrust("garba_mechanic", 25, {
    title: "Loyal Fleet Patron",
    description: "Supported Arewa Heavy Workshop consistently.",
    type: "positive",
  });
  assert.ok(csq.getNpcMemory("garba_mechanic").trust >= 65);

  const discountedQuote = csq.getRepairQuote("truck");
  assert.ok(discountedQuote.discount > 0, "Trade discount must be calculated");
  assert.strictEqual(discountedQuote.discount, Math.round(discountedQuote.originalCost * 0.20));
  assert.strictEqual(discountedQuote.cost, discountedQuote.originalCost - discountedQuote.discount);

  // Execute repair with sufficient cash
  const repairRes = csq.repairVehicle("truck", discountedQuote.cost + 10000);
  assert.strictEqual(repairRes.success, true);
  assert.strictEqual(repairRes.cost, discountedQuote.cost);
  assert.ok(repairRes.message.includes("100% condition"));
  assert.ok(repairRes.message.includes("20% Master Garba Trade Discount"));

  // Verify condition restored to 100%
  assert.strictEqual(csq.getVehicleCondition("truck").condition, 100.0);
  assert.strictEqual(csq.getVehicleCondition("truck").needsRepair, false);
});

test("ConsequenceSystem - NPC Memory, Trust Clamping & Bounded Incidents", () => {
  const csq = new ConsequenceSystem();

  // Initial trust for Chinedu is 55 (friendly merchant neighbor)
  const initialMem = csq.getNpcMemory("Chinedu Okeke");
  assert.strictEqual(initialMem.trust, 55);
  assert.strictEqual(initialMem.npcId, "chinedu_okeke");
  assert.strictEqual(initialMem.incidents.length, 0);

  // Initial trust for Garba Mechanic is 50
  assert.strictEqual(csq.getNpcMemory("garba_mechanic").trust, 50);

  // Add 8 incidents to verify bounded memory cap of 6
  for (let i = 1; i <= 8; i++) {
    csq.modifyNpcTrust("Chinedu Okeke", 5, {
      title: `Consignment Delivery #${i}`,
      description: `Smooth delivery ${i}`,
      type: "positive",
    });
  }

  const updatedMem = csq.getNpcMemory("chinedu_okeke");
  assert.strictEqual(updatedMem.incidents.length, 6, "Incidents should be bounded to max 6 entries");
  assert.strictEqual(updatedMem.incidents[0].title, "Consignment Delivery #8");

  // Trust clamp upper bound: 100
  csq.modifyNpcTrust("chinedu_okeke", 80);
  assert.strictEqual(csq.getNpcMemory("chinedu_okeke").trust, 100);

  // Trust clamp lower bound: 0
  csq.modifyNpcTrust("chinedu_okeke", -150);
  assert.strictEqual(csq.getNpcMemory("chinedu_okeke").trust, 0);
});

test("ConsequenceSystem - Dynamic Dialogue & NPC Character Reactions", () => {
  const csq = new ConsequenceSystem();
  const dummyDialogues = ["Sannu!", "Lafiya lau."];

  // Garba Mechanic - Neutral
  const garbaNeutral = csq.getNpcGreetingAndDialogue("Master Garba Mechanic", dummyDialogues, false);
  assert.strictEqual(garbaNeutral.trustStatus, "neutral");

  // Garba Mechanic - Loyal with damaged vehicle
  csq.modifyNpcTrust("garba_mechanic", 35);
  const garbaLoyal = csq.getNpcGreetingAndDialogue("Master Garba Mechanic", dummyDialogues, true);
  assert.strictEqual(garbaLoyal.trustStatus, "loyal");
  assert.strictEqual(garbaLoyal.perkOffered, "repair_discount");
  assert.ok(garbaLoyal.quote.includes("20% Master Mechanic trade discount"));

  // Habiba Mai Shayi - Loyal with free tea perk
  csq.modifyNpcTrust("Habiba Mai Shayi", 35);
  const habibaLoyal = csq.getNpcGreetingAndDialogue("Habiba Mai Shayi", dummyDialogues, false);
  assert.strictEqual(habibaLoyal.trustStatus, "loyal");
  assert.strictEqual(habibaLoyal.perkOffered, "free_tea");
  assert.ok(habibaLoyal.quote.includes("hot spiced ginger tea on the house"));

  // Chinedu Okeke - Hostile after broken cargo
  csq.modifyNpcTrust("Chinedu Okeke", -40);
  const chineduHostile = csq.getNpcGreetingAndDialogue("Chinedu Okeke", dummyDialogues, false);
  assert.strictEqual(chineduHostile.trustStatus, "hostile");
  assert.ok(chineduHostile.quote.includes("fragile like glass"));
});

test("ConsequenceSystem - Delivery Consequences: Pristine Bonus vs Cargo Damaged Penalty", () => {
  const csq = new ConsequenceSystem();
  const baseReward = 20000;

  // Case 1: Pristine delivery (zero collisions)
  csq.onMissionCargoPickup();
  const pristineResult = csq.onMissionCargoDelivery("local-delivery-electronics", "Chinedu Okeke", baseReward);
  assert.strictEqual(pristineResult.cargoDamaged, false);
  assert.strictEqual(pristineResult.bonus, 3000, "15% pristine handling bonus");
  assert.strictEqual(pristineResult.penalty, 0);
  assert.strictEqual(pristineResult.payout, 23000);
  assert.ok(pristineResult.dialogue.includes("pristine handling bonus"));
  assert.ok(csq.getNpcMemory("chinedu_okeke").trust > 55, "Trust should rise on pristine delivery");

  // Case 2: Damaged delivery (high speed impact during transit)
  csq.onMissionCargoPickup();
  csq.onVehicleCollision("van", 8.5, true); // rattles cargo
  const damagedResult = csq.onMissionCargoDelivery("local-delivery-electronics", "Chinedu Okeke", baseReward);
  assert.strictEqual(damagedResult.cargoDamaged, true);
  assert.strictEqual(damagedResult.penalty, 5000, "25% damaged goods deduction");
  assert.strictEqual(damagedResult.bonus, 0);
  assert.strictEqual(damagedResult.payout, 15000);
  assert.ok(damagedResult.dialogue.includes("deduct ₦5,000 for damaged stock"));

  // Case 3: Mission cancelled with cargo loaded
  const garbaTrustBefore = csq.getNpcMemory("garba_mechanic").trust;
  csq.onMissionCancelled("garba_mechanic", true);
  const garbaTrustAfter = csq.getNpcMemory("garba_mechanic").trust;
  assert.strictEqual(garbaTrustAfter, garbaTrustBefore - 10, "Cancelling loaded cargo contract penalizes client trust");
});

test("ConsequenceSystem - Idempotency & Duplicate Protection", () => {
  const csq = new ConsequenceSystem();

  const csqRecord = {
    id: "csq_unique_event_123",
    eventType: "unique_test_event",
    timestamp: Date.now(),
    trigger: "Test Trigger",
    entityId: "test_entity",
    stateChanges: { incidentTitle: "Unique Incident" },
    persisted: true,
    resolved: false,
  };

  // First record should succeed
  const first = csq.recordConsequence(csqRecord);
  assert.strictEqual(first, true);
  assert.strictEqual(csq.getConsequencesHistory().length, 1);

  // Second attempt with same ID should be ignored idempotently
  const duplicate = csq.recordConsequence(csqRecord);
  assert.strictEqual(duplicate, false);
  assert.strictEqual(csq.getConsequencesHistory().length, 1, "Log length must not increase on duplicate event");
});

test("ConsequenceSystem - Persistence & Save/Load Compatibility", () => {
  const csqOriginal = new ConsequenceSystem();

  // Setup non-trivial state
  csqOriginal.onVehicleCollision("sedan", 6.0, false);
  csqOriginal.modifyNpcTrust("habiba_mai_shayi", 20, {
    title: "Generous Patron",
    description: "Paid regular tips",
    type: "positive",
  });
  csqOriginal.onBusinessUpgraded("arewa-suya-franchise", 2);

  const serialized = csqOriginal.serialize();
  assert.ok(serialized.npcMemory);
  assert.ok(serialized.vehicleConditions);
  assert.ok(serialized.consequencesHistory);

  // Restore into fresh instance
  const csqRestored = new ConsequenceSystem();
  csqRestored.deserialize(serialized);

  // Check restored vehicle conditions
  assert.strictEqual(
    csqRestored.getVehicleCondition("sedan").condition,
    csqOriginal.getVehicleCondition("sedan").condition,
  );

  // Check restored NPC memory
  assert.strictEqual(
    csqRestored.getNpcMemory("habiba_mai_shayi").trust,
    csqOriginal.getNpcMemory("habiba_mai_shayi").trust,
  );
  assert.strictEqual(
    csqRestored.getNpcMemory("habiba_mai_shayi").incidents.length,
    csqOriginal.getNpcMemory("habiba_mai_shayi").incidents.length,
  );

  // Check backward compatibility with empty / legacy save data (v1/v2)
  const legacyCsq = new ConsequenceSystem();
  legacyCsq.deserialize(undefined);
  assert.strictEqual(legacyCsq.getVehicleCondition("sedan").condition, 100);
  assert.strictEqual(legacyCsq.getNpcMemory("garba_mechanic").trust, 50);

  legacyCsq.deserialize({});
  assert.strictEqual(legacyCsq.getVehicleCondition("van").condition, 100);
});

test("EconomySystem - Full Save/Load Round-Trip with Consequences Data", () => {
  const econ = new EconomySystem();
  const mockStorage: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    get length() { return Object.keys(mockStorage).length; },
  };

  const origWindow = (global as any).window;
  (global as any).window = {
    localStorage: mockLocalStorage,
  };

  try {
    const csqSys = new ConsequenceSystem();
    csqSys.onVehicleCollision("keke", 8.0, false);
    csqSys.modifyNpcTrust("garba_mechanic", 30);

    const csqPayload = csqSys.serialize();

    // Save through EconomySystem.saveToStorage
    const savedOk = econ.saveToStorage(
      75000,
      0,
      true,
      ["local-delivery-electronics"],
      22000,
      undefined,
      "clear",
      false,
      "unit-2b",
      { hunger: 90, energy: 85, hygiene: 95 },
      [],
      0,
      csqPayload,
    );
    assert.strictEqual(savedOk, true, "saveToStorage should return true");

    // Verify localStorage has persisted JSON with consequence fields
    const rawSaved = mockStorage["kano_streets_save_v1"];
    assert.ok(rawSaved, "Save key kano_streets_save_v1 should exist");
    const parsed = JSON.parse(rawSaved);
    assert.ok(parsed.consequencesHistory);
    assert.ok(parsed.vehicleConditions);
    assert.ok(parsed.npcMemory);
    assert.strictEqual(parsed.npcMemory.garba_mechanic.trust, 80);

    // Load back into EconomySystem
    const loadedData = econ.loadFromStorage();
    assert.ok(loadedData, "loadFromStorage should return SaveData");
    assert.ok(loadedData.consequencesHistory);
    assert.ok(loadedData.vehicleConditions);
    assert.ok(loadedData.npcMemory);

    // Deserialize into fresh ConsequenceSystem
    const loadedCsq = new ConsequenceSystem();
    loadedCsq.deserialize({
      npcMemory: loadedData.npcMemory,
      vehicleConditions: loadedData.vehicleConditions,
      consequencesHistory: loadedData.consequencesHistory,
    });

    assert.strictEqual(loadedCsq.getNpcMemory("garba_mechanic").trust, 80);
    assert.strictEqual(
      loadedCsq.getVehicleCondition("keke").condition,
      csqSys.getVehicleCondition("keke").condition,
    );
  } finally {
    (global as any).window = origWindow;
  }
});

