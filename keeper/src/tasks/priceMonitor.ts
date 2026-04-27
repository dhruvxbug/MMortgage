import { ethers } from "ethers";
import BTCOracleAbi from "../../abi/BTCOracle.json";
import { mortgageVault } from "../lib/contracts.js";
import { onWebSocketProviderReady } from "../lib/provider.js";
import { runHealthCheckForPosition } from "./healthCheck.js";
import { log } from "../lib/logger.js";

const ALERT_THRESHOLD = Number(process.env.ALERT_THRESHOLD ?? "145");

// In-memory state
const positionRatios = new Map<bigint, number>();
const alertedPositions = new Set<bigint>();

async function refreshPositionRatios(btcPriceUSD: number): Promise<void> {
  try {
    const filter = mortgageVault.filters["MortgageOpened"]();
    const events = await mortgageVault.queryFilter(filter, 0, "latest");

    for (const e of events) {
      const parsed = mortgageVault.interface.parseLog({ topics: [...e.topics], data: e.data });
      const tokenId = parsed?.args[0] as bigint | undefined;
      if (tokenId === undefined) continue;

      try {
        const position = await mortgageVault["getPosition"](tokenId) as readonly unknown[];
        const active = position[10] as boolean;
        if (!active) continue;

        const collateralAmount = Number(position[0] as bigint) / 1e18; // BTC
        const borrowedMUSD = Number(position[1] as bigint) / 1e18;
        if (borrowedMUSD === 0) continue;

        const ratio = (collateralAmount * btcPriceUSD * 100) / borrowedMUSD;
        positionRatios.set(tokenId, ratio);

        log.debug(`[PriceMonitor] Position ${tokenId} ratio: ${ratio.toFixed(2)}%`);

        if (ratio < ALERT_THRESHOLD) {
          log.warn(
            `[PriceMonitor] Position ${tokenId} ratio ${ratio.toFixed(2)}% below threshold ${ALERT_THRESHOLD}%. Running immediate health check.`,
          );
          if (!alertedPositions.has(tokenId)) {
            alertedPositions.add(tokenId);
            void runHealthCheckForPosition(tokenId);
          }
        } else if (alertedPositions.has(tokenId)) {
          alertedPositions.delete(tokenId);
        }
      } catch (err) {
        log.error(`[PriceMonitor] Error refreshing position ${tokenId}:`, err);
      }
    }
  } catch (err) {
    log.error("[PriceMonitor] Error refreshing positions:", err);
  }
}

export function startPriceMonitor(): () => void {
  const oracleAddress = process.env.BTC_ORACLE_ADDRESS;
  if (!oracleAddress) {
    log.warn("[PriceMonitor] BTC_ORACLE_ADDRESS not set. Price monitor disabled.");
    return () => undefined;
  }

  let oracle: ethers.Contract | null = null;

  const unsubscribe = onWebSocketProviderReady((wsProvider) => {
    if (oracle) {
      oracle.removeAllListeners("PriceUpdated");
    }

    oracle = new ethers.Contract(oracleAddress, BTCOracleAbi, wsProvider);

    oracle.on("PriceUpdated", (price: bigint, timestamp: bigint) => {
      const btcPriceUSD = Number(price) / 1e8;
      log.info(`[PriceMonitor] BTC price updated: $${btcPriceUSD.toFixed(2)} at ${new Date(Number(timestamp) * 1000).toISOString()}`);
      void refreshPositionRatios(btcPriceUSD);
    });

    log.info(`[PriceMonitor] Subscribed to PriceUpdated on oracle ${oracleAddress}.`);
  });

  return () => {
    unsubscribe();
    if (oracle) {
      oracle.removeAllListeners("PriceUpdated");
      oracle = null;
    }
  };
}
