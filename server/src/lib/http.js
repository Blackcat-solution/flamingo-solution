import crypto from 'node:crypto';
import { AppError, tooMany } from './errors.js';
import { insert, nowIso } from '../db.js';
import { config } from '../config.js';

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * When the site is served through a proxy that collapses every visitor onto a
 * handful of edge addresses, per-IP limits become per-audience limits. A single
 * noisy visitor can then lock everyone out of sign-in.
 *
 * RATE_LIMIT_MULTIPLIER scales every per-IP allowance so a shared demonstration
 * link stays usable. It is ignored outside demo mode: a real deployment keeps
 * the configured protection no matter what the environment says.
 */
export const rateLimitMultiplier = (() => {
  const parsed = Number(process.env.RATE_LIMIT_MULTIPLIER || 1);
  if (!Number.isFinite(parsed) || parsed <= 1) return 1;
  if (!config.demoMode) return 1;
  return Math.min(parsed, 100);
})();

const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 60, scope = 'default', keyFn } = {}) {
  const limit = Math.max(1, Math.round(max * rateLimitMultiplier));
  return (req, res, next) => {
    const key = `${scope}:${keyFn ? keyFn(req) : req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return next(tooMany());
    }
    next();
  };
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  res.setHeader('X-Request-Id', req.id);
  next();
}

export function requestContext(req, _res, next) {
  req.id = crypto.randomUUID();
  next();
}

export function audit(req, { action, entityType, entityId, meta, actorId, actorRole }) {
  insert('audit_logs', {
    id: `aud_${crypto.randomUUID()}`,
    actor_id: actorId ?? req?.user?.id ?? null,
    actor_role: actorRole ?? req?.user?.role ?? null,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    ip: req?.ip ?? null,
    meta: meta ? JSON.stringify(meta) : null,
    created_at: nowIso()
  });
}

export function pagination(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit || defaultLimit)));
  return { page, limit, offset: (page - 1) * limit };
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? null },
      requestId: req.id
    });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: { code: 'file_too_large', message: 'Upload exceeds the 8 MB limit' },
      requestId: req.id
    });
  }
  console.error(`[${req.id}]`, err);
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Our team has been notified.'
      : err.message;
  return res.status(500).json({
    error: { code: 'internal_error', message },
    requestId: req.id
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'not_found', message: `No route matches ${req.method} ${req.path}` },
    requestId: req.id
  });
}
