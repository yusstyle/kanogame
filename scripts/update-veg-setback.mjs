import fs from "fs";
import path from "path";

const srcGame = path.resolve("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game");
const filePath = path.join(srcGame, "abujaVegetation.ts");
let code = fs.readFileSync(filePath, "utf8");

code = code.replace(
  /for \(let z = -140; z <= 140; z \+= 18\) \{\s*if \(Math\.abs\(z\) < 26\) continue;/,
  `for (let z = -140; z <= 140; z += 18) {
    if (Math.abs(z) < 42) continue;`
);

code = code.replace(
  /for \(let x = -130; x <= 130; x \+= 20\) \{\s*if \(Math\.abs\(x\) < 26\) continue;/,
  `for (let x = -130; x <= 130; x += 20) {
    if (Math.abs(x) < 42) continue;`
);

fs.writeFileSync(filePath, code, "utf8");
console.log("abujaVegetation.ts setbacks updated!");

