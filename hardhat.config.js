require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { SEPOLIA_RPC_URL, PRIVATE_KEY } = process.env;
// Sepolia n'est active que si la cle privee est valide (32 octets hex), sinon les tests locaux restent utilisables
const hasValidKey = /^(0x)?[0-9a-fA-F]{64}$/.test(PRIVATE_KEY || "");

module.exports = {
  solidity: {
    version: "0.8.24",
    // viaIR : necessaire car mintCertificate a beaucoup de parametres (erreur "stack too deep" sinon)
    // evmVersion cancun : requis par les versions recentes d'OpenZeppelin v5
    settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    ...(SEPOLIA_RPC_URL && hasValidKey
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [PRIVATE_KEY] } }
      : {}),
  },
};
