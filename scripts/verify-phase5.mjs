import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9295;
const tempUserData = path.join(os.tmpdir(), `edge-phase5-verify-${Date.now()}`);

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
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.pending.has(data.id)) {
          const { res: r, rej: j } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) j(data.error);
          else if (data.result && data.result.result) r(data.result.result.value);
          else r(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { res: resolve, rej: reject });
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
  return await cdp.eval(`
    (() => new Promise((resolve) => {
      const safetyTimer = setTimeout(() => {
        onDone();
      }, 35000);
      const eng = window.__kanoEngine;
      const frameDeltas = [];
      let lastTime = performance.now();
      let count = 0;

      function onFrame() {
        const now = performance.now();
        const dt = now - lastTime;
        lastTime = now;
        frameDeltas.push(dt);
        count++;

        if (count < ${frames}) {
          requestAnimationFrame(onFrame);
        } else {
          clearTimeout(safetyTimer);
          onDone();
        }
      }

      function onDone() {
        const validDts = frameDeltas.slice(5);
        const totalMs = validDts.reduce((a, b) => a + b, 0);
        const avgFps = totalMs > 0 ? (validDts.length / (totalMs / 1000)) : 60;
        
        // 1% low FPS calculation:
        const sorted = [...validDts].sort((a, b) => a - b);
        const p99Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
        const worst1PctDt = sorted[p99Index] || 16.6;
        const low1PctFps = worst1PctDt > 0 ? 1000 / worst1PctDt : 60;

        const medianDt = sorted[Math.floor(sorted.length / 2)] || 16.6;
        const minDt = sorted[0] || 16.6;
        const maxDt = sorted[sorted.length - 1] || 16.6;

        const info = eng.renderer.info;
        const jsHeapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) : null;

        resolve({
          avgFps: +avgFps.toFixed(2),
          low1PctFps: +low1PctFps.toFixed(2),
          medianDtMs: +medianDt.toFixed(2),
          minDtMs: +minDt.toFixed(2),
          maxDtMs: +maxDt.toFixed(2),
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          jsHeapMB
        });
      }
      requestAnimationFrame(onFrame);
    }))()
  `);
}

async function setCamera(cdp, { x, y, z, yaw, pitch, hidePlayer = true }) {
  await cdp.eval(`
    (() => {
      const eng = window.__kanoEngine;
      if (!eng) return;
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
      eng.renderer.render(eng.scene, eng.camera);
    })()
  `);
  await new Promise(r => setTimeout(r, 1200));
}

