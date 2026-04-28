// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBTCOracle
/// @notice Minimal interface for Mezo's on-chain BTC/USD price oracle
interface IBTCOracle {
    /// @notice Returns the latest BTC/USD price and its timestamp
    /// @return price      Current BTC price in USD (18 decimals)
    /// @return updatedAt  Unix timestamp of when the price was last updated
    function latestAnswer() external view returns (uint256 price, uint256 updatedAt);
}
