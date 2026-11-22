import { spawn } from "child_process";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9280;
const tempUserData = path.join(os.tmpdir(), `edge-track-wuse-${Date.now()}`);

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

    // Track 800 frames and see when draw calls jump!
    const trackResult = await cdp.eval(`
      new Promise((resolve) => {
        const eng = window.__kanoEngine;
        const history = [];
        let frame = 0;

        function loop() {
          frame++;
          const info = eng.renderer.info;
          if (frame % 50 === 0 || info.render.calls > 200) {
            history.push({
              frame,
              calls: info.render.calls,
              tris: info.render.triangles,
              playerPos: { x: +eng.playerPosition.x.toFixed(2), y: +eng.playerPosition.y.toFixed(2), z: +eng.playerPosition.z.toFixed(2) },
              city: eng.currentCity,
              cameraPos: { x: +eng.camera.position.x.toFixed(2), y: +eng.camera.position.y.toFixed(2), z: +eng.camera.position.z.toFixed(2) }
            });
          }

          if (frame < 700 && history.length < 30) {
            requestAnimationFrame(loop);
          } else {
            resolve(JSON.stringify(history));
          }
        }
        requestAnimationFrame(loop);
      })
    `);

    console.log("Track result:", JSON.parse(trackResult));

    cdp.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
