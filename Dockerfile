FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json tsconfig*.json ./
RUN npm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig*.json ./
COPY src ./src
COPY Makefile ./Makefile
COPY migrations ./migrations
COPY scripts ./scripts
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add bash make

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json tsconfig*.json ./ 
COPY src ./src
COPY Makefile ./Makefile
COPY migrations ./migrations
COPY scripts ./scripts

EXPOSE 8080

CMD ["node", "dist/index.js"]

