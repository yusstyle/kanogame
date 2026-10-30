export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface LocalProgressSummary {
  hasSave: boolean;
  cash: number;
  dayCount: number;
  propertiesCount: number;
  lastSavedAt: number | null;
}

export interface AuthState {
  user: UserProfile | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  error: string | null;
  localProgress: LocalProgressSummary;
}

export function inspectLocalSave(): LocalProgressSummary {
  if (typeof window === "undefined" || !window.localStorage) {
    return { hasSave: false, cash: 0, dayCount: 1, propertiesCount: 0, lastSavedAt: null };
  }
  try {
    const raw = window.localStorage.getItem("kano_streets_save_v1");
    if (!raw) {
      return { hasSave: false, cash: 0, dayCount: 1, propertiesCount: 0, lastSavedAt: null };
    }
    const data = JSON.parse(raw);
    const propertiesCount =
      (Array.isArray(data.ownedProperties) ? data.ownedProperties.length : 0) +
      (data.hasApartmentRental ? 1 : 0);
    return {
      hasSave: true,
      cash: typeof data.cash === "number" ? data.cash : 0,
      dayCount: typeof data.dayCount === "number" ? data.dayCount : 1,
      propertiesCount,
      lastSavedAt: typeof data.savedAt === "number" ? data.savedAt : null,
    };
  } catch {
    return { hasSave: false, cash: 0, dayCount: 1, propertiesCount: 0, lastSavedAt: null };
  }
}

export class AuthService {
  private state: AuthState = {
    user: null,
    status: "idle",
    error: null,
    localProgress: inspectLocalSave(),
  };

  private listeners: Set<(state: AuthState) => void> = new Set();
  private baseUrl: string = "/api/auth";

  constructor(customBaseUrl?: string) {
    if (customBaseUrl) {
      this.baseUrl = customBaseUrl.replace(/\/+$/, "");
    }
  }

  public getState(): AuthState {
    return { ...this.state, localProgress: inspectLocalSave() };
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.state.localProgress = inspectLocalSave();
    const snapshot = this.getState();
    this.listeners.forEach((l) => l(snapshot));
  }

  /**
   * Initializes session check on game startup.
   * Treating HTTP 401 as Guest Mode (normal gameplay), not as an error.
   */
  public async initSession(): Promise<UserProfile | null> {
    this.state.status = "loading";
    this.state.error = null;
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/me`, {
        method: "GET",
        headers: { accept: "application/json" },
        credentials: "include",
      });

      if (res.ok) {
        const body = await res.json();
        this.state.user = body.user || null;
        this.state.status = this.state.user ? "authenticated" : "unauthenticated";
        this.state.error = null;
      } else {
        // 401 Unauthenticated is normal Guest Mode
        this.state.user = null;
        this.state.status = "unauthenticated";
        this.state.error = null;
      }
    } catch {
      // Offline / network failure defaults safely to Guest Mode without blocking
      this.state.user = null;
      this.state.status = "unauthenticated";
      this.state.error = null;
    }

    this.notify();
    return this.state.user;
  }

  /**
   * Registers a new account and updates session.
   */
  public async register(
    email: string,
    pass: string,
    displayName: string,
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      return { success: false, error: "Please enter a valid email address." };
    }
    if (pass.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long." };
    }
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: "Display name must be at least 2 characters long." };
    }

    this.state.status = "loading";
    this.state.error = null;
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/register`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: trimmedEmail,
          password: pass,
          displayName: trimmedName,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMessage = data.message || "Registration failed. Please try again.";
        this.state.status = "unauthenticated";
        this.state.error = errMessage;
        this.notify();
        return { success: false, error: errMessage };
      }

      this.state.user = data.user;
      this.state.status = "authenticated";
      this.state.error = null;
      this.notify();
      return { success: true, user: data.user };
    } catch {
      const networkErr = "Network error connecting to the server. Please check your connection.";
      this.state.status = "unauthenticated";
      this.state.error = networkErr;
      this.notify();
      return { success: false, error: networkErr };
    }
  }

  /**
   * Logs in an existing user with credentials.
   */
  public async login(
    email: string,
    pass: string,
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !pass) {
      return { success: false, error: "Please provide both email and password." };
    }

    this.state.status = "loading";
    this.state.error = null;
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/login`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmedEmail, password: pass }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMessage = data.message || "Invalid email or password.";
        this.state.status = "unauthenticated";
        this.state.error = errMessage;
        this.notify();
        return { success: false, error: errMessage };
      }

      this.state.user = data.user;
      this.state.status = "authenticated";
      this.state.error = null;
      this.notify();
      return { success: true, user: data.user };
    } catch {
      const networkErr = "Unable to connect to the authentication service.";
      this.state.status = "unauthenticated";
      this.state.error = networkErr;
      this.notify();
      return { success: false, error: networkErr };
    }
  }

  /**
   * Logs out the user. Note: Local saves are strictly preserved.
   */
  public async logout(): Promise<{ success: boolean }> {
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: "POST",
        headers: { accept: "application/json" },
        credentials: "include",
      });
    } catch {
      // Ignore network errors on logout
    }

    this.state.user = null;
    this.state.status = "unauthenticated";
    this.state.error = null;
    this.notify();
    return { success: true };
  }
}

export const authService = new AuthService();

