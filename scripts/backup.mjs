#!/usr/bin/env node
/**
 * Online SQLite backup for FLAMINGO.
 *
 * Uses SQLite's VACUUM INTO, which produces a consistent single-file snapshot
 * while the API keeps running. Encrypted document storage is copied alongside.
 * The encryption key itself is never written to the backup.
 *
 * Usage:
 *   node scripts/backup.mjs [--out <directory>] [--label <name>] [--no-storage]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../server/src/config.js';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function directoryStats(directory) {
  if (!fs.existsSync(directory)) return { fileCount: 0, bytes: 0 };
  let fileCount = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(entry.parentPath || entry.path, entry.name);
    fileCount += 1;
    bytes += fs.statSync(fullPath).size;
  }
  return { fileCount, bytes };
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const outRoot = path.resolve(
  arg('out') || process.env.FLAMINGO_BACKUP_DIR || path.join(config.repoRoot, 'backups')
);
const label = String(arg('label', 'scheduled')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'scheduled';
const includeStorage = !process.argv.includes('--no-storage');

if (!fs.existsSync(config.dbFile)) {
  console.error(`Database not found: ${config.dbFile}`);
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 23);
const backupDir = path.join(outRoot, `flamingo-${timestamp}-${label}`);
const databaseTarget = path.join(backupDir, 'flamingo.db');
const storageTarget = path.join(backupDir, 'storage');

fs.mkdirSync(backupDir, { recursive: true });

const source = new DatabaseSync(config.dbFile);
try {
  source.exec(`VACUUM INTO ${sqlQuote(databaseTarget)}`);
} finally {
  source.close();
}

let storage = { included: false, fileCount: 0, bytes: 0 };
if (includeStorage && fs.existsSync(config.storageDir)) {
  fs.cpSync(config.storageDir, storageTarget, { recursive: true });
  const stats = directoryStats(storageTarget);
  storage = { included: true, ...stats };
}

const dbBytes = fs.statSync(databaseTarget).size;
const manifest = {
  format: 'flamingo-backup-v1',
  createdAt: new Date().toISOString(),
  label,
  database: { file: 'flamingo.db', bytes: dbBytes },
  storage,
  encryptionKeyFingerprint: sha256(config.documentEncryptionKey).slice(0, 16)
};
fs.writeFileSync(path.join(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      backupDir,
      databaseBytes: dbBytes,
      storageFiles: storage.fileCount,
      storageBytes: storage.bytes,
      encryptionKeyFingerprint: manifest.encryptionKeyFingerprint
    },
    null,
    2
  )
);
