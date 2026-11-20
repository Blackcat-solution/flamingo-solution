import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, DefinitionList, Input, Loading, Modal,
  PageHeader, Pagination, Select
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { dateTimeLabel, relativeTime, titleCase } from '../../../lib/format';
import { useApi, useDebounced, useDocumentTitle } from '../../../lib/hooks';

export default function AdminAudit() {
  useDocumentTitle('Audit log');
  const { adminPermissions } = useAuth();
  const allowed = adminPermissions.includes('*') || adminPermissions.includes('users.view');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const debouncedAction = useDebounced(action, 450);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => setPage(1), [debouncedAction, entityType]);

  const path = useMemo(() => {
    if (!allowed) return null;
    const search = new URLSearchParams();
    if (debouncedAction) search.set('action', debouncedAction);
    if (entityType) search.set('entityType', entityType);
    search.set('page', String(page));
    search.set('limit', '50');
    return `/admin/audit?${search.toString()}`;
  }, [allowed, debouncedAction, entityType, page]);

  const { data, loading, error } = useApi<any>(path);

  if (!allowed) {
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>Your administrator role does not include the audit log.</p>
      </Card>
    );
  }

  const rows = data?.rows || [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Audit log"
        eyebrow="Accountability"
        description="Every privileged action is recorded with the actor, entity, IP address, metadata and timestamp. Entries are append-only through the application."
      />

      <Alert tone="info" title="Retention and access">
        In production, export audit records to append-only storage with a retention schedule agreed by legal. Access to
        the audit log is itself a privileged capability.
      </Alert>

      <Card className="card-pad-sm" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Filter by action, e.g. verification"
            style={{ maxWidth: 300 }}
          />
          <Select value={entityType} onChange={(event) => setEntityType(event.target.value)} style={{ maxWidth: 190 }}>
            <option value="">All entities</option>
            <option value="user">User</option>
            <option value="professional_profile">Professional profile</option>
            <option value="employer_profile">Employer profile</option>
            <option value="document">Document</option>
            <option value="assessment_attempt">Assessment attempt</option>
            <option value="payout">Payout</option>
            <option value="dispute">Dispute</option>
            <option value="review">Review</option>
            <option value="settings">Settings</option>
          </Select>
          <span className="grow" />
          <span className="tiny muted">{pagination?.total ?? 0} entries</span>
        </div>
      </Card>

      {loading ? <Loading label="Loading audit records." /> : null}
      {error ? <Alert tone="danger" title="Could not load the audit log">{error}</Alert> : null}

      {!loading && !error ? (
        <Card style={{ marginTop: 16 }}>
          <div className="table-wrap">
            <table className="table table-compact">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>IP</th><th className="actions">Detail</th></tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row: any) => (
                  <tr key={row.id}>
                    <td>
                      <div>{dateTimeLabel(row.created_at)}</div>
                      <div className="tiny muted">{relativeTime(row.created_at)}</div>
                    </td>
                    <td>
                      <div>{row.actor_role ? titleCase(row.actor_role) : 'System'}</div>
                      <div className="tiny muted mono">{row.actor_id ? row.actor_id.slice(0, 18) : '—'}</div>
                    </td>
                    <td><Badge tone="outline">{row.action}</Badge></td>
                    <td>
                      <div>{row.entity_type ? titleCase(row.entity_type) : '—'}</div>
                      <div className="tiny muted mono">{row.entity_id || '—'}</div>
                    </td>
                    <td className="mono tiny">{row.ip || '—'}</td>
                    <td className="actions">
                      <Button variant="secondary" size="sm" onClick={() => setSelected(row)}>View</Button>
                    </td>
                  </tr>
                )) : <tr><td colSpan={6} className="table-empty">No audit entries match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          {pagination ? (
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
          ) : null}
        </Card>
      ) : null}

      {selected ? (
        <Modal
          open
          size="lg"
          title="Audit entry"
          subtitle={dateTimeLabel(selected.created_at)}
          onClose={() => setSelected(null)}
          footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
        >
          <DefinitionList
            items={[
              { label: 'Entry ID', value: <span className="mono tiny">{selected.id}</span> },
              { label: 'Action', value: selected.action },
              { label: 'Actor', value: `${selected.actor_id || 'System'}${selected.actor_role ? ` · ${titleCase(selected.actor_role)}` : ''}` },
              { label: 'Entity', value: `${selected.entity_type ? titleCase(selected.entity_type) : '—'} · ${selected.entity_id || '—'}` },
              { label: 'IP address', value: <span className="mono">{selected.ip || '—'}</span> },
              { label: 'Recorded', value: dateTimeLabel(selected.created_at) }
            ]}
          />
          <div className="form-section" style={{ marginTop: 18 }}>
            <div className="form-section-head">
              <h3 className="form-section-title">Metadata</h3>
              <p className="form-section-sub">Structured context captured with the action.</p>
            </div>
            <pre className="card card-pad-sm mono tiny" style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
              {JSON.stringify(selected.meta || {}, null, 2)}
            </pre>
          </div>
          <Alert tone="neutral" title="Append-only record">
            This view is read-only. Audit entries cannot be edited or deleted through the application.
          </Alert>
        </Modal>
      ) : null}

      <div className="portal-section">
        <Card className="card-pad">
          <strong>What is captured</strong>
          <div className="grid grid-2" style={{ marginTop: 10 }}>
            {[
              'Authentication and session events',
              'Verification and document review decisions',
              'Assessment review outcomes',
              'Payout release and dispute resolutions',
              'Account status and settings changes',
              'Administrative access to encrypted documents'
            ].map((item) => (
              <div className="row" key={item} style={{ alignItems: 'flex-start', padding: '4px 0' }}>
                <span className="dot" style={{ marginTop: 6 }} />
                <span className="tiny">{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
