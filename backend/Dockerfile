
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY server.js ./
COPY auth.js ./
COPY paymentRoutes.js ./
COPY createAdmin.js ./

EXPOSE 3000

CMD ["node", "server.js"]

