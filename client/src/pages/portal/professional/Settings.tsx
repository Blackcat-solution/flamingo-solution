import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, CopyButton, DefinitionList, Field, Icon,
  Input, Loading, PageHeader, StatusBadge, Tabs
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { dateLabel, dateTimeLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type TabKey = 'security' | 'account' | 'privacy';

export default function ProfessionalSettings() {
  useDocumentTitle('Security settings');
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const { data, loading, error, reload } = useApi<any>('/auth/me');
  const [tab, setTab] = useState<TabKey>('security');
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [enableCode, setEnableCode] = useState('');
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const account = data?.user || user;

  const startMfa = () =>
    run('mfa-setup', async () => {
      const result = await api<any>('/auth/mfa/setup', { method: 'POST' });
      setSetup({ secret: result.secret, otpauthUrl: result.otpauthUrl });
      return result;
    }, 'Authenticator secret generated. Confirm with a 6-digit code.');

  const enableMfa = () =>
    run('mfa-enable', async () => {
      await api('/auth/mfa/enable', { method: 'POST', body: { code: enableCode } });
      setSetup(null);
      setEnableCode('');
      await refresh();
      reload();
    }, 'Multi-factor authentication enabled.');

  const disableMfa = () =>
    run('mfa-disable', async () => {
      await api('/auth/mfa/disable', { method: 'POST', body: disableForm });
      setDisableForm({ password: '', code: '' });
      await refresh();
      reload();
    }, 'Multi-factor authentication disabled.');

  const changePassword = () =>
    run('password', async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('The new passwords do not match.');
      }
      await api('/auth/password/change', {
        method: 'POST',
        body: { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }
      });
      await logout();
      navigate('/login', { state: { message: 'Password changed. Sign in with your new password.' } });
    });

  if (loading && !account) return <Loading label="Loading security settings." />;
  if (error && !account) return <Alert tone="danger" title="Could not load your account">{error}</Alert>;

  return (
    <>
      <PageHeader
        title="Security settings"
        eyebrow="Account protection"
        description="Manage multi-factor authentication, your password and the data-sharing choices attached to your professional record."
      />

      <div className="grid grid-3" style={{ marginBottom: 22 }}>
        <Card className="card-pad-sm">
          <div className="between">
            <div className="stat-label">Multi-factor authentication</div>
            <StatusBadge status={account?.mfaEnabled ? 'active' : 'pending'} label={account?.mfaEnabled ? 'Enabled' : 'Not enabled'} />
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>A six-digit authenticator code at every sign-in.</p>
        </Card>
        <Card className="card-pad-sm">
          <div className="between">
            <div className="stat-label">Account status</div>
            <StatusBadge status={account?.status} />
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>Role: {titleCase(account?.role)}{account?.adminRole ? ` · ${titleCase(account.adminRole)}` : ''}</p>
        </Card>
        <Card className="card-pad-sm">
          <div className="between">
            <div className="stat-label">Last sign-in</div>
            <Icon name="clock" className="icon-sm text-muted" />
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>{account?.lastLoginAt ? dateTimeLabel(account.lastLoginAt) : 'This session'}</p>
        </Card>
      </div>

      <Tabs<TabKey>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'security', label: 'Security' },
          { key: 'account', label: 'Account details' },
          { key: 'privacy', label: 'Privacy & data' }
        ]}
      />

      <div className="split" style={{ marginTop: 22 }}>
        <div className="stack-lg">
          {tab === 'security' ? (
            <>
              <Card>
                <CardHeader
                  title="Multi-factor authentication"
                  subtitle="Recommended. Use any TOTP authenticator app."
                  actions={<Badge tone={account?.mfaEnabled ? 'success' : 'warning'}>{account?.mfaEnabled ? 'Active' : 'Off'}</Badge>}
                />
                {!account?.mfaEnabled ? (
                  <>
                    {!setup ? (
                      <>
                        <p className="small muted">
                          Add a second factor so a stolen password alone cannot access your identity documents, contracts
                          or payout records.
                        </p>
                        <Button onClick={startMfa} loading={busy === 'mfa-setup'}><Icon name="shield-check" className="icon-sm" /> Set up authenticator</Button>
                      </>
                    ) : (
                      <>
                        <div className="steps" style={{ marginTop: 8 }}>
                          <div className="step">
                            <span className="step-num">1</span>
                            <div>
                              <h3>Add the secret to your app</h3>
                              <p>Open your authenticator and add a new account using the secret below or the setup URI.</p>
                            </div>
                          </div>
                          <div className="step">
                            <span className="step-num">2</span>
                            <div>
                              <h3>Confirm a 6-digit code</h3>
                              <p>Enter the current code from the app. Codes rotate every 30 seconds.</p>
                            </div>
                          </div>
                          <div className="step">
                            <span className="step-num">3</span>
                            <div>
                              <h3>Keep a recovery route</h3>
                              <p>Store the secret in your password manager. Support can verify your identity if you lose the device.</p>
                            </div>
                          </div>
                        </div>
                        <div className="form-grid" style={{ marginTop: 14 }}>
                          <Field label="Authenticator secret" htmlFor="mfa-secret" className="span-2" hint="Shown once during setup. Do not share it.">
                            <div className="row" style={{ gap: 8 }}>
                              <Input id="mfa-secret" value={setup.secret} readOnly className="mono" />
                              <CopyButton value={setup.secret} label="Copy" />
                            </div>
                          </Field>
                          <Field label="Setup URI" htmlFor="mfa-uri" className="span-2" hint="Paste into an authenticator that accepts otpauth:// links.">
                            <div className="row" style={{ gap: 8 }}>
                              <Input id="mfa-uri" value={setup.otpauthUrl} readOnly className="mono tiny" />
                              <CopyButton value={setup.otpauthUrl} label="Copy" />
                            </div>
                          </Field>
                          <Field label="6-digit code" htmlFor="mfa-code" required>
                            <Input id="mfa-code" inputMode="numeric" maxLength={6} value={enableCode} onChange={(event) => setEnableCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="mono" />
                          </Field>
                        </div>
                        <div className="form-actions">
                          <Button variant="secondary" onClick={() => setSetup(null)}>Cancel</Button>
                          <Button onClick={enableMfa} loading={busy === 'mfa-enable'} disabled={enableCode.length !== 6}>Enable MFA</Button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Alert tone="success" title="MFA is protecting this account">
                      Every sign-in now requires your password and a current authenticator code.
                    </Alert>
                    <div className="form-section-head" style={{ marginTop: 18 }}>
                      <h3 className="form-section-title">Turn off MFA</h3>
                      <p className="form-section-sub">Requires your password and a current code. Turn it off only if you are replacing the device.</p>
                    </div>
                    <div className="form-grid">
                      <Field label="Current password" htmlFor="mfa-password" required>
                        <Input id="mfa-password" type="password" autoComplete="current-password" value={disableForm.password} onChange={(event) => setDisableForm((current) => ({ ...current, password: event.target.value }))} />
                      </Field>
                      <Field label="6-digit code" htmlFor="mfa-disable-code" required>
                        <Input id="mfa-disable-code" inputMode="numeric" maxLength={6} value={disableForm.code} onChange={(event) => setDisableForm((current) => ({ ...current, code: event.target.value.replace(/\D/g, '') }))} className="mono" />
                      </Field>
                    </div>
                    <div className="form-actions">
                      <Button variant="danger-soft" onClick={disableMfa} loading={busy === 'mfa-disable'} disabled={!disableForm.password || disableForm.code.length !== 6}>
                        Disable MFA
                      </Button>
                    </div>
                  </>
                )}
              </Card>

              <Card>
                <CardHeader title="Change password" subtitle="At least 10 characters with upper case, lower case, a number and a symbol." />
                <div className="form-grid">
                  <Field label="Current password" htmlFor="pw-current" required className="span-2">
                    <Input id="pw-current" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
                  </Field>
                  <Field label="New password" htmlFor="pw-new" required>
                    <Input id="pw-new" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
                  </Field>
                  <Field label="Confirm new password" htmlFor="pw-confirm" required error={passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword ? 'Passwords do not match.' : undefined}>
                    <Input id="pw-confirm" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
                  </Field>
                </div>
                <div className="alert alert-info" style={{ marginTop: 14 }}>
                  <Icon name="info" />
                  <div>Changing your password ends all active sessions, including this one. You will be asked to sign in again.</div>
                </div>
                <div className="form-actions">
                  <Button onClick={changePassword} loading={busy === 'password'} disabled={!passwordForm.currentPassword || passwordForm.newPassword.length < 10}>Change password</Button>
                </div>
              </Card>
            </>
          ) : null}

          {tab === 'account' ? (
            <Card>
              <CardHeader title="Account details" subtitle="Identity fields are managed by Flamingo support to keep verification records consistent." />
              <DefinitionList
                items={[
                  { label: 'Name', value: account?.name || '—' },
                  { label: 'Email', value: account?.email || '—' },
                  { label: 'Role', value: titleCase(account?.role) },
                  { label: 'Status', value: <StatusBadge status={account?.status} /> },
                  { label: 'Account created', value: account?.createdAt ? dateLabel(account.createdAt) : '—' },
                  { label: 'Last sign-in', value: account?.lastLoginAt ? dateTimeLabel(account.lastLoginAt) : 'This session' },
                  { label: 'Demo account', value: account?.isDemo ? <Badge tone="brand">Yes — seeded data</Badge> : 'No' }
                ]}
              />
              <div className="form-actions">
                <Link className="btn btn-secondary" to="/portal/professional/profile">Edit professional profile</Link>
                <Link className="btn btn-secondary" to="/contact">Contact support</Link>
              </div>
            </Card>
          ) : null}

          {tab === 'privacy' ? (
            <>
              <Card>
                <CardHeader title="What employers can see" subtitle="Contact details stay private until you are shortlisted." />
                <div className="compare-list" style={{ listStyle: 'none', padding: 0 }}>
                  {[
                    ['Public when published', 'Headline, category, city, experience, skills, rating and rate.'],
                    ['After shortlisting', 'Full name and contact details are released to that verified employer.'],
                    ['Never shared in the marketplace', 'Identity document images, home address and payout details.'],
                    ['Audited access', 'Verification officers and finance staff access records only through logged routes.']
                  ].map(([title, copy]) => (
                    <div className="row" key={title} style={{ alignItems: 'flex-start', padding: '8px 0' }}>
                      <Icon name="check-circle" className="icon-sm text-success" />
                      <span>
                        <span className="tiny strong" style={{ display: 'block' }}>{title}</span>
                        <span className="tiny muted">{copy}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Data rights" subtitle="You can ask for a copy, correction or deletion of eligible data." />
                <div className="grid grid-2">
                  <div>
                    <strong className="small">Access & portability</strong>
                    <p className="tiny muted">Request an export of your profile, documents metadata, assignments and payout records.</p>
                    <Link className="btn btn-secondary btn-sm" to="/contact">Request export</Link>
                  </div>
                  <div>
                    <strong className="small">Correction</strong>
                    <p className="tiny muted">Verified fields can be corrected with supporting evidence. Audit history is preserved.</p>
                    <Link className="btn btn-secondary btn-sm" to="/contact">Request correction</Link>
                  </div>
                </div>
                <Alert tone="warning" title="Retention">
                  Financial and audit records are retained for the period required by law. Deleting your profile does not
                  erase completed payout or tax records.
                </Alert>
              </Card>
            </>
          ) : null}
        </div>

        <div className="stack">
          <Card className="card-pad">
            <div className="row"><span className="icon-tile green sm"><Icon name="shield-check" /></span><strong>Security checklist</strong></div>
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {[
                ['Use a unique password', true],
                ['Enable MFA', Boolean(account?.mfaEnabled)],
                ['Keep your email secure', true],
                ['Review sessions after a password change', true]
              ].map(([label, done]) => (
                <div className="row" key={String(label)} style={{ alignItems: 'flex-start' }}>
                  <Icon name={done ? 'check-circle' : 'alert-circle'} className={done ? 'icon-sm text-success' : 'icon-sm text-warning'} />
                  <span className="tiny">{label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Session safety" />
            <p className="tiny muted">
              Sessions are HTTP-only and bound to a CSRF token. Sign-in attempts are rate limited. All security events are
              written to an audit log.
            </p>
            <Button variant="secondary" size="sm" className="btn-block" onClick={() => run('refresh', async () => { await refresh(); reload(); }, 'Security status refreshed.')} loading={busy === 'refresh'} style={{ marginTop: 10 }}>
              <Icon name="refresh" className="icon-sm" /> Refresh status
            </Button>
          </Card>

          <Alert tone="info" title="Demonstration environment">
            This environment uses seeded demo accounts. Do not reuse a real password, and do not upload genuine identity
            documents.
          </Alert>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile navy sm"><Icon name="help-circle" /></span><strong>Lost your device?</strong></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Contact support from a verified email address. Identity re-verification is required before MFA can be reset.
            </p>
          </Card>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Account lifecycle" sub="Your professional record is preserved if membership becomes inactive." />
        <Alert tone="neutral">
          Deactivating public visibility does not delete your record. Completed assignments, reviews, assessments and
          payout history remain available to you for the retention period.
        </Alert>
      </div>
    </>
  );
}
