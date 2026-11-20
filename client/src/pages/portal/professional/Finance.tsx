import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Icon, Loading, PageHeader,
  Stat, StatusBadge, Tabs
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { dateLabel, inr } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

type Filter = 'all' | 'advance' | 'final';

export default function ProfessionalFinance() {
  useDocumentTitle('Financial centre');
  const { data, loading, error } = useApi<any>('/professional/finance/summary');
  const [filter, setFilter] = useState<Filter>('all');

  const payouts = data?.payouts || [];
  const filtered = useMemo(
    () => payouts.filter((payout: any) => filter === 'all' || payout.type === filter),
    [payouts, filter]
  );

  if (loading) return <Loading label="Preparing your statement." />;
  if (error) return <Alert tone="danger" title="Could not load your financial centre">{error}</Alert>;
  if (!data) return null;

  const { totals, activationFees, statementNote } = data;
  const paidPayouts = payouts.filter((payout: any) => payout.status === 'paid').length;

  const exportStatement = () => {
    const header = ['Reference', 'Assignment', 'Employer', 'Type', 'Gross (INR)', 'Activation fee (INR)', 'TDS (INR)', 'Net (INR)', 'Status', 'Created'];
    const rows: Array<Array<unknown>> = payouts.map((payout: any) => [
      payout.payout_ref,
      payout.code,
      payout.org_name,
      payout.type,
      (payout.gross_paise / 100).toFixed(2),
      (payout.activation_fee_paise / 100).toFixed(2),
      (payout.tds_paise / 100).toFixed(2),
      (payout.net_paise / 100).toFixed(2),
      payout.status,
      payout.created_at
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `flamingo-payout-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Financial centre"
        eyebrow="Earnings & payouts"
        description="Every payout in one auditable statement. Gross, the one-time activation fee, tax deducted at source and the net amount are itemised separately."
        actions={
          <Button variant="secondary" onClick={exportStatement} disabled={!payouts.length}>
            <Icon name="download" className="icon-sm" /> Export statement
          </Button>
        }
      />

      <div className="grid grid-4">
        <Stat label="Net received" value={inr(totals.netPaidPaise)} sub={`${paidPayouts} settled payout${paidPayouts === 1 ? '' : 's'}`} icon="wallet" tone="success" />
        <Stat label="Pending & processing" value={inr(totals.pendingPaise)} sub="Not yet settled to your account" icon="clock" tone="warning" />
        <Stat label="Gross earned" value={inr(totals.grossEarnedPaise)} sub="Before fees and TDS" icon="trending-up" />
        <Stat label="Activation fees" value={inr(totals.activationFeesPaise)} sub="Deducted once per activated assignment" icon="percent" />
      </div>

      <div className="split split-finance" style={{ marginTop: 26 }}>
        <div className="stack-lg">
          <Card>
            <CardHeader
              title="Payout statement"
              subtitle="Advances and final settlements for each assignment. Amounts are in Indian rupees."
              actions={
                <Tabs<Filter>
                  active={filter}
                  onChange={setFilter}
                  tabs={[
                    { key: 'all', label: 'All', count: payouts.length },
                    { key: 'advance', label: 'Advance', count: payouts.filter((payout: any) => payout.type === 'advance').length },
                    { key: 'final', label: 'Final', count: payouts.filter((payout: any) => payout.type === 'final').length }
                  ]}
                />
              }
            />
            {filtered.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Assignment</th>
                      <th>Type</th>
                      <th className="num">Gross</th>
                      <th className="num">Fee</th>
                      <th className="num">TDS</th>
                      <th className="num">Net</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((payout: any) => (
                      <tr key={payout.id}>
                        <td>
                          <div className="mono tiny">{payout.payout_ref}</div>
                          <div className="tiny muted">{dateLabel(payout.created_at)}</div>
                        </td>
                        <td>
                          <div className="list-title">{payout.title}</div>
                          <div className="tiny muted">{payout.org_name} · {payout.code}</div>
                        </td>
                        <td><Badge tone={payout.type === 'advance' ? 'info' : 'neutral'}>{payout.type === 'advance' ? '50% advance' : '50% final'}</Badge></td>
                        <td className="num">{inr(payout.gross_paise)}</td>
                        <td className="num">{payout.activation_fee_paise ? <span className="text-danger">−{inr(payout.activation_fee_paise)}</span> : '—'}</td>
                        <td className="num">{payout.tds_paise ? `−${inr(payout.tds_paise)}` : '—'}</td>
                        <td className="num"><strong>{inr(payout.net_paise)}</strong></td>
                        <td><StatusBadge status={payout.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon="wallet"
                title="No payouts yet"
                description="Payouts appear once an employer funds an accepted assignment. Your first payout carries the one-time activation fee."
                action={<Link className="btn btn-primary" to="/portal/professional/assignments">View assignments</Link>}
              />
            )}
            <p className="tiny muted" style={{ marginTop: 12 }}>{statementNote}</p>
          </Card>

          <Card>
            <CardHeader title="Activation fees" subtitle="One fee per assignment, disclosed before you accept, never a subscription." />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Assignment</th><th>Disclosed</th><th className="num">Base</th><th className="num">GST</th><th className="num">Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {activationFees.length ? activationFees.map((fee: any) => (
                    <tr key={fee.id}>
                      <td>
                        <div className="list-title">{fee.title}</div>
                        <div className="tiny muted">{fee.code}</div>
                      </td>
                      <td>{dateLabel(fee.disclosed_at)}</td>
                      <td className="num">{inr(fee.base_paise)}</td>
                      <td className="num">{inr(fee.gst_paise)}</td>
                      <td className="num"><strong>{inr(fee.amount_paise)}</strong></td>
                      <td>
                        <StatusBadge status={fee.status} />
                        {fee.charged_at ? <div className="tiny muted" style={{ marginTop: 4 }}>{dateLabel(fee.charged_at)}</div> : null}
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6} className="table-empty">No activation fees disclosed.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="alert alert-info" style={{ marginTop: 16 }}>
              <Icon name="info" />
              <div>
                The ₹699 fee is GST-inclusive. It is deducted once from the first payout after an employer funds the
                advance. Decline an assignment before activation and nothing is charged.
              </div>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card className="card-pad">
            <div className="row"><span className="icon-tile gold sm"><Icon name="rupee" /></span><strong>Worked example</strong></div>
            <p className="tiny muted" style={{ marginTop: 6 }}>₹20,000 assignment, 50% advance, one activation fee.</p>
            <div className="money-sheet" style={{ marginTop: 12 }}>
              <div className="money-sheet-title">Advance payout</div>
              <div className="money-line"><span>Advance (50%)</span><span className="num">{inr(1000000)}</span></div>
              <div className="money-line deduct"><span>Activation fee</span><span className="num">−{inr(69900)}</span></div>
              <div className="money-total"><span>First payout</span><strong>{inr(930100)}</strong></div>
              <div className="money-sheet-title" style={{ marginTop: 14 }}>Completion payout</div>
              <div className="money-line"><span>Final (50%)</span><span className="num">{inr(1000000)}</span></div>
              <div className="money-total"><span>Final payout</span><strong>{inr(1000000)}</strong></div>
            </div>
            <div className="kv" style={{ marginTop: 12 }}>
              <div className="kv-row"><span className="kv-key">Total received</span><span className="kv-val strong">{inr(1930100)}</span></div>
              <div className="kv-row"><span className="kv-key">Total assignment</span><span className="kv-val">{inr(2000000)}</span></div>
              <div className="kv-row"><span className="kv-key">Fee share</span><span className="kv-val">3.5%</span></div>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              The platform fee is 0% in this demonstration, so ₹20,000 − ₹699 = ₹19,301 reconciles exactly.
            </p>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Tax & records" />
            <div className="kv">
              <div className="kv-row"><span className="kv-key">TDS recorded</span><span className="kv-val">{inr(totals.tdsPaise)}</span></div>
              <div className="kv-row"><span className="kv-key">Payouts</span><span className="kv-val">{payouts.length}</span></div>
              <div className="kv-row"><span className="kv-key">Settled</span><span className="kv-val">{paidPayouts}</span></div>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              TDS is recorded where applicable under the professional-services provisions modelled here. This is a
              demonstration; consult a tax professional for filing.
            </p>
          </Card>

          <Alert tone="warning" title="Simulated gateway">
            Payment capture and settlement are simulated in this environment. No live money moves and no escrow is
            claimed. In production these events would come from a licensed payment provider.
          </Alert>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Payment structure" sub="Transparent by design: the same rules apply to every assignment." />
        <div className="grid grid-3">
          <Card className="card-pad">
            <span className="icon-tile"><Icon name="percent" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>50% advance</strong>
            <p className="tiny muted">Released after the employer funds the assignment and the contract is accepted.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile green"><Icon name="check-circle" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>50% on completion</strong>
            <p className="tiny muted">Released after completion evidence is approved, less any agreed deductions.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile gold"><Icon name="file-text" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Itemised GST</strong>
            <p className="tiny muted">Fees show base and GST separately so employer invoices and your records agree.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
