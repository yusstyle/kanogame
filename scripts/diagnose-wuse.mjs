import { spawn } from "child_process";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9270;
const tempUserData = path.join(os.tmpdir(), `edge-diag-wuse-${Date.now()}`);

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
          else if (data.result && data.result.exceptionDetails) {
            console.error("Eval exception:", JSON.stringify(data.result.exceptionDetails));
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

    // Position in Wuse: x = -208, z = 330
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
        eng.renderer.render(eng.scene, eng.camera);
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Inspect scene hierarchy and active chunks
    const sceneAnalysisRaw = await cdp.eval(`
      JSON.stringify((() => {
        const eng = window.__kanoEngine;
        const rendererInfo = {
          calls: eng.renderer.info.render.calls,
          triangles: eng.renderer.info.render.triangles,
          geometries: eng.renderer.info.memory.geometries,
          textures: eng.renderer.info.memory.textures
        };

        const activeChunks = [];
        if (eng.abujaStreamingManager) {
          eng.abujaStreamingManager.chunks.forEach((c, key) => {
            if (c.currentLOD !== 2) {
              activeChunks.push({
                key,
                name: c.districtName,
                lod: c.currentLOD,
                cx: c.cx,
                cz: c.cz,
                meshCountLOD0: c.lod0Mesh ? c.lod0Mesh.children.length : 0,
                meshCountLOD1: c.lod1Mesh ? c.lod1Mesh.children.length : 0
              });
            }
          });
        }

        // Tally all visible meshes in scene
        const breakdown = {};
        const shadowCasters = {};
        let totalVisibleMeshes = 0;
        let totalShadowCasters = 0;

        eng.scene.traverse((obj) => {
          if (obj.isMesh && obj.visible) {
            totalVisibleMeshes++;
            let category = "other";
            let parent = obj.parent;
            while (parent && parent !== eng.scene) {
              if (parent.name) {
                category = parent.name;
                break;
              }
              parent = parent.parent;
            }

            const triCount = obj.geometry ? (obj.geometry.index ? obj.geometry.index.count / 3 : obj.geometry.attributes.position.count / 3) : 0;
            if (!breakdown[category]) breakdown[category] = { count: 0, tris: 0 };
            breakdown[category].count++;
            breakdown[category].tris += Math.round(triCount);

            if (obj.castShadow) {
              totalShadowCasters++;
              if (!shadowCasters[category]) shadowCasters[category] = 0;
              shadowCasters[category]++;
            }
          }
        });

        // Top 20 biggest individual meshes by triangle count
        const topMeshes = [];
        eng.scene.traverse((obj) => {
          if (obj.isMesh && obj.visible && obj.geometry) {
            const tris = obj.geometry.index ? obj.geometry.index.count / 3 : obj.geometry.attributes.position.count / 3;
            topMeshes.push({
              name: obj.name || "unnamed",
              parent: obj.parent ? obj.parent.name : "root",
              tris: Math.round(tris),
              castShadow: obj.castShadow,
              receiveShadow: obj.receiveShadow,
              mat: obj.material ? (obj.material.name || obj.material.type) : "none"
            });
          }
        });
        topMeshes.sort((a, b) => b.tris - a.tris);

        return {
          rendererInfo,
          activeChunks,
          totalVisibleMeshes,
          totalShadowCasters,
          breakdown,
          shadowCasters,
          top15Meshes: topMeshes.slice(0, 15)
        };
      })())
    `);

    const sceneAnalysis = JSON.parse(sceneAnalysisRaw);
    console.log("=== WUSE SCENE ANALYSIS ===");
    console.log(JSON.stringify(sceneAnalysis, null, 2));

    cdp.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);