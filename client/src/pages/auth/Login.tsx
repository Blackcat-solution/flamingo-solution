import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { Alert, Button, Field, Icon, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../lib/api';
import { errorMessage, useDocumentTitle } from '../../lib/hooks';

const DEMOS = [
  { role: 'Professional', email: 'candidate@flamingo.work', note: 'Aarav Mehta · active assignment' },
  { role: 'Employer', email: 'employer@flamingo.work', note: 'Meridian Technologies · verified' },
  { role: 'Super admin', email: 'admin@flamingo.work', note: 'Full platform access' },
  { role: 'Finance officer', email: 'finance@flamingo.work', note: 'Finance & reports only' },
  { role: 'Verification officer', email: 'verification@flamingo.work', note: 'Verification & documents' },
  { role: 'Support', email: 'support@flamingo.work', note: 'Users & disputes' }
];

const DESTINATIONS: Record<string, string> = {
  professional: '/portal/professional',
  employer: '/portal/employer',
  admin: '/portal/admin'
};

export default function Login() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [mfaRequired, setMfaRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof form) => (event: any) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const fillDemo = (email: string) => {
    setForm({ email, password: 'Flamingo@2026', code: '' });
    setMfaRequired(false);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email, form.password, mfaRequired ? form.code : undefined);
      notify(`Welcome back, ${user.name.split(' ')[0]}.`, 'success');
      const next = params.get('next');
      navigate(next || DESTINATIONS[user.role] || '/', { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'mfa_required') {
        setMfaRequired(true);
        setError('Multi-factor authentication is enabled for this account. Enter the 6-digit code from your authenticator.');
      } else {
        setError(errorMessage(cause));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div>
          <Brand inverse />
          <h2>Work your time.<br />Earn your worth.</h2>
          <p>
            A curated marketplace for experienced professionals and verified employers. Sign in to manage
            assignments, assessments, interviews and money in one place.
          </p>
          <div className="auth-points">
            <div><Icon name="shield-check" /> Identity, experience and assessment evidence in one record.</div>
            <div><Icon name="calendar" /> Compliant working patterns with automatic overlap protection.</div>
            <div><Icon name="wallet" /> Transparent 50/50 payments and itemised statements.</div>
          </div>
        </div>
        <div className="tiny" style={{ color: '#8fa3bc' }}>
          Demonstration environment. Payments, verification and payouts are simulated. No live money moves.
        </div>
      </aside>

      <main className="auth-main" style={{ flexDirection: 'column', alignItems: 'center' }}>
        <div className="auth-card">
          <span className="eyebrow">Welcome back</span>
          <h1 className="auth-title">Sign in to FLAMINGO</h1>
          <p className="auth-sub">Use your account email and password. Demo accounts use the password below.</p>

          {error ? <Alert tone={mfaRequired ? 'warning' : 'danger'} title={mfaRequired ? 'MFA required' : 'Sign-in failed'}>{error}</Alert> : null}

          <form className="auth-form" onSubmit={submit}>
            <Field label="Email address" htmlFor="login-email" required>
              <Input id="login-email" type="email" autoComplete="email" value={form.email} onChange={update('email')} required placeholder="you@company.com" />
            </Field>
            <Field label="Password" htmlFor="login-password" required>
              <Input id="login-password" type="password" autoComplete="current-password" value={form.password} onChange={update('password')} required placeholder="Your password" />
            </Field>
            {mfaRequired ? (
              <Field label="Authenticator code" htmlFor="login-code" required hint="6-digit time-based code. Demo accounts do not have MFA enabled by default.">
                <Input id="login-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.code} onChange={update('code')} required placeholder="000000" />
              </Field>
            ) : null}
            <Button type="submit" block loading={busy}>
              {mfaRequired ? 'Verify & sign in' : 'Sign in'} <Icon name="arrow-right" className="icon-sm" />
            </Button>
          </form>

          <div className="auth-demo">
            <div className="between">
              <span className="auth-demo-title">Demo accounts</span>
              <span className="tiny muted">Password: <span className="mono">Flamingo@2026</span></span>
            </div>
            <div className="demo-buttons">
              {DEMOS.map((demo) => (
                <button key={demo.email} type="button" onClick={() => fillDemo(demo.email)} title={demo.note}>
                  {demo.role}
                </button>
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Click a role to fill the credentials. Seeded accounts use <span className="mono">candidate@flamingo.work</span>,
              {' '}<span className="mono">employer@flamingo.work</span> and <span className="mono">admin@flamingo.work</span>.
            </p>
          </div>

          <div className="auth-footer">
            New to Flamingo? <Link to="/register/professional">Join as a professional</Link> or <Link to="/register/employer">create an employer account</Link>.
          </div>
          <div className="auth-footer" style={{ marginTop: 8 }}>
            <Link to="/">← Back to the public site</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
