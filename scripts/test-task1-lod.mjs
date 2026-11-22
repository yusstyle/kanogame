import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9310;
const tempUserData = path.join(os.tmpdir(), `edge-task1-lod-${Date.now()}`);

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
          else if (d.result && d.result.exceptionDetails) {
            reject(new Error(JSON.stringify(d.result.exceptionDetails)));
          } else if (d.result && d.result.result) resolve(d.result.result.value);
          else resolve(d.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // Wait for game ready
  console.log("Waiting for game ready...");
  for (let i = 0; i < 90; i++) {
    const ready = await send("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('.ks-button-primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter the neighborhood'));
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && !!eng.car && typeof eng.travelToCity === "function";
      })()`,
      returnByValue: true
    });
    if (ready) break;
    await new Promise(r => setTimeout(r, 600));
  }

  // Dismiss modals
  await send("Runtime.evaluate", {
    expression: `(() => {
      const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (dismissBtn) dismissBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 800));

  // Run Task 1 tests
  console.log("Running comprehensive Task 1 LOD verification...");
  const results = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const eng = window.__kanoEngine;
        const car = eng.car;
        if (!car || !car.gltfBody) return { error: "No car or gltfBody" };

        const testResults = {};

        // Helper to count visible meshes and categorize
        function analyzeMeshes() {
          let totalMeshes = 0;
          let visibleMeshes = 0;
          let lod0Count = 0;
          let lod1Count = 0;
          let lod2Count = 0;
          let visibleLod0 = 0;
          let visibleLod1 = 0;
          let visibleLod2 = 0;
          const visibleNames = [];

          car.gltfBody.traverse(child => {
            if (child.isMesh) {
              totalMeshes++;
              const minL = child.userData.lodMinLevel;
              if (minL === 0) lod0Count++;
              if (minL === 1) lod1Count++;
              if (minL === 2) lod2Count++;

              if (child.visible) {
                visibleMeshes++;
                if (minL === 0) visibleLod0++;
                if (minL === 1) visibleLod1++;
                if (minL === 2) visibleLod2++;
                visibleNames.push(child.name);
              }
            }
          });

          return {
            totalMeshes,
            visibleMeshes,
            distribution: { lod0: lod0Count, lod1: lod1Count, lod2: lod2Count },
            visibleDistribution: { lod0: visibleLod0, lod1: visibleLod1, lod2: visibleLod2 },
            sampleVisible: visibleNames.slice(0, 10)
          };
        }

        // Test A: LOD 0
        car.setLODLevel(0);
        testResults.lod0 = analyzeMeshes();
        testResults.lod0_valid = (
          testResults.lod0.visibleMeshes === testResults.lod0.totalMeshes &&
          testResults.lod0.visibleDistribution.lod0 > 0 &&
          testResults.lod0.visibleDistribution.lod1 > 0 &&
          testResults.lod0.visibleDistribution.lod2 > 0
        );

        // Test B: LOD 1
        car.setLODLevel(1);
        testResults.lod1 = analyzeMeshes();
        testResults.lod1_valid = (
          testResults.lod1.visibleDistribution.lod0 === 0 &&
          testResults.lod1.visibleDistribution.lod1 > 0 &&
          testResults.lod1.visibleDistribution.lod2 > 0
        );

        // Test C: LOD 2
        car.setLODLevel(2);
        testResults.lod2 = analyzeMeshes();
        testResults.lod2_valid = (
          testResults.lod2.visibleDistribution.lod0 === 0 &&
          testResults.lod2.visibleDistribution.lod1 === 0 &&
          testResults.lod2.visibleDistribution.lod2 === testResults.lod2.distribution.lod2 &&
          testResults.lod2.visibleMeshes === 5 // 1 body shell + 4 tires
        );

        // Test D: Repeated Switching Idempotency (0 -> 2 -> 1 -> 0 -> 2 -> 0 -> 1 -> 2 -> 0)
        const sequence = [0, 2, 1, 0, 2, 0, 1, 2, 1, 0];
        for (const lvl of sequence) {
          car.setLODLevel(lvl);
        }
        testResults.postCycleLod0 = analyzeMeshes();
        testResults.idempotency_valid = (
          testResults.postCycleLod0.visibleMeshes === testResults.lod0.totalMeshes &&
          testResults.postCycleLod0.visibleDistribution.lod0 === testResults.lod0.distribution.lod0 &&
          testResults.postCycleLod0.visibleDistribution.lod1 === testResults.lod0.distribution.lod1 &&
          testResults.postCycleLod0.visibleDistribution.lod2 === testResults.lod0.distribution.lod2
        );

        // Test E: Driving Mode Protection
        // When in driving mode, eng.updateChunkCulling must force LOD 0 regardless of distance
        eng.mode = "driving";
        eng.activeVehicle = "sedan";
        eng.playerPosition.set(1000, 0, 1000); // 1000m away
        eng.carPosition.set(0, 0, 0);
        eng.updateChunkCulling(true);
        testResults.drivingModeLod = car.gltfBody.userData.currentLOD;
        testResults.drivingModeMeshes = analyzeMeshes().visibleMeshes;
        testResults.driving_mode_valid = (
          testResults.drivingModeLod === 0 &&
          testResults.drivingModeMeshes === testResults.lod0.totalMeshes
        );

        // Test F: Traffic Vehicle Initial LOD
        // If a new vehicle is attached with isTraffic = true
        let trafficSedanAttached = null;
        if (eng.trafficSystem && eng.trafficSystem.vehicles.length > 0) {
          const sedans = eng.trafficSystem.vehicles.filter(v => v.type === "sedan");
          if (sedans.length > 0) {
            const s = sedans[0];
            const g = s.model.gltfBody;
            if (g) {
              trafficSedanAttached = {
                currentLOD: g.userData.currentLOD,
                isTraffic: g.userData.isTraffic,
                visibleMeshes: g.children.filter(c => c.visible).length
              };
            }
          }
        }
        testResults.trafficSedan = trafficSedanAttached;

        // Restore player position & mode
        eng.mode = "on-foot";
        eng.playerPosition.set(0, 0, 0);
        eng.updateChunkCulling(true);

        return testResults;
      })()
    `,
    returnByValue: true
  });

  console.log("=== TASK 1 LOD RESULTS ===");
  console.log(JSON.stringify(results, null, 2));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
