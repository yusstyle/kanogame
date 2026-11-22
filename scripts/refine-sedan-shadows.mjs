import fs from "fs";

// 1. Update actors.ts
let actors = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", "utf8");

const oldActorsBlock = `        if (isMicroOrInterior) {
          child.userData = child.userData || {};
          child.userData.isInteriorOrMicro = true;
          child.castShadow = false;
          if (isTraffic) {
            child.visible = false;
            return;
          }
        }`;

const newActorsBlock = `        if (isMicroOrInterior) {
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
        child.castShadow = nameLower.includes("body_shell") || nameLower.includes("sculpted_tyre");`;

const cleanActors = actors.replace(/\r\n/g, "\n");
const cleanOldActors = oldActorsBlock.replace(/\r\n/g, "\n");
const cleanNewActors = newActorsBlock.replace(/\r\n/g, "\n");

if (cleanActors.includes(cleanOldActors)) {
  const updated = cleanActors.replace(cleanOldActors, cleanNewActors);
  fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", updated.replace(/\n/g, "\r\n"), "utf8");
  console.log("Successfully refined vehicle shadow casters in actors.ts");
} else {
  console.error("Could not find cleanOldActors in actors.ts");
}

// 2. Update TrafficSystem.ts
let traffic = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/TrafficSystem.ts", "utf8");

const oldTrafficShadow = `          if (child instanceof THREE.Mesh) {
            if (shouldCastShadow) {
              const nl = child.name.toLowerCase();
              const isMicro = nl.includes("rotor") || nl.includes("drill") || nl.includes("lug") || nl.includes("caliper") || nl.includes("wiper") || nl.includes("valve") || nl.includes("headrest") || nl.includes("seat") || nl.includes("console") || nl.includes("carpet") || nl.includes("steering") || nl.includes("mirror") || nl.includes("bead") || nl.includes("handle") || nl.includes("liner") || nl.includes("insert") || nl.includes("optical") || nl.includes("pillar");
              child.castShadow = !isMicro;
            } else {
              child.castShadow = false;
            }
          }`;

const newTrafficShadow = `          if (child instanceof THREE.Mesh) {
            if (shouldCastShadow) {
              const nl = child.name.toLowerCase();
              child.castShadow = nl.includes("body_shell") || nl.includes("sculpted_tyre") || nl.includes("chassis") || nl.includes("body") || nl.includes("procedural");
            } else {
              child.castShadow = false;
            }
          }`;

const cleanTraffic = traffic.replace(/\r\n/g, "\n");
const cleanOldTraffic = oldTrafficShadow.replace(/\r\n/g, "\n");
const cleanNewTraffic = newTrafficShadow.replace(/\r\n/g, "\n");

if (cleanTraffic.includes(cleanOldTraffic)) {
  const updated = cleanTraffic.replace(cleanOldTraffic, cleanNewTraffic);
  fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/TrafficSystem.ts", updated.replace(/\n/g, "\r\n"), "utf8");
  console.log("Successfully refined dynamic traffic shadows in TrafficSystem.ts");
} else {
  console.error("Could not find cleanOldTraffic in TrafficSystem.ts");
}
