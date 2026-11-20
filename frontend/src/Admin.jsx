import { useState } from "react";
import * as XLSX from "xlsx";
import { ethers } from "ethers";
import deployment from "./contract.json";

const REQUIRED = ["studentName", "studentId", "diplomaTitle", "issueDate", "grade"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY = { recipient: "", studentName: "", studentId: "", diplomaTitle: "", issueDate: "", grade: "" };

// Erreurs personnalisées du contrat -> message lisible
const CUSTOM_ERRORS = {
  AccessControlUnauthorizedAccount: "Accès refusé : ce compte n'a pas MINTER_ROLE. Demandez un grantRole à l'administrateur.",
  StudentIdAlreadyUsed: "Ce studentId a déjà reçu un certificat (double mint interdit).",
  ZeroAddress: "Adresse destinataire nulle.",
  EmptyField: "Champ obligatoire vide (nom, identifiant, diplôme ou tokenURI).",
  EmptyBatch: "Lot vide.",
  BatchTooLarge: "Lot trop grand (50 certificats maximum).",
};

function errMsg(e) {
  const name = e.revert?.name;
  if (name && CUSTOM_ERRORS[name]) {
    const arg = name === "StudentIdAlreadyUsed" ? ` (${e.revert.args[0]})` : "";
    return CUSTOM_ERRORS[name] + arg;
  }
  if (e.code === "ACTION_REJECTED") return "Transaction refusée dans MetaMask.";
  const raw = e.reason || e.shortMessage || e.message || String(e);
  if (/AccessControlUnauthorizedAccount/i.test(raw)) return CUSTOM_ERRORS.AccessControlUnauthorizedAccount;
  if (/insufficient funds/i.test(raw)) return "Fonds insuffisants pour payer le gas (ETH Sepolia).";
  if (typeof e.data === "string" && e.data.length >= 10 && /unknown custom error/i.test(raw)) {
    return `${raw} [selecteur ${e.data.slice(0, 10)}]`;
  }
  return raw;
}

// Métadonnées générées côté client : pas besoin d'IPFS
function makeUri(r) {
  const meta = JSON.stringify({
    name: `${r.diplomaTitle} - ${r.studentName}`,
    description: `Certificat academique delivre a ${r.studentName}`,
    attributes: [
      { trait_type: "studentId", value: r.studentId },
      { trait_type: "issueDate", value: r.issueDate },
      { trait_type: "grade", value: r.grade || "" },
    ],
  });
  const bytes = new TextEncoder().encode(meta);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return "data:application/json;base64," + btoa(bin);
}

// Lien Etherscan uniquement sur Sepolia (en local, hash brut)
function TxLink({ hash }) {
  if (deployment.chainId !== 11155111) return <code>{hash}</code>;
  return <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer"><code>{hash}</code></a>;
}

function normDate(v) {
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v ?? "").trim();
}

function validateRows(raw) {
  const seen = new Set();
  return raw.map((r, i) => {
    const row = {
      studentName: String(r.studentName ?? "").trim(),
      studentId: String(r.studentId ?? "").trim(),
      diplomaTitle: String(r.diplomaTitle ?? "").trim(),
      issueDate: normDate(r.issueDate),
      grade: String(r.grade ?? "").trim(),
      recipientAddress: String(r.recipientAddress ?? "").trim(),
    };
    const errors = [];
    REQUIRED.forEach((k) => !row[k] && errors.push(`${k} manquant`));
    if (row.issueDate && !ISO_DATE.test(row.issueDate)) errors.push("issueDate doit etre AAAA-MM-JJ");
    if (row.recipientAddress && !ethers.isAddress(row.recipientAddress)) errors.push("adresse invalide");
    const key = row.studentId;
    if (seen.has(key)) errors.push("doublon dans le fichier");
    seen.add(key);
    return { ...row, line: i + 2, errors, selected: errors.length === 0 };
  });
}

