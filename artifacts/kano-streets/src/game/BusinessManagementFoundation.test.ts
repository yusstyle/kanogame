import test from "node:test";
import assert from "node:assert/strict";
import { EconomySystem } from "./economySystem";
import { BUSINESS_METADATA, BUSINESS_TIERS } from "./empireCatalog";
import type { BusinessCategory, DailyFinancialStatement } from "./types";

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
}

test("Milestone 3 Phase A.1: Business Categories & Catalog Alignment", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  economy.syncEntityMetadata();

  const sabonGari = economy.businesses.get("sabon-gari-shop");
  assert.ok(sabonGari, "Sabon Gari shop must exist");
  assert.equal(sabonGari.category, "retail");
  assert.equal(sabonGari.categoryTitle, "Supermarkets & Retail");

  const suya = economy.businesses.get("arewa-suya-franchise");
  assert.ok(suya, "Arewa Suya franchise must exist");
  assert.equal(suya.category, "restaurant");
  assert.equal(suya.categoryTitle, "Restaurants & Dining");

  const cyber = economy.businesses.get("cyber-hub-station");
  assert.ok(cyber, "Cyber Hub must exist");
  assert.equal(cyber.category, "entertainment");
  assert.equal(cyber.categoryTitle, "Entertainment & Leisure");

  const depot = economy.businesses.get("dawanau-grain-depot");
  assert.ok(depot, "Dawanau depot must exist");
  assert.equal(depot.category, "logistics");
  assert.equal(depot.categoryTitle, "Transport & Logistics");

  // Verify business metadata catalog has all 4 entries
  assert.equal(Object.keys(BUSINESS_METADATA).length, 4);
});

test("Milestone 3 Phase A.2: Business Management Metrics & Default Initialization", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  economy.syncEntityMetadata();

  const b = economy.businesses.get("sabon-gari-shop");
  assert.ok(b);
  assert.equal(b.condition, 100, "Initial condition should be mint 100%");
  assert.equal(b.employeeCount, 2, "Level 1 retail staff should be 2");
  assert.ok((b.reputation ?? 0) >= 70, "Reputation initialized");
  assert.ok((b.customerSatisfaction ?? 0) >= 75, "Customer satisfaction initialized");
  assert.ok(b.inventoryStatus?.includes("capacity") || b.inventoryStatus?.includes("Stock"), "Inventory status present");
  assert.equal(b.maintenanceCost, 15000, "Level 1 retail maintenance cost configured");
  assert.equal(b.dailyTax, Math.round(b.dailyRevenue * 0.05), "Municipal tax should be 5% of gross revenue");
  assert.equal(b.netProfit, b.dailyRevenue - b.dailyCost - (b.dailyTax ?? 0), "Net profit equals revenue minus costs and taxes");
});

test("Milestone 3 Phase A.3: Routine Business Maintenance & Condition Restoration", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  let playerCash = 5000000;

  // Buy the shop
  const buyRes = economy.purchaseBusiness("sabon-gari-shop", playerCash);
  assert.equal(buyRes.success, true);
  playerCash -= buyRes.cost;

  // Degrade condition artificially to 60%
  economy.businessConditions.set("sabon-gari-shop", 60);
  economy.syncEntityMetadata();

  let biz = economy.businesses.get("sabon-gari-shop");
  assert.equal(biz?.condition, 60);
  // Revenue should be scaled down when condition < 70%
  assert.ok((biz?.dailyRevenue ?? 15000) < 15000, "Revenue should be penalized by poor condition");

  // Maintain the business
  const initialCash = playerCash;
  const maintRes = economy.maintainBusiness("sabon-gari-shop", playerCash);
  assert.equal(maintRes.success, true);
  assert.equal(maintRes.cost, 15000);
  assert.equal(maintRes.newCondition, 100);
  playerCash -= maintRes.cost;

  biz = economy.businesses.get("sabon-gari-shop");
  assert.equal(biz?.condition, 100, "Condition restored to 100%");
  assert.equal(biz?.dailyRevenue, 15000, "Daily revenue restored to full nominal value");

  // Verify ledger entry
  const lastTx = economy.transactionHistory[0];
  assert.equal(lastTx.type, "maintenance");
  assert.equal(lastTx.amount, -15000);

  // Attempting maintenance when already at 100% must be rejected cleanly
  const redundantRes = economy.maintainBusiness("sabon-gari-shop", playerCash);
  assert.equal(redundantRes.success, false);
  assert.equal(redundantRes.cost, 0);
  assert.ok(redundantRes.message.includes("already in mint 100%"));

  // Attempting maintenance with insufficient cash must fail
  economy.businessConditions.set("sabon-gari-shop", 50);
  const brokeRes = economy.maintainBusiness("sabon-gari-shop", 500);
  assert.equal(brokeRes.success, false);
  assert.equal(brokeRes.cost, 0);
  assert.ok(brokeRes.message.includes("Insufficient funds"));
});

