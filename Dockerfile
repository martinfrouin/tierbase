FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# Pages are prerendered from the database, so the build needs to reach it
ARG DATABASE_URL
RUN DATABASE_URL=$DATABASE_URL npm run build

FROM node:24-alpine AS app
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:24-alpine AS worker
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY scripts ./scripts
COPY db ./db
COPY data/*.json data/*.txt ./data/
CMD ["sh", "scripts/worker.sh"]
