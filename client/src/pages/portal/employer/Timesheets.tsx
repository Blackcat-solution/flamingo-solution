import { useMemo, useState } from 'react';
import {
  Alert, Button, Card, CardHeader, EmptyState, Field, Icon, Loading, Modal,
  PageHeader, Stat, StatusBadge, Tabs, Textarea
} from '../../../components/ui';
import { api } from '../../../lib/api';
import { dateLabel } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type Filter = 'submitted' | 'approved' | 'rejected' | 'all';

export default function EmployerTimesheets() {
  useDocumentTitle('Timesheets');
  const { data, loading, error, reload } = useApi<any>('/employer/timesheets');
  const { busy, run } = useAction();
  const [filter, setFilter] = useState<Filter>('submitted');
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [approving, setApproving] = useState<any | null>(null);
  const [approveNote, setApproveNote] = useState('');

  const timesheets = data?.timesheets || [];
  const filtered = useMemo(
    () => timesheets.filter((entry: any) => filter === 'all' || entry.status === filter),
    [timesheets, filter]
  );

  if (loading) return <Loading label="Loading timesheets." />;
  if (error) return <Alert tone="danger" title="Could not load timesheets">{error}</Alert>;

  const approve = () =>
    run('approve', async () => {
      if (!approving) return;
      await api(`/employer/timesheets/${approving.id}/approve`, {
        method: 'POST',
        body: { note: approveNote || undefined }
      });
      setApproving(null);
      setApproveNote('');
      reload();
    }, 'Timesheet approved.');

  const reject = () =>
    run('reject', async () => {
      if (!rejecting) return;
      await api(`/employer/timesheets/${rejecting.id}/reject`, {
        method: 'POST',
        body: { note: rejectNote }
      });
      setRejecting(null);
      setRejectNote('');
      reload();
    }, 'Timesheet rejected with a reason.');

  const submitted = timesheets.filter((entry: any) => entry.status === 'submitted');
  const approvedHours = timesheets.filter((entry: any) => entry.status === 'approved').reduce((sum: number, entry: any) => sum + Number(entry.hours_worked), 0);

  return (
    <>
      <PageHeader
        title="Timesheets"
        eyebrow="Attendance approval"
        description="Review submitted attendance windows against the agreed schedule. Approving keeps the professional’s verified record accurate and supports completion."
      />

      <div className="grid grid-4">
        <Stat label="Awaiting review" value={submitted.length} sub="Submitted by professionals" icon="clock" tone={submitted.length ? 'warning' : 'success'} />
        <Stat label="Approved hours" value={`${approvedHours.toFixed(1)}h`} sub="All engagements" icon="check-circle" tone="success" />
        <Stat label="Rejected" value={timesheets.filter((entry: any) => entry.status === 'rejected').length} sub="With written reasons" icon="x-circle" />
        <Stat label="Total entries" value={timesheets.length} sub="Latest 100" icon="list" />
      </div>

      <div style={{ marginTop: 22 }}>
        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'submitted', label: 'Awaiting review', count: submitted.length },
            { key: 'approved', label: 'Approved', count: timesheets.filter((entry: any) => entry.status === 'approved').length },
            { key: 'rejected', label: 'Rejected', count: timesheets.filter((entry: any) => entry.status === 'rejected').length },
            { key: 'all', label: 'All', count: timesheets.length }
          ]}
        />
      </div>

      <Card style={{ marginTop: 18 }}>
        <CardHeader title="Attendance entries" subtitle="Only submitted time can be approved or rejected." />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Professional</th><th>Assignment</th><th>Window</th><th>Break</th><th>Hours</th><th>Status</th><th className="actions">Action</th></tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((entry: any) => (
                <tr key={entry.id}>
                  <td>{dateLabel(entry.work_date)}</td>
                  <td>{entry.professional_name}</td>
                  <td>
                    <div className="list-title">{entry.title}</div>
                    <div className="tiny muted">{entry.code}</div>
                  </td>
                  <td className="mono tiny">{entry.start_at}–{entry.end_at}</td>
                  <td className="num">{entry.break_minutes}m</td>
                  <td className="num"><strong>{entry.hours_worked}</strong></td>
                  <td>
                    <StatusBadge status={entry.status} />
                    {entry.approval_note ? <div className="tiny muted" style={{ marginTop: 4, maxWidth: 180 }}>{entry.approval_note}</div> : null}
                  </td>
                  <td className="actions">
                    {entry.status === 'submitted' ? (
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <Button variant="secondary" size="sm" onClick={() => { setRejecting(entry); setRejectNote(''); }}>Reject</Button>
                        <Button size="sm" onClick={() => { setApproving(entry); setApproveNote(''); }}>Approve</Button>
                      </div>
                    ) : <span className="tiny muted">Reviewed</span>}
                  </td>
                </tr>
              )) : <tr><td colSpan={8} className="table-empty">No timesheets in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="portal-section">
        <div className="grid grid-3">
          <Card className="card-pad">
            <span className="icon-tile"><Icon name="clock" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Verify the window</strong>
            <p className="tiny muted">Check the date, start and end times, and the 60-minute break for shifts over six hours.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile green"><Icon name="check-circle" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Approve promptly</strong>
            <p className="tiny muted">Unreviewed time delays the professional’s record and can hold up completion.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile gold"><Icon name="message" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Explain rejections</strong>
            <p className="tiny muted">A written reason is required and is shared with the professional so they can correct it.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        title="Approve timesheet"
        subtitle={approving ? `${approving.professional_name} · ${dateLabel(approving.work_date)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(null)}>Cancel</Button>
            <Button onClick={approve} loading={busy === 'approve'}>Approve hours</Button>
          </>
        }
      >
        <Field label="Approval note" htmlFor="ts-approve-note" hint="Optional. Recorded against the entry.">
          <Textarea id="ts-approve-note" value={approveNote} maxLength={500} onChange={(event) => setApproveNote(event.target.value)} placeholder="Approved against the agreed weekly deliverables." />
        </Field>
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject timesheet"
        subtitle={rejecting ? `${rejecting.professional_name} · ${dateLabel(rejecting.work_date)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={reject} loading={busy === 'reject'} disabled={rejectNote.trim().length < 5}>Reject entry</Button>
          </>
        }
      >
        <Field label="Reason for rejection" htmlFor="ts-reject-note" required hint="At least 5 characters. The professional sees this reason.">
          <Textarea id="ts-reject-note" value={rejectNote} maxLength={500} onChange={(event) => setRejectNote(event.target.value)} placeholder="The logged window does not match the agreed 09:00–18:00 schedule." />
        </Field>
      </Modal>
    </>
  );
}
