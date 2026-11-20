import { useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Icon, Input, Loading,
  Modal, PageHeader, Select, StatusBadge, Tabs, Textarea
} from '../../../components/ui';
import { api } from '../../../lib/api';
import { dateLabel, inr, titleCase } from '../../../lib/format';
import { todayISO, rupeesToPaise, useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

const DAYS = [
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' }
];

const emptyForm = {
  title: '',
  category: 'technology',
  description: '',
  skills: '',
  minExperience: '3',
  shiftHours: '8',
  workingDays: ['TUE', 'WED', 'THU', 'FRI'],
  hoursPerWeek: '32',
  startDate: todayISO(),
  durationWeeks: '8',
  budget: '',
  status: 'open'
};

type Filter = 'all' | 'open' | 'draft' | 'paused' | 'closed';

export default function EmployerRequirements() {
  useDocumentTitle('Requirements');
  const { data, loading, error, reload } = useApi<any>('/employer/requirements');
  const { data: categoryData } = useApi<any>('/public/categories');
  const { data: dashboard } = useApi<any>('/employer/dashboard');
  const { busy, run } = useAction();
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const categories = categoryData?.categories || [];
  const verified = dashboard?.employer?.verificationStatus === 'verified' || dashboard?.verification?.status === 'verified';
  const requirements = data?.requirements || [];
  const filtered = requirements.filter((requirement: any) => filter === 'all' || requirement.status === filter);

  if (loading) return <Loading label="Loading requirements." />;
  if (error) return <Alert tone="danger" title="Could not load requirements">{error}</Alert>;

  const update = (key: string) => (event: any) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const toggleDay = (day: string) => {
    setForm((current) => {
      const days = current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : current.workingDays.length >= 4 ? current.workingDays : [...current.workingDays, day];
      return { ...current, workingDays: days };
    });
  };

  const create = () =>
    run('create', async () => {
      const skills = form.skills.split(',').map((item) => item.trim()).filter(Boolean);
      if (!skills.length) throw new Error('Add at least one required skill.');
      if (form.description.trim().length < 20) throw new Error('Describe the work in at least 20 characters.');
      if (!form.workingDays.length) throw new Error('Choose at least one working day.');
      await api('/employer/requirements', {
        method: 'POST',
        body: {
          title: form.title,
          category: form.category,
          description: form.description,
          skills,
          minExperience: Number(form.minExperience),
          hoursPerWeek: Number(form.hoursPerWeek),
          shiftHours: Number(form.shiftHours),
          workingDays: form.workingDays,
          startDate: form.startDate,
          durationWeeks: Number(form.durationWeeks),
          budgetHourlyPaise: rupeesToPaise(form.budget),
          status: form.status
        }
      });
      setForm({ ...emptyForm });
      setModalOpen(false);
      reload();
    }, 'Requirement saved.');

  const changeStatus = (id: string, status: string) =>
    run(`status-${id}`, async () => {
      await api(`/employer/requirements/${id}`, { method: 'PATCH', body: { status } });
      reload();
    }, `Requirement ${status}.`);

  const maxWeekly = Number(form.shiftHours) * form.workingDays.length;

  return (
    <>
      <PageHeader
        title="Requirements"
        eyebrow="Hiring briefs"
        description="Define the work before you search. Rates must sit inside the sourced market range, and schedules must follow the four-day, 48-hour policy."
        actions={
          <Button onClick={() => setModalOpen(true)} disabled={!verified}>
            <Icon name="plus" className="icon-sm" /> New requirement
          </Button>
        }
      />

      {!verified ? (
        <Alert tone="warning" title="Verification required">
          You can browse talent while verification is pending, but creating requirements, shortlisting, interviewing and
          hiring require a verified organisation. <a href="/portal/employer/profile">Complete verification</a>.
        </Alert>
      ) : null}

      <div className="grid grid-4">
        <div className="stat"><div className="stat-row"><span className="stat-label">Total briefs</span><span className="stat-icon"><Icon name="file-text" /></span></div><span className="stat-value">{requirements.length}</span><span className="stat-sub">Across all statuses</span></div>
        <div className="stat"><div className="stat-row"><span className="stat-label">Open</span><span className="stat-icon green"><Icon name="check-circle" /></span></div><span className="stat-value">{requirements.filter((item: any) => item.status === 'open').length}</span><span className="stat-sub">Visible to your team</span></div>
        <div className="stat"><div className="stat-row"><span className="stat-label">Drafts</span><span className="stat-icon gold"><Icon name="edit" /></span></div><span className="stat-value">{requirements.filter((item: any) => item.status === 'draft').length}</span><span className="stat-sub">Not yet published internally</span></div>
        <div className="stat"><div className="stat-row"><span className="stat-label">Average budget</span><span className="stat-icon"><Icon name="rupee" /></span></div><span className="stat-value">{inr(requirements.length ? requirements.reduce((sum: number, item: any) => sum + Number(item.budget_hourly_paise), 0) / requirements.length : 0, { compact: true })}</span><span className="stat-sub">Per hour</span></div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'all', label: 'All', count: requirements.length },
            { key: 'open', label: 'Open', count: requirements.filter((item: any) => item.status === 'open').length },
            { key: 'draft', label: 'Draft', count: requirements.filter((item: any) => item.status === 'draft').length },
            { key: 'paused', label: 'Paused', count: requirements.filter((item: any) => item.status === 'paused').length },
            { key: 'closed', label: 'Closed', count: requirements.filter((item: any) => item.status === 'closed').length }
          ]}
        />
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        {filtered.length ? filtered.map((requirement: any) => (
          <Card key={requirement.id} className="card-pad">
            <div className="between wrap" style={{ alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <Badge tone="outline">{requirement.code || requirement.id.slice(0, 12)}</Badge>
                  <StatusBadge status={requirement.status} />
                  <Badge tone="neutral">{titleCase(requirement.category)}</Badge>
                </div>
                <h3 className="card-title" style={{ marginTop: 10 }}>{requirement.title}</h3>
                <p className="page-sub clamp-2" style={{ marginBottom: 8 }}>{requirement.description}</p>
                <div className="chips">
                  <span className="chip"><Icon name="calendar" className="icon-sm" /> {(requirement.workingDays || []).join(' · ')}</span>
                  <span className="chip"><Icon name="clock" className="icon-sm" /> {requirement.shiftHours}h/day · {requirement.hoursPerWeek}h/week</span>
                  <span className="chip"><Icon name="user" className="icon-sm" /> {requirement.minExperience}+ years</span>
                  <span className="chip"><Icon name="rupee" className="icon-sm" /> {inr(requirement.budget_hourly_paise)}/hour</span>
                  <span className="chip"><Icon name="map-pin" className="icon-sm" /> Starts {dateLabel(requirement.start_date)}</span>
                </div>
                <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                  {(requirement.skills || []).map((skill: string) => <Badge key={skill} tone="outline">{skill}</Badge>)}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 160 }}>
                <div className="stat-label">Engagement</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 750 }}>{requirement.durationWeeks} weeks</div>
                <div className="tiny muted">{inr(requirement.budget_hourly_paise * requirement.hours_per_week * requirement.durationWeeks)} estimated</div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              {requirement.status !== 'open' ? <Button variant="secondary" size="sm" onClick={() => changeStatus(requirement.id, 'open')} loading={busy === `status-${requirement.id}`}>Publish</Button> : null}
              {requirement.status === 'open' ? <Button variant="secondary" size="sm" onClick={() => changeStatus(requirement.id, 'paused')} loading={busy === `status-${requirement.id}`}>Pause</Button> : null}
              {requirement.status !== 'closed' ? <Button variant="secondary" size="sm" onClick={() => changeStatus(requirement.id, 'closed')} loading={busy === `status-${requirement.id}`}>Close</Button> : null}
              <a className="btn btn-primary btn-sm" href={`/portal/employer/talent?requirement=${requirement.id}`}>Find talent <Icon name="arrow-right" className="icon-sm" /></a>
            </div>
          </Card>
        )) : (
          <EmptyState
            icon="file-text"
            title={filter === 'all' ? 'No requirements yet' : `No ${filter} requirements`}
            description="A clear brief helps verified professionals self-select and keeps rates and schedules compliant from the start."
            action={<Button onClick={() => setModalOpen(true)} disabled={!verified}>Create your first requirement</Button>}
          />
        )}
      </div>

      <div className="portal-section">
        <div className="grid grid-3">
          <Card className="card-pad">
            <span className="icon-tile"><Icon name="calendar" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Four-day pattern</strong>
            <p className="tiny muted">Choose up to four days between Tuesday and Saturday. Sunday and Monday are compulsory off days.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile green"><Icon name="clock" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>48-hour cap</strong>
            <p className="tiny muted">Weekly hours cannot exceed shift hours × working days, and never exceed 48 hours.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile gold"><Icon name="rupee" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Sourced rates</strong>
            <p className="tiny muted">Budgets outside the published category range are rejected so pricing stays transparent.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create a hiring requirement"
        subtitle="This becomes the shared brief for shortlisting and contracting."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={busy === 'create'}>Save requirement</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Requirement title" htmlFor="rq-title" required className="span-2">
            <Input id="rq-title" value={form.title} onChange={update('title')} placeholder="e.g. Senior frontend engineer for design-system migration" maxLength={180} />
          </Field>
          <Field label="Category" htmlFor="rq-category" required>
            <Select id="rq-category" value={form.category} onChange={update('category')}>
              {categories.map((category: any) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </Select>
          </Field>
          <Field label="Minimum experience" htmlFor="rq-exp" required hint="Years. Flamingo's marketplace floor is three years.">
            <Input id="rq-exp" type="number" min={0} max={40} value={form.minExperience} onChange={update('minExperience')} />
          </Field>
          <Field label="Scope of work" htmlFor="rq-description" required className="span-2" hint={`${form.description.length}/4000 characters. Minimum 20.`}>
            <Textarea id="rq-description" value={form.description} onChange={update('description')} maxLength={4000} placeholder="What needs to be delivered, in what context, and how success will be judged." />
          </Field>
          <Field label="Required skills" htmlFor="rq-skills" required className="span-2" hint="Comma-separated. At least one.">
            <Input id="rq-skills" value={form.skills} onChange={update('skills')} placeholder="React, TypeScript, Design systems" />
          </Field>
          <Field label="Shift length" htmlFor="rq-shift" required>
            <Select id="rq-shift" value={form.shiftHours} onChange={update('shiftHours')}>
              <option value="8">8 hours</option>
              <option value="10">10 hours</option>
              <option value="12">12 hours</option>
            </Select>
          </Field>
          <Field label="Hours per week" htmlFor="rq-hours" required hint={`Maximum ${maxWeekly} hours for this pattern.`}>
            <Input id="rq-hours" type="number" min={4} max={Math.min(48, maxWeekly || 48)} value={form.hoursPerWeek} onChange={update('hoursPerWeek')} />
          </Field>
          <Field label="Working days" htmlFor="rq-days" required className="span-2" hint="Up to four days. Sunday and Monday are blocked by policy.">
            <div className="row wrap" id="rq-days">
              {DAYS.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={`btn btn-sm ${form.workingDays.includes(day.key) ? 'btn-dark' : 'btn-secondary'}`}
                  onClick={() => toggleDay(day.key)}
                  aria-pressed={form.workingDays.includes(day.key)}
                >
                  {form.workingDays.includes(day.key) ? <Icon name="check" className="icon-sm" /> : null}{day.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Start date" htmlFor="rq-start" required>
            <Input id="rq-start" type="date" value={form.startDate} min={todayISO()} onChange={update('startDate')} />
          </Field>
          <Field label="Duration (weeks)" htmlFor="rq-duration" required>
            <Input id="rq-duration" type="number" min={1} max={52} value={form.durationWeeks} onChange={update('durationWeeks')} />
          </Field>
          <Field label="Budget rate (₹ per hour)" htmlFor="rq-budget" required hint="Must sit inside the sourced range for the category and level.">
            <Input id="rq-budget" type="number" min={100} step={50} value={form.budget} onChange={update('budget')} placeholder="e.g. 2200" />
          </Field>
          <Field label="Status" htmlFor="rq-status">
            <Select id="rq-status" value={form.status} onChange={update('status')}>
              <option value="open">Open</option>
              <option value="draft">Draft</option>
            </Select>
          </Field>
        </div>
        <Alert tone="info" title="Before you publish">
          The weekly rate is agreed on the assignment contract. A 50% advance is funded after both parties accept, and
          the professional pays a one-time ₹699 activation fee from the first payout.
        </Alert>
      </Modal>
    </>
  );
}
