import {
  all,
  one,
  jsonParse,
  getSettings
} from '../db.js';
import { averageRating } from '../domain/performance.js';

export function professionalForUser(userId) {
  return one('SELECT * FROM professional_profiles WHERE user_id = ?', userId);
}

export function employerForUser(userId) {
  return one('SELECT * FROM employer_profiles WHERE user_id = ?', userId);
}

export function parseJsonFields(row, fields) {
  if (!row) return row;
  const clone = { ...row };
  for (const field of fields) clone[field] = jsonParse(clone[field], []);
  return clone;
}

export function professionalCard(row) {
  const settings = getSettings();
  return {
    id: row.id,
    name: row.name,
    headline: row.headline,
    category: row.category,
    city: row.city,
    state: row.state,
    yearsExperience: row.years_experience,
    skills: jsonParse(row.skills, []),
    certifications: jsonParse(row.certifications, []),
    hourlyRatePaise: row.hourly_rate_paise,
    recommendedRatePaise: row.recommended_rate_paise,
    availabilityDays: jsonParse(row.availability_days, []),
    shiftHours: row.shift_hours,
    rating: row.rating,
    completedAssignments: row.completed_assignments,
    rehireRate: row.rehire_rate,
    assessmentStatus: row.assessment_status,
    identityStatus: row.identity_status,
    verificationStatus: row.verification_status,
    isPublic: Boolean(row.is_public),
    isDemo: Boolean(row.is_demo),
    photoUrl: row.photo_url,
    minimumExperienceMet: row.years_experience >= settings.min_experience_years
  };
}

export function professionalDetail(row) {
  return {
    ...professionalCard(row),
    bio: row.bio,
    education: row.education,
    languages: jsonParse(row.languages, []),
    portfolioUrl: row.portfolio_url,
    linkedinUrl: row.linkedin_url,
    preferredStart: row.preferred_start,
    preferredEnd: row.preferred_end,
    noticePeriodDays: row.notice_period_days,
    salaryExpectationPaise: row.salary_expectation_paise,
    profileStatus: row.profile_status,
    createdAt: row.created_at
  };
}

export function professionalPublicProfile(profileId, { includeContact = false } = {}) {
  const row = one(
    `SELECT p.*, u.name, u.email, u.phone, u.created_at AS user_created_at
     FROM professional_profiles p JOIN users u ON u.id = p.user_id
     WHERE p.id = ? AND p.is_public = 1`,
    profileId
  );
  if (!row) return null;
  const employment = all(
    'SELECT id, employer_name, title, start_date, end_date, is_current, description, verified FROM employment_history WHERE professional_id = ? ORDER BY start_date DESC',
    profileId
  );
  const reviews = all(
    `SELECT r.id, r.total_score, r.scores, r.strengths, r.improvements, r.overall_rating, r.rehire,
            r.submitted_at, e.org_name, r.status
     FROM reviews r JOIN employer_profiles e ON e.id = r.employer_id
     WHERE r.professional_id = ? AND r.status IN ('published','upheld','revised')
     ORDER BY r.submitted_at DESC LIMIT 10`,
    profileId
  ).map((review) => ({
    ...review,
    scores: jsonParse(review.scores, {}),
    orgName: review.org_name
  }));
  const attempts = all(
    `SELECT a.id, a.final_score, a.status, a.submitted_at, s.title, s.category
     FROM assessment_attempts a JOIN assessments s ON s.id = a.assessment_id
     WHERE a.professional_id = ? AND a.status IN ('passed','failed')
     ORDER BY a.submitted_at DESC LIMIT 5`,
    profileId
  );
  return {
    ...professionalDetail(row),
    email: includeContact ? row.email : undefined,
    phone: includeContact ? row.phone : undefined,
    contactShared: includeContact,
    employmentHistory: employment,
    reviews,
    assessments: attempts,
    reviewAverage: averageRating(reviews),
    cardNote: row.is_demo ? 'Demonstration profile — seeded sample data for product evaluation.' : null
  };
}

export function employerSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgName: row.org_name,
    legalName: row.legal_name,
    gstin: row.gstin,
    industry: row.industry,
    companySize: row.company_size,
    city: row.city,
    state: row.state,
    website: row.website,
    verificationStatus: row.verification_status,
    repName: row.rep_name,
    repDesignation: row.rep_designation,
    billingEmail: row.billing_email,
    isDemo: Boolean(row.is_demo)
  };
}

export function unreadNotifications(userId) {
  return one('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL', userId)?.count || 0;
}

export function isShortlisted(employerId, professionalId) {
  return Boolean(
    one('SELECT id FROM shortlists WHERE employer_id = ? AND professional_id = ? LIMIT 1', employerId, professionalId)
  );
}

export function professionalScore(profileId) {
  const attempt = one(
    `SELECT final_score FROM assessment_attempts
     WHERE professional_id = ? AND status = 'passed'
     ORDER BY final_score DESC LIMIT 1`,
    profileId
  );
  return attempt?.final_score ?? null;
}
