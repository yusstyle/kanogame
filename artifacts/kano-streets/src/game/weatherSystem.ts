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

    // Harmonize weather preset with natural time of day
    let effectiveSky = config.skyColor;
    let effectiveFog = config.fogColor;
    let effectiveSun = config.sunColor;
    let effectiveSunIntensity = config.sunIntensity * (0.35 + 0.65 * diurnalFactor);
    let effectiveHemiIntensity = config.hemiIntensity * (0.45 + 0.55 * diurnalFactor);

    if (this.currentPreset === "clear" || this.currentPreset === "harmattan") {
      if (hourOfDay >= 17.5 && hourOfDay <= 19.2) {
        // Evening transition towards sunset glow
        const sunsetRatio = Math.min(1, Math.max(0, (hourOfDay - 17.5) / 1.7));
        effectiveSky = sunsetRatio > 0.5 ? "#df8855" : config.skyColor;
        effectiveFog = sunsetRatio > 0.5 ? "#d97843" : config.fogColor;
      } else if (hourOfDay < 5.8 || hourOfDay > 19.5) {
        // Night transition
        effectiveSky = "#0b1424";
        effectiveFog = "#0b1424";
        effectiveSun = "#4a6890";
        effectiveSunIntensity = 0.35;
        effectiveHemiIntensity = 0.6;
      }
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.set(effectiveSky);
    } else {
      scene.background = new THREE.Color(effectiveSky);
    }

    if (scene.fog && scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(effectiveFog);
      scene.fog.near = config.fogNear;
      scene.fog.far = config.fogFar;
    }

    if (sunLight) {
      sunLight.color.set(effectiveSun);
      sunLight.intensity = effectiveSunIntensity;
    }

    if (hemiLight) {
      hemiLight.color.set(config.hemiSkyColor);
      hemiLight.groundColor.set(config.hemiGroundColor);
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
