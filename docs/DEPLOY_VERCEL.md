# Deploying FLAMINGO with Vercel

**Status:** demonstration deployment. This is not the production go-live described in
[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md); the twelve blockers there still apply.

---

## 1. Why the API cannot run on Vercel

Vercel runs static files and short-lived functions. FLAMINGO's server is a long-running
Express process with state on a real disk:

| Requirement | Source | Vercel |
| --- | --- | --- |
| Writable disk for SQLite | `server/src/config.js:33-36`, `server/src/db.js:10` | Read-only; only `/tmp`, per instance, discarded |
| `node:sqlite` `DatabaseSync` | `server/src/db.js:4` | Runtime-dependent, experimental |
| Encrypted uploads on disk | `server/src/lib/storage.js` | Not durable |
| `clamd` socket | `server/src/lib/malware.js`, `config.js:104` | No sidecar daemons; production guard refuses to boot |
| Secret manager, not `env` | `config.js:110` | No filesystem mount for `SECRET_PROVIDER=file` |
| In-memory rate limits and sessions | `server/src/lib/http.js:8` | Not shared across instances |

So the split is:

```
browser ──► https://<project>.vercel.app        (static client, SPA fallback)
                 │
                 └─ /api/* rewrite ──► https://<api-host>   (Express + SQLite + clamd)
```

The browser only ever sees one origin, so the existing `/api` paths, session cookie and
CSRF token work unchanged. No client code changes are needed.

---

## 2. Files in this repository

| File | Purpose |
| --- | --- |
| `vercel.json` | Builds `client/dist`, adds the SPA fallback, proxies `/api/*` to the API host |
| `.vercelignore` | Keeps `node_modules`, `.env`, `secrets/` and local data out of the upload |
| `Dockerfile` | API image: Node 24, built client included, runs as a non-root user |
| `docker-compose.yml` | API + `clamd` sidecar + persistent volumes for a demo deployment |
| `.dockerignore` | Keeps local data, secrets and test artefacts out of the image |

---

## 3. Part A — deploy the API

The API needs a host with a persistent disk. Railway, Render, Fly.io and any Docker VPS all
work. The steps below use Railway because it builds the Dockerfile directly from this folder
without a Git repository.

### 3.1 Create the secret file

```bash
mkdir -p secrets
node -e "console.log(JSON.stringify({DOCUMENT_ENCRYPTION_KEY: require('crypto').randomBytes(48).toString('base64')}))" > secrets/flamingo.json
```

`SECRET_PROVIDER=file` reads `{"NAME":"value"}` pairs from that file before configuration is
evaluated (`server/src/lib/secrets.js:63-75`). Keep the file out of version control; it is
already in `.gitignore` and both ignore files.

### 3.2 Deploy

```bash
npm install -g @railway/cli
railway login
railway init          # create the project
railway up            # uploads this folder and builds the Dockerfile
```

Then, in the Railway dashboard for that service:

1. Add a **volume** mounted at `/app/server/data` (SQLite).
2. Add a **volume** mounted at `/app/server/storage` (encrypted uploads).
3. Set the environment variables from section 3.3.
4. Generate a public domain, e.g. `flamingo-api.up.railway.app`.
5. Run the seed once: `railway run npm run seed` (or `docker compose exec api npm run seed`
   on a VPS).

### 3.3 Environment variables

| Variable | Value | Why |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables the production guards |
| `DEMO_MODE` | `true` | Seeded demo accounts stay available |
| `ALLOW_DEMO_IN_PRODUCTION` | `true` | Explicit acknowledgement required by `config.js:92` |
| `SECRET_PROVIDER` | `file` | Production rejects `env` (`config.js:110`) |
| `FLAMINGO_SECRETS_FILE` | `/run/secrets/flamingo.json` or the path you mount | Where the key is read from |
| `KMS_PROVIDER` | `local` | Derives the AES key from the secret |
| `MALWARE_SCAN_MODE` | `clamd` | Production rejects `eicar` and `off` (`config.js:104`) |
| `CLAMAV_HOST` / `CLAMAV_PORT` | `clamav` / `3310` | Sidecar address; on Railway use the private hostname |
| `SECURE_COOKIES` | `true` | Both Vercel and Railway terminate TLS |
| `REQUIRE_ADMIN_MFA` | `false` | Demo only; **must be `true` for any real deployment** |
| `FLAMINGO_DATA_DIR` | `/app/server/data` | SQLite directory |
| `FLAMINGO_STORAGE` | `/app/server/storage` | Upload directory |
| `PORT` | `4000` | Container port |

`docs/DEPLOYMENT.md` §2 is the authoritative list; the table above is the minimum for a demo.

### 3.4 On a VPS instead

```bash
mkdir -p secrets            # create secrets/flamingo.json as in 3.1
docker compose up -d --build
docker compose exec api npm run seed
```

`docker-compose.yml` already sets the variables above and runs `clamav/clamav:stable`
alongside the API. Put nginx or Caddy in front for TLS; see `docs/DEPLOYMENT.md` §5.

### 3.5 Verify the API before touching Vercel

```bash
curl -s https://<api-host>/api/health
# {"status":"ok","service":"flamingo-api","demoMode":true,...}

curl -s https://<api-host>/api/ready
# {"status":"ready","checks":{"database":"ok","storage":"ok","scanner":"ok"},...}
```

`scanner` must be `ok`; if it is `failed` or `simulated`, the container is not running `clamd`
and document uploads will be refused (fail closed, by design).

---

## 4. Part B — deploy the client to Vercel

### 4.1 Point the proxy at your API

Edit the one line in `vercel.json`:

```json
"destination": "https://<api-host>/api/:path*"
```

Keep the `/api/:path*` suffix. Do not add a trailing slash.

