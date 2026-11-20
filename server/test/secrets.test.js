import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hydrateSecrets } from '../src/lib/secrets.js';
import { config } from '../src/config.js';
import {
  documentKeyFingerprint,
  resetDocumentKeyCache
} from '../src/lib/kms.js';

const ENV_KEYS = [
  'SECRET_PROVIDER',
  'FLAMINGO_SECRETS_FILE',
  'FLAMINGO_SECRET_NAMES',
  'DOCUMENT_ENCRYPTION_KEY'
];

let tempDir;
let saved;
let savedKey;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  savedKey = config.documentEncryptionKey;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flamingo-secrets-'));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  config.documentEncryptionKey = savedKey;
  fs.rmSync(tempDir, { recursive: true, force: true });
  resetDocumentKeyCache();
});

describe('secret hydration', () => {
  it('does nothing when the provider is env', async () => {
    process.env.SECRET_PROVIDER = 'env';
    const result = await hydrateSecrets();
    expect(result).toEqual({ provider: 'env', loaded: [] });
  });

  it('loads a JSON secret file into the environment', async () => {
    const file = path.join(tempDir, 'secrets.json');
    const value = 'k'.repeat(32);
    fs.writeFileSync(
      file,
      JSON.stringify({ DOCUMENT_ENCRYPTION_KEY: value })
    );
    process.env.SECRET_PROVIDER = 'file';
    process.env.FLAMINGO_SECRETS_FILE = file;
    delete process.env.DOCUMENT_ENCRYPTION_KEY;

    const result = await hydrateSecrets();
    expect(result.provider).toBe('file');
    expect(result.loaded).toContain('DOCUMENT_ENCRYPTION_KEY');
    expect(process.env.DOCUMENT_ENCRYPTION_KEY).toBe(value);
  });

  it('does not overwrite a value that is already present', async () => {
    const file = path.join(tempDir, 'secrets.json');
    fs.writeFileSync(file, JSON.stringify({ DOCUMENT_ENCRYPTION_KEY: 'from-file' }));
    process.env.SECRET_PROVIDER = 'file';
    process.env.FLAMINGO_SECRETS_FILE = file;
    process.env.DOCUMENT_ENCRYPTION_KEY = 'from-environment';

    await hydrateSecrets();
    expect(process.env.DOCUMENT_ENCRYPTION_KEY).toBe('from-environment');
  });

  it('fails clearly when the secret file is missing', async () => {
    process.env.SECRET_PROVIDER = 'file';
    process.env.FLAMINGO_SECRETS_FILE = path.join(tempDir, 'absent.json');
    await expect(hydrateSecrets()).rejects.toThrow(/not found/i);
  });

  it('fails clearly on an unknown provider', async () => {
    process.env.SECRET_PROVIDER = 'carrier-pigeon';
    await expect(hydrateSecrets()).rejects.toThrow(/Unknown SECRET_PROVIDER/);
  });
});

describe('document key handling', () => {
  it('derives a stable 32-byte key from the configured secret', () => {
    config.documentEncryptionKey = 'a'.repeat(32);
    resetDocumentKeyCache();
    const first = documentKeyFingerprint();
    resetDocumentKeyCache();
    const second = documentKeyFingerprint();
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{16}$/);
  });

  it('derives a different key from a different secret', () => {
    config.documentEncryptionKey = 'a'.repeat(32);
    resetDocumentKeyCache();
    const first = documentKeyFingerprint();
    config.documentEncryptionKey = 'b'.repeat(32);
    resetDocumentKeyCache();
    const second = documentKeyFingerprint();
    expect(first).not.toBe(second);
  });
});
