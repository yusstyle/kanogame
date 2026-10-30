import { useState } from "react";
import type { FurnitureInstance, PropertyId } from "../game/types";
import { getFurnitureCatalogItem, isFurnitureCompatibleWithRoom } from "../game/furnitureCatalogue";

export interface FurnishingOverlayProps {
  propertyName: string;
  propertyId: PropertyId;
  unplacedItems: FurnitureInstance[];
  placedItems: FurnitureInstance[];
  onClose: () => void;
  onPlaceItem: (
    instanceId: string,
    room: string,
    floor: number,
    position: { x: number; y: number; z: number },
    rotationY: number,
  ) => { success: boolean; message: string };
  onMoveItem: (
    instanceId: string,
    position: { x: number; y: number; z: number },
    rotationY: number,
  ) => { success: boolean; message: string };
  onStoreItem: (instanceId: string) => { success: boolean; message: string };
  onRotateItem: (instanceId: string, deltaYaw: number) => { success: boolean; message: string };
}

const ROOM_OPTIONS_BY_PROPERTY: Record<PropertyId, { id: string; name: string; floor: number; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } }[]> = {
  "unit-2b": [
    { id: "living", name: "Living & Dining Room", floor: 1, bounds: { minX: -5.2, maxX: 2.2, minZ: -4.2, maxZ: 4.2 } },
    { id: "bedroom", name: "Master Bedroom", floor: 1, bounds: { minX: 2.4, maxX: 5.2, minZ: -4.2, maxZ: 0.2 } },
    { id: "kitchen", name: "Modern Kitchen", floor: 1, bounds: { minX: 2.4, maxX: 5.2, minZ: 0.4, maxZ: 4.2 } },
  ],
  "bompai-penthouse": [
    { id: "salon", name: "Grand Living Salon (Floor 1)", floor: 1, bounds: { minX: -7.0, maxX: 7.0, minZ: -6.5, maxZ: 0.2 } },
    { id: "kitchen", name: "Gourmet Kitchen (Floor 1)", floor: 1, bounds: { minX: 2.5, maxX: 7.0, minZ: -6.5, maxZ: -1.5 } },
    { id: "mezzanine", name: "Executive Mezzanine (Floor 2)", floor: 2, bounds: { minX: -7.0, maxX: 7.0, minZ: 1.0, maxZ: 4.5 } },
    { id: "master_suite", name: "Master Suite & Terrace (Floor 2)", floor: 2, bounds: { minX: -7.0, maxX: 7.0, minZ: 4.5, maxZ: 6.8 } },
  ],
  "albaraka-villa": [
    { id: "majilis", name: "Majilis (Living Salon)", floor: 1, bounds: { minX: -8.0, maxX: 1.5, minZ: -7.0, maxZ: 2.0 } },
    { id: "master_suite", name: "Master Suite", floor: 1, bounds: { minX: 2.0, maxX: 8.0, minZ: -7.0, maxZ: 2.0 } },
    { id: "family_kitchen", name: "Family Kitchen & Dining", floor: 1, bounds: { minX: -8.0, maxX: 8.0, minZ: 2.2, maxZ: 7.0 } },
  ],
};

