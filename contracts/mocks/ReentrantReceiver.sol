// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICertificateNFT {
    function mintCertificate(address, string calldata, string calldata, string calldata, string calldata, string calldata, string calldata)
        external returns (uint256);
}

/// @dev Mock malveillant : tente de ré-entrer dans mintCertificate pendant onERC721Received.
contract ReentrantReceiver {
    ICertificateNFT public target;

    constructor(address t) { target = ICertificateNFT(t); }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        target.mintCertificate(address(this), "Evil", "REENTER-1", "Hack", "2026-01-01", "A", "ipfs://x");
        return this.onERC721Received.selector;
    }
}
