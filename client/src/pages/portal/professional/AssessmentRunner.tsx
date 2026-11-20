import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Icon, Loading, Modal, PageHeader,
  Progress, ScoreRing, StatusBadge, Textarea
} from '../../../components/ui';
import { SectionTitle } from '../../../components/portal/PortalKit';
import { api } from '../../../lib/api';
import { dateTimeLabel, titleCase } from '../../../lib/format';
import { useApi, useDocumentTitle } from '../../../lib/hooks';
import { useAction } from '../../../lib/useAction';

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function AssessmentRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi<any>(id ? `/professional/attempts/${id}` : null);
  const { busy, run } = useAction();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<any>(null);
  const reportedRef = useRef(false);

  useDocumentTitle(data?.attempt?.title ? `${data.attempt.title} — assessment` : 'Assessment');

  useEffect(() => {
    if (data?.questions) {
      const initial: Record<string, string> = {};
      for (const question of data.questions) {
        if (question.savedAnswer !== null && question.savedAnswer !== undefined) initial[question.id] = String(question.savedAnswer);
      }
      setAnswers(initial);
    }
  }, [data]);

  useEffect(() => {
    if (!data?.attempt || data.attempt.status !== 'in_progress') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [data]);

  useEffect(() => {
    if (!data?.attempt || data.attempt.status !== 'in_progress') return;
    const handler = () => {
      if (document.visibilityState === 'hidden' && !reportedRef.current) {
        reportedRef.current = true;
        api(`/professional/attempts/${data.attempt.id}/integrity`, {
          method: 'POST',
          body: { type: 'tab_hidden', detail: 'Document visibility changed during the timed assessment.' }
        }).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [data]);

  const remaining = data?.attempt ? new Date(data.attempt.expiresAt).getTime() - now : 0;
  const expired = Boolean(data?.expired) || remaining <= 0;
  const inProgress = data?.attempt?.status === 'in_progress' && !expired;
  const answeredCount = useMemo(() => Object.values(answers).filter((value) => value !== '').length, [answers]);

  if (loading) return <Loading label="Loading assessment." />;
  if (error) return <Alert tone="danger" title="Could not load this attempt">{error}</Alert>;
  if (!data) return <EmptyState title="Attempt not found" />;

  const { attempt, questions } = data;
  const isFinished = attempt.status !== 'in_progress' || expired;

  const saveAnswer = async (questionId: string, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    if (!inProgress) return;
    try {
      await api(`/professional/attempts/${attempt.id}/answer`, { method: 'POST', body: { questionId, answer: value } });
    } catch {
      // The next save retries; the visible answer remains so nothing is lost locally.
    }
  };

  const submit = () =>
    run('submit', async () => {
      const payload = await api<any>(`/professional/attempts/${attempt.id}/submit`, { method: 'POST' });
      setResult(payload);
      setConfirmOpen(false);
      reload();
    }, 'Assessment submitted for human review.');

  if (result) {
    return (
      <div className="container-narrow" style={{ padding: '50px 0' }}>
        <Card className="card-pad-lg" style={{ textAlign: 'center' }}>
          <span className="icon-tile green" style={{ width: 60, height: 60, margin: '0 auto' }}><Icon name="check-circle" /></span>
          <h1 className="page-title" style={{ marginTop: 18 }}>Submitted for review</h1>
          <p className="page-sub" style={{ maxWidth: 560, margin: '10px auto 0' }}>{result.message}</p>
          <div className="row center" style={{ marginTop: 22 }}>
            <ScoreRing value={result.autoScore} label="Auto score" />
            <div style={{ textAlign: 'left' }}>
              <div className="stat-label">Integrity band</div>
              <div style={{ marginTop: 6 }}><Badge tone={result.integrity?.band === 'high' ? 'danger' : result.integrity?.band === 'medium' ? 'warning' : 'success'}>{titleCase(result.integrity?.band || 'low')}</Badge></div>
              <p className="tiny muted" style={{ marginTop: 8, maxWidth: 320 }}>{result.integrity?.disclaimer || 'Signals are supporting context for a human reviewer, never automated proof.'}</p>
            </div>
          </div>
          <div className="row center" style={{ marginTop: 24 }}>
            <Link className="btn btn-primary" to="/portal/professional/assessments">Back to assessments</Link>
            <Link className="btn btn-secondary" to="/portal/professional">Return to overview</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={attempt.title}
        eyebrow={`Assessment attempt #${attempt.attemptNo}`}
        description={`${titleCase(attempt.category)} · Pass mark ${attempt.passMark}/100 · ${questions.length} questions`}
        actions={<Link className="btn btn-secondary" to="/portal/professional/assessments">Exit</Link>}
      />

      {expired && attempt.status === 'in_progress' ? (
        <Alert tone="danger" title="Time expired">
          The timer has ended. Answers saved before expiry are retained. Contact support if you believe this is an error.
        </Alert>
      ) : null}

      {isFinished ? (
        <>
          <Card className="card-pad">
            <div className="split" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(220px,0.6fr)' }}>
              <div>
                <div className="row wrap">
                  <StatusBadge status={attempt.status} />
                  <Badge tone="outline">Auto score {attempt.autoScore ?? '—'}/100</Badge>
                  <Badge tone="outline">Final {attempt.finalScore ?? 'pending'}</Badge>
                </div>
                <h2 className="card-title" style={{ marginTop: 14 }}>Reviewer feedback</h2>
                <p className="page-sub" style={{ marginTop: 8, whiteSpace: 'pre-line' }}>
                  {attempt.feedback || attempt.reviewNotes || 'Human review is pending. Results usually publish within two business days.'}
                </p>
                {attempt.integrityFlags?.length ? (
                  <div className="alert alert-warning" style={{ marginTop: 14 }}>
                    <Icon name="alert-triangle" />
                    <div>
                      <strong>Review context</strong>
                      <div className="tiny" style={{ marginTop: 4 }}>
                        {attempt.integrityFlags.map((flag: any) => `${titleCase(flag.type)} ×${flag.count}`).join(' · ')}.
                        These signals are context for a reviewer, not a finding of misconduct.
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="center"><ScoreRing value={attempt.finalScore ?? attempt.autoScore ?? 0} label="Score" /></div>
            </div>
          </Card>

          <div className="portal-section">
            <SectionTitle title="Questions & awarded points" sub="Correct answers are scored automatically. Practical work is scored by a human." />
            <div className="stack">
              {questions.map((question: any) => (
                <Card key={question.id}>
                  <CardHeader
                    title={<span>Question {question.number}</span>}
                    subtitle={question.type === 'practical' ? 'Practical response · human scored' : 'Objective question'}
                    actions={<Badge tone="outline">{question.awardedPoints ?? '—'} / {question.points} points</Badge>}
                  />
                  <p className="small" style={{ whiteSpace: 'pre-line' }}>{question.prompt}</p>
                  {question.rubric ? <div className="notice" style={{ marginTop: 10 }}><strong>Rubric</strong>{question.rubric}</div> : null}
                  <div className="notice" style={{ marginTop: 10 }}>
                    <strong>Your answer</strong>
                    {answers[question.id] ? (question.type === 'mcq' ? question.options[Number(answers[question.id])] : answers[question.id]) : 'No answer saved.'}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="split">
          <div className="stack">
            {questions.map((question: any) => (
              <Card key={question.id}>
                <CardHeader
                  title={<span>Question {question.number} of {questions.length}</span>}
                  subtitle={question.type === 'practical' ? 'Practical response. Write clearly and show your reasoning.' : 'Select one option.'}
                  actions={<Badge tone="outline">{question.points} points</Badge>}
                />
                <p className="small" style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>{question.prompt}</p>
                {question.type === 'mcq' ? (
                  <div className="stack-sm" style={{ marginTop: 14 }}>
                    {question.options.map((option: string, index: number) => (
                      <label
                        key={index}
                        className="checkbox"
                        style={{
                          padding: '11px 13px',
                          border: `1px solid ${answers[question.id] === String(index) ? 'var(--brand)' : 'var(--line)'}`,
                          borderRadius: 10,
                          background: answers[question.id] === String(index) ? 'var(--brand-50)' : '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          checked={answers[question.id] === String(index)}
                          onChange={() => saveAnswer(question.id, String(index))}
                          disabled={!inProgress}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    {question.rubric ? <div className="notice" style={{ marginTop: 12 }}><strong>Scoring rubric</strong>{question.rubric}</div> : null}
                    <Textarea
                      value={answers[question.id] || ''}
                      onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                      onBlur={(event) => saveAnswer(question.id, event.target.value)}
                      disabled={!inProgress}
                      placeholder="Write your practical answer. It saves when you leave the field."
                      style={{ marginTop: 12, minHeight: 170 }}
                    />
                  </>
                )}
              </Card>
            ))}
            <div className="form-actions">
              <Button variant="secondary" onClick={() => navigate('/portal/professional/assessments')}>Exit without submitting</Button>
              <Button onClick={() => setConfirmOpen(true)} disabled={!answeredCount} loading={busy === 'submit'}>
                Submit assessment <Icon name="send" className="icon-sm" />
              </Button>
            </div>
          </div>

          <div className="split-side">
            <Card className="card-pad" style={{ borderColor: expired ? 'var(--danger)' : undefined }}>
              <div className="stat-label">Time remaining</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: remaining < 300000 ? 'var(--danger)' : 'var(--ink)' }}>
                {formatRemaining(remaining)}
              </div>
              <Progress value={answeredCount} max={questions.length} label="Answered" meta={`${answeredCount}/${questions.length}`} />
              <p className="tiny muted" style={{ marginTop: 10 }}>Answers save as you go. The assessment locks when the timer ends.</p>
            </Card>
            <Card className="card-pad">
              <CardHeader title="Before you submit" />
              <ul className="feature-list">
                <li><Icon name="check" className="icon-sm" /> Answer every question you can.</li>
                <li><Icon name="check" className="icon-sm" /> Practical answers are read by a human.</li>
                <li><Icon name="check" className="icon-sm" /> Do not paste another person&apos;s work.</li>
                <li><Icon name="check" className="icon-sm" /> Tab changes are recorded as review context only.</li>
              </ul>
            </Card>
            <Alert tone="info" title="No AI detection claim">
              Flamingo does not claim to detect AI-written answers with certainty. Integrity signals prompt a human
              look; they never decide the result automatically.
            </Alert>
          </div>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit this assessment?"
        subtitle="You cannot edit answers after submission. Practical answers will be queued for human review."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Keep working</Button>
            <Button onClick={submit} loading={busy === 'submit'}>Submit for review</Button>
          </>
        }
      >
        <p className="small">You have answered {answeredCount} of {questions.length} questions. Objective questions are marked immediately; practical work and any integrity context go to a human reviewer.</p>
        {attempt.expiresAt ? <p className="tiny muted" style={{ marginTop: 8 }}>Timer ends {dateTimeLabel(attempt.expiresAt)}.</p> : null}
      </Modal>
    </>
  );
}
