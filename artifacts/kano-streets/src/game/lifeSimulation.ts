import type { NeedsState } from "./types";

export class LifeSimulationSystem {
  public hunger = 85;
  public energy = 90;
  public hygiene = 85;

  // Base decay rates per real second (~60 real seconds = 1 in-game hour)
  // ~3 hunger/hr, ~2.5 energy/hr, ~2 hygiene/hr
  private baseHungerDecayRate = 0.05;
  private baseEnergyDecayRate = 0.04;
  private baseHygieneDecayRate = 0.03;

  constructor(initial?: Partial<NeedsState>) {
    if (initial) {
      this.loadSnapshot(initial);
    }
  }

  public update(dtSeconds: number, isRunning: boolean, isDriving: boolean, isIndoors: boolean) {
    if (dtSeconds <= 0 || !Number.isFinite(dtSeconds)) return;

    // Running burns energy faster (1.8x); driving is low exertion (0.8x)
    let energyMultiplier = 1.0;
    if (isRunning) energyMultiplier = 1.8;
    else if (isDriving) energyMultiplier = 0.8;

    // Outdoors in Kano heat/Harmattan dust slightly accelerates hunger and hygiene decay
    const outdoorDustFactor = isIndoors ? 0.7 : 1.1;

    this.hunger = Math.max(0, this.hunger - this.baseHungerDecayRate * dtSeconds * outdoorDustFactor);
    this.energy = Math.max(0, this.energy - this.baseEnergyDecayRate * dtSeconds * energyMultiplier);
    this.hygiene = Math.max(0, this.hygiene - this.baseHygieneDecayRate * dtSeconds * outdoorDustFactor);
  }

  public eatFood(amount = 40, foodLabel = "Meal"): { success: boolean; hungerGained: number; message: string } {
    const prev = this.hunger;
    this.hunger = Math.min(100, this.hunger + amount);
    const gained = Math.round(this.hunger - prev);
    // Eating also gives a slight energy perk (+5)
    this.energy = Math.min(100, this.energy + 5);
    return {
      success: true,
      hungerGained: gained,
      message: `Ate ${foodLabel}! Hunger restored (+${gained}%). Currently: ${Math.round(this.hunger)}%.`,
    };
  }

  public sleep(hours = 6): { success: boolean; message: string } {
    this.energy = 100;
    // Natural metabolic depletion during sleep (capped so player never awakens in distress)
    this.hunger = Math.max(25, this.hunger - hours * 2.5);
    return {
      success: true,
      message: `You slept soundly for ${hours} hours. Energy fully replenished to 100%!`,
    };
  }

  public shower(amenityLabel = "Bathroom Shower"): { success: boolean; message: string } {
    this.hygiene = 100;
    // Showering provides a small refreshing boost (+5 energy)
    this.energy = Math.min(100, this.energy + 5);
    return {
      success: true,
      message: `Freshened up at ${amenityLabel}. Hygiene restored to 100%! Ready for the day.`,
    };
  }

  public getSpeedMultiplier(): number {
    if (this.energy < 20 || this.hunger < 20) {
      // Gentle non-punitive penalty: 15% reduction
      return 0.85;
    }
    if (this.energy >= 70 && this.hunger >= 70) {
      // Well-nourished bonus
      return 1.05;
    }
    return 1.0;
  }

  public getStatusPrompt(): string | null {
    if (this.energy < 20) {
      return "Fatigued: Rest in a bed at your residence to restore full energy.";
    }
    if (this.hunger < 20) {
      return "Hungry: Grab food at Arewa Suya Lounge, roadside Mai Shayi, or your home kitchen.";
    }
    if (this.hygiene < 20) {
      return "Dusty: Take a shower in your bathroom to freshen up.";
    }
    return null;
  }

  public getSnapshot(): NeedsState {
    return {
      hunger: Math.round(this.hunger),
      energy: Math.round(this.energy),
      hygiene: Math.round(this.hygiene),
    };
  }

  public loadSnapshot(data?: Partial<NeedsState>) {
    if (!data) return;
    if (typeof data.hunger === "number" && Number.isFinite(data.hunger)) {
      this.hunger = Math.max(0, Math.min(100, data.hunger));
    }
    if (typeof data.energy === "number" && Number.isFinite(data.energy)) {
      this.energy = Math.max(0, Math.min(100, data.energy));
    }
    if (typeof data.hygiene === "number" && Number.isFinite(data.hygiene)) {
      this.hygiene = Math.max(0, Math.min(100, data.hygiene));
    }
  }
}

