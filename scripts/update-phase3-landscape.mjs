import fs from "fs";

// 1. UPDATE abujaLandscape.ts
const lsPath = "artifacts/kano-streets/src/game/abujaLandscape.ts";
let lsCode = fs.readFileSync(lsPath, "utf8");
const isLsCRLF = lsCode.includes("\r\n");
const lsEOL = isLsCRLF ? "\r\n" : "\n";

// Add import of abujaPbrMaterials to abujaLandscape.ts if not present
if (!lsCode.includes("abujaPbrMaterials")) {
  lsCode = 'import { abujaPbrMaterials } from "./abujaMaterials";' + lsEOL + lsCode;
}

// Find buildRollingSavannahTerrain canvas texture generation
const oldTerrainGen = [
  '  // Savannah PBR Grass Texture with Laterite Earth Soil Bleed',
  '  const canvas = document.createElement("canvas");',
  '  canvas.width = canvas.height = 512;',
  '  const ctx = canvas.getContext("2d")!;',
  '',
  '  // Base lush savannah green',
  '  ctx.fillStyle = "#385e3f";',
  '  ctx.fillRect(0, 0, 512, 512);',
  '',
  '  // Laterite reddish earth streaks & mineral speckles',
  '  let seed = 49201;',
  '  const rnd = () => {',
  '    seed = (seed * 1664525 + 1013904223) >>> 0;',
  '    return seed / 4294967296;',
  '  };',
  '',
  '  // Organic grass clump mottling',
  '  for (let i = 0; i < 18000; i++) {',
  '    const rx = rnd() * 512;',
  '    const ry = rnd() * 512;',
  '    const rVal = rnd();',
  '    if (rVal < 0.35) {',
  '      ctx.fillStyle = "#2a4b32"; // Deep green shadow',
  '    } else if (rVal < 0.70) {',
  '      ctx.fillStyle = "#466f4d"; // Sunlit blade',
  '    } else if (rVal < 0.88) {',
  '      ctx.fillStyle = "#5c7948"; // Golden savannah dry blade',
  '    } else {',
  '      ctx.fillStyle = "#6d4734"; // Subsurface laterite soil fleck',
  '    }',
  '    ctx.fillRect(rx, ry, 1.8, 1.8);',
  '  }',
  '',
  '  // Broad laterite soil mottles',
  '  for (let i = 0; i < 40; i++) {',
  '    const cx = rnd() * 512;',
  '    const cy = rnd() * 512;',
  '    const rad = 15 + rnd() * 35;',
  '    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);',
  '    grad.addColorStop(0, "rgba(109, 71, 52, 0.18)");',
  '    grad.addColorStop(1, "rgba(56, 94, 63, 0)");',
  '    ctx.fillStyle = grad;',
  '    ctx.beginPath;',
  '    ctx.arc(cx, cy, rad, 0, Math.PI * 2);',
  '    ctx.fill();',
  '  }',
  '',
  '  const texture = new THREE.CanvasTexture(canvas);',
  '  texture.colorSpace = THREE.SRGBColorSpace;',
  '  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;',
  '  texture.repeat.set(64, 64);'
].join(lsEOL);

// In case whitespace differs, let's find the boundaries of texture creation
const terrainGenStart = lsCode.indexOf("// Savannah PBR Grass Texture with Laterite Earth Soil Bleed");
const terrainGenEnd = lsCode.indexOf("const mat = new THREE.MeshStandardMaterial({", terrainGenStart);

if (terrainGenStart !== -1 && terrainGenEnd !== -1) {
  const newTerrainGen = [
    '  // Savannah PBR Grass Texture with Laterite Earth Soil Bleed',
    '  // Photorealistic continuous gradients without discrete single-pixel flecks',
    '  const canvas = document.createElement("canvas");',
    '  canvas.width = canvas.height = 512;',
    '  const ctx = canvas.getContext("2d")!;',
    '',
    '  // Deep lush Nigerian savannah base',
    '  ctx.fillStyle = "#335436";',
    '  ctx.fillRect(0, 0, 512, 512);',
    '',
    '  let seed = 49201;',
    '  const rnd = () => {',
    '    seed = (seed * 1664525 + 1013904223) >>> 0;',
    '    return seed / 4294967296;',
    '  };',
    '',
    '  // Multi-tier continuous turf tone washes (broad organic radial gradients)',
    '  for (let i = 0; i < 90; i++) {',
    '    const cx = rnd() * 512;',
    '    const cy = rnd() * 512;',
    '    const rad = 20 + rnd() * 60;',
    '    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);',
    '    const rVal = rnd();',
    '    if (rVal < 0.4) {',
    '      grad.addColorStop(0, "rgba(35, 68, 38, 0.45)"); // Deep emerald shadow',
    '    } else if (rVal < 0.75) {',
    '      grad.addColorStop(0, "rgba(75, 115, 68, 0.40)"); // Sunlit savannah blade tone',
    '    } else {',
    '      grad.addColorStop(0, "rgba(95, 118, 62, 0.35)"); // Golden dry savannah blade',
    '    }',
    '    grad.addColorStop(1, "rgba(51, 84, 54, 0)");',
    '    ctx.fillStyle = grad;',
    '    ctx.beginPath();',
    '    ctx.arc(cx, cy, rad, 0, Math.PI * 2);',
    '    ctx.fill();',
    '  }',
    '',
    '  // Organic laterite reddish soil bleeds and gentle earth streaks',
    '  for (let i = 0; i < 35; i++) {',
    '    const cx = rnd() * 512;',
    '    const cy = rnd() * 512;',
    '    const rad = 15 + rnd() * 45;',
    '    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);',
    '    grad.addColorStop(0, "rgba(115, 75, 52, 0.28)");',
    '    grad.addColorStop(0.7, "rgba(95, 65, 45, 0.12)");',
    '    grad.addColorStop(1, "rgba(51, 84, 54, 0)");',
    '    ctx.fillStyle = grad;',
    '    ctx.beginPath();',
    '    ctx.arc(cx, cy, rad, 0, Math.PI * 2);',
    '    ctx.fill();',
    '  }',
    '',
    '  // Soft fine blade directionality (drawn as smooth linear brush strokes)',
    '  ctx.strokeStyle = "rgba(40, 80, 42, 0.08)";',
    '  ctx.lineWidth = 1.2;',
    '  for (let i = 0; i < 300; i++) {',
    '    const sx = rnd() * 512;',
    '    const sy = rnd() * 512;',
    '    ctx.beginPath();',
    '    ctx.moveTo(sx, sy);',
    '    ctx.lineTo(sx + 6 + rnd() * 12, sy + (rnd() - 0.5) * 4);',
    '    ctx.stroke();',
    '  }',
    '',
    '  const texture = new THREE.CanvasTexture(canvas);',
    '  texture.colorSpace = THREE.SRGBColorSpace;',
    '  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;',
    '  texture.repeat.set(36, 36);',
    '  texture.anisotropy = 4;',
    '  texture.generateMipmaps = true;',
    '  texture.minFilter = THREE.LinearMipmapLinearFilter;',
    '  '
  ].join(lsEOL);

  lsCode = lsCode.slice(0, terrainGenStart) + newTerrainGen + lsCode.slice(terrainGenEnd);
  console.log("Updated buildRollingSavannahTerrain texture!");
}

