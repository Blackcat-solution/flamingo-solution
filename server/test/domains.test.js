import { describe, expect, it } from 'vitest';
import {
  scoreObjective,
  integrityRisk,
  plagiarismSignal,
  similarity,
  retakeEligibility,
  selectQuestions
} from '../src/domain/assessment.js';
import { scoreReview, ratingBand, averageRating } from '../src/domain/performance.js';
import { recommendRate, levelForExperience, experienceFactor } from '../src/domain/pricing.js';

const questions = [
  { id: 'q1', type: 'mcq', points: 10, correct_option: 1 },
  { id: 'q2', type: 'mcq', points: 10, correct_option: 0 },
  { id: 'q3', type: 'practical', points: 20 }
];

describe('assessment scoring', () => {
  it('auto-marks objective answers and leaves practical work for a human', () => {
    const result = scoreObjective(questions, {
      q1: { answer: '1' },
      q2: { answer: '2' },
      q3: { answer: 'A written answer' }
    });
    expect(result.objectivePoints).toBe(10);
    expect(result.objectiveMax).toBe(20);
    expect(result.autoScore).toBe(50);
    expect(result.needsReview).toBe(true);
    expect(result.results.find((item) => item.questionId === 'q3').isCorrect).toBeNull();
  });

  it('treats unanswered questions as incorrect, not crashes', () => {
    const result = scoreObjective(questions, {});
    expect(result.autoScore).toBe(0);
    expect(result.needsReview).toBe(true);
  });

  it('selects a deterministic, complete question set', () => {
    const first = selectQuestions(questions, 3, 42).map((item) => item.id);
    const second = selectQuestions(questions, 3, 42).map((item) => item.id);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(3);
  });
});

describe('integrity signals are review prompts, never proof', () => {
  it('scores low risk when nothing is flagged', () => {
    const risk = integrityRisk([]);
    expect(risk.score).toBe(100);
    expect(risk.band).toBe('low');
    expect(risk.requiresHumanReview).toBe(false);
  });

  it('flags repeated signals for human review with an explicit disclaimer', () => {
    const risk = integrityRisk([
      { type: 'paste', count: 2 },
      { type: 'focus_lost', count: 3 }
    ]);
    expect(risk.score).toBeLessThan(85);
    expect(risk.requiresHumanReview).toBe(true);
    expect(risk.disclaimer).toMatch(/do not prove misconduct/i);
  });

  it('caps repeated-flag penalties', () => {
    const once = integrityRisk([{ type: 'paste', count: 1 }]);
    const many = integrityRisk([{ type: 'paste', count: 20 }]);
    expect(once.score).toBe(88);
    expect(many.score).toBe(64);
  });

  it('measures text similarity as a screening signal only', () => {
    const copied =
      'The quick brown fox jumps over the lazy dog while the market opens early every morning.';
    const other = 'The quick brown fox jumps over the lazy dog while the market opens early every morning.';
    expect(similarity(copied, other)).toBe(1);
    const signal = plagiarismSignal(copied, [{ id: 'a1', answer: other }]);
    expect(signal.flag).toBe(true);
    expect(signal.note).toMatch(/not a finding of plagiarism/i);
  });

  it('enforces the documented retake waiting period', () => {
    const settings = { assessment_retake_days: 30 };
    const recent = { status: 'failed', submitted_at: new Date().toISOString() };
    expect(retakeEligibility(recent, settings).eligible).toBe(false);
    const old = {
      status: 'failed',
      submitted_at: new Date(Date.now() - 31 * 86_400_000).toISOString()
    };
    expect(retakeEligibility(old, settings).eligible).toBe(true);
    expect(retakeEligibility(null, settings).eligible).toBe(true);
  });
});

describe('100-point performance review', () => {
  const perfect = { quality: 10, timeliness: 10, technical: 10, conduct: 10, communication: 10, reliability: 10 };

  it('awards the full 100 points for perfect scores', () => {
    const result = scoreReview(perfect);
    expect(result.valid).toBe(true);
    expect(result.total).toBe(100);
    expect(result.band).toBe('exceptional');
  });

  it('applies the published weights', () => {
    const result = scoreReview({
      quality: 8,
      timeliness: 8,
      technical: 8,
      conduct: 8,
      communication: 8,
      reliability: 8
    });
    expect(result.total).toBe(80);
    expect(result.band).toBe('exceeds_expectations');
    expect(result.breakdown.find((item) => item.key === 'quality').pointsAwarded).toBe(20);
  });

  it('rejects missing or out-of-range criteria', () => {
    const result = scoreReview({ quality: 11 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(6);
  });

  it('maps bands consistently and averages published reviews', () => {
    expect(ratingBand(90)).toBe('exceptional');
    expect(ratingBand(80)).toBe('exceeds_expectations');
    expect(ratingBand(70)).toBe('meets_expectations');
    expect(ratingBand(60)).toBe('developing');
    expect(ratingBand(59)).toBe('below_expectations');
    expect(averageRating([{ total_score: 80 }, { total_score: 90 }])).toBe(85);
    expect(averageRating([])).toBe(0);
  });
});

describe('sourced pricing engine', () => {
  const benchmark = {
    min_hourly_paise: 100_000,
    median_hourly_paise: 150_000,
    max_hourly_paise: 250_000,
    level: 'senior',
    source_name: 'Test source',
    source_url: 'https://example.com/rates',
    as_of: '2026-01-01',
    demand_index: 1
  };

  it('refuses to invent a benchmark when none exists', () => {
    const result = recommendRate({ benchmark: null, yearsExperience: 8 });
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/No verified market benchmark/);
  });

  it('clamps recommendations inside the sourced range', () => {
    const result = recommendRate({
      benchmark,
      yearsExperience: 20,
      assessmentScore: 100,
      certifications: ['A', 'B', 'C', 'D'],
      education: 'PhD',
      city: 'Bengaluru',
      industry: 'Technology',
      rating: 5,
      demandIndex: 1
    });
    expect(result.available).toBe(true);
    expect(result.recommendedHourlyPaise).toBeGreaterThanOrEqual(benchmark.min_hourly_paise);
    expect(result.recommendedHourlyPaise).toBeLessThanOrEqual(benchmark.max_hourly_paise);
    expect(result.recommendedHourlyPaise % 1000).toBe(0);
  });

  it('exposes the full calculation trail and its source', () => {
    const result = recommendRate({
      benchmark,
      yearsExperience: 7,
      assessmentScore: 82,
      certifications: ['AWS'],
      education: 'B.Tech',
      city: 'Pune',
      industry: 'SaaS',
      rating: 4.5,
      demandIndex: 1
    });
    expect(result.steps.length).toBe(8);
    expect(result.benchmark.sourceName).toBe('Test source');
    expect(result.methodology).toMatch(/recommendations only/i);
  });

  it('maps experience to levels and never drops below the 3-year minimum factor', () => {
    expect(levelForExperience(3)).toBe('mid');
    expect(levelForExperience(6)).toBe('senior');
    expect(levelForExperience(10)).toBe('lead');
    expect(experienceFactor(3)).toBe(1);
    expect(experienceFactor(0)).toBe(1);
  });
});
