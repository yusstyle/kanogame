import fs from "fs";
import path from "path";

const srcGame = path.resolve("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game");

// 1. UPDATE abujaInfrastructure.ts
{
  const filePath = path.join(srcGame, "abujaInfrastructure.ts");
  let code = fs.readFileSync(filePath, "utf8");

  // Asphalt
  code = code.replace(/aspCtx\.fillStyle = "#222528";/, 'aspCtx.fillStyle = "#1a1c1e";');
  code = code.replace(/roughness: 0\.82,\s*metalness: 0\.06,/, 'roughness: 0.90,\n    metalness: 0.02,');

  // Sidewalk
  code = code.replace(/sideCtx\.fillStyle = "#c2c6cb";/, 'sideCtx.fillStyle = "#74787d";');
  code = code.replace(
    /const shade = 185 \+ Math\.floor\(randTile\(\) \* 25\);/,
    'const shade = 118 + Math.floor(randTile() * 18);'
  );
  code = code.replace(
    /sideCtx\.fillStyle = `rgb\(\${shade}, \${shade \+ 2}, \${shade \+ 4}\)`;/,
    'sideCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 3})`;'
  );
  code = code.replace(/sideCtx\.strokeStyle = "#72777d";/, 'sideCtx.strokeStyle = "#383c40";');
  code = code.replace(
    /cachedSidewalkMat = new THREE\.MeshStandardMaterial\(\{[\s\S]*?roughness: 0\.72,\s*metalness: 0\.05,/,
    'cachedSidewalkMat = new THREE.MeshStandardMaterial({\n    map: sidewalkTex,\n    roughness: 0.88,\n    metalness: 0.02,'
  );

  // Curb
  code = code.replace(/curbCtx\.fillStyle = "#dce0e3";/, 'curbCtx.fillStyle = "#8a8f94";');
  code = code.replace(/curbCtx\.strokeStyle = "#9da2a6";/, 'curbCtx.strokeStyle = "#4a4e52";');
  code = code.replace(
    /cachedCurbMat = new THREE\.MeshStandardMaterial\(\{[\s\S]*?roughness: 0\.58,\s*metalness: 0\.08,/,
    'cachedCurbMat = new THREE.MeshStandardMaterial({\n    map: curbTex,\n    roughness: 0.85,\n    metalness: 0.02,'
  );

  // Median green material
  code = code.replace(/color: "#285834",/, 'color: "#3b5438",');
  code = code.replace(/roughness: 0\.88,\s*\}\);(\s*\/\/ North Median)/, 'roughness: 0.92,\n  });$1');

  fs.writeFileSync(filePath, code, "utf8");
  console.log("abujaInfrastructure.ts updated!");
}

// 2. UPDATE abujaMaterials.ts
{
  const filePath = path.join(srcGame, "abujaMaterials.ts");
  let code = fs.readFileSync(filePath, "utf8");

  // Add createArchitecturalStuccoTexture before abujaPbrMaterials
  const stuccoFn = `
/**
 * Procedural Warm Cream Architectural Stucco & Honed Limestone
 */
export function createArchitecturalStuccoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ded9cf";
  ctx.fillRect(0, 0, 256, 256);

  // Natural mineral grain & fine aggregate
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const tone = Math.random();
    ctx.fillStyle = tone > 0.5 ? "rgba(255, 255, 255, 0.14)" : "rgba(80, 70, 60, 0.08)";
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  // Soft architectural masonry course lines
  ctx.strokeStyle = "rgba(100, 90, 80, 0.08)";
  ctx.lineWidth = 1;
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
`;

  if (!code.includes("createArchitecturalStuccoTexture")) {
    code = code.replace(/export const abujaPbrMaterials = \{/, `${stuccoFn}\nexport const abujaPbrMaterials = {`);
  }

  // Update stuccoWhite and marbleCream
  code = code.replace(
    /stuccoWhite: new THREE\.MeshStandardMaterial\(\{[\s\S]*?color: "#fafbfc",[\s\S]*?roughness: 0\.45,[\s\S]*?metalness: 0\.02,[\s\S]*?\}\),/,
    `stuccoWhite: new THREE.MeshStandardMaterial({
    map: createArchitecturalStuccoTexture(),
    roughness: 0.85,
    metalness: 0.02,
  }),`
  );

  code = code.replace(
    /marbleCream: new THREE\.MeshStandardMaterial\(\{[\s\S]*?color: "#f4f1ea",[\s\S]*?roughness: 0\.35,[\s\S]*?metalness: 0\.05,[\s\S]*?\}\),/,
    `marbleCream: new THREE.MeshStandardMaterial({
    color: "#dad5cb",
    roughness: 0.75,
    metalness: 0.02,
  }),`
  );

  fs.writeFileSync(filePath, code, "utf8");
  console.log("abujaMaterials.ts updated!");
}

// 3. UPDATE abujaDistrict.ts
{
  const filePath = path.join(srcGame, "abujaDistrict.ts");
  let code = fs.readFileSync(filePath, "utf8");

  // Update sharedMaterials.whiteMarble
  code = code.replace(
    /whiteMarble: new THREE\.MeshStandardMaterial\(\{[\s\S]*?color: "#f5f6f8",[\s\S]*?roughness: 0\.25,[\s\S]*?\}\),/,
    `whiteMarble: new THREE.MeshStandardMaterial({
    color: "#ded9cf",
    roughness: 0.78,
    metalness: 0.02,
  }),`
  );

  // Update sharedMaterials.goldDome
  code = code.replace(
    /goldDome: new THREE\.MeshStandardMaterial\(\{[\s\S]*?color: "#e5b73b",[\s\S]*?roughness: 0\.15,[\s\S]*?metalness: 0\.85,[\s\S]*?\}\),/,
    `goldDome: new THREE.MeshStandardMaterial({
    color: "#e5b73b",
    roughness: 0.28,
    metalness: 0.85,
  }),`
  );

  // Replace createAbujaNationalMosque with full architectural articulation
  const mosqueRegex = /export function createAbujaNationalMosque\([\s\S]*?return root;\s*\}/;
  const newMosque = `export function createAbujaNationalMosque(
  materials: GameMaterials,
  colliders: Collider[],
  x: number,
  z: number,
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = "AbujaNationalMosque";

  // 1. Terraced Stone Podium
  addBox(root, materials.stone, 0, 0.5, 0, 48, 1.0, 48);
  addBox(root, sharedMaterials.whiteMarble, 0, 1.2, 0, 42, 0.4, 42);
  colliders.push({ x, z, halfX: 21, halfZ: 21, height: 2 });

  // 2. Main Prayer Hall Structure (Tiered architectural massing)
  addBox(root, sharedMaterials.whiteMarble, 0, 7.5, 0, 36, 12, 36);
  colliders.push({ x, z, halfX: 18, halfZ: 18, height: 16 });

  // Decorative roofline cornice and parapet
  addBox(root, sharedMaterials.whiteMarble, 0, 13.8, 0, 37.6, 0.6, 37.6);
  addBox(root, sharedMaterials.goldAccents, 0, 14.2, 0, 36.8, 0.2, 36.8);

  // Arched Islamic Window Panels on all 4 facades
  for (const side of [-1, 1]) {
    // North & South Facades
    for (let wx = -12; wx <= 12; wx += 6) {
      addBox(root, sharedMaterials.glassBlue, wx, 7.5, side * 18.15, 2.2, 6.5, 0.2);
      addBox(root, sharedMaterials.goldAccents, wx, 11.0, side * 18.2, 2.4, 0.3, 0.2);
    }
    // East & West Facades
    for (let wz = -12; wz <= 12; wz += 6) {
      addBox(root, sharedMaterials.glassBlue, side * 18.15, 7.5, wz, 0.2, 6.5, 2.2);
      addBox(root, sharedMaterials.goldAccents, side * 18.2, 11.0, wz, 0.2, 0.3, 2.4);
    }
  }

  // Grand Arched Entrance Portico (Facing West toward Boulevard)
  addBox(root, sharedMaterials.whiteMarble, -19.5, 6, 0, 3.0, 9, 14);
  addBox(root, sharedMaterials.goldAccents, -21.1, 4.5, 0, 0.2, 6, 5); // Main portal arch

  // 3. Central Dome Drum with Arched Clerestory Windows
  addCylinder(root, sharedMaterials.whiteMarble, 0, 15.2, 0, 9.2, 9.4, 2.4);
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6;
    addBox(root, sharedMaterials.glassBlue, Math.sin(ang) * 9.3, 15.2, Math.cos(ang) * 9.3, 1.4, 1.6, 0.3);
  }

  // Monumental Golden Central Dome
  const dome = addSphere(root, sharedMaterials.goldDome, 0, 18.5, 0, 9.5);
  dome.scale.set(9.5, 8.5, 9.5);
  // Gold Spire & Crescent Finial
  addCylinder(root, sharedMaterials.goldDome, 0, 27.5, 0, 0.15, 0.5, 5);
  addSphere(root, sharedMaterials.goldDome, 0, 30.2, 0, 0.45);

  // 4. Four Slender Pencil Minarets with Classical Islamic Balconies & Spires
  const corners = [
    [-17.5, -17.5],
    [17.5, -17.5],
    [-17.5, 17.5],
    [17.5, 17.5],
  ];

  corners.forEach(([mx, mz]) => {
    // Plinth base
    addBox(root, materials.stone, mx, 1.5, mz, 3.2, 3.0, 3.2);
    addBox(root, sharedMaterials.whiteMarble, mx, 3.3, mz, 2.6, 0.6, 2.6);

    // Lower octagonal minaret shaft
    addCylinder(root, sharedMaterials.whiteMarble, mx, 11.5, mz, 1.3, 1.5, 16, 8);

    // First Balcony (Sherfeh) with corbelled base & gold balustrade
    addCylinder(root, sharedMaterials.whiteMarble, mx, 19.8, mz, 2.1, 1.4, 0.8, 8);
    addCylinder(root, sharedMaterials.goldAccents, mx, 20.4, mz, 2.1, 2.1, 0.6, 8);

    // Upper minaret shaft
    addCylinder(root, sharedMaterials.whiteMarble, mx, 24.5, mz, 1.05, 1.25, 8, 8);

    // Upper lantern gallery & second balcony
    addCylinder(root, sharedMaterials.whiteMarble, mx, 28.8, mz, 1.6, 1.1, 0.6, 8);
    addCylinder(root, sharedMaterials.goldAccents, mx, 29.3, mz, 1.6, 1.6, 0.5, 8);

    // Conical Golden Spire & Crescent Finial
    addCylinder(root, sharedMaterials.goldDome, mx, 32.5, mz, 0.05, 1.1, 6, 8);
    addSphere(root, sharedMaterials.goldDome, mx, 35.6, mz, 0.25);

    colliders.push({ x: x + mx, z: z + mz, halfX: 1.6, halfZ: 1.6, height: 36 });
  });

  return root;
}`;

  code = code.replace(mosqueRegex, newMosque);

  fs.writeFileSync(filePath, code, "utf8");
  console.log("abujaDistrict.ts updated!");
}

