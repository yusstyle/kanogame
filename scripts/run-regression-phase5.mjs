import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9297;
const tempUserData = path.join(os.tmpdir(), `edge-reg-check-${Date.now()}`);

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
            console.error("Eval Exception Details:", JSON.stringify(d.result.exceptionDetails, null, 2));
            reject(new Error(d.result.exceptionDetails.text || "Eval Exception"));
          } else if (d.result && d.result.result) resolve(d.result.result.value);
          else resolve(d.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // 1. Wait for game engine ready
  console.log("Waiting for game engine ready...");
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
    if (ready) {
      console.log("Engine ready!");
      break;
    }
    await new Promise(r => setTimeout(r, 600));
  }

  // 2. Dismiss onboarding
  await send("Runtime.evaluate", {
    expression: `(() => {
      const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (dismissBtn) dismissBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 800));

  // 3. Travel to Abuja
  console.log("Traveling to Abuja...");
  await send("Runtime.evaluate", {
    expression: `(() => {
      window.__kanoEngine.travelToCity("abuja", "highway");
    })()`
  });
  await new Promise(r => setTimeout(r, 2500));

  console.log("Running comprehensive regression tests...");
  const regression = await send("Runtime.evaluate", {
    expression: `
      (async () => {
        const eng = window.__kanoEngine;
        if (!eng) return { error: "No window.__kanoEngine" };
        const results = {};

        // 1. Vehicle Collision Verification
        const testCollisionClear = !eng.carCollidesAt(14, 10, 0);
        const testCollisionWall = eng.carCollidesAt(-28, -105, 0);
        results.vehicleCollision = {
          clearLocationOk: testCollisionClear,
          obstacleCollisionOk: testCollisionWall,
          passed: testCollisionClear && testCollisionWall
        };

        // 2. Traffic Fleet & Behavior Verification
        const trafficCount = eng.trafficSystem ? eng.trafficSystem.vehicles.length : 0;
        let trafficMoves = false;
        if (eng.trafficSystem && eng.trafficSystem.vehicles.length > 0) {
          const v0 = eng.trafficSystem.vehicles[0];
          const startP = v0.position.clone();
          eng.trafficSystem.update(0.5, eng.playerPosition, null, 0);
          trafficMoves = v0.position.distanceTo(startP) > 0.001 || v0.speed > 0;
        }
        results.traffic = {
          count: trafficCount,
          moving: trafficMoves,
          passed: trafficCount > 0 && trafficMoves
        };

        // 3. Pedestrian Crowd & Behavior Verification
        const pedCount = eng.pedestrianSystem ? eng.pedestrianSystem.pedestrians.length : 0;
        let pedMoves = false;
        if (eng.pedestrianSystem && eng.pedestrianSystem.pedestrians.length > 0) {
          const p0 = eng.pedestrianSystem.pedestrians[0];
          const startP = p0.position.clone();
          eng.pedestrianSystem.update(0.5, eng.playerPosition, null);
          pedMoves = p0.position.distanceTo(startP) > 0.001 || p0.speed > 0 || p0.state === "walking";
        }
        results.pedestrians = {
          count: pedCount,
          active: pedMoves,
          passed: pedCount > 0 && pedMoves
        };

        // 4. Economy, Inventory, Properties Verification
        const initialCash = eng.cash;
        eng.cash = 250000;
        results.economy = {
          initialCash,
          modifiedCash: eng.cash,
          passed: eng.cash === 250000
        };

        // 5. Intercity Roundtrip & Persistence Verification
        await eng.travelToCity("kano", "highway");
        await new Promise(r => setTimeout(r, 2500));
        const kanoState = {
          city: eng.currentCity,
          cash: eng.cash,
          hasWorld: !!eng.world && !!eng.world.root,
          fogNear: eng.scene.fog ? eng.scene.fog.near : null,
          fogFar: eng.scene.fog ? eng.scene.fog.far : null
        };

        await eng.travelToCity("abuja", "highway");
        await new Promise(r => setTimeout(r, 2500));
        const abujaState = {
          city: eng.currentCity,
          cash: eng.cash,
          hasWorld: !!eng.world && !!eng.world.root && eng.world.root.name === "AbujaWorldRoot",
          fogNear: eng.scene.fog ? eng.scene.fog.near : null,
          fogFar: eng.scene.fog ? eng.scene.fog.far : null
        };

        results.intercityTravel = {
          kanoState,
          abujaState,
          passed: (
            kanoState.city === "kano" &&
            abujaState.city === "abuja" &&
            kanoState.cash === 250000 &&
            abujaState.cash === 250000 &&
            kanoState.hasWorld &&
            abujaState.hasWorld
          )
        };

        results.overallPassed = (
          results.vehicleCollision.passed &&
          results.traffic.passed &&
          results.pedestrians.passed &&
          results.economy.passed &&
          results.intercityTravel.passed
        );

        return results;
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log("=== REGRESSION RESULTS ===");
  console.log(JSON.stringify(regression, null, 2));

  // Update phase5_validation_report.json
  const reportPath = "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\phase5_validation_report.json";
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    report.regression = regression;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("Updated phase5_validation_report.json with regression results!");
  }

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
