import { spawn } from "child_process";
import os from "os";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const GAME_URL = "http://localhost:5173/";
const DEBUG_PORT = 9255;
const tempUserData = path.join(os.tmpdir(), `edge-test-ws-${Date.now()}`);

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
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const list = await res.json();
  const pageTab = list.find(t => t.type === "page" && !t.url.startsWith("edge") && !t.url.startsWith("chrome-extension"));
  console.log("Connecting to:", pageTab?.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  ws.addEventListener("message", (msg) => {
    const d = JSON.parse(msg.data);
    if (d.result && d.result.result) {
      console.log("[EVAL RESULT id=" + d.id + "]", JSON.stringify(d.result.result.value));
    } else if (d.error) {
      console.error("[EVAL ERROR id=" + d.id + "]", d.error);
    }
  });

  // Navigate explicitly to be 100% certain
  ws.send(JSON.stringify({ id: 1, method: "Page.navigate", params: { url: GAME_URL } }));

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    ws.send(JSON.stringify({
      id: 10 + i,
      method: "Runtime.evaluate",
      params: {
        expression: "({ htmlLen: document.documentElement.outerHTML.length, text: document.body ? document.body.innerText.slice(0, 100) : 'no body' })",
        returnByValue: true
      }
    }));
  }

  await new Promise(r => setTimeout(r, 1000));
  ws.close();
  try { edgeProc.kill(); } catch {}
}

run().catch(console.error);
