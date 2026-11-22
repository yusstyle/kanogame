import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9288;
const tempUserData = path.join(os.tmpdir(), `edge-cbd-810-${Date.now()}`);

console.log("Launching Microsoft Edge on debug port " + DEBUG_PORT + "...");
const edgeProc = spawn(EDGE_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${tempUserData}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1920,1080",
  GAME_URL
], { stdio: "ignore" });

async function getWsUrl(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const tab = list.find(t => t.type === "page" && !t.url.startsWith("edge") && !t.url.startsWith("chrome-extension"));
        if (tab && tab.webSocketDebuggerUrl) return tab.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Could not connect to Edge tab");
}

async function run() {
  const wsUrl = await getWsUrl(DEBUG_PORT);
  const ws = new WebSocket(wsUrl);
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

  // Enter game
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

  // Travel to Abuja
  for (let attempt = 0; attempt < 5; attempt++) {
    const isAbuja = await send("Runtime.evaluate", {
      expression: `(() => {
        const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
        if (dismissBtn) dismissBtn.click();
        const eng = window.__kanoEngine;
        if (!eng || !eng.travelToCity) return false;
        if (eng.currentCity === "abuja") return true;
        eng.travelToCity("abuja", "highway");
        return false;
      })()`,
      returnByValue: true
    });
    if (isAbuja) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  await new Promise(r => setTimeout(r, 2000));

  // Position at CBD
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

  // Deep inspect all renderBufferDirect calls
  const breakdown = await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
      const renderer = eng.renderer;
      const scene = eng.scene;
      const mainCamera = eng.camera;

      const calls = [];
      const origRenderBufferDirect = renderer.renderBufferDirect.bind(renderer);

      renderer.renderBufferDirect = function(camera, currentScene, geometry, material, object, group) {
        const isShadow = camera !== mainCamera;
        let rootName = object.name || "unnamed";
        let curr = object;
        while (curr.parent && curr.parent !== scene) {
          curr = curr.parent;
          if (curr.name) rootName = curr.name + " / " + rootName;
        }

        calls.push({
          isShadow,
          objName: object.name || "unnamed",
          rootPath: rootName,
          matType: material ? material.type : "none"
        });

        origRenderBufferDirect(camera, currentScene, geometry, material, object, group);
      };

      renderer.info.reset();
      renderer.render(scene, mainCamera);
      renderer.renderBufferDirect = origRenderBufferDirect;

      const mainByGroup = {};
      const shadowByGroup = {};

      calls.forEach(c => {
        const p = c.rootPath.split(" / ")[0];
        if (c.isShadow) {
          shadowByGroup[p] = (shadowByGroup[p] || 0) + 1;
        } else {
          mainByGroup[p] = (mainByGroup[p] || 0) + 1;
        }
      });

      return {
        totalCalls: calls.length,
        mainCount: calls.filter(c => !c.isShadow).length,
        shadowCount: calls.filter(c => c.isShadow).length,
        mainByGroup,
        shadowByGroup,
        shadowCallsSample: calls.filter(c => c.isShadow).slice(0, 30)
      };
    })()`,
    returnByValue: true
  });

  console.log("=== CALL BREAKDOWN ===");
  console.log(`Total: ${breakdown.totalCalls} | Main: ${breakdown.mainCount} | Shadow: ${breakdown.shadowCount}`);
  console.log("\nMain calls by group:");
  Object.entries(breakdown.mainByGroup).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  console.log("\nShadow calls by group:");
  Object.entries(breakdown.shadowByGroup).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
