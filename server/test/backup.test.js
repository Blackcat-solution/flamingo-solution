import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flamingo-backup-test-'));
const sourceDir = path.join(tempDir, 'source');
const sourceDb = path.join(sourceDir, 'flamingo.db');
const sourceStorage = path.join(sourceDir, 'storage');
const key = crypto.randomBytes(32).toString('hex');
const backupRoot = path.join(tempDir, 'backups');

function run(script, args, env = {}) {
  return execFileSync(process.execPath, [path.join(repoRoot, 'scripts', script), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FLAMINGO_DATA_DIR: sourceDir,
      FLAMINGO_DB: sourceDb,
      FLAMINGO_STORAGE: sourceStorage,
      FLAMINGO_BACKUP_DIR: backupRoot,
      DOCUMENT_ENCRYPTION_KEY: key,
      ...env
    },
    stdio: 'pipe'
  });
}

describe('backup and restore', () => {
  let backupDir;

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Windows may keep a SQLite handle briefly.
    }
  });

  it('creates a consistent database snapshot and copies encrypted storage', () => {
    fs.mkdirSync(path.join(sourceStorage, '2026-11-12'), { recursive: true });
    const db = new DatabaseSync(sourceDb);
    db.exec('CREATE TABLE evidence (id INTEGER PRIMARY KEY, label TEXT NOT NULL);');
    db.prepare('INSERT INTO evidence (label) VALUES (?)').run('backup-round-trip');
    db.close();
    fs.writeFileSync(path.join(sourceStorage, '2026-11-12', 'document.bin'), 'encrypted bytes');

    const output = JSON.parse(run('backup.mjs', ['--label', 'test']));
    backupDir = output.backupDir;

    expect(output.ok).toBe(true);
    expect(output.databaseBytes).toBeGreaterThan(0);
    expect(output.storageFiles).toBe(1);
    expect(fs.existsSync(path.join(backupDir, 'manifest.json'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
    expect(manifest.format).toBe('flamingo-backup-v1');
    expect(manifest.encryptionKeyFingerprint).toBeTruthy();
    expect(JSON.stringify(manifest)).not.toContain(key);
  });

  it('restores the database and storage into a clean target', () => {
    const targetDir = path.join(tempDir, 'restored');
    const targetDb = path.join(targetDir, 'flamingo.db');
    const targetStorage = path.join(targetDir, 'storage');

    run(
      'restore.mjs',
      ['--from', backupDir],
      {
        FLAMINGO_DATA_DIR: targetDir,
        FLAMINGO_DB: targetDb,
        FLAMINGO_STORAGE: targetStorage
      }
    );

    const db = new DatabaseSync(targetDb);
    const row = db.prepare('SELECT label FROM evidence WHERE id = 1').get();
    db.close();
    expect(row.label).toBe('backup-round-trip');
    expect(fs.readFileSync(path.join(targetStorage, '2026-11-12', 'document.bin'), 'utf8')).toBe(
      'encrypted bytes'
    );
  });

  it('refuses a restore with the wrong document key', () => {
    const targetDir = path.join(tempDir, 'wrong-key');
    expect(() =>
      run(
        'restore.mjs',
        ['--from', backupDir],
        {
          FLAMINGO_DATA_DIR: targetDir,
          FLAMINGO_DB: path.join(targetDir, 'flamingo.db'),
          FLAMINGO_STORAGE: path.join(targetDir, 'storage'),
          DOCUMENT_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex')
        }
      )
    ).toThrow();
    expect(fs.existsSync(path.join(targetDir, 'flamingo.db'))).toBe(false);
  });

  it('refuses to overwrite an existing database without --force', () => {
    expect(() => run('restore.mjs', ['--from', backupDir])).toThrow();
  });
});
