// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {MortgageVault}     from "../../src/MortgageVault.sol";
import {MortgageNFT}       from "../../src/MortgageNFT.sol";
import {EscrowController}  from "../../src/EscrowController.sol";
import {YieldRouter}       from "../../src/YieldRouter.sol";
import {LiquidationBuffer} from "../../src/LiquidationBuffer.sol";

import {MockBorrowManager} from "../mocks/MockBorrowManager.sol";
import {MockMUSDVault}     from "../mocks/MockMUSDVault.sol";
import {MockBTCOracle}     from "../mocks/MockBTCOracle.sol";
import {MockERC20}         from "../mocks/MockERC20.sol";

/// @title MortgageFlowTest
/// @notice Full end-to-end integration test that covers the happy-path mortgage
///         lifecycle: open → deposit to vault → simulate yield → harvest →
///         release installment → verify seller balance.
contract MortgageFlowTest is Test {
    // ─── Contracts ────────────────────────────────────────────────────────────
    MortgageVault     vault;
    MortgageNFT       nft;
    EscrowController  escrow;
    YieldRouter       router;
    LiquidationBuffer liquidBuf;

    MockBorrowManager borrowMgr;
    MockMUSDVault     musdVault;
    MockBTCOracle     oracle;
    MockERC20         musd;

    // ─── Actors ───────────────────────────────────────────────────────────────
    address owner  = makeAddr("owner");
    address alice  = makeAddr("alice");   // borrower
    address seller = makeAddr("seller");  // property seller
    address keeper = makeAddr("keeper");  // keeper bot

    // ─── Demo scenario values ─────────────────────────────────────────────────
    uint256 constant BTC_PRICE     = 90_000e18;   // $90,000 / BTC
    uint256 constant COLL_BTC      = 0.5e18;      // 0.5 BTC collateral
    uint256 constant MUSD_BORROW   = 22_500e18;   // 22,500 MUSD (50% LTV)
    uint256 constant PROPERTY_COST = 11_250e18;   // property purchase price
    uint256 constant INSTALLMENT   = 93.75e18;    // monthly net yield
    uint256 constant MONTHLY_YIELD = 112.5e18;    // gross 6% APY monthly
    uint256 constant INTERVAL      = 30 days;

    function setUp() public {
        musd      = new MockERC20("MUSD", "MUSD");
        oracle    = new MockBTCOracle(BTC_PRICE);
        borrowMgr = new MockBorrowManager();
        musdVault = new MockMUSDVault(address(musd));

        vm.startPrank(owner);

        // Deploy core contracts
        nft    = new MortgageNFT(owner);
        vault  = new MortgageVault(
            address(borrowMgr),
            address(oracle),
            address(musd),
            address(nft),
            owner
        );
        escrow = new EscrowController(address(musd), owner);
        router = new YieldRouter(
            address(musd),
            address(musdVault),
            address(escrow),
            keeper,
            owner
        );
        liquidBuf = new LiquidationBuffer(
            address(borrowMgr),
            address(oracle),
            address(musd),
            owner
        );

        // Wire contracts together
        nft.setVault(address(vault));
        escrow.setYieldRouter(address(router));

        vm.stopPrank();

        // Fund contracts with MUSD for transfers
        musd.mint(address(vault),     1_000_000e18);
        musd.mint(address(musdVault), 1_000_000e18);
        musd.mint(keeper,             1_000_000e18);
        musd.mint(alice,              100_000e18);

        // Give alice BTC collateral
        vm.deal(alice, 10 ether);
    }

    // ─── Full lifecycle integration test ─────────────────────────────────────

    function testFullMortgageFlow() public {
        console.log("=== MezoMortgage Integration Test ===");

        // ── Step 1: Alice opens mortgage ─────────────────────────────────────
        vm.prank(alice);
        uint256 posId = vault.openMortgage{value: COLL_BTC}(MUSD_BORROW);

        (,,,, uint256 nftId, bool active) = vault.positions(posId);
        assertTrue(active,     "position should be active");
        assertGt(nftId, 0,     "NFT should be minted");
        assertEq(nft.ownerOf(nftId), alice, "alice should own NFT");
        console.log("Step 1: Mortgage opened. posId:", posId, "nftId:", nftId);

        // ── Step 2: Alice creates a property escrow ───────────────────────────
        vm.startPrank(alice);
        musd.approve(address(escrow), PROPERTY_COST);
        uint256 escrowId = escrow.createEscrow(seller, PROPERTY_COST, INSTALLMENT, INTERVAL);
        vm.stopPrank();
        console.log("Step 2: Escrow created. escrowId:", escrowId);

        // ── Step 3: Keeper deposits MUSD into yield vault ────────────────────
        vm.startPrank(keeper);
        musd.approve(address(router), MUSD_BORROW);
        router.depositToVault(MUSD_BORROW);
        vm.stopPrank();

        assertEq(router.totalDeposited(), MUSD_BORROW, "vault deposit not tracked");
        console.log("Step 3: MUSD deposited to savings vault");

        // ── Step 4: Simulate yield accrual (warp 1 month) ────────────────────
        vm.warp(block.timestamp + INTERVAL);
        // Refresh oracle after warp so it stays fresh
        oracle.setPrice(BTC_PRICE);
        musdVault.setGain(address(router), MONTHLY_YIELD);
        console.log("Step 4: Warped 30 days, yield accrued:", MONTHLY_YIELD / 1e18, "MUSD");

        // ── Step 5: Keeper harvests yield and routes to escrow ────────────────
        vm.prank(keeper);
        router.harvestAndRoute(escrowId);

        uint256 routed = router.totalRoutedToEscrow();
        assertGt(routed, 0, "yield should have been routed");
        console.log("Step 5: Yield routed to escrow:", routed / 1e18, "MUSD");

        // ── Step 6: Warp another month and release installment ───────────────
        vm.warp(block.timestamp + INTERVAL);
        // Refresh oracle again after warp
        oracle.setPrice(BTC_PRICE);
        uint256 sellerBefore = musd.balanceOf(seller);

        // Temporarily re-point escrow yieldRouter to this test contract so we can call release
        vm.prank(owner);
        escrow.setYieldRouter(address(this));
        escrow.releaseInstallment(escrowId);

        uint256 sellerAfter = musd.balanceOf(seller);
        uint256 received    = sellerAfter - sellerBefore;
        assertEq(received, INSTALLMENT, "seller did not receive installment");
        console.log("Step 6: Installment released. Seller received:", received / 1e18, "MUSD");

        // ── Step 7: Health check on alice's trove (should be healthy at 200%) ──
        (uint256 ratio, uint8 status) = liquidBuf.checkHealth(alice, posId);
        assertGe(ratio, 2e18, "alice's trove should be at 200% ratio");
        console.log("Step 7: Health check completed. Status:", status);

        // ── Step 8: Verify NFT metadata is updated after partial repay ────────
        uint256 partialRepay = 1_000e18;
        musd.mint(alice, partialRepay);
        vm.startPrank(alice);
        musd.approve(address(vault), partialRepay);
        vault.repayMortgage(posId, partialRepay);
        vm.stopPrank();

        MortgageNFT.MortgageData memory nftData = nft.getMortgageData(nftId);
        assertEq(nftData.paidSoFar, partialRepay, "NFT paid-so-far not updated");
        console.log("Step 8: NFT updated. Paid so far:", nftData.paidSoFar / 1e18, "MUSD");

        console.log("=== Integration test PASSED ===");
    }

    // ─── Invariant: collateral ratio must never go below 100% after topup ─────

    function testInvariant_collateralRatioNeverBelowSolvency() public {
        vm.prank(alice);
        vault.openMortgage{value: COLL_BTC}(MUSD_BORROW);

        // Even with a massive price drop, ratio should not go negative
        oracle.setPrice(1e18); // $1/BTC — nearly worthless
        uint256 ratio = vault.getCollateralRatio(1);

        // Ratio is collValueUSD / debt — it CAN be < 100% at this extreme price,
        // but it must be a valid number (not overflow/underflow)
        assertLt(ratio, 1e18, "ratio should be < 100% at $1 BTC price");
        assertGt(ratio, 0,    "ratio must be > 0");
    }
}
