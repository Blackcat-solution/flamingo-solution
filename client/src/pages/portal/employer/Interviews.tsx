import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Icon, Input, Loading,
  Modal, PageHeader, Select, Stat, StatusBadge, Tabs, Textarea
} from '../../../components/ui';
import { api } from '../../../lib/api';
import { dateTimeLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type Filter = 'scheduled' | 'completed' | 'all';

const CRITERIA: Array<[string, string]> = [
  ['technical', 'Technical depth'],
  ['communication', 'Communication'],
  ['problemSolving', 'Problem solving'],
  ['collaboration', 'Collaboration'],
  ['reliability', 'Reliability']
];

const defaultWhen = () => {
  const date = new Date(Date.now() + 86_400_000);
  date.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
};

export default function EmployerInterviews() {
  useDocumentTitle('Interviews');
  const [searchParams] = useSearchParams();
  const { data, loading, error, reload } = useApi<any>('/employer/interviews');
  const { data: shortlistData } = useApi<any>('/employer/shortlist');
  const { data: requirementData } = useApi<any>('/employer/requirements');
  const { data: dashboard } = useApi<any>('/employer/dashboard');
  const { busy, run } = useAction();
  const [filter, setFilter] = useState<Filter>('scheduled');
  const [scheduleOpen, setScheduleOpen] = useState(Boolean(searchParams.get('candidate')));
  const [scheduleForm, setScheduleForm] = useState({
    professionalId: searchParams.get('candidate') || '',
    requirementId: searchParams.get('requirement') || '',
    round: '1',
    scheduledAt: defaultWhen(),
    durationMinutes: '45',
    panelNames: '',
    notes: ''
  });
  const [scorecard, setScorecard] = useState<any | null>(null);
  const [scoreForm, setScoreForm] = useState({
    panelName: '',
    scores: Object.fromEntries(CRITERIA.map(([key]) => [key, '7'])),
    notes: '',
    recommendation: 'yes'
  });
  const [outcome, setOutcome] = useState<any | null>(null);
  const [outcomeForm, setOutcomeForm] = useState({ outcome: 'advanced', notes: '' });

  const interviews = data?.interviews || [];
  const shortlist = shortlistData?.shortlist || [];
  const requirements = requirementData?.requirements || [];
  const canInterview = dashboard?.verification?.canInterview ?? (dashboard?.employer?.verificationStatus === 'verified');

  const filtered = useMemo(() => {
    if (filter === 'scheduled') return interviews.filter((interview: any) => interview.status === 'scheduled');
    if (filter === 'completed') return interviews.filter((interview: any) => interview.status === 'completed');
    return interviews;
  }, [interviews, filter]);

  if (loading) return <Loading label="Loading interviews." />;
  if (error) return <Alert tone="danger" title="Could not load interviews">{error}</Alert>;

  const candidateInterviews = (id: string) => interviews.filter((interview: any) => interview.professional_id === id);
  const roundTwoReady = (id: string) => {
    const round1 = candidateInterviews(id).find((interview: any) => interview.round === 1);
    return round1?.status === 'completed' && (round1.scorecards || []).length > 0;
  };

  const openScorecard = (interview: any) => {
    setScorecard(interview);
    setScoreForm({
      panelName: interview.panel?.[0]?.name || '',
      scores: Object.fromEntries(CRITERIA.map(([key]) => [key, '7'])),
      notes: '',
      recommendation: 'yes'
    });
  };

  const submitScorecard = () =>
    run('scorecard', async () => {
      if (!scorecard) return;
      await api(`/employer/interviews/${scorecard.id}/scorecard`, {
        method: 'POST',
        body: {
          panelName: scoreForm.panelName,
          scores: Object.fromEntries(Object.entries(scoreForm.scores).map(([key, value]) => [key, Number(value)])),
          notes: scoreForm.notes || undefined,
          recommendation: scoreForm.recommendation
        }
      });
      setScorecard(null);
      reload();
    }, 'Scorecard submitted.');

  const openOutcome = (interview: any) => {
    setOutcome(interview);
    setOutcomeForm({ outcome: interview.round === 2 ? 'selected' : 'advanced', notes: '' });
  };

  const submitOutcome = () =>
    run('outcome', async () => {
      if (!outcome) return;
      await api(`/employer/interviews/${outcome.id}/outcome`, {
        method: 'POST',
        body: { outcome: outcomeForm.outcome, notes: outcomeForm.notes || undefined }
      });
      setOutcome(null);
      reload();
    }, 'Interview outcome recorded.');

  const schedule = () =>
    run('schedule', async () => {
      const panel = scheduleForm.panelNames.split(',').map((name) => name.trim()).filter(Boolean).map((name) => ({ name }));
      if (!scheduleForm.professionalId) throw new Error('Choose a shortlisted candidate.');
      if (!panel.length) throw new Error('Name at least one panel member.');
      if (Number(scheduleForm.round) === 2 && !roundTwoReady(scheduleForm.professionalId)) {
        throw new Error('Complete Round 1 and submit its scorecard before scheduling the final round.');
      }
      await api('/employer/interviews', {
        method: 'POST',
        body: {
          professionalId: scheduleForm.professionalId,
          requirementId: scheduleForm.requirementId || null,
          round: Number(scheduleForm.round),
          scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
          durationMinutes: Number(scheduleForm.durationMinutes),
          panel,
          notes: scheduleForm.notes || undefined
        }
      });
      setScheduleOpen(false);
      setScheduleForm((current) => ({ ...current, notes: '', panelNames: '' }));
      reload();
    }, 'Interview scheduled. The candidate has been notified.');

  return (
    <>
      <PageHeader
        title="Interview centre"
        eyebrow="Selection"
        description="A maximum of two rounds: a scored panel interview and a final discussion. Round 2 unlocks only after the Round 1 scorecard is submitted."
        actions={<Button onClick={() => setScheduleOpen(true)} disabled={!canInterview}><Icon name="video" className="icon-sm" /> Schedule interview</Button>}
      />

      {!canInterview ? <Alert tone="warning" title="Verification required">Interview scheduling requires a verified organisation. <Link to="/portal/employer/profile">Complete verification</Link>.</Alert> : null}

      <div className="grid grid-4">
        <Stat label="Scheduled" value={interviews.filter((interview: any) => interview.status === 'scheduled').length} sub="Upcoming conversations" icon="calendar" tone="success" />
        <Stat label="Completed" value={interviews.filter((interview: any) => interview.status === 'completed').length} sub="With recorded outcomes" icon="check-circle" />
        <Stat label="Final rounds" value={interviews.filter((interview: any) => interview.round === 2).length} sub="Final discussions only" icon="award" tone="warning" />
        <Stat label="Awaiting scorecard" value={interviews.filter((interview: any) => interview.status === 'completed' && !(interview.scorecards || []).length).length} sub="Complete for a fair record" icon="file-text" />
      </div>

      <div style={{ marginTop: 22 }}>
        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'scheduled', label: 'Scheduled', count: interviews.filter((interview: any) => interview.status === 'scheduled').length },
            { key: 'completed', label: 'Completed', count: interviews.filter((interview: any) => interview.status === 'completed').length },
            { key: 'all', label: 'All', count: interviews.length }
          ]}
        />
      </div>

      <div className="stack" style={{ marginTop: 20 }}>
        {filtered.length ? filtered.map((interview: any) => {
          const hasScorecard = (interview.scorecards || []).length > 0;
          return (
            <Card key={interview.id} className="card-pad">
              <div className="between wrap" style={{ alignItems: 'flex-start', gap: 14 }}>
                <div>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <Badge tone={interview.round === 1 ? 'info' : 'brand'}>{interview.round === 1 ? 'Round 1 · Panel interview' : 'Round 2 · Final discussion'}</Badge>
                    <StatusBadge status={interview.status} />
                    {interview.outcome ? <Badge tone={interview.outcome === 'selected' ? 'success' : interview.outcome === 'rejected' ? 'danger' : 'warning'}>{titleCase(interview.outcome)}</Badge> : null}
                  </div>
                  <h3 className="card-title" style={{ marginTop: 10 }}>{interview.professional_name}</h3>
                  <div className="page-sub" style={{ marginBottom: 0 }}>
                    {dateTimeLabel(interview.scheduled_at)} · {interview.duration_minutes} min · {titleCase(interview.mode)}
                    {interview.requirement_title ? ` · ${interview.requirement_title}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="stat-label">Panel</div>
                  <div className="tiny">{(interview.panel || []).map((member: any) => member.name).join(', ') || 'Unassigned'}</div>
                  {hasScorecard ? <Badge tone="success">Scorecard submitted</Badge> : interview.status === 'completed' ? <Badge tone="warning">Scorecard missing</Badge> : null}
                </div>
              </div>

              {(interview.scorecards || []).length ? (
                <div className="table-wrap" style={{ marginTop: 14 }}>
                  <table className="table table-compact">
                    <thead><tr><th>Panelist</th><th>Score</th><th>Recommendation</th><th>Submitted</th></tr></thead>
                    <tbody>
                      {interview.scorecards.map((card: any) => (
                        <tr key={card.id}>
                          <td>{card.panel_name}</td>
                          <td className="num">{card.total_score}/100</td>
                          <td><Badge tone={['strong_yes', 'yes'].includes(card.recommendation) ? 'success' : 'danger'}>{titleCase(card.recommendation)}</Badge></td>
                          <td>{dateTimeLabel(card.submitted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {interview.notes ? <p className="tiny muted" style={{ marginTop: 10 }}>{interview.notes}</p> : null}

              <div className="row wrap" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                {interview.meeting_url && interview.status === 'scheduled' ? (
                  <a className="btn btn-secondary btn-sm" href={interview.meeting_url} target="_blank" rel="noreferrer"><Icon name="video" className="icon-sm" /> Meeting room</a>
                ) : null}
                {interview.status === 'scheduled' ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => openScorecard(interview)}><Icon name="file-text" className="icon-sm" /> {hasScorecard ? 'Add scorecard' : 'Submit scorecard'}</Button>
                    <Button variant="primary" size="sm" onClick={() => openOutcome(interview)}>Record outcome</Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => openScorecard(interview)}>Add another scorecard</Button>
                )}
              </div>
            </Card>
          );
        }) : (
          <EmptyState
            icon="video"
            title={filter === 'scheduled' ? 'No interviews scheduled' : 'No interviews in this view'}
            description="Shortlist a verified candidate first. Round 1 must be completed with a scorecard before the final discussion can be booked."
            action={<Link className="btn btn-primary" to="/portal/employer/shortlist">Open shortlist</Link>}
          />
        )}
      </div>

      <div className="portal-section">
        <Card className="card-pad">
          <CardHeader title="How the two-round limit works" subtitle="Enforced by the API, not just guidance." />
          <div className="grid grid-3">
            <div>
              <strong className="small">Round 1 · Panel</strong>
              <p className="tiny muted">Panel members score fixed criteria. A scorecard is required before Round 2.</p>
            </div>
            <div>
              <strong className="small">Round 2 · Final discussion</strong>
              <p className="tiny muted">Scope, schedule and payment. No third round exists in the model.</p>
            </div>
            <div>
              <strong className="small">Hiring gate</strong>
              <p className="tiny muted">Only a completed Round 2 with a “selected” outcome unlocks assignment creation.</p>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule an interview"
        subtitle="Maximum two rounds per candidate."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={schedule} loading={busy === 'schedule'}>Schedule interview</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Candidate" htmlFor="int-candidate" required className="span-2">
            <Select id="int-candidate" value={scheduleForm.professionalId} onChange={(event) => setScheduleForm((current) => ({ ...current, professionalId: event.target.value }))}>
              <option value="">Choose a shortlisted candidate</option>
              {shortlist.map((candidate: any) => {
                const existing = candidateInterviews(candidate.id);
                return (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} — {existing.length ? `${existing.length}/2 rounds used` : 'no interviews yet'}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Requirement" htmlFor="int-requirement">
            <Select id="int-requirement" value={scheduleForm.requirementId} onChange={(event) => setScheduleForm((current) => ({ ...current, requirementId: event.target.value }))}>
              <option value="">No specific requirement</option>
              {requirements.map((requirement: any) => <option key={requirement.id} value={requirement.id}>{requirement.title}</option>)}
            </Select>
          </Field>
          <Field label="Round" htmlFor="int-round" required hint="Round 2 requires a completed Round 1 scorecard.">
            <Select id="int-round" value={scheduleForm.round} onChange={(event) => setScheduleForm((current) => ({ ...current, round: event.target.value }))}>
              <option value="1">Round 1 — panel interview</option>
              <option value="2">Round 2 — final discussion</option>
            </Select>
          </Field>
          <Field label="Date & time" htmlFor="int-when" required>
            <Input id="int-when" type="datetime-local" value={scheduleForm.scheduledAt} onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledAt: event.target.value }))} />
          </Field>
          <Field label="Duration (minutes)" htmlFor="int-duration" required>
            <Input id="int-duration" type="number" min={20} max={120} step={5} value={scheduleForm.durationMinutes} onChange={(event) => setScheduleForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
          </Field>
          <Field label="Panel members" htmlFor="int-panel" required className="span-2" hint="Comma-separated names. At least one.">
            <Input id="int-panel" value={scheduleForm.panelNames} onChange={(event) => setScheduleForm((current) => ({ ...current, panelNames: event.target.value }))} placeholder="Nandini Rao, Karthik S." />
          </Field>
          <Field label="Notes for the candidate" htmlFor="int-notes" className="span-2" hint="Optional. Share preparation or accessibility information.">
            <Textarea id="int-notes" value={scheduleForm.notes} maxLength={1000} onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))} style={{ minHeight: 80 }} />
          </Field>
        </div>
        <Alert tone="info" title="Simulated meeting link">
          A placeholder meeting URL is generated automatically. Conflicts with the candidate or your panel are blocked.
        </Alert>
      </Modal>

      <Modal
        open={Boolean(scorecard)}
        onClose={() => setScorecard(null)}
        title="Interview scorecard"
        subtitle={scorecard ? `${scorecard.professional_name} · Round ${scorecard.round}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setScorecard(null)}>Cancel</Button>
            <Button onClick={submitScorecard} loading={busy === 'scorecard'}>Submit scorecard</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Panelist name" htmlFor="sc-name" required className="span-2">
            <Input id="sc-name" value={scoreForm.panelName} onChange={(event) => setScoreForm((current) => ({ ...current, panelName: event.target.value }))} />
          </Field>
          {CRITERIA.map(([key, label]) => (
            <Field key={key} label={label} htmlFor={`sc-${key}`} hint="Score out of 10.">
              <Input id={`sc-${key}`} type="number" min={0} max={10} step={1} value={scoreForm.scores[key]} onChange={(event) => setScoreForm((current) => ({ ...current, scores: { ...current.scores, [key]: event.target.value } }))} />
            </Field>
          ))}
          <Field label="Recommendation" htmlFor="sc-recommendation" required className="span-2">
            <Select id="sc-recommendation" value={scoreForm.recommendation} onChange={(event) => setScoreForm((current) => ({ ...current, recommendation: event.target.value }))}>
              <option value="strong_yes">Strong yes</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="strong_no">Strong no</option>
            </Select>
          </Field>
          <Field label="Evidence notes" htmlFor="sc-notes" className="span-2" hint="Record concrete examples, not impressions alone.">
            <Textarea id="sc-notes" value={scoreForm.notes} maxLength={2000} onChange={(event) => setScoreForm((current) => ({ ...current, notes: event.target.value }))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(outcome)}
        onClose={() => setOutcome(null)}
        title="Record interview outcome"
        subtitle={outcome ? `${outcome.professional_name} · Round ${outcome.round}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOutcome(null)}>Cancel</Button>
            <Button onClick={submitOutcome} loading={busy === 'outcome'}>Publish outcome</Button>
          </>
        }
      >
        <Field label="Outcome" htmlFor="out-outcome" required hint={outcome?.round === 2 ? 'Round 2 can only be selected, rejected or marked no-show.' : 'Advance to the final discussion, reject or mark a no-show.'}>
          <Select id="out-outcome" value={outcomeForm.outcome} onChange={(event) => setOutcomeForm((current) => ({ ...current, outcome: event.target.value }))}>
            {outcome?.round === 1 ? <option value="advanced">Advanced to Round 2</option> : null}
            {outcome?.round === 2 ? <option value="selected">Selected — unlock hiring</option> : null}
            <option value="rejected">Rejected</option>
            <option value="no_show">No show</option>
          </Select>
        </Field>
        <Field label="Notes" htmlFor="out-notes" hint="The candidate sees a neutral notification. Detailed feedback can be shared through support.">
          <Textarea id="out-notes" value={outcomeForm.notes} maxLength={2000} onChange={(event) => setOutcomeForm((current) => ({ ...current, notes: event.target.value }))} />
        </Field>
        <Alert tone="warning" title="This is a formal decision">
          Outcomes are recorded in the audit log. A “selected” outcome after Round 2 is the only route to creating an
          assignment contract.
        </Alert>
      </Modal>
    </>
  );
}
