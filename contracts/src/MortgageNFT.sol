// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title MortgageNFT
/// @notice ERC-721 token representing a MezoMortgage position. Each token
///         stores on-chain metadata and renders its own SVG via tokenURI.
contract MortgageNFT is ERC721, Ownable {
    using Strings for uint256;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotVault();
    error TokenDoesNotExist(uint256 tokenId);

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a new mortgage NFT is minted
    event MortgageMinted(uint256 indexed tokenId, address indexed owner);

    /// @notice Emitted when mortgage metadata is updated (e.g. partial repayment)
    event MortgageDataUpdated(uint256 indexed tokenId);

    // ─── Storage ─────────────────────────────────────────────────────────────

    /// @notice The MortgageVault contract address — the only caller allowed to mint
    address public vault;

    /// @notice Counter used to derive the next token ID
    uint256 private _nextTokenId;

    /// @notice Metadata attached to each NFT position
    struct MortgageData {
        uint256 collateralBTC;  // BTC collateral in wei (18 decimals)
        uint256 borrowedMUSD;   // MUSD debt at origination (18 decimals)
        uint256 totalPayments;  // Total installments required (18 decimals)
        uint256 paidSoFar;      // MUSD paid off so far (18 decimals)
        uint256 openedAt;       // Unix timestamp when the mortgage was opened
    }

    mapping(uint256 => MortgageData) private _mortgageData;

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _owner) ERC721("MezoMortgage", "MMTG") Ownable(_owner) {}

    // ─── Vault management ────────────────────────────────────────────────────

    /// @notice Set the MortgageVault address (only owner)
    /// @param _vault  Address of the MortgageVault contract
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    // ─── Minting ─────────────────────────────────────────────────────────────

    /// @notice Mint a new mortgage NFT to `to` with the provided metadata
    /// @param to            Recipient of the NFT
    /// @param data          MortgageData struct with position details
    /// @return tokenId      The newly minted token ID
    function mint(address to, MortgageData calldata data)
        external
        returns (uint256 tokenId)
    {
        if (msg.sender != vault) revert NotVault();
        tokenId = ++_nextTokenId;
        _mortgageData[tokenId] = data;
        _safeMint(to, tokenId);
        emit MortgageMinted(tokenId, to);
    }

    /// @notice Update the paid-so-far amount on an existing token (called by Vault)
    /// @param tokenId    Token to update
    /// @param paidSoFar  New cumulative paid amount (18 decimals)
    function updatePaid(uint256 tokenId, uint256 paidSoFar) external {
        if (msg.sender != vault) revert NotVault();
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        _mortgageData[tokenId].paidSoFar = paidSoFar;
        emit MortgageDataUpdated(tokenId);
    }

    // ─── Metadata ────────────────────────────────────────────────────────────

    /// @notice Returns the mortgage data stored for a token
    /// @param tokenId  Token ID to query
    function getMortgageData(uint256 tokenId) external view returns (MortgageData memory) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return _mortgageData[tokenId];
    }

    /// @notice Generate a fully on-chain base64-encoded JSON metadata URI with SVG artwork
    /// @param tokenId  Token ID to render
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        MortgageData memory d = _mortgageData[tokenId];

        // Percentage paid off (0–100, capped)
        uint256 pctPaid = d.totalPayments > 0
            ? (d.paidSoFar * 100) / d.totalPayments
            : 0;
        if (pctPaid > 100) pctPaid = 100;

        // Progress bar width (0–200px)
        uint256 barWidth = pctPaid * 2;

        // Human-readable amounts (divide by 1e18, show whole units)
        string memory collBTC  = _formatWei(d.collateralBTC);
        string memory debtMUSD = _formatWei(d.borrowedMUSD);
        string memory paidMUSD = _formatWei(d.paidSoFar);

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">',
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
            '<stop offset="0%" stop-color="#1a1a2e"/><stop offset="100%" stop-color="#16213e"/>',
            '</linearGradient></defs>',
            '<rect width="300" height="200" fill="url(#bg)" rx="12"/>',
            '<text x="14" y="28" fill="#F7931A" font-size="13" font-family="monospace" font-weight="bold">MezoMortgage</text>',
            '<text x="14" y="48" fill="#aaa" font-size="9" font-family="monospace">ID #', tokenId.toString(), '</text>',
            '<line x1="14" y1="54" x2="286" y2="54" stroke="#333" stroke-width="1"/>',
            '<text x="14" y="72" fill="#ccc" font-size="9" font-family="monospace">Collateral</text>',
            '<text x="14" y="85" fill="#fff" font-size="11" font-family="monospace">', collBTC, ' BTC</text>',
            '<text x="160" y="72" fill="#ccc" font-size="9" font-family="monospace">Borrowed</text>',
            '<text x="160" y="85" fill="#fff" font-size="11" font-family="monospace">', debtMUSD, ' MUSD</text>',
            '<text x="14" y="108" fill="#ccc" font-size="9" font-family="monospace">Paid Off</text>',
            '<text x="14" y="121" fill="#4ade80" font-size="11" font-family="monospace">', paidMUSD, ' MUSD (', pctPaid.toString(), '%)</text>',
            '<text x="14" y="143" fill="#ccc" font-size="9" font-family="monospace">Progress</text>',
            '<rect x="14" y="150" width="200" height="10" rx="5" fill="#333"/>',
            '<rect x="14" y="150" width="', barWidth.toString(), '" height="10" rx="5" fill="#F7931A"/>',
            '<text x="14" y="183" fill="#555" font-size="7" font-family="monospace">Your Bitcoin pays for your house.</text>',
            '</svg>'
        ));

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"MezoMortgage #', tokenId.toString(), '",',
            '"description":"Bitcoin-backed self-repaying mortgage position on MezoMortgage.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Collateral BTC","value":"', collBTC, '"},',
            '{"trait_type":"Borrowed MUSD","value":"', debtMUSD, '"},',
            '{"trait_type":"Paid Off MUSD","value":"', paidMUSD, '"},',
            '{"trait_type":"Percent Paid","value":', pctPaid.toString(), '}',
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /// @dev Check whether a token ID has been minted (owns a non-zero address)
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /// @dev Format a wei value as a whole-unit string (e.g. 2_500000000000000000 → "2")
    function _formatWei(uint256 amount) internal pure returns (string memory) {
        return (amount / 1e18).toString();
    }
}
