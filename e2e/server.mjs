import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

/**
 * Start the API for the browser suite against a disposable database.
 * The seed is idempotent because it runs with --reset.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// Playwright sets these from playwright.config.ts; resolve them from the repo
// root so the server and the script agree on one location.
const dataDir = path.resolve(root, process.env.FLAMINGO_DATA_DIR || '.e2e/data');
const dbFile = path.resolve(root, process.env.FLAMINGO_DB || '.e2e/data/flamingo.db');
const storageDir = path.resolve(root, process.env.FLAMINGO_STORAGE || '.e2e/storage');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(storageDir, { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DEMO_MODE: 'true',
  SECURE_COOKIES: 'false',
  MALWARE_SCAN_MODE: 'eicar',
  FLAMINGO_DATA_DIR: dataDir,
  FLAMINGO_DB: dbFile,
  FLAMINGO_STORAGE: storageDir,
  DOCUMENT_ENCRYPTION_KEY:
    process.env.DOCUMENT_ENCRYPTION_KEY ||
    'e2e-only-document-key-not-for-any-real-data-0001'
};

execFileSync(process.execPath, [path.join(root, 'server/src/seed.js'), '--reset'], {
  cwd: path.join(root, 'server'),
  env,
  stdio: 'inherit'
});

// Import after the environment is set: config.js reads process.env at load.
await import('../server/src/index.js');
