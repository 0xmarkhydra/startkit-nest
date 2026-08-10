FROM node:20-alpine AS build

WORKDIR /app
RUN npm install --global pnpm@9.15.9

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV APP_ENV=production
WORKDIR /app

RUN apk add --no-cache tini

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/scripts/typeorm-cli.mjs ./scripts/typeorm-cli.mjs

USER node
EXPOSE 8000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
