import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9286;
const tempUserData = path.join(os.tmpdir(), `edge-cbd-spikes-${Date.now()}`);

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
          else if (data.result && data.result.exceptionDetails) {
            console.error("Eval Exception Details:", JSON.stringify(data.result.exceptionDetails, null, 2));
            j(new Error(data.result.exceptionDetails.text || "Eval Exception"));
          } else if (data.result && data.result.result) r(data.result.result.value);
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

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function run() {
  let cdp = null;
  try {
    const wsUrl = await getGameTabWsUrl(DEBUG_PORT);
    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log("Connected to game tab!");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log("Waiting for game engine...");
    for (let i = 0; i < 90; i++) {
      const ready = await cdp.eval(`(() => {
        const btn = document.querySelector('.ks-button-primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter the neighborhood'));
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && typeof eng.travelToCity === "function";
      })()`);
      if (ready) break;
      await new Promise(r => setTimeout(r, 600));
    }

    // Dismiss onboarding & travel to abuja
    for (let attempt = 0; attempt < 5; attempt++) {
      const isAbuja = await cdp.eval(`(() => {
        const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
        if (dismissBtn) dismissBtn.click();
        const eng = window.__kanoEngine;
        if (!eng || !eng.travelToCity) return false;
        if (eng.currentCity === "abuja") return true;
        eng.travelToCity("abuja", "highway");
        return false;
      })()`);
      if (isAbuja) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    await new Promise(r => setTimeout(r, 2000));

    // Position at CBD
    console.log("Positioning camera at CBD...");
    await cdp.eval(`(() => {
      const eng = window.__kanoEngine;
      if (!eng) return;
      eng.statusMessage = null;
      eng.setCameraMode("first-person");
      if (eng.player && eng.player.root) eng.player.root.visible = false;
      const ground = eng.surfaceHeight(0, -62);
      eng.playerPosition.set(0, ground + 3.5, -62);
      eng.playerYaw = Math.PI;
      eng.cameraYaw = Math.PI;
      eng.cameraPitch = 0.14;
      if (eng.abujaStreamingManager) eng.abujaStreamingManager.update(eng.playerPosition, true);
      eng.updateChunkCulling(true);
      eng.renderer.render(eng.scene, eng.camera);
    })()`);
    await new Promise(r => setTimeout(r, 1500));

    // Profile 600 frames with deep instrumentation
    console.log("\nProfiling 600 frames at CBD with detailed timing breakdown...");
    const profileData = await cdp.eval(`
      (() => new Promise((resolve) => {
        const eng = window.__kanoEngine;
        const renderer = eng.renderer;
        const scene = eng.scene;
        const camera = eng.camera;

        const frameRecords = [];
        const spikeRecords = [];
        let count = 0;
        let lastTime = performance.now();

        // Hook original renderBufferDirect to sample draw calls on spike frames
        const origRender = renderer.render.bind(renderer);
        let renderTiming = 0;

        function onFrame() {
          const now = performance.now();
          const dt = now - lastTime;
          lastTime = now;

          // Measure GameEngine.update vs renderer.render
          // We can inspect timings by observing frame metrics
          const info = renderer.info;
          const calls = info.render.calls;
          const tris = info.render.triangles;
          const jsHeapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) : 0;

          const record = {
            frame: count,
            dtMs: +dt.toFixed(2),
            calls,
            tris,
            jsHeapMB
          };

          if (count > 5) {
            frameRecords.push(record);
            if (dt > 33.3) {
              spikeRecords.push(record);
            }
          }
          count++;

          if (count < 600) {
            requestAnimationFrame(onFrame);
          } else {
            // Aggregate
            const validDts = frameRecords.map(r => r.dtMs);
            const totalMs = validDts.reduce((a, b) => a + b, 0);
            const avgFps = totalMs > 0 ? (validDts.length / (totalMs / 1000)) : 60;
            const sorted = [...validDts].sort((a,b) => a - b);
            const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
            const low1PctFps = 1000 / p99;
            const medianDt = sorted[Math.floor(sorted.length / 2)];

            resolve({
              avgFps: +avgFps.toFixed(2),
              low1PctFps: +low1PctFps.toFixed(2),
              medianDtMs: +medianDt.toFixed(2),
              totalFrames: frameRecords.length,
              spikeFramesCount: spikeRecords.length,
              top10SlowestFrames: [...frameRecords].sort((a,b) => b.dtMs - a.dtMs).slice(0, 10),
              calls: info.render.calls,
              triangles: info.render.triangles,
              geometries: info.memory.geometries,
              textures: info.memory.textures,
              startHeapMB: frameRecords[0]?.jsHeapMB,
              endHeapMB: frameRecords[frameRecords.length - 1]?.jsHeapMB
            });
          }
        }

        requestAnimationFrame(onFrame);
      }))()
    `);

    console.log("=== CBD FRAME-TIME SPIKE PROFILE RESULTS ===");
    console.log(`Avg FPS: ${profileData.avgFps} | 1% Low FPS: ${profileData.low1PctFps} | Median Frame: ${profileData.medianDtMs} ms`);
    console.log(`Draw Calls: ${profileData.calls} | Triangles: ${profileData.triangles.toLocaleString()}`);
    console.log(`Spike Frames (>33.3ms / <30fps): ${profileData.spikeFramesCount} out of ${profileData.totalFrames} frames (${((profileData.spikeFramesCount/profileData.totalFrames)*100).toFixed(1)}%)`);
    console.log(`JS Heap: ${profileData.startHeapMB} MB -> ${profileData.endHeapMB} MB`);
    console.log("\nTop 10 Slowest Frames:");
    profileData.top10SlowestFrames.forEach(f => console.log(`  Frame ${f.frame}: dt=${f.dtMs}ms (${(1000/f.dtMs).toFixed(1)} FPS), calls=${f.calls}, tris=${f.tris}, heap=${f.jsHeapMB}MB`));

    // Also inspect traffic and pedestrian individual costs
    const systemTimings = await cdp.eval(`
      (() => {
        const eng = window.__kanoEngine;
        const tStart = performance.now();
        for (let i = 0; i < 20; i++) {
          if (eng.trafficSystem && eng.trafficSystem.update) {
            eng.trafficSystem.update(0.016, eng.playerPosition, null, 0, eng.pedestrianSystem?.pedestrians);
          }
        }
        const trafficAvgMs = (performance.now() - tStart) / 20;

        const pStart = performance.now();
        for (let i = 0; i < 20; i++) {
          if (eng.pedestrianSystem && eng.pedestrianSystem.update) {
            eng.pedestrianSystem.update(0.016, eng.playerPosition, null);
          }
        }
        const pedAvgMs = (performance.now() - pStart) / 20;

        const cullStart = performance.now();
        for (let i = 0; i < 20; i++) {
          eng.updateChunkCulling(true);
        }
        const cullAvgMs = (performance.now() - cullStart) / 20;

        return {
          trafficAvgMs: +trafficAvgMs.toFixed(3),
          pedAvgMs: +pedAvgMs.toFixed(3),
          cullAvgMs: +cullAvgMs.toFixed(3),
          trafficVehiclesCount: eng.trafficSystem ? eng.trafficSystem.vehicles.length : 0,
          pedestrianCount: eng.pedestrianSystem ? eng.pedestrianSystem.pedestrians.length : 0,
          staticBatchesCount: eng.staticBatches ? eng.staticBatches.length : 0
        };
      })()
    `);
    console.log("\n=== SUB-SYSTEM CPU EXECUTION TIMINGS ===");
    console.log(JSON.stringify(systemTimings, null, 2));

    fs.writeFileSync(
      "c:\\Users\\USER\\Downloads\\Kano-3D-Neighborhood-Game\\scripts\\cbd_spike_profile.json",
      JSON.stringify({ profileData, systemTimings }, null, 2)
    );

    cdp.close();
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

run().catch(console.error);
