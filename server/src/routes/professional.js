import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import {
  all,
  one,
  run,
  insert,
  update,
  jsonParse,
  getSettings,
  nowIso
} from '../db.js';
import {
  requireAuth,
  requireRole,
  verifyCsrf
} from '../lib/auth.js';
import { asyncHandler, audit, rateLimit } from '../lib/http.js';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import {
  professionalForUser,
  parseJsonFields,
  professionalDetail
} from '../lib/data.js';
import { recommendRate, levelForExperience } from '../domain/pricing.js';
import {
  validateAvailability,
  validateAssignmentSchedule,
  validateTimesheet,
  dayOfWeek,
  DAY_LABELS
} from '../domain/scheduling.js';
import {
  selectQuestions,
  scoreObjective,
  integrityRisk,
  retakeEligibility,
  plagiarismSignal
} from '../domain/assessment.js';
import { saveEncryptedFile, readEncryptedFile, safeStorageKey, assertAllowedUpload } from '../lib/storage.js';
import { scanBuffer, MalwareDetectedError, ScanUnavailableError } from '../lib/malware.js';
import { computePayout } from '../domain/finance.js';

const router = Router();
router.use(requireAuth, requireRole('professional'), verifyCsrf);
router.use((req, _res, next) => {
  req.professional = professionalForUser(req.user.id);
  req.dbUser = one('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!req.professional) return next(notFound('Professional profile not found.'));
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const error = assertAllowedUpload({
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: 0
    });
    if (error) return callback(new Error(error));
    callback(null, true);
  }
});

const profileUpdateSchema = z.object({
  headline: z.string().min(3).max(160).optional(),
  bio: z.string().max(3000).optional(),
  category: z.string().min(2).max(60).optional(),
  city: z.string().min(2).max(80).optional(),
  state: z.string().min(2).max(80).optional(),
  yearsExperience: z.coerce.number().min(0).max(60).optional(),
  education: z.string().max(200).optional(),
  skills: z.array(z.string().min(1).max(60)).max(20).optional(),
  certifications: z.array(z.string().max(120)).max(20).optional(),
  languages: z.array(z.string().max(40)).max(10).optional(),
  portfolioUrl: z.string().url().max(300).optional().or(z.literal('')),
  linkedinUrl: z.string().url().max(300).optional().or(z.literal('')),
  hourlyRatePaise: z.coerce.number().int().min(10000).max(1000000).optional(),
  availabilityDays: z.array(z.enum(['TUE', 'WED', 'THU', 'FRI', 'SAT'])).max(4).optional(),
  shiftHours: z.coerce.number().optional(),
  preferredStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  preferredEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  noticePeriodDays: z.coerce.number().int().min(0).max(90).optional(),
  salaryExpectationPaise: z.coerce.number().int().min(0).max(100000000).optional(),
  breaks: z
    .array(
      z.object({
        label: z.string().max(60),
        minutes: z.coerce.number().int().min(5).max(120),
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      })
    )
    .max(4)
    .optional()
});

function benchmarkFor(category, years) {
  return one(
    'SELECT * FROM rate_benchmarks WHERE category = ? AND level = ? ORDER BY as_of DESC LIMIT 1',
    category,
    levelForExperience(years)
  );
}

function bestAssessmentScore(profileId) {
  return (
    one(
      `SELECT MAX(final_score) AS score FROM assessment_attempts
       WHERE professional_id = ? AND status = 'passed'`,
      profileId
    )?.score ?? null
  );
}

function recommendationFor(profile) {
  const benchmark = benchmarkFor(profile.category, profile.years_experience);
  return recommendRate({
    benchmark,
    yearsExperience: profile.years_experience,
    assessmentScore: bestAssessmentScore(profile.id),
    certifications: jsonParse(profile.certifications, []),
    education: profile.education,
    city: profile.city,
    industry: 'Professional services',
    rating: profile.rating,
    demandIndex: benchmark?.demand_index || 1
  });
}

function completeness(profile) {
  const checks = [
    { key: 'headline', label: 'Professional headline', complete: Boolean(profile.headline) },
    { key: 'bio', label: 'Profile summary (at least 80 characters)', complete: (profile.bio || '').length >= 80 },
    { key: 'skills', label: 'At least three skills', complete: jsonParse(profile.skills, []).length >= 3 },
    { key: 'education', label: 'Education', complete: Boolean(profile.education) },
    { key: 'location', label: 'City and state', complete: Boolean(profile.city && profile.state) },
    {
      key: 'availability',
      label: 'Availability and shift preference',
      complete: jsonParse(profile.availability_days, []).length > 0
    },
    {
      key: 'employment',
      label: 'Employment history',
      complete: all('SELECT id FROM employment_history WHERE professional_id = ?', profile.id).length > 0
    },
    {
      key: 'reference',
      label: 'At least one professional reference',
      complete: all('SELECT id FROM professional_references WHERE professional_id = ?', profile.id).length > 0
    },
    {
      key: 'identity',
      label: 'Government identity document',
      complete:
        all(
          "SELECT id FROM documents WHERE owner_type = 'professional' AND owner_id = ? AND doc_type = 'identity_proof'",
          profile.id
        ).length > 0
    },
    {
      key: 'rate',
      label: 'Hourly rate',
      complete: Boolean(profile.hourly_rate_paise)
    }
  ];
  return { checks, complete: checks.every((check) => check.complete) };
}

