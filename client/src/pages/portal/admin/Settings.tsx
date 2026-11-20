import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, Field, Icon, Input, Loading, PageHeader
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type Group = {
  title: string;
  sub: string;
  fields: Array<{ key: string; label: string; hint?: string; type?: 'text' | 'number' }>;
};

const GROUPS: Group[] = [
  {
    title: 'Fees & tax',
    sub: 'Disclosed money mechanics. Policy changes apply to new actions; existing contracts retain accepted terms.',
    fields: [
      { key: 'activation_fee_paise', label: 'Activation fee (₹, GST-inclusive)', hint: 'Deducted once from the first payout of an assignment.', type: 'number' },
      { key: 'gst_rate_bps', label: 'GST rate (basis points)', hint: '1800 = 18%. Confirm treatment with a tax adviser.', type: 'number' },
      { key: 'platform_fee_bps', label: 'Platform fee (basis points)', hint: '0 = no platform fee. Itemised separately when non-zero.', type: 'number' },
      { key: 'advance_percent', label: 'Advance percentage', hint: 'The standard structure is 50% advance, 50% on completion.', type: 'number' },
      { key: 'tds_rate_bps', label: 'TDS rate (basis points)', hint: 'Recorded on payouts. Confirm applicability with a tax adviser.', type: 'number' },
      { key: 'payout_hold_days', label: 'Payout hold (days)', hint: 'Days between completion approval and payout release.', type: 'number' }
    ]
  },
  {
    title: 'Working rules',
    sub: 'Limits enforced by the scheduling engine and visible to professionals and employers.',
    fields: [
      { key: 'max_working_hours_day', label: 'Maximum hours per day', type: 'number' },
      { key: 'max_working_days_week', label: 'Maximum working days per week', hint: 'Four days per week in the published policy.', type: 'number' },
      { key: 'weekly_hours_cap', label: 'Weekly hours cap', type: 'number' },
      { key: 'mandatory_off_days', label: 'Mandatory off days', hint: 'Comma-separated day codes. Sunday and Monday are compulsory.' },
      { key: 'allowed_working_days', label: 'Available working days', hint: 'Comma-separated day codes.' },
      { key: 'shift_options', label: 'Shift options (hours)', hint: 'Comma-separated shift lengths.' },
      { key: 'break_policy', label: 'Break policy (minutes)', hint: '15 + 15 + 30 minutes inside the attendance window.' }
    ]
  },
  {
    title: 'Assessment & experience',
    sub: 'Gates that protect marketplace quality. Assessments remain free to professionals.',
    fields: [
      { key: 'min_experience_years', label: 'Minimum experience (years)', hint: 'Registration is refused below this threshold.', type: 'number' },
      { key: 'min_assessment_score', label: 'Minimum assessment score', hint: 'A pass requires at least this score out of 100.', type: 'number' },
      { key: 'assessment_retake_days', label: 'Retake waiting period (days)', type: 'number' },
      { key: 'max_interview_rounds', label: 'Maximum interview rounds', hint: 'Two rounds: panel, then final discussion.', type: 'number' }
    ]
  },
  {
    title: 'Platform identity',
    sub: 'Public-facing support and legal identity.',
    fields: [
      { key: 'support_email', label: 'Support email' },
      { key: 'brand_legal_name', label: 'Legal entity name' }
    ]
  }
];

const NUMERIC = new Set(GROUPS.flatMap((group) => group.fields.filter((field) => field.type === 'number').map((field) => field.key)));

