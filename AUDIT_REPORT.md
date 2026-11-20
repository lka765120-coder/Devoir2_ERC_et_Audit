# Rapport d’audit simplifié — Devoir 2

Auteur : ACHRAF  
Date : 19/11/2026  
Projet : Système de certification académique on-chain (migration ERC-721)

## 1. Périmètre audité

- `contracts/CertificateNFT.sol` : ERC721 + ERC721URIStorage + AccessControl + ReentrancyGuard (OpenZeppelin v5, Solidity 0.8.24, EVM Cancun).
- Fonctions : `mintCertificate`, `batchMintCertificates`, `revokeCertificate`, `getCertificate`, `isValid`, `tokenIdOfStudent`, `totalMinted`, `tokenURI`, `supportsInterface`.
- `contracts/mocks/ReentrantReceiver.sol` : uniquement utilisé par les tests (vecteur de reentrancy).
- Hors périmètre : frontend, configuration Hardhat, dépendances OpenZeppelin.

## 2. Checklist appliquée

| Exigence | Résultat |
|---|---|
| Standard OpenZeppelin (ERC-721) | OK |
| 1 certificat = 1 tokenId unique | OK |
| Métadonnées via `tokenURI` | OK (URI fournie à l’émission) |
| `MINTER_ROLE` via `AccessControl` | OK |
| Events `CertificateMinted` / `CertificateRevoked` avec `tokenId indexed` | OK |
| `nonReentrant` sur mint et batch | OK |
| Validation des inputs (adresse nulle, champs vides) | OK |
| Double mint du même `studentId` impossible | OK (`mapping` keccak(studentId) → tokenId) |
| Révocation claire (flag + event) | OK |
| Non-transférable (soulbound) | OK (`_update` refuse tout transfert) |
| Solidity ≥ 0.8.x | OK (0.8.24) |

## 2bis. Choix de conception

- **ERC-721 plutôt qu’ERC-20** : chaque certificat est unique et non fongible (un diplôme appartient à un étudiant précis).
- **ERC721URIStorage** : permet d’associer une `tokenURI` par tokenId sans réécrire tout le standard.
- **AccessControl (2 rôles)** plutôt que `Ownable` : sépare l’émission (`MINTER_ROLE`) de l’administration et de la révocation (`DEFAULT_ADMIN_ROLE`). Le déployeur reçoit les deux rôles au départ.
- **Soulbound** : `_update` refuse tout transfert ; un diplôme ne doit pas être vendu ou cédé.
- **`batchMintCertificates(CertificateInput[])`** : la struct regroupe adresse + champs du certificat + URI en un seul paramètre. Cela conserve le modèle de données du Devoir 1 et évite l’erreur « stack too deep » de sept tableaux parallèles. La variante `batchMintCertificates(address[], string[])` du sujet est donc couverte fonctionnellement, avec plus de données stockées.
- **`MAX_BATCH_SIZE = 50`** : borne le gas d’une transaction, complétée par des lots de 1–15 dans le frontend.
- **Métadonnées en `data:application/json;base64`** : génération dynamique côté client, autorisée par le sujet (« IPFS ou génération dynamique »), sans service externe.

## 3. Vulnérabilités recherchées

- **Reentrancy** : `_safeMint` peut appeler `onERC721Received`. Les effets (tokenId, mapping, struct, URI) sont écrits **avant** l’appel externe (checks-effects-interactions) et `nonReentrant` protège la fonction. Test dédié avec `ReentrantReceiver` → bloqué (`ReentrancyGuardReentrantCall`). **Risque : faible**.
- **Access control** : `onlyRole(MINTER_ROLE)` sur mint/batch, `onlyRole(DEFAULT_ADMIN_ROLE)` sur revoke et `grantRole`. Test : compte sans rôle rejeté. **OK**.
- **Double mint** : clé `keccak256(studentId)` stockée on-chain, `StudentIdAlreadyUsed`. Test dédié. **OK**.
- **Overflow / underflow** : compilateur 0.8.x + counter contrôlé. **OK**.
- **Logique métier** : lot vide, lot > 50, doublons dans un lot → toute la transaction est annulée (revert). **OK**.
- **Batch gas** : `MAX_BATCH_SIZE = 50` borne la taille. **Risque : faible**.

## 4. Résultats des tests automatisés

- `npm test` : **13 tests passent** (après recompilation complète des 25 fichiers Solidity), répartis en `mint`, `batch`, `revoke`, `sécurité`.
- Cas couverts : mint réussi, refus d’accès, double mint, champs vides/adresse nulle, batch valide et invalide, révocation (droits, double revoke, token inexistant), soulbound, reentrancy, `supportsInterface`, `tokenIdOfStudent`, constructeur.
- Sortie complète : `nvdossier/preuves/01_npm_test.txt`.
- Capture d’écran des preuves : `nvdossier/preuves/08_preuves_terminal.png`.

