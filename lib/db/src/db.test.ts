import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableName } from "drizzle-orm";
import {
  isDatabaseConfigured,
  getDatabaseUrl,
  usersTable,
  sessionsTable,
  cloudSavesTable,
  insertUserSchema,
  insertSessionSchema,
  insertCloudSaveSchema,
} from "./index";
import { runMigrations } from "./migrate";

describe("Milestone 16 Phase 1: Database Architecture & Schema Verification", () => {
  it("verifies database configuration status handles missing DATABASE_URL gracefully", () => {
    // When no DATABASE_URL is set, isDatabaseConfigured must return false without throwing
    const configured = isDatabaseConfigured();
    assert.equal(typeof configured, "boolean");
    const url = getDatabaseUrl();
    if (!configured) {
      assert.equal(url, undefined);
    }
  });

  it("verifies usersTable structure, constraints and Zod schema validation", () => {
    assert.equal(getTableName(usersTable), "users");
    assert.ok(usersTable.id);
    assert.ok(usersTable.email);
    assert.ok(usersTable.passwordHash);
    assert.ok(usersTable.displayName);
    assert.ok(usersTable.emailVerified);
    assert.ok(usersTable.createdAt);
    assert.ok(usersTable.updatedAt);

    // Validate Zod insert schema
    const parsed = insertUserSchema.parse({
      email: "player1@kanostreets.ng",
      displayName: "Musa Dan-Ladi",
    });
    assert.equal(parsed.email, "player1@kanostreets.ng");
    assert.equal(parsed.displayName, "Musa Dan-Ladi");
  });

  it("verifies sessionsTable structure and relations", () => {
    assert.equal(getTableName(sessionsTable), "sessions");
    assert.ok(sessionsTable.id);
    assert.ok(sessionsTable.userId);
    assert.ok(sessionsTable.expiresAt);
    assert.ok(sessionsTable.createdAt);
    assert.ok(sessionsTable.ipAddress);
    assert.ok(sessionsTable.userAgent);

    const testExpiry = new Date(Date.now() + 86400000);
    const parsed = insertSessionSchema.parse({
      id: "sess_test_token_hash_12345",
      userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      expiresAt: testExpiry,
    });
    assert.equal(parsed.id, "sess_test_token_hash_12345");
  });

  it("verifies cloudSavesTable structure, integrity checksum, and optimistic concurrency revision", () => {
    assert.equal(getTableName(cloudSavesTable), "cloud_saves");
    assert.ok(cloudSavesTable.id);
    assert.ok(cloudSavesTable.userId);
    assert.ok(cloudSavesTable.saveVersion);
    assert.ok(cloudSavesTable.revision);
    assert.ok(cloudSavesTable.payload);
    assert.ok(cloudSavesTable.checksum);
    assert.ok(cloudSavesTable.clientSavedAt);
    assert.ok(cloudSavesTable.createdAt);
    assert.ok(cloudSavesTable.updatedAt);

    const parsed = insertCloudSaveSchema.parse({
      userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      saveVersion: 1,
      revision: 1,
      payload: { cash: 250000, hasApartmentRental: true },
      checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      clientSavedAt: Date.now(),
    });
    assert.equal(parsed.revision, 1);
    assert.equal(parsed.saveVersion, 1);
  });

  it("verifies runMigrations reports safe status when DATABASE_URL is not provisioned", async () => {
    if (!isDatabaseConfigured()) {
      const result = await runMigrations();
      assert.equal(result.success, false);
      assert.match(result.message, /DATABASE_URL is not configured/);
    }
  });
});
