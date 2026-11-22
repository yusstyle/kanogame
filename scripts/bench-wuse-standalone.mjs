import { spawn } from "child_process";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9285;
const tempUserData = path.join(os.tmpdir(), `edge-bench-wuse-${Date.now()}`);

const edgeProc = spawn(EDGE_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${tempUserData}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1920,1080",
  GAME_URL
], { stdio: "ignore" });

async function getGameTabWsUrl(port) {
  for (let i = 0; i < 40; i++) {
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
  throw new Error("Could not connect to Edge tab");
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

async function run() {
  try {
    const wsUrl = await getGameTabWsUrl(DEBUG_PORT);
    const cdp = new CDPClient(wsUrl);
    await cdp.connect();

    // Set 1080p
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
    await cdp.eval(`window.__kanoEngine.travelToCity("abuja", "highway");`);
    await new Promise(r => setTimeout(r, 3000));

    // Teleport to Wuse
    await cdp.eval(`
      (() => {
        const eng = window.__kanoEngine;
        eng.setCameraMode("first-person");
        const ground = eng.surfaceHeight(-208, 330);
        eng.playerPosition.set(-208, ground + 1.68, 330);
        eng.cameraYaw = 0;
        eng.cameraPitch = 0.05;
        if (eng.abujaStreamingManager) {
          eng.abujaStreamingManager.update(eng.playerPosition, true);
        }
        eng.updateChunkCulling(true);
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    // Run 3 independent 600-frame trials
    for (let t = 1; t <= 3; t++) {
      const res = await cdp.eval(`
        new Promise((resolve) => {
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

            if (count < 600) {
              requestAnimationFrame(onFrame);
            } else {
              const validDts = frameDeltas.slice(5);
              const totalMs = validDts.reduce((a, b) => a + b, 0);
              const avgFps = validDts.length / (totalMs / 1000);
              const sorted = [...validDts].sort((a, b) => a - b);
              const p99 = sorted[Math.floor(sorted.length * 0.99)];
              const low1PctFps = 1000 / p99;
              const medianDt = sorted[Math.floor(sorted.length / 2)];
              const info = eng.renderer.info;

              resolve(JSON.stringify({
                trial: ${t},
                avgFps: +avgFps.toFixed(2),
                low1PctFps: +low1PctFps.toFixed(2),
                medianDtMs: +medianDt.toFixed(2),
                drawCalls: info.render.calls,
                triangles: info.render.triangles,
                city: eng.currentCity,
                pos: { x: +eng.playerPosition.x.toFixed(1), z: +eng.playerPosition.z.toFixed(1) }
              }));
            }
          }
          requestAnimationFrame(onFrame);
        })
      `);
      console.log(`Wuse Trial ${t}:`, res);
    }

    cdp.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
