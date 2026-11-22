import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9295;
const tempUserData = path.join(os.tmpdir(), `edge-bench-test-${Date.now()}`);

console.log("Launching Microsoft Edge with background-throttling disabled on port " + DEBUG_PORT + "...");
const edgeProc = spawn(EDGE_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${tempUserData}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1920,1080",
  "--disable-backgrounding-occluded-windows",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-features=CalculateNativeWinOcclusion",
  GAME_URL
], { stdio: "ignore" });

async function getGameTabWsUrl(port, timeoutMs = 25000) {
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
          else if (data.result && data.result.result) r(data.result.result.value !== undefined ? data.result.result.value : data.result.result);
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
  async eval(expression) {
    return await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  }
  close() {
    if (this.ws) try { this.ws.close(); } catch {}
  }
}

async function runBenchmark(cdp, districtName, trialIndex, frames = 600) {
  const raw = await cdp.eval(`
    new Promise((resolve) => {
      const eng = window.__kanoEngine;
      const frameDeltas = [];
      let lastTime = performance.now();
      let count = 0;

      const timeout = setTimeout(() => {
        const info = eng.renderer.info;
        resolve(JSON.stringify({
          timeout: true,
          framesCollected: count,
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          city: eng.currentCity
        }));
      }, 35000);

      function onFrame() {
        const now = performance.now();
        const dt = now - lastTime;
        lastTime = now;
        if (count > 0) frameDeltas.push(dt);
        count++;

        if (count < ${frames}) {
          requestAnimationFrame(onFrame);
        } else {
          clearTimeout(timeout);
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
            district: "${districtName}",
            trial: ${trialIndex},
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
    })
  `);
  return JSON.parse(raw);
}

async function run() {
  try {
    const wsUrl = await getGameTabWsUrl(DEBUG_PORT);
    const cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log("Connected to CDP!");

    // 1080p
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Wait for engine
    for (let i = 0; i < 40; i++) {
      const ready = await cdp.eval(`(() => {
        const btn = document.querySelector('.ks-button-primary');
        if (btn) btn.click();
        return !!window.__kanoEngine && !!window.__kanoEngine.scene;
      })()`);
      if (ready) break;
      await new Promise(r => setTimeout(r, 500));
    }

    // Dismiss onboarding
    await cdp.eval(`(() => {
      const btn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    // Travel to Abuja
    console.log("Traveling to Abuja...");
    await cdp.eval(`window.__kanoEngine.travelToCity("abuja", "highway");`);
    await new Promise(r => setTimeout(r, 3000));

    const districts = [
      { name: "Maitama", x: -336, z: 75, yaw: 0, pitch: 0.05 },
      { name: "CBD", x: 0, z: -35, yaw: 0, pitch: 0.05 },
      { name: "Wuse", x: -208, z: 330, yaw: 0, pitch: 0.05 }
    ];

    const results = {};

    for (const d of districts) {
      console.log(`\nSetting position to ${d.name} (${d.x}, ${d.z})...`);
      await cdp.eval(`
        (() => {
          const eng = window.__kanoEngine;
          eng.setCameraMode("first-person");
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

      console.log(`Warming up ${d.name}...`);
      await runBenchmark(cdp, d.name, 0, 60);

      results[d.name] = [];
      for (let t = 1; t <= 3; t++) {
        console.log(`Running ${d.name} Trial ${t} (600 frames)...`);
        const res = await runBenchmark(cdp, d.name, t, 600);
        console.log(`  Result Trial ${t}:`, res);
        results[d.name].push(res);
      }
    }

    fs.writeFileSync(
      "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\benchmark_results.json",
      JSON.stringify(results, null, 2)
    );
    console.log("\nAll benchmarks finished! Saved to benchmark_results.json");

    cdp.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);

