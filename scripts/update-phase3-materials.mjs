import fs from "fs";

const filePath = "artifacts/kano-streets/src/game/abujaMaterials.ts";
let code = fs.readFileSync(filePath, "utf8");
const isCRLF = code.includes("\r\n");
const EOL = isCRLF ? "\r\n" : "\n";

// Helper generator functions to insert into abujaMaterials.ts
const newGenerators = `
/**
 * 10. Authentic Nigerian Sandcrete Block & Textured Wall Plaster
 * Sandcrete (cement + sharp sand mix) is the ubiquitous Nigerian architectural material
 */
export function createSandcreteTexture(): THREE.CanvasTexture {
  if (typeof document === "undefined") return new THREE.CanvasTexture(null as any);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Warm sandy cream-beige base
  ctx.fillStyle = "#e5ddcf";
  ctx.fillRect(0, 0, 512, 512);

  // Multi-octave fine cementitious sand aggregate
  let seed = 91823;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 9000; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const sz = 0.8 + rnd() * 2.2;
    const val = rnd();
    ctx.fillStyle = val > 0.6
      ? "rgba(255, 255, 255, 0.18)"
      : val > 0.25
        ? "rgba(110, 95, 80, 0.12)"
        : "rgba(180, 130, 90, 0.10)";
    ctx.fillRect(x, y, sz, sz);
  }

  // Subtle sandcrete block masonry courses (every 64px vertical)
  ctx.strokeStyle = "rgba(120, 105, 90, 0.14)";
  ctx.lineWidth = 1.5;
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    // Staggered vertical mortar joints
    const shift = (y / 64) % 2 === 0 ? 0 : 64;
    for (let x = shift; x <= 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 64);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 4;
  return tex;
}

/**
 * 11. Nigerian Interlocking Concrete Paver Texture (Herringbone / Basketweave)
 * High-durability precast concrete pavers common in Abuja driveways and plazas
 */
export function createInterlockingPaverTexture(): THREE.CanvasTexture {
  if (typeof document === "undefined") return new THREE.CanvasTexture(null as any);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#6b7278"; // Base grout joint tone
  ctx.fillRect(0, 0, 512, 512);

  const tileW = 64;
  const tileH = 32;
  let seed = 44219;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let y = 0; y < 512; y += tileH) {
    const xOff = ((y / tileH) % 2) * (tileW / 2);
    for (let x = -tileW; x < 512 + tileW; x += tileW) {
      const shade = 145 + Math.floor(rnd() * 25);
      ctx.fillStyle = \`rgb(\${shade}, \${shade + 2}, \${shade + 4})\`;
      ctx.fillRect(x + xOff + 2, y + 2, tileW - 4, tileH - 4);

      // Fine granite aggregate flecks
      ctx.fillStyle = "rgba(40, 45, 50, 0.12)";
      for (let s = 0; s < 12; s++) {
        ctx.fillRect(
          x + xOff + 4 + rnd() * (tileW - 8),
          y + 4 + rnd() * (tileH - 8),
          1.5,
          1.5
        );
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 4;
  return tex;
}

/**
 * 12. Polished Royal Cream Marble / Travertine Facade Texture
 */
export function createPolishedMarbleTexture(): THREE.CanvasTexture {
  if (typeof document === "undefined") return new THREE.CanvasTexture(null as any);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ece7dd";
  ctx.fillRect(0, 0, 512, 512);

  // Soft organic marble veins
  const veins = [
    { startX: 40, startY: 0, endX: 380, endY: 512, color: "rgba(165, 150, 135, 0.22)", width: 4 },
    { startX: 180, startY: 0, endX: 490, endY: 512, color: "rgba(180, 165, 145, 0.18)", width: 2.5 },
    { startX: 0, startY: 120, endX: 280, endY: 512, color: "rgba(150, 138, 122, 0.16)", width: 3 },
    { startX: 320, startY: 0, endX: 120, endY: 512, color: "rgba(175, 160, 140, 0.15)", width: 2 },
  ];

  veins.forEach((v) => {
    ctx.strokeStyle = v.color;
    ctx.lineWidth = v.width;
    ctx.beginPath();
    ctx.moveTo(v.startX, v.startY);
    ctx.bezierCurveTo(
      v.startX + 80,
      v.startY + 180,
      v.endX - 90,
      v.endY - 180,
      v.endX,
      v.endY
    );
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  return tex;
}

/**
 * 13. Heavy Black Sliding Compound Security Gate Texture
 * Authentic Nigerian residential/commercial security sliding gates
 */
export function createOrnamentalGateTexture(): THREE.CanvasTexture {
  if (typeof document === "undefined") return new THREE.CanvasTexture(null as any);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Deep matte dark anthracite background
  ctx.fillStyle = "#181a1c";
  ctx.fillRect(0, 0, 512, 512);

  // Solid steel lower kick-plate (bottom 140px)
  ctx.fillStyle = "#1e2124";
  ctx.fillRect(8, 372, 496, 132);
  ctx.strokeStyle = "#32373c";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 374, 492, 128);

  // Vertical security square-tube pickets (every 28px)
  for (let x = 20; x < 500; x += 28) {
    ctx.fillStyle = "#25292d";
    ctx.fillRect(x, 24, 12, 348);

    // Subtle edge highlight
    ctx.fillStyle = "#3d4248";
    ctx.fillRect(x + 1, 24, 2, 348);
  }

  // Horizontal structural cross-rails
  const rails = [30, 140, 250, 360];
  rails.forEach((ry) => {
    ctx.fillStyle = "#1c1f22";
    ctx.fillRect(8, ry, 496, 18);
    ctx.strokeStyle = "#383e44";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, ry, 496, 18);
  });

  // Top spear/fleur-de-lis security finials
  for (let x = 20; x < 500; x += 28) {
    ctx.fillStyle = "#c59a35"; // Gold-brass tipped security spear
    ctx.beginPath();
    ctx.moveTo(x + 6, 8);
    ctx.lineTo(x + 12, 24);
    ctx.lineTo(x, 24);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.anisotropy = 4;
  return tex;
}

/**
 * 14. Manicured Tropical Estate Lawn Texture
 * Continuous smooth turf with natural tone gradients, no discrete pixel speckles
 */
export function createManicuredLawnTexture(): THREE.CanvasTexture {
  if (typeof document === "undefined") return new THREE.CanvasTexture(null as any);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Rich lush tropical emerald green base
  ctx.fillStyle = "#2e5732";
  ctx.fillRect(0, 0, 512, 512);

  // Soft continuous turf tone motting (broad radial washes)
  let seed = 37191;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 60; i++) {
    const cx = rnd() * 512;
    const cy = rnd() * 512;
    const rad = 25 + rnd() * 65;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    const isBright = rnd() > 0.45;
    grad.addColorStop(0, isBright ? "rgba(66, 118, 68, 0.35)" : "rgba(32, 64, 35, 0.4)");
    grad.addColorStop(1, "rgba(46, 87, 50, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft mowing directional stripes (every 48px)
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  for (let y = 0; y < 512; y += 48) {
    ctx.fillRect(0, y, 512, 24);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = 4;
  return tex;
}

/**
 * 15. Botanical Garden Flower Bed Texture (Crimson & Amber Inflorescences)
 * Authentic tropical floral displays with rich dark loam and clustered blooms
 */
export function createBotanicalFlowerBedTexture(): THREE.CanvasTexture {
  if (typeof document === "undefined") return new THREE.CanvasTexture(null as any);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Rich organic dark compost/soil base
  ctx.fillStyle = "#221b16";
  ctx.fillRect(0, 0, 512, 512);

  let seed = 81726;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Dense understory foliage clumps
  for (let i = 0; i < 400; i++) {
    const lx = rnd() * 512;
    const ly = rnd() * 512;
    const lr = 8 + rnd() * 16;
    const grad = ctx.createRadialGradient(lx, ly, 1, lx, ly, lr);
    grad.addColorStop(0, rnd() > 0.5 ? "#245821" : "#1a4217");
    grad.addColorStop(1, "rgba(25, 45, 22, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clustered authentic tropical blooms (Crimson Bougainvillea + Golden Marigold)
  const bloomClusters = [
    { x: 120, y: 140, r: 50, color: "#9e1a48" },
    { x: 180, y: 160, r: 40, color: "#b52656" },
    { x: 340, y: 120, r: 55, color: "#d97706" },
    { x: 380, y: 180, r: 45, color: "#b45309" },
    { x: 150, y: 360, r: 60, color: "#d97706" },
    { x: 320, y: 380, r: 55, color: "#9e1a48" },
    { x: 260, y: 260, r: 45, color: "#c0265f" },
  ];

  bloomClusters.forEach((cl) => {
    for (let b = 0; b < 45; b++) {
      const ang = rnd() * Math.PI * 2;
      const dist = Math.pow(rnd(), 0.7) * cl.r;
      const bx = cl.x + Math.cos(ang) * dist;
      const by = cl.y + Math.sin(ang) * dist;
      const br = 2.5 + rnd() * 3.5;

      ctx.fillStyle = cl.color;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 4;
  return tex;
}
`;

