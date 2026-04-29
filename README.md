# MMortgage 

> **Your Bitcoin pays for your house. No bank. No selling.**

MezoMortgage is a Bitcoin-backed, self-repaying mortgage protocol built on [Mezo](https://mezo.org). Deposit BTC as collateral, borrow MUSD at 1%, earn 4–8% APY in Mezo's savings vault, and let the yield automatically service your property payments — entirely on-chain.

---

## How it works

<img width="701" height="513" alt="image" src="https://github.com/user-attachments/assets/dcfcccbf-7dd2-4f02-b972-aeb1e18a33d4" />
<br>

```
Deposit BTC → Borrow MUSD (1%) → Earn yield (4–8%) → Yield pays property installments
```

1. You lock BTC as collateral on Mezo and borrow MUSD at a fixed 1% annual rate
2. That MUSD gets deposited into Mezo's MUSD Savings Vault, earning 4–8% APY
3. The yield surplus (earnings minus borrow cost) is routed to an on-chain escrow
4. The escrow releases monthly installments to your property seller automatically
5. Your BTC stays locked, appreciates, and you never sell a satoshi

**Example:** 0.5 BTC → borrow 22,500 MUSD → earns ~$1,350/yr → costs $225/yr in interest → $93.75/month net routed to escrow → pays off a $11,250 property in 10 years.

---

## Smart contracts

| Contract | Purpose |
|---|---|
| `MortgageVault.sol` | CDP wrapper — accepts BTC collateral, mints MUSD, opens positions |
| `EscrowController.sol` | Holds MUSD for property purchase, releases installments on schedule |
| `YieldRouter.sol` | Deposits MUSD to vault, harvests yield, routes surplus to escrow |
| `LiquidationBuffer.sol` | 3-tier health monitor — warns at 140% LTV, auto-tops up at 130% |
| `MortgageNFT.sol` | ERC-721 representing each position — transferable, on-chain SVG metadata |
| `VeBooster.sol` | veMEZO lockers get 0.5% borrow rate instead of 1% |

---

## Tech stack

**Contracts** — Solidity ^0.8.24, Foundry, OpenZeppelin v5

**Frontend** — Next.js 14 (App Router), Mezo Passport SDK, wagmi v2, viem, Tailwind CSS

**Backend** — Node.js 20 keeper bot, ethers.js v6, node-cron

**Infrastructure** — Spectrum Nodes (RPC + WebSocket), Wormhole NTT (cross-chain MUSD)

---

## Project structure

```
mezomortgage/
├── contracts/          # Foundry project
│   ├── src/            # 6 Solidity contracts
│   ├── test/           # Unit + integration tests
│   └── script/         # Deployment scripts
├── frontend/           # Next.js 14 app
│   ├── app/            # Pages: /, /open, /dashboard
│   ├── components/     # UI components
│   └── hooks/          # wagmi contract hooks
├── keeper/             # Node.js automation bot
│   └── tasks/          # healthCheck, harvestYield, releaseInstallment
└── README.md
```

---

## Getting started

**Prerequisites:** Node.js 20+, Foundry, Git

```bash
# Clone
git clone https://github.com/your-username/mezomortgage
cd mezomortgage

# Contracts
cd contracts
forge install
forge build
forge test

# Frontend
cd ../frontend
npm install
cp .env.example .env.local
npm run dev

# Keeper bot
cd ../keeper
npm install
cp .env.example .env
npm run dev
```

### Environment variables

```bash
# keeper/.env
SPECTRUM_NODES_HTTP_URL=https://mezo-testnet.spectrumnodes.com
SPECTRUM_NODES_WS_URL=wss://mezo-testnet.spectrumnodes.com/ws
KEEPER_PRIVATE_KEY=0x...
MORTGAGE_VAULT_ADDRESS=0x...
ESCROW_CONTROLLER_ADDRESS=0x...
YIELD_ROUTER_ADDRESS=0x...
LIQUIDATION_BUFFER_ADDRESS=0x...
```

---

## To Be Deployed contracts (Mezo testnet) - under basic audit and testing 

| Contract | Address |
|---|---|
| MortgageVault | `0x...` |
| EscrowController | `0x...` |
| YieldRouter | `0x...` |
| LiquidationBuffer | `0x...` |
| MortgageNFT | `0x...` |
| VeBooster | `0x...` |

---

## Sponsor integrations

**Spectrum Nodes** — All RPC and WebSocket calls route through Spectrum's Mezo testnet endpoint. The keeper bot uses the WebSocket feed for real-time BTC price monitoring, triggering immediate health checks on sharp price drops rather than waiting for the hourly cron.

**Wormhole NTT** — Sellers on Ethereum or Base receive MUSD installments directly via Wormhole's Native Token Transfer protocol. The keeper bot handles the bridge call programmatically — cross-chain delivery is completely invisible to the end user.


---

## License

MIT
