// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {MortgageVault}     from "../src/MortgageVault.sol";
import {MortgageNFT}       from "../src/MortgageNFT.sol";
import {MockBorrowManager} from "./mocks/MockBorrowManager.sol";
import {MockBTCOracle}     from "./mocks/MockBTCOracle.sol";
import {MockERC20}         from "./mocks/MockERC20.sol";

contract MortgageVaultTest is Test {
    // ─── Contracts ────────────────────────────────────────────────────────────
    MortgageVault     vault;
    MortgageNFT       nft;
    MockBorrowManager borrowMgr;
    MockBTCOracle     oracle;
    MockERC20         musd;

    // ─── Test actors ─────────────────────────────────────────────────────────
    address owner  = makeAddr("owner");
    address alice  = makeAddr("alice");
    address bob    = makeAddr("bob");
    address keeper = makeAddr("keeper");

    // ─── Demo scenario constants (from SYSTEM_PROMPT) ─────────────────────────
    uint256 constant BTC_PRICE      = 90_000e18;  // $90,000 / BTC
    uint256 constant COLLATERAL_BTC = 0.5e18;     // 0.5 BTC
    uint256 constant MUSD_BORROW    = 22_500e18;  // 22,500 MUSD (50% LTV)

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

        // Fund vault with MUSD so it can transfer to borrowers on openMortgage
        musd.mint(address(vault), 1_000_000e18);

        // Give alice some ETH to use as BTC collateral
        vm.deal(alice, 10 ether);
        vm.deal(bob,   10 ether);
    }

    // ─── Happy path tests ─────────────────────────────────────────────────────

    function testOpenMortgage_success() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);

        (
            address posOwner,
            uint256 coll,
            uint256 debt,
            ,
            uint256 tokenId,
            bool    active
        ) = vault.positions(posId);

        assertEq(posOwner,  alice,          "owner mismatch");
        assertEq(coll,      COLLATERAL_BTC, "collateral mismatch");
        assertEq(debt,      MUSD_BORROW,    "debt mismatch");
        assertEq(active,    true,           "should be active");
        assertGt(tokenId,   0,              "tokenId should be assigned");
    }

    function testAddCollateral_success() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);

        uint256 extraColl = 0.1e18;
        vm.prank(alice);
        vault.addCollateral{value: extraColl}(posId);

        (, uint256 coll,,,,) = vault.positions(posId);
        assertEq(coll, COLLATERAL_BTC + extraColl, "collateral not updated");
    }

    function testRepayMortgage_partial() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);

        uint256 repayAmt = 5_000e18;
        musd.mint(alice, repayAmt);
        vm.startPrank(alice);
        musd.approve(address(vault), repayAmt);
        vault.repayMortgage(posId, repayAmt);
        vm.stopPrank();

        (,,, uint256 paid,,) = vault.positions(posId);
        assertEq(paid, repayAmt, "paid amount not updated");
    }

    function testCloseMortgage_success() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);

        // Alice got MUSD_BORROW from vault; she needs to repay it to close
        vm.startPrank(alice);
        musd.approve(address(vault), MUSD_BORROW);
        vault.closeMortgage(posId);
        vm.stopPrank();

        (,,,,,bool active) = vault.positions(posId);
        assertEq(active, false, "should be inactive after close");
    }

    function testMortgageNFTMintedOnOpen() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);

        (,,,, uint256 tokenId,) = vault.positions(posId);
        assertGt(tokenId, 0,    "tokenId not assigned");
        assertEq(nft.ownerOf(tokenId), alice, "NFT not minted to alice");
    }

    // ─── Edge cases & security tests ─────────────────────────────────────────

    function testOpenMortgage_revertsIfCollateralTooLow() public {
        // 1 wei BTC collateral, requesting 22_500 MUSD → ratio << 150%
        vm.prank(alice);
        vm.expectRevert();
        vault.openMortgage{value: 1}(MUSD_BORROW);
    }

    function testOpenMortgage_revertsIfLTVTooHigh() public {
        // 0.5 BTC at $90k = $45k collateral; try to borrow $35k (78% LTV > 66.6%)
        vm.prank(alice);
        vm.expectRevert(); // CollateralRatioTooLow
        vault.openMortgage{value: COLLATERAL_BTC}(35_000e18);
    }

    function testUnauthorized_cannotCloseOtherUsersMortgage() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);

        // Bob tries to close Alice's mortgage
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(MortgageVault.NotPositionOwner.selector, bob, alice)
        );
        vault.closeMortgage(posId);
    }

    function testOracleStale_revertsIfPriceOld() public {
        // Warp to a future time so we can set a stale oracle without underflow
        vm.warp(block.timestamp + 4 hours);
        // Make oracle stale (2 hours ago)
        oracle.setStale(2 hours);

        vm.prank(alice);
        vm.expectRevert(); // StaleOraclePrice
        vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);
    }

    function testReentrancy_openMortgage() public {
        // A malicious BorrowManager that re-enters openMortgage
        ReentrantBorrowManager reentrantMgr = new ReentrantBorrowManager();

        vm.startPrank(owner);
        MortgageVault attackVault = new MortgageVault(
            address(reentrantMgr),
            address(oracle),
            address(musd),
            address(nft),
            owner
        );
        nft.setVault(address(attackVault));
        vm.stopPrank();

        musd.mint(address(attackVault), 1_000_000e18);
        reentrantMgr.setTarget(address(attackVault));

        vm.prank(alice);
        vm.expectRevert(); // ReentrancyGuard should block
        attackVault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);
    }

    // ─── Gas snapshots ────────────────────────────────────────────────────────

    function testGas_openMortgage() public {
        vm.prank(alice);
        uint256 gasStart = gasleft();
        vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);
        uint256 gasUsed = gasStart - gasleft();
        console.log("openMortgage gas:", gasUsed);
    }

    // ─── View function tests ──────────────────────────────────────────────────

    function testGetCollateralRatio() public {
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLLATERAL_BTC}(MUSD_BORROW);

        uint256 ratio = vault.getCollateralRatio(posId);
        // 0.5 BTC * $90,000 = $45,000 collateral / $22,500 debt = 200%
        assertEq(ratio, 2e18, "expected 200% ratio");
    }

    function testGetPositionsByOwner() public {
        vm.startPrank(alice);
        vault.openMortgage{value: 0.3e18}(11_000e18);
        vault.openMortgage{value: 0.3e18}(11_000e18);
        vm.stopPrank();

        uint256[] memory ids = vault.getPositionsByOwner(alice);
        assertEq(ids.length, 2, "should have 2 positions");
    }
}

// ─── Helper: Reentrant BorrowManager for reentrancy test ──────────────────────
contract ReentrantBorrowManager {
    address public target;
    bool    private _attacking;

    function setTarget(address t) external { target = t; }

    function openTrove(uint256 musdAmount, address, address) external payable {
        if (!_attacking) {
            _attacking = true;
            // Attempt to re-enter openMortgage
            MortgageVault(payable(target)).openMortgage{value: msg.value / 2}(musdAmount / 2);
            _attacking = false;
        }
    }

    function addColl(address, address) external payable {}
    function withdrawColl(uint256, address, address) external {}
    function repayMUSD(uint256, address, address) external {}
    function closeTrove() external {}

    function getTrove(address) external pure returns (bytes memory) { return ""; }
    function getNominalICR(address) external pure returns (uint256) { return 2e18; }
    function getCurrentICR(address, uint256) external pure returns (uint256) { return 2e18; }
}
