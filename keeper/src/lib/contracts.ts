import { ethers } from "ethers";
import { httpProvider } from "./provider";
import { log } from "./logger";
import MortgageVaultAbi from "../../abi/MortgageVault.json";
import EscrowControllerAbi from "../../abi/EscrowController.json";
import YieldRouterAbi from "../../abi/YieldRouter.json";
import LiquidationBufferAbi from "../../abi/LiquidationBuffer.json";
import MortgageNftAbi from "../../abi/MortgageNFT.json";
import BTCOracleAbi from "../../abi/BTCOracle.json";

// ---------------------------------------------------------------------------
// Env-var validation
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const KEEPER_PRIVATE_KEY = requireEnv("KEEPER_PRIVATE_KEY");
const MORTGAGE_VAULT_ADDRESS = requireEnv("MORTGAGE_VAULT_ADDRESS");
const ESCROW_CONTROLLER_ADDRESS = requireEnv("ESCROW_CONTROLLER_ADDRESS");
const YIELD_ROUTER_ADDRESS = requireEnv("YIELD_ROUTER_ADDRESS");
const LIQUIDATION_BUFFER_ADDRESS = requireEnv("LIQUIDATION_BUFFER_ADDRESS");
const MORTGAGE_NFT_ADDRESS = requireEnv("MORTGAGE_NFT_ADDRESS");
const BTC_ORACLE_ADDRESS = requireEnv("BTC_ORACLE_ADDRESS");

// ---------------------------------------------------------------------------
// Signer
// ---------------------------------------------------------------------------

export const signer: ethers.Wallet = new ethers.Wallet(
  KEEPER_PRIVATE_KEY,
  httpProvider,
);

log.info(`Keeper signer address: ${signer.address}`);

// ---------------------------------------------------------------------------
// Contract instances (signed — write-capable)
// ---------------------------------------------------------------------------

export const mortgageVault: ethers.Contract = new ethers.Contract(
  MORTGAGE_VAULT_ADDRESS,
  MortgageVaultAbi,
  signer,
);

export const escrowController: ethers.Contract = new ethers.Contract(
  ESCROW_CONTROLLER_ADDRESS,
  EscrowControllerAbi,
  signer,
);

export const yieldRouter: ethers.Contract = new ethers.Contract(
  YIELD_ROUTER_ADDRESS,
  YieldRouterAbi,
  signer,
);

export const liquidationBuffer: ethers.Contract = new ethers.Contract(
  LIQUIDATION_BUFFER_ADDRESS,
  LiquidationBufferAbi,
  signer,
);

export const mortgageNft: ethers.Contract = new ethers.Contract(
  MORTGAGE_NFT_ADDRESS,
  MortgageNftAbi,
  signer,
);

export const btcOracle: ethers.Contract = new ethers.Contract(
  BTC_ORACLE_ADDRESS,
  BTCOracleAbi,
  signer,
);

// ---------------------------------------------------------------------------
// WebSocket helper (read-only)
// ---------------------------------------------------------------------------

/**
 * Returns a read-only Contract instance connected to the given WebSocket
 * provider. Useful for subscribing to on-chain events without exposing the
 * keeper private key to the WebSocket connection.
 *
 * @param address   - Contract address
 * @param abi       - Contract ABI (array or human-readable fragments)
 * @param wsProvider - An active ethers.WebSocketProvider
 */
export function getContractWithWs(
  address: string,
  abi: ethers.InterfaceAbi,
  wsProvider: ethers.WebSocketProvider,
): ethers.Contract {
  return new ethers.Contract(address, abi, wsProvider);
}