function ownProfile(profile, user) {
  return {
    ...professionalDetail({ ...profile, name: user.name }),
    email: user.email,
    phone: user.phone,
    recommendedRatePaise: profile.recommended_rate_paise,
    availability: jsonParse(profile.availability_days, []),
    compliance: {
      workingDays: getSettings().allowedWorkingDays,
      mandatoryOffDays: getSettings().mandatoryOffDays,
      shiftOptions: getSettings().shiftOptions
    }
  };
}

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const profile = req.professional;
    const settings = getSettings();
    const assignments = all(
      `SELECT a.*, e.org_name FROM assignments a JOIN employer_profiles e ON e.id = a.employer_id
       WHERE a.professional_id = ? ORDER BY a.start_date DESC`,
      profile.id
    );
    const active = assignments.filter((item) => ['active', 'not_started', 'awaiting_approval'].includes(item.status));
    const timesheets = all(
      `SELECT t.*, a.title, a.code FROM timesheets t JOIN assignments a ON a.id = t.assignment_id
       WHERE t.professional_id = ? ORDER BY t.work_date DESC LIMIT 6`,
      profile.id
    );
    const payouts = all('SELECT * FROM payouts WHERE professional_id = ? ORDER BY created_at DESC LIMIT 5', profile.id);
    const interview = one(
      `SELECT i.*, e.org_name FROM interviews i JOIN employer_profiles e ON e.id = i.employer_id
       WHERE i.professional_id = ? AND i.scheduled_at > ? AND i.status = 'scheduled'
       ORDER BY i.scheduled_at ASC LIMIT 1`,
      profile.id,
      nowIso()
    );
    const activation = one(
      'SELECT * FROM activation_fees WHERE professional_id = ? ORDER BY disclosed_at DESC LIMIT 1',
      profile.id
    );
    const notifications = all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6',
      req.user.id
    );
    const earned = one(
      "SELECT COALESCE(SUM(net_paise),0) AS total FROM payouts WHERE professional_id = ? AND status = 'paid'",
      profile.id
    )?.total || 0;
    const pending = one(
      "SELECT COALESCE(SUM(net_paise),0) AS total FROM payouts WHERE professional_id = ? AND status IN ('pending','processing')",
      profile.id
    )?.total || 0;
    res.json({
      profile: ownProfile(profile, req.dbUser),
      completeness: completeness(profile),
      activeAssignments: active,
      assignments: assignments.slice(0, 5),
      timesheets,
      payouts,
      upcomingInterview: interview,
      latestActivationFee: activation,
      notifications,
      earnings: {
        lifetimeNetPaise: earned,
        pendingNetPaise: pending,
        activationFeesPaise:
          one(
            "SELECT COALESCE(SUM(amount_paise),0) AS total FROM activation_fees WHERE professional_id = ? AND status = 'deducted'",
            profile.id
          )?.total || 0
      },
      settings: {
        workingDays: settings.allowedWorkingDays,
        offDays: settings.mandatoryOffDays,
        shiftOptions: settings.shiftOptions,
        maxWeeklyHours: settings.weekly_hours_cap
      }
    });
  })
);

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const documents = all(
      'SELECT id, doc_type, filename, mime_type, size_bytes, status, created_at FROM documents WHERE owner_type = ? AND owner_id = ? ORDER BY created_at DESC',
      'professional',
      req.professional.id
    );
    const references = all(
      'SELECT * FROM professional_references WHERE professional_id = ? ORDER BY created_at DESC',
      req.professional.id
    );
    const employment = all(
      'SELECT * FROM employment_history WHERE professional_id = ? ORDER BY start_date DESC',
      req.professional.id
    );
    res.json({
      profile: ownProfile(req.professional, req.dbUser),
      documents,
      references,
      employment,
      completeness: completeness(req.professional),
      recommendation: recommendationFor(req.professional)
    });
  })
);

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const body = parse(profileUpdateSchema, req.body);
    const profile = req.professional;
    const settings = getSettings();
    const updates = { updated_at: nowIso() };

    if (body.headline !== undefined) updates.headline = body.headline;
    if (body.bio !== undefined) updates.bio = body.bio;
    if (body.category !== undefined) updates.category = body.category;
    if (body.city !== undefined) updates.city = body.city;
    if (body.state !== undefined) updates.state = body.state;
    if (body.education !== undefined) updates.education = body.education;
    if (body.portfolioUrl !== undefined) updates.portfolio_url = body.portfolioUrl || null;
    if (body.linkedinUrl !== undefined) updates.linkedin_url = body.linkedinUrl || null;
    if (body.noticePeriodDays !== undefined) updates.notice_period_days = body.noticePeriodDays;
    if (body.salaryExpectationPaise !== undefined) updates.salary_expectation_paise = body.salaryExpectationPaise;
    if (body.skills) updates.skills = JSON.stringify(body.skills);
    if (body.certifications) updates.certifications = JSON.stringify(body.certifications);
    if (body.languages) updates.languages = JSON.stringify(body.languages);

    if (body.yearsExperience !== undefined) {
      if (body.yearsExperience < settings.min_experience_years) {
        throw badRequest(`Flamingo requires at least ${settings.min_experience_years} years of professional experience.`);
      }
      updates.years_experience = body.yearsExperience;
      updates.minimum_experience_met = 1;
    }

    const effectiveDays = body.availabilityDays || jsonParse(profile.availability_days, []);
    const effectiveShift = body.shiftHours ?? profile.shift_hours;
    const effectiveStart = body.preferredStart || profile.preferred_start || '09:00';
    if (body.availabilityDays || body.shiftHours || body.preferredStart || body.breaks) {
      const validation = validateAvailability(
        {
          days: effectiveDays,
          shiftHours: effectiveShift,
          startTime: effectiveStart,
          breaks: body.breaks || jsonParse(profile.break_schedule, [])
        },
        settings
      );
      if (!validation.valid) throw unprocessable('Working pattern is not compliant.', validation.errors);
      updates.availability_days = JSON.stringify(effectiveDays);
      updates.shift_hours = effectiveShift;
      updates.preferred_start = effectiveStart;
      updates.preferred_end = validation.endTime;
    }

    if (body.hourlyRatePaise !== undefined) {
      const benchmark = benchmarkFor(body.category || profile.category, body.yearsExperience ?? profile.years_experience);
      if (benchmark) {
        if (
          body.hourlyRatePaise < benchmark.min_hourly_paise ||
          body.hourlyRatePaise > benchmark.max_hourly_paise
        ) {
          throw unprocessable(
            'Published rate is outside the sourced range for this category.',
            {
              minHourlyPaise: benchmark.min_hourly_paise,
              maxHourlyPaise: benchmark.max_hourly_paise,
              source: benchmark.source_name
            }
          );
        }
      }
      updates.hourly_rate_paise = body.hourlyRatePaise;
    }

    const updated = { ...profile, ...updates };
    const recommendation = recommendationFor(updated);
    if (recommendation.available) updates.recommended_rate_paise = recommendation.recommendedHourlyPaise;
    if (!updates.hourly_rate_paise && !profile.hourly_rate_paise && recommendation.available) {
      updates.hourly_rate_paise = recommendation.recommendedHourlyPaise;
    }
    update('professional_profiles', profile.id, updates);
    audit(req, { action: 'professional.profile_updated', entityType: 'professional_profile', entityId: profile.id, meta: { fields: Object.keys(updates) } });
    const fresh = one('SELECT * FROM professional_profiles WHERE id = ?', profile.id);
    res.json({
      profile: ownProfile(fresh, req.dbUser),
      recommendation: recommendationFor(fresh),
      completeness: completeness(fresh)
    });
  })
);

