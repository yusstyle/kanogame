import React, { useState, useEffect, useCallback } from "react";
import { authService, type UserProfile, type AuthState } from "../game/authService";
import {
  cloudSaveService,
  type CloudSaveState,
  type CloudSyncStatus,
} from "../game/cloudSaveService";
import "./AccountModal.css";

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const [authState, setAuthState] = useState<AuthState>(authService.getState());
  const [cloudState, setCloudState] = useState<CloudSaveState>(cloudSaveService.getState());
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Form input fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  // Subscribe to auth service and cloud save service state updates
  useEffect(() => {
    const unsubAuth = authService.subscribe((next) => {
      setAuthState(next);
    });
    const unsubCloud = cloudSaveService.subscribe((next) => {
      setCloudState(next);
    });
    return () => {
      unsubAuth();
      unsubCloud();
    };
  }, []);

  // Sync cloud state when modal is opened and user is authenticated
  useEffect(() => {
    if (isOpen && authState.user) {
      cloudSaveService.syncOnAuth();
    }
  }, [isOpen, authState.user]);

  // Listen for Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Clear fields and feedback when opening or switching tabs
  const switchTab = useCallback((tab: "login" | "register") => {
    setActiveTab(tab);
    setFeedback(null);
  }, []);

  if (!isOpen) return null;

  const { user, localProgress } = authState;
  const isGuest = !user;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);

    const res = await authService.login(email, password);
    setLoading(false);

    if (res.success) {
      setFeedback({ type: "success", message: `Welcome back, ${res.user?.displayName || "Player"}!` });
      setPassword("");
      // Trigger cloud sync
      await cloudSaveService.syncOnAuth();
    } else {
      setFeedback({ type: "error", message: res.error || "Login failed." });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);

    const res = await authService.register(email, password, displayName);
    setLoading(false);

    if (res.success) {
      setFeedback({ type: "success", message: `Account created! Welcome to Kano Streets, ${res.user?.displayName}!` });
      setPassword("");
      // Trigger initial cloud sync
      await cloudSaveService.syncOnAuth();
    } else {
      setFeedback({ type: "error", message: res.error || "Registration failed." });
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await authService.logout();
    cloudSaveService.reset();
    setLoading(false);
    setFeedback({ type: "success", message: "Signed out. You are now playing in Guest Mode." });
    setActiveTab("login");
  };

  const handleResolveConflict = async (choice: "keep_local" | "keep_cloud") => {
    setLoading(true);
    const res = await cloudSaveService.resolveConflict(choice);
    setLoading(false);
    if (res.success) {
      setFeedback({
        type: "success",
        message: choice === "keep_local"
          ? "Local progress uploaded to cloud! Progress is in sync."
          : "Cloud save restored! Local copy backed up non-destructively.",
      });
    } else {
      setFeedback({
        type: "error",
        message: res.error || "Failed to resolve conflict.",
      });
    }
  };

  const renderSyncBadge = (status: CloudSyncStatus) => {
    switch (status) {
      case "synced":
        return <div className="ks-sync-badge synced">☁ Synced (Rev {cloudState.currentRevision ?? 1})</div>;
      case "checking":
        return <div className="ks-sync-badge checking"><span className="ks-spinner" /> Checking Cloud...</div>;
      case "uploading":
        return <div className="ks-sync-badge uploading"><span className="ks-spinner" /> Uploading Save...</div>;
      case "conflict":
        return <div className="ks-sync-badge conflict">⚠️ Progress Conflict</div>;
      case "offline":
        return <div className="ks-sync-badge offline">📡 Offline / Guest Sync</div>;
      case "error":
        return <div className="ks-sync-badge error">⚠️ Sync Error</div>;
      default:
        return null;
    }
  };

  return (
    <div className="ks-account-overlay" onClick={onClose} role="presentation">
      <div
        className="ks-account-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ks-account-title"
      >
        {/* Header */}
        <div className="ks-account-header">
          <div className="ks-account-brand">
            <div className="ks-account-icon" aria-hidden="true">
              👤
            </div>
            <div className="ks-account-title">
              <h2 id="ks-account-title">{user ? "Player Profile" : "Kano Streets Identity"}</h2>
              <p>{user ? "Authenticated Player Account" : "Sign in or create an account"}</p>
            </div>
          </div>
          <button className="ks-account-close" onClick={onClose} aria-label="Close Account Modal">
            &times;
          </button>
        </div>

        {/* Guest Progress Notification Banner */}
        {isGuest && localProgress.hasSave && (
          <div className="ks-guest-banner" role="status">
            <div className="ks-guest-banner-title">
              <span>💾</span>
              <span>Local Progress Detected</span>
            </div>
            <div className="ks-guest-stats">
              <span>💵 ₦{localProgress.cash.toLocaleString()}</span>
              <span>📅 Day {localProgress.dayCount}</span>
              <span>🏠 {localProgress.propertiesCount} {localProgress.propertiesCount === 1 ? "Property" : "Properties"}</span>
            </div>
            <div className="ks-guest-note">
              Your device save is safely stored. Signing in lets you manage your identity across sessions without losing local progress.
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div style={{ margin: "0.75rem 1.5rem 0 1.5rem" }}>
            <div className={`ks-account-alert ${feedback.type}`} role="alert">
              <span>{feedback.type === "error" ? "⚠️" : "✓"}</span>
              <span>{feedback.message}</span>
            </div>
          </div>
        )}

        {/* Authenticated View */}
        {user ? (
          <div className="ks-account-body">
            {/* Sync Status Row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cloud Save Status</span>
              {renderSyncBadge(cloudState.status)}
            </div>

            {/* Conflict Resolution Card (Side-by-Side Comparison) */}
            {cloudState.status === "conflict" && cloudState.comparison && (
              <div className="ks-conflict-card" role="region" aria-label="Cloud Save Conflict Resolution">
                <div className="ks-conflict-header">
                  <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                  <div>
                    <h4>Progress Conflict Detected</h4>
                    <p className="ks-conflict-desc">
                      Your local device save differs from the save in the cloud. Choose which progress you wish to keep:
                    </p>
                  </div>
                </div>

                <table className="ks-conflict-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Local Save (Device)</th>
                      <th>Cloud Save (Server)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Street Cash</td>
                      <td className="local">₦{cloudState.comparison.localSave.cash?.toLocaleString() ?? 0}</td>
                      <td className="cloud">₦{cloudState.comparison.cloudSave.payload.cash?.toLocaleString() ?? 0}</td>
                    </tr>
                    <tr>
                      <td>Kano Gold</td>
                      <td className="local">🪙 {cloudState.comparison.localSave.premiumCoins ?? 250}</td>
                      <td className="cloud">🪙 {cloudState.comparison.cloudSave.payload.premiumCoins ?? 250}</td>
                    </tr>
                    <tr>
                      <td>Calendar Progress</td>
                      <td className="local">Day {cloudState.comparison.localSave.dayCount ?? 1}</td>
                      <td className="cloud">Day {cloudState.comparison.cloudSave.payload.dayCount ?? 1}</td>
                    </tr>
                    <tr>
                      <td>Properties Owned</td>
                      <td className="local">{cloudState.comparison.localSave.ownedProperties?.length ?? 0} Owned</td>
                      <td className="cloud">{cloudState.comparison.cloudSave.payload.ownedProperties?.length ?? 0} Owned</td>
                    </tr>
                    <tr>
                      <td>Last Saved</td>
                      <td className="local">{cloudState.comparison.localSave.savedAt ? new Date(cloudState.comparison.localSave.savedAt).toLocaleTimeString() : "Recent"}</td>
                      <td className="cloud">{cloudState.comparison.cloudSave.updatedAt ? new Date(cloudState.comparison.cloudSave.updatedAt).toLocaleTimeString() : "Recent"}</td>
                    </tr>
                    <tr>
                      <td>Revision</td>
                      <td className="local">Unsynced</td>
                      <td className="cloud">Rev {cloudState.comparison.cloudSave.revision}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="ks-conflict-actions">
                  <button
                    className="ks-conflict-btn local"
                    onClick={() => handleResolveConflict("keep_local")}
                    disabled={loading}
                  >
                    <span>Keep Local Progress (Overwrite Cloud)</span>
                    <span>→</span>
                  </button>
                  <button
                    className="ks-conflict-btn cloud"
                    onClick={() => handleResolveConflict("keep_cloud")}
                    disabled={loading}
                  >
                    <span>Keep Cloud Save (Overwrite Local)</span>
                    <span>↓</span>
                  </button>
                  <button
                    className="ks-conflict-btn later"
                    onClick={onClose}
                    disabled={loading}
                  >
                    <span>Decide Later (Continue in Local Mode)</span>
                  </button>
                </div>

                <p className="ks-recovery-hint">
                  🛡️ A timestamped safety recovery copy is automatically created before any local device changes.
                </p>
              </div>
            )}

            <div className="ks-profile-card">
              <div className="ks-profile-avatar-row">
                <div className="ks-profile-avatar" aria-hidden="true">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="ks-profile-meta">
                  <h3>{user.displayName}</h3>
                  <p>{user.email}</p>
                  <div className="ks-profile-badge">Active Session Verified</div>
                </div>
              </div>

              <div className="ks-profile-details">
                <div className="ks-profile-item">
                  <span>Account ID</span>
                  <span>{user.id.slice(0, 8)}…{user.id.slice(-4)}</span>
                </div>
                <div className="ks-profile-item">
                  <span>Member Since</span>
                  <span>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "2026"}
                  </span>
                </div>
                <div className="ks-profile-item">
                  <span>Local Device Save</span>
                  <span>{localProgress.hasSave ? `Day ${localProgress.dayCount}` : "New Profile"}</span>
                </div>
                <div className="ks-profile-item">
                  <span>Verification Status</span>
                  <span>{user.emailVerified ? "Verified" : "Standard"}</span>
                </div>
              </div>
            </div>

            <button
              className="ks-account-btn danger"
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? <span className="ks-spinner" /> : "Sign Out (Switch to Guest)"}
            </button>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b", textAlign: "center" }}>
              Signing out will not erase your local gameplay or device progress.
            </p>
          </div>
        ) : (
          /* Unauthenticated (Guest) View */
          <>
            {/* Tabs */}
            <div className="ks-account-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === "login"}
                className={`ks-account-tab ${activeTab === "login" ? "active" : ""}`}
                onClick={() => switchTab("login")}
              >
                Sign In
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "register"}
                className={`ks-account-tab ${activeTab === "register" ? "active" : ""}`}
                onClick={() => switchTab("register")}
              >
                Create Account
              </button>
            </div>

            <div className="ks-account-body">
              {activeTab === "login" ? (
                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="ks-account-field">
                    <label htmlFor="ks-login-email">Email Address</label>
                    <input
                      id="ks-login-email"
                      type="email"
                      className="ks-account-input"
                      placeholder="e.g. musa@kanostreets.ng"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="ks-account-field">
                    <label htmlFor="ks-login-pass">Password</label>
                    <input
                      id="ks-login-pass"
                      type="password"
                      className="ks-account-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <button type="submit" className="ks-account-btn" disabled={loading}>
                    {loading ? <span className="ks-spinner" /> : "Sign In to Kano Streets"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="ks-account-field">
                    <label htmlFor="ks-reg-name">Display Name (Citizen Handle)</label>
                    <input
                      id="ks-reg-name"
                      type="text"
                      className="ks-account-input"
                      placeholder="e.g. Danjuma Ibrahim"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      minLength={2}
                      maxLength={50}
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div className="ks-account-field">
                    <label htmlFor="ks-reg-email">Email Address</label>
                    <input
                      id="ks-reg-email"
                      type="email"
                      className="ks-account-input"
                      placeholder="e.g. danjuma@kanostreets.ng"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="ks-account-field">
                    <label htmlFor="ks-reg-pass">Password</label>
                    <input
                      id="ks-reg-pass"
                      type="password"
                      className="ks-account-input"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                    <span className="ks-input-hint">Must be at least 8 characters long.</span>
                  </div>

                  <button type="submit" className="ks-account-btn" disabled={loading}>
                    {loading ? <span className="ks-spinner" /> : "Create Account"}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AccountModal;
