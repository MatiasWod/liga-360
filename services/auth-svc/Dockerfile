FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
ENV NODE_ENV=production
EXPOSE 4003
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=15s \
  CMD node -e "fetch('http://localhost:4003/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["npm", "start"]
