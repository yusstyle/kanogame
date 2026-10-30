import type { CareerPathChoice, InvestigationChoice, StoryProgressData, StorySnapshotInfo } from "./types";

export interface IndentureDocument {
  title: string;
  date: string;
  parties: string[];
  content: string;
  seals: string[];
  historicalNotes: string;
}

export const INDENTURE_1968: IndentureDocument = {
  title: "1968 TRANS-SAHARAN COMMERCIAL PARTNERSHIP INDENTURE",
  date: "14th Safar 1388 AH / 12th May 1968 CE",
  parties: [
    "Alhaji Muhammadu Dan-Kano (Trading Elder, Dala Quarters)",
    "Malam Bello Sanusi (Caravan Master & Groundnut Factor, Bompai)",
    "Monsieur Jean-Luc Dupuis (Sahelian Cross-Border Freight Agent, Niamey / Kano)",
  ],
  content: `BE IT KNOWN TO ALL MERCHANTS AND ELDERS that under the ancient customs of Kasuwar Kurmi and the sovereign laws of the Northern Region of Nigeria, the Trading House of Dan-Kano establishes an inviolable commercial pact:

1. The Dan-Kano Ancestral Zaure and adjoining storage courtyards at Tudun Dala shall remain forever bonded to the family lineage, free from alien partition or speculative encumbrance.
2. In exchange for the cross-desert transport consortium traversing Kano, Zinder, and Agadez, fifteen parcels of registered warehouse certificates were lodged within the British-West African Commercial vault under dual seal.
3. Should commercial lineage fall into question, restoration shall be witnessed either through the oral council of the Dandali Clan Elders or through the colonial-era ledger archives preserved at Arewa Commercial Bank.
4. An engraved master key of ancient cast brass, inscribed with the Sahelian trade emblem, remains sequestered until an heir of rightful vision steps forward to reunite the heritage of Kano with modern enterprise.`,
  seals: [
    "Embossed Northern Region Stamp #NR-68-0419",
    "Wax Seal of the Kano Traditional Leather Guild",
    "Signature of Alhaji Muhammadu Dan-Kano in Ajami & English",
  ],
  historicalNotes:
    "This historic deed represents the pivotal transition of Kano's ancient merchant dynasties into modern post-independence West African logistics and banking.",
};

export class StorySystem {
  private progress: StoryProgressData;

  constructor(saved?: Partial<StoryProgressData>) {
    this.progress = {
      chapter: 1,
      stage: 0,
      investigationChoice: null,
      careerPath: null,
      careerPathChoice: null,
      indentureDiscovered: false,
      elderTrust: 10,
      cluesFound: [],
      completed: false,
      rewardClaimed: false,
      timestamp: Date.now(),
    };

    if (saved) {
      this.loadProgress(saved);
    }
  }

  public getProgress(): StoryProgressData {
    return { ...this.progress, cluesFound: [...this.progress.cluesFound] };
  }

  public loadProgress(saved: Partial<StoryProgressData>) {
    this.progress = {
      chapter: saved.chapter ?? 1,
      stage: saved.stage ?? 0,
      investigationChoice: saved.investigationChoice ?? null,
      careerPath: saved.careerPath ?? saved.careerPathChoice ?? null,
      careerPathChoice: saved.careerPathChoice ?? saved.careerPath ?? null,
      indentureDiscovered: saved.indentureDiscovered ?? false,
      elderTrust: saved.elderTrust ?? 10,
      cluesFound: saved.cluesFound ? [...saved.cluesFound] : [],
      completed: saved.completed ?? (saved.stage !== undefined && saved.stage >= 4),
      rewardClaimed: saved.rewardClaimed ?? false,
      timestamp: saved.timestamp ?? Date.now(),
    };
  }

  // Stage 0 -> Stage 1: Malam Kabiru summons player & hands over 1968 Indenture
  public examineIndenture(): { success: boolean; message: string } {
    if (this.progress.stage > 0 && this.progress.indentureDiscovered) {
      return { success: true, message: "You review the 1968 Trans-Saharan Partnership Indenture." };
    }

    this.progress.stage = 1;
    this.progress.indentureDiscovered = true;
    if (!this.progress.cluesFound.includes("1968_trans_saharan_indenture")) {
      this.progress.cluesFound.push("1968_trans_saharan_indenture");
    }
    this.progress.timestamp = Date.now();

    return {
      success: true,
      message:
        "Malam Kabiru Dan-Kano presents the 1968 Trans-Saharan Partnership Indenture! You discover the ancient title deeds of the family trading house.",
    };
  }

