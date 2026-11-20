import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, DefinitionList, Field, Input, Loading, Modal,
  PageHeader, Pagination, Select, StatusBadge, Textarea
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { dateLabel, dateTimeLabel, titleCase } from '../../../lib/format';
import { useApi, useDebounced, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

function StatusChange({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [status, setStatus] = useState(user.status === 'suspended' ? 'active' : 'suspended');
  const [reason, setReason] = useState('');

  const submit = () =>
    run('status', async () => {
      await api(`/admin/users/${user.id}/status`, {
        method: 'POST',
        body: { status, reason }
      });
      onDone();
      onClose();
    }, 'Account status updated.');

  return (
    <Modal
      open
      size="lg"
      title="Change account status"
      subtitle={`${user.name} · ${user.email}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={status === 'active' ? 'primary' : 'danger-soft'}
            onClick={submit}
            loading={busy === 'status'}
            disabled={reason.trim().length < 5}
          >
            Set status to {titleCase(status)}
          </Button>
        </>
      }
    >
      <DefinitionList
        items={[
          { label: 'Role', value: titleCase(user.role) + (user.admin_role ? ` · ${titleCase(user.admin_role)}` : '') },
          { label: 'Current status', value: <StatusBadge status={user.status} /> },
          { label: 'MFA', value: user.mfaEnabled ? 'Enabled' : 'Not enabled' },
          { label: 'Created', value: dateLabel(user.created_at) },
          { label: 'Last sign-in', value: user.last_login_at ? dateTimeLabel(user.last_login_at) : 'Never' }
        ]}
      />

      <div className="form-section" style={{ marginTop: 18 }}>
        <div className="form-section-head">
          <h3 className="form-section-title">New status</h3>
          <p className="form-section-sub">Suspending or closing an account ends all active sessions immediately.</p>
        </div>
        <div className="form-grid">
          <Field label="Status" htmlFor="user-status" required>
            <Select id="user-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
          <Field
            label="Reason"
            htmlFor="user-reason"
            required
            className="span-2"
            hint="At least 5 characters. The account holder receives this reason."
          >
            <Textarea
              id="user-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              style={{ minHeight: 90 }}
              placeholder="Why is this change being made?"
            />
          </Field>
        </div>
      </div>

      <Alert tone="warning" title="Audited action">
        Status changes are restricted to super administrators and written to the audit log with your name, the reason and
        the timestamp.
      </Alert>
    </Modal>
  );
}

export default function AdminUsers() {
  useDocumentTitle('User administration');
  const { user: me, adminPermissions } = useAuth();
  const allowed = adminPermissions.includes('*') || adminPermissions.includes('users.view');
  const canChangeStatus = adminPermissions.includes('*');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => setPage(1), [role, status, debounced]);

  const path = useMemo(() => {
    if (!allowed) return null;
    const search = new URLSearchParams();
    if (role) search.set('role', role);
    if (status) search.set('status', status);
    if (debounced) search.set('q', debounced);
    search.set('page', String(page));
    search.set('limit', '25');
    return `/admin/users?${search.toString()}`;
  }, [allowed, role, status, debounced, page]);

  const { data, loading, error, reload } = useApi<any>(path);

  if (!allowed) {
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>Your administrator role does not include user administration.</p>
      </Card>
    );
  }

  const rows = data?.rows || [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Users"
        eyebrow="Account administration"
        description="Search professionals, employers and administrators. Status changes are restricted to super administrators."
      />

      <Card className="card-pad-sm">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            style={{ maxWidth: 320 }}
          />
          <Select value={role} onChange={(event) => setRole(event.target.value)} style={{ maxWidth: 170 }}>
            <option value="">All roles</option>
            <option value="professional">Professionals</option>
            <option value="employer">Employers</option>
            <option value="admin">Administrators</option>
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} style={{ maxWidth: 170 }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="closed">Closed</option>
          </Select>
          <span className="grow" />
          <span className="tiny muted">{pagination?.total ?? 0} accounts</span>
        </div>
      </Card>

      {loading ? <Loading label="Loading accounts." /> : null}
      {error ? <Alert tone="danger" title="Could not load accounts">{error}</Alert> : null}

      {!loading && !error ? (
        <Card style={{ marginTop: 16 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Account</th><th>Role</th><th>Status</th><th>MFA</th><th>Created</th><th>Last sign-in</th><th className="actions">Action</th></tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row: any) => (
                  <tr key={row.id}>
                    <td>
                      <div className="list-title">
                        {row.name} {row.is_demo ? <Badge tone="brand" className="badge-sm">Demo</Badge> : null}
                        {row.id === me?.id ? <Badge tone="info" className="badge-sm">You</Badge> : null}
                      </div>
                      <div className="tiny muted">{row.email}{row.phone ? ` · ${row.phone}` : ''}</div>
                    </td>
                    <td>
                      <div>{titleCase(row.role)}</div>
                      {row.admin_role ? <div className="tiny muted">{titleCase(row.admin_role)}</div> : null}
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>{row.mfa_enabled ? <Badge tone="success">Enabled</Badge> : <Badge tone="outline">Off</Badge>}</td>
                    <td>{dateLabel(row.created_at)}</td>
                    <td>{row.last_login_at ? dateTimeLabel(row.last_login_at) : 'Never'}</td>
                    <td className="actions">
                      {canChangeStatus && row.id !== me?.id ? (
                        <Button variant="secondary" size="sm" onClick={() => setSelected(row)}>Manage</Button>
                      ) : (
                        <span className="tiny muted">{row.id === me?.id ? 'Current session' : 'View only'}</span>
                      )}
                    </td>
                  </tr>
                )) : <tr><td colSpan={7} className="table-empty">No accounts match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          {pagination ? (
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
          ) : null}
        </Card>
      ) : null}

      <div className="portal-section">
        <div className="grid grid-3">
          <Card className="card-pad">
            <strong>Status</strong>
            <p className="tiny muted" style={{ marginTop: 6 }}>
              Suspended accounts cannot sign in and active sessions are revoked. Closed accounts are retained for audit
              and financial retention.
            </p>
          </Card>
          <Card className="card-pad">
            <strong>Least privilege</strong>
            <p className="tiny muted" style={{ marginTop: 6 }}>
              Administrator permissions follow the assigned role. Only a super administrator can change another account's
              status or platform settings.
            </p>
          </Card>
          <Card className="card-pad">
            <strong>Audit</strong>
            <p className="tiny muted" style={{ marginTop: 6 }}>
              Every status change is recorded with the actor, target, reason and timestamp. Audit records are not editable
              through the interface.
            </p>
          </Card>
        </div>
      </div>

      {selected ? <StatusChange user={selected} onClose={() => setSelected(null)} onDone={reload} /> : null}
    </>
  );
}
