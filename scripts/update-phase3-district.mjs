import fs from "fs";

const distPath = "artifacts/kano-streets/src/game/abujaDistrict.ts";
let code = fs.readFileSync(distPath, "utf8");
const isCRLF = code.includes("\r\n");
const EOL = isCRLF ? "\r\n" : "\n";

// Add import of vegetationMaterials if needed
if (!code.includes("vegetationMaterials")) {
  code = 'import { vegetationMaterials } from "./abujaVegetation";' + EOL + code;
}

// 1. Streetlight lamp material & light pool creation
const streetlightStart = code.indexOf("// 16. MODERN DUAL-LANTERN SOLAR STREETLIGHT");
if (streetlightStart !== -1) {
  const newStreetlightSection = [
    '// 16. MODERN DUAL-LANTERN SOLAR STREETLIGHT (WITH PHOTOREALISTIC ILLUMINATION POOLS)',
    '// -------------------------------------------------------------',
    'let cachedLightPoolMat: THREE.MeshBasicMaterial | null = null;',
    'function getStreetlightPoolMaterial(): THREE.MeshBasicMaterial {',
    '  if (cachedLightPoolMat) return cachedLightPoolMat;',
    '  if (typeof document === "undefined") return new THREE.MeshBasicMaterial();',
    '  const canvas = document.createElement("canvas");',
    '  canvas.width = canvas.height = 128;',
    '  const ctx = canvas.getContext("2d")!;',
    '  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);',
    '  grad.addColorStop(0.0, "rgba(255, 215, 145, 0.48)");',
    '  grad.addColorStop(0.35, "rgba(255, 195, 120, 0.28)");',
    '  grad.addColorStop(0.7, "rgba(255, 175, 90, 0.08)");',
    '  grad.addColorStop(1.0, "rgba(255, 160, 60, 0.0)");',
    '  ctx.fillStyle = grad;',
    '  ctx.fillRect(0, 0, 128, 128);',
    '  const tex = new THREE.CanvasTexture(canvas);',
    '  cachedLightPoolMat = new THREE.MeshBasicMaterial({',
    '    map: tex,',
    '    transparent: true,',
    '    blending: THREE.AdditiveBlending,',
    '    depthWrite: false,',
    '  });',
    '  return cachedLightPoolMat;',
    '}',
    '',
    'const warmLanternMat = new THREE.MeshStandardMaterial({',
    '  color: "#fff4d0",',
    '  emissive: "#ffb84d",',
    '  emissiveIntensity: 2.2,',
    '  roughness: 0.2,',
    '});',
    '',
    'export function createModernSolarStreetlight(materials: GameMaterials): THREE.Group {',
    '  const pole = new THREE.Group();',
    '  pole.name = "ModernSolarStreetlight";',
    '  const poleMesh = new THREE.Mesh(sharedStreetlightPoleGeo, sharedMaterials.poleMat);',
    '  poleMesh.castShadow = true;',
    '  poleMesh.receiveShadow = true;',
    '  const lampMesh = new THREE.Mesh(sharedStreetlightLampGeo, warmLanternMat);',
    '  lampMesh.castShadow = false;',
    '  lampMesh.receiveShadow = false;',
    '  pole.add(poleMesh);',
    '  pole.add(lampMesh);',
    '  return pole;',
    '}',
    '',
    'export function createModernSolarStreetlightInstances(',
    '  positions: { x: number; y?: number; z: number; rotationY?: number }[],',
    '  materials: GameMaterials,',
    '): THREE.Group {',
    '  const group = new THREE.Group();',
    '  group.name = "ModernSolarStreetlightInstances";',
    '  const count = positions.length;',
    '  if (count === 0) return group;',
    '',
    '  const poleMesh = new THREE.InstancedMesh(sharedStreetlightPoleGeo, sharedMaterials.poleMat, count);',
    '  const lampMesh = new THREE.InstancedMesh(sharedStreetlightLampGeo, warmLanternMat, count);',
    '  poleMesh.castShadow = true;',
    '  poleMesh.receiveShadow = true;',
    '  lampMesh.castShadow = false;',
    '  lampMesh.receiveShadow = false;',
    '  poleMesh.name = "StreetlightPoleInstances";',
    '  lampMesh.name = "StreetlightLampInstances";',
    '',
    '  // Warm ground illumination pools beneath each streetlight',
    '  const poolGeo = new THREE.PlaneGeometry(12.5, 12.5);',
    '  poolGeo.rotateX(-Math.PI / 2);',
    '  const poolMesh = new THREE.InstancedMesh(poolGeo, getStreetlightPoolMaterial(), count);',
    '  poolMesh.name = "StreetlightGroundLightPools";',
    '',
    '  const dummy = new THREE.Object3D();',
    '  const poolDummy = new THREE.Object3D();',
    '  for (let i = 0; i < count; i++) {',
    '    const p = positions[i];',
    '    dummy.position.set(p.x, p.y || 0, p.z);',
    '    dummy.rotation.y = p.rotationY || 0;',
    '    dummy.updateMatrix();',
    '    poleMesh.setMatrixAt(i, dummy.matrix);',
    '    lampMesh.setMatrixAt(i, dummy.matrix);',
    '',
    '    poolDummy.position.set(p.x, (p.y || 0) + 0.025, p.z);',
    '    poolDummy.updateMatrix();',
    '    poolMesh.setMatrixAt(i, poolDummy.matrix);',
    '  }',
    '  poleMesh.instanceMatrix.needsUpdate = true;',
    '  lampMesh.instanceMatrix.needsUpdate = true;',
    '  poolMesh.instanceMatrix.needsUpdate = true;',
    '',
    '  group.add(poleMesh);',
    '  group.add(lampMesh);',
    '  group.add(poolMesh);',
    '  return group;',
    '}'
  ].join(EOL);

  code = code.slice(0, streetlightStart) + newStreetlightSection;
  console.log("Updated streetlight illumination in abujaDistrict.ts!");
}

fs.writeFileSync(distPath, code, "utf8");
console.log("Successfully wrote abujaDistrict.ts!");
