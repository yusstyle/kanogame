import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9268;
const tempUserData = path.join(os.tmpdir(), `edge-phase4-profile-${Date.now()}`);

console.log("Launching Microsoft Edge for Phase 4 Profiling on port " + DEBUG_PORT + "...");
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

async function getWsUrl(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const tab = list.find(t => t.type === "page" && !t.url.startsWith("edge") && !t.url.startsWith("chrome-extension"));
        if (tab && tab.webSocketDebuggerUrl) return tab.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Could not connect to Edge tab");
}

class CDP {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
  }
  async connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = e => rej(e);
      this.ws.onmessage = msg => {
        const d = JSON.parse(msg.data);
        if (d.id && this.pending.has(d.id)) {
          const { res: r, rej: j } = this.pending.get(d.id);
          this.pending.delete(d.id);
          if (d.error) j(d.error);
          else if (d.result && d.result.result) r(d.result.result.value !== undefined ? d.result.result.value : d.result.result);
          else r(d.result);
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.id++;
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
    const wsUrl = await getWsUrl(DEBUG_PORT);
    const cdp = new CDP(wsUrl);
    await cdp.connect();

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

    // Dismiss onboarding
    await cdp.eval(`(() => {
      const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (dismissBtn) dismissBtn.click();
      window.__kanoEngine.travelToCity("abuja", "highway");
    })()`);
    await new Promise(r => setTimeout(r, 3500));

    // Profile helper
    const profileDistrict = async (name, pos) => {
      console.log(`\n========================================`);
      console.log(`PROFILING DISTRICT: ${name}`);
      console.log(`========================================`);

      await cdp.eval(`(() => {
        const eng = window.__kanoEngine;
        eng.statusMessage = null;
        eng.setCameraMode("first-person");
        if (eng.player && eng.player.root) eng.player.root.visible = false;
        const ground = eng.surfaceHeight(${pos.x}, ${pos.z});
        const posY = ${pos.y !== undefined ? pos.y : 'ground + 1.68'};
        eng.playerPosition.set(${pos.x}, posY, ${pos.z});
        eng.playerYaw = ${pos.yaw};
        eng.cameraYaw = ${pos.yaw};
        eng.cameraPitch = ${pos.pitch};
        if (eng.abujaStreamingManager) eng.abujaStreamingManager.update(eng.playerPosition, true);
        eng.updateChunkCulling(true);
        eng.renderer.render(eng.scene, eng.camera);
      })()`);
      await new Promise(r => setTimeout(r, 1500));

      const profile = await cdp.eval(`(() => {
        const eng = window.__kanoEngine;
        const renderer = eng.renderer;
        const scene = eng.scene;
        const mainCamera = eng.camera;

        // Hook renderBufferDirect
        const origRenderBufferDirect = renderer.renderBufferDirect.bind(renderer);
        let shadowCalls = 0;
        let mainCalls = 0;
        const callsBySystem = {};
        const shadowCallsBySystem = {};
        const landmarkTriangles = {};
        const landmarkMeshes = {};
        const topTrianglesList = [];

        function getSystem(obj) {
          let curr = obj;
          while (curr && curr !== scene) {
            const n = curr.name || "";
            if (n === "building-interiors-root") return "building-interiors";
            if (n === "traffic-system-root") return "traffic-system";
            if (n === "pedestrian-system-root") return "pedestrian-system";
            if (n === "AbujaStreamingWorldRoot") return "abuja-streaming";
            if (n === "AbujaWorldRoot") return "abuja-world-static";
            if (n === "AbujaInfrastructureSystem") return "abuja-infrastructure";
            if (n === "AbujaVegetationSystem") return "abuja-vegetation";
            if (n.startsWith("neighborhood-static-") || n.startsWith("cell-")) return "district-static-cells";
            if (n.includes("ThreeArms") || n.includes("NationalAssembly")) return "national-assembly";
            if (n.includes("Mosque")) return "national-mosque";
            if (n.includes("ChristianCenter")) return "christian-center";
            if (n.includes("Cbn") || n.includes("Nnpc")) return "financial-towers";
            if (n.includes("CeddiPlaza") || n.includes("Plaza") || n.includes("Market")) return "commercial-plazas";
            curr = curr.parent;
          }
          return "other";
        }

        renderer.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
          const isShadow = (camera !== mainCamera);
          const sys = getSystem(object);
          if (isShadow) {
            shadowCalls++;
            shadowCallsBySystem[sys] = (shadowCallsBySystem[sys] || 0) + 1;
          } else {
            mainCalls++;
            callsBySystem[sys] = (callsBySystem[sys] || 0) + 1;
          }
          origRenderBufferDirect(camera, scene, geometry, material, object, group);
        };

        // Measure render calls & time
        renderer.info.reset();
        const startRender = performance.now();
        renderer.render(scene, mainCamera);
        const cpuRenderMs = performance.now() - startRender;
        renderer.renderBufferDirect = origRenderBufferDirect;

        const info = {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          lines: renderer.info.render.lines,
          points: renderer.info.render.points,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures
        };

        // System update timings
        const tStart = performance.now();
        if (eng.trafficSystem && eng.trafficSystem.update) eng.trafficSystem.update(0.016);
        const trafficMs = performance.now() - tStart;

        const pStart = performance.now();
        if (eng.pedestrianSystem && eng.pedestrianSystem.update) eng.pedestrianSystem.update(0.016);
        const pedMs = performance.now() - pStart;

        // Traverse scene to measure triangles per landmark
        let totalMeshes = 0;
        let shadowCasters = 0;
        let transparentCount = 0;

        scene.traverse((obj) => {
          if (obj.isMesh || obj.isPoints || obj.isLine) {
            totalMeshes++;
            if (obj.castShadow) shadowCasters++;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => { if (m && m.transparent) transparentCount++; });

            let triCount = 0;
            if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
              triCount = obj.geometry.index ? Math.round(obj.geometry.index.count / 3) : Math.round(obj.geometry.attributes.position.count / 3);
            }

            const sys = getSystem(obj);
            landmarkMeshes[sys] = (landmarkMeshes[sys] || 0) + 1;
            landmarkTriangles[sys] = (landmarkTriangles[sys] || 0) + triCount;

            if (triCount > 2000) {
              topTrianglesList.push({
                name: obj.name || "unnamed",
                parent: obj.parent ? obj.parent.name : "root",
                system: sys,
                triangles: triCount,
                castShadow: !!obj.castShadow,
                visible: !!obj.visible
              });
            }
          }
        });

        return {
          cpuRenderMs: +cpuRenderMs.toFixed(2),
          trafficMs: +trafficMs.toFixed(2),
          pedMs: +pedMs.toFixed(2),
          info,
          totalMeshes,
          shadowCasters,
          transparentCount,
          shadowCalls,
          mainCalls,
          callsBySystem,
          shadowCallsBySystem,
          landmarkTriangles,
          landmarkMeshes,
          topTrianglesList: topTrianglesList.sort((a,b) => b.triangles - a.triangles).slice(0, 10)
        };
      })()`);

      console.log(`CPU Render Time: ${profile.cpuRenderMs} ms | Traffic: ${profile.trafficMs} ms | Pedestrians: ${profile.pedMs} ms`);
      console.log(`Draw Calls: ${profile.info.calls} (Main: ${profile.mainCalls}, Shadow: ${profile.shadowCalls}) | Triangles: ${profile.info.triangles.toLocaleString()}`);
      console.log(`Total Meshes: ${profile.totalMeshes} | Shadow Casters: ${profile.shadowCasters} | Transparent: ${profile.transparentCount}`);
      console.log(`\nMain Camera Calls by System:`);
      Object.entries(profile.callsBySystem).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  - ${k}: ${v} calls`));
      console.log(`\nShadow Map Calls by System:`);
      Object.entries(profile.shadowCallsBySystem).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  - ${k}: ${v} shadow calls`));
      console.log(`\nTriangles by System:`);
      Object.entries(profile.landmarkTriangles).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  - ${k}: ${v.toLocaleString()} tris`));
      console.log(`\nTop Complex Meshes:`);
      profile.topTrianglesList.forEach(m => console.log(`  - ${m.name} (${m.parent} in ${m.system}): ${m.triangles.toLocaleString()} tris, shadow=${m.castShadow}`));
      
      return profile;
    };

    const cbdProfile = await profileDistrict("CBD / Three Arms", { x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
    const wuseProfile = await profileDistrict("Wuse Commercial", { x: -30, y: 1.8, z: 88, yaw: -0.5 * Math.PI, pitch: 0.04 });
    const maitamaProfile = await profileDistrict("Maitama Luxury", { x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 });

    fs.writeFileSync(
      "c:\\Users\\USER\\Downloads\\Kano-3D-Neighborhood-Game\\scripts\\phase4_profile_results.json",
      JSON.stringify({ cbdProfile, wuseProfile, maitamaProfile }, null, 2)
    );

    cdp.close();
    try { edgeProc.kill(); } catch {}
    console.log("\nProfiling complete! Output written to scripts/phase4_profile_results.json");
  } catch (err) {
    console.error("Profiling error:", err);
    try { edgeProc.kill(); } catch {}
  }
}

run();
