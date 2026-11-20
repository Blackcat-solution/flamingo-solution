import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageHero } from '../../components/PublicPageHero';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Icon, Input, Loading, Modal,
  Pagination, Rating, Select
} from '../../components/ui';
import { dayList, inr } from '../../lib/format';
import { useApi, useDebounced, useDocumentTitle } from '../../lib/hooks';

const DAYS = ['TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function Marketplace() {
  useDocumentTitle('Find verified professionals');
  const { data: categoryData } = useApi<{ categories: any[] }>('/public/categories');
  const [filters, setFilters] = useState({
    q: '',
    category: '',
    city: '',
    minExperience: '',
    maxRate: '',
    minRating: '',
    availabilityDay: '',
    minScore: '',
    sort: 'rating'
  });
  const [page, setPage] = useState(1);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const debouncedQ = useDebounced(filters.q, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters.category, filters.city, filters.minExperience, filters.maxRate, filters.minRating, filters.availabilityDay, filters.minScore, filters.sort]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (filters.category) params.set('category', filters.category);
    if (filters.city) params.set('city', filters.city);
    if (filters.minExperience) params.set('minExperience', filters.minExperience);
    if (filters.maxRate) params.set('maxRate', filters.maxRate);
    if (filters.minRating) params.set('minRating', filters.minRating);
    if (filters.availabilityDay) params.set('availabilityDay', filters.availabilityDay);
    if (filters.minScore) params.set('minScore', filters.minScore);
    if (filters.sort) params.set('sort', filters.sort);
    params.set('page', String(page));
    params.set('limit', '9');
    return `/marketplace/professionals?${params.toString()}`;
  }, [debouncedQ, filters, page]);

  const { data, loading, error } = useApi<any>(path);
  const { data: compareData } = useApi<any>(compareOpen && compareIds.length ? `/marketplace/compare?ids=${compareIds.join(',')}` : null);

  const update = (key: keyof typeof filters) => (event: any) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const reset = () => setFilters({ q: '', category: '', city: '', minExperience: '', maxRate: '', minRating: '', availabilityDay: '', minScore: '', sort: 'rating' });

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  };

  const professionals = data?.professionals || [];
  const pagination = data?.pagination;
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== 'sort' && value).length;

  return (
    <>
      <PublicPageHero
        eyebrow="Professional directory"
        title="Verified capability, on your terms."
        lead="Every public profile has passed identity and experience verification plus a Flamingo assessment. Filter by category, rate, availability and assessed score. All profiles are seeded demonstration data."
        meta={
          <>
            <span><Icon name="shield-check" className="icon-sm" /> Identity verified</span>
            <span><Icon name="award" className="icon-sm" /> Assessment passed</span>
            <span><Icon name="lock" className="icon-sm" /> Contact only after shortlist</span>
          </>
        }
      />

      <section className="section-tight" style={{ paddingTop: 20 }}>
        <div className="container">
          <Card className="card-pad" style={{ marginBottom: 22 }}>
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <div className="searchbox">
                <Icon name="search" />
                <Input
                  placeholder="Search by name, skill, headline or summary"
                  value={filters.q}
                  onChange={update('q')}
                  aria-label="Search professionals"
                />
              </div>
              <Select value={filters.sort} onChange={update('sort')} aria-label="Sort results">
                <option value="rating">Highest rated</option>
                <option value="experience">Most experienced</option>
                <option value="rate_low">Rate: low to high</option>
                <option value="rate_high">Rate: high to low</option>
                <option value="newest">Newest</option>
              </Select>
              {activeCount ? <Button variant="ghost" size="sm" onClick={reset}><Icon name="x" className="icon-sm" /> Clear {activeCount}</Button> : null}
            </div>
            <div className="filters">
              <Field label="Category">
                <Select value={filters.category} onChange={update('category')}>
                  <option value="">All categories</option>
                  {(categoryData?.categories || []).map((category) => (
                    <option key={category.key} value={category.key}>{category.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="City">
                <Input value={filters.city} onChange={update('city')} placeholder="Any city" />
              </Field>
              <Field label="Min experience (years)">
                <Input type="number" min={0} max={40} value={filters.minExperience} onChange={update('minExperience')} placeholder="3" />
              </Field>
              <Field label="Max rate (₹/hour)">
                <Input type="number" min={0} step={100} value={filters.maxRate} onChange={update('maxRate')} placeholder="Any" />
              </Field>
              <Field label="Min rating">
                <Select value={filters.minRating} onChange={update('minRating')}>
                  <option value="">Any</option>
                  <option value="3">3.0+</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                </Select>
              </Field>
              <Field label="Available on">
                <Select value={filters.availabilityDay} onChange={update('availabilityDay')}>
                  <option value="">Any working day</option>
                  {DAYS.map((day) => <option key={day} value={day}>{day[0] + day.slice(1).toLowerCase()}</option>)}
                </Select>
              </Field>
              <Field label="Min assessment score">
                <Select value={filters.minScore} onChange={update('minScore')}>
                  <option value="">Any</option>
                  <option value="70">70+</option>
                  <option value="80">80+</option>
                  <option value="90">90+</option>
                </Select>
              </Field>
            </div>
          </Card>

          <div className="between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong>{loading ? 'Searching…' : `${pagination?.total ?? 0} verified professionals`}</strong>
              <span className="tiny muted" style={{ marginLeft: 8 }}>Demonstration profiles, seeded for evaluation.</span>
            </div>
            {compareIds.length ? (
              <div className="row">
                <span className="tiny muted">{compareIds.length}/4 selected</span>
                <Button size="sm" variant="secondary" onClick={() => setCompareOpen(true)}>Compare <Icon name="layers" className="icon-sm" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setCompareIds([])}>Clear</Button>
              </div>
            ) : null}
          </div>

          {error ? <Card className="card-pad" style={{ marginBottom: 18 }}><span className="text-danger">{error}</span></Card> : null}

          {loading && !professionals.length ? (
            <Loading label="Loading verified professionals." />
          ) : professionals.length ? (
            <>
              <div className="grid grid-3">
                {professionals.map((professional: any) => {
                  const selected = compareIds.includes(professional.id);
                  return (
                    <Card key={professional.id} className="market-card">
                      <div className="market-head">
                        <Avatar name={professional.name} size="lg" />
                        <div className="grow">
                          <div className="market-name">{professional.name}</div>
                          <div className="market-role clamp-2">{professional.headline}</div>
                          <div className="row" style={{ gap: 6, marginTop: 6 }}>
                            <Rating value={professional.rating} />
                            {professional.isDemo ? <Badge tone="outline">Demo</Badge> : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`btn btn-sm ${selected ? 'btn-dark' : 'btn-secondary'}`}
                          onClick={() => toggleCompare(professional.id)}
                          aria-pressed={selected}
                          title={selected ? 'Remove from comparison' : 'Add to comparison'}
                        >
                          <Icon name={selected ? 'check' : 'layers'} className="icon-sm" />
                        </button>
                      </div>
                      <div className="market-meta">
                        <span><Icon name="map-pin" className="icon-sm" /> {professional.city || 'India'}</span>
                        <span><Icon name="briefcase" className="icon-sm" /> {professional.yearsExperience} yrs</span>
                        {professional.assessmentScore ? <span><Icon name="award" className="icon-sm" /> {professional.assessmentScore}/100</span> : null}
                      </div>
                      <div className="chips">
                        {(professional.skills || []).slice(0, 3).map((skill: string) => <span className="chip" key={skill}>{skill}</span>)}
                        {(professional.skills || []).length > 3 ? <span className="chip">+{(professional.skills || []).length - 3}</span> : null}
                      </div>
                      <div className="market-rate">
                        <strong>{inr(professional.hourlyRatePaise)}</strong>
                        <span>/ hour</span>
                      </div>
                      <div className="market-foot">
                        <span className="tiny muted"><Icon name="calendar" className="icon-sm" /> {dayList(professional.availabilityDays)}</span>
                        <Link className="btn btn-soft btn-sm" to={`/professionals/${professional.id}`}>
                          View profile <Icon name="arrow-right" className="icon-sm" />
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
              {pagination ? (
                <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
              ) : null}
            </>
          ) : (
            <EmptyState
              icon="search"
              title="No professionals match those filters."
              description="Try widening the rate, experience or availability filters. New verified profiles appear after assessment review."
              action={<Button variant="secondary" onClick={reset}>Clear filters</Button>}
            />
          )}

          <div className="notice" style={{ marginTop: 28 }}>
            <strong>Demonstration data</strong>
            {data?.disclosure || 'Every candidate shown here is seeded demonstration data. Verification, assessments and reviews are simulated for product evaluation.'}
          </div>
        </div>
      </section>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare professionals"
        subtitle="Public fields only. Contact details are never included in comparisons."
        size="xl"
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Attribute</th>
                {(compareData?.professionals || []).map((professional: any) => (
                  <th key={professional.id}>{professional.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td>Headline</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}>{p.headline}</td>)}</tr>
              <tr><td>Category</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}>{p.category}</td>)}</tr>
              <tr><td>Experience</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}>{p.yearsExperience} years</td>)}</tr>
              <tr><td>Hourly rate</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}>{inr(p.hourlyRatePaise)}</td>)}</tr>
              <tr><td>Rating</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}><Rating value={p.rating} /></td>)}</tr>
              <tr><td>Assessment</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}>{p.assessmentStatus === 'passed' ? 'Passed' : p.assessmentStatus}</td>)}</tr>
              <tr><td>Availability</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}>{dayList(p.availabilityDays)}</td>)}</tr>
              <tr><td>Shift</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}>{p.shiftHours} hours/day</td>)}</tr>
              <tr><td>Skills</td>{(compareData?.professionals || []).map((p: any) => <td key={p.id}>{(p.skills || []).join(', ')}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>{compareData?.note}</p>
      </Modal>
    </>
  );
}
