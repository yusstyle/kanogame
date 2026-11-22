import { spawn } from "child_process";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9254;
const tempUserData = path.join(os.tmpdir(), `edge-test-console-${Date.now()}`);

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

  ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
  ws.send(JSON.stringify({ id: 2, method: "Log.enable" }));

  ws.addEventListener("message", (msg) => {
    const d = JSON.parse(msg.data);
    if (d.method === "Runtime.consoleAPICalled") {
      console.log("[BROWSER CONSOLE]", d.params.type, d.params.args.map(a => a.value || a.description).join(" "));
    }
    if (d.method === "Runtime.exceptionThrown") {
      console.error("[BROWSER EXCEPTION]", d.params.exceptionDetails?.text, d.params.exceptionDetails?.exception?.description);
    }
  });

  // Wait 6 seconds for Vite modules to finish transforming
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 1000));
    let id = 100 + i;
    ws.send(JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: {
        expression: "({ buttons: document.querySelectorAll('button').length, bodyLen: document.body.innerText.length, hasEngine: typeof window.__kanoEngine !== 'undefined' })",
        returnByValue: true
      }
    }));
  }

  await new Promise(r => setTimeout(r, 2000));
  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
