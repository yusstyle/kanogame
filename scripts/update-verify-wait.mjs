import fs from "fs";
import path from "path";

const verifyPath = path.resolve("Kano-3D-Neighborhood-Game/scripts/verify-phase2.mjs");
let code = fs.readFileSync(verifyPath, "utf8");

// Improve the engine wait loop
code = code.replace(
  `    let engineReady = false;
    for (let i = 0; i < 50; i++) {
      engineReady = await cdp.eval(\`(() => {
        const btn = document.querySelector('.ks-button-primary');
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && typeof eng.travelToCity === "function";
      })()\`);
      if (engineReady) break;
      await new Promise(r => setTimeout(r, 500));
    }`,
  `    let engineReady = false;
    for (let i = 0; i < 90; i++) {
      engineReady = await cdp.eval(\`(() => {
        const btn = document.querySelector('.ks-button-primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter the neighborhood'));
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && typeof eng.travelToCity === "function";
      })()\`);
      if (engineReady) break;
      await new Promise(r => setTimeout(r, 600));
    }`
);

fs.writeFileSync(verifyPath, code, "utf8");
console.log("verify-phase2.mjs updated with resilient engine check!");
