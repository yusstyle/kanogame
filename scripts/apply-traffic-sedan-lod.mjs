import fs from "fs";

// 1. Update actors.ts
let actors = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", "utf8");

// Update CarModel type definition
actors = actors.replace(
  'attachGLTFBody: (gltf: THREE.Group, colorHex?: string) => void;',
  'attachGLTFBody: (gltf: THREE.Group, colorHex?: string, isTraffic?: boolean) => void;'
);

// Update attachGLTFBody implementation
const oldAttachImpl = `  const attachGLTFBody = (gltf: THREE.Group, colorHex?: string) => {`;
const newAttachImpl = `  const attachGLTFBody = (gltf: THREE.Group, colorHex?: string, isTraffic = false) => {`;
actors = actors.replace(oldAttachImpl, newAttachImpl);

const oldCullBlock = `        if (
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

const newCullBlock = `        if (
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

// Replace regardless of line endings
const cleanActors = actors.replace(/\r\n/g, "\n");
const cleanOldCull = oldCullBlock.replace(/\r\n/g, "\n");
const cleanNewCull = newCullBlock.replace(/\r\n/g, "\n");

if (cleanActors.includes(cleanOldCull)) {
  const updated = cleanActors.replace(cleanOldCull, cleanNewCull);
  fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", updated.replace(/\n/g, "\r\n"), "utf8");
  console.log("Successfully updated attachGLTFBody in actors.ts");
} else {
  console.error("Could not find cleanOldCull in actors.ts");
}

// 2. Also hide teeth and tear glands in attachRiggedCharacter in actors.ts
let actors2 = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", "utf8");
const oldRiggedTraverse = `          const nl = child.name.toLowerCase();
          const isMicro = child.name.startsWith("h_") || nl.includes("eye") || nl.includes("gland") || nl.includes("teeth");
          child.castShadow = !isMicro;
          child.receiveShadow = true;`;

const newRiggedTraverse = `          const nl = child.name.toLowerCase();
          if (nl.includes("teeth") || nl.includes("gland")) {
            child.visible = false;
            child.castShadow = false;
            return;
          }
          const isMicro = child.name.startsWith("h_") || nl.includes("eye");
          child.castShadow = !isMicro;
          child.receiveShadow = true;`;

const cleanActors2 = actors2.replace(/\r\n/g, "\n");
const cleanOldRigged = oldRiggedTraverse.replace(/\r\n/g, "\n");
const cleanNewRigged = newRiggedTraverse.replace(/\r\n/g, "\n");

if (cleanActors2.includes(cleanOldRigged)) {
  const updated = cleanActors2.replace(cleanOldRigged, cleanNewRigged);
  fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/actors.ts", updated.replace(/\n/g, "\r\n"), "utf8");
  console.log("Successfully updated rigged character culling in actors.ts");
} else {
  console.error("Could not find cleanOldRigged in actors.ts");
}

// 3. Update TrafficSystem.ts to pass isTraffic = true
let traffic = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/TrafficSystem.ts", "utf8");
traffic = traffic.replace(
  '(v.model as CarModel).attachGLTFBody(sedanGLTF, variant?.body || "#b0b5b8");',
  '(v.model as CarModel).attachGLTFBody(sedanGLTF, variant?.body || "#b0b5b8", true);'
);
traffic = traffic.replace(
  'car.attachGLTFBody(this.sedanGLTF, p.body);',
  'car.attachGLTFBody(this.sedanGLTF, p.body, true);'
);
traffic = traffic.replace(
  'car.attachGLTFBody(this.sedanGLTF, variant.body);',
  'car.attachGLTFBody(this.sedanGLTF, variant.body, true);'
);
fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/TrafficSystem.ts", traffic, "utf8");
console.log("Successfully updated TrafficSystem.ts to pass isTraffic = true");
