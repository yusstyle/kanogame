import fs from "fs";

let actors = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", "utf8");

const dupBlock = `        const isMicroOrInterior = (
          nameLower.includes("rotor") ||
          nameLower.includes("drill") ||
          nameLower.includes("lug") ||
          nameLower.includes("caliper") ||
          nameLower.includes("wiper") ||
          nameLower.includes("valve") ||
          nameLower.includes("headrest") ||
          nameLower.includes("seat") ||
          nameLower.includes("console") ||
          nameLower.includes("carpet") ||
          nameLower.includes("steering") ||
          nameLower.includes("mirror") ||
          nameLower.includes("bead") ||
          nameLower.includes("handle") ||
          nameLower.includes("liner") ||
          nameLower.includes("insert") ||
          nameLower.includes("optical") ||
          nameLower.includes("pillar")
        );
        if (isMicroOrInterior) {
          child.castShadow = false;
        }`;

const cleanActors = actors.replace(/\r\n/g, "\n");
const cleanDup = dupBlock.replace(/\r\n/g, "\n");

if (cleanActors.includes(cleanDup)) {
  const updated = cleanActors.replace(cleanDup, "");
  fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", updated.replace(/\n/g, "\r\n"), "utf8");
  console.log("Successfully removed duplicate isMicroOrInterior block");
} else {
  console.error("Could not find cleanDup");
}
