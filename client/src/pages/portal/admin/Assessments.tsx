import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, DefinitionList, Field, Icon, Input, Loading,
  Modal, PageHeader, Pagination, Select, StatusBadge, Tabs, Textarea, ScoreRing
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { dateLabel, dateTimeLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

type StatusTab = 'human_review' | 'submitted' | 'passed' | 'failed';

const STATUS_LABEL: Record<StatusTab, string> = {
  human_review: 'Awaiting review',
  submitted: 'Submitted',
  passed: 'Passed',
  failed: 'Failed'
};

function AttemptReview({ attemptId, onClose, onDone }: { attemptId: string; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const { data, loading, error } = useApi<any>(`/admin/assessment-attempts/${attemptId}`);
  const [finalScore, setFinalScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState<'pass' | 'fail' | 'request_retake'>('pass');
  const [points, setPoints] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data?.attempt) return;
    const attempt = data.attempt;
    setFinalScore(String(attempt.final_score ?? attempt.auto_score ?? 0));
  }, [data]);

  useEffect(() => {
    if (!data?.questions) return;
    const next: Record<string, string> = {};
    for (const question of data.questions) {
      if (question.answer?.id) {
        next[question.answer.id] = String(question.answer.points_awarded ?? '');
      }
    }
    setPoints(next);
  }, [data]);

  const attempt = data?.attempt;
  const questions = data?.questions || [];
  const passMark = attempt?.pass_mark ?? 70;
  const practical = questions.filter((question: any) => question.type !== 'mcq');

  const review = () =>
    run('review', async () => {
      const payload = {
        finalScore: Number(finalScore),
        feedback,
        decision,
        answerPoints: practical
          .map((question: any) => question.answer)
          .filter(Boolean)
          .map((answer: any) => ({ answerId: answer.id, points: Number(points[answer.id] || 0) }))
      };
      await api(`/admin/assessment-attempts/${attemptId}/review`, { method: 'POST', body: payload });
      onDone();
      onClose();
    }, 'Assessment result recorded.');

  const scoreNumber = Number(finalScore) || 0;
  const canPass = scoreNumber >= passMark;

  return (
    <Modal
      open
      size="xl"
      title={attempt ? `${attempt.professional_name} · ${attempt.title}` : 'Assessment attempt'}
      subtitle={attempt ? `${titleCase(attempt.category)} · attempt ${attempt.attempt_no} · submitted ${dateTimeLabel(attempt.submitted_at)}` : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={review}
            loading={busy === 'review'}
            disabled={feedback.trim().length < 10 || (decision === 'pass' && !canPass)}
          >
            Record result
          </Button>
        </>
      }
    >
      {loading ? <Loading label="Loading the attempt." /> : null}
      {error ? <Alert tone="danger" title="Could not load the attempt">{error}</Alert> : null}
      {attempt ? (
        <>
          <div className="split">
            <div className="stack">
              <div className="between">
                <div>
                  <div className="stat-label">Status</div>
                  <div style={{ marginTop: 6 }}><StatusBadge status={attempt.status} /></div>
                </div>
                <ScoreRing value={attempt.auto_score ?? 0} label="Auto score" />
              </div>
              <DefinitionList
                items={[
                  { label: 'Pass mark', value: `${passMark}/100` },
                  { label: 'Objective score', value: `${data.objectiveSummary?.objectivePoints ?? 0} / ${data.objectiveSummary?.objectiveMax ?? 0}` },
                  { label: 'Integrity score', value: `${attempt.integrity_score}/100` },
                  { label: 'Duration', value: `${attempt.duration_minutes} minutes` },
                  { label: 'Headline', value: attempt.headline || '—' }
                ]}
              />
            </div>
            <div className="stack">
              <Card className="card-pad-sm">
                <div className="stat-label">Integrity signals</div>
                {attempt.integrityFlags?.length ? (
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {attempt.integrityFlags.map((flag: any, index: number) => (
                      <Badge key={`${flag.type}-${index}`} tone="warning">
                        {titleCase(typeof flag === 'string' ? flag : flag.type)}{typeof flag === 'object' && flag.count ? ` ×${flag.count}` : ''}
                      </Badge>
                    ))}
                  </div>
                ) : <p className="tiny muted" style={{ marginTop: 8 }}>No signals recorded.</p>}
                <p className="tiny muted" style={{ marginTop: 8 }}>
                  Signals prompt a closer human read. They are never proof of AI-assisted work or misconduct.
                </p>
              </Card>
            </div>
          </div>

          <div className="form-section" style={{ marginTop: 18 }}>
            <div className="form-section-head">
              <h3 className="form-section-title">Questions and answers</h3>
              <p className="form-section-sub">Score practical answers against the rubric. Objective questions are marked automatically.</p>
            </div>
            <div className="stack">
              {questions.map((question: any, index: number) => {
                const answer = question.answer;
                const seen = question.type === 'mcq' && answer ? Number(answer.answer) : null;
                return (
                  <div key={question.id} className="card card-pad-sm">
                    <div className="between" style={{ gap: 12 }}>
                      <div className="tiny strong">Question {index + 1} · {titleCase(question.type)}</div>
                      <Badge tone="outline">{question.points} points</Badge>
                    </div>
                    <p style={{ margin: '8px 0' }}>{question.prompt}</p>
                    {question.type === 'mcq' ? (
                      <div className="stack-sm">
                        {(question.options || []).map((option: string, optionIndex: number) => (
                          <div
                            key={optionIndex}
                            className="row"
                            style={{
                              alignItems: 'flex-start',
                              opacity: seen === null ? 0.8 : 0.75
                            }}
                          >
                            <Icon
                              name={optionIndex === question.correct_option ? 'check-circle' : seen === optionIndex ? 'x-circle' : 'minus'}
                              className={`icon-sm ${optionIndex === question.correct_option ? 'text-success' : seen === optionIndex ? 'text-danger' : 'text-muted'}`}
                            />
                            <span className="tiny">{option}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="card card-pad-sm" style={{ background: 'var(--cream)', marginTop: 8 }}>
                          <div className="eyebrow eyebrow-plain" style={{ fontSize: '0.66rem' }}>Submitted answer</div>
                          <p className="small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                            {answer?.answer ? String(answer.answer) : 'No answer submitted.'}
                          </p>
                        </div>
                        {question.rubric ? (
                          <div className="alert alert-info" style={{ marginTop: 10 }}>
                            <Icon name="list" />
                            <div><strong>Rubric:</strong> {question.rubric}</div>
                          </div>
                        ) : null}
                        {answer ? (
                          <Field label={`Points awarded (0–${question.points})`} htmlFor={`points-${answer.id}`} className="span-2">
                            <Input
                              id={`points-${answer.id}`}
                              type="number"
                              min={0}
                              max={question.points}
                              step="0.5"
                              value={points[answer.id] || ''}
                              onChange={(event) =>
                                setPoints((current) => ({ ...current, [answer.id]: event.target.value }))
                              }
                              style={{ maxWidth: 140 }}
                            />
                          </Field>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-section" style={{ marginTop: 18 }}>
            <div className="form-section-head">
              <h3 className="form-section-title">Result</h3>
              <p className="form-section-sub">The final score is your judgement. A pass requires at least {passMark}/100.</p>
            </div>
            <div className="form-grid">
              <Field label="Final score" htmlFor="final-score" required>
                <Input
                  id="final-score"
                  type="number"
                  min={0}
                  max={100}
                  value={finalScore}
                  onChange={(event) => setFinalScore(event.target.value)}
                />
              </Field>
              <Field label="Decision" htmlFor="review-decision" required>
                <Select id="review-decision" value={decision} onChange={(event) => setDecision(event.target.value as any)}>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="request_retake">Fail with retake</option>
                </Select>
              </Field>
              <Field
                label="Feedback to the professional"
                htmlFor="review-feedback"
                required
                className="span-2"
                hint="At least 10 characters. Explain the judgement against the rubric."
              >
                <Textarea
                  id="review-feedback"
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  maxLength={2000}
                  style={{ minHeight: 100 }}
                />
              </Field>
            </div>
            {decision === 'pass' && !canPass ? (
              <Alert tone="danger" title="Score below the pass mark">
                A pass requires at least {passMark}/100. Adjust the final score or choose a different decision.
              </Alert>
            ) : null}
          </div>

          <Alert tone="warning" title="Human judgement only">
            {data.disclaimer}
          </Alert>
        </>
      ) : null}
    </Modal>
  );
}

export default function AdminAssessments() {
  useDocumentTitle('Assessment review');
  const { adminPermissions } = useAuth();
  const allowed = adminPermissions.includes('*') || adminPermissions.includes('verification.review');
  const [status, setStatus] = useState<StatusTab>('human_review');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => setPage(1), [status]);

  const { data, loading, error, reload } = useApi<any>(
    allowed ? `/admin/assessment-attempts?status=${status}&page=${page}&limit=20` : null
  );

  if (!allowed) {
    return (
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>Your administrator role does not include assessment review.</p>
      </Card>
    );
  }

  const rows = data?.rows || [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Assessment review"
        eyebrow="Evidence & assessment"
        description="Objective questions are auto-marked. Practical answers are scored by a human against the published rubric. Integrity signals are supporting context only."
      />

      <Alert tone="warning" title="No automated AI detection">
        Flamingo does not use automated AI-detection to reject candidates. Focus-loss and paste events are review
        prompts. Never describe them as proof of misconduct.
      </Alert>

      <div style={{ marginTop: 18 }}>
        <Tabs<StatusTab>
          active={status}
          onChange={setStatus}
          tabs={(Object.keys(STATUS_LABEL) as StatusTab[]).map((key) => ({ key, label: STATUS_LABEL[key] }))}
        />
      </div>

      {loading ? <Loading label="Loading assessment queue." /> : null}
      {error ? <Alert tone="danger" title="Could not load the assessment queue">{error}</Alert> : null}

      {!loading && !error ? (
        <Card style={{ marginTop: 16 }}>
          <CardHeader
            title={STATUS_LABEL[status]}
            subtitle={`${pagination?.total ?? 0} attempt${pagination?.total === 1 ? '' : 's'} in this view.`}
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Professional</th><th>Assessment</th><th>Auto score</th><th>Integrity</th><th>Practical</th><th>Submitted</th><th>Status</th><th className="actions">Action</th></tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row: any) => (
                  <tr key={row.id}>
                    <td>
                      <div className="list-title">{row.professional_name}</div>
                      <div className="tiny muted">{row.headline} · {row.years_experience} yrs</div>
                    </td>
                    <td>
                      <div>{row.title}</div>
                      <div className="tiny muted">{titleCase(row.category)}</div>
                    </td>
                    <td className="num">{row.auto_score ?? '—'}</td>
                    <td className="num">
                      <span className={row.integrity_score < 70 ? 'text-warning' : undefined}>{row.integrity_score}</span>
                    </td>
                    <td className="num">{row.practicalCount}</td>
                    <td>{dateLabel(row.submitted_at || row.started_at)}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td className="actions">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedId(row.id)}>
                        {['human_review', 'submitted'].includes(row.status) ? 'Review' : 'View'}
                      </Button>
                    </td>
                  </tr>
                )) : <tr><td colSpan={8} className="table-empty">No attempts in this view.</td></tr>}
              </tbody>
            </table>
          </div>
          {pagination ? (
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
          ) : null}
        </Card>
      ) : null}

      {data?.disclaimer ? (
        <div className="portal-section">
          <Alert tone="neutral" title="Review standard">{data.disclaimer}</Alert>
        </div>
      ) : null}

      {selectedId ? (
        <AttemptReview attemptId={selectedId} onClose={() => setSelectedId(null)} onDone={reload} />
      ) : null}
    </>
  );
}
