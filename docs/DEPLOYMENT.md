# Deployment guide

This guide covers local development, a production-style single-instance deployment, reverse proxy configuration, backups and rollback.

> Deploying the client to Vercel with the API on a separate host? See [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) first. The Vercel split still needs this guide for the API host, its environment variables (§2) and the reverse proxy (§5).

> The shipped architecture is a single Node.js process serving the API and the built client. It is appropriate for a pilot or internal deployment. Horizontal scaling requires the changes noted in section 10.

---

## 1. Prerequisites

| Requirement | Version |
| --- | --- |
| Node.js | **22.5 or newer** (24 LTS recommended) |
| npm | 10 or newer |
| Operating system | Linux (recommended), macOS or Windows |
| Reverse proxy | nginx, Caddy or a managed load balancer |
| TLS certificate | Required for production |

Node 22.5 is the minimum because the server uses the built-in `node:sqlite` module.

---

## 2. Environment variables

Set these in the process environment. The server reads `process.env` directly and **does not auto-load a `.env` file**. Use your process manager's environment file (for example systemd `EnvironmentFile=`), your hosting platform's variables, or Node's `--env-file` flag if you prefer a file.

| Variable | Default | Required in production | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | Yes | Set to `production` |
| `PORT` | `4000` | No | Listening port |
| `FLAMINGO_DATA_DIR` | `server/data` | No | Directory for the SQLite file |
| `FLAMINGO_DB` | `server/data/flamingo.db` | No | Full database path |
| `FLAMINGO_STORAGE` | `server/storage` | No | Encrypted document directory |
| `SESSION_TTL_HOURS` | `12` | No | Session lifetime |
| `SECURE_COOKIES` | On when `NODE_ENV=production` | Yes | Requires HTTPS; production startup fails if disabled |
| `DOCUMENT_ENCRYPTION_KEY` | Development string | **Yes** | 32+ random bytes; store in a secret manager; production startup fails on the default or a short key |
| `SECRET_PROVIDER` | `env` | **Yes** | `aws`, `gcp`, `azure`, `vault` or `file`. `env` is rejected in production |
| `FLAMINGO_SECRET_NAMES` | `DOCUMENT_ENCRYPTION_KEY` | No | Comma-separated secret names to load at boot |
| `FLAMINGO_SECRETS_FILE` | None | If provider is `file` | Path to a mounted JSON secret file |
| `KMS_PROVIDER` | `local` | Recommended | `local` or `aws-kms` |
| `KMS_KEY_ID` | None | If `aws-kms` | KMS key used to unwrap the document key |
| `DOCUMENT_ENCRYPTION_KEY_CIPHERTEXT` | None | If `aws-kms` | Base64 KMS ciphertext of the document key |
| `MALWARE_SCAN_MODE` | `eicar` outside production | **Yes** | Must be `clamd` in production |
| `CLAMAV_HOST` / `CLAMAV_PORT` | `127.0.0.1` / `3310` | No | TCP address of `clamd` |
| `CLAMAV_SOCKET` | None | No | Unix socket path; overrides host/port |
| `CLAMAV_TIMEOUT_MS` | `10000` | No | Scan timeout; the upload fails closed |
| `DEMO_MODE` | `true` | Set `false` | Controls demo-mode signalling; production startup fails when `true` unless `ALLOW_DEMO_IN_PRODUCTION=true` |
| `ALLOW_DEMO_IN_PRODUCTION` | `false` | No | Only for a public, clearly labelled demonstration with no real user data |
| `RATE_LIMIT_MULTIPLIER` | `1` | No | Demonstration only. Multiplies every per-IP allowance (sign-in, registration, uploads, password change) when `DEMO_MODE=true`; ignored outside demo mode. Leave unset for any real deployment. |
| `REQUIRE_ADMIN_MFA` | On in production when demo mode is off | Yes | Admin API stays closed until the account enrols a TOTP authenticator |
| `TZ` | System | Recommended | Set `Asia/Kolkata` for Indian operations |

`assertProductionSafety()` runs before the HTTP listener starts and rejects unsafe production combinations: a default/short document key, insecure cookies, demo mode without an explicit override, admin MFA disabled outside demo mode, a non-`clamd` upload scan mode, or a process-environment-only secret provider. See `server/src/config.js`. With demo mode off it also refuses to start while seeded `is_demo` users remain.

Generate a document key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Never reuse the development key with real documents.** Changing the key makes previously encrypted files unreadable unless you re-encrypt them.

---

## 3. Local development

```bash
npm install
npm run seed
npm run dev
```

- API: `http://localhost:4000`
- Vite dev server: `http://localhost:5173`
- Vite proxies `/api` to the API.

