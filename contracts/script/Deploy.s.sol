// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MortgageNFT}       from "../src/MortgageNFT.sol";
import {MortgageVault}     from "../src/MortgageVault.sol";
import {EscrowController}  from "../src/EscrowController.sol";
import {YieldRouter}       from "../src/YieldRouter.sol";
import {LiquidationBuffer} from "../src/LiquidationBuffer.sol";
import {VeBooster}         from "../src/VeBooster.sol";

/// @title Deploy
/// @notice Foundry deployment script for MezoMortgage on Mezo testnet.
///
///  Run:
///    forge script script/Deploy.s.sol --rpc-url mezo_testnet \
///      --broadcast --verify -vvvv
///
///  Required env vars (see .env.example):
///    DEPLOYER_PRIVATE_KEY
///    MEZO_BORROW_MANAGER
///    MEZO_MUSD_VAULT
///    MEZO_BTC_ORACLE
///    MEZO_MUSD_TOKEN
///    MEZO_TOKEN      (MEZO ERC-20)
///    VEMEZO_CONTRACT
///    KEEPER_ADDRESS
contract Deploy is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");

        address borrowManager = vm.envAddress("MEZO_BORROW_MANAGER");
        address musdVault     = vm.envAddress("MEZO_MUSD_VAULT");
        address btcOracle     = vm.envAddress("MEZO_BTC_ORACLE");
        address musdToken     = vm.envAddress("MEZO_MUSD_TOKEN");
        address mezoToken     = vm.envAddress("MEZO_TOKEN");
        address veMEZO        = vm.envAddress("VEMEZO_CONTRACT");
        address keeper        = vm.envAddress("KEEPER_ADDRESS");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        // ── 1. MortgageNFT ────────────────────────────────────────────────────
        MortgageNFT nft = new MortgageNFT(deployer);
        console.log("MortgageNFT:      ", address(nft));

        // ── 2. MortgageVault ──────────────────────────────────────────────────
        MortgageVault vault = new MortgageVault(
            borrowManager,
            btcOracle,
            musdToken,
            address(nft),
            deployer
        );
        console.log("MortgageVault:    ", address(vault));

        // Wire NFT → Vault
        nft.setVault(address(vault));

        // ── 3. EscrowController ───────────────────────────────────────────────
        EscrowController escrow = new EscrowController(musdToken, deployer);
        console.log("EscrowController: ", address(escrow));

        // ── 4. YieldRouter ────────────────────────────────────────────────────
        YieldRouter router = new YieldRouter(
            musdToken,
            musdVault,
            address(escrow),
            keeper,
            deployer
        );
        console.log("YieldRouter:      ", address(router));

        // Wire EscrowController → YieldRouter
        escrow.setYieldRouter(address(router));

        // ── 5. LiquidationBuffer ──────────────────────────────────────────────
        LiquidationBuffer buffer = new LiquidationBuffer(
            borrowManager,
            btcOracle,
            musdToken,
            deployer
        );
        console.log("LiquidationBuffer:", address(buffer));

        // ── 6. VeBooster ──────────────────────────────────────────────────────
        VeBooster booster = new VeBooster(mezoToken, veMEZO, deployer);
        console.log("VeBooster:        ", address(booster));

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("\n=== MezoMortgage Deployment Summary ===");
        console.log("Network:           Mezo Testnet");
        console.log("Deployer:         ", deployer);
        console.log("MortgageNFT:      ", address(nft));
        console.log("MortgageVault:    ", address(vault));
        console.log("EscrowController: ", address(escrow));
        console.log("YieldRouter:      ", address(router));
        console.log("LiquidationBuffer:", address(buffer));
        console.log("VeBooster:        ", address(booster));
    }
}
