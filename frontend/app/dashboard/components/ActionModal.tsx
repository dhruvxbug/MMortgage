"use client";

import { useEffect, useState } from "react";

import type {
  DashboardAction,
  DashboardPosition,
} from "@/app/dashboard/components/types";

type ActionModalProps = {
  action: DashboardAction | null;
  isPending: boolean;
  isOpen: boolean;
  position: DashboardPosition | null;
  onClose: () => void;
  onSubmit: (amount?: string) => void;
};

function getCopy(action: DashboardAction | null): {
  title: string;
  description: string;
  buttonLabel: string;
  needsAmount: boolean;
} {
  switch (action) {
    case "add-collateral":
      return {
        title: "Add BTC Collateral",
        description:
          "Increase the vault buffer to improve liquidation safety and extend the margin for BTC volatility.",
        buttonLabel: "Add Collateral",
        needsAmount: true,
      };
    case "repay-early":
      return {
        title: "Repay Early",
        description:
          "Reduce outstanding MUSD debt ahead of schedule to improve the position health and shorten payoff time.",
        buttonLabel: "Repay MUSD",
        needsAmount: true,
      };
    case "close-position":
      return {
        title: "Close Position",
        description:
          "Closing repays the full debt and unlocks the BTC collateral. Review carefully before continuing.",
        buttonLabel: "Close Position",
        needsAmount: false,
      };
    default:
      return {
        title: "",
        description: "",
        buttonLabel: "",
        needsAmount: false,
      };
  }
}

export default function ActionModal({
  action,
  isPending,
  isOpen,
  position,
  onClose,
  onSubmit,
}: ActionModalProps) {
  const [amount, setAmount] = useState("");
  const copy = getCopy(action);

  useEffect(() => {
    if (!isOpen) {
      setAmount("");
    }
  }, [isOpen]);

  if (!isOpen || !action || !position) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/80 px-4 py-6 backdrop-blur">
      <div className="w-full max-w-xl rounded-[32px] border border-zinc-800 bg-zinc-900 p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Position #{position.tokenId.toString()}
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {copy.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-700 px-3 py-2 text-sm text-zinc-400"
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-sm leading-7 text-zinc-400">{copy.description}</p>

        {copy.needsAmount ? (
          <div className="mt-6 rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
            <label className="text-sm font-semibold text-zinc-200">
              {action === "add-collateral" ? "Amount (BTC)" : "Amount (MUSD)"}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none"
            />
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-red-400/30 bg-red-500/10 p-4 text-sm leading-7 text-red-100">
            This action repays all debt and permanently closes the mortgage
            position.
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="ghost-button">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(amount)}
            disabled={isPending || (copy.needsAmount && Number(amount) <= 0)}
            className="brand-button disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Submitting..." : copy.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