  // Stage 1 -> Stage 2: Decision 1 - Investigation Path
  public chooseInvestigation(choice: "elders" | "bank"): {
    success: boolean;
    message: string;
    bonusCash: number;
    trustGain: number;
  } {
    if (this.progress.stage < 1) {
      return {
        success: false,
        message: "You must first visit Malam Kabiru at Dan-Kano Compound to receive the Indenture.",
        bonusCash: 0,
        trustGain: 0,
      };
    }

    if (this.progress.investigationChoice !== null) {
      return {
        success: false,
        message: `You have already investigated via the ${this.progress.investigationChoice === "elders" ? "Clan Elders" : "Arewa Commercial Bank"}.`,
        bonusCash: 0,
        trustGain: 0,
      };
    }

    this.progress.investigationChoice = choice;
    this.progress.stage = 2;
    this.progress.timestamp = Date.now();

    let bonusCash = 0;
    let trustGain = 0;
    let message = "";

    if (choice === "elders") {
      trustGain = 25;
      this.progress.elderTrust = (this.progress.elderTrust ?? 10) + trustGain;
      if (!this.progress.cluesFound.includes("elders_oral_testimony")) {
        this.progress.cluesFound.push("elders_oral_testimony");
      }
      message =
        "The Dandali Clan Elders recount decades of honest trade, verifying your ancestral pedigree (+25 Elder Trust).";
    } else {
      bonusCash = 10000;
      if (!this.progress.cluesFound.includes("bank_colonial_ledger")) {
        this.progress.cluesFound.push("bank_colonial_ledger");
      }
      message =
        "Arewa Commercial Bank audits the 1968 colonial ledger, validating the commercial credit line (+₦10,000 Bank Credit).";
    }

    return { success: true, message, bonusCash, trustGain };
  }

  // Stage 2 -> Stage 3: Decision 2 - Foundation of Business Empire
  public chooseCareerPath(choice: CareerPathChoice): {
    success: boolean;
    message: string;
    perkDescription: string;
  } {
    if (this.progress.stage < 2) {
      return {
        success: false,
        message: "You must complete the title investigation before founding your commercial venture.",
        perkDescription: "",
      };
    }

    if (this.progress.careerPathChoice !== null) {
      return {
        success: false,
        message: `Your career path is already established as ${(this.progress.careerPathChoice ?? "").toUpperCase()}.`,
        perkDescription: "",
      };
    }

    if (!choice) {
      return { success: false, message: "Invalid career choice.", perkDescription: "" };
    }

    this.progress.careerPath = choice;
    this.progress.careerPathChoice = choice;
    this.progress.stage = 3;
    this.progress.timestamp = Date.now();

    let perkDescription = "";
    switch (choice) {
      case "transport":
        perkDescription = "Kawu Industrial Freight Bonus: +15% payout on all freight deliveries";
        break;
      case "trading":
        perkDescription = "Kasuwar Kurmi Artisan Margin: +15% profit on all market trade goods";
        break;
      case "technology":
        perkDescription = "Cyber Hub Tech Consulting: +20% revenue from gaming and electronics services";
        break;
      case "property":
        perkDescription = "Arewa Real Estate Syndicate: 10% acquisition discount on all city properties";
        break;
    }

    if (!this.progress.cluesFound.includes(`career_foundation_${choice}`)) {
      this.progress.cluesFound.push(`career_foundation_${choice}`);
    }

    return {
      success: true,
      message: `Commercial foundation established in ${choice.toUpperCase()}! ${perkDescription}`,
      perkDescription,
    };
  }

