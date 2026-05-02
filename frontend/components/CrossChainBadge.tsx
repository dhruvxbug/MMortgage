"use client";

type CrossChainBadgeProps = {
  chain: string;
  className?: string;
};

function getChainMark(chain: string): string {
  const normalized = chain.toLowerCase();

  if (normalized.includes("base")) {
    return "B";
  }

  if (
    normalized.includes("ethereum") ||
    normalized.includes("sepolia")
  ) {
    return "ETH";
  }

  return "NTT";
}

export default function CrossChainBadge({
  chain,
  className = "",
}: CrossChainBadgeProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span className="inline-flex items-center gap-2 rounded-full border border-[#F7931A]/40 bg-[#F7931A]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F7931A]">
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#F7931A] px-1 text-[9px] font-bold tracking-normal text-zinc-950">
          {getChainMark(chain)}
        </span>
        Wormhole NTT
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs normal-case leading-5 tracking-normal text-zinc-200 opacity-0 shadow-panel transition group-hover:opacity-100 group-focus-within:opacity-100">
        Installments bridge automatically via Wormhole Native Token Transfer.
        No action needed.
      </span>
    </span>
  );
}
