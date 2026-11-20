const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const c = await (await hre.ethers.getContractFactory("CertificateNFT")).deploy(deployer.address);
  await c.waitForDeployment();
  const address = await c.getAddress();
  console.log("CertificateNFT deploye a :", address);
  console.log("Admin / minter :", deployer.address);
  console.log("Tx de deploiement :", c.deploymentTransaction().hash);

  // Ecrit adresse + chainId + ABI pour le frontend (le frontend lit chainId)
  const artifact = await hre.artifacts.readArtifact("CertificateNFT");
  const out = path.join(__dirname, "..", "frontend", "src", "contract.json");
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ address, chainId, abi: artifact.abi }, null, 2));
  console.log("ABI ecrite dans", out);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