  // Stage 3 -> Stage 4: Resolution & Chapter 1 Completion
  public resolveChapter1(): {
    success: boolean;
    message: string;
    payout: number;
    storyXP: number;
    unlockedKey: string;
  } {
    if (this.progress.stage < 3) {
      return {
        success: false,
        message: "You must establish your commercial career foundation before concluding Chapter 1.",
        payout: 0,
        storyXP: 0,
        unlockedKey: "",
      };
    }

    this.progress.stage = 4;
    this.progress.completed = true;
    this.progress.timestamp = Date.now();

    if (this.progress.rewardClaimed) {
      return {
        success: true,
        message: "Chapter 1 is already completed. The Dan-Kano title has been fully secured.",
        payout: 0,
        storyXP: 0,
        unlockedKey: "BRONZE_VAULT_KEY_SAHEL_1968",
      };
    }

    this.progress.rewardClaimed = true;
    const payout = 50000;
    const storyXP = 250;
    const unlockedKey = "BRONZE_VAULT_KEY_SAHEL_1968";

    if (!this.progress.cluesFound.includes("chapter_1_secured_title")) {
      this.progress.cluesFound.push("chapter_1_secured_title");
    }

    return {
      success: true,
      message:
        "CHAPTER 1 COMPLETED: 'Roots in the Ancient Dust'! The Dan-Kano Ancestral Compound is fully titled to your name. You receive ₦50,000 and discover the mysterious Bronze Sahel Vault Key!",
      payout,
      storyXP,
      unlockedKey,
    };
  }

  public getSnapshotInfo(playerPos?: { x: number; z: number }): StorySnapshotInfo {
    let stageName = "Uninitiated";
    let currentObjective = "Visit Malam Kabiru at Dan-Kano Ancestral Zaure in Dala Quarters";
    let targetCoords = { x: -85, z: -68 };
    let targetLandmarkId = "dan-kano-compound";
    let canInvestigate = false;
    let canChooseCareer = false;
    const isComplete = this.progress.stage >= 4;

    switch (this.progress.stage) {
      case 0:
        stageName = "The Summons";
        currentObjective = "Find Malam Kabiru Dan-Kano at Dan-Kano Ancestral Zaure (-85, -68)";
        targetCoords = { x: -85, z: -68 };
        targetLandmarkId = "dan-kano-compound";
        break;
      case 1:
        stageName = "The Title Dispute";
        currentObjective =
          "Investigate ancestral deed: Consult Clan Elders at Dandali (-72, -72) OR Bank Auditor at Arewa Bank (80, -22)";
        canInvestigate = true;
        targetCoords = { x: -72, z: -72 };
        targetLandmarkId = "dandali-square";
        break;
      case 2:
        stageName = "Foundations of an Empire";
        currentObjective = "Choose your commercial foundation: Transport, Trading, Tech, or Real Estate";
        canChooseCareer = true;
        targetCoords = { x: -85, z: -68 };
        targetLandmarkId = "dan-kano-compound";
        break;
      case 3:
        stageName = "Ratification of Heritage";
        currentObjective = "Return to Dan-Kano Ancestral Zaure (-85, -68) to seal title and claim legacy";
        targetCoords = { x: -85, z: -68 };
        targetLandmarkId = "dan-kano-compound";
        break;
      case 4:
      default:
        stageName = "Chapter 1 Secured";
        currentObjective = "Ancestral title secured. Prepare for Chapter 2: 'Shadows Over the Sahel'.";
        targetCoords = { x: -85, z: -68 };
        targetLandmarkId = "dan-kano-compound";
        break;
    }

    const distanceMeters = playerPos
      ? Math.round(Math.hypot(targetCoords.x - playerPos.x, targetCoords.z - playerPos.z))
      : 0;

    return {
      chapter: this.progress.chapter,
      chapterTitle: "Chapter 1: Roots in the Ancient Dust",
      stage: this.progress.stage,
      stageTitle: stageName,
      stageName,
      objective: currentObjective,
      currentObjective,
      instruction: currentObjective,
      targetName: targetLandmarkId,
      targetCoords,
      targetLandmarkId,
      distanceMeters,
      canInvestigate,
      canChooseCareer,
      isComplete,
      completed: isComplete,
      indentureDiscovered: this.progress.indentureDiscovered ?? false,
      investigationChoice: this.progress.investigationChoice,
      careerPath: this.progress.careerPath,
      careerPathChoice: this.progress.careerPathChoice,
      canInspectIndenture: this.progress.indentureDiscovered ?? false,
    };
  }

  public getCareerPerkDescription(choice: CareerPathChoice): string {
    switch (choice) {
      case "transport":
        return "+15% Freight contract payout bonus";
      case "trading":
        return "+15% Retail goods trading profit margin";
      case "technology":
        return "+20% Gaming & tech services revenue";
      case "property":
        return "10% Acquisition discount on real estate purchases";
      default:
        return "No career perk selected";
    }
  }
}

