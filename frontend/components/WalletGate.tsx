"use client";

import type { ReactNode } from "react";

import { useAccount } from "wagmi";

import { WalletConnectButton } from "@/components/WalletConnectButton";

type WalletGateProps = {
  children: ReactNode;
  title?: string;
  description?: string;
};

export default function WalletGate({
  children,
  title = "Connect your Bitcoin wallet to continue",
  description = "MezoMortgage uses Mezo Passport so you can connect Xverse, Unisat, and standard EVM wallets from one place.",
}: WalletGateProps) {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="paper-panel overflow-hidden">
          <div className="bg-grid-paper border-b-2 border-zinc-900 px-6 py-5">
            <span className="section-label border-zinc-900 bg-white/70 text-zinc-950">
              Wallet Required
            </span>
          </div>
          <div className="space-y-6 px-6 py-8 sm:px-8">
            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-balance sm:text-4xl">
                {title}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-zinc-700">
                {description}
              </p>
            </div>
            <WalletConnectButton />
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
