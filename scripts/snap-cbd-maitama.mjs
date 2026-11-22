import fs from "fs";
import path from "path";

const DEBUG_PORT = 9252;
const screenshotsDir = "C:\\Users\\USER\\.gemini\\antigravity\\brain\\071c962c-0708-4000-887d-b3eaaac1b5f6\\screenshots";

async function run() {
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
          else resolve(d.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async function setCam({ x, y, z, yaw, pitch }) {
    await send("Runtime.evaluate", {
      expression: `(() => {
        const eng = window.__kanoEngine;
        eng.statusMessage = null;
        eng.setCameraMode("first-person");
        if (eng.player && eng.player.root) eng.player.root.visible = false;
        const ground = eng.surfaceHeight(${x}, ${z});
        const posY = ${y !== undefined ? y : 'ground + 1.68'};
        eng.playerPosition.set(${x}, posY, ${z});
        eng.playerYaw = ${yaw};
        eng.cameraYaw = ${yaw};
        eng.cameraPitch = ${pitch};
        if (eng.abujaStreamingManager) eng.abujaStreamingManager.update(eng.playerPosition, true);
        eng.updateChunkCulling(true);
        eng.renderer.render(eng.scene, eng.camera);
      })()`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1200));
  }

  async function snap(name) {
    const res = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(screenshotsDir, name), Buffer.from(res.data, "base64"));
    console.log("Captured:", name);
  }

  // 1. CBD Three Arms Zone Monumental Panorama
  console.log("Capturing phase2_cbd_threearms.png...");
  await setCam({ x: 0, y: 3.5, z: -62, yaw: Math.PI, pitch: 0.14 });
  await snap("phase2_cbd_threearms.png");

  // 2. Maitama Luxury Residential Compound & Security Gate
  console.log("Capturing phase2_maitama.png...");
  await setCam({ x: -53, y: 1.8, z: -4, yaw: Math.PI, pitch: 0.05 });
  await snap("phase2_maitama.png");

  ws.close();
}

run().catch(console.error);
