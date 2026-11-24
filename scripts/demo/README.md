# Demonstration supervisor

Runs the free public demonstration from one Windows PC:

```
Vercel (static client + /api rewrite)
      │
      ▼
Cloudflare quick tunnel  ──►  Express API :4000  ──►  server/data/flamingo.db
```

`supervisor.mjs` keeps the API and the tunnel alive, rewrites the tunnel hostname
into `vercel.json`, and redeploys production with the Vercel CLI whenever the
hostname changes.

## Install

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo\install-autostart.ps1 -StartNow
```

- Writes a hidden launcher to `%LOCALAPPDATA%\flamingo-demo\start-supervisor.vbs`.
- Registers the Scheduled Task **FLAMINGO Demo Supervisor** at sign-in if the
  shell is elevated; otherwise installs the same hidden launcher in the user's
  Startup folder (no admin rights needed).
- `-StartNow` starts it immediately unless a supervisor is already running.

Remove everything with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo\remove-autostart.ps1
```

## What it does

| Behaviour | Detail |
| --- | --- |
| API | `node server/src/index.js` with `DEMO_MODE=true`, `RATE_LIMIT_MULTIPLIER=25` |
| Tunnel | `cloudflared tunnel --url http://127.0.0.1:4000 --no-autoupdate` |
| Rewrite | `/api/:path*` destination in `vercel.json` is replaced in place |
| Deploy | `vercel --prod --yes`, serialised; a newer hostname supersedes an older one |
| Restart | After a child exits: 2s, 5s, 10s, 20s, 30s, then 60s backoff |
| Health | Local and public `/api/health` every 30 seconds; two local or three public failures restart the process |
| Lock | `%LOCALAPPDATA%\flamingo-demo\supervisor.lock` prevents a second instance |

Logs: `%LOCALAPPDATA%\flamingo-demo\logs\supervisor-YYYY-MM-DD.log`.

The lock file holds `{"pid":...,"startedAt":"..."}`. A lock whose PID is no longer
alive is removed automatically.

`vercel.json` is committed with the tunnel hostname that was live when the last
commit was made. The supervisor rewrites it locally on every tunnel restart and
redeploys with the Vercel CLI; that local edit is runtime state and is not
committed automatically. A fresh clone is therefore correct until the tunnel next
restarts, at which point the supervisor corrects it on its first run.

## Tested failure drills

| Drill | Observed |
| --- | --- |
| Kill the API process | `exited ... restarting in 2000ms`, then `starting (after exit)`; public `/api/health` back within seconds |
| Kill `cloudflared` | New tunnel hostname, `vercel.json` rewritten, Vercel redeployed, public health `200` about 35s later |
| Start a second supervisor | Exits with `another supervisor is already running` |

## Limits

- Stops at sleep, hibernate, sign-out, shutdown and power loss. On a laptop,
  `powercfg /change standby-timeout-ac 0` disables sleep on AC power; it is not
  applied automatically because it is machine-wide and costs power.
- A quick tunnel gets a new hostname on every restart. Public requests return
  `502` for roughly 30–60 seconds while Vercel redeploys.
- One PC is a single point of failure. A stable API host (Railway, Render with a
  disk, or a small VPS) is the real fix once the demonstration has an audience.
- Upload scanning is `simulated` in this mode. Never accept real identity
  documents through the demonstration.

## Manual run

```powershell
node scripts/demo/supervisor.mjs
```

Environment overrides:

| Variable | Purpose |
| --- | --- |
| `CLOUDFLARED_PATH` | Use a specific `cloudflared` binary |
| `VERCEL_CLI_PATH` | Use a specific `vercel/dist/vc.js` entry |
| `SUPERVISOR_HEALTH_INTERVAL_MS` | Health poll interval, default `30000` |
| `SUPERVISOR_SKIP_DEPLOY` | `1` rewrites `vercel.json` without deploying |
| `FLAMINGO_DEMO_DIR` | Runtime directory, default `%LOCALAPPDATA%\flamingo-demo` |
| `SUPERVISOR_VERBOSE` | `1` also prints to the console |

If `cloudflared` is missing, the supervisor downloads the current Windows release
into `%LOCALAPPDATA%\flamingo-demo\bin` on first start.
