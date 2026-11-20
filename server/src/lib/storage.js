import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { documentKey } from './kms.js';

export function saveEncryptedFile(buffer, storageKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', documentKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const target = path.join(config.storageDir, storageKey);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, encrypted);
  return { iv: iv.toString('base64'), authTag: authTag.toString('base64') };
}

export function readEncryptedFile(storageKey, ivBase64, tagBase64) {
  const target = path.join(config.storageDir, storageKey);
  if (!fs.existsSync(target)) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', documentKey(), Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  const encrypted = fs.readFileSync(target);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function safeStorageKey(originalName) {
  const extension = path.extname(originalName || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
  return `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
}

export function assertAllowedUpload({ mimetype, originalname, size, buffer }) {
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(mimetype)) {
    return 'Only PDF, JPEG, PNG or WebP documents can be uploaded.';
  }
  if (size > 8 * 1024 * 1024) return 'Documents must be 8 MB or smaller.';
  if (/\.(exe|js|sh|bat|cmd|html|svg)$/i.test(originalname || '')) {
    return 'This file type is not permitted.';
  }
  if (buffer) {
    const detected = sniffFileType(buffer);
    if (!detected) {
      return 'The file content is not a valid PDF, JPEG, PNG or WebP document.';
    }
    if (detected !== mimetype) {
      return 'The file content does not match its declared type.';
    }
  }
  return null;
}

/**
 * Detect supported document types from file bytes. The browser-supplied
 * Content-Type is not trusted on its own.
 */
export function sniffFileType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
