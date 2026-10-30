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
import type { Collider, GameMaterials, GraphicsQuality } from "./types";

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

export interface ParkedVehicle {
  id: string;
  type: AIVehicleType;
  model: CarModel | KekeModel | UsableVehicleModel;
  position: THREE.Vector3;
  yaw: number;
  locationName: string;
  collider: Collider;
}

export interface TrafficSignalPost {
  group: THREE.Group;
  axis: "x" | "z";
  intersectionCenter: { x: number; z: number };
  redMesh: THREE.Mesh;
  yellowMesh: THREE.Mesh;
  greenMesh: THREE.Mesh;
  redMaterial: THREE.MeshStandardMaterial;
  yellowMaterial: THREE.MeshStandardMaterial;
  greenMaterial: THREE.MeshStandardMaterial;
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
  public parkedVehicles: ParkedVehicle[] = [];
  public signalPosts: TrafficSignalPost[] = [];
  private readonly root = new THREE.Group();
  private quality: GraphicsQuality = "balanced";
  private time = 0;
  private timeOfDayHours = 10;
  private lastCitationTime = -999;
  private citationCooldown = 10.0;
  public onCitation?: (fine: number, reason: string) => void;
  private sedanGLTF: THREE.Group | null = null;

  public upgradeWithSedanGLTF(sedanGLTF: THREE.Group) {
    this.sedanGLTF = sedanGLTF;
    for (const v of this.vehicles) {
      if (v.type === "sedan" && "attachGLTFBody" in v.model) {
        const variant = CAR_COLOR_VARIANTS[this.vehicles.indexOf(v) % CAR_COLOR_VARIANTS.length];
        (v.model as CarModel).attachGLTFBody(sedanGLTF, variant?.body || "#b0b5b8");
      }
    }
    for (const pv of this.parkedVehicles) {
      if (pv.type === "sedan" && "attachGLTFBody" in pv.model) {
        const bodyColor = pv.id === "parked_sedan_bompai" ? "#d4d8db" : "#2a4d7d";
        (pv.model as CarModel).attachGLTFBody(sedanGLTF, bodyColor);
      }
    }
  }

