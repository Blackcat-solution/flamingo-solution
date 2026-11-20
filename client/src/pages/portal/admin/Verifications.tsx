import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, DefinitionList, Field, Icon, Input, Loading,
  Modal, PageHeader, Pagination, Select, StatusBadge, Tabs, Textarea
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { api, downloadFile } from '../../../lib/api';
import { dateLabel, titleCase } from '../../../lib/format';
import { useApi, useDebounced, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type TabKey = 'professionals' | 'employers';

function DocumentRows({
  documents,
  onReviewed
}: {
  documents: any[];
  onReviewed: (id: string, status: string) => void;
}) {
  const { busy, run } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const review = (doc: any, decision: 'approve' | 'reject') =>
    run(`${decision}-${doc.id}`, async () => {
      await api(`/admin/documents/${doc.id}/review`, {
        method: 'POST',
        body: { decision, notes: notes[doc.id] || undefined }
      });
      onReviewed(doc.id, decision === 'approve' ? 'verified' : 'rejected');
    }, decision === 'approve' ? 'Document verified.' : 'Document rejected.');

  if (!documents.length) {
    return <p className="muted small">No documents uploaded.</p>;
  }

  return (
    <div className="stack">
      {documents.map((doc) => (
        <div key={doc.id} className="card card-pad-sm">
          <div className="between" style={{ gap: 12 }}>
            <div>
              <div className="list-title">{doc.filename}</div>
              <div className="tiny muted">
                {titleCase(doc.doc_type)} · {Math.round(doc.size_bytes / 1024)} KB · uploaded {dateLabel(doc.created_at)}
              </div>
            </div>
            <StatusBadge status={doc.status} />
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadFile(`/admin/documents/${doc.id}/download`, doc.filename)}
            >
              <Icon name="download" className="icon-sm" /> Download
            </Button>
            {doc.status === 'submitted' ? (
              <>
                <Button size="sm" onClick={() => review(doc, 'approve')} loading={busy === `approve-${doc.id}`}>
                  <Icon name="check" className="icon-sm" /> Verify
                </Button>
                <Button variant="danger-soft" size="sm" onClick={() => review(doc, 'reject')} loading={busy === `reject-${doc.id}`}>
                  <Icon name="x" className="icon-sm" /> Reject
                </Button>
              </>
            ) : null}
          </div>
          {doc.status === 'submitted' ? (
            <Input
              value={notes[doc.id] || ''}
              onChange={(event) => setNotes((current) => ({ ...current, [doc.id]: event.target.value }))}
              placeholder="Reviewer note (optional for approval, recommended for rejection)"
              style={{ marginTop: 8 }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ProfessionalReview({
  row,
  onClose,
  onDone
}: {
  row: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const { busy, run } = useAction();
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<any[]>(row.documents || []);

  const decide = (decision: 'approve' | 'reject') =>
    run(decision, async () => {
      await api(`/admin/verifications/professionals/${row.id}/decision`, {
        method: 'POST',
        body: { decision, notes: notes || undefined }
      });
      onDone();
      onClose();
    }, decision === 'approve' ? 'Professional verified.' : 'Verification rejected.');

  const skillList = Array.isArray(row.skills) ? row.skills : [];

  return (
    <Modal
      open
      size="xl"
      title={row.name}
      subtitle={`${row.headline} · ${titleCase(row.category)} · ${row.years_experience} years`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger-soft"
            onClick={() => decide('reject')}
            loading={busy === 'reject'}
            disabled={notes.trim().length < 10}
          >
            Reject verification
          </Button>
          <Button onClick={() => decide('approve')} loading={busy === 'approve'}>Approve verification</Button>
        </>
      }
    >
      <div className="between" style={{ marginBottom: 14 }}>
        <StatusBadge status={row.verification_status} />
        <div className="tiny muted">Submitted {dateLabel(row.created_at)}</div>
      </div>

      <DefinitionList
        items={[
          { label: 'Email', value: row.email || '—' },
          { label: 'Phone', value: row.phone || '—' },
          { label: 'Identity status', value: <StatusBadge status={row.identity_status || row.identityStatus} /> },
          { label: 'Assessment', value: <StatusBadge status={row.assessmentStatus || row.assessment_status} /> },
          { label: 'Location', value: [row.city, row.state].filter(Boolean).join(', ') || '—' },
          { label: 'Education', value: row.education || '—' },
          { label: 'Current role', value: row.currentTitle || row.current_title || '—' },
          { label: 'Hourly rate', value: row.hourlyRatePaise ? `₹${row.hourlyRatePaise / 100}/hour` : 'Not set' }
        ]}
      />

      {skillList.length ? (
        <div style={{ marginTop: 14 }}>
          <div className="eyebrow eyebrow-plain">Skills claimed</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {skillList.map((skill: string) => <Badge key={skill} tone="outline">{skill}</Badge>)}
          </div>
        </div>
      ) : null}

      <div className="form-section" style={{ marginTop: 18 }}>
        <div className="form-section-head">
          <h3 className="form-section-title">Employment history</h3>
          <p className="form-section-sub">Check dates and titles against the uploaded evidence.</p>
        </div>
        {row.employment?.length ? (
          <div className="stack-sm">
            {row.employment.map((job: any) => (
              <div key={job.id} className="between" style={{ gap: 12 }}>
                <div>
                  <div className="small strong">{job.title} · {job.employer_name}</div>
                  <div className="tiny muted">{dateLabel(job.start_date)} — {job.is_current ? 'Present' : dateLabel(job.end_date)}</div>
                </div>
                <Badge tone={job.verified ? 'success' : 'warning'}>{job.verified ? 'Verified' : 'Unverified'}</Badge>
              </div>
            ))}
          </div>
        ) : <p className="muted small">No employment history recorded.</p>}
      </div>

      <div className="form-section" style={{ marginTop: 18 }}>
        <div className="form-section-head">
          <h3 className="form-section-title">Documents</h3>
          <p className="form-section-sub">Files are encrypted at rest. Every download is audited.</p>
        </div>
        <DocumentRows
          documents={documents}
          onReviewed={(id, status) =>
            setDocuments((current) => current.map((doc) => (doc.id === id ? { ...doc, status } : doc)))
          }
        />
      </div>

      <Field
        label="Reviewer notes"
        htmlFor="pro-verify-notes"
        hint="Required for rejection (at least 10 characters). The professional receives this note."
      >
        <Textarea
          id="pro-verify-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          style={{ minHeight: 90 }}
          placeholder="What evidence did you check, and what did you decide?"
        />
      </Field>

      <Alert tone="info">
        Approving verification does not publish the profile. Public visibility still requires a passed assessment and
        the professional's own publishing choice.
      </Alert>
    </Modal>
  );
}

function EmployerReview({
  row,
  onClose,
  onDone
}: {
  row: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const { busy, run } = useAction();
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<any[]>(row.documents || []);

  const decide = (decision: 'approve' | 'reject') =>
    run(decision, async () => {
      await api(`/admin/verifications/employers/${row.id}/decision`, {
        method: 'POST',
        body: { decision, notes: notes || undefined }
      });
      onDone();
      onClose();
    }, decision === 'approve' ? 'Organisation verified.' : 'Organisation verification rejected.');

  return (
    <Modal
      open
      size="xl"
      title={row.org_name}
      subtitle={`${row.contact_name} · ${row.city || 'City not set'}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger-soft"
            onClick={() => decide('reject')}
            loading={busy === 'reject'}
            disabled={notes.trim().length < 10}
          >
            Reject verification
          </Button>
          <Button onClick={() => decide('approve')} loading={busy === 'approve'}>Approve organisation</Button>
        </>
      }
    >
      <div className="between" style={{ marginBottom: 14 }}>
        <StatusBadge status={row.verification_status} />
        <div className="tiny muted">Registered {dateLabel(row.created_at)}</div>
      </div>

      <DefinitionList
        items={[
          { label: 'Legal name', value: row.legal_name || '—' },
          { label: 'Registration number', value: row.registration_number || '—' },
          { label: 'GSTIN', value: row.gstin || 'Not provided' },
          { label: 'Industry', value: row.industry || '—' },
          { label: 'Company size', value: row.company_size || '—' },
          { label: 'Website', value: row.website || '—' },
          { label: 'Contact email', value: row.contact_email || '—' },
          { label: 'Phone', value: row.phone || '—' },
          { label: 'Representative', value: `${row.rep_name || '—'}${row.rep_designation ? ` · ${row.rep_designation}` : ''}` },
          { label: 'Billing email', value: row.billing_email || '—' },
          { label: 'Registered address', value: row.registered_address || '—' }
        ]}
      />

      <div className="form-section" style={{ marginTop: 18 }}>
        <div className="form-section-head">
          <h3 className="form-section-title">Incorporation and tax evidence</h3>
          <p className="form-section-sub">Confirm the legal name and GST details match the documents.</p>
        </div>
        <DocumentRows
          documents={documents}
          onReviewed={(id, status) =>
            setDocuments((current) => current.map((doc) => (doc.id === id ? { ...doc, status } : doc)))
          }
        />
      </div>

      <Field
        label="Reviewer notes"
        htmlFor="emp-verify-notes"
        hint="Required for rejection (at least 10 characters). The employer receives this note."
      >
        <Textarea
          id="emp-verify-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          style={{ minHeight: 90 }}
          placeholder="Which documents were checked, and what did you decide?"
        />
      </Field>

      <Alert tone="info">
        Verifying an organisation unlocks shortlisting, interviewing and hiring. Candidate contact details are released
        only after that employer shortlists a candidate.
      </Alert>
    </Modal>
  );
}

export default function AdminVerifications() {
  useDocumentTitle('Verification centre');
  const { adminPermissions } = useAuth();
  const allowed = adminPermissions.includes('*') || adminPermissions.includes('verification.review');
  const [params, setParams] = useSearchParams();
  const tab: TabKey = params.get('tab') === 'employers' ? 'employers' : 'professionals';
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => setPage(1), [tab, status, debounced]);

  const path = useMemo(() => {
    if (!allowed) return null;
    const search = new URLSearchParams();
    if (status) search.set('status', status);
    if (debounced) search.set('q', debounced);
    search.set('page', String(page));
    search.set('limit', '20');
    return `/admin/verifications/${tab}?${search.toString()}`;
  }, [allowed, tab, status, debounced, page]);

  const { data, loading, error, reload } = useApi<any>(path);

  if (!allowed) {
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>Your administrator role does not include verification review.</p>
      </Card>
    );
  }

  const rows = data?.rows || [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Verification centre"
        eyebrow="Trust & safety"
        description="Review identity, experience and organisation evidence. Decisions are written by a person with notes and recorded in the audit log."
      />

      <Tabs<TabKey>
        active={tab}
        onChange={(next) => {
          setParams(next === 'professionals' ? {} : { tab: next });
          setSelected(null);
        }}
        tabs={[
          { key: 'professionals', label: 'Professionals' },
          { key: 'employers', label: 'Employers' }
        ]}
      />

      <Card className="card-pad-sm" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === 'professionals' ? 'Search name, email or headline' : 'Search organisation, contact or email'}
            style={{ maxWidth: 320 }}
          />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} style={{ maxWidth: 180 }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_review">In review</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </Select>
          <span className="grow" />
          <span className="tiny muted">{pagination?.total ?? 0} records</span>
        </div>
      </Card>

      {loading ? <Loading label="Loading verification queue." /> : null}
      {error ? <Alert tone="danger" title="Could not load the queue">{error}</Alert> : null}

      {!loading && !error ? (
        <Card style={{ marginTop: 16 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                {tab === 'professionals' ? (
                  <tr><th>Professional</th><th>Category</th><th>Experience</th><th>Documents</th><th>Status</th><th>Submitted</th><th className="actions">Action</th></tr>
                ) : (
                  <tr><th>Organisation</th><th>Contact</th><th>Industry</th><th>Documents</th><th>Status</th><th>Registered</th><th className="actions">Action</th></tr>
                )}
              </thead>
              <tbody>
                {rows.length ? rows.map((row: any) => (
                  <tr key={row.id}>
                    {tab === 'professionals' ? (
                      <>
                        <td>
                          <div className="list-title">{row.name}</div>
                          <div className="tiny muted">{row.headline}</div>
                        </td>
                        <td>{titleCase(row.category)}</td>
                        <td className="num">{row.yearsExperience ?? row.years_experience} yrs</td>
                        <td>{row.documents?.length || 0}</td>
                        <td><StatusBadge status={row.verificationStatus || row.verification_status} /></td>
                        <td>{dateLabel(row.created_at)}</td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div className="list-title">{row.org_name}</div>
                          <div className="tiny muted">{row.legal_name || row.city || '—'}</div>
                        </td>
                        <td>
                          <div>{row.contact_name}</div>
                          <div className="tiny muted">{row.contact_email}</div>
                        </td>
                        <td>{row.industry || '—'}</td>
                        <td>{row.documents?.length || 0}</td>
                        <td><StatusBadge status={row.verification_status} /></td>
                        <td>{dateLabel(row.created_at)}</td>
                      </>
                    )}
                    <td className="actions">
                      <Button variant="secondary" size="sm" onClick={() => setSelected(row)}>Review</Button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="table-empty">No records match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination ? (
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
          ) : null}
        </Card>
      ) : null}

      <div className="portal-section">
        <Card className="card-pad">
          <div className="row"><span className="icon-tile green sm"><Icon name="shield-check" /></span><strong>Verification standard</strong></div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Check that the legal name, identity and experience match the evidence. Approval records the decision but does
            not publish a professional profile; publishing also requires a passed assessment and the professional's
            consent. Rejections must include a clear note so the applicant can correct the record.
          </p>
        </Card>
      </div>

      {selected && tab === 'professionals' ? (
        <ProfessionalReview row={selected} onClose={() => setSelected(null)} onDone={reload} />
      ) : null}
      {selected && tab === 'employers' ? (
        <EmployerReview row={selected} onClose={() => setSelected(null)} onDone={reload} />
      ) : null}
    </>
  );
}
