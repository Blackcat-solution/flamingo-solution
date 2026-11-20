import { useId } from 'react';
import { Link } from 'react-router-dom';

type MarkProps = {
  className?: string;
  inverse?: boolean;
};

/**
 * Custom FLAMINGO mark: a stylised flamingo built from a single coral body,
 * an S-curve neck and a geometric head. No external asset dependency.
 */
export function FlamingoMark({ className = 'brand-mark', inverse = false }: MarkProps) {
  const uid = useId().replace(/:/g, '');
  const bodyId = `flamingo-body-${uid}`;
  const wingId = `flamingo-wing-${uid}`;
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="FLAMINGO">
      <defs>
        <linearGradient id={bodyId} x1="12" y1="12" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor={inverse ? '#ff9aa6' : '#f47783'} />
          <stop offset="1" stopColor={inverse ? '#ff6f84' : '#e0445e'} />
        </linearGradient>
        <linearGradient id={wingId} x1="24" y1="36" x2="46" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor={inverse ? '#ffd0d6' : '#ffd4d9'} />
          <stop offset="1" stopColor={inverse ? '#ffb9c3' : '#ffb4bf'} />
        </linearGradient>
      </defs>
      <path
        d="M30.8 54.4c-8.9.5-15.2-4.5-14.5-12 .6-6.4 6.1-10.5 13-10.1 7.7.4 13.2 5.6 13.5 13 .2 5.6-4.4 9.6-12 9.1Z"
        fill={`url(#${bodyId})`}
      />
      <path
        d="M44.9 23.2c-2.8 5.7-8.1 7.4-8.7 13.3-.5 4.6 2.1 8.2 6.2 9.7"
        fill="none"
        stroke={`url(#${bodyId})`}
        strokeWidth="5.4"
        strokeLinecap="round"
      />
      <path
        d="M23.6 39.9c5-3.2 12.2-2.9 17.1 1.6 2.1 1.9 2.9 4.3 2.2 6.4-6.1 1.8-12.6.9-17.1-2.6-2-1.6-3.1-3.6-2.2-5.4Z"
        fill={`url(#${wingId})`}
      />
      <path
        d="M39.4 12.3a7.6 7.6 0 1 0 0 15.2 7.6 7.6 0 0 0 0-15.2Z"
        fill={`url(#${bodyId})`}
      />
      <path d="M46.7 17.1h7.6l-7.6 4.9v-4.9Z" fill="#0d1a2b" />
      <circle cx="42" cy="17.1" r="1.35" fill="#fff" />
      <path d="M24.3 54.1 22 62M33.2 55.9 36 62" stroke="#0d1a2b" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M18.8 62h6M33.2 62h6" stroke="#0d1a2b" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

type BrandProps = {
  to?: string;
  inverse?: boolean;
  large?: boolean;
  tagline?: boolean;
  className?: string;
};

export function Brand({ to, inverse = false, large = false, tagline = true, className = '' }: BrandProps) {
  const content = (
    <>
      <FlamingoMark inverse={inverse} />
      <span>
        <span className="brand-word">FLAMINGO</span>
        {tagline ? <span className="brand-tag">Work your time. Earn your worth.</span> : null}
      </span>
    </>
  );
  const classes = ['brand', large ? 'brand-lg' : '', inverse ? 'brand-inverse' : '', className]
    .filter(Boolean)
    .join(' ');
  if (to) {
    return (
      <Link to={to} className={classes} aria-label="FLAMINGO home">
        {content}
      </Link>
    );
  }
  return <span className={classes}>{content}</span>;
}
