FROM node:lts-alpine

WORKDIR /usr/src/app

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]

RUN apk update
RUN apk upgrade
RUN apk add --no-cache ffmpeg

RUN npm install --silent && mv node_modules ../

COPY . .

RUN npm run build

CMD ["npm", "run", "start"]