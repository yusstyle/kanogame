import fs from "fs";
import path from "path";

const rootDir = "c:/Users/USER/Downloads/Kano-3D-Neighborhood-Game/Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game";

// 1. Update actors.ts
console.log("Updating actors.ts...");
let actors = fs.readFileSync(path.join(rootDir, "actors.ts"), "utf8");

// Rigged character head micro-parts shadow culling
const oldRiggedTraverse = `      characterGroup.traverse((child) => {\r
        if (child instanceof THREE.Mesh) {\r
          child.castShadow = true;\r
          child.receiveShadow = true;\r
        }\r
      });`;

const newRiggedTraverse = `      characterGroup.traverse((child) => {\r
        if (child instanceof THREE.Mesh) {\r
          const nl = child.name.toLowerCase();\r
          const isMicro = child.name.startsWith("h_") || nl.includes("eye") || nl.includes("gland") || nl.includes("teeth");\r
          child.castShadow = !isMicro;\r
          child.receiveShadow = true;\r
        }\r
      });`;

if (actors.includes(oldRiggedTraverse)) {
  actors = actors.replace(oldRiggedTraverse, newRiggedTraverse);
  console.log("  Replaced rigged traverse in actors.ts");
} else {
  console.warn("  Could not find oldRiggedTraverse (already updated or diff line endings)");
}

// GLTF sedan rotor drill holes and shadow culling
const oldGltfTraverse = `    const model = gltf.clone(true);\r
    model.traverse((child) => {\r
      if (child instanceof THREE.Mesh) {\r
        const nameLower = child.name.toLowerCase();\r
        if (\r
          nameLower.includes("headrest") ||\r
          nameLower.includes("seat_back") ||\r
          nameLower.includes("seat_cushion")\r
        ) {`;

const newGltfTraverse = `    const model = gltf.clone(true);\r
    model.traverse((child) => {\r
      if (child instanceof THREE.Mesh) {\r
        const nameLower = child.name.toLowerCase();\r
        if (nameLower.includes("rotor_drill_recess")) {\r
          child.visible = false;\r
          child.castShadow = false;\r
          return;\r
        }\r
        const isMicroOrInterior = (\r
          nameLower.includes("rotor") ||\r
          nameLower.includes("drill") ||\r
          nameLower.includes("lug") ||\r
          nameLower.includes("caliper") ||\r
          nameLower.includes("wiper") ||\r
          nameLower.includes("valve") ||\r
          nameLower.includes("headrest") ||\r
          nameLower.includes("seat") ||\r
          nameLower.includes("console") ||\r
          nameLower.includes("carpet") ||\r
          nameLower.includes("steering") ||\r
          nameLower.includes("mirror") ||\r
          nameLower.includes("bead") ||\r
          nameLower.includes("handle") ||\r
          nameLower.includes("liner") ||\r
          nameLower.includes("insert") ||\r
          nameLower.includes("optical") ||\r
          nameLower.includes("pillar")\r
        );\r
        if (isMicroOrInterior) {\r
          child.castShadow = false;\r
        }\r
        if (\r
          nameLower.includes("headrest") ||\r
          nameLower.includes("seat_back") ||\r
          nameLower.includes("seat_cushion")\r
        ) {`;

if (actors.includes(oldGltfTraverse)) {
  actors = actors.replace(oldGltfTraverse, newGltfTraverse);
  console.log("  Replaced gltf traverse in actors.ts");
} else {
  console.warn("  Could not find oldGltfTraverse (already updated or diff line endings)");
}
fs.writeFileSync(path.join(rootDir, "actors.ts"), actors, "utf8");

// 2. Update TrafficSystem.ts
console.log("Updating TrafficSystem.ts...");
let traffic = fs.readFileSync(path.join(rootDir, "TrafficSystem.ts"), "utf8");

// Add CityId import if needed
if (!traffic.includes('import { CityId }')) {
  traffic = traffic.replace('import { VEHICLE_CONFIGS }', 'import { CityId } from "./cities";\r\nimport { VEHICLE_CONFIGS }');
}

// Add cityId to constructor
const oldTrafficCtor = `  constructor(\r
    private readonly scene: THREE.Scene,\r
    private readonly materials: GameMaterials,\r
    private readonly network: NavigationNetwork,\r
    private readonly colliderIndex: ColliderIndex,\r
    private readonly surfaceHeight: (x: number, z: number) => number = () => 0,\r
  ) {`;

