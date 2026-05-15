import cron from "node-cron";
import { ethers } from "ethers";
import { mortgageVault, yieldRouter } from "../lib/contracts";
import { log } from "../lib/logger";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function harvestPosition(tokenId: bigint): Promise<void> {
  const position = (await mortgageVault["getPosition"](tokenId)) as readonly unknown[];
  const active = position[10] as boolean;
  if (!active) {
    log.debug(`[HarvestYield] Position ${tokenId} inactive, skipping.`);
    return;
  }

  const yieldAmount = await (yieldRouter["getAccruedYield"] as (id: bigint) => Promise<bigint>)(tokenId);
  const yieldMUSD = ethers.formatUnits(yieldAmount, 18);
  log.info(`[HarvestYield] Position ${tokenId}: yield harvested = ${yieldMUSD} MUSD`);

  const tx = await (yieldRouter["harvestAndRoute"] as (id: bigint) => Promise<{ hash: string; wait: () => Promise<ethers.TransactionReceipt> }>)(tokenId);
  const receipt = await tx.wait();

  let routedToEscrow = 0n;
  for (const eventLog of receipt.logs) {
    try {
      const parsed = yieldRouter.interface.parseLog({
        topics: [...eventLog.topics],
        data: eventLog.data,
      });

      if (parsed?.name === "YieldHarvested") {
        routedToEscrow = parsed.args[2] as bigint;
        break;
      }
    } catch {
      continue;
    }
  }

  log.info(
    `[HarvestYield] Position ${tokenId}: amount routed to escrow = ${ethers.formatUnits(routedToEscrow, 18)} MUSD. TX: ${tx.hash}`,
  );
}

export async function runHarvestYield(): Promise<void> {
  log.info("[HarvestYield] Starting harvest run...");
  try {
    const filter = mortgageVault.filters["MortgageOpened"]();
    const events = await mortgageVault.queryFilter(filter, 0, "latest");
    const tokenIds = events.map((e) => {
      const parsed = mortgageVault.interface.parseLog({ topics: [...e.topics], data: e.data });
      return parsed?.args[0] as bigint;
    }).filter((id): id is bigint => id !== undefined);

    log.info(`[HarvestYield] Processing ${tokenIds.length} position(s).`);

    for (const tokenId of tokenIds) {
      try {
        await harvestPosition(tokenId);
      } catch (firstErr) {
        log.warn(`[HarvestYield] Position ${tokenId} failed. Retrying in 30s...`, firstErr);
        await sleep(30_000);
        try {
          await harvestPosition(tokenId);
        } catch (retryErr) {
          log.error(`[HarvestYield] Position ${tokenId} retry failed:`, retryErr);
        }
      }
    }
  } catch (err) {
    log.error("[HarvestYield] Fatal error during harvest run:", err);
  }
  log.info("[HarvestYield] Run complete.");
}

export function scheduleHarvestYield(): cron.ScheduledTask {
  const task = cron.schedule("0 2 * * *", () => {
    void runHarvestYield();
  }, {
    timezone: "UTC",
  });
  log.info("[HarvestYield] Scheduled: daily at 02:00 UTC.");
  return task;
}
