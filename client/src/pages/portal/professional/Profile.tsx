import { useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, DefinitionList, Field, Icon, Input, Loading,
  PageHeader, Progress, Select, StatusBadge, Tabs, Textarea, Toggle
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { downloadFile } from '../../../lib/api';
import { dateLabel, inr, titleCase } from '../../../lib/format';
import { rupeesToPaise, useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';
import { api } from '../../../lib/api';

type TabKey = 'overview' | 'work' | 'experience' | 'documents' | 'verification';

const DAYS = [
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' }
];

const DOC_TYPES = [
  ['identity_proof', 'Government identity'],
  ['address_proof', 'Address proof'],
  ['education', 'Education certificate'],
  ['certification', 'Professional certification'],
  ['experience_letter', 'Experience letter'],
  ['resume', 'Résumé / CV'],
  ['other', 'Other supporting document']
];

export default function ProfessionalProfilePage() {
  useDocumentTitle('Profile & documents');
  const { data, loading, error, reload } = useApi<any>('/professional/profile');
  const { busy, run } = useAction();
  const [tab, setTab] = useState<TabKey>('overview');
  const [form, setForm] = useState<any>(null);
  const [days, setDays] = useState<string[]>([]);
  const [skillText, setSkillText] = useState('');
  const [certText, setCertText] = useState('');
  const [languageText, setLanguageText] = useState('');
  const [rate, setRate] = useState('');
  const [salary, setSalary] = useState('');
  const [employment, setEmployment] = useState({ employerName: '', title: '', startDate: '', endDate: '', isCurrent: false, description: '' });
  const [reference, setReference] = useState({ name: '', company: '', title: '', email: '', phone: '', relationship: '' });
  const [docType, setDocType] = useState('identity_proof');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!data?.profile) return;
    const profile = data.profile;
    setForm({
      headline: profile.headline || '',
      bio: profile.bio || '',
      category: profile.category || 'technology',
      city: profile.city || '',
      state: profile.state || '',
      yearsExperience: String(profile.yearsExperience ?? 3),
      education: profile.education || '',
      portfolioUrl: profile.portfolioUrl || '',
      linkedinUrl: profile.linkedinUrl || '',
      shiftHours: String(profile.shiftHours || 8),
      preferredStart: profile.preferredStart || '09:00',
      noticePeriodDays: String(profile.noticePeriodDays ?? 0)
    });
    setDays(profile.availability || []);
    setSkillText((profile.skills || []).join(', '));
    setCertText((profile.certifications || []).join(', '));
    setLanguageText((profile.languages || []).join(', '));
    setRate(profile.hourlyRatePaise ? String(profile.hourlyRatePaise / 100) : '');
    setSalary(profile.salaryExpectationPaise ? String(profile.salaryExpectationPaise / 100) : '');
  }, [data]);

  if (loading || !form) return <Loading label="Loading your profile." />;
  if (error) return <Alert tone="danger" title="Could not load your profile">{error}</Alert>;

  const profile = data.profile;
  const completeness = data.completeness;
  const recommendation = data.recommendation;
  const completeCount = completeness.checks.filter((check: any) => check.complete).length;

  const update = (key: string) => (event: any) =>
    setForm((current: any) => ({ ...current, [key]: event.target.value }));

  const saveProfile = () =>
    run('save', async () => {
      await api('/professional/profile', {
        method: 'PATCH',
        body: {
          headline: form.headline,
          bio: form.bio,
          category: form.category,
          city: form.city,
          state: form.state,
          yearsExperience: Number(form.yearsExperience),
          education: form.education,
          skills: skillText.split(',').map((item) => item.trim()).filter(Boolean),
          certifications: certText.split(',').map((item) => item.trim()).filter(Boolean),
          languages: languageText.split(',').map((item) => item.trim()).filter(Boolean),
          portfolioUrl: form.portfolioUrl || '',
          linkedinUrl: form.linkedinUrl || '',
          hourlyRatePaise: rate ? rupeesToPaise(rate) : undefined,
          salaryExpectationPaise: salary ? rupeesToPaise(salary) : 0,
          availabilityDays: days,
          shiftHours: Number(form.shiftHours),
          preferredStart: form.preferredStart,
          noticePeriodDays: Number(form.noticePeriodDays)
        }
      });
      reload();
    }, 'Profile saved.');

  const submitVerification = () =>
    run('submit', async () => {
      await api('/professional/profile/submit', { method: 'POST' });
      reload();
    }, 'Profile submitted for verification.');

  const togglePublic = (next: boolean) =>
    run('visibility', async () => {
      await api('/professional/profile/visibility', { method: 'POST', body: { isPublic: next } });
      reload();
    }, next ? 'Profile published to the marketplace.' : 'Public visibility turned off. Your career record remains intact.');

  const addEmployment = () =>
    run('employment', async () => {
      await api('/professional/employment', { method: 'POST', body: { ...employment, endDate: employment.isCurrent ? null : employment.endDate || null } });
      setEmployment({ employerName: '', title: '', startDate: '', endDate: '', isCurrent: false, description: '' });
      reload();
    }, 'Employment history added.');

  const addReference = () =>
    run('reference', async () => {
      await api('/professional/references', { method: 'POST', body: reference });
      setReference({ name: '', company: '', title: '', email: '', phone: '', relationship: '' });
      reload();
    }, 'Reference invited.');

  const upload = () =>
    run('upload', async () => {
      if (!file) throw new Error('Choose a file first.');
      const body = new FormData();
      body.append('file', file);
      body.append('docType', docType);
      await api('/professional/documents', { method: 'POST', formData: body });
      setFile(null);
      reload();
    }, 'Document encrypted and queued for verification.');

  const toggleDay = (day: string) => {
    setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : current.length >= 4 ? current : [...current, day]);
  };

  return (
    <>
      <PageHeader
        title="Profile & documents"
        eyebrow="Professional record"
        description="This is the evidence employers see. Completeness and verification are separate from public visibility, which you control."
        actions={
          <>
            <Button variant="secondary" onClick={saveProfile} loading={busy === 'save'}>Save changes</Button>
            <Button onClick={submitVerification} loading={busy === 'submit'} disabled={!completeness.complete}>Submit for verification</Button>
          </>
        }
      />

      <div className="grid grid-4">
        <Card className="card-pad-sm"><div className="stat-label">Profile status</div><div style={{ marginTop: 6 }}><StatusBadge status={profile.profileStatus} /></div></Card>
        <Card className="card-pad-sm"><div className="stat-label">Identity</div><div style={{ marginTop: 6 }}><StatusBadge status={profile.identityStatus} /></div></Card>
        <Card className="card-pad-sm"><div className="stat-label">Assessment</div><div style={{ marginTop: 6 }}><StatusBadge status={profile.assessmentStatus} /></div></Card>
        <Card className="card-pad-sm"><div className="stat-label">Public visibility</div><div style={{ marginTop: 6 }}><Badge tone={profile.isPublic ? 'success' : 'outline'}>{profile.isPublic ? 'Published' : 'Private'}</Badge></div></Card>
      </div>

      <div style={{ marginTop: 22 }}>
        <Tabs<TabKey>
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'work', label: 'Work pattern' },
            { key: 'experience', label: 'Experience & references' },
            { key: 'documents', label: 'Documents', count: data.documents.length },
            { key: 'verification', label: 'Verification & visibility' }
          ]}
        />
      </div>

      <div className="split" style={{ marginTop: 22 }}>
        <div className="stack-lg">
          {tab === 'overview' ? (
            <Card>
              <CardHeader title="Professional summary" subtitle="Written for employers. Avoid claims you cannot evidence." />
              <div className="form-grid">
                <Field label="Professional headline" htmlFor="p-headline" required>
                  <Input id="p-headline" value={form.headline} onChange={update('headline')} maxLength={160} />
                </Field>
                <Field label="Category" htmlFor="p-category">
                  <Input id="p-category" value={titleCase(form.category)} readOnly disabled />
                </Field>
                <Field label="Summary" htmlFor="p-bio" className="span-2" hint={`${form.bio.length}/3000 characters. At least 80 characters are required for completeness.`}>
                  <Textarea id="p-bio" value={form.bio} onChange={update('bio')} maxLength={3000} placeholder="What you do, the problems you solve, and the evidence behind your claims." />
                </Field>
                <Field label="Skills" htmlFor="p-skills" className="span-2" hint="Comma-separated. At least three.">
                  <Input id="p-skills" value={skillText} onChange={(event) => setSkillText(event.target.value)} />
                </Field>
                <Field label="Certifications" htmlFor="p-certs" className="span-2" hint="Comma-separated.">
                  <Input id="p-certs" value={certText} onChange={(event) => setCertText(event.target.value)} />
                </Field>
                <Field label="Languages" htmlFor="p-languages">
                  <Input id="p-languages" value={languageText} onChange={(event) => setLanguageText(event.target.value)} />
                </Field>
                <Field label="Education" htmlFor="p-education">
                  <Input id="p-education" value={form.education} onChange={update('education')} />
                </Field>
                <Field label="City" htmlFor="p-city">
                  <Input id="p-city" value={form.city} onChange={update('city')} />
                </Field>
                <Field label="State" htmlFor="p-state">
                  <Input id="p-state" value={form.state} onChange={update('state')} />
                </Field>
                <Field label="Portfolio URL" htmlFor="p-portfolio">
                  <Input id="p-portfolio" type="url" value={form.portfolioUrl} onChange={update('portfolioUrl')} placeholder="https://" />
                </Field>
                <Field label="LinkedIn URL" htmlFor="p-linkedin">
                  <Input id="p-linkedin" type="url" value={form.linkedinUrl} onChange={update('linkedinUrl')} placeholder="https://" />
                </Field>
                <Field label="Years of experience" htmlFor="p-years" hint="Minimum three years. Changes may require re-verification.">
                  <Input id="p-years" type="number" min={0} max={60} step={0.5} value={form.yearsExperience} onChange={update('yearsExperience')} />
                </Field>
                <Field label="Notice period (days)" htmlFor="p-notice">
                  <Input id="p-notice" type="number" min={0} max={90} value={form.noticePeriodDays} onChange={update('noticePeriodDays')} />
                </Field>
                <Field label="Hourly rate (₹)" htmlFor="p-rate" hint={recommendation?.available ? `Sourced range: ${inr(recommendation.benchmark.minHourlyPaise)}–${inr(recommendation.benchmark.maxHourlyPaise)}. Recommended ${inr(recommendation.recommendedHourlyPaise)}.` : 'No sourced benchmark available yet.'}>
                  <Input id="p-rate" type="number" min={100} step={50} value={rate} onChange={(event) => setRate(event.target.value)} placeholder="e.g. 1800" />
                </Field>
                <Field label="Annual salary expectation (₹)" htmlFor="p-salary">
                  <Input id="p-salary" type="number" min={0} step={10000} value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="Optional" />
                </Field>
              </div>
              <div className="form-actions">
                <Button variant="secondary" onClick={saveProfile} loading={busy === 'save'}>Save profile</Button>
              </div>
            </Card>
          ) : null}

          {tab === 'work' ? (
            <Card>
              <CardHeader title="Working pattern" subtitle="Choose an 8, 10 or 12-hour shift and up to four days between Tuesday and Saturday. Sunday and Monday are compulsory off days." />
              <div className="field">
                <span className="label">Working days</span>
                <div className="row wrap">
                  {DAYS.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      className={`btn btn-sm ${days.includes(day.key) ? 'btn-dark' : 'btn-secondary'}`}
                      onClick={() => toggleDay(day.key)}
                      aria-pressed={days.includes(day.key)}
                    >
                      {days.includes(day.key) ? <Icon name="check" className="icon-sm" /> : null}{day.label}
                    </button>
                  ))}
                  <span className="tiny muted">Sunday & Monday are blocked by policy.</span>
                </div>
              </div>
              <div className="form-grid" style={{ marginTop: 18 }}>
                <Field label="Shift length" htmlFor="p-shift">
                  <Select id="p-shift" value={form.shiftHours} onChange={update('shiftHours')}>
                    <option value="8">8 hours</option>
                    <option value="10">10 hours</option>
                    <option value="12">12 hours</option>
                  </Select>
                </Field>
                <Field label="Preferred start" htmlFor="p-start">
                  <Input id="p-start" type="time" value={form.preferredStart} onChange={update('preferredStart')} />
                </Field>
              </div>
              <div className="alert alert-info" style={{ marginTop: 18 }}>
                <Icon name="info" />
                <div>
                  Shift hours are paid/productive hours. A mandatory 60-minute break (15 + 15 + 30) sits inside the
                  attendance window. Combined assignments cannot exceed 12 hours/day or 48 hours/week, and overlapping
                  bookings are blocked automatically.
                </div>
              </div>
              <div className="form-actions">
                <Button variant="secondary" onClick={saveProfile} loading={busy === 'save'}>Save working pattern</Button>
              </div>
            </Card>
          ) : null}

          {tab === 'experience' ? (
            <>
              <Card>
                <CardHeader title="Employment history" subtitle="Add roles that support your three-year minimum and category expertise." />
                {(data.employment || []).length ? (
                  <div className="timeline">
                    {data.employment.map((job: any) => (
                      <div className="tl-item" key={job.id}>
                        <span className="tl-dot" />
                        <div className="grow">
                          <div className="between">
                            <div>
                              <div className="tl-title">{job.title}</div>
                              <div className="tl-sub">{job.employer_name} · {dateLabel(job.start_date)} – {job.is_current ? 'Present' : dateLabel(job.end_date)}</div>
                            </div>
                            <Badge tone={job.verified ? 'success' : 'outline'}>{job.verified ? 'Verified' : 'Unverified'}</Badge>
                          </div>
                          {job.description ? <p className="tiny muted" style={{ marginTop: 4 }}>{job.description}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted small">No employment history added yet.</p>}
                <div className="form-grid" style={{ marginTop: 20 }}>
                  <Field label="Employer" htmlFor="eh-employer" required>
                    <Input id="eh-employer" value={employment.employerName} onChange={(event) => setEmployment((c) => ({ ...c, employerName: event.target.value }))} placeholder="Company name" />
                  </Field>
                  <Field label="Job title" htmlFor="eh-title" required>
                    <Input id="eh-title" value={employment.title} onChange={(event) => setEmployment((c) => ({ ...c, title: event.target.value }))} placeholder="e.g. Senior Engineer" />
                  </Field>
                  <Field label="Start date" htmlFor="eh-start" required>
                    <Input id="eh-start" type="date" value={employment.startDate} onChange={(event) => setEmployment((c) => ({ ...c, startDate: event.target.value }))} />
                  </Field>
                  <Field label="End date" htmlFor="eh-end">
                    <Input id="eh-end" type="date" value={employment.endDate} onChange={(event) => setEmployment((c) => ({ ...c, endDate: event.target.value }))} disabled={employment.isCurrent} />
                  </Field>
                  <label className="checkbox span-2">
                    <input type="checkbox" checked={employment.isCurrent} onChange={(event) => setEmployment((c) => ({ ...c, isCurrent: event.target.checked }))} />
                    <span>This is my current role</span>
                  </label>
                  <Field label="Summary" htmlFor="eh-desc" className="span-2">
                    <Textarea id="eh-desc" value={employment.description} onChange={(event) => setEmployment((c) => ({ ...c, description: event.target.value }))} style={{ minHeight: 80 }} />
                  </Field>
                </div>
                <div className="form-actions">
                  <Button variant="secondary" onClick={addEmployment} loading={busy === 'employment'}>Add employment</Button>
                </div>
              </Card>

              <Card>
                <CardHeader title="Professional references" subtitle="At least one reference is required for profile completeness." />
                {(data.references || []).length ? (
                  <div className="list">
                    {data.references.map((ref: any) => (
                      <div className="list-row" key={ref.id}>
                        <span className="icon-tile navy sm"><Icon name="user" /></span>
                        <div className="list-main">
                          <div className="list-title">{ref.name}</div>
                          <div className="list-sub">{ref.title || 'Reference'}{ref.company ? ` · ${ref.company}` : ''} · {ref.email}</div>
                        </div>
                        <StatusBadge status={ref.status} />
                      </div>
                    ))}
                  </div>
                ) : <p className="muted small">No references invited yet.</p>}
                <div className="form-grid" style={{ marginTop: 20 }}>
                  <Field label="Reference name" htmlFor="ref-name" required>
                    <Input id="ref-name" value={reference.name} onChange={(event) => setReference((c) => ({ ...c, name: event.target.value }))} />
                  </Field>
                  <Field label="Email" htmlFor="ref-email" required>
                    <Input id="ref-email" type="email" value={reference.email} onChange={(event) => setReference((c) => ({ ...c, email: event.target.value }))} />
                  </Field>
                  <Field label="Company" htmlFor="ref-company">
                    <Input id="ref-company" value={reference.company} onChange={(event) => setReference((c) => ({ ...c, company: event.target.value }))} />
                  </Field>
                  <Field label="Job title" htmlFor="ref-title">
                    <Input id="ref-title" value={reference.title} onChange={(event) => setReference((c) => ({ ...c, title: event.target.value }))} />
                  </Field>
                  <Field label="Relationship" htmlFor="ref-rel">
                    <Input id="ref-rel" value={reference.relationship} onChange={(event) => setReference((c) => ({ ...c, relationship: event.target.value }))} placeholder="e.g. Former manager" />
                  </Field>
                  <Field label="Phone" htmlFor="ref-phone">
                    <Input id="ref-phone" value={reference.phone} onChange={(event) => setReference((c) => ({ ...c, phone: event.target.value }))} />
                  </Field>
                </div>
                <div className="form-actions">
                  <Button variant="secondary" onClick={addReference} loading={busy === 'reference'}>Invite reference</Button>
                </div>
              </Card>
            </>
          ) : null}

          {tab === 'documents' ? (
            <Card>
              <CardHeader title="Encrypted documents" subtitle="Files are encrypted at rest. Verification officers can access them only through an audited route." />
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Document</th><th>Type</th><th>Uploaded</th><th>Status</th><th className="actions">Action</th></tr></thead>
                  <tbody>
                    {data.documents.length ? data.documents.map((doc: any) => (
                      <tr key={doc.id}>
                        <td><div className="list-title">{doc.filename}</div><div className="tiny muted">{Math.round(doc.size_bytes / 1024)} KB</div></td>
                        <td>{titleCase(doc.doc_type)}</td>
                        <td>{dateLabel(doc.created_at)}</td>
                        <td><StatusBadge status={doc.status} /></td>
                        <td className="actions">
                          <Button variant="secondary" size="sm" onClick={() => downloadFile(`/professional/documents/${doc.id}/download`, doc.filename)}>
                            <Icon name="download" className="icon-sm" /> Download
                          </Button>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={5} className="table-empty">No documents uploaded.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="form-section" style={{ marginTop: 18 }}>
                <div className="form-section-head">
                  <h3 className="form-section-title">Upload a document</h3>
                  <p className="form-section-sub">PDF, PNG, JPG or DOCX up to 8 MB. Never upload passwords or payment credentials.</p>
                </div>
                <div className="form-grid">
                  <Field label="Document type" htmlFor="doc-type">
                    <Select id="doc-type" value={docType} onChange={(event) => setDocType(event.target.value)}>
                      {DOC_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                  </Field>
                  <Field label="File" htmlFor="doc-file">
                    <Input id="doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  </Field>
                </div>
                <div className="form-actions">
                  <Button variant="secondary" onClick={upload} loading={busy === 'upload'} disabled={!file}>Encrypt & upload</Button>
                </div>
              </div>
            </Card>
          ) : null}

          {tab === 'verification' ? (
            <>
              <Card>
                <CardHeader title="Verification" subtitle="Verification and assessment are gates to public visibility, not to using your private career record." />
                <div className="kv">
                  <div className="kv-row"><span className="kv-key">Profile status</span><span className="kv-val"><StatusBadge status={profile.profileStatus} /></span></div>
                  <div className="kv-row"><span className="kv-key">Identity verification</span><span className="kv-val"><StatusBadge status={profile.identityStatus} /></span></div>
                  <div className="kv-row"><span className="kv-key">Experience verification</span><span className="kv-val"><StatusBadge status={profile.verificationStatus} /></span></div>
                  <div className="kv-row"><span className="kv-key">Assessment</span><span className="kv-val"><StatusBadge status={profile.assessmentStatus} /></span></div>
                </div>
                <div className="alert alert-info" style={{ marginTop: 16 }}>
                  <Icon name="shield-check" />
                  <div>Submission requires all completeness checks. A verification officer reviews the evidence and records a written decision. You will be notified in the portal.</div>
                </div>
                <div className="row wrap" style={{ marginTop: 16 }}>
                  <Button onClick={submitVerification} loading={busy === 'submit'} disabled={!completeness.complete || ['in_review', 'verified'].includes(profile.verificationStatus)}>
                    Submit for verification
                  </Button>
                  <Button variant="secondary" onClick={reload}>Refresh status</Button>
                </div>
              </Card>

              <Card>
                <CardHeader title="Public visibility" subtitle="Publishing requires verified identity and experience plus a passed assessment and an approved profile." />
                <Toggle
                  checked={Boolean(profile.isPublic)}
                  onChange={togglePublic}
                  label="Publish my profile to the employer marketplace"
                  description="You can turn this off at any time. Your assignments, contracts and verified history remain intact."
                  disabled={busy === 'visibility'}
                />
                <div className="grid grid-2" style={{ marginTop: 16 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <Icon name={profile.verificationStatus === 'verified' ? 'check-circle' : 'alert-circle'} className={profile.verificationStatus === 'verified' ? 'text-success icon-sm' : 'text-warning icon-sm'} />
                    <span className="tiny">Identity and experience verified</span>
                  </div>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <Icon name={profile.assessmentStatus === 'passed' ? 'check-circle' : 'alert-circle'} className={profile.assessmentStatus === 'passed' ? 'text-success icon-sm' : 'text-warning icon-sm'} />
                    <span className="tiny">Assessment passed</span>
                  </div>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <Icon name={profile.profileStatus === 'approved' ? 'check-circle' : 'alert-circle'} className={profile.profileStatus === 'approved' ? 'text-success icon-sm' : 'text-warning icon-sm'} />
                    <span className="tiny">Profile approved</span>
                  </div>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <Icon name="lock" className="icon-sm text-muted" />
                    <span className="tiny">Contact details stay private until shortlisting</span>
                  </div>
                </div>
              </Card>
            </>
          ) : null}
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="Profile completeness" subtitle={`${completeCount} of ${completeness.checks.length} requirements`} />
            <Progress value={completeCount} max={completeness.checks.length} />
            <div className="stack-sm" style={{ marginTop: 12 }}>
              {completeness.checks.map((check: any) => (
                <div className="row" key={check.key} style={{ alignItems: 'flex-start' }}>
                  <Icon name={check.complete ? 'check-circle' : 'x-circle'} className={check.complete ? 'text-success icon-sm' : 'text-warning icon-sm'} />
                  <span className="tiny" style={{ color: check.complete ? 'var(--muted)' : 'var(--ink)' }}>{check.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {recommendation?.available ? (
            <Card className="card-pad">
              <CardHeader title="Rate recommendation" subtitle="Calculated from a sourced benchmark." />
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 750 }}>{inr(recommendation.recommendedHourlyPaise)}</span>
                <span className="tiny muted">/ hour</span>
              </div>
              <div className="kv" style={{ marginTop: 10 }}>
                <div className="kv-row"><span className="kv-key">Sourced range</span><span className="kv-val">{inr(recommendation.benchmark.minHourlyPaise)}–{inr(recommendation.benchmark.maxHourlyPaise)}</span></div>
                <div className="kv-row"><span className="kv-key">Source</span><span className="kv-val">{recommendation.benchmark.sourceName || recommendation.benchmark.source?.name || 'Sourced benchmark'}</span></div>
              </div>
              <div className="stack-sm" style={{ marginTop: 10 }}>
                {(recommendation.steps || []).map((step: any) => (
                  <div className="between" key={step.label}>
                    <span className="tiny muted">{step.label}</span>
                    <span className="tiny">×{step.factor}</span>
                  </div>
                ))}
              </div>
              <p className="tiny muted" style={{ marginTop: 10 }}>A recommendation, not a mandate. The final rate is agreed on the assignment contract.</p>
            </Card>
          ) : (
            <Alert tone="info" title="No benchmark for this category">{recommendation?.reason || 'A sourced benchmark is required before a recommendation can be shown.'}</Alert>
          )}

          <Card className="card-pad">
            <CardHeader title="Record summary" />
            <DefinitionList
              items={[
                { label: 'Experience', value: `${profile.yearsExperience} years` },
                { label: 'Rating', value: profile.rating ? `${profile.rating.toFixed(1)} / 5` : 'New' },
                { label: 'Completed', value: `${profile.completedAssignments} assignments` },
                { label: 'Rehire rate', value: `${profile.rehireRate}%` },
                { label: 'Category', value: titleCase(profile.category) }
              ]}
            />
          </Card>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Privacy & data" sub="Your record is preserved if your membership becomes inactive. Only relevant, authorised information is shared with prospective employers." />
        <Alert tone="neutral">
          Contact details are released only to a verified employer after shortlisting. Every access is written to the
          audit log. You can request a data export or correction through support.
        </Alert>
      </div>
    </>
  );
}
