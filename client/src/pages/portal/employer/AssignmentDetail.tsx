import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import {
  Alert, Avatar, Badge, Button, Card, CardHeader, DefinitionList, EmptyState, Field,
  Icon, Input, Loading, Modal, PageHeader, Select, StatusBadge, Textarea
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { api } from '../../../lib/api';
import { dateLabel, dateTimeLabel, inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

const REVIEW_CRITERIA: Array<[string, string]> = [
  ['quality', 'Quality of work'],
  ['timeliness', 'Timeliness'],
  ['technical', 'Technical skill'],
  ['conduct', 'Professional conduct'],
  ['communication', 'Communication'],
  ['reliability', 'Reliability']
];

export default function EmployerAssignmentDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<any>(id ? `/employer/assignments/${id}` : null);
  const { busy, run } = useAction();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    scores: Object.fromEntries(REVIEW_CRITERIA.map(([key]) => [key, '8'])),
    strengths: '',
    improvements: '',
    responsibilities: '',
    rehire: true
  });

  useDocumentTitle(data?.assignment?.code ? `Assignment ${data.assignment.code}` : 'Assignment');

  if (loading) return <Loading label="Loading contract." />;
  if (error) return <Alert tone="danger" title="Could not load assignment">{error}</Alert>;
  if (!data) return null;

  const { assignment, professional, timesheets, invoices, payments, payouts, activationFee, review, events } = data;
  const advance = payments.find((payment: any) => payment.type === 'advance');
  const final = payments.find((payment: any) => payment.type === 'final');
  const bothSigned = assignment.contract_signed_employer && assignment.contract_signed_professional;
  const canApproveCompletion = assignment.status === 'awaiting_approval';
  const canFundAdvance = bothSigned && !advance;

  const action = (key: string, operation: () => Promise<any>, success: string) =>
    run(key, async () => {
      await operation();
      reload();
    }, success);

  const sign = () => action('sign', () => api(`/employer/assignments/${assignment.id}/sign`, { method: 'POST' }), 'Contract signed on behalf of your organisation.');
  const payAdvance = () => action('pay-advance', () => api(`/employer/assignments/${assignment.id}/pay`, { method: 'POST', body: { type: 'advance' } }), 'Advance captured. The ₹699 activation fee was deducted from the professional’s first payout.');
  const payFinal = () => action('pay-final', () => api(`/employer/assignments/${assignment.id}/pay`, { method: 'POST', body: { type: 'final' } }), 'Final payment captured and payout scheduled.');
  const approveCompletion = () => action('approve', () => api(`/employer/assignments/${assignment.id}/approve-completion`, { method: 'POST' }), 'Completion approved. The final payment is now available.');

  const publishReview = () =>
    run('review', async () => {
      await api(`/employer/assignments/${assignment.id}/review`, {
        method: 'POST',
        body: {
          scores: Object.fromEntries(Object.entries(reviewForm.scores).map(([key, value]) => [key, Number(value)])),
          strengths: reviewForm.strengths,
          improvements: reviewForm.improvements,
          responsibilities: reviewForm.responsibilities,
          rehire: reviewForm.rehire
        }
      });
      setReviewOpen(false);
      reload();
    }, 'Performance review published.');

  const totalReview = REVIEW_CRITERIA.reduce((sum, [key]) => sum + Number(reviewForm.scores[key] || 0), 0) / REVIEW_CRITERIA.length * 10;

  return (
    <>
      <PageHeader
        title={assignment.title}
        eyebrow={`${assignment.code} · Contract`}
        description={`${professional?.name || 'Professional'} · ${titleCase(assignment.category)}`}
        actions={
          <>
            <Link className="btn btn-secondary" to="/portal/employer/assignments">All assignments</Link>
            {canFundAdvance ? <Button onClick={payAdvance} loading={busy === 'pay-advance'}><Icon name="credit-card" className="icon-sm" /> Fund 50% advance</Button> : null}
            {assignment.status === 'completed' && !final ? <Button onClick={payFinal} loading={busy === 'pay-final'}><Icon name="wallet" className="icon-sm" /> Release final 50%</Button> : null}
            {canApproveCompletion ? <Button onClick={approveCompletion} loading={busy === 'approve'}><Icon name="check-circle" className="icon-sm" /> Approve completion</Button> : null}
          </>
        }
      />

      <div className="row wrap" style={{ gap: 8, marginBottom: 18 }}>
        <StatusBadge status={assignment.status} />
        <Badge tone={bothSigned ? 'success' : 'warning'}>{bothSigned ? 'Both parties accepted' : 'Awaiting professional acceptance'}</Badge>
        <Badge tone={advance ? 'success' : 'outline'}>{advance ? 'Advance funded' : 'Advance not funded'}</Badge>
        <Badge tone={final ? 'success' : 'outline'}>{final ? 'Final paid' : 'Final not paid'}</Badge>
        {review ? <Badge tone="success">Review published</Badge> : null}
      </div>

      {!assignment.contract_signed_employer ? (
        <Alert tone="warning" title="Employer signature missing">Sign the contract before funding any payment. <Button size="sm" variant="secondary" onClick={sign} loading={busy === 'sign'}>Sign now</Button></Alert>
      ) : null}

      <div className="split">
        <div className="stack-lg">
          <Card>
            <CardHeader title="Contract terms" subtitle={`${dateLabel(assignment.start_date)} – ${dateLabel(assignment.end_date)}`} />
            <div className="grid grid-3">
              <div>
                <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Scope</div>
                <p className="tiny" style={{ marginTop: 4 }}>{assignment.scope || assignment.description || '—'}</p>
              </div>
              <div>
                <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Deliverables</div>
                <p className="tiny" style={{ marginTop: 4 }}>{assignment.deliverables}</p>
              </div>
              <div>
                <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Reporting manager</div>
                <p className="tiny" style={{ marginTop: 4 }}>{assignment.reporting_manager}</p>
              </div>
            </div>
            <div className="kv" style={{ marginTop: 16 }}>
              <div className="kv-row"><span className="kv-key">Working pattern</span><span className="kv-val">{(assignment.working_days || []).join(' · ')}</span></div>
              <div className="kv-row"><span className="kv-key">Daily window</span><span className="kv-val">{assignment.daily_start} · {assignment.shift_hours} paid hours + 60-minute break</span></div>
              <div className="kv-row"><span className="kv-key">Weekly hours</span><span className="kv-val">{assignment.hours_per_week} hours</span></div>
              <div className="kv-row"><span className="kv-key">Break schedule</span><span className="kv-val">{(assignment.break_schedule || []).map((item: any) => `${item.label} ${item.minutes}m`).join(' · ') || '15 + 15 + 30 minutes'}</span></div>
              <div className="kv-row"><span className="kv-key">Payment terms</span><span className="kv-val">{assignment.payment_terms}</span></div>
              <div className="kv-row"><span className="kv-key">Cancellation</span><span className="kv-val">{assignment.cancellation_terms}</span></div>
              <div className="kv-row"><span className="kv-key">Disputes</span><span className="kv-val">{assignment.dispute_terms}</span></div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment schedule" subtitle="50% advance, 50% on completion. GST and platform fee are itemised on every invoice." />
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Milestone</th><th className="num">Amount</th><th>Status</th><th>Captured</th></tr></thead>
                <tbody>
                  <tr>
                    <td>Advance · 50%</td>
                    <td className="num">{inr(Math.round(assignment.total_value_paise / 2))}</td>
                    <td><StatusBadge status={advance ? (advance.status === 'captured' ? 'paid' : advance.status) : 'pending'} /></td>
                    <td>{advance ? dateLabel(advance.captured_at) : '—'}</td>
                  </tr>
                  <tr>
                    <td>Final · 50%</td>
                    <td className="num">{inr(assignment.total_value_paise - Math.round(assignment.total_value_paise / 2))}</td>
                    <td><StatusBadge status={final ? (final.status === 'captured' ? 'paid' : final.status) : 'pending'} /></td>
                    <td>{final ? dateLabel(final.captured_at) : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="row wrap" style={{ marginTop: 14 }}>
              {canFundAdvance ? <Button onClick={payAdvance} loading={busy === 'pay-advance'}>Fund advance</Button> : null}
              {assignment.status === 'active' ? <span className="tiny muted">Completion approval unlocks the final payment once the professional submits evidence.</span> : null}
              {canApproveCompletion ? <Button onClick={approveCompletion} loading={busy === 'approve'}>Approve completion</Button> : null}
              {assignment.status === 'completed' && !final ? <Button onClick={payFinal} loading={busy === 'pay-final'}>Release final payment</Button> : null}
            </div>
            <Alert tone="info" title="Fee disclosure">
              The professional’s one-time ₹699 activation fee is {activationFee?.status === 'deducted' ? `already deducted on ${dateLabel(activationFee.charged_at)}` : 'deducted from the first payout after you fund the advance'}. Base {inr(activationFee?.base_paise)} + GST {inr(activationFee?.gst_paise)}.
            </Alert>
          </Card>

          <Card>
            <CardHeader title="Timesheets" subtitle="Approved time supports completion and protects both parties." actions={<Link className="btn btn-secondary btn-sm" to="/portal/employer/timesheets">Review timesheets</Link>} />
            <div className="table-wrap">
              <table className="table table-compact">
                <thead><tr><th>Date</th><th>Window</th><th>Break</th><th>Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {timesheets.length ? timesheets.map((entry: any) => (
                    <tr key={entry.id}>
                      <td>{dateLabel(entry.work_date)}</td>
                      <td className="mono tiny">{entry.start_at}–{entry.end_at}</td>
                      <td className="num">{entry.break_minutes}m</td>
                      <td className="num">{entry.hours_worked}</td>
                      <td><StatusBadge status={entry.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={5} className="table-empty">No time logged yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Invoices & payouts" subtitle="Employer invoice totals and the professional’s net payouts." />
            <div className="table-wrap">
              <table className="table table-compact">
                <thead><tr><th>Invoice</th><th>Type</th><th className="num">Charges</th><th className="num">GST</th><th className="num">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {invoices.length ? invoices.map((invoice: any) => (
                    <tr key={invoice.id}>
                      <td className="mono tiny">{invoice.invoice_no}</td>
                      <td>{titleCase(invoice.type)}</td>
                      <td className="num">{inr(invoice.professional_charges_paise)}</td>
                      <td className="num">{inr(invoice.gst_paise)}</td>
                      <td className="num"><strong>{inr(invoice.total_paise)}</strong></td>
                      <td><StatusBadge status={invoice.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={6} className="table-empty">No invoices issued.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table table-compact">
                <thead><tr><th>Payout</th><th>Type</th><th className="num">Gross</th><th className="num">Fee</th><th className="num">Net</th><th>Status</th></tr></thead>
                <tbody>
                  {payouts.length ? payouts.map((payout: any) => (
                    <tr key={payout.id}>
                      <td className="mono tiny">{payout.payout_ref}</td>
                      <td>{titleCase(payout.type)}</td>
                      <td className="num">{inr(payout.gross_paise)}</td>
                      <td className="num">{payout.activation_fee_paise ? `−${inr(payout.activation_fee_paise)}` : '—'}</td>
                      <td className="num"><strong>{inr(payout.net_paise)}</strong></td>
                      <td><StatusBadge status={payout.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={6} className="table-empty">No payouts created.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>Payments are simulated. No live funds move and no escrow is claimed.</p>
          </Card>

          {assignment.status === 'completed' || assignment.status === 'closed' ? (
            <Card>
              <CardHeader
                title="Performance review"
                subtitle="Structured feedback becomes part of the professional’s verified career record."
                actions={!review ? <Button size="sm" onClick={() => setReviewOpen(true)}>Publish review</Button> : <StatusBadge status={review.status} />}
              />
              {review ? (
                <div className="grid grid-2">
                  <div>
                    <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 750 }}>{Number(review.total_score).toFixed(1)}</span>
                      <span className="tiny muted">/ 100</span>
                    </div>
                    <p className="tiny muted">{dateLabel(review.submitted_at)} · {titleCase(review.overall_rating)}</p>
                    <Badge tone={review.rehire ? 'success' : 'neutral'}>{review.rehire ? 'Would rehire' : 'No rehire'}</Badge>
                  </div>
                  <div>
                    <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Strengths</div>
                    <p className="tiny">{review.strengths}</p>
                    <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem', marginTop: 8 }}>Development areas</div>
                    <p className="tiny">{review.improvements}</p>
                  </div>
                </div>
              ) : (
                <EmptyState icon="star" title="No review yet" description="Publish a structured review to close the assignment and update the professional’s rating." action={<Button onClick={() => setReviewOpen(true)}>Publish performance review</Button>} />
              )}
            </Card>
          ) : null}
        </div>

        <div className="stack">
          {professional ? (
            <Card className="card-pad">
              <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <Avatar name={professional.name} size="lg" />
                <div>
                  <strong>{professional.name}</strong>
                  <div className="tiny muted">{professional.headline}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <Badge tone="success"><Icon name="shield-check" className="icon-sm" /> Verified</Badge>
                    <Badge tone="brand">Assessment passed</Badge>
                  </div>
                </div>
              </div>
              <div className="kv" style={{ marginTop: 12 }}>
                <div className="kv-row"><span className="kv-key">Email</span><span className="kv-val tiny">{professional.email || '—'}</span></div>
                <div className="kv-row"><span className="kv-key">Phone</span><span className="kv-val tiny">{professional.phone || '—'}</span></div>
                <div className="kv-row"><span className="kv-key">Location</span><span className="kv-val">{professional.city}</span></div>
                <div className="kv-row"><span className="kv-key">Rating</span><span className="kv-val">{professional.rating ? `${Number(professional.rating).toFixed(1)} / 5` : 'New'}</span></div>
              </div>
              <Link className="btn btn-secondary btn-sm btn-block" to={`/professionals/${professional.id}`} style={{ marginTop: 10 }}>View record</Link>
            </Card>
          ) : null}

          <Card className="card-pad">
            <CardHeader title="Contract value" />
            <div className="money-sheet">
              <div className="money-line"><span>Rate</span><span className="num">{inr(assignment.hourly_rate_paise)}/h</span></div>
              <div className="money-line"><span>Hours</span><span className="num">{assignment.estimated_hours}h</span></div>
              <div className="money-total"><span>Total</span><strong>{inr(assignment.total_value_paise)}</strong></div>
            </div>
            <DefinitionList
              items={[
                { label: 'Advance', value: inr(Math.round(assignment.total_value_paise / 2)) },
                { label: 'Final', value: inr(assignment.total_value_paise - Math.round(assignment.total_value_paise / 2)) },
                { label: 'Professional fee', value: `${inr(activationFee?.amount_paise)} once` },
                { label: 'Platform fee', value: inr(invoices.reduce((sum: number, invoice: any) => sum + invoice.platform_fee_paise, 0)) }
              ]}
            />
          </Card>

          <Card className="card-pad">
            <CardHeader title="Activity" />
            <div className="timeline">
              {events.length ? [...events].reverse().map((event: any) => (
                <div className="tl-item" key={event.id}>
                  <span className="tl-dot" />
                  <div>
                    <div className="tl-title">{titleCase(event.event_type)}</div>
                    <div className="tl-sub">{event.note}</div>
                    <div className="tiny muted">{dateTimeLabel(event.created_at)}</div>
                  </div>
                </div>
              )) : <p className="muted small">No events recorded.</p>}
            </div>
          </Card>

          <Alert tone="warning" title="Simulated gateway">
            Capturing payments here records simulated settlement only. Production requires an RBI-authorised payment
            aggregator and its escrow arrangements.
          </Alert>
        </div>
      </div>

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Publish performance review"
        subtitle={`${professional?.name || 'Professional'} · ${assignment.code}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button onClick={publishReview} loading={busy === 'review'}>Publish review</Button>
          </>
        }
      >
        <div className="form-grid">
          {REVIEW_CRITERIA.map(([key, label]) => (
            <Field key={key} label={label} htmlFor={`rv-${key}`} hint="Out of 10.">
              <Input id={`rv-${key}`} type="number" min={0} max={10} value={reviewForm.scores[key]} onChange={(event) => setReviewForm((current) => ({ ...current, scores: { ...current.scores, [key]: event.target.value } }))} />
            </Field>
          ))}
          <Field label="Strengths" htmlFor="rv-strengths" required className="span-2" hint="At least 10 characters. Be specific and evidence-based.">
            <Textarea id="rv-strengths" value={reviewForm.strengths} minLength={10} maxLength={2000} onChange={(event) => setReviewForm((current) => ({ ...current, strengths: event.target.value }))} />
          </Field>
          <Field label="Development areas" htmlFor="rv-improvements" required className="span-2" hint="At least 10 characters. Describe behaviour, not personality.">
            <Textarea id="rv-improvements" value={reviewForm.improvements} minLength={10} maxLength={2000} onChange={(event) => setReviewForm((current) => ({ ...current, improvements: event.target.value }))} />
          </Field>
          <Field label="Responsibilities delivered" htmlFor="rv-resp" required className="span-2" hint="At least 10 characters.">
            <Textarea id="rv-resp" value={reviewForm.responsibilities} minLength={10} maxLength={2000} onChange={(event) => setReviewForm((current) => ({ ...current, responsibilities: event.target.value }))} />
          </Field>
          <Field label="Would you work with this professional again?" htmlFor="rv-rehire" className="span-2">
            <Select id="rv-rehire" value={reviewForm.rehire ? 'yes' : 'no'} onChange={(event) => setReviewForm((current) => ({ ...current, rehire: event.target.value === 'yes' }))}>
              <option value="yes">Yes — would rehire</option>
              <option value="no">No</option>
            </Select>
          </Field>
        </div>
        <div className="money-sheet" style={{ marginTop: 12 }}>
          <div className="money-sheet-title">Provisional total</div>
          <div className="money-total"><span>Weighted score</span><strong>{totalReview.toFixed(0)} / 100</strong></div>
        </div>
        <Alert tone="info" title="Right of reply">
          The professional is notified and may respond once or challenge the review for human examination. Challenges are
          decided by a reviewer outside this engagement.
        </Alert>
      </Modal>

      <div className="portal-section">
        <SectionTitle title="Need help?" sub="Contract, timesheet or payment disputes are handled by the Flamingo team." />
        <Alert tone="neutral">
          Raise a dispute within 10 days of the disputed event. Both parties can submit evidence, and the resolution is
          recorded against the assignment. Contact <a href="mailto:support@flamingo.work">support@flamingo.work</a>.
        </Alert>
      </div>
    </>
  );
}
