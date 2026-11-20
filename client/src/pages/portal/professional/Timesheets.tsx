import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Icon, Input, Loading,
  PageHeader, Select, Stat, StatusBadge, Tabs, Textarea
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { api } from '../../../lib/api';
import { dateLabel, inr } from '../../../lib/format';
import { addDaysISO, todayISO, useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type Filter = 'all' | 'submitted' | 'approved' | 'rejected';

const toMinutes = (time: string) => {
  const [hours, minutes] = String(time || '0:0').split(':').map(Number);
  return hours * 60 + minutes;
};

const pad = (value: number) => String(value).padStart(2, '0');

const addMinutesToTime = (time: string, minutes: number) => {
  const total = Math.min(23 * 60 + 59, toMinutes(time) + minutes);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

/** Tuesday-based week containing the supplied ISO date, matching the staffing week. */
const weekRange = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDay();
  const offset = (day + 5) % 7; // Tuesday = 0
  const start = addDaysISO(iso, -offset);
  return { start, end: addDaysISO(start, 5) };
};

export default function ProfessionalTimesheets() {
  useDocumentTitle('Timesheets');
  const { data, loading, error, reload } = useApi<any>('/professional/timesheets');
  const assignmentsApi = useApi<any>('/professional/assignments');
  const { busy, run } = useAction();
  const [filter, setFilter] = useState<Filter>('all');
  const [form, setForm] = useState({
    assignmentId: '',
    workDate: todayISO(),
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: '60',
    notes: ''
  });

  const assignments = (assignmentsApi.data?.assignments || []).filter((assignment: any) =>
    ['active', 'awaiting_approval'].includes(assignment.status)
  );

  useEffect(() => {
    if (!form.assignmentId && assignments.length) {
      const first = assignments[0];
      setForm((current) => ({
        ...current,
        assignmentId: first.id,
        startTime: first.dailyStart || '09:00',
        endTime: addMinutesToTime(first.dailyStart || '09:00', (first.shiftHours || 8) * 60 + 60)
      }));
    }
  }, [assignments, form.assignmentId]);

  const timesheets = data?.timesheets || [];
  const filtered = useMemo(
    () => timesheets.filter((entry: any) => filter === 'all' || entry.status === filter),
    [timesheets, filter]
  );

  if (loading) return <Loading label="Loading your timesheets." />;
  if (error) return <Alert tone="danger" title="Could not load timesheets">{error}</Alert>;

  const approvedHours = timesheets.filter((entry: any) => entry.status === 'approved').reduce((sum: number, entry: any) => sum + Number(entry.hours_worked), 0);
  const submittedHours = timesheets.filter((entry: any) => entry.status === 'submitted').reduce((sum: number, entry: any) => sum + Number(entry.hours_worked), 0);
  const rejected = timesheets.filter((entry: any) => entry.status === 'rejected').length;
  const week = weekRange(form.workDate);
  const weekHours = timesheets
    .filter((entry: any) => entry.status !== 'rejected' && entry.work_date >= week.start && entry.work_date <= week.end)
    .reduce((sum: number, entry: any) => sum + Number(entry.hours_worked), 0);

  const setValue = (key: string) => (event: any) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const chooseAssignment = (event: any) => {
    const assignment = assignments.find((item: any) => item.id === event.target.value);
    setForm((current) => ({
      ...current,
      assignmentId: event.target.value,
      startTime: assignment?.dailyStart || current.startTime,
      endTime: assignment ? addMinutesToTime(assignment.dailyStart || '09:00', (assignment.shiftHours || 8) * 60 + 60) : current.endTime
    }));
  };

  const submit = () =>
    run('log-time', async () => {
      if (!form.assignmentId) throw new Error('Choose an active assignment first.');
      const result = await api<any>('/professional/timesheets', {
        method: 'POST',
        body: {
          assignmentId: form.assignmentId,
          workDate: form.workDate,
          startTime: form.startTime,
          endTime: form.endTime,
          breakMinutes: Number(form.breakMinutes),
          notes: form.notes || undefined
        }
      });
      setForm((current) => ({ ...current, notes: '' }));
      reload();
      return result;
    }, 'Time submitted for employer approval.');

  const selectedAssignment = assignments.find((item: any) => item.id === form.assignmentId);

  return (
    <>
      <PageHeader
        title="Timesheets"
        eyebrow="Attendance & hours"
        description="Log productive hours against an active assignment. Compliance checks run before an entry is saved, including breaks, weekly caps and overlaps with any other employer."
        actions={<Badge tone="info"><Icon name="shield-check" className="icon-sm" /> Policy-checked</Badge>}
      />

      <div className="grid grid-4">
        <Stat label="Approved hours" value={`${approvedHours.toFixed(1)}h`} sub="Counted toward your verified record" icon="check-circle" tone="success" />
        <Stat label="Awaiting approval" value={`${submittedHours.toFixed(1)}h`} sub={`${timesheets.filter((entry: any) => entry.status === 'submitted').length} submitted entries`} icon="clock" tone="warning" />
        <Stat label="This week" value={`${weekHours.toFixed(1)}h`} sub="All non-rejected entries · cap 48h" icon="calendar" />
        <Stat label="Needs attention" value={rejected} sub="Rejected entries can be corrected" icon="alert-circle" tone={rejected ? 'warning' : 'success'} />
      </div>

      <div className="split" style={{ marginTop: 26 }}>
        <div className="stack-lg">
          <Card>
            <CardHeader
              title="Log time"
              subtitle="One honest entry per attendance window. Breaks are unpaid within the paid-hours model but must still be recorded."
            />
            {assignments.length ? (
              <>
                <div className="form-grid">
                  <Field label="Assignment" htmlFor="ts-assignment" required className="span-2">
                    <Select id="ts-assignment" value={form.assignmentId} onChange={chooseAssignment}>
                      {assignments.map((assignment: any) => (
                        <option key={assignment.id} value={assignment.id}>
                          {assignment.title} · {assignment.employer} ({assignment.code})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Work date" htmlFor="ts-date" required hint="Sunday and Monday are compulsory off days.">
                    <Input id="ts-date" type="date" value={form.workDate} max={todayISO()} onChange={setValue('workDate')} />
                  </Field>
                  <Field label="Break minutes" htmlFor="ts-break" required hint="At least 60 minutes for shifts over six hours.">
                    <Input id="ts-break" type="number" min={0} max={180} step={5} value={form.breakMinutes} onChange={setValue('breakMinutes')} />
                  </Field>
                  <Field label="Start time" htmlFor="ts-start" required>
                    <Input id="ts-start" type="time" value={form.startTime} onChange={setValue('startTime')} />
                  </Field>
                  <Field label="End time" htmlFor="ts-end" required>
                    <Input id="ts-end" type="time" value={form.endTime} onChange={setValue('endTime')} />
                  </Field>
                  <Field label="Notes for your manager" htmlFor="ts-notes" className="span-2" hint="Optional. Describe deliverables completed or anything that affected the day.">
                    <Textarea id="ts-notes" value={form.notes} maxLength={500} onChange={setValue('notes')} style={{ minHeight: 80 }} />
                  </Field>
                </div>
                {selectedAssignment ? (
                  <div className="chips" style={{ marginTop: 14 }}>
                    <span className="chip"><Icon name="calendar" className="icon-sm" /> {(selectedAssignment.workingDays || []).join(' · ') || 'No days set'}</span>
                    <span className="chip"><Icon name="clock" className="icon-sm" /> {selectedAssignment.shiftHours}h shift</span>
                    <span className="chip"><Icon name="rupee" className="icon-sm" /> {inr(selectedAssignment.hourlyRatePaise)}/hour</span>
                  </div>
                ) : null}
                <div className="form-actions">
                  <Button onClick={submit} loading={busy === 'log-time'} disabled={!form.assignmentId}>Submit timesheet</Button>
                </div>
              </>
            ) : (
              <EmptyState
                icon="briefcase"
                title="No active assignment"
                description="Time can only be logged against an active or awaiting-approval assignment. Accept a contract to start."
              />
            )}
          </Card>
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="Compliance rules" subtitle="Applied automatically to every entry." />
            <div className="stack-sm">
              {[
                'Shift lengths are 8, 10 or 12 productive hours.',
                'Maximum 12 hours per day and 48 hours per week.',
                'At least 60 minutes of breaks above six hours.',
                'Sunday and Monday are compulsory off days.',
                'Overlaps with any employer are blocked.',
                'Only days in the assignment contract can be logged.'
              ].map((rule) => (
                <div className="row" key={rule} style={{ alignItems: 'flex-start' }}>
                  <Icon name="check-circle" className="icon-sm text-success" />
                  <span className="tiny">{rule}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="card-pad">
            <CardHeader title="This staffing week" subtitle={`${dateLabel(week.start)} – ${dateLabel(week.end)}`} />
            <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 750 }}>{weekHours.toFixed(1)}</span>
              <span className="tiny muted">of 48 hours logged</span>
            </div>
            <div className="progress" style={{ marginTop: 10 }} role="progressbar" aria-valuenow={Math.round((weekHours / 48) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar" style={{ width: `${Math.min(100, (weekHours / 48) * 100)}%` }} />
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              The staffing week runs Tuesday to Saturday. Sunday and Monday work is never accepted.
            </p>
          </Card>

          <Alert tone="info" title="Approval & pay">
            Approved hours feed the employer's financial centre. Payments are split 50% advance and 50% on completion;
            the ₹699 activation fee is deducted once, from the first payout only.
          </Alert>
        </div>
      </div>

      <Card style={{ marginTop: 26 }}>
        <CardHeader title="Timesheet history" subtitle="The last 60 entries across all your assignments." />
        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'all', label: 'All', count: timesheets.length },
            { key: 'submitted', label: 'Submitted', count: timesheets.filter((entry: any) => entry.status === 'submitted').length },
            { key: 'approved', label: 'Approved', count: timesheets.filter((entry: any) => entry.status === 'approved').length },
            { key: 'rejected', label: 'Rejected', count: rejected }
          ]}
        />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Assignment</th><th>Window</th><th>Break</th><th>Hours</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((entry: any) => (
                <tr key={entry.id}>
                  <td>
                    <div className="list-title">{dateLabel(entry.work_date)}</div>
                    {entry.notes ? <div className="tiny muted truncate" title={entry.notes}>{entry.notes}</div> : null}
                  </td>
                  <td>
                    <div>{entry.title}</div>
                    <div className="tiny muted">{entry.org_name} · {entry.code}</div>
                  </td>
                  <td className="mono tiny">{entry.start_at}–{entry.end_at}</td>
                  <td className="num">{entry.break_minutes}m</td>
                  <td className="num"><strong>{Number(entry.hours_worked).toFixed(2)}</strong></td>
                  <td><StatusBadge status={entry.status} /></td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="table-empty">No timesheets in this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="portal-section">
        <SectionTitle title="Need a correction?" sub="Rejected entries remain visible so the record stays honest. Re-submit a corrected attendance window, or contact support if the assignment dates are wrong." />
        <Alert tone="neutral">
          Timesheet disputes are handled through the Flamingo support team. Every approval, rejection and correction is
          written to the audit log with the reviewer's identity and a timestamp.
        </Alert>
      </div>
    </>
  );
}
