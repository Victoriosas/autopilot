FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html server.ts tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist-node/server.cjs"]
