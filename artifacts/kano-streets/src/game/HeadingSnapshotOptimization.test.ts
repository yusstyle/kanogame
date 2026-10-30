import assert from "node:assert/strict";
import { test } from "node:test";
import { isHeadingEquivalent } from "./navigation";
import type { GameSnapshot } from "./types";

test("Stage 4: isHeadingEquivalent Angular Equivalence & Wraparound", () => {
  // 1. Exact equality
  assert.equal(isHeadingEquivalent(0, 0), true);
  assert.equal(isHeadingEquivalent(1.25, 1.25), true);
  assert.equal(isHeadingEquivalent(undefined, undefined), true);
  assert.equal(isHeadingEquivalent(1.0, undefined), false);

  // 2. Micro variations below 0.035 rad (~2 degrees)
  assert.equal(isHeadingEquivalent(1.000, 1.015, 0.035), true, "Delta 0.015 rad is treated as equivalent");
  assert.equal(isHeadingEquivalent(2.500, 2.530, 0.035), true, "Delta 0.030 rad is treated as equivalent");

  // 3. Meaningful turns above threshold
  assert.equal(isHeadingEquivalent(1.000, 1.050, 0.035), false, "Delta 0.050 rad is a meaningful turn");
  assert.equal(isHeadingEquivalent(0, Math.PI / 4, 0.035), false, "45-degree turn triggers update");

  // 4. Modular wraparound across -PI and +PI boundary
  const nearPosPi = Math.PI - 0.01;
  const nearNegPi = -Math.PI + 0.01;
  assert.equal(
    isHeadingEquivalent(nearPosPi, nearNegPi, 0.035),
    true,
    "Wraparound across -PI / +PI boundary is equivalent",
  );

  // 5. Modular wraparound across 0 and 2*PI boundary
  const nearZero = 0.01;
  const nearTwoPi = Math.PI * 2 - 0.01;
  assert.equal(
    isHeadingEquivalent(nearZero, nearTwoPi, 0.035),
    true,
    "Wraparound across 0 / 2*PI boundary is equivalent",
  );
});

test("Stage 4: Unchanged Snapshot Suppression Logic", () => {
  const baseSnapshot: GameSnapshot = {
    mode: "on-foot",
    location: "SABON GARI",
    speedKmh: 0,
    interactionPrompt: null,
    statusMessage: null,
    vehicleType: null,
    cash: 50000,
    trafficFine: 0,
    hasApartmentRental: false,
    playerCoords: { x: 10.0, z: 20.0 },
    playerHeading: 1.50,
  };

  // Replicating App.tsx receiveSnapshot equality checker
  function shouldPreserveSnapshot(current: GameSnapshot, next: GameSnapshot): boolean {
    return (
      current.mode === next.mode &&
      current.location === next.location &&
      current.speedKmh === next.speedKmh &&
      current.interactionPrompt === next.interactionPrompt &&
      current.statusMessage === next.statusMessage &&
      current.vehicleType === next.vehicleType &&
      current.cash === next.cash &&
      current.trafficFine === next.trafficFine &&
      current.hasApartmentRental === next.hasApartmentRental &&
      current.playerCoords?.x === next.playerCoords?.x &&
      current.playerCoords?.z === next.playerCoords?.z &&
      isHeadingEquivalent(current.playerHeading, next.playerHeading, 0.035)
    );
  }

  // 1. Snapshot with tiny heading jitter (delta = 0.01 rad)
  const jitterSnapshot: GameSnapshot = {
    ...baseSnapshot,
    playerHeading: 1.51,
  };
  assert.equal(
    shouldPreserveSnapshot(baseSnapshot, jitterSnapshot),
    true,
    "Suppresses re-render on micro heading jitter (preserves current reference)",
  );

  // 2. Snapshot with meaningful heading change (delta = 0.2 rad)
  const turnedSnapshot: GameSnapshot = {
    ...baseSnapshot,
    playerHeading: 1.70,
  };
  assert.equal(
    shouldPreserveSnapshot(baseSnapshot, turnedSnapshot),
    false,
    "Emits new snapshot when player makes a deliberate turn",
  );

  // 3. Snapshot with coordinate change (moving 0.2m)
  const movedSnapshot: GameSnapshot = {
    ...baseSnapshot,
    playerCoords: { x: 10.2, z: 20.0 },
  };
  assert.equal(
    shouldPreserveSnapshot(baseSnapshot, movedSnapshot),
    false,
    "Emits new snapshot when player coordinates change",
  );

  // 4. Snapshot with cash change
  const cashSnapshot: GameSnapshot = {
    ...baseSnapshot,
    cash: 70000,
  };
  assert.equal(
    shouldPreserveSnapshot(baseSnapshot, cashSnapshot),
    false,
    "Emits new snapshot when cash balance changes",
  );
});

