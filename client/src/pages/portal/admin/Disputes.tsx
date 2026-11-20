import { useState } from 'react';
import {
  Alert, Button, Card, CardHeader, DefinitionList, Field, Icon, Loading,
  Modal, PageHeader, Select, StatusBadge, Tabs, Textarea
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { dateLabel, relativeTime, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type TabKey = 'disputes' | 'reviews';

const REVIEW_SCORE_LABELS: Record<string, string> = {
  quality: 'Quality of work',
  timeliness: 'Timeliness',
  technical: 'Technical skill',
  conduct: 'Conduct',
  communication: 'Communication',
  reliability: 'Reliability'
};

function DisputeResolve({ dispute, onClose, onDone }: { dispute: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [form, setForm] = useState({ status: 'investigating', resolution: '' });

  const submit = () =>
    run('resolve', async () => {
      await api(`/admin/disputes/${dispute.id}/resolve`, {
        method: 'POST',
        body: { status: form.status, resolution: form.resolution }
      });
      onDone();
      onClose();
    }, 'Dispute updated.');

  return (
    <Modal
      open
      size="lg"
      title={`${titleCase(dispute.category)} dispute`}
      subtitle={`Raised by ${dispute.raised_by_name} · ${dateLabel(dispute.created_at)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy === 'resolve'} disabled={form.resolution.trim().length < 10}>
            Save decision
          </Button>
        </>
      }
    >
      <div className="between" style={{ marginBottom: 14 }}>
        <StatusBadge status={dispute.status} />
        <span className="tiny muted">{dispute.assignment_code || 'No assignment linked'}</span>
      </div>

      <DefinitionList
        items={[
          { label: 'Raised by', value: `${dispute.raised_by_name} (${titleCase(dispute.raised_by_role)})` },
          { label: 'Assignment', value: dispute.assignment_title || 'Not linked' },
          { label: 'Employer', value: dispute.org_name || 'Not linked' },
          { label: 'Category', value: titleCase(dispute.category) },
          { label: 'Status', value: <StatusBadge status={dispute.status} /> },
          { label: 'Opened', value: dateLabel(dispute.created_at) }
        ]}
      />

      <div className="card card-pad-sm" style={{ marginTop: 14, background: 'var(--cream)' }}>
        <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Dispute description</div>
        <p className="small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{dispute.description}</p>
      </div>

      <div className="form-section" style={{ marginTop: 18 }}>
        <div className="form-section-head">
          <h3 className="form-section-title">Decision</h3>
          <p className="form-section-sub">Investigate the evidence before resolving. The decision and note are visible to the person who raised the dispute.</p>
        </div>
        <div className="form-grid">
          <Field label="Status" htmlFor="dispute-status" required>
            <Select id="dispute-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </Select>
          </Field>
          <Field
            label="Resolution note"
            htmlFor="dispute-resolution"
            required
            className="span-2"
            hint="At least 10 characters. Summarise the evidence, the decision and any remedy."
          >
            <Textarea
              id="dispute-resolution"
              value={form.resolution}
              onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value }))}
              maxLength={3000}
              style={{ minHeight: 110 }}
            />
          </Field>
        </div>
      </div>

      <Alert tone="info" title="Evidence discipline">
        Resolve on the contract, timesheets and written communication. Do not disclose one party's private evidence to
        the other beyond what the resolution requires.
      </Alert>
    </Modal>
  );
}

function ReviewResolve({ review, onClose, onDone }: { review: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [form, setForm] = useState({ decision: 'uphold', resolution: '' });
  const scores = review.scores || {};

  const submit = () =>
    run('resolve', async () => {
      await api(`/admin/reviews/${review.id}/resolve`, {
        method: 'POST',
        body: { decision: form.decision, resolution: form.resolution }
      });
      onDone();
      onClose();
    }, 'Review challenge resolved.');

  return (
    <Modal
      open
      size="lg"
      title="Review challenge"
      subtitle={`${review.professional_name} challenged a review from ${review.org_name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy === 'resolve'} disabled={form.resolution.trim().length < 10}>
            Record decision
          </Button>
        </>
      }
    >
      <div className="between" style={{ marginBottom: 14 }}>
        <StatusBadge status={review.status} />
        <span className="tiny muted">Response {review.response_at ? relativeTime(review.response_at) : 'pending'}</span>
      </div>

      <DefinitionList
        items={[
          { label: 'Assignment', value: `${review.title} · ${review.code}` },
          { label: 'Employer', value: review.org_name },
          { label: 'Professional', value: review.professional_name },
          { label: 'Overall', value: titleCase(review.overall_rating) },
          { label: 'Total score', value: `${review.total_score}/100` },
          { label: 'Published', value: dateLabel(review.submitted_at) }
        ]}
      />

      <div style={{ marginTop: 14 }}>
        <div className="eyebrow eyebrow-plain">Scores</div>
        <div className="grid grid-2" style={{ marginTop: 6 }}>
          {Object.entries(REVIEW_SCORE_LABELS).map(([key, label]) => (
            <div className="between" key={key}>
              <span className="tiny muted">{label}</span>
              <span className="tiny strong">{scores[key] ?? '—'}/10</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <div className="card card-pad-sm" style={{ background: 'var(--cream)' }}>
          <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Professional response</div>
          <p className="small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{review.professional_response || 'No response recorded.'}</p>
        </div>
        <div className="card card-pad-sm">
          <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Original narrative</div>
          <p className="tiny" style={{ marginTop: 4 }}><strong>Strengths:</strong> {review.strengths || '—'}</p>
          <p className="tiny" style={{ marginTop: 4 }}><strong>Improvements:</strong> {review.improvements || '—'}</p>
        </div>
      </div>

      <div className="form-section" style={{ marginTop: 18 }}>
        <div className="form-section-head">
          <h3 className="form-section-title">Decision</h3>
          <p className="form-section-sub">Upholding keeps the review with a marker. Revising keeps the record but notes the correction.</p>
        </div>
        <div className="form-grid">
          <Field label="Decision" htmlFor="review-decision" required>
            <Select id="review-decision" value={form.decision} onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value }))}>
              <option value="uphold">Uphold the original review</option>
              <option value="revise">Mark the review revised</option>
            </Select>
          </Field>
          <Field
            label="Explanation"
            htmlFor="review-resolution"
            required
            className="span-2"
            hint="At least 10 characters. This explanation is attached to the public review record."
          >
            <Textarea
              id="review-resolution"
              value={form.resolution}
              onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value }))}
              maxLength={3000}
              style={{ minHeight: 100 }}
            />
          </Field>
        </div>
      </div>

      <Alert tone="warning" title="Reviews are not deleted">
        The original review remains visible with a challenge marker and the resolution. Flamingo does not silently
        remove employer feedback.
      </Alert>
    </Modal>
  );
}

