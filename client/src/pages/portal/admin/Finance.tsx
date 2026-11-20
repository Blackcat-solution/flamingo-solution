import { useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, Icon, Loading, PageHeader, Stat, StatusBadge, Tabs
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { dateLabel, inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type TabKey = 'payouts' | 'invoices' | 'fees' | 'ledger';

export default function AdminFinance() {
  useDocumentTitle('Financial centre');
  const { adminPermissions } = useAuth();
  const canView = adminPermissions.includes('*') || adminPermissions.includes('finance.view');
  const canManagePayouts = adminPermissions.includes('*') || adminPermissions.includes('payouts.manage');
  const { data, loading, error, reload } = useApi<any>(canView ? '/admin/finance/summary' : null);
  const { busy, run } = useAction();
  const [tab, setTab] = useState<TabKey>('payouts');

  if (!canView) {
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>Your administrator role does not include financial records.</p>
      </Card>
    );
  }

  if (loading) return <Loading label="Loading financial records." />;
  if (error) return <Alert tone="danger" title="Could not load the financial centre">{error}</Alert>;
  if (!data) return null;

  const { totals, invoices, payouts, activationFees, trialBalance, reconciliation, gatewayNotice } = data;
  const pendingPayouts = payouts.filter((payout: any) => ['pending', 'processing'].includes(payout.status));

  const markPaid = (payout: any) =>
    run(payout.id, async () => {
      await api(`/admin/payouts/${payout.id}/mark-paid`, {
        method: 'POST',
        body: { method: 'simulated_imps' }
      });
      reload();
    }, 'Payout marked settled (simulated).');

  return (
    <>
      <PageHeader
        title="Financial centre"
        eyebrow="Money movement"
        description="Invoices, activation fees, payouts and the control ledger. Every figure is a simulated demonstration transaction."
      />

      <Alert tone="warning" title="Simulated gateway">
        {gatewayNotice}
      </Alert>

      <div className="grid grid-4" style={{ marginTop: 20 }}>
        <Stat label="Captured payments" value={inr(totals.capturedPaise)} sub="Employer charges incl. GST" icon="credit-card" />
        <Stat label="GST collected" value={inr(totals.gstCollectedPaise)} sub="On captured invoices" icon="percent" />
        <Stat label="Activation base" value={inr(totals.activationBasePaise)} sub={`GST ${inr(totals.activationGstPaise)}`} icon="rupee" tone="success" />
        <Stat label="Platform fee revenue" value={inr(totals.platformRevenuePaise)} sub="Configured at 0% in this demo" icon="trending-up" />
      </div>

      <div className="grid grid-4" style={{ marginTop: 14 }}>
        <Stat label="Payouts settled" value={inr(totals.payoutsPaidPaise)} sub="Marked paid" icon="wallet" tone="success" />
        <Stat label="Payouts outstanding" value={inr(totals.payoutsPendingPaise)} sub={`${pendingPayouts.length} awaiting release`} icon="clock" tone={totals.payoutsPendingPaise ? 'warning' : 'success'} />
        <Stat label="TDS withheld" value={inr(totals.tdsWithheldPaise)} sub="Recorded on payouts" icon="scale" />
        <Stat label="Ledger control" value={reconciliation.balanced ? 'Balanced' : 'Check'} sub={reconciliation.balanced ? 'Debits equal credits' : 'Reconciliation required'} icon={reconciliation.balanced ? 'check-circle' : 'alert-triangle'} tone={reconciliation.balanced ? 'success' : 'warning'} />
      </div>

      <div style={{ marginTop: 22 }}>
        <Tabs<TabKey>
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'payouts', label: 'Payouts', count: payouts.length },
            { key: 'invoices', label: 'Invoices', count: invoices.length },
            { key: 'fees', label: 'Activation fees', count: activationFees.length },
            { key: 'ledger', label: 'Control ledger', count: trialBalance.length }
          ]}
        />
      </div>

      {tab === 'payouts' ? (
        <Card style={{ marginTop: 16 }}>
          <CardHeader
            title="Professional payouts"
            subtitle="The ₹699 activation fee is deducted once, from the first payout of an assignment."
            actions={<Badge tone={pendingPayouts.length ? 'warning' : 'success'}>{pendingPayouts.length} outstanding</Badge>}
          />
          <div className="table-wrap">
            <table className="table table-tight">
              <thead>
                <tr><th>Payout</th><th>Professional</th><th>Assignment</th><th>Type</th><th>Gross</th><th>Activation</th><th>TDS</th><th>Net</th><th>Status</th><th className="actions">Action</th></tr>
              </thead>
              <tbody>
                {payouts.length ? payouts.map((payout: any) => (
                  <tr key={payout.id}>
                    <td>
                      <div className="mono tiny">{payout.payout_ref}</div>
                      <div className="tiny muted">{dateLabel(payout.created_at)}</div>
                    </td>
                    <td>{payout.professional_name}</td>
                    <td>
                      <div>{payout.title}</div>
                      <div className="tiny muted">{payout.code}</div>
                    </td>
                    <td><Badge tone="outline">{titleCase(payout.type)}</Badge></td>
                    <td className="num">{inr(payout.gross_paise)}</td>
                    <td className="num">{payout.activation_fee_paise ? `− ${inr(payout.activation_fee_paise)}` : '—'}</td>
                    <td className="num">{payout.tds_paise ? `− ${inr(payout.tds_paise)}` : '—'}</td>
                    <td className="num strong">{inr(payout.net_paise)}</td>
                    <td><StatusBadge status={payout.status} /></td>
                    <td className="actions">
                      {['pending', 'processing'].includes(payout.status) && canManagePayouts ? (
                        <Button variant="secondary" size="sm" onClick={() => markPaid(payout)} loading={busy === payout.id}>
                          Mark paid
                        </Button>
                      ) : payout.paid_at ? (
                        <span className="tiny muted">{dateLabel(payout.paid_at)}</span>
                      ) : (
                        <span className="tiny muted">—</span>
                      )}
                    </td>
                  </tr>
                )) : <tr><td colSpan={10} className="table-empty">No payouts recorded.</td></tr>}
              </tbody>
            </table>
          </div>
          <Alert tone="info" title="Payout release is simulated">
            Marking a payout paid records the settlement in the demonstration ledger. It does not move money. A production
            release requires verified bank details, a payout hold period and a payment aggregator instruction.
          </Alert>
        </Card>
      ) : null}

      {tab === 'invoices' ? (
        <Card style={{ marginTop: 16 }}>
          <CardHeader title="Employer invoices" subtitle="Professional charges, platform fee and GST are itemised separately." />
          <div className="table-wrap">
            <table className="table table-tight">
              <thead>
                <tr><th>Invoice</th><th>Employer</th><th>Assignment</th><th>Type</th><th>Professional charges</th><th>Platform fee</th><th>GST</th><th>Total</th><th>Status</th><th>Issued</th></tr>
              </thead>
              <tbody>
                {invoices.length ? invoices.map((invoice: any) => (
                  <tr key={invoice.id}>
                    <td className="mono tiny">{invoice.invoice_no}</td>
                    <td>{invoice.org_name}</td>
                    <td>
                      <div>{invoice.title}</div>
                      <div className="tiny muted">{invoice.code}</div>
                    </td>
                    <td><Badge tone="outline">{titleCase(invoice.type)}</Badge></td>
                    <td className="num">{inr(invoice.professional_charges_paise)}</td>
                    <td className="num">{inr(invoice.platform_fee_paise)}</td>
                    <td className="num">{inr(invoice.gst_paise)}</td>
                    <td className="num strong">{inr(invoice.total_paise)}</td>
                    <td><StatusBadge status={invoice.status} /></td>
                    <td>{dateLabel(invoice.issued_at)}</td>
                  </tr>
                )) : <tr><td colSpan={10} className="table-empty">No invoices recorded.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card card-pad-sm" style={{ marginTop: 14, background: 'var(--cream)' }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Icon name="info" className="icon-sm text-muted" />
              <p className="tiny muted">
                The standard structure is 50% advance and 50% on completion. Example: a ₹20,000 assignment produces a
                ₹10,000 advance, a ₹699 activation deduction from the first payout, a ₹9,301 first payout and a ₹10,000
                final payout — ₹19,301 in total to the professional.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === 'fees' ? (
        <Card style={{ marginTop: 16 }}>
          <CardHeader title="Activation fees" subtitle="Charged once per assignment, only when an assignment is activated. GST-inclusive ₹699." />
          <div className="table-wrap">
            <table className="table table-tight">
              <thead>
                <tr><th>Assignment</th><th>Professional</th><th>Total fee</th><th>Base</th><th>GST</th><th>Status</th><th>Disclosed</th><th>Charged</th></tr>
              </thead>
              <tbody>
                {activationFees.length ? activationFees.map((fee: any) => (
                  <tr key={fee.id}>
                    <td>
                      <div>{fee.title}</div>
                      <div className="tiny muted">{fee.code}</div>
                    </td>
                    <td>{fee.professional_name}</td>
                    <td className="num strong">{inr(fee.amount_paise)}</td>
                    <td className="num">{inr(fee.base_paise)}</td>
                    <td className="num">{inr(fee.gst_paise)}</td>
                    <td><StatusBadge status={fee.status} /></td>
                    <td>{dateLabel(fee.disclosed_at)}</td>
                    <td>{fee.charged_at ? dateLabel(fee.charged_at) : '—'}</td>
                  </tr>
                )) : <tr><td colSpan={8} className="table-empty">No activation fees recorded.</td></tr>}
              </tbody>
            </table>
          </div>
          <Alert tone="neutral" title="No assignment, no charge">
            Registration, assessments and profile publication are free. The activation fee applies only when an
            assignment is activated and is deducted once from the first payout.
          </Alert>
        </Card>
      ) : null}

      {tab === 'ledger' ? (
        <Card style={{ marginTop: 16 }}>
          <CardHeader
            title="Control ledger trial balance"
            subtitle="A double-entry control record, not a statutory book of account."
            actions={<Badge tone={reconciliation.balanced ? 'success' : 'danger'}>{reconciliation.balanced ? 'Balanced' : 'Unbalanced'}</Badge>}
          />
          <div className="table-wrap">
            <table className="table table-tight">
              <thead><tr><th>Account</th><th className="num">Debits</th><th className="num">Credits</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {trialBalance.length ? trialBalance.map((row: any) => (
                  <tr key={row.account}>
                    <td className="mono tiny">{row.account}</td>
                    <td className="num">{inr(row.debitPaise)}</td>
                    <td className="num">{inr(row.creditPaise)}</td>
                    <td className="num strong">{inr(row.balancePaise)}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="table-empty">No ledger entries.</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th className="num">{inr(reconciliation.debitPaise)}</th>
                  <th className="num">{inr(reconciliation.creditPaise)}</th>
                  <th className="num">{inr(reconciliation.debitPaise - reconciliation.creditPaise)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
          <Alert tone="neutral" title="Control note">{reconciliation.note}</Alert>
        </Card>
      ) : null}

      <div className="portal-section">
        <Card className="card-pad">
          <div className="row"><span className="icon-tile navy sm"><Icon name="server" /></span><strong>Production money controls</strong></div>
          <div className="compare-list" style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
            {[
              ['Payment aggregator', 'Use an RBI-authorised aggregator with appropriate nodal or escrow arrangements.'],
              ['Tax', 'GST and TDS treatment must be confirmed by the company’s tax adviser.'],
              ['Reconciliation', 'Match every gateway settlement to an invoice, payment and ledger entry.'],
              ['Payout verification', 'Verify bank details out of band before the first release.']
            ].map(([title, copy]) => (
              <div className="row" key={title} style={{ alignItems: 'flex-start', padding: '6px 0' }}>
                <Icon name="check-circle" className="icon-sm text-success" />
                <span><span className="tiny strong" style={{ display: 'block' }}>{title}</span><span className="tiny muted">{copy}</span></span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
