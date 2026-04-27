"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

type WalletConnectButtonProps = {
  variant?: "primary" | "compact";
  className?: string;
};

function truncateAddress(address?: string): string {
  if (!address) {
    return "Connect Wallet";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnectButton({
  variant = "primary",
  className = "",
}: WalletConnectButtonProps) {
  const baseClasses =
    variant === "compact"
      ? "inline-flex h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:border-zinc-500"
      : "inline-flex h-12 items-center justify-center rounded-lg border-2 border-[#F7931A] bg-[#F7931A] px-5 text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5 hover:bg-[#ffae4a]";

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={`${baseClasses} ${className}`.trim()}
            >
              Connect Wallet
            </button>
          );
        }

        return (
          <div className={`flex items-center gap-2 ${className}`.trim()}>
            <button
              type="button"
              onClick={openChainModal}
              className="hidden rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300 md:inline-flex"
            >
              {chain.name}
            </button>
            <button
              type="button"
              onClick={openAccountModal}
              className={`${baseClasses} min-w-[9.5rem]`.trim()}
            >
              {account.displayName ?? truncateAddress(account.address)}
              <span className="ml-2 rounded-full bg-zinc-950/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                {truncateAddress(account.address)}
              </span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
