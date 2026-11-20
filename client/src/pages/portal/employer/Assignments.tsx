import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, EmptyState, Field, Icon, Input, Loading,
  Modal, PageHeader, Select, Stat, StatusBadge, Tabs, Textarea
} from '../../../components/ui';
import { api } from '../../../lib/api';
import { dateLabel, inr, titleCase } from '../../../lib/format';
import { todayISO, rupeesToPaise, useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type Filter = 'all' | 'active' | 'offers' | 'completed' | 'cancelled';

const DAYS = [
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' }
];

const emptyForm = {
  professionalId: '',
  requirementId: '',
  title: '',
  description: '',
  scope: '',
  hourlyRate: '',
  shiftHours: '8',
  workingDays: ['TUE', 'WED', 'THU', 'FRI'],
  hoursPerWeek: '32',
  dailyStart: '09:00',
  startDate: todayISO(),
  weeks: '8',
  reportingManager: '',
  deliverables: '',
  paymentTerms: '',
  cancellationTerms: '',
  disputeTerms: ''
};

export default function EmployerAssignments() {
  useDocumentTitle('Assignments');
  const { data, loading, error, reload } = useApi<any>('/employer/assignments');
  const { data: shortlistData } = useApi<any>('/employer/shortlist');
  const { data: interviewData, reload: reloadInterviews } = useApi<any>('/employer/interviews');
  const { data: requirementData } = useApi<any>('/employer/requirements');
  const { data: dashboard } = useApi<any>('/employer/dashboard');
  const { busy, run } = useAction();
  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const assignments = data?.assignments || [];
  const shortlist = shortlistData?.shortlist || [];
  const requirements = requirementData?.requirements || [];
  const canHire = dashboard?.verification?.canHire ?? (dashboard?.employer?.verificationStatus === 'verified');

  const eligible = useMemo(() => {
    const selected = (interviewData?.interviews || []).filter(
      (interview: any) => interview.round === 2 && interview.status === 'completed' && interview.outcome === 'selected'
    );
    const ids = Array.from(new Set(selected.map((interview: any) => interview.professional_id)));
    return ids
      .map((id) => shortlist.find((candidate: any) => candidate.id === id))
      .filter(Boolean);
  }, [interviewData, shortlist]);

  const filtered = assignments.filter((assignment: any) => {
    if (filter === 'active') return ['active', 'not_started', 'awaiting_approval'].includes(assignment.status);
    if (filter === 'offers') return assignment.status === 'not_started' && !assignment.contract_signed_professional;
    if (filter === 'completed') return ['completed', 'closed'].includes(assignment.status);
    if (filter === 'cancelled') return assignment.status === 'cancelled';
    return true;
  });

  if (loading) return <Loading label="Loading assignments." />;
  if (error) return <Alert tone="danger" title="Could not load assignments">{error}</Alert>;

  const update = (key: string) => (event: any) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const toggleDay = (day: string) => {
    setForm((current) => {
      const days = current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : current.workingDays.length >= 4 ? current.workingDays : [...current.workingDays, day];
      return { ...current, workingDays: days };
    });
  };

  const chooseCandidate = (event: any) => {
    const candidate = shortlist.find((item: any) => item.id === event.target.value);
    setForm((current) => ({
      ...current,
      professionalId: event.target.value,
      hourlyRate: candidate?.hourlyRatePaise ? String(candidate.hourlyRatePaise / 100) : current.hourlyRate,
      shiftHours: candidate?.shiftHours ? String(candidate.shiftHours) : current.shiftHours,
      title: current.title || (candidate ? `${titleCase(candidate.category)} engagement — ${candidate.name}` : '')
    }));
  };

  const chooseRequirement = (event: any) => {
    const requirement = requirements.find((item: any) => item.id === event.target.value);
    setForm((current) => ({
      ...current,
      requirementId: event.target.value,
      title: requirement?.title || current.title,
      description: requirement?.description || current.description,
      scope: current.scope || requirement?.description || '',
      hourlyRate: requirement?.budget_hourly_paise ? String(requirement.budget_hourly_paise / 100) : current.hourlyRate,
      shiftHours: requirement?.shift_hours ? String(requirement.shift_hours) : current.shiftHours,
      hoursPerWeek: requirement?.hours_per_week ? String(requirement.hours_per_week) : current.hoursPerWeek,
      workingDays: requirement?.workingDays?.length ? requirement.workingDays : current.workingDays,
      startDate: requirement?.start_date || current.startDate,
      weeks: requirement?.duration_weeks ? String(requirement.duration_weeks) : current.weeks
    }));
  };

  const create = () =>
    run('create', async () => {
      if (!form.professionalId) throw new Error('Choose a selected candidate. Hiring requires a completed final interview with a selected outcome.');
      if (form.scope.trim().length < 20) throw new Error('Describe the scope in at least 20 characters.');
      if (form.deliverables.trim().length < 10) throw new Error('List the deliverables (at least 10 characters).');
      const total = rupeesToPaise(form.hourlyRate) * Number(form.hoursPerWeek) * Number(form.weeks);
      await api('/employer/assignments', {
        method: 'POST',
        body: {
          professionalId: form.professionalId,
          requirementId: form.requirementId || null,
          title: form.title,
          description: form.description || undefined,
          scope: form.scope,
          hourlyRatePaise: rupeesToPaise(form.hourlyRate),
          hoursPerWeek: Number(form.hoursPerWeek),
          shiftHours: Number(form.shiftHours),
          workingDays: form.workingDays,
          dailyStart: form.dailyStart,
          startDate: form.startDate,
          weeks: Number(form.weeks),
          reportingManager: form.reportingManager,
          deliverables: form.deliverables,
          paymentTerms: form.paymentTerms || undefined,
          cancellationTerms: form.cancellationTerms || undefined,
          disputeTerms: form.disputeTerms || undefined
        }
      });
      setCreateOpen(false);
      setForm({ ...emptyForm });
      reload();
      reloadInterviews();
      return total;
    }, 'Contract created. The professional has been notified and must accept before payment.');

  const totalValue = rupeesToPaise(form.hourlyRate) * Number(form.hoursPerWeek || 0) * Number(form.weeks || 0);

  return (
    <>
      <PageHeader
        title="Assignments"
        eyebrow="Contracts & engagements"
        description="Only a completed final interview with a “selected” outcome unlocks a contract. Both parties accept digitally before any money is funded."
        actions={<Button onClick={() => setCreateOpen(true)} disabled={!canHire}><Icon name="plus" className="icon-sm" /> Create contract</Button>}
      />

      {!canHire ? <Alert tone="warning" title="Verification required">Hiring requires a verified organisation. <Link to="/portal/employer/profile">Complete verification</Link>.</Alert> : null}

      <div className="grid grid-4">
        <Stat label="Active" value={assignments.filter((assignment: any) => ['active', 'not_started', 'awaiting_approval'].includes(assignment.status)).length} sub="Live engagements" icon="briefcase" tone="success" />
        <Stat label="Awaiting acceptance" value={assignments.filter((assignment: any) => assignment.status === 'not_started' && !assignment.contract_signed_professional).length} sub="Professional has not signed" icon="file-text" tone="warning" />
        <Stat label="Completed" value={assignments.filter((assignment: any) => ['completed', 'closed'].includes(assignment.status)).length} sub="Paid or closed" icon="check-circle" />
        <Stat label="Committed value" value={inr(assignments.reduce((sum: number, assignment: any) => sum + Number(assignment.total_value_paise || 0), 0), { compact: true })} sub={`${eligible.length} eligible candidate${eligible.length === 1 ? '' : 's'}`} icon="rupee" />
      </div>

      <div style={{ marginTop: 22 }}>
        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'all', label: 'All', count: assignments.length },
            { key: 'active', label: 'Active', count: assignments.filter((assignment: any) => ['active', 'not_started', 'awaiting_approval'].includes(assignment.status)).length },
            { key: 'offers', label: 'Offers', count: assignments.filter((assignment: any) => assignment.status === 'not_started' && !assignment.contract_signed_professional).length },
            { key: 'completed', label: 'Completed', count: assignments.filter((assignment: any) => ['completed', 'closed'].includes(assignment.status)).length },
            { key: 'cancelled', label: 'Cancelled', count: assignments.filter((assignment: any) => assignment.status === 'cancelled').length }
          ]}
        />
      </div>

      <div className="stack" style={{ marginTop: 20 }}>
        {filtered.length ? filtered.map((assignment: any) => (
          <Card key={assignment.id} className="card-pad">
            <div className="between wrap" style={{ alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <Badge tone="outline">{assignment.code}</Badge>
                  <StatusBadge status={assignment.status} />
                  {assignment.contract_signed_professional ? <Badge tone="success">Professional accepted</Badge> : <Badge tone="warning">Awaiting acceptance</Badge>}
                  {assignment.activation_fee_charged ? <Badge tone="success">Advance funded</Badge> : <Badge tone="outline">Not funded</Badge>}
                </div>
                <h3 className="card-title" style={{ marginTop: 10 }}>{assignment.title}</h3>
                <div className="page-sub" style={{ marginBottom: 8 }}>{assignment.professional_name} · {titleCase(assignment.category)}</div>
                <div className="chips">
                  <span className="chip"><Icon name="calendar" className="icon-sm" /> {assignment.working_days?.replace(/[\[\]"]/g, '').replace(/,/g, ' · ')}</span>
                  <span className="chip"><Icon name="clock" className="icon-sm" /> {assignment.shift_hours}h/day · {assignment.hours_per_week}h/week</span>
                  <span className="chip"><Icon name="map-pin" className="icon-sm" /> {dateLabel(assignment.start_date)} – {dateLabel(assignment.end_date)}</span>
                  <span className="chip"><Icon name="rupee" className="icon-sm" /> {inr(assignment.hourly_rate_paise)}/hour</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="stat-label">Total contract</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 750 }}>{inr(assignment.total_value_paise)}</div>
                <div className="tiny muted">{assignment.estimated_hours} estimated hours</div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <Link className="btn btn-secondary btn-sm" to={`/portal/employer/finance`}>Financial centre</Link>
              <Link className="btn btn-primary btn-sm" to={`/portal/employer/assignments/${assignment.id}`}>Open contract <Icon name="arrow-right" className="icon-sm" /></Link>
            </div>
          </Card>
        )) : (
          <EmptyState
            icon="briefcase"
            title={filter === 'all' ? 'No assignments yet' : `No ${filter} assignments`}
            description={eligible.length ? 'You have a selected candidate. Create the contract to begin the engagement.' : 'Complete a final interview with a selected outcome to unlock a contract.'}
            action={eligible.length ? <Button onClick={() => setCreateOpen(true)}>Create contract</Button> : <Link className="btn btn-primary" to="/portal/employer/interviews">Open interview centre</Link>}
          />
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create assignment contract"
        subtitle="Hiring is only available after a completed Round 2 with a selected outcome."
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={busy === 'create'}>Create contract</Button>
          </>
        }
      >
        {eligible.length ? (
          <>
            <div className="form-grid">
              <Field label="Selected candidate" htmlFor="asg-candidate" required className="span-2">
                <Select id="asg-candidate" value={form.professionalId} onChange={chooseCandidate}>
                  <option value="">Choose a selected candidate</option>
                  {eligible.map((candidate: any) => (
                    <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.headline}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Linked requirement" htmlFor="asg-requirement">
                <Select id="asg-requirement" value={form.requirementId} onChange={chooseRequirement}>
                  <option value="">No linked requirement</option>
                  {requirements.map((requirement: any) => <option key={requirement.id} value={requirement.id}>{requirement.title}</option>)}
                </Select>
              </Field>
              <Field label="Contract title" htmlFor="asg-title" required>
                <Input id="asg-title" value={form.title} onChange={update('title')} maxLength={180} />
              </Field>
              <Field label="Scope" htmlFor="asg-scope" required className="span-2" hint={`${form.scope.length}/3000 characters. Minimum 20.`}>
                <Textarea id="asg-scope" value={form.scope} onChange={update('scope')} maxLength={3000} placeholder="What the professional will deliver and the boundaries of the engagement." />
              </Field>
              <Field label="Deliverables" htmlFor="asg-deliverables" required className="span-2" hint="Specific, observable outputs used for completion approval.">
                <Textarea id="asg-deliverables" value={form.deliverables} onChange={update('deliverables')} maxLength={3000} />
              </Field>
              <Field label="Reporting manager" htmlFor="asg-manager" required>
                <Input id="asg-manager" value={form.reportingManager} onChange={update('reportingManager')} placeholder="Name and role" maxLength={160} />
              </Field>
              <Field label="Hourly rate (₹)" htmlFor="asg-rate" required hint="Must sit inside the sourced range for the category and level.">
                <Input id="asg-rate" type="number" min={100} step={50} value={form.hourlyRate} onChange={update('hourlyRate')} />
              </Field>
              <Field label="Shift length" htmlFor="asg-shift" required>
                <Select id="asg-shift" value={form.shiftHours} onChange={update('shiftHours')}>
                  <option value="8">8 hours</option>
                  <option value="10">10 hours</option>
                  <option value="12">12 hours</option>
                </Select>
              </Field>
              <Field label="Hours per week" htmlFor="asg-hours" required>
                <Input id="asg-hours" type="number" min={4} max={48} value={form.hoursPerWeek} onChange={update('hoursPerWeek')} />
              </Field>
              <Field label="Daily start" htmlFor="asg-start-time" required>
                <Input id="asg-start-time" type="time" value={form.dailyStart} onChange={update('dailyStart')} />
              </Field>
              <Field label="Start date" htmlFor="asg-start" required>
                <Input id="asg-start" type="date" value={form.startDate} min={todayISO()} onChange={update('startDate')} />
              </Field>
              <Field label="Duration (weeks)" htmlFor="asg-weeks" required>
                <Input id="asg-weeks" type="number" min={1} max={52} value={form.weeks} onChange={update('weeks')} />
              </Field>
              <Field label="Working days" htmlFor="asg-days" required className="span-2" hint="Up to four days, Tuesday to Saturday. Sunday and Monday are compulsory off days.">
                <div className="row wrap" id="asg-days">
                  {DAYS.map((day) => (
                    <button key={day.key} type="button" className={`btn btn-sm ${form.workingDays.includes(day.key) ? 'btn-dark' : 'btn-secondary'}`} onClick={() => toggleDay(day.key)} aria-pressed={form.workingDays.includes(day.key)}>
                      {form.workingDays.includes(day.key) ? <Icon name="check" className="icon-sm" /> : null}{day.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Payment terms" htmlFor="asg-payment" className="span-2" hint="Leave blank to use the standard 50% advance and 50% completion terms.">
                <Textarea id="asg-payment" value={form.paymentTerms} maxLength={1000} onChange={update('paymentTerms')} style={{ minHeight: 60 }} />
              </Field>
              <Field label="Cancellation terms" htmlFor="asg-cancel" className="span-2" hint="Leave blank for the standard seven-day notice terms.">
                <Textarea id="asg-cancel" value={form.cancellationTerms} maxLength={1000} onChange={update('cancellationTerms')} style={{ minHeight: 60 }} />
              </Field>
            </div>
            <div className="money-sheet" style={{ marginTop: 14 }}>
              <div className="money-sheet-title">Contract value</div>
              <div className="money-line"><span>{inr(rupeesToPaise(form.hourlyRate))} × {form.hoursPerWeek}h × {form.weeks} weeks</span><span className="num">{inr(totalValue)}</span></div>
              <div className="money-line deduct"><span>50% advance on acceptance</span><span className="num">{inr(Math.round(totalValue / 2))}</span></div>
              <div className="money-total"><span>50% on completion</span><strong>{inr(Math.round(totalValue / 2))}</strong></div>
            </div>
            <Alert tone="info" title="Activation fee">
              The professional pays a one-time ₹699 GST-inclusive activation fee, deducted from their first payout. It is
              not added to your invoice and is not a subscription.
            </Alert>
          </>
        ) : (
          <EmptyState
            icon="award"
            title="No selected candidates"
            description="Complete Round 2 with a selected outcome first. Flamingo does not allow hiring without that recorded decision."
            action={<Link className="btn btn-primary" to="/portal/employer/interviews">Open interview centre</Link>}
          />
        )}
      </Modal>
    </>
  );
}
