#!/usr/bin/env node
/**
 * Restore a FLAMINGO backup produced by scripts/backup.mjs.
 *
 * Stop the API before running this. The existing database and storage are moved
 * aside to timestamped `.pre-restore-*` paths rather than deleted, so a bad
 * restore can be reversed.
 *
 * Usage:
 *   node scripts/restore.mjs --from <backup-directory> [--force] [--allow-key-mismatch]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../server/src/config.js';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function fail(message) {
  console.error(`Restore aborted: ${message}`);
  process.exit(1);
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

const from = arg('from');
if (!from) fail('pass --from <backup-directory>.');

const backupDir = path.resolve(from);
const manifestPath = path.join(backupDir, 'manifest.json');
const backupDb = path.join(backupDir, 'flamingo.db');
const backupStorage = path.join(backupDir, 'storage');

if (!fs.existsSync(manifestPath)) fail(`manifest.json not found in ${backupDir}.`);
if (!fs.existsSync(backupDb)) fail(`flamingo.db not found in ${backupDir}.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.format !== 'flamingo-backup-v1') fail(`unsupported backup format: ${manifest.format}`);

if (
  manifest.encryptionKeyFingerprint &&
  manifest.encryptionKeyFingerprint !== fingerprint(config.documentEncryptionKey) &&
  !process.argv.includes('--allow-key-mismatch')
) {
  fail(
    'DOCUMENT_ENCRYPTION_KEY does not match the key used for this backup. Restored documents would be unreadable. Set the original key, or pass --allow-key-mismatch if you intentionally accept that.'
  );
}

const force = process.argv.includes('--force');
if (fs.existsSync(config.dbFile) && !force) {
  fail(`${config.dbFile} already exists. Stop the service and pass --force to replace it.`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
fs.mkdirSync(path.dirname(config.storageDir), { recursive: true });

// Stage the database beside its target, then swap. This avoids copying a
// half-written file directly over the live path.
const staging = `${config.dbFile}.restore-${process.pid}.tmp`;
fs.copyFileSync(backupDb, staging);

if (fs.existsSync(config.dbFile)) {
  const aside = `${config.dbFile}.pre-restore-${stamp}`;
  fs.renameSync(config.dbFile, aside);
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(`${config.dbFile}${suffix}`)) fs.renameSync(`${config.dbFile}${suffix}`, `${aside}${suffix}`);
  }
}
fs.renameSync(staging, config.dbFile);

let storageRestored = false;
if (fs.existsSync(backupStorage)) {
  if (fs.existsSync(config.storageDir)) {
    fs.renameSync(config.storageDir, `${config.storageDir}.pre-restore-${stamp}`);
  }
  fs.cpSync(backupStorage, config.storageDir, { recursive: true });
  storageRestored = true;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      restoredFrom: backupDir,
      database: config.dbFile,
      storage: storageRestored ? config.storageDir : null,
      backupCreatedAt: manifest.createdAt,
      next: [
        'Start the API and check GET /api/health.',
        'Sign in and download one encrypted document to confirm the key matches.',
        'Keep the .pre-restore-* copies until verification is complete.'
      ]
    },
    null,
    2
  )
);
