// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IWormholeNTT
/// @notice Minimal interface for the Wormhole NTT (Native Token Transfer) Manager
///         deployed on Mezo.  Only the functions called by MezoMortgage are declared.
///
///         Reference: github.com/mezo-org/ntt-bridge-mezo-testnet
interface IWormholeNTT {
    // ─── Errors ───────────────────────────────────────────────────────────────

    /// @dev Thrown when a zero recipient address is supplied
    error InvalidRecipient();

    /// @dev Thrown when the target chain is not supported
    error UnsupportedChain(uint16 chainId);

    // ─── Functions ───────────────────────────────────────────────────────────

    /// @notice Initiate a cross-chain NTT transfer.
    ///         The caller must have approved the NTT Manager for `amount` tokens
    ///         before calling this function.
    /// @param amount          Token amount to transfer (18 decimals)
    /// @param recipientChain  Wormhole chain ID of the destination
    ///                        (e.g. 2 = Ethereum, 30 = Base)
    /// @param recipient       Recipient address encoded as 32 bytes
    ///                        (use `bytes32(uint256(uint160(addr)))` for EVM)
    /// @param shouldQueue     Whether to queue the transfer if rate-limited
    /// @return sequence       Wormhole message sequence number for status tracking
    function transfer(
        uint256 amount,
        uint16  recipientChain,
        bytes32 recipient,
        bool    shouldQueue
    ) external payable returns (uint64 sequence);

    /// @notice Get the delivery price quote for a cross-chain transfer.
    ///         The returned value must be passed as `msg.value` to `transfer`.
    /// @param targetChain  Wormhole chain ID of the destination
    /// @return nativeCost  Cost in native gas token (BTC on Mezo)
    function quoteDeliveryPrice(uint16 targetChain)
        external
        view
        returns (uint256 nativeCost);

    /// @notice Returns whether the given chain ID is a supported transfer destination.
    /// @param chainId  Wormhole chain ID to check
    function isChainSupported(uint16 chainId) external view returns (bool);
}
