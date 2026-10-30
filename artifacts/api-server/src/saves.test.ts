import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "./app";
import { db, usersTable, cloudSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AddressInfo } from "node:net";
import { ALLOWED_VEHICLES, ALLOWED_WEATHER } from "./lib/saveValidator";

describe("Milestone 16 Phase 4: Secure Cloud Save API & Concurrency Tests", () => {
  let server: http.Server;
  let baseUrl: string;

  let userAEmail = `user_a_${Date.now()}@kanostreets.ng`;
  let userBEmail = `user_b_${Date.now()}@kanostreets.ng`;
  let userCEmail = `user_c_${Date.now()}@kanostreets.ng`;
  let userACookie: string;
  let userBCookie: string;
  let userCCookie: string;

  const validPayload = {
    version: 1,
    cash: 50000,
    premiumCoins: 250,
    trafficFine: 0,
    hasApartmentRental: true,
    ownedProperties: ["unit-2b"],
    ownedBusinesses: ["sabon-gari-shop"],
    businessLevels: { "sabon-gari-shop": 2 },
    propertyRenovations: { "unit-2b": 1 },
    ownedVehicles: ["veh_sedan"],
    unlockedVehicleSkins: ["skin_sedan_stock"],
    dayCount: 5,
    vehicleUpgrade: { engineStage: 1, paintColor: "#334155", suspensionUpgraded: false },
    savedAt: 1730000000000,
  };

  before(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Register User A
    const regARes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: userAEmail,
        password: "Password123!",
        displayName: "Citizen Alpha",
      }),
    });
    assert.equal(regARes.status, 201);
    const setCookieA = regARes.headers.get("set-cookie");
    assert.ok(setCookieA);
    userACookie = setCookieA.split(";")[0];

    // Register User B
    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: userBEmail,
        password: "Password123!",
        displayName: "Citizen Beta",
      }),
    });
    assert.equal(regBRes.status, 201);
    const setCookieB = regBRes.headers.get("set-cookie");
    assert.ok(setCookieB);
    userBCookie = setCookieB.split(";")[0];

    // Register User C (Dedicated for vehicle & weather validation tests)
    const regCRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: userCEmail,
        password: "Password123!",
        displayName: "Citizen Gamma",
      }),
    });
    assert.equal(regCRes.status, 201);
    const setCookieC = regCRes.headers.get("set-cookie");
    assert.ok(setCookieC);
    userCCookie = setCookieC.split(";")[0];
  });

  after(async () => {
    // Cleanup test users and their cascade-deleted saves
    try {
      await db.delete(usersTable).where(eq(usersTable.email, userAEmail));
      await db.delete(usersTable).where(eq(usersTable.email, userBEmail));
      await db.delete(usersTable).where(eq(usersTable.email, userCEmail));
    } catch {}

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("1. Authentication & Cross-Account Isolation", () => {
    it("GET /api/saves returns 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/saves`);
      assert.equal(res.status, 401);
    });

    it("PUT /api/saves returns 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedRevision: 0,
          clientSavedAt: Date.now(),
          payload: validPayload,
        }),
      });
      assert.equal(res.status, 401);
    });

    it("GET /api/saves returns 404 for User A before save creation", async () => {
      const res = await fetch(`${baseUrl}/api/saves`, {
        headers: { cookie: userACookie },
      });
      assert.equal(res.status, 404);
    });
  });

  describe("2. First-Time Save Creation & Revision Concurrency", () => {
    it("PUT /api/saves with expectedRevision: 0 creates Revision 1", async () => {
      const res = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          expectedRevision: 0,
          clientSavedAt: validPayload.savedAt,
          payload: validPayload,
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.save.revision, 1);
      assert.equal(data.save.payload.cash, 50000);
      assert.ok(data.save.checksum);
    });

    it("Subsequent PUT with expectedRevision: 0 returns 409 Conflict (Prevents duplicate race)", async () => {
      const res = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          expectedRevision: 0,
          clientSavedAt: Date.now(),
          payload: validPayload,
        }),
      });

      assert.equal(res.status, 409);
      const data = (await res.json()) as any;
      assert.equal(data.error, "CONFLICT");
      assert.equal(data.currentRevision, 1);
    });

    it("PUT with expectedRevision: 1 successfully updates to Revision 2", async () => {
      const updatedPayload = { ...validPayload, cash: 75000, dayCount: 6, savedAt: Date.now() };

      const res = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          expectedRevision: 1,
          clientSavedAt: updatedPayload.savedAt,
          payload: updatedPayload,
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.save.revision, 2);
      assert.equal(data.save.payload.cash, 75000);
    });

    it("Concurrent updates with stale revision return 409 Conflict", async () => {
      const payloadDevice1 = { ...validPayload, cash: 80000, savedAt: Date.now() };
      const payloadDevice2 = { ...validPayload, cash: 90000, savedAt: Date.now() };

      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/saves`, {
          method: "PUT",
          headers: { "content-type": "application/json", cookie: userACookie },
          body: JSON.stringify({
            expectedRevision: 2,
            clientSavedAt: payloadDevice1.savedAt,
            payload: payloadDevice1,
          }),
        }),
        fetch(`${baseUrl}/api/saves`, {
          method: "PUT",
          headers: { "content-type": "application/json", cookie: userACookie },
          body: JSON.stringify({
            expectedRevision: 2,
            clientSavedAt: payloadDevice2.savedAt,
            payload: payloadDevice2,
          }),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      assert.deepEqual(statuses, [200, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      const conflictBody = (await conflictRes.json()) as any;
      assert.equal(conflictBody.error, "CONFLICT");
      assert.equal(conflictBody.currentRevision, 3);
    });
  });

  describe("3. Data Validation & Boundary Limits", () => {
    it("Rejects negative cash balance with 400", async () => {
      const res = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          expectedRevision: 3,
          clientSavedAt: Date.now(),
          payload: { ...validPayload, cash: -500 },
        }),
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as any;
      assert.match(data.message, /cash/i);
    });

    it("Rejects invalid property IDs with 400", async () => {
      const res = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          expectedRevision: 3,
          clientSavedAt: Date.now(),
          payload: { ...validPayload, ownedProperties: ["unauthorized-palace"] },
        }),
      });

      assert.equal(res.status, 400);
    });

    it("Rejects duplicate property IDs with 400", async () => {
      const res = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          expectedRevision: 3,
          clientSavedAt: Date.now(),
          payload: { ...validPayload, ownedProperties: ["unit-2b", "unit-2b"] },
        }),
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as any;
      assert.match(data.message, /duplicate property/i);
    });

    it("Rejects prototype pollution attempt with 400", async () => {
      const dirtyPayload = JSON.parse('{"__proto__":{"polluted":true},"version":1,"cash":100}');
      const res = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          expectedRevision: 3,
          clientSavedAt: Date.now(),
          payload: dirtyPayload,
        }),
      });

      assert.equal(res.status, 400);
    });
  });

  describe("4. Cross-User Save Isolation", () => {
    it("User B cannot access or overwrite User A's cloud save", async () => {
      // User B initially has 404
      const getBRes = await fetch(`${baseUrl}/api/saves`, {
        headers: { cookie: userBCookie },
      });
      assert.equal(getBRes.status, 404);

      // User B creates their own save
      const userBPayload = { ...validPayload, cash: 12000, dayCount: 2 };
      const putBRes = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userBCookie },
        body: JSON.stringify({
          expectedRevision: 0,
          clientSavedAt: Date.now(),
          payload: userBPayload,
        }),
      });
      assert.equal(putBRes.status, 201);
      const bData = (await putBRes.json()) as any;
      assert.equal(bData.save.revision, 1);
      assert.equal(bData.save.payload.cash, 12000);

      // Verify User A's save is completely untouched (still at revision 3)
      const getARes = await fetch(`${baseUrl}/api/saves`, {
        headers: { cookie: userACookie },
      });
      assert.equal(getARes.status, 200);
      const aData = (await getARes.json()) as any;
      assert.equal(aData.save.revision, 3);
    });
  });

  describe("5. Conflict Resolution Endpoint", () => {
    it("POST /api/saves/resolve-conflict rejects stale baseRevision with 409", async () => {
      const res = await fetch(`${baseUrl}/api/saves/resolve-conflict`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          resolution: "keep_local",
          baseRevision: 1, // Server is at revision 3
          payload: { ...validPayload, cash: 99000 },
        }),
      });

      assert.equal(res.status, 409);
      const data = (await res.json()) as any;
      assert.equal(data.currentRevision, 3);
    });

    it("POST /api/saves/resolve-conflict with keep_local forces update to Revision 4", async () => {
      const overridePayload = { ...validPayload, cash: 150000, dayCount: 10, savedAt: Date.now() };

      const res = await fetch(`${baseUrl}/api/saves/resolve-conflict`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          resolution: "keep_local",
          baseRevision: 3,
          payload: overridePayload,
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.save.revision, 4);
      assert.equal(data.save.payload.cash, 150000);
    });

    it("POST /api/saves/resolve-conflict with keep_cloud returns authoritative server save", async () => {
      const res = await fetch(`${baseUrl}/api/saves/resolve-conflict`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: userACookie },
        body: JSON.stringify({
          resolution: "keep_cloud",
          baseRevision: 4,
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.save.revision, 4);
      assert.equal(data.save.payload.cash, 150000);
    });
  });

  describe("6. Vehicle & Weather Identifiers Strict Validation", () => {
    it("Accepts valid catalog vehicles and rejects unknown or duplicate vehicle IDs", async () => {
      // 1. Accepts all allowed catalog vehicle IDs
      assert.deepEqual(ALLOWED_VEHICLES, [
        "veh_sedan",
        "veh_keke",
        "veh_van",
        "veh_pickup",
        "veh_minibus",
        "veh_truck",
      ]);

      const resValidFleet = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userCCookie },
        body: JSON.stringify({
          expectedRevision: 0,
          clientSavedAt: Date.now(),
          payload: { ...validPayload, ownedVehicles: Array.from(ALLOWED_VEHICLES) },
        }),
      });
      assert.equal(resValidFleet.status, 201, "All valid catalog vehicles must be accepted");

      // 2. Rejects unknown vehicle ID
      const resUnknownVeh = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userCCookie },
        body: JSON.stringify({
          expectedRevision: 1,
          clientSavedAt: Date.now(),
          payload: { ...validPayload, ownedVehicles: ["veh_sedan", "veh_unknown_hypercar"] },
        }),
      });
      assert.equal(resUnknownVeh.status, 400, "Unknown vehicle ID must be rejected with 400");
      const errUnknown = (await resUnknownVeh.json()) as any;
      assert.match(errUnknown.message, /ownedVehicles/i);

      // 3. Rejects duplicate vehicle IDs
      const resDupVeh = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userCCookie },
        body: JSON.stringify({
          expectedRevision: 1,
          clientSavedAt: Date.now(),
          payload: { ...validPayload, ownedVehicles: ["veh_sedan", "veh_sedan"] },
        }),
      });
      assert.equal(resDupVeh.status, 400, "Duplicate vehicle IDs must be rejected with 400");
      const errDup = (await resDupVeh.json()) as any;
      assert.match(errDup.message, /duplicate vehicle/i);
    });

    it("Accepts all 4 game weather presets and rejects invalid weather presets", async () => {
      assert.deepEqual(ALLOWED_WEATHER, ["clear", "harmattan", "sunset_glow", "cool_night"]);

      // Verify each preset
      let curRev = 1;
      for (const preset of ALLOWED_WEATHER) {
        const res = await fetch(`${baseUrl}/api/saves`, {
          method: "PUT",
          headers: { "content-type": "application/json", cookie: userCCookie },
          body: JSON.stringify({
            expectedRevision: curRev,
            clientSavedAt: Date.now(),
            payload: { ...validPayload, weatherPreset: preset },
          }),
        });
        assert.equal(res.status, 200, `Weather preset '${preset}' must be accepted`);
        curRev++;
      }

      // Rejects invalid weather preset
      const resInvalid = await fetch(`${baseUrl}/api/saves`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: userCCookie },
        body: JSON.stringify({
          expectedRevision: curRev,
          clientSavedAt: Date.now(),
          payload: { ...validPayload, weatherPreset: "monsoon_flood" },
        }),
      });
      assert.equal(resInvalid.status, 400, "Invalid weather preset must be rejected with 400");
      const errInvalid = (await resInvalid.json()) as any;
      assert.match(errInvalid.message, /weatherPreset/i);
    });
  });
});
