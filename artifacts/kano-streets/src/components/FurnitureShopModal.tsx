import { useState } from "react";
import {
  FURNITURE_CATALOGUE,
  type FurnitureCatalogItem,
  type FurnitureCategory,
  type QualityTier,
} from "../game/furnitureCatalogue";

export interface FurnitureShopModalProps {
  onClose: () => void;
  playerCash: number;
  onPurchaseFurniture: (catalogId: string) => { success: boolean; message: string };
}

const CATEGORY_LABELS: Record<FurnitureCategory, { label: string; icon: string }> = {
  living: { label: "Living Room", icon: "🛋️" },
  bedroom: { label: "Bedroom", icon: "🛏️" },
  kitchen: { label: "Kitchen", icon: "🍳" },
  study: { label: "Study & Office", icon: "💻" },
  decor: { label: "Decor & Lighting", icon: "🏺" },
};

const TIER_COLORS: Record<QualityTier, { bg: string; text: string; border: string }> = {
  basic: { bg: "#1e293b", text: "#94a3b8", border: "#475569" },
  standard: { bg: "#143a2c", text: "#86efac", border: "#22c55e" },
  premium: { bg: "#3e2710", text: "#fde047", border: "#eab308" },
};

export default function FurnitureShopModal({
  onClose,
  playerCash,
  onPurchaseFurniture,
}: FurnitureShopModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<FurnitureCategory | "all">("all");
  const [selectedTier, setSelectedTier] = useState<QualityTier | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusBanner, setStatusBanner] = useState<{ text: string; isSuccess: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredItems = FURNITURE_CATALOGUE.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesTier = selectedTier === "all" || item.tier === selectedTier;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesTier && matchesSearch;
  });

  const handleBuy = (item: FurnitureCatalogItem) => {
    if (isProcessing) return;
    if (playerCash < item.price) {
      setStatusBanner({
        text: `Insufficient Funds: You need ₦${item.price.toLocaleString()} to purchase "${item.name}".`,
        isSuccess: false,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = onPurchaseFurniture(item.id);
      setStatusBanner({
        text: res.message,
        isSuccess: res.success,
      });
    } finally {
      setTimeout(() => setIsProcessing(false), 300);
    }
  };

  return (
    <div className="ks-directory-layer" role="dialog" aria-modal="true" aria-labelledby="ks-furniture-shop-title">
      <div className="ks-directory-panel ks-city-map-panel" style={{ maxWidth: 960 }}>
        {/* Header */}
        <div className="ks-directory-header">
          <div>
            <div className="ks-edition" style={{ color: "var(--ks-copper)" }}>
              SABON GARI COMMERCIAL CORRIDOR · DIRECT HOME DELIVERY
            </div>
            <h2 id="ks-furniture-shop-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>🛋️ Arewa Royal Furniture &amp; Electronics Showroom</span>
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(244, 238, 223, 0.7)" }}>
              Sales Consultant: <strong>Musa Dan-Ladi</strong> · Deliveries to Airport View (Unit 2B), Bompai Heights, &amp; Al-Baraka Villa
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                borderRadius: 4,
                padding: "6px 14px",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 11, color: "#86efac", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Available Cash
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f0fdf4" }}>
                ₦{playerCash.toLocaleString()}
              </div>
            </div>
            <button className="ks-directory-close" onClick={onClose} aria-label="Close Shop">
              ✕
            </button>
          </div>
        </div>

        {/* Status Confirmation Banner */}
        {statusBanner && (
          <div
            style={{
              padding: "10px 20px",
              background: statusBanner.isSuccess ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
              borderBottom: `1px solid ${statusBanner.isSuccess ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
              color: statusBanner.isSuccess ? "#bbf7d0" : "#fca5a5",
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{statusBanner.text}</span>
            <button
              onClick={() => setStatusBanner(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div style={{ padding: "14px 24px 8px", borderBottom: "1px solid rgba(244, 238, 223, 0.1)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search furniture, electronics, appliances..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ks-directory-search"
              style={{ flex: 1, minWidth: 220 }}
            />

            {/* Category Filter Pills */}
            <div className="ks-category-filter-pills" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                className={`ks-filter-pill ${selectedCategory === "all" ? "active" : ""}`}
                onClick={() => setSelectedCategory("all")}
                style={{
                  background: selectedCategory === "all" ? "var(--ks-copper)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(244, 238, 223, 0.2)",
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: 3,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                All Categories ({FURNITURE_CATALOGUE.length})
              </button>
              {(Object.keys(CATEGORY_LABELS) as FurnitureCategory[]).map((cat) => {
                const count = FURNITURE_CATALOGUE.filter((i) => i.category === cat).length;
                const isSel = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      background: isSel ? "var(--ks-copper)" : "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(244, 238, 223, 0.2)",
                      color: isSel ? "#172421" : "#fff",
                      fontWeight: isSel ? 700 : 400,
                      padding: "4px 10px",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {CATEGORY_LABELS[cat].icon} {CATEGORY_LABELS[cat].label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tier Filters */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(244, 238, 223, 0.6)", textTransform: "uppercase" }}>Tier:</span>
            {(["all", "basic", "standard", "premium"] as const).map((tier) => {
              const isSel = selectedTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  style={{
                    background: isSel ? "rgba(244, 238, 223, 0.2)" : "transparent",
                    border: "1px solid rgba(244, 238, 223, 0.15)",
                    color: isSel ? "#fef3c7" : "rgba(244, 238, 223, 0.6)",
                    padding: "2px 8px",
                    borderRadius: 2,
                    cursor: "pointer",
                    fontSize: 11,
                    textTransform: "capitalize",
                  }}
                >
                  {tier}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="ks-directory-list" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filteredItems.map((item) => {
            const canAfford = playerCash >= item.price;
            const tierStyle = TIER_COLORS[item.tier];

            return (
              <div
                key={item.id}
                className="ks-directory-card"
                style={{
                  background: "rgba(22, 34, 31, 0.85)",
                  border: "1px solid rgba(244, 238, 223, 0.15)",
                  borderRadius: 4,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  {/* Card Header Badges */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: 2,
                        background: tierStyle.bg,
                        color: tierStyle.text,
                        border: `1px solid ${tierStyle.border}`,
                        fontWeight: 600,
                      }}
                    >
                      {item.tier}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(244, 238, 223, 0.5)" }}>
                      {item.dimensions.width}m × {item.dimensions.depth}m × {item.dimensions.height}m
                    </span>
                  </div>

                  {/* Product Title */}
                  <h3
                    style={{
                      margin: "0 0 6px",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--ks-ink, #f4eedf)",
                      fontFamily: "'Fraunces', Georgia, serif",
                    }}
                  >
                    {item.name}
                  </h3>

                  {/* Description */}
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(244, 238, 223, 0.7)", lineHeight: 1.4 }}>
                    {item.description}
                  </p>

                  {/* Interactive Effect Badge */}
                  {item.upgradeEffect && (
                    <div
                      style={{
                        fontSize: 11,
                        background: "rgba(202, 138, 4, 0.12)",
                        border: "1px solid rgba(202, 138, 4, 0.3)",
                        color: "#fef08a",
                        padding: "4px 8px",
                        borderRadius: 3,
                        marginBottom: 10,
                      }}
                    >
                      ⚡ {item.upgradeEffect}
                    </div>
                  )}

                  {/* Room Compatibility */}
                  <div style={{ fontSize: 11, color: "rgba(244, 238, 223, 0.5)", marginBottom: 12 }}>
                    📍 {item.compatibleRooms.slice(0, 2).join(", ")}
                    {item.compatibleRooms.length > 2 && ` +${item.compatibleRooms.length - 2} more`}
                  </div>
                </div>

                {/* Footer: Price and Buy Button */}
                <div
                  style={{
                    borderTop: "1px solid rgba(244, 238, 223, 0.1)",
                    paddingTop: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span style={{ fontSize: 10, color: "rgba(244, 238, 223, 0.5)", display: "block" }}>PRICE</span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: canAfford ? "#fef08a" : "#fca5a5",
                      }}
                    >
                      ₦{item.price.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => handleBuy(item)}
                    disabled={!canAfford || isProcessing}
                    style={{
                      background: canAfford ? "var(--ks-copper, #c2783d)" : "rgba(255,255,255,0.08)",
                      border: "1px solid " + (canAfford ? "rgba(244, 238, 223, 0.4)" : "rgba(255,255,255,0.1)"),
                      borderRadius: 3,
                      color: canAfford ? "#172421" : "rgba(244, 238, 223, 0.4)",
                      fontWeight: 700,
                      fontSize: 12,
                      padding: "8px 14px",
                      cursor: canAfford && !isProcessing ? "pointer" : "not-allowed",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {!canAfford ? "Insufficient Funds" : isProcessing ? "Processing..." : "Buy & Deliver"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
