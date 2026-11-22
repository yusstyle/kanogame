import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9260;
const tempUserData = path.join(os.tmpdir(), `edge-snap-airport-${Date.now()}`);
const screenshotsDir = "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\screenshots";

console.log("Launching Edge...");
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
          else resolve(d.result?.result?.value !== undefined ? d.result.result.value : d.result);
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
  await new Promise(r => setTimeout(r, 3000));

  // Snap Airport Expressway at NNPC Mega Station & Airport Corridor
  await send("Runtime.evaluate", {
    expression: `(() => {
      const eng = window.__kanoEngine;
      eng.statusMessage = null;
      eng.setCameraMode("first-person");
      if (eng.player && eng.player.root) eng.player.root.visible = false;
      const ground = eng.surfaceHeight(35, 96);
      eng.playerPosition.set(35, ground + 1.68, 96);
      eng.playerYaw = 0;
      eng.cameraYaw = 0;
      eng.cameraPitch = 0.05;
      if (eng.abujaStreamingManager) eng.abujaStreamingManager.update(eng.playerPosition, true);
      eng.updateChunkCulling(true);
      eng.renderer.render(eng.scene, eng.camera);
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(screenshotsDir, "phase2_airport_expressway.png"), Buffer.from(shot.data, "base64"));
  console.log("Airport Expressway screenshot updated!");

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
