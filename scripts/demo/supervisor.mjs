#!/usr/bin/env node
/**
 * FLAMINGO demonstration supervisor.
 *
 * Keeps the two processes that make the public demonstration work alive on this
 * PC, and keeps Vercel pointed at whichever hostname the tunnel is using:
 *
 *   1. the Express API on http://127.0.0.1:4000
 *   2. a Cloudflare quick tunnel in front of it
 *   3. the `/api/*` rewrite in vercel.json, redeployed with the Vercel CLI
 *
 * Both child processes are restarted after an exit, and a health poll every
 * 30 seconds catches a process that is alive but no longer serving. A lock file
 * stops a second supervisor from starting a duplicate API on the same port.
 *
 * This does not survive sleep, hibernation, shutdown or a power cut. It also
 * cannot make a free quick tunnel stable: the hostname changes on every tunnel
 * restart, so a short outage is expected while Vercel redeploys.
 *
 * Usage:
 *   node scripts/demo/supervisor.mjs
 *
 * Environment:
 *   RATE_LIMIT_MULTIPLIER   passed to the API (default 25 for the demo)
 *   CLOUDFLARED_PATH        explicit path to the cloudflared binary
 *   VERCEL_CLI_PATH         explicit path to the Vercel CLI entry (vc.js)
 *   SUPERVISOR_HEALTH_INTERVAL_MS  health poll interval (default 30000)
 *   SUPERVISOR_SKIP_DEPLOY  set to 1 to rewrite vercel.json without deploying
 *   FLAMINGO_DEMO_DIR       runtime directory (default %LOCALAPPDATA%\flamingo-demo)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const serverEntry = path.join(repoRoot, 'server', 'src', 'index.js');
const vercelConfigPath = path.join(repoRoot, 'vercel.json');
const nodeExe = process.execPath;
const isWindows = process.platform === 'win32';

const localAppData =
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const runtimeDir =
  process.env.FLAMINGO_DEMO_DIR || path.join(localAppData, 'flamingo-demo');
const logDir = path.join(runtimeDir, 'logs');
const lockFile = path.join(runtimeDir, 'supervisor.lock');
const logFile = path.join(
  logDir,
  `supervisor-${new Date().toISOString().slice(0, 10)}.log`
);

const HEALTH_INTERVAL_MS = Number(
  process.env.SUPERVISOR_HEALTH_INTERVAL_MS || 30_000
);
const LOCAL_HEALTH_TIMEOUT_MS = 8_000;
const PUBLIC_HEALTH_TIMEOUT_MS = 15_000;
const STARTUP_GRACE_MS = 20_000;
const BACKOFF_MS = [2_000, 5_000, 10_000, 20_000, 30_000, 60_000];
const ANSI = /\x1b\[[0-9;]*m/g;
const TUNNEL_HOST = /https:\/\/([a-z0-9][a-z0-9-]*\.trycloudflare\.com)/i;

fs.mkdirSync(logDir, { recursive: true });

function log(scope, message) {
  const line = `${new Date().toISOString()} ${scope.toUpperCase().padEnd(9)} ${message}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch {
    // Logging must never take the supervisor down.
  }
  if (process.stdout.isTTY || process.env.SUPERVISOR_VERBOSE === '1') {
    process.stdout.write(line);
  }
}

function stripAnsi(value) {
  return String(value).replace(ANSI, '');
}

function pipeLines(stream, scope, onLine, { echo = true } = {}) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = stripAnsi(buffer.slice(0, index)).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      if (line.trim()) {
        if (echo) log(scope, line);
        onLine?.(line);
      }
    }
    if (buffer.length > 16_384) {
      if (echo) log(scope, stripAnsi(buffer));
      buffer = '';
    }
  });
}

async function probe(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return { ok: false, status: response.status };
    const body = await response.text();
    return { ok: true, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

function localApiHealthy() {
  return probe('http://127.0.0.1:4000/api/health', LOCAL_HEALTH_TIMEOUT_MS);
}

function publicApiHealthy(host) {
  return probe(`https://${host}/api/health`, PUBLIC_HEALTH_TIMEOUT_MS);
}

/* ------------------------------------------------------------------ lock */

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

