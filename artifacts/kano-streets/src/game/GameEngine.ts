import * as THREE from "three";
import { createCarModel, createPlayerModel, type CarModel, type PlayerModel } from "./actors";
import { ColliderIndex } from "./ColliderIndex";
import { getDistrict, getDistrictLabel, ROAD_LAYOUT } from "./layout";
import { createMaterials } from "./materials";
import { createWorld } from "./world";
import type { Collider, GameMode, GameScreen, GameSnapshot, GraphicsQuality } from "./types";

const PLAYER_START = new THREE.Vector3(-4, 0, -4);
const CAR_START = new THREE.Vector3(-2, 0, -8);
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
  private walkPhase = 0;
  private wheelSpin = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    callbacks: GameEngineCallbacks,
    rendererFactory: RendererFactory = (target) =>
      new THREE.WebGLRenderer({
        canvas: target,
        antialias: false,
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

    this.scene.background = new THREE.Color("#d9c49e");
    this.scene.fog = new THREE.FogExp2("#c9b794", 0.0049);

    this.materials = createMaterials();
    this.world = createWorld(this.materials);
    this.colliderIndex = new ColliderIndex(this.world.colliders);
    this.scene.add(this.world.root);
    this.addLighting();
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
    const hemi = new THREE.HemisphereLight("#e8f1e8", "#765c3e", 1.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#ffe7b5", 2.7);
    sun.position.set(-44, 62, -34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -82;
    sun.shadow.camera.right = 82;
    sun.shadow.camera.top = 82;
    sun.shadow.camera.bottom = -82;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 180;
    sun.shadow.bias = -0.00036;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
    this.sunLight = sun;

    const bounce = new THREE.DirectionalLight("#b8d1d2", 0.48);
    bounce.position.set(52, 28, 40);
    this.scene.add(bounce);
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
    this.playerPosition.copy(PLAYER_START);
    this.playerVerticalVelocity = 0;
    this.playerGrounded = true;
    this.playerYaw = 0;
    this.carPosition.copy(CAR_START);
    this.carYaw = 0;
    this.carSpeed = 0;
    this.player.root.visible = true;
    this.car.root.visible = true;
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
      if (this.playerPosition.distanceTo(this.carPosition) > 4.7) {
        this.statusMessage = "Move closer to the passenger car";
        this.pushSnapshot(true);
        return;
      }
      this.mode = "driving";
      this.carSpeed = 0;
      this.player.root.visible = false;
      this.statusMessage = "You are driving";
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
      if (this.mode === "on-foot") this.updatePlayer(dt);
      else this.updateCar(dt);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.pushSnapshot(false);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private updatePlayer(dt: number) {
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

    const swing = isWalking && this.playerGrounded ? Math.sin(this.walkPhase) * 0.54 : 0;
    this.player.leftArm.rotation.x = THREE.MathUtils.damp(this.player.leftArm.rotation.x, -swing, 9, dt);
    this.player.rightArm.rotation.x = THREE.MathUtils.damp(this.player.rightArm.rotation.x, swing, 9, dt);
    this.player.leftLeg.rotation.x = THREE.MathUtils.damp(this.player.leftLeg.rotation.x, swing, 9, dt);
    this.player.rightLeg.rotation.x = THREE.MathUtils.damp(this.player.rightLeg.rotation.x, -swing, 9, dt);

    this.player.root.position.copy(this.playerPosition);
    this.player.root.rotation.y = this.playerYaw;
  }

  private updateCar(dt: number) {
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
      wheel.children[0].rotation.x = this.wheelSpin;
      wheel.children[1].rotation.x = this.wheelSpin;
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

  private collides(x: number, z: number, radius: number, skipCar = false) {
    const bounds = this.world.bounds;
    if (Math.abs(x) > bounds - radius || Math.abs(z) > bounds - radius) return true;

    if (this.mode === "on-foot" && !skipCar) {
      if (this.overlapsCar(x, z, radius)) return true;
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
    const target = isDriving
      ? new THREE.Vector3(this.carPosition.x, 1.0, this.carPosition.z)
      : new THREE.Vector3(this.playerPosition.x, this.playerPosition.y + 1.25, this.playerPosition.z);
    const distance = isDriving ? 8.3 : 6.35;
    const followYaw = isDriving ? this.carYaw + this.cameraYaw : this.cameraYaw;
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
  }

  private pushSnapshot(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastSnapshotAt < 120) return;
    this.lastSnapshotAt = now;

    let interactionPrompt: string | null = null;
    if (this.mode === "driving") {
      interactionPrompt = "Exit passenger car";
    } else if (this.playerPosition.distanceTo(this.carPosition) <= 4.7) {
      interactionPrompt = "Enter passenger car";
    }

    const location = this.mode === "driving" ? this.carPosition : this.playerPosition;
    this.callbacks.onSnapshot({
      mode: this.mode,
      location: getDistrictLabel(getDistrict(location.x, location.z)),
      speedKmh: this.mode === "driving" ? Math.abs(this.carSpeed) * 3.6 : 0,
      interactionPrompt,
      statusMessage: this.statusMessage,
    });
  }

  private lerpAngle(from: number, to: number, alpha: number) {
    const delta = THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
    return from + delta * alpha;
  }
}
