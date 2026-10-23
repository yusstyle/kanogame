import * as THREE from "three";
import {
  createPedestrianModel,
  type PedestrianOptions,
  type PlayerModel,
} from "./actors";
import type { ColliderIndex } from "./ColliderIndex";
import type { NavigationNetwork, PedestrianWaypoint } from "./navigation";
import type { GameMaterials, GraphicsQuality } from "./types";

export type PedestrianState = "walking" | "idle" | "vendor" | "talking";

export interface Pedestrian {
  id: string;
  model: PlayerModel;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  state: PedestrianState;
  stateTimer: number;
  currentWaypoint: PedestrianWaypoint | null;
  targetWaypoint: PedestrianWaypoint | null;
  walkPhase: number;
  personalSpeed: number;
  lookSeed: number;
}

const NPC_PALETTES: PedestrianOptions[] = [
  // 1. Traditional Indigo Dyed Kaftan
  {
    skinColor: "#6a442e",
    tunicColor: "#253556",
    trousersColor: "#323c4a",
    capColor: "#a38656",
    embroideryColor: "#d2b47e",
    hasCap: true,
  },
  // 2. Crisp Northern White Babariga
  {
    skinColor: "#7a4e35",
    tunicColor: "#eae5da",
    trousersColor: "#544e45",
    capColor: "#bfa472",
    embroideryColor: "#c2ab7c",
    hasCap: true,
  },
  // 3. Kano Ochre / Golden Brown
  {
    skinColor: "#503223",
    tunicColor: "#9c6828",
    trousersColor: "#423223",
    capColor: "#cfb076",
    embroideryColor: "#e0c386",
    hasCap: true,
  },
  // 4. Sahelian Sage / Olive
  {
    skinColor: "#8c5c3e",
    tunicColor: "#486358",
    trousersColor: "#333d37",
    capColor: "#b29767",
    embroideryColor: "#cfb583",
    hasCap: false,
  },
  // 5. Terracotta / Clay Red
  {
    skinColor: "#5c3a28",
    tunicColor: "#8a3c2c",
    trousersColor: "#3b2823",
    capColor: "#d9bc84",
    embroideryColor: "#dfc78f",
    hasCap: true,
  },
  // 6. Charcoal / Minimalist
  {
    skinColor: "#734833",
    tunicColor: "#333333",
    trousersColor: "#222222",
    capColor: "#c4a770",
    embroideryColor: "#cbb17b",
    hasCap: true,
  },
];

