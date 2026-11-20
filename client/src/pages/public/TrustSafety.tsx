import { Link } from 'react-router-dom';
import { PublicPageHero } from '../../components/PublicPageHero';
import { Alert, Badge, Card, CardHeader, Icon, SectionHeading } from '../../components/ui';
import { useApi, useDocumentTitle } from '../../lib/hooks';

export default function TrustSafety() {
  useDocumentTitle('Trust & safety');
  const { data: stats } = useApi<any>('/public/stats');

  return (
    <>
      <PublicPageHero
        eyebrow="Trust & safety"
        title="Trust is a process, not a badge."
        lead="Flamingo separates what is verified, what is assessed and what is only a signal. Employers see evidence. Professionals see exactly how decisions are made and how to challenge them."
        meta={
          <>
            <span><Icon name="lock" className="icon-sm" /> Encrypted document storage</span>
            <span><Icon name="users" className="icon-sm" /> Human review</span>
            <span><Icon name="scale" className="icon-sm" /> Documented disputes</span>
          </>
        }
        aside={
          <Card className="card-pad" style={{ background: 'var(--navy)', color: '#dfe8f2', borderColor: 'var(--navy)' }}>
            <div className="eyebrow" style={{ color: '#ff9aa6' }}>Current demo state</div>
            <h3 style={{ color: '#fff', marginTop: 10 }}>Seeded, simulated, labelled.</h3>
            <div className="kv" style={{ marginTop: 12 }}>
              <div className="kv-row" style={{ borderColor: 'rgba(255,255,255,.12)' }}><span style={{ color: '#9fb1c6' }}>Public profiles</span><span style={{ color: '#fff' }}>{stats?.publicProfessionals ?? '—'}</span></div>
              <div className="kv-row" style={{ borderColor: 'rgba(255,255,255,.12)' }}><span style={{ color: '#9fb1c6' }}>Verified employers</span><span style={{ color: '#fff' }}>{stats?.verifiedEmployers ?? '—'}</span></div>
              <div className="kv-row" style={{ borderColor: 'rgba(255,255,255,.12)' }}><span style={{ color: '#9fb1c6' }}>Completed assignments</span><span style={{ color: '#fff' }}>{stats?.completedAssignments ?? '—'}</span></div>
            </div>
            <p className="tiny" style={{ color: '#8fa3bc', marginTop: 12 }}>{stats?.note || 'Seeded demonstration data. Counts are not claims about live marketplace liquidity.'}</p>
          </Card>
        }
      />

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Three gates before visibility"
            title="A profile becomes public only when it is earned."
            description="Public search is restricted to professionals who pass every gate. Turning visibility off never deletes a career record."
          />
          <div className="steps">
            <div className="step">
              <span className="step-num">01</span>
              <h3>Identity verified</h3>
              <p>Government identity and address evidence is reviewed by a verification officer. Documents are encrypted at rest and access is audited.</p>
            </div>
            <div className="step">
              <span className="step-num">02</span>
              <h3>Experience evidenced</h3>
              <p>At least three years of professional experience, supported by employment history and references. Claims are checked, not taken on trust.</p>
            </div>
            <div className="step">
              <span className="step-num">03</span>
              <h3>Assessment passed</h3>
              <p>A timed practical assessment is scored against a published rubric by a human reviewer before a profile can be published.</p>
            </div>
          </div>
          <Alert tone="info" title="What employers can see">
            Category, headline, skills, experience, rate, availability, assessment outcome and published reviews.
            Contact details are released only to a verified employer that has shortlisted the candidate. Every contact
            view is written to the audit log.
          </Alert>
        </div>
      </section>

      <section className="section" id="assessments" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="split" style={{ alignItems: 'start' }}>
            <div>
              <SectionHeading
                eyebrow="Assessment integrity"
                title="Evidence, not detection theatre."
                description="Flamingo does not claim that AI-written text can be detected with certainty. Automated detectors are unreliable, opaque and disproportionately harmful. We use practical work and human judgement instead."
              />
              <div className="stack">
                <Card className="card-pad">
                  <div className="row-top">
                    <span className="icon-tile green"><Icon name="check-circle" /></span>
                    <div>
                      <strong>What we do</strong>
                      <ul className="feature-list" style={{ marginTop: 8 }}>
                        <li><Icon name="check" className="icon-sm" /> Timed practical tasks that resemble real work.</li>
                        <li><Icon name="check" className="icon-sm" /> Live problem-solving and oral verification where needed.</li>
                        <li><Icon name="check" className="icon-sm" /> Published rubrics and two independent reviewer judgements.</li>
                        <li><Icon name="check" className="icon-sm" /> Retake policy with a cooling-off period.</li>
                      </ul>
                    </div>
                  </div>
                </Card>
                <Card className="card-pad">
                  <div className="row-top">
                    <span className="icon-tile gold"><Icon name="alert-triangle" /></span>
                    <div>
                      <strong>What we do not do</strong>
                      <ul className="feature-list" style={{ marginTop: 8 }}>
                        <li><Icon name="x" className="icon-sm" /> Treat an AI-detector score as proof of misconduct.</li>
                        <li><Icon name="x" className="icon-sm" /> Reject a candidate automatically from a focus or similarity signal.</li>
                        <li><Icon name="x" className="icon-sm" /> Publish an integrity score as a verdict.</li>
                        <li><Icon name="x" className="icon-sm" /> Use assessment data for anything beyond the hiring decision.</li>
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <div className="card card-pad-lg" style={{ background: 'var(--cream)' }}>
              <Badge tone="brand">Reviewer workflow</Badge>
              <h3 style={{ marginTop: 14 }}>From submission to result</h3>
              <div className="timeline" style={{ marginTop: 18 }}>
                {[
                  ['Objective answers auto-marked', 'Multiple-choice and numeric items are scored immediately.'],
                  ['Practical answers queued', 'A human reviewer scores each practical response against the rubric.'],
                  ['Signals surfaced, not decided', 'Focus changes or text similarity appear as context for the reviewer.'],
                  ['Decision and feedback published', 'Pass, fail or retake, with written feedback and a challenge route.']
                ].map(([title, sub]) => (
                  <div className="tl-item" key={title}>
                    <span className="tl-dot" />
                    <div>
                      <div className="tl-title">{title}</div>
                      <div className="tl-sub">{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Alert tone="warning" title="No 100% claim">
                No detector can prove authorship. A reviewer may ask for a live walkthrough, but the decision rests on
                demonstrated capability and the published rubric.
              </Alert>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Money & records"
            title="Every movement has two sides."
            description="The demonstration ledger is a double-entry control record. It is designed to make reconciliation possible, not to imitate a statutory book of account."
          />
          <div className="grid grid-3">
            <Card>
              <CardHeader title="Itemised invoices" subtitle="Professional charges, platform fee, GST and other charges are separate lines." />
              <div className="kv">
                <div className="kv-row"><span className="kv-key">Professional charges</span><span className="kv-val">Shown</span></div>
                <div className="kv-row"><span className="kv-key">Platform fee</span><span className="kv-val">Shown separately</span></div>
                <div className="kv-row"><span className="kv-key">GST</span><span className="kv-val">Shown separately</span></div>
              </div>
            </Card>
            <Card>
              <CardHeader title="Balanced ledger" subtitle="Each capture, activation fee and payout posts a balanced group." />
              <div className="kv">
                <div className="kv-row"><span className="kv-key">Debit total</span><span className="kv-val">= Credit total</span></div>
                <div className="kv-row"><span className="kv-key">Activation fee</span><span className="kv-val">GST split recorded</span></div>
                <div className="kv-row"><span className="kv-key">Payouts</span><span className="kv-val">Status tracked</span></div>
              </div>
            </Card>
            <Card>
              <CardHeader title="Dispute route" subtitle="A review or payment dispute can be raised and resolved by a human." />
              <div className="kv">
                <div className="kv-row"><span className="kv-key">Window</span><span className="kv-val">10 days</span></div>
                <div className="kv-row"><span className="kv-key">Review marker</span><span className="kv-val">Visible while open</span></div>
                <div className="kv-row"><span className="kv-key">Decision</span><span className="kv-val">Written outcome</span></div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ paddingBottom: 90 }}>
        <div className="container">
          <div className="band-cta">
            <h2>Ask the harder question: how is this verified?</h2>
            <p>Read the FAQ, inspect the money model, or talk to the team about a control you need to see.</p>
            <div className="row wrap">
              <Link className="btn btn-white" to="/faq">Read the FAQ</Link>
              <Link className="btn btn-ghost" to="/contact">Talk to us</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