const newTrafficCtor = `  constructor(\r
    private readonly scene: THREE.Scene,\r
    private readonly materials: GameMaterials,\r
    private readonly network: NavigationNetwork,\r
    private readonly colliderIndex: ColliderIndex,\r
    private readonly surfaceHeight: (x: number, z: number) => number = () => 0,\r
    private readonly cityId: CityId = "kano",\r
  ) {`;

if (traffic.includes(oldTrafficCtor)) {
  traffic = traffic.replace(oldTrafficCtor, newTrafficCtor);
  console.log("  Added cityId to TrafficSystem constructor");
}

// Only spawn parked vehicles in Kano
const oldSpawnParked = `    // 2. Build Authentic Kano Parked Vehicles in Designated Roadside Bays\r
    this.spawnParkedVehicles();`;

const newSpawnParked = `    // 2. Build Authentic Kano Parked Vehicles in Designated Roadside Bays (Kano only)\r
    if (this.cityId !== "abuja") {\r
      this.spawnParkedVehicles();\r
    }`;

if (traffic.includes(oldSpawnParked)) {
  traffic = traffic.replace(oldSpawnParked, newSpawnParked);
  console.log("  Gated Kano parked vehicles behind cityId !== 'abuja'");
}

// Traffic shadow traverse optimization in setQuality and update
const oldTrafficShadowTraverse = `      const shouldCastShadow = distToPlayer <= 38 && this.quality === 'quality';\r
      if (v.model.root.userData.lastShadowState !== shouldCastShadow) {\r
        v.model.root.userData.lastShadowState = shouldCastShadow;\r
        v.model.root.traverse((child) => {\r
          if (child instanceof THREE.Mesh) {\r
            child.castShadow = shouldCastShadow;\r
          }\r
        });\r
      }`;

const newTrafficShadowTraverse = `      const shouldCastShadow = distToPlayer <= 38 && this.quality === 'quality';\r
      if (v.model.root.userData.lastShadowState !== shouldCastShadow) {\r
        v.model.root.userData.lastShadowState = shouldCastShadow;\r
        v.model.root.traverse((child) => {\r
          if (child instanceof THREE.Mesh) {\r
            if (shouldCastShadow) {\r
              const nl = child.name.toLowerCase();\r
              const isMicro = nl.includes("rotor") || nl.includes("drill") || nl.includes("lug") || nl.includes("caliper") || nl.includes("wiper") || nl.includes("valve") || nl.includes("headrest") || nl.includes("seat") || nl.includes("console") || nl.includes("carpet") || nl.includes("steering") || nl.includes("mirror") || nl.includes("bead") || nl.includes("handle") || nl.includes("liner") || nl.includes("insert") || nl.includes("optical") || nl.includes("pillar");\r
              child.castShadow = !isMicro;\r
            } else {\r
              child.castShadow = false;\r
            }\r
          }\r
        });\r
      }`;

if (traffic.includes(oldTrafficShadowTraverse)) {
  traffic = traffic.replace(oldTrafficShadowTraverse, newTrafficShadowTraverse);
  console.log("  Optimized traffic shadow traverse");
}
fs.writeFileSync(path.join(rootDir, "TrafficSystem.ts"), traffic, "utf8");

// 3. Update PedestrianSystem.ts
console.log("Updating PedestrianSystem.ts...");
let ped = fs.readFileSync(path.join(rootDir, "PedestrianSystem.ts"), "utf8");

// Add CityId import if needed
if (!ped.includes('import { CityId }')) {
  ped = ped.replace('import { WAYPOINT_CONFIG }', 'import { CityId } from "./cities";\r\nimport { WAYPOINT_CONFIG }');
}

// Add cityId to constructor
const oldPedCtor = `  constructor(\r
    private readonly scene: THREE.Scene,\r
    private readonly materials: GameMaterials,\r
    private readonly network: NavigationNetwork,\r
    private readonly colliderIndex: ColliderIndex,\r
    private readonly surfaceHeight: (x: number, z: number) => number = () => 0,\r
  ) {`;

const newPedCtor = `  constructor(\r
    private readonly scene: THREE.Scene,\r
    private readonly materials: GameMaterials,\r
    private readonly network: NavigationNetwork,\r
    private readonly colliderIndex: ColliderIndex,\r
    private readonly surfaceHeight: (x: number, z: number) => number = () => 0,\r
    private readonly cityId: CityId = "kano",\r
  ) {`;

