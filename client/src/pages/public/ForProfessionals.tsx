import { Link } from 'react-router-dom';
import { PublicPageHero } from '../../components/PublicPageHero';
import { Badge, Card, Icon, SectionHeading } from '../../components/ui';
import { useDocumentTitle } from '../../lib/hooks';
import { inr } from '../../lib/format';

export default function ForProfessionals() {
  useDocumentTitle('For professionals');

  return (
    <>
      <PublicPageHero
        eyebrow="For professionals"
        title={<>Your experience, on <span className="text-brand">your terms</span>.</>}
        lead="Choose a compliant working pattern. Publish a rate inside a sourced market range. Prove capability through practical work, not keyword games. Keep a verified career record that belongs to you."
        actions={
          <>
            <Link className="btn btn-primary" to="/register/professional">Create your free profile</Link>
            <Link className="btn btn-secondary" to="/how-it-works">See how it works</Link>
          </>
        }
        meta={
          <>
            <span><Icon name="check-circle" className="icon-sm" /> Free to join</span>
            <span><Icon name="check-circle" className="icon-sm" /> Free first assessment</span>
            <span><Icon name="check-circle" className="icon-sm" /> No charge without an assignment</span>
          </>
        }
        aside={
          <Card className="card-pad-lg">
            <div className="between">
              <div>
                <div className="eyebrow eyebrow-plain">Example engagement</div>
                <h3 style={{ marginTop: 6, fontSize: '1.2rem' }}>Senior React Engineer</h3>
              </div>
              <Badge tone="success" dot>Verified</Badge>
            </div>
            <div className="chips" style={{ marginTop: 12 }}>
              <span className="chip">₹1,000/hour</span>
              <span className="chip">Tue–Fri</span>
              <span className="chip">8h shift</span>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="money-line"><span>Assignment value</span><span className="num">{inr(2000000)}</span></div>
              <div className="money-line"><span>Advance (50%)</span><span className="num">{inr(1000000)}</span></div>
              <div className="money-line deduct"><span>One-time activation fee</span><span className="num">−{inr(69900)}</span></div>
              <div className="money-line"><span>Final payout (50%)</span><span className="num">{inr(1000000)}</span></div>
            </div>
            <div className="money-total"><span>Net received</span><strong>{inr(1930100)}</strong></div>
            <p className="tiny muted" style={{ marginTop: 10 }}>Illustrative example using the required finance model. GST component itemised separately.</p>
          </Card>
        }
      />

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="What you control"
            title="The parts of work that should never be a mystery."
            description="Flamingo separates what the platform verifies from what the professional decides."
          />
          <div className="grid grid-3">
            {[
              { icon: 'clock' as const, title: 'Your time', copy: 'Pick a shift length and up to four days between Tuesday and Saturday. Sunday and Monday stay off. Overlaps across employers are blocked.' },
              { icon: 'rupee' as const, title: 'Your rate', copy: 'See the sourced market range for your category and level. Publish a rate inside it, with a documented recommendation if you want guidance.' },
              { icon: 'eye' as const, title: 'Your visibility', copy: 'Your profile becomes public only after verification and a passed assessment. Turn visibility off whenever you want; your record stays intact.' },
              { icon: 'award' as const, title: 'Your evidence', copy: 'Assessments are practical and human-reviewed. A strong result is portable proof, not a one-off application artefact.' },
              { icon: 'wallet' as const, title: 'Your money trail', copy: 'Every payout shows gross, activation fee, TDS where applicable, and net. The fee is disclosed before you accept.' },
              { icon: 'trending-up' as const, title: 'Your career record', copy: 'Completed assignments, ratings, reviews, assessment results and verified employment history persist even if you take a break.' }
            ].map((item) => (
              <Card key={item.title} className="feature-card card-hover">
                <span className="icon-tile"><Icon name={item.icon} /></span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="split" style={{ alignItems: 'center' }}>
            <div>
              <SectionHeading eyebrow="Assessment" title="Prove it with work, not a detector." />
              <p className="lead">
                The assessment mixes objective questions with a practical task. Practical answers are scored by a
                human against a published rubric. We do not claim to detect AI-written text with certainty, and we
                never use an automated detector as proof of misconduct.
              </p>
              <div className="stack-sm" style={{ marginTop: 20 }}>
                <div className="row"><Icon name="check-circle" className="icon-sm text-success" /><span className="small">Timed attempt with a clear duration and pass mark.</span></div>
                <div className="row"><Icon name="check-circle" className="icon-sm text-success" /><span className="small">Integrity signals are review prompts only — focus changes, paste patterns, duplicate text.</span></div>
                <div className="row"><Icon name="check-circle" className="icon-sm text-success" /><span className="small">Feedback and a retake path after the published waiting period.</span></div>
                <div className="row"><Icon name="check-circle" className="icon-sm text-success" /><span className="small">Passed assessments and scores appear on your public profile.</span></div>
              </div>
            </div>
            <Card className="card-pad-lg">
              <div className="between">
                <div>
                  <div className="hero-card-label">Assessment result</div>
                  <h3 style={{ marginTop: 4 }}>Senior React Engineer</h3>
                </div>
                <Badge tone="success">Passed</Badge>
              </div>
              <div className="row" style={{ marginTop: 18, gap: 20 }}>
                <div>
                  <div className="stat-value">86<span className="tiny muted">/100</span></div>
                  <div className="tiny muted">Final score · pass mark 70</div>
                </div>
                <div className="grow">
                  <div className="progress-meta"><span>Human-reviewed practical</span><span>44/50</span></div>
                  <div className="progress"><div className="progress-bar success" style={{ width: '88%' }} /></div>
                  <div className="progress-meta" style={{ marginTop: 12 }}><span>Objective questions</span><span>42/50</span></div>
                  <div className="progress"><div className="progress-bar" style={{ width: '84%' }} /></div>
                </div>
              </div>
              <div className="alert alert-info" style={{ marginTop: 18 }}>
                <Icon name="info" />
                <div>Illustrative scoring display. In this demo, seeded attempts use sample scores for product evaluation.</div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Money" title="The fee is small, disclosed, and once." align="center" />
          <div className="grid grid-3">
            <Card className="card-pad-lg">
              <span className="icon-tile green"><Icon name="user" /></span>
              <h3 style={{ marginTop: 14 }}>Free to register</h3>
              <p className="small muted" style={{ marginTop: 8 }}>Create a profile and take your first assessment at no cost. There is no subscription and no pay-to-apply.</p>
            </Card>
            <Card className="card-pad-lg" style={{ borderColor: 'var(--brand-100)' }}>
              <span className="icon-tile"><Icon name="rupee" /></span>
              <h3 style={{ marginTop: 14 }}>₹699 once per assignment</h3>
              <p className="small muted" style={{ marginTop: 8 }}>Deducted from your first payout for that assignment only. It funds verification, assessment review, contract administration and payment reconciliation.</p>
            </Card>
            <Card className="card-pad-lg">
              <span className="icon-tile gold"><Icon name="wallet" /></span>
              <h3 style={{ marginTop: 14 }}>50% + 50%</h3>
              <p className="small muted" style={{ marginTop: 8 }}>An advance when the contract is signed, and the balance after approved completion. No assignment means no activation charge.</p>
            </Card>
          </div>
          <div className="center" style={{ marginTop: 26 }}>
            <Link className="btn btn-primary" to="/pricing">See the full pricing model</Link>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="band-cta">
            <h2>Bring your track record. We will bring the evidence layer.</h2>
            <p>Create a free profile, choose your working pattern and take the assessment when you are ready.</p>
            <div className="row wrap">
              <Link className="btn btn-white" to="/register/professional">Join Flamingo</Link>
              <Link className="btn btn-ghost" to="/trust-safety">Read trust & safety</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