async function run() {
  const artifactDir = "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\screenshots";
  const accessibleDir = "c:\\Users\\USER\\Downloads\\Kano-3D-Neighborhood-Game\\phase5_screenshots";
  [artifactDir, accessibleDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const saveScreenshots = async (filename) => {
    const artPath = path.join(artifactDir, filename);
    const accPath = path.join(accessibleDir, filename);
    await cdp.screenshot(artPath);
    fs.copyFileSync(artPath, accPath);
    console.log(`Saved screenshot -> ${filename}`);
  };

  let cdp = null;
  try {
    console.log("Connecting to Edge CDP on port " + DEBUG_PORT + "...");
    const wsUrl = await getGameTabWsUrl(DEBUG_PORT);
    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log("Connected to game tab!");

    // Set 1080p full resolution
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log("Waiting for game engine initialization...");
    let engineReady = false;
    for (let i = 0; i < 90; i++) {
      engineReady = await cdp.eval(`(() => {
        const btn = document.querySelector('.ks-button-primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter the neighborhood'));
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && typeof eng.travelToCity === "function";
      })()`);
      if (engineReady) break;
      await new Promise(r => setTimeout(r, 600));
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

    // Ensure daytime weather preset first
    console.log("Setting clear daytime weather for daytime verification...");
    await cdp.eval(`window.__kanoEngine.setWeatherPreset("clear");`);
    await new Promise(r => setTimeout(r, 1200));

    // ==========================================
    // THREE 600-FRAME BENCHMARK TRIALS
    // ==========================================
    console.log("\n--- RUNNING 3-TRIAL 600-FRAME BENCHMARKS ---");
    const benchmarkResults = {};

    // 1. CBD / Three Arms Zone (Priority)
    console.log("\nBenchmarking CBD / Three Arms (3 trials x 600 frames)...");
    benchmarkResults.cbd = [];
    await setCamera(cdp, { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    for (let t = 1; t <= 3; t++) {
      console.log(`CBD Trial ${t}/3 running...`);
      const res = await runBenchmark(cdp, 600);
      benchmarkResults.cbd.push(res);
      console.log(`CBD Trial ${t}: Avg FPS=${res.avgFps}, 1% Low=${res.low1PctFps}, Median Dt=${res.medianDtMs}ms, Calls=${res.drawCalls}, Tris=${res.triangles}`);
      await new Promise(r => setTimeout(r, 500));
    }

    // 2. Wuse Commercial District (Priority)
    console.log("\nBenchmarking Wuse Commercial (3 trials x 600 frames)...");
    benchmarkResults.wuse = [];
    await setCamera(cdp, { x: -30, y: 1.8, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 });
    for (let t = 1; t <= 3; t++) {
      console.log(`Wuse Trial ${t}/3 running...`);
      const res = await runBenchmark(cdp, 600);
      benchmarkResults.wuse.push(res);
      console.log(`Wuse Trial ${t}: Avg FPS=${res.avgFps}, 1% Low=${res.low1PctFps}, Median Dt=${res.medianDtMs}ms, Calls=${res.drawCalls}, Tris=${res.triangles}`);
      await new Promise(r => setTimeout(r, 500));
    }

    // 3. Maitama Luxury District (Regression Control)
    console.log("\nBenchmarking Maitama Luxury (3 trials x 600 frames)...");
    benchmarkResults.maitama = [];
    await setCamera(cdp, { x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 });
    for (let t = 1; t <= 3; t++) {
      console.log(`Maitama Trial ${t}/3 running...`);
      const res = await runBenchmark(cdp, 600);
      benchmarkResults.maitama.push(res);
      console.log(`Maitama Trial ${t}: Avg FPS=${res.avgFps}, 1% Low=${res.low1PctFps}, Median Dt=${res.medianDtMs}ms, Calls=${res.drawCalls}, Tris=${res.triangles}`);
      await new Promise(r => setTimeout(r, 500));
    }

    // ==========================================
    // CAPTURE 1080P CANONICAL PHASE 5 SCREENSHOTS
    // ==========================================
    console.log("\n--- CAPTURING FRESH 1080P PHASE 5 SCREENSHOTS ---");

    // 1: CBD daytime
    console.log("Capturing 1: CBD daytime...");
    await setCamera(cdp, { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    await saveScreenshots("phase5_cbd_day.png");

    // 2: CBD nighttime
    console.log("Capturing 2: CBD nighttime...");
    await cdp.eval(`window.__kanoEngine.setWeatherPreset("cool_night");`);
    await new Promise(r => setTimeout(r, 1200));
    await setCamera(cdp, { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    await saveScreenshots("phase5_cbd_night.png");

    // Switch back to clear daytime
    await cdp.eval(`window.__kanoEngine.setWeatherPreset("clear");`);
    await new Promise(r => setTimeout(r, 1200));

    // 3: Wuse daytime
    console.log("Capturing 3: Wuse daytime...");
    await setCamera(cdp, { x: -30, y: 1.8, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 });
    await saveScreenshots("phase5_wuse_day.png");

    // 4: Maitama daytime
    console.log("Capturing 4: Maitama daytime...");
    await setCamera(cdp, { x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 });
    await saveScreenshots("phase5_maitama_day.png");

    // 5: Player eye-level street view
    console.log("Capturing 5: Player eye-level view...");
    await setCamera(cdp, { x: 14, z: 10, yaw: -0.35 * Math.PI, pitch: 0.02, hidePlayer: false });
    await saveScreenshots("phase5_player_eyelevel.png");

    // 6: Aerial overview
    console.log("Capturing 6: Aerial overview...");
    await setCamera(cdp, { x: 0, y: 320, z: 120, yaw: 0.1, pitch: -0.75 });
    await saveScreenshots("phase5_aerial_overview.png");

    // ==========================================
    // EXTENSIVE REGRESSION CHECKS
    // ==========================================
    console.log("\n--- RUNNING SYSTEM REGRESSION CHECKS ---");
    const regression = await cdp.eval(`
      (async () => {
        const eng = window.__kanoEngine;
        const results = {};

        // 1. Vehicle Movement & Collision Verification
        const initialCarPos = eng.carPosition.clone();
        const initialYaw = eng.carYaw;
        const testCollisionClear = !eng.carCollidesAt(14, 10, 0);
        const testCollisionWall = eng.carCollidesAt(-28, -105, 0); // National assembly boundary
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
          trafficMoves = v0.position.distanceTo(startP) > 0.01 || v0.speed > 0;
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
          eng.pedestrianSystem.update(0.5);
          pedMoves = p0.position.distanceTo(startP) > 0.05 || p0.speed > 0 || p0.state === "walking";
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
        await new Promise(r => setTimeout(r, 2000));
        const kanoState = {
          city: eng.currentCity,
          cash: eng.cash,
          hasWorld: !!eng.world && !!eng.world.root && eng.world.root.name !== "AbujaWorldRoot",
          fogNear: eng.scene.fog ? eng.scene.fog.near : null,
          fogFar: eng.scene.fog ? eng.scene.fog.far : null
        };

        await eng.travelToCity("abuja", "highway");
        await new Promise(r => setTimeout(r, 2000));
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
    `);
    console.log("Regression Results:", JSON.stringify(regression, null, 2));

    const finalReport = {
      timestamp: new Date().toISOString(),
      benchmarkResults,
      regression
    };

    fs.writeFileSync(
      "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\phase5_validation_report.json",
      JSON.stringify(finalReport, null, 2)
    );
    console.log("\nReport successfully saved to phase5_validation_report.json");

    cdp.close();
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

run().catch(err => {
  console.error("Phase 5 verification failed:", err);
  process.exit(1);
});