export default function AdminDisputes() {
  useDocumentTitle('Disputes & reviews');
  const { adminPermissions } = useAuth();
  const can = (permission: string) => adminPermissions.includes('*') || adminPermissions.includes(permission);
  const canDisputes = can('disputes.view');
  const canReviews = can('marketplace.moderate');
  const canResolveDispute = can('disputes.finance');
  const [tab, setTab] = useState<TabKey>(canDisputes ? 'disputes' : 'reviews');
  const [status, setStatus] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [selectedReview, setSelectedReview] = useState<any>(null);

  const disputesApi = useApi<any>(canDisputes ? `/admin/disputes${status ? `?status=${status}` : ''}` : null);
  const reviewsApi = useApi<any>(canReviews ? '/admin/reviews/challenges' : null);

  if (!canDisputes && !canReviews) {
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>Your administrator role does not include dispute or review moderation.</p>
      </Card>
    );
  }

  const disputes = disputesApi.data?.disputes || [];
  const reviews = reviewsApi.data?.reviews || [];

  return (
    <>
      <PageHeader
        title="Disputes & reviews"
        eyebrow="Fair outcomes"
        description="Investigate payment, timesheet and conduct disputes, and review challenges to performance feedback. Decisions are written by a person with an explanation."
      />

      <Tabs<TabKey>
        active={tab}
        onChange={setTab}
        tabs={[
          ...(canDisputes ? [{ key: 'disputes' as TabKey, label: 'Disputes', count: disputes.length }] : []),
          ...(canReviews ? [{ key: 'reviews' as TabKey, label: 'Review challenges', count: reviews.length }] : [])
        ]}
      />

      {tab === 'disputes' && canDisputes ? (
        <>
          <Card className="card-pad-sm" style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Select value={status} onChange={(event) => setStatus(event.target.value)} style={{ maxWidth: 200 }}>
                <option value="">All disputes</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </Select>
              <span className="grow" />
              <span className="tiny muted">{disputes.length} case{disputes.length === 1 ? '' : 's'}</span>
            </div>
          </Card>

          {disputesApi.loading ? <Loading label="Loading disputes." /> : null}
          {disputesApi.error ? <Alert tone="danger" title="Could not load disputes">{disputesApi.error}</Alert> : null}

          {!disputesApi.loading && !disputesApi.error ? (
            <Card style={{ marginTop: 16 }}>
              <CardHeader title="Dispute register" subtitle="Oldest open cases first." />
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Case</th><th>Raised by</th><th>Assignment</th><th>Category</th><th>Opened</th><th>Status</th><th className="actions">Action</th></tr></thead>
                  <tbody>
                    {disputes.length ? disputes.map((dispute: any) => (
                      <tr key={dispute.id}>
                        <td>
                          <div className="list-title">{dispute.description.slice(0, 70)}{dispute.description.length > 70 ? '…' : ''}</div>
                          <div className="tiny muted mono">{dispute.id}</div>
                        </td>
                        <td>
                          <div>{dispute.raised_by_name}</div>
                          <div className="tiny muted">{titleCase(dispute.raised_by_role)}</div>
                        </td>
                        <td>
                          {dispute.assignment_title ? (
                            <>
                              <div>{dispute.assignment_title}</div>
                              <div className="tiny muted">{dispute.assignment_code} · {dispute.org_name}</div>
                            </>
                          ) : <span className="tiny muted">Not linked</span>}
                        </td>
                        <td>{titleCase(dispute.category)}</td>
                        <td>{dateLabel(dispute.created_at)}</td>
                        <td><StatusBadge status={dispute.status} /></td>
                        <td className="actions">
                          <Button variant="secondary" size="sm" onClick={() => setSelectedDispute(dispute)}>
                            {canResolveDispute ? 'Open case' : 'View case'}
                          </Button>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={7} className="table-empty">No disputes in this view.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'reviews' && canReviews ? (
        <>
          {reviewsApi.loading ? <Loading label="Loading review challenges." /> : null}
          {reviewsApi.error ? <Alert tone="danger" title="Could not load review challenges">{reviewsApi.error}</Alert> : null}

          {!reviewsApi.loading && !reviewsApi.error ? (
            <Card style={{ marginTop: 16 }}>
              <CardHeader
                title="Challenged reviews"
                subtitle="A professional has asked for a human review of published feedback."
              />
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Assignment</th><th>Professional</th><th>Employer</th><th>Score</th><th>Response</th><th>Status</th><th className="actions">Action</th></tr></thead>
                  <tbody>
                    {reviews.length ? reviews.map((review: any) => (
                      <tr key={review.id}>
                        <td>
                          <div className="list-title">{review.title}</div>
                          <div className="tiny muted">{review.code}</div>
                        </td>
                        <td>{review.professional_name}</td>
                        <td>{review.org_name}</td>
                        <td className="num">{review.total_score}/100</td>
                        <td>{review.response_at ? relativeTime(review.response_at) : '—'}</td>
                        <td><StatusBadge status={review.status} /></td>
                        <td className="actions">
                          <Button variant="secondary" size="sm" onClick={() => setSelectedReview(review)}>Open challenge</Button>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={7} className="table-empty">No review challenges are waiting.</td></tr>}
                  </tbody>
                </table>
              </div>
              {reviewsApi.data?.disclaimer ? <Alert tone="neutral" title="Moderation note">{reviewsApi.data.disclaimer}</Alert> : null}
            </Card>
          ) : null}
        </>
      ) : null}

      <div className="portal-section">
        <div className="grid grid-3">
          <Card className="card-pad">
            <span className="icon-tile green sm"><Icon name="check-circle" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Evidence first</strong>
            <p className="tiny muted">Read the contract, approved timesheets and written communication before deciding.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile navy sm"><Icon name="scale" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Both sides heard</strong>
            <p className="tiny muted">Disputes are investigated, not auto-rejected. Record the evidence relied on.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile gold sm"><Icon name="eye" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Transparent outcomes</strong>
            <p className="tiny muted">The person who raised the case receives the resolution note. Reviews are never silently removed.</p>
          </Card>
        </div>
      </div>

      {selectedDispute ? (
        canResolveDispute ? (
          <DisputeResolve dispute={selectedDispute} onClose={() => setSelectedDispute(null)} onDone={disputesApi.reload} />
        ) : (
          <Modal
            open
            size="lg"
            title={`${titleCase(selectedDispute.category)} dispute`}
            subtitle={`Raised by ${selectedDispute.raised_by_name}`}
            onClose={() => setSelectedDispute(null)}
            footer={<Button variant="secondary" onClick={() => setSelectedDispute(null)}>Close</Button>}
          >
            <StatusBadge status={selectedDispute.status} />
            <p className="small" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{selectedDispute.description}</p>
            <Alert tone="warning" title="Read-only access">
              Recording a resolution requires the disputes finance permission. Ask a super administrator if you need it.
            </Alert>
          </Modal>
        )
      ) : null}

      {selectedReview ? (
        <ReviewResolve review={selectedReview} onClose={() => setSelectedReview(null)} onDone={reviewsApi.reload} />
      ) : null}
    </>
  );
}
