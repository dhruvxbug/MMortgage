// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LiquidationBuffer} from "../src/LiquidationBuffer.sol";
import {MockBorrowManager} from "./mocks/MockBorrowManager.sol";
import {MockBTCOracle}     from "./mocks/MockBTCOracle.sol";
import {MockERC20}         from "./mocks/MockERC20.sol";

contract LiquidationBufferTest is Test {
    LiquidationBuffer buffer;
    MockBorrowManager borrowMgr;
    MockBTCOracle     oracle;
    MockERC20         musd;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");

    uint256 constant BTC_PRICE   = 90_000e18;
    uint256 constant COLL_BTC    = 0.5e18;
    uint256 constant DEBT_MUSD   = 22_500e18;

    function setUp() public {
        musd      = new MockERC20("MUSD", "MUSD");
        oracle    = new MockBTCOracle(BTC_PRICE);
        borrowMgr = new MockBorrowManager();

        vm.prank(owner);
        buffer = new LiquidationBuffer(
            address(borrowMgr),
            address(oracle),
            address(musd),
            owner
        );

        // Set up alice's Trove: 0.5 BTC collateral, 22,500 MUSD debt → 200% ratio
        borrowMgr.setTrove(alice, COLL_BTC, DEBT_MUSD);
    }

    // ─── Happy path ───────────────────────────────────────────────────────────

    function testCheckHealth_healthyPosition() public view {
        (uint256 ratio, uint8 status) = buffer.checkHealth(alice, 1);
        // 0.5 BTC * $90k / 22,500 MUSD = 200% → healthy
        assertEq(ratio,  2e18, "ratio should be 200%");
        assertEq(status, 0,    "should be healthy (0)");
    }

    function testCheckHealth_triggersTopUpAt140() public {
        // Drop BTC price so ratio falls between 130% and 140%
        // Need ratio = 135% → price = 135% * debt / coll = 1.35 * 22500 / 0.5 = $60,750
        uint256 newPrice = 60_750e18;
        oracle.setPrice(newPrice);

        (, uint8 status) = buffer.checkHealth(alice, 1);
        assertEq(status, 1, "expected topup status (1)");
    }

    function testCheckHealth_triggersPartialRepayAt130() public {
        // Drop BTC price so ratio falls below 130%
        // Need ratio = 125% → price = 1.25 * 22500 / 0.5 = $56,250
        uint256 newPrice = 56_250e18;
        oracle.setPrice(newPrice);

        (, uint8 status) = buffer.checkHealth(alice, 1);
        assertEq(status, 2, "expected critical status (2)");
    }

    function testSetHealthThreshold_onlyOwner() public {
        // Non-owner reverts
        vm.prank(alice);
        vm.expectRevert();
        buffer.setHealthThreshold(145e16, 135e16);

        // Owner succeeds
        vm.prank(owner);
        buffer.setHealthThreshold(145e16, 135e16);
        assertEq(buffer.topUpThreshold(),    145e16, "topUp mismatch");
        assertEq(buffer.criticalThreshold(), 135e16, "critical mismatch");
    }

    function testSetHealthThreshold_revertsIfCriticalAboveTopUp() public {
        vm.prank(owner);
        vm.expectRevert(LiquidationBuffer.InvalidThreshold.selector);
        buffer.setHealthThreshold(130e16, 140e16); // critical > topUp
    }

    function testTriggerTopUp_addsCollateral() public {
        // Make position unhealthy
        oracle.setPrice(60_000e18); // price drop → ratio ~133% (between 130-140)

        uint256 topUpAmt = 0.1e18;
        vm.deal(owner, topUpAmt);
        vm.prank(owner);
        buffer.depositBTCBuffer{value: topUpAmt}();

        // Manually set the trove to alice's address for borrowMgr.addColl
        // since addColl uses msg.sender (= buffer contract)
        vm.prank(owner);
        buffer.triggerTopUp(alice, 1, topUpAmt);

        assertEq(buffer.btcBuffer(), 0, "buffer should be empty after topup");
    }

    function testPartialRepay_reducesDebt() public {
        // Make position critical
        oracle.setPrice(50_000e18);

        uint256 repayAmt = 5_000e18;
        musd.mint(owner, repayAmt);
        vm.startPrank(owner);
        musd.approve(address(buffer), repayAmt);
        buffer.depositMUSDBuffer(repayAmt);
        buffer.partialRepay(alice, 1, repayAmt);
        vm.stopPrank();

        assertEq(buffer.musdBuffer(), 0, "MUSD buffer should be empty after repay");
    }

    // ─── Fuzz tests ───────────────────────────────────────────────────────────

    /// @dev Invariant: if ratio < criticalThreshold, status must be STATUS_CRITICAL
    function testFuzz_collateralRatio(uint256 btcPrice, uint256 collateral) public {
        // Bound inputs to reasonable ranges
        btcPrice   = bound(btcPrice,   1e18,    200_000e18);
        collateral = bound(collateral, 1e15,    10e18);

        uint256 debt = 22_500e18; // fixed debt
        borrowMgr.setTrove(alice, collateral, debt);
        oracle.setPrice(btcPrice);

        (uint256 ratio, uint8 status) = buffer.checkHealth(alice, 1);

        uint256 expectedRatio = (collateral * btcPrice * 1e18) / (debt * 1e18);

        if (expectedRatio < buffer.criticalThreshold()) {
            assertEq(status, 2); // STATUS_CRITICAL
        } else if (expectedRatio < buffer.topUpThreshold()) {
            assertEq(status, 1); // STATUS_TOPUP
        } else {
            assertEq(status, 0); // STATUS_HEALTHY
        }
    }
}
