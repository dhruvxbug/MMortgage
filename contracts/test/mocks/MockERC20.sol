// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Simple mintable ERC-20 used as MUSD / MEZO in tests
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /// @dev Mint `amount` tokens to `to` — callable by anyone in tests
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
