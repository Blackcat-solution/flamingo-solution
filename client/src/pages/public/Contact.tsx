import { useState, type FormEvent } from 'react';
import { PublicPageHero } from '../../components/PublicPageHero';
import { Alert, Button, Card, Field, Icon, Input, Select, Textarea } from '../../components/ui';
import { api } from '../../lib/api';
import { errorMessage, useDocumentTitle } from '../../lib/hooks';

const SUBJECTS = [
  'Professional registration',
  'Employer verification',
  'Pricing and activation fee',
  'Payments or payouts',
  'Assessment or review',
  'Trust, safety or privacy',
  'Partnerships',
  'Something else'
];

export default function Contact() {
  useDocumentTitle('Contact');
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference: string; message: string } | null>(null);

  const update = (key: keyof typeof form) => (event: any) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = await api<{ reference: string; message: string }>('/public/contact', {
        method: 'POST',
        body: form
      });
      setResult(payload);
      setForm({ name: '', email: '', subject: SUBJECTS[0], message: '' });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PublicPageHero
        eyebrow="Contact"
        title="Talk to the team behind the marketplace."
        lead="Questions about verification, fees, assessments or a specific engagement. A real person reads every message."
      />

      <section className="section-tight">
        <div className="container">
          <div className="split">
            <Card className="card-pad-lg">
              <div className="eyebrow eyebrow-plain">Send a message</div>
              <h2 className="card-title" style={{ fontSize: '1.4rem', marginTop: 8 }}>How can we help?</h2>
              {result ? (
                <Alert tone="success" title={`Message received — reference ${result.reference}`}>
                  {result.message} Keep the reference for follow-up. In this demonstration, messages are stored in the
                  local database and are not sent by email.
                </Alert>
              ) : null}
              {error ? <Alert tone="danger" title="Message not sent">{error}</Alert> : null}
              <form className="auth-form" onSubmit={submit}>
                <div className="field-row">
                  <Field label="Your name" htmlFor="contact-name" required>
                    <Input id="contact-name" value={form.name} onChange={update('name')} required minLength={2} placeholder="Full name" />
                  </Field>
                  <Field label="Email address" htmlFor="contact-email" required>
                    <Input id="contact-email" type="email" value={form.email} onChange={update('email')} required placeholder="you@company.com" />
                  </Field>
                </div>
                <Field label="Subject" htmlFor="contact-subject" required>
                  <Select id="contact-subject" value={form.subject} onChange={update('subject')}>
                    {SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}
                  </Select>
                </Field>
                <Field label="Message" htmlFor="contact-message" required hint="At least 10 characters. Do not include identity document numbers or payment credentials.">
                  <Textarea id="contact-message" value={form.message} onChange={update('message')} required minLength={10} placeholder="Tell us what you need." />
                </Field>
                <div className="form-actions">
                  <Button type="submit" loading={busy}>Send message <Icon name="send" className="icon-sm" /></Button>
                </div>
              </form>
            </Card>

            <div className="stack">
              <Card className="card-pad">
                <span className="icon-tile"><Icon name="mail" /></span>
                <h3 className="card-title" style={{ marginTop: 12 }}>General enquiries</h3>
                <p className="page-sub">support@flamingo.work</p>
                <p className="tiny muted">Response target: one business day. Demo environment — no live email is sent.</p>
              </Card>
              <Card className="card-pad">
                <span className="icon-tile navy"><Icon name="building" /></span>
                <h3 className="card-title" style={{ marginTop: 12 }}>Flamingo Solution Pvt. Ltd.</h3>
                <p className="page-sub">India · operating as FLAMINGO</p>
                <p className="tiny muted">Registered address and statutory details would be published here in production. This is a product demonstration.</p>
              </Card>
              <Card className="card-pad">
                <span className="icon-tile gold"><Icon name="shield" /></span>
                <h3 className="card-title" style={{ marginTop: 12 }}>Security or privacy concern</h3>
                <p className="page-sub">Include the affected account email and a description. Do not send passwords, OTPs or document images.</p>
              </Card>
              <Alert tone="info" title="Demo environment">
                Payments, identity verification and payouts are simulated. No live money moves and no real identity
                document is processed.
              </Alert>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
