# MezoMortgage Keeper

Off-chain automation service for MezoMortgage.

## Responsibilities

- Hourly health checks (`LiquidationBuffer.checkHealth`) with mitigation triggers
- Daily yield harvest + route to escrow
- Daily installment release for due escrows
- Real-time BTC oracle monitoring via Spectrum Nodes WebSocket

## Environment

Copy `.env.example` to `.env` and set real values.

## Commands

```bash
npm install
npm run build
npm run dev
npm start
```

## Docker

From repository root:

```bash
docker build -t mezomortgage-keeper .
docker run --env-file keeper/.env mezomortgage-keeper
```

## Notes

- Cron jobs use UTC.
- Keeper catches task-level errors and keeps running.
- WebSocket reconnect uses exponential backoff with max 5 retries.
