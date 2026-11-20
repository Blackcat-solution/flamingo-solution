import { Router } from 'express';
import { all, one } from '../db.js';
import { asyncHandler, audit, pagination } from '../lib/http.js';
import { currentSession } from '../lib/auth.js';
import { professionalCard, professionalPublicProfile, isShortlisted } from '../lib/data.js';
import { notFound } from '../lib/errors.js';

const router = Router();

function buildFilters(query) {
  const where = [
    'p.is_public = 1',
    "p.assessment_status = 'passed'",
    "p.verification_status = 'verified'"
  ];
  const params = [];
  if (query.q) {
    where.push('(u.name LIKE ? OR p.headline LIKE ? OR p.skills LIKE ? OR p.bio LIKE ?)');
    const term = `%${query.q}%`;
    params.push(term, term, term, term);
  }
  if (query.category) {
    where.push('p.category = ?');
    params.push(query.category);
  }
  if (query.skill) {
    where.push('p.skills LIKE ?');
    params.push(`%${query.skill}%`);
  }
  if (query.city) {
    where.push('p.city LIKE ?');
    params.push(`%${query.city}%`);
  }
  if (query.minExperience) {
    where.push('p.years_experience >= ?');
    params.push(Number(query.minExperience));
  }
  if (query.maxExperience) {
    where.push('p.years_experience <= ?');
    params.push(Number(query.maxExperience));
  }
  if (query.maxRate) {
    where.push('p.hourly_rate_paise <= ?');
    params.push(Number(query.maxRate) * 100);
  }
  if (query.minRating) {
    where.push('p.rating >= ?');
    params.push(Number(query.minRating));
  }
  if (query.availabilityDay) {
    where.push('p.availability_days LIKE ?');
    params.push(`%${query.availabilityDay}%`);
  }
  if (query.minScore) {
    where.push(
      `(SELECT MAX(a.final_score) FROM assessment_attempts a WHERE a.professional_id = p.id AND a.status = 'passed') >= ?`
    );
    params.push(Number(query.minScore));
  }
  const sorts = {
    rating: 'p.rating DESC, p.completed_assignments DESC',
    rate_low: 'p.hourly_rate_paise ASC',
    rate_high: 'p.hourly_rate_paise DESC',
    experience: 'p.years_experience DESC',
    newest: 'p.created_at DESC'
  };
  const order = sorts[query.sort] || sorts.rating;
  return { where, params, order };
}

router.get(
  '/professionals',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req, { defaultLimit: 12 });
    const { where, params, order } = buildFilters(req.query);
    const rows = all(
      `SELECT p.*, u.name,
              (SELECT MAX(a.final_score) FROM assessment_attempts a
                WHERE a.professional_id = p.id AND a.status = 'passed') AS assessment_score
       FROM professional_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${order}
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const total = one(
      `SELECT COUNT(*) AS count FROM professional_profiles p JOIN users u ON u.id = p.user_id
       WHERE ${where.join(' AND ')}`,
      ...params
    )?.count || 0;
    res.json({
      professionals: rows.map((row) => ({
        ...professionalCard(row),
        assessmentScore: row.assessment_score
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      disclosure:
        'Every candidate shown here is seeded demonstration data, clearly labelled. Verification, assessments and reviews are simulated for product evaluation.'
    });
  })
);

router.get(
  '/featured',
  asyncHandler(async (_req, res) => {
    const rows = all(
      `SELECT p.*, u.name FROM professional_profiles p JOIN users u ON u.id = p.user_id
       WHERE p.is_public = 1 AND p.assessment_status = 'passed'
       ORDER BY p.rating DESC, p.completed_assignments DESC LIMIT 6`
    );
    res.json({ professionals: rows.map(professionalCard) });
  })
);

router.get(
  '/professionals/:id',
  asyncHandler(async (req, res) => {
    const session = currentSession(req);
    let includeContact = false;
    if (session?.role === 'employer') {
      const employer = one('SELECT * FROM employer_profiles WHERE user_id = ?', session.user_id);
      if (employer?.verification_status === 'verified' && isShortlisted(employer.id, req.params.id)) {
        includeContact = true;
        audit(req, {
          action: 'candidate.contact_viewed',
          entityType: 'professional_profile',
          entityId: req.params.id,
          meta: { employerId: employer.id, reason: 'shortlisted_candidate' }
        });
      }
    }
    const profile = professionalPublicProfile(req.params.id, { includeContact });
    if (!profile) throw notFound('This professional profile is not publicly available.');
    res.json({ professional: profile });
  })
);

router.get(
  '/compare',
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (!ids.length) return res.json({ professionals: [] });
    const placeholders = ids.map(() => '?').join(',');
    const rows = all(
      `SELECT p.*, u.name FROM professional_profiles p JOIN users u ON u.id = p.user_id
       WHERE p.id IN (${placeholders}) AND p.is_public = 1`,
      ...ids
    );
    res.json({
      professionals: rows.map(professionalCard),
      note: 'Comparison uses only authorised public profile fields. Contact details are not included.'
    });
  })
);

export default router;
