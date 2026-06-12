FROM node:20-alpine
WORKDIR /app
COPY database/package.json database/package-lock.json ./
RUN npm ci --omit=dev
# DB-per-service: cada servicio corre su propio dir de migraciones (npm run migrate:<svc>).
COPY database/migrations-auth ./migrations-auth
COPY database/migrations-teams ./migrations-teams
COPY database/migrations-inscriptions ./migrations-inscriptions
COPY database/migrations-matchevents ./migrations-matchevents
ENV NODE_ENV=production
# El comando concreto lo fija cada Job/servicio (migrate:auth | migrate:teams | migrate:inscriptions).
CMD ["npm", "run", "migrate:teams"]

