import {
  getContract,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";

type ContractClient =
  | PublicClient
  | WalletClient
  | {
      public: PublicClient;
      wallet?: WalletClient;
    };

export const CONTRACT_ADDRESSES = {
  mortgageVault: "0x1111111111111111111111111111111111111111",
  escrowController: "0x2222222222222222222222222222222222222222",
  yieldRouter: "0x3333333333333333333333333333333333333333",
  liquidationBuffer: "0x4444444444444444444444444444444444444444",
  mortgageNft: "0x5555555555555555555555555555555555555555",
  veBooster: "0x6666666666666666666666666666666666666666",
} as const satisfies Record<string, Address>;

export const mortgageVaultAbi = [
  {
    type: "function",
    name: "openMortgage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collateralAmount", type: "uint256" },
      { name: "borrowAmount", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "propertyPrice", type: "uint256" },
      { name: "firstPaymentDate", type: "uint256" },
      { name: "paymentFrequency", type: "uint8" },
      { name: "isCrossChain", type: "bool" },
      { name: "destinationChain", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "addCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repayMortgage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closeMortgage",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getCollateralRatio",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "ratioBps", type: "uint256" }],
  },
  {
    type: "function",
    name: "getPosition",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "collateralAmount", type: "uint256" },
      { name: "borrowedMUSD", type: "uint256" },
      { name: "ltvBps", type: "uint256" },
      { name: "collateralRatioBps", type: "uint256" },
      { name: "propertyPrice", type: "uint256" },
      { name: "installmentsPaid", type: "uint256" },
      { name: "totalInstallments", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "isCrossChain", type: "bool" },
      { name: "destinationChain", type: "string" },
      { name: "active", type: "bool" },
    ],
  },
] as const;

export const escrowControllerAbi = [
  {
    type: "function",
    name: "createEscrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "schedule", type: "uint8" },
    ],
    outputs: [{ name: "escrowId", type: "uint256" }],
  },
  {
    type: "function",
    name: "releaseInstallment",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "emergencyWithdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getSchedule",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nextPaymentDue", type: "uint256" },
      { name: "installmentAmount", type: "uint256" },
      { name: "installmentsPaid", type: "uint256" },
      { name: "totalInstallments", type: "uint256" },
      { name: "escrowBalance", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "isCrossChain", type: "bool" },
      { name: "destinationChain", type: "string" },
    ],
  },
] as const;

export const yieldRouterAbi = [
  {
    type: "function",
    name: "depositToVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "harvestAndRoute",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getAccruedYield",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "yieldAmount", type: "uint256" }],
  },
  {
    type: "function",
    name: "getPendingInstallment",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "getVaultApy",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "apyBps", type: "uint256" }],
  },
] as const;

export const liquidationBufferAbi = [
  {
    type: "function",
    name: "checkHealth",
    stateMutability: "view",
    inputs: [{ name: "vaultId", type: "uint256" }],
    outputs: [{ name: "healthy", type: "bool" }],
  },
  {
    type: "function",
    name: "triggerTopUp",
    stateMutability: "nonpayable",
    inputs: [{ name: "vaultId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "partialRepay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vaultId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setHealthThreshold",
    stateMutability: "nonpayable",
    inputs: [{ name: "thresholdBps", type: "uint256" }],
    outputs: [],
  },
] as const;

export const mortgageNftAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "metadata", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "uri", type: "string" }],
  },
  {
    type: "function",
    name: "transferPosition",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newOwner", type: "address" },
    ],
    outputs: [],
  },
] as const;

export const veBoosterAbi = [
  {
    type: "function",
    name: "lockVeMEZO",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "applyDiscount",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "unlockAfterExpiry",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getEffectiveRate",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "rateBps", type: "uint256" }],
  },
] as const;

export const getMortgageVaultContract = (client: ContractClient) =>
  getContract({
    address: CONTRACT_ADDRESSES.mortgageVault,
    abi: mortgageVaultAbi,
    client,
  });

export const getEscrowControllerContract = (client: ContractClient) =>
  getContract({
    address: CONTRACT_ADDRESSES.escrowController,
    abi: escrowControllerAbi,
    client,
  });

export const getYieldRouterContract = (client: ContractClient) =>
  getContract({
    address: CONTRACT_ADDRESSES.yieldRouter,
    abi: yieldRouterAbi,
    client,
  });

export const getLiquidationBufferContract = (client: ContractClient) =>
  getContract({
    address: CONTRACT_ADDRESSES.liquidationBuffer,
    abi: liquidationBufferAbi,
    client,
  });

export const getMortgageNftContract = (client: ContractClient) =>
  getContract({
    address: CONTRACT_ADDRESSES.mortgageNft,
    abi: mortgageNftAbi,
    client,
  });

export const getVeBoosterContract = (client: ContractClient) =>
  getContract({
    address: CONTRACT_ADDRESSES.veBooster,
    abi: veBoosterAbi,
    client,
  });
