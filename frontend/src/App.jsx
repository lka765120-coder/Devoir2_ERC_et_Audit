import { useMemo, useState } from "react";
import { ethers } from "ethers";
import deployment from "./contract.json";
import Admin from "./Admin.jsx";
import Public from "./Public.jsx";

const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

export default function App() {
  const [tab, setTab] = useState("public");
  const [account, setAccount] = useState(null);
  const [signerContract, setSignerContract] = useState(null);
  const [isMinter, setIsMinter] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState("");

  const readContract = useMemo(() => {
    if (!deployment.address) return null;
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    return new ethers.Contract(deployment.address, deployment.abi, provider);
  }, []);

  async function connectWallet() {
    setError("");
    try {
      if (!window.ethereum) throw new Error("MetaMask non detecte. Installez l'extension.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const addr = await signer.getAddress();
      const c = new ethers.Contract(deployment.address, deployment.abi, signer);
      const id = Number(network.chainId);
      setAccount(addr);
      setChainId(id);
      setSignerContract(c);
      // Changement de compte ou de réseau dans MetaMask : on repart d'un état propre
      window.ethereum.on?.("accountsChanged", () => window.location.reload());
      window.ethereum.on?.("chainChanged", () => window.location.reload());
      if (id !== deployment.chainId) return; // hasRole échouerait sur une autre chaîne
      const role = await c.MINTER_ROLE();
      setIsMinter(await c.hasRole(role, addr));
    } catch (e) {
      setError(e.shortMessage || e.message);
    }
  }

  const wrongNetwork = chainId !== null && chainId !== deployment.chainId;

  return (
    <div className="container">
      <h1>Certification académique on-chain (ERC-721)</h1>
      {!deployment.address && (
        <p className="error">Aucun contrat déployé : lancez <code>npm run deploy:local</code> à la racine.</p>
      )}
      <nav>
        <button className={tab === "public" ? "active" : ""} onClick={() => setTab("public")}>Vérification publique</button>
        <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>Administration</button>
      </nav>

      {tab === "public" ? (
        <Public contract={readContract} />
      ) : (
        <>
          {account ? (
            <p className="ok">Connecté : <code>{account}</code> (réseau {chainId})</p>
          ) : (
            <button onClick={connectWallet}>Connecter MetaMask</button>
          )}
          {wrongNetwork && (
            <p className="error">
              Mauvais réseau : le contrat est sur la chaîne {deployment.chainId}
              {deployment.chainId === 11155111 ? " (Sepolia)" : " (Hardhat local)"}. Changez de réseau dans MetaMask.
            </p>
          )}
          {account && !wrongNetwork && !isMinter && (
            <p className="error">
              Ce compte n’a pas <code>MINTER_ROLE</code> : vous pouvez vérifier des certificats,
              mais pas en émettre. Connectez le compte administrateur ou demandez un <code>grantRole</code>.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {account && isMinter && !wrongNetwork && <Admin contract={signerContract} account={account} />}
        </>
      )}
    </div>
  );
}
