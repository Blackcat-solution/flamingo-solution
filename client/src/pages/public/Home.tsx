import { Link } from 'react-router-dom';
import { useApi, useDocumentTitle } from '../../lib/hooks';
import { dayList, inr } from '../../lib/format';
import { Badge, Card, Icon, Rating, SectionHeading, Avatar, Accordion } from '../../components/ui';

const FALLBACK_FAQS = [
  {
    q: 'Is registration free?',
    a: 'Yes. Creating a profile and taking your first assessment are free. A ₹699 activation fee applies once per new assignment and is deducted from your first payout for that assignment only.'
  },
  {
    q: 'How do the working-hour rules work?',
    a: 'Choose an 8, 10 or 12-hour shift and up to four working days between Tuesday and Saturday. Sunday and Monday are compulsory off days. Combined bookings stay within 12 hours a day and 48 hours a week, with 15 + 15 + 30 minutes of breaks.'
  },
  {
    q: 'How many interview rounds are there?',
    a: 'A maximum of two. Round 1 is a panel interview covering experience and problem solving. Round 2 is the final discussion on expectations, working arrangements and selection.'
  },
  {
    q: 'Does Flamingo use AI detection on assessments?',
    a: 'No. AI detection is not reliable enough for employment decisions. We use timed practical work, live problem-solving, rubrics and human review. Integrity signals are prompts for a reviewer, never automated proof.'
  }
];

