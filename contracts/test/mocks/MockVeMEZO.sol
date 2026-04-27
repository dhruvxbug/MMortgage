// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVeMEZO} from "../../src/interfaces/IVeMEZO.sol";

/// @title MockVeMEZO
/// @notice Test stub for the veMEZO voting-power contract
contract MockVeMEZO is IVeMEZO {
    mapping(address => uint256) public balance;
    mapping(address => uint256) public lockEnd;

    function setBalance(address user, uint256 amount) external {
        balance[user] = amount;
    }

    function setLockEnd(address user, uint256 expiry) external {
        lockEnd[user] = expiry;
    }

    function balanceOf(address user) external view override returns (uint256) {
        return balance[user];
    }

    function lockedEnd(address user) external view override returns (uint256) {
        return lockEnd[user];
    }
}
