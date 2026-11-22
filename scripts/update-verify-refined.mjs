import fs from "fs";
import path from "path";

const verifyPath = path.resolve("Kano-3D-Neighborhood-Game/scripts/verify-phase2.mjs");
let code = fs.readFileSync(verifyPath, "utf8");

code = code.replace(
  `    // 1: CBD and Three Arms Zone
    console.log("Capturing 1: CBD and Three Arms Zone...");
    await setCamera(cdp, { x: 0, z: -55, yaw: Math.PI, pitch: 0.06 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_cbd_threearms.png"));

    // 2: Maitama Luxury Residential Compound & Security Gate
    console.log("Capturing 2: Maitama Luxury Residential Compound & Security Gate...");
    await setCamera(cdp, { x: -32, z: -38, yaw: -0.5 * Math.PI, pitch: 0.04 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_maitama.png"));`,
  `    // 1: CBD and Three Arms Zone
    console.log("Capturing 1: CBD and Three Arms Zone...");
    await setCamera(cdp, { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_cbd_threearms.png"));

    // 2: Maitama Luxury Residential Compound & Security Gate
    console.log("Capturing 2: Maitama Luxury Residential Compound & Security Gate...");
    await setCamera(cdp, { x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_maitama.png"));`
);

code = code.replace(
  `    const districts = [
      { name: "maitama", x: -32, z: -38, yaw: -0.5 * Math.PI, pitch: 0.04 },
      { name: "cbd", x: 0, z: -55, yaw: Math.PI, pitch: 0.06 },
      { name: "wuse", x: -30, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 }
    ];`,
  `    const districts = [
      { name: "maitama", x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 },
      { name: "cbd", x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 },
      { name: "wuse", x: -30, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 }
    ];`
);

fs.writeFileSync(verifyPath, code, "utf8");
console.log("verify-phase2.mjs refined coordinates applied!");