  constructor(
    private readonly scene: THREE.Scene,
    private readonly materials: GameMaterials,
    private readonly network: NavigationNetwork,
    private readonly colliderIndex: ColliderIndex,
    private readonly surfaceHeight: (x: number, z: number) => number = () => 0,
  ) {
    this.root.name = "traffic-system-root";
    this.scene.add(this.root);

    // 1. Build Physical 3D Traffic Light Signal Posts at Arterial Intersections
    this.buildTrafficSignalPosts();

    // 2. Build Authentic Kano Parked Vehicles in Designated Roadside Bays
    this.spawnParkedVehicles();

    // 3. Spawn Active Traffic Fleet
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

  public setTimeOfDay(hours: number) {
    this.timeOfDayHours = hours;
  }

  public getSignalState(axis: "x" | "z"): "green" | "yellow" | "red" {
    const cycle = this.time % 18.0;
    if (axis === "x") {
      if (cycle < 8.0) return "green";
      if (cycle < 9.0) return "yellow";
      return "red";
    } else {
      if (cycle < 9.0) return "red";
      if (cycle < 17.0) return "green";
      return "yellow";
    }
  }

  public isIntersectionRedForHeading(
    intersectionCenter: { x: number; z: number },
    headingYaw: number,
  ): boolean {
    const normYaw = THREE.MathUtils.euclideanModulo(headingYaw, Math.PI * 2);
    // Heading East (around pi/2) or West (around 3pi/2) => X-axis road
    const isHeadingX =
      (normYaw >= Math.PI * 0.25 && normYaw <= Math.PI * 0.75) ||
      (normYaw >= Math.PI * 1.25 && normYaw <= Math.PI * 1.75);
    const axis = isHeadingX ? "x" : "z";
    return this.getSignalState(axis) === "red";
  }

  public triggerCitation(fine: number, reason: string): boolean {
    if (this.time - this.lastCitationTime < this.citationCooldown) {
      return false; // Active cooldown prevents spam
    }
    this.lastCitationTime = this.time;
    if (this.onCitation) {
      this.onCitation(fine, reason);
      return true;
    }
    return false;
  }

  private buildTrafficSignalPosts() {
    const majorIntersections = [
      { x: 0, z: 0, nameX: "Murtala Mohammed Way", nameZ: "Bompai Road", widthX: 20, widthZ: 16 },
      { x: 62, z: 0, nameX: "Murtala Mohammed Way", nameZ: "Airport Road", widthX: 20, widthZ: 24 },
      { x: 0, z: -62, nameX: "Sabon Gari Avenue", nameZ: "Bompai Road", widthX: 14, widthZ: 16 },
      { x: 62, z: -62, nameX: "Sabon Gari Avenue", nameZ: "Airport Road", widthX: 14, widthZ: 24 },
      { x: -62, z: 0, nameX: "Murtala Mohammed Way", nameZ: "Dala Link", widthX: 20, widthZ: 12 },
      { x: -62, z: -62, nameX: "Sabon Gari Avenue", nameZ: "Kasuwa Center", widthX: 14, widthZ: 12 },
    ];

    const poleGeometry = new THREE.CylinderGeometry(0.12, 0.14, 5.4, 8);
    const mastArmGeometry = new THREE.BoxGeometry(2.8, 0.12, 0.12);
    const boxGeometry = new THREE.BoxGeometry(0.48, 1.35, 0.32);
    const lensGeometry = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12);
    lensGeometry.rotateX(Math.PI / 2);

    for (const inter of majorIntersections) {
      const halfX = inter.widthZ / 2 + 3.5;
      const halfZ = inter.widthX / 2 + 3.5;

      // Create 4 corner signal posts:
      // 2 controlling X-axis traffic, 2 controlling Z-axis traffic
      const postConfigs = [
        {
          x: inter.x - halfX,
          z: inter.z + halfZ,
          yaw: Math.PI / 2, // Facing West for Eastbound X traffic
          axis: "x" as const,
        },
        {
          x: inter.x + halfX,
          z: inter.z - halfZ,
          yaw: -Math.PI / 2, // Facing East for Westbound X traffic
          axis: "x" as const,
        },
        {
          x: inter.x - halfX,
          z: inter.z - halfZ,
          yaw: 0, // Facing North for Southbound Z traffic
          axis: "z" as const,
        },
        {
          x: inter.x + halfX,
          z: inter.z + halfZ,
          yaw: Math.PI, // Facing South for Northbound Z traffic
          axis: "z" as const,
        },
      ];

      for (const pConfig of postConfigs) {
        const group = new THREE.Group();
        const yGround = this.surfaceHeight(pConfig.x, pConfig.z);
        group.position.set(pConfig.x, yGround, pConfig.z);
        group.rotation.set(0, pConfig.yaw, 0);

        // Mast pole
        const mast = new THREE.Mesh(poleGeometry, this.materials.metal);
        mast.position.set(0, 2.7, 0);
        mast.castShadow = true;
        group.add(mast);

        // Cantilever horizontal arm
        const arm = new THREE.Mesh(mastArmGeometry, this.materials.metal);
        arm.position.set(1.4, 5.1, 0);
        group.add(arm);

        // Signal Housing Box
        const housing = new THREE.Mesh(boxGeometry, this.materials.black);
        housing.position.set(2.4, 4.65, 0);
        housing.castShadow = true;
        group.add(housing);

        // Dynamic Signal Lenses
        const redMat = new THREE.MeshStandardMaterial({
          color: "#2a0404",
          emissive: "#ff1111",
          emissiveIntensity: 0.05,
          roughness: 0.3,
        });
        const yellowMat = new THREE.MeshStandardMaterial({
          color: "#2a1c02",
          emissive: "#ffaa00",
          emissiveIntensity: 0.05,
          roughness: 0.3,
        });
        const greenMat = new THREE.MeshStandardMaterial({
          color: "#03260c",
          emissive: "#00ee44",
          emissiveIntensity: 0.05,
          roughness: 0.3,
        });

        const redLens = new THREE.Mesh(lensGeometry, redMat);
        redLens.position.set(2.4, 5.05, 0.16);
        group.add(redLens);

        const yellowLens = new THREE.Mesh(lensGeometry, yellowMat);
        yellowLens.position.set(2.4, 4.65, 0.16);
        group.add(yellowLens);

        const greenLens = new THREE.Mesh(lensGeometry, greenMat);
        greenLens.position.set(2.4, 4.25, 0.16);
        group.add(greenLens);

        this.root.add(group);

        // Register collider at base
        this.colliderIndex.add({
          x: pConfig.x,
          z: pConfig.z,
          halfX: 0.3,
          halfZ: 0.3,
          height: 5.5,
        });

        this.signalPosts.push({
          group,
          axis: pConfig.axis,
          intersectionCenter: { x: inter.x, z: inter.z },
          redMesh: redLens,
          yellowMesh: yellowLens,
          greenMesh: greenLens,
          redMaterial: redMat,
          yellowMaterial: yellowMat,
          greenMaterial: greenMat,
        });
      }
    }
  }

