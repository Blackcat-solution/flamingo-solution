import { Link, useNavigate } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Icon, Loading, PageHeader,
  StatusBadge
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { api } from '../../../lib/api';
import { dateLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

export default function ProfessionalAssessments() {
  useDocumentTitle('Assessments');
  const { data, loading, error, reload } = useApi<any>('/professional/assessments');
  const { busy, run } = useAction();
  const navigate = useNavigate();

  if (loading) return <Loading label="Loading assessments." />;
  if (error) return <Alert tone="danger" title="Could not load assessments">{error}</Alert>;
  if (!data) return null;

  const start = (assessment: any) =>
    run(`start-${assessment.id}`, async () => {
      const result = await api<{ attemptId: string; resumed?: boolean }>(`/professional/assessments/${assessment.id}/start`, { method: 'POST' });
      navigate(`/portal/professional/assessments/attempt/${result.attemptId}`);
    });

  return (
    <>
      <PageHeader
        title="Assessments"
        eyebrow="Capability evidence"
        description="Timed practical work, scored by a human against a published rubric. Assessments are free. Integrity signals are never treated as automated proof of misconduct."
        actions={<Button variant="secondary" onClick={reload}><Icon name="refresh" className="icon-sm" /> Refresh</Button>}
      />

      <div className="grid grid-3">
        <Card className="card-pad">
          <div className="row"><span className="icon-tile"><Icon name="award" /></span><strong>Recommended for you</strong></div>
          <p className="page-sub" style={{ marginTop: 8 }}>Based on your professional category. You may take another category if it better matches your work.</p>
          <div className="stat" style={{ marginTop: 12 }}>
            <span className="stat-label">Assessment status</span>
            <span className="stat-value" style={{ fontSize: '1.3rem' }}>{data.attempts.find((attempt: any) => attempt.status === 'passed') ? 'Passed' : 'Not passed yet'}</span>
          </div>
        </Card>
        <Card className="card-pad">
          <div className="row"><span className="icon-tile gold sm"><Icon name="clock" /></span><strong>Timed</strong></div>
          <p className="page-sub" style={{ marginTop: 8 }}>The timer starts when you begin. Your answers save as you work. Expired attempts are marked expired.</p>
        </Card>
        <Card className="card-pad">
          <div className="row"><span className="icon-tile green sm"><Icon name="users" /></span><strong>Human review</strong></div>
          <p className="page-sub" style={{ marginTop: 8 }}>Practical answers are scored against a rubric. Results usually publish within two business days.</p>
        </Card>
      </div>

      <div className="portal-section">
        <SectionTitle title="Recommended assessments" sub="Start with the assessment aligned to your category." />
        {data.recommended.length ? (
          <div className="grid grid-2">
            {data.recommended.map((assessment: any) => {
              const passed = data.attempts.find((attempt: any) => attempt.assessmentId === assessment.id && attempt.status === 'passed');
              return (
                <Card key={assessment.id} className="card-pad">
                  <div className="between">
                    <div>
                      <Badge tone="brand">{titleCase(assessment.category)}</Badge>
                      <h3 className="card-title" style={{ marginTop: 10 }}>{assessment.title}</h3>
                    </div>
                    {passed ? <Badge tone="success">Passed · {passed.finalScore}/100</Badge> : <Badge tone="outline">{assessment.questionCount} questions</Badge>}
                  </div>
                  <p className="page-sub" style={{ marginTop: 8 }}>{assessment.description}</p>
                  <div className="row wrap" style={{ marginTop: 12 }}>
                    <span className="chip"><Icon name="clock" className="icon-sm" /> {assessment.durationMinutes} minutes</span>
                    <span className="chip"><Icon name="target" className="icon-sm" /> Pass mark {assessment.passScore}/100</span>
                    <span className="chip"><Icon name="file-text" className="icon-sm" /> {assessment.questionCount} questions</span>
                  </div>
                  <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: 14 }}>
                    {passed ? (
                      <Link className="btn btn-secondary" to={`/portal/professional/assessments/attempt/${passed.id}`}>View result</Link>
                    ) : (
                      <Button onClick={() => start(assessment)} loading={busy === `start-${assessment.id}`}>
                        <Icon name="play" className="icon-sm" /> Start assessment
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="award" title="No category assessment yet" description="Browse all assessments below. A pricing analyst is required to add a sourced benchmark for a new category." />
        )}
      </div>

      <div className="portal-section">
        <SectionTitle title="All assessments" sub="Free to take. Retakes follow the published waiting policy." />
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Assessment</th><th>Category</th><th>Format</th><th>Pass mark</th><th className="actions">Action</th></tr></thead>
              <tbody>
                {data.all.map((assessment: any) => {
                  const passed = data.attempts.find((attempt: any) => attempt.assessmentId === assessment.id && attempt.status === 'passed');
                  return (
                    <tr key={assessment.id}>
                      <td><div className="list-title">{assessment.title}</div></td>
                      <td>{titleCase(assessment.category)}</td>
                      <td>{assessment.durationMinutes} min · {assessment.questionCount} questions</td>
                      <td>{assessment.passScore}/100</td>
                      <td className="actions">
                        {passed ? <Badge tone="success">Passed</Badge> : (
                          <Button size="sm" variant="secondary" onClick={() => start(assessment)} loading={busy === `start-${assessment.id}`}>Start</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="portal-section">
        <SectionTitle title="Attempt history" sub="Auto score covers objective questions. Final score includes human review." />
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Assessment</th><th>Attempt</th><th>Started</th><th>Status</th><th>Auto</th><th>Final</th><th>Integrity</th><th className="actions">View</th></tr></thead>
              <tbody>
                {data.attempts.length ? data.attempts.map((attempt: any) => (
                  <tr key={attempt.id}>
                    <td><div className="list-title">{attempt.title}</div><div className="tiny muted">{titleCase(attempt.category)}</div></td>
                    <td>#{attempt.attemptNo}</td>
                    <td>{dateLabel(attempt.startedAt)}</td>
                    <td><StatusBadge status={attempt.status} /></td>
                    <td className="num">{attempt.autoScore ?? '—'}</td>
                    <td className="num"><strong>{attempt.finalScore ?? '—'}</strong></td>
                    <td>{attempt.integrityScore ?? 100}/100</td>
                    <td className="actions">
                      <Link className="btn btn-secondary btn-sm" to={`/portal/professional/assessments/attempt/${attempt.id}`}>Open</Link>
                    </td>
                  </tr>
                )) : <tr><td colSpan={8} className="table-empty">No attempts yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Alert tone="warning" title="Integrity notice">
        {data.integrityNotice}
      </Alert>
    </>
  );
}
