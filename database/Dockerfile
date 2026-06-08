FROM node:20-alpine
WORKDIR /app
COPY database/package.json database/package-lock.json ./
RUN npm ci --omit=dev
COPY database/migrations ./migrations
COPY database/migrations-teams ./migrations-teams
COPY database/migrations-identity ./migrations-identity
ENV NODE_ENV=production
CMD ["npm", "run", "migrate"]
