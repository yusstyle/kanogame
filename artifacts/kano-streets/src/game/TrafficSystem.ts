import * as THREE from "three";
import {
  createCarModel,
  createKekeModel,
  type CarModel,
  type KekeModel,
} from "./actors";
import type { ColliderIndex } from "./ColliderIndex";
import type { NavigationNetwork, TrafficWaypoint } from "./navigation";
import { getNextTrafficWaypoint } from "./navigation";
import type { GameMaterials, GraphicsQuality } from "./types";

export type AIVehicleType = "sedan" | "keke";

export interface AIVehicle {
  id: string;
  type: AIVehicleType;
  model: CarModel | KekeModel;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  targetSpeed: number;
  cruisingSpeed: number;
  currentWaypoint: TrafficWaypoint;
  targetWaypoint: TrafficWaypoint;
  stuckTimer: number;
  wheelSpin: number;
  steeringAngle: number;
  isRecovering: boolean;
  recoveryTimer: number;
}

const CAR_COLOR_VARIANTS = [
  { body: "#d4d8db", accent: "#303233", plate: "KMC 402 KN" }, // Silver Peugeot style
  { body: "#2a4d7d", accent: "#d4bf9a", plate: "TRN 118 KAN" }, // Deep blue
  { body: "#ded2b8", accent: "#453b32", plate: "GWL 553 KN" }, // Desert sand / beige
  { body: "#8f3e30", accent: "#262524", plate: "DLA 921 KAN" }, // Terracotta red
];

const KEKE_PLATE_VARIANTS = [
  { plate: "KMC 781 KAN", stripe: "#1f5934" },
  { plate: "DLA 409 KN", stripe: "#1a472a" },
  { plate: "NS 332 KAN", stripe: "#2d6a4f" },
  { plate: "GWL 614 KN", stripe: "#184e2e" },
];

export class TrafficSystem {
  public vehicles: AIVehicle[] = [];
  private readonly root = new THREE.Group();
  private quality: GraphicsQuality = "balanced";

  constructor(
    private readonly scene: THREE.Scene,
    private readonly materials: GameMaterials,
    private readonly network: NavigationNetwork,
    private readonly colliderIndex: ColliderIndex,
    private readonly surfaceHeight: (x: number, z: number) => number = () => 0,
  ) {
    this.root.name = "traffic-system-root";
    this.scene.add(this.root);
    this.spawnFleet();
  }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    const targetCount = quality === "performance" ? 4 : quality === "balanced" ? 6 : 8;

