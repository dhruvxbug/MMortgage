// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBTCOracle} from "../../src/interfaces/IBTCOracle.sol";

/// @title MockBTCOracle
/// @notice Test stub for Mezo's BTC/USD price oracle.
///         Returns a configurable price and timestamp.
contract MockBTCOracle is IBTCOracle {
    uint256 public price;
    uint256 public updatedAt;

    constructor(uint256 _price) {
        price     = _price;
        updatedAt = block.timestamp;
    }

    // ─── Test helpers ─────────────────────────────────────────────────────────

    /// @dev Update the price and timestamp (simulates a fresh oracle update)
    function setPrice(uint256 _price) external {
        price     = _price;
        updatedAt = block.timestamp;
    }

    /// @dev Simulate a stale oracle by setting an old timestamp
    function setStale(uint256 _staleness) external {
        updatedAt = block.timestamp - _staleness;
    }

    // ─── IBTCOracle implementation ────────────────────────────────────────────

    function latestAnswer() external view override returns (uint256, uint256) {
        return (price, updatedAt);
    }
}