`npm run dev` runs both workspaces concurrently with file watching.

---

## 4. Production-style build and run

From the repository root:

```bash
npm ci
npm run build          # type-check and build the client into client/dist
npm run seed           # only for a demo; omit for real data
NODE_ENV=production \
SECURE_COOKIES=true \
DEMO_MODE=false \
DOCUMENT_ENCRYPTION_KEY="<32+ byte random secret>" \
npm start
```

The process refuses to start if any of the production guards fail. Check the error message and fix the environment rather than bypassing the guard.

After the first sign-in, every administrator must enrol a TOTP authenticator. Until enrolment is complete, the admin API returns `mfa_enrollment_required` and the client shows a blocking setup screen. Keep a secure recovery process for lost devices.

The API detects `client/dist` and serves it, with an `index.html` fallback for client-side routes. `/api/*` is excluded from the fallback.

Verify:

```bash
curl -i http://localhost:4000/api/health
curl -I http://localhost:4000/
```

Expected: `200` from both, with the health payload showing `demoMode` according to your setting.

`/api/ready` also probes the malware scanner. It returns `503` when `MALWARE_SCAN_MODE=clamd` and the daemon cannot be reached.

---

## 4a. Secrets and upload scanning

### Loading secrets

Set `SECRET_PROVIDER` to a managed store and hydrate the process before configuration is read. The server does this automatically at boot:

```
SECRET_PROVIDER=aws
FLAMINGO_SECRET_NAMES=DOCUMENT_ENCRYPTION_KEY
AWS_REGION=ap-south-1
```

Install the matching optional SDK in the server workspace, for example `npm i -w server @aws-sdk/client-secrets-manager`. A missing SDK fails at boot with an explicit message.

`file` is the simplest managed option for Docker or Kubernetes:

```
SECRET_PROVIDER=file
FLAMINGO_SECRETS_FILE=/run/secrets/flamingo.json
```

```json
{ "DOCUMENT_ENCRYPTION_KEY": "<32+ byte random secret>" }
```

### Unwrapping the document key with KMS

```bash
aws kms encrypt \
  --key-id "$KMS_KEY_ID" \
  --plaintext fileb://document-key.txt \
  --query CiphertextBlob --output text > document-key.b64
```

Then set `KMS_PROVIDER=aws-kms`, `KMS_KEY_ID`, and `DOCUMENT_ENCRYPTION_KEY_CIPHERTEXT` (the contents of `document-key.b64`). The plaintext key is derived in memory and never written to the environment. Delete `document-key.txt` and `document-key.b64` from the host afterwards.

### Running ClamAV

Use the official image as a sidecar. Keep signature updates enabled; a stale signature database is itself an alert condition.

```yaml
services:
  clamav:
    image: clamav/clamav:stable
    restart: unless-stopped
    volumes:
      - clamav-db:/var/lib/clamav
  api:
    environment:
      MALWARE_SCAN_MODE: clamd
      CLAMAV_HOST: clamav
      CLAMAV_PORT: "3310"
    depends_on:
      - clamav
volumes:
  clamav-db:
```

Verify the path before launch: upload the EICAR test file and confirm a `422` with `malware_detected`, and that nothing appears in the storage directory. Stop the daemon and confirm uploads return `503` rather than being stored.

Neither the `eicar` mode nor `off` may be used in production; the startup guard enforces this.

---

## 5. Reverse proxy (nginx example)

Terminate TLS at nginx and forward to the Node process.

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}
```

`app.set('trust proxy', 1)` is already configured, so client IPs and secure cookies behave correctly behind one proxy hop.

---

## 6. Process management (systemd example)

```ini
# /etc/systemd/system/flamingo.service
[Unit]
Description=FLAMINGO API
After=network.target

[Service]
Type=simple
User=flamingo
WorkingDirectory=/opt/flamingo
Environment=NODE_ENV=production
Environment=PORT=4000
Environment=SECURE_COOKIES=true
Environment=TZ=Asia/Kolkata
Environment=FLAMINGO_DATA_DIR=/var/lib/flamingo/data
Environment=FLAMINGO_STORAGE=/var/lib/flamingo/storage
EnvironmentFile=/etc/flamingo/flamingo.env
ExecStart=/usr/bin/node server/src/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/flamingo
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Put `DOCUMENT_ENCRYPTION_KEY=...` in `/etc/flamingo/flamingo.env`, readable only by the service user (for example `chmod 600`, owner `root:flamingo`). Adjust the path if your secret store injects the value another way. Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now flamingo
sudo systemctl status flamingo
```

---

## 7. Persistent data

| Path | Contents | Backup priority |
| --- | --- | --- |
| `FLAMINGO_DB` (default `server/data/flamingo.db`) | All relational data | Critical |
| `FLAMINGO_STORAGE` (default `server/storage`) | Encrypted documents | Critical |
| `DOCUMENT_ENCRYPTION_KEY` | Decryption key | Critical, store separately |

The database runs in WAL mode. The backup script uses SQLite's `VACUUM INTO` to take a consistent snapshot while the API is running, then copies the encrypted storage directory.

### Backup

```bash
# Default destination: server/backups/flamingo-<timestamp>-<label>/
npm run backup

