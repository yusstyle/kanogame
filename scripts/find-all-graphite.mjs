import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9294;
const tempUserData = path.join(os.tmpdir(), `edge-find-graphite-${Date.now()}`);

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
  await new Promise(r => setTimeout(r, 3500)); // Wait for glb loading

  const graphiteObjects = await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
      const scene = eng.scene;

      const results = [];
      scene.traverse((obj) => {
        const n = obj.name || "";
        if (n.includes("Graphite") || n.includes("sedan") || n.includes("Sedan") || n.includes("107_reused") || n.includes("Watertight")) {
          // Count meshes inside
          let meshCount = 0;
          let visMeshCount = 0;
          obj.traverse(c => {
            if (c.isMesh) {
              meshCount++;
              if (c.visible) visMeshCount++;
            }
          });

          let pPath = obj.name || "unnamed";
          let curr = obj;
          while (curr.parent && curr.parent !== scene) {
            curr = curr.parent;
            if (curr.name) pPath = curr.name + " -> " + pPath;
          }

          results.push({
            name: obj.name,
            type: obj.type,
            path: pPath,
            visible: obj.visible,
            totalMeshesUnder: meshCount,
            visibleMeshesUnder: visMeshCount,
            pos: { x: +obj.position.x.toFixed(1), y: +obj.position.y.toFixed(1), z: +obj.position.z.toFixed(1) }
          });
        }
      });

      return {
        count: results.length,
        results
      };
    })()`,
    returnByValue: true
  });

  console.log("=== GRAPHITE / SEDAN OBJECTS IN SCENE ===");
  console.log(JSON.stringify(graphiteObjects, null, 2));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
