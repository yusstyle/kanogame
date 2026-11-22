import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9292;
const tempUserData = path.join(os.tmpdir(), `edge-robust-verify-${Date.now()}`);

console.log("Launching Microsoft Edge on port " + DEBUG_PORT + "...");
const edgeProc = spawn(EDGE_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${tempUserData}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1920,1080",
  GAME_URL
], { stdio: "ignore" });

async function getGameTabWsUrl(port, timeoutMs = 35000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const pageTab = list.find(t => t.type === "page" && !t.url.startsWith("edge") && !t.url.startsWith("chrome-extension"));
        if (pageTab && pageTab.webSocketDebuggerUrl) return pageTab.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Timeout connecting to Edge CDP on port ${port}`);
}

class RobustCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => res();
      this.ws.onerror = (e) => rej(e);
      this.ws.onclose = (ev) => {
        for (const [id, { rej }] of this.pending.entries()) {
          rej(new Error(`WebSocket closed unexpectedly (code: ${ev.code}, reason: ${ev.reason})`));
        }
        this.pending.clear();
      };
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.method === "Runtime.exceptionThrown") {
          console.error("  [BROWSER EXCEPTION]", JSON.stringify(data.params.exceptionDetails));
        } else if (data.method === "Runtime.consoleAPICalled") {
          const text = data.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a)).join(" ");
          if (data.params.type === "error") {
            console.error("  [BROWSER ERROR]", text);
          } else if (text.includes("FPS") || text.includes("Benchmark") || text.includes("Frame")) {
            console.log("  [BROWSER]", text);
          }
        }

        if (data.id && this.pending.has(data.id)) {
          const { res: r, rej: j } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) j(new Error(data.error.message || "CDP Error"));
          else if (data.result && data.result.exceptionDetails) {
            j(new Error(data.result.exceptionDetails.text || "Eval exception"));
          } else if (data.result && data.result.result) {
            r(data.result.result.value !== undefined ? data.result.result.value : data.result.result);
          } else r(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.nextId++;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression, timeoutMs = 45000) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CDP eval timed out after ${timeoutMs}ms: ${expression.slice(0, 100)}...`));
      }, timeoutMs);

      try {
        const res = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        clearTimeout(timer);
        resolve(res);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function run() {
  try {
    const wsUrl = await getGameTabWsUrl(DEBUG_PORT);
    const cdp = new RobustCDP(wsUrl);
    await cdp.connect();
    console.log("Connected to game tab!");

    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Wait for engine initialization
    console.log("Waiting for game engine initialization...");
    let engineReady = false;
    for (let i = 0; i < 40; i++) {
      engineReady = await cdp.eval(`(() => {
        const btn = document.querySelector('.ks-button-primary');
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && typeof eng.travelToCity === "function";
      })()`);
      if (engineReady) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (!engineReady) throw new Error("Engine not ready");

    // Dismiss modals
    await cdp.eval(`(() => {
      const btn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    // Travel to Abuja
    console.log("Traveling to Abuja...");
    for (let attempt = 0; attempt < 5; attempt++) {
      const city = await cdp.eval(`window.__kanoEngine.currentCity`);
      if (city === "abuja") break;
      await cdp.eval(`window.__kanoEngine.travelToCity("abuja", "highway");`);
      await new Promise(r => setTimeout(r, 2500));
    }

    const currentCity = await cdp.eval(`window.__kanoEngine.currentCity`);
    const worldName = await cdp.eval(`window.__kanoEngine.world ? window.__kanoEngine.world.root.name : "none"`);
    console.log(`Active world: City=${currentCity}, WorldRoot=${worldName}`);

    // Set up benchmark function in browser
    await cdp.eval(`
      window.__runBenchmarkFrames = function(targetFrames, districtName, trialIndex) {
        return new Promise((resolve) => {
          const eng = window.__kanoEngine;
          const frameDeltas = [];
          let lastTime = performance.now();
          let count = 0;

          function onFrame(now) {
            const dt = now - lastTime;
            lastTime = now;
            if (count > 0) frameDeltas.push(dt);
            count++;

            if (count % 150 === 0) {
              console.log("Benchmark " + districtName + " T" + trialIndex + " progress: " + count + "/" + targetFrames);
            }

            if (count < targetFrames) {
              requestAnimationFrame(onFrame);
            } else {
              const validDts = frameDeltas.slice(5);
              const totalMs = validDts.reduce((a, b) => a + b, 0);
              const avgFps = validDts.length / (totalMs / 1000);
              const sorted = [...validDts].sort((a, b) => a - b);
              const p99 = sorted[Math.floor(sorted.length * 0.99)];
              const low1PctFps = 1000 / p99;
              const medianDt = sorted[Math.floor(sorted.length / 2)];
              const minDt = sorted[0];
              const maxDt = sorted[sorted.length - 1];
              const info = eng.renderer.info;
              const jsHeapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) : null;

              resolve(JSON.stringify({
                district: districtName,
                trial: trialIndex,
                avgFps: +avgFps.toFixed(2),
                low1PctFps: +low1PctFps.toFixed(2),
                medianDtMs: +medianDt.toFixed(2),
                minDtMs: +minDt.toFixed(2),
                maxDtMs: +maxDt.toFixed(2),
                drawCalls: info.render.calls,
                triangles: info.render.triangles,
                geometries: info.memory.geometries,
                textures: info.memory.textures,
                jsHeapMB,
                city: eng.currentCity,
                pos: { x: +eng.playerPosition.x.toFixed(1), z: +eng.playerPosition.z.toFixed(1) }
              }));
            }
          }
          requestAnimationFrame(onFrame);
        });
      };
    `);

    const districts = [
      { name: "Maitama", x: -336, z: 75, yaw: 0, pitch: 0.05 },
      { name: "CBD", x: 0, z: -35, yaw: 0, pitch: 0.05 },
      { name: "Wuse", x: -208, z: 330, yaw: 0, pitch: 0.05 }
    ];

    const benchmarkResults = {};

    for (const d of districts) {
      console.log(`\n=== Benchmarking ${d.name} (${d.x}, ${d.z}) ===`);
      // Position camera
      await cdp.eval(`
        (() => {
          const eng = window.__kanoEngine;
          eng.setCameraMode("first-person");
          if (eng.player && eng.player.root) eng.player.root.visible = false;
          const ground = eng.surfaceHeight(${d.x}, ${d.z});
          eng.playerPosition.set(${d.x}, ground + 1.68, ${d.z});
          eng.cameraYaw = ${d.yaw};
          eng.cameraPitch = ${d.pitch};
          if (eng.abujaStreamingManager) {
            eng.abujaStreamingManager.update(eng.playerPosition, true);
          }
          eng.updateChunkCulling(true);
        })()
      `);
      await new Promise(r => setTimeout(r, 1500));

      // Warmup 60 frames
      console.log(`  Warmup 60 frames...`);
      await cdp.eval(`window.__runBenchmarkFrames(60, "${d.name}", 0)`);

      benchmarkResults[d.name] = [];
      for (let t = 1; t <= 3; t++) {
        console.log(`  Starting Trial ${t} (600 frames)...`);
        const raw = await cdp.eval(`window.__runBenchmarkFrames(600, "${d.name}", ${t})`, 60000);
        const res = JSON.parse(raw);
        console.log(`  Trial ${t} complete: Avg FPS=${res.avgFps}, 1% Low=${res.low1PctFps}, DrawCalls=${res.drawCalls}, Triangles=${res.triangles}`);
        benchmarkResults[d.name].push(res);
      }
    }

    // ==========================================
    // REGRESSION TESTS
    // ==========================================
    console.log("\n--- REGRESSION TEST 1: DRIVING ACROSS DISTRICT BOUNDARY ---");
    const drivingBoundaryTest = JSON.parse(await cdp.eval(`
      (async () => {
        const eng = window.__kanoEngine;
        eng.playerPosition.set(0, eng.surfaceHeight(0, -60), -60);
        eng.cameraYaw = 0;
        eng.updateChunkCulling(true);
        const initialDistrict = eng.abujaStreamingManager ? eng.abujaStreamingManager.getDistrictAt(0, -60) : "unknown";

        let positionsValid = true;
        for (let step = 0; step < 30; step++) {
          const z = -60 - (step * 6);
          const y = eng.surfaceHeight(0, z);
          eng.playerPosition.set(0, y, z);
          if (isNaN(eng.playerPosition.x) || isNaN(eng.playerPosition.y) || isNaN(eng.playerPosition.z)) {
            positionsValid = false;
          }
          if (eng.abujaStreamingManager) {
            eng.abujaStreamingManager.update(eng.playerPosition, false);
          }
          await new Promise(r => setTimeout(r, 30));
        }
        const endDistrict = eng.abujaStreamingManager ? eng.abujaStreamingManager.getDistrictAt(0, -240) : "unknown";
        return JSON.stringify({
          initialDistrict,
          endDistrict,
          positionsValid,
          passed: positionsValid && initialDistrict !== endDistrict
        });
      })()
    `));
    console.log("Boundary test result:", drivingBoundaryTest);

    console.log("\n--- REGRESSION TEST 2: PEDESTRIAN & TRAFFIC ACTIVITY ---");
    const activityTest = JSON.parse(await cdp.eval(`
      (() => {
        const eng = window.__kanoEngine;
        const vehCount = eng.trafficSystem ? eng.trafficSystem.vehicles.length : 0;
        const pedCount = eng.pedestrianSystem ? eng.pedestrianSystem.pedestrians.length : 0;
        let activeVehicles = 0;
        let activePedestrians = 0;
        if (eng.trafficSystem) {
          activeVehicles = eng.trafficSystem.vehicles.filter(v => v.model && v.model.root).length;
        }
        if (eng.pedestrianSystem) {
          activePedestrians = eng.pedestrianSystem.pedestrians.filter(p => p.model && p.model.root).length;
        }
        return JSON.stringify({
          vehCount,
          pedCount,
          activeVehicles,
          activePedestrians,
          passed: vehCount > 0 && pedCount > 0 && activeVehicles === vehCount && activePedestrians === pedCount
        });
      })()
    `));
    console.log("Activity test result:", activityTest);

    console.log("\n--- REGRESSION TEST 3: COLLISION & NAVIGATION ---");
    const collisionTest = JSON.parse(await cdp.eval(`
      (() => {
        const eng = window.__kanoEngine;
        const colliderCount = eng.colliders ? eng.colliders.length : 0;
        const navWaypoints = eng.navigation ? (eng.navigation.trafficWaypoints.size + eng.navigation.pedestrianWaypoints.size) : 0;
        let hitObelisk = false;
        if (eng.colliderIndex) {
          const hits = eng.colliderIndex.query(0, 0, 2.0);
          hitObelisk = hits.length > 0;
        } else if (eng.colliders) {
          hitObelisk = eng.colliders.some(c => Math.abs(c.x) <= c.halfX + 1 && Math.abs(c.z) <= c.halfZ + 1);
        }
        return JSON.stringify({
          colliderCount,
          navWaypoints,
          hitObelisk,
          passed: colliderCount > 20 && navWaypoints > 50 && hitObelisk
        });
      })()
    `));
    console.log("Collision test result:", collisionTest);

    console.log("\n--- REGRESSION TEST 4: INTERCITY SAVE PERSISTENCE ---");
    const fullPersistenceTest = JSON.parse(await cdp.eval(`
      (async () => {
        const eng = window.__kanoEngine;
        if (!eng.playerData) eng.playerData = {};
        eng.playerData.inventory = [
          { id: "test-phone", name: "Smartphone", quantity: 1 },
          { id: "test-cola", name: "Kano Cola", quantity: 3 }
        ];
        eng.cash = 250000;
        if (eng.economy) {
          eng.economy.cash = 250000;
          eng.economy.ownedVehicles = ["sedan", "keke"];
          eng.economy.ownedProperties = { "bompai-penthouse": { purchasedDay: 1, condition: 1.0, furnishings: {} } };
          eng.economy.ownedBusinesses = { "suya-spot": { level: 2, dailyRevenue: 15000, managerHired: true } };
        }
        if (eng.missionSystem) eng.missionSystem.currentChapter = 2;

        const preState = {
          city: eng.currentCity,
          cash: eng.cash,
          inventoryCount: eng.playerData.inventory.length,
          vehiclesCount: eng.economy ? eng.economy.ownedVehicles.length : 0,
          propertiesCount: eng.economy ? Object.keys(eng.economy.ownedProperties).length : 0,
          businessesCount: eng.economy ? Object.keys(eng.economy.ownedBusinesses).length : 0,
          chapter: eng.missionSystem ? eng.missionSystem.currentChapter : null
        };

        // Travel to Kano
        await eng.travelToCity("kano", "highway");
        await new Promise(r => setTimeout(r, 2500));

        const kanoState = {
          city: eng.currentCity,
          cash: eng.cash,
          hasWorld: !!eng.world && !!eng.world.root,
          fogNear: eng.scene.fog ? eng.scene.fog.near : null,
          fogFar: eng.scene.fog ? eng.scene.fog.far : null,
          inventoryCount: eng.playerData.inventory.length,
          vehiclesCount: eng.economy ? eng.economy.ownedVehicles.length : 0,
          propertiesCount: eng.economy ? Object.keys(eng.economy.ownedProperties).length : 0,
          businessesCount: eng.economy ? Object.keys(eng.economy.ownedBusinesses).length : 0,
          chapter: eng.missionSystem ? eng.missionSystem.currentChapter : null
        };

        // Travel back to Abuja
        await eng.travelToCity("abuja", "highway");
        await new Promise(r => setTimeout(r, 2500));

        const abujaState = {
          city: eng.currentCity,
          cash: eng.cash,
          hasWorld: !!eng.world && !!eng.world.root,
          fogNear: eng.scene.fog ? eng.scene.fog.near : null,
          fogFar: eng.scene.fog ? eng.scene.fog.far : null,
          inventoryCount: eng.playerData.inventory.length,
          vehiclesCount: eng.economy ? eng.economy.ownedVehicles.length : 0,
          propertiesCount: eng.economy ? Object.keys(eng.economy.ownedProperties).length : 0,
          businessesCount: eng.economy ? Object.keys(eng.economy.ownedBusinesses).length : 0,
          chapter: eng.missionSystem ? eng.missionSystem.currentChapter : null
        };

        const passed = (
          kanoState.city === "kano" &&
          abujaState.city === "abuja" &&
          preState.cash === kanoState.cash && kanoState.cash === abujaState.cash &&
          preState.inventoryCount === kanoState.inventoryCount &&
          preState.vehiclesCount === kanoState.vehiclesCount &&
          preState.propertiesCount === kanoState.propertiesCount &&
          preState.businessesCount === kanoState.businessesCount &&
          preState.chapter === kanoState.chapter &&
          kanoState.hasWorld && abujaState.hasWorld &&
          kanoState.fogFar < abujaState.fogFar
        );

        return JSON.stringify({ preState, kanoState, abujaState, passed });
      })()
    `));
    console.log("Persistence test result:", fullPersistenceTest);

    const finalReport = {
      timestamp: new Date().toISOString(),
      benchmarkResults,
      drivingBoundaryTest,
      activityTest,
      collisionTest,
      fullPersistenceTest
    };

    fs.writeFileSync(
      "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\phase2_validation_report.json",
      JSON.stringify(finalReport, null, 2)
    );
    console.log("\nSUCCESS: All benchmarks and regression tests completed!");
    console.log("Report written to phase2_validation_report.json");

    cdp.close();
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    edgeProc.kill();
  }
}

run();