export class PedestrianSystem {
  public pedestrians: Pedestrian[] = [];
  private readonly root = new THREE.Group();
  private quality: GraphicsQuality = "balanced";
  private time = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly materials: GameMaterials,
    private readonly network: NavigationNetwork,
    private readonly colliderIndex: ColliderIndex,
    private readonly surfaceHeight: (x: number, z: number) => number = () => 0,
  ) {
    this.root.name = "pedestrian-system-root";
    this.scene.add(this.root);
    this.spawnCrowd();
  }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    const targetCount = quality === "performance" ? 8 : quality === "balanced" ? 14 : 20;

    const enableShadows = quality === "quality";
    this.pedestrians.forEach((p) => {
      p.model.root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = enableShadows;
        }
      });
    });

    if (this.pedestrians.length < targetCount) {
      this.spawnAdditionalWalkers(targetCount - this.pedestrians.length);
    } else if (this.pedestrians.length > targetCount) {
      // Remove excess walkers (preserve fixed vendors)
      const walkers = this.pedestrians.filter((p) => p.state !== "vendor");
      while (this.pedestrians.length > targetCount && walkers.length > 0) {
        const removed = walkers.pop();
        if (removed) {
          const idx = this.pedestrians.indexOf(removed);
          if (idx !== -1) {
            this.pedestrians.splice(idx, 1);
            this.root.remove(removed.model.root);
          }
        }
      }
    }
  }

  private spawnCrowd() {
    // 1. Spawn Fixed Market Vendors in Sabon Gari
    this.spawnMarketVendors();

    // 2. Spawn Sidewalk & Plaza Walkers
    const initialWalkerCount = this.quality === "performance" ? 4 : this.quality === "balanced" ? 9 : 15;
    this.spawnAdditionalWalkers(initialWalkerCount);
  }

  private spawnMarketVendors() {
    // Market center is at (-31, 31)
    const vendorLocations = [
      { x: -31 - 5.1, z: 31 - 4.2 - 1.1, yaw: 0 }, // Behind northern stall 1
      { x: -31 + 5.1, z: 31 - 4.2 - 1.1, yaw: 0 }, // Behind northern stall 2
      { x: -31 - 5.1, z: 31 + 4.2 + 1.1, yaw: Math.PI }, // Behind southern stall 3
      { x: -31 + 5.1, z: 31 + 4.2 + 1.1, yaw: Math.PI }, // Behind southern stall 4
      { x: -31, z: 31 - 1.25, yaw: 0 }, // Behind central market table
    ];

    vendorLocations.forEach((loc, index) => {
      const palette = NPC_PALETTES[index % NPC_PALETTES.length];
      const model = createPedestrianModel(this.materials, palette);
      const y = this.surfaceHeight(loc.x, loc.z);

      model.root.position.set(loc.x, y, loc.z);
      model.root.rotation.y = loc.yaw;
      this.root.add(model.root);

      this.pedestrians.push({
        id: `vendor_${index}`,
        model,
        position: new THREE.Vector3(loc.x, y, loc.z),
        yaw: loc.yaw,
        speed: 0,
        state: "vendor",
        stateTimer: 0,
        currentWaypoint: null,
        targetWaypoint: null,
        walkPhase: index * 1.5,
        personalSpeed: 0,
        lookSeed: index * 2.3,
      });
    });
  }

  private spawnAdditionalWalkers(count: number) {
    const waypoints = this.network.pedestrianWaypointList;
    if (waypoints.length === 0) return;

    for (let i = 0; i < count; i += 1) {
      // Pick a random waypoint far from the player spawn (-4, -4)
      const valid = waypoints.filter((wp) => {
        const distToPlayer = Math.hypot(wp.x - (-4), wp.z - (-4));
        if (distToPlayer < 12) return false;
        // Don't collide with static obstacles
        const colliders = this.colliderIndex.query(wp.x, wp.z, 0.45);
        if (colliders.length > 0) return false;
        return true;
      });

      if (valid.length === 0) break;
      const startWp = valid[Math.floor(Math.random() * valid.length)];
      const nextId = startWp.nextIds[Math.floor(Math.random() * startWp.nextIds.length)];
      const nextWp = nextId ? this.network.pedestrianWaypoints.get(nextId) ?? null : null;

      const palette = NPC_PALETTES[(this.pedestrians.length + i) % NPC_PALETTES.length];
      const model = createPedestrianModel(this.materials, palette);
      const y = this.surfaceHeight(startWp.x, startWp.z);
      const dx = nextWp ? nextWp.x - startWp.x : 0;
      const dz = nextWp ? nextWp.z - startWp.z : 1;
      const initialYaw = Math.atan2(dx, dz);

      model.root.position.set(startWp.x, y, startWp.z);
      model.root.rotation.y = initialYaw;
      this.root.add(model.root);

      this.pedestrians.push({
        id: `ped_${Date.now()}_${i}`,
        model,
        position: new THREE.Vector3(startWp.x, y, startWp.z),
        yaw: initialYaw,
        speed: 1.25,
        state: "walking",
        stateTimer: 4 + Math.random() * 8,
        currentWaypoint: startWp,
        targetWaypoint: nextWp,
        walkPhase: Math.random() * Math.PI * 2,
        personalSpeed: 1.1 + Math.random() * 0.35,
        lookSeed: Math.random() * 10,
      });
    }
  }

  public update(dt: number, playerPosition: THREE.Vector3, playerVehiclePos: THREE.Vector3 | null) {
    this.time += dt;

    for (let i = 0; i < this.pedestrians.length; i += 1) {
      const p = this.pedestrians[i];
      const distToPlayer = p.position.distanceTo(playerPosition);

      // Distance culling: pedestrians >85m away skip animation
      if (distToPlayer > 85) {
        continue;
      }

      this.updatePedestrian(p, dt, playerPosition, playerVehiclePos);
    }
  }

  private updatePedestrian(
    p: Pedestrian,
    dt: number,
    playerPosition: THREE.Vector3,
    playerVehiclePos: THREE.Vector3 | null,
  ) {
    // 1. Vendor behavior (stationary, subtle gesturing, looking around)
    if (p.state === "vendor") {
      this.animateVendor(p, dt);
      return;
    }

    // 2. Walker state machine (walking <-> idle)
    p.stateTimer -= dt;

    if (p.state === "idle") {
      p.speed = THREE.MathUtils.damp(p.speed, 0, 8, dt);
      if (p.stateTimer <= 0) {
        // Transition back to walking
        p.state = "walking";
        p.stateTimer = 5 + Math.random() * 10;
        if (p.currentWaypoint && p.currentWaypoint.nextIds.length > 0) {
          const nextId = p.currentWaypoint.nextIds[Math.floor(Math.random() * p.currentWaypoint.nextIds.length)];
          p.targetWaypoint = this.network.pedestrianWaypoints.get(nextId) ?? null;
        }
      }
    } else if (p.state === "walking") {
      p.speed = THREE.MathUtils.damp(p.speed, p.personalSpeed, 6, dt);

      // Chance to take a brief rest or look around
      if (p.stateTimer <= 0 && Math.random() < 0.25) {
        p.state = "idle";
        p.stateTimer = 2.5 + Math.random() * 4;
      }

      if (p.targetWaypoint) {
        const dx = p.targetWaypoint.x - p.position.x;
        const dz = p.targetWaypoint.z - p.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < 1.4 * 1.4) {
          // Reached waypoint, pick next
          p.currentWaypoint = p.targetWaypoint;
          if (p.targetWaypoint.nextIds.length > 0) {
            const nextId = p.targetWaypoint.nextIds[Math.floor(Math.random() * p.targetWaypoint.nextIds.length)];
            p.targetWaypoint = this.network.pedestrianWaypoints.get(nextId) ?? null;
          }
        }

        if (p.targetWaypoint) {
          const desiredYaw = Math.atan2(
            p.targetWaypoint.x - p.position.x,
            p.targetWaypoint.z - p.position.z,
          );

          // Turn towards waypoint
          let yawDiff = desiredYaw - p.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

          p.yaw += THREE.MathUtils.clamp(yawDiff, -3.2 * dt, 3.2 * dt);
        }
      }
    }

    // 3. Move and avoid obstacles
    if (p.speed > 0.05) {
      const moveX = Math.sin(p.yaw) * p.speed * dt;
      const moveZ = Math.cos(p.yaw) * p.speed * dt;

      // Safe step check: ensure new position does not enter building colliders
      const nextX = p.position.x + moveX;
      const nextZ = p.position.z + moveZ;
      const obstacles = this.colliderIndex.query(nextX, nextZ, 0.42);

      if (obstacles.length === 0) {
        p.position.x = nextX;
        p.position.z = nextZ;
      } else {
        // Obstructed, pause and turn around
        p.state = "idle";
        p.stateTimer = 1.5;
        p.yaw += Math.PI * 0.75;
      }

      p.position.y = this.surfaceHeight(p.position.x, p.position.z);
    }

    // 4. Procedural walk animation
    const isMoving = p.speed > 0.15;
    if (isMoving) {
      p.walkPhase += dt * (p.speed * 4.2);
    }

    const swing = isMoving ? Math.sin(p.walkPhase) * 0.46 : 0;
    p.model.leftArm.rotation.x = THREE.MathUtils.damp(p.model.leftArm.rotation.x, -swing, 8, dt);
    p.model.rightArm.rotation.x = THREE.MathUtils.damp(p.model.rightArm.rotation.x, swing, 8, dt);
    p.model.leftLeg.rotation.x = THREE.MathUtils.damp(p.model.leftLeg.rotation.x, swing, 8, dt);
    p.model.rightLeg.rotation.x = THREE.MathUtils.damp(p.model.rightLeg.rotation.x, -swing, 8, dt);

    // Subtle vertical bounce
    const bounce = isMoving ? Math.abs(Math.sin(p.walkPhase * 2)) * 0.03 : 0;
    p.model.root.position.set(p.position.x, p.position.y + bounce, p.position.z);
    p.model.root.rotation.y = p.yaw;

    // Subtle head turn
    if (p.model.head) {
      const headYaw = Math.sin(this.time * 0.7 + p.lookSeed) * 0.22;
      p.model.head.rotation.y = THREE.MathUtils.damp(p.model.head.rotation.y, headYaw, 4, dt);
    }
  }

  private animateVendor(p: Pedestrian, dt: number) {
    // Subtle breathing & occasional greeting gesture
    const breath = Math.sin(this.time * 1.6 + p.lookSeed) * 0.035;
    p.model.leftArm.rotation.x = THREE.MathUtils.damp(p.model.leftArm.rotation.x, breath, 4, dt);
    p.model.rightArm.rotation.x = THREE.MathUtils.damp(p.model.rightArm.rotation.x, -breath, 4, dt);

    if (p.model.head) {
      const lookAround = Math.sin(this.time * 0.4 + p.lookSeed) * 0.35;
      p.model.head.rotation.y = THREE.MathUtils.damp(p.model.head.rotation.y, lookAround, 3, dt);
    }

    p.model.root.position.copy(p.position);
    p.model.root.rotation.y = p.yaw;
  }

  public dispose() {
    this.pedestrians.forEach((p) => {
      this.root.remove(p.model.root);
    });
    this.pedestrians = [];
    this.scene.remove(this.root);
  }
}
