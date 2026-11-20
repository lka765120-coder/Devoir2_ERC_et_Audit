// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CertificateNFT - certificats académiques ERC-721 (non transférables)
/// @notice 1 certificat = 1 NFT. Un studentId ne peut être utilisé qu'une seule fois.
contract CertificateNFT is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_BATCH_SIZE = 50;

    struct Certificate {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        bool revoked;
    }

    struct CertificateInput {
        address to;
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        string uri;
    }

    uint256 private _nextTokenId; // les tokenId commencent à 1
    mapping(uint256 => Certificate) private _certificates;
    mapping(bytes32 => uint256) private _tokenIdByStudent; // keccak(studentId) => tokenId (0 = inexistant)

    event CertificateMinted(uint256 indexed tokenId, address indexed recipient, string studentId);
    event CertificateRevoked(uint256 indexed tokenId, address indexed revokedBy);

    error ZeroAddress();
    error EmptyField();
    error StudentIdAlreadyUsed(string studentId);
    error AlreadyRevoked(uint256 tokenId);
    error EmptyBatch();
    error BatchTooLarge(uint256 size, uint256 max);
    error Soulbound();

    constructor(address admin) ERC721("AcademicCertificate", "ACERT") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    // ───────────── Écriture ─────────────

    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256) {
        return _issue(CertificateInput(to, studentName, studentId, diplomaTitle, issueDate, grade, uri));
    }

    function batchMintCertificates(CertificateInput[] calldata inputs)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
    {
        uint256 n = inputs.length;
        if (n == 0) revert EmptyBatch();
        if (n > MAX_BATCH_SIZE) revert BatchTooLarge(n, MAX_BATCH_SIZE);
        for (uint256 i = 0; i < n; i++) {
            _issue(inputs[i]);
        }
    }

    function revokeCertificate(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _requireOwned(tokenId);
        Certificate storage c = _certificates[tokenId];
        if (c.revoked) revert AlreadyRevoked(tokenId);
        c.revoked = true;
        emit CertificateRevoked(tokenId, msg.sender);
    }

    // ───────────── Lecture ─────────────

    function getCertificate(uint256 tokenId)
        external
        view
        returns (Certificate memory cert, address recipient, string memory uri)
    {
        recipient = _requireOwned(tokenId);
        cert = _certificates[tokenId];
        uri = tokenURI(tokenId);
    }

    function isValid(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0) && !_certificates[tokenId].revoked;
    }

    function tokenIdOfStudent(string calldata studentId) external view returns (uint256) {
        return _tokenIdByStudent[keccak256(bytes(studentId))];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    // ───────────── Interne ─────────────

    function _issue(CertificateInput memory i) internal returns (uint256 tokenId) {
        if (i.to == address(0)) revert ZeroAddress();
        if (
            bytes(i.studentName).length == 0 || bytes(i.studentId).length == 0
                || bytes(i.diplomaTitle).length == 0 || bytes(i.uri).length == 0
        ) revert EmptyField();

        bytes32 key = keccak256(bytes(i.studentId));
        if (_tokenIdByStudent[key] != 0) revert StudentIdAlreadyUsed(i.studentId);

        // Effects avant l'appel externe (_safeMint) : checks-effects-interactions
        tokenId = ++_nextTokenId;
        _tokenIdByStudent[key] = tokenId;
        _certificates[tokenId] =
            Certificate(i.studentName, i.studentId, i.diplomaTitle, i.issueDate, i.grade, false);
        _setTokenURI(tokenId, i.uri);

        emit CertificateMinted(tokenId, i.to, i.studentId);
        _safeMint(i.to, tokenId);
    }

    /// @dev Soulbound : seul le mint (from == 0) est autorisé, pas de transfert.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // ───────────── Overrides requis ─────────────

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
