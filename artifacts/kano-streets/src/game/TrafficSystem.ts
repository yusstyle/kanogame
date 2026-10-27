import * as THREE from "three";
import {
  createCarModel,
  createKekeModel,
  createDeliveryVanModel,
  createPickupTruckModel,
  createMinibusModel,
  createFreightTruckModel,
  type CarModel,
  type KekeModel,
  type UsableVehicleModel,
} from "./actors";
import type { ColliderIndex } from "./ColliderIndex";
import type { NavigationNetwork, TrafficWaypoint } from "./navigation";
import { getNextTrafficWaypoint } from "./navigation";
import type { GameMaterials, GraphicsQuality } from "./types";

export type AIVehicleType =
  | "sedan"
  | "keke"
  | "delivery_van"
  | "pickup_truck"
  | "minibus"
  | "truck";

export interface VehicleTypeConfig {
  type: AIVehicleType;
  collisionRadius: number;
  cruisingSpeed: number;
  maxSteerRate: number;
  length: number;
  lateralBuffer: number;
  followingDistance: number;
  name: string;
}

export const VEHICLE_CONFIGS: Record<AIVehicleType, VehicleTypeConfig> = {
  keke: {
    type: "keke",
    collisionRadius: 1.25,
    cruisingSpeed: 7.0,
    maxSteerRate: 2.4,
    length: 2.6,
    lateralBuffer: 2.1,
    followingDistance: 8.5,
    name: "Tricycle Keke Napep",
  },
  sedan: {
    type: "sedan",
    collisionRadius: 1.65,
    cruisingSpeed: 8.2,
    maxSteerRate: 1.8,
    length: 4.2,
    lateralBuffer: 2.6,
    followingDistance: 10.5,
    name: "Peugeot Saloon Car",
  },
  delivery_van: {
    type: "delivery_van",
    collisionRadius: 1.9,
    cruisingSpeed: 7.6,
    maxSteerRate: 1.6,
    length: 4.8,
    lateralBuffer: 2.7,
    followingDistance: 11.5,
    name: "Commercial Delivery Van",
  },
  pickup_truck: {
    type: "pickup_truck",
    collisionRadius: 1.8,
    cruisingSpeed: 8.0,
    maxSteerRate: 1.7,
    length: 4.6,
    lateralBuffer: 2.6,
    followingDistance: 11.0,
    name: "Hilux Utility Pickup",
  },
  minibus: {
    type: "minibus",
    collisionRadius: 1.95,
    cruisingSpeed: 7.2,
    maxSteerRate: 1.5,
    length: 5.2,
    lateralBuffer: 2.8,
    followingDistance: 12.0,
    name: "Kano Danfo Minibus",
  },
  truck: {
    type: "truck",
    collisionRadius: 2.4,
    cruisingSpeed: 6.2,
    maxSteerRate: 1.3,
    length: 7.5,
    lateralBuffer: 3.2,
    followingDistance: 14.0,
    name: "Heavy Haulage Freight Truck",
  },
};

export interface AIVehicle {
  id: string;
  type: AIVehicleType;
  model: CarModel | KekeModel | UsableVehicleModel;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  targetSpeed: number;
  cruisingSpeed: number;
  collisionRadius: number;
  currentWaypoint: TrafficWaypoint;
  targetWaypoint: TrafficWaypoint;
  stuckTimer: number;
  wheelSpin: number;
  steeringAngle: number;
  isRecovering: boolean;
  recoveryTimer: number;
  recoveryAttempts: number;
  isPatrol?: boolean;
  patrolRole?: "karota" | "npf";
  sirenActive?: boolean;
  sirenLight?: THREE.PointLight;
  sirenTimer?: number;
}

const CAR_COLOR_VARIANTS = [
  { body: "#d4d8db", accent: "#303233", plate: "KMC 402 KN" },
  { body: "#2a4d7d", accent: "#d4bf9a", plate: "TRN 118 KAN" },
  { body: "#ded2b8", accent: "#453b32", plate: "GWL 553 KN" },
  { body: "#8f3e30", accent: "#262524", plate: "DLA 921 KAN" },
];

const KEKE_PLATE_VARIANTS = [
  { plate: "KMC 781 KAN", stripe: "#1f5934" },
  { plate: "DLA 409 KN", stripe: "#1a472a" },
  { plate: "NS 332 KAN", stripe: "#2d6a4f" },
  { plate: "GWL 614 KN", stripe: "#184e2e" },
];

const COMMERCIAL_VAN_VARIANTS = [
  { body: "#eceae1", accent: "#1a4f3a", plate: "KN 582 KMC" },
  { body: "#e8dfd5", accent: "#243e62", plate: "KN 741 TRN" },
];

