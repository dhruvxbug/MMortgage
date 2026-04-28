// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVeMEZO
/// @notice Minimal interface for the veMEZO governance token lock contract
interface IVeMEZO {
    /// @notice Returns the amount of veMEZO voting power (locked balance) held by `_user`
    /// @param _user  Address to query
    function balanceOf(address _user) external view returns (uint256);

    /// @notice Returns the timestamp when `_user`'s veMEZO lock expires
    /// @param _user  Address to query
    function lockedEnd(address _user) external view returns (uint256);
}
