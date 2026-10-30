import type { SaveData } from "./economySystem";
import { authService, type UserProfile } from "./authService";

export interface CloudSaveRecord {
  id: string;
  userId: string;
  saveVersion: number;
  revision: number;
  payload: SaveData;
  checksum: string;
  clientSavedAt: number | null;
  createdAt: string;
  updatedAt: string;
}

export type CloudSyncStatus =
  | "idle"
  | "checking"
  | "synced"
  | "uploading"
  | "conflict"
  | "offline"
  | "error";

export interface CloudSaveComparison {
  localSave: SaveData;
  cloudSave: CloudSaveRecord;
}

export interface CloudSaveState {
  status: CloudSyncStatus;
  lastSyncTime: number | null;
  currentRevision: number | null;
  cloudSave: CloudSaveRecord | null;
  comparison: CloudSaveComparison | null;
  error: string | null;
}

export function readRawLocalSave(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem("kano_streets_save_v1");
  } catch {
    return null;
  }
}

export function readParsedLocalSave(): SaveData | null {
  const raw = readRawLocalSave();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

/**
 * Creates a non-destructive recovery backup before any operation that overwrites local device save.
 * Preserves the existing kano_streets_save_v1_backup key and creates a timestamped recovery copy.
 */
export function createLocalRecoveryBackup(): { success: boolean; recoveryKey?: string; error?: string } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { success: false, error: "localStorage is not available" };
  }
  try {
    const raw = window.localStorage.getItem("kano_streets_save_v1");
    if (!raw) return { success: true }; // Nothing to back up

    // 1. Preserve existing standard backup key if not set (never overwrite pre-existing backup)
    if (!window.localStorage.getItem("kano_streets_save_v1_backup")) {
      window.localStorage.setItem("kano_streets_save_v1_backup", raw);
    }

    // 2. Always create a timestamped recovery copy
    const recoveryKey = `kano_streets_save_v1_recovery_${Date.now()}`;
    window.localStorage.setItem(recoveryKey, raw);

    // 3. Verify recovery backup was written successfully
    const verified = window.localStorage.getItem(recoveryKey);
    if (!verified || verified !== raw) {
      return { success: false, error: "Failed to verify written recovery backup" };
    }

    return { success: true, recoveryKey };
  } catch (err: any) {
    return { success: false, error: err?.message || "Storage error during backup" };
  }
}

export class CloudSaveService {
  private state: CloudSaveState = {
    status: "idle",
    lastSyncTime: null,
    currentRevision: null,
    cloudSave: null,
    comparison: null,
    error: null,
  };

  private listeners: Set<(state: CloudSaveState) => void> = new Set();
  private baseUrl: string = "/api/saves";

  constructor(customBaseUrl?: string) {
    if (customBaseUrl) {
      this.baseUrl = customBaseUrl.replace(/\/+$/, "");
    }
  }

  public getState(): CloudSaveState {
    return { ...this.state };
  }

  public subscribe(listener: (state: CloudSaveState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = this.getState();
    this.listeners.forEach((l) => l(snapshot));
  }

  /**
   * Resets cloud state when logging out or switching accounts.
   * Guarantees that User A's cloud data is never visible to User B.
   */
  public reset() {
    this.state = {
      status: "idle",
      lastSyncTime: null,
      currentRevision: null,
      cloudSave: null,
      comparison: null,
      error: null,
    };
    this.notify();
  }

  /**
   * Fetches latest cloud save for the authenticated player.
   */
  public async fetchCloudSave(): Promise<{ success: boolean; save?: CloudSaveRecord; notFound?: boolean; error?: string }> {
    try {
      const res = await fetch(this.baseUrl, {
        method: "GET",
        headers: { accept: "application/json" },
        credentials: "include",
      });

      if (res.status === 404) {
        return { success: false, notFound: true };
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.message || "Failed to fetch cloud save" };
      }

      const data = await res.json();
      return { success: true, save: data.save };
    } catch {
      return { success: false, error: "Network offline or unreachable" };
    }
  }

