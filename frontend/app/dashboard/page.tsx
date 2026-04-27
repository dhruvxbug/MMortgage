"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { parseEther, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import ActionModal from "@/app/dashboard/components/ActionModal";
import HealthAlertBanner from "@/app/dashboard/components/HealthAlertBanner";
import PositionCard from "@/app/dashboard/components/PositionCard";
import type {
  DashboardAction,
  DashboardPosition,
} from "@/app/dashboard/components/types";
import WalletGate from "@/components/WalletGate";
import {
  CONTRACT_ADDRESSES,
  escrowControllerAbi,
  mortgageNftAbi,
  mortgageVaultAbi,
  yieldRouterAbi,
} from "@/lib/contracts";
import { demoScenario } from "@/lib/demo";
import { chains } from "@/lib/wagmi-config";

const demoPosition: DashboardPosition = {
  tokenId: 2048n,
  btcLocked: demoScenario.btcHoldings,
  btcValueUsd: demoScenario.btcHoldings * demoScenario.btcPrice,
  musdBorrowed: demoScenario.musdBorrowed,
  collateralRatio: demoScenario.collateralRatio,
  mortgagePaidPercent: 12.4,
  vaultApy: 6.2,
  monthlyYield: 112.5,
  monthlyPayment: 93.75,
  yieldSurplus: 18.75,
  nextPaymentDue: "May 15, 2026",
  nextPaymentCountdown: "in 21 days",
  sellerAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  chainLabel: "Ethereum",
  crossChain: true,
  totalPropertyPrice: 22_500,
  installmentsPaid: 3,
  totalInstallments: 120,
  escrowBalance: 187.5,
};

function formatUnitsNumber(value?: bigint): number {
  if (!value) {
    return 0;
  }

  return Number(value) / 1e18;
}

