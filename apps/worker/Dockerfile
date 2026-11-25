# syntax=docker/dockerfile:1
FROM node:22.23.4-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV COREPACK_HOME=/pnpm/corepack
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    corepack enable && NODE_USE_ENV_PROXY=1 corepack prepare pnpm@10.17.1 --activate
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY --chown=node:node apps/worker ./apps/worker
COPY --chown=node:node packages/observability ./packages/observability

# The worker executes workspace TypeScript with tsx. Keep its runtime and
# compiler tools even when the hosting service builds with NODE_ENV=production.
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    NODE_USE_ENV_PROXY=1 pnpm --filter @matricia/worker... install --frozen-lockfile --prod=false \
    && pnpm --filter @matricia/worker build \
    && chmod -R a+rX /pnpm/corepack /app/node_modules /app/apps/worker/node_modules

ENV NODE_ENV=production
ENV PORT=8080
USER node
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/readiness',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["pnpm", "--filter", "@matricia/worker", "start"]
