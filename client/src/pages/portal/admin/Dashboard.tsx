import { Link, Navigate } from 'react-router-dom';
import {
  Alert, Badge, Card, CardHeader, Icon, Loading, PageHeader, Stat, StatusBadge
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { useAuth } from '../../../context/AuthContext';
import { dateLabel, inr, relativeTime, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

export default function AdminDashboard() {
  useDocumentTitle('Administration overview');
  const { adminPermissions } = useAuth();
  const can = (permission: string) =>
    adminPermissions.includes('*') || adminPermissions.includes(permission);
  const permitted = can('users.view');
  const { data, loading, error } = useApi<any>(permitted ? '/admin/dashboard' : null);

  if (!permitted) {
    if (can('finance.view')) return <Navigate to="/portal/admin/finance" replace />;
    if (can('reports.view')) return <Navigate to="/portal/admin/reports" replace />;
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>
          Your administrator role does not include the platform overview. Use the navigation to reach the areas you
          are responsible for.
        </p>
      </Card>
    );
  }

  if (loading) return <Loading label="Loading the administration overview." />;
  if (error) return <Alert tone="danger" title="Could not load the overview">{error}</Alert>;
  if (!data) return null;

  const { admin, stats, queues, recentAudit } = data;

  return (
    <>
      <PageHeader
        title="Platform overview"
        eyebrow={`Signed in as ${titleCase(admin.role)}`}
        description="Verification, assessment review, money movement and platform health. Every action taken here is written to the audit log."
      />

      <Alert tone="info" title="Demonstration environment">
        Queues, payments and payouts are seeded demonstration records. Identity checks are simulated and no live money
        moves. Decisions made here are recorded but do not affect a live marketplace.
      </Alert>

      <div className="grid grid-4" style={{ marginTop: 20 }}>
        <Stat label="Pending professionals" value={stats.pendingProfessionals} sub="Identity and experience review" icon="shield-check" tone={stats.pendingProfessionals ? 'warning' : 'success'} />
        <Stat label="Pending employers" value={stats.pendingEmployers} sub="Organisation verification" icon="building" tone={stats.pendingEmployers ? 'warning' : 'success'} />
        <Stat label="Assessment review" value={stats.assessmentQueue} sub="Practical answers awaiting a human" icon="award" tone={stats.assessmentQueue ? 'warning' : 'success'} />
        <Stat label="Open disputes" value={stats.openDisputes} sub="Payment, review and conduct cases" icon="scale" tone={stats.openDisputes ? 'warning' : 'success'} />
      </div>

      <div className="grid grid-4" style={{ marginTop: 14 }}>
        <Stat label="Active assignments" value={stats.activeAssignments} sub="In progress or awaiting approval" icon="briefcase" />
        <Stat label="Captured payments" value={inr(stats.capturedPaise, { compact: true })} sub="Simulated gateway" icon="credit-card" />
        <Stat label="Activation revenue" value={inr(stats.activationRevenuePaise, { compact: true })} sub="GST-exclusive base on deducted fees" icon="rupee" />
        <Stat label="Pending payouts" value={inr(stats.pendingPayoutsPaise, { compact: true })} sub="Pending or processing" icon="wallet" tone={stats.pendingPayoutsPaise ? 'warning' : 'success'} />
      </div>

      <div className="split" style={{ marginTop: 26 }}>
        <div className="stack-lg">
          <Card>
            <CardHeader
              title="Professional verification queue"
              subtitle="Oldest submissions first. Approving verification does not publish a profile."
              actions={<Link className="btn btn-secondary btn-sm" to="/portal/admin/verifications">Open queue</Link>}
            />
            {queues.verificationQueue.length ? (
              <div className="list">
                {queues.verificationQueue.map((row: any) => (
                  <div className="list-row" key={row.id}>
                    <span className="icon-tile sm"><Icon name="user" /></span>
                    <div className="list-main">
                      <div className="list-title">{row.name}</div>
                      <div className="list-sub">{row.headline} · {titleCase(row.category)} · {row.years_experience} yrs</div>
                    </div>
                    <div className="list-side">
                      <StatusBadge status={row.verification_status} />
                      <div className="tiny muted" style={{ marginTop: 4 }}>{dateLabel(row.created_at)}</div>
                    </div>
                    <Link className="btn btn-secondary btn-sm" to="/portal/admin/verifications">Review</Link>
                  </div>
                ))}
              </div>
            ) : <p className="muted small">No professional profiles are waiting.</p>}
          </Card>

          <Card>
            <CardHeader
              title="Employer verification queue"
              subtitle="Shortlisting and hiring stay locked until the organisation is verified."
              actions={<Link className="btn btn-secondary btn-sm" to="/portal/admin/verifications?tab=employers">Open queue</Link>}
            />
            {queues.employerQueue.length ? (
              <div className="list">
                {queues.employerQueue.map((row: any) => (
                  <div className="list-row" key={row.id}>
                    <span className="icon-tile navy sm"><Icon name="building" /></span>
                    <div className="list-main">
                      <div className="list-title">{row.org_name}</div>
                      <div className="list-sub">{row.name} · {row.city || 'City not set'}</div>
                    </div>
                    <div className="list-side">
                      <StatusBadge status={row.verification_status} />
                      <div className="tiny muted" style={{ marginTop: 4 }}>{dateLabel(row.created_at)}</div>
                    </div>
                    <Link className="btn btn-secondary btn-sm" to="/portal/admin/verifications?tab=employers">Review</Link>
                  </div>
                ))}
              </div>
            ) : <p className="muted small">No employer profiles are waiting.</p>}
          </Card>
        </div>

        <div className="stack">
          <Card className="card-pad">
            <div className="between">
              <CardHeader title="Open disputes" />
              <Badge tone={stats.openDisputes ? 'warning' : 'success'}>{stats.openDisputes}</Badge>
            </div>
            {queues.disputes.length ? queues.disputes.map((dispute: any) => (
              <div key={dispute.id} style={{ marginTop: 12 }}>
                <div className="between">
                  <strong className="small">{titleCase(dispute.category)}</strong>
                  <StatusBadge status={dispute.status} />
                </div>
                <div className="tiny muted">{dispute.raised_by_name} · {dateLabel(dispute.created_at)}</div>
                <div className="tiny" style={{ marginTop: 4 }}>{dispute.description}</div>
              </div>
            )) : <p className="muted small" style={{ marginTop: 8 }}>No open disputes.</p>}
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/admin/disputes" style={{ marginTop: 12 }}>Dispute centre</Link>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Finance controls" subtitle="Reconciliation and payout release." />
            <div className="kv">
              <div className="kv-row"><span className="kv-key">Captured</span><span className="kv-val strong">{inr(stats.capturedPaise)}</span></div>
              <div className="kv-row"><span className="kv-key">Activation base</span><span className="kv-val">{inr(stats.activationRevenuePaise)}</span></div>
              <div className="kv-row"><span className="kv-key">Pending payouts</span><span className="kv-val">{inr(stats.pendingPayoutsPaise)}</span></div>
            </div>
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/admin/finance" style={{ marginTop: 10 }}>Financial centre</Link>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Recent audit activity" subtitle="Immutable platform record." />
            <div className="stack-sm">
              {recentAudit.slice(0, 6).map((entry: any) => (
                <div key={entry.id} className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <div className="tiny strong">{titleCase(entry.action)}</div>
                    <div className="tiny muted">{entry.actor_role || 'system'} · {relativeTime(entry.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/admin/audit" style={{ marginTop: 10 }}>Full audit log</Link>
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: 26 }}>
        <CardHeader
          title="Assessment review queue"
          subtitle="Practical answers require human judgement against the published rubric."
          actions={<Link className="btn btn-secondary btn-sm" to="/portal/admin/assessments">Open queue</Link>}
        />
        {queues.reviewQueue.length ? (
          <div className="table-wrap">
            <table className="table table-compact">
              <thead><tr><th>Professional</th><th>Assessment</th><th>Auto score</th><th>Integrity</th><th>Submitted</th><th className="actions">Action</th></tr></thead>
              <tbody>
                {queues.reviewQueue.map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.professional_name}</td>
                    <td>{row.title}</td>
                    <td className="num">{row.auto_score ?? '—'}</td>
                    <td className="num">{row.integrity_score}</td>
                    <td>{dateLabel(row.submitted_at)}</td>
                    <td className="actions"><Link className="btn btn-secondary btn-sm" to="/portal/admin/assessments">Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted small">No attempts are awaiting human review.</p>}
        <Alert tone="warning" title="Integrity signals are review prompts only">
          Focus loss and paste events are never treated as proof of AI-assisted work or misconduct. Score the work
          itself against the rubric.
        </Alert>
      </Card>

      <div className="portal-section">
        <SectionTitle title="Operating principles" sub="Controls that administrators should not bypass." />
        <div className="grid grid-3">
          <Card className="card-pad">
            <span className="icon-tile green sm"><Icon name="shield-check" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Human decisions</strong>
            <p className="tiny muted">Verification and assessment outcomes are made by a person with written notes. No automated rejection.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile navy sm"><Icon name="scale" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Two interview rounds</strong>
            <p className="tiny muted">A contract requires a completed final round with a selected outcome. The limit is enforced by the API.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile gold sm"><Icon name="rupee" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Disclosed money</strong>
            <p className="tiny muted">The ₹699 activation fee is deducted once from the first payout. GST and platform fees are itemised.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
