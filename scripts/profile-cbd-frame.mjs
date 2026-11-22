import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9268;
const tempUserData = path.join(os.tmpdir(), `edge-diag-cbd-frame-${Date.now()}`);

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

  const sedanList = await send("Runtime.evaluate", {
    expression: `(() => window.__kanoEngine.scene.children.filter(c => (c.name || "").includes("Graphite") || (c.name || "").includes("car") || (c.name || "").includes("sedan") || c.name === "").map(c => ({ name: c.name, type: c.type, pos: c.position, uuid: c.uuid, childrenCount: c.children.length })))()`,
    returnByValue: true
  });
  console.log("=== DIRECT SCENE SEDANS ===", JSON.stringify(sedanList, null, 2));

  const result = await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
      const renderer = eng.renderer;
      const scene = eng.scene;
      const mainCamera = eng.camera;

      // Hook renderBufferDirect
      const origRenderBufferDirect = renderer.renderBufferDirect.bind(renderer);
      const callRecords = [];
      let shadowCalls = 0;
      let mainCalls = 0;
      const callsBySystem = {};
      const shadowCallsBySystem = {};
      const otherDetails = {};

      function getSystem(obj) {
        let curr = obj;
        while (curr) {
          if (curr.name === "building-interiors-root") return "building-interiors";
          if (curr.name === "traffic-system-root") return "traffic-system";
          if (curr.name === "pedestrian-system-root") return "pedestrian-system";
          if (curr.name === "AbujaStreamingWorldRoot") return "abuja-streaming";
          if (curr.name === "AbujaWorldRoot") return "abuja-world-static";
          if (curr.name === "keke-napep-root" || curr.name === "delivery-van-root" || curr.name === "pickup-truck-root" || curr.name === "commuter-minibus-root" || curr.name === "freight-truck-root") return "player-vehicles";
          if (curr.name && (curr.name.startsWith("neighborhood-static-") || curr.name.startsWith("cell-"))) return "kano-or-abuja-cells";
          curr = curr.parent;
        }
        return "other";
      }

      renderer.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
        const isShadow = (camera !== mainCamera);
        const sys = getSystem(object);
        if (isShadow) {
          shadowCalls++;
          shadowCallsBySystem[sys] = (shadowCallsBySystem[sys] || 0) + 1;
        } else {
          mainCalls++;
          callsBySystem[sys] = (callsBySystem[sys] || 0) + 1;
        }
        if (sys === "other") {
          const pName = object.parent ? (object.parent.name || "unnamed_parent") : "no_parent";
          const gpName = object.parent && object.parent.parent ? (object.parent.parent.name || "unnamed_gp") : "no_gp";
          const key = object.name + " -> " + pName + " -> " + gpName;
          otherDetails[key] = (otherDetails[key] || 0) + 1;
        }
        origRenderBufferDirect(camera, scene, geometry, material, object, group);
      };

      renderer.info.reset();
      renderer.render(scene, mainCamera);

      // Restore
      renderer.renderBufferDirect = origRenderBufferDirect;

      return {
        totalCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        shadowCalls,
        mainCalls,
        callsBySystem,
        shadowCallsBySystem,
        otherDetails
      };
    })()`,
    returnByValue: true
  });

  console.log("=== FRAME RENDER CALL BREAKDOWN ===");
  console.log(JSON.stringify(result, null, 2));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
