import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9276;
const tempUserData = path.join(os.tmpdir(), `edge-diag-car-inspect-${Date.now()}`);

const edgeProc = spawn(EDGE_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${tempUserData}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1920,1080",
  GAME_URL
], { stdio: "ignore" });

async function getGameTabWsUrl(port) {
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
  const wsUrl = await getGameTabWsUrl(DEBUG_PORT);
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

  // Dismiss onboarding & travel to abuja
  await send("Runtime.evaluate", {
    expression: `(() => {
      const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (dismissBtn) dismissBtn.click();
      window.__kanoEngine.travelToCity("abuja", "highway");
    })()`
  });
  await new Promise(r => setTimeout(r, 3500));

  // Set camera to CBD
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

  const carInfo = await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
      const car = eng.car;
      if (!car || !car.root) return { error: "no car" };

      const allMeshes = [];
      const visibleMeshes = [];
      car.root.traverse((obj) => {
        if (obj.isMesh) {
          allMeshes.push({ name: obj.name, visible: obj.visible, castShadow: obj.castShadow });
          if (obj.visible) visibleMeshes.push(obj.name);
        }
      });

      return {
        rootVisible: car.root.visible,
        carPos: { x: eng.carPosition.x, y: eng.carPosition.y, z: eng.carPosition.z },
        playerPos: { x: eng.playerPosition.x, y: eng.playerPosition.y, z: eng.playerPosition.z },
        distToCar: eng.carPosition.distanceTo(eng.playerPosition),
        totalMeshes: allMeshes.length,
        visibleCount: visibleMeshes.length,
        visibleNames: visibleMeshes.slice(0, 50)
      };
    })()`,
    returnByValue: true
  });

  console.log("=== CAR INSPECTION RESULT ===");
  console.log(JSON.stringify(carInfo, null, 2));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
