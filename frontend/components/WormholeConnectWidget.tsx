"use client";

import dynamic from "next/dynamic";
import { useMemo, type ComponentType } from "react";
import type {
  Chain,
  WormholeConnectTheme,
  config,
} from "@wormhole-foundation/wormhole-connect";
import {
  nttExecutorRoute,
  type NttRoute,
} from "@wormhole-foundation/wormhole-connect/ntt";

type DestinationChain = "Ethereum" | "Base";

type WormholeConnectWidgetProps = {
  isActive: boolean;
  destinationChain?: DestinationChain;
};

type ConnectProps = {
  config: config.WormholeConnectConfig;
  theme?: WormholeConnectTheme;
};

const WormholeConnect = dynamic<ConnectProps>(
  () =>
    import("@wormhole-foundation/wormhole-connect").then(
      (mod) => mod.default as ComponentType<ConnectProps>,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-950" />
    ),
  },
);

const SOURCE_CHAIN: Chain = "Mezo";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MUSD_ICON = "https://wormhole.com/token.png";

function isAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(
    value &&
      value !== ZERO_ADDRESS &&
      /^0x[a-fA-F0-9]{40}$/.test(value),
  );
}

function getNetwork(): "Mainnet" | "Testnet" {
  return process.env.NEXT_PUBLIC_WORMHOLE_NETWORK === "Mainnet"
    ? "Mainnet"
    : "Testnet";
}

function getDestinationChain(
  destinationChain: DestinationChain,
  network: "Mainnet" | "Testnet",
): Chain {
  if (network === "Mainnet") {
    return destinationChain;
  }

  return destinationChain === "Base" ? "BaseSepolia" : "Sepolia";
}

function getDestinationTokenAddress(
  destinationChain: DestinationChain,
  network: "Mainnet" | "Testnet",
): string | undefined {
  if (network === "Mainnet") {
    return destinationChain === "Base"
      ? process.env.NEXT_PUBLIC_BASE_MUSD_TOKEN_ADDRESS
      : process.env.NEXT_PUBLIC_ETHEREUM_MUSD_TOKEN_ADDRESS;
  }

  return destinationChain === "Base"
    ? process.env.NEXT_PUBLIC_BASE_SEPOLIA_MUSD_TOKEN_ADDRESS
    : process.env.NEXT_PUBLIC_SEPOLIA_MUSD_TOKEN_ADDRESS;
}

function getDestinationManagerAddress(
  destinationChain: DestinationChain,
  network: "Mainnet" | "Testnet",
): string | undefined {
  if (network === "Mainnet") {
    return destinationChain === "Base"
      ? process.env.NEXT_PUBLIC_BASE_NTT_MANAGER_ADDRESS
      : process.env.NEXT_PUBLIC_ETHEREUM_NTT_MANAGER_ADDRESS;
  }

  return destinationChain === "Base"
    ? process.env.NEXT_PUBLIC_BASE_SEPOLIA_NTT_MANAGER_ADDRESS
    : process.env.NEXT_PUBLIC_SEPOLIA_NTT_MANAGER_ADDRESS;
}

function getDestinationTransceiverAddress(
  destinationChain: DestinationChain,
  network: "Mainnet" | "Testnet",
): string | undefined {
  if (network === "Mainnet") {
    return destinationChain === "Base"
      ? process.env.NEXT_PUBLIC_BASE_NTT_TRANSCEIVER_ADDRESS
      : process.env.NEXT_PUBLIC_ETHEREUM_NTT_TRANSCEIVER_ADDRESS;
  }

  return destinationChain === "Base"
    ? process.env.NEXT_PUBLIC_BASE_SEPOLIA_NTT_TRANSCEIVER_ADDRESS
    : process.env.NEXT_PUBLIC_SEPOLIA_NTT_TRANSCEIVER_ADDRESS;
}

