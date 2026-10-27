import * as THREE from "three";

export type WeatherPreset = "clear" | "harmattan" | "sunset_glow" | "cool_night";

export interface WeatherConfig {
  preset: WeatherPreset;
  displayName: string;
  skyColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  particleCount: number;
  particleOpacity: number;
  particleSize: number;
  windSpeed: { x: number; y: number; z: number };
}

export const WEATHER_CONFIGS: Record<WeatherPreset, WeatherConfig> = {
  clear: {
    preset: "clear",
    displayName: "Clear Sahel Sky",
    skyColor: "#dcd4c3",
    fogColor: "#dcd4c3",
    fogNear: 45,
    fogFar: 235,
    sunColor: "#fff8ed",
    sunIntensity: 2.7,
    hemiSkyColor: "#d8e8f2",
    hemiGroundColor: "#7a5e42",
    hemiIntensity: 1.45,
    particleCount: 80,
    particleOpacity: 0.12,
    particleSize: 0.28,
    windSpeed: { x: 0.4, y: -0.05, z: 0.6 },
  },
  harmattan: {
    preset: "harmattan",
    displayName: "Harmattan Dust Haze",
    skyColor: "#ceb68e",
    fogColor: "#ceb68e",
    fogNear: 24,
    fogFar: 165,
    sunColor: "#eed090",
    sunIntensity: 2.1,
    hemiSkyColor: "#e0cbb2",
    hemiGroundColor: "#91704d",
    hemiIntensity: 1.55,
    particleCount: 220,
    particleOpacity: 0.58,
    particleSize: 0.42,
    windSpeed: { x: 1.8, y: -0.12, z: 2.2 },
  },
  sunset_glow: {
    preset: "sunset_glow",
    displayName: "Golden Sunset Glow",
    skyColor: "#df8855",
    fogColor: "#d97843",
    fogNear: 35,
    fogFar: 200,
    sunColor: "#ff9033",
    sunIntensity: 2.4,
    hemiSkyColor: "#f7ad72",
    hemiGroundColor: "#7e4024",
    hemiIntensity: 1.35,
    particleCount: 100,
    particleOpacity: 0.22,
    particleSize: 0.32,
    windSpeed: { x: 0.6, y: -0.04, z: 0.8 },
  },
  cool_night: {
    preset: "cool_night",
    displayName: "Cool Starlit Night",
    skyColor: "#0b1424",
    fogColor: "#0b1424",
    fogNear: 28,
    fogFar: 175,
    sunColor: "#4a6890",
    sunIntensity: 0.38,
    hemiSkyColor: "#15243d",
    hemiGroundColor: "#101924",
    hemiIntensity: 0.65,
    particleCount: 60,
    particleOpacity: 0.15,
    particleSize: 0.25,
    windSpeed: { x: 0.3, y: -0.02, z: 0.4 },
  },
};

export class WeatherSystem {
  public currentPreset: WeatherPreset = "clear";
  public readonly particleGroup: THREE.Group;
  private readonly particleGeometry: THREE.BufferGeometry;
  private readonly particleMaterial: THREE.PointsMaterial;
  private readonly particles: THREE.Points;
  private readonly particlePositions: Float32Array;
  private readonly particleVelocities: Float32Array;
  private readonly maxParticles = 250;
  private activeCount = 80;
  private boundsRadius = 38;
  private boundsHeight = 14;
  private center = new THREE.Vector3();

  // Cached color objects to avoid runtime GC allocations
  private readonly colSky = new THREE.Color();
  private readonly colFog = new THREE.Color();
  private readonly colSun = new THREE.Color();
  private readonly colHemiSky = new THREE.Color();
  private readonly colHemiGround = new THREE.Color();
  private readonly tmpNightSky = new THREE.Color("#0b1424");
  private readonly tmpNightSun = new THREE.Color("#4a6890");
  private readonly tmpDawnSky = new THREE.Color("#df9c72");
  private readonly tmpDawnFog = new THREE.Color("#d28d63");
  private readonly tmpDawnSun = new THREE.Color("#ffd49c");
  private readonly tmpSunsetSky = new THREE.Color("#df8855");
  private readonly tmpSunsetFog = new THREE.Color("#d97843");
  private readonly tmpSunsetSun = new THREE.Color("#ff9033");