// Insert the new generators before abujaPbrMaterials
const targetPos = code.indexOf("export const abujaPbrMaterials = {");
if (targetPos === -1) {
  console.error("Could not find abujaPbrMaterials export in abujaMaterials.ts!");
  process.exit(1);
}

code = code.slice(0, targetPos) + newGenerators + EOL + code.slice(targetPos);

// Now update the material definitions in abujaPbrMaterials
code = code.replace(
  '  sandcreteWarm: new THREE.MeshStandardMaterial({\\r?\\n    color: "#e8dfd1",\\r?\\n    roughness: 0.85,\\r?\\n    metalness: 0.02,\\r?\\n  }),',
  '  sandcreteWarm: new THREE.MeshStandardMaterial({\\r?\\n    map: createSandcreteTexture(),\\r?\\n    roughness: 0.85,\\r?\\n    metalness: 0.02,\\r?\\n  }),'
);

// We'll replace the full abujaPbrMaterials block cleanly
const oldPbrMatBlockStart = code.indexOf("export const abujaPbrMaterials = {");
const oldPbrMatBlockEnd = code.indexOf("};", oldPbrMatBlockStart) + 2;

const newPbrMatBlock = [
  'export const abujaPbrMaterials = {',
  '  corrugatedZincRoof: new THREE.MeshStandardMaterial({',
  '    map: createCorrugatedRoofTexture(),',
  '    roughness: 0.65,',
  '    metalness: 0.55,',
  '  }),',
  '  waterTankStorex: new THREE.MeshStandardMaterial({',
  '    map: createWaterTankTexture(),',
  '    roughness: 0.35,',
  '    metalness: 0.1,',
  '  }),',
  '  generatorEnclosure: new THREE.MeshStandardMaterial({',
  '    map: createGeneratorTexture(),',
  '    roughness: 0.4,',
  '    metalness: 0.3,',
  '  }),',
  '  sandcreteWarm: new THREE.MeshStandardMaterial({',
  '    map: createSandcreteTexture(),',
  '    roughness: 0.88,',
  '    metalness: 0.02,',
  '  }),',
  '  steelTowerGray: new THREE.MeshStandardMaterial({',
  '    color: "#47525d",',
  '    roughness: 0.45,',
  '    metalness: 0.75,',
  '  }),',
  '  razorWireSilver: new THREE.MeshStandardMaterial({',
  '    color: "#bdc3c7",',
  '    roughness: 0.25,',
  '    metalness: 0.9,',
  '  }),',
  '  signageAtlas: new THREE.MeshStandardMaterial({',
  '    map: createCommercialSignageAtlas(),',
  '    roughness: 0.35,',
  '    metalness: 0.2,',
  '  }),',
  '  glassCurtainBlue: new THREE.MeshStandardMaterial({',
  '    map: createGlassCurtainTexture("#1b4f72", "#17202a"),',
  '    roughness: 0.12,',
  '    metalness: 0.85,',
  '  }),',
  '  glassCurtainGreen: new THREE.MeshStandardMaterial({',
  '    map: createGlassCurtainTexture("#0e6251", "#145a32"),',
  '    roughness: 0.15,',
  '    metalness: 0.8,',
  '  }),',
  '  ledgerStoneMaitama: new THREE.MeshStandardMaterial({',
  '    map: createLedgerStoneTexture(),',
  '    roughness: 0.85,',
  '    metalness: 0.05,',
  '  }),',
  '  terracottaRoof: new THREE.MeshStandardMaterial({',
  '    map: createTerracottaTileTexture(),',
  '    roughness: 0.7,',
  '    metalness: 0.1,',
  '  }),',
  '  shopfrontDisplay: new THREE.MeshStandardMaterial({',
  '    map: createShopfrontDisplayTexture(),',
  '    roughness: 0.2,',
  '    metalness: 0.4,',
  '  }),',
  '  acCondenser: new THREE.MeshStandardMaterial({',
  '    map: createAcLouverTexture(),',
  '    roughness: 0.4,',
  '    metalness: 0.6,',
  '  }),',
  '  marbleCream: new THREE.MeshStandardMaterial({',
  '    map: createPolishedMarbleTexture(),',
  '    roughness: 0.55,',
  '    metalness: 0.08,',
  '  }),',
  '  graniteCharcoal: new THREE.MeshStandardMaterial({',
  '    color: "#2c3e50",',
  '    roughness: 0.75,',
  '    metalness: 0.25,',
  '  }),',
  '  bronzeSunshade: new THREE.MeshStandardMaterial({',
  '    color: "#a0522d",',
  '    roughness: 0.35,',
  '    metalness: 0.75,',
  '  }),',
  '  stuccoWhite: new THREE.MeshStandardMaterial({',
  '    map: createArchitecturalStuccoTexture(),',
  '    roughness: 0.85,',
  '    metalness: 0.02,',
  '  }),',
  '  compoundGateBlack: new THREE.MeshStandardMaterial({',
  '    map: createOrnamentalGateTexture(),',
  '    roughness: 0.45,',
  '    metalness: 0.75,',
  '  }),',
  '  paverInterlocking: new THREE.MeshStandardMaterial({',
  '    map: createInterlockingPaverTexture(),',
  '    roughness: 0.90,',
  '    metalness: 0.04,',
  '  }),',
  '  estateLawn: new THREE.MeshStandardMaterial({',
  '    map: createManicuredLawnTexture(),',
  '    roughness: 0.88,',
  '    metalness: 0.02,',
  '  }),',
  '  botanicalFlowerBed: new THREE.MeshStandardMaterial({',
  '    map: createBotanicalFlowerBedTexture(),',
  '    roughness: 0.82,',
  '    metalness: 0.02,',
  '  }),',
  '};'
].join(EOL);

code = code.slice(0, oldPbrMatBlockStart) + newPbrMatBlock + code.slice(oldPbrMatBlockEnd);

fs.writeFileSync(filePath, code, "utf8");
console.log("Successfully updated abujaMaterials.ts!");
