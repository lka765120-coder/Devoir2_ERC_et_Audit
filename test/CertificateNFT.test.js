const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const sample = (to, id = "2023-INF-042") => [
  to, "Amina Benali", id, "Licence Informatique", "2026-06-15", "Mention Bien", "ipfs://cid/" + id + ".json",
];
// version objet pour batchMintCertificates (struct CertificateInput)
const asInput = (a) => ({
  to: a[0], studentName: a[1], studentId: a[2], diplomaTitle: a[3], issueDate: a[4], grade: a[5], uri: a[6],
});

async function deployFixture() {
  const [admin, minter, student, other] = await ethers.getSigners();
  const c = await (await ethers.getContractFactory("CertificateNFT")).deploy(admin.address);
  const MINTER_ROLE = await c.MINTER_ROLE();
  const ADMIN_ROLE = await c.DEFAULT_ADMIN_ROLE();
  await c.grantRole(MINTER_ROLE, minter.address);
  return { c, admin, minter, student, other, MINTER_ROLE, ADMIN_ROLE };
}

describe("CertificateNFT", () => {
  describe("mint", () => {
    it("mint réussi : owner, tokenURI, données, event", async () => {
      const { c, minter, student } = await loadFixture(deployFixture);
      await expect(c.connect(minter).mintCertificate(...sample(student.address)))
        .to.emit(c, "CertificateMinted").withArgs(1, student.address, "2023-INF-042");
      expect(await c.ownerOf(1)).to.equal(student.address);
      expect(await c.tokenURI(1)).to.equal("ipfs://cid/2023-INF-042.json");
      const [cert, recipient] = await c.getCertificate(1);
      expect(cert.studentName).to.equal("Amina Benali");
      expect(cert.revoked).to.equal(false);
      expect(recipient).to.equal(student.address);
      expect(await c.isValid(1)).to.equal(true);
    });

    it("accès refusé pour un compte sans MINTER_ROLE", async () => {
      const { c, other, student, MINTER_ROLE } = await loadFixture(deployFixture);
      await expect(c.connect(other).mintCertificate(...sample(student.address)))
        .to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount")
        .withArgs(other.address, MINTER_ROLE);
    });

    it("double mint du même studentId bloqué", async () => {
      const { c, minter, student, other } = await loadFixture(deployFixture);
      await c.connect(minter).mintCertificate(...sample(student.address));
      await expect(c.connect(minter).mintCertificate(...sample(other.address)))
        .to.be.revertedWithCustomError(c, "StudentIdAlreadyUsed");
    });

    it("rejette adresse nulle et champs vides", async () => {
      const { c, minter, student } = await loadFixture(deployFixture);
      await expect(c.connect(minter).mintCertificate(...sample(ethers.ZeroAddress)))
        .to.be.revertedWithCustomError(c, "ZeroAddress");
      const bad = sample(student.address); bad[1] = "";
      await expect(c.connect(minter).mintCertificate(...bad))
        .to.be.revertedWithCustomError(c, "EmptyField");
    });

    it("tokenIdOfStudent et autres champs vides rejetés", async () => {
      const { c, minter, student } = await loadFixture(deployFixture);
      await c.connect(minter).mintCertificate(...sample(student.address));
      expect(await c.tokenIdOfStudent("2023-INF-042")).to.equal(1);
      expect(await c.tokenIdOfStudent("inconnu")).to.equal(0);
      for (const idx of [2, 3, 6]) {
        const bad = sample(student.address, "X-" + idx);
        bad[idx] = "";
        await expect(c.connect(minter).mintCertificate(...bad))
          .to.be.revertedWithCustomError(c, "EmptyField");
      }
    });

    it("constructeur refuse l'adresse nulle", async () => {
      const F = await ethers.getContractFactory("CertificateNFT");
      await expect(F.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(F, "ZeroAddress");
    });
  });

  describe("batch", () => {
    it("batch réussi", async () => {
      const { c, minter, student } = await loadFixture(deployFixture);
      const inputs = ["A-1", "A-2", "A-3"].map((id) => asInput(sample(student.address, id)));
      await expect(c.connect(minter).batchMintCertificates(inputs)).to.emit(c, "CertificateMinted");
      expect(await c.totalMinted()).to.equal(3);
      expect(await c.balanceOf(student.address)).to.equal(3);
    });

    it("batch refusé sans rôle, vide, trop gros, ou avec doublon (tout est annulé)", async () => {
      const { c, minter, other, student } = await loadFixture(deployFixture);
      await expect(c.connect(other).batchMintCertificates([asInput(sample(student.address))]))
        .to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount");
      await expect(c.connect(minter).batchMintCertificates([]))
        .to.be.revertedWithCustomError(c, "EmptyBatch");
      const big = Array.from({ length: 51 }, (_, i) => asInput(sample(student.address, "B-" + i)));
      await expect(c.connect(minter).batchMintCertificates(big))
        .to.be.revertedWithCustomError(c, "BatchTooLarge");
      const dup = [asInput(sample(student.address, "D-1")), asInput(sample(student.address, "D-1"))];
      await expect(c.connect(minter).batchMintCertificates(dup))
        .to.be.revertedWithCustomError(c, "StudentIdAlreadyUsed");
      expect(await c.totalMinted()).to.equal(0);
    });
  });

  describe("revoke", () => {
    it("revoke par l'admin : flag + event", async () => {
      const { c, admin, minter, student } = await loadFixture(deployFixture);
      await c.connect(minter).mintCertificate(...sample(student.address));
      await expect(c.connect(admin).revokeCertificate(1))
        .to.emit(c, "CertificateRevoked").withArgs(1, admin.address);
      expect((await c.getCertificate(1))[0].revoked).to.equal(true);
      expect(await c.isValid(1)).to.equal(false);
    });

    it("minter simple ne peut pas révoquer ; double revoke et token inexistant rejetés", async () => {
      const { c, admin, minter, student, ADMIN_ROLE } = await loadFixture(deployFixture);
      await c.connect(minter).mintCertificate(...sample(student.address));
      await expect(c.connect(minter).revokeCertificate(1))
        .to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount")
        .withArgs(minter.address, ADMIN_ROLE);
      await c.connect(admin).revokeCertificate(1);
      await expect(c.connect(admin).revokeCertificate(1)).to.be.revertedWithCustomError(c, "AlreadyRevoked");
      await expect(c.connect(admin).revokeCertificate(99)).to.be.revertedWithCustomError(c, "ERC721NonexistentToken");
    });
  });

  describe("sécurité", () => {
    it("certificat non transférable (soulbound)", async () => {
      const { c, minter, student, other } = await loadFixture(deployFixture);
      await c.connect(minter).mintCertificate(...sample(student.address));
      await expect(c.connect(student).transferFrom(student.address, other.address, 1))
        .to.be.revertedWithCustomError(c, "Soulbound");
    });

    it("reentrancy via onERC721Received bloquée", async () => {
      const { c, admin, minter } = await loadFixture(deployFixture);
      const attacker = await (await ethers.getContractFactory("ReentrantReceiver")).deploy(await c.getAddress());
      await c.connect(admin).grantRole(await c.MINTER_ROLE(), await attacker.getAddress());
      await expect(c.connect(minter).mintCertificate(...sample(await attacker.getAddress(), "R-1")))
        .to.be.revertedWithCustomError(c, "ReentrancyGuardReentrantCall");
    });

    it("grantRole réservé à l'admin ; supportsInterface ERC-721", async () => {
      const { c, other } = await loadFixture(deployFixture);
      await expect(c.connect(other).grantRole(await c.MINTER_ROLE(), other.address))
        .to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount");
      expect(await c.supportsInterface("0x80ac58cd")).to.equal(true);
    });
  });
});