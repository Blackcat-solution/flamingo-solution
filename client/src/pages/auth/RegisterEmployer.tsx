import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { Alert, Button, Field, Icon, Input, Select, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { errorMessage, useDocumentTitle } from '../../lib/hooks';

const SIZES = ['1–10', '11–50', '51–200', '201–500', '501–1,000', '1,000+'];

export default function RegisterEmployer() {
  useDocumentTitle('Create an employer account');
  const { refresh } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    orgName: '',
    legalName: '',
    registrationNumber: '',
    gstin: '',
    industry: '',
    companySize: '11–50',
    website: '',
    registeredAddress: '',
    city: '',
    state: '',
    repName: '',
    repDesignation: '',
    billingEmail: '',
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
      await api('/auth/register/employer', {
        method: 'POST',
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          orgName: form.orgName,
          legalName: form.legalName,
          registrationNumber: form.registrationNumber,
          gstin: form.gstin,
          industry: form.industry,
          companySize: form.companySize,
          website: form.website,
          registeredAddress: form.registeredAddress,
          city: form.city,
          state: form.state,
          repName: form.repName,
          repDesignation: form.repDesignation,
          billingEmail: form.billingEmail,
          consent: form.consent
        }
      });
      await refresh();
      notify('Employer account created. Upload your organisation documents to start verification.', 'success');
      navigate('/portal/employer', { replace: true });
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
          <h2>Hire verified capability with a shorter process.</h2>
          <p>
            Search assessed professionals, run a maximum of two structured interview rounds, and hire with contracts
            and transparent money mechanics built in.
          </p>
          <div className="auth-points">
            <div><Icon name="shield-check" /> Employer verification before shortlisting and hiring.</div>
            <div><Icon name="users" /> Confidential contact only after shortlisting.</div>
            <div><Icon name="calendar" /> Schedule rules enforced on every booking.</div>
            <div><Icon name="rupee" /> Itemised invoices, 50% advance and 50% on completion.</div>
          </div>
        </div>
        <div className="tiny" style={{ color: '#8fa3bc' }}>
          Demonstration environment. Verification and payments are simulated.
        </div>
      </aside>

      <main className="auth-main" style={{ flexDirection: 'column', alignItems: 'center' }}>
        <div className="auth-card wide">
          <span className="eyebrow">Employer registration</span>
          <h1 className="auth-title">Create your employer account</h1>
          <p className="auth-sub">You can browse the marketplace immediately. Shortlisting, interviewing and hiring unlock after organisation verification.</p>

          {error ? <Alert tone="danger" title="Registration not completed">{error}</Alert> : null}

          <form className="auth-form" onSubmit={submit}>
            <div className="form-section">
              <div className="form-section-head">
                <h2 className="form-section-title">Account holder</h2>
                <p className="form-section-sub">The person managing this employer account.</p>
              </div>
              <div className="form-grid">
                <Field label="Full name" htmlFor="emp-name" required>
                  <Input id="emp-name" value={form.name} onChange={update('name')} required minLength={2} placeholder="Your name" />
                </Field>
                <Field label="Work email" htmlFor="emp-email" required>
                  <Input id="emp-email" type="email" autoComplete="email" value={form.email} onChange={update('email')} required placeholder="you@company.com" />
                </Field>
                <Field label="Password" htmlFor="emp-password" required hint="At least 10 characters, with upper-case, lower-case and a number.">
                  <Input id="emp-password" type="password" autoComplete="new-password" value={form.password} onChange={update('password')} required minLength={10} placeholder="Create a strong password" />
                </Field>
                <Field label="Phone number" htmlFor="emp-phone" required>
                  <Input id="emp-phone" type="tel" value={form.phone} onChange={update('phone')} required minLength={6} placeholder="+91 98…" />
                </Field>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-head">
                <h2 className="form-section-title">Organisation</h2>
                <p className="form-section-sub">Use the legal details that appear on your incorporation and GST records.</p>
              </div>
              <div className="form-grid">
                <Field label="Trading name" htmlFor="emp-org" required>
                  <Input id="emp-org" value={form.orgName} onChange={update('orgName')} required placeholder="e.g. Meridian Technologies" />
                </Field>
                <Field label="Legal name" htmlFor="emp-legal">
                  <Input id="emp-legal" value={form.legalName} onChange={update('legalName')} placeholder="Registered legal entity" />
                </Field>
                <Field label="Registration number" htmlFor="emp-reg">
                  <Input id="emp-reg" value={form.registrationNumber} onChange={update('registrationNumber')} placeholder="CIN / LLPIN / registration" />
                </Field>
                <Field label="GSTIN" htmlFor="emp-gstin" hint="15-character GSTIN. Optional for demonstration.">
                  <Input id="emp-gstin" value={form.gstin} onChange={update('gstin')} placeholder="29ABCDE1234F1Z5" />
                </Field>
                <Field label="Industry" htmlFor="emp-industry" required>
                  <Input id="emp-industry" value={form.industry} onChange={update('industry')} required minLength={2} placeholder="e.g. Information technology" />
                </Field>
                <Field label="Company size" htmlFor="emp-size">
                  <Select id="emp-size" value={form.companySize} onChange={update('companySize')}>
                    {SIZES.map((size) => <option key={size}>{size}</option>)}
                  </Select>
                </Field>
                <Field label="Website" htmlFor="emp-website" className="span-2">
                  <Input id="emp-website" type="url" value={form.website} onChange={update('website')} placeholder="https://company.com" />
                </Field>
                <Field label="Registered address" htmlFor="emp-address" required className="span-2">
                  <Textarea id="emp-address" value={form.registeredAddress} onChange={update('registeredAddress')} required placeholder="Street, area, landmark" style={{ minHeight: 80 }} />
                </Field>
                <Field label="City" htmlFor="emp-city" required>
                  <Input id="emp-city" value={form.city} onChange={update('city')} required placeholder="Bengaluru" />
                </Field>
                <Field label="State" htmlFor="emp-state" required>
                  <Input id="emp-state" value={form.state} onChange={update('state')} required placeholder="Karnataka" />
                </Field>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-head">
                <h2 className="form-section-title">Billing & representative</h2>
                <p className="form-section-sub">Invoices and verification notices are sent to these contacts.</p>
              </div>
              <div className="form-grid">
                <Field label="Representative name" htmlFor="emp-rep" required>
                  <Input id="emp-rep" value={form.repName} onChange={update('repName')} required placeholder="Authorised representative" />
                </Field>
                <Field label="Designation" htmlFor="emp-rep-role">
                  <Input id="emp-rep-role" value={form.repDesignation} onChange={update('repDesignation')} placeholder="e.g. Head of Talent" />
                </Field>
                <Field label="Billing email" htmlFor="emp-billing" required className="span-2">
                  <Input id="emp-billing" type="email" value={form.billingEmail} onChange={update('billingEmail')} required placeholder="billing@company.com" />
                </Field>
              </div>
            </div>

            <label className="checkbox">
              <input type="checkbox" checked={form.consent} onChange={update('consent')} required />
              <span>
                I confirm I am authorised to register this organisation, the details are accurate, and I consent to
                organisation verification. I have read the <Link to="/trust-safety">trust & safety</Link> and{' '}
                <Link to="/pricing">pricing</Link> pages.
              </span>
            </label>

            <div className="form-actions">
              <Link className="btn btn-secondary" to="/login">Already have an account?</Link>
              <Button type="submit" loading={busy}>Create employer account <Icon name="arrow-right" className="icon-sm" /></Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
