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

    /// @notice Initiate a cross-chain NTT transfer using the simple manager call.
    /// @param amount          Token amount to transfer (18 decimals)
    /// @param recipientChain  Wormhole chain ID of the destination
    ///                        (e.g. 2 = Ethereum, 30 = Base)
    /// @param recipient       Recipient address encoded as 32 bytes
    ///                        (use `bytes32(uint256(uint160(addr)))` for EVM)
    /// @return sequence       Wormhole message sequence number for status tracking
    function transfer(
        uint256 amount,
        uint16  recipientChain,
        bytes32 recipient
    ) external payable returns (uint64 sequence);

    /// @notice Initiate a cross-chain NTT transfer with refund and queue controls.
    /// @param amount                    Token amount to transfer (18 decimals)
    /// @param recipientChain            Wormhole chain ID of the destination
    /// @param recipient                 Recipient address encoded as 32 bytes
    /// @param refundAddress             Address encoded as bytes32 for unused gas refunds
    /// @param shouldQueue               Queue if outbound rate limits are exceeded
    /// @param transceiverInstructions   Optional transceiver-specific instructions
    /// @return sequence                 Wormhole message sequence number for status tracking
    function transfer(
        uint256 amount,
        uint16  recipientChain,
        bytes32 recipient,
        bytes32 refundAddress,
        bool    shouldQueue,
        bytes calldata transceiverInstructions
    ) external payable returns (uint64 sequence);

    /// @notice Get the delivery price quote for a cross-chain transfer.
    ///         The total price must be passed as `msg.value` to `transfer`.
    /// @param recipientChain            Wormhole chain ID of the destination
    /// @param transceiverInstructions   Optional transceiver-specific instructions
    /// @return deliveryQuotes           Per-transceiver delivery quotes
    /// @return totalPrice               Cost in native gas token (BTC on Mezo)
    function quoteDeliveryPrice(
        uint16 recipientChain,
        bytes calldata transceiverInstructions
    )
        external
        view
        returns (uint256[] memory deliveryQuotes, uint256 totalPrice);

    /// @notice Return the next message sequence that will be assigned by the manager.
    /// @return sequence  Next manager message sequence
    function nextMessageSequence() external view returns (uint64 sequence);

    /// @notice Returns whether the given chain ID is a supported transfer destination.
    /// @param chainId  Wormhole chain ID to check
    function isChainSupported(uint16 chainId) external view returns (bool);
}
