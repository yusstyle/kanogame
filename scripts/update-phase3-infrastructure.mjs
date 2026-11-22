import fs from "fs";

const infPath = "artifacts/kano-streets/src/game/abujaInfrastructure.ts";
let code = fs.readFileSync(infPath, "utf8");
const isCRLF = code.includes("\r\n");
const EOL = isCRLF ? "\r\n" : "\n";

// Add import of abujaPbrMaterials if not present
if (!code.includes("abujaPbrMaterials")) {
  code = 'import { abujaPbrMaterials } from "./abujaMaterials";' + EOL + code;
}

// 1. Smooth out verge canvas texture (replace 4000 random noise rectangles with smooth continuous gradients)
const vergeStart = code.indexOf("// 4. Natural Laterite Soil / Compacted Gravel Verge Transition");
const markingStart = code.indexOf("// 5. Thermoplastic Road Markings", vergeStart);

if (vergeStart !== -1 && markingStart !== -1) {
  const newVergeGen = [
    '// 4. Natural Laterite Soil / Compacted Gravel Verge Transition',
    '  // Smooth continuous gradient blending without sharp random point noise',
    '  const vergeCanvas = document.createElement("canvas");',
    '  vergeCanvas.width = vergeCanvas.height = 256;',
    '  const vergeCtx = vergeCanvas.getContext("2d")!;',
    '  vergeCtx.fillStyle = "#634330"; // Warm laterite base',
    '  vergeCtx.fillRect(0, 0, 256, 256);',
    '  let randVergeSeed = 613;',
    '  const randVerge = () => {',
    '    randVergeSeed = (randVergeSeed * 1664525 + 1013904223) >>> 0;',
    '    return randVergeSeed / 4294967296;',
    '  };',
    '  // Soft blended gravel washes',
    '  for (let i = 0; i < 45; i++) {',
    '    const cx = randVerge() * 256;',
    '    const cy = randVerge() * 256;',
    '    const rad = 8 + randVerge() * 24;',
    '    const grad = vergeCtx.createRadialGradient(cx, cy, 1, cx, cy, rad);',
    '    grad.addColorStop(0, randVerge() > 0.5 ? "rgba(142, 95, 68, 0.35)" : "rgba(75, 48, 32, 0.35)");',
    '    grad.addColorStop(1, "rgba(99, 67, 48, 0)");',
    '    vergeCtx.fillStyle = grad;',
    '    vergeCtx.beginPath();',
    '    vergeCtx.arc(cx, cy, rad, 0, Math.PI * 2);',
    '    vergeCtx.fill();',
    '  }',
    '  const vergeTex = new THREE.CanvasTexture(vergeCanvas);',
    '  vergeTex.colorSpace = THREE.SRGBColorSpace;',
    '  vergeTex.wrapS = vergeTex.wrapT = THREE.RepeatWrapping;',
    '  vergeTex.repeat.set(2, 24);',
    '  vergeTex.anisotropy = 4;',
    '  vergeTex.generateMipmaps = true;',
    '',
    '  cachedVergeMat = new THREE.MeshStandardMaterial({',
    '    map: vergeTex,',
    '    roughness: 0.95,',
    '    metalness: 0.02,',
    '  });',
    '  '
  ].join(EOL);

  code = code.slice(0, vergeStart) + newVergeGen + code.slice(markingStart);
  console.log("Updated verge texture in abujaInfrastructure.ts!");
}

// 2. Add roundabout inner landscaped park meshes
const roundInnerCurbMarker = "curbGeometries.push(roundInnerCurb);";
const roundInnerIdx = code.indexOf(roundInnerCurbMarker);

if (roundInnerIdx !== -1) {
  const insertPos = roundInnerIdx + roundInnerCurbMarker.length;
  const roundaboutParkCode = [
    '',
    '  // Central Roundabout Inner Landscaped Park Island (r: 8.5 to 20)',
    '  // Eliminates bare terrain inside the roundabout and creates a manicured civic monument garden',
    '  const rbLawnGeo = new THREE.RingGeometry(8.5, 18.2, 48);',
    '  rbLawnGeo.applyMatrix4(rotMinusX);',
    '  rbLawnGeo.translate(0, 0.178, 0);',
    '  const rbLawnMesh = new THREE.Mesh(rbLawnGeo, abujaPbrMaterials.estateLawn);',
    '  rbLawnMesh.name = "AbujaRoundaboutInnerLawn";',
    '  rbLawnMesh.receiveShadow = true;',
    '  rbLawnMesh.userData.noMerge = true;',
    '  group.add(rbLawnMesh);',
    '',
    '  // Outer walking perimeter ring inside the curb (r: 18.2 to 20.0)',
    '  const rbWalkGeo = new THREE.RingGeometry(18.2, 20.0, 48);',
    '  rbWalkGeo.applyMatrix4(rotMinusX);',
    '  rbWalkGeo.translate(0, 0.185, 0);',
    '  sidewalkGeometries.push(rbWalkGeo);',
    '',
    '  // Concentric ornamental botanical flower bed ring (r: 12.2 to 14.8)',
    '  const rbFlowerGeo = new THREE.RingGeometry(12.2, 14.8, 48);',
    '  rbFlowerGeo.applyMatrix4(rotMinusX);',
    '  rbFlowerGeo.translate(0, 0.21, 0);',
    '  const rbFlowerMesh = new THREE.Mesh(rbFlowerGeo, abujaPbrMaterials.botanicalFlowerBed);',
    '  rbFlowerMesh.name = "AbujaRoundaboutFlowerBed";',
    '  rbFlowerMesh.receiveShadow = true;',
    '  rbFlowerMesh.userData.noMerge = true;',
    '  group.add(rbFlowerMesh);',
    '',
    '  // Raised precast curb edging along flower bed ring',
    '  const rbFlowerCurbIn = new THREE.RingGeometry(11.95, 12.2, 48);',
    '  rbFlowerCurbIn.applyMatrix4(rotMinusX);',
    '  rbFlowerCurbIn.translate(0, 0.22, 0);',
    '  curbGeometries.push(rbFlowerCurbIn);',
    '  const rbFlowerCurbOut = new THREE.RingGeometry(14.8, 15.05, 48);',
    '  rbFlowerCurbOut.applyMatrix4(rotMinusX);',
    '  rbFlowerCurbOut.translate(0, 0.22, 0);',
    '  curbGeometries.push(rbFlowerCurbOut);'
  ].join(EOL);

  code = code.slice(0, insertPos) + roundaboutParkCode + code.slice(insertPos);
  console.log("Added roundabout landscaped park island to abujaInfrastructure.ts!");
}

fs.writeFileSync(infPath, code, "utf8");
console.log("Successfully wrote abujaInfrastructure.ts!");
