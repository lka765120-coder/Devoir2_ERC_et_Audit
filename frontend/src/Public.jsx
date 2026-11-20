import { useState } from "react";
import deployment from "./contract.json";

const IS_SEPOLIA = deployment.chainId === 11155111;

// Décode une tokenURI "data:application/json;base64,..." (sinon null)
function decodeMetadata(uri) {
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) return null;
  try {
    const bin = atob(uri.slice(prefix.length));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export default function Public({ contract }) {
  const [certId, setCertId] = useState("");
  const [cert, setCert] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e.preventDefault();
    setError(""); setCert(null);
    if (!/^\d+$/.test(certId) || certId === "0") return setError("Entrez un tokenId numerique >= 1.");
    setLoading(true);
    try {
      // getCertificate renvoie (cert, recipient, uri)
      const [c, recipient, uri] = await contract.getCertificate(certId);
      setCert({
        tokenId: certId,
        studentName: c.studentName, studentId: c.studentId, diplomaTitle: c.diplomaTitle,
        issueDate: c.issueDate, grade: c.grade, recipient, uri, revoked: c.revoked,
        metadata: decodeMetadata(uri),
      });
    } catch (err) {
      const notFound = err.revert?.name === "ERC721NonexistentToken";
      setError(notFound ? `Aucun certificat avec le tokenId ${certId}.` : "Certificat introuvable (ou nœud RPC injoignable).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Vérifier un certificat</h2>
      <form onSubmit={search} className="row">
        <input placeholder="Token ID (ex : 1)" value={certId} onChange={(e) => setCertId(e.target.value.trim())} />
        <button disabled={!contract || loading}>{loading ? "Recherche..." : "Rechercher"}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {cert && (
        <div className="card">
          <p className={cert.revoked ? "error" : "ok"}>
            Statut : <strong>{cert.revoked ? "REVOQUE" : "VALIDE"}</strong>
          </p>
          <table>
            <tbody>
              <tr><th>Token ID</th><td><strong>#{cert.tokenId}</strong></td></tr>
              <tr><th>Étudiant</th><td>{cert.studentName}</td></tr>
              <tr><th>Identifiant (CNE)</th><td>{cert.studentId}</td></tr>
              <tr><th>Diplôme</th><td>{cert.diplomaTitle}</td></tr>
              <tr><th>Date d'émission</th><td>{cert.issueDate}</td></tr>
              <tr><th>Mention</th><td>{cert.grade}</td></tr>
              <tr><th>Adresse destinataire</th><td><code>{cert.recipient}</code></td></tr>
              <tr><th>tokenURI</th><td><code title={cert.uri}>{cert.uri.length > 70 ? cert.uri.slice(0, 70) + "…" : cert.uri}</code></td></tr>
              <tr><th>Contrat</th><td>
                {IS_SEPOLIA ? (
                  <a href={`https://sepolia.etherscan.io/nft/${deployment.address}/${cert.tokenId}`} target="_blank" rel="noreferrer">
                    <code>{deployment.address}</code> (voir sur Etherscan)
                  </a>
                ) : <code>{deployment.address}</code>}
              </td></tr>
            </tbody>
          </table>
          {cert.metadata && (
            <>
              <h3>Métadonnées décodées (tokenURI)</h3>
              <pre className="scroll">{JSON.stringify(cert.metadata, null, 2)}</pre>
            </>
          )}
        </div>
      )}
    </section>
  );
}
