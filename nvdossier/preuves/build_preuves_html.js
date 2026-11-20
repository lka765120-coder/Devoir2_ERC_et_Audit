// Construit une page HTML lisible avec les sorties de terminal, pour capture d'écran.
const fs = require("fs");
const path = require("path");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const read = (f) => {
  const buf = fs.readFileSync(path.join(__dirname, f));
  const txt = (buf[0] === 0xff && buf[1] === 0xfe) ? buf.toString("utf16le").replace(/^\uFEFF/, "")
            : (buf[0] === 0xef && buf[1] === 0xbb) ? buf.toString("utf8").replace(/^\uFEFF/, "")
            : buf.toString("utf8");
  return esc(txt);
};

const blocks = [
  ["1. npm test — 13 tests réussis", "01_npm_test.txt"],
  ["2. npx hardhat coverage — 100 % lignes sur CertificateNFT.sol", "02_coverage.txt"],
  ["3. npm run deploy:local — adresse et tx de déploiement", "03_deploiement_local.txt"],
  ["4. Mint de démonstration — tokenId 1 et tokenURI", "04_mint_demo.txt"],
];

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Preuves d'exécution — Devoir 2</title>
<style>
 body{font-family:Segoe UI,Arial,sans-serif;background:#f6f8fa;color:#1f2328;margin:0;padding:28px 40px}
 h1{font-size:26px;margin:0 0 22px} h2{font-size:17px;margin:26px 0 8px;color:#0969da}
 pre{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:14px 18px;font-family:Consolas,monospace;
     font-size:13px;line-height:1.45;white-space:pre-wrap;margin:0}
 .ok{color:#1a7f37;font-weight:600}
</style></head><body>
<h1>Preuves d'exécution — Devoir 2 (ERC-721 &amp; audit)</h1>
${blocks.map(([t, f]) => `<h2>${t}</h2><pre>${read(f)}</pre>`).join("\n")}
</body></html>`;

fs.writeFileSync(path.join(__dirname, "07_preuves.html"), html, "utf8");
console.log("HTML ecrit");
