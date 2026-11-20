// Relance les commandes et écrit leurs sorties en UTF-8 propre (pas de Tee-Object).
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const env = { ...process.env, Path: "C:\\Program Files\\nodejs;" + (process.env.Path || "") };

// On ne relance que les commandes sans effet de bord (les autres fichiers sont
// simplement convertis de UTF-16 (Tee-Object) vers UTF-8 plus bas).
const jobs = [
  ["npm test", "01_npm_test.txt"],
  ["npx hardhat coverage", "02_coverage.txt"],
];

for (const f of ["03_deploiement_local.txt", "04_mint_demo.txt"]) {
  const p = path.join(__dirname, f);
  const buf = fs.readFileSync(p);
  const txt = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le").replace(/^\uFEFF/, "") : buf.toString("utf8");
  fs.writeFileSync(p, txt, "utf8");
}

for (const [cmd, file] of jobs) {
  const r = spawnSync(cmd, { shell: true, cwd: root, env, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const out = (r.stdout || "") + (r.stderr || "") + "\n(code: " + r.status + ")\n";
  fs.writeFileSync(path.join(__dirname, file), out, "utf8");
  console.log(file, "->", r.status);
}
