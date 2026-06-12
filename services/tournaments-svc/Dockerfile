FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY schema.graphql ./schema.graphql
ENV NODE_ENV=production
EXPOSE 4001
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=20s \
  CMD node -e "fetch('http://localhost:4001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["npm", "start"]