# Explicit destination and label
npm run backup -- --out /backups/flamingo --label nightly

# Database only
npm run backup -- --out /backups/flamingo --label db-only --no-storage
```

Each backup contains `flamingo.db`, `manifest.json` and (by default) a `storage/` copy. The manifest records row-file size, storage counts and a **fingerprint** of the encryption key — never the key itself.

Schedule this with cron or your platform scheduler, ship the output to encrypted off-host storage, and alert on failure. Test a restore quarterly.

### Restore drill

Stop the API before restoring. The restore script moves the existing database and storage aside to `.pre-restore-<timestamp>` paths instead of deleting them.

```bash
# Inspect the latest backup first
cat /backups/flamingo/flamingo-2026-11-12_02-00-00-nightly/manifest.json

# Restore into the configured paths
npm run restore -- --from /backups/flamingo/flamingo-2026-11-12_02-00-00-nightly --force

# If the key is intentionally different and old documents may be unreadable
npm run restore -- --from <backup> --force --allow-key-mismatch
```

Then:

1. Start the service and check `/api/health`.
2. Sign in and download one encrypted document to confirm the key matches.
3. Verify the reference assignment totals and a recent audit entry.
4. Keep the `.pre-restore-*` copies until verification is complete.

> These scripts cover the current single-instance SQLite deployment. Managed PostgreSQL backups and point-in-time recovery are a separate deliverable; see [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md).

---

## 8. Seeding and resetting

```bash
npm run seed
```

This **destroys and recreates** all demo data. Never run it against a production database. For production, create the schema with `schema.sql` and provision an administrator through a controlled script; do not load demo users. In production with demo mode off, the server refuses to start while any `is_demo = 1` user remains.

---

## 9. Health checks and monitoring

- Liveness: `GET /api/health` returns `200` with `{ status: "ok" }`.
- Readiness: `GET /api/ready` returns `200` only when the database answers and the storage directory is writable; otherwise `503` with per-check detail.
- Logs: the server writes request errors to stdout/stderr with a request ID. Ship them to a central store.
- Recommended alerts: 5xx rate, login failure spikes, CSRF failures, rate-limit spikes, disk usage, backup failures.

The MVP has no metrics endpoint, tracing or alerting. Add these before launch.

---

## 10. Scaling notes

The current design is single-instance:

- In-memory rate limiting and the SQLite single-writer model assume one process.
- Encrypted files live on local disk.

To scale horizontally:

1. Migrate to PostgreSQL — follow [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md); PostgreSQL is **not supported yet**.
2. Move rate limiting to Redis.
3. Move documents to encrypted object storage with signed URLs.
4. Run multiple stateless API instances behind a load balancer.
5. Serve the static build from a CDN.
6. Move notifications and payout batches to a job queue.

---

## 11. Rollback

1. Keep the previous release directory (for example `/opt/flamingo/releases/<sha>`).
2. Repoint the symlink or service `WorkingDirectory` to the previous release.
3. Restart the service.
4. If the schema changed, restore the matching database backup. Always take a backup before a migration.

Because the client is a static bundle, a rollback also restores the previous UI. Browser caches respect the hashed asset filenames.

---

## 12. Deployment checklist

- [ ] Node 22.5+ installed
- [ ] `npm ci` completed from the lockfile
- [ ] `npm run build` passes
- [ ] `NODE_ENV=production`
- [ ] `SECURE_COOKIES=true`
- [ ] Strong `DOCUMENT_ENCRYPTION_KEY` set from a secret manager
- [ ] `DEMO_MODE=false` (or an explicit, documented `ALLOW_DEMO_IN_PRODUCTION=true`)
- [ ] Administrator accounts enrolled in TOTP MFA
- [ ] Database and storage on persistent volumes
- [ ] TLS enabled with HSTS at the proxy
- [ ] `npm run backup` scheduled and a restore tested
- [ ] Health check wired to monitoring
- [ ] Log shipping configured
- [ ] Seeded demo accounts removed for a real launch
- [ ] Legal, tax and privacy reviews completed (see [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md))
