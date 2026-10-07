# Harvex Agent Studio: self-hosted image (Coolify / any Docker host).
# The app is a Cloudflare Worker + D1. Here it runs on workerd (Cloudflare's open-source runtime)
# through `wrangler dev --local`; D1 is SQLite on the /data volume. See COOLIFY-ID.md.

# ---- build: install everything, build the Worker bundle
FROM node:22-bookworm-slim AS build
WORKDIR /src
ENV CLOUDFLARE_CF_FETCH_ENABLED=false WRANGLER_SEND_METRICS=false SHARP_IGNORE_GLOBAL_LIBVIPS=1 CI=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime: only wrangler/workerd + the built bundle + migrations
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8787 HARVEX_DATA_DIR=/data \
    WRANGLER_SEND_METRICS=false CLOUDFLARE_CF_FETCH_ENABLED=false WRANGLER_WRITE_LOGS=false \
    XDG_CONFIG_HOME=/tmp/.config HOME=/tmp
# workerd verifies outbound HTTPS (AI provider, BNB Smart Chain RPC) against the system CA store: the slim image has none
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN printf '{"name":"harvex-runtime","private":true,"type":"module","dependencies":{"wrangler":"4.92.0"}}\n' > package.json \
 && npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force
COPY --from=build /src/dist ./dist
COPY --from=build /src/drizzle ./drizzle
COPY scripts/container-start.mjs ./scripts/container-start.mjs
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 8787
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/chain').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/container-start.mjs"]
