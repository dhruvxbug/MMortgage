# MezoMortgage Wormhole NTT Integration

MezoMortgage uses Wormhole Native Token Transfers (NTT) to pay sellers who want their MUSD installments on Ethereum or Base instead of Mezo.

## Cross-Chain Flow

1. The buyer opens a MezoMortgage position and creates an escrow funded with MUSD.
2. The seller is registered with `EscrowController.setCrossChainSeller(escrowId, chainId, wormholeAddress)`.
3. When an installment is due, the keeper calls `EscrowController.releaseInstallment(escrowId)`.
4. `EscrowController` updates escrow state and emits `CrossChainRelease(escrowId, destinationChainId, destinationAddress, amount)`.
5. The keeper reads the event, quotes delivery from the Mezo NTT manager, approves MUSD, and calls the NTT manager `transfer`.
6. Wormhole Guardians attest the transfer. The destination NTT manager mints or releases native MUSD to the seller on Ethereum/Base.
7. Failed bridge attempts are logged and queued in memory for retry by the keeper.

## Keeper Configuration

Set these in `keeper/.env`:

```bash
MUSD_TOKEN_ADDRESS=0x...
WORMHOLE_NTT_MANAGER_ADDRESS=0x...
WORMHOLE_NTT_EMITTER_ADDRESS=0x...
WORMHOLE_SOURCE_CHAIN_ID=50
WORMHOLE_ETHEREUM_CHAIN_ID=2
WORMHOLE_BASE_CHAIN_ID=30
WORMHOLE_SCAN_API_URL=https://api.wormholescan.io
WORMHOLE_VAA_POLL_ATTEMPTS=4
WORMHOLE_VAA_POLL_INTERVAL_MS=15000
```

For testnet routes, use the Wormhole testnet chain IDs for the destination, such as `10002` for Sepolia and `10004` for Base Sepolia.

## Frontend Configuration

The optional manual bridge widget is rendered by `frontend/components/WormholeConnectWidget.tsx` when a dashboard position has cross-chain escrow enabled.

Set the public NTT addresses in the frontend environment:

```bash
NEXT_PUBLIC_WORMHOLE_NETWORK=Testnet
NEXT_PUBLIC_SPECTRUM_NODES_HTTP_URL=https://mezo-testnet.spectrumnodes.com
NEXT_PUBLIC_MEZO_MUSD_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_MEZO_NTT_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_MEZO_NTT_TRANSCEIVER_ADDRESS=0x...
NEXT_PUBLIC_SEPOLIA_MUSD_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_SEPOLIA_NTT_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_SEPOLIA_NTT_TRANSCEIVER_ADDRESS=0x...
NEXT_PUBLIC_BASE_SEPOLIA_MUSD_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_BASE_SEPOLIA_NTT_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_BASE_SEPOLIA_NTT_TRANSCEIVER_ADDRESS=0x...
```

Use the mainnet `ETHEREUM_*` and `BASE_*` variables when `NEXT_PUBLIC_WORMHOLE_NETWORK=Mainnet`.

## Getting Testnet MUSD on Ethereum/Base

1. Get testnet MUSD on Mezo from the project faucet or deployed MUSD test token.
2. Open Portal Bridge or Wormhole Connect.
3. Select Mezo as the source chain and MUSD as the token.
4. Select Sepolia or Base Sepolia as the destination chain.
5. Submit the source transaction, wait for Guardian attestation, then redeem on the destination chain if the route is manual.

## Known Limitations

- Ethereum finality can make delivery take about 15 minutes.
- The keeper must hold enough native BTC on Mezo to pay NTT delivery fees.
- The current keeper retry queue is in memory. Production should persist retries in Redis, Postgres, or a queue service.
- The keeper uses the configured MUSD balance/allowance for NTT transfers. Production should replace this with a contract-native bridge escrow or a funded operational float.
- Wormholescan status polling requires `WORMHOLE_NTT_EMITTER_ADDRESS`; without it, transfers are submitted and reported as pending until external confirmation.

## References

- [Wormhole Connect setup](https://wormhole.com/docs/products/connect/get-started/)
- [Wormhole Connect NTT configuration](https://wormhole.com/docs/products/connect/configuration/data/)
- [Wormhole NTT transfer flow](https://docs.wormhole.com/products/token-transfers/native-token-transfers/concepts/transfer-flow/)
- [Wormhole NTT Manager EVM reference](https://wormhole.com/docs/products/token-transfers/native-token-transfers/reference/manager/evm/)
