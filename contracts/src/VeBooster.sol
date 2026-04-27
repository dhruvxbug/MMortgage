// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IVeMEZO} from "./interfaces/IVeMEZO.sol";

/// @title VeBooster
/// @notice Lets users lock veMEZO tokens to earn a borrow-rate discount.
///         Active veMEZO lockers pay 50 bps (0.5%) instead of 100 bps (1%).
///         Addresses the MEZO Utilization prize track.
contract VeBooster is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAmount();
    error LockNotExpired(uint256 expiry, uint256 current);
    error NoActiveLock();
    error InvalidAddress();
    error LockAlreadyActive();

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a user locks veMEZO
    event VeMEZOLocked(address indexed user, uint256 amount, uint256 duration, uint256 expiry);

    /// @notice Emitted when a user unlocks expired veMEZO
    event VeMEZOUnlocked(address indexed user, uint256 amount);

    /// @notice Emitted when the discount rate is updated
    event DiscountRateUpdated(uint256 newDiscountedRateBps);

    // ─── Constants ───────────────────────────────────────────────────────────

    /// @dev Standard borrow rate in basis points (1%)
    uint256 public constant STANDARD_RATE_BPS = 100;

    // ─── Storage ─────────────────────────────────────────────────────────────

    /// @notice Discounted borrow rate in basis points (default: 50 = 0.5%)
    uint256 public discountedRateBps = 50;

    IERC20  public immutable mezoToken; // MEZO ERC-20 token (locked by users)
    IVeMEZO public immutable veMEZO;    // veMEZO voting power contract

    struct LockInfo {
        uint256 amount;  // MEZO tokens locked
        uint256 expiry;  // Unix timestamp when lock expires
    }

    mapping(address => LockInfo) public locks;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _mezoToken  MEZO ERC-20 token address
    /// @param _veMEZO     veMEZO contract address
    /// @param _owner      Initial owner
    constructor(address _mezoToken, address _veMEZO, address _owner) Ownable(_owner) {
        if (_mezoToken == address(0) || _veMEZO == address(0)) revert InvalidAddress();
        mezoToken = IERC20(_mezoToken);
        veMEZO    = IVeMEZO(_veMEZO);
    }

    // ─── User actions ─────────────────────────────────────────────────────────

    /// @notice Lock MEZO tokens for `duration` seconds to earn the rate discount.
    ///         Caller must approve this contract for `amount` MEZO first.
    /// @param amount    Amount of MEZO to lock (18 dec)
    /// @param duration  Lock duration in seconds (min 7 days)
    function lockVeMEZO(uint256 amount, uint256 duration)
        external
        nonReentrant
    {
        if (amount == 0)          revert ZeroAmount();
        if (duration < 7 days)    revert ZeroAmount(); // reuse error for brevity
        // Only one active lock per user at a time
        if (locks[msg.sender].expiry > block.timestamp) revert LockAlreadyActive();

        mezoToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 expiry = block.timestamp + duration;
        locks[msg.sender] = LockInfo({amount: amount, expiry: expiry});

        emit VeMEZOLocked(msg.sender, amount, duration, expiry);
    }

    /// @notice Unlock MEZO tokens after the lock has expired
    function unlockAfterExpiry() external nonReentrant {
        LockInfo storage lock = locks[msg.sender];
        if (lock.amount == 0)              revert NoActiveLock();
        if (block.timestamp < lock.expiry) revert LockNotExpired(lock.expiry, block.timestamp);

        uint256 amount = lock.amount;
        delete locks[msg.sender];

        mezoToken.safeTransfer(msg.sender, amount);
        emit VeMEZOUnlocked(msg.sender, amount);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Apply the discount for a user if they have an active veMEZO lock.
    ///         Returns true if the discount was successfully applied (lock still active).
    /// @param user  Address to check
    /// @return hasDiscount  Whether the discount is active
    function applyDiscount(address user) external view returns (bool hasDiscount) {
        return _hasActiveLock(user);
    }

    /// @notice Return the effective annual borrow rate in basis points for `user`
    /// @param user  Address to query
    /// @return rateBps  50 if user has an active veMEZO lock; 100 otherwise
    function getEffectiveRate(address user) external view returns (uint256 rateBps) {
        return _hasActiveLock(user) ? discountedRateBps : STANDARD_RATE_BPS;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Update the discounted rate (onlyOwner)
    /// @param newRateBps  New discounted rate in basis points (must be < STANDARD_RATE_BPS)
    function setDiscountedRate(uint256 newRateBps) external onlyOwner {
        require(newRateBps < STANDARD_RATE_BPS, "Discount must be less than standard rate");
        discountedRateBps = newRateBps;
        emit DiscountRateUpdated(newRateBps);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _hasActiveLock(address user) internal view returns (bool) {
        LockInfo storage lock = locks[user];
        // Check both our internal lock AND on-chain veMEZO balance
        bool internalActive = lock.amount > 0 && lock.expiry > block.timestamp;
        bool veActive       = veMEZO.balanceOf(user) > 0 && veMEZO.lockedEnd(user) > block.timestamp;
        return internalActive || veActive;
    }
}
