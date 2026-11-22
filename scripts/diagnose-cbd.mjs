import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9266;
const tempUserData = path.join(os.tmpdir(), `edge-diag-cbd-${Date.now()}`);

console.log("Launching Edge for CBD diagnosis...");
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

async function run() {
  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const list = await res.json();
  const pageTab = list.find(t => t.type === "page" && !t.url.startsWith("edge") && !t.url.startsWith("chrome-extension"));
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
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
          else if (d.result && d.result.result) resolve(d.result.result.value);
          else resolve(d.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // Set 1080p
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  // Wait for button and click
  for (let i = 0; i < 90; i++) {
    const ready = await send("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('.ks-button-primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter the neighborhood'));
        if (btn) btn.click();
        const eng = window.__kanoEngine;
        return typeof eng !== "undefined" && !!eng.scene && typeof eng.travelToCity === "function";
      })()`,
      returnByValue: true
    });
    if (ready) break;
    await new Promise(r => setTimeout(r, 600));
  }

  // Dismiss modals and travel to Abuja
  await send("Runtime.evaluate", {
    expression: `(() => {
      const dismissBtn = document.querySelector('.ks-onboarding-close-btn') || document.querySelector('.ks-onboarding-actions button');
      if (dismissBtn) dismissBtn.click();
      window.__kanoEngine.travelToCity("abuja", "highway");
    })()`
  });
  await new Promise(r => setTimeout(r, 3500));

  // Position at CBD
  console.log("Positioning camera at CBD...");
  await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
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
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  // Profile scene composition
  console.log("Inspecting CBD scene composition...");
  const diagData = await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
      const renderer = eng.renderer;
      const scene = eng.scene;
      const camera = eng.camera;

      // Force render and capture info
      renderer.info.reset();
      renderer.render(scene, camera);
      const renderInfo = {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        lines: renderer.info.render.lines,
        points: renderer.info.render.points,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures
      };

      // Hierarchy categorization
      const categoryCounts = {};
      const shadowCasterCounts = {};
      let totalMeshes = 0;
      let totalVisibleMeshes = 0;
      let totalShadowCasters = 0;

      const landmarkBreakdown = {};

      scene.traverse((obj) => {
        if (obj.isMesh || obj.isPoints || obj.isLine) {
          totalMeshes++;
          const isVis = obj.visible;
          if (isVis) totalVisibleMeshes++;
          if (obj.castShadow) {
            totalShadowCasters++;
          }

          let curr = obj;
          let topName = obj.name || "unnamed";
          let landmarkName = "other";

          while (curr.parent && curr.parent !== scene) {
            if (curr.parent.name === "AbujaWorldRoot" || curr.parent.name === "AbujaStreamingWorldRoot") {
              topName = curr.name || topName;
              break;
            }
            const n = curr.name || "";
            if (
              n.includes("ThreeArms") ||
              n.includes("Mosque") ||
              n.includes("Christian") ||
              n.includes("Cbn") ||
              n.includes("Nnpc") ||
              n.includes("Maitama") ||
              n.includes("Shopping") ||
              n.includes("Hotel") ||
              n.includes("Park") ||
              n.includes("Market") ||
              n.includes("Toll") ||
              n.includes("Airport") ||
              n.includes("Solar") ||
              n.includes("AsoRock") ||
              n.includes("Infrastructure") ||
              n.includes("Terrain") ||
              n.includes("Vegetation") ||
              n.includes("Traffic") ||
              n.includes("Pedestrian")
            ) {
              landmarkName = n;
            }
            curr = curr.parent;
          }

          const cat = topName || "root";
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          if (obj.castShadow) {
            shadowCasterCounts[cat] = (shadowCasterCounts[cat] || 0) + 1;
          }

          if (!landmarkBreakdown[landmarkName]) {
            landmarkBreakdown[landmarkName] = { meshes: 0, shadowCasters: 0, triangles: 0, visible: 0 };
          }
          landmarkBreakdown[landmarkName].meshes++;
          if (obj.castShadow) landmarkBreakdown[landmarkName].shadowCasters++;
          if (obj.visible) landmarkBreakdown[landmarkName].visible++;
          if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
            const count = obj.geometry.index ? obj.geometry.index.count / 3 : obj.geometry.attributes.position.count / 3;
            landmarkBreakdown[landmarkName].triangles += Math.round(count);
          }
        }
      });

      return {
        renderInfo,
        totalMeshes,
        totalVisibleMeshes,
        totalShadowCasters,
        categoryCounts,
        shadowCasterCounts,
        landmarkBreakdown,
        cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        activeChunks: eng.abujaStreamingManager ? eng.abujaStreamingManager.activeChunks : null
      };
    })()`,
    returnByValue: true
  });

  console.log("=== CBD DIAGNOSTIC REPORT ===");
  console.log("Renderer Info:", JSON.stringify(diagData.renderInfo, null, 2));
  console.log("Total Meshes: " + diagData.totalMeshes + ", Visible: " + diagData.totalVisibleMeshes + ", Shadow Casters: " + diagData.totalShadowCasters);
  console.log("Active Chunks:", diagData.activeChunks);
  console.log("\n--- Category Mesh Counts ---");
  console.log(JSON.stringify(diagData.categoryCounts, null, 2));
  console.log("\n--- Category Shadow Casters ---");
  console.log(JSON.stringify(diagData.shadowCasterCounts, null, 2));
  console.log("\n--- Landmark Breakdown ---");
  console.log(JSON.stringify(diagData.landmarkBreakdown, null, 2));

  fs.writeFileSync("Kano-3D-Neighborhood-Game/scripts/cbd-diagnostic-output.json", JSON.stringify(diagData, null, 2));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