### 4.2 Deploy

```bash
npx vercel login     # approve in the browser
npx vercel link      # create or select the project, root directory "."
npx vercel --prod    # production deployment
```

Or import the folder in the Vercel dashboard and accept the settings from `vercel.json`:
install `npm ci`, build `npm run build -w client`, output `client/dist`, framework "Other".

Vercel will run the workspace install, build only the client, and publish `client/dist`.
The Express server is not deployed there.

### 4.3 If your Vercel plan rejects `npm ci` at the workspace root

Set **Root Directory** to `client`, then:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

The root `vercel.json` rewrite and headers must then be copied into the project settings
(Settings → Rewrites / Headers), because the file is read from the repository root.

---

## 5. Verification checklist

Run these against the **Vercel** URL, in this order. Anything that fails here fails in front
of a user.

1. `https://<project>.vercel.app/api/health` returns `200` with the JSON from §3.5 — this
   proves the rewrite is wired, not just the static build.
2. Home page loads and the marketplace at `/professionals` lists seeded professionals.
3. Sign in as `candidate@flamingo.work` / `Flamingo@2026`; the professional dashboard loads
   with the ₹9,301 first payout and ₹19,301 total.
4. Refresh the page while signed in — the session survives (cookie set on the Vercel origin).
5. Upload a document to *Profile & documents*. Then upload a file larger than 4.5 MB.
6. Fail a login 21 times from one network and confirm the 21st returns `429`.
7. `https://<api-host>/api/ready` still reports `scanner: ok`.

Re-run the local suites before deploying: `npm test`, `npx playwright test`,
`node scripts/smoke.mjs http://localhost:4000`, `npm run build`.

---

## 6. Caveats to know before sharing the link

- **Upload size.** Measured through the Vercel rewrite: a 6 MB PDF upload returned `201`, so
  the rewrite path is not subject to the 4.5 MB function body limit. The API still caps uploads
  at 8 MB (`server/src/routes/professional.js:58`).
- **Rate limiting.** `app.set('trust proxy', 1)` (`server/src/app.js:19`) makes `req.ip` come
  from `X-Forwarded-For`. Measured through the rewrite: the API recorded Vercel edge addresses
  (`13.233.90.105`, `52.66.205.189`) rather than the visitor's address, so visitors routed
  through the same edge share one login bucket (20 attempts / 15 minutes). With a small audience
  this only slows down someone who mistypes repeatedly; for a public launch, key the limiter on a
  trusted client address or move the API behind a proxy that preserves it.
- **Demo data is real on disk.** `DEMO_MODE=true` keeps seeded accounts and the simulated
  ledger. Do not enter real personal data: there is no signed DPDP review, no live KYC, and
  payments are simulated.
- **Admin MFA is off** in the demo compose file. Turn it on before any non-demo use.
- **Not production-ready.** Legal custody opinion, tax review, privacy review, key management,
  payment integration, KYC, ClamAV hardening, PostgreSQL, penetration test and UAT are all
  still open — see `docs/PRODUCTION_READINESS.md`.

## 7. Free demonstration deployment (current setup)

This is the state of the live deployment as of 17 November 2026, and the cheapest way to show
the product before paying for infrastructure.

| Piece | What runs it | Cost |
| --- | --- | --- |
| Client | Vercel project `flamingo`, production URL `https://flamingo-gules.vercel.app` | Free (Hobby) |
| API | `node server/src/index.js` on the demonstration PC, port 4000 | Free |
| Public route to the API | Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:4000`) | Free, no account |

`vercel.json` rewrites `/api/:path*` to the current tunnel host. Because the browser only sees
the Vercel origin, cookies and CSRF behave exactly as they do locally.

**What this means in practice**

- The site is fully functional only while the PC is awake, the API is listening on port 4000 and
  the `cloudflared` process is alive.
- A quick tunnel gets a new random hostname every time it restarts, so `vercel.json` must be
  updated and the project redeployed after each restart.
- Upload scanning is `simulated` in this mode (`/api/ready` reports it). The eicar scanner only
  recognises the standard antivirus test string; it is not real protection. Do not accept real
  identity documents.
- Vercel's Hobby plan is for non-commercial use. Before this becomes the live site for
  Flamingo Solution Pvt. Ltd., move to Pro (about $20/month) or a paid host.

**To relaunch after a restart**

```powershell
# 1. API. The multiplier keeps a shared link usable when every visitor shares
#    one proxy address; it has no effect on a real deployment.
$env:RATE_LIMIT_MULTIPLIER = "25"
cd <repo>
node server/src/index.js

# 2. Tunnel (keep this window open)
cloudflared tunnel --url http://localhost:4000

# 3. Copy the https://<random>.trycloudflare.com host into vercel.json, then
npx vercel --prod --yes
```

**Why the multiplier is needed.** The API sees the Vercel edge address, not the visitor, so
per-IP limits act as per-audience limits. Measured through the public URL: 25 failed sign-ins
from distinct addresses all returned `401`, and a valid sign-in still returned `200`. With the
multiplier removed, the 21st attempt from the whole audience returns `429` and sign-in is closed
to everyone for 15 minutes. Per-account protection is unchanged: eight failed attempts on one
account still block that account for 15 minutes (`server/src/routes/auth.js:301`).

**When responses justify the spend**, do §3 (Railway or any Docker host) instead: a stable API
hostname, real ClamAV, and no dependency on a desktop. Attach your own domain in Vercel under
Settings → Domains.

## 8. Simpler alternative

If the split feels like more moving parts than you need, skip Vercel and point your domain at
the container: it already serves `client/dist` from the same origin (`server/src/app.js:58`).
One host, one origin, no rewrite, no proxy limits. `docs/DEPLOYMENT.md` covers nginx and
systemd for that setup.
