import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, DefinitionList, Icon, Loading, Modal, PageHeader,
  StatusBadge
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { api } from '../../../lib/api';
import { dateLabel, dateTimeLabel, dayList, inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

export default function ProfessionalAssignmentDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<any>(id ? `/professional/assignments/${id}` : null);
  const { busy, run } = useAction();
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);

  useDocumentTitle(data?.assignment?.title ? data.assignment.title : 'Assignment');

  if (loading) return <Loading label="Loading assignment." />;
  if (error) return <Alert tone="danger" title="Could not load this assignment">{error}</Alert>;
  if (!data) return null;

  const { assignment, activationFee, payouts, timesheets, review, events } = data;
  const canAccept = !assignment.contractSignedProfessional && !['cancelled', 'completed', 'closed'].includes(assignment.status);
  const canDecline = !assignment.activationFeeCharged && assignment.status !== 'completed';
  const canSubmitCompletion = assignment.status === 'active';

  const accept = () =>
    run('accept', async () => {
      await api(`/professional/assignments/${assignment.id}/accept`, { method: 'POST' });
      setAcceptOpen(false);
      reload();
    }, 'Assignment accepted. The contract is now binding in this demonstration.');

  const decline = () =>
    run('decline', async () => {
      await api(`/professional/assignments/${assignment.id}/decline`, { method: 'POST' });
      reload();
    }, 'Assignment declined. No activation fee was charged.');

  const submitCompletion = () =>
    run('completion', async () => {
      await api(`/professional/assignments/${assignment.id}/submit-completion`, { method: 'POST' });
      setCompletionOpen(false);
      reload();
    }, 'Completion submitted for employer approval.');

  return (
    <>
      <PageHeader
        title={assignment.title}
        eyebrow={`${assignment.code} · ${assignment.employer}`}
        description={`${titleCase(assignment.category)} · ${dateLabel(assignment.startDate)} to ${dateLabel(assignment.endDate)}`}
        actions={
          <>
            <Link className="btn btn-secondary" to="/portal/professional/assignments">Back to assignments</Link>
            {canSubmitCompletion ? <Button onClick={() => setCompletionOpen(true)}>Submit completion</Button> : null}
          </>
        }
      />

      <div className="row wrap" style={{ marginBottom: 20 }}>
        <StatusBadge status={assignment.status} />
        <Badge tone={assignment.contractSignedProfessional ? 'success' : 'warning'}>{assignment.contractSignedProfessional ? 'You signed' : 'Your acceptance pending'}</Badge>
        <Badge tone={assignment.contractSignedEmployer ? 'success' : 'outline'}>{assignment.contractSignedEmployer ? 'Employer signed' : 'Employer signature pending'}</Badge>
        <Badge tone={assignment.activationFeeCharged ? 'success' : 'outline'}>{assignment.activationFeeCharged ? 'Activation fee deducted' : 'Activation fee not charged'}</Badge>
      </div>

      <div className="split">
        <div className="stack-lg">
          <Card>
            <CardHeader title="Assignment terms" subtitle="The contract terms disclosed before acceptance." actions={<Badge tone="outline">{assignment.code}</Badge>} />
            <DefinitionList
              items={[
                { label: 'Employer', value: assignment.employer },
                { label: 'Hourly rate', value: `${inr(assignment.hourlyRatePaise)} / hour` },
                { label: 'Weekly hours', value: `${assignment.hoursPerWeek} paid hours` },
                { label: 'Shift', value: `${assignment.shiftHours} hours, starting ${assignment.dailyStart}` },
                { label: 'Working days', value: dayList(assignment.workingDays) },
                { label: 'Duration', value: `${dateLabel(assignment.startDate)} – ${dateLabel(assignment.endDate)}` },
                { label: 'Estimated hours', value: `${assignment.estimatedHours} hours` },
                { label: 'Total value', value: inr(assignment.totalValuePaise) },
                { label: 'Reporting manager', value: assignment.reportingManager || '—' },
                { label: 'Payment terms', value: assignment.paymentTerms },
                { label: 'Cancellation', value: assignment.cancellationTerms },
                { label: 'Disputes', value: assignment.disputeTerms }
              ]}
            />
            <div className="notice" style={{ marginTop: 14 }}><strong>Deliverables</strong>{assignment.deliverables}</div>
            <div className="chips" style={{ marginTop: 14 }}>
              {(assignment.breakSchedule || []).map((item: any) => (
                <span className="chip" key={item.label}>{item.label} · {item.start}–{item.end}</span>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment schedule" subtitle="50% advance on signature, 50% after approved completion." />
            <div className="grid grid-3">
              <div className="card card-pad-sm" style={{ background: 'var(--cream)' }}>
                <div className="stat-label">Advance (50%)</div>
                <div className="stat-value" style={{ fontSize: '1.3rem' }}>{inr(Math.round(assignment.totalValuePaise / 2))}</div>
              </div>
              <div className="card card-pad-sm" style={{ background: 'var(--cream)' }}>
                <div className="stat-label">Completion (50%)</div>
                <div className="stat-value" style={{ fontSize: '1.3rem' }}>{inr(Math.round(assignment.totalValuePaise / 2))}</div>
              </div>
              <div className="card card-pad-sm" style={{ background: 'var(--brand-50)' }}>
                <div className="stat-label">Activation fee</div>
                <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--brand-700)' }}>{activationFee ? inr(activationFee.amountPaise) : inr(69900)}</div>
                <div className="tiny muted">Deducted once from first payout</div>
              </div>
            </div>
            {activationFee ? (
              <div className="alert alert-info" style={{ marginTop: 14 }}>
                <Icon name="info" />
                <div>
                  <strong>Activation-fee disclosure</strong>
                  <div className="tiny" style={{ marginTop: 3 }}>{activationFee.disclosure}</div>
                  <div className="tiny" style={{ marginTop: 4 }}>Base {inr(activationFee.basePaise)} + GST {inr(activationFee.gstPaise)} · Status {activationFee.status}</div>
                </div>
              </div>
            ) : null}
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table table-compact">
                <thead><tr><th>Payout</th><th>Type</th><th>Gross</th><th>Fee</th><th>Net</th><th>Status</th></tr></thead>
                <tbody>
                  {payouts.length ? payouts.map((payout: any) => (
                    <tr key={payout.id}>
                      <td className="mono">{payout.payout_ref}</td>
                      <td>{titleCase(payout.type)}</td>
                      <td className="num">{inr(payout.gross_paise)}</td>
                      <td className="num">{payout.activation_fee_paise ? `-${inr(payout.activation_fee_paise)}` : '—'}</td>
                      <td className="num"><strong>{inr(payout.net_paise)}</strong></td>
                      <td><StatusBadge status={payout.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={6} className="table-empty">No payouts yet. The employer must fund the advance after both parties accept.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timesheets" subtitle="Time is validated against the assignment pattern and weekly caps." actions={<Link className="btn btn-secondary btn-sm" to="/portal/professional/timesheets">Log time</Link>} />
            <div className="table-wrap">
              <table className="table table-compact">
                <thead><tr><th>Date</th><th>Window</th><th>Break</th><th>Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {timesheets.length ? timesheets.map((entry: any) => (
                    <tr key={entry.id}>
                      <td>{dateLabel(entry.work_date)}</td>
                      <td>{entry.start_at}–{entry.end_at}</td>
                      <td>{entry.break_minutes} min</td>
                      <td className="num">{entry.hours_worked}</td>
                      <td><StatusBadge status={entry.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={5} className="table-empty">No time logged for this assignment.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          {review ? (
            <Card>
              <CardHeader title="Performance review" subtitle={`${review.overall_rating} · ${review.total_score}/100`} actions={<StatusBadge status={review.status} />} />
              <div className="grid grid-2">
                <div><div className="tiny strong">Strengths</div><p className="tiny muted" style={{ marginTop: 4 }}>{review.strengths}</p></div>
                <div><div className="tiny strong">Development areas</div><p className="tiny muted" style={{ marginTop: 4 }}>{review.improvements}</p></div>
              </div>
              <Link className="btn btn-secondary btn-sm" to="/portal/professional/reviews" style={{ marginTop: 12 }}>Respond or challenge</Link>
            </Card>
          ) : null}
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="Contract actions" />
            {canAccept ? (
              <>
                <p className="page-sub">Review the terms and activation-fee disclosure, then accept. Accepting checks your combined schedule for conflicts.</p>
                <Button block onClick={() => setAcceptOpen(true)}>Accept assignment</Button>
                {canDecline ? <Button block variant="secondary" onClick={decline} loading={busy === 'decline'} style={{ marginTop: 8 }}>Decline — no fee</Button> : null}
              </>
            ) : (
              <div className="alert alert-success">
                <Icon name="check-circle" />
                <div>{assignment.contractSignedProfessional ? 'You accepted this contract.' : 'This assignment is no longer open for acceptance.'}</div>
              </div>
            )}
            {canSubmitCompletion ? (
              <Button block variant="secondary" onClick={() => setCompletionOpen(true)} style={{ marginTop: 10 }}>Submit completion</Button>
            ) : null}
          </Card>

          <Card className="card-pad">
            <CardHeader title="Activity" subtitle="Assignment events in order." />
            <div className="timeline">
              {events.length ? events.map((event: any) => (
                <div className="tl-item" key={event.id}>
                  <span className="tl-dot" />
                  <div>
                    <div className="tl-title">{titleCase(event.event_type)}</div>
                    <div className="tl-sub">{dateTimeLabel(event.created_at)}</div>
                    {event.note ? <div className="tiny muted" style={{ marginTop: 3 }}>{event.note}</div> : null}
                  </div>
                </div>
              )) : <p className="muted small">No events yet.</p>}
            </div>
          </Card>

          <Alert tone="warning" title="Money is simulated">
            The employer payment and your payout use a simulated gateway in this environment. No live funds move.
            Production settlement requires an RBI-authorised payment aggregator.
          </Alert>
        </div>
      </div>

      <Modal
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        title="Accept this assignment?"
        subtitle="This is a demonstration contract. Acceptance records your consent and activates the fee disclosure."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAcceptOpen(false)}>Cancel</Button>
            <Button onClick={accept} loading={busy === 'accept'}>Accept contract</Button>
          </>
        }
      >
        <div className="kv">
          <div className="kv-row"><span className="kv-key">Assignment</span><span className="kv-val">{assignment.title}</span></div>
          <div className="kv-row"><span className="kv-key">Employer</span><span className="kv-val">{assignment.employer}</span></div>
          <div className="kv-row"><span className="kv-key">Total value</span><span className="kv-val">{inr(assignment.totalValuePaise)}</span></div>
          <div className="kv-row"><span className="kv-key">Activation fee</span><span className="kv-val">{activationFee ? inr(activationFee.amountPaise) : inr(69900)} once</span></div>
        </div>
        <div className="notice" style={{ marginTop: 12 }}>
          The activation fee is deducted from your first payout only, after the employer funds the advance. It is not
          a subscription. Declining before activation incurs no charge.
        </div>
      </Modal>

      <Modal
        open={completionOpen}
        onClose={() => setCompletionOpen(false)}
        title="Submit assignment completion?"
        subtitle="The employer must approve completion before the final 50% payment can be released."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompletionOpen(false)}>Cancel</Button>
            <Button onClick={submitCompletion} loading={busy === 'completion'}>Submit completion</Button>
          </>
        }
      >
        <p className="small">Confirm that the agreed deliverables have been completed and documented. The employer will review and approve the release.</p>
      </Modal>
    </>
  );
}
