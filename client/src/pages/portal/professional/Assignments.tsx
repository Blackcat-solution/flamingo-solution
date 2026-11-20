import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, EmptyState, Icon, Loading, PageHeader, StatusBadge, Tabs
} from '../../../components/ui';
import { api } from '../../../lib/api';
import { dateLabel, dayList, inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type Filter = 'all' | 'active' | 'offers' | 'completed';

export default function ProfessionalAssignments() {
  useDocumentTitle('Assignments');
  const { data, loading, error, reload } = useApi<any>('/professional/assignments');
  const [filter, setFilter] = useState<Filter>('all');
  const { busy, run } = useAction();

  if (loading) return <Loading label="Loading assignments." />;
  if (error) return <Alert tone="danger" title="Could not load assignments">{error}</Alert>;
  if (!data) return null;

  const assignments = data.assignments || [];
  const filtered = assignments.filter((assignment: any) => {
    if (filter === 'active') return ['active', 'not_started', 'awaiting_approval'].includes(assignment.status);
    if (filter === 'offers') return assignment.status === 'not_started' && !assignment.contractSignedProfessional;
    if (filter === 'completed') return ['completed', 'closed'].includes(assignment.status);
    return true;
  });

  const decline = (id: string) =>
    run(`decline-${id}`, async () => {
      await api(`/professional/assignments/${id}/decline`, { method: 'POST' });
      reload();
    }, 'Assignment declined. No activation fee was charged.');

  return (
    <>
      <PageHeader
        title="Assignments"
        eyebrow="Your engagements"
        description="Contracts, working patterns and activation-fee disclosure in one place. Scheduling conflicts are checked when you accept."
        actions={<Link className="btn btn-secondary" to="/professionals">Browse marketplace</Link>}
      />

      <Tabs<Filter>
        active={filter}
        onChange={setFilter}
        tabs={[
          { key: 'all', label: 'All', count: assignments.length },
          { key: 'offers', label: 'Offers', count: assignments.filter((a: any) => a.status === 'not_started' && !a.contractSignedProfessional).length },
          { key: 'active', label: 'Active', count: assignments.filter((a: any) => ['active', 'not_started', 'awaiting_approval'].includes(a.status)).length },
          { key: 'completed', label: 'Completed', count: assignments.filter((a: any) => ['completed', 'closed'].includes(a.status)).length }
        ]}
      />

      <div className="stack" style={{ marginTop: 20 }}>
        {filtered.length ? filtered.map((assignment: any) => (
          <Card key={assignment.id} className="card-pad">
            <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <Badge tone="outline">{assignment.code}</Badge>
                  <StatusBadge status={assignment.status} />
                  {!assignment.contractSignedProfessional && assignment.status !== 'cancelled' ? <Badge tone="warning">Awaiting your acceptance</Badge> : null}
                  {assignment.activationFeeCharged ? <Badge tone="success">Fee deducted</Badge> : <Badge tone="outline">Fee not yet charged</Badge>}
                </div>
                <h3 className="card-title" style={{ marginTop: 10 }}>{assignment.title}</h3>
                <div className="page-sub">{assignment.employer} · {titleCase(assignment.category)}</div>
                <div className="chips" style={{ marginTop: 10 }}>
                  <span className="chip"><Icon name="calendar" className="icon-sm" /> {dayList(assignment.workingDays)}</span>
                  <span className="chip"><Icon name="clock" className="icon-sm" /> {assignment.shiftHours}h shift · {assignment.hoursPerWeek}h/week</span>
                  <span className="chip"><Icon name="map-pin" className="icon-sm" /> {dateLabel(assignment.startDate)} – {dateLabel(assignment.endDate)}</span>
                  <span className="chip"><Icon name="rupee" className="icon-sm" /> {inr(assignment.hourlyRatePaise)}/hour</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="stat-label">Total value</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 750 }}>{inr(assignment.totalValuePaise)}</div>
                <div className="tiny muted">{assignment.estimatedHours} estimated hours</div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              {!assignment.contractSignedProfessional && assignment.status !== 'cancelled' && assignment.status !== 'completed' ? (
                <>
                  <Button variant="secondary" size="sm" onClick={() => decline(assignment.id)} loading={busy === `decline-${assignment.id}`}>Decline</Button>
                  <Link className="btn btn-secondary btn-sm" to={`/portal/professional/assignments/${assignment.id}`}>Review contract</Link>
                  <Link className="btn btn-primary btn-sm" to={`/portal/professional/assignments/${assignment.id}`}>Accept assignment <Icon name="arrow-right" className="icon-sm" /></Link>
                </>
              ) : (
                <Link className="btn btn-primary btn-sm" to={`/portal/professional/assignments/${assignment.id}`}>Open assignment</Link>
              )}
            </div>
          </Card>
        )) : (
          <EmptyState
            icon="briefcase"
            title={filter === 'all' ? 'No assignments yet' : `No ${filter} assignments`}
            description="When a verified employer shortlists and selects you, the contract and activation-fee disclosure appear here before you accept."
            action={<Link className="btn btn-primary" to="/professionals">Browse the marketplace</Link>}
          />
        )}
      </div>

      <Alert tone="info" title="Activation fee, once per assignment">
        A ₹699 GST-inclusive fee is disclosed before acceptance and deducted only from the first payout after the
        employer funds the advance. Decline the assignment before activation and nothing is charged.
      </Alert>
    </>
  );
}
