import type { DashboardPosition } from "@/app/dashboard/components/types";

type HealthAlertBannerProps = {
  position: DashboardPosition;
  onAddCollateral: (position: DashboardPosition) => void;
};

export default function HealthAlertBanner({
  position,
  onAddCollateral,
}: HealthAlertBannerProps) {
  const severe = position.collateralRatio < 135;

  return (
    <div
      className={`mb-6 flex flex-col gap-4 rounded-[28px] border p-5 sm:flex-row sm:items-center sm:justify-between ${
        severe
          ? "border-red-300 bg-red-50 text-red-950"
          : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
    >
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-[0.2em] opacity-70">
          Position Health
        </div>
        <div className="text-base font-semibold">
          {severe
            ? `Position #${position.tokenId.toString()} is near liquidation.`
            : `Position #${position.tokenId.toString()} is approaching minimum collateral ratio.`}
        </div>
        <p className="text-sm">
          Consider adding BTC collateral before the market moves against the
          vault.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onAddCollateral(position)}
        className="inline-flex items-center justify-center rounded-lg border border-current px-4 py-3 text-sm font-semibold"
      >
        Add Collateral
      </button>
    </div>
  );
}
