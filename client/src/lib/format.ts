export const inr = (paise?: number | null, options?: { compact?: boolean }) => {
  if (paise === null || paise === undefined || Number.isNaN(Number(paise))) return '—';
  const value = Number(paise) / 100;
  if (options?.compact && Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(value >= 1000000 ? 0 : 1)}L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
};

export const dateLabel = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  }).format(date);
};

export const dateTimeLabel = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
};

export const relativeTime = (value?: string | null) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d ago`;
  return dateLabel(value);
};

export const initials = (name?: string) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export const titleCase = (value?: string | null) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const statusTone = (status?: string | null) => {
  const value = String(status || '').toLowerCase();
  if (['active', 'verified', 'approved', 'paid', 'passed', 'captured', 'published', 'resolved', 'selected', 'upheld'].includes(value)) return 'success';
  if (['pending', 'in_review', 'submitted', 'processing', 'awaiting_approval', 'human_review', 'challenged', 'under_review', 'investigating', 'in_progress', 'not_started'].includes(value)) return 'warning';
  if (['rejected', 'failed', 'suspended', 'cancelled', 'disputed', 'closed', 'expired', 'no_show', 'below_expectations'].includes(value)) return 'danger';
  return 'neutral';
};

export const dayList = (days?: string[]) => (days && days.length ? days.join(' · ') : 'Not set');

export const cx = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

export const safeArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);
