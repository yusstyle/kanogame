import fs from "fs";

// ==========================================
// 1. ACTORS.TS: Add CarModel LOD System
// ==========================================
console.log("Updating actors.ts...");
let actorsContent = fs.readFileSync("artifacts/kano-streets/src/game/actors.ts", "utf8");
const isCrlf = actorsContent.includes("\r\n");
actorsContent = actorsContent.replace(/\r\n/g, "\n");

// Update CarModel type definition
const targetCarModelType = `export type CarModel = {
  root: THREE.Group;
  wheels: THREE.Group[];
  frontWheels: THREE.Group[];
  proceduralBody: THREE.Group;
  gltfBody?: THREE.Group;
  wheelRig: "procedural" | "asset";
  attachGLTFBody: (gltf: THREE.Group, colorHex?: string, isTraffic?: boolean) => void;
};`;

const replacementCarModelType = `export type CarModel = {
  root: THREE.Group;
  wheels: THREE.Group[];
  frontWheels: THREE.Group[];
  proceduralBody: THREE.Group;
  gltfBody?: THREE.Group;
  wheelRig: "procedural" | "asset";
  attachGLTFBody: (gltf: THREE.Group, colorHex?: string, isTraffic?: boolean) => void;
  setLODLevel?: (level: 0 | 1 | 2) => void;
};`;

if (!actorsContent.includes(targetCarModelType)) {
  throw new Error("Could not find targetCarModelType in actors.ts");
}
actorsContent = actorsContent.replace(targetCarModelType, replacementCarModelType);

// Update attachGLTFBody implementation in createCarModel
const targetAttachBody = `  const attachGLTFBody = (gltf: THREE.Group, colorHex?: string, isTraffic = false) => {
    if (gltfBody) {
      root.remove(gltfBody);
    }
    proceduralBody.visible = false;
    wheels.forEach((pivot) => {
      pivot.visible = false;
    });
    const model = gltf.clone(true);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const nameLower = child.name.toLowerCase();
        if (
          nameLower.includes("rotor_drill_recess") ||
          nameLower.includes("lug_") ||
          nameLower.includes("cabin_carpet") ||
          nameLower.includes("caliper") ||
          nameLower.includes("wiper")
        ) {
          child.visible = false;
          child.castShadow = false;
          return;
        }

        const isMicroOrInterior = (
          nameLower.includes("inner_mesh") ||
          nameLower.includes("shut_line") ||
          nameLower.includes("rubber_seal") ||
          nameLower.includes("rotor") ||
          nameLower.includes("liner") ||
          nameLower.includes("valve_stem") ||
          nameLower.includes("plinth") ||
          nameLower.includes("gasket") ||
          nameLower.includes("headrest") ||
          nameLower.includes("seat") ||
          nameLower.includes("steering") ||
          nameLower.includes("console") ||
          nameLower.includes("carpet") ||
          nameLower.includes("optical") ||
          nameLower.includes("pocket") ||
          nameLower.includes("flange") ||
          nameLower.includes("drill") ||
          nameLower.includes("mirror") ||
          nameLower.includes("bead") ||
          nameLower.includes("handle") ||
          nameLower.includes("insert") ||
          nameLower.includes("pillar")
        );
        if (isMicroOrInterior) {
          child.userData = child.userData || {};
          child.userData.isInteriorOrMicro = true;
          child.castShadow = false;
          if (isTraffic) {
            child.visible = false;
            return;
          }
        }

        // Only the main watertight body shell and tires define the car silhouette in sunlight shadows.
        // All decorative micro-trim, lenses, sensors, blades, and inner caps are shadow-culled.
        child.castShadow = nameLower.includes("body_shell") || nameLower.includes("sculpted_tyre");

        if (
          nameLower.includes("headrest") ||
          nameLower.includes("seat_back") ||
          nameLower.includes("seat_cushion")
        ) {
          child.userData = child.userData || {};
          child.userData.isSeatMesh = true;
          // In graphite-four-door-sedan.glb, front seats and headrests:
          if (
            child.name.startsWith("Adjustable_headrest") ||
            child.name.startsWith("Contoured_seat_back") ||
            child.name.startsWith("Contoured_seat_cushion")
          ) {
            child.userData.isDriverSeatPart = true;
          }
        }
      }
    });`;