  /**
   * Initiates synchronization check upon player authentication or online reconnect.
   */
  public async syncOnAuth(): Promise<void> {
    const auth = authService.getState();
    if (auth.status !== "authenticated" || !auth.user) {
      this.reset();
      return;
    }

    this.state.status = "checking";
    this.state.error = null;
    this.notify();

    const localSave = readParsedLocalSave();
    const fetchRes = await this.fetchCloudSave();

    if (!fetchRes.success && !fetchRes.notFound) {
      // Network outage or server error defaults safely to offline mode without interrupting gameplay
      this.state.status = "offline";
      this.state.error = fetchRes.error || "Unable to reach cloud servers.";
      this.notify();
      return;
    }

    // Case 1: No cloud save exists yet
    if (fetchRes.notFound) {
      if (localSave) {
        // Automatically upload local progress as initial revision 1
        await this.uploadLocalSave(0, localSave);
      } else {
        // Both local and cloud are empty: synced
        this.state.status = "synced";
        this.notify();
      }
      return;
    }

    const cloud = fetchRes.save!;
    this.state.cloudSave = cloud;
    this.state.currentRevision = cloud.revision;

    // Case 2: Cloud save exists, but local save is empty
    if (!localSave) {
      try {
        window.localStorage.setItem("kano_streets_save_v1", JSON.stringify(cloud.payload));
      } catch (err: any) {
        this.state.status = "error";
        this.state.error = `Failed to write initial cloud save: ${err?.message || "Storage error"}`;
        this.notify();
        return;
      }
      this.state.status = "synced";
      this.state.lastSyncTime = Date.now();
      this.notify();
      return;
    }

    // Case 3: Both exist — detect whether data matches or conflicts
    const isIdentical =
      localSave.cash === cloud.payload.cash &&
      localSave.dayCount === cloud.payload.dayCount &&
      JSON.stringify(localSave.ownedProperties) === JSON.stringify(cloud.payload.ownedProperties) &&
      JSON.stringify(localSave.ownedBusinesses) === JSON.stringify(cloud.payload.ownedBusinesses);

    if (isIdentical) {
      this.state.status = "synced";
      this.state.lastSyncTime = Date.now();
      this.notify();
      return;
    }

    // Divergent progress detected: display comparison modal and await explicit choice
    this.state.status = "conflict";
    this.state.comparison = { localSave, cloudSave: cloud };
    this.notify();
  }