## 5. Analyse statique et couverture

### Couverture de code (`npx hardhat coverage`)

| Fichier | % Stmts | % Branch | % Funcs | % Lines |
|---|---|---|---|---|
| `contracts/CertificateNFT.sol` | **100** | **96,88** | **100** | **100** |
| `contracts/mocks/ReentrantReceiver.sol` | 50 | 100 | 100 | 50 (ligne 17, branche de test non appelée) |
| **All files** | 96,67 | 96,88 | **100** | 97,3 |

Le contrat audité est couvert à 100 % en lignes, instructions et fonctions. La seule ligne non couverte du mock est une branche de test (fonds envoyés avec succès au receveur), sans impact sur la sécurité du contrat de production. Sortie complète : `nvdossier/preuves/02_coverage.txt`.

### Analyse statique (Slither)

Slither rapporte ~60 résultats, presque tous issus du code d’OpenZeppelin (assembly, `Math.mulDiv`, pragmas) ou du mock de test. Pour `CertificateNFT.sol`, deux points informatifs seulement :

- `costly-loop` : `_nextTokenId` écrit en storage dans la boucle du batch — inévitable et borné à 50.
- `missing-inheritance` : interface du mock de test, sans impact production.

**Aucune vulnérabilité de sécurité détectée.**

## 6. Points non couverts / limites

- Métadonnées générées en `data:application/json;base64` côté client : pas de stockage IPFS réel (bonus non réalisé).
- Tests automatisés exécutés sur le réseau Hardhat local ; sur Sepolia, seuls le déploiement et un mint d’exemple ont été réalisés (pas de tests de revoke/batch on-chain).
- Code source non vérifié sur Etherscan (`hardhat verify` non exécuté).
- Pas de vérification formelle (Foundry/fuzzing non utilisé).
- Slither exécuté mais non exhaustif (bruit OZ important).
- Un seul compte admin : pas de multi-sig, pas de timelock.
- Frontend non audité (seules les interactions contractuelles sont testées).
- Bonus non réalisés : ERC-1155, IPFS réel, QR code, Foundry, comparaison écrite ERC-721 vs ERC-1155.

## 7. Améliorations recommandées

- Passer les métadonnées sur IPFS et afficher un QR code de vérification.
- Admin multi-sig / timelock pour `revokeCertificate` et `grantRole`.
- Limiter davantage la taille des lots et ajouter un évènement par ligne du batch.
- Vérifier le code source sur Etherscan (`npx hardhat verify`).
- Audit externe + fuzzing (Foundry/Echidna) avant production.

## 8. Captures d’écran

- Transaction de mint sur Etherscan Sepolia (tokenId #1) : `nvdossier/preuves/10_etherscan_sepolia.png`.
- Frontend connecté à Sepolia : mint (`nvdossier/preuves/11_frontend_admin_sepolia.png`) et vérification publique (`nvdossier/preuves/12_frontend_public_sepolia.png`).
- Vérification publique d’un certificat émis (tokenId #1 + tokenURI) : `nvdossier/preuves/06_frontend_public.png` (également `nvdossier/mint_reussi.png`).
- Sorties `npm test`, `npx hardhat coverage`, `npm run deploy:local` et mint de démonstration : `nvdossier/preuves/08_preuves_terminal.png`.
- Fichiers du projet dans VS Code : `nvdossier/preuves/09_vscode_fichiers.png`.

## 9. État du déploiement

Le contrat est déployé sur **Sepolia** (chain ID 11155111) :

| Élément | Valeur |
|---|---|
| Adresse du contrat | [`0x2DABD81A51Ae13F8eA9F3DaAd74322784dddFbD1`](https://sepolia.etherscan.io/address/0x2DABD81A51Ae13F8eA9F3DaAd74322784dddFbD1) |
| Tx de déploiement | [`0xc27773d0…4e10e396`](https://sepolia.etherscan.io/tx/0xc27773d09245cc727dbc2e2ba5db7272cd35d31dd149b7cf4ef153d64e10e396) — bloc 12170849, statut Success |
| Tx de mint (tokenId 1) | [`0x491629bd…6ca5c94d`](https://sepolia.etherscan.io/tx/0x491629bdebbe8ef8c79b72bd6cd94d94bdf4d9eadadf27bbe89c5b106ca5c94d) — bloc 12170875, statut Success |
| Admin / minter | `0x86564dc21d72c477D46C85adA2930D46333a5058` |

Le mint d’exemple a été émis avec `scripts/mint-example.js`. Etherscan montre le transfert ERC-721 du tokenId 1 depuis l’adresse nulle vers le compte admin. Les preuves du déploiement local (Hardhat, chain ID 31337) restent disponibles dans `nvdossier/preuves/`.