router.post(
  '/profile/submit',
  asyncHandler(async (req, res) => {
    const profile = req.professional;
    const check = completeness(profile);
    if (!check.complete) {
      throw unprocessable('Complete the outstanding profile requirements before submitting for verification.', check.checks.filter((item) => !item.complete));
    }
    update('professional_profiles', profile.id, {
      profile_status: 'submitted',
      verification_status: 'in_review',
      updated_at: nowIso()
    });
    audit(req, { action: 'professional.verification_submitted', entityType: 'professional_profile', entityId: profile.id });
    res.json({
      ok: true,
      message: 'Profile submitted. Identity and experience verification usually completes within two business days.'
    });
  })
);

router.post(
  '/profile/visibility',
  asyncHandler(async (req, res) => {
    const { isPublic } = parse(z.object({ isPublic: z.boolean() }), req.body);
    const profile = req.professional;
    if (isPublic) {
      if (profile.verification_status !== 'verified') throw forbidden('Identity and experience verification must be complete.');
      if (profile.assessment_status !== 'passed') throw forbidden('Pass the assessment before publishing your profile.');
      if (profile.profile_status !== 'approved') throw forbidden('Your profile is awaiting approval.');
    }
    update('professional_profiles', profile.id, { is_public: isPublic ? 1 : 0, updated_at: nowIso() });
    audit(req, { action: 'professional.visibility_changed', entityType: 'professional_profile', entityId: profile.id, meta: { isPublic } });
    res.json({ ok: true, isPublic, note: 'Your career record remains accessible when public visibility is off.' });
  })
);

router.post(
  '/documents',
  rateLimit({ windowMs: 60 * 60_000, max: 12, scope: 'uploads' }),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Choose a document to upload.');
    const docType = String(req.body.docType || 'other');
    const allowed = ['identity_proof', 'address_proof', 'education', 'certification', 'experience_letter', 'resume', 'other'];
    if (!allowed.includes(docType)) throw badRequest('Unknown document type.');
    const error = assertAllowedUpload(req.file);
    if (error) throw unprocessable(error);
    try {
      await scanBuffer(req.file.buffer, { filename: req.file.originalname });
    } catch (scanError) {
      audit(req, {
        action:
          scanError instanceof MalwareDetectedError
            ? 'document.scan_rejected'
            : 'document.scan_unavailable',
        entityType: 'document',
        entityId: null,
        meta: {
          docType,
          filename: req.file.originalname,
          signature: scanError.details?.signature ?? null
        }
      });
      throw scanError;
    }
    const storageKey = safeStorageKey(req.file.originalname);
    const { iv, authTag } = saveEncryptedFile(req.file.buffer, storageKey);
    const id = `doc_${crypto.randomUUID()}`;
    insert('documents', {
      id,
      owner_type: 'professional',
      owner_id: req.professional.id,
      doc_type: docType,
      filename: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      storage_key: storageKey,
      iv,
      auth_tag: authTag,
      status: 'submitted',
      reviewer_id: null,
      reviewed_at: null,
      review_notes: null,
      created_at: nowIso()
    });
    if (docType === 'identity_proof' && req.professional.identity_status === 'pending') {
      update('professional_profiles', req.professional.id, { identity_status: 'submitted', updated_at: nowIso() });
    }
    audit(req, { action: 'document.uploaded', entityType: 'document', entityId: id, meta: { docType } });
    res.status(201).json({
      document: { id, docType, filename: req.file.originalname, sizeBytes: req.file.size, status: 'submitted' },
      message: 'Document encrypted at rest and queued for verification.'
    });
  })
);

