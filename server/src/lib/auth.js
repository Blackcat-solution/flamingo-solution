import crypto from 'node:crypto';
import { db, one, run, insert, nowIso } from '../db.js';
import { config } from '../config.js';
import { unauthorized, forbidden } from './errors.js';

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored || '').split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 10) {
    return 'Password must be at least 10 characters long';
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include upper-case, lower-case and numeric characters';
  }
  return null;
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const base64url = (buffer) =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function createSession(req, res, userId) {
  const token = base64url(crypto.randomBytes(32));
  const csrfToken = base64url(crypto.randomBytes(24));
  const id = `ses_${crypto.randomUUID()}`;
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600_000).toISOString();
  insert('sessions', {
    id,
    user_id: userId,
    token_hash: sha256(token),
    csrf_token: csrfToken,
    ip: req.ip,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
    created_at: createdAt,
    expires_at: expiresAt
  });
  const cookie = [
    `${config.sessionCookie}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${config.sessionTtlHours * 3600}`,
    config.secureCookies ? 'Secure' : null
  ]
    .filter(Boolean)
    .join('; ');
  res.setHeader('Set-Cookie', cookie);
  return { token, csrfToken, expiresAt };
}

export function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[config.sessionCookie];
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  res.setHeader(
    'Set-Cookie',
    `${config.sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      config.secureCookies ? '; Secure' : ''
    }`
  );
}

export function currentSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[config.sessionCookie];
  if (!token) return null;
  const session = one(
    `SELECT s.id, s.user_id, s.csrf_token, s.expires_at, s.created_at,
            u.name, u.email, u.role, u.admin_role, u.status, u.mfa_enabled
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
    sha256(token)
  );
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE id = ?', session.id);
    return null;
  }
  if (session.status !== 'active') return null;
  return session;
}

export function requireAuth(req, _res, next) {
  const session = currentSession(req);
  if (!session) return next(unauthorized());
  req.session = session;
  req.user = {
    id: session.user_id,
    name: session.name,
    email: session.email,
    role: session.role,
    adminRole: session.admin_role,
    mfaEnabled: Boolean(session.mfa_enabled)
  };
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export function requireAdminPermission(permission) {
  return (req, _res, next) => {
    if (!req.user || req.user.role !== 'admin') return next(forbidden());
    const permissions = adminPermissionsFor(req.user.adminRole);
    if (!permissions.includes('*') && !permissions.includes(permission)) {
      return next(forbidden('Your administrator role does not include this permission'));
    }
    next();
  };
}

export function adminPermissionsFor(adminRole) {
  const map = {
    super_admin: ['*'],
    verification_officer: [
      'users.view',
      'verification.review',
      'documents.review',
      'marketplace.moderate'
    ],
    finance_officer: [
      'finance.view',
      'finance.reconcile',
      'payouts.manage',
      'disputes.finance',
      'reports.view'
    ],
    recruitment_manager: [
      'users.view',
      'marketplace.view',
      'assignments.view',
      'interviews.view',
      'reports.view'
    ],
    support: ['users.view', 'support.tickets', 'disputes.view', 'marketplace.view']
  };
  return map[adminRole] || [];
}

export function verifyCsrf(req, res, next) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
  if (!req.session) return next(unauthorized());
  const token = req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrf_token) {
    return next(forbidden('CSRF validation failed. Refresh the page and try again.'));
  }
  next();
}

// ---------- Time-based one-time passwords (MFA readiness, no third-party dependency) ----------
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secret, timeStep = Math.floor(Date.now() / 30_000)) {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(timeStep / 2 ** 32), 0);
  counter.writeUInt32BE(timeStep % 2 ** 32, 4);
  const digest = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret, code) {
  const step = Math.floor(Date.now() / 30_000);
  for (let offset = -1; offset <= 1; offset += 1) {
    if (totpCode(secret, step + offset) === String(code)) return true;
  }
  return false;
}

export function mfaOtpauthUrl(secret, email) {
  return `otpauth://totp/FLAMINGO:${encodeURIComponent(email)}?secret=${secret}&issuer=FLAMINGO&algorithm=SHA1&digits=6&period=30`;
}

export function recordLoginAttempt(email, ip, success) {
  db.prepare(
    'INSERT INTO login_attempts (id, email, ip, success, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(`la_${crypto.randomUUID()}`, email.toLowerCase(), ip || '', success ? 1 : 0, nowIso());
  // Retain 30 days of authentication telemetry only.
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  run('DELETE FROM login_attempts WHERE created_at < ?', cutoff);
}
