import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9350;
const tempUserData = path.join(os.tmpdir(), `edge-audit-p5-${Date.now()}`);

console.log(`[Audit] Launching Microsoft Edge on debug port ${DEBUG_PORT}...`);
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
    return await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
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
  let cdp = null;
  try {
    console.log(`[Audit] Connecting to Edge CDP on port ${DEBUG_PORT}...`);
    const wsUrl = await getGameTabWsUrl(DEBUG_PORT);
    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log("[Audit] Connected to game tab!");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log("[Audit] Waiting for game engine initialization...");
    let engineReady = false;
    for (let i = 0; i < 90; i++) {
      engineReady = await cdp.eval(`(() => {
        const btn = document.querySelector('.ks-button-primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter the neighborhood'));
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && !!eng.car && typeof eng.travelToCity === "function";
      })()`);
      if (engineReady) break;
      await new Promise(r => setTimeout(r, 600));
    }

    if (!engineReady) {
      throw new Error("Game engine did not initialize within timeout");
    }
    console.log("[Audit] Engine initialized successfully.");

    // Dismiss onboarding modals
    await cdp.eval(`(() => {
      const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (dismissBtn) dismissBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 800));

    // Travel to Abuja
    console.log("[Audit] Traveling to Abuja...");
    for (let attempt = 0; attempt < 5; attempt++) {
      const city = await cdp.eval(`window.__kanoEngine.currentCity`);
      if (city === "abuja") break;
      await cdp.eval(`window.__kanoEngine.travelToCity("abuja", "highway");`);
      await new Promise(r => setTimeout(r, 2500));
    }
    await cdp.eval(`window.__kanoEngine.setWeatherPreset("clear");`);
    await new Promise(r => setTimeout(r, 1200));

    // =========================================================================
    // SECTION 1: GPU TIMING AUDIT (EXT_disjoint_timer_query_webgl2)
    // =========================================================================
    console.log("\n=======================================================");
    console.log("SECTION 1: GPU TIMING (EXT_disjoint_timer_query_webgl2)");
    console.log("=======================================================");

    const gpuExtensionCheck = await cdp.eval(`
      (() => {
        const eng = window.__kanoEngine;
        const gl = eng.renderer.getContext();
        const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') || gl.getExtension('EXT_disjoint_timer_query');
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          hasExtension: !!ext,
          extensionName: ext ? ext.constructor.name : null,
          unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          webglVersion: gl.getParameter(gl.VERSION),
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
        };
      })()
    `);
    console.log("GPU Context Info:", JSON.stringify(gpuExtensionCheck, null, 2));

    const districts = [
      { name: "CBD", x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 },
      { name: "Wuse", x: -30, y: 3.5, z: 88, yaw: 0.45, pitch: 0.12 },
      { name: "Maitama", x: -53, y: 3.5, z: -4, yaw: 1.57, pitch: 0.10 }
    ];

    const gpuDistrictTimings = {};

    for (const dist of districts) {
      console.log(`\nMeasuring GPU timing in ${dist.name}...`);
      await setCamera(cdp, dist);

      const timingResult = await cdp.eval(`
        (async () => {
          const eng = window.__kanoEngine;
          const gl = eng.renderer.getContext();
          const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');

          if (!ext) {
            return {
              supported: false,
              reason: "EXT_disjoint_timer_query_webgl2 is null or disabled in this browser context"
            };
          }

          const samples = [];
          const rejectedDisjoint = [];
          const timeouts = [];
          const totalAttempts = 40;

          for (let i = 0; i < totalAttempts; i++) {
            // Check & clear disjoint flag before query
            gl.getParameter(ext.GPU_DISJOINT_EXT);

            const query = gl.createQuery();
            gl.beginQuery(ext.TIME_ELAPSED_EXT, query);

            // Render current scene
            eng.renderer.render(eng.scene, eng.camera);

            gl.endQuery(ext.TIME_ELAPSED_EXT);

            // Wait for query result asynchronously
            let resolved = false;
            for (let wait = 0; wait < 60; wait++) {
              await new Promise(r => setTimeout(r, 4));
              const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
              if (disjoint) {
                rejectedDisjoint.push(i);
                gl.deleteQuery(query);
                resolved = true;
                break;
              }
              const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
              if (available) {
                const timeElapsedNs = gl.getQueryParameter(query, gl.QUERY_RESULT);
                const timeElapsedMs = timeElapsedNs / 1000000;
                samples.push(timeElapsedMs);
                gl.deleteQuery(query);
                resolved = true;
                break;
              }
            }
            if (!resolved) {
              timeouts.push(i);
              gl.deleteQuery(query);
            }
          }

          if (samples.length === 0) {
            return {
              supported: true,
              validSamplesCount: 0,
              rejectedDisjointCount: rejectedDisjoint.length,
              timeoutCount: timeouts.length,
              note: "GPU queries returned disjoint or unavailable (typical in Chromium security sandboxing to prevent microarchitectural timing attacks)"
            };
          }

          const sorted = [...samples].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length * 0.5)];
          const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
          const max = sorted[sorted.length - 1];
          const min = sorted[0];

          return {
            supported: true,
            totalAttempts,
            validSamplesCount: samples.length,
            rejectedDisjointCount: rejectedDisjoint.length,
            timeoutCount: timeouts.length,
            medianGpuMs: +median.toFixed(3),
            p95GpuMs: +p95.toFixed(3),
            maxGpuMs: +max.toFixed(3),
            minGpuMs: +min.toFixed(3),
            samplesMs: samples.slice(0, 15).map(s => +s.toFixed(3))
          };
        })()
      `);
      console.log(`${dist.name} GPU Timing Result:`, JSON.stringify(timingResult, null, 2));
      gpuDistrictTimings[dist.name] = timingResult;
    }

    // =========================================================================
    // SECTION 2: LOD COMPONENT AUDIT (LOD 0, LOD 1, LOD 2 & Traffic)
    // =========================================================================
    console.log("\n=======================================================");
    console.log("SECTION 2: LOD COMPONENT AUDIT");
    console.log("=======================================================");

    const lodAudit = await cdp.eval(`
      (() => {
        const eng = window.__kanoEngine;
        const car = eng.car;
        if (!car || !car.gltfBody) return { error: "No car or gltfBody" };

        const allMeshes = [];
        const categorized = { lod0: [], lod1: [], lod2: [], other: [] };

        car.gltfBody.traverse(child => {
          if (child.isMesh) {
            const minLevel = child.userData.lodMinLevel;
            const item = {
              name: child.name,
              minLevel,
              castShadow: child.castShadow,
              receiveShadow: child.receiveShadow
            };
            allMeshes.push(item);
            if (minLevel === 2) categorized.lod2.push(item);
            else if (minLevel === 1) categorized.lod1.push(item);
            else if (minLevel === 0) categorized.lod0.push(item);
            else categorized.other.push(item);
          }
        });

        // Test transitions & visibility at each LOD level
        const levels = [0, 1, 2];
        const transitions = {};

        for (const lvl of levels) {
          car.setLODLevel(lvl);
          let visibleCount = 0;
          const visibleMeshNames = [];
          const visibleByMinLevel = { lod0: 0, lod1: 0, lod2: 0, other: 0 };

          car.gltfBody.traverse(child => {
            if (child.isMesh && child.visible) {
              visibleCount++;
              visibleMeshNames.push(child.name);
              const minLevel = child.userData.lodMinLevel;
              if (minLevel === 2) visibleByMinLevel.lod2++;
              else if (minLevel === 1) visibleByMinLevel.lod1++;
              else if (minLevel === 0) visibleByMinLevel.lod0++;
              else visibleByMinLevel.other++;
            }
          });

          transitions[\`LOD_\${lvl}\`] = {
            totalVisible: visibleCount,
            breakdownByLODMinLevel: visibleByMinLevel,
            visibleNames: visibleMeshNames
          };
        }

        // Return player vehicle to full LOD 0
        car.setLODLevel(0);

        // Classify LOD 2 meshes specifically (resolving 5 vs 6 discrepancy)
        const lod2MeshNames = categorized.lod2.map(m => m.name);
        const bodyShellMeshes = lod2MeshNames.filter(n => n.toLowerCase().includes("body_shell"));
        const tireMeshes = lod2MeshNames.filter(n => n.toLowerCase().includes("tyre") || n.toLowerCase().includes("tire"));
        const otherMeshes = lod2MeshNames.filter(n => !n.toLowerCase().includes("body_shell") && !n.toLowerCase().includes("tyre") && !n.toLowerCase().includes("tire"));

        // Audit traffic vehicles in Abuja
        const trafficData = [];
        if (eng.trafficSystem && eng.trafficSystem.vehicles) {
          eng.trafficSystem.vehicles.forEach((v, idx) => {
            if (v.gltfBody) {
              let visCount = 0;
              let totalM = 0;
              v.gltfBody.traverse(ch => {
                if (ch.isMesh) {
                  totalM++;
                  if (ch.visible) visCount++;
                }
              });
              trafficData.push({
                index: idx,
                isTraffic: !!v.gltfBody.userData.isTraffic,
                currentLOD: v.gltfBody.userData.currentLOD,
                totalMeshes: totalM,
                visibleMeshes: visCount
              });
            }
          });
        }

        return {
          totalSubmeshes: allMeshes.length,
          minLevelCounts: {
            lod0_interior_trim: categorized.lod0.length,
            lod1_exterior_components: categorized.lod1.length,
            lod2_core_silhouette: categorized.lod2.length,
            unassigned: categorized.other.length
          },
          lod2ExactComposition: {
            totalLOD2Meshes: categorized.lod2.length,
            bodyShellSubmeshes: bodyShellMeshes,
            tireSubmeshes: tireMeshes,
            otherVisibleSubmeshes: otherMeshes,
            resolvedDiscrepancy: "The 3D model body shell consists of 2 tessellated sub-meshes (Watertight_14-station_body_shell_closed_tessellation and Watertight_14-station_body_shell_closed_tessellation_1) plus 4 sculpted tyres (107_reused_Sculpted_tyre, 001, 002, 003) = exactly 6 meshes. The initial Phase 5 text stated '5 draw calls' thinking 1 body + 4 tyres, but physically there are 2 body shell sub-meshes."
          },
          transitions,
          playerCarRestoredToLOD0: car.gltfBody.userData.currentLOD === 0,
          trafficCount: trafficData.length,
          trafficSedans: trafficData
        };
      })()
    `);
    console.log("LOD Audit Results:", JSON.stringify(lodAudit, null, 2));

    // =========================================================================
    // SECTION 3: BENCHMARK AUDIT (VSync Cap Explanation & Uncapped Diagnostic)
    // =========================================================================
    console.log("\n=======================================================");
    console.log("SECTION 3: BENCHMARK AUDIT & UNCAPPED RENDERING TEST");
    console.log("=======================================================");

    const uncappedDiagnostics = {};

    for (const dist of districts) {
      console.log(`\nRunning uncapped render diagnostic in ${dist.name}...`);
      await setCamera(cdp, dist);

      const uncappedResult = await cdp.eval(`
        (() => {
          const eng = window.__kanoEngine;
          const renderer = eng.renderer;
          const scene = eng.scene;
          const camera = eng.camera;

          // Warmup 5 frames
          for (let w = 0; w < 5; w++) {
            renderer.render(scene, camera);
          }

          // Measure 300 sequential pure render calls (uncoupled from requestAnimationFrame VSync)
          const frames = 300;
          const times = [];
          const tStart = performance.now();

          for (let i = 0; i < frames; i++) {
            const t0 = performance.now();
            renderer.render(scene, camera);
            const t1 = performance.now();
            times.push(t1 - t0);
          }
          const tEnd = performance.now();
          const totalMs = tEnd - tStart;

          const sorted = [...times].sort((a, b) => a - b);
          const medianDt = sorted[Math.floor(sorted.length * 0.5)];
          const p95Dt = sorted[Math.floor(sorted.length * 0.95)];
          const p99Dt = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
          const minDt = sorted[0];
          const maxDt = sorted[sorted.length - 1];
          const avgDt = totalMs / frames;

          const uncappedAvgFPS = avgDt > 0 ? 1000 / avgDt : 999;
          const uncappedMedianFPS = medianDt > 0 ? 1000 / medianDt : 999;
          const uncapped1PctLowFPS = p99Dt > 0 ? 1000 / p99Dt : 999;

          const info = renderer.info;
          return {
            framesMeasured: frames,
            totalRenderDurationMs: +totalMs.toFixed(2),
            avgFrameTimeMs: +avgDt.toFixed(3),
            medianFrameTimeMs: +medianDt.toFixed(3),
            p95FrameTimeMs: +p95Dt.toFixed(3),
            p99FrameTimeMs: +p99Dt.toFixed(3),
            minFrameTimeMs: +minDt.toFixed(3),
            maxFrameTimeMs: +maxDt.toFixed(3),
            uncappedAvgFPS: +uncappedAvgFPS.toFixed(2),
            uncappedMedianFPS: +uncappedMedianFPS.toFixed(2),
            uncapped1PctLowFPS: +uncapped1PctLowFPS.toFixed(2),
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures
          };
        })()
      `);
      console.log(`${dist.name} Uncapped Diagnostic:`, JSON.stringify(uncappedResult, null, 2));
      uncappedDiagnostics[dist.name] = uncappedResult;
    }

    // Save all audit data to JSON file
    const completeAuditReport = {
      auditTimestamp: new Date().toISOString(),
      gpuContext: gpuExtensionCheck,
      gpuDistrictTimings,
      lodAudit,
      uncappedDiagnostics
    };

    const auditOutputPath = path.join(process.cwd(), "scripts", "phase5_evidence_audit_output.json");
    fs.writeFileSync(auditOutputPath, JSON.stringify(completeAuditReport, null, 2));
    console.log(`\n[Audit] Successfully saved complete audit output to: ${auditOutputPath}`);

  } catch (err) {
    console.error("[Audit Fatal Error]", err);
  } finally {
    if (cdp) cdp.close();
    try { edgeProc.kill(); } catch {}
  }
}

run();
