import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [version, setVersion] = useState(0);
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((cause) => {
        if (!cancelled) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { data, error, loading, reload, setData };
}

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const previous = document.title;
    if (title) document.title = `${title} · FLAMINGO`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details as unknown;
    let extra = '';
    if (Array.isArray(details)) {
      extra = details
        .map((item) => (typeof item === 'string' ? item : (item as { message?: string })?.message))
        .filter(Boolean)
        .join(' ');
    } else if (details && typeof details === 'object') {
      extra = Object.values(details as Record<string, unknown>)
        .filter((item): item is string => typeof item === 'string')
        .join(' ');
    }
    return extra && !error.message.includes(extra) ? `${error.message} ${extra}` : error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export const rupeesToPaise = (value: string | number): number => {
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
};

export const paiseToRupees = (paise?: number | null): number =>
  Number.isFinite(Number(paise)) ? Number(paise) / 100 : 0;

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const addDaysISO = (date: string, days: number): string => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

export const toNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