export default function AdminSettings() {
  useDocumentTitle('Platform settings');
  const { adminPermissions } = useAuth();
  const allowed = adminPermissions.includes('*') || adminPermissions.includes('users.view');
  const canEdit = adminPermissions.includes('*');
  const { data, loading, error, reload } = useApi<any>(allowed ? '/admin/settings' : null);
  const { busy, run } = useAction();
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data?.settings) return;
    const next: Record<string, string> = {};
    for (const group of GROUPS) {
      for (const field of group.fields) {
        const value = data.settings[field.key];
        next[field.key] =
          field.key === 'activation_fee_paise'
            ? String(Number(value) / 100)
            : value === undefined || value === null
              ? ''
              : String(value);
      }
    }
    setForm(next);
  }, [data]);

  if (!allowed) {
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>Your administrator role does not include platform settings.</p>
      </Card>
    );
  }

  if (loading || !data) return <Loading label="Loading platform settings." />;
  if (error) return <Alert tone="danger" title="Could not load settings">{error}</Alert>;

  const update = (key: string) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = () =>
    run('save', async () => {
      const payload: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(form)) {
        if (key === 'activation_fee_paise') {
          payload[key] = String(Math.round(Number(value) * 100));
        } else if (NUMERIC.has(key)) {
          payload[key] = String(value);
        } else {
          payload[key] = value;
        }
      }
      await api('/admin/settings', { method: 'PATCH', body: payload });
      reload();
    }, 'Settings saved. New actions use the updated policy.');

  return (
    <>
      <PageHeader
        title="Platform settings"
        eyebrow="Policy configuration"
        description="Fees, working limits, assessment gates and platform identity. Only a super administrator can save changes."
        actions={
          canEdit ? (
            <Button onClick={save} loading={busy === 'save'}>
              <Icon name="check" className="icon-sm" /> Save settings
            </Button>
          ) : <Badge tone="outline">Read only</Badge>
        }
      />

      <Alert tone="info" title="Policy scope">
        {data.note}
      </Alert>

      {!canEdit ? (
        <Alert tone="warning" title="Read-only for your role">
          Changing platform settings requires super administrator permission. You can review the current configuration
          here, but the save action is disabled.
        </Alert>
      ) : null}

      <div className="split" style={{ marginTop: 20 }}>
        <div className="stack-lg">
          {GROUPS.map((group) => (
            <Card key={group.title}>
              <CardHeader title={group.title} subtitle={group.sub} />
              <div className="form-grid">
                {group.fields.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    htmlFor={`setting-${field.key}`}
                    hint={field.hint}
                  >
                    <Input
                      id={`setting-${field.key}`}
                      type={field.type === 'number' ? 'number' : 'text'}
                      step={field.type === 'number' ? 'any' : undefined}
                      value={form[field.key] ?? ''}
                      onChange={update(field.key)}
                      disabled={!canEdit}
                      className={field.key.includes('email') ? undefined : 'mono'}
                    />
                    <div className="tiny muted" style={{ marginTop: 2 }}>{field.key}</div>
                  </Field>
                ))}
              </div>
            </Card>
          ))}

          {canEdit ? (
            <div className="form-actions">
              <Button onClick={save} loading={busy === 'save'}>
                <Icon name="check" className="icon-sm" /> Save settings
              </Button>
            </div>
          ) : null}
        </div>

        <div className="stack">
          <Card className="card-pad">
            <CardHeader title="Money example" subtitle="This must reconcile exactly." />
            <div className="kv">
              <div className="kv-row"><span className="kv-key">Assignment value</span><span className="kv-val strong">₹20,000</span></div>
              <div className="kv-row"><span className="kv-key">Advance (50%)</span><span className="kv-val">₹10,000</span></div>
              <div className="kv-row"><span className="kv-key">Activation fee</span><span className="kv-val">− ₹699</span></div>
              <div className="kv-row"><span className="kv-key">First payout</span><span className="kv-val strong">₹9,301</span></div>
              <div className="kv-row"><span className="kv-key">Final payout</span><span className="kv-val">₹10,000</span></div>
              <div className="kv-row"><span className="kv-key">Total to professional</span><span className="kv-val strong">₹19,301</span></div>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              GST on the ₹699 fee is ₹106.63, with a base of ₹592.37. The platform fee is configured at 0% so the example
              reconciles exactly.
            </p>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Working rules" />
            <div className="stack-sm">
              {[
                ['Shifts', '8, 10 or 12 hours'],
                ['Days', 'Four days per week'],
                ['Off', 'Sunday and Monday'],
                ['Available', 'Tuesday to Saturday'],
                ['Caps', '12 hours per day, 48 per week'],
                ['Breaks', '15 + 15 + 30 minutes']
              ].map(([label, value]) => (
                <div className="between" key={label}>
                  <span className="tiny muted">{label}</span>
                  <span className="tiny strong">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="card-pad">
            <div className="row"><span className="icon-tile navy sm"><Icon name="lock" /></span><strong>Change control</strong></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Every settings change is audited with the actor, keys changed and timestamp. Existing contracts keep the
              terms disclosed at acceptance.
            </p>
          </Card>

          <Alert tone="warning" title="Tax and legal review">
            GST and TDS settings are operational controls, not tax advice. Confirm treatment with the company's tax
            adviser before production use.
          </Alert>
        </div>
      </div>

      <div className="portal-section">
        <SectionTitle title="Read-only configuration" sub="Values surfaced by the API but not editable through this screen." />
        <Card className="card-pad">
          <div className="grid grid-3">
            <div><div className="stat-label">TDS threshold</div><div className="small strong">₹5,00,000</div></div>
            <div><div className="stat-label">Marketplace minimum rating</div><div className="small strong">0</div></div>
            <div><div className="stat-label">Fraud review threshold</div><div className="small strong">60</div></div>
          </div>
        </Card>
      </div>
    </>
  );
}
