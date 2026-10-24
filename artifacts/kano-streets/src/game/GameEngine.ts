import * as THREE from "three";
import {
  createCarModel,
  createKekeModel,
  createPlayerModel,
  type CarModel,
  type KekeModel,
  type PlayerModel,
} from "./actors";
import { loadGLTFModel } from "./assetManifest";
import { ColliderIndex } from "./ColliderIndex";
import { getDistrict, getDistrictLabel, ROAD_LAYOUT } from "./layout";
import { createMaterials } from "./materials";
import { buildNavigationNetwork, type NavigationNetwork } from "./navigation";
import { PedestrianSystem } from "./PedestrianSystem";
import { TrafficSystem } from "./TrafficSystem";
import { createWorld } from "./world";
import type { Collider, GameMode, GameScreen, GameSnapshot, GraphicsQuality, VehicleType } from "./types";

const PLAYER_START = new THREE.Vector3(-4, 0, -4);
const CAR_START = new THREE.Vector3(-2, 0, -8);
const KEKE_START = new THREE.Vector3(6, 0, -8);
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
  private walkPhase = 0;
  private wheelSpin = 0;

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

    this.materials = createMaterials();
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

    void this.loadAssets();

    this.camera.position.set(0, 3.8, -6.8);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    this.onKeyDownBound = (event) => this.onKeyDown(event);
    this.onKeyUpBound = (event) => this.keys.delete(normalizeMovementKey(event.key.toLowerCase()));
    this.onMouseMoveBound = (event) => this.onMouseMove(event);
    this.onPointerLockBound = () => this.onPointerLockChange();
    this.onCanvasClickBound = () => {
      if (
        this.screen === "playing" &&
        !this.prefersTouchControls() &&
        document.pointerLockElement !== this.canvas
      ) {
        this.requestPointerLock();
      }
    };
    this.onCanvasPointerDownBound = (event) => {
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
  }

  private updateLighting() {
    if (!this.sunLight) return;
    const targetPos = this.mode === "driving"
      ? (this.activeVehicle === "keke" ? this.kekePosition : this.carPosition)
      : this.playerPosition;
    this.sunLight.position.set(targetPos.x - 44, 62, targetPos.z - 34);
    this.sunLight.target.position.set(targetPos.x, targetPos.y, targetPos.z);
    this.sunLight.target.updateMatrixWorld();
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
    if (normalized === "e" && this.screen === "playing") {
      this.toggleVehicle();
      return;
    }
    if (normalized === "r" && this.screen !== "menu") {
      this.reset();
      return;
    }
    if (normalized === "escape" && this.screen === "playing") {
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
    this.player.root.visible = true;
    this.car.root.visible = true;
    this.keke.root.visible = true;
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
    if (["w", "a", "s", "d", " ", "shift", "e", "r", "escape", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }

    if (key === "escape" && !event.repeat && this.screen === "playing") {
      this.callbacks.onPause();
      return;
    }
    if (key === "r" && !event.repeat && this.screen !== "menu") {
      this.reset();
      return;
    }
    if (key === "e" && !event.repeat && this.screen === "playing") {
      this.toggleVehicle();
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

  private toggleVehicle() {
    if (this.mode === "on-foot") {
      const distCar = this.playerPosition.distanceTo(this.carPosition);
      const distKeke = this.playerPosition.distanceTo(this.kekePosition);
      if (distCar <= 4.7 && distCar <= distKeke) {
        this.activeVehicle = "sedan";
        this.mode = "driving";
        this.carSpeed = 0;
        this.player.root.visible = false;
        this.statusMessage = "You are driving the Sedan";
        this.pushSnapshot(true);
        return;
      }
      if (distKeke <= 4.7) {
        this.activeVehicle = "keke";
        this.mode = "driving";
        this.kekeSpeed = 0;
        this.player.root.visible = false;
        this.statusMessage = "You are riding the Keke Napep";
        this.pushSnapshot(true);
        return;
      }
      this.statusMessage = "Move closer to a vehicle";
      this.pushSnapshot(true);
      return;
    }

    if (this.activeVehicle === "keke") {
      const right = new THREE.Vector3(Math.cos(this.kekeYaw), 0, -Math.sin(this.kekeYaw));
      const candidates = [
        this.kekePosition.clone().addScaledVector(right, 1.45),
        this.kekePosition.clone().addScaledVector(right, -1.45),
      ];
      const safeExit = candidates.find(
        (candidate) =>
          !this.collides(candidate.x, candidate.z, 0.45) &&
          !this.overlapsKeke(candidate.x, candidate.z, 0.45) &&
          !this.overlapsCar(candidate.x, candidate.z, 0.45) &&
          candidate.distanceTo(this.kekePosition) > 1.2,
      );
      if (!safeExit) {
        this.statusMessage = "There is not enough clear space to exit here";
        this.pushSnapshot(true);
        return;
      }

      this.playerPosition.copy(safeExit);
      this.playerYaw = this.kekeYaw;
      this.kekeSpeed = 0;
      this.mode = "on-foot";
      this.player.root.visible = true;
      this.statusMessage = "Exited safely";
      this.updateTransform();
      this.pushSnapshot(true);
      return;
    }

    const right = new THREE.Vector3(Math.cos(this.carYaw), 0, -Math.sin(this.carYaw));
    const candidates = [
      this.carPosition.clone().addScaledVector(right, 1.75),
      this.carPosition.clone().addScaledVector(right, -1.75),
    ];
    const safeExit = candidates.find(
      (candidate) =>
        !this.collides(candidate.x, candidate.z, 0.48) &&
        !this.overlapsCar(candidate.x, candidate.z, 0.48) &&
        !this.overlapsKeke(candidate.x, candidate.z, 0.48) &&
        candidate.distanceTo(this.carPosition) > 1.5,
    );
    if (!safeExit) {
      this.statusMessage = "There is not enough clear space to exit here";
      this.pushSnapshot(true);
      return;
    }

    this.playerPosition.copy(safeExit);
    this.playerYaw = this.carYaw;
    this.carSpeed = 0;
    this.mode = "on-foot";
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
      if (this.mode === "on-foot") this.updatePlayer(dt, now);
      else this.updateCar(dt);

      const activeVehPos = this.mode === "driving"
        ? (this.activeVehicle === "keke" ? this.kekePosition : this.carPosition)
        : null;

      this.trafficSystem.update(dt, this.playerPosition, activeVehPos);
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
    const speed = this.keys.has("shift") ? 7.1 : 4.15;
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
      const targetYaw = Math.atan2(moveX, moveZ);
      this.playerYaw = this.lerpAngle(this.playerYaw, targetYaw, 1 - Math.exp(-12 * dt));
      this.walkPhase += dt * (this.keys.has("shift") ? 12.4 : 8.3);
    }

    const isRunning = this.keys.has("shift") && isWalking;
    const swingMagnitude = isRunning ? 0.68 : 0.46;
    const swing = isWalking && this.playerGrounded ? Math.sin(this.walkPhase) * swingMagnitude : 0;
    const idleBreath = !isWalking && this.playerGrounded ? Math.sin(now * 2.2) * 0.04 : 0;
    const idleSway = !isWalking && this.playerGrounded ? Math.sin(now * 1.1) * 0.015 : 0;

    if (this.playerGrounded) {
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
      const headTurn = !isWalking ? Math.sin(now * 0.7) * 0.16 : 0;
      this.player.head.rotation.y = THREE.MathUtils.damp(this.player.head.rotation.y, headTurn, 5, dt);
    }

    const verticalBounce = isWalking && this.playerGrounded ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.035 : 0;
    this.player.root.position.set(
      this.playerPosition.x,
      this.playerPosition.y + verticalBounce,
      this.playerPosition.z,
    );
    this.player.root.rotation.y = this.playerYaw;
  }

  private updateCar(dt: number) {
    if (this.activeVehicle === "keke") {
      this.updateKeke(dt);
    } else {
      this.updateSedan(dt);
    }
  }

  private updateSedan(dt: number) {
    const throttle = this.keys.has("w");
    const braking = this.keys.has("s") || this.keys.has(" ");
    const steer =
      (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const accel = 7.8;
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

    this.carSpeed = THREE.MathUtils.clamp(this.carSpeed, -6.5, 18.2);
    const steeringFactor = THREE.MathUtils.clamp(Math.abs(this.carSpeed) / 3, 0, 1);
    this.carYaw +=
      steer * 0.9 * steeringFactor * dt * (this.carSpeed >= 0 ? 1 : -1);
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

  private moveCircle(position: THREE.Vector3, dx: number, dz: number, radius: number) {
    const nextX = THREE.MathUtils.clamp(
      position.x + dx,
      -this.world.bounds + radius,
      this.world.bounds - radius,
    );
    if (!this.collides(nextX, position.z, radius)) position.x = nextX;

    const nextZ = THREE.MathUtils.clamp(
      position.z + dz,
      -this.world.bounds + radius,
      this.world.bounds - radius,
    );
    if (!this.collides(position.x, nextZ, radius)) position.z = nextZ;
  }

  private collides(x: number, z: number, radius: number, skipVehicle = false) {
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

  private surfaceHeight(x: number, z: number) {
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
    const vehiclePos = this.activeVehicle === "keke" ? this.kekePosition : this.carPosition;
    const vehicleYaw = this.activeVehicle === "keke" ? this.kekeYaw : this.carYaw;
    const target = isDriving
      ? new THREE.Vector3(vehiclePos.x, 1.0, vehiclePos.z)
      : new THREE.Vector3(this.playerPosition.x, this.playerPosition.y + 1.25, this.playerPosition.z);
    const distance = isDriving ? (this.activeVehicle === "keke" ? 5.8 : 8.3) : 6.35;
    const followYaw = isDriving ? vehicleYaw + this.cameraYaw : this.cameraYaw;
    const heightPitch = this.cameraPitch;
    const direction = new THREE.Vector3(
      -Math.sin(followYaw) * Math.cos(heightPitch),
      Math.sin(heightPitch),
      -Math.cos(followYaw) * Math.cos(heightPitch),
    );
    const desired = target.clone().addScaledVector(direction, distance);
    const path = desired.clone().sub(target);
    const pathLength = path.length();
    const samples = Math.ceil(pathLength / 0.45);
    let safeDistance = pathLength;
    for (let step = 2; step <= samples; step += 1) {
      const distanceAlongPath = Math.min(step * 0.45, pathLength);
      const point = target.clone().addScaledVector(path, distanceAlongPath / pathLength);
      const blocked = this.colliderIndex.query(point.x, point.z, 1.2).some((collider: Collider) => {
        if (point.y > (collider.height ?? 3.5) - 0.2) return false;
        const dx = Math.max(Math.abs(point.x - collider.x) - collider.halfX, 0);
        const dz = Math.max(Math.abs(point.z - collider.z) - collider.halfZ, 0);
        return dx * dx + dz * dz < 0.32 * 0.32;
      });
      if (blocked) {
        safeDistance = Math.max(2.2, distanceAlongPath - 0.55);
        break;
      }
    }
    if (pathLength > 0) {
      desired.copy(target).addScaledVector(path.multiplyScalar(1 / pathLength), safeDistance);
    }
    const smoothing = 1 - Math.exp(-7.2 * dt);
    this.camera.position.lerp(desired, smoothing);
    this.lookMatrix.lookAt(this.camera.position, target, this.camera.up);
    this.desiredCameraQuaternion.setFromRotationMatrix(this.lookMatrix);
    this.camera.quaternion.slerp(this.desiredCameraQuaternion, 1 - Math.exp(-12 * dt));
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
  }

  private pushSnapshot(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastSnapshotAt < 120) return;
    this.lastSnapshotAt = now;

    let interactionPrompt: string | null = null;
    if (this.mode === "driving") {
      interactionPrompt = this.activeVehicle === "keke" ? "Exit Keke Napep" : "Exit passenger car";
    } else {
      const distCar = this.playerPosition.distanceTo(this.carPosition);
      const distKeke = this.playerPosition.distanceTo(this.kekePosition);
      if (distCar <= 4.7 && distCar <= distKeke) {
        interactionPrompt = "Drive Sedan";
      } else if (distKeke <= 4.7) {
        interactionPrompt = "Ride Keke Napep";
      }
    }

    const location = this.mode === "driving"
      ? (this.activeVehicle === "keke" ? this.kekePosition : this.carPosition)
      : this.playerPosition;
    const currentSpeed = this.mode === "driving"
      ? (this.activeVehicle === "keke" ? Math.abs(this.kekeSpeed) * 3.6 : Math.abs(this.carSpeed) * 3.6)
      : 0;

    this.callbacks.onSnapshot({
      mode: this.mode,
      vehicleType: this.activeVehicle,
      location: getDistrictLabel(getDistrict(location.x, location.z)),
      speedKmh: currentSpeed,
      interactionPrompt,
      statusMessage: this.statusMessage,
    });
  }

  private lerpAngle(from: number, to: number, alpha: number) {
    const delta = THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
    return from + delta * alpha;
  }
}
