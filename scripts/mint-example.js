// Mint d'un certificat d'exemple (pour la tx d'exemple demandée dans le devoir)
// Usage : npx hardhat run scripts/mint-example.js --network sepolia
const hre = require("hardhat");
const { address, abi } = require("../frontend/src/contract.json");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const c = new hre.ethers.Contract(address, abi, signer);

  const studentId = "2026-DEMO-" + (Date.now() % 100000);
  const metadata = {
    name: "Licence Informatique",
    description: "Certificat de réussite de Amina Benali",
    attributes: [
      { trait_type: "studentId", value: studentId },
      { trait_type: "grade", value: "Mention Bien" },
    ],
  };
  const uri = "data:application/json;base64," + Buffer.from(JSON.stringify(metadata)).toString("base64");

  const tx = await c.mintCertificate(
    signer.address, "Amina Benali", studentId, "Licence Informatique", "2026-06-15", "Mention Bien", uri
  );
  console.log("Tx mint :", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmée au bloc", receipt.blockNumber);
  console.log("Total mintés :", (await c.totalMinted()).toString());
}

main().catch((e) => { console.error(e); process.exitCode = 1; });