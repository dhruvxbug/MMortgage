// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IBorrowManager} from "./interfaces/IBorrowManager.sol";
import {IBTCOracle} from "./interfaces/IBTCOracle.sol";
import {MortgageNFT} from "./MortgageNFT.sol";

/// @title MortgageVault
/// @notice Core CDP wrapper for MezoMortgage. Users deposit BTC collateral,
///         open a Trove in Mezo's BorrowManager, mint MUSD, and receive a
///         MortgageNFT representing their position.
contract MortgageVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────

    /// @dev Minimum collateral ratio at origination (150% = 1.5e18)
    uint256 public constant MIN_COLLATERAL_RATIO = 150e16;

    /// @dev Oracle price freshness window: reject prices older than 1 hour
    uint256 public constant ORACLE_FRESHNESS_WINDOW = 1 hours;

    /// @dev Basis points denominator
    uint256 public constant BPS = 10_000;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroCollateral();
    error ZeroMUSD();
    error CollateralRatioTooLow(uint256 ratio, uint256 minimum);
    error StaleOraclePrice(uint256 updatedAt, uint256 maxAge);
    error NotPositionOwner(address caller, address owner);
    error PositionNotActive(uint256 positionId);
    error PositionAlreadyExists(uint256 positionId);
    error InsufficientRepayment();
    error InvalidAddress();

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a new mortgage is opened
    event MortgageOpened(
        uint256 indexed positionId,
        address indexed owner,
        uint256 collateralBTC,
        uint256 borrowedMUSD,
        uint256 tokenId
    );

    /// @notice Emitted when collateral is added to a position
    event CollateralAdded(uint256 indexed positionId, address indexed owner, uint256 amount);

    /// @notice Emitted when MUSD is partially repaid
    event MortgageRepaid(uint256 indexed positionId, address indexed owner, uint256 amount);

    /// @notice Emitted when a mortgage is fully closed
    event MortgageClosed(uint256 indexed positionId, address indexed owner);

    // ─── Storage ─────────────────────────────────────────────────────────────

    struct Position {
        address owner;
        uint256 collateralBTC;  // BTC deposited (wei, 18 dec)
        uint256 borrowedMUSD;   // MUSD minted (18 dec)
        uint256 paidMUSD;       // MUSD repaid so far (18 dec)
        uint256 tokenId;        // MortgageNFT token ID
        bool    active;
    }

    IBorrowManager public immutable borrowManager;
    IBTCOracle     public immutable btcOracle;
    IERC20         public immutable musd;
    MortgageNFT    public immutable mortgageNFT;

    uint256 private _positionCounter;

    mapping(uint256 => Position) public positions;
    // owner → array of positionIds
    mapping(address => uint256[]) private _ownerPositions;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _borrowManager  Mezo BorrowManager address
    /// @param _btcOracle      Mezo BTC price oracle address
    /// @param _musd           MUSD token address
    /// @param _mortgageNFT    MortgageNFT contract address
    /// @param _owner          Initial owner of the vault
    constructor(
        address _borrowManager,
        address _btcOracle,
        address _musd,
        address _mortgageNFT,
        address _owner
    ) Ownable(_owner) {
        if (
            _borrowManager == address(0) ||
            _btcOracle     == address(0) ||
            _musd          == address(0) ||
            _mortgageNFT   == address(0)
        ) revert InvalidAddress();

        borrowManager = IBorrowManager(_borrowManager);
        btcOracle     = IBTCOracle(_btcOracle);
        musd          = IERC20(_musd);
        mortgageNFT   = MortgageNFT(_mortgageNFT);
    }

    // ─── Core actions ────────────────────────────────────────────────────────

    /// @notice Open a new mortgage by depositing BTC collateral and borrowing MUSD
    /// @dev    Msg.value is the BTC collateral (native gas token on Mezo)
    /// @param  musdAmount  Amount of MUSD to borrow (18 decimals)
    /// @return positionId  New position ID
    function openMortgage(uint256 musdAmount)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 positionId)
    {
        if (msg.value == 0)   revert ZeroCollateral();
        if (musdAmount == 0)  revert ZeroMUSD();

        // Check oracle freshness and collateral ratio
        (uint256 btcPrice, uint256 updatedAt) = btcOracle.latestAnswer();
        _requireFreshPrice(updatedAt);
        _requireSafeRatio(msg.value, musdAmount, btcPrice, MIN_COLLATERAL_RATIO);

        // Open Trove in Mezo BorrowManager (sends BTC via msg.value)
        borrowManager.openTrove{value: msg.value}(musdAmount, address(0), address(0));

        // Record position
        positionId = ++_positionCounter;
        positions[positionId] = Position({
            owner:        msg.sender,
            collateralBTC: msg.value,
            borrowedMUSD: musdAmount,
            paidMUSD:     0,
            tokenId:      0,
            active:       true
        });
        _ownerPositions[msg.sender].push(positionId);

        // Mint NFT
        MortgageNFT.MortgageData memory nftData = MortgageNFT.MortgageData({
            collateralBTC:  msg.value,
            borrowedMUSD:   musdAmount,
            totalPayments:  musdAmount,
            paidSoFar:      0,
            openedAt:       block.timestamp
        });
        uint256 tokenId = mortgageNFT.mint(msg.sender, nftData);
        positions[positionId].tokenId = tokenId;

        // Transfer minted MUSD to the caller
        musd.safeTransfer(msg.sender, musdAmount);

        emit MortgageOpened(positionId, msg.sender, msg.value, musdAmount, tokenId);
    }

    /// @notice Add BTC collateral to an existing position
    /// @param positionId  Position to top-up
    function addCollateral(uint256 positionId)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (msg.value == 0) revert ZeroCollateral();
        Position storage pos = _requireActiveOwner(positionId);

        borrowManager.addColl{value: msg.value}(address(0), address(0));
        pos.collateralBTC += msg.value;

        emit CollateralAdded(positionId, msg.sender, msg.value);
    }

    /// @notice Repay MUSD debt on an existing position (partial or full)
    /// @param positionId  Position to repay
    /// @param musdAmount  Amount of MUSD to repay (18 decimals)
    function repayMortgage(uint256 positionId, uint256 musdAmount)
        external
        nonReentrant
        whenNotPaused
    {
        if (musdAmount == 0) revert ZeroMUSD();
        Position storage pos = _requireActiveOwner(positionId);

        // Pull MUSD from caller
        musd.safeTransferFrom(msg.sender, address(this), musdAmount);
        musd.approve(address(borrowManager), musdAmount);
        borrowManager.repayMUSD(musdAmount, address(0), address(0));

        pos.paidMUSD += musdAmount;

        // Update NFT progress
        mortgageNFT.updatePaid(pos.tokenId, pos.paidMUSD);

        emit MortgageRepaid(positionId, msg.sender, musdAmount);
    }

    /// @notice Close a mortgage by repaying all remaining MUSD debt
    /// @param positionId  Position to close
    function closeMortgage(uint256 positionId)
        external
        nonReentrant
        whenNotPaused
    {
        Position storage pos = _requireActiveOwner(positionId);

        uint256 remaining = pos.borrowedMUSD - pos.paidMUSD;
        if (remaining > 0) {
            musd.safeTransferFrom(msg.sender, address(this), remaining);
            musd.approve(address(borrowManager), remaining);
        }

        borrowManager.closeTrove();
        pos.active = false;

        emit MortgageClosed(positionId, msg.sender);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Return the current collateral ratio for a position (18-decimal fixed point)
    /// @param positionId  Position to check
    /// @return ratio      Collateral value / debt value (e.g. 2.0e18 = 200%)
    function getCollateralRatio(uint256 positionId) external view returns (uint256 ratio) {
        Position storage pos = positions[positionId];
        if (!pos.active) revert PositionNotActive(positionId);

        (uint256 btcPrice,) = btcOracle.latestAnswer();
        uint256 collateralValueUSD = (pos.collateralBTC * btcPrice) / 1e18;
        uint256 debt = pos.borrowedMUSD - pos.paidMUSD;
        if (debt == 0) return type(uint256).max;
        ratio = (collateralValueUSD * 1e18) / debt;
    }

    /// @notice Return full position detail in a single call.
    ///         Collateral ratio is returned in basis points (20000 = 200%).
    ///         Escrow-related fields (propertyPrice, installmentsPaid,
    ///         totalInstallments, isCrossChain, destinationChain) are reserved
    ///         for future integration with EscrowController and are returned as
    ///         zero/false/"" in this version.
    /// @param positionId  Position to query
    function getPosition(uint256 positionId)
        external
        view
        returns (
            uint256 collateralAmount,
            uint256 borrowedMUSD,
            uint256 ltvBps,
            uint256 collateralRatioBps,
            uint256 propertyPrice,
            uint256 installmentsPaid,
            uint256 totalInstallments,
            address seller,
            bool    isCrossChain,
            string  memory destinationChain,
            bool    active
        )
    {
        Position storage pos = positions[positionId];
        (uint256 btcPrice,) = btcOracle.latestAnswer();
        uint256 collValueUSD = (pos.collateralBTC * btcPrice) / 1e18;
        uint256 debt = pos.borrowedMUSD > pos.paidMUSD
            ? pos.borrowedMUSD - pos.paidMUSD
            : 0;

        // LTV in bps: e.g. 5000 = 50%
        ltvBps = collValueUSD > 0 ? (debt * BPS) / collValueUSD : 0;

        // Collateral ratio in bps: e.g. 20000 = 200%
        // (collValueUSD * 10_000) / debt  — both values are 18-decimal,
        // the 1e18 factors cancel, leaving a pure ratio in basis-point units.
        collateralRatioBps = debt > 0 ? (collValueUSD * BPS) / debt : type(uint256).max;

        return (
            pos.collateralBTC,
            pos.borrowedMUSD,
            ltvBps,
            collateralRatioBps,
            0,         // propertyPrice – tracked in EscrowController
            0,         // installmentsPaid – tracked in EscrowController
            0,         // totalInstallments – tracked in EscrowController
            pos.owner, // seller slot repurposed for position owner
            false,     // isCrossChain – tracked in EscrowController
            "",        // destinationChain – tracked in EscrowController
            pos.active
        );
    }

    /// @notice Return all position IDs owned by `owner`
    /// @param owner  Address to query
    function getPositionsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerPositions[owner];
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Pause the vault in an emergency
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume the vault after an emergency
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _requireFreshPrice(uint256 updatedAt) internal view {
        if (block.timestamp - updatedAt > ORACLE_FRESHNESS_WINDOW) {
            revert StaleOraclePrice(updatedAt, block.timestamp - ORACLE_FRESHNESS_WINDOW);
        }
    }

    function _requireSafeRatio(
        uint256 collBTC,
        uint256 debtMUSD,
        uint256 btcPrice,
        uint256 minRatio
    ) internal pure {
        uint256 collValueUSD = (collBTC * btcPrice) / 1e18;
        // ratio = collValueUSD * 1e18 / debtMUSD
        uint256 ratio = (collValueUSD * 1e18) / debtMUSD;
        if (ratio < minRatio) revert CollateralRatioTooLow(ratio, minRatio);
    }

    function _requireActiveOwner(uint256 positionId) internal view returns (Position storage pos) {
        pos = positions[positionId];
        if (!pos.active)             revert PositionNotActive(positionId);
        if (pos.owner != msg.sender) revert NotPositionOwner(msg.sender, pos.owner);
    }

    /// @dev Allow contract to receive BTC (returned collateral from closeTrove)
    receive() external payable {}
}
