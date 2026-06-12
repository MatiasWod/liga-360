FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/ ./packages/shared/
COPY services/teams-svc/ ./services/teams-svc/

RUN npm ci --workspace=teams-svc --omit=dev

ENV NODE_ENV=production
EXPOSE 4002
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=15s \
  CMD node -e "fetch('http://localhost:4002/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["node", "services/teams-svc/src/index.js"]

