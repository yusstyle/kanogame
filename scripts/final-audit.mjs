// Phase 5 Final Evidence Audit Script — v2 (robust engine access)
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9341;
const tempUserData = path.join(os.tmpdir(), `edge-audit2-${Date.now()}`);

console.log("Launching Microsoft Edge on debug port " + DEBUG_PORT + "...");
const edgeProc = spawn(EDGE_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${tempUserData}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1920,1080",
  "--disable-frame-rate-limit",
  "--disable-gpu-vsync",
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

async function run() {
  const wsUrl = await getWsUrl(DEBUG_PORT);
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (msg) => {
        const d = JSON.parse(msg.data);
        if (d.id === msgId) {
          ws.removeEventListener("message", handler);
          if (d.error) reject(d.error);
          else resolve(d.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async function evaluate(expr, timeout = 30000) {
    const r = await send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
      timeout
    });
    if (r.result && r.result.subtype === "error") {
      console.log("Eval error:", r.result.description);
      return "__ERROR__";
    }
    if (r.exceptionDetails) {
      console.log("Eval exception:", r.exceptionDetails.text, r.exceptionDetails.exception?.description);
      return "__ERROR__";
    }
    return r.result ? r.result.value : undefined;
  }

  // Wait for game engine to be fully ready
  console.log("Waiting for game engine...");
  let engineReady = false;
  for (let i = 0; i < 90; i++) {
    const check = await evaluate(`
      (function() {
        const eng = window.__kanoEngine;
        if (!eng) return "no_engine";
        if (!eng.renderer) return "no_renderer";
        if (!eng.scene) return "no_scene";
        if (!eng.camera) return "no_camera";
        if (typeof eng.travelToCity !== "function") return "no_travelToCity";
        return "ready";
      })()
    `);
    console.log(`  Check ${i}: ${check}`);
    if (check === "ready") { engineReady = true; break; }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (!engineReady) {
    console.error("Engine never became ready after 90s.");
    ws.close(); edgeProc.kill(); process.exit(1);
  }
  console.log("Engine is ready.");

  // Dismiss modals carefully (click buttons but keep checking engine)
  for (let attempt = 0; attempt < 3; attempt++) {
    await evaluate(`
      document.querySelectorAll('button').forEach(b => {
        const t = b.textContent || '';
        if (/start|play|close|ok|skip|continue|begin/i.test(t)) b.click();
      });
    `);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Verify engine is still alive after modal dismissal
  const stillAlive = await evaluate(`!!window.__kanoEngine && typeof window.__kanoEngine.travelToCity === "function"`);
  console.log("Engine alive after modals:", stillAlive);
  
  if (!stillAlive) {
    // Wait for engine to re-initialize
    console.log("Engine lost, waiting for re-init...");
    for (let i = 0; i < 30; i++) {
      const ok = await evaluate(`!!window.__kanoEngine && typeof window.__kanoEngine.travelToCity === "function"`);
      if (ok) break;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Travel to Abuja
  console.log("Travelling to Abuja...");
  const travelResult = await evaluate(`
    (async function() {
      const eng = window.__kanoEngine;
      if (!eng) return "ERROR: no engine";
      if (typeof eng.travelToCity !== "function") return "ERROR: no travelToCity method";
      try {
        await eng.travelToCity("abuja", "highway");
        return "OK";
      } catch(e) {
        return "ERROR: " + e.message;
      }
    })()
  `, 30000);
  console.log("Travel result:", travelResult);
  
  if (travelResult !== "OK" && travelResult !== "__ERROR__") {
    console.log("Travel may have failed, waiting longer...");
  }
  await new Promise(r => setTimeout(r, 5000));

  // Verify we're in Abuja
  const cityCheck = await evaluate(`
    (function() {
      const eng = window.__kanoEngine;
      if (!eng) return JSON.stringify({ error: "no engine" });
      return JSON.stringify({
        currentCity: eng.currentCity || eng.city || "unknown",
        hasRenderer: !!eng.renderer,
        hasScene: !!eng.scene,
        hasCamera: !!eng.camera,
        hasPlayerCar: !!(eng.playerCar)
      });
    })()
  `);
  console.log("City check:", cityCheck);

  // ===================== TASK 1: GPU TIMING =====================
  console.log("\n=== TASK 1: GPU TIMING ===");
  const gpuInfo = await evaluate(`
    (function() {
      const eng = window.__kanoEngine;
      if (!eng || !eng.renderer) return JSON.stringify({ error: "no renderer" });
      const gl = eng.renderer.getContext();
      return JSON.stringify({
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        hasDisjointTimer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
      });
    })()
  `);
  console.log("GPU Info:", gpuInfo);

  // Collect GPU timing samples
  console.log("Collecting GPU timing samples...");
  const gpuSamples = await evaluate(`
    (async function() {
      const eng = window.__kanoEngine;
      if (!eng || !eng.renderer) return JSON.stringify({ error: "no renderer" });
      const gl = eng.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      
      if (!ext) return JSON.stringify({ status: "UNAVAILABLE", reason: "Extension not supported by browser" });
      
      const samples = [];
      const errors = [];
      
      for (let i = 0; i < 25; i++) {
        try {
          await new Promise(r => requestAnimationFrame(r));
          
          // Clear any previous disjoint state
          gl.getParameter(ext.GPU_DISJOINT_EXT);
          
          const query = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
          eng.renderer.render(eng.scene, eng.camera);
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          
          // Poll for result availability
          let got = false;
          for (let j = 0; j < 50; j++) {
            await new Promise(r => setTimeout(r, 4));
            const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
            if (disjoint) { errors.push("disjoint_" + i); gl.deleteQuery(query); got = true; break; }
            if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
              const ns = gl.getQueryParameter(query, gl.QUERY_RESULT);
              samples.push(ns / 1e6);
              gl.deleteQuery(query);
              got = true;
              break;
            }
          }
          if (!got) { errors.push("timeout_" + i); gl.deleteQuery(query); }
        } catch (e) { errors.push("err_" + i + ":" + e.message); }
      }
      
      if (samples.length === 0) {
        return JSON.stringify({ status: "NO_VALID_SAMPLES", errors, reason: "All samples disjoint, timed out, or errored" });
      }
      
      const sorted = [...samples].sort((a, b) => a - b);
      return JSON.stringify({
        status: "OK",
        validSamples: samples.length,
        errors,
        allMs: samples.map(v => +v.toFixed(3)),
        median: +(sorted[Math.floor(sorted.length / 2)]).toFixed(3),
        p95: +(sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)]).toFixed(3),
        max: +(sorted[sorted.length - 1]).toFixed(3),
        min: +(sorted[0]).toFixed(3)
      });
    })()
  `, 60000);
  console.log("GPU Timing Samples:", gpuSamples);

  // ===================== TASK 2: LOD COMPONENT AUDIT =====================
  console.log("\n=== TASK 2: LOD COMPONENT AUDIT ===");
  
  const lodAudit = await evaluate(`
    (function() {
      const eng = window.__kanoEngine;
      if (!eng) return JSON.stringify({ error: "no engine" });
      const car = eng.playerCar;
      if (!car) return JSON.stringify({ error: "no playerCar" });
      
      // Find gltfBody — could be a direct property or inside root
      let body = car.gltfBody;
      if (!body && car.root) {
        car.root.traverse(c => { if (c.userData && c.userData.currentLOD !== undefined) body = c; });
      }
      if (!body) return JSON.stringify({ error: "no gltfBody found", carKeys: Object.keys(car) });
      
      const meshes = { lod0: [], lod1: [], lod2: [], unknown: [] };
      let totalMeshes = 0;
      
      body.traverse(child => {
        if (child.isMesh) {
          totalMeshes++;
          const level = child.userData ? child.userData.lodMinLevel : undefined;
          const entry = { name: child.name, visible: child.visible, lodMinLevel: level };
          if (level === 0) meshes.lod0.push(entry);
          else if (level === 1) meshes.lod1.push(entry);
          else if (level === 2) meshes.lod2.push(entry);
          else meshes.unknown.push(entry);
        }
      });
      
      const currentLOD = body.userData ? body.userData.currentLOD : "unknown";
      let visibleCount = 0;
      body.traverse(ch => { if (ch.isMesh && ch.visible) visibleCount++; });
      
      // Test LOD transitions
      const lodTests = {};
      if (car.setLODLevel) {
        for (const lvl of [0, 1, 2]) {
          car.setLODLevel(lvl);
          let v = 0;
          body.traverse(ch => { if (ch.isMesh && ch.visible) v++; });
          lodTests["lod" + lvl + "_visible"] = v;
        }
        // Restore to LOD 0 for player
        car.setLODLevel(0);
      }
      
      return JSON.stringify({
        totalMeshes,
        currentLOD,
        visibleMeshes: visibleCount,
        lod2Names: meshes.lod2.map(m => m.name),
        lod2Count: meshes.lod2.length,
        lod1Count: meshes.lod1.length,
        lod0Count: meshes.lod0.length,
        unknownCount: meshes.unknown.length,
        isTraffic: body.userData ? !!body.userData.isTraffic : false,
        lodTransitionTests: lodTests
      });
    })()
  `);
  console.log("LOD Audit (Player Car):", lodAudit);

  // Traffic vehicle audit
  const trafficAudit = await evaluate(`
    (function() {
      const eng = window.__kanoEngine;
      if (!eng) return JSON.stringify({ error: "no engine" });
      const ts = eng.trafficSystem;
      if (!ts) return JSON.stringify({ error: "no trafficSystem", engKeys: Object.keys(eng).filter(k => /traffic/i.test(k)) });
      
      const vehicles = ts.vehicles || [];
      const results = [];
      
      for (let i = 0; i < Math.min(vehicles.length, 3); i++) {
        const v = vehicles[i];
        if (!v) { results.push({ index: i, error: "null vehicle" }); continue; }
        
        let body = v.gltfBody;
        if (!body && v.root) {
          v.root.traverse(c => { if (c.userData && c.userData.currentLOD !== undefined && !body) body = c; });
        }
        if (!body) { results.push({ index: i, error: "no gltfBody" }); continue; }
        
        let totalMeshes = 0, visibleMeshes = 0;
        body.traverse(ch => { if (ch.isMesh) { totalMeshes++; if (ch.visible) visibleMeshes++; } });
        
        results.push({
          index: i,
          currentLOD: body.userData ? body.userData.currentLOD : "unknown",
          isTraffic: body.userData ? !!body.userData.isTraffic : false,
          totalMeshes,
          visibleMeshes
        });
      }
      
      return JSON.stringify({ totalVehicles: vehicles.length, samples: results });
    })()
  `);
  console.log("Traffic Audit:", trafficAudit);

  // ===================== TASK 3: UNCAPPED FPS DIAGNOSTIC =====================
  console.log("\n=== TASK 3: UNCAPPED FPS DIAGNOSTIC ===");
  
  const positions = [
    { name: "CBD", x: 0, z: -62 },
    { name: "Wuse", x: -30, z: 88 },
    { name: "Maitama", x: -53, z: -4 }
  ];
  
  const uncappedResults = {};
  
  for (const pos of positions) {
    console.log(`Testing uncapped FPS at ${pos.name}...`);
    
    // Move camera
    await evaluate(`
      (function() {
        const eng = window.__kanoEngine;
        if (!eng || !eng.camera) return;
        eng.camera.position.set(${pos.x}, 8, ${pos.z});
        eng.camera.lookAt(${pos.x}, 0, ${pos.z + 20});
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));
    
    // Run uncapped render: 300 frames, setTimeout(0) between each
    const result = await evaluate(`
      (async function() {
        const eng = window.__kanoEngine;
        if (!eng || !eng.renderer) return JSON.stringify({ error: "no renderer" });
        const renderer = eng.renderer;
        const scene = eng.scene;
        const camera = eng.camera;
        
        const frameTimes = [];
        
        for (let i = 0; i < 300; i++) {
          const t0 = performance.now();
          renderer.render(scene, camera);
          const t1 = performance.now();
          frameTimes.push(t1 - t0);
          if (i % 50 === 0) await new Promise(r => setTimeout(r, 0));
        }
        
        const sorted = [...frameTimes].sort((a, b) => a - b);
        const totalTime = frameTimes.reduce((a, b) => a + b, 0);
        const avgFT = totalTime / frameTimes.length;
        const drawCalls = renderer.info && renderer.info.render ? renderer.info.render.calls : null;
        const triangles = renderer.info && renderer.info.render ? renderer.info.render.triangles : null;
        
        return JSON.stringify({
          frames: 300,
          totalMs: +totalTime.toFixed(2),
          avgFrameMs: +avgFT.toFixed(3),
          avgFPS: +(1000 / avgFT).toFixed(1),
          medianMs: +sorted[150].toFixed(3),
          medianFPS: +(1000 / sorted[150]).toFixed(1),
          p1LowMs: +sorted[297].toFixed(3),
          p1LowFPS: +(1000 / sorted[297]).toFixed(1),
          minMs: +sorted[0].toFixed(3),
          maxMs: +sorted[299].toFixed(3),
          drawCalls,
          triangles
        });
      })()
    `, 60000);
    
    console.log(`  ${pos.name}:`, result);
    try { uncappedResults[pos.name] = JSON.parse(result); } catch { uncappedResults[pos.name] = result; }
  }

  // ===================== RENDER INFO =====================
  const renderInfo = await evaluate(`
    (function() {
      const eng = window.__kanoEngine;
      if (!eng || !eng.renderer) return JSON.stringify({ error: "no renderer" });
      const info = eng.renderer.info;
      return JSON.stringify({
        render: info.render,
        memory: info.memory,
        programs: info.programs ? info.programs.length : 0
      });
    })()
  `);
  console.log("\nRenderer Info:", renderInfo);

  // ===================== SAVE RESULTS =====================
  const auditResults = {
    timestamp: new Date().toISOString(),
    task1_gpuTiming: {
      gpuInfo: safeJSON(gpuInfo),
      samples: safeJSON(gpuSamples)
    },
    task2_lodAudit: {
      playerCar: safeJSON(lodAudit),
      trafficVehicles: safeJSON(trafficAudit)
    },
    task3_uncappedFPS: uncappedResults,
    renderInfo: safeJSON(renderInfo)
  };

  const outPath = path.join(process.cwd(), "scripts", "final-audit-results.json");
  fs.writeFileSync(outPath, JSON.stringify(auditResults, null, 2));
  console.log("\n=== AUDIT COMPLETE ===");
  console.log("Results saved to:", outPath);

  ws.close();
  edgeProc.kill();
  process.exit(0);
}

function safeJSON(val) {
  if (val === "__ERROR__" || val === undefined) return { error: "evaluation_failed" };
  try { return JSON.parse(val); } catch { return val; }
}

run().catch(e => {
  console.error("FATAL:", e);
  edgeProc.kill();
  process.exit(1);
});

setTimeout(() => {
  console.error("TIMEOUT after 3 minutes");
  edgeProc.kill();
  process.exit(1);
}, 180000);
