// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EscrowController
/// @notice Holds MUSD earmarked for a property purchase and releases monthly
///         installments on schedule to the seller. Only the YieldRouter can
///         trigger installment releases.
contract EscrowController is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error InvalidSeller();
    error InvalidAmount();
    error InvalidInterval();
    error CallerNotYieldRouter(address caller);
    error EscrowNotActive(uint256 escrowId);
    error InstallmentNotDue(uint256 nextDue, uint256 current);
    error EscrowFullyPaid(uint256 escrowId);
    error InsufficientEscrowBalance(uint256 balance, uint256 required);

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a new escrow is created
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed seller,
        uint256 totalAmount,
        uint256 installmentAmount,
        uint256 intervalSeconds
    );

    /// @notice Emitted each time an installment is successfully released
    event InstallmentReleased(
        uint256 indexed escrowId,
        address indexed seller,
        uint256 amount,
        uint256 remaining
    );

    /// @notice Emitted when the owner performs an emergency withdrawal
    event EmergencyWithdraw(uint256 indexed escrowId, address indexed to, uint256 amount);

    // ─── Storage ─────────────────────────────────────────────────────────────

    struct Escrow {
        address seller;           // Beneficiary address (on Mezo or cross-chain)
        uint256 totalAmount;      // Total MUSD to be paid out (18 dec)
        uint256 installmentAmt;   // MUSD per installment (18 dec)
        uint256 intervalSeconds;  // Seconds between installments (e.g. 30 days)
        uint256 balance;          // Remaining MUSD balance (18 dec)
        uint256 nextDue;          // Unix timestamp of the next installment
        bool    active;
    }

    IERC20  public immutable musd;
    address public yieldRouter;

    uint256 private _escrowCounter;
    mapping(uint256 => Escrow) public escrows;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _musd   MUSD token address
    /// @param _owner  Initial owner
    constructor(address _musd, address _owner) Ownable(_owner) {
        if (_musd == address(0)) revert InvalidSeller();
        musd = IERC20(_musd);
    }

    // ─── Configuration ────────────────────────────────────────────────────────

    /// @notice Set (or update) the YieldRouter address
    /// @param _yieldRouter  Address of the YieldRouter contract
    function setYieldRouter(address _yieldRouter) external onlyOwner {
        if (_yieldRouter == address(0)) revert InvalidSeller();
        yieldRouter = _yieldRouter;
    }

    // ─── Escrow lifecycle ─────────────────────────────────────────────────────

    /// @notice Create a new escrow. Caller must have approved this contract for `amount` MUSD.
    /// @param seller           Property seller address
    /// @param amount           Total MUSD to place in escrow (18 dec)
    /// @param installmentAmt   MUSD per installment (18 dec)
    /// @param intervalSeconds  Seconds between installments (≥ 1 day)
    /// @return escrowId        New escrow ID
    function createEscrow(
        address seller,
        uint256 amount,
        uint256 installmentAmt,
        uint256 intervalSeconds
    ) external nonReentrant whenNotPaused returns (uint256 escrowId) {
        if (seller == address(0))      revert InvalidSeller();
        if (amount == 0)               revert InvalidAmount();
        if (installmentAmt == 0)       revert InvalidAmount();
        if (intervalSeconds < 1 days)  revert InvalidInterval();

        musd.safeTransferFrom(msg.sender, address(this), amount);

        escrowId = ++_escrowCounter;
        escrows[escrowId] = Escrow({
            seller:          seller,
            totalAmount:     amount,
            installmentAmt:  installmentAmt,
            intervalSeconds: intervalSeconds,
            balance:         amount,
            nextDue:         block.timestamp + intervalSeconds,
            active:          true
        });

        emit EscrowCreated(escrowId, seller, amount, installmentAmt, intervalSeconds);
    }

    /// @notice Release one installment to the seller. Only callable by the YieldRouter.
    /// @param escrowId  Escrow to process
    function releaseInstallment(uint256 escrowId)
        external
        nonReentrant
        whenNotPaused
    {
        if (msg.sender != yieldRouter) revert CallerNotYieldRouter(msg.sender);

        Escrow storage e = escrows[escrowId];
        if (!e.active)                      revert EscrowNotActive(escrowId);
        if (e.balance == 0)                 revert EscrowFullyPaid(escrowId);
        if (block.timestamp < e.nextDue)    revert InstallmentNotDue(e.nextDue, block.timestamp);

        uint256 payout = e.installmentAmt > e.balance ? e.balance : e.installmentAmt;
        if (payout > e.balance) revert InsufficientEscrowBalance(e.balance, payout);

        e.balance   -= payout;
        e.nextDue   += e.intervalSeconds;
        if (e.balance == 0) e.active = false;

        musd.safeTransfer(e.seller, payout);

        emit InstallmentReleased(escrowId, e.seller, payout, e.balance);
    }

    /// @notice Emergency withdrawal by the owner (pauses escrow first)
    /// @param escrowId  Escrow to drain
    /// @param to        Destination address for the funds
    function emergencyWithdraw(uint256 escrowId, address to)
        external
        onlyOwner
        nonReentrant
    {
        if (to == address(0)) revert InvalidSeller();
        Escrow storage e = escrows[escrowId];
        uint256 amount = e.balance;
        if (amount == 0) revert EscrowFullyPaid(escrowId);

        e.balance = 0;
        e.active  = false;

        musd.safeTransfer(to, amount);
        emit EmergencyWithdraw(escrowId, to, amount);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Return the full payment schedule info for an escrow
    /// @param escrowId  Escrow to query
    function getSchedule(uint256 escrowId)
        external
        view
        returns (
            address seller,
            uint256 balance,
            uint256 installmentAmt,
            uint256 nextDue,
            bool    active
        )
    {
        Escrow storage e = escrows[escrowId];
        return (e.seller, e.balance, e.installmentAmt, e.nextDue, e.active);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Pause the contract
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause the contract
    function unpause() external onlyOwner { _unpause(); }
}
