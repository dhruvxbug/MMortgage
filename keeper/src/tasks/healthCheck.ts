import cron from "node-cron";
import { mortgageVault, liquidationBuffer } from "../lib/contracts";
import { log } from "../lib/logger";

async function getOpenPositionIds(): Promise<bigint[]> {
  const filter = mortgageVault.filters["MortgageOpened"]();
  const events = await mortgageVault.queryFilter(filter, 0, "latest");
  const positionIds = new Set<bigint>();

  for (const event of events) {
    const parsed = mortgageVault.interface.parseLog({
      topics: [...event.topics],
      data: event.data,
    });
    const id = parsed?.args[0] as bigint | undefined;
    if (id !== undefined) {
      positionIds.add(id);
    }
  }

  return [...positionIds];
}

export async function runHealthCheckForPosition(positionId: bigint): Promise<void> {
  const timestamp = new Date().toISOString();
  try {
    const position = (await mortgageVault["getPosition"](positionId)) as readonly unknown[];
    const active = position[10] as boolean;

    if (!active) {
      log.debug(`[${timestamp}] [HealthCheck] Position ${positionId} inactive, skipping.`);
      return;
    }

    const healthy = (await liquidationBuffer["checkHealth"](positionId)) as boolean;
    const collateralRatioBps = (await mortgageVault["getCollateralRatio"](positionId)) as bigint;
    const ratioPct = Number(collateralRatioBps) / 100;

    if (ratioPct < 130) {
      log.error(
        `[${timestamp}] [HealthCheck] CRITICAL position ${positionId}: ratio=${ratioPct.toFixed(2)}% healthy=${healthy}. Triggering partialRepay().`,
      );
      const tx = await (liquidationBuffer["partialRepay"] as (id: bigint, amount: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(positionId, 0n);
      await tx.wait();
      log.info(`[${timestamp}] [HealthCheck] partialRepay tx for position ${positionId}: ${tx.hash}`);
      return;
    }

    if (ratioPct < 140) {
      log.warn(
        `[${timestamp}] [HealthCheck] WARNING position ${positionId}: ratio=${ratioPct.toFixed(2)}% healthy=${healthy}. Triggering triggerTopUp().`,
      );
      const tx = await (liquidationBuffer["triggerTopUp"] as (id: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(positionId);
      await tx.wait();
      log.info(`[${timestamp}] [HealthCheck] triggerTopUp tx for position ${positionId}: ${tx.hash}`);
      return;
    }

    log.info(
      `[${timestamp}] [HealthCheck] Position ${positionId} healthy. ratio=${ratioPct.toFixed(2)}% healthy=${healthy}`,
    );
  } catch (error) {
    log.error(`[${timestamp}] [HealthCheck] Error processing position ${positionId}:`, error);
  }
}

export async function runHealthCheck(): Promise<void> {
  log.info("[HealthCheck] Starting health check run...");
  try {
    const tokenIds = await getOpenPositionIds();

    log.info(`[HealthCheck] Found ${tokenIds.length} mortgage position(s).`);

    for (const tokenId of tokenIds) {
      await runHealthCheckForPosition(tokenId);
    }
  } catch (err) {
    log.error("[HealthCheck] Fatal error during health check run:", err);
  }
  log.info("[HealthCheck] Run complete.");
}

export function scheduleHealthCheck(): cron.ScheduledTask {
  const task = cron.schedule("0 * * * *", () => {
    void runHealthCheck();
  }, {
    timezone: "UTC",
  });
  log.info("[HealthCheck] Scheduled: every hour.");
  return task;
}
