import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react';
import { createPortal } from 'react-dom';
import { cx, initials, statusTone, titleCase } from '../lib/format';

/* ------------------------------------------------------------------ icons */
export type IconName =
  | 'activity' | 'alert-circle' | 'alert-triangle' | 'arrow-left' | 'arrow-right'
  | 'arrow-up-right' | 'award' | 'bar-chart' | 'bell' | 'book-open' | 'briefcase'
  | 'building' | 'calendar' | 'check' | 'check-circle' | 'check-square' | 'chevron-down'
  | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'clock' | 'code' | 'copy'
  | 'credit-card' | 'database' | 'download' | 'edit' | 'external-link' | 'eye'
  | 'eye-off' | 'file-text' | 'filter' | 'flag' | 'globe' | 'grid' | 'help-circle'
  | 'info' | 'key' | 'layers' | 'list' | 'lock' | 'logout' | 'mail' | 'map-pin'
  | 'menu' | 'message' | 'minus' | 'more-horizontal' | 'percent' | 'phone'
  | 'pie-chart' | 'play' | 'plus' | 'refresh' | 'rupee' | 'scale' | 'search'
  | 'send' | 'server' | 'settings' | 'shield' | 'shield-check' | 'sparkles' | 'star'
  | 'target' | 'trash' | 'trending-up' | 'upload' | 'user' | 'users' | 'video'
  | 'wallet' | 'x' | 'x-circle' | 'zap';

const ICONS: Record<IconName, ReactNode> = {
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  'alert-circle': <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" /></>,
  'alert-triangle': <><path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12" y2="17" /></>,
  'arrow-left': <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  'arrow-right': <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  'arrow-up-right': <><line x1="7" y1="17" x2="17" y2="7" /><polyline points="8 7 17 7 17 16" /></>,
  award: <><circle cx="12" cy="9" r="6" /><polyline points="8.5 14 7 22 12 19 17 22 15.5 14" /></>,
  'bar-chart': <><line x1="4" y1="20" x2="4" y2="11" /><line x1="10" y1="20" x2="10" y2="5" /><line x1="16" y1="20" x2="16" y2="14" /><line x1="22" y1="20" x2="22" y2="8" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></>,
  'book-open': <><path d="M2 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2Z" /><path d="M22 4h-7a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22Z" /></>,
  briefcase: <><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="2.5" y1="12" x2="21.5" y2="12" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><line x1="8" y1="7" x2="8" y2="7" /><line x1="12" y1="7" x2="12" y2="7" /><line x1="16" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="8" y2="11" /><line x1="12" y1="11" x2="12" y2="11" /><line x1="16" y1="11" x2="16" y2="11" /><path d="M10 21v-5h4v5" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2" /><line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="3" y1="9.5" x2="21" y2="9.5" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  'check-circle': <><circle cx="12" cy="12" r="9" /><polyline points="8 12 11 15 16 9" /></>,
  'check-square': <><rect x="3" y="3" width="18" height="18" rx="3" /><polyline points="8 12 11 15 16 9" /></>,
  'chevron-down': <polyline points="6 9 12 15 18 9" />,
  'chevron-left': <polyline points="15 18 9 12 15 6" />,
  'chevron-right': <polyline points="9 18 15 12 9 6" />,
  'chevron-up': <polyline points="18 15 12 9 6 15" />,
  clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></>,
  code: <><polyline points="8 6 2 12 8 18" /><polyline points="16 6 22 12 16 18" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  'credit-card': <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="6" y1="15" x2="10" y2="15" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  'external-link': <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
  eye: <><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7S19 19 12 19 1.5 12 1.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': <><path d="M17.9 17.9A10.5 10.5 0 0 1 12 19C5 19 1.5 12 1.5 12a19 19 0 0 1 5-5.9" /><path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c7 0 10.5 8 10.5 8a19 19 0 0 1-2.2 3.4" /><line x1="2" y1="2" x2="22" y2="22" /></>,
  'file-text': <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></>,
  filter: <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />,
  flag: <><path d="M4 22V3" /><path d="M4 4h13l-2 5 2 5H4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  'help-circle': <><circle cx="12" cy="12" r="9" /><path d="M9.4 9a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.6-2.6 2.6" /><line x1="12" y1="17" x2="12" y2="17" /></>,
  info: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16.5" /><line x1="12" y1="7.8" x2="12" y2="7.8" /></>,
  key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m11 12 9-9M17 6l3 3M14 9l3 3" /></>,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3" y2="6" /><line x1="3" y1="12" x2="3" y2="12" /><line x1="3" y1="18" x2="3" y2="18" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><polyline points="3 6 12 13 21 6" /></>,
  'map-pin': <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  'more-horizontal': <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  percent: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z" />,
  'pie-chart': <><path d="M21.2 15.9A10 10 0 1 1 8 2.8" /><path d="M22 12A10 10 0 0 0 12 2v10Z" /></>,
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  refresh: <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" /></>,
  rupee: <><path d="M6 3h12M6 8h12M6 13h5.5a5.5 5.5 0 0 0 0-11" /><path d="M6 13l9 8" /></>,
  scale: <><line x1="12" y1="3" x2="12" y2="21" /><path d="M5 7h14" /><path d="M5 7 2 14h6L5 7ZM19 7l-3 7h6l-3-7ZM8 21h8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></>,
  send: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  server: <><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6" y2="6" /><line x1="6" y1="18" x2="6" y2="18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  shield: <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />,
  'shield-check': <><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><polyline points="8.5 11.5 11 14 15.5 9.5" /></>,
  sparkles: <><path d="m12 3 1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1Z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z" /></>,
  star: <polygon points="12 2 15.1 8.6 22.5 9.6 17 14.8 18.3 22.1 12 18.7 5.7 22.1 7 14.8 1.5 9.6 8.9 8.6 12 2" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  'trending-up': <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  video: <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>,
  wallet: <><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  'x-circle': <><circle cx="12" cy="12" r="9" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></>,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
};

