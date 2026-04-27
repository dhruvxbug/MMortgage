// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VeBooster}  from "../src/VeBooster.sol";
import {MockERC20}  from "./mocks/MockERC20.sol";
import {MockVeMEZO} from "./mocks/MockVeMEZO.sol";

contract VeBoosterTest is Test {
    VeBooster  booster;
    MockERC20  mezoToken;
    MockVeMEZO veMEZO;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    uint256 constant LOCK_AMOUNT   = 1_000e18;
    uint256 constant LOCK_DURATION = 180 days;

    function setUp() public {
        mezoToken = new MockERC20("MEZO", "MEZO");
        veMEZO    = new MockVeMEZO();

        vm.prank(owner);
        booster = new VeBooster(address(mezoToken), address(veMEZO), owner);

        mezoToken.mint(alice, 10_000e18);
        mezoToken.mint(bob,   10_000e18);
    }

    // ─── Happy path ───────────────────────────────────────────────────────────

    function testLockVeMEZO_appliesDiscount() public {
        vm.startPrank(alice);
        mezoToken.approve(address(booster), LOCK_AMOUNT);
        booster.lockVeMEZO(LOCK_AMOUNT, LOCK_DURATION);
        vm.stopPrank();

        assertTrue(booster.applyDiscount(alice), "discount should be active");
    }

    function testGetEffectiveRate_withoutLock_returns100bps() public view {
        uint256 rate = booster.getEffectiveRate(bob);
        assertEq(rate, 100, "should be 100bps without lock");
    }

    function testGetEffectiveRate_withLock_returns50bps() public {
        vm.startPrank(alice);
        mezoToken.approve(address(booster), LOCK_AMOUNT);
        booster.lockVeMEZO(LOCK_AMOUNT, LOCK_DURATION);
        vm.stopPrank();

        uint256 rate = booster.getEffectiveRate(alice);
        assertEq(rate, 50, "should be 50bps with active lock");
    }

    function testUnlockAfterExpiry_revertsIfNotExpired() public {
        vm.startPrank(alice);
        mezoToken.approve(address(booster), LOCK_AMOUNT);
        booster.lockVeMEZO(LOCK_AMOUNT, LOCK_DURATION);

        // Try unlocking before expiry
        vm.expectRevert(); // LockNotExpired
        booster.unlockAfterExpiry();
        vm.stopPrank();
    }

    function testUnlockAfterExpiry_success() public {
        vm.startPrank(alice);
        mezoToken.approve(address(booster), LOCK_AMOUNT);
        booster.lockVeMEZO(LOCK_AMOUNT, LOCK_DURATION);
        vm.stopPrank();

        // Warp past expiry
        vm.warp(block.timestamp + LOCK_DURATION + 1);

        uint256 aliceBefore = mezoToken.balanceOf(alice);
        vm.prank(alice);
        booster.unlockAfterExpiry();
        uint256 aliceAfter  = mezoToken.balanceOf(alice);

        assertEq(aliceAfter - aliceBefore, LOCK_AMOUNT, "tokens not returned");
        assertFalse(booster.applyDiscount(alice), "discount should be gone after unlock");
    }

    function testGetEffectiveRate_withVeMEZO_onChainBalance() public {
        // Simulate a user who holds veMEZO on-chain (not locked via VeBooster)
        veMEZO.setBalance(bob, 500e18);
        veMEZO.setLockEnd(bob, block.timestamp + 30 days);

        uint256 rate = booster.getEffectiveRate(bob);
        assertEq(rate, 50, "on-chain veMEZO holder should get discount");
    }

    function testLockAlreadyActive_reverts() public {
        vm.startPrank(alice);
        mezoToken.approve(address(booster), LOCK_AMOUNT * 2);
        booster.lockVeMEZO(LOCK_AMOUNT, LOCK_DURATION);

        vm.expectRevert(VeBooster.LockAlreadyActive.selector);
        booster.lockVeMEZO(LOCK_AMOUNT, LOCK_DURATION);
        vm.stopPrank();
    }
}
