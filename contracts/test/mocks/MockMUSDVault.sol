// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMUSDVault} from "../../src/interfaces/IMUSDVault.sol";

/// @title MockMUSDVault
/// @notice Test stub for Mezo's MUSD Savings Vault.
///         Simulates deposit tracking and configurable yield accrual.
contract MockMUSDVault is IMUSDVault {
    IERC20 public musd;

    mapping(address => uint256) public deposits;
    mapping(address => uint256) public pendingGains;

    constructor(address _musd) {
        musd = IERC20(_musd);
    }

    // ─── Test helpers ─────────────────────────────────────────────────────────

    /// @dev Manually set a yield gain for `depositor` (simulates accrual)
    function setGain(address depositor, uint256 gain) external {
        pendingGains[depositor] = gain;
    }

    // ─── IMUSDVault implementation ────────────────────────────────────────────

    function provideToSP(uint256 _amount, address) external override {
        musd.transferFrom(msg.sender, address(this), _amount);
        deposits[msg.sender] += _amount;
    }

    function withdrawFromSP(uint256 _amount) external override {
        if (_amount > 0) {
            require(deposits[msg.sender] >= _amount, "insufficient deposit");
            deposits[msg.sender] -= _amount;
            musd.transfer(msg.sender, _amount);
        }
        // Credit any pending gains
        uint256 gain = pendingGains[msg.sender];
        if (gain > 0) {
            pendingGains[msg.sender] = 0;
            musd.transfer(msg.sender, gain);
        }
    }

    function getCompoundedMUSDDeposit(address _depositor) external view override returns (uint256) {
        return deposits[_depositor];
    }

    function getDepositorMUSDGain(address _depositor) external view override returns (uint256) {
        return pendingGains[_depositor];
    }
}
