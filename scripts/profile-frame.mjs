import { spawn } from "child_process";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9260;
const tempUserData = path.join(os.tmpdir(), `edge-profile-${Date.now()}`);

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

    // Wait for engine
    for (let i = 0; i < 30; i++) {
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

    // Measure frame timings at Wuse vs CBD vs Maitama
    const profileCode = (x, z) => `
      new Promise((resolve) => {
        const eng = window.__kanoEngine;
        eng.playerPosition.set(${x}, eng.surfaceHeight(${x}, ${z}), ${z});
        eng.updateChunkCulling(true);

        const samples = [];
        let count = 0;
        function step() {
          const t0 = performance.now();
          // We measure individual pieces if possible
          const tStart = performance.now();
          count++;
          if (count < 60) {
            requestAnimationFrame(step);
          } else {
            const info = eng.renderer.info;
            resolve({
              calls: info.render.calls,
              triangles: info.render.triangles,
              fps: 1000 / (performance.now() - t0)
            });
          }
        }
        requestAnimationFrame(step);
      })
    `;

    console.log("Testing Wuse (-30, 105)...");
    const wuse = await cdp.eval(profileCode(-30, 105));
    console.log("Wuse:", JSON.stringify(wuse));

    console.log("Testing CBD (0, 0)...");
    const cbd = await cdp.eval(profileCode(0, 0));
    console.log("CBD:", JSON.stringify(cbd));

    console.log("Testing Maitama (-336, 48)...");
    const maitama = await cdp.eval(profileCode(-336, 48));
    console.log("Maitama:", JSON.stringify(maitama));

    cdp.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
