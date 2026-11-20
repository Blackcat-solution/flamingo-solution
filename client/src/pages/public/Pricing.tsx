import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageHero } from '../../components/PublicPageHero';
import { Alert, Badge, Card, CardHeader, Field, Icon, Input, SectionHeading, Select } from '../../components/ui';
import { inr, titleCase } from '../../lib/format';
import { rupeesToPaise, useApi, useDocumentTitle } from '../../lib/hooks';

const LEVEL_ORDER: Record<string, number> = { mid: 1, senior: 2, lead: 3 };

export default function Pricing() {
  useDocumentTitle('Pricing, fees & benchmarks');
  const { data } = useApi<any>('/public/benchmarks');
  const { data: config } = useApi<any>('/public/config');
  const [amount, setAmount] = useState('20000');
  const [category, setCategory] = useState('all');

  const terms = config?.terms;
  const valuePaise = rupeesToPaise(amount || 0);
  const fee = terms?.activationFeePaise ?? 69900;
  const gstBps = terms?.gstRateBps ?? 1800;
  const advancePercent = terms?.advancePercent ?? 50;
  const advance = Math.round((valuePaise * advancePercent) / 100);
  const firstPayout = Math.max(0, advance - fee);
  const finalPayout = valuePaise - advance;
  const totalReceived = Math.max(0, valuePaise - fee);
  const feeBase = Math.round((fee * 10000) / (10000 + gstBps));
  const feeGst = fee - feeBase;

  const benchmarks = data?.benchmarks || [];
  const shown = useMemo(
    () => (category === 'all' ? benchmarks : benchmarks.filter((item: any) => item.category === category)),
    [benchmarks, category]
  );

  return (
    <>
      <PublicPageHero
        eyebrow="Pricing, fees & sourced benchmarks"
        title="See every rupee before you commit."
        lead="Registration is free. A single activation fee applies only when an assignment activates, and it is deducted once from your first payout. Flamingo publishes where its rate ranges come from and what it does not know."
        meta={
          <>
            <span><Icon name="check-circle" className="icon-sm" /> No subscription</span>
            <span><Icon name="check-circle" className="icon-sm" /> No charge without an assignment</span>
            <span><Icon name="check-circle" className="icon-sm" /> GST itemised</span>
          </>
        }
      />

      <section className="section-tight">
        <div className="container">
          <div className="money-hero">
            <div className="money-hero-grid">
              <div>
                <span className="eyebrow" style={{ color: '#ff9aa6' }}>The exact model</span>
                <h2>50% advance. 50% on completion. One disclosed fee.</h2>
                <p>
                  The employer funds half the assignment value when both parties accept the contract. The other half
                  is released after completion is approved. The activation fee is GST-inclusive and deducted from the
                  professional&apos;s first payout - never as a recurring charge.
                </p>
                <div className="rule-grid" style={{ marginTop: 24 }}>
                  <div className="rule" style={{ background: 'rgba(255,255,255,.06)' }}>
                    <strong style={{ color: '#fff' }}>{inr(fee)}</strong>
                    <span style={{ color: '#a7b8cb' }}>One-time activation fee</span>
                  </div>
                  <div className="rule" style={{ background: 'rgba(255,255,255,.06)' }}>
                    <strong style={{ color: '#fff' }}>{advancePercent}%</strong>
                    <span style={{ color: '#a7b8cb' }}>Advance on signature</span>
                  </div>
                  <div className="rule" style={{ background: 'rgba(255,255,255,.06)' }}>
                    <strong style={{ color: '#fff' }}>{100 - advancePercent}%</strong>
                    <span style={{ color: '#a7b8cb' }}>After completion</span>
                  </div>
                  <div className="rule" style={{ background: 'rgba(255,255,255,.06)' }}>
                    <strong style={{ color: '#fff' }}>0</strong>
                    <span style={{ color: '#a7b8cb' }}>Charge if you decline</span>
                  </div>
                </div>
              </div>

              <div className="money-sheet">
                <div className="money-sheet-title">
                  <div>
                    <div className="hero-card-label">Payout calculator</div>
                    <div style={{ fontWeight: 700, marginTop: 3 }}>Try your own assignment value</div>
                  </div>
                  <Badge tone="brand">Live</Badge>
                </div>
                <Field label="Assignment value (INR)" htmlFor="calc-amount" hint="Enter the total contracted value.">
                  <Input
                    id="calc-amount"
                    type="number"
                    min={0}
                    step={500}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </Field>
                <div style={{ marginTop: 14 }}>
                  <div className="money-line"><span>Assignment value</span><span className="num">{inr(valuePaise)}</span></div>
                  <div className="money-line"><span>Advance @ {advancePercent}%</span><span className="num">{inr(advance)}</span></div>
                  <div className="money-line deduct"><span>Activation fee (once)</span><span className="num">-{inr(fee)}</span></div>
                  <div className="money-line"><span>First payout</span><span className="num">{inr(firstPayout)}</span></div>
                  <div className="money-line"><span>Final payout @ {100 - advancePercent}%</span><span className="num">{inr(finalPayout)}</span></div>
                </div>
                <div className="money-total"><span>Total received by professional</span><strong>{inr(totalReceived)}</strong></div>
                <p className="money-note">
                  Activation fee of {inr(fee)} = base {inr(feeBase)} + GST {inr(feeGst)}. Platform fee is
                  {' '}{String((terms?.platformFeeBps ?? 0) / 100)}% in this demonstration configuration. If the
                  assignment value is lower than the fee, the first payout floors at zero and the balance is handled
                  by support - no negative payout is ever issued.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="What you pay for"
            title="A fee tied to a real engagement, not a login."
            description="The fee funds the work that makes a placement trustworthy. It is disclosed before acceptance and itemised on the statement."
          />
          <div className="grid grid-3">
            <Card className="feature-card">
              <span className="icon-tile"><Icon name="shield-check" /></span>
              <h3>Verification & assessment</h3>
              <p>Identity and experience checks, assessment administration and human review of practical work.</p>
            </Card>
            <Card className="feature-card">
              <span className="icon-tile gold"><Icon name="file-text" /></span>
              <h3>Contract & reconciliation</h3>
              <p>Assignment contracting, activation-fee disclosure, invoice reconciliation and payout administration.</p>
            </Card>
            <Card className="feature-card">
              <span className="icon-tile green"><Icon name="message" /></span>
              <h3>Support & dispute handling</h3>
              <p>Human support for scheduling, timesheets, payment queries and review challenges.</p>
            </Card>
          </div>
          <Alert tone="warning" title="Demonstration configuration" >
            Payments, verification and payouts are simulated in this environment. No live money moves. Production
            collection and settlement must run through an RBI-authorised payment aggregator and its escrow or nodal
            arrangements. GST and TDS treatment must be confirmed by a qualified adviser.
          </Alert>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <SectionHeading
            eyebrow="Sourced rate ranges"
            title="Benchmarks, with their sources attached."
            description="These are recommendation ranges compiled from published sources and documented assumptions. They are not audited market facts, and Flamingo will not recommend a rate without a source."
            actions={
              <Field label="Category" htmlFor="bench-category">
                <Select id="bench-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="all">All categories</option>
                  {benchmarks.map((item: any) => (
                    <option key={item.category} value={item.category}>{item.label}</option>
                  ))}
                </Select>
              </Field>
            }
          />
          {data?.methodology ? <p className="tiny muted" style={{ marginTop: -22, marginBottom: 22 }}>{data.methodology}</p> : null}

          <div className="stack">
            {shown.map((group: any) => (
              <Card key={group.category}>
                <CardHeader
                  title={group.label}
                  subtitle={`${group.levels.length} experience levels. Last reviewed ${data?.lastReviewed || '—'}.`}
                  actions={<Badge tone="outline">{titleCase(group.category)}</Badge>}
                />
                <div className="bench-list">
                  {[...group.levels].sort((a: any, b: any) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]).map((level: any) => {
                    const span = Math.max(1, level.maxHourlyPaise - level.minHourlyPaise);
                    const position = ((level.medianHourlyPaise - level.minHourlyPaise) / span) * 100;
                    return (
                      <div className="bench-row" key={level.level}>
                        <div>
                          <div className="bench-name">{titleCase(level.level)}</div>
                          <div className="bench-level">Demand index {Number(level.demandIndex || 1).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="bench-bar">
                            <span className="bench-bar-marker" style={{ left: `${Math.max(2, Math.min(98, position))}%` }} />
                          </div>
                          <div className="bench-level" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{inr(level.minHourlyPaise)}</span>
                            <span>median {inr(level.medianHourlyPaise)}</span>
                            <span>{inr(level.maxHourlyPaise)}</span>
                          </div>
                        </div>
                        <div className="bench-range">
                          <strong>{inr(level.medianHourlyPaise)}</strong>
                          <div>/ hour</div>
                        </div>
                        {level.source ? (
                          <div className="bench-source">
                            <span>Source: {level.source.name}</span>
                            <span>
                              {level.source.url ? (
                                <a href={level.source.url} target="_blank" rel="noreferrer">{level.source.url.replace(/^https?:\/\//, '').slice(0, 46)}</a>
                              ) : null}
                              {' · '}as of {level.source.asOf}
                            </span>
                          </div>
                        ) : null}
                        {level.notes ? <div className="bench-source"><span>{level.notes}</span></div> : null}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          <div className="notice" style={{ marginTop: 26 }}>
            <strong>How to read these ranges</strong>
            Ranges are hourly recommendations for Indian professional-services contractors. Medians may be derived
            from salary bands converted with a documented contractor loading where a published contractor median is
            unavailable. Review <span className="mono">docs/RESEARCH.md</span> in the project for sources, dates and
            assumptions. No benchmark is fabricated.
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="split" style={{ alignItems: 'center' }}>
            <div>
              <SectionHeading eyebrow="Employer billing" title="Invoices you can reconcile." description="Employer invoices separate professional charges, platform fee, GST and any other disclosed charges. No bundled mystery line items." />
              <ul className="feature-list">
                <li><Icon name="check-circle" className="icon-sm" /> 50% advance invoice and 50% final invoice.</li>
                <li><Icon name="check-circle" className="icon-sm" /> GST shown on the platform fee, not hidden in a total.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Simulated gateway reference retained on every payment.</li>
                <li><Icon name="check-circle" className="icon-sm" /> Dispute window disclosed on the assignment contract.</li>
              </ul>
            </div>
            <div className="card card-pad">
              <div className="between" style={{ marginBottom: 14 }}>
                <strong>Sample invoice</strong>
                <Badge tone="outline">Demo</Badge>
              </div>
              <div className="kv">
                <div className="kv-row"><span className="kv-key">Professional charges</span><span className="kv-val">{inr(advance)}</span></div>
                <div className="kv-row"><span className="kv-key">Platform fee</span><span className="kv-val">{inr(0)}</span></div>
                <div className="kv-row"><span className="kv-key">GST on platform fee</span><span className="kv-val">{inr(0)}</span></div>
                <div className="kv-row"><span className="kv-key">Other disclosed charges</span><span className="kv-val">{inr(0)}</span></div>
                <div className="kv-row"><span className="kv-key strong">Invoice total</span><span className="kv-val strong">{inr(advance)}</span></div>
              </div>
              <Link className="btn btn-secondary btn-block" to="/for-employers" style={{ marginTop: 16 }}>
                Employer overview <Icon name="arrow-right" className="icon-sm" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