// Update MillenniumPark flower beds and lawn
// Replace flowerBedCanvas with abujaPbrMaterials.botanicalFlowerBed and sharedMaterials.lawn with abujaPbrMaterials.estateLawn
lsCode = lsCode.replace("sharedMaterials.lawn", "abujaPbrMaterials.estateLawn");

// Flower beds replacement
const parkFlowerStart = lsCode.indexOf("// 4. Botanical Flower Beds");
const parkPergolaStart = lsCode.indexOf("// 5. Wooden Pergolas", parkFlowerStart);

if (parkFlowerStart !== -1 && parkPergolaStart !== -1) {
  const newFlowerBeds = [
    '// 4. Botanical Flower Beds (Authentic Nigerian Tropical Displays)',
    '  const bedGeos: THREE.BufferGeometry[] = [];',
    '  const curbGeos: THREE.BufferGeometry[] = [];',
    '  const bedOffsets = [',
    '    { x: -18, z: -18 },',
    '    { x: 18, z: -18 },',
    '    { x: -18, z: 18 },',
    '    { x: 18, z: 18 },',
    '    { x: -28, z: 0 },',
    '    { x: 28, z: 0 },',
    '  ];',
    '  bedOffsets.forEach((b) => {',
    '    // Raised loamy soil bed with botanical flowers',
    '    const bed = new THREE.BoxGeometry(7.6, 0.28, 4.6);',
    '    bed.translate(b.x, 0.20, b.z);',
    '    bedGeos.push(bed);',
    '',
    '    // Precast concrete border retaining curb frame',
    '    const curbN = new THREE.BoxGeometry(8.2, 0.22, 0.35);',
    '    curbN.translate(b.x, 0.21, b.z - 2.45);',
    '    const curbS = new THREE.BoxGeometry(8.2, 0.22, 0.35);',
    '    curbS.translate(b.x, 0.21, b.z + 2.45);',
    '    const curbW = new THREE.BoxGeometry(0.35, 0.22, 5.25);',
    '    curbW.translate(b.x - 3.95, 0.21, b.z);',
    '    const curbE = new THREE.BoxGeometry(0.35, 0.22, 5.25);',
    '    curbE.translate(b.x + 3.95, 0.21, b.z);',
    '    curbGeos.push(curbN, curbS, curbW, curbE);',
    '  });',
    '',
    '  const mergedBeds = safeMergeGeometries(bedGeos);',
    '  for (const g of bedGeos) g.dispose();',
    '  const bedsMesh = new THREE.Mesh(mergedBeds, abujaPbrMaterials.botanicalFlowerBed);',
    '  bedsMesh.name = "MillenniumParkFlowerBeds";',
    '  bedsMesh.receiveShadow = true;',
    '  bedsMesh.userData.noMerge = true;',
    '  root.add(bedsMesh);',
    '',
    '  const mergedCurbs = safeMergeGeometries(curbGeos);',
    '  for (const g of curbGeos) g.dispose();',
    '  const flowerCurbMesh = new THREE.Mesh(mergedCurbs, materials.curb);',
    '  flowerCurbMesh.name = "MillenniumParkFlowerCurbs";',
    '  flowerCurbMesh.receiveShadow = true;',
    '  flowerCurbMesh.userData.noMerge = true;',
    '  root.add(flowerCurbMesh);',
    '  '
  ].join(lsEOL);

  lsCode = lsCode.slice(0, parkFlowerStart) + newFlowerBeds + lsCode.slice(parkPergolaStart);
  console.log("Updated MillenniumPark flower beds!");
}

fs.writeFileSync(lsPath, lsCode, "utf8");
console.log("Successfully wrote abujaLandscape.ts!");
