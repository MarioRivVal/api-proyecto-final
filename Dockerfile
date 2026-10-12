FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN node_modules/.bin/nest build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3200
# Aplica las migraciones pendientes y arranca la API
CMD ["sh", "-c", "node_modules/.bin/typeorm migration:run -d dist/data-source.js && exec node dist/main"]
