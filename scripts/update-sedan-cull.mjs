import fs from "fs";

let actors = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", "utf8");

const oldCode = `        if (nameLower.includes("rotor_drill_recess")) {
          child.visible = false;
          child.castShadow = false;
          return;
        }`;

const newCode = `        if (
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

// Replace regardless of line endings
const cleanActors = actors.replace(/\r\n/g, "\n");
const cleanOld = oldCode.replace(/\r\n/g, "\n");
const cleanNew = newCode.replace(/\r\n/g, "\n");

if (cleanActors.includes(cleanOld)) {
  const updated = cleanActors.replace(cleanOld, cleanNew);
  fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", updated.replace(/\n/g, "\r\n"), "utf8");
  console.log("Successfully updated sedan micro-mesh culling in actors.ts");
} else {
  console.error("Could not find oldCode in actors.ts");
}
