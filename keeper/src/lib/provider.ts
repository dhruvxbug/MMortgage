import { ethers } from "ethers";
import { log } from "./logger";

const HTTP_URL = process.env.SPECTRUM_NODES_HTTP_URL;
const WS_URL = process.env.SPECTRUM_NODES_WS_URL;

if (!HTTP_URL) throw new Error("SPECTRUM_NODES_HTTP_URL is not set");
if (!WS_URL) throw new Error("SPECTRUM_NODES_WS_URL is not set");

export const httpProvider = new ethers.JsonRpcProvider(HTTP_URL);

const MAX_RETRIES = 5;
type WsConsumer = (provider: ethers.WebSocketProvider) => void;

let wsProvider: ethers.WebSocketProvider | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let shuttingDown = false;
const wsConsumers = new Set<WsConsumer>();

function notifyConsumers(provider: ethers.WebSocketProvider): void {
  for (const consumer of wsConsumers) {
    try {
      consumer(provider);
    } catch (error) {
      log.error("WebSocket consumer callback failed:", error);
    }
  }
}

function attachSocketListeners(provider: ethers.WebSocketProvider): void {
  const socket = provider.websocket as {
    addEventListener?: (event: string, cb: (arg?: unknown) => void) => void;
    on?: (event: string, cb: (arg?: unknown) => void) => void;
  };

  const onClose = () => {
    if (shuttingDown) {
      return;
    }

    wsProvider = null;
    reconnectAttempts += 1;

    if (reconnectAttempts > MAX_RETRIES) {
      log.error(
        `WebSocket reconnect attempts exceeded (${MAX_RETRIES}). Real-time monitoring disabled until restart.`,
      );
      return;
    }

    const delayMs = Math.min(2 ** (reconnectAttempts - 1) * 1000, 30_000);
    log.warn(
      `WebSocket closed. Reconnecting in ${delayMs}ms (attempt ${reconnectAttempts}/${MAX_RETRIES})...`,
    );

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocketProvider();
    }, delayMs);
  };

  const onError = (err?: unknown) => {
    log.error("WebSocket error:", err);
  };

  if (typeof socket.addEventListener === "function") {
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError);
    return;
  }

  if (typeof socket.on === "function") {
    socket.on("close", onClose);
    socket.on("error", onError);
  }
}

function connectWebSocketProvider(): ethers.WebSocketProvider {
  const provider = new ethers.WebSocketProvider(WS_URL!);
  wsProvider = provider;
  attachSocketListeners(provider);
  reconnectAttempts = 0;
  log.info("WebSocket provider connected.");
  notifyConsumers(provider);
  return provider;
}

export function getWebSocketProvider(
): ethers.WebSocketProvider {
  if (wsProvider) {
    return wsProvider;
  }
  return connectWebSocketProvider();
}

export function onWebSocketProviderReady(consumer: WsConsumer): () => void {
  wsConsumers.add(consumer);
  if (wsProvider) {
    consumer(wsProvider);
  }
  return () => {
    wsConsumers.delete(consumer);
  };
}

export async function shutdownProviders(): Promise<void> {
  shuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (wsProvider) {
    try {
      await wsProvider.destroy();
      log.info("WebSocket provider closed.");
    } catch (error) {
      log.warn("Error while closing WebSocket provider:", error);
    } finally {
      wsProvider = null;
    }
  }
}
