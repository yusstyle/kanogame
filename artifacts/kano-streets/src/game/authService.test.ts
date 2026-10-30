import test from "node:test";
import assert from "node:assert/strict";
import { AuthService, inspectLocalSave, type UserProfile } from "./authService";

function setupMockDOM() {
  const store = new Map<string, string>();

  const fakeLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  (globalThis as any).window = {
    localStorage: fakeLocalStorage,
  };

  return fakeLocalStorage;
}

test("inspectLocalSave detects empty localStorage as guest", () => {
  const storage = setupMockDOM();
  storage.clear();

  const summary = inspectLocalSave();
  assert.equal(summary.hasSave, false);
  assert.equal(summary.cash, 0);
  assert.equal(summary.dayCount, 1);
  assert.equal(summary.propertiesCount, 0);
  assert.equal(summary.lastSavedAt, null);
});

test("inspectLocalSave accurately summarizes valid kano_streets_save_v1 without modifying it", () => {
  const storage = setupMockDOM();
  const testSave = {
    cash: 45000,
    dayCount: 8,
    ownedProperties: ["bompai-penthouse", "albaraka-villa"],
    hasApartmentRental: true,
    savedAt: 1730000000000,
  };
  storage.setItem("kano_streets_save_v1", JSON.stringify(testSave));

  const summary = inspectLocalSave();
  assert.equal(summary.hasSave, true);
  assert.equal(summary.cash, 45000);
  assert.equal(summary.dayCount, 8);
  assert.equal(summary.propertiesCount, 3); // 2 owned + 1 apartment rental
  assert.equal(summary.lastSavedAt, 1730000000000);

  // Verify save content was completely preserved
  const reRead = JSON.parse(storage.getItem("kano_streets_save_v1")!);
  assert.deepEqual(reRead, testSave);
});

test("inspectLocalSave handles corrupted save gracefully", () => {
  const storage = setupMockDOM();
  storage.setItem("kano_streets_save_v1", "INVALID_JSON_CORRUPTED{{{");

  const summary = inspectLocalSave();
  assert.equal(summary.hasSave, false);
  assert.equal(summary.cash, 0);
});

test("AuthService subscription notifies listeners of state transitions", () => {
  setupMockDOM();
  const service = new AuthService("/api/auth");
  const notifications: any[] = [];

  const unsub = service.subscribe((s) => {
    notifications.push(s.status);
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0], "idle");

  unsub();
});

test("AuthService input validation catches invalid registration parameters client-side", async () => {
  setupMockDOM();
  const service = new AuthService("/api/auth");

  // Invalid email
  const res1 = await service.register("invalid-email", "Secret1234", "Citizen One");
  assert.equal(res1.success, false);
  assert.match(res1.error!, /valid email/i);

  // Short password
  const res2 = await service.register("valid@kanostreets.ng", "short", "Citizen One");
  assert.equal(res2.success, false);
  assert.match(res2.error!, /at least 8 characters/i);

  // Short display name
  const res3 = await service.register("valid@kanostreets.ng", "Secret1234", "X");
  assert.equal(res3.success, false);
  assert.match(res3.error!, /display name/i);
});

test("AuthService input validation catches empty login parameters", async () => {
  setupMockDOM();
  const service = new AuthService("/api/auth");

  const res = await service.login("", "");
  assert.equal(res.success, false);
  assert.match(res.error!, /both email and password/i);
});

test("AuthService initSession handles HTTP 401 as Guest Mode without throwing", async () => {
  setupMockDOM();
  const originalFetch = globalThis.fetch;

  // Mock fetch returning 401 Unauthorized
  globalThis.fetch = (async () => {
    return {
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    } as any;
  }) as any;

  try {
    const service = new AuthService("/api/auth");
    const user = await service.initSession();

    assert.equal(user, null);
    assert.equal(service.getState().status, "unauthenticated");
    assert.equal(service.getState().user, null);
    assert.equal(service.getState().error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AuthService initSession handles server outage / network failure as Guest Mode", async () => {
  setupMockDOM();
  const originalFetch = globalThis.fetch;

  // Mock fetch throwing network disconnect
  globalThis.fetch = (async () => {
    throw new Error("Failed to fetch (Connection Refused)");
  }) as any;

  try {
    const service = new AuthService("/api/auth");
    const user = await service.initSession();

    assert.equal(user, null);
    assert.equal(service.getState().status, "unauthenticated");
    assert.equal(service.getState().error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AuthService initSession succeeds when valid user session exists", async () => {
  setupMockDOM();
  const originalFetch = globalThis.fetch;

  const mockUser: UserProfile = {
    id: "user-1234",
    email: "aminu@kanostreets.ng",
    displayName: "Aminu Kano",
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };

  globalThis.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ user: mockUser }),
    } as any;
  }) as any;

  try {
    const service = new AuthService("/api/auth");
    const user = await service.initSession();

    assert.deepEqual(user, mockUser);
    assert.equal(service.getState().status, "authenticated");
    assert.equal(service.getState().user?.displayName, "Aminu Kano");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AuthService login and logout updates state and strictly preserves local save data", async () => {
  const storage = setupMockDOM();
  const testSaveData = { cash: 99999, dayCount: 20, ownedProperties: ["unit-2b"] };
  storage.setItem("kano_streets_save_v1", JSON.stringify(testSaveData));

  const originalFetch = globalThis.fetch;

  const mockUser: UserProfile = {
    id: "user-5678",
    email: "fatima@kanostreets.ng",
    displayName: "Fatima Balarabe",
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };

  // Mock login success
  globalThis.fetch = (async (url: string) => {
    if (url.includes("/login")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser }),
      } as any;
    }
    if (url.includes("/logout")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any;
    }
    return { ok: false, status: 404 } as any;
  }) as any;

  try {
    const service = new AuthService("/api/auth");
    const loginRes = await service.login("fatima@kanostreets.ng", "ValidPass123");

    assert.equal(loginRes.success, true);
    assert.equal(service.getState().status, "authenticated");
    assert.equal(service.getState().user?.displayName, "Fatima Balarabe");

    // Perform logout
    const logoutRes = await service.logout();
    assert.equal(logoutRes.success, true);
    assert.equal(service.getState().status, "unauthenticated");
    assert.equal(service.getState().user, null);

    // Verify local device save was NOT wiped or touched
    const preservedSave = JSON.parse(storage.getItem("kano_streets_save_v1")!);
    assert.deepEqual(preservedSave, testSaveData);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

