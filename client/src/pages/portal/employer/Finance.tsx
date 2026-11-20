import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Icon, Loading, Modal,
  PageHeader, Stat, StatusBadge
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { dateLabel, inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

export default function EmployerFinance() {
  useDocumentTitle('Financial centre');
  const { data, loading, error } = useApi<any>('/employer/finance');
  const { data: dashboard } = useApi<any>('/employer/dashboard');
  const { data: config } = useApi<any>('/public/config');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  if (loading) return <Loading label="Preparing your invoices." />;
  if (error) return <Alert tone="danger" title="Could not load your financial centre">{error}</Alert>;
  if (!data) return null;

  const { invoices, payments, totals, gatewayNotice } = data;
  const terms = config?.terms;
  const platformFeePercent = terms ? terms.platformFeeBps / 100 : 0;
  const gstPercent = terms ? terms.gstRateBps / 100 : 18;
  const employer = dashboard?.employer;

  return (
    <>
      <PageHeader
        title="Financial centre"
        eyebrow="Invoices & payments"
        description="Every invoice itemises professional charges, the platform fee and GST. Payments are split 50% advance and 50% on completion."
        actions={<Link className="btn btn-secondary" to="/portal/employer/assignments">Open assignments</Link>}
      />

      <div className="grid grid-4">
        <Stat label="Total invoiced" value={inr(totals.invoicedPaise)} sub={`${invoices.length} invoices`} icon="file-text" />
        <Stat label="Paid to date" value={inr(totals.paidPaise)} sub={`${payments.filter((payment: any) => payment.status === 'captured').length} captured payments`} icon="wallet" tone="success" />
        <Stat label="GST recorded" value={inr(totals.gstPaise)} sub={`At ${gstPercent}% on the platform fee`} icon="percent" />
        <Stat label="Platform fees" value={inr(totals.platformFeePaise)} sub={`${platformFeePercent}% of professional charges in this demo`} icon="credit-card" tone="warning" />
      </div>

      <div className="split split-finance" style={{ marginTop: 26 }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Invoices" subtitle="Issued against each payment milestone." actions={<Badge tone="outline">Demo invoices</Badge>} />
            {invoices.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Invoice</th><th>Assignment</th><th>Type</th><th className="num">Charges</th><th className="num">Platform fee</th><th className="num">GST</th><th className="num">Total</th><th>Status</th><th className="actions">Action</th></tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice: any) => (
                      <tr key={invoice.id}>
                        <td>
                          <div className="mono tiny">{invoice.invoice_no}</div>
                          <div className="tiny muted">{dateLabel(invoice.issued_at)}</div>
                        </td>
                        <td>{invoice.title}</td>
                        <td><Badge tone={invoice.type === 'advance' ? 'info' : 'neutral'}>{titleCase(invoice.type)}</Badge></td>
                        <td className="num">{inr(invoice.professional_charges_paise)}</td>
                        <td className="num">{inr(invoice.platform_fee_paise)}</td>
                        <td className="num">{inr(invoice.gst_paise)}</td>
                        <td className="num"><strong>{inr(invoice.total_paise)}</strong></td>
                        <td><StatusBadge status={invoice.status} /></td>
                        <td className="actions"><Button variant="secondary" size="sm" onClick={() => setInvoiceId(invoice.id)}>View</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon="file-text" title="No invoices yet" description="Invoices are issued when you fund an assignment advance or release the final payment." />}
            <p className="tiny muted" style={{ marginTop: 12 }}>{gatewayNotice}</p>
          </Card>

          <Card>
            <CardHeader title="Payments" subtitle="Simulated gateway captures for each milestone." />
            <div className="table-wrap">
              <table className="table table-compact">
                <thead><tr><th>Reference</th><th>Assignment</th><th>Type</th><th className="num">Total</th><th>Gateway</th><th>Status</th><th>Captured</th></tr></thead>
                <tbody>
                  {payments.length ? payments.map((payment: any) => (
                    <tr key={payment.id}>
                      <td className="mono tiny">{payment.payment_ref}</td>
                      <td className="tiny">{payment.assignment_id}</td>
                      <td>{titleCase(payment.type)}</td>
                      <td className="num"><strong>{inr(payment.total_paise)}</strong></td>
                      <td><Badge tone="outline">{titleCase(payment.gateway)}</Badge></td>
                      <td><StatusBadge status={payment.status} /></td>
                      <td>{payment.captured_at ? dateLabel(payment.captured_at) : '—'}</td>
                    </tr>
                  )) : <tr><td colSpan={7} className="table-empty">No payments captured.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="Bill to" />
            {employer ? (
              <div className="kv">
                <div className="kv-row"><span className="kv-key">Organisation</span><span className="kv-val">{employer.orgName}</span></div>
                <div className="kv-row"><span className="kv-key">GSTIN</span><span className="kv-val mono tiny">{employer.gstin || 'Not recorded'}</span></div>
                <div className="kv-row"><span className="kv-key">Billing email</span><span className="kv-val tiny">{employer.billingEmail}</span></div>
                <div className="kv-row"><span className="kv-key">City</span><span className="kv-val">{employer.city}, {employer.state}</span></div>
              </div>
            ) : null}
            <Link className="btn btn-secondary btn-sm btn-block" to="/portal/employer/profile" style={{ marginTop: 10 }}>Update billing details</Link>
          </Card>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile gold sm"><Icon name="rupee" /></span><strong>Worked example</strong></div>
            <p className="tiny muted" style={{ marginTop: 6 }}>₹20,000 assignment. Platform fee is {platformFeePercent}% in this demonstration.</p>
            <div className="money-sheet" style={{ marginTop: 12 }}>
              <div className="money-line"><span>Professional charges</span><span className="num">{inr(2000000)}</span></div>
              <div className="money-line deduct"><span>Platform fee ({platformFeePercent}%)</span><span className="num">{inr(0)}</span></div>
              <div className="money-line"><span>GST on platform fee</span><span className="num">{inr(0)}</span></div>
              <div className="money-total"><span>Invoice total</span><strong>{inr(2000000)}</strong></div>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              The professional receives ₹19,301 after the ₹699 activation fee. Their side is shown in their statement.
            </p>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Payment structure" />
            <div className="kv">
              <div className="kv-row"><span className="kv-key">Advance</span><span className="kv-val">{terms?.advancePercent ?? 50}%</span></div>
              <div className="kv-row"><span className="kv-key">Completion</span><span className="kv-val">{100 - (terms?.advancePercent ?? 50)}%</span></div>
              <div className="kv-row"><span className="kv-key">GST rate</span><span className="kv-val">{gstPercent}%</span></div>
              <div className="kv-row"><span className="kv-key">Activation fee</span><span className="kv-val">₹699 once, paid by professional</span></div>
            </div>
          </Card>

          <Alert tone="warning" title="No escrow claim">
            This demonstration does not hold funds in escrow. Production payments must flow through an RBI-authorised
            payment aggregator and its designated escrow arrangements.
          </Alert>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Transparent billing" sub="What each line on your invoice means." />
        <div className="grid grid-3">
          <Card className="card-pad">
            <strong className="small">Professional charges</strong>
            <p className="tiny muted">The agreed contract value for the milestone. This is what funds the professional.</p>
          </Card>
          <Card className="card-pad">
            <strong className="small">Platform fee</strong>
            <p className="tiny muted">Flamingo’s service fee. It is {platformFeePercent}% in this demonstration and shown separately from charges.</p>
          </Card>
          <Card className="card-pad">
            <strong className="small">GST</strong>
            <p className="tiny muted">Charged at {gstPercent}% on the platform fee and itemised so input-credit records agree.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(invoiceId)}
        onClose={() => setInvoiceId(null)}
        title="Invoice detail"
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setInvoiceId(null)}>Close</Button><Button onClick={() => window.print()}>Print</Button></>}
      >
        {invoiceId ? <InvoiceDetail invoiceId={invoiceId} /> : null}
      </Modal>
    </>
  );
}

