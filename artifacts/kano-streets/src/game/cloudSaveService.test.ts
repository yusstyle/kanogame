import test from "node:test";
import assert from "node:assert/strict";
import {
  CloudSaveService,
  createLocalRecoveryBackup,
  readParsedLocalSave,
  type CloudSaveRecord,
} from "./cloudSaveService";
import { authService, type UserProfile } from "./authService";
import type { SaveData } from "./economySystem";

function setupMockDOM() {
  const store = new Map<string, string>();

  const fakeLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get _store() {
      return store;
    },
  };

  (globalThis as any).window = {
    localStorage: fakeLocalStorage,
  };

  return fakeLocalStorage;
}

const mockSaveData: SaveData = {
  version: 1,
  cash: 85000,
  premiumCoins: 250,
  trafficFine: 0,
  hasApartmentRental: true,
  ownedProperties: ["unit-2b"],
  ownedBusinesses: ["sabon-gari-shop"],
  dayCount: 7,
  vehicleUpgrade: { engineStage: 1, paintColor: "#334155", suspensionUpgraded: false },
  savedAt: 1730000000000,
};

const mockCloudRecord: CloudSaveRecord = {
  id: "cs-1234",
  userId: "user-abcd",
  saveVersion: 1,
  revision: 2,
  payload: mockSaveData,
  checksum: "abc123def456",
  clientSavedAt: 1730000000000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test("createLocalRecoveryBackup creates timestamped recovery copy and preserves backup key", () => {
  const storage = setupMockDOM();
  storage.setItem("kano_streets_save_v1", JSON.stringify(mockSaveData));

  const res = createLocalRecoveryBackup();
  assert.equal(res.success, true);
  assert.ok(res.recoveryKey?.startsWith("kano_streets_save_v1_recovery_"));

  // Verify kano_streets_save_v1_backup was created
  const standardBackup = storage.getItem("kano_streets_save_v1_backup");
  assert.ok(standardBackup);
  assert.deepEqual(JSON.parse(standardBackup!), mockSaveData);

  // Verify timestamped recovery backup exists
  const recoveryBackup = storage.getItem(res.recoveryKey!);
  assert.ok(recoveryBackup);
  assert.deepEqual(JSON.parse(recoveryBackup!), mockSaveData);

  // Verify primary save was not altered
  assert.deepEqual(readParsedLocalSave(), mockSaveData);
});

test("Pre-existing kano_streets_save_v1_backup remains byte-for-byte unchanged", () => {
  const storage = setupMockDOM();
  const preExistingBackup = JSON.stringify({ ...mockSaveData, cash: 12345, dayCount: 1 });
  storage.setItem("kano_streets_save_v1_backup", preExistingBackup);

  const currentLocal = { ...mockSaveData, cash: 99999, dayCount: 15 };
  storage.setItem("kano_streets_save_v1", JSON.stringify(currentLocal));

  const res = createLocalRecoveryBackup();
  assert.equal(res.success, true);

  // Verify pre-existing backup was NOT overwritten
  assert.equal(storage.getItem("kano_streets_save_v1_backup"), preExistingBackup);
  // Verify new timestamped copy was written with currentLocal
  assert.deepEqual(JSON.parse(storage.getItem(res.recoveryKey!)!), currentLocal);
});

test("Recovery backup failure aborts resolution and prevents local save overwrite", async () => {
  const storage = setupMockDOM();
  const localData = { ...mockSaveData, cash: 33333 };
  storage.setItem("kano_streets_save_v1", JSON.stringify(localData));

  const serverRecord: CloudSaveRecord = {
    ...mockCloudRecord,
    revision: 6,
    payload: { ...mockSaveData, cash: 999999 },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.includes("/resolve-conflict")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ save: serverRecord }),
      } as any;
    }
    return { ok: false, status: 404 } as any;
  }) as any;

  // Make setItem throw (e.g. QuotaExceededError when creating backup)
  const originalSetItem = storage.setItem;
  storage.setItem = (key: string, val: string) => {
    if (key.includes("recovery")) {
      throw new Error("QuotaExceededError: storage is full");
    }
    originalSetItem(key, val);
  };

  try {
    const service = new CloudSaveService("/api/saves");
    (service as any).state = {
      status: "conflict",
      currentRevision: 6,
      cloudSave: serverRecord,
      comparison: { localSave: localData, cloudSave: serverRecord },
      error: null,
    };

    const res = await service.resolveConflict("keep_cloud");
    assert.equal(res.success, false, "Must return failure when recovery backup fails");
    assert.match(res.error!, /safety recovery backup/i);

    // CRITICAL: Local save MUST remain completely unchanged
    const preservedLocal = JSON.parse(storage.getItem("kano_streets_save_v1")!);
    assert.equal(preservedLocal.cash, 33333, "Local save must not be overwritten when backup fails");
  } finally {
    globalThis.fetch = originalFetch;
    storage.setItem = originalSetItem;
  }
});

