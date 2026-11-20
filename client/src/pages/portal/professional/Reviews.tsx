import { useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Icon, Loading, Modal,
  PageHeader, Progress, Rating, Stat, StatusBadge, Textarea
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { api } from '../../../lib/api';
import { dateLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

const SCORE_LABELS: Array<[string, string]> = [
  ['quality', 'Quality of work'],
  ['timeliness', 'Timeliness'],
  ['technical', 'Technical skill'],
  ['conduct', 'Professional conduct'],
  ['communication', 'Communication'],
  ['reliability', 'Reliability']
];

const ratingLabel: Record<string, string> = {
  exceeds_expectations: 'Exceeds expectations',
  meets_expectations: 'Meets expectations',
  below_expectations: 'Below expectations',
  outstanding: 'Outstanding'
};

export default function ProfessionalReviews() {
  useDocumentTitle('Reviews');
  const { data, loading, error, reload } = useApi<any>('/professional/reviews');
  const { busy, run } = useAction();
  const [active, setActive] = useState<any | null>(null);
  const [response, setResponse] = useState('');
  const [challenge, setChallenge] = useState(false);

  if (loading) return <Loading label="Loading your reviews." />;
  if (error) return <Alert tone="danger" title="Could not load reviews">{error}</Alert>;

  const reviews = data?.reviews || [];
  const average = reviews.length
    ? reviews.reduce((sum: number, review: any) => sum + Number(review.total_score || 0), 0) / reviews.length
    : 0;
  const rehireRate = reviews.length
    ? Math.round((reviews.filter((review: any) => review.rehire).length / reviews.length) * 100)
    : 0;
  const awaiting = reviews.filter((review: any) => !review.professional_response).length;
  const challenged = reviews.filter((review: any) => ['challenged', 'under_review'].includes(review.status)).length;

  const openResponse = (review: any) => {
    setActive(review);
    setResponse('');
    setChallenge(false);
  };

  const submitResponse = () =>
    run('respond', async () => {
      if (!active) return;
      if (response.trim().length < 10) throw new Error('Write at least 10 characters.');
      await api(`/professional/reviews/${active.id}/respond`, {
        method: 'POST',
        body: { response: response.trim(), challenge }
      });
      setActive(null);
      setResponse('');
      setChallenge(false);
      reload();
    }, challenge ? 'Challenge submitted for human review.' : 'Response published.');

  return (
    <>
      <PageHeader
        title="Reviews"
        eyebrow="Performance feedback"
        description="Structured employer reviews with a right of reply. You can respond once to each review, or ask the Flamingo review team to examine it."
        actions={<LinklessBadge />}
      />

      <div className="grid grid-4">
        <Stat label="Average score" value={`${average.toFixed(1)}`} sub="Out of 100 across published reviews" icon="star" tone="warning" />
        <Stat label="Reviews received" value={reviews.length} sub={`${awaiting} awaiting your response`} icon="message" />
        <Stat label="Rehire rate" value={`${rehireRate}%`} sub="Employers who would work with you again" icon="refresh" tone="success" />
        <Stat label="Under review" value={challenged} sub="Challenges being examined" icon="scale" />
      </div>

      <div className="split" style={{ marginTop: 26 }}>
        <div className="stack-lg">
          {reviews.length ? reviews.map((review: any) => (
            <Card key={review.id}>
              <CardHeader
                title={review.title}
                subtitle={`${review.org_name} · ${review.code} · ${dateLabel(review.submitted_at)}`}
                actions={
                  <div className="row" style={{ gap: 8 }}>
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
                  <div className="tiny muted" style={{ marginTop: 4 }}>{ratingLabel[review.overall_rating] || titleCase(review.overall_rating)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  {SCORE_LABELS.map(([key, label]) => (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <Progress
                        value={Number(review.scores?.[key] || 0)}
                        max={10}
                        tone={Number(review.scores?.[key] || 0) >= 8 ? 'success' : Number(review.scores?.[key] || 0) >= 6 ? 'brand' : 'warning'}
                        label={<span className="tiny">{label}</span>}
                        meta={<span className="tiny strong">{review.scores?.[key] ?? '—'}/10</span>}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-3" style={{ marginTop: 18 }}>
                <div>
                  <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Strengths</div>
                  <p className="tiny" style={{ marginTop: 4 }}>{review.strengths || '—'}</p>
                </div>
                <div>
                  <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Development areas</div>
                  <p className="tiny" style={{ marginTop: 4 }}>{review.improvements || '—'}</p>
                </div>
                <div>
                  <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Responsibilities</div>
                  <p className="tiny" style={{ marginTop: 4 }}>{review.responsibilities || '—'}</p>
                </div>
              </div>

              {review.professional_response ? (
                <div className="notice" style={{ marginTop: 16 }}>
                  <div className="between">
                    <strong>Your response</strong>
                    <span className="tiny muted">{dateLabel(review.response_at)}</span>
                  </div>
                  {review.professional_response}
                  {review.resolution ? (
                    <div className="tiny muted" style={{ marginTop: 8 }}>Resolution: {review.resolution}</div>
                  ) : null}
                </div>
              ) : (
                <div className="row wrap" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                  <Button variant="secondary" size="sm" onClick={() => openResponse(review)} disabled={['challenged', 'under_review'].includes(review.status)}>
                    <Icon name="message" className="icon-sm" /> Respond or challenge
                  </Button>
                </div>
              )}
            </Card>
          )) : (
            <EmptyState
              icon="star"
              title="No reviews yet"
              description="After an assignment completes, your employer submits a structured review. You will get a chance to respond before it is final."
            />
          )}
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="How reviews work" />
            <div className="stack-sm">
              {[
                'Employers score six fixed criteria out of ten.',
                'Scores are published with strengths and development areas.',
                'You may respond once; responses appear beside the review.',
                'A challenge opens a human review — it does not delete the review.',
                'Both sides can submit evidence to the review team.'
              ].map((item) => (
                <div className="row" key={item} style={{ alignItems: 'flex-start' }}>
                  <Icon name="check-circle" className="icon-sm text-success" />
                  <span className="tiny">{item}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Your score profile" subtitle="Across every published review." />
            {reviews.length ? (
              SCORE_LABELS.map(([key, label]) => {
                const values = reviews
                  .map((review: any) => Number(review.scores?.[key]))
                  .filter((value: number) => Number.isFinite(value));
                const averageScore = values.length ? values.reduce((sum: number, value: number) => sum + value, 0) / values.length : 0;
                return (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <Progress value={averageScore} max={10} label={<span className="tiny">{label}</span>} meta={<span className="tiny strong">{averageScore.toFixed(1)}</span>} />
                  </div>
                );
              })
            ) : <p className="muted small">No scores to summarise.</p>}
          </Card>

          <Alert tone="info" title="Fairness safeguards">
            Reviews must relate to the assignment scope. Personal, discriminatory or retaliatory content is removed after
            human review. Challenges are decided by a reviewer who was not part of the engagement.
          </Alert>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile navy sm"><Icon name="scale" /></span><strong>Disagree with a score?</strong></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Choose “Respond and request review” in the response dialog. Describe which criterion you believe is
              inaccurate and link it to evidence such as approved timesheets or deliverables.
            </p>
          </Card>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Use feedback well" sub="Reviews are a record of delivered work, not a personality verdict." />
        <div className="grid grid-3">
          <Card className="card-pad">
            <span className="icon-tile green"><Icon name="target" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Pick one improvement</strong>
            <p className="tiny muted">Choose a single development area and evidence progress in your next assignment.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile"><Icon name="book-open" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Add relevant training</strong>
            <p className="tiny muted">Certifications that match the feedback strengthen your profile and rate recommendation.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile gold"><Icon name="message" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Reply professionally</strong>
            <p className="tiny muted">A short, factual response protects your record without escalating avoidable conflict.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={challenge ? 'Respond and request review' : 'Respond to review'}
        subtitle={active ? `${active.org_name} · ${active.title}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={submitResponse} loading={busy === 'respond'} disabled={response.trim().length < 10}>
              {challenge ? 'Submit challenge' : 'Publish response'}
            </Button>
          </>
        }
      >
        <Field
          label="Your response"
          htmlFor="review-response"
          required
          hint={`${response.length}/2000 characters. Keep it factual and specific.`}
        >
          <Textarea
            id="review-response"
            value={response}
            maxLength={2000}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="Thank you for the feedback. On the point about earlier scope flags, here is what happened…"
            style={{ minHeight: 140 }}
          />
        </Field>
        <label className="checkbox" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={challenge} onChange={(event) => setChallenge(event.target.checked)} />
          <span>I am asking the Flamingo review team to examine this review. The review stays visible with an “under review” marker.</span>
        </label>
        <Alert tone="warning" title="What happens next">
          A challenge creates a dispute record reviewed by a human. Both you and the employer may be asked for evidence.
          Outcomes can uphold, revise or remove the review; the decision and reasons are recorded.
        </Alert>
      </Modal>
    </>
  );
}

function LinklessBadge() {
  return <Badge tone="info"><Icon name="shield-check" className="icon-sm" /> Human-reviewed disputes</Badge>;
}
