import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert, Avatar, Badge, Button, Card, EmptyState, Icon, Loading, Modal,
  PageHeader, Stat, StatusBadge
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { api } from '../../../lib/api';
import { dayList, inr, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

export default function EmployerShortlist() {
  useDocumentTitle('Shortlist');
  const { data, loading, error, reload } = useApi<any>('/employer/shortlist');
  const { data: requirementData } = useApi<any>('/employer/requirements');
  const { busy, run } = useAction();
  const [contact, setContact] = useState<any | null>(null);

  if (loading) return <Loading label="Loading your shortlist." />;
  if (error) return <Alert tone="danger" title="Could not load your shortlist">{error}</Alert>;

  const shortlist = data?.shortlist || [];
  const requirements = requirementData?.requirements || [];
  const requirementName = (id?: string) => requirements.find((item: any) => item.id === id)?.title || 'General pipeline';
  const linked = shortlist.filter((candidate: any) => candidate.requirement_id).length;

  const remove = (shortlistId: string) =>
    run(`remove-${shortlistId}`, async () => {
      await api(`/employer/shortlist/${shortlistId}`, { method: 'DELETE' });
      reload();
    }, 'Candidate removed from your shortlist.');

  return (
    <>
      <PageHeader
        title="Shortlist"
        eyebrow="Hiring pipeline"
        description="Shortlisted candidates only: verified identity, verified experience and a passed assessment. Contact details are released to your organisation and every view is audited."
        actions={
          <>
            <Link className="btn btn-secondary" to="/portal/employer/talent">Find more talent</Link>
            <Link className="btn btn-primary" to="/portal/employer/interviews">Schedule interview <Icon name="arrow-right" className="icon-sm" /></Link>
          </>
        }
      />

      <div className="grid grid-4">
        <Stat label="Shortlisted" value={shortlist.length} sub="All verified professionals" icon="users" tone="success" />
        <Stat label="Linked to briefs" value={linked} sub={`${shortlist.length - linked} general pipeline`} icon="file-text" />
        <Stat label="Ready to interview" value={shortlist.length} sub="Maximum two rounds each" icon="video" />
        <Stat label="Average rate" value={inr(shortlist.length ? shortlist.reduce((sum: number, item: any) => sum + Number(item.hourlyRatePaise || 0), 0) / shortlist.length : 0, { compact: true })} sub="Per hour" icon="rupee" />
      </div>

      <div className="stack" style={{ marginTop: 24 }}>
        {shortlist.length ? shortlist.map((candidate: any) => (
          <Card key={candidate.shortlistId} className="card-pad">
            <div className="between wrap" style={{ alignItems: 'flex-start', gap: 16 }}>
              <div className="row" style={{ alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 260 }}>
                <Avatar name={candidate.name} size="lg" />
                <div>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <h3 className="card-title" style={{ margin: 0 }}>{candidate.name}</h3>
                    <Badge tone="success"><Icon name="shield-check" className="icon-sm" /> Verified</Badge>
                    <Badge tone="brand">Assessment {candidate.assessmentStatus === 'passed' ? 'passed' : candidate.assessmentStatus}</Badge>
                  </div>
                  <div className="page-sub" style={{ marginBottom: 8 }}>{candidate.headline}</div>
                  <div className="chips">
                    <span className="chip"><Icon name="briefcase" className="icon-sm" /> {titleCase(candidate.category)}</span>
                    <span className="chip"><Icon name="map-pin" className="icon-sm" /> {candidate.city}</span>
                    <span className="chip"><Icon name="award" className="icon-sm" /> {candidate.yearsExperience} years</span>
                    <span className="chip"><Icon name="calendar" className="icon-sm" /> {dayList(candidate.availabilityDays)}</span>
                    <span className="chip"><Icon name="star" className="icon-sm" /> {candidate.rating ? `${Number(candidate.rating).toFixed(1)} / 5` : 'New'}</span>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                    {(candidate.skills || []).slice(0, 6).map((skill: string) => <Badge key={skill} tone="outline">{skill}</Badge>)}
                  </div>
                  {candidate.note ? <p className="tiny muted" style={{ marginTop: 10 }}><strong>Your note:</strong> {candidate.note}</p> : null}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 170 }}>
                <div className="stat-label">{requirementName(candidate.requirement_id)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 750 }}>{inr(candidate.hourlyRatePaise)}</div>
                <div className="tiny muted">per hour · {candidate.completedAssignments} completed</div>
                <div className="row" style={{ gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                  <StatusBadge status={candidate.verificationStatus} />
                  <StatusBadge status={candidate.identityStatus} />
                </div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" onClick={() => remove(candidate.shortlistId)} loading={busy === `remove-${candidate.shortlistId}`}>
                <Icon name="trash" className="icon-sm" /> Remove
              </Button>
              <Link className="btn btn-secondary btn-sm" to={`/professionals/${candidate.id}`}>Public profile</Link>
              <Button variant="secondary" size="sm" onClick={() => setContact(candidate)}><Icon name="mail" className="icon-sm" /> Contact details</Button>
              <Link className="btn btn-secondary btn-sm" to={`/portal/employer/interviews?candidate=${candidate.id}${candidate.requirement_id ? `&requirement=${candidate.requirement_id}` : ''}`}>
                <Icon name="video" className="icon-sm" /> Schedule interview
              </Link>
              <Link className="btn btn-primary btn-sm" to={`/portal/employer/interviews?candidate=${candidate.id}`}>Open interview centre</Link>
            </div>
          </Card>
        )) : (
          <EmptyState
            icon="users"
            title="Your shortlist is empty"
            description="Search the verified marketplace and shortlist candidates who match an open requirement."
            action={<Link className="btn btn-primary" to="/portal/employer/talent">Search talent</Link>}
          />
        )}
      </div>

      <div className="portal-section">
        <SectionTitle title="From shortlist to contract" sub="The sequence is enforced in the platform, not just written in a policy." />
        <div className="grid grid-4">
          {[
            ['1. Shortlist', 'Releases contact details to your verified organisation.'],
            ['2. Round 1 panel', 'Structured scorecard submitted by the panel.'],
            ['3. Round 2 discussion', 'Final scope, schedule and payment conversation.'],
            ['4. Selected & contract', 'Only a completed Round 2 with “selected” unlocks hiring.']
          ].map(([title, copy], index) => (
            <Card className="card-pad" key={title}>
              <span className="icon-tile navy sm">{index + 1}</span>
              <strong style={{ display: 'block', marginTop: 10 }}>{title}</strong>
              <p className="tiny muted">{copy}</p>
            </Card>
          ))}
        </div>
      </div>

      <Alert tone="info" title="Privacy by design">
        Phone numbers and email addresses are not shown in list views. They are available through an audited candidate
        contact action only after shortlisting, and every access is written to the audit log.
      </Alert>

      <Modal
        open={Boolean(contact)}
        onClose={() => setContact(null)}
        title="Candidate contact details"
        subtitle={contact ? `${contact.name} · ${contact.headline}` : undefined}
        footer={<Button variant="secondary" onClick={() => setContact(null)}>Close</Button>}
      >
        {contact ? <ContactDetails professionalId={contact.id} /> : null}
      </Modal>
    </>
  );
}

function ContactDetails({ professionalId }: { professionalId: string }) {
  const { data, loading, error } = useApi<any>(`/marketplace/professionals/${professionalId}`);

  if (loading) return <Loading label="Releasing contact details." />;
  if (error) return <Alert tone="danger" title="Could not load contact details">{error}</Alert>;
  if (!data?.professional) return null;
  const professional = data.professional;

  return (
    <div className="stack">
      <Alert tone="success" title="Contact released to your organisation">
        This access was recorded in the audit log. Use the details only for this hiring process.
      </Alert>
      <div className="kv">
        <div className="kv-row"><span className="kv-key">Name</span><span className="kv-val">{professional.name}</span></div>
        <div className="kv-row"><span className="kv-key">Email</span><span className="kv-val">{professional.email || 'Not available'}</span></div>
        <div className="kv-row"><span className="kv-key">Phone</span><span className="kv-val">{professional.phone || 'Not available'}</span></div>
        <div className="kv-row"><span className="kv-key">Location</span><span className="kv-val">{professional.city}, {professional.state}</span></div>
        <div className="kv-row"><span className="kv-key">Notice period</span><span className="kv-val">{professional.noticePeriodDays} days</span></div>
      </div>
    </div>
  );
}
