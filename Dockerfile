FROM node:lts-alpine

WORKDIR /usr/src/app

COPY ["server/package.json", "server/package-lock.json*", "server/npm-shrinkwrap.json*", "./"]
RUN npm install --silent && mv node_modules ../

COPY . .

RUN npm run build

CMD ["npm", "run", "start"]