// Le contrat refuse l'adresse nulle : sans destinataire, le certificat va au compte connecté
export default function Admin({ contract, account }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function mintOne(e) {
    e.preventDefault();
    setError(""); setResult(null);
    if (form.recipient && !ethers.isAddress(form.recipient)) return setError("Adresse destinataire invalide.");
    if (form.issueDate && !ISO_DATE.test(form.issueDate)) return setError("Date au format AAAA-MM-JJ.");
    setBusy(true);
    try {
      const uri = makeUri(form);
      const tx = await contract.mintCertificate(
        form.recipient || account,
        form.studentName, form.studentId, form.diplomaTitle,
        form.issueDate, form.grade, uri
      );
      const receipt = await tx.wait();
      let tokenId = "?";
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "CertificateMinted") tokenId = parsed.args.tokenId.toString();
        } catch { /* log d'un autre contrat */ }
      }
      setResult({ hash: tx.hash, tokenId, uri });
      setForm(EMPTY);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const [rows, setRows] = useState([]);
  const [batchSize, setBatchSize] = useState(10);
  const [logs, setLogs] = useState([]);
  const [sending, setSending] = useState(false);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setLogs([]);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      if (raw.length === 0) throw new Error("Fichier vide.");
      const missing = REQUIRED.filter((c) => !(c in raw[0]));
      if (missing.length) throw new Error(`Colonnes manquantes : ${missing.join(", ")}`);
      setRows(validateRows(raw));
    } catch (err) {
      setRows([]);
      setError(errMsg(err));
    }
  }

  const toggle = (i) => setRows(rows.map((r, k) => (k === i && r.errors.length === 0 ? { ...r, selected: !r.selected } : r)));

  async function sendSelected() {
    setError(""); setLogs([]);
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return setError("Aucune ligne selectionnee.");
    const size = Math.min(Math.max(parseInt(batchSize) || 10, 1), 15); // <= MAX_BATCH_SIZE (50)
    setSending(true);

    // Pré-vérification : simule chaque ligne (rôle, adresse, champs) sans envoyer de transaction
    for (const r of selected) {
      try {
        await contract.mintCertificate.staticCall(
          r.recipientAddress || account,
          r.studentName, r.studentId, r.diplomaTitle, r.issueDate, r.grade, makeUri(r)
        );
      } catch (err) {
        setSending(false);
        return setError(`Ligne ${r.line} (${r.studentId}) refusée par le contrat : ${errMsg(err)}`);
      }
    }

    for (let i = 0; i < selected.length; i += size) {
      const chunk = selected.slice(i, i + size);
      const label = `Lot ${i / size + 1} (${chunk.length} certificats)`;
      try {
        const inputs = chunk.map((r) => ({
          to: r.recipientAddress || account,
          studentName: r.studentName,
          studentId: r.studentId,
          diplomaTitle: r.diplomaTitle,
          issueDate: r.issueDate,
          grade: r.grade,
          uri: makeUri(r),
        }));
        const tx = await contract.batchMintCertificates(inputs);
        setLogs((l) => [...l, { label, status: "envoye", hash: tx.hash }]);
        await tx.wait();
        setLogs((l) => l.map((x) => (x.label === label ? { ...x, status: "confirme" } : x)));
      } catch (err) {
        setLogs((l) => [...l, { label, status: "erreur", error: errMsg(err) }]);
        break;
      }
    }
    setSending(false);
  }

  return (
    <section>
      <h2>Émission unitaire</h2>
      <form onSubmit={mintOne} className="grid">
        <input placeholder="Adresse wallet (vide = compte connecté)" value={form.recipient} onChange={set("recipient")} />
        <input placeholder="Nom de l'étudiant *" value={form.studentName} onChange={set("studentName")} required />
        <input placeholder="Identifiant / CNE *" value={form.studentId} onChange={set("studentId")} required />
        <input placeholder="Diplôme *" value={form.diplomaTitle} onChange={set("diplomaTitle")} required />
        <input placeholder="Date AAAA-MM-JJ *" value={form.issueDate} onChange={set("issueDate")} required />
        <input placeholder="Mention" value={form.grade} onChange={set("grade")} />
        <button disabled={busy}>{busy ? "Transaction en cours..." : "Émettre le certificat"}</button>
      </form>
      {result && (
        <p className="ok">
          Certificat n°<strong>{result.tokenId}</strong> émis. Hash : <TxLink hash={result.hash} /><br />
          tokenURI : <code title={result.uri}>{result.uri.slice(0, 70)}…</code>
        </p>
      )}

      <h2>Import Excel / CSV</h2>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
      {rows.length > 0 && (
        <>
          <div className="scroll">
            <table>
              <thead>
                <tr><th></th><th>Ligne</th><th>Nom</th><th>CNE</th><th>Diplôme</th><th>Date</th><th>Mention</th><th>Adresse</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.errors.length ? "bad" : ""}>
                    <td><input type="checkbox" checked={r.selected} disabled={r.errors.length > 0} onChange={() => toggle(i)} /></td>
                    <td>{r.line}</td><td>{r.studentName}</td><td>{r.studentId}</td><td>{r.diplomaTitle}</td>
                    <td>{r.issueDate}</td><td>{r.grade}</td>
                    <td><code>{r.recipientAddress ? r.recipientAddress.slice(0, 8) + "…" : "-"}</code></td>
                    <td>{r.errors.length ? r.errors.join(" ; ") : "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            <label>Taille des lots (1-15) :
              <input type="number" min="1" max="15" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} style={{ width: 70, marginLeft: 8 }} />
            </label>
            <button disabled={sending} onClick={sendSelected}>
              {sending ? "Envoi en cours..." : `Émettre ${rows.filter((r) => r.selected).length} certificat(s)`}
            </button>
          </div>
        </>
      )}
      {logs.map((l, i) => (
        <p key={i} className={l.status === "erreur" ? "error" : "ok"}>
          {l.label} : {l.status} {l.hash && <TxLink hash={l.hash} />} {l.error}
        </p>
      ))}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
