FROM node:lts-alpine

WORKDIR /usr/src/app

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]

RUN apk update
RUN apk upgrade

RUN npm install --silent && mv node_modules ../

COPY . .
RUN npm run build
RUN npm run migration:generate
RUN npm run migration:run

CMD ["npm", "run", "start"]