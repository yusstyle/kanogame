import fs from "fs";

const filePath = "artifacts/kano-streets/src/game/weatherSystem.ts";
let code = fs.readFileSync(filePath, "utf8");

// Normalize line endings for replacement to preserve existing
const isCRLF = code.includes("\r\n");
const EOL = isCRLF ? "\r\n" : "\n";

// Update cool_night preset config
const oldPreset = [
  '  cool_night: {',
  '    preset: "cool_night",',
  '    displayName: "Cool Starlit Night",',
  '    skyColor: "#0b1424",',
  '    fogColor: "#0b1424",',
  '    fogNear: 28,',
  '    fogFar: 180,',
  '    sunColor: "#4f729d",',
  '    sunIntensity: 0.42,',
  '    hemiSkyColor: "#15243d",',
  '    hemiGroundColor: "#101924",',
  '    hemiIntensity: 0.45,',
  '    particleCount: 60,',
  '    particleOpacity: 0.15,',
  '    particleSize: 0.25,',
  '    windSpeed: { x: 0.3, y: -0.02, z: 0.4 },',
  '  },'
].join(EOL);

const newPreset = [
  '  cool_night: {',
  '    preset: "cool_night",',
  '    displayName: "Cool Starlit Night",',
  '    skyColor: "#0f1d32",',
  '    fogColor: "#0f1d32",',
  '    fogNear: 40,',
  '    fogFar: 260,',
  '    sunColor: "#8eaed8",',
  '    sunIntensity: 0.85,',
  '    hemiSkyColor: "#223554",',
  '    hemiGroundColor: "#1d2925",',
  '    hemiIntensity: 0.82,',
  '    particleCount: 20,',
  '    particleOpacity: 0.08,',
  '    particleSize: 0.18,',
  '    windSpeed: { x: 0.3, y: -0.02, z: 0.4 },',
  '  },'
].join(EOL);

if (!code.includes(oldPreset)) {
  console.error("Could not find oldPreset in weatherSystem.ts!");
} else {
  code = code.replace(oldPreset, newPreset);
}

// Update tmpNight colors
const oldTmp = [
  '  private readonly tmpNightSky = new THREE.Color("#0b1424");',
  '  private readonly tmpNightSun = new THREE.Color("#4a6890");'
].join(EOL);

const newTmp = [
  '  private readonly tmpNightSky = new THREE.Color("#0f1d32");',
  '  private readonly tmpNightSun = new THREE.Color("#8eaed8");'
].join(EOL);

if (code.includes(oldTmp)) {
  code = code.replace(oldTmp, newTmp);
}

// Update night intensities in update loop
const oldNightIntensities = [
  '        effectiveSunIntensity = 0.42;',
  '        effectiveHemiIntensity = 0.45;'
].join(EOL);

const newNightIntensities = [
  '        effectiveSunIntensity = 0.85;',
  '        effectiveHemiIntensity = 0.82;'
].join(EOL);

if (code.includes(oldNightIntensities)) {
  code = code.replace(oldNightIntensities, newNightIntensities);
}

// Update bounceLight intensity at night
const oldBounce = [
  '        bounceLight.color.set("#223348");',
  '        bounceLight.intensity = 0.06;'
].join(EOL);

const newBounce = [
  '        bounceLight.color.set("#223348");',
  '        bounceLight.intensity = 0.22;'
].join(EOL);

if (code.includes(oldBounce)) {
  code = code.replace(oldBounce, newBounce);
}

fs.writeFileSync(filePath, code, "utf8");
console.log("Successfully updated weatherSystem.ts lighting!");

// Also update GameEngine.ts bounceLight night intensity
const gePath = "artifacts/kano-streets/src/game/GameEngine.ts";
let geCode = fs.readFileSync(gePath, "utf8");
const geCRLF = geCode.includes("\r\n");
const geEOL = geCRLF ? "\r\n" : "\n";

const oldGeBounce = [
  '      } else if (isNightOrTwilight) {',
  '        this.bounceLight.intensity = 0.05;'
].join(geEOL);

const newGeBounce = [
  '      } else if (isNightOrTwilight) {',
  '        this.bounceLight.intensity = 0.22;'
].join(geEOL);

if (geCode.includes(oldGeBounce)) {
  geCode = geCode.replace(oldGeBounce, newGeBounce);
  fs.writeFileSync(gePath, geCode, "utf8");
  console.log("Successfully updated GameEngine.ts bounceLight!");
}