const PICKUP_VARIANTS = [
  { body: "#1c3c2e", plate: "KN 301 PKP" },
  { body: "#3d4b53", plate: "KN 620 HIL" },
];

const MINIBUS_VARIANTS = [
  { body: "#dfa824", plate: "KN 844 DNF" },
  { body: "#e6b033", plate: "KN 912 KMC" },
];

const FREIGHT_TRUCK_VARIANTS = [
  { cab: "#264875", plate: "KN 119 TRK" },
  { cab: "#733328", plate: "KN 405 HAUL" },
];

export class TrafficSystem {
  public vehicles: AIVehicle[] = [];
  private readonly root = new THREE.Group();
  private quality: GraphicsQuality = "balanced";
  private time = 0;
  public onCitation?: (fine: number, reason: string) => void;

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
        // Keep patrol vehicle if possible
        const removeIdx = this.vehicles.findIndex((v) => !v.isPatrol);
        const removed = removeIdx !== -1 ? this.vehicles.splice(removeIdx, 1)[0] : this.vehicles.pop();
        if (removed) {
          this.root.remove(removed.model.root);
        }
      }
    }
  }

  private spawnFleet() {
    const targetCount = this.quality === "performance" ? 4 : this.quality === "balanced" ? 6 : 8;
    // 1. First spawn dedicated KAROTA Patrol Vehicle
    this.spawnPatrolVehicle("karota");

    // 2. Spawn remaining diverse commercial and passenger fleet up to targetCount
    if (this.vehicles.length < targetCount) {
      this.spawnAdditionalVehicles(targetCount - this.vehicles.length);
    }
  }

  private spawnPatrolVehicle(role: "karota" | "npf" = "karota") {
    const waypoints = this.network.trafficWaypointList.filter(
      (wp) => !wp.isIntersection && Math.hypot(wp.x - (-4), wp.z - (-4)) > 20,
    );
    if (waypoints.length === 0) return;

    const startWp = waypoints[0];
    const nextWp = getNextTrafficWaypoint(this.network, startWp) || startWp;

    const dx = nextWp.x - startWp.x;
    const dz = nextWp.z - startWp.z;
    const initialYaw = Math.atan2(dx, dz);

    // KAROTA Green Hilux Patrol Pickup
    const model = createPickupTruckModel(this.materials, "#12542a", "KN 01 KAROTA");
    const y = this.surfaceHeight(startWp.x, startWp.z);
    model.root.position.set(startWp.x, y, startWp.z);
    model.root.rotation.set(0, initialYaw, 0);

    // Add rooftop emergency flashing beacon light bar
    const beaconMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.12, 0.22),
      this.materials.glass || new THREE.MeshStandardMaterial({ color: "#222222" }),
    );
    beaconMount.position.set(0, 1.88, 0.1);
    model.root.add(beaconMount);

    const sirenLight = new THREE.PointLight(0x00ff66, 0, 14);
    sirenLight.position.set(0, 2.05, 0.1);
    model.root.add(sirenLight);

    this.root.add(model.root);

    const cfg = VEHICLE_CONFIGS.pickup_truck;
    this.vehicles.push({
      id: `patrol_${role}_0`,
      type: "pickup_truck",
      model,
      position: new THREE.Vector3(startWp.x, y, startWp.z),
      yaw: initialYaw,
      speed: cfg.cruisingSpeed * 0.8,
      targetSpeed: cfg.cruisingSpeed,
      cruisingSpeed: cfg.cruisingSpeed,
      collisionRadius: cfg.collisionRadius,
      currentWaypoint: startWp,
      targetWaypoint: nextWp,
      stuckTimer: 0,
      wheelSpin: 0,
      steeringAngle: 0,
      isRecovering: false,
      recoveryTimer: 0,
      recoveryAttempts: 0,
      isPatrol: true,
      patrolRole: role,
      sirenActive: false,
      sirenLight,
      sirenTimer: 0,
    });
  }

  private spawnAdditionalVehicles(count: number) {
    const availableWaypoints = this.network.trafficWaypointList.filter((wp) => {
      const distToPlayer = Math.hypot(wp.x - (-4), wp.z - (-4));
      if (distToPlayer < 24) return false;
      const distToOthers = this.vehicles.some((v) => Math.hypot(v.position.x - wp.x, v.position.z - wp.z) < 20);
      return !distToOthers && !wp.isIntersection;
    });

    const vehicleTypes: AIVehicleType[] = [
      "sedan",
      "keke",
      "delivery_van",
      "pickup_truck",
      "minibus",
      "truck",
    ];

    for (let i = 0; i < count; i += 1) {
      if (availableWaypoints.length === 0) break;
      const wpIndex = (i * 5) % availableWaypoints.length;
      const startWp = availableWaypoints.splice(wpIndex, 1)[0];
      const nextWp = getNextTrafficWaypoint(this.network, startWp) || startWp;

      const type: AIVehicleType = vehicleTypes[i % vehicleTypes.length];
      const id = `traffic_${type}_${Date.now()}_${i}`;

      const dx = nextWp.x - startWp.x;
      const dz = nextWp.z - startWp.z;
      const initialYaw = Math.atan2(dx, dz);

      let model: CarModel | KekeModel | UsableVehicleModel;
      const cfg = VEHICLE_CONFIGS[type];
      const cruisingSpeed = cfg.cruisingSpeed;

      switch (type) {
        case "sedan": {
          const variant = CAR_COLOR_VARIANTS[this.vehicles.length % CAR_COLOR_VARIANTS.length];
          model = createCarModel(this.materials, variant.body, variant.accent, variant.plate);
          break;
        }
        case "keke": {
          const variant = KEKE_PLATE_VARIANTS[this.vehicles.length % KEKE_PLATE_VARIANTS.length];
          model = createKekeModel(this.materials, variant.plate, variant.stripe);
          break;
        }
        case "delivery_van": {
          const variant = COMMERCIAL_VAN_VARIANTS[this.vehicles.length % COMMERCIAL_VAN_VARIANTS.length];
          model = createDeliveryVanModel(this.materials, variant.body, variant.accent, variant.plate);
          break;
        }
        case "pickup_truck": {
          const variant = PICKUP_VARIANTS[this.vehicles.length % PICKUP_VARIANTS.length];
          model = createPickupTruckModel(this.materials, variant.body, variant.plate);
          break;
        }
        case "minibus": {
          const variant = MINIBUS_VARIANTS[this.vehicles.length % MINIBUS_VARIANTS.length];
          model = createMinibusModel(this.materials, variant.body, variant.plate);
          break;
        }
        case "truck": {
          const variant = FREIGHT_TRUCK_VARIANTS[this.vehicles.length % FREIGHT_TRUCK_VARIANTS.length];
          model = createFreightTruckModel(this.materials, variant.cab, variant.plate);
          break;
        }
      }

      const y = this.surfaceHeight(startWp.x, startWp.z);
      model.root.position.set(startWp.x, y, startWp.z);
      model.root.rotation.set(0, initialYaw, 0);
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
        collisionRadius: cfg.collisionRadius,
        currentWaypoint: startWp,
        targetWaypoint: nextWp,
        stuckTimer: 0,
        wheelSpin: 0,
        steeringAngle: 0,
        isRecovering: false,
        recoveryTimer: 0,
        recoveryAttempts: 0,
      });
    }
  }

  public update(
    dt: number,
    playerPosition: THREE.Vector3,
    playerVehiclePosition: THREE.Vector3 | null,
    playerVehicleSpeed: number = 0,
  ) {
    this.time += dt;

    // Traffic signal cycle: 18-second periodic cycle for intersections
    // 0-8s: X axis green, Z axis red
    // 8-9s: X axis yellow
    // 9-17s: Z axis green, X axis red
    // 17-18s: Z axis yellow
    const cycleTime = this.time % 18;
    const isXGreen = cycleTime < 8.0;
    const isZGreen = cycleTime >= 9.0 && cycleTime < 17.0;

    for (let i = 0; i < this.vehicles.length; i += 1) {
      const v = this.vehicles[i];
      const distToPlayer = v.position.distanceTo(playerPosition);

      if (distToPlayer > 95) {
        continue;
      }

      this.updateVehicle(
        v,
        dt,
        playerPosition,
        playerVehiclePosition,
        playerVehicleSpeed,
        isXGreen,
        isZGreen,
      );
    }
  }

  private updateVehicle(
    v: AIVehicle,
    dt: number,
    playerPosition: THREE.Vector3,
    playerVehiclePosition: THREE.Vector3 | null,
    playerVehicleSpeed: number,
    isXGreen: boolean,
    isZGreen: boolean,
  ) {
    const cfg = VEHICLE_CONFIGS[v.type];

    // 1. Waypoint steering calculation
    const dx = v.targetWaypoint.x - v.position.x;
    const dz = v.targetWaypoint.z - v.position.z;
    const distToTargetSq = dx * dx + dz * dz;

    if (distToTargetSq < 3.2 * 3.2) {
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

    let yawDiff = desiredYaw - v.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    const steerDelta = THREE.MathUtils.clamp(yawDiff, -cfg.maxSteerRate * dt, cfg.maxSteerRate * dt);
    v.yaw += steerDelta;
    v.steeringAngle = THREE.MathUtils.clamp(yawDiff * 0.8, -0.42, 0.42);

    // 2. Speed and Avoidance
    let desiredSpeed = v.cruisingSpeed;

    // Slow down during sharp turns
    if (Math.abs(yawDiff) > 0.45) {
      desiredSpeed *= 0.55;
    }

    const forward = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    const right = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));

    // A. Intersection Signal & Clearance Yielding
    if (v.targetWaypoint.isIntersection) {
      const distToIntersection = Math.sqrt(distToTargetSq);
      if (distToIntersection < 8.5) {
        const isGreen = v.targetWaypoint.axis === "x" ? isXGreen : isZGreen;

        // Check if another vehicle is currently crossing inside this intersection box
        const isIntersectionOccupied = this.vehicles.some((other) => {
          if (other.id === v.id) return false;
          const otherDist = Math.hypot(other.position.x - v.targetWaypoint.x, other.position.z - v.targetWaypoint.z);
          return otherDist < 5.6;
        });

        if (!isGreen || isIntersectionOccupied) {
          // Stop at intersection stop line
          desiredSpeed = 0;
        }
      }
    }

    // B. Avoid Player (on-foot or in vehicle)
    const checkPlayer = (pos: THREE.Vector3, buffer: number) => {
      const rel = new THREE.Vector3().subVectors(pos, v.position);
      const forwardDist = rel.dot(forward);
      const lateralDist = Math.abs(rel.dot(right));

      if (forwardDist > 0 && forwardDist < cfg.followingDistance && lateralDist < buffer) {
        if (forwardDist < 4.8) {
          desiredSpeed = 0; // Emergency brake
        } else {
          desiredSpeed = Math.min(desiredSpeed, (forwardDist / cfg.followingDistance) * 3.5);
        }
      }
    };

    checkPlayer(playerPosition, 2.2);
    if (playerVehiclePosition) {
      checkPlayer(playerVehiclePosition, cfg.lateralBuffer);
    }

    // C. Avoid other traffic vehicles ahead in queue
    for (const other of this.vehicles) {
      if (other.id === v.id) continue;
      const rel = new THREE.Vector3().subVectors(other.position, v.position);
      const forwardDist = rel.dot(forward);
      const lateralDist = Math.abs(rel.dot(right));

      if (forwardDist > 0 && forwardDist < cfg.followingDistance && lateralDist < cfg.lateralBuffer) {
        if (forwardDist < Math.max(4.5, cfg.collisionRadius * 1.8)) {
          desiredSpeed = 0; // Stopped queue
        } else {
          desiredSpeed = Math.min(desiredSpeed, other.speed * 0.85);
        }
      }
    }

    // D. Static obstacle collision & Anti-Gridlock recovery
    const isColliding = this.colliderIndex.query(v.position.x, v.position.z, cfg.collisionRadius).length > 0;

    if (v.isRecovering) {
      v.recoveryTimer -= dt;
      desiredSpeed = -2.5; // Reverse gear
      // Steer alternating direction
      v.yaw += (v.recoveryAttempts % 2 === 0 ? 0.45 : -0.45) * dt;
      if (v.recoveryTimer <= 0) {
        v.isRecovering = false;
        v.stuckTimer = 0;
      }
    } else if (isColliding || (desiredSpeed > 1.0 && Math.abs(v.speed) < 0.25)) {
      v.stuckTimer += dt;
      if (v.stuckTimer > 2.6) {
        v.recoveryAttempts += 1;
        if (v.recoveryAttempts >= 2 || v.stuckTimer > 7.5) {
          // Bounded anti-gridlock: relocate stuck vehicle to clear distant waypoint
          this.relocateStuckVehicle(v, playerPosition);
        } else {
          v.isRecovering = true;
          v.recoveryTimer = 1.8;
        }
      }
    } else {
      v.stuckTimer = Math.max(0, v.stuckTimer - dt * 0.5);
      if (v.speed > 2.0) {
        v.recoveryAttempts = 0;
      }
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
    v.model.root.rotation.set(0, v.yaw, 0);

    if (v.type === "sedan") {
      const car = v.model as CarModel;
      car.wheels.forEach((w) => {
        if (w.children[0]) w.children[0].rotation.x = v.wheelSpin;
      });
      car.frontWheels.forEach((w) => {
        w.rotation.y = v.steeringAngle;
      });
    } else if (v.type === "keke") {
      const keke = v.model as KekeModel;
      keke.frontFork.rotation.y = v.steeringAngle;
      keke.frontWheel.rotation.x = v.wheelSpin;
      keke.rearWheels.forEach((w) => {
        w.rotation.x = v.wheelSpin;
      });
    } else {
      const uveh = v.model as UsableVehicleModel;
      uveh.wheels.forEach((w) => {
        if (w.children[0]) w.children[0].rotation.x = v.wheelSpin;
      });
      uveh.frontWheels.forEach((w) => {
        w.rotation.y = v.steeringAngle;
      });
    }

    // 5. Patrol Officer Monitoring & Siren
    if (v.isPatrol && v.sirenLight) {
      if (v.sirenTimer && v.sirenTimer > 0) {
        v.sirenTimer -= dt;
        v.sirenLight.intensity = Math.sin(this.time * 16) > 0 ? 2.5 : 0.2;
        if (v.sirenTimer <= 0) {
          v.sirenLight.intensity = 0;
          v.sirenActive = false;
        }
      }

      // Check player speeding near patrol
      if (playerVehiclePosition) {
        const distToPlayerVeh = v.position.distanceTo(playerVehiclePosition);
        if (distToPlayerVeh <= 14.0 && playerVehicleSpeed > 16.6) {
          // Speed > 60 km/h detected by mobile radar
          if (!v.sirenActive) {
            v.sirenActive = true;
            v.sirenTimer = 5.0;
            this.onCitation?.(
              5000,
              "KAROTA Mobile Radar Citation: Speeding (>60 km/h) near patrol unit! ₦5,000 fine registered. Settle at Airport Road Station desk.",
            );
          }
        } else if (distToPlayerVeh <= 3.2 && Math.abs(playerVehicleSpeed) > 3.0) {
          // Collision with patrol vehicle
          if (!v.sirenActive) {
            v.sirenActive = true;
            v.sirenTimer = 6.0;
            this.onCitation?.(
              5000,
              "KAROTA Mobile Patrol Citation: Collision with patrol vehicle! ₦5,000 fine registered.",
            );
          }
        }
      }
    }
  }

  private relocateStuckVehicle(v: AIVehicle, playerPosition: THREE.Vector3) {
    const candidateWaypoints = this.network.trafficWaypointList.filter((wp) => {
      if (wp.isIntersection) return false;
      const distToPlayer = Math.hypot(wp.x - playerPosition.x, wp.z - playerPosition.z);
      if (distToPlayer < 40) return false;
      const distToOthers = this.vehicles.some(
        (other) => other.id !== v.id && Math.hypot(other.position.x - wp.x, other.position.z - wp.z) < 18,
      );
      return !distToOthers;
    });

    if (candidateWaypoints.length > 0) {
      const newWp = candidateWaypoints[Math.floor(Math.random() * candidateWaypoints.length)];
      const nextWp = getNextTrafficWaypoint(this.network, newWp) || newWp;
      const dx = nextWp.x - newWp.x;
      const dz = nextWp.z - newWp.z;
      const newYaw = Math.atan2(dx, dz);

      v.position.set(newWp.x, this.surfaceHeight(newWp.x, newWp.z), newWp.z);
      v.yaw = newYaw;
      v.currentWaypoint = newWp;
      v.targetWaypoint = nextWp;
      v.speed = v.cruisingSpeed * 0.7;
      v.stuckTimer = 0;
      v.recoveryAttempts = 0;
      v.isRecovering = false;
      v.model.root.position.copy(v.position);
      v.model.root.rotation.set(0, v.yaw, 0);
    } else {
      // If no distant waypoint available, reset recovery timers safely
      v.stuckTimer = 0;
      v.recoveryAttempts = 0;
      v.isRecovering = false;
      v.speed = v.cruisingSpeed * 0.5;
    }
  }

  public checkTrafficInteraction(playerPos: THREE.Vector3): { prompt: string; action: () => string } | null {
    const patrol = this.vehicles.find((v) => v.isPatrol);
    if (patrol && patrol.position.distanceTo(playerPos) <= 3.4) {
      return {
        prompt: "Talk to KAROTA Mobile Patrol Officer",
        action: () =>
          "KAROTA Mobile Patrol: 'City patrol active. Road regulations, traffic signals, and speed limits are strictly monitored across all districts. Safe driving!'",
      };
    }
    return null;
  }

  public dispose() {
    this.vehicles.forEach((v) => {
      this.root.remove(v.model.root);
    });
    this.vehicles = [];
    this.scene.remove(this.root);
  }
}
