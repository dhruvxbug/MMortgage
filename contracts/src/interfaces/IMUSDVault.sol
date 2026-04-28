// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IMUSDVault
/// @notice Minimal interface for Mezo's MUSD Savings Vault
interface IMUSDVault {
    // ─── Depositor actions ────────────────────────────────────────────────────

    /// @notice Deposit MUSD into the savings vault
    /// @param _amount      Amount of MUSD to deposit (18 decimals)
    /// @param _frontEndTag Frontend tag address (pass address(0) if none)
    function provideToSP(uint256 _amount, address _frontEndTag) external;

    /// @notice Withdraw MUSD from the savings vault
    /// @param _amount  Amount of MUSD to withdraw (18 decimals)
    function withdrawFromSP(uint256 _amount) external;

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Return the deposited MUSD balance for `_depositor`
    /// @param _depositor  Address to query
    function getCompoundedMUSDDeposit(address _depositor) external view returns (uint256);

    /// @notice Return the pending MUSD yield (gains) that have accrued but not yet been claimed
    /// @param _depositor  Address to query
    function getDepositorMUSDGain(address _depositor) external view returns (uint256);
}