const replacementAttachBody = `  const setLODLevel = (level: 0 | 1 | 2) => {
    if (!gltfBody) return;
    if (gltfBody.userData.currentLOD === level) return;
    gltfBody.userData.currentLOD = level;
    gltfBody.traverse((child) => {
      if (child instanceof THREE.Mesh && typeof child.userData.lodMinLevel === "number") {
        child.visible = child.userData.lodMinLevel <= level;
      }
    });
  };

  const attachGLTFBody = (gltf: THREE.Group, colorHex?: string, isTraffic = false) => {
    if (gltfBody) {
      root.remove(gltfBody);
    }
    proceduralBody.visible = false;
    wheels.forEach((pivot) => {
      pivot.visible = false;
    });
    const model = gltf.clone(true);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const nameLower = child.name.toLowerCase();
        child.userData = child.userData || {};

        // LOD Hierarchy for 180+ submesh sedan model:
        // LOD 2 (Far > 55m): Core silhouette only (watertight body shell, 4 tires) -> 5 draw calls total
        // LOD 1 (Mid 18m - 55m / Traffic): Primary exterior (body, tires, rims, glass, bumpers, roof, hood, lamps) -> ~18 draw calls
        // LOD 0 (Near < 18m / Driving): Full detail including interior, trim, seats, consoles
        const isCoreSilhouette = nameLower.includes("body_shell") || nameLower.includes("sculpted_tyre");
        const isPrimaryExterior = isCoreSilhouette || (
          nameLower.includes("rim") ||
          nameLower.includes("glass") ||
          nameLower.includes("windshield") ||
          nameLower.includes("bumper") ||
          nameLower.includes("roof") ||
          nameLower.includes("hood") ||
          nameLower.includes("lamp") ||
          nameLower.includes("lens") ||
          nameLower.includes("mirror")
        );

        if (isCoreSilhouette) {
          child.userData.lodMinLevel = 2; // Always visible in LOD 0, 1, 2
        } else if (isPrimaryExterior) {
          child.userData.lodMinLevel = 1; // Visible in LOD 0, 1
        } else {
          child.userData.lodMinLevel = 0; // Visible only in LOD 0
        }

        // Traffic vehicles only ever require LOD 1 (exterior without micro-internals)
        if (isTraffic && child.userData.lodMinLevel < 1) {
          child.visible = false;
          child.castShadow = false;
          return;
        }

        // Only body shell and tires cast directional sunlight shadows
        child.castShadow = isCoreSilhouette;

        if (
          nameLower.includes("headrest") ||
          nameLower.includes("seat_back") ||
          nameLower.includes("seat_cushion")
        ) {
          child.userData.isSeatMesh = true;
          if (
            child.name.startsWith("Adjustable_headrest") ||
            child.name.startsWith("Contoured_seat_back") ||
            child.name.startsWith("Contoured_seat_cushion")
          ) {
            child.userData.isDriverSeatPart = true;
          }
        }
      }
    });`;

if (!actorsContent.includes(targetAttachBody)) {
  throw new Error("Could not find targetAttachBody in actors.ts");
}
actorsContent = actorsContent.replace(targetAttachBody, replacementAttachBody);

// Export setLODLevel in return object of createCarModel
const targetCarReturn = `    get gltfBody() {
      return gltfBody;
    },
    wheelRig: "procedural",
    attachGLTFBody,
  };`;

const replacementCarReturn = `    get gltfBody() {
      return gltfBody;
    },
    wheelRig: "procedural",
    attachGLTFBody,
    setLODLevel,
  };`;

if (!actorsContent.includes(targetCarReturn)) {
  throw new Error("Could not find targetCarReturn in actors.ts");
}
actorsContent = actorsContent.replace(targetCarReturn, replacementCarReturn);

fs.writeFileSync("artifacts/kano-streets/src/game/actors.ts", isCrlf ? actorsContent.replace(/\n/g, "\r\n") : actorsContent);
console.log("actors.ts updated successfully!");

// ==========================================
// 2. GAMEENGINE.TS: Update Vehicle Distance Culling & LOD
// ==========================================
console.log("Updating GameEngine.ts...");
let engineContent = fs.readFileSync("artifacts/kano-streets/src/game/GameEngine.ts", "utf8");
const engineIsCrlf = engineContent.includes("\r\n");
engineContent = engineContent.replace(/\r\n/g, "\n");

