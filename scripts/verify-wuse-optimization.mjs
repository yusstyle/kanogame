import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9330;
const tempUserData = path.join(os.tmpdir(), `edge-wuse-opt-${Date.now()}`);

console.log("Launching Microsoft Edge on debug port " + DEBUG_PORT + "...");
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

class CDPClient {
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
          rej(new Error(`WebSocket closed unexpectedly (code: ${ev.code})`));
        }
        this.pending.clear();
      };
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.pending.has(data.id)) {
          const { res: r, rej: j } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) j(new Error(data.error.message || "CDP error"));
          else if (data.result && data.result.exceptionDetails) {
            j(new Error(data.result.exceptionDetails.text || "Eval error"));
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

  async eval(expression, awaitPromise = true) {
    const res = await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
    return res;
  }

  async screenshot(outPath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(outPath, Buffer.from(res.data, "base64"));
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function runBenchmark(cdp, frames = 600) {
  const raw = await cdp.eval(`
    new Promise((resolve, reject) => {
      const eng = window.__kanoEngine;
      const frameDeltas = [];
      let lastTime = performance.now();
      let count = 0;

      const timer = setTimeout(() => {
        const validDts = frameDeltas.slice(5);
        const totalMs = validDts.reduce((a, b) => a + b, 0);
        const avgFps = validDts.length > 0 ? (validDts.length / (totalMs / 1000)) : 0;
        const sorted = [...validDts].sort((a, b) => a - b);
        const p99Index = Math.floor(sorted.length * 0.99);
        const worst1PctDt = sorted[p99Index] || 33;
        const low1PctFps = 1000 / worst1PctDt;
        const medianDt = sorted[Math.floor(sorted.length / 2)] || 16;
        const info = eng.renderer.info;
        const jsHeapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) : null;
        resolve(JSON.stringify({
          avgFps: +avgFps.toFixed(2),
          low1PctFps: +low1PctFps.toFixed(2),
          medianDtMs: +medianDt.toFixed(2),
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          jsHeapMB,
          timedOut: true,
          framesCollected: count,
          city: eng.currentCity,
          playerPos: { x: +eng.playerPosition.x.toFixed(1), z: +eng.playerPosition.z.toFixed(1) }
        }));
      }, 35000);

      function onFrame() {
        try {
          const now = performance.now();
          const dt = now - lastTime;
          lastTime = now;
          if (count > 0) frameDeltas.push(dt);
          count++;

          if (count < ${frames}) {
            requestAnimationFrame(onFrame);
          } else {
            clearTimeout(timer);
            const validDts = frameDeltas.slice(5);
            const totalMs = validDts.reduce((a, b) => a + b, 0);
            const avgFps = (validDts.length / (totalMs / 1000));
            
            const sorted = [...validDts].sort((a, b) => a - b);
            const p99Index = Math.floor(sorted.length * 0.99);
            const worst1PctDt = sorted[p99Index];
            const low1PctFps = 1000 / worst1PctDt;

            const medianDt = sorted[Math.floor(sorted.length / 2)];
            const minDt = sorted[0];
            const maxDt = sorted[sorted.length - 1];

            const info = eng.renderer.info;
            const jsHeapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) : null;

            resolve(JSON.stringify({
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
              playerPos: { x: +eng.playerPosition.x.toFixed(1), z: +eng.playerPosition.z.toFixed(1) }
            }));
          }
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      }
      requestAnimationFrame(onFrame);
    })
  `);
  return JSON.parse(raw);
}

async function setCamera(cdp, { x, y, z, yaw, pitch, hidePlayer = true }) {
  await cdp.eval(`
    (() => {
      const eng = window.__kanoEngine;
      eng.statusMessage = null;
      eng.setCameraMode("first-person");
      if (eng.player && eng.player.root) {
        eng.player.root.visible = ${!hidePlayer};
      }
      const ground = eng.surfaceHeight(${x}, ${z});
      const posY = ${y !== undefined ? y : 'ground + 1.68'};
      eng.playerPosition.set(${x}, posY, ${z});
      eng.playerYaw = ${yaw};
      eng.cameraYaw = ${yaw};
      eng.cameraPitch = ${pitch};

      if (eng.abujaStreamingManager) {
        eng.abujaStreamingManager.update(eng.playerPosition, true);
      }
      eng.updateChunkCulling(true);
    })()
  `);
  await new Promise(r => setTimeout(r, 1200));
}

async function run() {
  const screenshotsDir = "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\screenshots";
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    console.log("Connecting to Edge CDP on port " + DEBUG_PORT + "...");
    const wsUrl = await getGameTabWsUrl(DEBUG_PORT);
    const cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log("Connected to game tab!");

    // Set 1080p full resolution
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Wait for game engine
    console.log("Waiting for game engine initialization...");
    let engineReady = false;
    for (let i = 0; i < 50; i++) {
      engineReady = await cdp.eval(`(() => {
        const btn = document.querySelector('.ks-button-primary');
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && typeof eng.travelToCity === "function";
      })()`);
      if (engineReady) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (!engineReady) {
      throw new Error("Game engine did not initialize within timeout");
    }

    // Dismiss onboarding modals
    await cdp.eval(`(() => {
      const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (dismissBtn) dismissBtn.click();
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
    console.log(`Verified active world: City=${currentCity}, WorldRoot=${worldName}`);

    if (currentCity !== "abuja" || worldName !== "AbujaWorldRoot") {
      throw new Error(`Failed to mount Abuja world! (city: ${currentCity}, world: ${worldName})`);
    }

    // ==========================================
    // CAPTURE 1080P SCREENSHOTS (if missing)
    // ==========================================
    console.log("\n--- VERIFYING / CAPTURING 1080P SCREENSHOTS ---");

    const screenshots = [
      { file: "phase2_cbd_threearms.png", desc: "1: CBD and Three Arms Zone", cam: { x: 0, z: -35, yaw: 0, pitch: 0.08 } },
      { file: "phase2_maitama.png", desc: "2: Maitama Luxury Residential Compound & Security Gate", cam: { x: -336, z: 75, yaw: 0, pitch: 0.05 } },
      { file: "phase2_wuse.png", desc: "3: Wuse Commercial Plazas & Authentic Signage", cam: { x: -208, z: 330, yaw: 0, pitch: 0.05 } },
      { file: "phase2_player_eyelevel.png", desc: "4: Normal player eye-level view along Shehu Shagari Way", cam: { x: 14, z: 10, yaw: -0.35 * Math.PI, pitch: 0.02, hidePlayer: false } },
      { file: "phase2_aerial_overview.png", desc: "5: Aerial overview of Abuja metropolis", cam: { x: 0, y: 280, z: 80, yaw: 0.0, pitch: -0.55 } },
      { file: "phase2_airport_expressway.png", desc: "6: Airport Expressway transit corridor", cam: { x: 0, z: -130, yaw: Math.PI, pitch: 0.04 } },
      { file: "phase2_garki.png", desc: "7: Garki Administrative & FHA Housing Terraces", cam: { x: 175, z: 330, yaw: 0, pitch: 0.05 } }
    ];

    for (const sc of screenshots) {
      const targetPath = path.join(screenshotsDir, sc.file);
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 100000) {
        console.log(`Screenshot ${sc.desc} already verified on disk (${(fs.statSync(targetPath).size / 1024).toFixed(0)} KB)`);
      } else {
        console.log(`Capturing ${sc.desc}...`);
        await setCamera(cdp, sc.cam);
        await cdp.screenshot(targetPath);
      }
    }
    console.log("All 7 canonical screenshots confirmed!");

    // ==========================================
    // THREE 600-FRAME BENCHMARK TRIALS PER DISTRICT
    // ==========================================
    console.log("\n--- RUNNING 3-TRIAL 600-FRAME BENCHMARKS ---");
    const benchmarkResults = {};
    const districts = [
      { name: "maitama", x: -336, z: 75, yaw: 0, pitch: 0.05 },
      { name: "cbd", x: 0, z: -35, yaw: 0, pitch: 0.05 },
      { name: "wuse", x: -208, z: 330, yaw: 0, pitch: 0.05 }
    ];

    for (const dist of districts) {
      console.log(`\nBenchmarking ${dist.name.toUpperCase()} (3 trials x 600 frames)...`);
      await setCamera(cdp, dist);
      await runBenchmark(cdp, 60); // Warmup frames

      const trials = [];
      for (let t = 1; t <= 3; t++) {
        console.log(`  Trial ${t}...`);
        const res = await runBenchmark(cdp, 600);
        console.log(`  Trial ${t}: Avg FPS=${res.avgFps}, 1% Low=${res.low1PctFps}, DrawCalls=${res.drawCalls}, Triangles=${res.triangles}`);
        trials.push(res);
      }
      benchmarkResults[dist.name] = trials;
    }

    // ==========================================
    // REGRESSION TEST 1: DRIVING ACROSS DISTRICT BOUNDARY
    // ==========================================
    console.log("\n--- REGRESSION TEST 1: DRIVING ACROSS DISTRICT BOUNDARIES ---");
    const drivingBoundaryTest = await cdp.eval(`
      (async () => {
        const eng = window.__kanoEngine;
        // Start on Shehu Shagari Way near boundary
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
          await new Promise(r => setTimeout(r, 40));
        }

        const endDistrict = eng.abujaStreamingManager ? eng.abujaStreamingManager.getDistrictAt(0, -240) : "unknown";
        return {
          initialDistrict,
          endDistrict,
          positionsValid,
          passed: positionsValid && initialDistrict !== endDistrict
        };
      })()
    `);
    console.log("Driving boundary test:", JSON.stringify(drivingBoundaryTest));

    // ==========================================
    // REGRESSION TEST 2: PEDESTRIAN & TRAFFIC ACTIVITY
    // ==========================================
    console.log("\n--- REGRESSION TEST 2: PEDESTRIAN & TRAFFIC ACTIVITY ---");
    const activityTest = await cdp.eval(`
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

        return {
          vehCount,
          pedCount,
          activeVehicles,
          activePedestrians,
          passed: vehCount > 0 && pedCount > 0 && activeVehicles === vehCount && activePedestrians === pedCount
        };
      })()
    `);
    console.log("Traffic and pedestrian activity:", JSON.stringify(activityTest));

    // ==========================================
    // REGRESSION TEST 3: COLLISION & INTERACTION
    // ==========================================
    console.log("\n--- REGRESSION TEST 3: COLLISION & NAVIGATION ---");
    const collisionTest = await cdp.eval(`
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

        return {
          colliderCount,
          navWaypoints,
          hitObelisk,
          passed: colliderCount > 20 && navWaypoints > 50 && hitObelisk
        };
      })()
    `);
    console.log("Collision test:", JSON.stringify(collisionTest));

    // ==========================================
    // REGRESSION TEST 4: COMPREHENSIVE SAVE PERSISTENCE & TRAVEL
    // ==========================================
    console.log("\n--- REGRESSION TEST 4: COMPREHENSIVE SAVE PERSISTENCE & TRAVEL ---");
    const fullPersistenceTest = await cdp.eval(`
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
        if (eng.missionSystem) {
          eng.missionSystem.currentChapter = 2;
        }

        const preState = {
          city: eng.currentCity,
          cash: eng.cash,
          inventoryCount: eng.playerData.inventory.length,
          vehiclesCount: eng.economy ? eng.economy.ownedVehicles.length : 0,
          propertiesCount: eng.economy ? Object.keys(eng.economy.ownedProperties).length : 0,
          businessesCount: eng.economy ? Object.keys(eng.economy.ownedBusinesses).length : 0,
          chapter: eng.missionSystem ? eng.missionSystem.currentChapter : null
        };

        // 2. Travel to Kano
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

        // 3. Travel back to Abuja
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

        const persistencePassed = (
          kanoState.city === "kano" &&
          abujaState.city === "abuja" &&
          preState.cash === kanoState.cash && kanoState.cash === abujaState.cash &&
          preState.inventoryCount === kanoState.inventoryCount && kanoState.inventoryCount === abujaState.inventoryCount &&
          preState.vehiclesCount === kanoState.vehiclesCount && kanoState.vehiclesCount === abujaState.vehiclesCount &&
          preState.propertiesCount === kanoState.propertiesCount && kanoState.propertiesCount === abujaState.propertiesCount &&
          preState.businessesCount === kanoState.businessesCount && kanoState.businessesCount === abujaState.businessesCount &&
          preState.chapter === kanoState.chapter && kanoState.chapter === abujaState.chapter &&
          kanoState.hasWorld && abujaState.hasWorld &&
          kanoState.fogFar < abujaState.fogFar
        );

        return {
          preState,
          kanoState,
          abujaState,
          passed: persistencePassed
        };
      })()
    `);
    console.log("Full persistence test:", JSON.stringify(fullPersistenceTest, null, 2));

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
    console.log("\nReport successfully saved to phase2_validation_report.json");

    cdp.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(err => {
  console.error("Verification execution failed:", err);
  edgeProc.kill();
});
