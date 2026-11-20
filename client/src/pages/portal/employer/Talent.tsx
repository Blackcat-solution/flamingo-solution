import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert, Avatar, Badge, Button, Card, EmptyState, Field, Icon, Input, Loading, Modal,
  PageHeader, Pagination, Select, Textarea
} from '../../../components/ui';
import { api } from '../../../lib/api';
import { dayList, inr, titleCase } from '../../../lib/format';
import { useApi, useDebounced, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

const DAYS = ['TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function EmployerTalent() {
  useDocumentTitle('Talent search');
  const [searchParams] = useSearchParams();
  const requirementFilter = searchParams.get('requirement') || '';
  const { data: categoryData } = useApi<any>('/public/categories');
  const { data: requirementData } = useApi<any>('/employer/requirements');
  const { data: shortlistData, reload: reloadShortlist } = useApi<any>('/employer/shortlist');
  const { data: dashboard } = useApi<any>('/employer/dashboard');
  const { busy, run } = useAction();

  const [filters, setFilters] = useState({
    q: '',
    category: '',
    city: '',
    minExperience: '3',
    maxRate: '',
    minRating: '',
    availabilityDay: '',
    sort: 'rating'
  });
  const [page, setPage] = useState(1);
  const [candidate, setCandidate] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [requirementId, setRequirementId] = useState(requirementFilter);
  const debouncedQ = useDebounced(filters.q, 350);

  useEffect(() => setPage(1), [debouncedQ, filters.category, filters.city, filters.minExperience, filters.maxRate, filters.minRating, filters.availabilityDay, filters.sort]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (filters.category) params.set('category', filters.category);
    if (filters.city) params.set('city', filters.city);
    if (filters.minExperience) params.set('minExperience', filters.minExperience);
    if (filters.maxRate) params.set('maxRate', filters.maxRate);
    if (filters.minRating) params.set('minRating', filters.minRating);
    if (filters.availabilityDay) params.set('availabilityDay', filters.availabilityDay);
    params.set('sort', filters.sort);
    params.set('page', String(page));
    params.set('limit', '9');
    return `/marketplace/professionals?${params.toString()}`;
  }, [debouncedQ, filters, page]);

  const { data, loading, error } = useApi<any>(path);
  const categories = categoryData?.categories || [];
  const requirements = requirementData?.requirements || [];
  const shortlistedIds = new Set((shortlistData?.shortlist || []).map((item: any) => item.id));
  const canShortlist = dashboard?.verification?.status === 'verified' || dashboard?.employer?.verificationStatus === 'verified';
  const professionals = data?.professionals || [];

  const update = (key: keyof typeof filters) => (event: any) => setFilters((current) => ({ ...current, [key]: event.target.value }));

  const openShortlist = (professional: any) => {
    setCandidate(professional);
    setNote('');
    setRequirementId(requirementFilter);
  };

  const shortlist = () =>
    run('shortlist', async () => {
      if (!candidate) return;
      await api('/employer/shortlist', {
        method: 'POST',
        body: { professionalId: candidate.id, requirementId: requirementId || null, note: note || undefined }
      });
      setCandidate(null);
      reloadShortlist();
    }, 'Candidate added to your shortlist.');

  return (
    <>
      <PageHeader
        title="Talent search"
        eyebrow="Verified marketplace"
        description="Every public profile has passed identity and experience verification plus a human-reviewed assessment. Filter by evidence, availability and rate."
        actions={<Link className="btn btn-secondary" to="/portal/employer/shortlist"><Icon name="users" className="icon-sm" /> Shortlist ({shortlistedIds.size})</Link>}
      />

      {!canShortlist ? (
        <Alert tone="warning" title="Shortlisting is locked until verification">
          You can review public profiles now. Verify your organisation to shortlist candidates and release their contact
          details. <Link to="/portal/employer/profile">Complete verification</Link>.
        </Alert>
      ) : null}

      <Card className="card-pad" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <div className="searchbox grow">
            <Icon name="search" className="icon-sm" />
            <Input value={filters.q} onChange={update('q')} placeholder="Search by name, headline, skill or summary" aria-label="Search professionals" />
          </div>
          <Select value={filters.category} onChange={update('category')} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((category: any) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </Select>
          <Input value={filters.city} onChange={update('city')} placeholder="City" aria-label="City" />
          <Select value={filters.minExperience} onChange={update('minExperience')} aria-label="Minimum experience">
            <option value="3">3+ years</option>
            <option value="5">5+ years</option>
            <option value="8">8+ years</option>
            <option value="12">12+ years</option>
          </Select>
          <Select value={filters.maxRate} onChange={update('maxRate')} aria-label="Maximum rate">
            <option value="">Any rate</option>
            <option value="1000">Up to ₹1,000/h</option>
            <option value="1500">Up to ₹1,500/h</option>
            <option value="2000">Up to ₹2,000/h</option>
            <option value="3000">Up to ₹3,000/h</option>
            <option value="5000">Up to ₹5,000/h</option>
          </Select>
          <Select value={filters.availabilityDay} onChange={update('availabilityDay')} aria-label="Availability">
            <option value="">Any day</option>
            {DAYS.map((day) => <option key={day} value={day}>{titleCase(day)}</option>)}
          </Select>
          <Select value={filters.sort} onChange={update('sort')} aria-label="Sort">
            <option value="rating">Best rated</option>
            <option value="rate_low">Lowest rate</option>
            <option value="rate_high">Highest rate</option>
            <option value="experience">Most experienced</option>
            <option value="newest">Newest</option>
          </Select>
        </div>
      </Card>

      {loading ? <Loading label="Searching verified professionals." /> : error ? (
        <Alert tone="danger" title="Search failed">{error}</Alert>
      ) : professionals.length ? (
        <>
          <div className="grid grid-3" style={{ marginTop: 20 }}>
            {professionals.map((professional: any) => {
              const already = shortlistedIds.has(professional.id);
              return (
                <Card key={professional.id} className="market-card">
                  <div className="market-head">
                    <Avatar name={professional.name} size="lg" />
                    <div className="grow">
                      <div className="market-name">{professional.name}</div>
                      <div className="market-role">{professional.headline}</div>
                      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                        <Badge tone="success"><Icon name="shield-check" className="icon-sm" /> Verified</Badge>
                        <Badge tone="brand">Assessment {professional.assessmentScore ?? '—'}</Badge>
                        {professional.isDemo ? <Badge tone="outline">Demo data</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <div className="market-meta">
                    <span><Icon name="map-pin" className="icon-sm" /> {professional.city}</span>
                    <span><Icon name="briefcase" className="icon-sm" /> {professional.yearsExperience} yrs</span>
                    <span><Icon name="star" className="icon-sm" /> {professional.rating ? Number(professional.rating).toFixed(1) : 'New'}</span>
                  </div>
                  <div className="chips">
                    <span className="chip"><Icon name="calendar" className="icon-sm" /> {dayList(professional.availabilityDays)}</span>
                    <span className="chip"><Icon name="clock" className="icon-sm" /> {professional.shiftHours}h shift</span>
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    {(professional.skills || []).slice(0, 4).map((skill: string) => <Badge key={skill} tone="outline">{skill}</Badge>)}
                  </div>
                  <div className="market-foot">
                    <div className="market-rate"><strong>{inr(professional.hourlyRatePaise)}</strong><span>/hour</span></div>
                    <div className="row" style={{ gap: 6 }}>
                      <Link className="btn btn-secondary btn-sm" to={`/professionals/${professional.id}`}>Profile</Link>
                      <Button size="sm" variant={already ? 'soft' : 'primary'} disabled={already || !canShortlist} onClick={() => openShortlist(professional)}>
                        {already ? <><Icon name="check" className="icon-sm" /> Shortlisted</> : 'Shortlist'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onChange={setPage} />
          <p className="tiny muted" style={{ marginTop: 12 }}>{data.disclosure}</p>
        </>
      ) : (
        <EmptyState icon="search" title="No matching professionals" description="Broaden the filters or lower the minimum experience. Only verified, publicly visible professionals appear here." />
      )}

      <div className="portal-section">
        <div className="grid grid-3">
          <Card className="card-pad">
            <span className="icon-tile"><Icon name="shield-check" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Evidence first</strong>
            <p className="tiny muted">Identity, experience and a passed assessment are prerequisites for visibility.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile green"><Icon name="lock" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Contact privacy</strong>
            <p className="tiny muted">Candidate contact details are released only after you shortlist them, and the access is logged.</p>
          </Card>
          <Card className="card-pad">
            <span className="icon-tile gold"><Icon name="star" /></span>
            <strong style={{ display: 'block', marginTop: 10 }}>Honest comparisons</strong>
            <p className="tiny muted">Ratings and assessment scores come from completed work and human-reviewed assessments.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(candidate)}
        onClose={() => setCandidate(null)}
        title="Add to shortlist"
        subtitle={candidate ? `${candidate.name} · ${candidate.headline}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCandidate(null)}>Cancel</Button>
            <Button onClick={shortlist} loading={busy === 'shortlist'}>Shortlist candidate</Button>
          </>
        }
      >
        <Field label="Attach to requirement" htmlFor="sl-requirement" hint="Optional. This keeps your pipeline organised.">
          <Select id="sl-requirement" value={requirementId} onChange={(event) => setRequirementId(event.target.value)}>
            <option value="">No specific requirement</option>
            {requirements.map((requirement: any) => <option key={requirement.id} value={requirement.id}>{requirement.title}</option>)}
          </Select>
        </Field>
        <Field label="Private note" htmlFor="sl-note" hint="Visible only to your organisation. Maximum 500 characters.">
          <Textarea id="sl-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="Why this candidate fits the brief." />
        </Field>
        <Alert tone="info" title="What happens next">
          Shortlisting releases contact details to your verified organisation and lets you schedule up to two interview
          rounds. The candidate is notified.
        </Alert>
      </Modal>
    </>
  );
}
