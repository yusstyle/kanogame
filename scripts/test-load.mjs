import { spawn } from "child_process";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9253;
const tempUserData = path.join(os.tmpdir(), `edge-test-load-${Date.now()}`);

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
  console.log("Page Tab:", pageTab?.title, pageTab?.url);

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function evalCode(expr) {
    return new Promise(resolve => {
      const msgId = id++;
      const handler = (msg) => {
        const d = JSON.parse(msg.data);
        if (d.id === msgId) {
          ws.removeEventListener("message", handler);
          resolve(d.result?.result?.value);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: msgId, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }));
    });
  }

  // Check DOM
  const domInfo = await evalCode(`(() => {
    return {
      title: document.title,
      buttons: Array.from(document.querySelectorAll('button')).map(b => ({ text: b.textContent.trim(), class: b.className })),
      hasCanvas: !!document.querySelector('canvas'),
      hasKanoEngine: typeof window.__kanoEngine !== 'undefined',
      bodyText: document.body.innerText.slice(0, 300)
    };
  })()`);
  console.log("DOM Info:", JSON.stringify(domInfo, null, 2));

  // Try clicking the start button
  console.log("Clicking start button...");
  await evalCode(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter the neighborhood') || b.classList.contains('ks-button-primary'));
    if (btn) btn.click();
  })()`);

  await new Promise(r => setTimeout(r, 3000));
  const postClickInfo = await evalCode(`(() => {
    return {
      hasKanoEngine: typeof window.__kanoEngine !== 'undefined',
      engineLoaded: !!(window.__kanoEngine && window.__kanoEngine.scene),
      loadingStage: document.querySelector('.ks-loading-stage')?.textContent,
      currentCity: window.__kanoEngine?.currentCity
    };
  })()`);
  console.log("Post Click Info:", JSON.stringify(postClickInfo, null, 2));

  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
