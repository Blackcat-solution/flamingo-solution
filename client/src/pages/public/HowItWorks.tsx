import { Link } from 'react-router-dom';
import { PublicPageHero } from '../../components/PublicPageHero';
import { Badge, Card, Icon, SectionHeading, Alert } from '../../components/ui';
import { useDocumentTitle } from '../../lib/hooks';
import { inr } from '../../lib/format';

export default function HowItWorks() {
  useDocumentTitle('How it works');

  return (
    <>
      <PublicPageHero
        eyebrow="How Flamingo works"
        title={<>A shorter path from <span className="text-brand">proven experience</span> to paid work.</>}
        lead="Flamingo connects experienced professionals with verified employers through a focused process: verify, assess, interview twice at most, contract with transparent terms, then work and get paid."
        actions={
          <>
            <Link className="btn btn-primary" to="/register/professional">Join as a professional</Link>
            <Link className="btn btn-secondary" to="/register/employer">Hire talent</Link>
          </>
        }
        aside={
          <Card className="card-pad-lg">
            <div className="eyebrow eyebrow-plain">The promise</div>
            <h3 style={{ fontSize: '1.25rem', marginTop: 8 }}>No pay-to-apply. No hidden cut.</h3>
            <ul className="feature-list" style={{ marginTop: 16 }}>
              <li><Icon name="check-circle" className="icon-sm" /> Free registration and first assessment</li>
              <li><Icon name="check-circle" className="icon-sm" /> ₹699 activation fee, once per assignment</li>
              <li><Icon name="check-circle" className="icon-sm" /> 50% advance + 50% on completion</li>
              <li><Icon name="check-circle" className="icon-sm" /> Fee deducted from the first payout only</li>
              <li><Icon name="check-circle" className="icon-sm" /> No charge if you decline before activation</li>
            </ul>
            <div className="money-total" style={{ marginTop: 18 }}>
              <span>₹20,000 example</span>
              <strong>{inr(1930100)}</strong>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>Net received after the one-time ₹699 activation fee.</p>
          </Card>
        }
      />

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Two sides, one standard"
            title="Designed to reduce risk for both parties."
            description="Professionals get control over time and rate. Employers get evidence of capability. The platform enforces the rules in between."
          />
          <div className="compare-grid">
            <Card className="compare-col card-pad-lg">
              <Badge tone="brand">For professionals</Badge>
              <h3 style={{ marginTop: 14 }}>Your experience is the asset.</h3>
              <ul className="compare-list">
                <li><Icon name="check" className="icon-sm yes" /> Free profile, free first assessment</li>
                <li><Icon name="check" className="icon-sm yes" /> Choose 8, 10 or 12-hour shifts and up to four working days</li>
                <li><Icon name="check" className="icon-sm yes" /> Sunday and Monday off, with overlap protection across employers</li>
                <li><Icon name="check" className="icon-sm yes" /> Publish a rate inside a transparent, sourced market range</li>
                <li><Icon name="check" className="icon-sm yes" /> See the ₹699 fee and 50/50 plan before accepting</li>
                <li><Icon name="check" className="icon-sm yes" /> Keep a permanent career record of verified work</li>
              </ul>
            </Card>
            <Card className="compare-col alt card-pad-lg">
              <Badge tone="navy">For employers</Badge>
              <h3 style={{ marginTop: 14 }}>Evidence before commitment.</h3>
              <ul className="compare-list">
                <li><Icon name="check" className="icon-sm yes" /> Search verified, assessed professionals by category and rate</li>
                <li><Icon name="check" className="icon-sm yes" /> Shortlist first; confidential contact details follow</li>
                <li><Icon name="check" className="icon-sm yes" /> Structured Round 1 and final Round 2, with scorecards</li>
                <li><Icon name="check" className="icon-sm yes" /> Hiring requires a completed final round marked “selected”</li>
                <li><Icon name="check" className="icon-sm yes" /> 50% advance, 50% after approved completion</li>
                <li><Icon name="check" className="icon-sm yes" /> Itemised invoices: charges, platform fee, GST</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <SectionHeading eyebrow="The process" title="Six stages. No busywork." />
          <div className="stack-lg">
            {[
              {
                step: '01',
                title: 'Register and build your profile',
                professional: 'Add at least three years of experience, skills, education, employment history and one reference. Choose your availability and preferred shift.',
                employer: 'Register your organisation, upload incorporation and GST documents, and add a billing contact.',
                icon: 'user' as const
              },
              {
                step: '02',
                title: 'Verify and assess',
                professional: 'Upload identity and experience documents. Complete a timed assessment: objective questions plus a practical task scored against a rubric.',
                employer: 'The Flamingo onboarding team verifies your organisation. Browsing is open; shortlisting, interviewing and hiring unlock after verification.',
                icon: 'shield-check' as const
              },
              {
                step: '03',
                title: 'Discover and shortlist',
                professional: 'Once verified and assessed, choose whether your profile is public. You can turn visibility off at any time without losing your record.',
                employer: 'Use filters for category, skills, city, experience, rate, rating and assessment score. Shortlist candidates and attach a requirement.',
                icon: 'search' as const
              },
              {
                step: '04',
                title: 'Interview — two rounds maximum',
                professional: 'Round 1 is a panel conversation. Round 2 is the final discussion on expectations, arrangements and commitment.',
                employer: 'Schedule both rounds, capture panel scorecards and record an outcome. Selection is only valid after Round 2.',
                icon: 'video' as const
              },
              {
                step: '05',
                title: 'Contract, disclose, activate',
                professional: 'Review the scope, deliverables, working pattern, payment terms, cancellation terms and the one-time ₹699 fee. Accept only when comfortable.',
                employer: 'Both parties accept the digital contract. Fund the 50% advance; the activation fee is deducted from the first professional payout.',
                icon: 'file-text' as const
              },
              {
                step: '06',
                title: 'Work, approve, review',
                professional: 'Log only compliant time. Submit completion evidence. The employer approves and releases the final 50%.',
                employer: 'Approve or reject timesheets with a note. Approve completion, pay the final 50%, and publish a structured performance review.',
                icon: 'check-circle' as const
              }
            ].map((item) => (
              <Card key={item.step} className="card-pad-lg">
                <div className="split" style={{ alignItems: 'center', gap: 32 }}>
                  <div className="row-top">
                    <span className="icon-tile" style={{ flexShrink: 0 }}><Icon name={item.icon} /></span>
                    <div>
                      <div className="eyebrow eyebrow-plain">Stage {item.step}</div>
                      <h3 style={{ fontSize: '1.15rem', marginTop: 5 }}>{item.title}</h3>
                      <p className="small muted" style={{ marginTop: 7 }}>
                        <strong style={{ color: 'var(--ink)' }}>Professional:</strong> {item.professional}
                      </p>
                      <p className="small muted" style={{ marginTop: 4 }}>
                        <strong style={{ color: 'var(--ink)' }}>Employer:</strong> {item.employer}
                      </p>
                    </div>
                  </div>
                  <div className="panel" style={{ background: 'var(--cream)' }}>
                    <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Controls</div>
                    <ul className="feature-list" style={{ marginTop: 10 }}>
                      {item.step === '01' && <><li><Icon name="check" className="icon-sm" /> Minimum 3 years experience</li><li><Icon name="check" className="icon-sm" /> Progressive profiling</li></>}
                      {item.step === '02' && <><li><Icon name="check" className="icon-sm" /> Encrypted uploads</li><li><Icon name="check" className="icon-sm" /> Human rubric review</li></>}
                      {item.step === '03' && <><li><Icon name="check" className="icon-sm" /> Public visibility opt-in</li><li><Icon name="check" className="icon-sm" /> Contact gated by shortlist</li></>}
                      {item.step === '04' && <><li><Icon name="check" className="icon-sm" /> Round cap of two</li><li><Icon name="check" className="icon-sm" /> Clash detection</li></>}
                      {item.step === '05' && <><li><Icon name="check" className="icon-sm" /> Fee disclosure first</li><li><Icon name="check" className="icon-sm" /> Both-party signature</li></>}
                      {item.step === '06' && <><li><Icon name="check" className="icon-sm" /> Timesheet rules enforced</li><li><Icon name="check" className="icon-sm" /> Review response rights</li></>}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="split">
            <div>
              <SectionHeading eyebrow="Working time" title="The rules are not decoration." />
              <p className="lead">
                Every booking runs through the same scheduling engine. Shift hours are paid/productive hours; the
                mandatory 60-minute break entitlement sits inside the attendance window.
              </p>
              <div className="rule-grid" style={{ marginTop: 22 }}>
                <div className="rule"><strong>8 / 10 / 12</strong><span>Shift hours</span></div>
                <div className="rule"><strong>4</strong><span>Days per week, maximum</span></div>
                <div className="rule"><strong>Tue–Sat</strong><span>Available working days</span></div>
                <div className="rule"><strong>Sun–Mon</strong><span>Compulsory rest days</span></div>
              </div>
              <div className="stack-sm" style={{ marginTop: 18 }}>
                <div className="row"><Icon name="check-circle" className="icon-sm text-success" /><span className="small">12-hour daily cap and 48-hour weekly cap across all employers.</span></div>
                <div className="row"><Icon name="check-circle" className="icon-sm text-success" /><span className="small">Breaks of 15 + 15 + 30 minutes, blocked inside the shift window.</span></div>
                <div className="row"><Icon name="check-circle" className="icon-sm text-success" /><span className="small">No overlapping bookings; timesheets cannot overlap time logged elsewhere.</span></div>
              </div>
            </div>
            <Card className="card-pad-lg">
              <h3 className="card-title">What a compliant week looks like</h3>
              <div className="kv" style={{ marginTop: 14 }}>
                <div className="kv-row"><span className="kv-key">Monday</span><span className="kv-val text-muted">Off — compulsory</span></div>
                <div className="kv-row"><span className="kv-key">Tuesday</span><span className="kv-val">09:30–18:30 · 8h</span></div>
                <div className="kv-row"><span className="kv-key">Wednesday</span><span className="kv-val">09:30–18:30 · 8h</span></div>
                <div className="kv-row"><span className="kv-key">Thursday</span><span className="kv-val">09:30–18:30 · 8h</span></div>
                <div className="kv-row"><span className="kv-key">Friday</span><span className="kv-val">09:30–18:30 · 8h</span></div>
                <div className="kv-row"><span className="kv-key">Saturday</span><span className="kv-val text-muted">Off — not selected</span></div>
                <div className="kv-row"><span className="kv-key">Sunday</span><span className="kv-val text-muted">Off — compulsory</span></div>
              </div>
              <div className="alert alert-info" style={{ marginTop: 16 }}>
                <Icon name="info" />
                <div>Paid hours: 32. Attendance window: 40 hours including 4 × 60-minute breaks. Breaks are unpaid rest, not extra billing hours.</div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <Alert tone="warning" title="Demonstration environment">
            This build is a product demonstration. Identity checks, assessments, payment capture and payouts are
            simulated; no real money moves and no real identity documents are processed. Production deployment would
            require an RBI-authorised payment aggregator, legal review of contract templates, and confirmation of GST
            and TDS treatment by a qualified adviser.
          </Alert>
          <div className="band-cta" style={{ marginTop: 28 }}>
            <h2>Start with a profile. Decide the rest later.</h2>
            <p>Registration is free. Take the assessment before you commit to any working pattern or rate.</p>
            <div className="row wrap">
              <Link className="btn btn-white" to="/register/professional">Create a profile</Link>
              <Link className="btn btn-ghost" to="/pricing">Review pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
