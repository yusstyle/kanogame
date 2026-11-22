import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9290;
const tempUserData = path.join(os.tmpdir(), `edge-cbd-loop-${Date.now()}`);

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
    })()`
  });
  await new Promise(r => setTimeout(r, 3000)); // Wait for game loop frames

  const inspectRunningLoop = await send("Runtime.evaluate", {
    expression: `(() => new Promise(resolve => {
      const eng = window.__kanoEngine;
      const renderer = eng.renderer;
      const samples = [];
      let frameCount = 0;

      function hook() {
        samples.push({
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          mode: eng.mode,
          activeVeh: eng.activeVehicle,
          carRootVis: eng.car ? eng.car.root.visible : false,
          gltfVisCount: eng.car && eng.car.gltfBody ? eng.car.gltfBody.children.filter(c => c.visible).length : 0,
          distToCar: eng.car ? eng.carPosition.distanceTo(eng.playerPosition) : 0,
          trafficCount: eng.trafficSystem ? eng.trafficSystem.vehicles.length : 0,
        });
        frameCount++;
        if (frameCount < 10) {
          requestAnimationFrame(hook);
        } else {
          resolve(samples);
        }
      }
      requestAnimationFrame(hook);
    }))()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log("=== RUNNING GAME LOOP SAMPLES AT CBD ===");
  console.log(JSON.stringify(inspectRunningLoop, null, 2));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
