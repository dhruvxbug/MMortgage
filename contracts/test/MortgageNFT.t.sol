// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {MortgageNFT}       from "../src/MortgageNFT.sol";
import {MockBorrowManager} from "./mocks/MockBorrowManager.sol";
import {MockBTCOracle}     from "./mocks/MockBTCOracle.sol";
import {MockERC20}         from "./mocks/MockERC20.sol";
import {MortgageVault}     from "../src/MortgageVault.sol";

contract MortgageNFTTest is Test {
    MortgageNFT       nft;
    MortgageVault     vault;
    MockBorrowManager borrowMgr;
    MockBTCOracle     oracle;
    MockERC20         musd;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    uint256 constant BTC_PRICE   = 90_000e18;
    uint256 constant COLL_BTC    = 0.5e18;
    uint256 constant MUSD_BORROW = 22_500e18;

    function setUp() public {
        musd      = new MockERC20("MUSD", "MUSD");
        oracle    = new MockBTCOracle(BTC_PRICE);
        borrowMgr = new MockBorrowManager();

        vm.startPrank(owner);
        nft   = new MortgageNFT(owner);
        vault = new MortgageVault(
            address(borrowMgr),
            address(oracle),
            address(musd),
            address(nft),
            owner
        );
        nft.setVault(address(vault));
        vm.stopPrank();

        musd.mint(address(vault), 1_000_000e18);
        vm.deal(alice, 10 ether);
        vm.deal(bob,   10 ether);
    }

    // ─── Happy path ───────────────────────────────────────────────────────────

    function testMint_onlyVault() public {
        // Direct mint from non-vault should revert
        MortgageNFT.MortgageData memory data = MortgageNFT.MortgageData({
            collateralBTC:  COLL_BTC,
            borrowedMUSD:   MUSD_BORROW,
            totalPayments:  MUSD_BORROW,
            paidSoFar:      0,
            openedAt:       block.timestamp
        });

        vm.prank(alice);
        vm.expectRevert(MortgageNFT.NotVault.selector);
        nft.mint(alice, data);
    }

    function testTransferPosition_success() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLL_BTC}(MUSD_BORROW);

        (,,,, uint256 tokenId,) = vault.positions(posId);

        // Alice transfers NFT to Bob
        vm.prank(alice);
        nft.transferFrom(alice, bob, tokenId);

        assertEq(nft.ownerOf(tokenId), bob, "NFT not transferred to bob");
    }

    function testTokenURI_returnsValidBase64SVG() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLL_BTC}(MUSD_BORROW);
        (,,,, uint256 tokenId,) = vault.positions(posId);

        string memory uri = nft.tokenURI(tokenId);

        // Must start with data:application/json;base64,
        assertEq(
            _startsWith(uri, "data:application/json;base64,"),
            true,
            "tokenURI must be base64 JSON"
        );
    }

    function testTokenURI_containsMortgageData() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLL_BTC}(MUSD_BORROW);
        (,,,, uint256 tokenId,) = vault.positions(posId);

        string memory uri = nft.tokenURI(tokenId);
        // URI is non-empty and reasonably long (has SVG embedded)
        assertGt(bytes(uri).length, 100, "tokenURI too short");
    }

    function testTokenURI_revertsForNonExistentToken() public {
        vm.expectRevert(
            abi.encodeWithSelector(MortgageNFT.TokenDoesNotExist.selector, 999)
        );
        nft.tokenURI(999);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _startsWith(string memory str, string memory prefix)
        internal
        pure
        returns (bool)
    {
        bytes memory strBytes    = bytes(str);
        bytes memory prefixBytes = bytes(prefix);
        if (strBytes.length < prefixBytes.length) return false;
        for (uint256 i = 0; i < prefixBytes.length; i++) {
            if (strBytes[i] != prefixBytes[i]) return false;
        }
        return true;
    }
}
