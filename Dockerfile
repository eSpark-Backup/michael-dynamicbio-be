FROM node:lts-alpine

WORKDIR /usr/src/app

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]

RUN apk update
RUN apk upgrade

RUN npm install --silent && mv node_modules ../

COPY . .
RUN npm run build

# Create startup script that runs migrations then starts the server
RUN echo '#!/bin/sh' > /usr/src/start.sh && \
    echo 'echo "🔄 Waiting for database..."' >> /usr/src/start.sh && \
    echo 'sleep 10' >> /usr/src/start.sh && \
    echo 'echo "🔄 Running database migrations..."' >> /usr/src/start.sh && \
    echo 'npm run migration:run || echo "⚠️  Migration failed or no migrations to run"' >> /usr/src/start.sh && \
    echo 'echo "🚀 Starting server..."' >> /usr/src/start.sh && \
    echo 'npm run start' >> /usr/src/start.sh && \
    chmod +x /usr/src/start.sh

CMD ["/bin/sh", "/usr/src/start.sh"]