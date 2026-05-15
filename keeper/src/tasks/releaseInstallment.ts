import cron from "node-cron";
import { ethers } from "ethers";
import { mortgageVault, escrowController } from "../lib/contracts";
import { bridgeMUSDToEncodedRecipient } from "../lib/wormhole";
import { log } from "../lib/logger";

function isSupportedCrossChainDestination(chain: string): boolean {
  const normalized = chain.toLowerCase();
  return (
    normalized.includes("ethereum") ||
    normalized.includes("sepolia") ||
    normalized.includes("base")
  );
}

function parseCrossChainRelease(
  receipt: { logs: readonly ethers.Log[] },
): {
  destinationChainId: number;
  destinationAddress: string;
  amount: bigint;
} | null {
  for (const logEntry of receipt.logs) {
    try {
      const parsed = escrowController.interface.parseLog({
        topics: [...logEntry.topics],
        data: logEntry.data,
      });

      if (parsed?.name === "CrossChainRelease") {
        return {
          destinationChainId: Number(parsed.args.destinationChainId),
          destinationAddress: parsed.args.destinationAddress as string,
          amount: parsed.args.amount as bigint,
        };
      }
    } catch {
      // Ignore logs from other contracts.
    }
  }

  return null;
}

export async function runReleaseInstallment(): Promise<void> {
  log.info("[ReleaseInstallment] Starting installment release run...");
  const now = BigInt(Math.floor(Date.now() / 1000));

  try {
    // Use MortgageOpened events to get all tokenIds (escrow IDs match tokenIds)
    const filter = mortgageVault.filters["MortgageOpened"]();
    const events = await mortgageVault.queryFilter(filter, 0, "latest");
    const tokenIds = events
      .map((e) => {
        const parsed = mortgageVault.interface.parseLog({
          topics: [...e.topics],
          data: e.data,
        });
        return parsed?.args[0] as bigint;
      })
      .filter((id): id is bigint => id !== undefined);

    log.info(`[ReleaseInstallment] Checking ${tokenIds.length} escrow(s).`);

    for (const tokenId of tokenIds) {
      try {
        const schedule = await (escrowController["getScheduleExtended"] as (
          id: bigint,
        ) => Promise<
          readonly [
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            string,
            boolean,
            number,
            string,
            string,
          ]
        >)(tokenId);
        const [
          nextPaymentDue,
          installmentAmount,
          installmentsPaid,
          totalInstallments,
          ,
          seller,
          isCrossChain,
          destinationChainId,
          destinationAddress,
          destinationChain,
        ] = schedule;

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

        const tx = await (escrowController["releaseInstallment"] as (
          id: bigint,
        ) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(tokenId);
        const receipt = (await tx.wait()) as { logs: readonly ethers.Log[] };
        log.info(
          `[ReleaseInstallment] Escrow ${tokenId} released: amount=${amountMUSD} MUSD destination=${destination} txHash=${tx.hash}`,
        );

        if (isCrossChain && isSupportedCrossChainDestination(destinationChain)) {
          const releaseEvent = parseCrossChainRelease(receipt);
          const encodedRecipient =
            releaseEvent?.destinationAddress ?? destinationAddress;
          const bridgeAmount = releaseEvent?.amount ?? installmentAmount;
          const bridge = await bridgeMUSDToEncodedRecipient(
            bridgeAmount,
            encodedRecipient,
            destinationChain,
          );
          log.info(
            `[ReleaseInstallment] Wormhole bridge initiated. ChainId: ${releaseEvent?.destinationChainId ?? destinationChainId}, Sequence: ${bridge.wormholeSequence}, ETA: ${bridge.estimatedDeliveryTime}`,
          );
        } else if (isCrossChain) {
          log.warn(
            `[ReleaseInstallment] Escrow ${tokenId}: destination chain '${destinationChain}' is not Ethereum/Base; skipping Wormhole NTT trigger.`,
          );
        }
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
