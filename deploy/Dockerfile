# FLAMINGO API image.
#
# The Vercel project serves client/dist; this container runs the Express API
# with a writable disk for SQLite and encrypted uploads. It also contains the
# built client, so the same image can serve the whole app on its own.
#
# Node 24 is used because the API imports node:sqlite (DatabaseSync).

FROM node:24-bookworm-slim AS build
WORKDIR /app

# Workspace manifests first so dependency layers cache independently.
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY client client
COPY server server
RUN npm run build -w client
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server server
COPY --from=build /app/client/dist client/dist

RUN groupadd --system flamingo \
 && useradd --system --gid flamingo --uid 10001 flamingo \
 && mkdir -p /app/server/data /app/server/storage \
 && chown -R flamingo:flamingo /app

COPY --chown=flamingo:flamingo deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

USER flamingo
EXPOSE 4000

# Materialises FLAMINGO_SECRETS_JSON into the file that SECRET_PROVIDER=file
# reads, then runs the command below.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
