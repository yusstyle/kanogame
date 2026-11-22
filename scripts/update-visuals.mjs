import fs from "fs";
import path from "path";

const root = path.resolve("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game");

// 1. weatherSystem.ts
{
  const filePath = path.join(root, "weatherSystem.ts");
  let code = fs.readFileSync(filePath, "utf8");

  code = code.replace(/sunIntensity:\s*2\.85,/, "sunIntensity: 1.55,");
  code = code.replace(/hemiIntensity:\s*0\.95,/, "hemiIntensity: 0.65,");

  code = code.replace(
    /let effectiveSunIntensity = config\.sunIntensity \* \(0\.35 \+ 0\.65 \* diurnalFactor\);/,
    `const baseSunIntensity = this.currentCity === "abuja" ? 1.55 : config.sunIntensity;
    const baseHemiIntensity = this.currentCity === "abuja" ? 0.65 : config.hemiIntensity;
    let effectiveSunIntensity = baseSunIntensity * (0.35 + 0.65 * diurnalFactor);`
  );
  code = code.replace(
    /let effectiveHemiIntensity = config\.hemiIntensity \* \(0\.45 \+ 0\.55 \* diurnalFactor\);/,
    `let effectiveHemiIntensity = baseHemiIntensity * (0.45 + 0.55 * diurnalFactor);`
  );

  code = code.replace(
    /const targetSky = new THREE\.Color\(config\.skyColor\);/,
    `const targetSky = this.currentCity === "abuja" ? new THREE.Color("#2068a8") : new THREE.Color(config.skyColor);`
  );
  code = code.replace(
    /const targetFog = new THREE\.Color\(config\.fogColor\);/,
    `const targetFog = this.currentCity === "abuja" ? new THREE.Color("#b4cae0") : new THREE.Color(config.fogColor);`
  );
  code = code.replace(
    /const targetSun = new THREE\.Color\(config\.sunColor\);/,
    `const targetSun = this.currentCity === "abuja" ? new THREE.Color("#fff7ee") : new THREE.Color(config.sunColor);`
  );

  code = code.replace(/scene\.fog\.near = 160;/, `scene.fog.near = 180;`);
  code = code.replace(/scene\.fog\.far = 580;/, `scene.fog.far = 650;`);

  fs.writeFileSync(filePath, code, "utf8");
  console.log("weatherSystem.ts updated!");
}

// 2. GameEngine.ts
{
  const filePath = path.join(root, "GameEngine.ts");
  let code = fs.readFileSync(filePath, "utf8");

  // Adjust tone mapping exposure from 1.12 to 0.98
  code = code.replace(/this\.renderer\.toneMappingExposure = 1\.12;/, `this.renderer.toneMappingExposure = 0.98;`);

  // Initial lights in addLighting()
  code = code.replace(
    /const hemi = new THREE\.HemisphereLight\("#d8e8f2", "#7a5e42", 1\.45\);/,
    `const hemi = new THREE.HemisphereLight("#c6def5", "#586352", 0.65);`
  );
  code = code.replace(
    /const sun = new THREE\.DirectionalLight\("#fff8ed", 2\.85\);/,
    `const sun = new THREE.DirectionalLight("#fff8ee", 1.55);`
  );
  code = code.replace(
    /const bounce = new THREE\.DirectionalLight\("#a3c0d4", 0\.55\);/,
    `const bounce = new THREE.DirectionalLight("#9ec0db", 0.18);`
  );

  // Initial scene background and fog
  code = code.replace(
    /this\.scene\.background = new THREE\.Color\("#dcd4c3"\);/,
    `this.scene.background = new THREE.Color("#2068a8");`
  );
  code = code.replace(
    /this\.scene\.fog = new THREE\.Fog\("#dcd4c3", 42, 230\);/,
    `this.scene.fog = new THREE.Fog("#b4cae0", 180, 650);`
  );

  fs.writeFileSync(filePath, code, "utf8");
  console.log("GameEngine.ts updated!");
}

