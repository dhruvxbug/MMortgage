// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EscrowController} from "../src/EscrowController.sol";
import {MockERC20}        from "./mocks/MockERC20.sol";

contract EscrowControllerTest is Test {
    EscrowController escrow;
    MockERC20        musd;

    address owner       = makeAddr("owner");
    address yieldRouter = makeAddr("yieldRouter");
    address seller      = makeAddr("seller");
    address alice       = makeAddr("alice");

    uint256 constant TOTAL   = 11_250e18;   // $11,250
    uint256 constant INSTALL = 93.75e18;    // $93.75/month net yield
    uint256 constant INTERVAL = 30 days;

    event CrossChainRelease(
        uint256 indexed escrowId,
        uint16  destinationChainId,
        bytes32 destinationAddress,
        uint256 amount
    );

    function setUp() public {
        musd   = new MockERC20("MUSD", "MUSD");
        vm.prank(owner);
        escrow = new EscrowController(address(musd), owner);

        vm.prank(owner);
        escrow.setYieldRouter(yieldRouter);

        // Seed alice with MUSD
        musd.mint(alice, 1_000_000e18);
    }

    // ─── Happy path ───────────────────────────────────────────────────────────

    function testCreateEscrow_success() public {
        vm.startPrank(alice);
        musd.approve(address(escrow), TOTAL);
        uint256 id = escrow.createEscrow(seller, TOTAL, INSTALL, INTERVAL);
        vm.stopPrank();

        (address s, uint256 bal, uint256 inst, uint256 nextDue, bool active) = escrow.getSchedule(id);
        assertEq(s,       seller,   "seller mismatch");
        assertEq(bal,     TOTAL,    "balance mismatch");
        assertEq(inst,    INSTALL,  "installment mismatch");
        assertGt(nextDue, 0,        "nextDue not set");
        assertTrue(active,          "should be active");
    }

    function testReleaseInstallment_onSchedule() public {
        vm.startPrank(alice);
        musd.approve(address(escrow), TOTAL);
        uint256 id = escrow.createEscrow(seller, TOTAL, INSTALL, INTERVAL);
        vm.stopPrank();

        // Warp past first installment due date
        vm.warp(block.timestamp + INTERVAL + 1);

        uint256 sellerBefore = musd.balanceOf(seller);
        vm.prank(yieldRouter);
        escrow.releaseInstallment(id);

        uint256 sellerAfter = musd.balanceOf(seller);
        assertEq(sellerAfter - sellerBefore, INSTALL, "installment not received");
    }

    // ─── Edge cases ───────────────────────────────────────────────────────────

    function testReleaseInstallment_revertsIfNotDue() public {
        vm.startPrank(alice);
        musd.approve(address(escrow), TOTAL);
        uint256 id = escrow.createEscrow(seller, TOTAL, INSTALL, INTERVAL);
        vm.stopPrank();

        // Do NOT warp — installment is not due yet
        vm.prank(yieldRouter);
        vm.expectRevert(); // InstallmentNotDue
        escrow.releaseInstallment(id);
    }

    function testReleaseInstallment_revertsIfCallerNotYieldRouter() public {
        vm.startPrank(alice);
        musd.approve(address(escrow), TOTAL);
        uint256 id = escrow.createEscrow(seller, TOTAL, INSTALL, INTERVAL);
        vm.stopPrank();

        vm.warp(block.timestamp + INTERVAL + 1);
        vm.prank(alice); // wrong caller
        vm.expectRevert(
            abi.encodeWithSelector(EscrowController.CallerNotYieldRouter.selector, alice)
        );
        escrow.releaseInstallment(id);
    }

    function testEmergencyWithdraw_onlyOwner() public {
        vm.startPrank(alice);
        musd.approve(address(escrow), TOTAL);
        uint256 id = escrow.createEscrow(seller, TOTAL, INSTALL, INTERVAL);
        vm.stopPrank();

        // Non-owner should revert
        vm.prank(alice);
        vm.expectRevert();
        escrow.emergencyWithdraw(id, alice);

        // Owner should succeed
        uint256 ownerBefore = musd.balanceOf(owner);
        vm.prank(owner);
        escrow.emergencyWithdraw(id, owner);
        uint256 ownerAfter  = musd.balanceOf(owner);
        assertEq(ownerAfter - ownerBefore, TOTAL, "emergency withdrawal failed");
    }

    function testCreateEscrow_revertsIfInvalidSeller() public {
        vm.startPrank(alice);
        musd.approve(address(escrow), TOTAL);
        vm.expectRevert(EscrowController.InvalidSeller.selector);
        escrow.createEscrow(address(0), TOTAL, INSTALL, INTERVAL);
        vm.stopPrank();
    }

    function testCreateEscrow_revertsIfIntervalTooShort() public {
        vm.startPrank(alice);
        musd.approve(address(escrow), TOTAL);
        vm.expectRevert(EscrowController.InvalidInterval.selector);
        escrow.createEscrow(seller, TOTAL, INSTALL, 1 hours); // < 1 day
        vm.stopPrank();
    }

    function testReleaseInstallment_byCrossChain() public {
        address crossChainSeller = makeAddr("crossChainSeller");
        bytes32 destinationAddress = bytes32(uint256(uint160(crossChainSeller)));

        vm.startPrank(alice);
        musd.approve(address(escrow), TOTAL);
        uint256 id = escrow.createEscrow(crossChainSeller, TOTAL, INSTALL, INTERVAL);
        vm.stopPrank();

        vm.prank(owner);
        escrow.setCrossChainSeller(id, 2, destinationAddress);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            bool isCrossChain,
            uint16 destinationChainId,
            bytes32 storedDestination,
            string memory storedChainName
        ) = escrow.getScheduleExtended(id);

        assertTrue(isCrossChain, "cross-chain flag not set");
        assertEq(destinationChainId, 2, "destination chain mismatch");
        assertEq(storedDestination, destinationAddress, "destination address mismatch");
        assertEq(storedChainName, "Ethereum", "destination chain name mismatch");

        vm.warp(block.timestamp + INTERVAL + 1);
        vm.expectEmit(true, false, false, true);
        emit CrossChainRelease(id, 2, destinationAddress, INSTALL);
        vm.prank(yieldRouter);
        escrow.releaseInstallment(id);

        assertEq(musd.balanceOf(crossChainSeller), INSTALL, "cross-chain seller not paid");
    }
}
