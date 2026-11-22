import fs from "fs";

// 1. Update actors.ts to tag isInteriorOrMicro
let actors = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", "utf8");

const oldTraverse = `        if (
          nameLower.includes("rotor_drill_recess") ||
          nameLower.includes("lug_") ||
          nameLower.includes("cabin_carpet") ||
          nameLower.includes("caliper") ||
          nameLower.includes("wiper")
        ) {
          child.visible = false;
          child.castShadow = false;
          return;
        }`;

const newTraverse = `        if (
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
        }`;

const cleanActors = actors.replace(/\r\n/g, "\n");
const cleanOld = oldTraverse.replace(/\r\n/g, "\n");
const cleanNew = newTraverse.replace(/\r\n/g, "\n");

// If isTraffic block was added previously, let's replace the whole region
const oldFullRegion = `        if (
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

        if (isTraffic) {
          if (
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
            nameLower.includes("optical") ||
            nameLower.includes("pocket") ||
            nameLower.includes("flange")
          ) {
            child.visible = false;
            child.castShadow = false;
            return;
          }
        }`;

if (cleanActors.includes(oldFullRegion.replace(/\r\n/g, "\n"))) {
  const updated = cleanActors.replace(oldFullRegion.replace(/\r\n/g, "\n"), cleanNew);
  fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", updated.replace(/\n/g, "\r\n"), "utf8");
  console.log("Successfully updated actors.ts with isInteriorOrMicro tag");
} else {
  console.log("Could not find oldFullRegion in actors.ts");
}

// 2. Update GameEngine.ts to update player car interior LOD in updateChunkCulling
let engine = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/GameEngine.ts", "utf8");

const oldEngCull = `    if (this.car?.root) {
      this.car.root.visible = (this.mode === "driving" && this.activeVehicle === "sedan") || this.carPosition.distanceTo(center) <= vehCullDist;
    }`;

const newEngCull = `    if (this.car?.root) {
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

if (engine.includes(oldEngCull)) {
  engine = engine.replace(oldEngCull, newEngCull);
  fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/GameEngine.ts", engine, "utf8");
  console.log("Successfully updated GameEngine.ts with distance LOD for player car micro/interior meshes");
} else {
  console.warn("Could not find oldEngCull in GameEngine.ts");
}
