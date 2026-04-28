// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBorrowManager} from "../../src/interfaces/IBorrowManager.sol";

/// @title MockBorrowManager
/// @notice Test stub for Mezo's BorrowManager. Returns configurable Trove data
///         and records collateral / debt mutations.
contract MockBorrowManager is IBorrowManager {
    struct TroveState {
        uint256 collateral;
        uint256 debt;
        uint8   status; // 0=nonExistent, 1=active
    }

    mapping(address => TroveState) public troves;

    // ─── Configuration helpers ────────────────────────────────────────────────

    /// @dev Seed a Trove with preset values (for test setup)
    function setTrove(address borrower, uint256 coll, uint256 debt) external {
        troves[borrower] = TroveState({collateral: coll, debt: debt, status: 1});
    }

    // ─── IBorrowManager implementation ────────────────────────────────────────

    function openTrove(uint256 _MUSDAmount, address, address) external payable override {
        troves[msg.sender] = TroveState({
            collateral: msg.value,
            debt:       _MUSDAmount,
            status:     1
        });
    }

    function addColl(address, address) external payable override {
        troves[msg.sender].collateral += msg.value;
    }

    function withdrawColl(uint256 amount, address, address) external override {
        troves[msg.sender].collateral -= amount;
    }

    function repayMUSD(uint256 amount, address, address) external override {
        if (troves[msg.sender].debt >= amount) {
            troves[msg.sender].debt -= amount;
        } else {
            troves[msg.sender].debt = 0;
        }
    }

    function closeTrove() external override {
        troves[msg.sender].status = 2;
        troves[msg.sender].collateral = 0;
        troves[msg.sender].debt       = 0;
    }

    function getTrove(address borrower) external view override returns (TroveData memory trove) {
        TroveState storage s = troves[borrower];
        trove = TroveData({collateral: s.collateral, debt: s.debt, status: s.status});
    }

    function getNominalICR(address borrower) external view override returns (uint256) {
        TroveState storage s = troves[borrower];
        if (s.debt == 0) return type(uint256).max;
        return (s.collateral * 1e20) / s.debt; // simplified NICR
    }

    function getCurrentICR(address borrower, uint256 price) external view override returns (uint256) {
        TroveState storage s = troves[borrower];
        if (s.debt == 0) return type(uint256).max;
        uint256 collValueUSD = (s.collateral * price) / 1e18;
        return (collValueUSD * 1e18) / s.debt;
    }
}
