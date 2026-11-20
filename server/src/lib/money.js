import crypto from 'node:crypto';

/** Money is stored as integer paise. Round half-up at every boundary. */
export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function toRupees(paise) {
  return Math.round(Number(paise)) / 100;
}

export function formatInr(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(toRupees(paise));
}

export function splitGst(grossPaise, gstRateBps) {
  const base = Math.round((grossPaise * 10_000) / (10_000 + gstRateBps));
  return { base, gst: grossPaise - base };
}

export function addGst(basePaise, gstRateBps) {
  const gst = Math.round((basePaise * gstRateBps) / 10_000);
  return { base: basePaise, gst, total: basePaise + gst };
}

export function percentOf(amountPaise, percent) {
  return Math.round((amountPaise * percent) / 100);
}

export function randomId(prefix) {
  return `${prefix}${crypto.randomUUID()}`;
}

export function invoiceNumber(seq, type = 'INV') {
  const year = new Date().getFullYear();
  return `FLM-${year}-${type}-${String(seq).padStart(5, '0')}`;
}