const targetEngineCarCull = `    if (this.car?.root) {
      const distToCar = this.carPosition.distanceTo(center);
      const isCarVisible = (this.mode === "driving" && this.activeVehicle === "sedan") || distToCar <= vehCullDist;
      this.car.root.visible = isCarVisible;
      if (isCarVisible && this.car.gltfBody) {
        const showMicro = (this.mode === "driving" && this.activeVehicle === "sedan") || distToCar < 14;
        if (this.car.gltfBody.userData.lastMicroState !== showMicro) {
          this.car.gltfBody.userData.lastMicroState = showMicro;
          this.car.gltfBody.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData?.isInteriorOrMicro) {
              child.visible = showMicro;
            }
          });
        }
      }
    }`;

const replacementEngineCarCull = `    if (this.car?.root) {
      const distToCar = this.carPosition.distanceTo(center);
      const isCarVisible = (this.mode === "driving" && this.activeVehicle === "sedan") || distToCar <= vehCullDist;
      this.car.root.visible = isCarVisible;
      if (isCarVisible && this.car.setLODLevel) {
        const isNear = (this.mode === "driving" && this.activeVehicle === "sedan") || distToCar < 18;
        const isMid = distToCar < 55;
        const lod: 0 | 1 | 2 = isNear ? 0 : isMid ? 1 : 2;
        this.car.setLODLevel(lod);
      }
    }`;

if (!engineContent.includes(targetEngineCarCull)) {
  throw new Error("Could not find targetEngineCarCull in GameEngine.ts");
}
engineContent = engineContent.replace(targetEngineCarCull, replacementEngineCarCull);

fs.writeFileSync("artifacts/kano-streets/src/game/GameEngine.ts", engineIsCrlf ? engineContent.replace(/\n/g, "\r\n") : engineContent);
console.log("GameEngine.ts updated successfully!");

// ==========================================
// 3. TRAFFICSYSTEM.TS: Shadow Caster Restriction
// ==========================================
console.log("Updating TrafficSystem.ts...");
let trafficContent = fs.readFileSync("artifacts/kano-streets/src/game/TrafficSystem.ts", "utf8");
const trafficIsCrlf = trafficContent.includes("\r\n");
trafficContent = trafficContent.replace(/\r\n/g, "\n");

const targetTrafficQuality = `    const enableShadows = quality === "quality";
    this.vehicles.forEach((v) => {
      v.model.root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = enableShadows;
        }
      });
    });`;

const replacementTrafficQuality = `    const enableShadows = quality === "quality";
    this.vehicles.forEach((v) => {
      v.model.root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const nameLower = child.name.toLowerCase();
          const isCoreCaster = nameLower.includes("body_shell") || nameLower.includes("tyre") || nameLower.includes("cabin") || nameLower.includes("chassis");
          child.castShadow = enableShadows && isCoreCaster;
        }
      });
    });`;

if (!trafficContent.includes(targetTrafficQuality)) {
  throw new Error("Could not find targetTrafficQuality in TrafficSystem.ts");
}
trafficContent = trafficContent.replace(targetTrafficQuality, replacementTrafficQuality);

fs.writeFileSync("artifacts/kano-streets/src/game/TrafficSystem.ts", trafficIsCrlf ? trafficContent.replace(/\n/g, "\r\n") : trafficContent);
console.log("TrafficSystem.ts updated successfully!");

// ==========================================
// 4. PEDESTRIANSYSTEM.TS: Shadow Caster Restriction
// ==========================================
console.log("Updating PedestrianSystem.ts...");
let pedContent = fs.readFileSync("artifacts/kano-streets/src/game/PedestrianSystem.ts", "utf8");
const pedIsCrlf = pedContent.includes("\r\n");
pedContent = pedContent.replace(/\r\n/g, "\n");

const targetPedQuality = `    const enableShadows = quality === "quality";
    this.pedestrians.forEach((p) => {
      p.model.root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = enableShadows;
        }
      });
    });`;

const replacementPedQuality = `    const enableShadows = quality === "quality";
    this.pedestrians.forEach((p) => {
      p.model.root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const nl = child.name.toLowerCase();
          const isMicro = child.name.startsWith("h_") || nl.includes("eye") || nl.includes("gland") || nl.includes("teeth");
          child.castShadow = enableShadows && !isMicro;
        }
      });
    });`;

