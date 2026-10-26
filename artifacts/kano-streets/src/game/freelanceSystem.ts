import type { FreelanceContract, FreelanceSnapshotInfo } from "./types";

export const FREELANCE_CONTRACT_CATALOG: FreelanceContract[] = [
  {
    id: "freelance_dawanau_inventory",
    title: "Dawanau Wholesale Grain Inventory Database",
    category: "software",
    client: "Dawanau Merchants Cooperative",
    payout: 45000,
    durationMinutes: 40,
    description: "Digitize weekly sorghum, millet, and sesame shipments between Dawanau wholesale depot and regional grain silos.",
    isCompleted: false,
  },
  {
    id: "freelance_kaduna_freight",
    title: "Kano–Kaduna Haulage Fleet Dispatch Optimization",
    category: "logistics",
    client: "Arewa Express Logistics",
    payout: 60000,
    durationMinutes: 50,
    description: "Schedule delivery routing and fuel waybills for interstate articulated trucks avoiding highway bottlenecks.",
    isCompleted: false,
  },
  {
    id: "freelance_sabon_gari_pos",
    title: "Sabon Gari Plaza E-Commerce & POS Integration",
    category: "software",
    client: "Kano Electronics Retail Union",
    payout: 50000,
    durationMinutes: 45,
    description: "Set up instant bank transfer and inventory alerts for multi-stall gadget traders in Sabon Gari commercial market.",
    isCompleted: false,
  },
  {
    id: "freelance_arewa_bank_audit",
    title: "Arewa Commercial Bank ATM Network Security Audit",
    category: "finance",
    client: "Arewa Commercial Bank IT Security",
    payout: 85000,
    durationMinutes: 60,
    description: "Perform vulnerability inspection and latency benchmark on Airport Road ATM terminal endpoints and cash servers.",
    isCompleted: false,
  },
  {
    id: "freelance_bompai_solar_cad",
    title: "Bompai Heights 12-Panel Solar Inverter CAD Layout",
    category: "architecture",
    client: "Sahel Clean Energy Ltd",
    payout: 75000,
    durationMinutes: 45,
    description: "Design 48V pure-sine inverter wiring schematic and photovoltaic rooftop tile distribution for Bompai residential complexes.",
    isCompleted: false,
  },
  {
    id: "freelance_kurmi_crafts_export",
    title: "Kurmi Market Artisans International Export Manifest",
    category: "trading",
    client: "Kano Traditional Guilds Federation",
    payout: 55000,
    durationMinutes: 35,
    description: "Standardize customs declarations and shipping tags for hand-tooled leather bags and indigo dyed textiles from Kurmi Market.",
    isCompleted: false,
  },
  {
    id: "freelance_dala_heritage_archive",
    title: "Dala Ancient City Wall Preservation 3D Model",
    category: "architecture",
    client: "Kano State History & Heritage Bureau",
    payout: 95000,
    durationMinutes: 60,
    description: "Process archival photos and drone surveys of Badala ramparts and Kofar Dala Gate for digital cultural preservation.",
    isCompleted: false,
  },
  {
    id: "freelance_inland_customs_portal",
    title: "Kano Inland Dry Port Manifest Verification Script",
    category: "logistics",
    client: "Kawu Freight & Customs Intermodal",
    payout: 110000,
    durationMinutes: 60,
    description: "Automate container serial verification and cargo release clearance between Lagos Apapa Port and Kawu logistics freight yard.",
    isCompleted: false,
  },
];

export class FreelanceSystem {
  private completedContractIds: Set<string> = new Set();
  public totalEarnings = 0;

  constructor(completedIds: string[] = [], totalEarnings = 0) {
    this.completedContractIds = new Set(completedIds);
    this.totalEarnings = totalEarnings;
  }

  public getAvailableContracts(): FreelanceContract[] {
    return FREELANCE_CONTRACT_CATALOG.filter((c) => !this.completedContractIds.has(c.id)).map((c) => ({
      ...c,
      isCompleted: false,
    }));
  }

  public getCompletedContracts(): FreelanceContract[] {
    return FREELANCE_CONTRACT_CATALOG.filter((c) => this.completedContractIds.has(c.id)).map((c) => ({
      ...c,
      isCompleted: true,
    }));
  }

  public getNextAvailableContract(): FreelanceContract | null {
    const available = this.getAvailableContracts();
    return available.length > 0 ? available[0] : null;
  }

  public isContractCompleted(id: string): boolean {
    return this.completedContractIds.has(id);
  }

  /**
   * Completes a finite freelance contract.
   * Strict anti-farming guarantee: If a contract has already been finalized,
   * it CANNOT pay out again.
   */
  public completeContract(id: string): {
    success: boolean;
    payout: number;
    durationMinutes: number;
    contractTitle?: string;
    message: string;
  } {
    const contract = FREELANCE_CONTRACT_CATALOG.find((c) => c.id === id);
    if (!contract) {
      return {
        success: false,
        payout: 0,
        durationMinutes: 0,
        message: "Freelance contract not found in client registry.",
      };
    }

    if (this.completedContractIds.has(id)) {
      return {
        success: false,
        payout: 0,
        durationMinutes: 0,
        contractTitle: contract.title,
        message: `Contract "${contract.title}" is already completed and archived. Repeat payout strictly blocked.`,
      };
    }

    // Award once
    this.completedContractIds.add(id);
    this.totalEarnings += contract.payout;

    return {
      success: true,
      payout: contract.payout,
      durationMinutes: contract.durationMinutes,
      contractTitle: contract.title,
      message: `Completed "${contract.title}" for ${contract.client}! Earned ₦${contract.payout.toLocaleString()}.`,
    };
  }

  public getSnapshot(): FreelanceSnapshotInfo {
    const next = this.getNextAvailableContract();
    return {
      totalContracts: FREELANCE_CONTRACT_CATALOG.length,
      completedCount: this.completedContractIds.size,
      totalEarnings: this.totalEarnings,
      nextAvailableContract: next,
    };
  }

  public getCompletedIds(): string[] {
    return Array.from(this.completedContractIds);
  }

  public loadSnapshot(completedIds?: string[], earnings?: number) {
    if (Array.isArray(completedIds)) {
      this.completedContractIds = new Set(completedIds);
    }
    if (typeof earnings === "number" && Number.isFinite(earnings)) {
      this.totalEarnings = earnings;
    }
  }
}

