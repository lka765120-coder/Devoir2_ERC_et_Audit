# Preuves d'execution — Devoir 2

## 1. npm test (13 tests)
``

> certification-blockchain@1.0.0 test
> hardhat test



  CertificateNFT
    mint
      Γ£ö mint r├⌐ussi : owner, tokenURI, donn├⌐es, event (599ms)
      Γ£ö acc├¿s refus├⌐ pour un compte sans MINTER_ROLE
      Γ£ö double mint du m├¬me studentId bloqu├⌐
      Γ£ö rejette adresse nulle et champs vides
      Γ£ö tokenIdOfStudent et autres champs vides rejet├⌐s
      Γ£ö constructeur refuse l'adresse nulle
    batch
      Γ£ö batch r├⌐ussi
      Γ£ö batch refus├⌐ sans r├┤le, vide, trop gros, ou avec doublon (tout est annul├⌐)
    revoke
      Γ£ö revoke par l'admin : flag + event
      Γ£ö minter simple ne peut pas r├⌐voquer ; double revoke et token inexistant rejet├⌐s
    s├⌐curit├⌐
      Γ£ö certificat non transf├⌐rable (soulbound)
      Γ£ö reentrancy via onERC721Received bloqu├⌐e
      Γ£ö grantRole r├⌐serv├⌐ ├á l'admin ; supportsInterface ERC-721


  13 passing (784ms)


``

## 2. npx hardhat coverage
``

Version
=======
> solidity-coverage: v0.8.17

Instrumenting for coverage...
=============================

> CertificateNFT.sol
> mocks\ReentrantReceiver.sol

Compilation:
============

Compiled 25 Solidity files successfully (evm target: cancun).

Network Info
============
> HardhatEVM: v2.29.2
> network:    hardhat



  CertificateNFT
    mint
      Γ£ö mint r├⌐ussi : owner, tokenURI, donn├⌐es, event (229ms)
      Γ£ö acc├¿s refus├⌐ pour un compte sans MINTER_ROLE (48ms)
      Γ£ö double mint du m├¬me studentId bloqu├⌐
      Γ£ö rejette adresse nulle et champs vides
      Γ£ö tokenIdOfStudent et autres champs vides rejet├⌐s (64ms)
      Γ£ö constructeur refuse l'adresse nulle
    batch
      Γ£ö batch r├⌐ussi (56ms)
      Γ£ö batch refus├⌐ sans r├┤le, vide, trop gros, ou avec doublon (tout est annul├⌐) (76ms)
    revoke
      Γ£ö revoke par l'admin : flag + event (50ms)
      Γ£ö minter simple ne peut pas r├⌐voquer ; double revoke et token inexistant rejet├⌐s (47ms)
    s├⌐curit├⌐
      Γ£ö certificat non transf├⌐rable (soulbound)
      Γ£ö reentrancy via onERC721Received bloqu├⌐e
      Γ£ö grantRole r├⌐serv├⌐ ├á l'admin ; supportsInterface ERC-721


  13 passing (739ms)

------------------------|----------|----------|----------|----------|----------------|
File                    |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
------------------------|----------|----------|----------|----------|----------------|
 contracts\             |      100 |    96.88 |      100 |      100 |                |
  CertificateNFT.sol    |      100 |    96.88 |      100 |      100 |                |
 contracts\mocks\       |       50 |      100 |      100 |       50 |                |
  ReentrantReceiver.sol |       50 |      100 |      100 |       50 |             17 |
------------------------|----------|----------|----------|----------|----------------|
All files               |    96.67 |    96.88 |      100 |     97.3 |                |
------------------------|----------|----------|----------|----------|----------------|

> Istanbul reports written to ./coverage/ and ./coverage.json

``

## 3. npm run deploy:local
``

> certification-blockchain@1.0.0 deploy:local
> hardhat run scripts/deploy.js --network localhost

Compiled 25 Solidity files successfully (evm target: cancun).
CertificateNFT deploye a : 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
Admin / minter : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Tx de deploiement : 0xe71d6314e8d506a1de5f42906f5e0e8b1911c5407140da42e68f15a82bb6ab35
ABI ecrite dans C:\Users\ACHRAF\Downloads\certification\certification\frontend\src\contract.json

``

## 4. Mint de demonstration (tokenId 1)
``
Mint tx : 0xd43b77a4b4e7e00b35e0aeba2707cc7f9348dc6fad9c9f2a09efc39a2819f0b1
Total minted : 1
tokenURI(1) : data:application/json;base64,eyJuYW1lIjoiTGljZW5jZSBJbmZvcm1hdGlxdWUgLSBBbWluYSBCZW5hbGkiLCJkZXNjcmlwdGlvbiI6IkNlcnRpZmljYXQgYWNhZGVtaXF1ZSBkZWxpdnJlIGEgQW1pbmEgQmVuYWxpIiwiYXR0cmlidXRlcyI6W3sidHJhaXRfdHlwZSI6InN0dWRlbnRJZCIsInZhbHVlIjoiMjAyMy1JTkYtMDQyIn0seyJ0cmFpdF90eXBlIjoiaXNzdWVEYXRlIiwidmFsdWUiOiIyMDI2LTA2LTE1In0seyJ0cmFpdF90eXBlIjoiZ3JhZGUiLCJ2YWx1ZSI6Ik1lbnRpb24gQmllbiJ9XX0=

``
