import "dotenv/config";
import type cron from "node-cron";

import { log } from "./lib/logger";
import {
  httpProvider,
  getWebSocketProvider,
  shutdownProviders,
} from "./lib/provider";
import { scheduleHealthCheck, runHealthCheck } from "./tasks/healthCheck";
import { scheduleHarvestYield } from "./tasks/harvestYield";
import { scheduleReleaseInstallment } from "./tasks/releaseInstallment";
import { startPriceMonitor } from "./tasks/priceMonitor";

let shuttingDown = false;
const scheduledTasks: cron.ScheduledTask[] = [];
let stopPriceMonitor: (() => void) | null = null;

// ── Process-level safety net ──────────────────────────────────────────────────

process.on("uncaughtException", (err) => {
  log.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled rejection:", reason);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  log.info(`[Keeper] Received ${signal}. Shutting down gracefully...`);

  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;

  if (stopPriceMonitor) {
    stopPriceMonitor();
    stopPriceMonitor = null;
  }

  await shutdownProviders();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  log.info("  MezoMortgage Keeper Bot");
  log.info(`  Started at: ${new Date().toISOString()}`);
  log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Verify RPC connectivity
  try {
    const network = await httpProvider.getNetwork();
    log.info(`[Keeper] Connected to network: ${network.name} (chainId: ${network.chainId})`);
  } catch (err) {
    log.error("[Keeper] Failed to connect to HTTP RPC. Check SPECTRUM_NODES_HTTP_URL.", err);
    process.exit(1);
  }

  // Start WebSocket provider for real-time events
  getWebSocketProvider();

  // Schedule cron tasks
  scheduledTasks.push(scheduleHealthCheck());
  scheduledTasks.push(scheduleHarvestYield());
  scheduledTasks.push(scheduleReleaseInstallment());

  // Start WebSocket-based price monitor
  stopPriceMonitor = startPriceMonitor();

  // Run an immediate health check on startup
  log.info("[Keeper] Running initial health check...");
  await runHealthCheck();

  log.info("[Keeper] All tasks scheduled. Keeper is running.");
}

main().catch((err) => {
  log.error("[Keeper] Fatal startup error:", err);
  process.exit(1);
});