router.get(
  '/documents/:id/download',
  asyncHandler(async (req, res) => {
    const document = one('SELECT * FROM documents WHERE id = ?', req.params.id);
    if (!document) throw notFound();
    const isOwner = document.owner_type === 'professional' && document.owner_id === req.professional.id;
    if (!isOwner) throw forbidden();
    const buffer = readEncryptedFile(document.storage_key, document.iv, document.auth_tag);
    if (!buffer) throw notFound('Stored file is unavailable.');
    audit(req, { action: 'document.downloaded', entityType: 'document', entityId: document.id });
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename.replace(/["\r\n]/g, '')}"`);
    res.send(buffer);
  })
);

router.post(
  '/employment',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        employerName: z.string().min(2).max(160),
        title: z.string().min(2).max(120),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        isCurrent: z.boolean().optional(),
        description: z.string().max(1000).optional()
      }),
      req.body
    );
    if (body.startDate > nowIso().slice(0, 10)) throw badRequest('Start date cannot be in the future.');
    if (!body.isCurrent && body.endDate && body.endDate < body.startDate) {
      throw badRequest('End date must be after the start date.');
    }
    const id = `eh_${crypto.randomUUID()}`;
    insert('employment_history', {
      id,
      professional_id: req.professional.id,
      employer_name: body.employerName,
      title: body.title,
      start_date: body.startDate,
      end_date: body.isCurrent ? null : body.endDate || null,
      is_current: body.isCurrent ? 1 : 0,
      description: body.description || null,
      verified: 0,
      verified_at: null,
      created_at: nowIso()
    });
    audit(req, { action: 'professional.employment_added', entityType: 'employment_history', entityId: id });
    res.status(201).json({ ok: true, id });
  })
);

router.post(
  '/references',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(2).max(120),
        company: z.string().max(160).optional(),
        title: z.string().max(120).optional(),
        email: z.string().email().max(200),
        phone: z.string().max(30).optional(),
        relationship: z.string().max(80).optional()
      }),
      req.body
    );
    const id = `ref_${crypto.randomUUID()}`;
    insert('professional_references', {
      id,
      professional_id: req.professional.id,
      name: body.name,
      company: body.company || null,
      title: body.title || null,
      email: body.email,
      phone: body.phone || null,
      relationship: body.relationship || null,
      status: 'invited',
      created_at: nowIso()
    });
    audit(req, { action: 'reference.added', entityType: 'professional_reference', entityId: id });
    res.status(201).json({ ok: true, id, status: 'invited' });
  })
);

router.get(
  '/pricing/recommendation',
  asyncHandler(async (req, res) => {
    const category = String(req.query.category || req.professional.category);
    const years = Number(req.query.years || req.professional.years_experience);
    const benchmark = benchmarkFor(category, years);
    const result = recommendRate({
      benchmark,
      yearsExperience: years,
      assessmentScore: bestAssessmentScore(req.professional.id),
      certifications: jsonParse(req.professional.certifications, []),
      education: req.professional.education,
      city: req.professional.city,
      industry: String(req.query.industry || 'Professional services'),
      rating: req.professional.rating,
      demandIndex: benchmark?.demand_index || 1
    });
    res.json({ recommendation: result });
  })
);

// ------------------------------------------------------------------ assessments
function attemptSummary(attempt) {
  return {
    id: attempt.id,
    assessmentId: attempt.assessment_id,
    title: attempt.title,
    category: attempt.category,
    status: attempt.status,
    attemptNo: attempt.attempt_no,
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at,
    submittedAt: attempt.submitted_at,
    autoScore: attempt.auto_score,
    finalScore: attempt.final_score,
    passMark: attempt.pass_mark,
    integrityScore: attempt.integrity_score,
    integrityFlags: jsonParse(attempt.integrity_flags, []),
    feedback: attempt.feedback,
    reviewNotes: attempt.review_notes
  };
}

router.get(
  '/assessments',
  asyncHandler(async (req, res) => {
    const assessments = all(
      `SELECT s.*, (SELECT COUNT(*) FROM assessment_questions q WHERE q.assessment_id = s.id) AS question_count
       FROM assessments s WHERE s.is_active = 1 ORDER BY s.category, s.title`
    );
    const attempts = all(
      `SELECT a.*, s.title, s.category FROM assessment_attempts a JOIN assessments s ON s.id = a.assessment_id
       WHERE a.professional_id = ? ORDER BY a.started_at DESC`,
      req.professional.id
    );
    const recommended = assessments.filter((item) => item.category === req.professional.category);
    res.json({
      recommended: recommended.map(({ id, code, title, category, description, duration_minutes, pass_score, question_count }) => ({
        id, code, title, category, description, durationMinutes: duration_minutes, passScore: pass_score, questionCount: question_count
      })),
      all: assessments.map(({ id, title, category, duration_minutes, pass_score, question_count }) => ({
        id, title, category, durationMinutes: duration_minutes, passScore: pass_score, questionCount: question_count
      })),
      attempts: attempts.map(attemptSummary),
      integrityNotice:
        'Assessments are monitored for suspicious patterns. Signals are reviewed by a human and never treated as automated proof of misconduct.'
    });
  })
);

router.post(
  '/assessments/:id/start',
  rateLimit({ windowMs: 60 * 60_000, max: 10, scope: 'assessment-start' }),
  asyncHandler(async (req, res) => {
    const assessment = one('SELECT * FROM assessments WHERE id = ? AND is_active = 1', req.params.id);
    if (!assessment) throw notFound('Assessment not found.');
    const attempts = all(
      'SELECT * FROM assessment_attempts WHERE professional_id = ? AND assessment_id = ? ORDER BY attempt_no DESC',
      req.professional.id,
      assessment.id
    );
    const activeAttempt = attempts.find(
      (attempt) => attempt.status === 'in_progress' && new Date(attempt.expires_at) > new Date()
    );
    if (activeAttempt) {
      return res.json({ attemptId: activeAttempt.id, resumed: true });
    }
    for (const attempt of attempts.filter((item) => item.status === 'in_progress')) {
      run("UPDATE assessment_attempts SET status = 'expired' WHERE id = ?", attempt.id);
    }
    if (attempts.some((attempt) => attempt.status === 'passed')) {
      throw conflict('You have already passed this assessment. Retakes are available only after a failed attempt.');
    }
    const lastFinished = attempts.find((attempt) => ['failed', 'expired'].includes(attempt.status));
    const eligibility = retakeEligibility(lastFinished, getSettings());
    if (!eligibility.eligible) throw forbidden(eligibility.reason);

    const questions = all('SELECT * FROM assessment_questions WHERE assessment_id = ?', assessment.id);
    if (!questions.length) throw conflict('This assessment has no published questions yet.');
    const seed = crypto.randomInt(1, 2 ** 31);
    const selected = selectQuestions(questions, questions.length, seed);
    const attemptId = `att_${crypto.randomUUID()}`;
    insert('assessment_attempts', {
      id: attemptId,
      assessment_id: assessment.id,
      professional_id: req.professional.id,
      attempt_no: (attempts[0]?.attempt_no || 0) + 1,
      status: 'in_progress',
      started_at: nowIso(),
      expires_at: new Date(Date.now() + assessment.duration_minutes * 60_000).toISOString(),
      submitted_at: null,
      auto_score: null,
      final_score: null,
      pass_mark: assessment.pass_score,
      integrity_score: 100,
      integrity_flags: '[]',
      reviewer_id: null,
      reviewed_at: null,
      review_notes: null,
      feedback: null,
      question_order: JSON.stringify(selected.map((question) => question.id))
    });
    update('professional_profiles', req.professional.id, {
      assessment_status: 'in_progress',
      updated_at: nowIso()
    });
    audit(req, { action: 'assessment.started', entityType: 'assessment_attempt', entityId: attemptId });
    res.status(201).json({ attemptId, durationMinutes: assessment.duration_minutes });
  })
);

router.get(
  '/attempts/:id',
  asyncHandler(async (req, res) => {
    const attempt = one(
      `SELECT a.*, s.title, s.category, s.duration_minutes FROM assessment_attempts a
       JOIN assessments s ON s.id = a.assessment_id
       WHERE a.id = ? AND a.professional_id = ?`,
      req.params.id,
      req.professional.id
    );
    if (!attempt) throw notFound();
    const order = jsonParse(attempt.question_order, []);
    const questions = order.length
      ? all(
          `SELECT * FROM assessment_questions WHERE assessment_id = ? AND id IN (${order.map(() => '?').join(',')})`,
          attempt.assessment_id,
          ...order
        )
      : all('SELECT * FROM assessment_questions WHERE assessment_id = ?', attempt.assessment_id);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean);
    const answers = all('SELECT * FROM attempt_answers WHERE attempt_id = ?', attempt.id);
    const answerMap = Object.fromEntries(answers.map((answer) => [answer.question_id, answer]));
    const inProgress = attempt.status === 'in_progress';
    res.json({
      attempt: attemptSummary(attempt),
      expired: inProgress && new Date(attempt.expires_at) <= new Date(),
      questions: ordered.map((question, index) => ({
        id: question.id,
        number: index + 1,
        type: question.type,
        prompt: question.prompt,
        options: jsonParse(question.options, []),
        points: question.points,
        rubric: question.type === 'practical' ? question.rubric : null,
        savedAnswer: answerMap[question.id]?.answer ?? null,
        ...(inProgress ? {} : { awardedPoints: answerMap[question.id]?.points_awarded ?? null })
      }))
    });
  })
);

router.post(
  '/attempts/:id/answer',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ questionId: z.string().min(1), answer: z.union([z.string().max(8000), z.number()]) }),
      req.body
    );
    const attempt = one(
      'SELECT * FROM assessment_attempts WHERE id = ? AND professional_id = ?',
      req.params.id,
      req.professional.id
    );
    if (!attempt) throw notFound();
    if (attempt.status !== 'in_progress') throw conflict('This attempt has already been submitted.');
    if (new Date(attempt.expires_at) <= new Date()) throw conflict('The assessment timer has expired.');
    const question = one(
      'SELECT * FROM assessment_questions WHERE id = ? AND assessment_id = ?',
      body.questionId,
      attempt.assessment_id
    );
    if (!question) throw badRequest('Question does not belong to this assessment.');
    const existing = one('SELECT id FROM attempt_answers WHERE attempt_id = ? AND question_id = ?', attempt.id, question.id);
    if (existing) {
      run('UPDATE attempt_answers SET answer = ? WHERE id = ?', String(body.answer), existing.id);
    } else {
      insert('attempt_answers', {
        id: `ans_${crypto.randomUUID()}`,
        attempt_id: attempt.id,
        question_id: question.id,
        answer: String(body.answer),
        is_correct: null,
        points_awarded: null,
        reviewer_note: null
      });
    }
    res.json({ ok: true, savedAt: nowIso() });
  })
);

router.post(
  '/attempts/:id/integrity',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ type: z.string().min(1).max(60), detail: z.string().max(500).optional() }),
      req.body
    );
    const attempt = one(
      'SELECT * FROM assessment_attempts WHERE id = ? AND professional_id = ?',
      req.params.id,
      req.professional.id
    );
    if (!attempt) throw notFound();
    insert('integrity_events', {
      id: `iev_${crypto.randomUUID()}`,
      attempt_id: attempt.id,
      event_type: body.type,
      detail: body.detail || null,
      created_at: nowIso()
    });
    const flags = jsonParse(attempt.integrity_flags, []);
    const existing = flags.find((flag) => flag.type === body.type);
    if (existing) existing.count += 1;
    else flags.push({ type: body.type, count: 1 });
    const risk = integrityRisk(flags);
    run(
      'UPDATE assessment_attempts SET integrity_flags = ?, integrity_score = ? WHERE id = ?',
      JSON.stringify(flags),
      risk.score,
      attempt.id
    );
    res.json({ ok: true, integrityScore: risk.score, band: risk.band, disclaimer: risk.disclaimer });
  })
);

router.post(
  '/attempts/:id/submit',
  asyncHandler(async (req, res) => {
    const attempt = one(
      'SELECT * FROM assessment_attempts WHERE id = ? AND professional_id = ?',
      req.params.id,
      req.professional.id
    );
    if (!attempt) throw notFound();
    if (attempt.status !== 'in_progress') throw conflict('This attempt has already been submitted.');
    const questions = all('SELECT * FROM assessment_questions WHERE assessment_id = ?', attempt.assessment_id);
    const answers = all('SELECT * FROM attempt_answers WHERE attempt_id = ?', attempt.id);
    if (!answers.length) throw badRequest('Answer at least one question before submitting.');
    const answersByQuestion = Object.fromEntries(answers.map((answer) => [answer.question_id, answer]));
    const result = scoreObjective(questions, answersByQuestion);
    for (const item of result.results) {
      const answer = answersByQuestion[item.questionId];
      if (!answer) continue;
      run(
        'UPDATE attempt_answers SET is_correct = ?, points_awarded = ? WHERE id = ?',
        item.isCorrect === null ? null : item.isCorrect ? 1 : 0,
        item.isCorrect === null ? null : item.points,
        answer.id
      );
    }
    const practicalAnswers = answers.filter((answer) => {
      const question = questions.find((item) => item.id === answer.question_id);
      return question?.type === 'practical';
    });
    const others = all(
      `SELECT id, answer FROM attempt_answers
       WHERE attempt_id != ? AND question_id IN (${questions.filter((q) => q.type === 'practical').map(() => '?').join(',') || "''"})
       ORDER BY answer ASC LIMIT 1`,
      attempt.id,
      ...(questions.filter((q) => q.type === 'practical').map((q) => q.id))
    );
    const signals = practicalAnswers.map((answer) => plagiarismSignal(answer.answer, others));
    const duplicate = signals.find((signal) => signal.flag);
    const flags = jsonParse(attempt.integrity_flags, []);
    if (duplicate) flags.push({ type: 'duplicate_submission', count: 1 });
    const risk = integrityRisk(flags);
    const now = nowIso();
    run(
      `UPDATE assessment_attempts SET status = 'human_review', submitted_at = ?, auto_score = ?,
       integrity_flags = ?, integrity_score = ? WHERE id = ?`,
      now,
      result.autoScore,
      JSON.stringify(flags),
      risk.score,
      attempt.id
    );
    audit(req, {
      action: 'assessment.submitted',
      entityType: 'assessment_attempt',
      entityId: attempt.id,
      meta: { autoScore: result.autoScore, integrityScore: risk.score }
    });
    res.json({
      ok: true,
      autoScore: result.autoScore,
      status: 'human_review',
      message:
        'Objective answers were auto-marked. Practical answers and any integrity signals are queued for human review. Results usually publish within two business days.',
      integrity: risk
    });
  })
);

// ------------------------------------------------------------------ assignments
function assignmentView(row) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status,
    employer: row.org_name,
    professional: row.professional_name,
    category: row.category,
    hourlyRatePaise: row.hourly_rate_paise,
    hoursPerWeek: row.hours_per_week,
    shiftHours: row.shift_hours,
    workingDays: jsonParse(row.working_days, []),
    dailyStart: row.daily_start,
    startDate: row.start_date,
    endDate: row.end_date,
    totalValuePaise: row.total_value_paise,
    estimatedHours: row.estimated_hours,
    deliverables: row.deliverables,
    reportingManager: row.reporting_manager,
    paymentTerms: row.payment_terms,
    cancellationTerms: row.cancellation_terms,
    disputeTerms: row.dispute_terms,
    breakSchedule: jsonParse(row.break_schedule, []),
    contractSignedProfessional: Boolean(row.contract_signed_professional),
    contractSignedEmployer: Boolean(row.contract_signed_employer),
    activationFeeCharged: Boolean(row.activation_fee_charged),
    createdAt: row.created_at
  };
}

router.get(
  '/assignments',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT a.*, e.org_name, u.name AS professional_name
       FROM assignments a
       JOIN employer_profiles e ON e.id = a.employer_id
       JOIN professional_profiles p ON p.id = a.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE a.professional_id = ? ORDER BY a.created_at DESC`,
      req.professional.id
    );
    res.json({ assignments: rows.map(assignmentView) });
  })
);

router.get(
  '/assignments/:id',
  asyncHandler(async (req, res) => {
    const row = one(
      `SELECT a.*, e.org_name, u.name AS professional_name
       FROM assignments a JOIN employer_profiles e ON e.id = a.employer_id
       JOIN professional_profiles p ON p.id = a.professional_id JOIN users u ON u.id = p.user_id
       WHERE a.id = ? AND a.professional_id = ?`,
      req.params.id,
      req.professional.id
    );
    if (!row) throw notFound();
    const fee = one('SELECT * FROM activation_fees WHERE assignment_id = ?', row.id);
    const payouts = all('SELECT * FROM payouts WHERE assignment_id = ? ORDER BY created_at', row.id);
    const timesheets = all('SELECT * FROM timesheets WHERE assignment_id = ? ORDER BY work_date DESC', row.id);
    const review = one('SELECT * FROM reviews WHERE assignment_id = ?', row.id);
    const events = all('SELECT * FROM assignment_events WHERE assignment_id = ? ORDER BY created_at', row.id);
    res.json({
      assignment: assignmentView(row),
      activationFee: fee
        ? {
            amountPaise: fee.amount_paise,
            basePaise: fee.base_paise,
            gstPaise: fee.gst_paise,
            status: fee.status,
            disclosedAt: fee.disclosed_at,
            chargedAt: fee.charged_at,
            disclosure:
              'A ₹699 activation fee is deducted once from your first payout for this assignment. It is not a subscription. If you decline before activation, nothing is deducted.'
          }
        : null,
      payouts,
      timesheets,
      review,
      events
    });
  })
);

router.post(
  '/assignments/:id/accept',
  asyncHandler(async (req, res) => {
    const row = one(
      'SELECT * FROM assignments WHERE id = ? AND professional_id = ?',
      req.params.id,
      req.professional.id
    );
    if (!row) throw notFound();
    if (row.contract_signed_professional) throw conflict('You have already accepted this assignment.');
    if (['cancelled', 'closed', 'completed'].includes(row.status)) throw conflict('This assignment can no longer be accepted.');
    const settings = getSettings();
    const existing = all(
      `SELECT id, code, title, working_days, shift_hours, daily_start FROM assignments
       WHERE professional_id = ? AND status IN ('active','not_started','awaiting_approval') AND id != ?`,
      req.professional.id,
      row.id
    ).map((item) => ({ ...item, working_days: jsonParse(item.working_days, []) }));
    const conflicts = validateAssignmentSchedule({
      workingDays: jsonParse(row.working_days, []),
      shiftHours: row.shift_hours,
      dailyStart: row.daily_start,
      existingAssignments: existing,
      settings
    });
    if (!conflicts.valid) throw unprocessable('This engagement conflicts with your existing schedule.', conflicts.errors);
    const now = nowIso();
    run('UPDATE assignments SET contract_signed_professional = 1, updated_at = ? WHERE id = ?', now, row.id);
    insert('assignment_events', {
      id: `ae_${crypto.randomUUID()}`,
      assignment_id: row.id,
      event_type: 'contract_accepted_professional',
      actor_id: req.user.id,
      note: 'Professional accepted the assignment contract and ₹699 activation-fee disclosure',
      created_at: now
    });
    audit(req, {
      action: 'assignment.accepted',
      entityType: 'assignment',
      entityId: row.id,
      meta: { activationFeeDisclosed: true }
    });
    res.json({ ok: true, activationFeeDisclosure: '₹699 will be deducted once from your first payout if the employer funds the advance.' });
  })
);

router.post(
  '/assignments/:id/decline',
  asyncHandler(async (req, res) => {
    const row = one(
      'SELECT * FROM assignments WHERE id = ? AND professional_id = ?',
      req.params.id,
      req.professional.id
    );
    if (!row) throw notFound();
    if (row.activation_fee_charged) throw conflict('Contact support: an activation fee has already been charged for this assignment.');
    if (row.status === 'completed') throw conflict('Completed assignments cannot be declined.');
    run("UPDATE assignments SET status = 'cancelled', updated_at = ? WHERE id = ?", nowIso(), row.id);
    insert('assignment_events', {
      id: `ae_${crypto.randomUUID()}`,
      assignment_id: row.id,
      event_type: 'declined_by_professional',
      actor_id: req.user.id,
      note: 'Professional declined before activation. No fee charged.',
      created_at: nowIso()
    });
    audit(req, { action: 'assignment.declined', entityType: 'assignment', entityId: row.id });
    res.json({ ok: true, note: 'Assignment declined. No activation fee was charged.' });
  })
);

router.post(
  '/assignments/:id/submit-completion',
  asyncHandler(async (req, res) => {
    const row = one(
      'SELECT * FROM assignments WHERE id = ? AND professional_id = ?',
      req.params.id,
      req.professional.id
    );
    if (!row) throw notFound();
    if (row.status !== 'active') throw conflict('Only active assignments can be submitted for completion.');
    run("UPDATE assignments SET status = 'awaiting_approval', updated_at = ? WHERE id = ?", nowIso(), row.id);
    insert('assignment_events', {
      id: `ae_${crypto.randomUUID()}`,
      assignment_id: row.id,
      event_type: 'completion_submitted',
      actor_id: req.user.id,
      note: 'Professional submitted completion evidence',
      created_at: nowIso()
    });
    audit(req, { action: 'assignment.completion_submitted', entityType: 'assignment', entityId: row.id });
    res.json({ ok: true, status: 'awaiting_approval' });
  })
);

// ------------------------------------------------------------------ timesheets
router.get(
  '/timesheets',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT t.*, a.title, a.code, e.org_name FROM timesheets t
       JOIN assignments a ON a.id = t.assignment_id
       JOIN employer_profiles e ON e.id = a.employer_id
       WHERE t.professional_id = ? ORDER BY t.work_date DESC LIMIT 60`,
      req.professional.id
    );
    res.json({ timesheets: rows });
  })
);

router.post(
  '/timesheets',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        assignmentId: z.string().min(1),
        workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        breakMinutes: z.coerce.number().int().min(0).max(180),
        notes: z.string().max(500).optional()
      }),
      req.body
    );
    const assignment = one(
      'SELECT * FROM assignments WHERE id = ? AND professional_id = ?',
      body.assignmentId,
      req.professional.id
    );
    if (!assignment) throw notFound('Assignment not found.');
    if (!['active', 'awaiting_approval'].includes(assignment.status)) {
      throw conflict('Time can only be logged against an active assignment.');
    }
    const existing = all(
      'SELECT * FROM timesheets WHERE professional_id = ?',
      req.professional.id
    );
    const validation = validateTimesheet({
      workDate: body.workDate,
      startTime: body.startTime,
      endTime: body.endTime,
      breakMinutes: body.breakMinutes,
      assignment: { ...assignment, working_days: jsonParse(assignment.working_days, []) },
      existingTimesheets: existing,
      settings: getSettings()
    });
    if (!validation.valid) throw unprocessable('Timesheet is not compliant.', validation.errors);
    const id = `ts_${crypto.randomUUID()}`;
    insert('timesheets', {
      id,
      assignment_id: assignment.id,
      professional_id: req.professional.id,
      work_date: body.workDate,
      start_at: body.startTime,
      end_at: body.endTime,
      break_minutes: body.breakMinutes,
      hours_worked: validation.hoursWorked,
      status: 'submitted',
      notes: body.notes || null,
      submitted_at: nowIso(),
      approved_by: null,
      approved_at: null,
      approval_note: null
    });
    audit(req, {
      action: 'timesheet.submitted',
      entityType: 'timesheet',
      entityId: id,
      meta: { hours: validation.hoursWorked, week: dayOfWeek(body.workDate) }
    });
    res.status(201).json({
      ok: true,
      id,
      hoursWorked: validation.hoursWorked,
      weekTotal: validation.weeklyLogged,
      day: DAY_LABELS[dayOfWeek(body.workDate)]
    });
  })
);

// ------------------------------------------------------------------ finance & career
router.get(
  '/finance/summary',
  asyncHandler(async (req, res) => {
    const professionalId = req.professional.id;
    const payouts = all(
      `SELECT p.*, a.code, a.title, e.org_name FROM payouts p
       JOIN assignments a ON a.id = p.assignment_id
       JOIN employer_profiles e ON e.id = a.employer_id
       WHERE p.professional_id = ? ORDER BY p.created_at DESC`,
      professionalId
    );
    const fees = all(
      `SELECT f.*, a.code, a.title FROM activation_fees f JOIN assignments a ON a.id = f.assignment_id
       WHERE f.professional_id = ? ORDER BY f.disclosed_at DESC`,
      professionalId
    );
    const totals = {
      grossEarnedPaise: payouts.reduce((sum, item) => sum + item.gross_paise, 0),
      netPaidPaise: payouts.filter((p) => p.status === 'paid').reduce((sum, item) => sum + item.net_paise, 0),
      pendingPaise: payouts.filter((p) => ['pending', 'processing'].includes(p.status)).reduce((sum, item) => sum + item.net_paise, 0),
      activationFeesPaise: fees.filter((f) => f.status === 'deducted').reduce((sum, item) => sum + item.amount_paise, 0),
      tdsPaise: payouts.reduce((sum, item) => sum + item.tds_paise, 0)
    };
    res.json({
      payouts,
      activationFees: fees.map((fee) => ({
        ...fee,
        disclosure: 'One-time activation fee per assignment, deducted from the first payout only.'
      })),
      totals,
      statementNote:
        'Amounts are shown in Indian rupees. Activation fee is GST-inclusive; the GST component is recorded in the financial ledger. This demo uses a simulated payment gateway.'
    });
  })
);

router.get(
  '/career',
  asyncHandler(async (req, res) => {
    const profile = req.professional;
    const assignments = all(
      `SELECT a.*, e.org_name FROM assignments a JOIN employer_profiles e ON e.id = a.employer_id
       WHERE a.professional_id = ? ORDER BY a.start_date DESC`,
      profile.id
    );
    const reviews = all(
      `SELECT r.*, e.org_name FROM reviews r JOIN employer_profiles e ON e.id = r.employer_id
       WHERE r.professional_id = ? ORDER BY r.submitted_at DESC`,
      profile.id
    ).map((review) => ({
      ...review,
      scores: jsonParse(review.scores, {})
    }));
    const assessments = all(
      `SELECT a.id, a.status, a.final_score, a.pass_mark, a.submitted_at, s.title, s.category
       FROM assessment_attempts a JOIN assessments s ON s.id = a.assessment_id
       WHERE a.professional_id = ? AND a.status IN ('passed','failed') ORDER BY a.submitted_at DESC`,
      profile.id
    );
    const employment = all('SELECT * FROM employment_history WHERE professional_id = ? ORDER BY start_date DESC', profile.id);
    const attendance = one(
      `SELECT COALESCE(SUM(hours_worked),0) AS hours, COUNT(*) AS entries
       FROM timesheets WHERE professional_id = ? AND status = 'approved'`,
      profile.id
    );
    res.json({
      profile: {
        ...ownProfile(profile, req.dbUser),
        completedAssignments: profile.completed_assignments,
        rating: profile.rating,
        rehireRate: profile.rehire_rate
      },
      assignments: assignments.map(assignmentView),
      reviews,
      assessments,
      employment,
      attendance,
      retentionNote:
        'Your career record is preserved if your membership becomes inactive. Only authorised, relevant information is shared with prospective employers.'
    });
  })
);

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const reviews = all(
      `SELECT r.*, e.org_name, a.code, a.title FROM reviews r
       JOIN employer_profiles e ON e.id = r.employer_id
       JOIN assignments a ON a.id = r.assignment_id
       WHERE r.professional_id = ? ORDER BY r.submitted_at DESC`,
      req.professional.id
    ).map((review) => ({ ...review, scores: jsonParse(review.scores, {}) }));
    res.json({ reviews });
  })
);

router.post(
  '/reviews/:id/respond',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ response: z.string().min(10).max(2000), challenge: z.boolean().optional() }),
      req.body
    );
    const review = one(
      'SELECT * FROM reviews WHERE id = ? AND professional_id = ?',
      req.params.id,
      req.professional.id
    );
    if (!review) throw notFound();
    if (review.professional_response) throw conflict('You have already responded to this review.');
    if (review.status === 'under_review' || review.status === 'challenged') {
      throw conflict('A challenge for this review is already in progress.');
    }
    const now = nowIso();
    run(
      "UPDATE reviews SET professional_response = ?, response_at = ?, status = ? WHERE id = ?",
      body.response,
      now,
      body.challenge ? 'challenged' : review.status,
      review.id
    );
    if (body.challenge) {
      insert('disputes', {
        id: `disp_${crypto.randomUUID()}`,
        raised_by: req.user.id,
        assignment_id: review.assignment_id,
        review_id: review.id,
        payment_id: null,
        category: 'review',
        description: body.response,
        status: 'open',
        resolution: null,
        created_at: now,
        resolved_at: null
      });
    }
    audit(req, {
      action: body.challenge ? 'review.challenged' : 'review.responded',
      entityType: 'review',
      entityId: review.id
    });
    res.json({
      ok: true,
      status: body.challenge ? 'challenged' : review.status,
      message: body.challenge
        ? 'Your challenge is with the Flamingo review team. The original review remains visible with a “under review” marker until resolved.'
        : 'Response published alongside the review.'
    });
  })
);

router.get(
  '/interviews',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT i.*, e.org_name FROM interviews i JOIN employer_profiles e ON e.id = i.employer_id
       WHERE i.professional_id = ? ORDER BY i.scheduled_at DESC`,
      req.professional.id
    );
    res.json({ interviews: rows.map((row) => ({ ...row, panel: jsonParse(row.panel, []) })) });
  })
);

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const notifications = all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      req.user.id
    );
    res.json({ notifications });
  })
);

router.post(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    run(
      'UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?',
      nowIso(),
      req.params.id,
      req.user.id
    );
    res.json({ ok: true });
  })
);

export default router;
