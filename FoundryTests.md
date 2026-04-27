[PASTE MASTER CONTEXT ABOVE FIRST]

You are a smart contract security engineer. Write a comprehensive Foundry 
test suite for MezoMortgage.

DELIVER THESE TEST FILES:

1. test/MortgageVault.t.sol
   Happy path:
   - testOpenMortgage_success()
   - testAddCollateral_success()
   - testRepayMortgage_partial()
   - testCloseMortgage_success()
   - testMortgageNFTMintedOnOpen()
   Edge cases + security:
   - testOpenMortgage_revertsIfCollateralTooLow()
   - testOpenMortgage_revertsIfLTVTooHigh()
   - testReentrancy_openMortgage() — attempt reentrancy, expect revert
   - testUnauthorized_cannotCloseOtherUsersMortgage()
   - testOracleStale_revertsIfPriceOld()

2. test/EscrowController.t.sol
   Happy path:
   - testCreateEscrow_success()
   - testReleaseInstallment_onSchedule()
   - testReleaseInstallment_byCrossChain()
   Edge cases:
   - testReleaseInstallment_revertsIfNotDue()
   - testReleaseInstallment_revertsIfCallerNotYieldRouter()
   - testEmergencyWithdraw_onlyOwner()
   - testCreateEscrow_revertsIfInvalidSeller()

3. test/YieldRouter.t.sol
   - testDepositToVault_success()
   - testHarvestAndRoute_routesCorrectAmount()
   - testHarvestAndRoute_revertsIfCallerNotKeeper()
   - testGetAccruedYield_returnsCorrectValue()
   - testHarvestAndRoute_handlesZeroYield()

4. test/LiquidationBuffer.t.sol
   - testCheckHealth_healthyPosition()
   - testCheckHealth_triggersTopUpAt140()
   - testCheckHealth_triggersPartialRepayAt130()
   - testSetHealthThreshold_onlyOwner()
   - fuzz: testFuzz_collateralRatio(uint256 btcPrice, uint256 collateral)

5. test/MortgageNFT.t.sol
   - testMint_onlyVault()
   - testTransferPosition_success()
   - testTokenURI_returnsValidBase64SVG()
   - testTokenURI_containsMortgageData()

6. test/VeBooster.t.sol
   - testLockVeMEZO_appliesDiscount()
   - testGetEffectiveRate_withoutLock_returns100bps()
   - testGetEffectiveRate_withLock_returns50bps()
   - testUnlockAfterExpiry_revertsIfNotExpired()

7. test/integration/MortgageFlow.t.sol
   Full end-to-end integration test:
   - Fork Mezo testnet
   - Open mortgage → deposit to vault → simulate yield accrual → harvest 
     → release installment → verify seller balance increased
   - Uses vm.prank, vm.deal, vm.warp for time manipulation
   - Validates all state transitions

8. test/mocks/
   - MockBorrowManager.sol — returns configurable Trove data
   - MockMUSDVault.sol — simulates yield accrual
   - MockBTCOracle.sol — returns configurable BTC price, simulates staleness

Use Foundry's standard Test.sol. Use vm.expectRevert with custom errors. 
Use invariant testing for collateral ratio (it must NEVER go below 100%). 
Add gas snapshots for openMortgage and harvestAndRoute functions.
Output each file in a labeled code block.
