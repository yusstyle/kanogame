import assert from "node:assert/strict";
import { test } from "node:test";
import { SaveDataSchema } from "./saveValidator";

const baseSave = {
  version: 1,
  cash: 0,
  trafficFine: 0,
  hasApartmentRental: false,
  ownedProperties: [],
  ownedBusinesses: [],
  dayCount: 1,
  savedAt: 1,
};

const highwaySecurity = {
  version: 1,
  reputation: 10,
  nextIncidentNumber: 2,
  activeIncident: {
    id: "highway-incident-1",
    zoneId: "abuja-southern-expressway-outer",
    stage: "investigating",
    missingPerson: {
      id: "highway-passenger-1",
      name: "Amina Yusuf",
      role: "passenger",
    },
    lastKnownLocation: {
      cityId: "abuja",
      district: "Asokoro Hillside",
      road: "Southern Airport Expressway",
      x: 600,
      z: 450,
    },
    cluesFound: ["dropped-travel-ticket"],
    policeStatus: "unavailable",
    cooldownRemainingSeconds: 0,
  },
  incidentHistory: [],
  zoneCooldowns: {},
};

test("strict cloud save validation accepts and preserves highway security progress", () => {
  const parsed = SaveDataSchema.safeParse({
    ...baseSave,
    highwaySecurity,
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data.highwaySecurity, highwaySecurity);
  }
});

test("legacy cloud saves remain valid without highway security data", () => {
  assert.equal(SaveDataSchema.safeParse(baseSave).success, true);
});

test("highway security save validation rejects unknown nested fields", () => {
  const parsed = SaveDataSchema.safeParse({
    ...baseSave,
    highwaySecurity: {
      ...highwaySecurity,
      unexpected: true,
    },
  });

  assert.equal(parsed.success, false);
});
