[PASTE MASTER CONTEXT ABOVE FIRST]

Frontend: Wallet Connection + Layout Shell

You are a senior React/Next.js engineer. Build the foundational frontend 
shell for MezoMortgage using Next.js 14 App Router.

TASK: Create the wallet connection infrastructure and app layout.

FILES TO PRODUCE:
1. frontend/lib/wagmi.ts
   - Configure Mezo Passport using getConfig() from @mezo-org/passport
   - Include Mezo testnet chain config (chain ID, RPC via Spectrum Nodes)
   - Support both Bitcoin wallets (Xverse, Unisat) and EVM wallets (MetaMask)
   - Export: config, chains array

2. frontend/lib/contracts.ts
   - Export all 6 contract addresses (use placeholder 0x... for testnet)
   - Export all 6 ABIs (as const arrays with the key functions we use)
   - Export typed contract instances using viem's getContract

3. frontend/app/providers.tsx
   - WagmiProvider wrapping the app
   - RainbowKitProvider with Mezo Passport config
   - QueryClientProvider from @tanstack/react-query
   - Mark as 'use client'

4. frontend/app/layout.tsx
   - Root layout wrapping with <Providers>
   - Tailwind font setup
   - Metadata: title "MezoMortgage", description, og tags

5. frontend/components/Navbar.tsx
   - Logo: "MezoMortgage" wordmark with small Bitcoin icon (SVG inline)
   - Nav links: Home, Dashboard, Open Mortgage, How it works
   - Right side: ConnectButton from RainbowKit (styled to match brand)
   - Mobile: hamburger menu
   - Show connected wallet address (truncated) when connected
   - Fully responsive

6. frontend/components/WalletGate.tsx
   - HOC/wrapper component: if wallet not connected, show a 
     "Connect your Bitcoin wallet to continue" prompt with ConnectButton
   - If connected, render children
   - Use useAccount() from wagmi

STYLE GUIDE:
- Tailwind only, no CSS files
- Color palette: bg-zinc-950 (dark bg), text-white, accent #F7931A (Bitcoin 
  orange) for CTAs, zinc-800 for cards
- Font: Inter or system-ui
- Rounded-xl for cards, rounded-lg for buttons
- No gradients, flat design
- All components must be TypeScript with explicit prop types

Output each file in a separate code block with filename as the label.

 Frontend: Mortgage Calculator Page (Landing)

[PASTE MASTER CONTEXT ABOVE FIRST]

You are a senior React engineer. Build the MezoMortgage landing page 
with an interactive mortgage calculator.

FILE: frontend/app/page.tsx (and any sub-components it needs)

THE PAGE HAS 3 SECTIONS:

SECTION 1 — Hero
  - Headline: "Your Bitcoin pays for your house."
  - Subheading: "Borrow against BTC at 1%. Earn 4–8% yield. Watch yield 
    automatically make your property payments. Keep your Bitcoin forever."
  - Two CTAs: "Open a Mortgage" (primary, orange) + "How it works" (ghost)
  - Background: dark (zinc-950), subtle Bitcoin grid pattern or just clean

SECTION 2 — Interactive Mortgage Calculator
  This is the core of the page. Build a real-time calculator with:

  INPUTS (sliders + number inputs, all linked):
  - BTC Holdings: slider 0.1 → 5 BTC, step 0.01
  - BTC Price: input, default $90,000 (user can update)
  - Loan-to-Value (LTV): slider 30% → 70%, default 50%
  - Vault APY: slider 3% → 12%, default 6%

  OUTPUTS (auto-calculated, update in real time):
  - MUSD Borrowed = BTC × Price × LTV
  - Annual Yield = MUSD × APY
  - Borrow Cost = MUSD × 1%
  - Net Monthly Payment = (Annual Yield - Borrow Cost) / 12
  - Property Budget = Net Monthly Payment × 12 × 10 (10yr payoff)
  - Effective BTC Yield APY (net) = (Annual Yield - Borrow Cost) / (BTC × Price)
  - Collateral Ratio = (BTC × Price) / MUSD Borrowed × 100

  DISPLAY:
  - Large stat cards for the 4 key numbers: MUSD Borrowed, Monthly Payment,
    Property Budget, Collateral Ratio
  - Collateral ratio card: green if >200%, yellow if 150–200%, red if <150%
  - Small note: "At current settings, your BTC collateral is X× 
    overcollateralized. Liquidation triggers at 130%."
  - CTA below calculator: "Open this mortgage →" — links to /open

SECTION 3 — How It Works (3-step explainer)
  Step 1: Deposit BTC → Mint MUSD at 1%
  Step 2: MUSD earns yield in Mezo vault (6%+ APY)  
  Step 3: Yield auto-pays your property installments

  Simple icon + title + 2-line description layout. Horizontal on desktop, 
  vertical on mobile.

TECHNICAL NOTES:
- All calculations in a useMemo or useCallback, no external lib needed
- All numbers formatted with toLocaleString() for $ values, toFixed(2) for %
- Calculator state in useState, no routing needed for this page
- 'use client' directive required
- Fully responsive (mobile-first Tailwind)
- TypeScript throughout

Output the complete file(s) needed.

Frontend: Open Mortgage Flow

[PASTE MASTER CONTEXT ABOVE FIRST]