function LoadingSkeleton() {
  return (
    <div className="rounded-[32px] border border-zinc-800 bg-zinc-900/90 p-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-[24px] border border-zinc-800 bg-zinc-950"
          />
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-[28px] border border-zinc-800 bg-zinc-950" />
        <div className="h-64 rounded-[28px] border border-zinc-800 bg-zinc-950" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [selectedAction, setSelectedAction] = useState<DashboardAction | null>(
    null,
  );
  const [selectedPosition, setSelectedPosition] =
    useState<DashboardPosition | null>(null);

  const {
    data: writeHash,
    error: writeError,
    isPending: isWriting,
    writeContract,
  } = useWriteContract();

  const { isLoading: isActionConfirming, error: receiptError } =
    useWaitForTransactionReceipt({
      hash: writeHash,
    });

  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.mortgageNft,
    abi: mortgageNftAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: chains[0].id,
    query: {
      enabled: Boolean(address),
      refetchInterval: 30_000,
    },
  });

  const tokenIndexContracts = useMemo(() => {
    const balance = Number(balanceData ?? 0n);

    if (!address || balance === 0) {
      return [];
    }

    return Array.from({ length: balance }, (_, index) => ({
      address: CONTRACT_ADDRESSES.mortgageNft,
      abi: mortgageNftAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(index)] as const,
      chainId: chains[0].id,
    }));
  }, [address, balanceData]);

  const { data: tokenResults, isLoading: isTokenIdsLoading } = useReadContracts(
    {
      contracts: tokenIndexContracts,
      allowFailure: true,
      query: {
        enabled: tokenIndexContracts.length > 0,
        refetchInterval: 30_000,
      },
    },
  );

  const tokenIds = useMemo(
    () =>
      (tokenResults ?? [])
        .map((result) =>
          result.status === "success" ? result.result : undefined,
        )
        .filter((value): value is bigint => typeof value === "bigint"),
    [tokenResults],
  );

  const detailContracts = useMemo(() => {
    return tokenIds.flatMap((tokenId) => [
      {
        address: CONTRACT_ADDRESSES.mortgageVault,
        abi: mortgageVaultAbi,
        functionName: "getPosition" as const,
        args: [tokenId] as const,
        chainId: chains[0].id,
      },
      {
        address: CONTRACT_ADDRESSES.yieldRouter,
        abi: yieldRouterAbi,
        functionName: "getAccruedYield" as const,
        args: [tokenId] as const,
        chainId: chains[0].id,
      },
      {
        address: CONTRACT_ADDRESSES.yieldRouter,
        abi: yieldRouterAbi,
        functionName: "getVaultApy" as const,
        args: [tokenId] as const,
        chainId: chains[0].id,
      },
      {
        address: CONTRACT_ADDRESSES.escrowController,
        abi: escrowControllerAbi,
        functionName: "getSchedule" as const,
        args: [tokenId] as const,
        chainId: chains[0].id,
      },
    ]);
  }, [tokenIds]);

  const { data: detailResults, isLoading: isDetailsLoading } = useReadContracts(
    {
      contracts: detailContracts,
      allowFailure: true,
      query: {
        enabled: detailContracts.length > 0,
        refetchInterval: 30_000,
      },
    },
  );

  const onchainPositions = useMemo<DashboardPosition[]>(() => {
    if (!detailResults || tokenIds.length === 0) {
      return [];
    }

    const positions: DashboardPosition[] = [];

    tokenIds.forEach((tokenId, index) => {
      const positionResult = detailResults[index * 4];
      const yieldResult = detailResults[index * 4 + 1];
      const apyResult = detailResults[index * 4 + 2];
      const scheduleResult = detailResults[index * 4 + 3];

      if (
        positionResult?.status !== "success" ||
        yieldResult?.status !== "success" ||
        apyResult?.status !== "success" ||
        scheduleResult?.status !== "success"
      ) {
        return;
      }

      const [
        collateralAmount,
        borrowedMUSD,
        ,
        collateralRatioBps,
        propertyPrice,
        installmentsPaid,
        totalInstallments,
        seller,
        isCrossChain,
        destinationChain,
      ] = positionResult.result as readonly [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        `0x${string}`,
        boolean,
        string,
        boolean,
      ];

      const [
        nextPaymentDue,
        installmentAmount,
        paidCount,
        totalCount,
        escrowBalance,
      ] = scheduleResult.result as readonly [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        `0x${string}`,
        boolean,
        string,
      ];
      const monthlyYield = formatUnitsNumber(yieldResult.result as bigint) / 12;
      const monthlyPayment = formatUnitsNumber(installmentAmount);
      const nextPaymentDate = new Date(Number(nextPaymentDue) * 1000);
      const countdownMs = nextPaymentDate.getTime() - Date.now();
      const countdownDays = Math.max(
        Math.ceil(countdownMs / (1000 * 60 * 60 * 24)),
        0,
      );

      positions.push({
        tokenId,
        btcLocked: formatUnitsNumber(collateralAmount),
        btcValueUsd:
          formatUnitsNumber(collateralAmount) * demoScenario.btcPrice,
        musdBorrowed: formatUnitsNumber(borrowedMUSD),
        collateralRatio: Number(collateralRatioBps) / 100,
        mortgagePaidPercent:
          Number(totalCount) > 0
            ? (Number(paidCount) / Number(totalCount)) * 100
            : 0,
        vaultApy: Number(apyResult.result) / 100,
        monthlyYield,
        monthlyPayment,
        yieldSurplus: monthlyYield - monthlyPayment,
        nextPaymentDue: nextPaymentDate.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        nextPaymentCountdown: `in ${countdownDays} days`,
        sellerAddress: seller,
        chainLabel: isCrossChain ? destinationChain : "Mezo",
        crossChain: isCrossChain,
        totalPropertyPrice: formatUnitsNumber(propertyPrice),
        installmentsPaid: Number(installmentsPaid),
        totalInstallments: Number(totalInstallments),
        escrowBalance: formatUnitsNumber(escrowBalance),
      });
    });

    return positions;
  }, [detailResults, tokenIds]);

  const usingDemoFallback =
    isConnected &&
    (isBalanceError ||
      (Number(balanceData ?? 0n) === 0 && tokenIds.length === 0) ||
      (tokenIds.length > 0 && onchainPositions.length === 0));

  const positions = usingDemoFallback ? [demoPosition] : onchainPositions;

  const healthAlertPosition = positions.find(
    (position) => position.collateralRatio < 160,
  );
  const isLoading =
    isConnected && (isBalanceLoading || isTokenIdsLoading || isDetailsLoading);
  const transactionError = writeError ?? receiptError;

  function openAction(
    action: DashboardAction,
    position: DashboardPosition,
  ): void {
    setSelectedAction(action);
    setSelectedPosition(position);
  }

  function closeAction(): void {
    setSelectedAction(null);
    setSelectedPosition(null);
  }

  function handleSubmitAction(amount?: string): void {
    if (!selectedAction || !selectedPosition) {
      return;
    }

    if (selectedAction === "add-collateral") {
      writeContract({
        address: CONTRACT_ADDRESSES.mortgageVault,
        abi: mortgageVaultAbi,
        functionName: "addCollateral",
        args: [selectedPosition.tokenId, parseEther(amount ?? "0")],
        chainId: chains[0].id,
      });
    }

    if (selectedAction === "repay-early") {
      writeContract({
        address: CONTRACT_ADDRESSES.mortgageVault,
        abi: mortgageVaultAbi,
        functionName: "repayMortgage",
        args: [selectedPosition.tokenId, parseUnits(amount ?? "0", 18)],
        chainId: chains[0].id,
      });
    }

    if (selectedAction === "close-position") {
      writeContract({
        address: CONTRACT_ADDRESSES.mortgageVault,
        abi: mortgageVaultAbi,
        functionName: "closeMortgage",
        args: [selectedPosition.tokenId],
        chainId: chains[0].id,
      });
    }
  }

  return (
    <WalletGate>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
              Position Dashboard
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              My Mortgages
            </h1>
          </div>
          <Link href="/open" className="brand-button">
            Open New Mortgage
          </Link>
        </div>

        {usingDemoFallback ? (
          <div className="mt-6 rounded-[28px] border border-[#F7931A]/30 bg-[#F7931A]/10 p-5 text-sm leading-7 text-zinc-100">
            Previewing the hackathon demo mortgage until live testnet contract
            addresses are wired into the frontend.
          </div>
        ) : null}

        {healthAlertPosition ? (
          <div className="mt-6">
            <HealthAlertBanner
              position={healthAlertPosition}
              onAddCollateral={(position) =>
                openAction("add-collateral", position)
              }
            />
          </div>
        ) : null}

        {transactionError ? (
          <div className="mt-6 rounded-[28px] border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-200">
            {transactionError.message}
          </div>
        ) : null}

        <div className="mt-6">
          {isLoading ? <LoadingSkeleton /> : null}

          {!isLoading && positions.length === 0 ? (
            <div className="paper-panel p-8">
              <span className="section-label border-zinc-900 bg-white/70 text-zinc-950">
                No Active Mortgages
              </span>
              <h2 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950">
                No active mortgages. Open your first Bitcoin mortgage.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700">
                Deposit BTC, mint MUSD, and start routing vault yield into
                property escrow payments without selling your stack.
              </p>
              <Link href="/open" className="brand-button mt-6">
                Open your first mortgage
              </Link>
            </div>
          ) : null}

          {!isLoading && positions.length > 0 ? (
            <div className="space-y-6">
              {positions.map((position) => (
                <PositionCard
                  key={position.tokenId.toString()}
                  position={position}
                  onAction={openAction}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ActionModal
        action={selectedAction}
        isOpen={Boolean(selectedAction && selectedPosition)}
        isPending={isWriting || isActionConfirming}
        position={selectedPosition}
        onClose={closeAction}
        onSubmit={handleSubmitAction}
      />
    </WalletGate>
  );
}