  constructor(initialPreset: WeatherPreset = "clear") {
    this.currentPreset = initialPreset;
    this.particleGroup = new THREE.Group();
    this.particleGroup.name = "WeatherParticleGroup";

    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleVelocities = new Float32Array(this.maxParticles * 3);

    for (let i = 0; i < this.maxParticles; i += 1) {
      const idx = i * 3;
      this.particlePositions[idx] = (Math.random() - 0.5) * this.boundsRadius * 2;
      this.particlePositions[idx + 1] = Math.random() * this.boundsHeight;
      this.particlePositions[idx + 2] = (Math.random() - 0.5) * this.boundsRadius * 2;

      this.particleVelocities[idx] = 0.5 + Math.random() * 1.5;
      this.particleVelocities[idx + 1] = -0.05 - Math.random() * 0.15;
      this.particleVelocities[idx + 2] = 0.8 + Math.random() * 1.8;
    }

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.particlePositions, 3),
    );

    this.particleMaterial = new THREE.PointsMaterial({
      color: "#c9ae87",
      size: 0.35,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });

    this.particles = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.particles.frustumCulled = false;
    this.particleGroup.add(this.particles);

    this.applyPreset(this.currentPreset);
  }

  public getPreset(): WeatherPreset {
    return this.currentPreset;
  }

  public getPresetDisplayName(preset?: WeatherPreset): string {
    const target = preset ?? this.currentPreset;
    return WEATHER_CONFIGS[target]?.displayName ?? target;
  }

  public setPreset(preset: WeatherPreset): void {
    if (!WEATHER_CONFIGS[preset]) return;
    this.currentPreset = preset;
    this.applyPreset(preset);
  }

  public cyclePreset(): WeatherPreset {
    const sequence: WeatherPreset[] = ["clear", "harmattan", "sunset_glow", "cool_night"];
    const currentIndex = sequence.indexOf(this.currentPreset);
    const nextIndex = (currentIndex + 1) % sequence.length;
    this.setPreset(sequence[nextIndex]);
    return this.currentPreset;
  }

  private applyPreset(preset: WeatherPreset): void {
    const config = WEATHER_CONFIGS[preset];
    if (!config) return;

    this.activeCount = config.particleCount;
    this.particleMaterial.opacity = config.particleOpacity;
    this.particleMaterial.size = config.particleSize;

    if (preset === "harmattan") {
      this.particleMaterial.color.set("#d4ba92");
    } else if (preset === "sunset_glow") {
      this.particleMaterial.color.set("#d98a58");
    } else if (preset === "cool_night") {
      this.particleMaterial.color.set("#4e637e");
    } else {
      this.particleMaterial.color.set("#c9ae87");
    }

    this.particleGeometry.setDrawRange(0, this.activeCount);
  }

  public applyToScene(
    scene: THREE.Scene,
    sunLight: THREE.DirectionalLight | null,
    hemiLight: THREE.HemisphereLight | null,
    hourOfDay: number,
    isInterior: boolean,
  ): void {
    if (isInterior) {
      if (scene.fog && scene.fog instanceof THREE.Fog) {
        scene.fog.near = 15;
        scene.fog.far = 85;
        scene.fog.color.set("#1f1a14");
      }
      if (sunLight) {
        sunLight.intensity = 0.2;
      }
      if (hemiLight) {
        hemiLight.intensity = 0.5;
        hemiLight.color.set("#ffe6cc");
        hemiLight.groundColor.set("#332211");
      }
      this.particles.visible = false;
      return;
    }

    this.particles.visible = true;
    const config = WEATHER_CONFIGS[this.currentPreset];

    // Diurnal factor calculation: 6:00 to 18:00 is daytime
    const isDay = hourOfDay >= 6 && hourOfDay <= 18;
    const diurnalFactor = isDay ? Math.sin(((hourOfDay - 6) / 12) * Math.PI) : 0.08;

    let effectiveSunIntensity = config.sunIntensity * (0.35 + 0.65 * diurnalFactor);
    let effectiveHemiIntensity = config.hemiIntensity * (0.45 + 0.55 * diurnalFactor);

    // Initialize with base config colors
    this.colSky.set(config.skyColor);
    this.colFog.set(config.fogColor);
    this.colSun.set(config.sunColor);
    this.colHemiSky.set(config.hemiSkyColor);
    this.colHemiGround.set(config.hemiGroundColor);

    if (this.currentPreset === "clear" || this.currentPreset === "harmattan") {
      if (hourOfDay >= 5.0 && hourOfDay < 6.8) {
        // 1. Dawn transition: Night -> Sahelian Dawn Peach -> Daylight
        const dawnRatio = (hourOfDay - 5.0) / 1.8;
        if (dawnRatio < 0.5) {
          const t = dawnRatio * 2.0;
          this.colSky.copy(this.tmpNightSky).lerp(this.tmpDawnSky, t);
          this.colFog.copy(this.tmpNightSky).lerp(this.tmpDawnFog, t);
          this.colSun.copy(this.tmpNightSun).lerp(this.tmpDawnSun, t);
        } else {
          const t = (dawnRatio - 0.5) * 2.0;
          const targetSky = new THREE.Color(config.skyColor);
          const targetFog = new THREE.Color(config.fogColor);
          const targetSun = new THREE.Color(config.sunColor);
          this.colSky.copy(this.tmpDawnSky).lerp(targetSky, t);
          this.colFog.copy(this.tmpDawnFog).lerp(targetFog, t);
          this.colSun.copy(this.tmpDawnSun).lerp(targetSun, t);
        }
        effectiveSunIntensity = 0.35 + 1.8 * dawnRatio;
        effectiveHemiIntensity = 0.6 + 0.8 * dawnRatio;
      } else if (hourOfDay >= 17.2 && hourOfDay < 19.2) {
        // 2. Sunset glow transition: Daylight -> Amber Golden Glow
        const sunsetRatio = (hourOfDay - 17.2) / 2.0;
        this.colSky.lerp(this.tmpSunsetSky, sunsetRatio);
        this.colFog.lerp(this.tmpSunsetFog, sunsetRatio);
        this.colSun.lerp(this.tmpSunsetSun, sunsetRatio);
        effectiveSunIntensity = config.sunIntensity * (0.85 - 0.3 * sunsetRatio);
      } else if (hourOfDay >= 19.2 && hourOfDay < 20.6) {
        // 3. Dusk into Night: Sunset Glow -> Starlit Night
        const duskRatio = (hourOfDay - 19.2) / 1.4;
        this.colSky.copy(this.tmpSunsetSky).lerp(this.tmpNightSky, duskRatio);
        this.colFog.copy(this.tmpSunsetFog).lerp(this.tmpNightSky, duskRatio);
        this.colSun.copy(this.tmpSunsetSun).lerp(this.tmpNightSun, duskRatio);
        effectiveSunIntensity = 1.4 - 1.05 * duskRatio;
        effectiveHemiIntensity = 1.1 - 0.5 * duskRatio;
      } else if (hourOfDay >= 20.6 || hourOfDay < 5.0) {
        // 4. Starlit Sahelian Night
        this.colSky.copy(this.tmpNightSky);
        this.colFog.copy(this.tmpNightSky);
        this.colSun.copy(this.tmpNightSun);
        effectiveSunIntensity = 0.35;
        effectiveHemiIntensity = 0.65;
      }
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(this.colSky);
    } else {
      scene.background = this.colSky.clone();
    }

    if (scene.fog && scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(this.colFog);
      scene.fog.near = config.fogNear;
      scene.fog.far = config.fogFar;
    }

    if (sunLight) {
      sunLight.color.copy(this.colSun);
      sunLight.intensity = effectiveSunIntensity;
    }

    if (hemiLight) {
      hemiLight.color.copy(this.colHemiSky);
      hemiLight.groundColor.copy(this.colHemiGround);
      hemiLight.intensity = effectiveHemiIntensity;
    }
  }

  public update(delta: number, centerPos?: THREE.Vector3): void {
    if (centerPos) {
      this.center.copy(centerPos);
      this.particleGroup.position.copy(centerPos);
    }

    const config = WEATHER_CONFIGS[this.currentPreset];
    const windX = config.windSpeed.x * delta * 4.0;
    const windY = config.windSpeed.y * delta * 4.0;
    const windZ = config.windSpeed.z * delta * 4.0;

    const positions = this.particlePositions;
    const halfRadius = this.boundsRadius;

    for (let i = 0; i < this.activeCount; i += 1) {
      const idx = i * 3;
      positions[idx] += windX;
      positions[idx + 1] += windY;
      positions[idx + 2] += windZ;

      // Wrap around bounds centered at local origin (particleGroup is positioned at center)
      if (positions[idx] > halfRadius) {
        positions[idx] = -halfRadius;
      } else if (positions[idx] < -halfRadius) {
        positions[idx] = halfRadius;
      }

      if (positions[idx + 1] < 0) {
        positions[idx + 1] = this.boundsHeight;
      } else if (positions[idx + 1] > this.boundsHeight) {
        positions[idx + 1] = 0;
      }

      if (positions[idx + 2] > halfRadius) {
        positions[idx + 2] = -halfRadius;
      } else if (positions[idx + 2] < -halfRadius) {
        positions[idx + 2] = halfRadius;
      }
    }

    const attr = this.particleGeometry.getAttribute("position") as THREE.BufferAttribute;
    if (attr) {
      attr.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
  }
}