if (!pedContent.includes(targetPedQuality)) {
  throw new Error("Could not find targetPedQuality in PedestrianSystem.ts");
}
pedContent = pedContent.replace(targetPedQuality, replacementPedQuality);

fs.writeFileSync("artifacts/kano-streets/src/game/PedestrianSystem.ts", pedIsCrlf ? pedContent.replace(/\n/g, "\r\n") : pedContent);
console.log("PedestrianSystem.ts updated successfully!");

// ==========================================
// 5. ABUJASTREAMING.TS: Distance Tuning & Central Chunk LOD
// ==========================================
console.log("Updating abujaStreaming.ts...");
let streamContent = fs.readFileSync("artifacts/kano-streets/src/game/abujaStreaming.ts", "utf8");
const streamIsCrlf = streamContent.includes("\r\n");
streamContent = streamContent.replace(/\r\n/g, "\n");

const targetStreamUpdate = `    // Distances squared for high-performance threshold comparison on integrated GPUs
    const nearDistSq = 220 * 220;
    const midDistSq = 450 * 450;

    for (const chunk of this.chunks.values()) {
      // Clamped closest point on chunk AABB to player for accurate distance calculation
      const closestX = Math.max(chunk.minX, Math.min(px, chunk.maxX));
      const closestZ = Math.max(chunk.minZ, Math.min(pz, chunk.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      // Central core chunks (preserving existing landmarks) are always kept active
      const isCentral = chunk.districtType === "central_core";

      if (distSq <= nearDistSq) {
        // LOD 0: Near detail
        chunk.group.visible = true;
        chunk.lod0Group.visible = true;
        chunk.lod1Group.visible = false;
        chunk.currentLod = 0;
        chunk.isVisible = true;
        activeCount++;
      } else if (distSq <= midDistSq || isCentral) {
        // LOD 1: Mid detail (simplified shells)
        chunk.group.visible = true;
        chunk.lod0Group.visible = false;
        chunk.lod1Group.visible = true;
        chunk.currentLod = 1;
        chunk.isVisible = true;
        activeCount++;
      } else {
        // LOD 2 / Culled
        chunk.group.visible = false;
        chunk.lod0Group.visible = false;
        chunk.lod1Group.visible = false;
        chunk.currentLod = 2;
        chunk.isVisible = false;
      }
    }`;

const replacementStreamUpdate = `    // Distances squared for high-performance threshold comparison on integrated GPUs
    const nearDistSq = 175 * 175; // 30,625
    const midDistSq = 400 * 400;  // 160,000

    for (const chunk of this.chunks.values()) {
      // Clamped closest point on chunk AABB to player for accurate distance calculation
      const closestX = Math.max(chunk.minX, Math.min(px, chunk.maxX));
      const closestZ = Math.max(chunk.minZ, Math.min(pz, chunk.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      // Central core landmarks are standalone in AbujaWorldRoot, so streaming chunks follow standard distance LOD
      if (distSq <= nearDistSq) {
        // LOD 0: Near detail
        chunk.group.visible = true;
        chunk.lod0Group.visible = true;
        chunk.lod1Group.visible = false;
        chunk.currentLod = 0;
        chunk.isVisible = true;
        activeCount++;
      } else if (distSq <= midDistSq) {
        // LOD 1: Mid detail (simplified shells)
        chunk.group.visible = true;
        chunk.lod0Group.visible = false;
        chunk.lod1Group.visible = true;
        chunk.currentLod = 1;
        chunk.isVisible = true;
        activeCount++;
      } else {
        // LOD 2 / Culled
        chunk.group.visible = false;
        chunk.lod0Group.visible = false;
        chunk.lod1Group.visible = false;
        chunk.currentLod = 2;
        chunk.isVisible = false;
      }
    }`;

if (!streamContent.includes(targetStreamUpdate)) {
  throw new Error("Could not find targetStreamUpdate in abujaStreaming.ts");
}
streamContent = streamContent.replace(targetStreamUpdate, replacementStreamUpdate);

fs.writeFileSync("artifacts/kano-streets/src/game/abujaStreaming.ts", streamIsCrlf ? streamContent.replace(/\n/g, "\r\n") : streamContent);
console.log("abujaStreaming.ts updated successfully!");
