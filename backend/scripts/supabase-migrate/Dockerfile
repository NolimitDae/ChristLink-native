FROM node:22.22.0-alpine
WORKDIR /job
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY migrate.mjs ./
USER node
CMD ["node", "migrate.mjs"]