if (ped.includes(oldPedCtor)) {
  ped = ped.replace(oldPedCtor, newPedCtor);
  console.log("  Added cityId to PedestrianSystem constructor");
}

// Only spawn Kano static crowd in Kano
const oldPedSpawnCrowd = `  private spawnCrowd() {\r
    this.spawnMarketVendors();\r
    this.spawnIndustrialWorkers();\r
    this.spawnHistoricCharacters();\r
    this.spawnDakaliElders();\r
    const initialWalkerCount = this.quality === "performance" ? 2 : this.quality === "balanced" ? 4 : 8;\r
    this.spawnAdditionalWalkers(initialWalkerCount);\r
  }`;

const newPedSpawnCrowd = `  private spawnCrowd() {\r
    if (this.cityId !== "abuja") {\r
      this.spawnMarketVendors();\r
      this.spawnIndustrialWorkers();\r
      this.spawnHistoricCharacters();\r
      this.spawnDakaliElders();\r
    }\r
    const initialWalkerCount = this.quality === "performance" ? 2 : this.quality === "balanced" ? 4 : 8;\r
    this.spawnAdditionalWalkers(initialWalkerCount);\r
  }`;

if (ped.includes(oldPedSpawnCrowd)) {
  ped = ped.replace(oldPedSpawnCrowd, newPedSpawnCrowd);
  console.log("  Gated Kano crowd spawning behind cityId !== 'abuja'");
}

// Pedestrian shadow culling
const oldPedShadowTraverse = `      const shouldCastShadow = distToPlayer <= 30 && this.quality === 'quality';\r
      if (p.model.root.userData.lastShadowState !== shouldCastShadow) {\r
        p.model.root.userData.lastShadowState = shouldCastShadow;\r
        p.model.root.traverse((child) => {\r
          if (child instanceof THREE.Mesh) {\r
            child.castShadow = shouldCastShadow;\r
          }\r
        });\r
      }`;

const newPedShadowTraverse = `      const shouldCastShadow = distToPlayer <= 30 && this.quality === 'quality';\r
      if (p.model.root.userData.lastShadowState !== shouldCastShadow) {\r
        p.model.root.userData.lastShadowState = shouldCastShadow;\r
        p.model.root.traverse((child) => {\r
          if (child instanceof THREE.Mesh) {\r
            if (shouldCastShadow) {\r
              const nl = child.name.toLowerCase();\r
              const isMicro = child.name.startsWith("h_") || nl.includes("eye") || nl.includes("gland") || nl.includes("teeth");\r
              child.castShadow = !isMicro;\r
            } else {\r
              child.castShadow = false;\r
            }\r
          }\r
        });\r
      }`;

if (ped.includes(oldPedShadowTraverse)) {
  ped = ped.replace(oldPedShadowTraverse, newPedShadowTraverse);
  console.log("  Optimized pedestrian shadow traverse");
}
fs.writeFileSync(path.join(rootDir, "PedestrianSystem.ts"), ped, "utf8");

// 4. Update GameEngine.ts
console.log("Updating GameEngine.ts...");
let engine = fs.readFileSync(path.join(rootDir, "GameEngine.ts"), "utf8");

// Pass currentCity to constructors in GameEngine
const oldEngTrafficCtor1 = `    this.trafficSystem = new TrafficSystem(\r
      this.scene,\r
      this.materials,\r
      this.navigation,\r
      this.colliderIndex,\r
      (x, z) => this.surfaceHeight(x, z),\r
    );`;

const newEngTrafficCtor1 = `    this.trafficSystem = new TrafficSystem(\r
      this.scene,\r
      this.materials,\r
      this.navigation,\r
      this.colliderIndex,\r
      (x, z) => this.surfaceHeight(x, z),\r
      this.currentCity,\r
    );`;

if (engine.includes(oldEngTrafficCtor1)) {
  engine = engine.replace(oldEngTrafficCtor1, newEngTrafficCtor1);
  console.log("  Passed currentCity to TrafficSystem in ctor");
}

const oldEngPedCtor1 = `    this.pedestrianSystem = new PedestrianSystem(\r
      this.scene,\r
      this.materials,\r
      this.navigation,\r
      this.colliderIndex,\r
      (x, z) => this.surfaceHeight(x, z),\r
    );`;

