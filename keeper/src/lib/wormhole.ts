import { ethers } from "ethers";
import { signer } from "./contracts";
import { log } from "./logger";

export interface BridgeResult {
  txHash: string;
  wormholeSequence: number;
  estimatedDeliveryTime: string;
}

export type TransferStatus = "pending" | "completed";

type BridgeDestination = {
  name: "Ethereum" | "Base";
  chainId: number;
};

type RetryItem = {
  amount: bigint;
  recipient: string;
  destination: BridgeDestination;
  attempts: number;
};

type SubmittedTransaction = {
  hash: string;
  wait: () => Promise<ethers.TransactionReceipt | null>;
};

type Erc20Contract = ethers.Contract & {
  allowance(owner: string, spender: string): Promise<bigint>;
  approve(spender: string, amount: bigint): Promise<SubmittedTransaction>;
};

type NttManagerContract = ethers.Contract & {
  quoteDeliveryPrice(
    recipientChain: number,
    transceiverInstructions: string,
  ): Promise<[bigint[], bigint]>;
  nextMessageSequence(): Promise<bigint>;
  getFunction(
    name: "transfer(uint256,uint16,bytes32,bytes32,bool,bytes)",
  ): (
    amount: bigint,
    recipientChain: number,
    recipient: string,
    refundAddress: string,
    shouldQueue: boolean,
    transceiverInstructions: string,
    overrides: { value: bigint },
  ) => Promise<SubmittedTransaction>;
};

const NTT_MANAGER_ABI = [
  "function quoteDeliveryPrice(uint16 recipientChain, bytes transceiverInstructions) view returns (uint256[] deliveryQuotes, uint256 totalPrice)",
  "function transfer(uint256 amount, uint16 recipientChain, bytes32 recipient, bytes32 refundAddress, bool shouldQueue, bytes transceiverInstructions) payable returns (uint64 sequence)",
  "function nextMessageSequence() view returns (uint64)",
  "event TransferSent(bytes32 indexed recipient, bytes32 indexed refundAddress, uint256 amount, uint256 fee, uint16 recipientChain, uint64 msgSequence)",
] as const;

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

const retryQueue: RetryItem[] = [];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] && process.env[name] !== "0x..."
    ? process.env[name]
    : undefined;
}

function getMUSDTokenAddress(): string {
  return (
    optionalEnv("MUSD_TOKEN_ADDRESS") ??
    optionalEnv("MEZO_MUSD_TOKEN_ADDRESS") ??
    requireEnv("MUSD_TOKEN_ADDRESS")
  );
}

function getDestination(destinationChain: string): BridgeDestination {
  const normalized = destinationChain.toLowerCase();

  if (normalized.includes("base")) {
    return {
      name: "Base",
      chainId: Number(process.env.WORMHOLE_BASE_CHAIN_ID ?? 30),
    };
  }

  return {
    name: "Ethereum",
    chainId: Number(process.env.WORMHOLE_ETHEREUM_CHAIN_ID ?? 2),
  };
}

function encodeEvmAddress(address: string): string {
  const checksummed = ethers.getAddress(address);
  return ethers.zeroPadValue(checksummed, 32);
}

function decodeEvmAddress(encoded: string): string {
  return ethers.getAddress(`0x${encoded.slice(-40)}`);
}

