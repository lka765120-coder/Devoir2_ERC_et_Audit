// Capture de la zone publique du frontend avec le certificat tokenId=1.
// Pilote un Edge headless via CDP (aucune modification du projet).
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 9223;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = path.join(__dirname, "06_frontend_public.png");
const PROFILE = path.join(__dirname, ".edge-profile");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(script) {
    const r = await this.send("Runtime.evaluate", { expression: script, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await fn()) return; } catch {}
    await sleep(250);
  }
  throw new Error("Timeout: " + label);
}

(async () => {
  const proc = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    "--window-size=1360,900", "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitFor(async () => {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return r.ok;
    }, 20000, "CDP prêt");

    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const cdp = new CDP(ws);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: "http://localhost:5173" });
    await waitFor(async () => await cdp.eval("document.readyState === 'complete' && !!document.querySelector('input')"), 20000, "chargement page");

    await cdp.eval(`(() => {
      const i = document.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(i, '1');
      i.dispatchEvent(new Event('input', { bubbles: true }));
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Rechercher'));
      b.click();
      return true;
    })()`);

    await waitFor(async () => await cdp.eval("document.body.innerText.includes('VALIDE')"), 20000, "résultat recherche");
    const text = await cdp.eval("document.body.innerText");

    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));
    console.log("Capture ecrite :", OUT);
    console.log("Texte verifie :\n" + text);
    ws.close();
  } finally {
    proc.kill();
    await sleep(500);
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
