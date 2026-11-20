import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { Alert, Button, Field, Icon, Input, Select, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { errorMessage, useApi, useDocumentTitle } from '../../lib/hooks';

export default function RegisterProfessional() {
  useDocumentTitle('Create a professional profile');
  const { refresh } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const { data: categoryData } = useApi<{ categories: any[] }>('/public/categories');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    category: 'technology',
    yearsExperience: '3',
    headline: '',
    city: '',
    state: '',
    education: '',
    skills: '',
    consent: false
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof form) => (event: any) =>
    setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const skills = form.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
      if (!skills.length) throw new Error('Add at least one skill, separated by commas.');
      await api('/auth/register/professional', {
        method: 'POST',
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          category: form.category,
          yearsExperience: Number(form.yearsExperience),
          headline: form.headline,
          city: form.city,
          state: form.state,
          education: form.education,
          skills,
          consent: form.consent
        }
      });
      await refresh();
      notify('Account created. Complete your profile, upload documents and take your assessment.', 'success');
      navigate('/portal/professional', { replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div>
          <Brand inverse />
          <h2>Your experience deserves a better marketplace.</h2>
          <p>
            Registration is free. Build a verified record, take a practical assessment and choose the working pattern
            that fits your life.
          </p>
          <div className="auth-points">
            <div><Icon name="check-circle" /> No subscription and no charge without an assignment.</div>
            <div><Icon name="check-circle" /> Minimum three years of professional experience.</div>
            <div><Icon name="check-circle" /> Public visibility only after verification and assessment.</div>
            <div><Icon name="check-circle" /> 8, 10 or 12-hour shifts across Tuesday–Saturday.</div>
          </div>
        </div>
        <div className="tiny" style={{ color: '#8fa3bc' }}>
          Seeded demo password for existing accounts: <span className="mono">Flamingo@2026</span>
        </div>
      </aside>

      <main className="auth-main" style={{ flexDirection: 'column', alignItems: 'center' }}>
        <div className="auth-card wide">
          <span className="eyebrow">Professional registration</span>
          <h1 className="auth-title">Create your professional profile</h1>
          <p className="auth-sub">Start with the essentials. You can complete your bio, availability, documents and references in the portal.</p>

          {error ? <Alert tone="danger" title="Registration not completed">{error}</Alert> : null}

          <form className="auth-form" onSubmit={submit}>
            <div className="form-section">
              <div className="form-section-head">
                <h2 className="form-section-title">Account</h2>
                <p className="form-section-sub">Your legal name is used for verification. Email cannot be changed later.</p>
              </div>
              <div className="form-grid">
                <Field label="Full name" htmlFor="reg-name" required>
                  <Input id="reg-name" value={form.name} onChange={update('name')} required minLength={2} placeholder="e.g. Aarav Mehta" />
                </Field>
                <Field label="Email address" htmlFor="reg-email" required>
                  <Input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={update('email')} required placeholder="you@example.com" />
                </Field>
                <Field label="Password" htmlFor="reg-password" required hint="At least 10 characters, with upper-case, lower-case and a number.">
                  <Input id="reg-password" type="password" autoComplete="new-password" value={form.password} onChange={update('password')} required minLength={10} placeholder="Create a strong password" />
                </Field>
                <Field label="Phone number" htmlFor="reg-phone" required>
                  <Input id="reg-phone" type="tel" value={form.phone} onChange={update('phone')} required minLength={6} placeholder="+91 98…" />
                </Field>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-head">
                <h2 className="form-section-title">Professional identity</h2>
                <p className="form-section-sub">Flamingo requires a minimum of three years of professional experience.</p>
              </div>
              <div className="form-grid">
                <Field label="Category" htmlFor="reg-category" required>
                  <Select id="reg-category" value={form.category} onChange={update('category')}>
                    {(categoryData?.categories || [{ key: 'technology', label: 'Information Technology & Software' }]).map((category) => (
                      <option key={category.key} value={category.key}>{category.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Years of experience" htmlFor="reg-years" required hint="Minimum 3 years. Claims are verified before public visibility.">
                  <Input id="reg-years" type="number" min={0} max={60} step={0.5} value={form.yearsExperience} onChange={update('yearsExperience')} required />
                </Field>
                <Field label="Professional headline" htmlFor="reg-headline" required className="span-2">
                  <Input id="reg-headline" value={form.headline} onChange={update('headline')} required minLength={3} maxLength={160} placeholder="e.g. Senior React Engineer · Design systems & accessibility" />
                </Field>
                <Field label="City" htmlFor="reg-city" required>
                  <Input id="reg-city" value={form.city} onChange={update('city')} required placeholder="Bengaluru" />
                </Field>
                <Field label="State" htmlFor="reg-state" required>
                  <Input id="reg-state" value={form.state} onChange={update('state')} required placeholder="Karnataka" />
                </Field>
                <Field label="Education" htmlFor="reg-education" className="span-2" hint="Highest relevant qualification. Optional at registration.">
                  <Input id="reg-education" value={form.education} onChange={update('education')} placeholder="e.g. B.Tech Computer Science" />
                </Field>
                <Field label="Skills" htmlFor="reg-skills" required className="span-2" hint="Comma-separated. Add at least three later for profile completeness.">
                  <Textarea id="reg-skills" value={form.skills} onChange={update('skills')} required placeholder="React, TypeScript, Design systems, Accessibility" style={{ minHeight: 84 }} />
                </Field>
              </div>
            </div>

            <label className="checkbox">
              <input type="checkbox" checked={form.consent} onChange={update('consent')} required />
              <span>
                I confirm that the information I provide is accurate, I have at least three years of professional
                experience, and I consent to identity and experience verification. I have read the{' '}
                <Link to="/trust-safety">trust & safety</Link> and <Link to="/pricing">pricing</Link> pages.
              </span>
            </label>

            <div className="form-actions">
              <Link className="btn btn-secondary" to="/login">Already have an account?</Link>
              <Button type="submit" loading={busy}>Create free profile <Icon name="arrow-right" className="icon-sm" /></Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
