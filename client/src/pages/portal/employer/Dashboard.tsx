import { Link } from 'react-router-dom';
import {
  Alert, Badge, Card, CardHeader, EmptyState, Icon, Loading, PageHeader,
  Stat, StatusBadge
} from '../../../components/ui';
import { QuickLink, SectionTitle } from '../../../components/portal/PortalKit';
import { dateLabel, dateTimeLabel, inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

export default function EmployerDashboard() {
  useDocumentTitle('Employer overview');
  const { data, loading, error } = useApi<any>('/employer/dashboard');

  if (loading) return <Loading label="Loading your hiring workspace." />;
  if (error) return <Alert tone="danger" title="Could not load your overview">{error}</Alert>;
  if (!data) return null;

  const { employer, stats, requirements, assignments, shortlist, pendingTimesheets, upcomingInterviews, invoices, verification } = data;
  const activeAssignments = assignments.filter((assignment: any) => ['active', 'not_started', 'awaiting_approval'].includes(assignment.status));

  return (
    <>
      <PageHeader
        title={`${employer.orgName}`}
        eyebrow="Employer workspace"
        description="Verified hiring, contracts, timesheets and money in one place. Shortlisting and hiring are unlocked only after organisation verification."
        actions={
          <>
            <Link className="btn btn-secondary" to="/portal/employer/talent">Find talent</Link>
            <Link className="btn btn-primary" to="/portal/employer/requirements">New requirement <Icon name="plus" className="icon-sm" /></Link>
          </>
        }
      />

      {verification.status !== 'verified' ? (
        <Alert tone="warning" title="Organisation verification pending">
          {verification.note} <Link to="/portal/employer/profile">Complete your company profile and documents</Link>.
        </Alert>
      ) : (
        <Alert tone="success" title="Organisation verified">
          {verification.note}
        </Alert>
      )}

      <div className="grid grid-4" style={{ marginTop: 20 }}>
        <Stat label="Open requirements" value={stats.openRequirements} sub={`${requirements.length} total`} icon="file-text" />
        <Stat label="Shortlisted" value={stats.shortlisted} sub="Candidates in your pipeline" icon="users" tone="success" />
        <Stat label="Active assignments" value={stats.activeAssignments} sub="In progress or awaiting activation" icon="briefcase" />
        <Stat label="Pending timesheets" value={stats.pendingTimesheets} sub={`${stats.upcomingInterviews} upcoming interviews`} icon="clock" tone={stats.pendingTimesheets ? 'warning' : 'success'} />
      </div>

      <div className="split" style={{ marginTop: 26 }}>
        <div className="stack-lg">
          <Card>
            <CardHeader
              title="Active engagements"
              subtitle="Contracts you have offered or are currently running."
              actions={<Link className="btn btn-secondary btn-sm" to="/portal/employer/assignments">All assignments</Link>}
            />
            {activeAssignments.length ? (
              <div className="list">
                {activeAssignments.map((assignment: any) => (
                  <div className="list-row" key={assignment.id}>
                    <span className="icon-tile navy sm"><Icon name="briefcase" /></span>
                    <div className="list-main">
                      <div className="list-title">{assignment.title}</div>
                      <div className="list-sub">{assignment.professional_name} · {assignment.code} · {inr(assignment.total_value_paise)}</div>
                    </div>
                    <div className="list-side">
                      <StatusBadge status={assignment.status} />
                      <div className="tiny muted" style={{ marginTop: 4 }}>{dateLabel(assignment.start_date)}</div>
                    </div>
                    <Link className="btn btn-secondary btn-sm" to={`/portal/employer/assignments/${assignment.id}`}>Open</Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="briefcase" title="No active assignments" description="Shortlist a verified professional, complete two interview rounds, then create a contract." action={<Link className="btn btn-primary" to="/portal/employer/talent">Search talent</Link>} />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Timesheets awaiting approval"
              subtitle="Approving keeps the professional's record accurate and unlocks payment milestones."
              actions={<Link className="btn btn-secondary btn-sm" to="/portal/employer/timesheets">Review all</Link>}
            />
            {pendingTimesheets.length ? (
              <div className="table-wrap">
                <table className="table table-compact">
                  <thead><tr><th>Date</th><th>Professional</th><th>Assignment</th><th>Hours</th><th className="actions">Action</th></tr></thead>
                  <tbody>
                    {pendingTimesheets.slice(0, 6).map((entry: any) => (
                      <tr key={entry.id}>
                        <td>{dateLabel(entry.work_date)}</td>
                        <td>{entry.professional_name}</td>
                        <td>{entry.title}</td>
                        <td className="num">{entry.hours_worked}</td>
                        <td className="actions"><Link className="btn btn-secondary btn-sm" to="/portal/employer/timesheets">Review</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted small">Nothing waiting. All submitted time has been reviewed.</p>}
          </Card>

          <Card>
            <CardHeader
              title="Open requirements"
              subtitle="Structured briefs that keep rates and schedules compliant."
              actions={<Link className="btn btn-secondary btn-sm" to="/portal/employer/requirements">Manage</Link>}
            />
            {requirements.length ? (
              <div className="list">
                {requirements.slice(0, 5).map((requirement: any) => (
                  <div className="list-row" key={requirement.id}>
                    <span className="icon-tile sm"><Icon name="file-text" /></span>
                    <div className="list-main">
                      <div className="list-title">{requirement.title}</div>
                      <div className="list-sub">
                        {titleCase(requirement.category)} · {requirement.hours_per_week}h/week · {requirement.working_days?.replace(/[\[\]"]/g, '').replace(/,/g, ' · ')}
                      </div>
                    </div>
                    <div className="list-side">
                      <StatusBadge status={requirement.status} />
                      <div className="tiny muted" style={{ marginTop: 4 }}>{inr(requirement.budget_hourly_paise)}/h</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted small">No requirements yet. Create one to describe the work before searching.</p>}
          </Card>
        </div>

        <div className="stack">
          <Card className="card-pad">
            <div className="between">
              <CardHeader title="Upcoming interviews" />
              <Badge tone="info">{upcomingInterviews.length}</Badge>
            </div>
            {upcomingInterviews.length ? upcomingInterviews.map((interview: any) => (
              <div key={interview.id} style={{ marginTop: 12 }}>
                <div className="between">
                  <strong className="small">{interview.professional_name}</strong>
                  <Badge tone={interview.round === 1 ? 'info' : 'brand'}>Round {interview.round}</Badge>
                </div>
                <div className="tiny muted">{dateTimeLabel(interview.scheduled_at)} · {interview.duration_minutes} min</div>
              </div>
            )) : <p className="muted small" style={{ marginTop: 8 }}>No interviews scheduled.</p>}
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/employer/interviews" style={{ marginTop: 12 }}>Interview centre</Link>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Shortlist" subtitle="Verified candidates only." />
            {shortlist.length ? (
              <div className="stack">
                {shortlist.slice(0, 4).map((candidate: any) => (
                  <div className="between" key={candidate.shortlistId} style={{ gap: 8 }}>
                    <div className="grow">
                      <div className="list-title">{candidate.name}</div>
                      <div className="tiny muted">
                        {[candidate.category ? titleCase(candidate.category) : null, candidate.yearsExperience ? `${candidate.yearsExperience} yrs` : null].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <Badge tone="outline">{inr(candidate.hourlyRatePaise)}/h</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="muted small">No shortlisted candidates yet.</p>}
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/employer/shortlist" style={{ marginTop: 12 }}>Open shortlist</Link>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Hiring health" />
            <div className="kv">
              <div className="kv-row"><span className="kv-key">Captured spend</span><span className="kv-val strong">{inr(stats.capturedSpendPaise)}</span></div>
              <div className="kv-row"><span className="kv-key">Total assignments</span><span className="kv-val">{assignments.length}</span></div>
              <div className="kv-row"><span className="kv-key">Invoices</span><span className="kv-val">{invoices.length}</span></div>
              <div className="kv-row"><span className="kv-key">Verification</span><span className="kv-val"><StatusBadge status={verification.status} /></span></div>
            </div>
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/employer/finance" style={{ marginTop: 10 }}>Financial centre</Link>
          </Card>

          <Alert tone="info" title="Fair hiring">
            Flamingo permits a maximum of two interview rounds. Shortlisting releases candidate contact details only to
            your verified organisation, and every access is audited.
          </Alert>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Your hiring path" sub="Four steps from brief to paid engagement." />
        <div className="grid grid-4">
          <QuickLink to="/portal/employer/requirements" icon="file-text" title="1. Define the work" sub="Scope, rate, schedule and deliverables." />
          <QuickLink to="/portal/employer/talent" icon="search" title="2. Find verified talent" sub="Filter by evidence and availability." />
          <QuickLink to="/portal/employer/interviews" icon="video" title="3. Interview twice" sub="Panel round, then final discussion." />
          <QuickLink to="/portal/employer/assignments" icon="briefcase" title="4. Contract & pay" sub="50% advance, 50% on completion." />
        </div>
      </div>
    </>
  );
}