test("Replacement fails and the original save is successfully restored", async () => {
  const storage = setupMockDOM();
  const localData = { ...mockSaveData, cash: 44444 };
  storage.setItem("kano_streets_save_v1", JSON.stringify(localData));

  const serverRecord: CloudSaveRecord = {
    ...mockCloudRecord,
    revision: 7,
    payload: { ...mockSaveData, cash: 888888 },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.includes("/resolve-conflict")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ save: serverRecord }),
      } as any;
    }
    return { ok: false, status: 404 } as any;
  }) as any;

  // Cloud replacement fails, but rollback with original localData succeeds
  const originalSetItem = storage.setItem;
  storage.setItem = (key: string, val: string) => {
    if (key === "kano_streets_save_v1" && val.includes("888888")) {
      throw new Error("Disk write error during replacement");
    }
    originalSetItem(key, val);
  };

  try {
    const service = new CloudSaveService("/api/saves");
    (service as any).state = {
      status: "conflict",
      currentRevision: 7,
      cloudSave: serverRecord,
      comparison: { localSave: localData, cloudSave: serverRecord },
      error: null,
    };

    const res = await service.resolveConflict("keep_cloud");
    assert.equal(res.success, false, "Must report failure if replacement write fails");
    assert.match(res.error!, /Original local save was successfully restored and verified/i);

    // Verify local save was actually restored to original localData
    const restored = JSON.parse(storage.getItem("kano_streets_save_v1")!);
    assert.equal(restored.cash, 44444, "Original local save must be restored after rollback");
  } finally {
    globalThis.fetch = originalFetch;
    storage.setItem = originalSetItem;
  }
});

test("Replacement and rollback both fail, with an honest error result", async () => {
  const storage = setupMockDOM();
  const localData = { ...mockSaveData, cash: 55555 };
  storage.setItem("kano_streets_save_v1", JSON.stringify(localData));

  const serverRecord: CloudSaveRecord = {
    ...mockCloudRecord,
    revision: 8,
    payload: { ...mockSaveData, cash: 999999 },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.includes("/resolve-conflict")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ save: serverRecord }),
      } as any;
    }
    return { ok: false, status: 404 } as any;
  }) as any;

  // All writes to kano_streets_save_v1 fail (replacement AND rollback)
  const originalSetItem = storage.setItem;
  storage.setItem = (key: string, val: string) => {
    if (key === "kano_streets_save_v1") {
      throw new Error("Persistent storage hardware error");
    }
    originalSetItem(key, val);
  };

  try {
    const service = new CloudSaveService("/api/saves");
    (service as any).state = {
      status: "conflict",
      currentRevision: 8,
      cloudSave: serverRecord,
      comparison: { localSave: localData, cloudSave: serverRecord },
      error: null,
    };

    const res = await service.resolveConflict("keep_cloud");
    assert.equal(res.success, false, "Must report failure if both fail");
    assert.match(res.error!, /rollback restoration also failed/i);
    assert.match(res.error!, /require recovery from the recovery key/i);
    assert.match(res.error!, /kano_streets_save_v1_recovery_/i);

    // Verify error does NOT claim original save was restored
    assert.doesNotMatch(res.error!, /successfully restored and verified/i);
    assert.doesNotMatch(res.error!, /Existing local save was preserved/i);
  } finally {
    globalThis.fetch = originalFetch;
    storage.setItem = originalSetItem;
  }
});

