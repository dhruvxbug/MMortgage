// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBorrowManager
/// @notice Minimal interface for Mezo's CDP BorrowManager (Trove engine)
interface IBorrowManager {
    // ─── Structs ──────────────────────────────────────────────────────────────

    /// @notice Summary data returned for a Trove
    struct TroveData {
        uint256 collateral; // BTC collateral (18 decimals)
        uint256 debt;       // MUSD debt (18 decimals)
        uint8   status;     // 0=nonExistent, 1=active, 2=closedByOwner, 3=closedByLiquidation
    }

    // ─── Trove management ─────────────────────────────────────────────────────

    /// @notice Open a new Trove (CDP position), minting `_MUSDAmount` MUSD
    /// @param _MUSDAmount  Amount of MUSD to mint
    /// @param _upperHint   Address hint for sorted-troves list (pass address(0) if unknown)
    /// @param _lowerHint   Address hint for sorted-troves list (pass address(0) if unknown)
    function openTrove(
        uint256 _MUSDAmount,
        address _upperHint,
        address _lowerHint
    ) external payable;

    /// @notice Add BTC collateral to the caller's existing Trove
    /// @param _upperHint   Sorted-troves upper hint
    /// @param _lowerHint   Sorted-troves lower hint
    function addColl(address _upperHint, address _lowerHint) external payable;

    /// @notice Withdraw BTC collateral from the caller's Trove
    /// @param _collWithdrawal  Amount of BTC to withdraw (18 decimals)
    /// @param _upperHint       Sorted-troves upper hint
    /// @param _lowerHint       Sorted-troves lower hint
    function withdrawColl(
        uint256 _collWithdrawal,
        address _upperHint,
        address _lowerHint
    ) external;

    /// @notice Repay MUSD debt on the caller's Trove
    /// @param _MUSDRepayment  Amount of MUSD to repay (18 decimals)
    /// @param _upperHint       Sorted-troves upper hint
    /// @param _lowerHint       Sorted-troves lower hint
    function repayMUSD(
        uint256 _MUSDRepayment,
        address _upperHint,
        address _lowerHint
    ) external;

    /// @notice Close the caller's Trove, repaying all debt and returning collateral
    function closeTrove() external;

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Return the full Trove data for a given borrower
    /// @param _borrower  Address whose Trove to query
    /// @return trove     TroveData struct
    function getTrove(address _borrower) external view returns (TroveData memory trove);

    /// @notice Return the nominal collateral ratio (NICR) of a Trove (18-decimal fixed point)
    /// @param _borrower  Address whose Trove to query
    function getNominalICR(address _borrower) external view returns (uint256);

    /// @notice Return the current collateral ratio adjusted for BTC price
    /// @param _borrower  Address whose Trove to query
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
}
