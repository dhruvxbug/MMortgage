[PASTE MASTER CONTEXT ABOVE FIRST]

You are a senior Node.js/TypeScript engineer specializing in blockchain 
automation. Build the MezoMortgage keeper bot — an off-chain service that 
automates yield harvesting, installment releases, and liquidation health 
monitoring.

TECH STACK:
  - Node.js 20 + TypeScript
  - ethers.js v6 (for contract calls + signing)
  - node-cron (for scheduling)
  - dotenv (for env vars)
  - Spectrum Nodes for all RPC (HTTP) and real-time events (WebSocket)

DELIVER THESE FILES:

1. keeper/index.ts
   - Entry point: initializes provider, signer, starts all cron jobs, 
     starts WebSocket listener
   - Graceful shutdown on SIGINT/SIGTERM

2. keeper/lib/provider.ts
   - HTTP JsonRpcProvider using SPECTRUM_NODES_HTTP_URL env var
   - WebSocketProvider using SPECTRUM_NODES_WS_URL env var
   - Auto-reconnect logic for WebSocket (exponential backoff, max 5 retries)
   - Export both providers

3. keeper/lib/contracts.ts
   - Initialize ethers Contract instances for all 6 contracts
   - Import ABIs from shared JSON files
   - Use a Wallet signer from KEEPER_PRIVATE_KEY env var
   - Export typed contract objects

4. keeper/tasks/healthCheck.ts
   - Cron: every hour ("0 * * * *")
   - For each open mortgage position (enumerate from MortgageVault events):
     * Call LiquidationBuffer.checkHealth(positionId)
     * If ratio < 140%: call triggerTopUp()
     * If ratio < 130%: log CRITICAL alert + call partialRepay()
   - Log all results with timestamp
   - Error handling: catch and log, never crash the process

5. keeper/tasks/harvestYield.ts
   - Cron: every day at 02:00 UTC ("0 2 * * *")
   - Call YieldRouter.harvestAndRoute() for each active position
   - Log: position ID, yield harvested (MUSD), amount routed to escrow
   - Retry once on failure with 30s delay

6. keeper/tasks/releaseInstallment.ts
   - Cron: every day at 03:00 UTC ("0 3 * * *")
   - Query EscrowController for all escrows with installmentDue <= now
   - Call releaseInstallment(escrowId) for each due escrow
   - If seller is cross-chain (Ethereum/Base): trigger Wormhole NTT transfer 
     using wormhole-sdk before calling release
   - Log: escrow ID, amount released, destination chain, tx hash

7. keeper/tasks/priceMonitor.ts
   - WebSocket subscription to Mezo BTC oracle PriceUpdated event
   - On each price update: recalculate all position collateral ratios in memory
   - If any ratio drops below ALERT_THRESHOLD (default 145%):
     * Immediately run healthCheck for that position (don't wait for cron)
   - Uses WebSocketProvider from Spectrum Nodes

8. keeper/.env.example
   SPECTRUM_NODES_HTTP_URL=https://mezo-testnet.spectrumnodes.com
   SPECTRUM_NODES_WS_URL=wss://mezo-testnet.spectrumnodes.com/ws
   KEEPER_PRIVATE_KEY=0x...
   MORTGAGE_VAULT_ADDRESS=0x...
   ESCROW_CONTROLLER_ADDRESS=0x...
   YIELD_ROUTER_ADDRESS=0x...
   LIQUIDATION_BUFFER_ADDRESS=0x...
   ALERT_THRESHOLD=145
   LOG_LEVEL=info

9. keeper/package.json
   - With all dependencies + build/start scripts
   - "start": "node dist/index.js"
   - "build": "tsc"
   - "dev": "ts-node keeper/index.ts"

10. Dockerfile
    - Node 20 Alpine base
    - Production-ready (npm ci, build, non-root user)
    - Ready for Railway or Render deploy

All TypeScript, strict mode, proper error handling. Never let the keeper 
crash — wrap everything in try/catch with process-level uncaughtException 
handler. Output each file in a labeled code block.
