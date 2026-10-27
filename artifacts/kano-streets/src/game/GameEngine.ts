import * as THREE from "three";
import {
  createCarModel,
  createKekeModel,
  createPlayerModel,
  createDeliveryVanModel,
  createPickupTruckModel,
  createMinibusModel,
  createFreightTruckModel,
  type CarModel,
  type KekeModel,
  type PlayerModel,
  type UsableVehicleModel,
} from "./actors";
import { loadGLTFModel, loadHumanoidCharacter } from "./assetManifest";
import { BuildingInteriorManager } from "./BuildingInteriors";
import { ColliderIndex } from "./ColliderIndex";
import { getDistrict, getDistrictLabel, ROAD_LAYOUT } from "./layout";
import { createMaterials } from "./materials";
import { buildNavigationNetwork, type NavigationNetwork } from "./navigation";
import { PedestrianSystem } from "./PedestrianSystem";
import { TrafficSystem } from "./TrafficSystem";
import { createWorld } from "./world";
import type { Collider, GameMode, GameScreen, GameSnapshot, GraphicsQuality, SocialContact, VehicleType, CareerPathChoice, PropertyId, InteriorId, FurnitureInstance, HomeNavInfo, PlayerHomeEntry } from "./types";
import { SocialSystem } from "./socialSystem";
import { EconomySystem, normalizePropertyId } from "./economySystem";
import { KANO_LANDMARKS, getNearestLandmark, getGpsLandmark } from "./landmarks";
import { MissionSystem } from "./missionSystem";
import { StorySystem } from "./storySystem";
import { WeatherSystem, type WeatherPreset } from "./weatherSystem";
import { AudioSystem } from "./audioSystem";
import { getPropertyByEntrance, getPropertyRegistryEntry } from "./propertyRegistry";
import { LifeSimulationSystem } from "./lifeSimulation";
import { FreelanceSystem, FREELANCE_CONTRACT_CATALOG } from "./freelanceSystem";

const PLAYER_START = new THREE.Vector3(-4, 0, -4);
const CAR_START = new THREE.Vector3(-2, 0, -8);
const KEKE_START = new THREE.Vector3(6, 0, -8);
const VAN_START = new THREE.Vector3(-30, 0, -165);
const PICKUP_START = new THREE.Vector3(22, 0, -135);
const MINIBUS_START = new THREE.Vector3(-12, 0, -145);
const TRUCK_START = new THREE.Vector3(32, 0, -180);
type GameEngineCallbacks = {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onPause: () => void;
};

type RendererFactory = (canvas: HTMLCanvasElement) => THREE.WebGLRenderer;

function normalizeMovementKey(key: string) {
  switch (key) {
    case "arrowup": return "w";
    case "arrowdown": return "s";
    case "arrowleft": return "a";
    case "arrowright": return "d";
    default: return key;
  }
}

