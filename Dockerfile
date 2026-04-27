FROM node:20-alpine AS builder
WORKDIR /app
COPY keeper/package*.json ./
RUN npm ci
COPY keeper/ .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 keeper && \
    adduser --system --uid 1001 keeper
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/abi ./abi
USER keeper
CMD ["node", "dist/index.js"]
