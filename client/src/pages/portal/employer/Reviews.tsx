import { Link } from 'react-router-dom';
import {
  Alert, Badge, Card, CardHeader, EmptyState, Icon, Loading, PageHeader,
  Progress, Rating, Stat, StatusBadge
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { dateLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

const SCORE_LABELS: Array<[string, string]> = [
  ['quality', 'Quality'],
  ['timeliness', 'Timeliness'],
  ['technical', 'Technical'],
  ['conduct', 'Conduct'],
  ['communication', 'Communication'],
  ['reliability', 'Reliability']
];

export default function EmployerReviews() {
  useDocumentTitle('Performance reviews');
  const { data, loading, error } = useApi<any>('/employer/reviews');
  const { data: assignmentData } = useApi<any>('/employer/assignments');

  if (loading) return <Loading label="Loading performance reviews." />;
  if (error) return <Alert tone="danger" title="Could not load reviews">{error}</Alert>;

  const reviews = data?.reviews || [];
  const assignments = assignmentData?.assignments || [];
  const reviewedIds = new Set(reviews.map((review: any) => review.assignment_id));
  const awaiting = assignments.filter((assignment: any) => ['completed', 'closed'].includes(assignment.status) && !reviewedIds.has(assignment.id));
  const average = reviews.length
    ? reviews.reduce((sum: number, review: any) => sum + Number(review.total_score || 0), 0) / reviews.length
    : 0;
  const rehireRate = reviews.length
    ? Math.round((reviews.filter((review: any) => review.rehire).length / reviews.length) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="Performance reviews"
        eyebrow="Post-assignment feedback"
        description="Structured, evidence-based reviews that update the professional’s verified record. Reviews can be responded to or challenged by the professional."
        actions={<Link className="btn btn-secondary" to="/portal/employer/assignments">Assignments</Link>}
      />

      <div className="grid grid-4">
        <Stat label="Reviews published" value={reviews.length} sub="Across completed work" icon="star" tone="success" />
        <Stat label="Awaiting review" value={awaiting.length} sub="Completed, not yet reviewed" icon="clock" tone={awaiting.length ? 'warning' : 'success'} />
        <Stat label="Average score" value={`${average.toFixed(1)}`} sub="Out of 100" icon="trending-up" />
        <Stat label="Rehire rate" value={`${rehireRate}%`} sub="Reviews marked would rehire" icon="refresh" />
      </div>

      {awaiting.length ? (
        <Card style={{ marginTop: 22 }}>
          <CardHeader title="Awaiting your review" subtitle="Complete the record so the professional’s career history stays current." />
          <div className="list">
            {awaiting.map((assignment: any) => (
              <div className="list-row" key={assignment.id}>
                <span className="icon-tile gold sm"><Icon name="star" /></span>
                <div className="list-main">
                  <div className="list-title">{assignment.title}</div>
                  <div className="list-sub">{assignment.professional_name} · {assignment.code} · {dateLabel(assignment.end_date)}</div>
                </div>
                <Link className="btn btn-primary btn-sm" to={`/portal/employer/assignments/${assignment.id}`}>Publish review</Link>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="split" style={{ marginTop: 22 }}>
        <div className="stack-lg">
          {reviews.length ? reviews.map((review: any) => (
            <Card key={review.id}>
              <CardHeader
                title={review.title}
                subtitle={`${review.professional_name} · ${review.code} · ${dateLabel(review.submitted_at)}`}
                actions={
                  <div className="row" style={{ gap: 6 }}>
                    <Badge tone={review.rehire ? 'success' : 'neutral'}>{review.rehire ? 'Would rehire' : 'No rehire'}</Badge>
                    <StatusBadge status={review.status} />
                  </div>
                }
              />
              <div className="between wrap" style={{ gap: 18 }}>
                <div>
                  <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 750 }}>{Number(review.total_score).toFixed(1)}</span>
                    <span className="tiny muted">/ 100</span>
                  </div>
                  <Rating value={Number(review.total_score) / 20} />
                  <div className="tiny muted" style={{ marginTop: 4 }}>{titleCase(review.overall_rating)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  {SCORE_LABELS.map(([key, label]) => (
                    <div key={key} style={{ marginBottom: 6 }}>
                      <Progress
                        value={Number(review.scores?.[key] || 0)}
                        max={10}
                        tone={Number(review.scores?.[key] || 0) >= 8 ? 'success' : 'brand'}
                        label={<span className="tiny">{label}</span>}
                        meta={<span className="tiny strong">{review.scores?.[key] ?? '—'}/10</span>}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-3" style={{ marginTop: 16 }}>
                <div>
                  <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Strengths</div>
                  <p className="tiny" style={{ marginTop: 4 }}>{review.strengths}</p>
                </div>
                <div>
                  <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Development areas</div>
                  <p className="tiny" style={{ marginTop: 4 }}>{review.improvements}</p>
                </div>
                <div>
                  <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Responsibilities</div>
                  <p className="tiny" style={{ marginTop: 4 }}>{review.responsibilities}</p>
                </div>
              </div>
              {review.professional_response ? (
                <div className="notice" style={{ marginTop: 14 }}>
                  <div className="between">
                    <strong>Professional response</strong>
                    <span className="tiny muted">{dateLabel(review.response_at)}</span>
                  </div>
                  {review.professional_response}
                </div>
              ) : null}
              {review.resolution ? (
                <div className="notice" style={{ marginTop: 10 }}><strong>Review team resolution</strong>{review.resolution}</div>
              ) : null}
              <div className="row wrap" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                <Link className="btn btn-secondary btn-sm" to={`/portal/employer/assignments/${review.assignment_id}`}>Open assignment</Link>
              </div>
            </Card>
          )) : (
            <EmptyState icon="star" title="No reviews yet" description="Publish a structured review after you approve completion. It becomes part of the professional’s verified record." action={<Link className="btn btn-primary" to="/portal/employer/assignments">Open assignments</Link>} />
          )}
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="Review standard" subtitle="Consistent criteria across every employer." />
            <div className="stack-sm">
              {[
                'Score six fixed criteria out of ten.',
                'Write at least 10 characters for strengths, development areas and responsibilities.',
                'Describe observable behaviour, not personality.',
                'Reviews are published immediately and shared with the professional.',
                'The professional gets one response and may request human review.'
              ].map((item) => (
                <div className="row" key={item} style={{ alignItems: 'flex-start' }}>
                  <Icon name="check-circle" className="icon-sm text-success" />
                  <span className="tiny">{item}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Your review profile" subtitle="Across all published reviews." />
            {SCORE_LABELS.map(([key, label]) => {
              const values = reviews.map((review: any) => Number(review.scores?.[key])).filter((value: number) => Number.isFinite(value));
              const score = values.length ? values.reduce((sum: number, value: number) => sum + value, 0) / values.length : 0;
              return <div key={key} style={{ marginBottom: 8 }}><Progress value={score} max={10} label={<span className="tiny">{label}</span>} meta={<span className="tiny strong">{score.toFixed(1)}</span>} /></div>;
            })}
          </Card>

          <Alert tone="info" title="Fairness">
            Challenges are reviewed by someone outside the engagement. Outcomes can uphold, revise or remove a review, and
            the decision is recorded with reasons.
          </Alert>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Close the loop" sub="Good reviews are specific, timely and actionable." />
        <div className="grid grid-3">
          <Card className="card-pad"><strong className="small">Before publishing</strong><p className="tiny muted">Approve completion and confirm all timesheets and invoices are settled.</p></Card>
          <Card className="card-pad"><strong className="small">After publishing</strong><p className="tiny muted">The professional can respond once. Revisions are handled by the review team, not by editing scores.</p></Card>
          <Card className="card-pad"><strong className="small">For future hiring</strong><p className="tiny muted">Use your own review history to calibrate expectations and improve briefs.</p></Card>
        </div>
      </div>
    </>
  );
}
