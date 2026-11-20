/**
 * 100-point performance evaluation.
 * Each criterion is scored 0–10 by the reporting manager and converted with the
 * published weights: quality 25, timeliness 20, technical 20, conduct 15,
 * communication 10, reliability 10.
 */

export const REVIEW_WEIGHTS = {
  quality: 25,
  timeliness: 20,
  technical: 20,
  conduct: 15,
  communication: 10,
  reliability: 10
};

export const REVIEW_CRITERIA = [
  { key: 'quality', label: 'Quality of output', weight: 25, hint: 'Accuracy, completeness and craft of delivered work' },
  { key: 'timeliness', label: 'Timeliness', weight: 20, hint: 'Delivery against agreed dates and hours' },
  { key: 'technical', label: 'Technical expertise', weight: 20, hint: 'Depth and independence of professional skill' },
  { key: 'conduct', label: 'Professional conduct', weight: 15, hint: 'Integrity, confidentiality and workplace respect' },
  { key: 'communication', label: 'Communication', weight: 10, hint: 'Clarity, responsiveness and escalation' },
  { key: 'reliability', label: 'Reliability', weight: 10, hint: 'Attendance, consistency and ownership' }
];

export function scoreReview(scores) {
  const errors = [];
  let total = 0;
  for (const criterion of REVIEW_CRITERIA) {
    const raw = Number(scores?.[criterion.key]);
    if (!Number.isFinite(raw) || raw < 0 || raw > 10) {
      errors.push(`${criterion.label} must be scored between 0 and 10.`);
      continue;
    }
    total += (raw / 10) * criterion.weight;
  }
  if (errors.length) return { valid: false, errors, total: null };
  const rounded = Math.round(total * 10) / 10;
  return {
    valid: true,
    errors: [],
    total: rounded,
    band: ratingBand(rounded),
    breakdown: REVIEW_CRITERIA.map((criterion) => ({
      ...criterion,
      score: Number(scores[criterion.key]),
      pointsAwarded: Math.round(((Number(scores[criterion.key]) / 10) * criterion.weight) * 10) / 10
    }))
  };
}

export function ratingBand(total) {
  if (total >= 90) return 'exceptional';
  if (total >= 80) return 'exceeds_expectations';
  if (total >= 70) return 'meets_expectations';
  if (total >= 60) return 'developing';
  return 'below_expectations';
}

export function ratingLabel(band) {
  return (
    {
      exceptional: 'Exceptional',
      exceeds_expectations: 'Exceeds expectations',
      meets_expectations: 'Meets expectations',
      developing: 'Developing',
      below_expectations: 'Below expectations'
    }[band] || 'Not rated'
  );
}

export function averageRating(reviews) {
  if (!reviews.length) return 0;
  return Math.round((reviews.reduce((sum, review) => sum + Number(review.total_score), 0) / reviews.length) * 10) / 10;
}