let ownsLock = false;

function acquireLock() {
  fs.mkdirSync(runtimeDir, { recursive: true });
  if (fs.existsSync(lockFile)) {
    let pid = 0;
    try {
      pid = Number(JSON.parse(fs.readFileSync(lockFile, 'utf8')).pid);
    } catch {
      const first = fs.readFileSync(lockFile, 'utf8').trim().split(/\s+/)[0];
      pid = Number(first);
    }
    if (pid !== process.pid && processAlive(pid)) {
      log('supervisor', `another supervisor is already running (pid ${pid}); exiting`);
      return false;
    }
    log('supervisor', `removing stale lock from pid ${pid || 'unknown'}`);
  }
  fs.writeFileSync(
    lockFile,
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`
  );
  ownsLock = true;
  return true;
}

function releaseLock() {
  if (!ownsLock) return;
  try {
    const pid = Number(JSON.parse(fs.readFileSync(lockFile, 'utf8')).pid);
    if (pid === process.pid) fs.unlinkSync(lockFile);
  } catch {
    // Already removed.
  }
  ownsLock = false;
}

/* --------------------------------------------------------- vercel config */

function apiDestination(host) {
  return `https://${host}/api/:path*`;
}

function readConfiguredHost() {
  try {
    const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    const rewrite = (config.rewrites || []).find(
      (entry) => entry.source === '/api/:path*'
    );
    const match = String(rewrite?.destination || '').match(
      /^https:\/\/([^/]+)\/api\/:path\*$/
    );
    return match?.[1] || null;
  } catch (error) {
    log('deploy', `cannot read vercel.json: ${error.message}`);
    return null;
  }
}

function writeConfiguredHost(host) {
  try {
    const raw = fs.readFileSync(vercelConfigPath, 'utf8');
    const replacement = apiDestination(host);
    const specific =
      /("source"\s*:\s*"\/api\/:path\*"\s*,\s*"destination"\s*:\s*")https:\/\/[^"]+(")/;
    const next = specific.test(raw)
      ? raw.replace(specific, `$1${replacement}$2`)
      : raw.replace(
          /("destination"\s*:\s*")https:\/\/[^"]+(")/,
          `$1${replacement}$2`
        );

    const parsed = JSON.parse(next);
    const rewrite = (parsed.rewrites || []).find(
      (entry) => entry.source === '/api/:path*'
    );
    if (rewrite?.destination !== replacement) {
      log('deploy', `vercel.json rewrite did not update as expected (${rewrite?.destination})`);
      return false;
    }
    if (next !== raw) fs.writeFileSync(vercelConfigPath, next);
    log('deploy', `vercel.json now points at ${host}`);
    return true;
  } catch (error) {
    log('deploy', `cannot update vercel.json: ${error.message}`);
    return false;
  }
}

/* ------------------------------------------------------------ cloudflared */

function findOnPath(binary) {
  const result = spawnSync(isWindows ? 'where' : 'which', [binary], {
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null;
}

function cloudflaredCandidates() {
  const binary = isWindows ? 'cloudflared.exe' : 'cloudflared';
  return [
    process.env.CLOUDFLARED_PATH,
    path.join(runtimeDir, 'bin', binary),
    path.join(repoRoot, 'tools', binary),
    path.join(os.tmpdir(), 'opencode', 'tools', binary)
  ].filter(Boolean);
}

function resolveCloudflared() {
  for (const candidate of cloudflaredCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return findOnPath(isWindows ? 'cloudflared.exe' : 'cloudflared');
}

async function ensureCloudflared() {
  const found = resolveCloudflared();
  if (found) return found;

  const binary = isWindows ? 'cloudflared.exe' : 'cloudflared';
  const target = path.join(runtimeDir, 'bin', binary);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  log('bootstrap', `cloudflared not found; downloading to ${target}`);

  try {
    const releaseResponse = await fetch(
      'https://api.github.com/repos/cloudflare/cloudflared/releases/latest',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'flamingo-demo-supervisor'
        },
        signal: AbortSignal.timeout(30_000)
      }
    );
    if (!releaseResponse.ok) {
      throw new Error(`release lookup returned ${releaseResponse.status}`);
    }
    const release = await releaseResponse.json();
    const assetName = isWindows
      ? 'cloudflared-windows-amd64.exe'
      : process.arch === 'arm64'
        ? 'cloudflared-linux-arm64'
        : 'cloudflared-linux-amd64';
    const asset = release.assets?.find((entry) => entry.name === assetName);
    if (!asset) throw new Error(`${assetName} not present in ${release.tag_name}`);

    const download = await fetch(asset.browser_download_url, {
      signal: AbortSignal.timeout(300_000)
    });
    if (!download.ok) throw new Error(`download returned ${download.status}`);
    const bytes = Buffer.from(await download.arrayBuffer());
    const temporary = `${target}.download`;
    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, target);
    if (!isWindows) fs.chmodSync(target, 0o755);
    log('bootstrap', `downloaded cloudflared ${release.tag_name} (${bytes.length} bytes)`);
    return target;
  } catch (error) {
    log('bootstrap', `download failed: ${error.message}`);
    log('bootstrap', 'install cloudflared and set CLOUDFLARED_PATH, then restart');
    return null;
  }
}

/* ------------------------------------------------------------ vercel CLI */

function resolveVercelCli() {
  const candidates = [
    process.env.VERCEL_CLI_PATH,
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'vercel', 'dist', 'vc.js'),
    path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'npm',
      'node_modules',
      'vercel',
      'dist',
      'vc.js'
    ),
    '/usr/local/lib/node_modules/vercel/dist/vc.js',
    '/usr/lib/node_modules/vercel/dist/vc.js'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function runDeploy(host) {
  const cli = resolveVercelCli();
  const command = cli ? nodeExe : isWindows ? 'vercel.cmd' : 'vercel';
  const args = cli ? [cli, '--prod', '--yes'] : ['--prod', '--yes'];
  log('deploy', `running ${cli ? 'vercel' : command} --prod --yes`);

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      windowsHide: true,
      shell: !cli && isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const tail = [];
    const collect = (line) => {
      tail.push(line);
      if (tail.length > 60) tail.shift();
    };
    pipeLines(child.stdout, 'deploy', collect, { echo: false });
    pipeLines(child.stderr, 'deploy', collect, { echo: false });

    let settled = false;
    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      if (ok) log('deploy', `production now serves ${host}${detail ? ` — ${detail}` : ''}`);
      else log('deploy', `deployment failed: ${detail}`);
      resolve(ok);
    };

    child.on('error', (error) => finish(false, error.message));
    child.on('exit', (code) => {
      if (code !== 0) return finish(false, `exit code ${code}`);
      const text = tail.join('\n');
      const ready = /"readyState":\s*"READY"|Production URL|Aliased/i.test(text);
      const summary = tail
        .filter((line) => /Production URL|readyState|blocked|Error/i.test(line))
        .slice(-1)[0];
      finish(ready, ready ? summary : 'no READY confirmation in the Vercel output');
    });
  });
}