    // Adjust shadow casting on active vehicles
    const enableShadows = quality === "quality";
    this.vehicles.forEach((v) => {
      v.model.root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = enableShadows;
        }
      });
    });

    if (this.vehicles.length < targetCount) {
      this.spawnAdditionalVehicles(targetCount - this.vehicles.length);
    } else if (this.vehicles.length > targetCount) {
      while (this.vehicles.length > targetCount) {
        const removed = this.vehicles.pop();
        if (removed) {
          this.root.remove(removed.model.root);
        }
      }
    }
  }

  private spawnFleet() {
    const initialCount = this.quality === "performance" ? 4 : this.quality === "balanced" ? 6 : 8;
    this.spawnAdditionalVehicles(initialCount);
  }

  private spawnAdditionalVehicles(count: number) {
    const availableWaypoints = this.network.trafficWaypointList.filter((wp) => {
      // Don't spawn within 28m of player spawn (-4, -4) or close to other existing vehicles
      const distToPlayer = Math.hypot(wp.x - (-4), wp.z - (-4));
      if (distToPlayer < 28) return false;
      const distToOthers = this.vehicles.some((v) => Math.hypot(v.position.x - wp.x, v.position.z - wp.z) < 22);
      return !distToOthers && !wp.isIntersection;
    });

    for (let i = 0; i < count; i += 1) {
      if (availableWaypoints.length === 0) break;
      const wpIndex = (i * 7) % availableWaypoints.length;
      const startWp = availableWaypoints.splice(wpIndex, 1)[0];
      const nextWp = getNextTrafficWaypoint(this.network, startWp) || startWp;

      const type: AIVehicleType = this.vehicles.length % 2 === 0 ? "sedan" : "keke";
      const id = `traffic_${type}_${Date.now()}_${i}`;

      const dx = nextWp.x - startWp.x;
      const dz = nextWp.z - startWp.z;
      const initialYaw = Math.atan2(dx, dz);

      let model: CarModel | KekeModel;
      let cruisingSpeed = 7.5;

      if (type === "sedan") {
        const variant = CAR_COLOR_VARIANTS[this.vehicles.length % CAR_COLOR_VARIANTS.length];
        model = createCarModel(this.materials, variant.body, variant.accent, variant.plate);
        cruisingSpeed = 8.2;
      } else {
        const variant = KEKE_PLATE_VARIANTS[this.vehicles.length % KEKE_PLATE_VARIANTS.length];
        model = createKekeModel(this.materials, variant.plate, variant.stripe);
        cruisingSpeed = 7.0;
      }

      const y = this.surfaceHeight(startWp.x, startWp.z);
      model.root.position.set(startWp.x, y, startWp.z);
      model.root.rotation.y = initialYaw;
      this.root.add(model.root);

      this.vehicles.push({
        id,
        type,
        model,
        position: new THREE.Vector3(startWp.x, y, startWp.z),
        yaw: initialYaw,
        speed: cruisingSpeed * 0.75,
        targetSpeed: cruisingSpeed,
        cruisingSpeed,
        currentWaypoint: startWp,
        targetWaypoint: nextWp,
        stuckTimer: 0,
        wheelSpin: 0,
        steeringAngle: 0,
        isRecovering: false,
        recoveryTimer: 0,
      });
    }
  }

  public update(
    dt: number,
    playerPosition: THREE.Vector3,
    playerVehiclePosition: THREE.Vector3 | null,
  ) {
    for (let i = 0; i < this.vehicles.length; i += 1) {
      const v = this.vehicles[i];
      const distToPlayer = v.position.distanceTo(playerPosition);

      // Distance culling: vehicles very far away (>95m) update AI throttled
      if (distToPlayer > 95) {
        continue;
      }

      this.updateVehicle(v, dt, playerPosition, playerVehiclePosition);
    }
  }

  private updateVehicle(
    v: AIVehicle,
    dt: number,
    playerPosition: THREE.Vector3,
    playerVehiclePosition: THREE.Vector3 | null,
  ) {
    // 1. Waypoint steering calculation
    const dx = v.targetWaypoint.x - v.position.x;
    const dz = v.targetWaypoint.z - v.position.z;
    const distToTargetSq = dx * dx + dz * dz;

    if (distToTargetSq < 3.2 * 3.2) {
      // Advance to next waypoint
      v.currentWaypoint = v.targetWaypoint;
      const next = getNextTrafficWaypoint(this.network, v.targetWaypoint);
      if (next && next.id !== v.targetWaypoint.id) {
        v.targetWaypoint = next;
      }
    }

    const desiredYaw = Math.atan2(
      v.targetWaypoint.x - v.position.x,
      v.targetWaypoint.z - v.position.z,
    );

    // Smooth steering towards waypoint
    let yawDiff = desiredYaw - v.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    const maxSteerRate = v.type === "keke" ? 2.4 : 1.75;
    const steerDelta = THREE.MathUtils.clamp(yawDiff, -maxSteerRate * dt, maxSteerRate * dt);
    v.yaw += steerDelta;
    v.steeringAngle = THREE.MathUtils.clamp(yawDiff * 0.8, -0.42, 0.42);

    // 2. Obstacle & Vehicle Avoidance
    let desiredSpeed = v.cruisingSpeed;

    // Slow down during sharp turns
    if (Math.abs(yawDiff) > 0.45) {
      desiredSpeed *= 0.55;
    }

    const forward = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    const right = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));

    // A. Avoid Player (on-foot or in vehicle)
    const checkPlayer = (pos: THREE.Vector3, buffer: number) => {
      const rel = new THREE.Vector3().subVectors(pos, v.position);
      const forwardDist = rel.dot(forward);
      const lateralDist = Math.abs(rel.dot(right));

      if (forwardDist > 0 && forwardDist < 10.5 && lateralDist < buffer) {
        if (forwardDist < 4.8) {
          desiredSpeed = 0; // Emergency stop
        } else {
          desiredSpeed = Math.min(desiredSpeed, (forwardDist / 10.5) * 3.5);
        }
      }
    };

    checkPlayer(playerPosition, 2.2);
    if (playerVehiclePosition) {
      checkPlayer(playerVehiclePosition, 2.8);
    }

    // B. Avoid other traffic vehicles
    for (const other of this.vehicles) {
      if (other.id === v.id) continue;
      const rel = new THREE.Vector3().subVectors(other.position, v.position);
      const forwardDist = rel.dot(forward);
      const lateralDist = Math.abs(rel.dot(right));

      if (forwardDist > 0 && forwardDist < 11.0 && lateralDist < 2.6) {
        if (forwardDist < 5.2) {
          desiredSpeed = 0; // Wait for front vehicle to move
        } else {
          desiredSpeed = Math.min(desiredSpeed, other.speed * 0.85);
        }
      }
    }

    // C. Static obstacle collision & recovery
    const collRadius = v.type === "keke" ? 1.25 : 1.65;
    const isColliding = this.colliderIndex.query(v.position.x, v.position.z, collRadius).length > 0;

    if (v.isRecovering) {
      v.recoveryTimer -= dt;
      desiredSpeed = -2.5; // Reverse out
      v.yaw += 0.4 * dt;
      if (v.recoveryTimer <= 0) {
        v.isRecovering = false;
        v.stuckTimer = 0;
      }
    } else if (isColliding || (desiredSpeed > 1.0 && v.speed < 0.25)) {
      v.stuckTimer += dt;
      if (v.stuckTimer > 2.8) {
        v.isRecovering = true;
        v.recoveryTimer = 1.6;
      }
    } else {
      v.stuckTimer = Math.max(0, v.stuckTimer - dt);
    }

    // 3. Acceleration & Speed Integration
    const accelRate = desiredSpeed > v.speed ? 4.5 : 10.5;
    v.speed += THREE.MathUtils.clamp((desiredSpeed - v.speed) * accelRate, -14, 6) * dt;

    // Move forward
    v.position.x += Math.sin(v.yaw) * v.speed * dt;
    v.position.z += Math.cos(v.yaw) * v.speed * dt;
    v.position.y = this.surfaceHeight(v.position.x, v.position.z);

    // 4. Animate Model
    v.wheelSpin += (v.speed * dt) / 0.35;
    v.model.root.position.copy(v.position);
    v.model.root.rotation.y = v.yaw;

    if (v.type === "sedan") {
      const car = v.model as CarModel;
      car.wheels.forEach((w) => {
        if (w.children[0]) w.children[0].rotation.x = v.wheelSpin;
      });
      car.frontWheels.forEach((w) => {
        w.rotation.y = v.steeringAngle;
      });
    } else {
      const keke = v.model as KekeModel;
      keke.frontFork.rotation.y = v.steeringAngle;
      keke.frontWheel.rotation.x = v.wheelSpin;
      keke.rearWheels.forEach((w) => {
        w.rotation.x = v.wheelSpin;
      });
    }
  }

  public dispose() {
    this.vehicles.forEach((v) => {
      this.root.remove(v.model.root);
    });
    this.vehicles = [];
    this.scene.remove(this.root);
  }
}
