[PASTE MASTER CONTEXT ABOVE FIRST]

You are a senior Solidity engineer. Using the project context above, write 
production-quality Solidity code for all 6 MezoMortgage smart contracts.

REQUIREMENTS:
- Solidity version: ^0.8.24
- Use Foundry as the dev framework (forge build, forge test)
- Use OpenZeppelin Contracts v5 for ERC-721, ReentrancyGuard, Ownable, 
  Pausable where appropriate
- Every public/external function must have NatSpec comments (@notice, 
  @param, @return)
- Apply reentrancy guards on all state-changing external functions
- Use custom errors instead of require strings (gas efficient)
- Emit events on every state change (for frontend + subgraph indexing)

DELIVER IN THIS ORDER:
1. MortgageVault.sol — full implementation
2. EscrowController.sol — full implementation
3. YieldRouter.sol — full implementation
4. LiquidationBuffer.sol — full implementation
5. MortgageNFT.sol — full ERC-721 implementation with on-chain SVG tokenURI
6. VeBooster.sol — full implementation
7. script/Deploy.s.sol — Foundry deployment script for Mezo testnet
8. test/MortgageVault.t.sol — comprehensive unit tests (happy path + edge cases)
9. foundry.toml — with Mezo testnet RPC configured under [rpc_endpoints]

For the Mezo BorrowManager and MUSD Savings Vault interfaces, write 
minimal interface files (IBorrowManager.sol, IMUSDVault.sol) with only 
the functions we call. Do not assume you have the full Mezo source — 
write clean interfaces based on the function signatures described in context.

For tokenURI in MortgageNFT.sol, generate a base64-encoded SVG showing: 
mortgage ID, collateral amount, MUSD borrowed, % paid off, and a simple 
progress bar. This runs fully on-chain.

Security checklist to implement:
- [ ] Reentrancy guard on openMortgage, repayMortgage, releaseInstallment
- [ ] Oracle freshness check (reject stale price if >1hr old)
- [ ] Min collateral ratio enforced: 150% at open, 130% buffer trigger
- [ ] Only authorized keeper address can call harvestAndRoute
- [ ] Escrow can only be released to pre-registered seller address
- [ ] pausable by owner for emergency

Output each file in a separate fenced code block labeled with the filename.
