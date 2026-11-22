import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9260;
const tempUserData = path.join(os.tmpdir(), `edge-phase3-verify-${Date.now()}`);

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
  const accessibleDir = "c:\\Users\\USER\\Downloads\\Kano-3D-Neighborhood-Game\\phase3_screenshots";
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
    // CAPTURE 1080P CANONICAL PHASE 3 SCREENSHOTS
    // ==========================================
    console.log("\n--- CAPTURING FRESH 1080P PHASE 3 SCREENSHOTS ---");

    // 1: CBD and Three Arms Zone (Daytime)
    console.log("Capturing 1: CBD and Three Arms Zone...");
    await setCamera(cdp, { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    await saveScreenshots("phase3_cbd_threearms.png");

    // 2: Maitama Luxury Residential Compound & Security Gate
    console.log("Capturing 2: Maitama Luxury Residential Compound & Security Gate...");
    await setCamera(cdp, { x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 });
    await saveScreenshots("phase3_maitama.png");

    // 3: Wuse Commercial Plazas & Authentic Signage
    console.log("Capturing 3: Wuse Commercial Plazas & Authentic Signage...");
    await setCamera(cdp, { x: -30, y: 1.8, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 });
    await saveScreenshots("phase3_wuse.png");

    // 4: Player eye-level street view (Daytime - showing landscaped roundabout, botanical flower beds, vegetation)
    console.log("Capturing 4: Player eye-level view along Shehu Shagari Way (Daytime)...");
    await setCamera(cdp, { x: 14, z: 10, yaw: -0.35 * Math.PI, pitch: 0.02, hidePlayer: false });
    await saveScreenshots("phase3_day_player_eyelevel.png");

    // 5: Aerial overview of Abuja metropolis
    console.log("Capturing 5: Aerial overview of Abuja metropolis...");
    await setCamera(cdp, { x: 0, y: 320, z: 120, yaw: 0.1, pitch: -0.75 });
    await saveScreenshots("phase3_aerial_overview.png");

    // 6: Airport Expressway transit corridor
    console.log("Capturing 6: Airport Expressway transit corridor...");
    await setCamera(cdp, { x: 0, y: 1.8, z: -125, yaw: Math.PI, pitch: 0.04 });
    await saveScreenshots("phase3_airport_expressway.png");

    // 7: Garki Administrative & FHA Housing Terraces
    console.log("Capturing 7: Garki Administrative & FHA Housing Terraces...");
    await setCamera(cdp, { x: 50, y: 1.8, z: 345, yaw: Math.PI, pitch: 0.08 });
    await saveScreenshots("phase3_garki.png");

    // ==========================================
    // NIGHTTIME VERIFICATION ("Cool Starlit Night")
    // ==========================================
    console.log("\nSetting Cool Starlit Night preset for nighttime lighting verification...");
    await cdp.eval(`window.__kanoEngine.setWeatherPreset("cool_night");`);
    await new Promise(r => setTimeout(r, 1500));

    // Canonical Player Eye-Level view at Night (Testing moonlight, streetlight pools, zero crushed blacks)
    console.log("Capturing canonical phase3_player_eyelevel.png (Cool Starlit Night)...");
    await setCamera(cdp, { x: 14, z: 10, yaw: -0.35 * Math.PI, pitch: 0.02, hidePlayer: false });
    await saveScreenshots("phase3_player_eyelevel.png");

    // CBD Night view
    console.log("Capturing CBD Three Arms at Night...");
    await setCamera(cdp, { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    await saveScreenshots("phase3_night_cbd.png");

    // Switch back to clear for benchmarking
    await cdp.eval(`window.__kanoEngine.setWeatherPreset("clear");`);
    await new Promise(r => setTimeout(r, 1200));

    // ==========================================
    // THREE 600-FRAME BENCHMARK TRIALS
    // ==========================================
    console.log("\n--- RUNNING 3-TRIAL 600-FRAME BENCHMARKS ---");
    const benchmarkResults = {};
    const districts = [
      { name: "maitama", x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 },
      { name: "cbd", x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 },
      { name: "wuse", x: -30, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 }
    ];

    for (const dist of districts) {
      console.log(`\nBenchmarking ${dist.name.toUpperCase()} (3 trials x 600 frames)...`);
      await setCamera(cdp, dist);
      await runBenchmark(cdp, 60); // Warmup

      const trials = [];
      for (let t = 1; t <= 3; t++) {
        console.log(`  Trial ${t}...`);
        const res = await runBenchmark(cdp, 600);
        console.log(`  Trial ${t}:`, JSON.stringify(res));
        trials.push(res);
      }
      benchmarkResults[dist.name] = trials;
    }

    // ==========================================
    // INTERCITY REGRESSION & PERSISTENCE TEST
    // ==========================================
    console.log("\n--- INTERCITY PERSISTENCE & REGRESSION TEST ---");
    const regression = await cdp.eval(`
      (async () => {
        const eng = window.__kanoEngine;
        const initial = {
          city: eng.currentCity,
          cash: eng.cash,
          inventoryLength: (eng.playerData && eng.playerData.inventory) ? eng.playerData.inventory.length : 0,
          ownedVehiclesCount: eng.economy ? eng.economy.ownedVehicles.length : 0,
          ownedPropertiesCount: eng.economy ? eng.economy.getOwnedPropertiesList().length : 0,
          ownedBusinessesCount: eng.economy ? eng.economy.getOwnedBusinessesList().length : 0,
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
        };

        return {
          initial,
          kanoState,
          abujaState,
          passed: (
            kanoState.city === "kano" &&
            abujaState.city === "abuja" &&
            initial.cash === kanoState.cash && kanoState.cash === abujaState.cash &&
            kanoState.hasWorld && abujaState.hasWorld
          )
        };
      })()
    `);
    console.log("Regression result:", JSON.stringify(regression, null, 2));

    const finalReport = {
      timestamp: new Date().toISOString(),
      benchmarkResults,
      regression
    };

    fs.writeFileSync(
      "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\phase3_validation_report.json",
      JSON.stringify(finalReport, null, 2)
    );
    console.log("\nReport successfully saved to phase3_validation_report.json");

    cdp.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
