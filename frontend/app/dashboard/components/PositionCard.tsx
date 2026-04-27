"use client";

import Link from "next/link";

import type {
  DashboardAction,
  DashboardPosition,
} from "@/app/dashboard/components/types";

type PositionCardProps = {
  position: DashboardPosition;
  onAction: (action: DashboardAction, position: DashboardPosition) => void;
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function PositionCard({
  position,
  onAction,
}: PositionCardProps) {
  const ratioColor =
    position.collateralRatio > 200
      ? "text-emerald-400"
      : position.collateralRatio >= 150
        ? "text-amber-400"
        : "text-red-400";

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(position.sellerAddress);
  }

  return (
    <article className="rounded-[32px] border border-zinc-800 bg-zinc-900/90 p-6 shadow-panel">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            BTC Locked
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {position.btcLocked.toFixed(2)} BTC
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {formatCurrency(position.btcValueUsd)}
          </div>
        </div>
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            MUSD Borrowed
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {position.musdBorrowed.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-zinc-400">MUSD debt</div>
        </div>
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Collateral Ratio
          </div>
          <div className={`mt-2 text-2xl font-semibold ${ratioColor}`}>
            {position.collateralRatio.toFixed(2)}%
          </div>
          <div className="mt-1 text-sm text-zinc-400">Health monitor</div>
        </div>
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            % Mortgage Paid
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {position.mortgagePaidPercent.toFixed(1)}%
          </div>
          <div className="mt-4 h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#F7931A]"
              style={{ width: `${Math.min(position.mortgagePaidPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Yield & Payment
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-zinc-400">Vault APY</div>
              <div className="mt-1 text-xl font-semibold text-white">
                {position.vaultApy.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Monthly Yield</div>
              <div className="mt-1 text-xl font-semibold text-white">
                {formatCurrency(position.monthlyYield)}
              </div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Monthly Payment</div>
              <div className="mt-1 text-xl font-semibold text-white">
                {formatCurrency(position.monthlyPayment)}
              </div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Yield Surplus</div>
              <div className="mt-1 text-xl font-semibold text-emerald-400">
                +{formatCurrency(position.yieldSurplus)}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-sm text-zinc-400">Next Payment Due</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {position.nextPaymentDue}
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              {position.nextPaymentCountdown}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Escrow Details
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-zinc-400">Seller address</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {truncateAddress(position.sellerAddress)}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300"
              >
                Copy
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-zinc-400">Chain</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
                  {position.chainLabel}
                  {position.crossChain ? (
                    <span className="rounded-full border border-[#F7931A]/40 bg-[#F7931A]/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#F7931A]">
                      Wormhole
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Total property price</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {position.totalPropertyPrice.toLocaleString()} MUSD
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Installments paid</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {position.installmentsPaid} of {position.totalInstallments}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Escrow balance</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {position.escrowBalance.toFixed(2)} MUSD
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => onAction("add-collateral", position)}
          className="brand-button"
        >
          Add Collateral
        </button>
        <button
          type="button"
          onClick={() => onAction("repay-early", position)}
          className="ghost-button"
        >
          Repay Early
        </button>
        <Link
          href={`https://explorer.test.mezo.org/token/${position.tokenId.toString()}`}
          target="_blank"
          className="ghost-button"
        >
          View NFT
        </Link>
        <button
          type="button"
          onClick={() => onAction("close-position", position)}
          className="rounded-lg border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/50"
        >
          Close Position
        </button>
      </div>
    </article>
  );
}
