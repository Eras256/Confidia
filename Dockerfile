FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy lockfiles and workspace configs
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/confidia-config/package.json ./packages/confidia-config/
COPY packages/confidia-sdk/package.json ./packages/confidia-sdk/
COPY packages/confidia-ui/package.json ./packages/confidia-ui/
COPY packages/confidia-test-utils/package.json ./packages/confidia-test-utils/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build all applications and packages
RUN pnpm run build

EXPOSE 3000
EXPOSE 3001

CMD ["pnpm", "run", "dev"]