  /**
   * Uploads local save to cloud with expected revision check.
   */
  public async uploadLocalSave(expectedRevision: number, payload: SaveData): Promise<boolean> {
    this.state.status = "uploading";
    this.notify();

    try {
      const res = await fetch(this.baseUrl, {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expectedRevision,
          clientSavedAt: payload.savedAt || Date.now(),
          payload,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Revision conflict occurred
        this.state.status = "conflict";
        this.state.currentRevision = data.currentRevision;
        this.state.cloudSave = data.cloudSave;
        this.state.comparison = { localSave: payload, cloudSave: data.cloudSave };
        this.notify();
        return false;
      }

      if (!res.ok) {
        this.state.status = "error";
        this.state.error = data.message || "Failed to upload save to cloud.";
        this.notify();
        return false;
      }

      this.state.status = "synced";
      this.state.cloudSave = data.save;
      this.state.currentRevision = data.save.revision;
      this.state.lastSyncTime = Date.now();
      this.state.comparison = null;
      this.notify();
      return true;
    } catch {
      this.state.status = "offline";
      this.state.error = "Network connection lost during upload.";
      this.notify();
      return false;
    }
  }

  /**
   * Resolves a detected conflict based on explicit user decision.
   */
  public async resolveConflict(choice: "keep_local" | "keep_cloud"): Promise<{ success: boolean; error?: string }> {
    if (!this.state.comparison) {
      return { success: false, error: "No active conflict to resolve." };
    }

    const { localSave, cloudSave } = this.state.comparison;
    const baseRevision = cloudSave.revision;

    try {
      const res = await fetch(`${this.baseUrl}/resolve-conflict`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resolution: choice,
          baseRevision,
          payload: choice === "keep_local" ? localSave : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Stale conflict resolution — revision changed on server in the meantime!
        this.state.status = "conflict";
        this.state.currentRevision = data.currentRevision;
        this.state.cloudSave = data.cloudSave;
        this.state.comparison = { localSave, cloudSave: data.cloudSave };
        this.state.error = "The cloud save was updated elsewhere while you were reviewing. Please review the updated comparison.";
        this.notify();
        return { success: false, error: this.state.error };
      }

      if (!res.ok) {
        const msg = data.message || "Failed to resolve conflict.";
        this.state.error = msg;
        this.notify();
        return { success: false, error: msg };
      }

      if (choice === "keep_cloud") {
        // 1. Retain exact original local save string in memory before touching storage
        const originalLocalRaw = typeof window !== "undefined" && window.localStorage
          ? window.localStorage.getItem("kano_streets_save_v1")
          : null;

        // 2. Non-destructively back up local device save before replacing
        const backupRes = createLocalRecoveryBackup();
        if (!backupRes.success) {
          const backupErr = `Failed to create safety recovery backup: ${backupRes.error || "Storage access denied or quota exceeded"}. Local save replacement aborted.`;
          this.state.error = backupErr;
          this.notify();
          return { success: false, error: backupErr };
        }
        const recoveryKey = backupRes.recoveryKey;

        // 3. Perform local replacement with verification and verified rollback on failure
        try {
          const payloadStr = JSON.stringify(data.save.payload);
          window.localStorage.setItem("kano_streets_save_v1", payloadStr);
          const verifyLocal = window.localStorage.getItem("kano_streets_save_v1");
          if (!verifyLocal || verifyLocal !== payloadStr) {
            throw new Error("Failed to verify local save write.");
          }
        } catch (writeErr: any) {
          const writeErrMsg = writeErr?.message || "Storage error during write";

          // If there was an original local save, attempt rollback to exact original string
          if (originalLocalRaw !== null) {
            try {
              window.localStorage.setItem("kano_streets_save_v1", originalLocalRaw);
              const verifyRollback = window.localStorage.getItem("kano_streets_save_v1");
              if (!verifyRollback || verifyRollback !== originalLocalRaw) {
                throw new Error("Rollback read-back verification failed.");
              }

              // Rollback succeeded and was verified
              const rollbackSuccessMsg = `Failed to apply cloud save: ${writeErrMsg}. Original local save was successfully restored and verified.`;
              this.state.error = rollbackSuccessMsg;
              this.notify();
              return { success: false, error: rollbackSuccessMsg };
            } catch (rollbackErr: any) {
              // Both replacement and rollback failed
              const rollbackErrMsg = rollbackErr?.message || "Storage error during rollback";
              const recoveryInfo = recoveryKey
                ? ` A safety recovery copy is available in localStorage under '${recoveryKey}'.`
                : "";
              const honestFailureMsg = `Failed to apply cloud save (${writeErrMsg}) and rollback restoration also failed (${rollbackErrMsg}). Primary save may require recovery from the recovery key.${recoveryInfo}`;
              this.state.error = honestFailureMsg;
              this.notify();
              return { success: false, error: honestFailureMsg };
            }
          }

          // If there was no original local save to rollback to
          const noLocalErr = `Failed to write cloud save to local storage: ${writeErrMsg}.`;
          this.state.error = noLocalErr;
          this.notify();
          return { success: false, error: noLocalErr };
        }
      }

      this.state.status = "synced";
      this.state.cloudSave = data.save;
      this.state.currentRevision = data.save.revision;
      this.state.lastSyncTime = Date.now();
      this.state.comparison = null;
      this.state.error = null;
      this.notify();

      return { success: true };
    } catch {
      const msg = "Network error while resolving conflict.";
      this.state.status = "offline";
      this.state.error = msg;
      this.notify();
      return { success: false, error: msg };
    }
  }
}

export const cloudSaveService = new CloudSaveService();

