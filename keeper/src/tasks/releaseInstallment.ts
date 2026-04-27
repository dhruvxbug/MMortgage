import cron from "node-cron";
import { ethers } from "ethers";
import { mortgageVault, escrowController } from "../lib/contracts.js";
import { bridgeMUSDToChain } from "../lib/wormhole.js";
import { log } from "../lib/logger.js";

function isSupportedCrossChainDestination(chain: string): boolean {
  const normalized = chain.toLowerCase();
  return normalized.includes("ethereum") || normalized.includes("base");
}

export async function runReleaseInstallment(): Promise<void> {
  log.info("[ReleaseInstallment] Starting installment release run...");
  const now = BigInt(Math.floor(Date.now() / 1000));

  try {
    // Use MortgageOpened events to get all tokenIds (escrow IDs match tokenIds)
    const filter = mortgageVault.filters["MortgageOpened"]();
    const events = await mortgageVault.queryFilter(filter, 0, "latest");
    const tokenIds = events.map((e) => {
      const parsed = mortgageVault.interface.parseLog({ topics: [...e.topics], data: e.data });
      return parsed?.args[0] as bigint;
    }).filter((id): id is bigint => id !== undefined);

    log.info(`[ReleaseInstallment] Checking ${tokenIds.length} escrow(s).`);

    for (const tokenId of tokenIds) {
      try {
        const schedule = await (escrowController["getSchedule"] as (id: bigint) => Promise<readonly [bigint, bigint, bigint, bigint, bigint, string, boolean, string]>)(tokenId);
        const [nextPaymentDue, installmentAmount, installmentsPaid, totalInstallments, , seller, isCrossChain, destinationChain] = schedule;

        if (installmentsPaid >= totalInstallments) {
          log.debug(`[ReleaseInstallment] Escrow ${tokenId} fully paid.`);
          continue;
        }
        if (nextPaymentDue > now) {
          log.debug(`[ReleaseInstallment] Escrow ${tokenId} not due yet.`);
          continue;
        }

        const amountMUSD = ethers.formatUnits(installmentAmount, 18);
        const destination = isCrossChain ? destinationChain : "Mezo";
        log.info(
          `[ReleaseInstallment] Escrow ${tokenId}: releasing ${amountMUSD} MUSD to ${seller} on ${destination}`,
        );

        if (isCrossChain && isSupportedCrossChainDestination(destinationChain)) {
          const bridge = await bridgeMUSDToChain(installmentAmount, seller, destinationChain);
          log.info(`[ReleaseInstallment] Wormhole bridge initiated. Sequence: ${bridge.wormholeSequence}, ETA: ${bridge.estimatedDeliveryTime}`);
        } else if (isCrossChain) {
          log.warn(
            `[ReleaseInstallment] Escrow ${tokenId}: destination chain '${destinationChain}' is not Ethereum/Base; skipping Wormhole NTT trigger.`,
          );
        }

        const tx = await (escrowController["releaseInstallment"] as (id: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(tokenId);
        await tx.wait();
        log.info(
          `[ReleaseInstallment] Escrow ${tokenId} released: amount=${amountMUSD} MUSD destination=${destination} txHash=${tx.hash}`,
        );
      } catch (err) {
        log.error(`[ReleaseInstallment] Error processing escrow ${tokenId}:`, err);
      }
    }
  } catch (err) {
    log.error("[ReleaseInstallment] Fatal error during release run:", err);
  }
  log.info("[ReleaseInstallment] Run complete.");
}

export function scheduleReleaseInstallment(): cron.ScheduledTask {
  const task = cron.schedule("0 3 * * *", () => {
    void runReleaseInstallment();
  }, {
    timezone: "UTC",
  });
  log.info("[ReleaseInstallment] Scheduled: daily at 03:00 UTC.");
  return task;
}
