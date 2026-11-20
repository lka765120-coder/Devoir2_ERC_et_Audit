// Émission d'un certificat de démonstration sur le nœud Hardhat local.
// Clé du compte de test #0 de Hardhat (UNIQUEMENT pour le réseau local, jamais sur un réseau réel).
const { ethers } = require("ethers");
const deployment = require("../../frontend/src/contract.json");

const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const wallet = new ethers.Wallet(PK, provider);
  const c = new ethers.Contract(deployment.address, deployment.abi, wallet);

  const meta = JSON.stringify({
    name: "Licence Informatique - Amina Benali",
    description: "Certificat academique delivre a Amina Benali",
    attributes: [
      { trait_type: "studentId", value: "2023-INF-042" },
      { trait_type: "issueDate", value: "2026-06-15" },
      { trait_type: "grade", value: "Mention Bien" },
    ],
  });
  const uri = "data:application/json;base64," + Buffer.from(meta, "utf8").toString("base64");

  const tx = await c.mintCertificate(
    wallet.address, "Amina Benali", "2023-INF-042",
    "Licence Informatique", "2026-06-15", "Mention Bien", uri
  );
  await tx.wait();
  console.log("Mint tx :", tx.hash);
  console.log("Total minted :", (await c.totalMinted()).toString());
  console.log("tokenURI(1) :", await c.tokenURI(1));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
