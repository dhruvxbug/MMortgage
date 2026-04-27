"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { demoScenario } from "@/lib/demo";

type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
};

type NumberFieldProps = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
};

type StatCardProps = {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

type StepCardProps = {
  index: string;
  title: string;
  description: string;
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: SliderFieldProps) {
  return (
    <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-semibold text-zinc-950">{label}</label>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-600">
          {value.toFixed(step < 1 ? 2 : 0)}
          {suffix ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-[#F7931A]"
      />
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-zinc-400">
        <span>
          {min}
          {suffix ?? ""}
        </span>
        <span>
          {max}
          {suffix ?? ""}
        </span>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  prefix,
  suffix,
  step = 1,
  min = 0,
  onChange,
}: NumberFieldProps) {
  return (
    <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white px-4 py-4">
      <label className="text-sm font-semibold text-zinc-950">{label}</label>
      <div className="flex items-center rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        {prefix ? (
          <span className="mr-2 text-sm font-semibold text-zinc-500">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full bg-transparent text-lg font-semibold text-zinc-950 outline-none"
        />
        {suffix ? (
          <span className="ml-2 text-sm font-semibold text-zinc-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }: StatCardProps) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-950"
          : "border-zinc-800 bg-zinc-900 text-white";

  return (
    <div className={`rounded-[28px] border p-5 ${toneClasses}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70">
        {label}
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        {value}
      </div>
    </div>
  );
}

function StepCard({ index, title, description }: StepCardProps) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white p-6">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-zinc-950 bg-[#F7931A] text-lg font-semibold text-zinc-950">
        {index}
      </div>
      <h3 className="text-xl font-semibold text-zinc-950">{title}</h3>
      <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-600">
        {description}
      </p>
    </div>
  );
}

export default function HomePage() {
  const [btcHoldings, setBtcHoldings] = useState<number>(
    demoScenario.btcHoldings,
  );
  const [btcPrice, setBtcPrice] = useState<number>(demoScenario.btcPrice);
  const [ltv, setLtv] = useState<number>(demoScenario.ltv);
  const [vaultApy, setVaultApy] = useState<number>(demoScenario.vaultApy);

  const calculations = useMemo(() => {
    const borrowed = btcHoldings * btcPrice * (ltv / 100);
    const annualYield = borrowed * (vaultApy / 100);
    const borrowCost = borrowed * 0.01;
    const netMonthlyPayment = (annualYield - borrowCost) / 12;
    const propertyBudget = netMonthlyPayment * 12 * demoScenario.payoffYears;
    const effectiveYieldApy =
      ((annualYield - borrowCost) / (btcHoldings * btcPrice)) * 100;
    const collateralRatio =
      borrowed === 0 ? 0 : (btcHoldings * btcPrice * 100) / borrowed;
    const overCollateralized = collateralRatio / 100;

    return {
      borrowed,
      annualYield,
      borrowCost,
      netMonthlyPayment,
      propertyBudget,
      effectiveYieldApy,
      collateralRatio,
      overCollateralized,
    };
  }, [btcHoldings, btcPrice, ltv, vaultApy]);

  const ratioTone: StatCardProps["tone"] =
    calculations.collateralRatio > 200
      ? "success"
      : calculations.collateralRatio >= 150
        ? "warning"
        : "danger";

  return (
    <div className="pb-20">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="paper-panel overflow-hidden">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="section-label border-zinc-900 bg-white/70 text-zinc-950">
                  Bank On Bitcoin
                </span>
                <span className="rounded-full border border-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700">
                  1% borrow rate
                </span>
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight text-balance sm:text-6xl lg:text-7xl">
                  Your Bitcoin pays for your house.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-zinc-700 sm:text-xl">
                  Borrow against BTC at 1%. Earn 4–8% yield. Watch yield
                  automatically make your property payments. Keep your Bitcoin
                  forever.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/open" className="brand-button">
                  Open a Mortgage
                </Link>
                <Link
                  href="/#how-it-works"
                  className="ghost-button border-zinc-300 text-zinc-950 hover:bg-white"
                >
                  How it works
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[26px] border border-zinc-200 bg-white p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    BTC stays yours
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-zinc-950">
                    Never sell
                  </div>
                </div>
                <div className="rounded-[26px] border border-zinc-200 bg-white p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    Stable spending rail
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-zinc-950">
                    Borrow in MUSD
                  </div>
                </div>
                <div className="rounded-[26px] border border-zinc-200 bg-white p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    Yield routing
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-zinc-950">
                    Escrow auto-pay
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-grid-paper border-l-0 border-t-2 border-zinc-900 p-6 lg:border-l-2 lg:border-t-0">
              <div className="relative mx-auto flex max-w-md flex-col gap-4">
                <div className="rounded-[34px] border-2 border-zinc-900 bg-zinc-950 p-5 text-white shadow-frame">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-zinc-400">
                        Mortgage preview
                      </div>
                      <div className="mt-2 text-2xl font-semibold">
                        0.50 BTC powers a home
                      </div>
                    </div>
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-[#F7931A] text-2xl text-zinc-950">
                      B
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3">
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Collateral
                      </div>
                      <div className="mt-2 text-3xl font-semibold">
                        0.50 BTC
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {formatCurrency(
                          demoScenario.btcHoldings * demoScenario.btcPrice,
                        )}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-zinc-800 bg-white p-4 text-zinc-950">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Routed monthly
                      </div>
                      <div className="mt-2 text-3xl font-semibold">
                        {formatCurrency(demoScenario.netMonthlyPayment)}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500">
                        Net yield after borrow cost
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ml-auto rounded-[26px] border-2 border-zinc-900 bg-[#F7931A] px-5 py-4 text-zinc-950 shadow-frame">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-800">
                    Tagline
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    Bank-free. Sell-free. Debt that pays itself.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="dark-panel overflow-hidden">
          <div className="grid gap-0 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-zinc-800 bg-brand-paper p-6 text-zinc-950 xl:border-b-0 xl:border-r">
              <div className="flex flex-wrap items-center gap-3">
                <span className="section-label border-zinc-900 bg-white/70 text-zinc-950">
                  Interactive Mortgage Calculator
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <SliderField
                  label="BTC Holdings"
                  value={btcHoldings}
                  min={0.1}
                  max={5}
                  step={0.01}
                  suffix=" BTC"
                  onChange={setBtcHoldings}
                />
                <NumberField
                  label="BTC Price"
                  value={btcPrice}
                  prefix="$"
                  step={1000}
                  min={1000}
                  onChange={setBtcPrice}
                />
                <SliderField
                  label="Loan-to-Value"
                  value={ltv}
                  min={30}
                  max={70}
                  step={1}
                  suffix="%"
                  onChange={setLtv}
                />
                <SliderField
                  label="Vault APY"
                  value={vaultApy}
                  min={3}
                  max={12}
                  step={0.1}
                  suffix="%"
                  onChange={setVaultApy}
                />
              </div>
            </div>

            <div className="bg-grid-slate p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <StatCard
                  label="MUSD Borrowed"
                  value={formatCurrency(calculations.borrowed)}
                />
                <StatCard
                  label="Net Monthly Payment"
                  value={formatCurrency(calculations.netMonthlyPayment)}
                />
                <StatCard
                  label="Property Budget"
                  value={formatCurrency(calculations.propertyBudget)}
                />
                <StatCard
                  label="Collateral Ratio"
                  value={`${calculations.collateralRatio.toFixed(2)}%`}
                  tone={ratioTone}
                />
              </div>

              <div className="mt-5 rounded-[28px] border border-zinc-800 bg-zinc-950/90 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Annual Yield
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {formatCurrency(calculations.annualYield)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Borrow Cost
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {formatCurrency(calculations.borrowCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Effective BTC Yield APY
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {calculations.effectiveYieldApy.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Payoff Horizon
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {demoScenario.payoffYears} years
                    </div>
                  </div>
                </div>

                <p className="mt-5 border-t border-zinc-800 pt-5 text-sm leading-7 text-zinc-300">
                  At current settings, your BTC collateral is{" "}
                  <span className="font-semibold text-white">
                    {calculations.overCollateralized.toFixed(2)}x
                  </span>{" "}
                  overcollateralized. Liquidation triggers at 130%.
                </p>

                <Link
                  href="/open"
                  className="mt-6 inline-flex items-center text-sm font-semibold text-[#F7931A]"
                >
                  Open this mortgage →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="paper-panel overflow-hidden">
          <div className="bg-grid-orange border-b-2 border-zinc-900 px-6 py-5">
            <span className="section-label border-zinc-900 bg-white/70 text-zinc-950">
              How It Works
            </span>
          </div>
          <div className="space-y-8 px-6 py-8 sm:px-10">
            <div className="max-w-3xl">
              <h2 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                Borrow in MUSD. Earn yield. Route it to real property payments.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-600">
                MezoMortgage turns BTC collateral into a self-repaying property
                engine, built around MUSD and Mezo-native yield rails.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <StepCard
                index="1"
                title="Deposit BTC → Mint MUSD at 1%"
                description="Lock BTC on Mezo, open a mortgage vault, and mint MUSD against a safe overcollateralized position."
              />
              <StepCard
                index="2"
                title="MUSD earns yield in Mezo vault"
                description="Borrowed MUSD goes straight into the Mezo Savings Vault, where it keeps compounding instead of sitting idle."
              />
              <StepCard
                index="3"
                title="Yield auto-pays your installments"
                description="Net yield flows into escrow and releases scheduled payments to the seller without forcing a BTC sale."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
