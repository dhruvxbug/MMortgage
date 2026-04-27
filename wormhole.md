[PASTE MASTER CONTEXT ABOVE FIRST]

You are a blockchain integration engineer with expertise in Wormhole's 
cross-chain infrastructure. Implement the Wormhole NTT integration for 
MezoMortgage so that property sellers on Ethereum or Base can receive 
MUSD installments directly, without the seller needing to bridge manually.

CONTEXT:
  - Mezo already uses Wormhole NTT for MUSD cross-chain transfers
  - NTT contract deployed on Mezo testnet (see mezo-org/ntt-bridge-mezo-testnet)
  - Wormhole Connect is available as an npm package for UI embedding
  - The keeper bot triggers cross-chain transfers when releasing installments

DELIVER THESE FILES:

1. frontend/components/WormholeConnectWidget.tsx
   - Embed Wormhole Connect widget for manual user bridging (if needed)
   - Configure: source chain = Mezo, destination = Ethereum/Base
   - Token: MUSD only
   - Style to match MezoMortgage dark theme
   - Show only when user has cross-chain escrow active

2. frontend/components/CrossChainBadge.tsx
   - Small badge component shown on cross-chain escrow cards
   - Shows: "Wormhole NTT" label + Ethereum/Base chain icon
   - Tooltip: "Installments bridge automatically via Wormhole Native Token 
     Transfer. No action needed."

3. keeper/lib/wormhole.ts
   - Function: bridgeMUSDToEthereum(amount: bigint, recipientAddress: string)
   - Uses Wormhole NTT SDK to initiate transfer from Mezo → Ethereum
   - Polls for VAA (Verified Action Approval) confirmation
   - Returns: { txHash, wormholeSequence, estimatedDeliveryTime }
   - Function: getTransferStatus(sequence: number): 'pending' | 'completed'
   - Error handling: if bridge fails, log error and queue for retry

4. contracts/src/interfaces/IWormholeNTT.sol
   - Minimal interface for the Wormhole NTT Manager contract
   - Functions: transfer(amount, recipientChain, recipient), 
     quoteDeliveryPrice(targetChain)

5. Update EscrowController.sol (additions only, output just the diff/additions):
   - Add isCrossChain bool + destinationChainId uint16 + destinationAddress 
     bytes32 to the Escrow struct
   - Add function setCrossChainSeller(escrowId, chainId, wormholeAddress)
   - In releaseInstallment(): if isCrossChain, emit CrossChainRelease event 
     with chain + amount (keeper bot picks this up and triggers Wormhole)

6. README-wormhole.md
   - How the cross-chain flow works step by step
   - How to get testnet MUSD on Ethereum via Portal Bridge
   - Known limitations (finality time ~15min for Ethereum)

Output all files. For the Wormhole SDK calls, reference the official 
@wormhole-foundation/sdk package patterns.
