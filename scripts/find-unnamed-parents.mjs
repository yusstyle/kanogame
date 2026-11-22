import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9267;
const tempUserData = path.join(os.tmpdir(), `edge-diag-unnamed-${Date.now()}`);

const edgeProc = spawn(EDGE_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${tempUserData}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1920,1080",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  GAME_URL
], { stdio: "ignore" });

async function run() {
  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const list = await res.json();
  const pageTab = list.find(t => t.type === "page" && !t.url.startsWith("edge") && !t.url.startsWith("chrome-extension"));
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (msg) => {
        const d = JSON.parse(msg.data);
        if (d.id === msgId) {
          ws.removeEventListener("message", handler);
          if (d.error) reject(d.error);
          else if (d.result && d.result.result) resolve(d.result.result.value);
          else resolve(d.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // Click start
  for (let i = 0; i < 90; i++) {
    const ready = await send("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('.ks-button-primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter the neighborhood'));
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && typeof eng.travelToCity === "function";
      })()`,
      returnByValue: true
    });
    if (ready) break;
    await new Promise(r => setTimeout(r, 600));
  }

  await send("Runtime.evaluate", {
    expression: `(() => {
      const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (dismissBtn) dismissBtn.click();
      window.__kanoEngine.travelToCity("abuja", "highway");
    })()`
  });
  await new Promise(r => setTimeout(r, 3500));

  await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
      const ground = eng.surfaceHeight(0, -62);
      eng.playerPosition.set(0, ground + 3.5, -62);
      eng.playerYaw = Math.PI;
      eng.cameraYaw = Math.PI;
      eng.cameraPitch = 0.14;
      if (eng.abujaStreamingManager) eng.abujaStreamingManager.update(eng.playerPosition, true);
      eng.updateChunkCulling(true);
      eng.renderer.render(eng.scene, eng.camera);
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const result = await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
      const scene = eng.scene;

      const parentHistogram = {};
      const grandParentHistogram = {};

      scene.traverse((obj) => {
        if ((obj.isMesh || obj.isPoints) && (!obj.name || obj.name === "")) {
          const pName = obj.parent ? (obj.parent.name || "unnamed_parent") : "no_parent";
          const gpName = obj.parent && obj.parent.parent ? (obj.parent.parent.name || "unnamed_grandparent") : "no_grandparent";
          parentHistogram[pName] = (parentHistogram[pName] || 0) + 1;
          grandParentHistogram[gpName] = (grandParentHistogram[gpName] || 0) + 1;
        }
      });

      // Also inspect root children of scene
      const sceneRoots = scene.children.map(c => ({
        name: c.name || "unnamed",
        type: c.type,
        childCount: c.children.length,
        isGroup: c.isGroup
      }));

      // Also inspect AbujaWorldRoot children
      const abujaRoot = scene.children.find(c => c.name === "AbujaWorldRoot");
      const abujaChildren = abujaRoot ? abujaRoot.children.map(c => ({
        name: c.name || "unnamed",
        type: c.type,
        childCount: c.children.length
      })) : [];

      return { parentHistogram, grandParentHistogram, sceneRoots, abujaChildren };
    })()`,
    returnByValue: true
  });

  console.log("=== UNNAMED MESHES PARENT HISTOGRAM ===");
  const sortedParents = Object.entries(result.parentHistogram).sort((a,b) => b[1] - a[1]);
  sortedParents.slice(0, 25).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log("\n=== GRANDPARENT HISTOGRAM ===");
  const sortedGP = Object.entries(result.grandParentHistogram).sort((a,b) => b[1] - a[1]);
  sortedGP.slice(0, 25).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log("\n=== SCENE ROOTS ===");
  console.log(JSON.stringify(result.sceneRoots, null, 2));

  console.log("\n=== ABUJA WORLD ROOT CHILDREN ===");
  console.log(JSON.stringify(result.abujaChildren, null, 2));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