function buildNttTokenConfig(
  chain: Chain,
  token: string | undefined,
  manager: string | undefined,
  transceiver: string | undefined,
): NttRoute.TokenConfig | undefined {
  if (!isAddress(token) || !isAddress(manager) || !isAddress(transceiver)) {
    return undefined;
  }

  return {
    chain,
    token,
    manager,
    transceiver: [
      {
        address: transceiver,
        type: "wormhole",
      },
    ],
  };
}

export default function WormholeConnectWidget({
  isActive,
  destinationChain = "Ethereum",
}: WormholeConnectWidgetProps) {
  const { connectConfig, isConfigured } = useMemo(() => {
    const network = getNetwork();
    const destination = getDestinationChain(destinationChain, network);
    const sourceToken =
      process.env.NEXT_PUBLIC_MEZO_MUSD_TOKEN_ADDRESS ??
      process.env.NEXT_PUBLIC_MUSD_TOKEN_ADDRESS;
    const sourceManager = process.env.NEXT_PUBLIC_MEZO_NTT_MANAGER_ADDRESS;
    const sourceTransceiver =
      process.env.NEXT_PUBLIC_MEZO_NTT_TRANSCEIVER_ADDRESS;
    const destinationToken = getDestinationTokenAddress(
      destinationChain,
      network,
    );
    const destinationManager = getDestinationManagerAddress(
      destinationChain,
      network,
    );
    const destinationTransceiver = getDestinationTransceiverAddress(
      destinationChain,
      network,
    );

    const sourceNtt = buildNttTokenConfig(
      SOURCE_CHAIN,
      sourceToken,
      sourceManager,
      sourceTransceiver,
    );
    const destinationNtt = buildNttTokenConfig(
      destination,
      destinationToken,
      destinationManager,
      destinationTransceiver,
    );
    const nttTokens =
      sourceNtt && destinationNtt ? [sourceNtt, destinationNtt] : undefined;

    const wormholeConfig: config.WormholeConnectConfig = {
      network,
      chains: [SOURCE_CHAIN, destination],
      tokens: ["MUSD"],
      rpcs: {
        Mezo:
          process.env.NEXT_PUBLIC_SPECTRUM_NODES_HTTP_URL ??
          "https://rpc.test.mezo.org",
      },
      ui: {
        title: "MezoMortgage MUSD Bridge",
        defaultInputs: {
          source: {
            chain: SOURCE_CHAIN,
            token: "MUSD",
          },
          destination: {
            chain: destination,
            token: "MUSD",
          },
          preferredRouteName: "NTT Executor",
        },
        disableUserInputtedTokens: true,
        hideRouteSelectionPills: true,
      },
      tokensConfig:
        isAddress(sourceToken) && isAddress(destinationToken)
          ? {
              MUSDmezo: {
                symbol: "MUSD",
                name: "Mezo USD",
                decimals: 18,
                icon: MUSD_ICON,
                tokenId: {
                  chain: SOURCE_CHAIN,
                  address: sourceToken,
                },
              },
              MUSDdestination: {
                symbol: "MUSD",
                name: "Mezo USD",
                decimals: 18,
                icon: MUSD_ICON,
                tokenId: {
                  chain: destination,
                  address: destinationToken,
                },
              },
            }
          : undefined,
      routes: nttTokens
        ? [
            nttExecutorRoute({
              ntt: {
                tokens: {
                  MUSD_NTT: nttTokens,
                },
              },
            }),
          ]
        : undefined,
    };

    return {
      connectConfig: wormholeConfig,
      isConfigured: Boolean(nttTokens),
    };
  }, [destinationChain]);

  if (!isActive) {
    return null;
  }

  const theme: WormholeConnectTheme = {
    mode: "dark",
    primary: "#F7931A",
    background: "#09090B",
    text: "#FFFFFF",
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {isConfigured ? (
        <WormholeConnect config={connectConfig} theme={theme} />
      ) : (
        <div className="rounded-lg border border-[#F7931A]/30 bg-[#F7931A]/10 p-4 text-sm leading-6 text-zinc-100">
          Wormhole Connect is ready for cross-chain escrows once the Mezo MUSD
          NTT manager, transceiver, and destination token addresses are set in
          the public environment variables.
        </div>
      )}
    </section>
  );
}