  private spawnParkedVehicles() {
    const parkedDefs = [
      // 1 & 2. Sabon Gari Kasuwa Passenger Keke Rank
      {
        id: "parked_keke_sabon_1",
        type: "keke" as AIVehicleType,
        x: -38,
        z: 24.5,
        yaw: Math.PI / 2,
        name: "Sabon Gari Kasuwa Tricycle Rank",
        plate: "KMC 204 KAN",
        stripe: "#1f5934",
      },
      {
        id: "parked_keke_sabon_2",
        type: "keke" as AIVehicleType,
        x: -43,
        z: 24.5,
        yaw: Math.PI / 2,
        name: "Sabon Gari Kasuwa Tricycle Rank",
        plate: "DLA 512 KN",
        stripe: "#1a472a",
      },
      // 3 & 4. Airport View Apartments Commercial Apron
      {
        id: "parked_sedan_airport",
        type: "sedan" as AIVehicleType,
        x: 40,
        z: -48,
        yaw: Math.PI,
        name: "Airport View Executive Parking Apron",
        body: "#2a4d7d",
        accent: "#d4bf9a",
        plate: "KN 402 AIR",
      },
      {
        id: "parked_van_airport",
        type: "delivery_van" as AIVehicleType,
        x: 44.5,
        z: -48,
        yaw: Math.PI,
        name: "Airport Road Logistics Apron",
        body: "#eceae1",
        accent: "#1a4f3a",
        plate: "KN 219 EXP",
      },
      // 5 & 6. Bompai Commercial Plaza & Bank Parking
      {
        id: "parked_pickup_bompai",
        type: "pickup_truck" as AIVehicleType,
        x: 76,
        z: -15,
        yaw: Math.PI / 2,
        name: "Arewa Commercial Bank Customer Bay",
        body: "#3d4b53",
        plate: "KN 844 SEC",
      },
      {
        id: "parked_sedan_bompai",
        type: "sedan" as AIVehicleType,
        x: 76,
        z: -19,
        yaw: Math.PI / 2,
        name: "Bompai Heights Commercial Bay",
        body: "#d4d8db",
        accent: "#303233",
        plate: "KN 118 BMP",
      },
      // 7 & 8. Kawu Industrial Freight Terminal & Staging Yard
      {
        id: "parked_truck_industrial",
        type: "truck" as AIVehicleType,
        x: 34,
        z: -148,
        yaw: -Math.PI / 2,
        name: "Kawu Freight Staging Bay",
        cab: "#264875",
        plate: "KN 505 TRK",
      },
      {
        id: "parked_van_industrial",
        type: "delivery_van" as AIVehicleType,
        x: 41,
        z: -148,
        yaw: -Math.PI / 2,
        name: "Container Yard Inspection Bay",
        body: "#e8dfd5",
        accent: "#243e62",
        plate: "KN 670 LOG",
      },
      // 9 & 10. Dala / Kasuwar Kurmi Historic District Curbside
      {
        id: "parked_pickup_dala",
        type: "pickup_truck" as AIVehicleType,
        x: -78,
        z: -98,
        yaw: Math.PI / 2,
        name: "Kasuwar Kurmi Artisan Delivery Bay",
        body: "#1c3c2e",
        plate: "KN 301 KRM",
      },
      {
        id: "parked_keke_dala",
        type: "keke" as AIVehicleType,
        x: -84,
        z: -98,
        yaw: Math.PI / 2,
        name: "Dandali Square Tricycle Stand",
        plate: "GWL 311 KN",
        stripe: "#2d6a4f",
      },
    ];

    for (const p of parkedDefs) {
      let model: CarModel | KekeModel | UsableVehicleModel;
      const cfg = VEHICLE_CONFIGS[p.type];

      switch (p.type) {
        case "keke":
          model = createKekeModel(this.materials, p.plate, p.stripe);
          break;
        case "sedan": {
          const car = createCarModel(this.materials, p.body!, p.accent!, p.plate);
          if (this.sedanGLTF) {
            car.attachGLTFBody(this.sedanGLTF, p.body);
          }
          model = car;
          break;
        }
        case "delivery_van":
          model = createDeliveryVanModel(this.materials, p.body!, p.accent!, p.plate);
          break;
        case "pickup_truck":
          model = createPickupTruckModel(this.materials, p.body!, p.plate);
          break;
        case "truck":
          model = createFreightTruckModel(this.materials, p.cab!, p.plate);
          break;
        default:
          model = createCarModel(this.materials, "#d4d8db", "#303233", p.plate);
      }

      const y = this.surfaceHeight(p.x, p.z);
      model.root.position.set(p.x, y, p.z);
      model.root.rotation.set(0, p.yaw, 0);
      this.root.add(model.root);

      const collider: Collider = {
        x: p.x,
        z: p.z,
        halfX: cfg.collisionRadius * 0.9,
        halfZ: cfg.collisionRadius * 0.9,
        height: 2.2,
      };

      // Add to spatial collider index
      this.colliderIndex.add(collider);

      this.parkedVehicles.push({
        id: p.id,
        type: p.type,
        model,
        position: new THREE.Vector3(p.x, y, p.z),
        yaw: p.yaw,
        locationName: p.name,
        collider,
      });
    }
  }

