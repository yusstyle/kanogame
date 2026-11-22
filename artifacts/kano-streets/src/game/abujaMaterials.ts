import * as THREE from "three";
import { markWorldResourceShared } from "./worldResourceLifecycle";

// =============================================================
// ABUJA ARCHITECTURAL PBR TEXTURES & SHARED MATERIALS
// All textures procedurally generated via HTML5 Canvas API
// 100% CC0 / Public Domain - Self-Authored Procedural Assets
// =============================================================

/**
 * 1. Authentic Nigerian Commercial Plaza Signboard Atlas
 * Contains authentic local brandings, banks, clinics, tech arcades and eateries
 */
export function createCommercialSignageAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Dark slate background
  ctx.fillStyle = "#1e272c";
  ctx.fillRect(0, 0, 1024, 512);

  const signs = [
    { title: "FIRST ABUJA COMMERCIAL BANK", sub: "Central Business District Branch · 24/7 ATM", bg: "#0b3c5d", border: "#d4ac0d", y: 0, h: 64 },
    { title: "EMAB TECH PLAZA", sub: "Laptops · Smartphones · Apple & Samsung Repairs", bg: "#900c3f", border: "#f1c40f", y: 64, h: 64 },
    { title: "KASUWA MODERN PHARMACY", sub: "Prescriptions · Medical Supplies · NHS Registered", bg: "#1e8449", border: "#ffffff", y: 128, h: 64 },
    { title: "SUYA SPOT & SHAWARMA LOUNGE", sub: "Fresh Charcoal Beef Suya · Chilled Drinks · Outdoor Seating", bg: "#d35400", border: "#f39c12", y: 192, h: 64 },
    { title: "MAITAMA DIPLOMATIC SUITES", sub: "Luxury Serviced Apartments · Executive Residency", bg: "#1c2833", border: "#b7950b", y: 256, h: 64 },
    { title: "HABEEB TEXTILES & FASHION", sub: "Exclusive Kaftans · Lace · Senegalese & Hausa Brocade", bg: "#512e5f", border: "#af7ac5", y: 320, h: 64 },
    { title: "ZENITH CAPITAL INVESTMENT", sub: "Wealth Management · Corporate Finance · Floor 4", bg: "#145a32", border: "#f4d03f", y: 384, h: 64 },
    { title: "FEDERAL MINISTRIES SERVICE PORTAL", sub: "Public Documents · Consular Services · Registry Desk", bg: "#212f3d", border: "#5dade2", y: 448, h: 64 },
  ];

  signs.forEach((s) => {
    // Background
    ctx.fillStyle = s.bg;
    ctx.fillRect(8, s.y + 4, 1008, s.h - 8);

    // Border
    ctx.strokeStyle = s.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, s.y + 6, 1004, s.h - 12);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(s.title, 32, s.y + 36);

    // Subtitle
    ctx.fillStyle = s.border;
    ctx.font = "14px sans-serif";
    ctx.fillText(s.sub, 34, s.y + 54);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * 2. High-Fidelity Modern Architectural Glass Curtain Wall
 * Reflective tinted double-glazing with aluminum structural mullions
 */
export function createGlassCurtainTexture(tintColor: string, mullionColor: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = mullionColor;
  ctx.fillRect(0, 0, 256, 256);

  const cols = 4;
  const rows = 4;
  const cellW = 256 / cols;
  const cellH = 256 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + 3;
      const y = r * cellH + 3;
      const w = cellW - 6;
      const h = cellH - 6;

      // Solar reflection gradient
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, tintColor);
      grad.addColorStop(0.4, "#ffffff22");
      grad.addColorStop(0.7, tintColor);
      grad.addColorStop(1, "#0d1b2a");

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // Subtle horizontal window blind slats
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      for (let by = y + 6; by < y + h; by += 8) {
        ctx.fillRect(x, by, w, 2);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * 3. Nigerian Luxury Villa Ledger Stone Accent Cladding
 * Natural stacked quartzite/slate stone used in Maitama & Asokoro estates
 */
export function createLedgerStoneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#8d7b68"; // Warm beige-grey undertone
  ctx.fillRect(0, 0, 256, 256);

  const stoneColors = ["#6b5b4e", "#8c7b6d", "#53463c", "#a4907c", "#7d6e5d", "#483d34"];

  const rows = 16;
  const rowH = 256 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    let x = 0;
    while (x < 256) {
      const stoneW = 24 + ((r * 17 + x * 23) % 40);
      const color = stoneColors[(r * 7 + (x | 0)) % stoneColors.length];

      ctx.fillStyle = color;
      ctx.fillRect(x, y + 1, Math.min(stoneW, 256 - x), rowH - 2);

      // Subtle stone highlight & bevel shadow
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(x, y + 1, Math.min(stoneW, 256 - x), 1);
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(x, y + rowH - 2, Math.min(stoneW, 256 - x), 1);

      x += stoneW + 2;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * 4. Terracotta Spanish/Roman Interlocking Roof Tile Texture
 */
export function createTerracottaTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#a84323"; // Terracotta base
  ctx.fillRect(0, 0, 256, 256);

  const cols = 8;
  const rows = 12;
  const colW = 256 / cols;
  const rowH = 256 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    for (let c = 0; c < cols; c++) {
      const x = c * colW;

      // Curved barrel tile shading
      const grad = ctx.createLinearGradient(x, y, x + colW, y);
      grad.addColorStop(0, "#732912");
      grad.addColorStop(0.3, "#c85a32");
      grad.addColorStop(0.7, "#d46b43");
      grad.addColorStop(1, "#541e0d");

      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);

      // Bottom overlap shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(x, y + rowH - 3, colW, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * 5. Ground-Floor Retail Arcade Shopfront Windows
 */
export function createShopfrontDisplayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, 512, 256);

  const shops = [
    { name: "BOUTIQUE", interior: "#2c3e50", light: "#f9e79f" },
    { name: "GADGETS", interior: "#1b2631", light: "#aed6f1" },
    { name: "CAFE & SUYA", interior: "#3e2723", light: "#edbb99" },
    { name: "MED PHARMA", interior: "#145a32", light: "#abebc6" },
  ];

  const shopW = 512 / 4;
  shops.forEach((s, i) => {
    const x = i * shopW;

    // Window frame
    ctx.fillStyle = "#333333";
    ctx.fillRect(x, 0, shopW, 256);

    // Warm illuminated shop interior
    const grad = ctx.createLinearGradient(x + 4, 30, x + shopW - 8, 240);
    grad.addColorStop(0, s.light);
    grad.addColorStop(0.4, s.interior);
    grad.addColorStop(1, "#0a0a0a");

    ctx.fillStyle = grad;
    ctx.fillRect(x + 4, 30, shopW - 8, 210);

    // Store awning banner
    ctx.fillStyle = "#d35400";
    ctx.fillRect(x + 4, 6, shopW - 8, 22);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(s.name, x + 12, 22);

    // Glass reflection diagonal
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.moveTo(x + 10, 240);
    ctx.lineTo(x + 40, 30);
    ctx.lineTo(x + 70, 30);
    ctx.lineTo(x + 40, 240);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * 6. Exterior Air Conditioner Split Condensers & Louver Atlas
 */
export function createAcLouverTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, 0, 128, 128);

  // Metal condenser fan grille
  ctx.fillStyle = "#333333";
  ctx.beginPath();
  ctx.arc(64, 64, 46, 0, Math.PI * 2);
  ctx.fill();

  // Grille concentric rings
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 3;
  for (let r = 12; r <= 42; r += 10) {
    ctx.beginPath();
    ctx.arc(64, 64, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Brand label
  ctx.fillStyle = "#154360";
  ctx.fillRect(20, 12, 36, 12);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText("COOL", 24, 21);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}


/**
 * 7. Weathered Galvanized Corrugated Zinc Roofing
 * Common on commercial utility buildings, market canopies and generator sheds
 */
export function createCorrugatedRoofTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#8a9597";
  ctx.fillRect(0, 0, 256, 256);

  const corrugationWidth = 16;
  for (let x = 0; x < 256; x += corrugationWidth) {
    const grad = ctx.createLinearGradient(x, 0, x + corrugationWidth, 0);
    grad.addColorStop(0.0, "#606b6e");
    grad.addColorStop(0.3, "#9ca7a9");
    grad.addColorStop(0.5, "#b5c0c2");
    grad.addColorStop(0.8, "#7d888a");
    grad.addColorStop(1.0, "#525c5e");

    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, corrugationWidth, 256);

    // Weathering & subtle laterite dust speckle
    ctx.fillStyle = "rgba(140, 80, 40, 0.08)";
    ctx.fillRect(x, 0, corrugationWidth, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * 8. Nigerian "Storex" / "Geepee" Heavy Polyethylene Water Storage Tank
 * Ribbed black / dark navy polymer with structural reinforcing rings
 */
export function createWaterTankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#161c22"; // Deep black-blue polymer
  ctx.fillRect(0, 0, 256, 256);

  // Horizontal structural ribbed bands
  const bands = [30, 75, 120, 165, 210];
  for (const y of bands) {
    const grad = ctx.createLinearGradient(0, y - 8, 0, y + 8);
    grad.addColorStop(0.0, "#0e1317");
    grad.addColorStop(0.5, "#2c3842");
    grad.addColorStop(1.0, "#0e1317");

    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 8, 256, 16);
  }

  // White manufacturer volume badge
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("STOREX 5000L", 65, 145);
  ctx.fillStyle = "#f39c12";
  ctx.fillRect(60, 150, 135, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * 9. Heavy Industrial Diesel Generator Soundproof Enclosure ("Mikano" / "CAT")
 */
export function createGeneratorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1e4d2b"; // Authentic dark industrial genset green
  ctx.fillRect(0, 0, 256, 128);

  // Side maintenance access doors
  ctx.strokeStyle = "#13331c";
  ctx.lineWidth = 3;
  ctx.strokeRect(15, 15, 100, 98);
  ctx.strokeRect(140, 15, 100, 98);

  // Cooling louver air vents
  ctx.fillStyle = "#0f2114";
  for (let ly = 30; ly < 90; ly += 6) {
    ctx.fillRect(25, ly, 80, 3);
    ctx.fillRect(150, ly, 80, 3);
  }

  // Yellow warning hazard plate
  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(35, 96, 60, 10);
  ctx.fillStyle = "#000000";
  ctx.font = "bold 8px sans-serif";
  ctx.fillText("DANGER 415V", 38, 104);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// -------------------------------------------------------------
// SINGLETON MATERIALS INSTANCES (SHARED GLOBALLY FOR LOW DRAW CALLS)
// -------------------------------------------------------------

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
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 4})`;
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

export const abujaPbrMaterials = {
  corrugatedZincRoof: new THREE.MeshStandardMaterial({
    map: createCorrugatedRoofTexture(),
    roughness: 0.65,
    metalness: 0.55,
  }),
  waterTankStorex: new THREE.MeshStandardMaterial({
    map: createWaterTankTexture(),
    roughness: 0.35,
    metalness: 0.1,
  }),
  generatorEnclosure: new THREE.MeshStandardMaterial({
    map: createGeneratorTexture(),
    roughness: 0.4,
    metalness: 0.3,
  }),
  sandcreteWarm: new THREE.MeshStandardMaterial({
    map: createSandcreteTexture(),
    roughness: 0.88,
    metalness: 0.02,
  }),
  steelTowerGray: new THREE.MeshStandardMaterial({
    color: "#47525d",
    roughness: 0.45,
    metalness: 0.75,
  }),
  razorWireSilver: new THREE.MeshStandardMaterial({
    color: "#bdc3c7",
    roughness: 0.25,
    metalness: 0.9,
  }),
  signageAtlas: new THREE.MeshStandardMaterial({
    map: createCommercialSignageAtlas(),
    roughness: 0.35,
    metalness: 0.2,
  }),
  glassCurtainBlue: new THREE.MeshStandardMaterial({
    map: createGlassCurtainTexture("#1b4f72", "#17202a"),
    roughness: 0.12,
    metalness: 0.85,
  }),
  glassCurtainGreen: new THREE.MeshStandardMaterial({
    map: createGlassCurtainTexture("#0e6251", "#145a32"),
    roughness: 0.15,
    metalness: 0.8,
  }),
  ledgerStoneMaitama: new THREE.MeshStandardMaterial({
    map: createLedgerStoneTexture(),
    roughness: 0.85,
    metalness: 0.05,
  }),
  terracottaRoof: new THREE.MeshStandardMaterial({
    map: createTerracottaTileTexture(),
    roughness: 0.7,
    metalness: 0.1,
  }),
  shopfrontDisplay: new THREE.MeshStandardMaterial({
    map: createShopfrontDisplayTexture(),
    roughness: 0.2,
    metalness: 0.4,
  }),
  acCondenser: new THREE.MeshStandardMaterial({
    map: createAcLouverTexture(),
    roughness: 0.4,
    metalness: 0.6,
  }),
  marbleCream: new THREE.MeshStandardMaterial({
    map: createPolishedMarbleTexture(),
    roughness: 0.55,
    metalness: 0.08,
  }),
  graniteCharcoal: new THREE.MeshStandardMaterial({
    color: "#2c3e50",
    roughness: 0.75,
    metalness: 0.25,
  }),
  bronzeSunshade: new THREE.MeshStandardMaterial({
    color: "#a0522d",
    roughness: 0.35,
    metalness: 0.75,
  }),
  stuccoWhite: new THREE.MeshStandardMaterial({
    map: createArchitecturalStuccoTexture(),
    roughness: 0.85,
    metalness: 0.02,
  }),
  compoundGateBlack: new THREE.MeshStandardMaterial({
    map: createOrnamentalGateTexture(),
    roughness: 0.45,
    metalness: 0.75,
  }),
  paverInterlocking: new THREE.MeshStandardMaterial({
    map: createInterlockingPaverTexture(),
    roughness: 0.90,
    metalness: 0.04,
  }),
  estateLawn: new THREE.MeshStandardMaterial({
    map: createManicuredLawnTexture(),
    roughness: 0.88,
    metalness: 0.02,
  }),
  botanicalFlowerBed: new THREE.MeshStandardMaterial({
    map: createBotanicalFlowerBedTexture(),
    roughness: 0.82,
    metalness: 0.02,
  }),
};
Object.values(abujaPbrMaterials).forEach(markWorldResourceShared);