test("Milestone 3 Phase A.4: Authoritative P&L Financial Statement Generation", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  let playerCash = 10000000;

  // Acquire Sabon Gari Stall (Rev: 15,000, Cost: 5,000)
  const buy1 = economy.purchaseBusiness("sabon-gari-shop", playerCash);
  playerCash -= buy1.cost;

  // Acquire Arewa Suya Lounge (Rev: 40,000, Cost: 10,000)
  const buy2 = economy.purchaseBusiness("arewa-suya-franchise", playerCash);
  playerCash -= buy2.cost;

  // Acquire Unit 2B residential property (Upkeep: 1,200/day, Purchase: 18,000,000 - mock purchase via map)
  const prop = economy.properties.get("unit-2b");
  if (prop) prop.isOwned = true;

  const statement: DailyFinancialStatement = economy.getFinancialStatement(playerCash);

  assert.equal(statement.day, 1);
  assert.equal(statement.grossRevenue, 15000 + 40000, "Gross commercial revenue sum (₦55,000)");
  assert.equal(statement.businessOperatingCosts, 5000 + 10000, "Operating costs sum (₦15,000)");
  assert.equal(statement.propertyUpkeep, 1200, "Property upkeep (₦1,200)");
  assert.equal(statement.municipalTaxes, Math.round(55000 * 0.05), "5% municipal tax on ₦55,000 (₦2,750)");

  // Strict distinction: Gross Revenue vs Net Profit
  assert.notEqual(statement.grossRevenue, statement.netProfit, "Gross revenue must NEVER be confused with net profit");
  assert.equal(
    statement.netProfit,
    statement.grossRevenue - statement.totalExpenses,
    "Net profit = gross revenue - total expenses",
  );

  // Balance sheet verification
  assert.ok(statement.totalEmpireNetWorth > statement.liquidCash, "Net worth includes real estate and business equity");
  assert.equal(
    statement.totalEmpireNetWorth,
    statement.liquidCash + statement.propertyValuation + statement.businessValuation,
    "Empire Net Worth = Liquid Cash + Property Valuation + Business Valuation",
  );
});

test("Milestone 3 Phase A.5: Monthly Financial Summary (30-Day Fiscal Cycle)", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  const playerCash = 500000;

  // Acquire shop
  economy.purchaseBusiness("sabon-gari-shop", playerCash);

  const monthly = economy.getMonthlyFinancialSummary(playerCash);
  assert.equal(monthly.month, 1);
  assert.ok(monthly.periodName.includes("Month 1"));
  assert.equal(monthly.totalRevenue, 15000 * 30, "30-day projected revenue");
  assert.equal(monthly.totalOperatingCosts, 5000 * 30, "30-day operating costs");
  assert.equal(monthly.totalNetProfit, monthly.averageDailyProfit * 30, "30-day projected net profit");
});

test("Milestone 3 Phase A.6: Day Rollover & Event Notification Logging", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  let playerCash = 1000000;
  economy.purchaseBusiness("sabon-gari-shop", playerCash);

  // Day 1 -> Day 2 transition (gameMinutes = 1441)
  const cycleRes = economy.updateDayCycle(1441, playerCash);
  assert.equal(economy.dayCount, 2);
  assert.ok(cycleRes.cashDelta > 0, "Cash delta distributed");

  // Verify financial statement logged to history
  assert.equal(economy.financialHistory.length, 1, "Day 2 statement recorded");
  assert.equal(economy.financialHistory[0].day, 2);

  // Verify business notifications feed logged
  assert.ok(economy.businessNotifications.length > 0, "Business notification logged");
  assert.ok(economy.businessNotifications[0].includes("Day 2"));

  // Verify condition degraded slightly on active business (100 -> 98)
  const cond = economy.businessConditions.get("sabon-gari-shop");
  assert.equal(cond, 98, "Condition experienced 2% operational daily wear");
});

test("Milestone 3 Phase A.7: Save/Load Backward Compatibility & Legacy Fallback", () => {
  setupMockDOM();
  const economy = new EconomySystem();
  let playerCash = 500000;
  economy.purchaseBusiness("sabon-gari-shop", playerCash);
  economy.businessConditions.set("sabon-gari-shop", 88);
  economy.businessReputations.set("sabon-gari-shop", 92);
  economy.businessSatisfaction.set("sabon-gari-shop", 94);

  // Save game
  const saved = economy.saveToStorage(playerCash, 0, false);
  assert.equal(saved, true);

  // Restore into a fresh economy instance
  const restored = new EconomySystem();
  const loaded = restored.loadFromStorage();
  assert.ok(loaded);
  assert.ok(restored.businesses.get("sabon-gari-shop")?.isOwned, "Business ownership preserved");
  assert.equal(restored.businessConditions.get("sabon-gari-shop"), 88, "Condition preserved");
  assert.equal(restored.businessReputations.get("sabon-gari-shop"), 92, "Reputation preserved");
  assert.equal(restored.businessSatisfaction.get("sabon-gari-shop"), 94, "Satisfaction preserved");

  // Now test loading a legacy save without any Phase A fields
  const legacySave = JSON.stringify({
    version: 1,
    cash: 250000,
    ownedBusinesses: ["sabon-gari-shop"],
    businessLevels: { "sabon-gari-shop": 2 },
    dayCount: 5,
  });
  (globalThis as any).window.localStorage.setItem("kano_streets_save_v1", legacySave);

  const legacyEconomy = new EconomySystem();
  const legacyLoaded = legacyEconomy.loadFromStorage();
  assert.ok(legacyLoaded);
  assert.equal(legacyEconomy.businesses.get("sabon-gari-shop")?.isOwned, true);
  assert.equal(legacyEconomy.businesses.get("sabon-gari-shop")?.level, 2);
  // Default fallbacks should be safe
  assert.equal(legacyEconomy.businesses.get("sabon-gari-shop")?.condition, 100, "Default condition fallback 100%");
  assert.ok((legacyEconomy.businesses.get("sabon-gari-shop")?.customerSatisfaction ?? 0) >= 80, "Default satisfaction fallback");
});

