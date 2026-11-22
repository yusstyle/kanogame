import fs from "fs";
import path from "path";

const verifyPath = path.resolve("Kano-3D-Neighborhood-Game/scripts/verify-phase2.mjs");
let code = fs.readFileSync(verifyPath, "utf8");

// Add Edge flags
code = code.replace(
  `  "--window-size=1920,1080",\n  GAME_URL`,
  `  "--window-size=1920,1080",\n  "--disable-background-timer-throttling",\n  "--disable-renderer-backgrounding",\n  "--disable-backgrounding-occluded-windows",\n  GAME_URL`
);

// Add safety timeout to runBenchmark
code = code.replace(
  `async function runBenchmark(cdp, frames = 600) {
  return await cdp.eval(\`
    new Promise((resolve) => {`,
  `async function runBenchmark(cdp, frames = 600) {
  return await cdp.eval(\`
    new Promise((resolve) => {
      const safetyTimer = setTimeout(() => {
        onDone();
      }, 35000);`
);

code = code.replace(
  `        if (count < \${frames}) {
          requestAnimationFrame(onFrame);
        } else {
          const validDts = frameDeltas.slice(5);`,
  `        if (count < \${frames}) {
          requestAnimationFrame(onFrame);
        } else {
          clearTimeout(safetyTimer);
          onDone();
        }
      }

      function onDone() {
        const validDts = frameDeltas.slice(5);`
);

fs.writeFileSync(verifyPath, code, "utf8");
console.log("verify-phase2.mjs updated with Edge flags and safety timeout!");
