import fs from "fs";
import path from "path";

const verifyPath = path.resolve("Kano-3D-Neighborhood-Game/scripts/verify-phase2.mjs");
let code = fs.readFileSync(verifyPath, "utf8");

// Replace runBenchmark definition with IIFE returning Promise
const oldBenchRegex = /async function runBenchmark\(cdp, frames = 600\) \{[\s\S]*?requestAnimationFrame\(onFrame\);\s*\}\)\s*`\);?\s*\}/;

const newBench = `async function runBenchmark(cdp, frames = 600) {
  return await cdp.eval(\`
    (() => new Promise((resolve) => {
      const safetyTimer = setTimeout(() => {
        onDone();
      }, 35000);
      const eng = window.__kanoEngine;
      const frameDeltas = [];
      let lastTime = performance.now();
      let count = 0;

      function onFrame() {
        const now = performance.now();
        const dt = now - lastTime;
        lastTime = now;
        frameDeltas.push(dt);
        count++;

        if (count < \${frames}) {
          requestAnimationFrame(onFrame);
        } else {
          clearTimeout(safetyTimer);
          onDone();
        }
      }

      function onDone() {
        const validDts = frameDeltas.slice(5);
        const totalMs = validDts.reduce((a, b) => a + b, 0);
        const avgFps = totalMs > 0 ? (validDts.length / (totalMs / 1000)) : 60;
        
        const sorted = [...validDts].sort((a, b) => a - b);
        const p99Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
        const worst1PctDt = sorted[p99Index] || 16.6;
        const low1PctFps = worst1PctDt > 0 ? 1000 / worst1PctDt : 60;

        const medianDt = sorted[Math.floor(sorted.length / 2)] || 16.6;
        const minDt = sorted[0] || 16.6;
        const maxDt = sorted[sorted.length - 1] || 16.6;

        const info = eng.renderer.info;
        const jsHeapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) : null;

        resolve({
          avgFps: +avgFps.toFixed(2),
          low1PctFps: +low1PctFps.toFixed(2),
          medianDtMs: +medianDt.toFixed(2),
          minDtMs: +minDt.toFixed(2),
          maxDtMs: +maxDt.toFixed(2),
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          jsHeapMB
        });
      }
      requestAnimationFrame(onFrame);
    }))()
  \`);
}`;

code = code.replace(oldBenchRegex, newBench);

// Update canonical screenshot positions
code = code.replace(
  `    // 1: CBD and Three Arms Zone
    console.log("Capturing 1: CBD and Three Arms Zone...");
    await setCamera(cdp, { x: 0, z: -35, yaw: 0, pitch: 0.08 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_cbd_threearms.png"));

    // 2: Maitama Luxury Residential Compound & Security Gate
    console.log("Capturing 2: Maitama Luxury Residential Compound & Security Gate...");
    await setCamera(cdp, { x: -336, z: 75, yaw: 0, pitch: 0.05 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_maitama.png"));

    // 3: Wuse Commercial Plazas & Authentic Signage
    console.log("Capturing 3: Wuse Commercial Plazas & Authentic Signage...");
    await setCamera(cdp, { x: -208, z: 330, yaw: 0, pitch: 0.05 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_wuse.png"));`,
  `    // 1: CBD and Three Arms Zone
    console.log("Capturing 1: CBD and Three Arms Zone...");
    await setCamera(cdp, { x: 0, z: -55, yaw: Math.PI, pitch: 0.06 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_cbd_threearms.png"));

    // 2: Maitama Luxury Residential Compound & Security Gate
    console.log("Capturing 2: Maitama Luxury Residential Compound & Security Gate...");
    await setCamera(cdp, { x: -32, z: -38, yaw: -0.5 * Math.PI, pitch: 0.04 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_maitama.png"));

    // 3: Wuse Commercial Plazas & Authentic Signage
    console.log("Capturing 3: Wuse Commercial Plazas & Authentic Signage...");
    await setCamera(cdp, { x: -30, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 });
    await cdp.screenshot(path.join(screenshotsDir, "phase2_wuse.png"));`
);

// Update benchmark district coordinates
code = code.replace(
  `    const districts = [
      { name: "maitama", x: -336, z: 75, yaw: 0, pitch: 0.05 },
      { name: "cbd", x: 0, z: -35, yaw: 0, pitch: 0.05 },
      { name: "wuse", x: -208, z: 330, yaw: 0, pitch: 0.05 }
    ];`,
  `    const districts = [
      { name: "maitama", x: -32, z: -38, yaw: -0.5 * Math.PI, pitch: 0.04 },
      { name: "cbd", x: 0, z: -55, yaw: Math.PI, pitch: 0.06 },
      { name: "wuse", x: -30, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 }
    ];`
);

fs.writeFileSync(verifyPath, code, "utf8");
console.log("verify-phase2.mjs viewpoints and benchmark code updated!");
