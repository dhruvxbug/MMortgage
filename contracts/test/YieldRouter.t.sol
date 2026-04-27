// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {YieldRouter}       from "../src/YieldRouter.sol";
import {EscrowController}  from "../src/EscrowController.sol";
import {MockMUSDVault}     from "./mocks/MockMUSDVault.sol";
import {MockERC20}         from "./mocks/MockERC20.sol";

contract YieldRouterTest is Test {
    YieldRouter      router;
    EscrowController escrow;
    MockMUSDVault    vault;
    MockERC20        musd;

    address owner       = makeAddr("owner");
    address keeper      = makeAddr("keeper");
    address seller      = makeAddr("seller");
    address alice       = makeAddr("alice");

    uint256 constant DEPOSIT_AMT = 22_500e18;
    uint256 constant GROSS_YIELD = 112.5e18; // ~6% APY / 12 months on 22,500

    function setUp() public {
        musd   = new MockERC20("MUSD", "MUSD");
        vault  = new MockMUSDVault(address(musd));

        vm.startPrank(owner);
        escrow = new EscrowController(address(musd), owner);
        router = new YieldRouter(
            address(musd),
            address(vault),
            address(escrow),
            keeper,
            owner
        );
        escrow.setYieldRouter(address(router));
        vm.stopPrank();

        // Mint MUSD for keeper to deposit
        musd.mint(keeper, 1_000_000e18);
        // Mint MUSD to MockMUSDVault so it can pay gains
        musd.mint(address(vault), 1_000_000e18);
    }

    // ─── Happy path ───────────────────────────────────────────────────────────

    function testDepositToVault_success() public {
        vm.startPrank(keeper);
        musd.approve(address(router), DEPOSIT_AMT);
        router.depositToVault(DEPOSIT_AMT);
        vm.stopPrank();

        assertEq(router.totalDeposited(), DEPOSIT_AMT, "deposit not tracked");
        assertEq(vault.deposits(address(router)), DEPOSIT_AMT, "vault not credited");
    }

    function testHarvestAndRoute_routesCorrectAmount() public {
        // First deposit
        vm.startPrank(keeper);
        musd.approve(address(router), DEPOSIT_AMT);
        router.depositToVault(DEPOSIT_AMT);
        vm.stopPrank();

        // Simulate yield accrual
        vault.setGain(address(router), GROSS_YIELD);

        // Create an escrow so there's somewhere to route
        musd.mint(alice, 100_000e18);
        vm.startPrank(alice);
        musd.approve(address(escrow), 11_250e18);
        escrow.createEscrow(seller, 11_250e18, 93.75e18, 30 days);
        vm.stopPrank();

        // Harvest & route
        vm.prank(keeper);
        router.harvestAndRoute(1);

        assertGt(router.totalRoutedToEscrow(), 0, "nothing routed to escrow");
    }

    function testHarvestAndRoute_revertsIfCallerNotKeeper() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(YieldRouter.CallerNotKeeper.selector, alice));
        router.harvestAndRoute(1);
    }

    function testGetAccruedYield_returnsCorrectValue() public {
        vm.startPrank(keeper);
        musd.approve(address(router), DEPOSIT_AMT);
        router.depositToVault(DEPOSIT_AMT);
        vm.stopPrank();

        vault.setGain(address(router), GROSS_YIELD);
        assertEq(router.getAccruedYield(), GROSS_YIELD, "accrued yield mismatch");
    }

    function testHarvestAndRoute_handlesZeroYield() public {
        vm.startPrank(keeper);
        musd.approve(address(router), DEPOSIT_AMT);
        router.depositToVault(DEPOSIT_AMT);
        vm.stopPrank();

        // No yield set → should revert with NoYieldToRoute
        vm.prank(keeper);
        vm.expectRevert(YieldRouter.NoYieldToRoute.selector);
        router.harvestAndRoute(1);
    }

    // ─── Gas snapshots ────────────────────────────────────────────────────────

    function testGas_harvestAndRoute() public {
        vm.startPrank(keeper);
        musd.approve(address(router), DEPOSIT_AMT);
        router.depositToVault(DEPOSIT_AMT);
        vm.stopPrank();

        vault.setGain(address(router), GROSS_YIELD);

        uint256 gasStart = gasleft();
        vm.prank(keeper);
        router.harvestAndRoute(1);
        uint256 gasUsed = gasStart - gasleft();
        console.log("harvestAndRoute gas:", gasUsed);
    }
}
