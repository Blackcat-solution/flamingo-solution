import { useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, DefinitionList, Field, Icon, Input, Loading,
  PageHeader, Select, StatusBadge, Tabs, Textarea
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { api, downloadFile } from '../../../lib/api';
import { dateLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type TabKey = 'company' | 'documents' | 'verification';

const DOC_TYPES = [
  ['incorporation', 'Certificate of incorporation'],
  ['gst_certificate', 'GST certificate'],
  ['address_proof', 'Registered address proof'],
  ['authorisation_letter', 'Authorisation letter'],
  ['other', 'Other supporting document']
];

export default function EmployerProfile() {
  useDocumentTitle('Company & documents');
  const { data, loading, error, reload } = useApi<any>('/employer/profile');
  const { busy, run } = useAction();
  const [tab, setTab] = useState<TabKey>('company');
  const [form, setForm] = useState<any>(null);
  const [docType, setDocType] = useState('incorporation');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!data?.employer) return;
    const employer = data.employer;
    setForm({
      industry: employer.industry || '',
      companySize: employer.companySize || '',
      website: employer.website || '',
      registeredAddress: employer.registeredAddress || '',
      city: employer.city || '',
      state: employer.state || '',
      repName: employer.repName || '',
      repDesignation: employer.repDesignation || '',
      billingEmail: employer.billingEmail || '',
      billingAddress: employer.billingAddress || '',
      organisationHistory: employer.organisationHistory || ''
    });
  }, [data]);

  if (loading || !form) return <Loading label="Loading your company profile." />;
  if (error) return <Alert tone="danger" title="Could not load your company profile">{error}</Alert>;

  const employer = data.employer;
  const documents = data.documents || [];

  const update = (key: string) => (event: any) => setForm((current: any) => ({ ...current, [key]: event.target.value }));

  const save = () =>
    run('save', async () => {
      await api('/employer/profile', {
        method: 'PATCH',
        body: { ...form, website: form.website || '' }
      });
      reload();
    }, 'Company profile saved.');

  const upload = () =>
    run('upload', async () => {
      if (!file) throw new Error('Choose a file first.');
      const body = new FormData();
      body.append('file', file);
      body.append('docType', docType);
      await api('/employer/documents', { method: 'POST', formData: body });
      setFile(null);
      reload();
    }, 'Document encrypted and queued for verification.');

  return (
    <>
      <PageHeader
        title="Company & documents"
        eyebrow="Organisation record"
        description="Verification unlocks shortlisting, interviewing and hiring. Every uploaded document is encrypted at rest and reviewed by a verification officer."
        actions={<Button variant="secondary" onClick={save} loading={busy === 'save'}>Save changes</Button>}
      />

      <div className="grid grid-4">
        <Card className="card-pad-sm"><div className="stat-label">Organisation</div><div className="strong" style={{ marginTop: 6 }}>{employer.orgName}</div></Card>
        <Card className="card-pad-sm"><div className="stat-label">Verification</div><div style={{ marginTop: 6 }}><StatusBadge status={employer.verificationStatus} /></div></Card>
        <Card className="card-pad-sm"><div className="stat-label">Documents</div><div className="strong" style={{ marginTop: 6 }}>{documents.length} uploaded</div></Card>
        <Card className="card-pad-sm"><div className="stat-label">Billing email</div><div className="tiny" style={{ marginTop: 6 }}>{employer.billingEmail}</div></Card>
      </div>

      {employer.verificationStatus !== 'verified' ? (
        <Alert tone="warning" title="Verification in progress">
          Upload incorporation and GST evidence if you have not already. Shortlisting, interviewing and hiring stay locked
          until a verification officer approves the organisation.
        </Alert>
      ) : (
        <Alert tone="success" title="Verified organisation">
          Candidate contact details are released only to your verified team after shortlisting, and every access is
          audited.
        </Alert>
      )}

      <div style={{ marginTop: 20 }}>
        <Tabs<TabKey>
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'company', label: 'Company details' },
            { key: 'documents', label: 'Documents', count: documents.length },
            { key: 'verification', label: 'Verification' }
          ]}
        />
      </div>

      <div className="split" style={{ marginTop: 20 }}>
        <div className="stack-lg">
          {tab === 'company' ? (
            <Card>
              <CardHeader title="Registered organisation" subtitle="Legal and billing details used on invoices." />
              <div className="form-grid">
                <Field label="Trading name" htmlFor="ep-org">
                  <Input id="ep-org" value={employer.orgName} readOnly disabled />
                </Field>
                <Field label="Legal name" htmlFor="ep-legal">
                  <Input id="ep-legal" value={employer.legalName || ''} readOnly disabled />
                </Field>
                <Field label="GSTIN" htmlFor="ep-gstin">
                  <Input id="ep-gstin" value={employer.gstin || 'Not recorded'} readOnly disabled className="mono" />
                </Field>
                <Field label="Registration number" htmlFor="ep-reg">
                  <Input id="ep-reg" value={employer.registrationNumber || 'Not recorded'} readOnly disabled className="mono" />
                </Field>
                <Field label="Industry" htmlFor="ep-industry" required>
                  <Input id="ep-industry" value={form.industry} onChange={update('industry')} />
                </Field>
                <Field label="Company size" htmlFor="ep-size">
                  <Select id="ep-size" value={form.companySize} onChange={update('companySize')}>
                    <option value="">Not specified</option>
                    <option value="1-10">1–10</option>
                    <option value="11-50">11–50</option>
                    <option value="51-200">51–200</option>
                    <option value="201-500">201–500</option>
                    <option value="500+">500+</option>
                  </Select>
                </Field>
                <Field label="Website" htmlFor="ep-website">
                  <Input id="ep-website" type="url" value={form.website} onChange={update('website')} placeholder="https://" />
                </Field>
                <Field label="Representative name" htmlFor="ep-rep" required>
                  <Input id="ep-rep" value={form.repName} onChange={update('repName')} />
                </Field>
                <Field label="Representative designation" htmlFor="ep-designation">
                  <Input id="ep-designation" value={form.repDesignation} onChange={update('repDesignation')} />
                </Field>
                <Field label="Billing email" htmlFor="ep-billing" required>
                  <Input id="ep-billing" type="email" value={form.billingEmail} onChange={update('billingEmail')} />
                </Field>
                <Field label="City" htmlFor="ep-city" required>
                  <Input id="ep-city" value={form.city} onChange={update('city')} />
                </Field>
                <Field label="State" htmlFor="ep-state" required>
                  <Input id="ep-state" value={form.state} onChange={update('state')} />
                </Field>
                <Field label="Registered address" htmlFor="ep-address" required className="span-2">
                  <Textarea id="ep-address" value={form.registeredAddress} onChange={update('registeredAddress')} style={{ minHeight: 70 }} />
                </Field>
                <Field label="Billing address" htmlFor="ep-billing-address" className="span-2" hint="Leave blank to use the registered address.">
                  <Textarea id="ep-billing-address" value={form.billingAddress} onChange={update('billingAddress')} style={{ minHeight: 70 }} />
                </Field>
                <Field label="About the organisation" htmlFor="ep-history" className="span-2" hint="Optional. Helps candidates understand the context of the work.">
                  <Textarea id="ep-history" value={form.organisationHistory} maxLength={2000} onChange={update('organisationHistory')} style={{ minHeight: 100 }} />
                </Field>
              </div>
              <div className="form-actions">
                <Button onClick={save} loading={busy === 'save'}>Save company details</Button>
              </div>
            </Card>
          ) : null}

          {tab === 'documents' ? (
            <Card>
              <CardHeader title="Encrypted documents" subtitle="PDF, PNG, JPG or DOCX up to 8 MB. Verification officers access files only through audited routes." />
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Document</th><th>Type</th><th>Uploaded</th><th>Status</th><th className="actions">Action</th></tr></thead>
                  <tbody>
                    {documents.length ? documents.map((doc: any) => (
                      <tr key={doc.id}>
                        <td>
                          <div className="list-title">{doc.filename}</div>
                          <div className="tiny muted">{Math.round(doc.size_bytes / 1024)} KB</div>
                        </td>
                        <td>{titleCase(doc.doc_type)}</td>
                        <td>{dateLabel(doc.created_at)}</td>
                        <td><StatusBadge status={doc.status} /></td>
                        <td className="actions">
                          <Button variant="secondary" size="sm" onClick={() => downloadFile(`/employer/documents/${doc.id}/download`, doc.filename)}>
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
                  <p className="form-section-sub">Do not upload passwords, bank credentials or personal identity documents.</p>
                </div>
                <div className="form-grid">
                  <Field label="Document type" htmlFor="ep-doc-type">
                    <Select id="ep-doc-type" value={docType} onChange={(event) => setDocType(event.target.value)}>
                      {DOC_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                  </Field>
                  <Field label="File" htmlFor="ep-doc-file">
                    <Input id="ep-doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  </Field>
                </div>
                <div className="form-actions">
                  <Button variant="secondary" onClick={upload} loading={busy === 'upload'} disabled={!file}>Encrypt & upload</Button>
                </div>
              </div>
            </Card>
          ) : null}

          {tab === 'verification' ? (
            <Card>
              <CardHeader title="Verification record" subtitle="A verification officer reviews evidence and records a written decision." />
              <DefinitionList
                items={[
                  { label: 'Status', value: <StatusBadge status={employer.verificationStatus} /> },
                  { label: 'Verified at', value: employer.verifiedAt ? dateLabel(employer.verifiedAt) : 'Not yet verified' },
                  { label: 'Documents submitted', value: documents.length },
                  { label: 'Documents approved', value: documents.filter((doc: any) => doc.status === 'approved').length },
                  { label: 'Reviewer notes', value: employer.verificationNotes || 'No notes recorded' }
                ]}
              />
              <Alert tone="info" title="What verification checks">
                Legal incorporation, GST details where provided, registered address, representative authority and the
                billing contact. Re-verification may be required if legal details change.
              </Alert>
            </Card>
          ) : null}
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="Verification checklist" />
            <div className="stack-sm">
              {[
                ['Company details complete', Boolean(form.industry && form.registeredAddress && form.repName && form.billingEmail)],
                ['Incorporation document', documents.some((doc: any) => doc.doc_type === 'incorporation')],
                ['GST certificate', documents.some((doc: any) => doc.doc_type === 'gst_certificate')],
                ['Address evidence', documents.some((doc: any) => doc.doc_type === 'address_proof')],
                ['Organisation verified', employer.verificationStatus === 'verified']
              ].map(([label, done]) => (
                <div className="row" key={String(label)} style={{ alignItems: 'flex-start' }}>
                  <Icon name={done ? 'check-circle' : 'alert-circle'} className={done ? 'icon-sm text-success' : 'icon-sm text-warning'} />
                  <span className="tiny">{label}</span>
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" className="btn-block" onClick={reload} style={{ marginTop: 12 }}>Refresh status</Button>
          </Card>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile navy sm"><Icon name="lock" /></span><strong>Data handling</strong></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Documents are encrypted at rest and served only to authorised reviewers. Downloads by your own team are
              audited. Access is revoked automatically if the organisation is suspended.
            </p>
          </Card>

          <Alert tone="warning" title="Demo environment">
            Seeded documents and verification decisions are simulated. Do not upload genuine incorporation or tax
            documents.
          </Alert>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile gold sm"><Icon name="help-circle" /></span><strong>Need a change?</strong></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Legal name, GSTIN and registration number are locked after verification. Contact support with evidence to
              request a correction.
            </p>
            <a className="btn btn-secondary btn-sm btn-block" href="mailto:support@flamingo.work" style={{ marginTop: 10 }}>Contact support</a>
          </Card>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Verification gates" sub="What unlocks at each stage." />
        <div className="grid grid-3">
          <Card className="card-pad"><Badge tone="info">Always</Badge><strong style={{ display: 'block', marginTop: 10 }}>Browse marketplace</strong><p className="tiny muted">Public profiles and rate benchmarks are visible before verification.</p></Card>
          <Card className="card-pad"><Badge tone="warning">After verification</Badge><strong style={{ display: 'block', marginTop: 10 }}>Shortlist & interview</strong><p className="tiny muted">Contact details are released only to verified organisations.</p></Card>
          <Card className="card-pad"><Badge tone="success">After selected outcome</Badge><strong style={{ display: 'block', marginTop: 10 }}>Create contract</strong><p className="tiny muted">Hiring requires a completed final round with a selected outcome.</p></Card>
        </div>
      </div>
    </>
  );
}
