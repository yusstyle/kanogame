import fs from "fs";
import path from "path";

const filePath = path.resolve("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/abujaDistrict.ts");
let code = fs.readFileSync(filePath, "utf8");

code = code.replace(
  "addCylinder(root, sharedMaterials.whiteMarble, mx, 11.5, mz, 1.3, 1.5, 16, 8);",
  "addCylinder(root, sharedMaterials.whiteMarble, mx, 11.5, mz, 1.3, 1.5, 16);"
);
code = code.replace(
  "addCylinder(root, sharedMaterials.whiteMarble, mx, 19.8, mz, 2.1, 1.4, 0.8, 8);",
  "addCylinder(root, sharedMaterials.whiteMarble, mx, 19.8, mz, 2.1, 1.4, 0.8);"
);
code = code.replace(
  "addCylinder(root, sharedMaterials.goldAccents, mx, 20.4, mz, 2.1, 2.1, 0.6, 8);",
  "addCylinder(root, sharedMaterials.goldAccents, mx, 20.4, mz, 2.1, 2.1, 0.6);"
);
code = code.replace(
  "addCylinder(root, sharedMaterials.whiteMarble, mx, 24.5, mz, 1.05, 1.25, 8, 8);",
  "addCylinder(root, sharedMaterials.whiteMarble, mx, 24.5, mz, 1.05, 1.25, 8);"
);
code = code.replace(
  "addCylinder(root, sharedMaterials.whiteMarble, mx, 28.8, mz, 1.6, 1.1, 0.6, 8);",
  "addCylinder(root, sharedMaterials.whiteMarble, mx, 28.8, mz, 1.6, 1.1, 0.6);"
);
code = code.replace(
  "addCylinder(root, sharedMaterials.goldAccents, mx, 29.3, mz, 1.6, 1.6, 0.5, 8);",
  "addCylinder(root, sharedMaterials.goldAccents, mx, 29.3, mz, 1.6, 1.6, 0.5);"
);
code = code.replace(
  "addCylinder(root, sharedMaterials.goldDome, mx, 32.5, mz, 0.05, 1.1, 6, 8);",
  "addCylinder(root, sharedMaterials.goldDome, mx, 32.5, mz, 0.05, 1.1, 6);"
);

fs.writeFileSync(filePath, code, "utf8");
console.log("Fixed addCylinder calls in abujaDistrict.ts");
