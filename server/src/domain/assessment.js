/**
 * Assessment engine helpers. Objective questions are auto-marked; practical
 * answers always require human review. Integrity signals are treated as
 * indicators for human review — never as proof of AI use or misconduct.
 */

export const INTEGRITY_WEIGHTS = {
  tab_hidden: 8,
  multiple_tabs: 12,
  paste: 12,
  devtools: 6,
  rapid_answer: 10,
  duplicate_submission: 25,
  ip_change: 15,
  identity_mismatch: 30,
  focus_lost: 5
};

export function seededShuffle(items, seed = Date.now()) {
  let state = Number(seed) || 1;
  const random = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function selectQuestions(questions, count, seed) {
  return seededShuffle(questions, seed).slice(0, Math.max(1, Math.min(count, questions.length)));
}

export function scoreObjective(questions, answersByQuestionId) {
  let awarded = 0;
  let objectiveMax = 0;
  let objectiveCount = 0;
  let needsReview = false;
  const results = [];
  for (const question of questions) {
    const answer = answersByQuestionId[question.id];
    if (question.type === 'mcq') {
      objectiveMax += question.points;
      objectiveCount += 1;
      const selected = answer?.answer;
      const isCorrect =
        selected !== undefined &&
        selected !== null &&
        Number(selected) === Number(question.correct_option);
      const points = isCorrect ? question.points : 0;
      awarded += points;
      results.push({ questionId: question.id, isCorrect, points });
    } else {
      needsReview = true;
      results.push({ questionId: question.id, isCorrect: null, points: 0 });
    }
  }
  return {
    objectivePoints: awarded,
    objectiveMax,
    autoScore: objectiveMax ? Math.round((awarded / objectiveMax) * 100) : 0,
    needsReview,
    objectiveCount,
    results
  };
}

export function integrityRisk(flags = []) {
  const normalized = flags.map((flag) =>
    typeof flag === 'string' ? { type: flag, count: 1 } : { type: flag.type, count: flag.count || 1 }
  );
  let penalty = 0;
  for (const flag of normalized) {
    penalty += (INTEGRITY_WEIGHTS[flag.type] || 5) * Math.min(3, flag.count);
  }
  const score = Math.max(0, 100 - penalty);
  const band = score >= 85 ? 'low' : score >= 60 ? 'medium' : 'high';
  return {
    score,
    band,
    requiresHumanReview: band !== 'low',
    disclaimer:
      'Integrity signals indicate patterns that warrant human review. They do not prove misconduct and are never presented as AI detection.'
  };
}

export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shingles(text, size = 4) {
  const words = normalizeText(text).split(' ').filter(Boolean);
  const set = new Set();
  for (let index = 0; index + size <= words.length; index += 1) {
    set.add(words.slice(index, index + size).join(' '));
  }
  if (!set.size && words.length) set.add(words.join(' '));
  return set;
}

export function similarity(a, b) {
  const left = shingles(a);
  const right = shingles(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function plagiarismSignal(answer, otherAnswers = []) {
  let highest = 0;
  let matchId = null;
  for (const other of otherAnswers) {
    const score = similarity(answer, other.answer);
    if (score > highest) {
      highest = score;
      matchId = other.id;
    }
  }
  return {
    similarity: Number(highest.toFixed(3)),
    matchAttemptId: matchId,
    flag: highest >= 0.75,
    note: 'Text similarity is a screening signal for human review, not a finding of plagiarism.'
  };
}

export function retakeEligibility(lastAttempt, settings, now = new Date()) {
  if (!lastAttempt) return { eligible: true, eligibleAt: null };
  if (!['failed', 'expired'].includes(lastAttempt.status)) {
    return { eligible: false, eligibleAt: null, reason: 'Assessment already completed or in progress.' };
  }
  const eligibleAt = new Date(
    new Date(lastAttempt.submitted_at || lastAttempt.started_at).getTime() +
      settings.assessment_retake_days * 86_400_000
  );
  return {
    eligible: now >= eligibleAt,
    eligibleAt: eligibleAt.toISOString(),
    reason: now >= eligibleAt ? null : `Retakes open ${settings.assessment_retake_days} days after the previous attempt.`
  };
}

export function weightedQuestionPoints(questions) {
  return questions.reduce((sum, question) => sum + question.points, 0);
}
