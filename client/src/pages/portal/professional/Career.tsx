import { Link } from 'react-router-dom';
import {
  Alert, Badge, Card, CardHeader, EmptyState, Icon, Loading, MiniBars,
  PageHeader, Rating, ScoreRing, Stat, StatusBadge
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { dateLabel, inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

const SCORE_LABELS: Record<string, string> = {
  quality: 'Quality',
  timeliness: 'Timeliness',
  technical: 'Technical',
  conduct: 'Conduct',
  communication: 'Communication',
  reliability: 'Reliability'
};

export default function ProfessionalCareer() {
  useDocumentTitle('Career record');
  const { data, loading, error } = useApi<any>('/professional/career');

  if (loading) return <Loading label="Loading your career record." />;
  if (error) return <Alert tone="danger" title="Could not load your career record">{error}</Alert>;
  if (!data) return null;

  const { profile, assignments, reviews, assessments, employment, attendance, retentionNote } = data;
  const completed = assignments.filter((assignment: any) => ['completed', 'closed'].includes(assignment.status));
  const averageReview = reviews.length
    ? reviews.reduce((sum: number, review: any) => sum + Number(review.total_score || 0), 0) / reviews.length
    : 0;
  const passedAssessments = assessments.filter((assessment: any) => assessment.status === 'passed');

  return (
    <>
      <PageHeader
        title="Career record"
        eyebrow="Verified professional history"
        description="A portable record of the work you have delivered, how employers rated it, and the assessments that back your expertise."
        actions={
          <>
            <Link className="btn btn-secondary" to="/portal/professional/profile">Edit profile</Link>
            <Link className="btn btn-primary" to="/portal/professional/assessments">Assessments <Icon name="arrow-right" className="icon-sm" /></Link>
          </>
        }
      />

      <Card className="card-accent card-pad">
        <div className="between wrap" style={{ gap: 22 }}>
          <div className="row grow" style={{ alignItems: 'flex-start', gap: 16 }}>
            <span className="icon-tile navy" style={{ width: 52, height: 52 }}><Icon name="trending-up" /></span>
            <div>
              <div className="row wrap" style={{ gap: 8 }}>
                <Badge tone={profile.verificationStatus === 'verified' ? 'success' : 'warning'}>
                  {profile.verificationStatus === 'verified' ? 'Verified professional' : 'Verification in progress'}
                </Badge>
                <Badge tone="outline">{titleCase(profile.category)}</Badge>
                {profile.isPublic ? <Badge tone="success">Marketplace visible</Badge> : <Badge tone="outline">Private</Badge>}
              </div>
              <h2 className="card-title" style={{ marginTop: 10, fontSize: '1.35rem' }}>{profile.name}</h2>
              <p className="page-sub" style={{ marginBottom: 0 }}>{profile.headline}</p>
              <div className="chips" style={{ marginTop: 12 }}>
                <span className="chip"><Icon name="map-pin" className="icon-sm" /> {profile.city}, {profile.state}</span>
                <span className="chip"><Icon name="briefcase" className="icon-sm" /> {profile.yearsExperience} years experience</span>
                <span className="chip"><Icon name="rupee" className="icon-sm" /> {inr(profile.hourlyRatePaise)}/hour</span>
                <span className="chip"><Icon name="star" className="icon-sm" /> {profile.rating ? `${Number(profile.rating).toFixed(1)} / 5` : 'New'}</span>
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 26, flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <ScoreRing value={averageReview || profile.rating * 20} label="review score" />
            </div>
            <div style={{ maxWidth: 190 }}>
              <div className="stat-label">Rehire rate</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 750, lineHeight: 1.1 }}>{profile.rehireRate}%</div>
              <div className="tiny muted">Based on employer reviews</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-4" style={{ marginTop: 20 }}>
        <Stat label="Completed assignments" value={profile.completedAssignments} sub={`${assignments.length} total engagements`} icon="check-circle" tone="success" />
        <Stat label="Verified hours" value={`${Number(attendance?.hours || 0).toFixed(1)}h`} sub={`${attendance?.entries || 0} approved timesheets`} icon="clock" />
        <Stat label="Assessments passed" value={passedAssessments.length} sub={passedAssessments.length ? passedAssessments[0]?.title : 'No passed assessment yet'} icon="award" tone="warning" />
        <Stat label="Employer reviews" value={reviews.length} sub={reviews.length ? `Average ${averageReview.toFixed(1)} / 100` : 'No reviews yet'} icon="star" />
      </div>

      <div className="split" style={{ marginTop: 26 }}>
        <div className="stack-lg">
          <Card>
            <CardHeader
              title="Assignment history"
              subtitle="Every engagement, including scope, schedule and value."
              actions={<Link className="btn btn-secondary btn-sm" to="/portal/professional/assignments">All assignments</Link>}
            />
            {assignments.length ? (
              <div className="timeline">
                {assignments.map((assignment: any) => (
                  <div className="tl-item" key={assignment.id}>
                    <span className="tl-dot" />
                    <div className="grow">
                      <div className="between wrap" style={{ gap: 8 }}>
                        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                          <div className="tl-title">{assignment.title}</div>
                          <div className="tl-sub">{assignment.employer} · {assignment.code} · {dateLabel(assignment.startDate)} – {dateLabel(assignment.endDate)}</div>
                        </div>
                        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                          <StatusBadge status={assignment.status} />
                          <Badge tone="outline">{inr(assignment.totalValuePaise)}</Badge>
                        </div>
                      </div>
                      <div className="chips" style={{ marginTop: 8 }}>
                        <span className="chip">{(assignment.workingDays || []).join(' · ') || 'Days not set'}</span>
                        <span className="chip">{assignment.shiftHours}h/day</span>
                        <span className="chip">{assignment.estimatedHours}h estimated</span>
                        {assignment.category ? <span className="chip">{titleCase(assignment.category)}</span> : null}
                      </div>
                      {assignment.deliverables ? <p className="tiny muted" style={{ marginTop: 8 }}>{assignment.deliverables}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="briefcase" title="No assignments yet" description="Your first accepted assignment starts this record." action={<Link className="btn btn-primary" to="/professionals">Browse marketplace</Link>} />
            )}
          </Card>

          <Card>
            <CardHeader title="Performance reviews" subtitle="Employer ratings with your published responses." actions={<Link className="btn btn-secondary btn-sm" to="/portal/professional/reviews">Reviews</Link>} />
            {reviews.length ? (
              <div className="stack-lg">
                {reviews.map((review: any) => (
                  <div key={review.id} className="card card-pad" style={{ boxShadow: 'none' }}>
                    <div className="between wrap" style={{ gap: 10 }}>
                      <div>
                        <div className="list-title">{review.title}</div>
                        <div className="tiny muted">{review.org_name} · {dateLabel(review.submitted_at)}</div>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <Rating value={review.total_score / 20} />
                        <StatusBadge status={review.status} />
                      </div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <MiniBars
                        data={Object.entries(SCORE_LABELS).map(([key, label]) => ({
                          label: label.slice(0, 3),
                          value: Number(review.scores?.[key] || 0)
                        }))}
                        format={(value) => `${value} / 10`}
                      />
                    </div>
                    {review.strengths ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Strengths</div>
                        <p className="tiny" style={{ marginTop: 4 }}>{review.strengths}</p>
                      </div>
                    ) : null}
                    {review.improvements ? (
                      <div style={{ marginTop: 8 }}>
                        <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Development areas</div>
                        <p className="tiny" style={{ marginTop: 4 }}>{review.improvements}</p>
                      </div>
                    ) : null}
                    {review.professional_response ? (
                      <div className="notice" style={{ marginTop: 10 }}>
                        <strong>Your response</strong>
                        {review.professional_response}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="star" title="No reviews yet" description="Reviews are published after an assignment completes and the employer submits a structured performance review." />
            )}
          </Card>
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="Assessment record" subtitle="Free, practical and human-reviewed." />
            {assessments.length ? (
              <div className="stack">
                {assessments.map((assessment: any) => (
                  <div key={assessment.id} className="between" style={{ gap: 10 }}>
                    <div>
                      <div className="list-title">{assessment.title}</div>
                      <div className="tiny muted">{titleCase(assessment.category)} · {dateLabel(assessment.submitted_at)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="strong">{assessment.final_score ?? '—'} / 100</div>
                      <StatusBadge status={assessment.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted small">No completed assessments yet.</p>}
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/professional/assessments" style={{ marginTop: 12 }}>Open assessments</Link>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Employment history" />
            {employment.length ? (
              <div className="timeline">
                {employment.map((job: any) => (
                  <div className="tl-item" key={job.id}>
                    <span className="tl-dot" />
                    <div>
                      <div className="tl-title">{job.title}</div>
                      <div className="tl-sub">{job.employer_name}</div>
                      <div className="tiny muted">{dateLabel(job.start_date)} – {job.is_current ? 'Present' : dateLabel(job.end_date)}</div>
                      <Badge tone={job.verified ? 'success' : 'outline'} className="badge-sm">{job.verified ? 'Verified' : 'Unverified'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted small">No employment history added.</p>}
          </Card>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile navy sm"><Icon name="shield-check" /></span><strong>Record integrity</strong></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>{retentionNote}</p>
            <div className="kv" style={{ marginTop: 10 }}>
              <div className="kv-row"><span className="kv-key">Identity</span><span className="kv-val"><StatusBadge status={profile.identityStatus} /></span></div>
              <div className="kv-row"><span className="kv-key">Experience</span><span className="kv-val"><StatusBadge status={profile.verificationStatus} /></span></div>
              <div className="kv-row"><span className="kv-key">Assessment</span><span className="kv-val"><StatusBadge status={profile.assessmentStatus} /></span></div>
            </div>
          </Card>

          <Alert tone="info" title="Your data, your control">
            Public visibility can be switched off at any time without deleting your assignments, reviews or verified
            history.
          </Alert>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Build the next chapter" sub="Strong records come from delivered work, honest reviews and current evidence." />
        <div className="row wrap">
          <Link className="btn btn-primary" to="/portal/professional/timesheets"><Icon name="clock" className="icon-sm" /> Log this week's hours</Link>
          <Link className="btn btn-secondary" to="/portal/professional/profile">Add a certification</Link>
          <Link className="btn btn-secondary" to="/portal/professional/interviews"><Icon name="video" className="icon-sm" /> Prepare for interviews</Link>
        </div>
      </div>
    </>
  );
}