export default function FurnishingOverlay({
  propertyName,
  propertyId,
  unplacedItems,
  placedItems,
  onClose,
  onPlaceItem,
  onMoveItem,
  onStoreItem,
  onRotateItem,
}: FurnishingOverlayProps) {
  const [activeTab, setActiveTab] = useState<"inventory" | "placed">("inventory");
  const [placingInstanceId, setPlacingInstanceId] = useState<string | null>(null);
  const [targetRoomIndex, setTargetRoomIndex] = useState(0);
  const [posX, setPosX] = useState(0);
  const [posZ, setPosZ] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const availableRooms = ROOM_OPTIONS_BY_PROPERTY[propertyId] ?? ROOM_OPTIONS_BY_PROPERTY["unit-2b"];
  const currentRoom = availableRooms[targetRoomIndex] ?? availableRooms[0];

  const placingItem = placingInstanceId
    ? [...unplacedItems, ...placedItems].find((i) => i.instanceId === placingInstanceId)
    : null;
  const placingCatalog = placingItem ? getFurnitureCatalogItem(placingItem.catalogId) : null;

  // Check if position is within current room bounds
  const isInsideRoom =
    posX >= currentRoom.bounds.minX &&
    posX <= currentRoom.bounds.maxX &&
    posZ >= currentRoom.bounds.minZ &&
    posZ <= currentRoom.bounds.maxZ;

  const handleStartPlacement = (item: FurnitureInstance) => {
    setPlacingInstanceId(item.instanceId);
    // Find initial center of current room
    const initX = (currentRoom.bounds.minX + currentRoom.bounds.maxX) / 2;
    const initZ = (currentRoom.bounds.minZ + currentRoom.bounds.maxZ) / 2;
    setPosX(item.isPlaced ? item.position.x : Math.round(initX * 2) / 2);
    setPosZ(item.isPlaced ? item.position.z : Math.round(initZ * 2) / 2);
    setRotationY(item.rotationY || 0);
  };

  const handleConfirmPlacement = () => {
    if (!placingItem || !placingCatalog) return;

    if (!isInsideRoom) {
      setStatusMessage(`Placement Error: Coordinates (${posX.toFixed(1)}, ${posZ.toFixed(1)}) are outside ${currentRoom.name} boundary.`);
      return;
    }

    const yCoord = currentRoom.floor === 2 ? 3.4 : 0.0;
    const isNewPlacement = !placingItem.isPlaced;

    let res: { success: boolean; message: string };
    if (isNewPlacement) {
      res = onPlaceItem(
        placingItem.instanceId,
        currentRoom.name,
        currentRoom.floor,
        { x: posX, y: yCoord, z: posZ },
        rotationY,
      );
    } else {
      res = onMoveItem(
        placingItem.instanceId,
        { x: posX, y: yCoord, z: posZ },
        rotationY,
      );
    }

    setStatusMessage(res.message);
    if (res.success) {
      setPlacingInstanceId(null);
      setActiveTab("placed");
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(440px, 100vw)",
        background: "rgba(18, 30, 27, 0.94)",
        borderLeft: "1px solid rgba(244, 238, 223, 0.2)",
        boxShadow: "-8px 0 24px rgba(0,0,0,0.5)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        color: "var(--ks-ink, #f4eedf)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid rgba(244, 238, 223, 0.15)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--ks-copper, #c2783d)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            CUSTOM HOME INTERIOR · FURNISHING MODE
          </div>
          <h2 style={{ margin: "2px 0 0", fontSize: 18, fontFamily: "'Fraunces', Georgia, serif" }}>
            {propertyName}
          </h2>
          <div style={{ fontSize: 12, color: "rgba(244, 238, 223, 0.6)", marginTop: 2 }}>
            Press <kbd style={{ padding: "1px 5px", background: "rgba(255,255,255,0.1)", borderRadius: 3 }}>[F]</kbd> to toggle mode
          </div>
        </div>
        <button
          className="ks-directory-close"
          onClick={onClose}
          style={{ width: 28, height: 28, fontSize: 14 }}
          title="Exit Furnishing Mode"
        >
          ✕
        </button>
      </div>

      {/* Status Feedback Message */}
      {statusMessage && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(202, 138, 4, 0.2)",
            borderBottom: "1px solid rgba(202, 138, 4, 0.4)",
            fontSize: 12,
            color: "#fef08a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Placement Controls HUD */}
      {placingItem && placingCatalog && (
        <div
          style={{
            background: "rgba(28, 44, 40, 0.98)",
            borderBottom: "2px solid var(--ks-copper, #c2783d)",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--ks-copper)", fontWeight: 700, textTransform: "uppercase" }}>
              🎯 Positioning: {placingCatalog.name}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 3,
                fontWeight: 600,
                background: isInsideRoom ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
                color: isInsideRoom ? "#86efac" : "#fca5a5",
                border: `1px solid ${isInsideRoom ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)"}`,
              }}
            >
              {isInsideRoom ? "✓ Valid Room Position" : "⚠ Outside Room"}
            </span>
          </div>

          {/* Room Selector Dropdown */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "rgba(244, 238, 223, 0.6)", display: "block", marginBottom: 4 }}>
              Target Room:
            </label>
            <select
              value={targetRoomIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setTargetRoomIndex(idx);
                const rm = availableRooms[idx];
                setPosX(Math.round(((rm.bounds.minX + rm.bounds.maxX) / 2) * 2) / 2);
                setPosZ(Math.round(((rm.bounds.minZ + rm.bounds.maxZ) / 2) * 2) / 2);
              }}
              style={{
                width: "100%",
                padding: "6px 10px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(244, 238, 223, 0.2)",
                color: "#fff",
                borderRadius: 3,
                fontSize: 12,
              }}
            >
              {availableRooms.map((rm, idx) => (
                <option key={rm.id} value={idx}>
                  {rm.name} (Floor {rm.floor})
                </option>
              ))}
            </select>
          </div>

          {/* Nudge Direction Pad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
            <div />
            <button
              onClick={() => setPosZ((z) => Math.round((z - 0.5) * 10) / 10)}
              style={nudgeBtnStyle}
              title="Move North / Forward"
            >
              ▲ North (-Z)
            </button>
            <div />

            <button
              onClick={() => setPosX((x) => Math.round((x - 0.5) * 10) / 10)}
              style={nudgeBtnStyle}
              title="Move West / Left"
            >
              ◀ West (-X)
            </button>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color: "rgba(244, 238, 223, 0.8)",
                background: "rgba(0,0,0,0.2)",
                borderRadius: 3,
              }}
            >
              <span>X: {posX.toFixed(1)}</span>
              <span>Z: {posZ.toFixed(1)}</span>
            </div>
            <button
              onClick={() => setPosX((x) => Math.round((x + 0.5) * 10) / 10)}
              style={nudgeBtnStyle}
              title="Move East / Right"
            >
              East (+X) ▶
            </button>

            <div />
            <button
              onClick={() => setPosZ((z) => Math.round((z + 0.5) * 10) / 10)}
              style={nudgeBtnStyle}
              title="Move South / Backward"
            >
              ▼ South (+Z)
            </button>
            <div />
          </div>

          {/* Rotate Controls */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              onClick={() => setRotationY((r) => r - Math.PI / 2)}
              style={{ ...nudgeBtnStyle, flex: 1 }}
            >
              ↺ Rotate 90° Left
            </button>
            <button
              onClick={() => setRotationY((r) => r + Math.PI / 2)}
              style={{ ...nudgeBtnStyle, flex: 1 }}
            >
              ↻ Rotate 90° Right
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleConfirmPlacement}
              disabled={!isInsideRoom}
              style={{
                flex: 2,
                background: isInsideRoom ? "var(--ks-copper, #c2783d)" : "rgba(255,255,255,0.1)",
                border: "1px solid " + (isInsideRoom ? "rgba(244, 238, 223, 0.4)" : "rgba(255,255,255,0.1)"),
                borderRadius: 3,
                color: isInsideRoom ? "#172421" : "rgba(244, 238, 223, 0.4)",
                fontWeight: 700,
                fontSize: 13,
                padding: "8px 14px",
                cursor: isInsideRoom ? "pointer" : "not-allowed",
              }}
            >
              ✓ Confirm Placement
            </button>
            <button
              onClick={() => setPlacingInstanceId(null)}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(244, 238, 223, 0.2)",
                borderRadius: 3,
                color: "rgba(244, 238, 223, 0.7)",
                fontSize: 13,
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(244, 238, 223, 0.15)" }}>
        <button
          onClick={() => { setActiveTab("inventory"); setPlacingInstanceId(null); }}
          style={{
            flex: 1,
            padding: "10px",
            background: activeTab === "inventory" ? "rgba(244, 238, 223, 0.1)" : "transparent",
            border: "none",
            borderBottom: activeTab === "inventory" ? "2px solid var(--ks-copper)" : "none",
            color: activeTab === "inventory" ? "#fff" : "rgba(244, 238, 223, 0.5)",
            fontWeight: activeTab === "inventory" ? 700 : 400,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          📦 Inventory ({unplacedItems.length})
        </button>
        <button
          onClick={() => { setActiveTab("placed"); setPlacingInstanceId(null); }}
          style={{
            flex: 1,
            padding: "10px",
            background: activeTab === "placed" ? "rgba(244, 238, 223, 0.1)" : "transparent",
            border: "none",
            borderBottom: activeTab === "placed" ? "2px solid var(--ks-copper)" : "none",
            color: activeTab === "placed" ? "#fff" : "rgba(244, 238, 223, 0.5)",
            fontWeight: activeTab === "placed" ? 700 : 400,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          🏡 Placed in Home ({placedItems.length})
        </button>
      </div>

      {/* Tab Content List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {activeTab === "inventory" && (
          <>
            {unplacedItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "rgba(244, 238, 223, 0.6)", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No Unplaced Items</div>
                <div>Visit Arewa Royal Furniture Showroom in Sabon Gari to purchase furniture, electronics, and appliances.</div>
              </div>
            ) : (
              unplacedItems.map((item) => {
                const cat = getFurnitureCatalogItem(item.catalogId);
                if (!cat) return null;
                const isSelected = placingInstanceId === item.instanceId;

                return (
                  <div
                    key={item.instanceId}
                    style={{
                      background: isSelected ? "rgba(194, 120, 61, 0.2)" : "rgba(0,0,0,0.3)",
                      border: `1px solid ${isSelected ? "var(--ks-copper)" : "rgba(244, 238, 223, 0.15)"}`,
                      borderRadius: 4,
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ks-ink)" }}>
                        {cat.name}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(244, 238, 223, 0.5)", marginTop: 2 }}>
                        {cat.category.toUpperCase()} · {cat.dimensions.width}m × {cat.dimensions.depth}m
                      </div>
                      {cat.upgradeEffect && (
                        <div style={{ fontSize: 11, color: "#fef08a", marginTop: 4 }}>
                          ⚡ {cat.upgradeEffect}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleStartPlacement(item)}
                      style={{
                        background: "var(--ks-copper, #c2783d)",
                        border: "none",
                        borderRadius: 3,
                        color: "#172421",
                        fontWeight: 700,
                        fontSize: 12,
                        padding: "6px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Place
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === "placed" && (
          <>
            {placedItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "rgba(244, 238, 223, 0.6)", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🛋️</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No Furniture Placed Yet</div>
                <div>Select items from your Inventory tab to arrange and customize this residence.</div>
              </div>
            ) : (
              placedItems.map((item) => {
                const cat = getFurnitureCatalogItem(item.catalogId);
                if (!cat) return null;
                const isSelected = placingInstanceId === item.instanceId;

                return (
                  <div
                    key={item.instanceId}
                    style={{
                      background: isSelected ? "rgba(194, 120, 61, 0.2)" : "rgba(0,0,0,0.3)",
                      border: `1px solid ${isSelected ? "var(--ks-copper)" : "rgba(244, 238, 223, 0.15)"}`,
                      borderRadius: 4,
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ks-ink)" }}>
                          {cat.name}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(244, 238, 223, 0.5)" }}>
                          Room: <strong>{item.room || "Main"}</strong> (Floor {item.floor}) · Pos: ({item.position.x.toFixed(1)}, {item.position.z.toFixed(1)})
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => handleStartPlacement(item)}
                        style={{
                          flex: 1,
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(244, 238, 223, 0.2)",
                          color: "#fff",
                          borderRadius: 3,
                          fontSize: 11,
                          padding: "5px 8px",
                          cursor: "pointer",
                        }}
                      >
                        ✎ Move
                      </button>
                      <button
                        onClick={() => {
                          const res = onRotateItem(item.instanceId, Math.PI / 2);
                          setStatusMessage(res.message);
                        }}
                        style={{
                          flex: 1,
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(244, 238, 223, 0.2)",
                          color: "#fff",
                          borderRadius: 3,
                          fontSize: 11,
                          padding: "5px 8px",
                          cursor: "pointer",
                        }}
                      >
                        ↻ Rotate 90°
                      </button>
                      <button
                        onClick={() => {
                          const res = onStoreItem(item.instanceId);
                          setStatusMessage(res.message);
                        }}
                        style={{
                          flex: 1,
                          background: "rgba(239, 68, 68, 0.15)",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          color: "#fca5a5",
                          borderRadius: 3,
                          fontSize: 11,
                          padding: "5px 8px",
                          cursor: "pointer",
                        }}
                      >
                        Store
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}

const nudgeBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(244, 238, 223, 0.2)",
  borderRadius: 3,
  color: "#fff",
  padding: "6px 4px",
  fontSize: 11,
  cursor: "pointer",
  textAlign: "center",
};
