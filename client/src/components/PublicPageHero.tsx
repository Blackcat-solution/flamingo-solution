import type { ReactNode } from 'react';

export function PublicPageHero({
  eyebrow,
  title,
  lead,
  actions,
  aside,
  meta
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className={`container ${aside ? 'page-hero-grid' : ''}`}>
        <div>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1 className="page-hero-title">{title}</h1>
          {lead ? <p className="page-hero-lead">{lead}</p> : null}
          {actions ? <div className="hero-actions">{actions}</div> : null}
          {meta ? <div className="hero-trust">{meta}</div> : null}
        </div>
        {aside ? <div className="page-hero-aside">{aside}</div> : null}
      </div>
    </section>
  );
}