  private spawnFleet() {
    const targetCount = this.quality === "performance" ? 4 : this.quality === "balanced" ? 6 : 8;

    // 1. First spawn dedicated KAROTA Mobile Patrol Vehicle
    this.spawnPatrolVehicle("karota");

    // 2. Spawn remaining diverse commercial, passenger, and logistics fleet up to targetCount
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

    // KAROTA Official Green Hilux Patrol Pickup
    const model = createPickupTruckModel(this.materials, "#12542a", "KN 01 KAROTA");
    const y = this.surfaceHeight(startWp.x, startWp.z);
    model.root.position.set(startWp.x, y, startWp.z);
    model.root.rotation.set(0, initialYaw, 0);

    // Rooftop emergency flashing beacon light bar
    const beaconMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.12, 0.22),
      this.materials.glass || new THREE.MeshStandardMaterial({ color: "#222222" }),
    );
    beaconMount.position.set(0, 1.88, 0.1);
    model.root.add(beaconMount);

    const sirenLight = new THREE.PointLight(0x00ff66, 0, 16);
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
    const vehicleTypes: AIVehicleType[] = [
      "sedan",
      "keke",
      "delivery_van",
      "pickup_truck",
      "minibus",
      "truck",
    ];

    const availableWaypoints = this.network.trafficWaypointList.filter((wp) => {
      const distToPlayer = Math.hypot(wp.x - (-4), wp.z - (-4));
      if (distToPlayer < 24) return false;
      const colliders = this.colliderIndex.query(wp.x, wp.z, 2.2);
      if (colliders.length > 0) return false;
      const distToOthers = this.vehicles.some((v) => Math.hypot(v.position.x - wp.x, v.position.z - wp.z) < 18);
      return !distToOthers && !wp.isIntersection;
    });

    for (let i = 0; i < count; i += 1) {
      if (availableWaypoints.length === 0) break;
      const wpIndex = (i * 3) % availableWaypoints.length;
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
          const car = createCarModel(this.materials, variant.body, variant.accent, variant.plate);
          if (this.sedanGLTF) {
            car.attachGLTFBody(this.sedanGLTF, variant.body);
          }
          model = car;
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
    pedestrians?: { position: THREE.Vector3 }[],
  ) {
    this.time += dt;

    // Traffic signal cycle: 18-second periodic cycle for intersections
    // 0.0 - 8.0s:  X-axis Green, Z-axis Red
    // 8.0 - 9.0s:  X-axis Yellow, Z-axis Red
    // 9.0 - 17.0s: Z-axis Green, X-axis Red
    // 17.0 - 18.0s: Z-axis Yellow, X-axis Red
    const cycleTime = this.time % 18.0;
    const isXGreen = cycleTime < 8.0;
    const isXYellow = cycleTime >= 8.0 && cycleTime < 9.0;
    const isZGreen = cycleTime >= 9.0 && cycleTime < 17.0;
    const isZYellow = cycleTime >= 17.0 && cycleTime < 18.0;

    // Update Visual Signal Lenses on all 3D Traffic Light Posts
    for (const post of this.signalPosts) {
      if (post.axis === "x") {
        const isRed = !isXGreen && !isXYellow;
        post.redMaterial.emissiveIntensity = isRed ? 2.8 : 0.05;
        post.yellowMaterial.emissiveIntensity = isXYellow ? 2.8 : 0.05;
        post.greenMaterial.emissiveIntensity = isXGreen ? 2.8 : 0.05;
      } else {
        const isRed = !isZGreen && !isZYellow;
        post.redMaterial.emissiveIntensity = isRed ? 2.8 : 0.05;
        post.yellowMaterial.emissiveIntensity = isZYellow ? 2.8 : 0.05;
        post.greenMaterial.emissiveIntensity = isZGreen ? 2.8 : 0.05;
      }
    }

    // Dynamic diurnal pacing adjustment based on in-game time
    let speedMult = 1.0;
    if (this.timeOfDayHours >= 6.5 && this.timeOfDayHours < 9.5) {
      speedMult = 1.1; // Morning rush hour
    } else if (this.timeOfDayHours >= 21.0 || this.timeOfDayHours < 6.0) {
      speedMult = 0.85; // Quieter night streets
    }

    for (let i = 0; i < this.vehicles.length; i += 1) {
      const v = this.vehicles[i];
      const distToPlayer = v.position.distanceTo(playerPosition);

      if (distToPlayer > 105) {
        continue;
      }

      // Distance-based update frequency LOD
      if (distToPlayer >= 45 && distToPlayer < 85) {
        if ((Math.floor(this.time * 60) + i) % 2 !== 0) {
          continue;
        }
      } else if (distToPlayer >= 85) {
        if ((Math.floor(this.time * 60) + i) % 6 !== 0) {
          continue;
        }
      }

      this.updateVehicle(
        v,
        dt,
        playerPosition,
        playerVehiclePosition,
        playerVehicleSpeed,
        isXGreen,
        isXYellow,
        isZGreen,
        isZYellow,
        speedMult,
        pedestrians,
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
    isXYellow: boolean,
    isZGreen: boolean,
    isZYellow: boolean,
    speedMult: number,
    pedestrians?: { position: THREE.Vector3 }[],
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
    let desiredSpeed = v.cruisingSpeed * speedMult;

    // Slow down during sharp turns
    if (Math.abs(yawDiff) > 0.4) {
      desiredSpeed *= 0.55;
    }

    // Slow down near busy market/depot pedestrian areas
    const distToSabonGariKasuwa = Math.hypot(v.position.x - (-31), v.position.z - 31);
    const distToDandaliSquare = Math.hypot(v.position.x - (-72), v.position.z - (-72));
    const distToKawuDepot = Math.hypot(v.position.x - (-15), v.position.z - (-155));
    if (distToSabonGariKasuwa < 25 || distToDandaliSquare < 22 || distToKawuDepot < 28) {
      desiredSpeed = Math.min(desiredSpeed, v.cruisingSpeed * 0.65);
    }

    const forward = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    const right = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));

    // A. Intersection Signal & Clearance Yielding with Smooth Deceleration & Anti-Gridlock
    if (v.targetWaypoint.isIntersection) {
      const distToIntersection = Math.sqrt(distToTargetSq);
      if (distToIntersection < 11.5) {
        // Anti-Gridlock: If vehicle has already crossed past the stop line into the junction (distToIntersection < 5.0),
        // prioritize clearing the intersection box smoothly to prevent deadlocks or blocking crossing lanes.
        if (distToIntersection < 5.0) {
          desiredSpeed = Math.max(desiredSpeed, v.cruisingSpeed * 0.75);
        } else {
          const isGreen = v.targetWaypoint.axis === "x" ? isXGreen : isZGreen;
          const isYellow = v.targetWaypoint.axis === "x" ? isXYellow : isZYellow;

          // Check if another vehicle is currently crossing inside this intersection box
          const isIntersectionOccupied = this.vehicles.some((other) => {
            if (other.id === v.id) return false;
            const otherDist = Math.hypot(other.position.x - v.targetWaypoint.x, other.position.z - v.targetWaypoint.z);
            return otherDist < 6.0;
          });

          if (!isGreen || isYellow || isIntersectionOccupied) {
            const stopLineDist = Math.max(0, distToIntersection - 5.5);
            if (stopLineDist < 1.2) {
              desiredSpeed = 0; // Stopped at stop line
            } else {
              desiredSpeed = Math.min(desiredSpeed, v.cruisingSpeed * (stopLineDist / 6.0));
            }
          }
        }
      }
    }

    // B. Yield to Crossing Pedestrians
    if (pedestrians && pedestrians.length > 0) {
      for (const ped of pedestrians) {
        const rel = new THREE.Vector3().subVectors(ped.position, v.position);
        const forwardDist = rel.dot(forward);
        const lateralDist = Math.abs(rel.dot(right));

        if (forwardDist > 0 && forwardDist < 14.0 && lateralDist < cfg.lateralBuffer + 0.6) {
          if (forwardDist < 4.2) {
            desiredSpeed = 0; // Emergency stop for pedestrian
          } else {
            const factor = (forwardDist - 4.2) / 9.8;
            desiredSpeed = Math.min(desiredSpeed, v.cruisingSpeed * factor * 0.55);
          }
        }
      }
    }

    // C. Avoid Player (on-foot or in vehicle)
    const checkPlayer = (pos: THREE.Vector3, buffer: number, isVehicle: boolean) => {
      const rel = new THREE.Vector3().subVectors(pos, v.position);
      const forwardDist = rel.dot(forward);
      const lateralDist = Math.abs(rel.dot(right));

      if (forwardDist > 0 && forwardDist < cfg.followingDistance + 2.0 && lateralDist < buffer) {
        if (forwardDist < (isVehicle ? Math.max(4.5, cfg.collisionRadius * 1.8) : 4.0)) {
          desiredSpeed = 0; // Full stop
        } else {
          const factor = (forwardDist - 4.0) / (cfg.followingDistance - 2.0);
          desiredSpeed = Math.min(desiredSpeed, (isVehicle ? Math.max(playerVehicleSpeed * 0.9, v.cruisingSpeed * factor) : v.cruisingSpeed * factor * 0.5));
        }
      }
    };

    checkPlayer(playerPosition, 2.2, false);
    if (playerVehiclePosition) {
      checkPlayer(playerVehiclePosition, cfg.lateralBuffer, true);
    }

    // D. Sensible Following Distances & Smooth Queue Deceleration
    for (const other of this.vehicles) {
      if (other.id === v.id) continue;
      const rel = new THREE.Vector3().subVectors(other.position, v.position);
      const forwardDist = rel.dot(forward);
      const lateralDist = Math.abs(rel.dot(right));

      if (forwardDist > 0 && forwardDist < cfg.followingDistance && lateralDist < cfg.lateralBuffer) {
        const otherCfg = VEHICLE_CONFIGS[other.type];
        const minGap = Math.max(4.6, (cfg.length + (otherCfg?.length || 4.2)) * 0.5 + 2.2);
        if (forwardDist < minGap) {
          desiredSpeed = 0; // Stopped queue spacing
        } else {
          const ramp = THREE.MathUtils.clamp((forwardDist - minGap) / (cfg.followingDistance - minGap), 0, 1);
          const followSpeed = other.speed > 0.5 ? Math.max(other.speed * 0.95, v.cruisingSpeed * ramp) : v.cruisingSpeed * ramp * 0.7;
          desiredSpeed = Math.min(desiredSpeed, followSpeed);
        }
      }
    }

    // E. Forward Lookahead Obstacle & Parked Vehicle Detection
    const forwardProbeDist = Math.max(3.2, v.speed * 0.75);
    const probeX = v.position.x + Math.sin(v.yaw) * forwardProbeDist;
    const probeZ = v.position.z + Math.cos(v.yaw) * forwardProbeDist;
    const forwardColliders = this.colliderIndex.query(probeX, probeZ, cfg.collisionRadius * 0.85);

    if (forwardColliders.length > 0) {
      const safeGap = forwardProbeDist - cfg.collisionRadius;
      if (safeGap < 1.0) {
        desiredSpeed = 0;
      } else {
        desiredSpeed = Math.min(desiredSpeed, v.cruisingSpeed * (safeGap / forwardProbeDist) * 0.5);
      }
    }

    // F. Static obstacle collision & Anti-Gridlock recovery
    const isColliding = this.colliderIndex.query(v.position.x, v.position.z, cfg.collisionRadius).length > 0;

    if (v.isRecovering) {
      v.recoveryTimer -= dt;
      desiredSpeed = -2.8; // Reverse gear
      v.yaw += (v.recoveryAttempts % 2 === 0 ? 0.45 : -0.45) * dt;
      if (v.recoveryTimer <= 0) {
        v.isRecovering = false;
        v.stuckTimer = 0;
      }
    } else if (isColliding || (desiredSpeed > 1.0 && Math.abs(v.speed) < 0.25)) {
      v.stuckTimer += dt;
      if (v.stuckTimer > 2.4) {
        v.recoveryAttempts += 1;
        if (v.recoveryAttempts >= 2 || v.stuckTimer > 6.5) {
          // Relocate stuck vehicle to unoccupied forward waypoint far from player
          this.relocateStuckVehicle(v, playerPosition);
        } else {
          v.isRecovering = true;
          v.recoveryTimer = 1.8;
        }
      }
    } else {
      v.stuckTimer = Math.max(0, v.stuckTimer - dt * 0.6);
      if (v.speed > 2.0) {
        v.recoveryAttempts = 0;
      }
    }

    // 3. Acceleration & Speed Integration
    const accelRate = desiredSpeed > v.speed ? 4.8 : 10.5;
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

    // 5. Patrol Officer Monitoring, Flashing Beacon & Traffic Enforcement
    if (v.isPatrol && v.sirenLight) {
      if (v.sirenTimer && v.sirenTimer > 0) {
        v.sirenTimer -= dt;
        v.sirenLight.intensity = Math.sin(this.time * 16) > 0 ? 2.8 : 0.2;
        if (v.sirenTimer <= 0) {
          v.sirenLight.intensity = 0;
          v.sirenActive = false;
        }
      }

      if (playerVehiclePosition) {
        const distToPlayerVeh = v.position.distanceTo(playerVehiclePosition);

        // A. Speeding (> 60 km/h) detected near patrol unit
        if (distToPlayerVeh <= 14.0 && playerVehicleSpeed > 16.6) {
          if (!v.sirenActive) {
            v.sirenActive = true;
            v.sirenTimer = 6.0;
            this.triggerCitation(
              5000,
              "KAROTA Mobile Radar Citation: Speeding (>60 km/h) near patrol unit! ₦5,000 fine registered. Settle at Station desk.",
            );
          }
        }
        // B. Reckless collision with patrol vehicle
        else if (distToPlayerVeh <= 3.2 && Math.abs(playerVehicleSpeed) > 3.0) {
          if (!v.sirenActive) {
            v.sirenActive = true;
            v.sirenTimer = 6.0;
            this.triggerCitation(
              5000,
              "KAROTA Mobile Patrol Citation: Reckless collision with patrol vehicle! ₦5,000 fine registered.",
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
      const colliders = this.colliderIndex.query(wp.x, wp.z, 2.0);
      if (colliders.length > 0) return false;
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

    this.parkedVehicles.forEach((pv) => {
      this.root.remove(pv.model.root);
    });
    this.parkedVehicles = [];

    this.signalPosts.forEach((p) => {
      this.root.remove(p.group);
      p.redMaterial.dispose();
      p.yellowMaterial.dispose();
      p.greenMaterial.dispose();
    });
    this.signalPosts = [];

    this.scene.remove(this.root);
  }
}
