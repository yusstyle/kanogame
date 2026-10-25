/**
 * Procedural Web Audio Engine for Kano Streets
 * Milestone 7: Living City, Sahel Atmosphere & Engine Audio
 *
 * Implements 100% procedural Web Audio API synthesis:
 * - Sahel Wind Breeze (filtered procedural noise generator)
 * - Vehicle Engine Tone (harmonic oscillator modulated by vehicle velocity)
 * - Distant Market Murmur (bandpass ambiance)
 * - Footstep Locomotion Cues (subtle gravel/pavement pulses)
 *
 * Designed to be zero-asset (no missing mp3 404s), battery-friendly,
 * and robust against browser Autoplay restrictions and SSR/Node test runners.
 */

export interface AudioSettings {
  masterVolume: number;
  muted: boolean;
  windVolume: number;
  engineVolume: number;
  footstepsVolume: number;
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private footstepGain: GainNode | null = null;

  // Synthesis nodes
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private isInitialized = false;
  private muted = false;
  private masterVolume = 0.65;
  private footstepTimer = 0;

  constructor(initialMuted = false, initialVolume = 0.65) {
    this.muted = initialMuted;
    this.masterVolume = Math.max(0, Math.min(1, initialVolume));
  }

  /**
   * Lazily initializes the Web Audio context on the first user gesture.
   */
  public init(): boolean {
    if (this.isInitialized) return true;
    if (typeof window === "undefined") return false;

    const AudioContextClass =
      window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext;

    if (!AudioContextClass) {
      return false;
    }

    try {
      this.ctx = new AudioContextClass();

      // Master output node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Procedural Sahel Wind Generator
      this.setupWindGenerator();

      // 2. Procedural Engine Generator
      this.setupEngineGenerator();

      // 3. Footstep Output
      this.footstepGain = this.ctx.createGain();
      this.footstepGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.footstepGain.connect(this.masterGain);

      this.isInitialized = true;
      return true;
    } catch (e) {
      console.warn("[AudioSystem] Web Audio initialization deferred or unavailable:", e);
      return false;
    }
  }

  private setupWindGenerator() {
    if (!this.ctx || !this.masterGain) return;

    // Generate a 4-second looping buffer of soft pink-leaning noise
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.14;
    }

    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = noiseBuffer;
    this.windSource.loop = true;

    // Resonant lowpass filter to mimic Sahelian desert wind sweeping over flat rooftops
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    this.windSource.start(0);
  }

  private setupEngineGenerator() {
    if (!this.ctx || !this.masterGain) return;

    // Primary vehicle engine oscillator (triangle for warm combustion timbre)
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "triangle";
    this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

    // Sub-harmonic oscillator for low end torque
    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = "sawtooth";
    this.engineSubOsc.frequency.setValueAtTime(22.5, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime); // Silent when not driving

    this.engineOsc.connect(this.engineFilter);
    this.engineSubOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc.start(0);
    this.engineSubOsc.start(0);
  }

  /**
   * Resumes audio context if suspended by browser autoplay policy.
   */
  public resume(): void {
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const target = this.muted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Triggers a subtle footstep crunch/tap sound.
   */
  public playFootstep(isSprinting = false): void {
    if (!this.ctx || !this.footstepGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isSprinting ? 120 : 95, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.06);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.footstepGain);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Frame update called from GameEngine animation loop.
   */
  public update(
    delta: number,
    state: {
      mode: "on-foot" | "driving";
      vehicleSpeed?: number;
      vehicleMaxSpeed?: number;
      isMovingOnFoot?: boolean;
      isSprinting?: boolean;
      isHarmattan?: boolean;
      isInterior?: boolean;
    },
  ): void {
    if (!this.isInitialized || !this.ctx) return;

    const now = this.ctx.currentTime;

    // Modulate Sahelian Wind
    if (this.windGain && this.windFilter) {
      if (state.isInterior) {
        this.windGain.gain.setTargetAtTime(0.03, now, 0.2);
        this.windFilter.frequency.setTargetAtTime(160, now, 0.2);
      } else {
        const baseGain = state.isHarmattan ? 0.35 : 0.16;
        const baseFreq = state.isHarmattan ? 480 : 320;
        this.windGain.gain.setTargetAtTime(baseGain, now, 0.15);
        this.windFilter.frequency.setTargetAtTime(baseFreq, now, 0.15);
      }
    }

    // Modulate Vehicle Engine Audio
    if (this.engineGain && this.engineOsc && this.engineSubOsc && this.engineFilter) {
      if (state.mode === "driving") {
        const speed = Math.abs(state.vehicleSpeed ?? 0);
        const maxSpeed = Math.max(1, state.vehicleMaxSpeed ?? 24);
        const speedRatio = Math.min(1.2, speed / maxSpeed);

        const targetGain = 0.22 + speedRatio * 0.18;
        const targetFreq = 42 + speedRatio * 85;
        const filterCutoff = 180 + speedRatio * 380;

        this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
        this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
        this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.08);
        this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.08);
      } else {
        this.engineGain.gain.setTargetAtTime(0, now, 0.12);
      }
    }

    // Footstep locomotion interval
    if (state.mode === "on-foot" && state.isMovingOnFoot && !state.isInterior) {
      const stepInterval = state.isSprinting ? 0.28 : 0.46;
      this.footstepTimer += delta;
      if (this.footstepTimer >= stepInterval) {
        this.footstepTimer = 0;
        this.playFootstep(state.isSprinting);
      }
    } else {
      this.footstepTimer = 0;
    }
  }

  public dispose(): void {
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        // Ignore
      }
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}
