const level = process.env.LOG_LEVEL ?? "info";

function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`[${timestamp()}] [INFO]  ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[${timestamp()}] [WARN]  ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[${timestamp()}] [ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => {
    if (level === "debug") {
      console.log(`[${timestamp()}] [DEBUG] ${msg}`, ...args);
    }
  },
};
