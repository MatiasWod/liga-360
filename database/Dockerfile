FROM node:20-alpine
WORKDIR /app
COPY database/package.json database/package-lock.json ./
RUN npm ci --omit=dev
COPY database/migrations ./migrations
ENV NODE_ENV=production
CMD ["npm", "run", "migrate"]
