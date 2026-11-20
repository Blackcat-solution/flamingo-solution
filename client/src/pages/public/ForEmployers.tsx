import { Link } from 'react-router-dom';
import { PublicPageHero } from '../../components/PublicPageHero';
import { Badge, Card, Icon, SectionHeading } from '../../components/ui';
import { useDocumentTitle } from '../../lib/hooks';
import { inr } from '../../lib/format';

export default function ForEmployers() {
  useDocumentTitle('For employers');

  return (
    <>
      <PublicPageHero
        eyebrow="For employers"
        title={<>Verified capability. <span className="text-brand">Two rounds.</span> No guesswork.</>}
        lead="Find experienced professionals who have passed identity, experience and practical assessment checks. Shortlist, interview twice at most, and contract with transparent payment terms."
        actions={
          <>
            <Link className="btn btn-primary" to="/register/employer">Create an employer account</Link>
            <Link className="btn btn-secondary" to="/professionals">Browse talent</Link>
          </>
        }
        meta={
          <>
            <span><Icon name="check-circle" className="icon-sm" /> Verified organisations</span>
            <span><Icon name="check-circle" className="icon-sm" /> Structured scorecards</span>
            <span><Icon name="check-circle" className="icon-sm" /> 50/50 payment plan</span>
          </>
        }
        aside={
          <Card className="card-pad-lg">
            <div className="eyebrow eyebrow-plain">Hiring guardrails</div>
            <h3 style={{ marginTop: 6, fontSize: '1.2rem' }}>What is enforced by the platform</h3>
            <ul className="feature-list" style={{ marginTop: 14 }}>
              <li><Icon name="check-circle" className="icon-sm" /> Employer verification before shortlisting or hiring</li>
              <li><Icon name="check-circle" className="icon-sm" /> Contact details released only for shortlisted candidates</li>
              <li><Icon name="check-circle" className="icon-sm" /> Round 1 scorecard required before Round 2</li>
              <li><Icon name="check-circle" className="icon-sm" /> “Selected” outcome only after completed Round 2</li>
              <li><Icon name="check-circle" className="icon-sm" /> Both parties sign before any payment</li>
              <li><Icon name="check-circle" className="icon-sm" /> Final payment only after completion approval</li>
            </ul>
          </Card>
        }
      />

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="The hiring process" title="Three decisions, not thirty steps." />
          <div className="steps">
            <div className="step">
              <span className="step-num">01</span>
              <h3>Search and shortlist</h3>
              <p>Filter by category, skills, city, experience, hourly rate, rating, availability and assessment score. Add a note and attach a requirement.</p>
            </div>
            <div className="step">
              <span className="step-num">02</span>
              <h3>Run two structured rounds</h3>
              <p>Round 1 is a panel interview with a scorecard. Round 2 is the final discussion on expectations and arrangements. There is no third round.</p>
            </div>
            <div className="step">
              <span className="step-num">03</span>
              <h3>Contract and activate</h3>
              <p>Set scope, deliverables, working pattern and rate. Both parties sign. Fund the 50% advance; work begins.</p>
            </div>
            <div className="step">
              <span className="step-num">04</span>
              <h3>Approve and release</h3>
              <p>Approve timesheets, confirm completion, release the final 50%, then publish a structured performance review.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="split" style={{ alignItems: 'center' }}>
            <div>
              <SectionHeading eyebrow="Evidence layer" title="A profile that has actually been checked." />
              <p className="lead">
                Public candidates have passed identity and experience verification plus a Flamingo assessment. The
                assessment combines objective questions with practical work scored by a human reviewer against a
                published rubric.
              </p>
              <div className="grid grid-2" style={{ marginTop: 22 }}>
                {[
                  ['Identity verified', 'Government identity document reviewed by the onboarding team.'],
                  ['Experience verified', 'Employment history and at least one professional reference checked.'],
                  ['Capability assessed', 'Timed practical work, objective questions and rubric scoring.'],
                  ['Conduct visible', 'Completed assignments, ratings and rehire rate on the public profile.']
                ].map(([title, copy]) => (
                  <div className="panel" key={title}>
                    <div className="row"><Icon name="shield-check" className="icon-sm text-success" /><strong className="small">{title}</strong></div>
                    <p className="tiny muted" style={{ marginTop: 6 }}>{copy}</p>
                  </div>
                ))}
              </div>
            </div>
            <Card className="card-pad-lg">
              <div className="between">
                <div>
                  <div className="hero-card-label">Candidate snapshot</div>
                  <h3 style={{ marginTop: 4 }}>Senior React Engineer</h3>
                </div>
                <Badge tone="success" dot>Verified</Badge>
              </div>
              <div className="kv" style={{ marginTop: 14 }}>
                <div className="kv-row"><span className="kv-key">Experience</span><span className="kv-val">8 years</span></div>
                <div className="kv-row"><span className="kv-key">Assessment</span><span className="kv-val">86/100 · passed</span></div>
                <div className="kv-row"><span className="kv-key">Rating</span><span className="kv-val">4.8 / 5 · 14 assignments</span></div>
                <div className="kv-row"><span className="kv-key">Rehire rate</span><span className="kv-val">92%</span></div>
                <div className="kv-row"><span className="kv-key">Availability</span><span className="kv-val">Tue–Thu · 8h shifts</span></div>
                <div className="kv-row"><span className="kv-key">Rate</span><span className="kv-val">₹1,450 / hour</span></div>
              </div>
              <div className="alert alert-brand" style={{ marginTop: 16 }}>
                <Icon name="lock" />
                <div>Contact details are withheld until you shortlist. Every contact view is written to the audit log.</div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Money" title="An invoice you can explain to finance." align="center" />
          <div className="grid grid-2" style={{ maxWidth: 980, margin: '0 auto' }}>
            <Card className="card-pad-lg">
              <h3>Employer payment plan</h3>
              <p className="small muted" style={{ marginTop: 8 }}>Assignment value is professional charges only. Flamingo's platform fee is shown separately; it is 0% in this demo configuration.</p>
              <div style={{ marginTop: 16 }}>
                <div className="money-line"><span>Assignment value</span><span className="num">{inr(2000000)}</span></div>
                <div className="money-line"><span>Advance on signature (50%)</span><span className="num">{inr(1000000)}</span></div>
                <div className="money-line"><span>Final on completion (50%)</span><span className="num">{inr(1000000)}</span></div>
                <div className="money-line"><span>Platform fee (0%)</span><span className="num">{inr(0)}</span></div>
                <div className="money-line"><span>GST on platform fee</span><span className="num">{inr(0)}</span></div>
              </div>
              <div className="money-total"><span>Total employer cost</span><strong>{inr(2000000)}</strong></div>
            </Card>
            <Card className="card-pad-lg">
              <h3>Professional payout</h3>
              <p className="small muted" style={{ marginTop: 8 }}>The one-time ₹699 activation fee is deducted from the professional's first payout, not added to the employer invoice.</p>
              <div style={{ marginTop: 16 }}>
                <div className="money-line"><span>First payout gross</span><span className="num">{inr(1000000)}</span></div>
                <div className="money-line deduct"><span>Activation fee (once)</span><span className="num">−{inr(69900)}</span></div>
                <div className="money-line"><span>First payout net</span><span className="num">{inr(930100)}</span></div>
                <div className="money-line"><span>Final payout net</span><span className="num">{inr(1000000)}</span></div>
              </div>
              <div className="money-total"><span>Professional receives</span><strong>{inr(1930100)}</strong></div>
            </Card>
          </div>
          <p className="tiny muted" style={{ textAlign: 'center', marginTop: 18, maxWidth: 720, marginInline: 'auto' }}>
            Demonstration figures. Production invoices must comply with applicable GST rules. TDS under section 194-O is
            modelled but only applied when the statutory threshold and PAN conditions are met.
          </p>
        </div>
      </section>

      <section className="section-tight" style={{ background: '#fff', borderTop: '1px solid var(--line)' }}>
        <div className="container">
          <div className="grid grid-2" style={{ alignItems: 'center' }}>
            <div>
              <SectionHeading eyebrow="Scheduling" title="Overlaps are blocked before they become problems." />
              <ul className="feature-list">
                <li><Icon name="check-circle" className="icon-sm" /> Up to four working days per week, Tuesday to Saturday.</li>
                <li><Icon name="check-circle" className="icon-sm" /> 8, 10 or 12-hour shifts with 15 + 15 + 30 minutes of breaks.</li>
                <li><Icon name="check-circle" className="icon-sm" /> 12-hour daily and 48-hour weekly combined caps.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Candidate clash detection across interviews and assignments.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Timesheets validated against the agreed days and hours.</li>
              </ul>
            </div>
            <Card className="card-dark card-pad-lg">
              <h3 style={{ color: '#fff' }}>What you will not find here</h3>
              <ul className="feature-list" style={{ marginTop: 14 }}>
                <li style={{ color: '#c5d2e1' }}><Icon name="x-circle" className="icon-sm" style={{ color: '#ff8a98' }} /> Unverified employers browsing contact details</li>
                <li style={{ color: '#c5d2e1' }}><Icon name="x-circle" className="icon-sm" style={{ color: '#ff8a98' }} /> Unlimited interview rounds</li>
                <li style={{ color: '#c5d2e1' }}><Icon name="x-circle" className="icon-sm" style={{ color: '#ff8a98' }} /> AI-detection verdicts presented as fact</li>
                <li style={{ color: '#c5d2e1' }}><Icon name="x-circle" className="icon-sm" style={{ color: '#ff8a98' }} /> Hidden professional deductions</li>
                <li style={{ color: '#c5d2e1' }}><Icon name="x-circle" className="icon-sm" style={{ color: '#ff8a98' }} /> Claims of escrow without an authorised aggregator</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ paddingBottom: 90 }}>
        <div className="container">
          <div className="band-cta">
            <h2>Hire with evidence, not a stack of CVs.</h2>
            <p>Create an employer account, complete verification and search the seeded demo marketplace.</p>
            <div className="row wrap">
              <Link className="btn btn-white" to="/register/employer">Start hiring</Link>
              <Link className="btn btn-ghost" to="/pricing">Review pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
