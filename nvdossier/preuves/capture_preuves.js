// Capture fiable de la page de preuves via CDP (Edge headless).
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 9225;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = path.join(__dirname, "08_preuves_terminal.png");
const PROFILE = path.join(__dirname, ".edge-profile-2");
const URL = "file:///C:/Users/ACHRAF/Downloads/certification/certification/nvdossier/preuves/07_preuves.html";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, label) {
  const t = Date.now();
  while (Date.now() - t < ms) { try { if (await fn()) return; } catch {} await sleep(250); }
  throw new Error("Timeout " + label);
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map();
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(script) { const r = await this.send("Runtime.evaluate", { expression: script, returnByValue: true }); return r.result.value; }
}

(async () => {
  const proc = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--window-size=1400,2100", "about:blank"], { stdio: "ignore" });
  try {
    await waitFor(async () => (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok, 20000, "CDP");
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const cdp = new CDP(ws);
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 3000, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: URL });
    await waitFor(async () => await cdp.eval("document.readyState === 'complete' && document.body.innerText.includes('13 passing')"), 20000, "page preuves");
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));
    console.log("Capture ecrite :", OUT);
    ws.close();
  } finally { proc.kill(); await sleep(400); try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {} }
})().catch((e) => { console.error(e); process.exitCode = 1; });