You are a senior React/Next.js engineer. Build the "Open Mortgage" 
multi-step flow page.

FILE: frontend/app/open/page.tsx + frontend/app/open/components/

This is a 4-step wizard. Show a step indicator at the top (Step 1 of 4).
Each step validates before allowing Next. Build this as a single page 
component with step state managed locally.

STEP 1 — Configure Position
  Fields:
  - BTC Collateral Amount (input, in BTC, validates > 0.1)
  - Loan-to-Value % (slider 30–70%, default 50%)
  - Auto-calculated: MUSD to borrow, collateral ratio
  - Show warning card if collateral ratio < 160%
  Next button: disabled until amount > 0.1 BTC and ratio > 150%

STEP 2 — Set Up Escrow
  Fields:
  - Seller wallet address (text input, validates as Ethereum/Mezo address)
  - Cross-chain toggle: "Seller is on Ethereum/Base?" 
    → if yes, show Wormhole info banner: "Installments will be bridged 
    via Wormhole NTT automatically"
  - Payment frequency: Monthly / Quarterly (radio)
  - First payment date: date picker (min: 30 days from today)
  - Total property price (MUSD): input
  - Auto-calculated: number of installments, installment amount

STEP 3 — Review & Confirm
  Summary card showing ALL details:
  - BTC locked, MUSD borrowed, LTV %, collateral ratio
  - Seller address, payment schedule, installment size
  - Cross-chain: yes/no + destination chain if yes
  - Estimated vault APY range, projected monthly yield, % of installment covered
  - Fees: Mezo borrow fee (1% annual), network gas (BTC)
  - Checkbox: "I understand my BTC will be locked until mortgage is closed"
  - "Open Mortgage" button (primary, full width)

STEP 4 — Success
  After successful transaction:
  - Large checkmark animation (CSS only, no framer-motion)
  - "Mortgage Opened!" heading
  - Show transaction hash as a link to Mezo block explorer
  - Show NFT minted: "Your MortgageNFT #[id] has been minted"
  - Two CTAs: "View Dashboard" + "Share on Twitter" 
    (Twitter/X share pre-fills: "Just opened a Bitcoin mortgage with 
    @MezoMortgage — my BTC is paying for real estate without me selling 
    a single satoshi. #Bitcoin #BTCfi")

TRANSACTION LOGIC (use wagmi hooks):
  - useWriteContract to call MortgageVault.openMortgage()
  - useWaitForTransactionReceipt to detect confirmation
  - Show pending spinner during tx confirmation
  - Handle error state: show error message + retry button
  - All contract addresses/ABIs imported from frontend/lib/contracts.ts

TypeScript, Tailwind, fully responsive. Output all files needed.

Frontend: Position Dashboard
[PASTE MASTER CONTEXT ABOVE FIRST]

You are a senior React/Next.js engineer. Build the MezoMortgage 
position dashboard at /dashboard.

FILE: frontend/app/dashboard/page.tsx + subcomponents

This page shows the user's active mortgage position(s). Gate with 
WalletGate component (redirect to connect if not connected).

LAYOUT:
  Header row: "My Mortgages" + "Open New Mortgage" button (top right)
  
  If no mortgages: empty state card — "No active mortgages. Open your 
  first Bitcoin mortgage." with CTA button.

  If has mortgages: show one PositionCard per MortgageNFT owned.

POSITION CARD — for each mortgage NFT:
  Top section (summary stats in a 4-column grid):
  - BTC Locked:         e.g. 0.50 BTC ($45,000)
  - MUSD Borrowed:      e.g. 22,500 MUSD
  - Collateral Ratio:   e.g. 200% (color coded: green/yellow/red)
  - % Mortgage Paid:    e.g. 12.4% (progress bar)

  Middle section (yield + payment info):
  - Vault APY:          6.2% (current)
  - Monthly Yield:      $112.50
  - Monthly Payment:    $93.75
  - Yield Surplus:      +$18.75 (accumulating in buffer)
  - Next Payment Due:   May 15, 2026 (countdown: "in 21 days")

  Bottom section (escrow details):
  - Seller address (truncated + copy button)
  - Chain: Mezo / Ethereum (with Wormhole badge if cross-chain)
  - Total property price: 22,500 MUSD
  - Installments paid: 3 of 120
  - Escrow balance: 187.50 MUSD (pre-funded)

  Action buttons (right side or bottom):
  - "Add Collateral" → opens modal with useWriteContract
  - "Repay Early" → opens modal
  - "View NFT" → links to block explorer token page
  - "Close Position" → confirmation modal (warns this repays all debt)

HEALTH ALERT BANNER:
  If any position has collateral ratio < 160%, show a yellow warning 
  banner at top: "⚠ Position #X is approaching minimum collateral ratio. 
  Consider adding BTC collateral." with "Add Collateral" CTA.
  If ratio < 135%, show red: "🔴 Position #X is near liquidation."

DATA FETCHING:
  - useReadContract to call MortgageNFT.balanceOf(address) + tokenOfOwnerByIndex
  - useReadContract for each tokenId to get position data from MortgageVault
  - useReadContract for yield data from YieldRouter
  - Poll every 30s using refetchInterval in useQuery
  - Loading skeletons while data fetches (Tailwind animate-pulse)

TypeScript, Tailwind. Mobile responsive. Output all files needed.