/* ----------------------------------------------------------------- state */

const state = {
  api: { child: null, external: false, errors: 0, nextStartAt: 0, startedAt: 0 },
  tunnel: { child: null, host: null, errors: 0, nextStartAt: 0, startedAt: 0 },
  healthFailures: 0,
  tunnelFailures: 0,
  shuttingDown: false
};

let deployChain = null;
let pendingHost = null;
let lastDeployedHost = readConfiguredHost();

function scheduleDeploy(host) {
  if (!host || state.shuttingDown) return;
  if (process.env.SUPERVISOR_SKIP_DEPLOY === '1') {
    writeConfiguredHost(host);
    lastDeployedHost = host;
    return;
  }
  pendingHost = host;
  if (deployChain) return;

  deployChain = (async () => {
    while (pendingHost && !state.shuttingDown) {
      const target = pendingHost;
      pendingHost = null;
      if (target === lastDeployedHost) {
        log('deploy', `already deployed against ${target}; nothing to do`);
        continue;
      }
      if (!writeConfiguredHost(target)) continue;
      const ok = await runDeploy(target);
      if (ok) {
        lastDeployedHost = target;
      } else {
        setTimeout(() => {
          if (state.tunnel.host) scheduleDeploy(state.tunnel.host);
        }, 60_000);
      }
    }
  })().finally(() => {
    deployChain = null;
    if (pendingHost) scheduleDeploy(pendingHost);
  });
}