function getEstimatedDeliveryTime(destination: BridgeDestination): string {
  const minutes =
    destination.name === "Ethereum"
      ? Number(process.env.WORMHOLE_ETHEREUM_FINALITY_MINUTES ?? 15)
      : Number(process.env.WORMHOLE_BASE_FINALITY_MINUTES ?? 3);

  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function ensureAllowance(
  token: Erc20Contract,
  spender: string,
  amount: bigint,
): Promise<void> {
  const allowance = await token.allowance(signer.address, spender);
  if (allowance >= amount) {
    return;
  }

  log.info("[Wormhole] Approving MUSD for NTT manager.");
  const approveTx = await token.approve(spender, amount);
  await approveTx.wait();
  log.info(`[Wormhole] MUSD approval confirmed: ${approveTx.hash}`);
}

function parseSequenceFromReceipt(
  receipt: ethers.TransactionReceipt,
  fallbackSequence: bigint,
): bigint {
  const iface = new ethers.Interface(NTT_MANAGER_ABI);

  for (const logEntry of receipt.logs) {
    try {
      const parsed = iface.parseLog({
        topics: [...logEntry.topics],
        data: logEntry.data,
      });

      if (parsed?.name === "TransferSent" && parsed.args.length === 6) {
        return parsed.args[5] as bigint;
      }
    } catch {
      // Ignore unrelated logs in the transaction receipt.
    }
  }

  return fallbackSequence;
}

async function pollForCompletion(sequence: number): Promise<TransferStatus> {
  const attempts = Number(process.env.WORMHOLE_VAA_POLL_ATTEMPTS ?? 4);
  const intervalMs = Number(process.env.WORMHOLE_VAA_POLL_INTERVAL_MS ?? 15_000);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = await getTransferStatus(sequence);
    if (status === "completed") {
      return status;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return "pending";
}

async function executeBridge(
  amount: bigint,
  recipientAddress: string,
  destination: BridgeDestination,
  enqueueOnFailure: boolean,
): Promise<BridgeResult> {
  const managerAddress = requireEnv("WORMHOLE_NTT_MANAGER_ADDRESS");
  const musdAddress = getMUSDTokenAddress();
  const nttManager = new ethers.Contract(
    managerAddress,
    NTT_MANAGER_ABI,
    signer,
  ) as unknown as NttManagerContract;
  const musd = new ethers.Contract(
    musdAddress,
    ERC20_ABI,
    signer,
  ) as unknown as Erc20Contract;
  const recipient = encodeEvmAddress(recipientAddress);
  const refundAddress = encodeEvmAddress(signer.address);
  const transceiverInstructions = "0x";

  log.info(
    `[Wormhole] Initiating ${ethers.formatUnits(amount, 18)} MUSD NTT transfer to ${recipientAddress} on ${destination.name}.`,
  );

  try {
    await ensureAllowance(musd, managerAddress, amount);

    const [, totalPrice] = await nttManager.quoteDeliveryPrice(
      destination.chainId,
      transceiverInstructions,
    );
    const fallbackSequence = await nttManager.nextMessageSequence();

    const transfer = nttManager.getFunction(
      "transfer(uint256,uint16,bytes32,bytes32,bool,bytes)",
    );
    const tx = await transfer(
      amount,
      destination.chainId,
      recipient,
      refundAddress,
      true,
      transceiverInstructions,
      { value: totalPrice },
    );
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error(`No receipt returned for Wormhole transfer ${tx.hash}`);
    }

    const sequence = parseSequenceFromReceipt(receipt, fallbackSequence);
    const sequenceNumber = Number(sequence);
    const status = await pollForCompletion(sequenceNumber);
    const estimatedDeliveryTime = getEstimatedDeliveryTime(destination);

    log.info(
      `[Wormhole] Transfer submitted: tx=${tx.hash} sequence=${sequenceNumber} status=${status} eta=${estimatedDeliveryTime}`,
    );

    return {
      txHash: tx.hash,
      wormholeSequence: sequenceNumber,
      estimatedDeliveryTime,
    };
  } catch (err) {
    log.error(`[Wormhole] Bridge failed for recipient ${recipientAddress}:`, err);

    if (enqueueOnFailure) {
      retryQueue.push({
        amount,
        recipient: recipientAddress,
        destination,
        attempts: 1,
      });
    }

    throw err;
  }
}

export async function bridgeMUSDToEthereum(
  amount: bigint,
  recipientAddress: string,
): Promise<BridgeResult> {
  return executeBridge(
    amount,
    recipientAddress,
    {
      name: "Ethereum",
      chainId: Number(process.env.WORMHOLE_ETHEREUM_CHAIN_ID ?? 2),
    },
    true,
  );
}

export async function bridgeMUSDToBase(
  amount: bigint,
  recipientAddress: string,
): Promise<BridgeResult> {
  return executeBridge(
    amount,
    recipientAddress,
    {
      name: "Base",
      chainId: Number(process.env.WORMHOLE_BASE_CHAIN_ID ?? 30),
    },
    true,
  );
}

export async function bridgeMUSDToChain(
  amount: bigint,
  recipientAddress: string,
  destinationChain: string,
): Promise<BridgeResult> {
  return executeBridge(
    amount,
    recipientAddress,
    getDestination(destinationChain),
    true,
  );
}

export async function bridgeMUSDToEncodedRecipient(
  amount: bigint,
  recipientAddress: string,
  destinationChain: string,
): Promise<BridgeResult> {
  return bridgeMUSDToChain(
    amount,
    decodeEvmAddress(recipientAddress),
    destinationChain,
  );
}

export async function getTransferStatus(
  sequence: number,
): Promise<TransferStatus> {
  const apiBase = optionalEnv("WORMHOLE_SCAN_API_URL");
  const emitterAddress = optionalEnv("WORMHOLE_NTT_EMITTER_ADDRESS");
  const sourceChainId = process.env.WORMHOLE_SOURCE_CHAIN_ID ?? "50";

  if (!apiBase || !emitterAddress) {
    log.debug(
      `[Wormhole] Sequence ${sequence}: no Wormholescan API/emitter configured, status pending.`,
    );
    return "pending";
  }

  const paddedSequence = sequence.toString();
  const url = `${apiBase.replace(/\/$/, "")}/api/v1/vaas/${sourceChainId}/${emitterAddress}/${paddedSequence}`;

  try {
    const response = await fetch(url);
    return response.ok ? "completed" : "pending";
  } catch (err) {
    log.warn(`[Wormhole] Status check failed for sequence ${sequence}:`, err);
    return "pending";
  }
}

export function getRetryQueue() {
  return retryQueue.map((item) => ({
    amount: item.amount,
    recipient: item.recipient,
    chain: item.destination.name,
    attempts: item.attempts,
  }));
}

export async function processRetryQueue(): Promise<void> {
  if (retryQueue.length === 0) return;

  log.info(`[Wormhole] Processing ${retryQueue.length} queued retries...`);
  for (const item of [...retryQueue]) {
    try {
      await executeBridge(item.amount, item.recipient, item.destination, false);
      retryQueue.splice(retryQueue.indexOf(item), 1);
    } catch {
      item.attempts++;
      if (item.attempts > 3) {
        log.error(
          `[Wormhole] Giving up on transfer to ${item.recipient} after 3 attempts.`,
        );
        retryQueue.splice(retryQueue.indexOf(item), 1);
      }
    }
  }
}
