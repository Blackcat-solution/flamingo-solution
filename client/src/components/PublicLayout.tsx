import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Brand, FlamingoMark } from './Brand';
import { useAuth } from '../context/AuthContext';
import { Avatar, Icon } from './ui';

export function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);
  return null;
}

const primaryNav = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/professionals', label: 'Find talent' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/trust-safety', label: 'Trust & safety' },
  { to: '/faq', label: 'FAQ' }
];

function portalFor(role?: string) {
  if (role === 'professional') return '/portal/professional';
  if (role === 'employer') return '/portal/employer';
  if (role === 'admin') return '/portal/admin';
  return null;
}

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="public-shell">
      <header className="pub-header">
        <div className="container pub-header-inner">
          <Brand to="/" />
          <nav className="pub-nav" aria-label="Primary">
            {primaryNav.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="pub-actions">
            {user ? (
              <>
                <Link className="btn btn-secondary btn-sm" to={portalFor(user.role) || '/'}>
                  <Icon name="grid" className="icon-sm" />
                  Portal
                </Link>
                <Link className="btn btn-primary btn-sm" to={portalFor(user.role) || '/'}>
                  <Avatar name={user.name} size="sm" className="avatar-navy" />
                  {user.name.split(' ')[0]}
                </Link>
              </>
            ) : (
              <>
                <Link className="btn btn-secondary btn-sm" to="/login">Sign in</Link>
                <Link className="btn btn-primary btn-sm" to="/register/professional">
                  Join Flamingo
                  <Icon name="arrow-right" className="icon-sm" />
                </Link>
              </>
            )}
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setOpen((value) => !value)}
              aria-label="Toggle navigation"
              aria-expanded={open}
            >
              <Icon name={open ? 'x' : 'menu'} />
            </button>
          </div>
        </div>
        <div className={`pub-mobile ${open ? 'open' : ''}`}>
          <div className="container">
            {primaryNav.map((item) => (
              <NavLink key={item.to} to={item.to}>{item.label}</NavLink>
            ))}
            <NavLink to="/for-professionals">For professionals</NavLink>
            <NavLink to="/for-employers">For employers</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            {!user ? (
              <>
                <Link className="btn btn-secondary btn-block" to="/login">Sign in</Link>
                <Link className="btn btn-primary btn-block" to="/register/professional">Join Flamingo</Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Brand inverse tagline={false} />
              <p className="footer-brand-copy">
                A curated marketplace where experienced professionals choose compliant working patterns and
                verified employers hire assessed talent with transparent money mechanics.
              </p>
              <div className="footer-meta">
                <span className="badge badge-navy">Demo environment</span>
                <span className="badge badge-outline" style={{ color: '#b9c6d6', borderColor: '#39516d' }}>India</span>
              </div>
            </div>
            <div>
              <h4>Platform</h4>
              <Link to="/how-it-works">How it works</Link>
              <Link to="/professionals">Professional directory</Link>
              <Link to="/pricing">Pricing & benchmarks</Link>
              <Link to="/trust-safety">Trust & safety</Link>
              <Link to="/faq">FAQ</Link>
            </div>
            <div>
              <h4>Professionals</h4>
              <Link to="/register/professional">Create a profile</Link>
              <Link to="/for-professionals">Why Flamingo</Link>
              <Link to="/login">Professional sign in</Link>
              <Link to="/trust-safety#assessments">Assessments</Link>
            </div>
            <div>
              <h4>Employers</h4>
              <Link to="/register/employer">Hire verified talent</Link>
              <Link to="/for-employers">Employer overview</Link>
              <Link to="/login">Employer sign in</Link>
              <Link to="/contact">Talk to us</Link>
            </div>
          </div>
          <div className="footer-note">
            <p>© {new Date().getFullYear()} Flamingo Solution Pvt. Ltd. All rights reserved. FLAMINGO and the flamingo mark are demo brand assets.</p>
            <p>
              Demonstration product: identity checks, assessments, payments and payouts are simulated. No live money moves.
              Market rates are sourced recommendations, not audited facts. GST and TDS treatment must be confirmed by a
              qualified adviser. Flamingo does not use automated AI-detection to make employment decisions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PublicNotFound() {
  return (
    <div className="container section" style={{ textAlign: 'center', paddingTop: 100, paddingBottom: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <FlamingoMark className="brand-mark" />
      </div>
      <p className="eyebrow" style={{ justifyContent: 'center' }}>404</p>
      <h1 className="section-title" style={{ marginTop: 10 }}>This page has flown away.</h1>
      <p className="section-sub" style={{ maxWidth: 480, margin: '14px auto 0' }}>
        The link may be outdated, or the page may have moved. Head back to the marketplace or explore how Flamingo works.
      </p>
      <div className="row center" style={{ marginTop: 26, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/">Back to home</Link>
        <Link className="btn btn-secondary" to="/professionals">Browse professionals</Link>
      </div>
    </div>
  );
}