/* ------------------------------------------------------------------- api */

function killTree(child, label) {
  if (!child || child.exitCode !== null || !child.pid) return;
  log(label, `stopping pid ${child.pid}`);
  try {
    if (isWindows) {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

const apiEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEMO_MODE: 'true',
  RATE_LIMIT_MULTIPLIER: process.env.RATE_LIMIT_MULTIPLIER || '25'
};

async function ensureApi(reason) {
  if (state.api.child || state.shuttingDown) return;
  if (Date.now() < state.api.nextStartAt) return;

  const health = await localApiHealthy();
  if (health.ok) {
    if (!state.api.external) {
      state.api.external = true;
      log('api', 'an API is already serving on port 4000; monitoring it');
    }
    return;
  }

  state.api.external = false;
  log('api', `starting${reason ? ` (${reason})` : ''}`);
  const child = spawn(nodeExe, [serverEntry], {
    cwd: repoRoot,
    env: apiEnv,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  state.api.child = child;
  state.api.startedAt = Date.now();
  pipeLines(child.stdout, 'api');
  pipeLines(child.stderr, 'api');

  child.on('error', (error) => {
    log('api', `could not start: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    const uptime = Date.now() - state.api.startedAt;
    if (state.api.child === child) state.api.child = null;
    if (state.shuttingDown) return;

    let delay;
    if (uptime > 60_000) {
      state.api.errors = 0;
      delay = BACKOFF_MS[0];
    } else {
      delay = BACKOFF_MS[Math.min(state.api.errors, BACKOFF_MS.length - 1)];
      state.api.errors += 1;
    }
    state.api.nextStartAt = Date.now() + delay;
    log(
      'api',
      `exited (code ${code}, signal ${signal}) after ${Math.round(uptime / 1000)}s; restarting in ${delay}ms`
    );
    setTimeout(() => {
      void ensureApi('after exit');
    }, delay);
  });
}

/* ---------------------------------------------------------------- tunnel */

async function ensureTunnel(reason) {
  if (state.tunnel.child || state.shuttingDown || !cloudflaredPath) return;
  if (Date.now() < state.tunnel.nextStartAt) return;

  log('tunnel', `starting${reason ? ` (${reason})` : ''}`);
  const child = spawn(
    cloudflaredPath,
    ['tunnel', '--url', 'http://127.0.0.1:4000', '--no-autoupdate'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  state.tunnel.child = child;
  state.tunnel.startedAt = Date.now();

  const inspect = (line) => {
    const match = line.match(TUNNEL_HOST);
    if (!match) return;
    const host = match[1];
    if (host === state.tunnel.host) return;
    state.tunnel.host = host;
    state.tunnel.errors = 0;
    log('tunnel', `public hostname ${host}`);
    scheduleDeploy(host);
  };
  pipeLines(child.stdout, 'tunnel', inspect);
  pipeLines(child.stderr, 'tunnel', inspect);

  child.on('error', (error) => {
    log('tunnel', `could not start: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    const uptime = Date.now() - state.tunnel.startedAt;
    if (state.tunnel.child === child) state.tunnel.child = null;
    state.tunnel.host = null;
    if (state.shuttingDown) return;

    let delay;
    if (uptime > 60_000) {
      state.tunnel.errors = 0;
      delay = BACKOFF_MS[0];
    } else {
      delay = BACKOFF_MS[Math.min(state.tunnel.errors, BACKOFF_MS.length - 1)];
      state.tunnel.errors += 1;
    }
    state.tunnel.nextStartAt = Date.now() + delay;
    log(
      'tunnel',
      `exited (code ${code}, signal ${signal}) after ${Math.round(uptime / 1000)}s; restarting in ${delay}ms`
    );
    setTimeout(() => {
      void ensureTunnel('after exit');
    }, delay);
  });
}

/* ---------------------------------------------------------------- health */

async function healthLoop() {
  if (state.shuttingDown) return;

  const local = await localApiHealthy();
  if (local.ok) {
    state.healthFailures = 0;
  } else {
    state.healthFailures += 1;
    log('health', `local API unhealthy (${state.healthFailures}/2) ${local.error || local.status || ''}`.trim());
    if (state.healthFailures >= 2) {
      state.healthFailures = 0;
      if (state.api.child) {
        killTree(state.api.child, 'health');
      } else {
        state.api.nextStartAt = 0;
        await ensureApi('health check');
      }
    }
  }

  if (local.ok && state.tunnel.host) {
    const host = state.tunnel.host;
    const remote = await publicApiHealthy(host);
    if (remote.ok) {
      state.tunnelFailures = 0;
    } else {
      state.tunnelFailures += 1;
      log(
        'health',
        `public API unhealthy (${state.tunnelFailures}/3) ${remote.error || remote.status || ''}`.trim()
      );
      if (state.tunnelFailures >= 3) {
        state.tunnelFailures = 0;
        log('health', 'public API unreachable; restarting the tunnel');
        killTree(state.tunnel.child, 'health');
      }
    }
  }

  setTimeout(healthLoop, HEALTH_INTERVAL_MS);
}

/* --------------------------------------------------------------- startup */

const cloudflaredPath = await ensureCloudflared();
if (!cloudflaredPath) process.exit(1);
if (!fs.existsSync(serverEntry)) {
  log('supervisor', `server entry missing: ${serverEntry}`);
  process.exit(1);
}

if (!acquireLock()) process.exit(0);

log('supervisor', `started pid ${process.pid}`);
log('supervisor', `repo ${repoRoot}`);
log('supervisor', `node ${nodeExe}`);
log('supervisor', `cloudflared ${cloudflaredPath}`);
log('supervisor', `vercel.json currently points at ${lastDeployedHost || '(unknown)'}`);
log('supervisor', `log file ${logFile}`);
log('supervisor', `health poll every ${HEALTH_INTERVAL_MS}ms`);

await ensureApi('startup');
await ensureTunnel('startup');
setTimeout(healthLoop, STARTUP_GRACE_MS);

/* -------------------------------------------------------------- shutdown */

function shutdown(reason) {
  if (state.shuttingDown) return;
  state.shuttingDown = true;
  log('supervisor', `shutting down (${reason})`);
  killTree(state.api.child, 'supervisor');
  killTree(state.tunnel.child, 'supervisor');
  setTimeout(() => {
    releaseLock();
    process.exit(0);
  }, 2_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', releaseLock);
process.on('uncaughtException', (error) => {
  log('supervisor', `uncaught exception: ${error.stack || error.message}`);
});
process.on('unhandledRejection', (error) => {
  log('supervisor', `unhandled rejection: ${error?.stack || error}`);
});
