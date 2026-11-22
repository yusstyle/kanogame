import fs from "fs";
import path from "path";

const verifyPath = path.resolve("Kano-3D-Neighborhood-Game/scripts/verify-phase2.mjs");
let code = fs.readFileSync(verifyPath, "utf8");

const oldScreenshotsBlock = `    // 1: CBD and Three Arms Zone
    console.log("Capturing 1: CBD and Three Arms Zone...");
    await setCamera(cdp, { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_cbd_threearms.png"));

    // 2: Maitama Luxury Residential Compound & Security Gate
    console.log("Capturing 2: Maitama Luxury Residential Compound & Security Gate...");
    await setCamera(cdp, { x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_maitama.png"));

    // 3: Wuse Commercial Plazas & Authentic Signage
    console.log("Capturing 3: Wuse Commercial Plazas & Authentic Signage...");
    await setCamera(cdp, { x: -30, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_wuse.png"));

    // 4: Normal player eye-level view along Shehu Shagari Way
    console.log("Capturing 4: Normal player eye-level view along Shehu Shagari Way...");
    await setCamera(cdp, { x: 14, z: 10, yaw: -0.35 * Math.PI, pitch: 0.02, hidePlayer: false });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_player_eyelevel.png"));

    // 5: Aerial overview of Abuja metropolis
    console.log("Capturing 5: Aerial overview of Abuja metropolis...");
    await setCamera(cdp, { x: 0, y: 320, z: 120, yaw: 0.1, pitch: 0.85 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_aerial_overview.png"));

    // 6: Airport Expressway transit corridor
    console.log("Capturing 6: Airport Expressway transit corridor...");
    await setCamera(cdp, { x: -50, z: -145, yaw: -0.5 * Math.PI, pitch: 0.04 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_airport_expressway.png"));

    // 7: Garki Administrative & FHA Housing Terraces
    console.log("Capturing 7: Garki Administrative & FHA Housing Terraces...");
    await setCamera(cdp, { x: 175, z: 330, yaw: 0, pitch: 0.05 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_garki.png"));`;

const newScreenshotsBlock = `    // 1: CBD and Three Arms Zone
    console.log("Capturing 1: CBD and Three Arms Zone...");
    await setCamera(cdp, { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_cbd_threearms.png"));

    // 2: Maitama Luxury Residential Compound & Security Gate
    console.log("Capturing 2: Maitama Luxury Residential Compound & Security Gate...");
    await setCamera(cdp, { x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_maitama.png"));

    // 3: Wuse Commercial Plazas & Authentic Signage
    console.log("Capturing 3: Wuse Commercial Plazas & Authentic Signage...");
    await setCamera(cdp, { x: -30, y: 1.8, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_wuse.png"));

    // 4: Normal player eye-level view along Shehu Shagari Way
    console.log("Capturing 4: Normal player eye-level view along Shehu Shagari Way...");
    await setCamera(cdp, { x: 14, z: 10, yaw: -0.35 * Math.PI, pitch: 0.02, hidePlayer: false });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_player_eyelevel.png"));

    // 5: Aerial overview of Abuja metropolis
    console.log("Capturing 5: Aerial overview of Abuja metropolis...");
    await setCamera(cdp, { x: 0, y: 320, z: 120, yaw: 0.1, pitch: -0.75 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_aerial_overview.png"));

    // 6: Airport Expressway transit corridor
    console.log("Capturing 6: Airport Expressway transit corridor...");
    await setCamera(cdp, { x: 0, y: 1.8, z: -125, yaw: Math.PI, pitch: 0.04 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_airport_expressway.png"));

    // 7: Garki Administrative & FHA Housing Terraces
    console.log("Capturing 7: Garki Administrative & FHA Housing Terraces...");
    await setCamera(cdp, { x: 50, y: 1.8, z: 345, yaw: Math.PI, pitch: 0.08 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_garki.png"));`;

code = code.replace(oldScreenshotsBlock, newScreenshotsBlock);

fs.writeFileSync(verifyPath, code, "utf8");
console.log("Updated verify-phase2.mjs with accurate canonical camera positions!");
