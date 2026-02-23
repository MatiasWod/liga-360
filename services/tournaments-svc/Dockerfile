FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY schema.graphql ./schema.graphql
ENV NODE_ENV=production
EXPOSE 4001
CMD ["npm", "start"]



