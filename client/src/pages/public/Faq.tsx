import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageHero } from '../../components/PublicPageHero';
import { Accordion, Card, Icon, SectionHeading } from '../../components/ui';
import { useApi, useDocumentTitle } from '../../lib/hooks';

const GROUPS: Array<{ key: string; label: string; match: RegExp }> = [
  { key: 'all', label: 'All questions', match: /.*/ },
  { key: 'money', label: 'Pricing & payouts', match: /fee|pay|money|invoice|gst/i },
  { key: 'work', label: 'Working pattern', match: /working|shift|break|hours|day|employer/i },
  { key: 'trust', label: 'Verification & assessments', match: /verif|assess|profil|ai|integrity/i }
];

export default function Faq() {
  useDocumentTitle('Frequently asked questions');
  const { data } = useApi<{ faqs: any[] }>('/public/faqs');
  const [group, setGroup] = useState('all');

  const faqs = data?.faqs || [];
  const shown = useMemo(() => {
    const active = GROUPS.find((item) => item.key === group) || GROUPS[0];
    return faqs.filter((faq) => active.match.test(`${faq.q} ${faq.a}`));
  }, [faqs, group]);

  return (
    <>
      <PublicPageHero
        eyebrow="Questions"
        title="The answers, without the fog."
        lead="Straight answers on fees, working time, verification and assessment integrity. If a question is not covered, ask us and we will add it."
        actions={<Link className="btn btn-secondary" to="/contact">Ask a question <Icon name="arrow-right" className="icon-sm" /></Link>}
      />

      <section className="section-tight">
        <div className="container-narrow">
          <div className="segmented" style={{ marginBottom: 22, flexWrap: 'wrap' }}>
            {GROUPS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={group === item.key ? 'active' : undefined}
                onClick={() => setGroup(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {shown.length ? (
            <Accordion items={shown.map((faq) => ({ q: faq.q, a: faq.a }))} />
          ) : (
            <Card className="card-pad">
              <p className="muted">No questions in this group yet. Ask the team and we will publish an answer.</p>
            </Card>
          )}

          <div className="grid grid-3" style={{ marginTop: 30 }}>
            <Card className="card-pad">
              <span className="icon-tile"><Icon name="wallet" /></span>
              <h3 className="card-title" style={{ marginTop: 12 }}>Money model</h3>
              <p className="page-sub">See the exact 50/50 split, the one-time activation fee and itemised invoice lines.</p>
              <Link className="btn btn-secondary btn-sm" to="/pricing" style={{ marginTop: 14 }}>Pricing & benchmarks</Link>
            </Card>
            <Card className="card-pad">
              <span className="icon-tile green"><Icon name="shield-check" /></span>
              <h3 className="card-title" style={{ marginTop: 12 }}>Trust model</h3>
              <p className="page-sub">Verification gates, encrypted documents, human review and dispute handling.</p>
              <Link className="btn btn-secondary btn-sm" to="/trust-safety" style={{ marginTop: 14 }}>Trust & safety</Link>
            </Card>
            <Card className="card-pad">
              <span className="icon-tile gold"><Icon name="calendar" /></span>
              <h3 className="card-title" style={{ marginTop: 12 }}>Working rules</h3>
              <p className="page-sub">Shift options, mandatory off days, caps, breaks and overlap protection.</p>
              <Link className="btn btn-secondary btn-sm" to="/how-it-works" style={{ marginTop: 14 }}>How it works</Link>
            </Card>
          </div>

          <div style={{ marginTop: 44 }}>
            <SectionHeading eyebrow="Still unsure?" title="Talk to a human." description="No chat-bot maze. Send a question and the team will respond within one business day." />
            <div className="row wrap">
              <Link className="btn btn-primary" to="/contact">Contact Flamingo</Link>
              <Link className="btn btn-secondary" to="/register/professional">Create a free profile</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
