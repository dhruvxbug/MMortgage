SYSTEM CONTEXT — READ FULLY BEFORE PROCEEDING

You are working on MezoMortgage, a Bitcoin-backed self-repaying mortgage 
protocol built for the Mezo Hackathon (hosted by Encode Club). This is a 
4-week hackathon with a $10,000 prize pool per track. The project targets 
three prize tracks simultaneously.

════════════════════════════════════════
PROJECT: MezoMortgage
════════════════════════════════════════

ELEVATOR PITCH:
  MezoMortgage lets Bitcoin holders finance real-world property purchases 
  without selling their BTC. Users deposit BTC as collateral, borrow MUSD 
  (a Bitcoin-backed stablecoin) at 1% fixed rate, deposit MUSD into a yield 
  vault earning 4–8% APY, and that yield surplus automatically services 
  monthly property installment payments via an on-chain escrow contract.
  Bitcoin pays for your house. You never sell it.

CORE MECHANISM (in order):
  1. User deposits BTC collateral on Mezo network
  2. Borrows MUSD (Bitcoin-backed stablecoin) at 1% fixed annual rate
  3. MUSD deposited into Mezo MUSD Savings Vault (earns 4–8% APY)
  4. Net yield (earnings minus 1% borrow cost) auto-routed to EscrowController
  5. EscrowController releases monthly installments to property seller
  6. User's BTC stays locked, appreciates, never sold
  7. Over time, yield fully repays the property purchase

PRIZE TRACKS BEING TARGETED:
  - PRIMARY:   "Bank on Bitcoin" track ($10,000) — Bitcoin-native financial 
               system using MUSD for savings, borrowing, spending
  - SECONDARY: "Supernormal dApps – MUSD Track" ($10,000) — consumer app 
               where MUSD is the primary payment currency
  - BONUS:     "MEZO Utilization" track — veMEZO holders get 0.5% rate 
               discount via VeBooster contract (addresses MEZO token utility)

JUDGING CRITERIA WEIGHTS:
  - Mezo Integration:        30% (MUSD + Mezo Passport — most important)
  - Technical Implementation: 30% (code quality, security, architecture)
  - Business Viability:       20% (market fit, real-world utility)
  - User Experience:          10% (simplicity, clarity)
  - Presentation Quality:     10% (demo, pitch)

════════════════════════════════════════
BLOCKCHAIN / NETWORK
════════════════════════════════════════

  Network:       Mezo (EVM-compatible Bitcoin L2)
  Chain ID:      Mezo Testnet
  Gas token:     BTC (native gas on Mezo)
  Core token:    MUSD — Bitcoin-backed stablecoin, USD-pegged
  Bridge:        Wormhole NTT (Native Token Transfer) for cross-chain MUSD
  RPC Provider:  Spectrum Nodes (all RPC + WebSocket calls MUST use this)
  Wallet:        Mezo Passport SDK (built on RainbowKit — mandatory integration)

KEY EXTERNAL CONTRACTS (Mezo ecosystem):
  - BorrowManager:    Mezo's CDP engine (users open Troves, mint MUSD)
  - MUSD Savings Vault: deposits MUSD, earns yield automatically
  - Mezo Swap:        AMM DEX for BTC/MUSD/USDC swaps
  - BTC Price Oracle: on-chain oracle for real-time BTC/USD price
  - veMEZO contract:  governance token lock for voting power + rate discounts

════════════════════════════════════════
OUR SMART CONTRACTS (6 total, Solidity ^0.8.24)
════════════════════════════════════════

  1. MortgageVault.sol
     - Purpose: Core CDP wrapper and position manager
     - Accepts BTC collateral, opens a Trove in Mezo's BorrowManager,
       mints MUSD, mints a MortgageNFT to represent the position
     - Key functions: openMortgage(), addCollateral(), repayMortgage(),
       closeMortgage(), getCollateralRatio()
     - Security: reentrancy guard, collateral ratio checks (min 150% LTV)

  2. EscrowController.sol
     - Purpose: Holds MUSD earmarked for property purchase, releases 
       installments on a monthly schedule to seller's address
     - Seller can be on Mezo OR on Ethereum/Base (via Wormhole NTT)
     - Key functions: createEscrow(seller, amount, schedule), 
       releaseInstallment(), emergencyWithdraw(), getSchedule()
     - Note: only YieldRouter can call releaseInstallment()

  3. YieldRouter.sol
     - Purpose: Deposits borrowed MUSD into Mezo savings vault, harvests 
       accrued yield, routes net yield to EscrowController automatically
     - Key functions: depositToVault(), harvestAndRoute(), 
       getAccruedYield(), getPendingInstallment()
     - Called by keeper bot on a daily/weekly cron schedule

  4. LiquidationBuffer.sol
     - Purpose: Health monitor and safety net. If BTC collateral drops and 
       LTV ratio falls below 130%, it triggers auto-topup from a buffer 
       reserve or executes partial MUSD repayment to restore health
     - Key functions: checkHealth(vaultId), triggerTopUp(), 
       partialRepay(), setHealthThreshold()
     - Reads price from Mezo's on-chain BTC oracle

  5. MortgageNFT.sol (ERC-721)
     - Purpose: Each mortgage position is tokenized as an NFT. The NFT 
       encodes loan metadata in tokenURI (collateral amount, borrowed MUSD,
       monthly payment, % paid off). Positions are transferable — secondary 
       market is possible.
     - Key functions: mint(to, mortgageData), tokenURI(tokenId), 
       transferPosition(tokenId, newOwner)
     - Inherits: OpenZeppelin ERC721, ERC721URIStorage

  6. VeBooster.sol
     - Purpose: Lets users lock veMEZO tokens to earn a rate discount. 
       Active veMEZO lockers pay 0.5% instead of 1% borrow rate.
       Addresses MEZO Utilization prize track.
     - Key functions: lockVeMEZO(amount, duration), applyDiscount(user),
       unlockAfterExpiry(), getEffectiveRate(user)

