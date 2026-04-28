// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IBorrowManager} from "./interfaces/IBorrowManager.sol";
import {IBTCOracle} from "./interfaces/IBTCOracle.sol";

/// @title LiquidationBuffer
/// @notice Health monitor and safety net for MezoMortgage positions.
///         If BTC collateral value drops and the LTV ratio falls below the
///         topup threshold (default 140%), it triggers an automatic top-up from
///         a reserve buffer.  If it falls below the critical threshold (130%),
///         it executes a partial MUSD repayment to restore position health.
contract LiquidationBuffer is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error StaleOraclePrice(uint256 updatedAt, uint256 maxAge);
    error PositionHealthy(uint256 positionId, uint256 ratio);
    error InvalidThreshold();
    error InsufficientBuffer();
    error InvalidAddress();
    error ZeroAmount();
    error OracleReturnedZeroPrice();

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a position health check is run
    event HealthChecked(uint256 indexed positionId, uint256 collateralRatio, uint8 status);

    /// @notice Emitted when BTC collateral is topped up from the buffer
    event TopUpTriggered(uint256 indexed positionId, uint256 btcAdded);

    /// @notice Emitted when MUSD is partially repaid to restore health
    event PartialRepayTriggered(uint256 indexed positionId, uint256 musdRepaid);

    /// @notice Emitted when BTC is deposited into the reserve buffer
    event BufferDeposited(address indexed depositor, uint256 amount);

    /// @notice Emitted when the health thresholds are updated
    event ThresholdsUpdated(uint256 topUpThreshold, uint256 criticalThreshold);

    // ─── Constants / status codes ─────────────────────────────────────────────

    uint8 public constant STATUS_HEALTHY   = 0;
    uint8 public constant STATUS_TOPUP     = 1;
    uint8 public constant STATUS_CRITICAL  = 2;

    uint256 public constant ORACLE_FRESHNESS_WINDOW = 1 hours;
    uint256 public constant PRECISION = 1e18;

    // ─── Storage ─────────────────────────────────────────────────────────────

    /// @notice Collateral ratio (18-dec) at which auto-topup is triggered (default 140%)
    uint256 public topUpThreshold = 140e16;

    /// @notice Collateral ratio (18-dec) at which partial repay is triggered (default 130%)
    uint256 public criticalThreshold = 130e16;

    IBorrowManager public immutable borrowManager;
    IBTCOracle     public immutable btcOracle;
    IERC20         public immutable musd;

    /// @notice BTC reserve available for collateral top-ups (wei)
    uint256 public btcBuffer;
    /// @notice MUSD reserve available for debt repayments (18 dec)
    uint256 public musdBuffer;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _borrowManager  Mezo BorrowManager address
    /// @param _btcOracle      Mezo BTC price oracle address
    /// @param _musd           MUSD token address
    /// @param _owner          Initial owner
    constructor(
        address _borrowManager,
        address _btcOracle,
        address _musd,
        address _owner
    ) Ownable(_owner) {
        if (_borrowManager == address(0) || _btcOracle == address(0) || _musd == address(0))
            revert InvalidAddress();

        borrowManager = IBorrowManager(_borrowManager);
        btcOracle     = IBTCOracle(_btcOracle);
        musd          = IERC20(_musd);
    }

    // ─── Buffer deposits ──────────────────────────────────────────────────────

    /// @notice Deposit BTC into the buffer reserve (native gas token)
    function depositBTCBuffer() external payable {
        if (msg.value == 0) revert ZeroAmount();
        btcBuffer += msg.value;
        emit BufferDeposited(msg.sender, msg.value);
    }

    /// @notice Deposit MUSD into the buffer reserve
    /// @param amount  MUSD amount (18 dec)
    function depositMUSDBuffer(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        musd.safeTransferFrom(msg.sender, address(this), amount);
        musdBuffer += amount;
        emit BufferDeposited(msg.sender, amount);
    }

    // ─── Health monitoring ────────────────────────────────────────────────────

    /// @notice Check the health of a Trove by its borrower address and emit a status event.
    ///         Returns the current collateral ratio and a numeric status code.
    /// @param borrower    Address of the Trove owner
    /// @param positionId  Position ID for event indexing
    /// @return ratio   Current collateral ratio (18-dec fixed point)
    /// @return status  0=healthy, 1=topup required, 2=critical
    function checkHealth(address borrower, uint256 positionId)
        external
        view
        returns (uint256 ratio, uint8 status)
    {
        (uint256 btcPrice, uint256 updatedAt) = btcOracle.latestAnswer();
        if (block.timestamp - updatedAt > ORACLE_FRESHNESS_WINDOW)
            revert StaleOraclePrice(updatedAt, block.timestamp - ORACLE_FRESHNESS_WINDOW);
        if (btcPrice == 0) revert OracleReturnedZeroPrice();

        ratio  = borrowManager.getCurrentICR(borrower, btcPrice);
        status = _statusFor(ratio);
    }

    /// @notice Trigger a BTC collateral top-up from the buffer reserve for `borrower`.
    ///         Only executes if the position is below topUpThreshold.
    /// @param borrower    Address of the Trove owner
    /// @param positionId  Position ID (for event indexing)
    /// @param btcAmount   Amount of BTC to add (wei)
    function triggerTopUp(address borrower, uint256 positionId, uint256 btcAmount)
        external
        nonReentrant
        onlyOwner
    {
        if (btcAmount == 0)         revert ZeroAmount();
        if (btcBuffer < btcAmount)  revert InsufficientBuffer();

        // Verify position actually needs a topup
        (uint256 btcPrice, uint256 updatedAt) = btcOracle.latestAnswer();
        if (block.timestamp - updatedAt > ORACLE_FRESHNESS_WINDOW)
            revert StaleOraclePrice(updatedAt, block.timestamp - ORACLE_FRESHNESS_WINDOW);

        uint256 ratio = borrowManager.getCurrentICR(borrower, btcPrice);
        if (ratio >= topUpThreshold) revert PositionHealthy(positionId, ratio);

        btcBuffer -= btcAmount;
        borrowManager.addColl{value: btcAmount}(address(0), address(0));

        emit TopUpTriggered(positionId, btcAmount);
    }

    /// @notice Partially repay MUSD debt from the buffer reserve to restore health.
    /// @param borrower    Address of the Trove owner
    /// @param positionId  Position ID (for event indexing)
    /// @param musdAmount  Amount of MUSD to repay (18 dec)
    function partialRepay(address borrower, uint256 positionId, uint256 musdAmount)
        external
        nonReentrant
        onlyOwner
    {
        if (musdAmount == 0)          revert ZeroAmount();
        if (musdBuffer < musdAmount)  revert InsufficientBuffer();

        (uint256 btcPrice, uint256 updatedAt) = btcOracle.latestAnswer();
        if (block.timestamp - updatedAt > ORACLE_FRESHNESS_WINDOW)
            revert StaleOraclePrice(updatedAt, block.timestamp - ORACLE_FRESHNESS_WINDOW);

        uint256 ratio = borrowManager.getCurrentICR(borrower, btcPrice);
        if (ratio >= criticalThreshold) revert PositionHealthy(positionId, ratio);

        musdBuffer -= musdAmount;
        musd.approve(address(borrowManager), musdAmount);
        borrowManager.repayMUSD(musdAmount, address(0), address(0));

        emit PartialRepayTriggered(positionId, musdAmount);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Update the health thresholds
    /// @param _topUp     New topup threshold (18-dec, e.g. 140e16 = 140%)
    /// @param _critical  New critical threshold (18-dec, e.g. 130e16 = 130%)
    function setHealthThreshold(uint256 _topUp, uint256 _critical) external onlyOwner {
        if (_critical >= _topUp) revert InvalidThreshold();
        if (_critical < 100e16)  revert InvalidThreshold(); // must stay solvent
        topUpThreshold   = _topUp;
        criticalThreshold = _critical;
        emit ThresholdsUpdated(_topUp, _critical);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _statusFor(uint256 ratio) internal view returns (uint8) {
        if (ratio < criticalThreshold)  return STATUS_CRITICAL;
        if (ratio < topUpThreshold)     return STATUS_TOPUP;
        return STATUS_HEALTHY;
    }

    receive() external payable {
        btcBuffer += msg.value;
    }
}
