import fs from "fs";

const vegPath = "artifacts/kano-streets/src/game/abujaVegetation.ts";
let code = fs.readFileSync(vegPath, "utf8");
const isCRLF = code.includes("\r\n");
const EOL = isCRLF ? "\r\n" : "\n";

const decls = [
  '// Pre-create shared geometries once for fast instancing',
  'const geoRoyalPalmTrunk = buildRoyalPalmTrunkGeometry();',
  'const geoRoyalPalmCrown = buildRoyalPalmCrownGeometry();',
  'const geoFanPalmTrunk = buildFanPalmTrunkGeometry();',
  'const geoFanPalmCrown = buildFanPalmCrownGeometry();',
  'const geoAcaciaTrunk = buildAcaciaTrunkGeometry();',
  'const geoAcaciaFoliage = buildAcaciaFoliageGeometry();',
  'const geoFlamboyantTrunk = buildFlamboyantTrunkGeometry();',
  'const geoFlamboyantCrown = buildFlamboyantCrownGeometry();',
  'const geoShrub = buildShrubGeometry();',
  'const geoBougainvillea = buildBougainvilleaGeometry();',
  'const geoBoulder = buildBoulderGeometry();',
  ''
].join(EOL);

code = code.replace('export interface TreeInstanceData {', decls + 'export interface TreeInstanceData {');
fs.writeFileSync(vegPath, code, "utf8");
console.log("Restored geometry singletons in abujaVegetation.ts!");
