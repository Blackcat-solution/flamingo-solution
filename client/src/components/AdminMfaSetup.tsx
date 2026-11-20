import { useState } from 'react';
import { Brand } from './Brand';
import { Alert, Button, Card, CopyButton, Field, Icon, Input } from './ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useAction } from '../lib/useAction';

/**
 * Blocking enrolment screen for administrator accounts. In production the
 * admin API stays closed until a TOTP authenticator is enabled, so the portal
 * shell is replaced with this setup flow.
 */
export function AdminMfaSetup() {
  const { user, logout, refresh } = useAuth();
  const { busy, run } = useAction();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');

  const start = () =>
    run(
      'mfa-setup',
      async () => {
        const result = await api<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup', {
          method: 'POST'
        });
        setSetup({ secret: result.secret, otpauthUrl: result.otpauthUrl });
      },
      'Authenticator key generated. Add it to your app, then confirm a 6-digit code.'
    );

  const enable = () =>
    run(
      'mfa-enable',
      async () => {
        await api('/auth/mfa/enable', { method: 'POST', body: { code } });
        setSetup(null);
        setCode('');
        await refresh();
      },
      'Multi-factor authentication enabled. The admin console is now unlocked.'
    );

  return (
    <div className="auth-main" style={{ minHeight: '100vh', flexDirection: 'column', alignItems: 'center' }}>
      <div className="auth-card wide">
        <Brand />
        <span className="eyebrow" style={{ marginTop: 28, display: 'block' }}>Administrator security</span>
        <h1 className="auth-title">Enable multi-factor authentication</h1>
        <p className="auth-sub">
          {user?.name ? `${user.name}, ` : ''}the administrator console is locked until this account has an
          authenticator app. This protects contracts, identity documents, payouts and platform settings if a
          password is stolen.
        </p>

        <Alert tone="warning" title="Admin access is blocked until MFA is enabled">
          Sign-in alone is not sufficient in this environment. Complete enrolment below, or sign out and ask a
          super administrator for help.
        </Alert>

        {!setup ? (
          <Card className="card-pad" style={{ marginTop: 18 }}>
            <div className="steps">
              <div className="step">
                <span className="step-num">1</span>
                <div>
                  <h3>Generate a setup key</h3>
                  <p>The secret is shown once and stored server-side. Never share it.</p>
                </div>
              </div>
              <div className="step">
                <span className="step-num">2</span>
                <div>
                  <h3>Add it to any TOTP authenticator</h3>
                  <p>Use the secret or the otpauth:// setup URI in your password manager or authenticator app.</p>
                </div>
              </div>
              <div className="step">
                <span className="step-num">3</span>
                <div>
                  <h3>Confirm a 6-digit code</h3>
                  <p>The console unlocks only after the server verifies a current code.</p>
                </div>
              </div>
            </div>
            <Button onClick={start} loading={busy === 'mfa-setup'}>
              <Icon name="shield-check" className="icon-sm" /> Generate setup key
            </Button>
          </Card>
        ) : (
          <Card className="card-pad" style={{ marginTop: 18 }}>
            <div className="form-grid">
              <Field
                label="Authenticator secret"
                htmlFor="admin-mfa-secret"
                className="span-2"
                hint="Shown once during setup. Store it in your password manager."
              >
                <div className="row" style={{ gap: 8 }}>
                  <Input id="admin-mfa-secret" value={setup.secret} readOnly className="mono" />
                  <CopyButton value={setup.secret} label="Copy" />
                </div>
              </Field>
              <Field
                label="Setup URI"
                htmlFor="admin-mfa-uri"
                className="span-2"
                hint="Paste into an authenticator that accepts otpauth:// links."
              >
                <div className="row" style={{ gap: 8 }}>
                  <Input id="admin-mfa-uri" value={setup.otpauthUrl} readOnly className="mono tiny" />
                  <CopyButton value={setup.otpauthUrl} label="Copy" />
                </div>
              </Field>
              <Field label="6-digit code" htmlFor="admin-mfa-code" required>
                <Input
                  id="admin-mfa-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="mono"
                  autoComplete="one-time-code"
                />
              </Field>
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setSetup(null)}>Cancel</Button>
              <Button
                onClick={enable}
                loading={busy === 'mfa-enable'}
                disabled={code.length !== 6}
              >
                Enable MFA & unlock console
              </Button>
            </div>
          </Card>
        )}

        <div className="auth-footer" style={{ marginTop: 18 }}>
          <Button variant="ghost" size="sm" onClick={() => { void logout(); }}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
