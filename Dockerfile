FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=7070
EXPOSE 7070

CMD ["node", "src/index.js"]
