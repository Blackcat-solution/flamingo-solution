import {
  Alert, Badge, Button, Card, CardHeader, Icon, Loading, MiniBars, PageHeader, Stat
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  useDocumentTitle('Reports');
  const { adminPermissions } = useAuth();
  const allowed = adminPermissions.includes('*') || adminPermissions.includes('reports.view');
  const { data, loading, error } = useApi<any>(allowed ? '/admin/reports/overview' : null);

  if (!allowed) {
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>Your administrator role does not include reporting.</p>
      </Card>
    );
  }

  if (loading) return <Loading label="Loading reports." />;
  if (error) return <Alert tone="danger" title="Could not load reports">{error}</Alert>;
  if (!data) return null;

  const byStatus = data.byStatus || [];
  const byCategory = data.byCategory || [];
  const monthly = data.monthly || [];
  const totalAssignments = byStatus.reduce((sum: number, row: any) => sum + row.count, 0);
  const captured = monthly.reduce((sum: number, row: any) => sum + (row.captured_paise || 0), 0);
  const completed = byStatus.find((row: any) => row.status === 'completed')?.count || 0;

  return (
    <>
      <PageHeader
        title="Reports"
        eyebrow="Diagnostics"
        description="Assignment mix, category demand and simulated payment volume. These are operational diagnostics, not audited financial statements."
        actions={
          <Button
            variant="secondary"
            onClick={() => downloadCsv('flamingo-monthly-payments.csv', monthly)}
            disabled={!monthly.length}
          >
            <Icon name="download" className="icon-sm" /> Export monthly CSV
          </Button>
        }
      />

      <div className="grid grid-4">
        <Stat label="Assignments" value={totalAssignments} sub="All statuses" icon="briefcase" />
        <Stat label="Completed" value={completed} sub="Formally released" icon="check-circle" tone="success" />
        <Stat label="Categories" value={byCategory.length} sub="Active demand areas" icon="layers" />
        <Stat label="Captured volume" value={inr(captured, { compact: true })} sub="Across reported months" icon="credit-card" />
      </div>

      <div className="split" style={{ marginTop: 24 }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Assignments by status" subtitle="Current distribution across the engagement lifecycle." />
            {byStatus.length ? (
              <div className="table-wrap">
                <table className="table table-compact">
                  <thead><tr><th>Status</th><th className="num">Assignments</th><th className="num">Share</th></tr></thead>
                  <tbody>
                    {byStatus.map((row: any) => (
                      <tr key={row.status}>
                        <td>{titleCase(row.status)}</td>
                        <td className="num">{row.count}</td>
                        <td className="num">{totalAssignments ? `${Math.round((row.count / totalAssignments) * 100)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted small">No assignment data.</p>}
          </Card>

          <Card>
            <CardHeader title="Monthly captured payments" subtitle="Simulated gateway volume by month." />
            {monthly.length ? (
              <MiniBars
                data={[...monthly].reverse().map((row: any) => ({
                  label: row.month.slice(2),
                  value: row.captured_paise || 0
                }))}
                format={(value) => inr(value, { compact: true })}
              />
            ) : <p className="muted small">No captured payments.</p>}
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table table-compact">
                <thead><tr><th>Month</th><th className="num">Payments</th><th className="num">Captured</th></tr></thead>
                <tbody>
                  {monthly.map((row: any) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td className="num">{row.payments}</td>
                      <td className="num strong">{inr(row.captured_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader title="Demand by category" subtitle="Assignments per professional category." />
            {byCategory.length ? (
              <div className="stack-sm">
                {byCategory.map((row: any) => (
                  <div key={row.category}>
                    <div className="between">
                      <span className="small">{titleCase(row.category)}</span>
                      <span className="tiny strong">{row.count}</span>
                    </div>
                    <div className="progress" style={{ marginTop: 4 }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${Math.max(6, (row.count / Math.max(1, byCategory[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted small">No category data.</p>}
          </Card>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile navy sm"><Icon name="bar-chart" /></span><strong>Reporting caveats</strong></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>{data.note}</p>
            <p className="tiny muted">
              Reports are not a substitute for statutory accounts, GST returns or TDS filings. Production reporting
              requires reconciliation to the payment aggregator and bank statements.
            </p>
          </Card>

          <Alert tone="info" title="Demo data">
            Seeded demonstration transactions are included in these totals. They are clearly labelled as simulated and
            must not be presented as live revenue.
          </Alert>
        </div>
      </div>

      <div className="portal-section">
        <Card className="card-pad">
          <div className="between">
            <div>
              <strong>Export discipline</strong>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                CSV exports contain aggregated demonstration figures. No personal identity, bank or contact data is
                included.
              </p>
            </div>
            <Badge tone="outline">Aggregated only</Badge>
          </div>
        </Card>
      </div>
    </>
  );
}
