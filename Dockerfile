# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

# Next.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install Playwright browser dependencies
RUN npx playwright install-deps chromium

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Install Playwright Chromium browser
RUN npx playwright install chromium

# Copy application code
COPY . .

# Build application
RUN npx next build --experimental-build-mode compile

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Install Playwright browser dependencies in final image
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 \
    libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 \
    libgtk-3-0 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0 \
    libcairo-gobject2 libcairo2 libgdk-pixbuf2.0-0 libgio-cil \
    libglib2.0-0 libxrender1 libasound2 libfreetype6 libfontconfig1 \
    libdbus-1-3 libgbm1 libxshmfence1 libnss3 libnspr4 libatk-bridge2.0-0 \
    libdrm2 libxkbcommon0 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=build /app /app

# Copy Playwright browsers from build stage
COPY --from=build /root/.cache/ms-playwright /root/.cache/ms-playwright

# Setup sqlite3 on a separate volume
RUN mkdir -p /data
VOLUME /data

# Entrypoint sets up the container.
ENTRYPOINT [ "/app/docker-entrypoint.js" ]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
ENV DATABASE_URL="file:///data/sqlite.db"
CMD [ "npm", "run", "start" ]