const newEngPedCtor1 = `    this.pedestrianSystem = new PedestrianSystem(\r
      this.scene,\r
      this.materials,\r
      this.navigation,\r
      this.colliderIndex,\r
      (x, z) => this.surfaceHeight(x, z),\r
      this.currentCity,\r
    );`;

if (engine.includes(oldEngPedCtor1)) {
  engine = engine.replace(oldEngPedCtor1, newEngPedCtor1);
  console.log("  Passed currentCity to PedestrianSystem in ctor");
}

// In travelToCity:
const oldEngTrafficCtor2 = `    this.trafficSystem = new TrafficSystem(\r
      this.scene,\r
      this.materials,\r
      this.navigation,\r
      this.colliderIndex,\r
      (x, z) => this.surfaceHeight(x, z),\r
    );`;

// There are two identical occurrences, replace all
while (engine.includes(oldEngTrafficCtor1)) {
  engine = engine.replace(oldEngTrafficCtor1, newEngTrafficCtor1);
}
while (engine.includes(oldEngPedCtor1)) {
  engine = engine.replace(oldEngPedCtor1, newEngPedCtor1);
}

// Gating stationary Kano commercial fleet vehicles in updateChunkCulling
const oldVehCull = `    if (this.car?.root) {\r
      this.car.root.visible = (this.mode === "driving" && this.activeVehicle === "sedan") || this.carPosition.distanceTo(center) <= vehCullDist;\r
    }\r
    if (this.keke?.root) {\r
      this.keke.root.visible = (this.mode === "driving" && this.activeVehicle === "keke") || this.kekePosition.distanceTo(center) <= vehCullDist;\r
    }\r
    if (this.van?.root) {\r
      this.van.root.visible = (this.mode === "driving" && this.activeVehicle === "van") || this.vanPosition.distanceTo(center) <= vehCullDist;\r
    }\r
    if (this.pickup?.root) {\r
      this.pickup.root.visible = (this.mode === "driving" && this.activeVehicle === "pickup") || this.pickupPosition.distanceTo(center) <= vehCullDist;\r
    }\r
    if (this.minibus?.root) {\r
      this.minibus.root.visible = (this.mode === "driving" && this.activeVehicle === "minibus") || this.minibusPosition.distanceTo(center) <= vehCullDist;\r
    }\r
    if (this.truck?.root) {\r
      this.truck.root.visible = (this.mode === "driving" && this.activeVehicle === "truck") || this.truckPosition.distanceTo(center) <= vehCullDist;\r
    }`;

const newVehCull = `    const isAbuja = this.currentCity === "abuja";\r
    if (this.car?.root) {\r
      this.car.root.visible = (this.mode === "driving" && this.activeVehicle === "sedan") || this.carPosition.distanceTo(center) <= vehCullDist;\r
    }\r
    if (this.keke?.root) {\r
      this.keke.root.visible = !isAbuja && ((this.mode === "driving" && this.activeVehicle === "keke") || this.kekePosition.distanceTo(center) <= vehCullDist);\r
    }\r
    if (this.van?.root) {\r
      this.van.root.visible = !isAbuja && ((this.mode === "driving" && this.activeVehicle === "van") || this.vanPosition.distanceTo(center) <= vehCullDist);\r
    }\r
    if (this.pickup?.root) {\r
      this.pickup.root.visible = !isAbuja && ((this.mode === "driving" && this.activeVehicle === "pickup") || this.pickupPosition.distanceTo(center) <= vehCullDist);\r
    }\r
    if (this.minibus?.root) {\r
      this.minibus.root.visible = !isAbuja && ((this.mode === "driving" && this.activeVehicle === "minibus") || this.minibusPosition.distanceTo(center) <= vehCullDist);\r
    }\r
    if (this.truck?.root) {\r
      this.truck.root.visible = !isAbuja && ((this.mode === "driving" && this.activeVehicle === "truck") || this.truckPosition.distanceTo(center) <= vehCullDist);\r
    }`;

if (engine.includes(oldVehCull)) {
  engine = engine.replace(oldVehCull, newVehCull);
  console.log("  Gated Kano player fleet vehicles in updateChunkCulling");
} else {
  console.warn("  Could not find oldVehCull in GameEngine.ts");
}

fs.writeFileSync(path.join(rootDir, "GameEngine.ts"), engine, "utf8");
console.log("All optimizations applied successfully!");
