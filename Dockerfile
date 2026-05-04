# Dockerfile
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/index.js"]