test("CloudSaveService reset wipes in-memory cloud data to prevent cross-account leakage", () => {
  setupMockDOM();
  const service = new CloudSaveService("/api/saves");

  (service as any).state = {
    status: "synced",
    lastSyncTime: Date.now(),
    currentRevision: 5,
    cloudSave: mockCloudRecord,
    comparison: { localSave: mockSaveData, cloudSave: mockCloudRecord },
    error: null,
  };

  service.reset();

  const state = service.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.currentRevision, null);
  assert.equal(state.cloudSave, null);
  assert.equal(state.comparison, null);
});

test("CloudSaveService syncOnAuth handles offline/network error without failing gameplay", async () => {
  const storage = setupMockDOM();
  storage.setItem("kano_streets_save_v1", JSON.stringify(mockSaveData));

  const mockUser: UserProfile = {
    id: "user-111",
    email: "offline@kanostreets.ng",
    displayName: "Offline Player",
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };
  (authService as any).state = {
    user: mockUser,
    status: "authenticated",
    error: null,
    localProgress: { hasSave: true, cash: 85000, dayCount: 7, propertiesCount: 1, lastSavedAt: 1730000000000 },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("Network unreachable");
  }) as any;

  try {
    const service = new CloudSaveService("/api/saves");
    await service.syncOnAuth();

    assert.equal(service.getState().status, "offline");
    assert.deepEqual(readParsedLocalSave(), mockSaveData);
  } finally {
    globalThis.fetch = originalFetch;
    authService.logout();
  }
});

test("CloudSaveService detects cloud/local differences as conflict", async () => {
  const storage = setupMockDOM();
  const localData = { ...mockSaveData, cash: 120000, dayCount: 12 };
  storage.setItem("kano_streets_save_v1", JSON.stringify(localData));

  const mockUser: UserProfile = {
    id: "user-222",
    email: "conflict@kanostreets.ng",
    displayName: "Conflict Player",
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };
  (authService as any).state = {
    user: mockUser,
    status: "authenticated",
    error: null,
    localProgress: { hasSave: true, cash: 120000, dayCount: 12, propertiesCount: 1, lastSavedAt: 1730000000000 },
  };

  const serverRecord: CloudSaveRecord = {
    ...mockCloudRecord,
    revision: 3,
    payload: { ...mockSaveData, cash: 40000, dayCount: 4 },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ save: serverRecord }),
    } as any;
  }) as any;

  try {
    const service = new CloudSaveService("/api/saves");
    await service.syncOnAuth();

    assert.equal(service.getState().status, "conflict");
    assert.ok(service.getState().comparison);
    assert.equal(service.getState().comparison?.localSave.cash, 120000);
    assert.equal(service.getState().comparison?.cloudSave.payload.cash, 40000);
  } finally {
    globalThis.fetch = originalFetch;
    authService.logout();
  }
});

test("CloudSaveService resolveConflict with keep_cloud safely backs up local save before writing", async () => {
  const storage = setupMockDOM();
  const localData = { ...mockSaveData, cash: 15000 };
  storage.setItem("kano_streets_save_v1", JSON.stringify(localData));

  const serverRecord: CloudSaveRecord = {
    ...mockCloudRecord,
    revision: 5,
    payload: { ...mockSaveData, cash: 200000, dayCount: 20 },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (url.includes("/resolve-conflict")) {
      const body = JSON.parse(init?.body as string);
      assert.equal(body.resolution, "keep_cloud");
      assert.equal(body.baseRevision, 5);
      return {
        ok: true,
        status: 200,
        json: async () => ({ save: serverRecord }),
      } as any;
    }
    return { ok: false, status: 404 } as any;
  }) as any;

  try {
    const service = new CloudSaveService("/api/saves");
    (service as any).state = {
      status: "conflict",
      currentRevision: 5,
      cloudSave: serverRecord,
      comparison: { localSave: localData, cloudSave: serverRecord },
      error: null,
    };

    const res = await service.resolveConflict("keep_cloud");
    assert.equal(res.success, true);
    assert.equal(service.getState().status, "synced");

    // Verify recovery backup was written
    const backup = storage.getItem("kano_streets_save_v1_backup");
    assert.ok(backup);
    assert.equal(JSON.parse(backup!).cash, 15000);

    // Verify local save now holds the restored cloud data
    const localUpdated = readParsedLocalSave();
    assert.equal(localUpdated?.cash, 200000);
    assert.equal(localUpdated?.dayCount, 20);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