function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const { data, loading, error } = useApi<any>(`/employer/invoices/${invoiceId}`);

  if (loading) return <Loading label="Loading invoice." />;
  if (error) return <Alert tone="danger" title="Could not load invoice">{error}</Alert>;
  if (!data) return null;

  const { invoice, assignment, employer, lines, totalPaise } = data;

  return (
    <div>
      <div className="between">
        <div>
          <div className="eyebrow eyebrow-plain">Invoice</div>
          <strong className="mono">{invoice.invoice_no}</strong>
          <div className="tiny muted">Issued {dateLabel(invoice.issued_at)} · Due {dateLabel(invoice.due_at)}</div>
        </div>
        <StatusBadge status={invoice.status} />
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div>
          <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Billed to</div>
          <div className="small strong">{employer.orgName}</div>
          <div className="tiny muted">{employer.billingEmail}</div>
          <div className="tiny muted">{employer.city}, {employer.state}</div>
        </div>
        <div>
          <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Assignment</div>
          <div className="small strong">{assignment.title}</div>
          <div className="tiny muted">{assignment.code} · {titleCase(invoice.type)} milestone</div>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="table table-compact">
          <thead><tr><th>Line</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {lines.map((line: any) => (
              <tr key={line.label}>
                <td>{line.label}</td>
                <td className="num">{inr(line.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="money-sheet" style={{ marginTop: 12 }}>
        <div className="money-total"><span>Total</span><strong>{inr(totalPaise)}</strong></div>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>Simulated invoice. No live tax filing or payment is produced in this demonstration.</p>
    </div>
  );
}
