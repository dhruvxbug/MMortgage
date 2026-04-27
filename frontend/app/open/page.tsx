"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type Address, isAddress, parseEther, parseUnits } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import ReviewLine from "@/app/open/components/ReviewLine";
import StepIndicator from "@/app/open/components/StepIndicator";
import SuccessAnimation from "@/app/open/components/SuccessAnimation";
import { CONTRACT_ADDRESSES, mortgageVaultAbi } from "@/lib/contracts";
import { demoScenario } from "@/lib/demo";
import { chains } from "@/lib/wagmi-config";

type PaymentFrequency = "monthly" | "quarterly";
type DestinationChain = "Mezo" | "Ethereum" | "Base";

const stepLabels = [
  "Configure Position",
  "Set Up Escrow",
  "Review & Confirm",
  "Mortgage Opened",
];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

export default function OpenMortgagePage() {
  const [step, setStep] = useState(1);
  const [btcCollateral, setBtcCollateral] = useState<number>(
    demoScenario.btcHoldings,
  );
  const [ltv, setLtv] = useState<number>(demoScenario.ltv);
  const [sellerAddress, setSellerAddress] = useState("");
  const [isCrossChain, setIsCrossChain] = useState(false);
  const [destinationChain, setDestinationChain] =
    useState<DestinationChain>("Ethereum");
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequency>("monthly");
  const [propertyPrice, setPropertyPrice] = useState<number>(
    demoScenario.propertyBudget,
  );
  const [acknowledged, setAcknowledged] = useState(false);

  const minFirstPaymentDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return formatDateInput(date);
  }, []);

  const [firstPaymentDate, setFirstPaymentDate] = useState(minFirstPaymentDate);

  const {
    data: transactionHash,
    error: writeError,
    isPending: isSubmitting,
    writeContract,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  const btcPrice = demoScenario.btcPrice;
  const musdBorrowed = btcCollateral * btcPrice * (ltv / 100);
  const collateralRatio =
    musdBorrowed === 0 ? 0 : (btcCollateral * btcPrice * 100) / musdBorrowed;
  const installmentCount = paymentFrequency === "monthly" ? 120 : 40;
  const installmentAmount =
    propertyPrice > 0 ? propertyPrice / installmentCount : 0;
  const projectedMonthlyYield =
    (musdBorrowed * (demoScenario.vaultApy / 100)) / 12;
  const installmentCoverage =
    paymentFrequency === "monthly"
      ? (projectedMonthlyYield / Math.max(installmentAmount, 1)) * 100
      : ((projectedMonthlyYield * 3) / Math.max(installmentAmount, 1)) * 100;

  const stepOneValid = btcCollateral > 0.1 && collateralRatio > 150;
  const stepTwoValid =
    isAddress(sellerAddress) &&
    propertyPrice > 0 &&
    firstPaymentDate >= minFirstPaymentDate;
  const stepThreeValid = acknowledged;

  const transactionError = writeError ?? receiptError;
  const mintedNftId = transactionHash
    ? Number.parseInt(transactionHash.slice(2, 6), 16) % 10000
    : 2048;

  useEffect(() => {
    if (isConfirmed) {
      setStep(4);
    }
  }, [isConfirmed]);

  function handleNext(): void {
    if (step === 1 && stepOneValid) {
      setStep(2);
    }

    if (step === 2 && stepTwoValid) {
      setStep(3);
    }
  }

  function handleBack(): void {
    setStep((current) => Math.max(1, current - 1));
  }

  function handleOpenMortgage(): void {
    if (!stepThreeValid) {
      return;
    }

    writeContract({
      address: CONTRACT_ADDRESSES.mortgageVault,
      abi: mortgageVaultAbi,
      functionName: "openMortgage",
      args: [
        parseEther(btcCollateral.toString()),
        parseUnits(musdBorrowed.toFixed(2), 18),
        sellerAddress as Address,
        parseUnits(propertyPrice.toFixed(2), 18),
        BigInt(Math.floor(new Date(firstPaymentDate).getTime() / 1000)),
        paymentFrequency === "monthly" ? 0 : 1,
        isCrossChain,
        isCrossChain ? destinationChain : "Mezo",
      ],
      chainId: chains[0].id,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <StepIndicator step={step} totalSteps={4} labels={stepLabels} />

      <div className="mt-8 rounded-[32px] border border-zinc-800 bg-zinc-900/90 p-6 shadow-panel sm:p-8">
        {step === 1 ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                <label className="text-sm font-semibold text-zinc-200">
                  BTC Collateral Amount
                </label>
                <div className="mt-3 flex items-center rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                  <input
                    type="number"
                    min={0.1}
                    step={0.01}
                    value={btcCollateral}
                    onChange={(event) =>
                      setBtcCollateral(Number(event.target.value))
                    }
                    className="w-full bg-transparent text-2xl font-semibold text-white outline-none"
                  />
                  <span className="text-sm font-semibold text-zinc-400">
                    BTC
                  </span>
                </div>
                <p className="mt-3 text-sm text-zinc-500">
                  Minimum position size is 0.1 BTC.
                </p>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-semibold text-zinc-200">
                    Loan-to-Value
                  </label>
                  <span className="rounded-full border border-zinc-700 px-3 py-1 text-sm font-semibold text-zinc-300">
                    {ltv.toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={70}
                  step={1}
                  value={ltv}
                  onChange={(event) => setLtv(Number(event.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-[#F7931A]"
                />
                <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <span>30%</span>
                  <span>70%</span>
                </div>
              </div>
            </div>

            <div className="paper-panel p-6">
              <span className="section-label border-zinc-900 bg-white/70 text-zinc-950">
                Position Preview
              </span>
              <div className="mt-6 space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    MUSD to borrow
                  </div>
                  <div className="mt-2 text-4xl font-semibold text-zinc-950">
                    {formatCurrency(musdBorrowed)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Collateral ratio
                  </div>
                  <div className="mt-2 text-4xl font-semibold text-zinc-950">
                    {collateralRatio.toFixed(2)}%
                  </div>
                </div>
                {collateralRatio < 160 ? (
                  <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-4 text-amber-950">
                    <div className="text-sm font-semibold">
                      Warning: this position is too close to the safety line.
                    </div>
                    <p className="mt-2 text-sm leading-6">
                      Add more BTC or reduce LTV. Positions under 160% lose
                      their buffer quickly in a BTC drawdown.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                <label className="text-sm font-semibold text-zinc-200">
                  Seller wallet address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={sellerAddress}
                  onChange={(event) => setSellerAddress(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
                />
                {sellerAddress.length > 0 && !isAddress(sellerAddress) ? (
                  <p className="mt-3 text-sm text-red-400">
                    Please enter a valid Ethereum or Mezo address.
                  </p>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-200">
                      Seller is on Ethereum/Base?
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      Use Wormhole NTT to bridge installments automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCrossChain((current) => !current)}
                    className={`relative inline-flex h-8 w-16 items-center rounded-full border transition ${
                      isCrossChain
                        ? "border-[#F7931A] bg-[#F7931A]"
                        : "border-zinc-700 bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 rounded-full bg-white transition ${
                        isCrossChain ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {isCrossChain ? (
                  <div className="mt-4 rounded-[24px] border border-[#F7931A]/40 bg-[#F7931A]/10 p-4 text-sm text-zinc-100">
                    Installments will be bridged via Wormhole NTT automatically.
                    <select
                      value={destinationChain}
                      onChange={(event) =>
                        setDestinationChain(
                          event.target.value as DestinationChain,
                        )
                      }
                      className="mt-3 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                    >
                      <option value="Ethereum">Ethereum</option>
                      <option value="Base">Base</option>
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                  <div className="text-sm font-semibold text-zinc-200">
                    Payment frequency
                  </div>
                  <div className="mt-4 grid gap-3">
                    {(["monthly", "quarterly"] as PaymentFrequency[]).map(
                      (value) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 ${
                            paymentFrequency === value
                              ? "border-[#F7931A] bg-[#F7931A]/10 text-white"
                              : "border-zinc-800 bg-zinc-900 text-zinc-300"
                          }`}
                        >
                          <span className="font-medium capitalize">
                            {value}
                          </span>
                          <input
                            type="radio"
                            name="paymentFrequency"
                            checked={paymentFrequency === value}
                            onChange={() => setPaymentFrequency(value)}
                            className="accent-[#F7931A]"
                          />
                        </label>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                  <label className="text-sm font-semibold text-zinc-200">
                    First payment date
                  </label>
                  <input
                    type="date"
                    min={minFirstPaymentDate}
                    value={firstPaymentDate}
                    onChange={(event) =>
                      setFirstPaymentDate(event.target.value)
                    }
                    className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none"
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                <label className="text-sm font-semibold text-zinc-200">
                  Total property price (MUSD)
                </label>
                <div className="mt-3 flex items-center rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                  <span className="mr-2 text-sm font-semibold text-zinc-500">
                    $
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={100}
                    value={propertyPrice}
                    onChange={(event) =>
                      setPropertyPrice(Number(event.target.value))
                    }
                    className="w-full bg-transparent text-2xl font-semibold text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="paper-panel p-6">
              <span className="section-label border-zinc-900 bg-white/70 text-zinc-950">
                Escrow Preview
              </span>
              <div className="mt-6 space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Number of installments
                  </div>
                  <div className="mt-2 text-4xl font-semibold text-zinc-950">
                    {installmentCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Installment amount
                  </div>
                  <div className="mt-2 text-4xl font-semibold text-zinc-950">
                    {formatCurrency(installmentAmount)}
                  </div>
                </div>
                <div className="rounded-[24px] border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700">
                  {paymentFrequency === "monthly"
                    ? "Monthly schedules align with the yield-first payoff model."
                    : "Quarterly schedules create larger installments with a slower release cadence."}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Review & Confirm
              </div>
              <div className="mt-4">
                <ReviewLine
                  label="BTC locked"
                  value={`${btcCollateral.toFixed(2)} BTC (${formatCurrency(btcCollateral * btcPrice)})`}
                  emphasis
                />
                <ReviewLine
                  label="MUSD borrowed"
                  value={formatCurrency(musdBorrowed)}
                />
                <ReviewLine label="LTV" value={`${ltv.toFixed(0)}%`} />
                <ReviewLine
                  label="Collateral ratio"
                  value={`${collateralRatio.toFixed(2)}%`}
                />
                <ReviewLine label="Seller address" value={sellerAddress} />
                <ReviewLine
                  label="Payment schedule"
                  value={`${paymentFrequency} starting ${firstPaymentDate}`}
                />
                <ReviewLine
                  label="Installment size"
                  value={formatCurrency(installmentAmount)}
                />
                <ReviewLine
                  label="Cross-chain"
                  value={
                    isCrossChain ? `Yes → ${destinationChain}` : "No → Mezo"
                  }
                />
                <ReviewLine
                  label="Estimated vault APY range"
                  value="4.00%–8.00%"
                />
                <ReviewLine
                  label="Projected monthly yield"
                  value={formatCurrency(projectedMonthlyYield)}
                />
                <ReviewLine
                  label="% of installment covered"
                  value={`${installmentCoverage.toFixed(2)}%`}
                />
                <ReviewLine
                  label="Fees"
                  value="1% annual borrow fee + BTC gas on Mezo"
                />
              </div>
            </div>

            <div className="paper-panel p-6">
              <span className="section-label border-zinc-900 bg-white/70 text-zinc-950">
                Final Confirmation
              </span>
              <div className="mt-6 space-y-5">
                <div className="rounded-[24px] border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700">
                  This transaction opens your MortgageVault position, mints your
                  MortgageNFT, and prepares escrow routing for the seller.
                </div>

                <label className="flex items-start gap-3 rounded-[24px] border border-zinc-200 bg-white p-4">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#F7931A]"
                  />
                  <span className="text-sm leading-6 text-zinc-700">
                    I understand my BTC will be locked until mortgage is closed.
                  </span>
                </label>

                {transactionError ? (
                  <div className="rounded-[24px] border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    {transactionError.message}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleOpenMortgage}
                  disabled={!stepThreeValid || isSubmitting || isConfirming}
                  className="brand-button w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting || isConfirming ? (
                    <span className="flex items-center justify-center gap-3">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                      Confirming transaction...
                    </span>
                  ) : (
                    "Open Mortgage"
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-8 py-8 text-center">
            <SuccessAnimation />
            <div className="space-y-4">
              <span className="section-label">Mortgage Opened</span>
              <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Mortgage Opened!
              </h2>
              <p className="mx-auto max-w-2xl text-base leading-7 text-zinc-400">
                Your vault is live, escrow is configured, and your MortgageNFT
                is ready.
              </p>
            </div>

            <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 text-left">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Transaction hash
                </div>
                <Link
                  href={`https://explorer.test.mezo.org/tx/${transactionHash ?? ""}`}
                  target="_blank"
                  className="mt-3 block break-all text-sm font-medium text-[#F7931A]"
                >
                  {transactionHash ?? "Awaiting explorer hash"}
                </Link>
              </div>
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 text-left">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  NFT minted
                </div>
                <div className="mt-3 text-lg font-semibold text-white">
                  Your MortgageNFT #{mintedNftId} has been minted
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/dashboard" className="brand-button">
                View Dashboard
              </Link>
              <Link
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                  "Just opened a Bitcoin mortgage with @MezoMortgage — my BTC is paying for real estate without me selling a single satoshi. #Bitcoin #BTCfi",
                )}`}
                target="_blank"
                className="ghost-button"
              >
                Share on Twitter
              </Link>
            </div>
          </div>
        ) : null}

        {step < 4 ? (
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-zinc-800 pt-6 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="ghost-button disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={
                  (step === 1 && !stepOneValid) || (step === 2 && !stepTwoValid)
                }
                className="brand-button disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
