"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { type Chain } from "viem";

const mezoTestnet: Chain = {
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.test.mezo.org"] },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" },
  },
};

export const chains = [mezoTestnet] as const;

export const config = getDefaultConfig({
  appName: "MezoMortgage",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    "da82adaa55c7e1ef57617ea0bdf7c8bf",
  chains: [mezoTestnet],
  ssr: true,
});