════════════════════════════════════════
FRONTEND STACK
════════════════════════════════════════

  Framework:   Next.js 14 (App Router)
  Wallet:      @mezo-org/passport + @rainbow-me/rainbowkit
  Web3 hooks:  wagmi v2 + viem 2.x
  Data:        @tanstack/react-query
  Styling:     Tailwind CSS
  Deploy:      Vercel

  Installation command:
    npm install @mezo-org/passport @rainbow-me/rainbowkit wagmi viem@2.x 
                @tanstack/react-query

  Passport setup (required pattern):
    import { getConfig } from '@mezo-org/passport'
    // Use getConfig() instead of createDefaultConfig from RainbowKit
    // This enables Bitcoin wallet support (Xverse, Unisat) + EVM wallets

════════════════════════════════════════
BACKEND / KEEPER BOT STACK
════════════════════════════════════════

  Runtime:     Node.js 20
  Web3:        ethers.js v6
  RPC:         Spectrum Nodes (HTTP + WebSocket endpoints for Mezo testnet)
  Scheduling:  node-cron (daily yield harvest, hourly health check)
  Deploy:      Railway or Render

  Keeper bot responsibilities:
    - Every hour:  call LiquidationBuffer.checkHealth() for all open positions
    - Every day:   call YieldRouter.harvestAndRoute() to move yield to escrow
    - Every month: call EscrowController.releaseInstallment() on due dates
    - Real-time:   WebSocket subscription to BTC price oracle events 
                   (Spectrum Nodes WS endpoint)

════════════════════════════════════════
CROSS-CHAIN (WORMHOLE)
════════════════════════════════════════

  Protocol:    Wormhole NTT (Native Token Transfer)
  Use case:    Seller receives MUSD installments on Ethereum or Base 
               instead of Mezo — no bridging friction for payees
  Integration: Wormhole Connect (3-line embed in frontend)
               OR NTT SDK for backend-triggered transfers
  Key fact:    Mezo already uses Wormhole NTT for MUSD cross-chain. 
               MUSD is live on Ethereum mainnet via this integration.
  Repo ref:    github.com/mezo-org/ntt-bridge-mezo-testnet

════════════════════════════════════════
FOLDER STRUCTURE
════════════════════════════════════════

  mezomortgage/
  ├── contracts/              # Solidity contracts (Foundry project)
  │   ├── src/
  │   │   ├── MortgageVault.sol
  │   │   ├── EscrowController.sol
  │   │   ├── YieldRouter.sol
  │   │   ├── LiquidationBuffer.sol
  │   │   ├── MortgageNFT.sol
  │   │   └── VeBooster.sol
  │   ├── test/
  │   │   └── *.t.sol
  │   ├── script/
  │   │   └── Deploy.s.sol
  │   └── foundry.toml
  ├── frontend/               # Next.js 14 app
  │   ├── app/
  │   │   ├── page.tsx        # Landing / mortgage calculator
  │   │   ├── dashboard/      # Position dashboard
  │   │   ├── open/           # Open new mortgage flow
  │   │   └── escrow/         # Escrow + payment schedule
  │   ├── components/
  │   ├── hooks/              # wagmi read/write hooks
  │   ├── lib/
  │   │   ├── wagmi.ts        # Mezo Passport config
  │   │   └── contracts.ts    # ABI + address constants
  │   └── package.json
  ├── keeper/                 # Node.js automation bot
  │   ├── index.ts
  │   ├── tasks/
  │   │   ├── healthCheck.ts
  │   │   ├── harvestYield.ts
  │   │   └── releaseInstallment.ts
  │   └── package.json
  └── README.md

════════════════════════════════════════
DEMO SCENARIO (use this in all UIs)
════════════════════════════════════════

  User:      Has 0.5 BTC (~$45,000 at $90,000/BTC)
  Borrows:   22,500 MUSD (50% LTV — safe)
  Vault APY: 6%
  Earnings:  $1,350/year = $112.50/month
  Borrow cost: 1% on 22,500 = $225/year = $18.75/month
  Net yield: $93.75/month routed to escrow
  Property:  $11,250 purchase agreement → paid off in 10 years via yield
  Result:    User still owns 0.5 BTC + property, never sold a satoshi

════════════════════════════════════════
TONE / BRAND
════════════════════════════════════════

  - Name: MezoMortgage
  - Tagline: "Your Bitcoin pays for your house."
  - Secondary: "Bank-free. Sell-free. Debt that pays itself."
  - Color palette: Bitcoin orange (#F7931A) + Mezo red-pink + dark neutrals
  - Voice: confident, clear, anti-bank, pro-sovereignty
  - Target user: Bitcoin holder with 0.3+ BTC who wants real-world utility 
    without selling

END OF MASTER CONTEXT