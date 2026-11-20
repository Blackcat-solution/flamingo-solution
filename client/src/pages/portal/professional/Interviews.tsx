import {
  Alert, Badge, Card, CardHeader, EmptyState, Icon, Loading,
  PageHeader, Stat, StatusBadge, Tabs
} from '../../../components/ui';
import { useState } from 'react';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { dateTimeLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

type Filter = 'upcoming' | 'past' | 'all';

export default function ProfessionalInterviews() {
  useDocumentTitle('Interviews');
  const { data, loading, error } = useApi<any>('/professional/interviews');
  const [filter, setFilter] = useState<Filter>('upcoming');

  if (loading) return <Loading label="Loading interviews." />;
  if (error) return <Alert tone="danger" title="Could not load interviews">{error}</Alert>;

  const interviews = data?.interviews || [];
  const now = Date.now();
  const upcoming = interviews
    .filter((interview: any) => interview.status === 'scheduled' && new Date(interview.scheduled_at).getTime() >= now)
    .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = interviews.filter((interview: any) => !upcoming.includes(interview));
  const filtered = filter === 'upcoming' ? upcoming : filter === 'past' ? past : interviews;

  const roundName = (round: number) => round === 1 ? 'Round 1 · Panel interview' : 'Round 2 · Final discussion';

  return (
    <>
      <PageHeader
        title="Interviews"
        eyebrow="Selection process"
        description="A maximum of two rounds: a panel interview followed by a final discussion. Meeting links, panel members and outcomes live here."
        actions={<Badge tone="info">Two rounds maximum</Badge>}
      />

      <div className="grid grid-4">
        <Stat label="Upcoming" value={upcoming.length} sub="Scheduled video interviews" icon="video" tone="success" />
        <Stat label="Completed" value={interviews.filter((interview: any) => interview.status === 'completed').length} sub="Across all employers" icon="check-circle" />
        <Stat label="Round 2 invitations" value={interviews.filter((interview: any) => interview.round === 2).length} sub="Final discussions" icon="award" tone="warning" />
        <Stat label="Cancelled or no-show" value={interviews.filter((interview: any) => ['cancelled', 'no_show'].includes(interview.status)).length} sub="Recorded for transparency" icon="x-circle" />
      </div>

      <div style={{ marginTop: 22 }}>
        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { key: 'past', label: 'Past', count: past.length },
            { key: 'all', label: 'All', count: interviews.length }
          ]}
        />
      </div>

      <div className="split" style={{ marginTop: 22 }}>
        <div className="stack-lg">
          {filtered.length ? filtered.map((interview: any) => {
            const when = new Date(interview.scheduled_at);
            const isUpcoming = interview.status === 'scheduled' && when.getTime() >= now;
            return (
              <Card key={interview.id}>
                <div className="between wrap" style={{ alignItems: 'flex-start', gap: 14 }}>
                  <div>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <Badge tone={interview.round === 1 ? 'info' : 'brand'}>{roundName(interview.round)}</Badge>
                      <StatusBadge status={interview.status} />
                      <Badge tone="outline">{titleCase(interview.mode)}</Badge>
                    </div>
                    <h3 className="card-title" style={{ marginTop: 10 }}>{interview.org_name}</h3>
                    <div className="page-sub" style={{ marginBottom: 0 }}>
                      {dateTimeLabel(interview.scheduled_at)} · {interview.duration_minutes} minutes
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="stat-label">Scheduled</div>
                    <div className="strong">{when.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                    <div className="tiny muted">{when.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                </div>

                <div className="grid grid-2" style={{ marginTop: 16 }}>
                  <div>
                    <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Panel</div>
                    <div className="stack-sm" style={{ marginTop: 6 }}>
                      {(interview.panel || []).length ? interview.panel.map((member: any, index: number) => (
                        <div className="row" key={index} style={{ alignItems: 'flex-start' }}>
                          <span className="icon-tile navy sm"><Icon name="user" /></span>
                          <span>
                            <span className="tiny strong" style={{ display: 'block' }}>{member.name}</span>
                            <span className="tiny muted">{member.role || 'Panel member'}</span>
                          </span>
                        </div>
                      )) : <span className="tiny muted">Panel to be confirmed.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Preparation</div>
                    <p className="tiny" style={{ marginTop: 6 }}>
                      {interview.round === 1
                        ? 'Expect questions on your verified experience, a practical scenario from the assignment scope, and your availability.'
                        : 'A final conversation about scope, working pattern, start date and the payment schedule. This is not a third interview round.'}
                    </p>
                    {interview.notes ? <p className="tiny muted" style={{ marginTop: 6 }}>{interview.notes}</p> : null}
                  </div>
                </div>

                {isUpcoming ? (
                  <div className="row wrap" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                    <Badge tone="neutral"><Icon name="clock" className="icon-sm" /> Link active before the start time</Badge>
                    {interview.meeting_url ? (
                      <a className="btn btn-primary btn-sm" href={interview.meeting_url} target="_blank" rel="noreferrer">
                        <Icon name="video" className="icon-sm" /> Join meeting
                      </a>
                    ) : null}
                  </div>
                ) : interview.outcome ? (
                  <div className="notice" style={{ marginTop: 16 }}>
                    <strong>Outcome</strong>
                    {titleCase(interview.outcome)}
                  </div>
                ) : null}
              </Card>
            );
          }) : (
            <EmptyState
              icon="video"
              title={filter === 'upcoming' ? 'No upcoming interviews' : 'No interviews in this view'}
              description="A verified employer can schedule up to two rounds after shortlisting you. Invitations and meeting links appear here."
            />
          )}
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="The two-round rule" subtitle="Applied to every employer on Flamingo." />
            <div className="timeline" style={{ marginTop: 6 }}>
              <div className="tl-item">
                <span className="tl-dot" />
                <div>
                  <div className="tl-title">Round 1 · Panel interview</div>
                  <div className="tl-sub">Structured questions with a panel. Scored against fixed criteria.</div>
                </div>
              </div>
              <div className="tl-item">
                <span className="tl-dot" />
                <div>
                  <div className="tl-title">Round 2 · Final discussion</div>
                  <div className="tl-sub">Scope, schedule, start date and payment terms — not another interrogation.</div>
                </div>
              </div>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>No third round can be scheduled. If an employer asks for one, contact support.</p>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Before you join" />
            <div className="stack-sm">
              {[
                'Test your camera, microphone and connection.',
                'Keep your identity document to hand if asked.',
                'Review the assignment scope and your availability.',
                'Join from a quiet, well-lit space.',
                'Ask about the payment schedule if it is unclear.'
              ].map((item) => (
                <div className="row" key={item} style={{ alignItems: 'flex-start' }}>
                  <Icon name="check-circle" className="icon-sm text-success" />
                  <span className="tiny">{item}</span>
                </div>
              ))}
            </div>
          </Card>

          <Alert tone="info" title="Simulated meeting links">
            Meeting rooms in this demonstration are placeholder links. No live video service is connected, and no
            recording is made.
          </Alert>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile navy sm"><Icon name="calendar" /></span><strong>Need to reschedule?</strong></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Ask the employer through the messages on your assignment or contact support. Repeated no-shows are recorded
              and can affect marketplace visibility.
            </p>
          </Card>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Accessibility & adjustments" sub="Interviews should be workable for everyone." />
        <Alert tone="neutral">
          You can request reasonable adjustments — extra time, a written question set, captions or a different time
          window — before the interview. Requests are handled by the employer with Flamingo support available.
        </Alert>
      </div>
    </>
  );
}
