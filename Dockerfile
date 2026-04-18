FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY ai/package*.json ./ai/

RUN npm ci
RUN npm ci --prefix frontend
RUN npm ci --prefix ai

COPY . .

RUN npm run build:frontend

ENV NODE_ENV=production
ENV PORT=4000
ENV DATA_DIR=/app/data

EXPOSE 4000

CMD ["node", "server.js"]
