import { Link, useParams } from 'react-router-dom';
import {
  Alert, Avatar, Badge, Card, CardHeader, DefinitionList, EmptyState, Icon, Loading,
  Progress, Rating, SectionHeading, StatusBadge
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { dateLabel, dayList, inr, titleCase } from '../../lib/format';
import { useApi, useDocumentTitle } from '../../lib/hooks';

export default function ProfessionalProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error } = useApi<{ professional: any }>(id ? `/marketplace/professionals/${id}` : null);
  const professional = data?.professional;
  useDocumentTitle(professional ? `${professional.name} — verified professional` : 'Professional profile');

  if (loading) return <div className="container section"><Loading label="Loading verified profile." /></div>;
  if (error || !professional) {
    return (
      <div className="container section">
        <EmptyState
          icon="shield"
          title="Profile not available"
          description={error || 'This profile is private, awaiting verification, or does not exist.'}
          action={<Link className="btn btn-secondary" to="/professionals">Back to directory</Link>}
        />
      </div>
    );
  }

  return (
    <>
      <section className="section-tight" style={{ paddingBottom: 26 }}>
        <div className="container">
          <Link className="tiny muted" to="/professionals" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Icon name="arrow-left" className="icon-sm" /> Back to professional directory
          </Link>
          <Card className="card-pad-lg">
            <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(260px, 0.7fr)' }}>
              <div>
                <div className="row-top" style={{ gap: 18 }}>
                  <Avatar name={professional.name} size="xl" />
                  <div className="grow">
                    <div className="row wrap" style={{ gap: 8 }}>
                      <h1 className="page-title">{professional.name}</h1>
                      <StatusBadge status={professional.verificationStatus} />
                      {professional.isDemo ? <Badge tone="outline">Demo profile</Badge> : null}
                    </div>
                    <div className="lead" style={{ fontSize: '1rem', marginTop: 6 }}>{professional.headline}</div>
                    <div className="market-meta" style={{ marginTop: 10 }}>
                      <span><Icon name="map-pin" className="icon-sm" /> {professional.city}, {professional.state}</span>
                      <span><Icon name="briefcase" className="icon-sm" /> {professional.yearsExperience} years experience</span>
                      <span><Icon name="award" className="icon-sm" /> Assessment {professional.assessmentStatus === 'passed' ? 'passed' : professional.assessmentStatus}</span>
                    </div>
                    <div className="row wrap" style={{ marginTop: 12 }}>
                      <Rating value={professional.rating} />
                      <span className="tiny muted">{professional.completedAssignments} completed assignments</span>
                      <span className="tiny muted">{professional.rehireRate}% rehire rate</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <div className="eyebrow eyebrow-plain">Professional summary</div>
                  <p style={{ marginTop: 8, lineHeight: 1.8, color: 'var(--ink-soft)' }}>{professional.bio || 'No summary provided yet.'}</p>
                </div>

                <div className="grid grid-2" style={{ marginTop: 24 }}>
                  <div>
                    <div className="eyebrow eyebrow-plain">Skills</div>
                    <div className="chips" style={{ marginTop: 10 }}>
                      {(professional.skills || []).map((skill: string) => <span className="chip" key={skill}>{skill}</span>)}
                    </div>
                    {professional.certifications?.length ? (
                      <>
                        <div className="eyebrow eyebrow-plain" style={{ marginTop: 18 }}>Certifications</div>
                        <div className="chips" style={{ marginTop: 10 }}>
                          {professional.certifications.map((cert: string) => <span className="chip chip-brand" key={cert}>{cert}</span>)}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div>
                    <div className="eyebrow eyebrow-plain">Availability</div>
                    <div className="kv" style={{ marginTop: 6 }}>
                      <div className="kv-row"><span className="kv-key">Working days</span><span className="kv-val">{dayList(professional.availabilityDays)}</span></div>
                      <div className="kv-row"><span className="kv-key">Shift length</span><span className="kv-val">{professional.shiftHours} hours/day</span></div>
                      <div className="kv-row"><span className="kv-key">Preferred window</span><span className="kv-val">{professional.preferredStart || '—'}–{professional.preferredEnd || '—'}</span></div>
                      <div className="kv-row"><span className="kv-key">Languages</span><span className="kv-val">{(professional.languages || []).join(', ') || '—'}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stack">
                <div className="card card-pad" style={{ background: 'var(--cream)' }}>
                  <div className="hero-card-label">Published rate</div>
                  <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 750 }}>{inr(professional.hourlyRatePaise)}</span>
                    <span className="muted tiny">/ hour</span>
                  </div>
                  {professional.recommendedRatePaise ? (
                    <div className="tiny muted" style={{ marginTop: 4 }}>Flamingo recommendation: {inr(professional.recommendedRatePaise)}/hour</div>
                  ) : null}
                  <div className="tiny muted" style={{ marginTop: 10 }}>Rates are recommendations within sourced benchmark ranges. Final rates are agreed on the assignment contract.</div>
                </div>

                {professional.contactShared ? (
                  <Alert tone="success" title="Contact released to your organisation">
                    {professional.email || 'Email available'}<br />{professional.phone || 'Phone available'}<br />
                    <span className="tiny">Access recorded in the audit log because this candidate is on your shortlist.</span>
                  </Alert>
                ) : (
                  <Card className="card-pad">
                    <div className="row"><span className="icon-tile"><Icon name="lock" /></span><strong>Contact stays private</strong></div>
                    <p className="page-sub" style={{ marginTop: 8 }}>
                      Direct contact details are released only to a verified employer after this professional is
                      shortlisted. Every contact view is audited.
                    </p>
                    {user?.role === 'employer' ? (
                      <Link className="btn btn-primary btn-block" to="/portal/employer/talent" style={{ marginTop: 12 }}>
                        Search & shortlist <Icon name="arrow-right" className="icon-sm" />
                      </Link>
                    ) : user?.role === 'professional' ? (
                      <Link className="btn btn-secondary btn-block" to="/portal/professional" style={{ marginTop: 12 }}>Go to your portal</Link>
                    ) : (
                      <Link className="btn btn-primary btn-block" to="/register/employer" style={{ marginTop: 12 }}>Create an employer account</Link>
                    )}
                  </Card>
                )}

                <Card className="card-pad">
                  <div className="between">
                    <strong>Assessment evidence</strong>
                    <Badge tone={professional.assessmentStatus === 'passed' ? 'success' : 'warning'}>
                      {professional.assessmentStatus === 'passed' ? 'Passed' : titleCase(professional.assessmentStatus)}
                    </Badge>
                  </div>
                  <p className="tiny muted" style={{ marginTop: 8 }}>Scored by a human reviewer against a published rubric.</p>
                  {(professional.assessments || []).length ? (
                    <div className="stack-sm" style={{ marginTop: 10 }}>
                      {professional.assessments.slice(0, 3).map((attempt: any) => (
                        <div className="between" key={attempt.id}>
                          <span className="tiny">{attempt.title}</span>
                          <strong className="tiny">{attempt.final_score ?? '—'}/100</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="section-tight" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="split">
            <div className="stack-lg">
              <Card>
                <CardHeader title="Employment history" subtitle="Verified where evidence was supplied. Seeded demonstration record." />
                {(professional.employmentHistory || []).length ? (
                  <div className="timeline">
                    {professional.employmentHistory.map((job: any) => (
                      <div className="tl-item" key={job.id}>
                        <span className="tl-dot" />
                        <div className="grow">
                          <div className="between">
                            <div>
                              <div className="tl-title">{job.title}</div>
                              <div className="tl-sub">{job.employer_name} · {dateLabel(job.start_date, { month: 'short', year: 'numeric' })} – {job.is_current ? 'Present' : dateLabel(job.end_date, { month: 'short', year: 'numeric' })}</div>
                            </div>
                            {job.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="outline">Unverified</Badge>}
                          </div>
                          {job.description ? <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.6 }}>{job.description}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted small">No employment history recorded.</p>}
              </Card>

              <Card>
                <CardHeader title="Verified performance reviews" subtitle="Published by employers after a completed assignment. Professionals may respond or challenge." />
                {(professional.reviews || []).length ? (
                  <div className="stack-lg">
                    {professional.reviews.map((review: any) => (
                      <div key={review.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 18 }}>
                        <div className="between">
                          <div>
                            <strong>{review.orgName}</strong>
                            <div className="tiny muted">{dateLabel(review.submitted_at)} · {titleCase(review.status)}</div>
                          </div>
                          <div className="row">
                            <Badge tone="info">{review.total_score}/100</Badge>
                            {review.rehire ? <Badge tone="success">Would rehire</Badge> : null}
                          </div>
                        </div>
                        <div className="grid grid-2" style={{ marginTop: 12 }}>
                          <div>
                            <div className="tiny strong">Strengths</div>
                            <p className="tiny muted" style={{ marginTop: 3, lineHeight: 1.6 }}>{review.strengths}</p>
                          </div>
                          <div>
                            <div className="tiny strong">Development areas</div>
                            <p className="tiny muted" style={{ marginTop: 3, lineHeight: 1.6 }}>{review.improvements}</p>
                          </div>
                        </div>
                        {review.scores && Object.keys(review.scores).length ? (
                          <div className="grid grid-3" style={{ gap: 8, marginTop: 12 }}>
                            {Object.entries(review.scores).map(([criterion, score]) => (
                              <div key={criterion}>
                                <Progress value={Number(score)} max={10} label={<span className="tiny">{titleCase(criterion)}</span>} meta={<span className="tiny">{String(score)}/10</span>} />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : <p className="muted small">No published reviews yet.</p>}
              </Card>
            </div>

            <div className="stack">
              <Card className="card-pad">
                <CardHeader title="At a glance" />
                <DefinitionList
                  items={[
                    { label: 'Category', value: titleCase(professional.category) },
                    { label: 'Experience', value: `${professional.yearsExperience} years` },
                    { label: 'Education', value: professional.education || '—' },
                    { label: 'Notice period', value: professional.noticePeriodDays ? `${professional.noticePeriodDays} days` : 'Immediate' },
                    { label: 'Shift preference', value: `${professional.shiftHours} hours/day` },
                    { label: 'Assessment', value: titleCase(professional.assessmentStatus) }
                  ]}
                />
              </Card>
              {professional.portfolioUrl || professional.linkedinUrl ? (
                <Card className="card-pad">
                  <CardHeader title="Links" />
                  <div className="stack-sm">
                    {professional.portfolioUrl ? <a className="btn btn-secondary btn-sm" href={professional.portfolioUrl} target="_blank" rel="noreferrer">Portfolio <Icon name="external-link" className="icon-sm" /></a> : null}
                    {professional.linkedinUrl ? <a className="btn btn-secondary btn-sm" href={professional.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn <Icon name="external-link" className="icon-sm" /></a> : null}
                  </div>
                </Card>
              ) : null}
              <Alert tone="info" title="Demo profile">
                {professional.cardNote || 'This profile is seeded demonstration data. Verification, assessments and reviews are simulated.'}
              </Alert>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ paddingBottom: 80 }}>
        <div className="container">
          <SectionHeading eyebrow="Next step" title="Shortlist with evidence, not guesswork." description="Verified employers can shortlist, run a maximum of two structured interview rounds and hire with the contract and fee disclosure built in." />
          <div className="row wrap">
            {user?.role === 'employer' ? (
              <Link className="btn btn-primary" to="/portal/employer/talent">Open talent search</Link>
            ) : (
              <Link className="btn btn-primary" to="/register/employer">Create an employer account</Link>
            )}
            <Link className="btn btn-secondary" to="/professionals">Back to directory</Link>
          </div>
        </div>
      </section>
    </>
  );
}
