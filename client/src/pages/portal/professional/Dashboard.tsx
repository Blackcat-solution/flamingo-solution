import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Icon, Loading, PageHeader, Progress,
  Stat, StatusBadge
} from '../../../components/ui';
import { QuickLink, SectionTitle } from '../../../components/portal/PortalKit';
import { useAuth } from '../../../context/AuthContext';
import { dateLabel, dateTimeLabel, inr, statusTone } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

export default function ProfessionalDashboard() {
  const { user } = useAuth();
  useDocumentTitle('Professional overview');
  const { data, loading, error } = useApi<any>('/professional/dashboard');

  if (loading) return <Loading label="Loading your workspace." />;
  if (error) return <Alert tone="danger" title="Could not load your overview">{error}</Alert>;
  if (!data) return null;

  const { profile, completeness, assignments, activeAssignments, timesheets, payouts, upcomingInterview, latestActivationFee, earnings, settings } = data;
  const completeCount = completeness.checks.filter((check: any) => check.complete).length;
  const totalChecks = completeness.checks.length;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'}.`}
        description="Your verified record, active work and money in one place. Keep your availability current so employers can schedule accurately."
        eyebrow="Professional workspace"
        actions={
          <>
            <Link className="btn btn-secondary" to="/portal/professional/profile">Edit profile</Link>
            <Link className="btn btn-primary" to="/portal/professional/assessments">Assessments <Icon name="arrow-right" className="icon-sm" /></Link>
          </>
        }
      />

      <div className="grid grid-4">
        <Stat label="Lifetime net received" value={inr(earnings.lifetimeNetPaise)} sub="Settled payouts" icon="wallet" tone="success" />
        <Stat label="Pending payouts" value={inr(earnings.pendingNetPaise)} sub="Pending or processing" icon="clock" tone="warning" />
        <Stat label="Active assignments" value={activeAssignments.length} sub={`${assignments.length} total engagements`} icon="briefcase" />
        <Stat label="Activation fees" value={inr(earnings.activationFeesPaise)} sub="Deducted once per activated assignment" icon="percent" />
      </div>

      <div className="split" style={{ marginTop: 26 }}>
        <div className="stack-lg">
          <Card>
            <CardHeader
              title="Profile readiness"
              subtitle={`${completeCount} of ${totalChecks} requirements complete`}
              actions={<Badge tone={completeness.complete ? 'success' : 'warning'}>{completeness.complete ? 'Ready to submit' : 'Action needed'}</Badge>}
            />
            <Progress value={completeCount} max={totalChecks} label="Completeness" meta={`${Math.round((completeCount / totalChecks) * 100)}%`} />
            <div className="grid grid-2" style={{ marginTop: 18 }}>
              {completeness.checks.map((check: any) => (
                <div className="row" key={check.key} style={{ alignItems: 'flex-start' }}>
                  <Icon name={check.complete ? 'check-circle' : 'alert-circle'} className={check.complete ? 'text-success icon-sm' : 'text-warning icon-sm'} />
                  <span className="tiny" style={{ color: check.complete ? 'var(--muted)' : 'var(--ink)' }}>{check.label}</span>
                </div>
              ))}
            </div>
            <div className="row wrap" style={{ marginTop: 18 }}>
              <Link className="btn btn-secondary btn-sm" to="/portal/professional/profile">Complete profile</Link>
              {profile.profileStatus === 'draft' || profile.verificationStatus === 'pending' || profile.verificationStatus === 'in_review' ? (
                <span className="tiny muted">Verification status: {profile.verificationStatus.replace('_', ' ')}</span>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Active & upcoming work"
              subtitle="Assignments currently in progress or awaiting activation."
              actions={<Link className="btn btn-secondary btn-sm" to="/portal/professional/assignments">All assignments</Link>}
            />
            {activeAssignments.length ? (
              <div className="list">
                {activeAssignments.map((assignment: any) => (
                  <div className="list-row" key={assignment.id}>
                    <span className="icon-tile navy sm"><Icon name="briefcase" /></span>
                    <div className="list-main">
                      <div className="list-title">{assignment.title}</div>
                      <div className="list-sub">{assignment.org_name} · {assignment.code} · {assignment.working_days?.replace(/[\[\]"]/g, '').replace(/,/g, ' · ')}</div>
                    </div>
                    <div className="list-side">
                      <StatusBadge status={assignment.status} />
                      <div className="tiny muted" style={{ marginTop: 4 }}>{dateLabel(assignment.start_date)}</div>
                    </div>
                    <Link className="btn btn-secondary btn-sm" to={`/portal/professional/assignments/${assignment.id}`}>Open</Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="search" title="No active assignments" description="Browse the marketplace and keep your profile ready for employer shortlists." action={<Link className="btn btn-primary" to="/professionals">Browse marketplace</Link>} />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent timesheets"
              subtitle="First week of the month, approved and pending."
              actions={<Link className="btn btn-secondary btn-sm" to="/portal/professional/timesheets">Log time</Link>}
            />
            <div className="table-wrap">
              <table className="table table-compact">
                <thead><tr><th>Date</th><th>Assignment</th><th>Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {timesheets.length ? timesheets.map((entry: any) => (
                    <tr key={entry.id}>
                      <td>{dateLabel(entry.work_date)}</td>
                      <td>{entry.title}</td>
                      <td className="num">{entry.hours_worked}</td>
                      <td><StatusBadge status={entry.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={4} className="table-empty">No time logged yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="stack">
          {upcomingInterview ? (
            <Card className="card-pad">
              <div className="between">
                <Badge tone="info">Upcoming interview</Badge>
                <span className="tiny muted">{dateTimeLabel(upcomingInterview.scheduled_at)}</span>
              </div>
              <h3 className="card-title" style={{ marginTop: 12 }}>{upcomingInterview.org_name}</h3>
              <p className="page-sub">Round {upcomingInterview.round} · {upcomingInterview.duration_minutes} minutes · Video</p>
              <a className="btn btn-primary btn-block" href={upcomingInterview.meeting_url} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
                <Icon name="video" className="icon-sm" /> Join meeting room
              </a>
              <p className="tiny muted" style={{ marginTop: 8 }}>The meeting link is simulated in this demonstration.</p>
            </Card>
          ) : (
            <Card className="card-pad">
              <div className="row"><span className="icon-tile"><Icon name="video" /></span><strong>Interviews</strong></div>
              <p className="page-sub" style={{ marginTop: 8 }}>No upcoming interview. Employers can schedule a maximum of two rounds after shortlisting you.</p>
              <Link className="btn btn-secondary btn-sm" to="/portal/professional/interviews" style={{ marginTop: 10 }}>View interview history</Link>
            </Card>
          )}

          <Card className="card-pad">
            <div className="between">
              <div className="row"><span className="icon-tile gold sm"><Icon name="award" /></span><strong>Assessment</strong></div>
              <StatusBadge status={profile.assessmentStatus} />
            </div>
            <p className="page-sub" style={{ marginTop: 8 }}>
              {profile.assessmentStatus === 'passed'
                ? 'You have passed a Flamingo assessment and can publish once verification is complete.'
                : 'A practical, human-reviewed assessment is required before your profile can become public.'}
            </p>
            <Link className="btn btn-secondary btn-sm" to="/portal/professional/assessments" style={{ marginTop: 10 }}>
              {profile.assessmentStatus === 'passed' ? 'View result' : 'Start assessment'}
            </Link>
          </Card>

          <Card className="card-pad">
            <div className="between">
              <CardHeader title="Working pattern" />
              <Link className="tiny strong text-brand" to="/portal/professional/profile">Change</Link>
            </div>
            <div className="kv" style={{ marginTop: 6 }}>
              <div className="kv-row"><span className="kv-key">Shift</span><span className="kv-val">{profile.shiftHours} hours/day</span></div>
              <div className="kv-row"><span className="kv-key">Working days</span><span className="kv-val">{(profile.availability || []).join(' · ') || 'Not set'}</span></div>
              <div className="kv-row"><span className="kv-key">Window</span><span className="kv-val">{profile.preferredStart || '—'}–{profile.preferredEnd || '—'}</span></div>
              <div className="kv-row"><span className="kv-key">Weekly cap</span><span className="kv-val">{settings.maxWeeklyHours} hours</span></div>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>Sunday and Monday are compulsory off days. {settings.offDays?.join?.(' and ') || 'Sun + Mon'}.</p>
          </Card>

          {latestActivationFee ? (
            <Alert tone="warning" title="Activation fee disclosure">
              {inr(latestActivationFee.amount_paise)} is disclosed for your latest assignment and is deducted once from
              the first payout only. Status: {latestActivationFee.status}. No fee is charged if you decline before activation.
            </Alert>
          ) : null}

          <Card className="card-pad">
            <div className="row"><span className="icon-tile navy sm"><Icon name="wallet" /></span><strong>Money at a glance</strong></div>
            <div className="kv" style={{ marginTop: 10 }}>
              <div className="kv-row"><span className="kv-key">Settled</span><span className="kv-val">{inr(earnings.lifetimeNetPaise)}</span></div>
              <div className="kv-row"><span className="kv-key">Pending</span><span className="kv-val">{inr(earnings.pendingNetPaise)}</span></div>
              <div className="kv-row"><span className="kv-key">Fees deducted</span><span className="kv-val">{inr(earnings.activationFeesPaise)}</span></div>
            </div>
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/professional/finance" style={{ marginTop: 10 }}>Open financial centre</Link>
          </Card>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Next actions" sub="Shortcuts to the parts of your record that need attention." />
        <div className="grid grid-4">
          <QuickLink to="/portal/professional/profile" icon="user" title="Profile & documents" sub="Identity, experience and references." />
          <QuickLink to="/portal/professional/assessments" icon="award" title="Assessments" sub="Timed practical work and results." />
          <QuickLink to="/portal/professional/timesheets" icon="clock" title="Timesheets" sub="Log compliant hours and track approval." />
          <QuickLink to="/portal/professional/career" icon="trending-up" title="Career record" sub="Verified history that travels with you." />
        </div>
      </div>

      {payouts.length ? (
        <div className="portal-section">
          <SectionTitle title="Latest payouts" sub="Amounts shown net of the one-time activation fee where applicable." actions={<Link className="btn btn-secondary btn-sm" to="/portal/professional/finance">All payouts</Link>} />
          <Card>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Reference</th><th>Type</th><th>Gross</th><th>Fee</th><th>Net</th><th>Status</th></tr></thead>
                <tbody>
                  {payouts.map((payout: any) => (
                    <tr key={payout.id}>
                      <td className="mono">{payout.payout_ref}</td>
                      <td>{payout.type}</td>
                      <td className="num">{inr(payout.gross_paise)}</td>
                      <td className="num">{payout.activation_fee_paise ? `-${inr(payout.activation_fee_paise)}` : '—'}</td>
                      <td className="num"><strong>{inr(payout.net_paise)}</strong></td>
                      <td><StatusBadge status={payout.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
