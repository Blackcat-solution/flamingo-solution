import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../ui';

export function SectionTitle({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="portal-section-head">
      <div>
        <h2 className="portal-section-title">{title}</h2>
        {sub ? <div className="portal-section-sub">{sub}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function QuickLink({ to, icon, title, sub }: { to: string; icon: IconName; title: string; sub: string }) {
  return (
    <Link to={to} className="card card-hover card-pad" style={{ display: 'block' }}>
      <span className="icon-tile"><Icon name={icon} /></span>
      <strong style={{ display: 'block', marginTop: 12 }}>{title}</strong>
      <span className="tiny muted" style={{ display: 'block', marginTop: 4 }}>{sub}</span>
    </Link>
  );
}

export function InlineEmpty({ children }: { children: ReactNode }) {
  return <div className="table-empty">{children}</div>;
}

export function FieldValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div>
      <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.68rem' }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 600, fontSize: '0.88rem' }}>{value}</div>
    </div>
  );
}

export function ToneIcon({ name, tone = 'brand' }: { name: IconName; tone?: 'brand' | 'green' | 'gold' | 'navy' }) {
  return <span className={`icon-tile ${tone === 'green' ? 'green' : tone === 'gold' ? 'gold' : tone === 'navy' ? 'navy' : ''}`}><Icon name={name} /></span>;
}
