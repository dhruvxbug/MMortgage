export type DashboardPosition = {
  tokenId: bigint;
  btcLocked: number;
  btcValueUsd: number;
  musdBorrowed: number;
  collateralRatio: number;
  mortgagePaidPercent: number;
  vaultApy: number;
  monthlyYield: number;
  monthlyPayment: number;
  yieldSurplus: number;
  nextPaymentDue: string;
  nextPaymentCountdown: string;
  sellerAddress: string;
  chainLabel: string;
  crossChain: boolean;
  totalPropertyPrice: number;
  installmentsPaid: number;
  totalInstallments: number;
  escrowBalance: number;
};

export type DashboardAction = "add-collateral" | "repay-early" | "close-position";