export function Icon({
  name,
  className = 'icon',
  strokeWidth = 1.8,
  style
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {ICONS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ buttons */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'soft' | 'dark' | 'danger' | 'danger-soft' | 'white';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ cards */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cx('card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  bordered
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div className={cx('card-header', bordered && 'bordered')}>
      <div className="grow">
        {eyebrow ? <div className="eyebrow eyebrow-plain" style={{ marginBottom: 6 }}>{eyebrow}</div> : null}
        <h3 className="card-title">{title}</h3>
        {subtitle ? <div className="card-sub">{subtitle}</div> : null}
      </div>
      {actions ? <div className="card-actions">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {eyebrow ? <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <div className="page-sub">{description}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  actions
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  actions?: ReactNode;
}) {
  return (
    <div className={cx('section-head', align === 'center' && 'center')} style={actions ? { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', maxWidth: 'none' } : undefined}>
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h2 className="section-title">{title}</h2>
        {description ? <p className="section-sub">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/* ------------------------------------------------------------------ badges */
export function Badge({
  children,
  tone = 'neutral',
  dot,
  className
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'navy' | 'outline';
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge-${tone}`, className)}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
  return (
    <span className={cx('badge', `badge-${statusTone(status)}`)}>
      <span className="dot" />
      {label || titleCase(status)}
    </span>
  );
}

/* ------------------------------------------------------------------ form */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('field', className)}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <div className="error-text">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('input', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx('select', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('textarea', props.className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="switch" style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      <span>
        <span className="label" style={{ display: 'block' }}>{label}</span>
        {description ? <span className="hint" style={{ display: 'block' }}>{description}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ display */
export function Stat({
  label,
  value,
  sub,
  icon,
  tone
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  tone?: 'brand' | 'success' | 'warning' | 'navy';
}) {
  return (
    <div className="stat">
      <div className="stat-row">
        <span className="stat-label">{label}</span>
        {icon ? <span className={cx('stat-icon', tone === 'success' && 'green', tone === 'warning' && 'gold')}><Icon name={icon} /></span> : null}
      </div>
      <span className="stat-value">{value}</span>
      {sub ? <span className="stat-sub">{sub}</span> : null}
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
  className
}: {
  name?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  return (
    <span className={cx('avatar', size !== 'md' && `avatar-${size}`, className)} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

export function Rating({ value, showValue = true }: { value?: number | null; showValue?: boolean }) {
  const rating = Number(value || 0);
  return (
    <span className="rating" title={`${rating.toFixed(1)} out of 5`}>
      <Icon name="star" className="icon-sm" />
      {showValue ? <span>{rating > 0 ? rating.toFixed(1) : 'New'}</span> : null}
    </span>
  );
}

export function Progress({
  value,
  max = 100,
  tone = 'brand',
  label,
  meta
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'success' | 'warning' | 'navy';
  label?: ReactNode;
  meta?: ReactNode;
}) {
  const percent = Math.max(0, Math.min(100, (Number(value) / (Number(max) || 1)) * 100));
  return (
    <div>
      {label || meta ? (
        <div className="progress-meta">
          <span>{label}</span>
          <span>{meta}</span>
        </div>
      ) : null}
      <div className="progress" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx('progress-bar', tone !== 'brand' && tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({
  icon = 'sparkles',
  title,
  description,
  action
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} className="icon-xl" /></span>
      <div className="empty-title">{title}</div>
      {description ? <p className="empty-sub">{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
  icon
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'neutral';
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
}) {
  const iconName: IconName =
    icon ||
    (tone === 'success' ? 'check-circle' : tone === 'danger' ? 'alert-circle' : tone === 'warning' ? 'alert-triangle' : tone === 'brand' ? 'sparkles' : 'info');
  return (
    <div className={cx('alert', tone !== 'neutral' && `alert-${tone}`)}>
      <Icon name={iconName} />
      <div>
        {title ? <div className="alert-title">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange
}: {
  tabs: Array<{ key: T; label: ReactNode; count?: number }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={cx('tab', active === tab.key && 'active')}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md'
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={cx('modal', size !== 'md' && `modal-${size}`)} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle ? <div className="modal-sub">{subtitle}</div> : null}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function Accordion({ items }: { items: Array<{ q: ReactNode; a: ReactNode }> }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="accordion">
      {items.map((item, index) => (
        <div className="acc-item" key={index}>
          <button
            type="button"
            className={cx('acc-button', open === index && 'open')}
            onClick={() => setOpen(open === index ? null : index)}
            aria-expanded={open === index}
          >
            <span>{item.q}</span>
            <Icon name="plus" />
          </button>
          {open === index ? <div className="acc-body">{item.a}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onChange
}: {
  page: number;
  pages: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const windowStart = Math.max(1, Math.min(page - 2, pages - 4));
  const windowEnd = Math.min(pages, windowStart + 4);
  const numbers: number[] = [];
  for (let index = windowStart; index <= windowEnd; index += 1) numbers.push(index);
  return (
    <div className="pagination">
      <span className="tiny muted">
        Page {page} of {pages}
        {total !== undefined ? ` · ${total} result${total === 1 ? '' : 's'}` : ''}
      </span>
      <div className="pagination-pages">
        <button type="button" className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <Icon name="chevron-left" className="icon-sm" />
        </button>
        {numbers.map((number) => (
          <button key={number} type="button" className={cx('page-btn', number === page && 'active')} onClick={() => onChange(number)}>
            {number}
          </button>
        ))}
        <button type="button" className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <Icon name="chevron-right" className="icon-sm" />
        </button>
      </div>
    </div>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
      title="Copy to clipboard"
    >
      <Icon name={copied ? 'check' : 'copy'} className="icon-sm" />
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function MiniBars({
  data,
  format
}: {
  data: Array<{ label: string; value: number }>;
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className="chart-bars">
      {data.map((item) => (
        <div className="chart-bar-wrap" key={item.label} title={`${item.label}: ${format ? format(item.value) : item.value}`}>
          <div className="chart-bar" style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }} />
          <span className="chart-bar-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ScoreRing({ value, label }: { value: number; label?: string }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="score-ring" style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#efe9e1" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={percent >= 70 ? 'var(--success)' : percent >= 50 ? 'var(--gold)' : 'var(--brand)'}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1 }}>{Math.round(percent)}</strong>
        {label ? <span className="tiny muted" style={{ marginTop: 1, fontSize: 9.5, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{label}</span> : null}
      </div>
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<{ label: ReactNode; value: ReactNode }> }) {
  return (
    <div className="kv">
      {items.map((item, index) => (
        <div className="kv-row" key={index}>
          <span className="kv-key">{item.label}</span>
          <span className="kv-val">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Notice({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="notice">
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  );
}