export class GameEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(57, 1, 0.1, 420);
  private readonly world: ReturnType<typeof createWorld>;
  private readonly colliderIndex: ColliderIndex;
  private readonly materials: ReturnType<typeof createMaterials>;
  private readonly player: PlayerModel;
  private readonly car: CarModel;
  private readonly keke: KekeModel;
  private readonly navigation: NavigationNetwork;
  private readonly trafficSystem: TrafficSystem;
  private readonly pedestrianSystem: PedestrianSystem;
  private readonly keys = new Set<string>();
  private readonly lookMatrix = new THREE.Matrix4();
  private readonly desiredCameraQuaternion = new THREE.Quaternion();
  private readonly callbacks: GameEngineCallbacks;
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private vehicleHeadlight: THREE.SpotLight | null = null;
  private readonly weatherSystem: WeatherSystem;
  private readonly audioSystem: AudioSystem;
  private graphicsQuality: GraphicsQuality = "balanced";
  private readonly resizeObserver: ResizeObserver;
  private readonly onKeyDownBound: (event: KeyboardEvent) => void;
  private readonly onKeyUpBound: (event: KeyboardEvent) => void;
  private readonly onMouseMoveBound: (event: MouseEvent) => void;
  private readonly onPointerLockBound: () => void;
  private readonly onCanvasClickBound: () => void;
  private readonly onContextMenuBound: (event: MouseEvent) => void;
  private readonly onCanvasPointerDownBound: (event: PointerEvent) => void;
  private readonly onCanvasPointerMoveBound: (event: PointerEvent) => void;
  private readonly onCanvasPointerUpBound: (event: PointerEvent) => void;
  private touchLookPointerId: number | null = null;
  private readonly touchLookPosition = new THREE.Vector2();

  private screen: GameScreen = "menu";
  private mode: GameMode = "on-foot";
  private activeVehicle: VehicleType = "sedan";
  private running = true;
  private animationFrame = 0;
  private lastFrameAt = 0;
  private lastSnapshotAt = 0;
  private statusMessage: string | null = null;
  private playerPosition = PLAYER_START.clone();
  private playerVerticalVelocity = 0;
  private playerGrounded = true;
  private playerYaw = 0;
  private cameraYaw = 0;
  private cameraPitch = 0.29;
  private carPosition = CAR_START.clone();
  private carYaw = 0;
  private carSpeed = 0;
  private kekePosition = KEKE_START.clone();
  private kekeYaw = 0;
  private kekeSpeed = 0;
  private kekeWheelSpin = 0;

  private vanPosition = VAN_START.clone();
  private vanYaw = 0;
  private vanSpeed = 0;
  private vanWheelSpin = 0;

  private pickupPosition = PICKUP_START.clone();
  private pickupYaw = 0;
  private pickupSpeed = 0;
  private pickupWheelSpin = 0;

  private minibusPosition = MINIBUS_START.clone();
  private minibusYaw = 0;
  private minibusSpeed = 0;
  private minibusWheelSpin = 0;

  private truckPosition = TRUCK_START.clone();
  private truckYaw = 0;
  private truckSpeed = 0;
  private truckWheelSpin = 0;

  private walkPhase = 0;
  private wheelSpin = 0;
  private readonly interiorManager: BuildingInteriorManager;
  public readonly socialSystem = new SocialSystem();
  public readonly economy = new EconomySystem();
  public readonly missionSystem = new MissionSystem();
  public readonly storySystem = new StorySystem();
  public readonly lifeSim = new LifeSimulationSystem();
  public readonly freelanceSystem = new FreelanceSystem();
  private van!: UsableVehicleModel;
  private pickup!: UsableVehicleModel;
  private minibus!: UsableVehicleModel;
  private truck!: UsableVehicleModel;
  private cash = 150000;
  private trafficFine = 0;
  private hasApartmentRental = false;
  private gameMinutes = 600; // 10:00 AM
  private gameScore = 0;
  private isSeated = false;
  private featuredContactId: string | null = null;
  private gpsTargetLandmark: string | null = null;
  private isFurnishingMode = false;
  private isFurnitureShopOpen = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    callbacks: GameEngineCallbacks,
    rendererFactory: RendererFactory = (target) =>
      new THREE.WebGLRenderer({
        canvas: target,
        antialias: true,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: false,
      }),
  ) {
    this.callbacks = callbacks;
    this.renderer = rendererFactory(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color("#dcd4c3");
    this.scene.fog = new THREE.Fog("#dcd4c3", 42, 230);

    this.weatherSystem = new WeatherSystem("clear");
    this.scene.add(this.weatherSystem.particleGroup);

    this.audioSystem = new AudioSystem(false, 0.65);

    this.materials = createMaterials();
    this.interiorManager = new BuildingInteriorManager(this.materials);
    this.scene.add(this.interiorManager.root);

    const saved = this.economy.loadFromStorage();
    if (saved) {
      this.cash = saved.cash;
      this.trafficFine = saved.trafficFine;
      this.hasApartmentRental = Boolean(saved.hasApartmentRental || this.economy.properties.get("unit-2b")?.isRented);
      if (saved.completedMissions) {
        this.missionSystem.loadProgress(saved.completedMissions, saved.careerEarnings ?? 0);
      }
      if (saved.storyProgress) {
        this.storySystem.loadProgress(saved.storyProgress);
      }
      if (saved.weatherPreset && ["clear", "harmattan", "sunset_glow", "cool_night"].includes(saved.weatherPreset)) {
        this.weatherSystem.setPreset(saved.weatherPreset as WeatherPreset);
      }
      if (typeof saved.audioMuted === "boolean") {
        this.audioSystem.setMuted(saved.audioMuted);
      }
      if (saved.selectedHomePropertyId !== undefined) {
        this.economy.selectedHomePropertyId = normalizePropertyId(saved.selectedHomePropertyId);
      }
      if (saved.needs) {
        this.lifeSim.loadSnapshot(saved.needs);
      }
      if (saved.completedFreelanceContracts) {
        this.freelanceSystem.loadSnapshot(saved.completedFreelanceContracts, saved.freelanceEarnings);
      }
    }
    this.economy.resolveSelectedHome(this.hasApartmentRental);
    this.syncAllPlacedFurniture();
    this.world = createWorld(this.materials);
    this.colliderIndex = new ColliderIndex(this.world.colliders);
    this.scene.add(this.world.root);
    this.addLighting();

    this.navigation = buildNavigationNetwork();
    this.trafficSystem = new TrafficSystem(
      this.scene,
      this.materials,
      this.navigation,
      this.colliderIndex,
      (x, z) => this.surfaceHeight(x, z),
    );
    this.trafficSystem.onCitation = (fine, reason) => {
      if (this.trafficFine === 0) {
        this.trafficFine = fine;
        this.statusMessage = reason;
        this.pushSnapshot(true);
        this.saveGame();
      }
    };
    this.pedestrianSystem = new PedestrianSystem(
      this.scene,
      this.materials,
      this.navigation,
      this.colliderIndex,
      (x, z) => this.surfaceHeight(x, z),
    );

    this.setGraphicsQuality("balanced");

    this.player = createPlayerModel(this.materials);
    this.player.root.position.copy(this.playerPosition);
    this.scene.add(this.player.root);

    this.car = createCarModel(this.materials);
    this.car.root.position.set(
      CAR_START.x,
      this.surfaceHeight(CAR_START.x, CAR_START.z),
      CAR_START.z,
    );
    this.scene.add(this.car.root);

    this.keke = createKekeModel(this.materials);
    this.keke.root.position.set(
      KEKE_START.x,
      this.surfaceHeight(KEKE_START.x, KEKE_START.z),
      KEKE_START.z,
    );
    this.scene.add(this.keke.root);

    this.van = createDeliveryVanModel(this.materials);
    this.van.root.position.set(
      this.vanPosition.x,
      this.surfaceHeight(this.vanPosition.x, this.vanPosition.z),
      this.vanPosition.z,
    );
    this.scene.add(this.van.root);

    this.pickup = createPickupTruckModel(this.materials);
    this.pickup.root.position.set(
      this.pickupPosition.x,
      this.surfaceHeight(this.pickupPosition.x, this.pickupPosition.z),
      this.pickupPosition.z,
    );
    this.scene.add(this.pickup.root);

    this.minibus = createMinibusModel(this.materials);
    this.minibus.root.position.set(
      this.minibusPosition.x,
      this.surfaceHeight(this.minibusPosition.x, this.minibusPosition.z),
      this.minibusPosition.z,
    );
    this.scene.add(this.minibus.root);

    this.truck = createFreightTruckModel(this.materials);
    this.truck.root.position.set(
      this.truckPosition.x,
      this.surfaceHeight(this.truckPosition.x, this.truckPosition.z),
      this.truckPosition.z,
    );
    this.scene.add(this.truck.root);

    void this.loadAssets();

    this.camera.position.set(0, 3.8, -6.8);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    this.onKeyDownBound = (event) => {
      this.audioSystem.init();
      this.audioSystem.resume();
      this.onKeyDown(event);
    };
    this.onKeyUpBound = (event) => this.keys.delete(normalizeMovementKey(event.key.toLowerCase()));
    this.onMouseMoveBound = (event) => this.onMouseMove(event);
    this.onPointerLockBound = () => this.onPointerLockChange();
    this.onCanvasClickBound = () => {
      this.audioSystem.init();
      this.audioSystem.resume();
      if (
        this.screen === "playing" &&
        !this.prefersTouchControls() &&
        document.pointerLockElement !== this.canvas
      ) {
        this.requestPointerLock();
      }
    };
    this.onCanvasPointerDownBound = (event) => {
      this.audioSystem.init();
      this.audioSystem.resume();
      if (event.pointerType !== "touch" || this.screen !== "playing") return;
      this.touchLookPointerId = event.pointerId;
      this.touchLookPosition.set(event.clientX, event.clientY);
      this.canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    this.onCanvasPointerMoveBound = (event) => {
      if (event.pointerType !== "touch" || event.pointerId !== this.touchLookPointerId) return;
      const deltaX = event.clientX - this.touchLookPosition.x;
      const deltaY = event.clientY - this.touchLookPosition.y;
      this.touchLookPosition.set(event.clientX, event.clientY);
      this.adjustCameraLook(deltaX, deltaY, 0.004, 0.003);
      event.preventDefault();
    };
    this.onCanvasPointerUpBound = (event) => {
      if (event.pointerId !== this.touchLookPointerId) return;
      this.touchLookPointerId = null;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    };
    this.onContextMenuBound = (event) => event.preventDefault();

    window.addEventListener("keydown", this.onKeyDownBound);
    window.addEventListener("keyup", this.onKeyUpBound);
    window.addEventListener("mousemove", this.onMouseMoveBound);
    document.addEventListener("pointerlockchange", this.onPointerLockBound);
    this.canvas.addEventListener("click", this.onCanvasClickBound);
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerDownBound);
    this.canvas.addEventListener("pointermove", this.onCanvasPointerMoveBound);
    this.canvas.addEventListener("pointerup", this.onCanvasPointerUpBound);
    this.canvas.addEventListener("pointercancel", this.onCanvasPointerUpBound);
    this.canvas.addEventListener("contextmenu", this.onContextMenuBound);

    this.animationFrame = requestAnimationFrame(this.animate);
  }

  private addLighting() {
    const hemi = new THREE.HemisphereLight("#d8e8f2", "#7a5e42", 1.45);
    this.scene.add(hemi);
    this.hemiLight = hemi;

    const sun = new THREE.DirectionalLight("#fff8ed", 2.85);
    sun.position.set(-44, 62, -34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -58;
    sun.shadow.camera.right = 58;
    sun.shadow.camera.top = 58;
    sun.shadow.camera.bottom = -58;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 175;
    sun.shadow.bias = -0.00032;
    sun.shadow.normalBias = 0.024;
    this.scene.add(sun);
    this.sunLight = sun;

    const bounce = new THREE.DirectionalLight("#a3c0d4", 0.55);
    bounce.position.set(52, 28, 40);
    this.scene.add(bounce);

    const headlight = new THREE.SpotLight("#fff5d0", 2.6, 42, Math.PI / 5.5, 0.45, 1.2);
    headlight.visible = false;
    this.scene.add(headlight);
    this.scene.add(headlight.target);
    this.vehicleHeadlight = headlight;
  }

  private updateLighting() {
    if (!this.sunLight) return;
    const hour = (this.gameMinutes / 60) % 24;
    const isInterior = Boolean(this.interiorManager.activeInterior);

    this.weatherSystem.applyToScene(this.scene, this.sunLight, this.hemiLight, hour, isInterior);

    // Diurnal street lantern & interior window glow
    const isNightOrTwilight = hour < 6.2 || hour > 18.6;
    if (this.materials.lampGlow) {
      this.materials.lampGlow.emissiveIntensity = isNightOrTwilight ? 2.4 : 0.2;
    }
    if (this.materials.glassLit) {
      this.materials.glassLit.emissiveIntensity = isNightOrTwilight ? 1.35 : 0.15;
    }

    if (this.vehicleHeadlight) {
      if (isNightOrTwilight && this.mode === "driving" && !isInterior) {
        this.vehicleHeadlight.visible = true;
        const vPos = this.getActiveVehiclePosition();
        const vYaw = this.getActiveVehicleYaw();
        this.vehicleHeadlight.position.set(vPos.x, vPos.y + 0.85, vPos.z);
        this.vehicleHeadlight.target.position.set(
          vPos.x + Math.sin(vYaw) * 25,
          vPos.y + 0.2,
          vPos.z + Math.cos(vYaw) * 25,
        );
        this.vehicleHeadlight.target.updateMatrixWorld();
      } else {
        this.vehicleHeadlight.visible = false;
      }
    }

    if (!isInterior) {
      const targetPos = this.mode === "driving"
        ? this.getActiveVehiclePosition()
        : this.playerPosition;
      this.sunLight.position.set(targetPos.x - 44, 62, targetPos.z - 34);
      this.sunLight.target.position.set(targetPos.x, targetPos.y, targetPos.z);
      this.sunLight.target.updateMatrixWorld();
    }
  }

  private async loadAssets() {
    // 1. Asynchronously load the 3D GLTF/GLB Sedan Model
    try {
      const sedanGLTF = await loadGLTFModel("/assets/graphite-four-door-sedan.glb");
      if (sedanGLTF && this.running) {
        this.car.attachGLTFBody(sedanGLTF);
      }
    } catch (e) {
      console.warn("[Asset] Failed to load sedan GLB model, procedural fallback active:", e);
    }

    // 2. Asynchronously load the 3D GLTF Iron Gate Model
    try {
      const gateGLTF = await loadGLTFModel("/assets/large_iron_gate/large_iron_gate_1k.gltf");
      if (gateGLTF && this.running && this.world.gateSlots) {
        for (const slot of this.world.gateSlots) {
          const clone = gateGLTF.clone(true);
          clone.scale.set(0.69, 0.70, 0.70);
          slot.clear();
          slot.add(clone);
        }
      }
    } catch (e) {
      console.warn("[Asset] Failed to load iron gate GLTF model, procedural fallback active:", e);
    }

    // 3. Asynchronously load the Photorealistic Rigged Human Character
    try {
      const humanoid = await loadHumanoidCharacter(
        "/assets/characters/Black_M_1_Casual.glb",
        "/assets/characters/humanoid_animations.json",
      );
      if (humanoid && this.running) {
        this.player.attachRiggedCharacter(humanoid.characterRoot, humanoid.animations);
      }
      if (this.running) {
        await this.pedestrianSystem.upgradeWithRealisticAvatars();
      }
    } catch (e) {
      console.warn("[Asset] Failed to load realistic humanoid character, procedural fallback active:", e);
    }
  }

  private resize() {
    const target = this.canvas.parentElement ?? this.canvas;
    const width = Math.max(1, target.clientWidth);
    const height = Math.max(1, target.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setScreen(screen: GameScreen) {
    this.screen = screen;
    if (screen !== "playing") {
      this.keys.clear();
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }
    if (screen === "playing") {
      this.statusMessage = this.prefersTouchControls()
        ? "Use the touch pad to move · drag open space to look"
        : document.pointerLockElement === this.canvas
          ? null
          : "Click the world to capture the mouse · Esc pauses";
    }
    this.pushSnapshot(true);
  }

  requestPointerLock() {
    if (this.prefersTouchControls()) return;
    try {
      const request = this.canvas.requestPointerLock();
      if (request && "catch" in request) {
        void request.catch(() => {
          this.statusMessage = "Click inside the world to enable mouse camera control";
          this.pushSnapshot(true);
        });
      }
    } catch {
      this.statusMessage = "Click inside the world to enable mouse camera control";
      this.pushSnapshot(true);
    }
  }

  setControlKey(key: string, pressed: boolean) {
    const normalized = key.toLowerCase();
    const movementKey = normalizeMovementKey(normalized);
    if (!pressed) {
      this.keys.delete(movementKey);
      return;
    }
    if (this.isSeated) {
      this.isSeated = false;
    }
    if (normalized === "e" && this.screen === "playing") {
      this.handleInteract();
      return;
    }
    if (normalized === "f" && this.screen === "playing") {
      this.toggleFurnishingMode();
      return;
    }
    if (normalized === "r" && this.screen !== "menu") {
      this.reset();
      return;
    }
    if (normalized === "escape" && this.screen === "playing") {
      if (this.isFurnishingMode) {
        this.isFurnishingMode = false;
        this.pushSnapshot(true);
        return;
      }
      if (this.isFurnitureShopOpen) {
        this.isFurnitureShopOpen = false;
        this.pushSnapshot(true);
        return;
      }
      this.callbacks.onPause();
      return;
    }
    this.keys.add(movementKey);
  }

  clearControls() {
    this.keys.clear();
    this.touchLookPointerId = null;
  }

  setGraphicsQuality(quality: GraphicsQuality) {
    if (this.graphicsQuality === quality && this.sunLight) return;
    this.graphicsQuality = quality;
    this.trafficSystem?.setQuality(quality);
    this.pedestrianSystem?.setQuality(quality);
    const pixelRatioCap = quality === "performance" ? 1 : quality === "quality" ? 1.65 : 1.25;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    this.renderer.shadowMap.enabled = quality !== "performance";
    const shadowSize = quality === "quality" ? 2048 : quality === "balanced" ? 1024 : 512;
    if (this.sunLight) {
      this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
      this.sunLight.shadow.needsUpdate = true;
    }
    this.resize();
  }

  reset() {
    this.mode = "on-foot";
    this.activeVehicle = "sedan";
    this.interiorManager.activeInterior = null;
    this.featuredContactId = null;
    this.playerPosition.copy(PLAYER_START);
    this.playerVerticalVelocity = 0;
    this.playerGrounded = true;
    this.playerYaw = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.29;
    this.carPosition.copy(CAR_START);
    this.carYaw = 0;
    this.carSpeed = 0;
    this.kekePosition.copy(KEKE_START);
    this.kekeYaw = 0;
    this.kekeSpeed = 0;
    this.vanPosition.copy(VAN_START);
    this.vanYaw = 0;
    this.vanSpeed = 0;
    this.pickupPosition.copy(PICKUP_START);
    this.pickupYaw = 0;
    this.pickupSpeed = 0;
    this.minibusPosition.copy(MINIBUS_START);
    this.minibusYaw = 0;
    this.minibusSpeed = 0;
    this.truckPosition.copy(TRUCK_START);
    this.truckYaw = 0;
    this.truckSpeed = 0;
    this.player.root.visible = true;
    this.player.playAction("idle", 0.1);
    this.car.root.visible = true;
    this.keke.root.visible = true;
    this.van.root.visible = true;
    this.pickup.root.visible = true;
    this.minibus.root.visible = true;
    this.truck.root.visible = true;
    this.keys.clear();
    this.statusMessage = "Returned to the starting junction";
    this.updateTransform();
    this.pushSnapshot(true);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDownBound);
    window.removeEventListener("keyup", this.onKeyUpBound);
    window.removeEventListener("mousemove", this.onMouseMoveBound);
    document.removeEventListener("pointerlockchange", this.onPointerLockBound);
    this.canvas.removeEventListener("click", this.onCanvasClickBound);
    this.canvas.removeEventListener("pointerdown", this.onCanvasPointerDownBound);
    this.canvas.removeEventListener("pointermove", this.onCanvasPointerMoveBound);
    this.canvas.removeEventListener("pointerup", this.onCanvasPointerUpBound);
    this.canvas.removeEventListener("pointercancel", this.onCanvasPointerUpBound);
    this.canvas.removeEventListener("contextmenu", this.onContextMenuBound);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.trafficSystem.dispose();
    this.pedestrianSystem.dispose();
    this.renderer.dispose();
  }

  private onKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    const movementKey = normalizeMovementKey(key);
    if (["w", "a", "s", "d", " ", "shift", "e", "f", "r", "escape", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }

    if (key === "escape" && !event.repeat && this.screen === "playing") {
      if (this.isFurnishingMode) {
        this.isFurnishingMode = false;
        this.pushSnapshot(true);
        return;
      }
      if (this.isFurnitureShopOpen) {
        this.isFurnitureShopOpen = false;
        this.pushSnapshot(true);
        return;
      }
      this.callbacks.onPause();
      return;
    }
    if (key === "r" && !event.repeat && this.screen !== "menu") {
      this.reset();
      return;
    }
    if (key === "e" && !event.repeat && this.screen === "playing") {
      this.handleInteract();
      return;
    }
    if (key === "f" && !event.repeat && this.screen === "playing") {
      this.toggleFurnishingMode();
      return;
    }
    this.keys.add(movementKey);
  }

  private onMouseMove(event: MouseEvent) {
    if (this.screen !== "playing" || document.pointerLockElement !== this.canvas) return;
    this.adjustCameraLook(event.movementX, event.movementY, 0.00235, 0.00185);
  }

  private adjustCameraLook(deltaX: number, deltaY: number, sensitivityX: number, sensitivityY: number) {
    this.cameraYaw -= deltaX * sensitivityX;
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch - deltaY * sensitivityY,
      -0.12,
      0.95,
    );
  }

  private prefersTouchControls() {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
  }

  private onPointerLockChange() {
    if (this.screen !== "playing") return;
    this.statusMessage = this.prefersTouchControls()
      ? "Use the touch pad to move · drag open space to look"
      : document.pointerLockElement === this.canvas
        ? null
        : "Click the world to capture the mouse · Esc pauses";
    this.pushSnapshot(true);
  }

  private handleInteract() {
    // 1. Check Mission Checkpoint Interaction (active mission step - works on foot or in vehicle)
    const activeTarget = this.mode === "driving" ? this.getActiveVehiclePosition() : this.playerPosition;
    const missionInter = this.missionSystem.checkMissionInteraction(activeTarget);
    if (missionInter) {
      const outcome = this.missionSystem.advanceStage(activeTarget, this.economy.getOwnedBusinessesList());
      if (outcome) {
        this.statusMessage = outcome.message;
        if (outcome.completed) {
          this.cash += outcome.reward + outcome.bonus;
          this.saveGame();
        }
        this.pushSnapshot(true);
        return;
      }
    }

    if (this.mode === "driving") {
      this.toggleVehicle();
      return;
    }

    // Check Kawu Logistics Dispatch Board at (-8, 0, -140)
    if (this.playerPosition.distanceTo(new THREE.Vector3(-8, 0, -140)) <= 3.4) {
      this.statusMessage = "Kawu Logistics Dispatch Board: Press [J] or click MISSIONS to accept contracts!";
      this.pushSnapshot(true);
      return;
    }

    // 1. If inside an interior
    if (this.interiorManager.activeInterior) {
      const activeZone = this.interiorManager.getActiveZone();
      if (activeZone) {
        // First check: placed furniture interaction (e.g. sit on sofa, watch TV, remote work on PC, drink Zobo from fridge, sleep in bed)
        const furnInter = this.interiorManager.getFurnitureInteraction(this.playerPosition);
        if (furnInter) {
          const res = furnInter.action();
          this.statusMessage = res.statusMessage;
          if (res.cashDelta) this.cash += res.cashDelta;
          if (res.timeDeltaMinutes) {
            this.gameMinutes += res.timeDeltaMinutes;
            this.economy.dayCount += Math.floor(res.timeDeltaMinutes / (24 * 60));
          }
          if (res.scoreDelta) this.gameScore = Math.max(this.gameScore, this.gameScore + res.scoreDelta);
          if (res.eatFood) {
            const eatRes = this.lifeSim.eatFood(res.eatFood.amount, res.eatFood.label);
            this.statusMessage = `${res.statusMessage} (${eatRes.message})`;
          }
          if (res.sleepInBed) {
            const sleepRes = this.lifeSim.sleep(res.sleepInBed.hours);
            this.statusMessage = `${res.statusMessage} (${sleepRes.message})`;
          }
          if (res.takeShower) {
            const showerRes = this.lifeSim.shower(res.takeShower.label);
            this.statusMessage = `${res.statusMessage} (${showerRes.message})`;
          }
          if (res.sitDown) {
            this.isSeated = true;
            const sitRes = this.lifeSim.sitAndRest(res.sitDown.label, res.sitDown.energyRestored ?? 20);
            this.statusMessage = `${res.statusMessage} (${sitRes.message})`;
          }
          if (res.watchTv) {
            this.isSeated = true;
            const tvRes = this.lifeSim.watchTelevision(res.watchTv.label, res.watchTv.energyRestored ?? 15);
            this.statusMessage = `${res.statusMessage} (${tvRes.message})`;
          }
          if (res.washHands) {
            const washRes = this.lifeSim.washHands(res.washHands.label);
            this.statusMessage = `${res.statusMessage} (${washRes.message})`;
          }
          if (res.drinkBeverage) {
            const drinkRes = this.lifeSim.drinkBeverage(
              res.drinkBeverage.label,
              res.drinkBeverage.hungerGain ?? 25,
              res.drinkBeverage.energyGain ?? 10,
            );
            this.statusMessage = `${res.statusMessage} (${drinkRes.message})`;
          }
          if (res.freelanceContractAction) {
            this.executeFreelanceContract();
          }
          this.saveGame();
          this.pushSnapshot(true);
          return;
        }

        // Second check: interactive interior room doors (open/close)
        const nearbyDoor = this.interiorManager.getNearbyDoor(this.playerPosition, 2.0);
        if (nearbyDoor) {
          const res = this.interiorManager.toggleDoor(nearbyDoor.id);
          this.statusMessage = res.message;
          this.pushSnapshot(true);
          return;
        }

        // Third check: Distance to exit door
        const distExit = this.playerPosition.distanceTo(activeZone.exitPoint);
        if (distExit <= 2.2) {
          this.playerPosition.copy(activeZone.outdoorDoorPosition);
          this.playerYaw = activeZone.outdoorDoorYaw;
          this.interiorManager.activeInterior = null;
          this.isFurnishingMode = false;
          this.statusMessage = `Exited ${activeZone.name}`;
          this.updateTransform();
          this.pushSnapshot(true);
          return;
        }

        // Fourth check: interactive station inside
        if (activeZone.checkInteraction) {
          const inter = activeZone.checkInteraction(this.playerPosition, {
            cash: this.cash,
            trafficFine: this.trafficFine,
            hasApartmentRental: this.hasApartmentRental,
            score: this.gameScore,
            ownedProperties: this.economy.getOwnedPropertiesList(),
            ownedBusinesses: this.economy.getOwnedBusinessesList(),
          });
          if (inter) {
            const res = inter.action();
            this.statusMessage = res.statusMessage;
            if (res.cashDelta) this.cash += res.cashDelta;
            if (res.clearFine) this.trafficFine = 0;
            if (res.rentApartment) {
              this.hasApartmentRental = true;
              const prop = this.economy.properties.get("unit-2b");
              if (prop) prop.isRented = true;
              this.economy.resolveSelectedHome(true);
            }
            if (res.scoreDelta) this.gameScore = Math.max(this.gameScore, res.scoreDelta);
            if (res.purchasedProperty) {
              const p = this.economy.properties.get(res.purchasedProperty);
              if (p) {
                p.isOwned = true;
                p.isRented = false;
              }
              this.economy.resolveSelectedHome(this.hasApartmentRental);
            }
            if (res.purchasedBusiness) {
              const b = this.economy.businesses.get(res.purchasedBusiness);
              if (b) b.isOwned = true;
            }
            if (res.openFurnitureShop) {
              this.isFurnitureShopOpen = true;
            }
            if (res.eatFood) {
              const eatRes = this.lifeSim.eatFood(res.eatFood.amount, res.eatFood.label);
              this.statusMessage = `${res.statusMessage} (${eatRes.message})`;
            }
            if (res.sleepInBed) {
              const sleepRes = this.lifeSim.sleep(res.sleepInBed.hours);
              this.statusMessage = `${res.statusMessage} (${sleepRes.message})`;
            }
            if (res.takeShower) {
              const showerRes = this.lifeSim.shower(res.takeShower.label);
              this.statusMessage = `${res.statusMessage} (${showerRes.message})`;
            }
            if (res.sitDown) {
              this.isSeated = true;
              const sitRes = this.lifeSim.sitAndRest(res.sitDown.label, res.sitDown.energyRestored ?? 20);
              this.statusMessage = `${res.statusMessage} (${sitRes.message})`;
            }
            if (res.watchTv) {
              this.isSeated = true;
              const tvRes = this.lifeSim.watchTelevision(res.watchTv.label, res.watchTv.energyRestored ?? 15);
              this.statusMessage = `${res.statusMessage} (${tvRes.message})`;
            }
            if (res.washHands) {
              const washRes = this.lifeSim.washHands(res.washHands.label);
              this.statusMessage = `${res.statusMessage} (${washRes.message})`;
            }
            if (res.drinkBeverage) {
              const drinkRes = this.lifeSim.drinkBeverage(
                res.drinkBeverage.label,
                res.drinkBeverage.hungerGain ?? 25,
                res.drinkBeverage.energyGain ?? 10,
              );
              this.statusMessage = `${res.statusMessage} (${drinkRes.message})`;
            }
            if (res.freelanceContractAction) {
              this.executeFreelanceContract();
            }
            if (res.socialContactId) {
              this.featuredContactId = res.socialContactId;
              const choices = this.socialSystem.getChoices(res.socialContactId, this.cash, this.hasApartmentRental);
              if (choices.length > 0) {
                const choice = choices[choices.length - 1];
                const outcome = this.socialSystem.interact(res.socialContactId, choice.id, this.cash, this.hasApartmentRental);
                if (outcome) {
                  this.statusMessage = outcome.statusMessage;
                  if (outcome.cashDelta) this.cash += outcome.cashDelta;
                }
              }
            }
            this.saveGame();
            this.pushSnapshot(true);
            return;
          }
        }
      }
      return;
    }

    // 2. Outdoors on foot: Check residential purchasable/rentable properties
    const nearbyProperty = getPropertyByEntrance(this.playerPosition, 3.4);
    if (nearbyProperty) {
      if (this.isPropertyAccessible(nearbyProperty.id)) {
        const zone = this.interiorManager.interiors.get(nearbyProperty.interiorId);
        if (zone) {
          this.interiorManager.outdoorSavedPosition.copy(this.playerPosition);
          this.interiorManager.outdoorSavedYaw = this.playerYaw;
          this.interiorManager.activeInterior = nearbyProperty.interiorId;
          this.playerPosition.copy(zone.spawnPoint);
          this.playerYaw = zone.spawnYaw;
          this.statusMessage = `Entered ${nearbyProperty.name}`;
          this.updateTransform();
          this.pushSnapshot(true);
          return;
        }
      } else {
        // Player does not own or rent this property yet
        if (nearbyProperty.id === "unit-2b") {
          if (this.cash >= 75000) {
            this.cash -= 75000;
            this.hasApartmentRental = true;
            const prop = this.economy.properties.get("unit-2b");
            if (prop) prop.isRented = true;
            this.economy.resolveSelectedHome(true);
            const zone = this.interiorManager.interiors.get("apartment");
            if (zone) {
              this.interiorManager.outdoorSavedPosition.copy(this.playerPosition);
              this.interiorManager.outdoorSavedYaw = this.playerYaw;
              this.interiorManager.activeInterior = "apartment";
              this.playerPosition.copy(zone.spawnPoint);
              this.playerYaw = zone.spawnYaw;
            }
            this.statusMessage = "Monthly lease signed for Unit 2B (₦75,000)! Welcome home.";
            this.saveGame();
            this.updateTransform();
            this.pushSnapshot(true);
            return;
          } else {
            this.statusMessage = "Unit 2B requires ₦75,000 for monthly lease or ₦18,000,000 for freehold purchase.";
            this.pushSnapshot(true);
            return;
          }
        } else {
          // Penthouse or Villa
          const prop = this.economy.properties.get(nearbyProperty.id);
          if (prop && this.cash >= prop.purchasePrice) {
            const purchaseRes = this.economy.purchaseProperty(nearbyProperty.id, this.cash);
            if (purchaseRes.success) {
              this.cash -= purchaseRes.cost;
              this.economy.resolveSelectedHome(this.hasApartmentRental);
              const zone = this.interiorManager.interiors.get(nearbyProperty.interiorId);
              if (zone) {
                this.interiorManager.outdoorSavedPosition.copy(this.playerPosition);
                this.interiorManager.outdoorSavedYaw = this.playerYaw;
                this.interiorManager.activeInterior = nearbyProperty.interiorId;
                this.playerPosition.copy(zone.spawnPoint);
                this.playerYaw = zone.spawnYaw;
              }
              this.statusMessage = purchaseRes.message;
              this.saveGame();
              this.updateTransform();
              this.pushSnapshot(true);
              return;
            }
          } else {
            this.statusMessage = `${nearbyProperty.name} is private property: ₦${nearbyProperty.purchasePrice.toLocaleString()} required for freehold Certificate of Occupancy.`;
            this.pushSnapshot(true);
            return;
          }
        }
      }
    }

    // 3. Outdoors on foot: Check public interior entrance doors (church, police-post, restaurant, gaming-hub)
    for (const [id, zone] of this.interiorManager.interiors.entries()) {
      if (id === "apartment" || id === "penthouse" || id === "house") continue;
      const distDoor = this.playerPosition.distanceTo(zone.outdoorDoorPosition);
      if (distDoor <= 3.4) {
        this.interiorManager.outdoorSavedPosition.copy(this.playerPosition);
        this.interiorManager.outdoorSavedYaw = this.playerYaw;
        this.interiorManager.activeInterior = id;
        this.playerPosition.copy(zone.spawnPoint);
        this.playerYaw = zone.spawnYaw;
        this.statusMessage = `Entered ${zone.name}`;
        this.updateTransform();
        this.pushSnapshot(true);
        return;
      }
    }

    // Check outdoor 24/7 ATM Cash Point at Arewa Commercial Bank (86.2, 0, -13.9)
    if (this.playerPosition.distanceTo(new THREE.Vector3(86.2, 0, -13.9)) <= 2.4) {
      this.cash += 20000;
      this.statusMessage = "ATM: Dispensed ₦20,000 cash from Arewa Commercial Bank account. Balance updated.";
      this.pushSnapshot(true);
      return;
    }

    // Check outdoor Police Officer at (26, 0, -12)
    if (this.playerPosition.distanceTo(new THREE.Vector3(26, 0, -12)) <= 3.2) {
      this.statusMessage = "NPF Officer: 'Airport Road Division reporting. Area is under active patrol. Report any security concerns.'";
      this.pushSnapshot(true);
      return;
    }

    // Check outdoor Checkpoint 2 NPF Officer at (-10, 0, -56)
    if (this.playerPosition.distanceTo(new THREE.Vector3(-10, 0, -56)) <= 3.2) {
      this.statusMessage = "NPF Highway Patrol: 'Sabon Gari checkpoint secure. Drive safely and observe road regulations.'";
      this.pushSnapshot(true);
      return;
    }

    // Check outdoor KAROTA Officer at (20, 0, -9.5)
    if (this.playerPosition.distanceTo(new THREE.Vector3(20, 0, -9.5)) <= 3.2) {
      if (this.trafficFine > 0) {
        this.statusMessage = `KAROTA Officer: 'You have an outstanding fine of ₦${this.trafficFine.toLocaleString()}. Settle it inside the station desk.'`;
      } else {
        this.statusMessage = "KAROTA Officer: 'Driver documents and roadworthiness verified. Safe driving in Kano!'";
      }
      this.pushSnapshot(true);
      return;
    }

    // Outdoor Food Vendor 1: Industrial Workers Canteen & Mai Shayi Hub at (-15, 0, -155)
    if (this.playerPosition.distanceTo(new THREE.Vector3(-15, 0, -155)) <= 3.4) {
      if (this.cash >= 1200) {
        this.cash -= 1200;
        const eatRes = this.lifeSim.eatFood(45, "Mai Shayi Spiced Tea & Fried Egg Bread");
        this.statusMessage = `Mai Shayi: Served steaming spiced ginger tea and egg bread (₦1,200). ${eatRes.message}`;
        this.saveGame();
      } else {
        this.statusMessage = "Mai Shayi: 'Sannu! Hot tea and egg bread requires ₦1,200 cash.'";
      }
      this.pushSnapshot(true);
      return;
    }

    // Outdoor Food Vendor 2: Historic Dandali Community Square & Food Hub at (-72, 0, -72)
    if (this.playerPosition.distanceTo(new THREE.Vector3(-72, 0, -72)) <= 3.4) {
      if (this.cash >= 800) {
        this.cash -= 800;
        const eatRes = this.lifeSim.eatFood(40, "Dandali Hot Masa & Kosai");
        this.statusMessage = `Dandali Food Stall: Hot Masa cakes and crispy Kosai bean patties served (₦800). ${eatRes.message}`;
        this.saveGame();
      } else {
        this.statusMessage = "Dandali Food Stall: Hot Masa and Kosai requires ₦800 cash.";
      }
      this.pushSnapshot(true);
      return;
    }

    // Story Chapter 1: Dan-Kano Compound & Zaure at (-85, 0, -68)
    if (this.playerPosition.distanceTo(new THREE.Vector3(-85, 0, -68)) <= 3.8) {
      const progress = this.storySystem.getProgress();
      if (progress.stage === 0) {
        const res = this.storySystem.examineIndenture();
        this.statusMessage = res.message;
        this.saveGame();
        this.pushSnapshot(true);
        return;
      } else if (progress.stage === 1) {
        this.statusMessage = "Investigate the 1968 Indenture: Consult Dandali Elders (-72, -72) OR Arewa Bank (80, -22).";
        this.pushSnapshot(true);
        return;
      } else if (progress.stage === 2) {
        this.statusMessage = "Choose your Commercial Career Foundation in the Legacy Archive (Press [M] -> Legacy).";
        this.pushSnapshot(true);
        return;
      } else if (progress.stage === 3) {
        const res = this.storySystem.resolveChapter1();
        if (res.payout > 0) {
          this.cash += res.payout;
          this.gameScore += res.storyXP;
        }
        this.statusMessage = res.message;
        this.saveGame();
        this.pushSnapshot(true);
        return;
      } else {
        this.statusMessage = "Dan-Kano Ancestral Compound: Title registered. The Bronze Sahel Vault Key remains in your archive.";
        this.pushSnapshot(true);
        return;
      }
    }

    // Story Chapter 1: Dandali Clan Elders at (-72, 0, -72)
    if (this.playerPosition.distanceTo(new THREE.Vector3(-72, 0, -72)) <= 3.8) {
      const progress = this.storySystem.getProgress();
      if (progress.stage === 1 && progress.investigationChoice === null) {
        const res = this.storySystem.chooseInvestigation("elders");
        this.statusMessage = res.message;
        this.saveGame();
        this.pushSnapshot(true);
        return;
      }
    }

    // Story Chapter 1: Arewa Commercial Bank Auditor at (80, 0, -22)
    if (this.playerPosition.distanceTo(new THREE.Vector3(80, 0, -22)) <= 3.8) {
      const progress = this.storySystem.getProgress();
      if (progress.stage === 1 && progress.investigationChoice === null) {
        const res = this.storySystem.chooseInvestigation("bank");
        if (res.bonusCash > 0) {
          this.cash += res.bonusCash;
        }
        this.statusMessage = res.message;
        this.saveGame();
        this.pushSnapshot(true);
        return;
      }
    }

    // Check outdoor Sabon Gari Commercial Complex Shop at (-22, 0, 45.2)
    if (this.playerPosition.distanceTo(new THREE.Vector3(-22, 0, 45.2)) <= 2.8) {
      const biz = this.economy.businesses.get("sabon-gari-shop");
      if (biz?.isOwned) {
        this.statusMessage = "Sabon Gari Electronics: Owned retail enterprise. Daily yield: ~₦10,000 net profit.";
      } else {
        const res = this.economy.purchaseBusiness("sabon-gari-shop", this.cash);
        this.statusMessage = res.message;
        if (res.success) {
          this.cash -= res.cost;
          this.saveGame();
        }
      }
      this.pushSnapshot(true);
      return;
    }

    // Check outdoor Bompai Heights Concierge at (18, 0, 39.5)
    if (this.playerPosition.distanceTo(new THREE.Vector3(18, 0, 39.5)) <= 2.8) {
      const prop = this.economy.properties.get("bompai-penthouse");
      if (prop?.isOwned) {
        this.statusMessage = "Bompai Heights Penthouse: Owned luxury residence.";
      } else {
        const res = this.economy.purchaseProperty("bompai-penthouse", this.cash);
        this.statusMessage = res.message;
        if (res.success) {
          this.cash -= res.cost;
          this.saveGame();
        }
      }
      this.pushSnapshot(true);
      return;
    }

    // Check outdoor Al-Baraka Executive Villa Gate at (44, 0, 45)
    if (this.playerPosition.distanceTo(new THREE.Vector3(44, 0, 45)) <= 2.8) {
      const prop = this.economy.properties.get("albaraka-villa");
      if (prop?.isOwned) {
        this.statusMessage = "Al-Baraka Executive Villa: Owned residence.";
      } else {
        const res = this.economy.purchaseProperty("albaraka-villa", this.cash);
        this.statusMessage = res.message;
        if (res.success) {
          this.cash -= res.cost;
          this.saveGame();
        }
      }
      this.pushSnapshot(true);
      return;
    }

    // Check outdoor Sani Auto Tuning Workshop at (-16, 0, -22)
    if (this.playerPosition.distanceTo(new THREE.Vector3(-16, 0, -22)) <= 3.2) {
      const res = this.economy.upgradeVehicleEngine(this.cash);
      this.statusMessage = res.message;
      if (res.success) {
        this.cash -= res.cost;
        this.saveGame();
      }
      this.pushSnapshot(true);
      return;
    }

    // Check outdoor pedestrian talk interaction
    const pedInter = this.pedestrianSystem.checkPedestrianInteraction(this.playerPosition);
    if (pedInter) {
      this.statusMessage = pedInter.action();
      this.pushSnapshot(true);
      return;
    }

    // Check KAROTA Mobile Patrol officer interaction
    const trafficInter = this.trafficSystem.checkTrafficInteraction(this.playerPosition);
    if (trafficInter) {
      this.statusMessage = trafficInter.action();
      this.pushSnapshot(true);
      return;
    }

    // Check vehicles
    this.toggleVehicle();
  }

  private toggleVehicle() {
    if (this.mode === "on-foot") {
      const candidates: { type: VehicleType; name: string; pos: THREE.Vector3; maxDist: number }[] = [
        { type: "sedan", name: "Sedan", pos: this.carPosition, maxDist: 4.7 },
        { type: "keke", name: "Keke Napep", pos: this.kekePosition, maxDist: 4.7 },
        { type: "van", name: "Delivery Van", pos: this.vanPosition, maxDist: 4.8 },
        { type: "pickup", name: "Pickup Truck", pos: this.pickupPosition, maxDist: 4.8 },
        { type: "minibus", name: "Passenger Minibus", pos: this.minibusPosition, maxDist: 5.0 },
        { type: "truck", name: "Freight Truck", pos: this.truckPosition, maxDist: 5.5 },
      ];

      const enterable = candidates
        .map((c) => ({ ...c, dist: this.playerPosition.distanceTo(c.pos) }))
        .filter((c) => c.dist <= c.maxDist)
        .sort((a, b) => a.dist - b.dist);

      if (enterable.length > 0) {
        const chosen = enterable[0];
        this.activeVehicle = chosen.type;
        this.mode = "driving";
        if (chosen.type === "sedan") this.carSpeed = 0;
        else if (chosen.type === "keke") this.kekeSpeed = 0;
        else if (chosen.type === "van") this.vanSpeed = 0;
        else if (chosen.type === "pickup") this.pickupSpeed = 0;
        else if (chosen.type === "minibus") this.minibusSpeed = 0;
        else if (chosen.type === "truck") this.truckSpeed = 0;

        this.player.playAction("drive", 0.1);
        this.player.root.visible = false;
        this.statusMessage = `You are driving the ${chosen.name}`;
        this.pushSnapshot(true);
        return;
      }
      this.statusMessage = "Move closer to a vehicle";
      this.pushSnapshot(true);
      return;
    }

    // Exiting active vehicle
    const vPos = this.getActiveVehiclePosition();
    const vYaw = this.getActiveVehicleYaw();
    const right = new THREE.Vector3(Math.cos(vYaw), 0, -Math.sin(vYaw));
    const forward = new THREE.Vector3(Math.sin(vYaw), 0, Math.cos(vYaw));
    const sideOffset = this.activeVehicle === "truck" ? 2.3 : this.activeVehicle === "minibus" || this.activeVehicle === "van" ? 2.0 : 1.8;
    const endOffset = this.activeVehicle === "truck" ? 4.5 : this.activeVehicle === "minibus" || this.activeVehicle === "van" ? 3.5 : 2.8;

    const candidates = [
      vPos.clone().addScaledVector(right, -sideOffset),
      vPos.clone().addScaledVector(right, sideOffset),
      vPos.clone().addScaledVector(forward, -endOffset),
      vPos.clone().addScaledVector(forward, endOffset),
    ];
    const safeExit = candidates.find(
      (candidate) =>
        !this.collides(candidate.x, candidate.z, 0.48) &&
        candidate.distanceTo(vPos) > 1.2,
    );
    if (!safeExit) {
      this.statusMessage = "There is not enough clear space to exit here";
      this.pushSnapshot(true);
      return;
    }

    safeExit.y = this.surfaceHeight(safeExit.x, safeExit.z);
    this.playerPosition.copy(safeExit);
    this.playerYaw = vYaw;
    if (this.activeVehicle === "sedan") this.carSpeed = 0;
    else if (this.activeVehicle === "keke") this.kekeSpeed = 0;
    else if (this.activeVehicle === "van") this.vanSpeed = 0;
    else if (this.activeVehicle === "pickup") this.pickupSpeed = 0;
    else if (this.activeVehicle === "minibus") this.minibusSpeed = 0;
    else if (this.activeVehicle === "truck") this.truckSpeed = 0;

    this.mode = "on-foot";
    this.player.playAction("idle", 0.2);
    this.player.root.visible = true;
    this.statusMessage = "Exited safely";
    this.updateTransform();
    this.pushSnapshot(true);
  }

  private animate = () => {
    if (!this.running) return;
    const now = performance.now() / 1000;
    const dt = Math.min(this.lastFrameAt === 0 ? 1 / 60 : now - this.lastFrameAt, 0.04);
    this.lastFrameAt = now;
    if (this.screen === "playing") {
      this.gameMinutes += dt * 4;
      const hours = (this.gameMinutes / 60) % 24;
      this.pedestrianSystem.setTimeOfDay(hours);

      const dayOutcome = this.economy.updateDayCycle(this.gameMinutes, this.cash);
      if (dayOutcome.cashDelta !== 0) {
        this.cash += dayOutcome.cashDelta;
        this.statusMessage = dayOutcome.message;
        this.saveGame();
      }

      if (this.mode === "on-foot") this.updatePlayer(dt, now);
      else this.updateCar(dt);

      const activeVehPos = this.mode === "driving"
        ? this.getActiveVehiclePosition()
        : null;

      const centerPos = activeVehPos ?? this.playerPosition;
      this.weatherSystem.update(dt, centerPos);

      const activeSpeed = this.mode === "driving" ? this.getActiveVehicleSpeed() : 0;
      const isMovingOnFoot = this.mode === "on-foot" && (this.keys.has("w") || this.keys.has("s") || this.keys.has("a") || this.keys.has("d"));
      const isSprinting = this.keys.has("shift");

      this.lifeSim.update(
        dt,
        isSprinting && isMovingOnFoot,
        this.mode === "driving",
        Boolean(this.interiorManager.activeInterior),
      );

      this.audioSystem.update(dt, {
        mode: this.mode,
        vehicleSpeed: activeSpeed,
        vehicleMaxSpeed: 24,
        isMovingOnFoot,
        isSprinting,
        isHarmattan: this.weatherSystem.getPreset() === "harmattan",
        isInterior: Boolean(this.interiorManager.activeInterior),
      });

      this.trafficSystem.update(dt, this.playerPosition, activeVehPos, activeSpeed);
      this.pedestrianSystem.update(dt, this.playerPosition, activeVehPos);
    }
    this.updateLighting();
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.pushSnapshot(false);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private updatePlayer(dt: number, now = performance.now() / 1000) {
    const forward = (this.keys.has("w") ? 1 : 0) - (this.keys.has("s") ? 1 : 0);
    const sideways = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const movement = new THREE.Vector2(sideways, forward);
    if (movement.lengthSq() > 1) movement.normalize();
    const speedMultiplier = this.lifeSim.getSpeedMultiplier();
    const speed = (this.keys.has("shift") ? 7.1 : 4.15) * speedMultiplier;
    const sin = Math.sin(this.cameraYaw);
    const cos = Math.cos(this.cameraYaw);
    const moveX = (sin * movement.y + cos * movement.x) * speed * dt;
    const moveZ = (cos * movement.y - sin * movement.x) * speed * dt;
    const isWalking = movement.lengthSq() > 0.001;

    this.moveCircle(this.playerPosition, moveX, moveZ, 0.43);

    if (this.keys.has(" ") && this.playerGrounded) {
      this.playerVerticalVelocity = 6.4;
      this.playerGrounded = false;
    }
    this.playerVerticalVelocity -= 18.2 * dt;
    this.playerPosition.y += this.playerVerticalVelocity * dt;
    if (this.playerPosition.y <= 0) {
      const ground = this.surfaceHeight(this.playerPosition.x, this.playerPosition.z);
      if (this.playerPosition.y <= ground) {
        this.playerPosition.y = ground;
        this.playerVerticalVelocity = 0;
        this.playerGrounded = true;
      } else {
        this.playerGrounded = false;
      }
    } else {
      const ground = this.surfaceHeight(this.playerPosition.x, this.playerPosition.z);
      if (this.playerPosition.y <= ground) {
        this.playerPosition.y = ground;
        this.playerVerticalVelocity = 0;
        this.playerGrounded = true;
      }
    }

    if (isWalking) {
      this.isSeated = false;
      const targetYaw = Math.atan2(moveX, moveZ);
      this.playerYaw = this.lerpAngle(this.playerYaw, targetYaw, 1 - Math.exp(-12 * dt));
      this.walkPhase += dt * (this.keys.has("shift") ? 12.4 : 8.3);
    }

    const isRunning = this.keys.has("shift") && isWalking;
    const swingMagnitude = isRunning ? 0.68 : 0.46;
    const swing = isWalking && this.playerGrounded ? Math.sin(this.walkPhase) * swingMagnitude : 0;
    const idleBreath = !isWalking && this.playerGrounded ? Math.sin(now * 2.2) * 0.04 : 0;
    const idleSway = !isWalking && this.playerGrounded ? Math.sin(now * 1.1) * 0.015 : 0;

    if (this.isSeated) {
      this.player.leftLeg.rotation.x = THREE.MathUtils.damp(this.player.leftLeg.rotation.x, Math.PI * 0.44, 9, dt);
      this.player.rightLeg.rotation.x = THREE.MathUtils.damp(this.player.rightLeg.rotation.x, Math.PI * 0.44, 9, dt);
      this.player.leftArm.rotation.x = THREE.MathUtils.damp(this.player.leftArm.rotation.x, 0.35, 9, dt);
      this.player.rightArm.rotation.x = THREE.MathUtils.damp(this.player.rightArm.rotation.x, 0.35, 9, dt);
      this.player.leftArm.rotation.z = THREE.MathUtils.damp(this.player.leftArm.rotation.z, 0, 7, dt);
      this.player.rightArm.rotation.z = THREE.MathUtils.damp(this.player.rightArm.rotation.z, 0, 7, dt);
    } else if (this.playerGrounded) {
      this.player.leftArm.rotation.x = THREE.MathUtils.damp(this.player.leftArm.rotation.x, -swing + idleBreath, 9, dt);
      this.player.rightArm.rotation.x = THREE.MathUtils.damp(this.player.rightArm.rotation.x, swing - idleBreath, 9, dt);
      this.player.leftLeg.rotation.x = THREE.MathUtils.damp(this.player.leftLeg.rotation.x, swing, 9, dt);
      this.player.rightLeg.rotation.x = THREE.MathUtils.damp(this.player.rightLeg.rotation.x, -swing, 9, dt);
      this.player.leftArm.rotation.z = THREE.MathUtils.damp(this.player.leftArm.rotation.z, idleSway, 7, dt);
      this.player.rightArm.rotation.z = THREE.MathUtils.damp(this.player.rightArm.rotation.z, -idleSway, 7, dt);
    } else {
      this.player.leftArm.rotation.x = THREE.MathUtils.damp(this.player.leftArm.rotation.x, 0.4, 7, dt);
      this.player.rightArm.rotation.x = THREE.MathUtils.damp(this.player.rightArm.rotation.x, 0.4, 7, dt);
      this.player.leftArm.rotation.z = THREE.MathUtils.damp(this.player.leftArm.rotation.z, -0.35, 7, dt);
      this.player.rightArm.rotation.z = THREE.MathUtils.damp(this.player.rightArm.rotation.z, 0.35, 7, dt);
      this.player.leftLeg.rotation.x = THREE.MathUtils.damp(this.player.leftLeg.rotation.x, -0.3, 7, dt);
      this.player.rightLeg.rotation.x = THREE.MathUtils.damp(this.player.rightLeg.rotation.x, -0.15, 7, dt);
    }

    if (this.player.head) {
      const headTurn = !isWalking && !this.isSeated ? Math.sin(now * 0.7) * 0.16 : 0;
      this.player.head.rotation.y = THREE.MathUtils.damp(this.player.head.rotation.y, headTurn, 5, dt);
    }

    if (this.player.riggedCharacter) {
      if (isWalking) {
        if (isRunning) {
          this.player.playAction("run", 0.15);
        } else {
          this.player.playAction("walk", 0.15);
        }
      } else {
        this.player.playAction("idle", 0.25);
      }
      this.player.updateAnimation(dt);
    }

    const verticalBounce =
      !this.player.riggedCharacter && isWalking && this.playerGrounded
        ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.035
        : 0;
    const heightOffset = this.isSeated ? -0.28 : 0;
    this.player.root.position.set(
      this.playerPosition.x,
      this.playerPosition.y + verticalBounce + heightOffset,
      this.playerPosition.z,
    );
    this.player.root.rotation.y = this.playerYaw;
  }

  private updateCar(dt: number) {
    if (this.activeVehicle === "keke") {
      this.updateKeke(dt);
    } else if (this.activeVehicle === "van") {
      this.updateVan(dt);
    } else if (this.activeVehicle === "pickup") {
      this.updatePickup(dt);
    } else if (this.activeVehicle === "minibus") {
      this.updateMinibus(dt);
    } else if (this.activeVehicle === "truck") {
      this.updateTruck(dt);
    } else {
      this.updateSedan(dt);
    }

    const vehPos = this.getActiveVehiclePosition();
    const vehSpeed = Math.abs(this.getActiveVehicleSpeed()) * 3.6;
    if (this.trafficFine === 0 && vehPos.distanceTo(new THREE.Vector3(20, 0, -9.5)) <= 8.5 && vehSpeed > 15) {
      this.trafficFine = 5000;
      this.statusMessage = "KAROTA Traffic Citation: Failed to stop at checkpoint! ₦5,000 penalty registered.";
      this.pushSnapshot(true);
    } else if (this.trafficFine === 0 && vehPos.distanceTo(new THREE.Vector3(-10, 0, -56)) <= 8.5 && vehSpeed > 15) {
      this.trafficFine = 5000;
      this.statusMessage = "NPF Traffic Citation: Failed to stop at Sabon Gari checkpoint! ₦5,000 penalty registered.";
      this.pushSnapshot(true);
    }
  }

  private updateSedan(dt: number) {
    const throttle = this.keys.has("w");
    const braking = this.keys.has("s");
    const handbrake = this.keys.has(" ");
    const steer =
      (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const engineMultiplier = 1 + this.economy.vehicleUpgrade.engineStage * 0.22;
    const accel = 7.8 * engineMultiplier;
    const brakeAccel = 15.5;
    const reverseAccel = 4.1;

    if (throttle) {
      this.carSpeed += (this.carSpeed < 0 ? brakeAccel : accel) * dt;
    } else if (braking) {
      this.carSpeed -= (this.carSpeed > 0 ? brakeAccel : reverseAccel) * dt;
    } else {
      this.carSpeed *= Math.exp(-0.72 * dt);
      if (Math.abs(this.carSpeed) < 0.035) this.carSpeed = 0;
    }

    if (handbrake) {
      this.carSpeed *= Math.exp(-4.2 * dt);
      if (Math.abs(this.carSpeed) < 0.12) this.carSpeed = 0;
    }

    const topSpeed = 18.2 * engineMultiplier;
    this.carSpeed = THREE.MathUtils.clamp(this.carSpeed, -6.5, topSpeed);
    const steeringFactor = THREE.MathUtils.clamp(Math.abs(this.carSpeed) / 3, 0, 1);
    this.carYaw +=
      steer * 0.95 * steeringFactor * dt * (this.carSpeed >= 0 ? 1 : -1);
    this.carYaw = THREE.MathUtils.euclideanModulo(this.carYaw + Math.PI, Math.PI * 2) - Math.PI;

    const previous = this.carPosition.clone();
    this.carPosition.x += Math.sin(this.carYaw) * this.carSpeed * dt;
    this.carPosition.z += Math.cos(this.carYaw) * this.carSpeed * dt;
    if (this.carCollidesAt(this.carPosition.x, this.carPosition.z, this.carYaw)) {
      this.carPosition.copy(previous);
      this.carSpeed = -this.carSpeed * 0.12;
      this.statusMessage = "The car contacted an obstacle";
    }

    this.wheelSpin += (this.carSpeed * dt) / 0.36;
    this.car.wheels.forEach((wheel) => {
      if (wheel.children[0]) wheel.children[0].rotation.x = this.wheelSpin;
      if (wheel.children[1]) wheel.children[1].rotation.x = this.wheelSpin;
    });
    const steeringAngle = steer * 0.36 * steeringFactor;
    this.car.frontWheels.forEach((wheel) => {
      wheel.rotation.y = steeringAngle;
    });
    this.car.root.position.set(
      this.carPosition.x,
      this.surfaceHeight(this.carPosition.x, this.carPosition.z),
      this.carPosition.z,
    );
    this.car.root.rotation.y = this.carYaw;
  }

  private updateKeke(dt: number) {
    const throttle = this.keys.has("w");
    const braking = this.keys.has("s") || this.keys.has(" ");
    const steer =
      (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const accel = 8.6;
    const brakeAccel = 16.5;
    const reverseAccel = 4.2;

    if (throttle) {
      this.kekeSpeed += (this.kekeSpeed < 0 ? brakeAccel : accel) * dt;
    } else if (braking) {
      this.kekeSpeed -= (this.kekeSpeed > 0 ? brakeAccel : reverseAccel) * dt;
    } else {
      this.kekeSpeed *= Math.exp(-0.85 * dt);
      if (Math.abs(this.kekeSpeed) < 0.03) this.kekeSpeed = 0;
    }

    // Kano commercial tricycle top speed: ~48 km/h
    this.kekeSpeed = THREE.MathUtils.clamp(this.kekeSpeed, -4.5, 13.5);
    const steeringFactor = THREE.MathUtils.clamp(Math.abs(this.kekeSpeed) / 2.5, 0, 1);
    this.kekeYaw +=
      steer * 1.35 * steeringFactor * dt * (this.kekeSpeed >= 0 ? 1 : -1);
    this.kekeYaw = THREE.MathUtils.euclideanModulo(this.kekeYaw + Math.PI, Math.PI * 2) - Math.PI;

    const previous = this.kekePosition.clone();
    this.kekePosition.x += Math.sin(this.kekeYaw) * this.kekeSpeed * dt;
    this.kekePosition.z += Math.cos(this.kekeYaw) * this.kekeSpeed * dt;
    if (this.kekeCollidesAt(this.kekePosition.x, this.kekePosition.z, this.kekeYaw)) {
      this.kekePosition.copy(previous);
      this.kekeSpeed = -this.kekeSpeed * 0.15;
      this.statusMessage = "The Keke Napep contacted an obstacle";
    }

    this.kekeWheelSpin += (this.kekeSpeed * dt) / 0.28;
    this.keke.frontWheel.rotation.x = this.kekeWheelSpin;
    this.keke.rearWheels.forEach((wheel) => {
      wheel.rotation.x = this.kekeWheelSpin;
    });

    const steeringAngle = steer * 0.48 * steeringFactor;
    this.keke.frontFork.rotation.y = steeringAngle;
    this.keke.root.position.set(
      this.kekePosition.x,
      this.surfaceHeight(this.kekePosition.x, this.kekePosition.z),
      this.kekePosition.z,
    );
    this.keke.root.rotation.y = this.kekeYaw;
  }

  public getActiveVehiclePosition(): THREE.Vector3 {
    switch (this.activeVehicle) {
      case "keke": return this.kekePosition;
      case "van": return this.vanPosition;
      case "pickup": return this.pickupPosition;
      case "minibus": return this.minibusPosition;
      case "truck": return this.truckPosition;
      default: return this.carPosition;
    }
  }

  public getActiveVehicleYaw(): number {
    switch (this.activeVehicle) {
      case "keke": return this.kekeYaw;
      case "van": return this.vanYaw;
      case "pickup": return this.pickupYaw;
      case "minibus": return this.minibusYaw;
      case "truck": return this.truckYaw;
      default: return this.carYaw;
    }
  }

  public getActiveVehicleSpeed(): number {
    switch (this.activeVehicle) {
      case "keke": return this.kekeSpeed;
      case "van": return this.vanSpeed;
      case "pickup": return this.pickupSpeed;
      case "minibus": return this.minibusSpeed;
      case "truck": return this.truckSpeed;
      default: return this.carSpeed;
    }
  }

  private boxCollidesAt(x: number, z: number, yaw: number, halfWidth: number, halfLength: number) {
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    const absCosine = Math.abs(cosine);
    const absSine = Math.abs(sine);
    const broadphaseRadius = Math.max(
      halfWidth * absCosine + halfLength * absSine,
      halfWidth * absSine + halfLength * absCosine,
    );

    const corners = [
      [-halfWidth, -halfLength],
      [halfWidth, -halfLength],
      [halfWidth, halfLength],
      [-halfWidth, halfLength],
    ];

    const worldCorners = corners.map(([cornerX, cornerZ]) => [
      x + cornerX * cosine + cornerZ * sine,
      z - cornerX * sine + cornerZ * cosine,
    ]);

    const nearbyColliders = this.colliderIndex.query(x, z, broadphaseRadius + 1);
    for (const collider of nearbyColliders) {
      const minX = collider.x - collider.halfX;
      const maxX = collider.x + collider.halfX;
      const minZ = collider.z - collider.halfZ;
      const maxZ = collider.z + collider.halfZ;

      for (const [wx, wz] of worldCorners) {
        if (wx >= minX && wx <= maxX && wz >= minZ && wz <= maxZ) {
          return true;
        }
      }
    }
    return false;
  }

  private updateVan(dt: number) {
    const throttle = this.keys.has("w");
    const braking = this.keys.has("s");
    const handbrake = this.keys.has(" ");
    const steer = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const engineMultiplier = 1 + this.economy.vehicleUpgrade.engineStage * 0.22;
    const accel = 7.2 * engineMultiplier;
    const brakeAccel = 14.5;
    const reverseAccel = 3.8;

    if (throttle) {
      this.vanSpeed += (this.vanSpeed < 0 ? brakeAccel : accel) * dt;
    } else if (braking) {
      this.vanSpeed -= (this.vanSpeed > 0 ? brakeAccel : reverseAccel) * dt;
    } else {
      this.vanSpeed *= Math.exp(-0.75 * dt);
      if (Math.abs(this.vanSpeed) < 0.035) this.vanSpeed = 0;
    }

    if (handbrake) {
      this.vanSpeed *= Math.exp(-4.0 * dt);
      if (Math.abs(this.vanSpeed) < 0.12) this.vanSpeed = 0;
    }

    const topSpeed = 16.5 * engineMultiplier;
    this.vanSpeed = THREE.MathUtils.clamp(this.vanSpeed, -5.5, topSpeed);
    const steeringFactor = THREE.MathUtils.clamp(Math.abs(this.vanSpeed) / 3, 0, 1);
    this.vanYaw += steer * 0.88 * steeringFactor * dt * (this.vanSpeed >= 0 ? 1 : -1);
    this.vanYaw = THREE.MathUtils.euclideanModulo(this.vanYaw + Math.PI, Math.PI * 2) - Math.PI;

    const previous = this.vanPosition.clone();
    this.vanPosition.x += Math.sin(this.vanYaw) * this.vanSpeed * dt;
    this.vanPosition.z += Math.cos(this.vanYaw) * this.vanSpeed * dt;
    if (this.boxCollidesAt(this.vanPosition.x, this.vanPosition.z, this.vanYaw, 1.05, 2.3)) {
      this.vanPosition.copy(previous);
      this.vanSpeed = -this.vanSpeed * 0.12;
      this.statusMessage = "The Delivery Van contacted an obstacle";
    }

    this.vanWheelSpin += (this.vanSpeed * dt) / 0.36;
    this.van.wheels.forEach((w) => {
      if (w.children[0]) w.children[0].rotation.x = this.vanWheelSpin;
    });
    const steeringAngle = steer * 0.34 * steeringFactor;
    this.van.frontWheels.forEach((w) => {
      w.rotation.y = steeringAngle;
    });
    this.van.root.position.set(
      this.vanPosition.x,
      this.surfaceHeight(this.vanPosition.x, this.vanPosition.z),
      this.vanPosition.z,
    );
    this.van.root.rotation.y = this.vanYaw;
  }

  private updatePickup(dt: number) {
    const throttle = this.keys.has("w");
    const braking = this.keys.has("s");
    const handbrake = this.keys.has(" ");
    const steer = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const engineMultiplier = 1 + this.economy.vehicleUpgrade.engineStage * 0.22;
    const accel = 8.5 * engineMultiplier;
    const brakeAccel = 16.0;
    const reverseAccel = 4.5;

    if (throttle) {
      this.pickupSpeed += (this.pickupSpeed < 0 ? brakeAccel : accel) * dt;
    } else if (braking) {
      this.pickupSpeed -= (this.pickupSpeed > 0 ? brakeAccel : reverseAccel) * dt;
    } else {
      this.pickupSpeed *= Math.exp(-0.72 * dt);
      if (Math.abs(this.pickupSpeed) < 0.035) this.pickupSpeed = 0;
    }

    if (handbrake) {
      this.pickupSpeed *= Math.exp(-4.2 * dt);
      if (Math.abs(this.pickupSpeed) < 0.12) this.pickupSpeed = 0;
    }

    const topSpeed = 19.5 * engineMultiplier;
    this.pickupSpeed = THREE.MathUtils.clamp(this.pickupSpeed, -6.5, topSpeed);
    const steeringFactor = THREE.MathUtils.clamp(Math.abs(this.pickupSpeed) / 3, 0, 1);
    this.pickupYaw += steer * 1.02 * steeringFactor * dt * (this.pickupSpeed >= 0 ? 1 : -1);
    this.pickupYaw = THREE.MathUtils.euclideanModulo(this.pickupYaw + Math.PI, Math.PI * 2) - Math.PI;

    const previous = this.pickupPosition.clone();
    this.pickupPosition.x += Math.sin(this.pickupYaw) * this.pickupSpeed * dt;
    this.pickupPosition.z += Math.cos(this.pickupYaw) * this.pickupSpeed * dt;
    if (this.boxCollidesAt(this.pickupPosition.x, this.pickupPosition.z, this.pickupYaw, 1.05, 2.5)) {
      this.pickupPosition.copy(previous);
      this.pickupSpeed = -this.pickupSpeed * 0.12;
      this.statusMessage = "The Pickup Truck contacted an obstacle";
    }

    this.pickupWheelSpin += (this.pickupSpeed * dt) / 0.40;
    this.pickup.wheels.forEach((w) => {
      if (w.children[0]) w.children[0].rotation.x = this.pickupWheelSpin;
    });
    const steeringAngle = steer * 0.38 * steeringFactor;
    this.pickup.frontWheels.forEach((w) => {
      w.rotation.y = steeringAngle;
    });
    this.pickup.root.position.set(
      this.pickupPosition.x,
      this.surfaceHeight(this.pickupPosition.x, this.pickupPosition.z),
      this.pickupPosition.z,
    );
    this.pickup.root.rotation.y = this.pickupYaw;
  }

  private updateMinibus(dt: number) {
    const throttle = this.keys.has("w");
    const braking = this.keys.has("s");
    const handbrake = this.keys.has(" ");
    const steer = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const engineMultiplier = 1 + this.economy.vehicleUpgrade.engineStage * 0.22;
    const accel = 6.5 * engineMultiplier;
    const brakeAccel = 13.5;
    const reverseAccel = 3.5;

    if (throttle) {
      this.minibusSpeed += (this.minibusSpeed < 0 ? brakeAccel : accel) * dt;
    } else if (braking) {
      this.minibusSpeed -= (this.minibusSpeed > 0 ? brakeAccel : reverseAccel) * dt;
    } else {
      this.minibusSpeed *= Math.exp(-0.78 * dt);
      if (Math.abs(this.minibusSpeed) < 0.035) this.minibusSpeed = 0;
    }

    if (handbrake) {
      this.minibusSpeed *= Math.exp(-3.8 * dt);
      if (Math.abs(this.minibusSpeed) < 0.12) this.minibusSpeed = 0;
    }

    const topSpeed = 15.2 * engineMultiplier;
    this.minibusSpeed = THREE.MathUtils.clamp(this.minibusSpeed, -5.0, topSpeed);
    const steeringFactor = THREE.MathUtils.clamp(Math.abs(this.minibusSpeed) / 3, 0, 1);
    this.minibusYaw += steer * 0.80 * steeringFactor * dt * (this.minibusSpeed >= 0 ? 1 : -1);
    this.minibusYaw = THREE.MathUtils.euclideanModulo(this.minibusYaw + Math.PI, Math.PI * 2) - Math.PI;

    const previous = this.minibusPosition.clone();
    this.minibusPosition.x += Math.sin(this.minibusYaw) * this.minibusSpeed * dt;
    this.minibusPosition.z += Math.cos(this.minibusYaw) * this.minibusSpeed * dt;
    if (this.boxCollidesAt(this.minibusPosition.x, this.minibusPosition.z, this.minibusYaw, 1.05, 2.6)) {
      this.minibusPosition.copy(previous);
      this.minibusSpeed = -this.minibusSpeed * 0.12;
      this.statusMessage = "The Minibus contacted an obstacle";
    }

    this.minibusWheelSpin += (this.minibusSpeed * dt) / 0.37;
    this.minibus.wheels.forEach((w) => {
      if (w.children[0]) w.children[0].rotation.x = this.minibusWheelSpin;
    });
    const steeringAngle = steer * 0.32 * steeringFactor;
    this.minibus.frontWheels.forEach((w) => {
      w.rotation.y = steeringAngle;
    });
    this.minibus.root.position.set(
      this.minibusPosition.x,
      this.surfaceHeight(this.minibusPosition.x, this.minibusPosition.z),
      this.minibusPosition.z,
    );
    this.minibus.root.rotation.y = this.minibusYaw;
  }

  private updateTruck(dt: number) {
    const throttle = this.keys.has("w");
    const braking = this.keys.has("s");
    const handbrake = this.keys.has(" ");
    const steer = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const engineMultiplier = 1 + this.economy.vehicleUpgrade.engineStage * 0.22;
    const accel = 5.2 * engineMultiplier;
    const brakeAccel = 12.5;
    const reverseAccel = 3.0;

    if (throttle) {
      this.truckSpeed += (this.truckSpeed < 0 ? brakeAccel : accel) * dt;
    } else if (braking) {
      this.truckSpeed -= (this.truckSpeed > 0 ? brakeAccel : reverseAccel) * dt;
    } else {
      this.truckSpeed *= Math.exp(-0.82 * dt);
      if (Math.abs(this.truckSpeed) < 0.035) this.truckSpeed = 0;
    }

    if (handbrake) {
      this.truckSpeed *= Math.exp(-3.6 * dt);
      if (Math.abs(this.truckSpeed) < 0.12) this.truckSpeed = 0;
    }

    const topSpeed = 13.8 * engineMultiplier;
    this.truckSpeed = THREE.MathUtils.clamp(this.truckSpeed, -4.5, topSpeed);
    const steeringFactor = THREE.MathUtils.clamp(Math.abs(this.truckSpeed) / 3, 0, 1);
    this.truckYaw += steer * 0.68 * steeringFactor * dt * (this.truckSpeed >= 0 ? 1 : -1);
    this.truckYaw = THREE.MathUtils.euclideanModulo(this.truckYaw + Math.PI, Math.PI * 2) - Math.PI;

    const previous = this.truckPosition.clone();
    this.truckPosition.x += Math.sin(this.truckYaw) * this.truckSpeed * dt;
    this.truckPosition.z += Math.cos(this.truckYaw) * this.truckSpeed * dt;
    if (this.boxCollidesAt(this.truckPosition.x, this.truckPosition.z, this.truckYaw, 1.15, 3.2)) {
      this.truckPosition.copy(previous);
      this.truckSpeed = -this.truckSpeed * 0.12;
      this.statusMessage = "The Freight Truck contacted an obstacle";
    }

    this.truckWheelSpin += (this.truckSpeed * dt) / 0.42;
    this.truck.wheels.forEach((w) => {
      if (w.children[0]) w.children[0].rotation.x = this.truckWheelSpin;
    });
    const steeringAngle = steer * 0.28 * steeringFactor;
    this.truck.frontWheels.forEach((w) => {
      w.rotation.y = steeringAngle;
    });
    this.truck.root.position.set(
      this.truckPosition.x,
      this.surfaceHeight(this.truckPosition.x, this.truckPosition.z),
      this.truckPosition.z,
    );
    this.truck.root.rotation.y = this.truckYaw;
  }

  private moveCircle(position: THREE.Vector3, dx: number, dz: number, radius: number) {
    if (this.interiorManager.activeInterior) {
      const nextX = position.x + dx;
      if (!this.collides(nextX, position.z, radius)) position.x = nextX;
      const nextZ = position.z + dz;
      if (!this.collides(position.x, nextZ, radius)) position.z = nextZ;
      return;
    }

    const nextX = THREE.MathUtils.clamp(
      position.x + dx,
      -this.world.bounds + radius,
      this.world.bounds - radius,
    );
    if (!this.collides(nextX, position.z, radius)) position.x = nextX;

    const nextZ = THREE.MathUtils.clamp(
      position.z + dz,
      -230 + radius,
      this.world.bounds - radius,
    );
    if (!this.collides(position.x, nextZ, radius)) position.z = nextZ;
  }

  private collides(x: number, z: number, radius: number, skipVehicle = false) {
    if (this.interiorManager.activeInterior) {
      const activeZone = this.interiorManager.getActiveZone();
      if (!activeZone) return false;
      return activeZone.colliders.some((collider: Collider) => {
        const closestX = THREE.MathUtils.clamp(
          x,
          collider.x - collider.halfX,
          collider.x + collider.halfX,
        );
        const closestZ = THREE.MathUtils.clamp(
          z,
          collider.z - collider.halfZ,
          collider.z + collider.halfZ,
        );
        const dx = x - closestX;
        const dz = z - closestZ;
        return dx * dx + dz * dz < radius * radius;
      });
    }

    const bounds = this.world.bounds;
    if (Math.abs(x) > bounds - radius || Math.abs(z) > bounds - radius) return true;

    if (this.mode === "on-foot" && !skipVehicle) {
      if (this.overlapsCar(x, z, radius) || this.overlapsKeke(x, z, radius)) return true;
    }

    return this.colliderIndex.query(x, z, radius + 0.5).some((collider: Collider) => {
      const closestX = THREE.MathUtils.clamp(
        x,
        collider.x - collider.halfX,
        collider.x + collider.halfX,
      );
      const closestZ = THREE.MathUtils.clamp(
        z,
        collider.z - collider.halfZ,
        collider.z + collider.halfZ,
      );
      const dx = x - closestX;
      const dz = z - closestZ;
      return dx * dx + dz * dz < radius * radius;
    });
  }

  private overlapsCar(x: number, z: number, radius: number) {
    const dx = x - this.carPosition.x;
    const dz = z - this.carPosition.z;
    const cosine = Math.cos(this.carYaw);
    const sine = Math.sin(this.carYaw);
    const localX = dx * cosine - dz * sine;
    const localZ = dx * sine + dz * cosine;
    return Math.abs(localX) < 1.03 + radius && Math.abs(localZ) < 2.12 + radius;
  }

  private overlapsKeke(x: number, z: number, radius: number) {
    const dx = x - this.kekePosition.x;
    const dz = z - this.kekePosition.z;
    const cosine = Math.cos(this.kekeYaw);
    const sine = Math.sin(this.kekeYaw);
    const localX = dx * cosine - dz * sine;
    const localZ = dx * sine + dz * cosine;
    return Math.abs(localX) < 0.68 + radius && Math.abs(localZ) < 1.35 + radius;
  }

  private kekeCollidesAt(x: number, z: number, yaw: number) {
    const halfWidth = 0.68;
    const halfLength = 1.35;
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    const absCosine = Math.abs(cosine);
    const absSine = Math.abs(sine);
    const extentX = halfWidth * absCosine + halfLength * absSine;
    const extentZ = halfWidth * absSine + halfLength * absCosine;
    if (Math.abs(x) > this.world.bounds - extentX || Math.abs(z) > this.world.bounds - extentZ) return true;

    if (this.overlapsCar(x, z, 0.45)) return true;

    const nearby = this.colliderIndex.query(x, z, Math.hypot(halfWidth, halfLength) + 0.6);
    return nearby.some((collider) => {
      const dx = x - collider.x;
      const dz = z - collider.z;
      if (Math.abs(dx) >= extentX + collider.halfX || Math.abs(dz) >= extentZ + collider.halfZ) return false;

      const localX = dx * cosine - dz * sine;
      const localZ = dx * sine + dz * cosine;
      const otherHalfX = collider.halfX * absCosine + collider.halfZ * absSine;
      const otherHalfZ = collider.halfX * absSine + collider.halfZ * absCosine;
      return Math.abs(localX) < halfWidth + otherHalfX &&
        Math.abs(localZ) < halfLength + otherHalfZ;
    });
  }

  private carCollidesAt(x: number, z: number, yaw: number) {
    const halfWidth = 1.04;
    const halfLength = 2.12;
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    const absCosine = Math.abs(cosine);
    const absSine = Math.abs(sine);
    const extentX = halfWidth * absCosine + halfLength * absSine;
    const extentZ = halfWidth * absSine + halfLength * absCosine;
    if (Math.abs(x) > this.world.bounds - extentX || Math.abs(z) > this.world.bounds - extentZ) return true;

    if (this.overlapsKeke(x, z, 0.45)) return true;

    const nearby = this.colliderIndex.query(x, z, Math.hypot(halfWidth, halfLength) + 0.6);
    return nearby.some((collider) => {
      const dx = x - collider.x;
      const dz = z - collider.z;
      if (Math.abs(dx) >= extentX + collider.halfX || Math.abs(dz) >= extentZ + collider.halfZ) return false;

      const localX = dx * cosine - dz * sine;
      const localZ = dx * sine + dz * cosine;
      const otherHalfX = collider.halfX * absCosine + collider.halfZ * absSine;
      const otherHalfZ = collider.halfX * absSine + collider.halfZ * absCosine;
      return Math.abs(localX) < halfWidth + otherHalfX &&
        Math.abs(localZ) < halfLength + otherHalfZ;
    });
  }

  private isPropertyAccessible(propId: PropertyId): boolean {
    const prop = this.economy.properties.get(propId);
    if (!prop) return false;
    if (prop.isOwned) return true;
    if (propId === "unit-2b" && (this.hasApartmentRental || prop.isRented)) return true;
    return false;
  }

  private surfaceHeight(x: number, z: number) {
    if (this.interiorManager.activeInterior) {
      return this.interiorManager.getSurfaceHeight(this.interiorManager.activeInterior, x, z);
    }
    if (Math.abs(x + 31) <= 10.5 && Math.abs(z - 31) <= 9) return 0.045;
    for (const road of ROAD_LAYOUT) {
      const lateral = road.axis === "x" ? Math.abs(z - road.center) : Math.abs(x - road.center);
      if (lateral <= road.width / 2) return 0.018;
    }
    for (const road of ROAD_LAYOUT) {
      const lateral = road.axis === "x" ? Math.abs(z - road.center) : Math.abs(x - road.center);
      if (lateral > road.width / 2 && lateral <= road.width / 2 + 3) return 0.085;
    }
    return 0;
  }

  private updateCamera(dt: number) {
    const isDriving = this.mode === "driving";
    const isIndoors = Boolean(this.interiorManager.activeInterior);
    const vehiclePos = this.getActiveVehiclePosition();
    const vehicleYaw = this.getActiveVehicleYaw();

    let distance = 6.35;
    let targetY = this.playerPosition.y + (isIndoors ? 1.4 : 1.25);
    if (isDriving) {
      switch (this.activeVehicle) {
        case "truck":
          distance = 11.2;
          targetY = 1.55;
          break;
        case "minibus":
          distance = 9.6;
          targetY = 1.35;
          break;
        case "van":
          distance = 9.0;
          targetY = 1.25;
          break;
        case "pickup":
          distance = 8.8;
          targetY = 1.15;
          break;
        case "keke":
          distance = 5.8;
          targetY = 0.95;
          break;
        default:
          distance = 8.3;
          targetY = 1.0;
          break;
      }
    } else if (isIndoors) {
      distance = 3.0;
    }

    const target = isDriving
      ? new THREE.Vector3(vehiclePos.x, targetY, vehiclePos.z)
      : new THREE.Vector3(this.playerPosition.x, targetY, this.playerPosition.z);
    let followYaw = isDriving ? vehicleYaw + this.cameraYaw : this.cameraYaw;
    if (isDriving) {
      const activeSpeed = this.getActiveVehicleSpeed();
      if (activeSpeed < -0.8) {
        followYaw += Math.PI;
      }
    }
    const heightPitch = isIndoors ? Math.min(this.cameraPitch, 0.45) : this.cameraPitch;
    const direction = new THREE.Vector3(
      -Math.sin(followYaw) * Math.cos(heightPitch),
      Math.sin(heightPitch),
      -Math.cos(followYaw) * Math.cos(heightPitch),
    );
    const desired = target.clone().addScaledVector(direction, distance);
    const path = desired.clone().sub(target);
    const pathLength = path.length();
    const samples = Math.ceil(pathLength / 0.4);
    let safeDistance = pathLength;
    const minSafeDist = isIndoors ? 1.4 : 2.0;
    const activeZone = this.interiorManager.getActiveZone();
    for (let step = 2; step <= samples; step += 1) {
      const distanceAlongPath = Math.min(step * 0.4, pathLength);
      const point = target.clone().addScaledVector(path, distanceAlongPath / pathLength);
      let blocked = false;
      if (activeZone) {
        blocked = activeZone.colliders.some((collider: Collider) => {
          const dx = Math.max(Math.abs(point.x - collider.x) - collider.halfX, 0);
          const dz = Math.max(Math.abs(point.z - collider.z) - collider.halfZ, 0);
          return dx * dx + dz * dz < 0.36 * 0.36;
        });
      } else {
        blocked = this.colliderIndex.query(point.x, point.z, 1.4).some((collider: Collider) => {
          if (point.y > (collider.height ?? 3.5) - 0.2) return false;
          const dx = Math.max(Math.abs(point.x - collider.x) - collider.halfX, 0);
          const dz = Math.max(Math.abs(point.z - collider.z) - collider.halfZ, 0);
          return dx * dx + dz * dz < 0.36 * 0.36;
        });
      }
      if (blocked) {
        safeDistance = Math.max(minSafeDist, distanceAlongPath - 0.45);
        break;
      }
    }
    if (pathLength > 0) {
      desired.copy(target).addScaledVector(path.multiplyScalar(1 / pathLength), safeDistance);
    }
    const smoothing = 1 - Math.exp(-9.5 * dt);
    this.camera.position.lerp(desired, smoothing);
    this.lookMatrix.lookAt(this.camera.position, target, this.camera.up);
    this.desiredCameraQuaternion.setFromRotationMatrix(this.lookMatrix);
    this.camera.quaternion.slerp(this.desiredCameraQuaternion, 1 - Math.exp(-14 * dt));
  }

  private updateTransform() {
    this.player.root.position.copy(this.playerPosition);
    this.player.root.rotation.y = this.playerYaw;
    this.car.root.position.set(
      this.carPosition.x,
      this.surfaceHeight(this.carPosition.x, this.carPosition.z),
      this.carPosition.z,
    );
    this.car.root.rotation.y = this.carYaw;
    this.keke.root.position.set(
      this.kekePosition.x,
      this.surfaceHeight(this.kekePosition.x, this.kekePosition.z),
      this.kekePosition.z,
    );
    this.keke.root.rotation.y = this.kekeYaw;
    this.van.root.position.set(
      this.vanPosition.x,
      this.surfaceHeight(this.vanPosition.x, this.vanPosition.z),
      this.vanPosition.z,
    );
    this.van.root.rotation.y = this.vanYaw;
    this.pickup.root.position.set(
      this.pickupPosition.x,
      this.surfaceHeight(this.pickupPosition.x, this.pickupPosition.z),
      this.pickupPosition.z,
    );
    this.pickup.root.rotation.y = this.pickupYaw;
    this.minibus.root.position.set(
      this.minibusPosition.x,
      this.surfaceHeight(this.minibusPosition.x, this.minibusPosition.z),
      this.minibusPosition.z,
    );
    this.minibus.root.rotation.y = this.minibusYaw;
    this.truck.root.position.set(
      this.truckPosition.x,
      this.surfaceHeight(this.truckPosition.x, this.truckPosition.z),
      this.truckPosition.z,
    );
    this.truck.root.rotation.y = this.truckYaw;
  }

  private pushSnapshot(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastSnapshotAt < 120) return;
    this.lastSnapshotAt = now;

    let interactionPrompt: string | null = null;
    if (this.mode === "driving") {
      const activeVehPos = this.getActiveVehiclePosition();
      const missionInter = this.missionSystem.checkMissionInteraction(activeVehPos);
      if (missionInter) {
        interactionPrompt = missionInter.prompt;
      } else {
        const exitLabels: Record<VehicleType, string> = {
          sedan: "Exit Sedan",
          keke: "Exit Keke Napep",
          van: "Exit Delivery Van",
          pickup: "Exit Pickup Truck",
          minibus: "Exit Passenger Minibus",
          truck: "Exit Freight Truck",
        };
        interactionPrompt = exitLabels[this.activeVehicle] ?? "Exit Vehicle";
      }
    } else if (this.interiorManager.activeInterior) {
      const activeZone = this.interiorManager.getActiveZone();
      if (activeZone) {
        const furnInter = this.interiorManager.getFurnitureInteraction(this.playerPosition);
        if (furnInter) {
          interactionPrompt = furnInter.prompt;
        } else {
          const nearbyDoor = this.interiorManager.getNearbyDoor(this.playerPosition, 2.0);
          if (nearbyDoor) {
            interactionPrompt = `${nearbyDoor.isOpen ? "Close" : "Open"} ${nearbyDoor.name}`;
          } else if (this.playerPosition.distanceTo(activeZone.exitPoint) <= 2.2) {
            interactionPrompt = `Exit ${activeZone.name}`;
          } else if (activeZone.checkInteraction) {
            const inter = activeZone.checkInteraction(this.playerPosition, {
              cash: this.cash,
              trafficFine: this.trafficFine,
              hasApartmentRental: this.hasApartmentRental,
              score: this.gameScore,
              ownedProperties: this.economy.getOwnedPropertiesList(),
              ownedBusinesses: this.economy.getOwnedBusinessesList(),
            });
            if (inter) interactionPrompt = inter.prompt;
          }
        }
      }
    } else {
      // 1. Check Mission Checkpoint Interaction on foot
      const missionInter = this.missionSystem.checkMissionInteraction(this.playerPosition);
      if (missionInter) {
        interactionPrompt = missionInter.prompt;
      }

      // Check Kawu Logistics Dispatch Board at (-8, 0, -140)
      if (!interactionPrompt && this.playerPosition.distanceTo(new THREE.Vector3(-8, 0, -140)) <= 3.4) {
        interactionPrompt = "Logistics Dispatch Board: Press [J] or click MISSIONS for Contracts";
      }

      // Check residential property entrance doors
      if (!interactionPrompt) {
        const nearbyProperty = getPropertyByEntrance(this.playerPosition, 3.4);
        if (nearbyProperty) {
          const isAccessible = this.isPropertyAccessible(nearbyProperty.id);
          if (isAccessible) {
            const role = (nearbyProperty.id === "unit-2b" && !this.economy.properties.get("unit-2b")?.isOwned)
              ? "Tenant"
              : "Owner";
            const isHome = this.economy.selectedHomePropertyId === nearbyProperty.id;
            interactionPrompt = `Enter ${nearbyProperty.name} (${role}${isHome ? " · PRIMARY HOME" : ""})`;
          } else if (nearbyProperty.id === "unit-2b") {
            interactionPrompt = this.cash >= 75000
              ? "Lease Unit 2B Apartment (₦75,000 / month)"
              : "Unit 2B: Lease (₦75,000/mo) or Buy (₦18M) [Need ₦75k]";
          } else {
            const price = nearbyProperty.purchasePrice;
            interactionPrompt = this.cash >= price
              ? `Purchase ${nearbyProperty.name} (₦${price.toLocaleString()})`
              : `${nearbyProperty.name}: For Sale (₦${price.toLocaleString()})`;
          }
        }
      }

      // Check public outdoor interior doors
      if (!interactionPrompt) {
        for (const [id, zone] of this.interiorManager.interiors.entries()) {
          if (id === "apartment" || id === "penthouse" || id === "house") continue;
          if (this.playerPosition.distanceTo(zone.outdoorDoorPosition) <= 3.4) {
            interactionPrompt = `Enter ${zone.name}`;
            break;
          }
        }
      }
      // Check ATM
      if (!interactionPrompt && this.playerPosition.distanceTo(new THREE.Vector3(86.2, 0, -13.9)) <= 2.4) {
        interactionPrompt = "ATM: Withdraw Cash (₦20,000)";
      }
      // Check officers
      if (!interactionPrompt) {
        if (this.playerPosition.distanceTo(new THREE.Vector3(26, 0, -12)) <= 3.2) {
          interactionPrompt = "Talk to Police Officer";
        } else if (this.playerPosition.distanceTo(new THREE.Vector3(-10, 0, -56)) <= 3.2) {
          interactionPrompt = "Talk to NPF Officer";
        } else if (this.playerPosition.distanceTo(new THREE.Vector3(20, 0, -9.5)) <= 3.2) {
          interactionPrompt = "Talk to KAROTA Officer";
        }
      }
      // Check outdoor food vendors
      if (!interactionPrompt) {
        if (this.playerPosition.distanceTo(new THREE.Vector3(-15, 0, -155)) <= 3.4) {
          interactionPrompt = "Mai Shayi: Order Spiced Tea & Fried Egg Bread (₦1,200)";
        } else if (this.playerPosition.distanceTo(new THREE.Vector3(-72, 0, -72)) <= 3.4) {
          interactionPrompt = "Dandali Food Stall: Buy Hot Masa & Kosai (₦800)";
        }
      }
      // Check Story Triggers
      if (!interactionPrompt) {
        if (this.playerPosition.distanceTo(new THREE.Vector3(-85, 0, -68)) <= 3.8) {
          const progress = this.storySystem.getProgress();
          if (progress.stage === 0) {
            interactionPrompt = "Malam Kabiru: Receive 1968 Indenture";
          } else if (progress.stage === 1) {
            interactionPrompt = "Dan-Kano Zaure: Investigate Indenture (Elders or Bank)";
          } else if (progress.stage === 2) {
            interactionPrompt = "Dan-Kano Zaure: Select Commercial Foundation";
          } else if (progress.stage === 3) {
            interactionPrompt = "Dan-Kano Zaure: Complete Chapter 1 & Claim Title";
          } else {
            interactionPrompt = "Dan-Kano Zaure: Story Chapter 1 Secured";
          }
        } else if (this.playerPosition.distanceTo(new THREE.Vector3(-72, 0, -72)) <= 3.8) {
          const progress = this.storySystem.getProgress();
          if (progress.stage === 1 && progress.investigationChoice === null) {
            interactionPrompt = "Dandali Elders: Investigate 1968 Indenture (+25 Trust)";
          }
        } else if (this.playerPosition.distanceTo(new THREE.Vector3(80, 0, -22)) <= 3.8) {
          const progress = this.storySystem.getProgress();
          if (progress.stage === 1 && progress.investigationChoice === null) {
            interactionPrompt = "Arewa Bank: Audit 1968 Ledger (+₦10,000 Credit)";
          }
        }
      }

      // Check outdoor shops / workshops
      if (!interactionPrompt) {
        if (this.playerPosition.distanceTo(new THREE.Vector3(-22, 0, 45.2)) <= 2.8) {
          const biz = this.economy.businesses.get("sabon-gari-shop");
          interactionPrompt = biz?.isOwned
            ? "Sabon Gari Electronics: Owned Enterprise"
            : "Acquire Sabon Gari Electronics Stall (₦450,000)";
        } else if (this.playerPosition.distanceTo(new THREE.Vector3(-16, 0, -22)) <= 3.2) {
          interactionPrompt = this.economy.vehicleUpgrade.engineStage >= 2
            ? "Sani Auto Workshop: Max Stage 2 Tune Active"
            : `Sani Auto: Engine Tune Stage ${this.economy.vehicleUpgrade.engineStage + 1} (₦${this.economy.vehicleUpgrade.engineStage === 0 ? "50,000" : "95,000"})`;
        }
      }
      // Check street pedestrians and mobile patrols
      if (!interactionPrompt) {
        const pedInter = this.pedestrianSystem.checkPedestrianInteraction(this.playerPosition);
        if (pedInter) {
          interactionPrompt = pedInter.prompt;
        } else {
          const trafficInter = this.trafficSystem.checkTrafficInteraction(this.playerPosition);
          if (trafficInter) {
            interactionPrompt = trafficInter.prompt;
          }
        }
      }
      // Check vehicles
      if (!interactionPrompt) {
        const vehOptions: { type: VehicleType; prompt: string; pos: THREE.Vector3; dist: number; maxDist: number }[] = [
          { type: "sedan", prompt: "Drive Sedan", pos: this.carPosition, dist: this.playerPosition.distanceTo(this.carPosition), maxDist: 4.7 },
          { type: "keke", prompt: "Ride Keke Napep", pos: this.kekePosition, dist: this.playerPosition.distanceTo(this.kekePosition), maxDist: 4.7 },
          { type: "van", prompt: "Drive Delivery Van", pos: this.vanPosition, dist: this.playerPosition.distanceTo(this.vanPosition), maxDist: 4.8 },
          { type: "pickup", prompt: "Drive Pickup Truck", pos: this.pickupPosition, dist: this.playerPosition.distanceTo(this.pickupPosition), maxDist: 4.8 },
          { type: "minibus", prompt: "Drive Passenger Minibus", pos: this.minibusPosition, dist: this.playerPosition.distanceTo(this.minibusPosition), maxDist: 5.0 },
          { type: "truck", prompt: "Drive Freight Truck", pos: this.truckPosition, dist: this.playerPosition.distanceTo(this.truckPosition), maxDist: 5.5 },
        ];
        const enterable = vehOptions.filter((v) => v.dist <= v.maxDist).sort((a, b) => a.dist - b.dist);
        if (enterable.length > 0) {
          interactionPrompt = enterable[0].prompt;
        }
      }
    }

    const location = this.mode === "driving"
      ? this.getActiveVehiclePosition()
      : this.playerPosition;
    const currentSpeed = this.mode === "driving"
      ? Math.abs(this.getActiveVehicleSpeed()) * 3.6
      : 0;

    const activeZone = this.interiorManager.getActiveZone();
    const locationLabel = activeZone
      ? activeZone.districtLabel
      : getDistrictLabel(getDistrict(location.x, location.z));

    const totalMins = Math.floor(this.gameMinutes) % (24 * 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = Math.floor(totalMins % 60);
    const timeString = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

    let featuredContact: SocialContact | null = null;
    if (this.interiorManager.activeInterior === "restaurant") {
      featuredContact = this.socialSystem.getContact("amina") ?? null;
    } else if (this.interiorManager.activeInterior === "gaming-hub") {
      featuredContact = this.socialSystem.getContact("zainab") ?? null;
    } else if (this.featuredContactId) {
      featuredContact = this.socialSystem.getContact(this.featuredContactId) ?? null;
    }

    const activeMissionInfo = this.missionSystem.getActiveMissionSnapshot(
      this.mode === "driving" ? this.getActiveVehiclePosition() : this.playerPosition,
    );

    this.callbacks.onSnapshot({
      mode: this.mode,
      vehicleType: this.activeVehicle,
      location: locationLabel,
      speedKmh: currentSpeed,
      interactionPrompt,
      statusMessage: this.statusMessage,
      cash: this.cash,
      trafficFine: this.trafficFine,
      hasApartmentRental: this.hasApartmentRental,
      activeInterior: this.interiorManager.activeInterior,
      timeString,
      gameScore: this.gameScore,
      featuredContact,
      ownedProperties: this.economy.getOwnedPropertiesList(),
      ownedBusinesses: this.economy.getOwnedBusinessesList(),
      dailyIncome: this.economy.getDailyNetIncome(),
      dayCount: this.economy.dayCount,
      gpsTarget: this.gpsTargetLandmark,
      activeMission: activeMissionInfo,
      availableMissionsCount: this.missionSystem.getAvailableMissions().length,
      playerCoords: {
        x: Math.round(location.x * 10) / 10,
        z: Math.round(location.z * 10) / 10,
      },
      playerHeading: this.mode === "driving" ? this.getActiveVehicleYaw() : this.playerYaw,
      storyInfo: this.storySystem.getSnapshotInfo({ x: location.x, z: location.z }),
      weatherPreset: this.weatherSystem.getPreset(),
      weatherDisplayName: this.weatherSystem.getPresetDisplayName(),
      audioMuted: this.audioSystem.isMuted(),
      isFurnishingMode: this.isFurnishingMode,
      furnishingTargetName: this.getFurnishingTargetName(),
      unplacedFurnitureCount: this.economy.getUnplacedFurniture().length,
      placedFurnitureCount: this.getCurrentInteriorPropertyId()
        ? this.economy.getPlacedFurniture(this.getCurrentInteriorPropertyId()!).length
        : 0,
      isFurnitureShopOpen: this.isFurnitureShopOpen,
      selectedHomePropertyId: this.economy.selectedHomePropertyId,
      homeNavInfo: this.getHomeNavInfo(),
      playerHomes: this.getPlayerHomes(),
      needs: this.lifeSim.getSnapshot(),
      freelanceInfo: this.freelanceSystem.getSnapshot(),
    });
  }

  public getPlayerHomes(): PlayerHomeEntry[] {
    const accessible = this.economy.getAccessibleProperties(this.hasApartmentRental);
    const selectedId = this.economy.resolveSelectedHome(this.hasApartmentRental);
    return accessible.map((p) => {
      const reg = getPropertyRegistryEntry(p.id);
      const entranceCoords = reg
        ? { x: reg.entranceDoor.x, z: reg.entranceDoor.z }
        : { x: 0, z: 0 };
      const dist = Math.round(
        Math.hypot(this.playerPosition.x - entranceCoords.x, this.playerPosition.z - entranceCoords.z),
      );
      const isLeased = p.id === "unit-2b" && !p.isOwned && (p.isRented || this.hasApartmentRental);
      const landmarkId = p.id === "unit-2b" ? "apartment" : p.id === "bompai-penthouse" ? "bompai-flats" : "villa";
      return {
        propertyId: p.id,
        name: reg?.name ?? p.name,
        district: reg?.district ?? "KANO",
        status: isLeased ? "LEASED" : "OWNED",
        isSelectedHome: p.id === selectedId,
        entranceCoords,
        distanceMeters: dist,
        description: reg?.description ?? p.description,
        landmarkId,
      };
    });
  }

  public getHomeNavInfo(): HomeNavInfo | null {
    const homeId = this.economy.resolveSelectedHome(this.hasApartmentRental);
    if (!homeId) return null;
    const reg = getPropertyRegistryEntry(homeId);
    if (!reg) return null;
    const distance = Math.round(
      Math.hypot(this.playerPosition.x - reg.entranceDoor.x, this.playerPosition.z - reg.entranceDoor.z),
    );
    return {
      propertyId: homeId,
      name: reg.name,
      district: reg.district,
      distanceMeters: distance,
      entranceCoords: { x: reg.entranceDoor.x, z: reg.entranceDoor.z },
      isInsideHome: this.interiorManager.activeInterior === reg.interiorId,
    };
  }

  public setSelectedHome(propertyId: PropertyId): { success: boolean; message: string } {
    const res = this.economy.setSelectedHome(propertyId, this.hasApartmentRental);
    this.statusMessage = res.message;
    if (res.success && this.gpsTargetLandmark === "my-home") {
      this.gpsTargetLandmark = "my-home";
    }
    this.saveGame();
    this.pushSnapshot(true);
    return res;
  }

  public leaseProperty(propertyId: PropertyId = "unit-2b"): { success: boolean; message: string } {
    if (propertyId !== "unit-2b") {
      return { success: false, message: "Only Unit 2B (Airport View Apartments) is available for monthly lease." };
    }
    const prop = this.economy.properties.get("unit-2b");
    if (prop?.isOwned) {
      return { success: false, message: "You already hold the Certificate of Occupancy deed for Unit 2B." };
    }
    if (this.hasApartmentRental && prop?.isRented) {
      return { success: false, message: "You already hold an active monthly lease for Unit 2B." };
    }
    if (this.cash < 75000) {
      return {
        success: false,
        message: `Insufficient funds: Monthly lease requires ₦75,000 (Available: ₦${this.cash.toLocaleString()}).`,
      };
    }

    this.cash -= 75000;
    this.hasApartmentRental = true;
    if (prop) prop.isRented = true;
    this.economy.resolveSelectedHome(true);
    this.statusMessage = "Monthly lease signed for Unit 2B (₦75,000)! Welcome home.";
    this.saveGame();
    this.pushSnapshot(true);
    return { success: true, message: this.statusMessage };
  }

  public purchaseProperty(propertyId: PropertyId): { success: boolean; message: string } {
    const res = this.economy.purchaseProperty(propertyId, this.cash);
    if (res.success) {
      this.cash -= res.cost;
      this.economy.resolveSelectedHome(this.hasApartmentRental);
      this.statusMessage = res.message;
      this.saveGame();
      this.pushSnapshot(true);
    } else {
      this.statusMessage = res.message;
      this.pushSnapshot(true);
    }
    return { success: res.success, message: res.message };
  }

  public findMyHome(): { success: boolean; message: string } {
    const nav = this.getHomeNavInfo();
    if (!nav) {
      this.statusMessage = "No home owned or leased. Lease Unit 2B or purchase a residence first.";
      this.pushSnapshot(true);
      return { success: false, message: this.statusMessage };
    }
    this.gpsTargetLandmark = "my-home";
    this.statusMessage = `GPS Target set: My Home · ${nav.name} (${nav.distanceMeters}m away)`;
    this.pushSnapshot(true);
    return { success: true, message: this.statusMessage };
  }

  public teleportHome(destination: "entrance" | "interior" = "entrance"): { success: boolean; message: string } {
    const homeId = this.economy.resolveSelectedHome(this.hasApartmentRental);
    if (!homeId) {
      this.statusMessage = "Cannot Teleport: No home owned or leased. Lease Unit 2B or purchase a property first.";
      this.pushSnapshot(true);
      return { success: false, message: this.statusMessage };
    }
    const reg = getPropertyRegistryEntry(homeId);
    if (!reg) {
      this.statusMessage = "Property registry information not found.";
      this.pushSnapshot(true);
      return { success: false, message: this.statusMessage };
    }
    if (!this.isPropertyAccessible(homeId)) {
      this.statusMessage = `Access Denied: You do not have valid ownership or lease for ${reg.name}.`;
      this.pushSnapshot(true);
      return { success: false, message: this.statusMessage };
    }

    if (this.mode === "driving") {
      this.toggleVehicle();
    }

    if (destination === "interior") {
      const zone = this.interiorManager.interiors.get(reg.interiorId);
      if (zone) {
        if (!this.interiorManager.activeInterior) {
          this.interiorManager.outdoorSavedPosition.copy(this.playerPosition);
          this.interiorManager.outdoorSavedYaw = this.playerYaw;
        }
        this.interiorManager.activeInterior = reg.interiorId;
        this.playerPosition.copy(zone.spawnPoint);
        this.playerYaw = zone.spawnYaw;
        this.isFurnishingMode = false;
        this.statusMessage = `[FAST TRAVEL] Teleported inside ${reg.name}. Welcome home!`;
      }
    } else {
      if (this.interiorManager.activeInterior) {
        this.interiorManager.activeInterior = null;
        this.isFurnishingMode = false;
      }
      const ground = this.surfaceHeight(reg.entranceDoor.x, reg.entranceDoor.z);
      this.playerPosition.set(reg.entranceDoor.x, ground, reg.entranceDoor.z);
      this.playerYaw = reg.entranceDoor.yaw;
      this.statusMessage = `[FAST TRAVEL] Teleported to entrance of ${reg.name}.`;
    }

    this.updateTransform();
    this.pushSnapshot(true);
    return { success: true, message: this.statusMessage ?? "Teleported home." };
  }

  public executeFreelanceContract(contractId?: string): { success: boolean; message: string } {
    const next = contractId
      ? FREELANCE_CONTRACT_CATALOG.find((c) => c.id === contractId)
      : this.freelanceSystem.getNextAvailableContract();

    if (!next) {
      const earnings = this.freelanceSystem.totalEarnings;
      this.statusMessage = `All 8 Kano Freelance Contracts completed and archived (₦${earnings.toLocaleString()} total earned). Client roster full!`;
      this.pushSnapshot(true);
      return { success: false, message: this.statusMessage };
    }

    const res = this.freelanceSystem.completeContract(next.id);
    if (res.success) {
      this.cash += res.payout;
      this.gameMinutes += res.durationMinutes;
      this.economy.dayCount += Math.floor(res.durationMinutes / (24 * 60));
      this.lifeSim.update(res.durationMinutes * 60, false, false, true);
      this.gameScore += 35;
      this.statusMessage = `[FREELANCE SUCCESS] ${res.message} Time advanced by ${res.durationMinutes}m.`;
      this.saveGame();
    } else {
      this.statusMessage = res.message;
    }

    this.pushSnapshot(true);
    return { success: res.success, message: this.statusMessage ?? res.message };
  }

  public setGPSTarget(id: string | null) {
    if (id === "my-home") {
      const home = this.getHomeNavInfo();
      if (!home) {
        this.statusMessage = "Cannot set GPS to home: No residence owned or leased yet.";
        this.pushSnapshot(true);
        return;
      }
      this.gpsTargetLandmark = "my-home";
      this.statusMessage = `GPS Target set: My Home · ${home.name} (${home.distanceMeters}m away)`;
      this.pushSnapshot(true);
      return;
    }
    this.gpsTargetLandmark = id;
    if (id) {
      const lm = KANO_LANDMARKS.find((l) => l.id === id);
      if (lm) {
        this.statusMessage = `GPS Target set: ${lm.name} (${lm.district})`;
      }
    } else {
      this.statusMessage = "GPS Navigation cleared";
    }
    this.pushSnapshot(true);
  }

  public interactSocial(contactId: string, choiceId: string) {
    const outcome = this.socialSystem.interact(contactId, choiceId, this.cash, this.hasApartmentRental);
    if (outcome) {
      this.statusMessage = outcome.statusMessage;
      if (outcome.cashDelta) this.cash += outcome.cashDelta;
      this.featuredContactId = contactId;
      this.pushSnapshot(true);
      return outcome;
    }
    return null;
  }

  public acceptMission(id: string): boolean {
    const res = this.missionSystem.acceptMission(id);
    this.statusMessage = res.message;
    if (res.success) {
      const active = this.missionSystem.getActiveMission();
      if (active) {
        const stage = active.stages[active.currentStageIndex];
        this.statusMessage = `Accepted Contract: ${active.title}. Checkpoint: ${stage.instruction}`;
      }
    }
    this.pushSnapshot(true);
    return res.success;
  }

  public cancelMission(): boolean {
    const res = this.missionSystem.cancelActiveMission();
    this.statusMessage = res.message;
    this.pushSnapshot(true);
    return res.success;
  }

  public getAvailableMissions() {
    return this.missionSystem.getAvailableMissions();
  }

  public getMissionSystem(): MissionSystem {
    return this.missionSystem;
  }

  public saveGame(): boolean {
    return this.economy.saveToStorage(
      this.cash,
      this.trafficFine,
      this.hasApartmentRental,
      this.missionSystem.getCompletedMissionsList(),
      this.missionSystem.careerEarnings,
      this.storySystem.getProgress(),
      this.weatherSystem.getPreset(),
      this.audioSystem.isMuted(),
      this.economy.selectedHomePropertyId,
      this.lifeSim.getSnapshot(),
      this.freelanceSystem.getCompletedIds(),
      this.freelanceSystem.totalEarnings,
    );
  }

  public getWeatherSystem(): WeatherSystem {
    return this.weatherSystem;
  }

  public getWeatherPreset(): WeatherPreset {
    return this.weatherSystem.getPreset();
  }

  public setWeatherPreset(preset: WeatherPreset): void {
    this.weatherSystem.setPreset(preset);
    this.updateLighting();
    this.saveGame();
    this.pushSnapshot(true);
  }

  public cycleWeather(): WeatherPreset {
    const next = this.weatherSystem.cyclePreset();
    this.statusMessage = `Atmosphere: ${this.weatherSystem.getPresetDisplayName(next)}`;
    this.updateLighting();
    this.saveGame();
    this.pushSnapshot(true);
    return next;
  }

  public getAudioSystem(): AudioSystem {
    return this.audioSystem;
  }

  public toggleAudioMute(): boolean {
    const muted = this.audioSystem.toggleMute();
    this.statusMessage = muted ? "Audio Muted 🔇" : "Audio Active 🔊";
    this.saveGame();
    this.pushSnapshot(true);
    return muted;
  }

  public isAudioMuted(): boolean {
    return this.audioSystem.isMuted();
  }

  public setAudioMuted(muted: boolean): void {
    this.audioSystem.setMuted(muted);
    this.statusMessage = muted ? "Audio Muted 🔇" : "Audio Active 🔊";
    this.saveGame();
    this.pushSnapshot(true);
  }

  public getStorySystem(): StorySystem {
    return this.storySystem;
  }

  public examineStoryIndenture(): boolean {
    const res = this.storySystem.examineIndenture();
    this.statusMessage = res.message;
    this.saveGame();
    this.pushSnapshot(true);
    return res.success;
  }

  public chooseStoryInvestigation(choice: "elders" | "bank") {
    const res = this.storySystem.chooseInvestigation(choice);
    if (res.success && res.bonusCash > 0) {
      this.cash += res.bonusCash;
    }
    this.statusMessage = res.message;
    this.saveGame();
    this.pushSnapshot(true);
    return res;
  }

  public chooseStoryCareer(choice: CareerPathChoice) {
    const res = this.storySystem.chooseCareerPath(choice);
    this.statusMessage = res.message;
    this.saveGame();
    this.pushSnapshot(true);
    return res;
  }

  public resolveStoryChapter1() {
    const res = this.storySystem.resolveChapter1();
    if (res.success && res.payout > 0) {
      this.cash += res.payout;
      this.gameScore += res.storyXP;
    }
    this.statusMessage = res.message;
    this.saveGame();
    this.pushSnapshot(true);
    return res;
  }

  // =========================================================================
  // Milestone 9: Customizable Homes, Furnishing & Furniture Showroom
  // =========================================================================

  public syncAllPlacedFurniture(): void {
    const properties: { propId: PropertyId; interiorId: InteriorId }[] = [
      { propId: "unit-2b", interiorId: "apartment" },
      { propId: "bompai-penthouse", interiorId: "penthouse" },
      { propId: "albaraka-villa", interiorId: "house" },
    ];
    for (const { propId, interiorId } of properties) {
      const placed = this.economy.getPlacedFurniture(propId);
      this.interiorManager.updatePlacedFurniture(interiorId, placed);
    }
  }

  public getCurrentInteriorPropertyId(): PropertyId | null {
    if (this.interiorManager.activeInterior === "apartment") return "unit-2b";
    if (this.interiorManager.activeInterior === "penthouse") return "bompai-penthouse";
    if (this.interiorManager.activeInterior === "house") return "albaraka-villa";
    return null;
  }

  public canFurnishCurrentLocation(): boolean {
    const propId = this.getCurrentInteriorPropertyId();
    if (!propId) return false;
    if (propId === "unit-2b") {
      return this.hasApartmentRental || Boolean(this.economy.properties.get("unit-2b")?.isOwned);
    }
    return Boolean(this.economy.properties.get(propId)?.isOwned);
  }

  public getFurnishingTargetName(): string {
    const propId = this.getCurrentInteriorPropertyId();
    if (!propId) return "Residence";
    if (propId === "unit-2b") return "Airport View Unit 2B (Executive Flat)";
    if (propId === "bompai-penthouse") return "Bompai Heights Luxury Penthouse";
    if (propId === "albaraka-villa") return "Al-Baraka Executive Villa";
    return "Residence";
  }

  public isFurnitureShopActive(): boolean {
    return this.isFurnitureShopOpen;
  }

  public openFurnitureShop(): void {
    this.isFurnitureShopOpen = true;
    this.pushSnapshot(true);
  }

  public closeFurnitureShop(): void {
    this.isFurnitureShopOpen = false;
    this.pushSnapshot(true);
  }

  public isFurnishingModeActive(): boolean {
    return this.isFurnishingMode;
  }

  public toggleFurnishingMode(): { success: boolean; message: string } {
    if (!this.canFurnishCurrentLocation()) {
      const msg = "Furnishing Mode: Enter an owned or rented residence to customize your home.";
      this.statusMessage = msg;
      this.pushSnapshot(true);
      return { success: false, message: msg };
    }

    this.isFurnishingMode = !this.isFurnishingMode;
    const msg = this.isFurnishingMode
      ? `Furnishing Mode Enabled: ${this.getFurnishingTargetName()}`
      : "Furnishing Mode Disabled";
    this.statusMessage = msg;
    this.pushSnapshot(true);
    return { success: true, message: msg };
  }

  public purchaseFurniture(catalogId: string): { success: boolean; message: string } {
    const res = this.economy.purchaseFurniture(catalogId, this.cash);
    if (res.success && res.cost) {
      this.cash -= res.cost;
      this.saveGame();
      this.statusMessage = res.message;
      this.pushSnapshot(true);
    }
    return res;
  }

  public placeFurnitureItem(
    instanceId: string,
    room: string,
    floor: number,
    position: { x: number; y: number; z: number },
    rotationY: number,
  ): { success: boolean; message: string } {
    const propId = this.getCurrentInteriorPropertyId();
    if (!propId || !this.canFurnishCurrentLocation()) {
      return { success: false, message: "Must be inside an owned or rented home to place furniture." };
    }

    const res = this.economy.placeFurniture(instanceId, propId, floor, room, position, rotationY);
    if (res.success) {
      this.syncAllPlacedFurniture();
      this.saveGame();
      this.statusMessage = res.message;
      this.pushSnapshot(true);
    }
    return res;
  }

  public moveFurnitureItem(
    instanceId: string,
    position: { x: number; y: number; z: number },
    rotationY: number,
  ): { success: boolean; message: string } {
    const res = this.economy.moveFurniture(instanceId, position, rotationY);
    if (res.success) {
      this.syncAllPlacedFurniture();
      this.saveGame();
      this.statusMessage = res.message;
      this.pushSnapshot(true);
    }
    return res;
  }

  public storeFurnitureItem(instanceId: string): { success: boolean; message: string } {
    const res = this.economy.storeFurniture(instanceId);
    if (res.success) {
      this.syncAllPlacedFurniture();
      this.saveGame();
      this.statusMessage = res.message;
      this.pushSnapshot(true);
    }
    return res;
  }

  public rotateFurnitureItem(instanceId: string, deltaYaw = Math.PI / 2): { success: boolean; message: string } {
    const instance = this.economy.furnitureInventory.find((i) => i.instanceId === instanceId);
    if (!instance || !instance.isPlaced) {
      return { success: false, message: "Item is not placed." };
    }
    const newYaw = (instance.rotationY + deltaYaw) % (Math.PI * 2);
    return this.moveFurnitureItem(instanceId, instance.position, newYaw);
  }

  public getUnplacedFurniture(): FurnitureInstance[] {
    return this.economy.getUnplacedFurniture();
  }

  public getPlacedFurniture(propertyId?: PropertyId): FurnitureInstance[] {
    const propId = propertyId ?? this.getCurrentInteriorPropertyId();
    if (!propId) return [];
    return this.economy.getPlacedFurniture(propId);
  }

  private lerpAngle(from: number, to: number, alpha: number) {
    const delta = THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
    return from + delta * alpha;
  }
}
