import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.storageDir, { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
db.exec(schema);

export const nowIso = () => new Date().toISOString();
export const isoDaysFromNow = (days) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

export const uid = (prefix = '') => `${prefix}${crypto.randomUUID()}`;

export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

export function one(sql, ...params) {
  return db.prepare(sql).get(...params);
}

export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

export function jsonParse(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function insert(table, data) {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  db.prepare(sql).run(...keys.map((key) => data[key]));
  return data;
}

export function update(table, id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...keys.map((key) => data[key]), id);
}

const DEFAULT_SETTINGS = {
  activation_fee_paise: 69900,
  gst_rate_bps: 1800,
  platform_fee_bps: 0,
  advance_percent: 50,
  tds_rate_bps: 10,
  tds_threshold_paise: 50000000,
  max_working_hours_day: 12,
  max_working_days_week: 4,
  weekly_hours_cap: 48,
  min_experience_years: 3,
  max_interview_rounds: 2,
  min_assessment_score: 70,
  assessment_retake_days: 30,
  payout_hold_days: 3,
  mandatory_off_days: 'SUN,MON',
  allowed_working_days: 'TUE,WED,THU,FRI,SAT',
  shift_options: '8,10,12',
  break_policy: '15,15,30',
  support_email: 'support@flamingo.work',
  brand_legal_name: 'Flamingo Solution Pvt. Ltd.',
  marketplace_min_rating: 0,
  fraud_review_threshold: 60
};

export function getSettings() {
  const rows = all('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  return {
    ...merged,
    activation_fee_paise: Number(merged.activation_fee_paise),
    gst_rate_bps: Number(merged.gst_rate_bps),
    platform_fee_bps: Number(merged.platform_fee_bps),
    advance_percent: Number(merged.advance_percent),
    tds_rate_bps: Number(merged.tds_rate_bps),
    max_working_hours_day: Number(merged.max_working_hours_day),
    max_working_days_week: Number(merged.max_working_days_week),
    weekly_hours_cap: Number(merged.weekly_hours_cap),
    min_experience_years: Number(merged.min_experience_years),
    max_interview_rounds: Number(merged.max_interview_rounds),
    min_assessment_score: Number(merged.min_assessment_score),
    assessment_retake_days: Number(merged.assessment_retake_days),
    mandatoryOffDays: String(merged.mandatory_off_days).split(',').filter(Boolean),
    allowedWorkingDays: String(merged.allowed_working_days).split(',').filter(Boolean),
    shiftOptions: String(merged.shift_options).split(',').map(Number),
    breakPolicy: String(merged.break_policy).split(',').map(Number)
  };
}

export function ensureDefaultSettings() {
  const existing = new Set(all('SELECT key FROM settings').map((r) => r.key));
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!existing.has(key)) {
      insert('settings', {
        key,
        value: String(value),
        description: null,
        updated_at: nowIso(),
        updated_by: null
      });
    }
  }
}

export function setSetting(key, value, actorId) {
  const existing = one('SELECT key FROM settings WHERE key = ?', key);
  if (existing) {
    run(
      'UPDATE settings SET value = ?, updated_at = ?, updated_by = ? WHERE key = ?',
      String(value),
      nowIso(),
      actorId,
      key
    );
  } else {
    insert('settings', {
      key,
      value: String(value),
      description: null,
      updated_at: nowIso(),
      updated_by: actorId
    });
  }
}

export function resetDatabase() {
  const tables = all(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  ).map((row) => row.name);
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const table of tables) {
    db.exec(`DELETE FROM ${table};`);
  }
  db.exec('PRAGMA foreign_keys = ON;');
}

export { DEFAULT_SETTINGS };
