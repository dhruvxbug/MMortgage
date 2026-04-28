// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IMUSDVault} from "./interfaces/IMUSDVault.sol";
import {EscrowController} from "./EscrowController.sol";

/// @title YieldRouter
/// @notice Deposits MUSD into the Mezo savings vault, harvests accrued yield,
///         deducts the borrow cost, and routes the net yield to the
///         EscrowController. Called by the keeper bot on a daily cron schedule.
contract YieldRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error CallerNotKeeper(address caller);
    error ZeroAmount();
    error InvalidAddress();
    error NoYieldToRoute();

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when MUSD is deposited into the savings vault
    event DepositedToVault(uint256 amount);

    /// @notice Emitted when yield is harvested and routed to the escrow
    event YieldHarvestedAndRouted(
        uint256 grossYield,
        uint256 borrowCost,
        uint256 netYield,
        uint256 escrowId
    );

    /// @notice Emitted when the keeper address is updated
    event KeeperUpdated(address indexed newKeeper);

    // ─── Storage ─────────────────────────────────────────────────────────────

    /// @dev Annual borrow rate in basis points (100 = 1%)
    uint256 public constant BORROW_RATE_BPS = 100;

    IERC20           public immutable musd;
    IMUSDVault       public immutable musdVault;
    EscrowController public immutable escrow;

    address public keeper;

    /// @notice Total MUSD deposited by this contract into the vault (18 dec)
    uint256 public totalDeposited;
    /// @notice Cumulative yield sent to escrow (18 dec)
    uint256 public totalRoutedToEscrow;
    /// @notice Unix timestamp of the last deposit (used for pro-rata borrow cost calculation)
    uint256 public lastDepositAt;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _musd       MUSD token address
    /// @param _musdVault  Mezo MUSD Savings Vault address
    /// @param _escrow     EscrowController address
    /// @param _keeper     Keeper bot address
    /// @param _owner      Initial owner
    constructor(
        address _musd,
        address _musdVault,
        address _escrow,
        address _keeper,
        address _owner
    ) Ownable(_owner) {
        if (
            _musd      == address(0) ||
            _musdVault == address(0) ||
            _escrow    == address(0) ||
            _keeper    == address(0)
        ) revert InvalidAddress();

        musd      = IERC20(_musd);
        musdVault = IMUSDVault(_musdVault);
        escrow    = EscrowController(_escrow);
        keeper    = _keeper;
    }

    // ─── Keeper actions ───────────────────────────────────────────────────────

    /// @notice Deposit `amount` MUSD from caller into the Mezo savings vault
    /// @param amount  MUSD to deposit (18 dec)
    function depositToVault(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyKeeper
    {
        if (amount == 0) revert ZeroAmount();
        musd.safeTransferFrom(msg.sender, address(this), amount);
        musd.approve(address(musdVault), amount);
        musdVault.provideToSP(amount, address(0));
        totalDeposited += amount;
        lastDepositAt   = block.timestamp;
        emit DepositedToVault(amount);
    }

    /// @notice Harvest accrued vault yield, deduct pro-rata borrow cost, and route
    ///         the net yield to the escrow. Only callable by the keeper.
    /// @param escrowId  Target escrow to fund
    function harvestAndRoute(uint256 escrowId)
        external
        nonReentrant
        whenNotPaused
        onlyKeeper
    {
        // Query accrued yield from the vault
        uint256 grossYield = musdVault.getDepositorMUSDGain(address(this));
        if (grossYield == 0) revert NoYieldToRoute();

        // Withdraw the yield (principal stays in vault)
        musdVault.withdrawFromSP(0); // triggers gain credit without touching principal

        // Calculate pro-rata annual borrow cost since last deposit
        uint256 elapsed    = block.timestamp - lastDepositAt;
        uint256 borrowCost = _annualisedCost(totalDeposited, elapsed);
        if (borrowCost > grossYield) borrowCost = grossYield; // cap at gross yield

        uint256 netYield = grossYield - borrowCost;
        if (netYield == 0) revert NoYieldToRoute();

        // Approve and fund the escrow
        musd.approve(address(escrow), netYield);
        // YieldRouter is the caller → escrow.releaseInstallment is triggered separately
        // Here we transfer net yield to escrow balance for the next installment cycle
        musd.safeTransfer(address(escrow), netYield);

        totalRoutedToEscrow += netYield;
        lastDepositAt        = block.timestamp;

        emit YieldHarvestedAndRouted(grossYield, borrowCost, netYield, escrowId);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Return the current accrued yield held in the vault for this contract
    function getAccruedYield() external view returns (uint256) {
        return musdVault.getDepositorMUSDGain(address(this));
    }

    /// @notice Return the current principal deposited in the savings vault
    function getVaultBalance() external view returns (uint256) {
        return musdVault.getCompoundedMUSDDeposit(address(this));
    }

    /// @notice Estimate the next net installment based on current accrued yield
    function getPendingInstallment() external view returns (uint256 netYield) {
        uint256 gross    = musdVault.getDepositorMUSDGain(address(this));
        uint256 elapsed  = block.timestamp - lastDepositAt;
        uint256 cost     = _annualisedCost(totalDeposited, elapsed);
        if (cost > gross) return 0;
        netYield = gross - cost;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Update the keeper address
    /// @param _keeper  New keeper address
    function setKeeper(address _keeper) external onlyOwner {
        if (_keeper == address(0)) revert InvalidAddress();
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }

    /// @notice Pause the contract
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause the contract
    function unpause() external onlyOwner { _unpause(); }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /// @dev Calculate pro-rata annual borrow cost: principal * rate * (elapsed / 365days)
    function _annualisedCost(uint256 principal, uint256 elapsedSeconds)
        internal
        pure
        returns (uint256)
    {
        // cost = principal * BORROW_RATE_BPS / 10000 * elapsedSeconds / 365days
        return (principal * BORROW_RATE_BPS * elapsedSeconds) / (10_000 * 365 days);
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert CallerNotKeeper(msg.sender);
        _;
    }
}
