## --- web-build: build React+Tailwind frontend ---
FROM node:20-alpine AS web-build

WORKDIR /web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build -- --outDir dist --emptyOutDir

## --- server-build: build TypeScript backend ---
FROM node:20-alpine AS server-build

WORKDIR /server

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

## --- runtime: small image with dist + public + prod deps ---
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=server-build /server/dist ./dist
COPY --from=web-build /web/dist ./public

EXPOSE 3000

CMD ["node", "dist/index.js"]