export default function Home() {
  useDocumentTitle('The future of flexible talent');
  const { data: featured } = useApi<{ professionals: any[] }>('/marketplace/featured');
  const { data: stats } = useApi<any>('/public/stats');
  const { data: faqData } = useApi<{ faqs: any[] }>('/public/faqs');

  const professionals = featured?.professionals?.slice(0, 3) || [];
  const faqs = (faqData?.faqs || FALLBACK_FAQS).slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">The future of flexible talent</span>
            <h1 className="hero-title">
              Work your time.<br />
              <em>Earn your worth.</em>
            </h1>
            <p className="hero-sub">
              A curated marketplace for experienced professionals and verified employers. Choose a compliant
              working pattern, prove your capability through practical assessment, and get paid through a
              transparent 50/50 structure.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/register/professional">
                Join as a professional
                <Icon name="arrow-right" className="icon-sm" />
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/register/employer">
                Hire verified talent
              </Link>
            </div>
            <div className="hero-trust">
              <span><Icon name="shield-check" className="icon-sm" /> Identity & experience verified</span>
              <span><Icon name="check-circle" className="icon-sm" /> Human-reviewed assessments</span>
              <span><Icon name="wallet" className="icon-sm" /> Transparent 50/50 payments</span>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-card hero-card-top">
              <Avatar name="Aarav Mehta" />
              <div className="grow">
                <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>Aarav Mehta</div>
                <div className="tiny muted">Senior React Engineer · Bengaluru</div>
              </div>
              <Badge tone="success" dot>Verified</Badge>
            </div>

            <div className="hero-card hero-card-main">
              <div className="between">
                <div>
                  <div className="hero-card-label">Active assignment</div>
                  <div className="hero-card-title">Senior React Engineer</div>
                  <div className="tiny muted" style={{ marginTop: 3 }}>Meridian Technologies · 12 weeks</div>
                </div>
                <Badge tone="brand">Demo data</Badge>
              </div>
              <div className="chips" style={{ marginTop: 14 }}>
                <span className="chip">Tue–Fri</span>
                <span className="chip">8h shift</span>
                <span className="chip">32h/week</span>
              </div>
              <div style={{ marginTop: 18 }}>
                <div className="hero-card-line"><span className="muted">Assignment value</span><span className="num">{inr(2000000)}</span></div>
                <div className="hero-card-line"><span className="muted">Advance (50%)</span><span className="num">{inr(1000000)}</span></div>
                <div className="hero-card-line"><span className="muted">Activation fee (once)</span><span className="num" style={{ color: 'var(--danger)' }}>−{inr(69900)}</span></div>
                <div className="hero-card-line"><span className="muted">First payout</span><span className="num">{inr(930100)}</span></div>
                <div className="hero-card-line"><span className="muted">Final payout</span><span className="num">{inr(1000000)}</span></div>
              </div>
              <div className="hero-card-total">
                <span>Total received</span>
                <strong>{inr(1930100)}</strong>
              </div>
              <div className="tiny muted" style={{ marginTop: 10 }}>
                Example only. GST component of the activation fee is itemised in the statement.
              </div>
            </div>

            <div className="hero-float-stat">
              <span className="icon-tile green sm"><Icon name="award" /></span>
              <div>
                <div className="stat-value">86<span style={{ fontSize: 12, color: 'var(--muted)' }}>/100</span></div>
                <div className="tiny muted">Assessment passed</div>
              </div>
            </div>

            <div className="hero-card hero-card-bottom">
              <div className="row">
                <span className="icon-tile green sm"><Icon name="shield-check" /></span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Profile verified</div>
                  <div className="tiny muted">Identity · experience · assessment</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container trust-strip">
        <div className="trust-strip-inner">
          <span className="trust-strip-label">Built for trust</span>
          <div className="trust-strip-items">
            <span><Icon name="shield-check" className="icon-sm" /> Verified employers</span>
            <span><Icon name="award" className="icon-sm" /> Assessed capability</span>
            <span><Icon name="scale" className="icon-sm" /> Compliant working time</span>
            <span><Icon name="rupee" className="icon-sm" /> Itemised money</span>
          </div>
          <span className="badge badge-outline">
            {stats ? `${stats.publicProfessionals} public profiles · ${stats.verifiedEmployers} verified employers` : 'Seeded demo marketplace'}
          </span>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Why Flamingo"
            title="Experience deserves a better marketplace."
            description="Most platforms optimise for volume. Flamingo is built for people with a track record and employers who need dependable, verified capability."
          />
          <div className="grid grid-3">
            <Card className="feature-card card-hover">
              <span className="icon-tile"><Icon name="user" /></span>
              <h3>Built for experienced professionals</h3>
              <p>A minimum of three years of professional experience keeps the marketplace focused. Your record, assessments and verified history travel with you.</p>
              <ul className="feature-list">
                <li><Icon name="check" className="icon-sm" /> Free registration and first assessment</li>
                <li><Icon name="check" className="icon-sm" /> Public visibility only after verification</li>
                <li><Icon name="check" className="icon-sm" /> Your rate, your working pattern</li>
              </ul>
            </Card>
            <Card className="feature-card card-hover">
              <span className="icon-tile gold"><Icon name="shield-check" /></span>
              <h3>Trust that is earned, not assumed</h3>
              <p>Identity and experience checks, timed practical assessments and human review. Employers see evidence, not just a polished profile.</p>
              <ul className="feature-list">
                <li><Icon name="check" className="icon-sm" /> Encrypted document handling</li>
                <li><Icon name="check" className="icon-sm" /> Rubric-scored practical work</li>
                <li><Icon name="check" className="icon-sm" /> Two-round interview maximum</li>
              </ul>
            </Card>
            <Card className="feature-card card-hover">
              <span className="icon-tile green"><Icon name="scale" /></span>
              <h3>Money and time, made legible</h3>
              <p>50% advance, 50% on completion. The ₹699 activation fee is disclosed before acceptance and deducted once from the first payout.</p>
              <ul className="feature-list">
                <li><Icon name="check" className="icon-sm" /> GST and platform fee itemised</li>
                <li><Icon name="check" className="icon-sm" /> Balanced, auditable ledger</li>
                <li><Icon name="check" className="icon-sm" /> Schedule overlap protection</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <SectionHeading
            eyebrow="How it works"
            title="From profile to first payout."
            description="A deliberate, four-step path designed to reduce hiring risk on both sides."
          />
          <div className="steps">
            <div className="step">
              <span className="step-num">01</span>
              <h3>Create your profile</h3>
              <p>Register free, add at least three years of experience, your skills and the working pattern that fits your life.</p>
            </div>
            <div className="step">
              <span className="step-num">02</span>
              <h3>Verify and assess</h3>
              <p>Upload identity and experience documents, then complete a timed practical assessment scored against a rubric.</p>
            </div>
            <div className="step">
              <span className="step-num">03</span>
              <h3>Interview and agree</h3>
              <p>A maximum of two rounds: a panel conversation, then the final discussion. The contract and fees are disclosed before acceptance.</p>
            </div>
            <div className="step">
              <span className="step-num">04</span>
              <h3>Work and get paid</h3>
              <p>Log compliant hours. The employer funds a 50% advance, then 50% after approved completion. The one-time fee is deducted from the first payout.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Marketplace"
            title="A preview of verified capability."
            description="Every public profile has passed identity and experience verification plus a Flamingo assessment. All profiles below are seeded demonstration data."
            actions={<Link className="btn btn-secondary" to="/professionals">Browse the directory <Icon name="arrow-right" className="icon-sm" /></Link>}
          />
          <div className="grid grid-3">
            {(professionals.length ? professionals : [null, null, null]).map((professional, index) =>
              professional ? (
                <Link key={professional.id} to={`/professionals/${professional.id}`} className="card card-hover market-card">
                  <div className="market-head">
                    <Avatar name={professional.name} />
                    <div className="grow">
                      <div className="market-name">{professional.name}</div>
                      <div className="market-role clamp-2">{professional.headline}</div>
                    </div>
                    {professional.isDemo ? <Badge tone="outline">Demo</Badge> : null}
                  </div>
                  <div className="market-meta">
                    <span><Icon name="map-pin" className="icon-sm" /> {professional.city}</span>
                    <span><Icon name="briefcase" className="icon-sm" /> {professional.yearsExperience} yrs</span>
                    <Rating value={professional.rating} />
                  </div>
                  <div className="chips">
                    {(professional.skills || []).slice(0, 3).map((skill: string) => (
                      <span className="chip" key={skill}>{skill}</span>
                    ))}
                  </div>
                  <div className="market-rate">
                    <strong>{inr(professional.hourlyRatePaise)}</strong>
                    <span>/ hour</span>
                  </div>
                  <div className="market-foot">
                    <span className="tiny muted">{dayList(professional.availabilityDays)}</span>
                    <span className="text-brand" style={{ fontSize: '0.8rem', fontWeight: 700 }}>View profile <Icon name="arrow-right" className="icon-sm" /></span>
                  </div>
                </Link>
              ) : (
                <Card key={index} className="market-card">
                  <div className="skeleton" style={{ height: 44, width: 44, borderRadius: '50%' }} />
                  <div className="skeleton" style={{ height: 14, width: '60%' }} />
                  <div className="skeleton" style={{ height: 12, width: '80%' }} />
                  <div className="skeleton" style={{ height: 40, width: '100%' }} />
                </Card>
              )
            )}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="money-hero">
            <div className="money-hero-grid">
              <div>
                <span className="eyebrow" style={{ color: '#ff9aa6' }}>Transparent money</span>
                <h2 style={{ marginTop: 12 }}>Know the number before you say yes.</h2>
                <p>
                  No hidden deductions. The employer pays 50% when the contract is signed and 50% after approved
                  completion. The one-time ₹699 activation fee is deducted from the first payout only — never as a
                  subscription, and never if you decline before activation.
                </p>
                <div className="row wrap" style={{ marginTop: 22 }}>
                  <Link className="btn btn-white" to="/pricing">See pricing & benchmarks</Link>
                  <Link className="btn btn-ghost" to="/trust-safety">How the ledger works</Link>
                </div>
              </div>
              <div className="money-sheet">
                <div className="money-sheet-title">
                  <div>
                    <div className="hero-card-label">Worked example</div>
                    <div style={{ fontWeight: 700, marginTop: 3 }}>₹20,000 assignment</div>
                  </div>
                  <Badge tone="brand">Exact</Badge>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div className="money-line"><span>Assignment value</span><span className="num">{inr(2000000)}</span></div>
                  <div className="money-line"><span>Advance @ 50%</span><span className="num">{inr(1000000)}</span></div>
                  <div className="money-line deduct"><span>Activation fee (once)</span><span className="num">−{inr(69900)}</span></div>
                  <div className="money-line"><span>First payout</span><span className="num">{inr(930100)}</span></div>
                  <div className="money-line"><span>Final payout @ 50%</span><span className="num">{inr(1000000)}</span></div>
                </div>
                <div className="money-total"><span>Total received by professional</span><strong>{inr(1930100)}</strong></div>
                <p className="money-note">
                  The ₹699 fee is GST-inclusive: base ₹592.37 + GST ₹106.63. Invoices itemise professional charges,
                  platform fee and GST. Platform fee is 0% in this demo configuration, so the example reconciles exactly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="split" style={{ alignItems: 'center' }}>
            <div>
              <SectionHeading
                eyebrow="Working-time rules"
                title="Flexibility with a spine."
                description="A marketplace that ignores working time is not flexible — it is extractive. Flamingo's scheduling engine enforces the rules on every booking."
              />
              <div className="rule-grid">
                <div className="rule"><strong>8 / 10 / 12</strong><span>Hourly shift choices</span></div>
                <div className="rule"><strong>4 days</strong><span>Maximum working days per week</span></div>
                <div className="rule"><strong>Sun + Mon</strong><span>Compulsory off days</span></div>
                <div className="rule"><strong>48h</strong><span>Weekly cap across employers</span></div>
              </div>
              <ul className="feature-list" style={{ marginTop: 20 }}>
                <li><Icon name="check-circle" className="icon-sm" /> Tuesday to Saturday availability, with no overlapping bookings.</li>
                <li><Icon name="check-circle" className="icon-sm" /> 12-hour daily cap and combined 48-hour weekly cap.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Breaks of 15 + 15 + 30 minutes are blocked inside the shift window.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Shift hours are paid/productive hours; the 60-minute break sits inside attendance.</li>
              </ul>
            </div>
            <div className="card card-pad-lg" style={{ background: 'var(--cream)' }}>
              <div className="row" style={{ marginBottom: 18 }}>
                <span className="icon-tile navy"><Icon name="calendar" /></span>
                <div>
                  <div style={{ fontWeight: 700 }}>A typical week</div>
                  <div className="tiny muted">Compliant by construction</div>
                </div>
              </div>
              <div className="kv">
                <div className="kv-row"><span className="kv-key">Shift</span><span className="kv-val">8 hours · 09:30–18:30</span></div>
                <div className="kv-row"><span className="kv-key">Working days</span><span className="kv-val">Tue, Wed, Thu, Fri</span></div>
                <div className="kv-row"><span className="kv-key">Breaks</span><span className="kv-val">15 + 30 + 15 minutes</span></div>
                <div className="kv-row"><span className="kv-key">Paid hours</span><span className="kv-val">32 hours / week</span></div>
                <div className="kv-row"><span className="kv-key">Off days</span><span className="kv-val">Sunday & Monday</span></div>
              </div>
              <div className="alert alert-brand" style={{ marginTop: 18 }}>
                <Icon name="shield-check" />
                <div>Overlapping bookings are blocked automatically, including time logged for another employer.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="split" style={{ alignItems: 'center' }}>
            <div className="card card-pad-lg" style={{ background: 'var(--navy)', color: '#dbe5f0' }}>
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="eyebrow" style={{ color: '#ff9aa6' }}>Assessment integrity</div>
                  <h2 style={{ color: '#fff', fontSize: '1.8rem', marginTop: 10 }}>Evidence, not AI guesswork.</h2>
                </div>
                <Badge tone="navy" className="badge-outline" >Human review</Badge>
              </div>
              <p style={{ marginTop: 14, color: '#a7b8cb', fontSize: '0.92rem', lineHeight: 1.75 }}>
                Practical, timed work reveals more than a polished CV. Every submission is scored against a published
                rubric by a human reviewer. We do not claim that AI-written answers can be detected with certainty,
                and we never use a detector as automated proof of misconduct.
              </p>
              <div className="grid grid-2" style={{ marginTop: 20 }}>
                {[
                  ['Timed practical tasks', 'Real work under realistic constraints'],
                  ['Published rubric', 'Transparent scoring criteria'],
                  ['Human review', 'Judgement, not a black box'],
                  ['Supporting signals', 'Prompts for review, never verdicts']
                ].map(([title, sub]) => (
                  <div key={title} style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,.05)' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>{title}</div>
                    <div className="tiny" style={{ color: '#8fa3bc', marginTop: 3 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionHeading
                eyebrow="For employers"
                title="Hire with a shorter, sharper process."
                description="Search verified professionals by category, experience, rate, availability and assessment score. Shortlist, run two structured rounds and hire with the contract and fee disclosure built in."
              />
              <ul className="feature-list">
                <li><Icon name="check-circle" className="icon-sm" /> Confidential contact details released only after shortlisting.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Round 1 panel and Round 2 final discussion, with scorecards.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Hiring requires a completed Round 2 with a “selected” outcome.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Employer invoices itemise charges, platform fee and GST.</li>
              </ul>
              <div className="row wrap" style={{ marginTop: 24 }}>
                <Link className="btn btn-primary" to="/register/employer">Create an employer account</Link>
                <Link className="btn btn-secondary" to="/for-employers">Employer overview</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <SectionHeading eyebrow="Questions" title="The things people ask first." align="center" />
          <Accordion items={faqs.map((faq) => ({ q: faq.q, a: faq.a }))} />
          <div className="center" style={{ marginTop: 24 }}>
            <Link className="btn btn-secondary" to="/faq">Read all FAQs <Icon name="arrow-right" className="icon-sm" /></Link>
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ paddingBottom: 90 }}>
        <div className="container">
          <div className="band-cta">
            <h2>Your experience is the product. Make it count.</h2>
            <p>
              Join a marketplace that respects your time, verifies capability and shows you the money before you commit.
              Registration is free. Public profiles are seeded demo data in this environment.
            </p>
            <div className="row wrap">
              <Link className="btn btn-white" to="/register/professional">Create your professional profile</Link>
              <Link className="btn btn-ghost" to="/contact">Talk to the Flamingo team</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
