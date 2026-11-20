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
import { requireAuth, requireRole, verifyCsrf } from '../lib/auth.js';
import { asyncHandler, audit } from '../lib/http.js';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import {
  employerForUser,
  employerSummary,
  professionalCard,
  professionalPublicProfile,
  isShortlisted
} from '../lib/data.js';
import {
  validateAvailability,
  validateAssignmentSchedule
} from '../domain/scheduling.js';
import { scoreReview, averageRating } from '../domain/performance.js';
import { levelForExperience, roundToNearest } from '../domain/pricing.js';
import {
  activationFee,
  employerInvoice,
  paymentPlan,
  computePayout,
  ledgerForInvoiceCapture,
  ledgerForActivation,
  ledgerForPayout
} from '../domain/finance.js';
import { saveEncryptedFile, safeStorageKey, assertAllowedUpload, readEncryptedFile } from '../lib/storage.js';
import { scanBuffer, MalwareDetectedError } from '../lib/malware.js';

const router = Router();
router.use(requireAuth, requireRole('employer'), verifyCsrf);
router.use((req, _res, next) => {
  req.employer = employerForUser(req.user.id);
  req.dbUser = one('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!req.employer) return next(notFound('Employer profile not found.'));
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});

const requirementSchema = z.object({
  title: z.string().min(3).max(180),
  category: z.string().min(2).max(60),
  description: z.string().min(20).max(4000),
  skills: z.array(z.string().min(1).max(60)).min(1).max(20),
  minExperience: z.coerce.number().min(0).max(40).default(3),
  hoursPerWeek: z.coerce.number().int().min(4).max(48),
  shiftHours: z.coerce.number().int(),
  workingDays: z.array(z.enum(['TUE', 'WED', 'THU', 'FRI', 'SAT'])).min(1).max(4),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationWeeks: z.coerce.number().int().min(1).max(52),
  budgetHourlyPaise: z.coerce.number().int().min(10000).max(1000000),
  status: z.enum(['draft', 'open']).optional().default('open')
});

function ensureVerifiedEmployer(req) {
  if (req.employer.verification_status !== 'verified') {
    throw forbidden('Employer verification must be completed before this action.');
  }
}

function professionalForId(id) {
  return one(
    `SELECT p.*, u.name FROM professional_profiles p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    id
  );
}

function invoiceSeq() {
  return (one('SELECT COUNT(*) AS count FROM invoices')?.count || 0) + 1;
}

function recordLedger(entries, refType, refId, timestamp) {
  for (const entry of entries) {
    insert('ledger_entries', {
      id: `led_${crypto.randomUUID()}`,
      txn_group: entry.groupId,
      account: entry.account,
      direction: entry.direction,
      amount_paise: entry.amountPaise,
      ref_type: refType,
      ref_id: refId,
      description: entry.description,
      created_at: timestamp
    });
  }
}

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const employerId = req.employer.id;
    const requirements = all(
      'SELECT * FROM job_requirements WHERE employer_id = ? ORDER BY created_at DESC LIMIT 10',
      employerId
    );
    const assignments = all(
      `SELECT a.*, u.name AS professional_name FROM assignments a
       JOIN professional_profiles p ON p.id = a.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE a.employer_id = ? ORDER BY a.created_at DESC`,
      employerId
    );
    const shortlist = all(
      `SELECT s.*, p.headline, p.rating, p.hourly_rate_paise, p.years_experience, u.name
       FROM shortlists s
       JOIN professional_profiles p ON p.id = s.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE s.employer_id = ? ORDER BY s.created_at DESC LIMIT 10`,
      employerId
    );
    const timesheets = all(
      `SELECT t.*, a.title, a.code, u.name AS professional_name FROM timesheets t
       JOIN assignments a ON a.id = t.assignment_id
       JOIN professional_profiles p ON p.id = t.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE a.employer_id = ? AND t.status = 'submitted'
       ORDER BY t.work_date ASC`,
      employerId
    );
    const interviews = all(
      `SELECT i.*, u.name AS professional_name FROM interviews i
       JOIN professional_profiles p ON p.id = i.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE i.employer_id = ? AND i.status = 'scheduled' AND i.scheduled_at > ?
       ORDER BY i.scheduled_at ASC`,
      employerId,
      nowIso()
    );
    const invoices = all(
      `SELECT i.*, a.title FROM invoices i JOIN assignments a ON a.id = i.assignment_id
       WHERE i.employer_id = ? ORDER BY i.issued_at DESC LIMIT 8`,
      employerId
    );
    const active = assignments.filter((item) => ['active', 'not_started', 'awaiting_approval'].includes(item.status));
    const spend = one(
      "SELECT COALESCE(SUM(total_paise),0) AS total FROM payments WHERE employer_id = ? AND status = 'captured'",
      employerId
    )?.total || 0;
    res.json({
      employer: employerSummary(req.employer),
      stats: {
        openRequirements: requirements.filter((item) => item.status === 'open').length,
        shortlisted: shortlist.length,
        activeAssignments: active.length,
        pendingTimesheets: timesheets.length,
        upcomingInterviews: interviews.length,
        capturedSpendPaise: spend
      },
      requirements: requirements.map((item) => ({ ...item, skills: jsonParse(item.skills, []), workingDays: jsonParse(item.working_days, []) })),
      assignments,
      shortlist: shortlist.map((row) => ({
        ...row,
        workingDays: jsonParse(row.working_days, [])
      })),
      pendingTimesheets: timesheets,
      upcomingInterviews: interviews.map((row) => ({ ...row, panel: jsonParse(row.panel, []) })),
      invoices,
      verification: {
        status: req.employer.verification_status,
        canSearch: true,
        canInterview: req.employer.verification_status === 'verified',
        canHire: req.employer.verification_status === 'verified',
        note:
          req.employer.verification_status === 'verified'
            ? 'Organisation verified. Confidential candidate contact is released only for shortlisted candidates.'
            : 'Verification is pending. You can browse public profiles, but shortlisting, interviewing and hiring require verification.'
      }
    });
  })
);

router.get('/profile', (req, res) => {
  const documents = all(
    'SELECT id, doc_type, filename, mime_type, size_bytes, status, created_at FROM documents WHERE owner_type = ? AND owner_id = ? ORDER BY created_at DESC',
    'employer',
    req.employer.id
  );
  res.json({
    employer: {
      ...employerSummary(req.employer),
      legalName: req.employer.legal_name,
      registrationNumber: req.employer.registration_number,
      registeredAddress: req.employer.registered_address,
      billingAddress: req.employer.billing_address,
      organisationHistory: req.employer.organisation_history,
      verificationNotes: req.employer.verification_notes,
      verifiedAt: req.employer.verified_at
    },
    documents
  });
});

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        industry: z.string().min(2).max(100).optional(),
        companySize: z.string().max(50).optional(),
        website: z.string().url().max(200).optional().or(z.literal('')),
        registeredAddress: z.string().min(5).max(300).optional(),
        city: z.string().min(2).max(80).optional(),
        state: z.string().min(2).max(80).optional(),
        repName: z.string().min(2).max(120).optional(),
        repDesignation: z.string().max(100).optional(),
        billingEmail: z.string().email().max(200).optional(),
        billingAddress: z.string().max(300).optional(),
        organisationHistory: z.string().max(2000).optional()
      }),
      req.body
    );
    const updates = { updated_at: nowIso() };
    const map = {
      industry: 'industry',
      companySize: 'company_size',
      website: 'website',
      registeredAddress: 'registered_address',
      city: 'city',
      state: 'state',
      repName: 'rep_name',
      repDesignation: 'rep_designation',
      billingEmail: 'billing_email',
      billingAddress: 'billing_address',
      organisationHistory: 'organisation_history'
    };
    for (const [key, column] of Object.entries(map)) {
      if (body[key] !== undefined) updates[column] = body[key] || null;
    }
    update('employer_profiles', req.employer.id, updates);
    audit(req, { action: 'employer.profile_updated', entityType: 'employer_profile', entityId: req.employer.id });
    res.json({ ok: true });
  })
);

router.post(
  '/documents',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Choose a document to upload.');
    const error = assertAllowedUpload(req.file);
    if (error) throw unprocessable(error);
    const docType = String(req.body.docType || 'incorporation');
    if (!['incorporation', 'gst_certificate', 'address_proof', 'authorisation_letter', 'other'].includes(docType)) {
      throw badRequest('Unknown document type.');
    }
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
      owner_type: 'employer',
      owner_id: req.employer.id,
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
    audit(req, { action: 'employer.document_uploaded', entityType: 'document', entityId: id });
    res.status(201).json({ ok: true, id, status: 'submitted' });
  })
);

router.get(
  '/documents/:id/download',
  asyncHandler(async (req, res) => {
    const doc = one('SELECT * FROM documents WHERE id = ? AND owner_type = ? AND owner_id = ?', req.params.id, 'employer', req.employer.id);
    if (!doc) throw notFound();
    const buffer = readEncryptedFile(doc.storage_key, doc.iv, doc.auth_tag);
    if (!buffer) throw notFound();
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename.replace(/["\r\n]/g, '')}"`);
    res.send(buffer);
  })
);

// ------------------------------------------------------------------ requirements
router.get(
  '/requirements',
  asyncHandler(async (req, res) => {
    const rows = all('SELECT * FROM job_requirements WHERE employer_id = ? ORDER BY created_at DESC', req.employer.id);
    res.json({
      requirements: rows.map((row) => ({
        ...row,
        skills: jsonParse(row.skills, []),
        workingDays: jsonParse(row.working_days, [])
      }))
    });
  })
);

router.post(
  '/requirements',
  asyncHandler(async (req, res) => {
    ensureVerifiedEmployer(req);
    const body = parse(requirementSchema, req.body);
    const settings = getSettings();
    const availability = validateAvailability(
      {
        days: body.workingDays,
        shiftHours: body.shiftHours,
        startTime: '09:00',
        breaks: [
          { minutes: 15, start: '11:00', end: '11:15' },
          { minutes: 30, start: '13:00', end: '13:30' },
          { minutes: 15, start: '16:00', end: '16:15' }
        ]
      },
      settings
    );
    if (!availability.valid) throw unprocessable('The requested working pattern is not compliant.', availability.errors);
    if (body.hoursPerWeek > body.shiftHours * body.workingDays.length) {
      throw badRequest('Weekly hours cannot exceed shift hours × working days.');
    }
    const id = `req_${crypto.randomUUID()}`;
    const now = nowIso();
    insert('job_requirements', {
      id,
      employer_id: req.employer.id,
      title: body.title,
      category: body.category,
      description: body.description,
      skills: JSON.stringify(body.skills),
      min_experience: body.minExperience,
      hours_per_week: body.hoursPerWeek,
      shift_hours: body.shiftHours,
      working_days: JSON.stringify(body.workingDays),
      start_date: body.startDate,
      duration_weeks: body.durationWeeks,
      budget_hourly_paise: body.budgetHourlyPaise,
      status: body.status,
      created_at: now,
      updated_at: now
    });
    audit(req, { action: 'requirement.created', entityType: 'job_requirement', entityId: id });
    res.status(201).json({ ok: true, id });
  })
);

router.patch(
  '/requirements/:id',
  asyncHandler(async (req, res) => {
    const requirement = one('SELECT * FROM job_requirements WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    if (!requirement) throw notFound();
    const body = parse(
      z.object({
        title: z.string().min(3).max(180).optional(),
        description: z.string().min(20).max(4000).optional(),
        status: z.enum(['draft', 'open', 'paused', 'closed']).optional(),
        budgetHourlyPaise: z.coerce.number().int().min(10000).max(1000000).optional()
      }),
      req.body
    );
    const updates = { updated_at: nowIso() };
    if (body.title) updates.title = body.title;
    if (body.description) updates.description = body.description;
    if (body.status) updates.status = body.status;
    if (body.budgetHourlyPaise) updates.budget_hourly_paise = body.budgetHourlyPaise;
    update('job_requirements', requirement.id, updates);
    audit(req, { action: 'requirement.updated', entityType: 'job_requirement', entityId: requirement.id });
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------------ shortlist
router.get(
  '/shortlist',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT s.id AS shortlist_id, s.note, s.created_at AS shortlisted_at, s.requirement_id,
              p.*, u.name
       FROM shortlists s JOIN professional_profiles p ON p.id = s.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE s.employer_id = ? ORDER BY s.created_at DESC`,
      req.employer.id
    );
    res.json({ shortlist: rows.map((row) => ({ ...professionalCard(row), shortlistId: row.shortlist_id, note: row.note })) });
  })
);

router.post(
  '/shortlist',
  asyncHandler(async (req, res) => {
    ensureVerifiedEmployer(req);
    const body = parse(
      z.object({
        professionalId: z.string().min(1),
        requirementId: z.string().optional().nullable(),
        note: z.string().max(500).optional()
      }),
      req.body
    );
    const professional = one("SELECT * FROM professional_profiles WHERE id = ? AND is_public = 1 AND assessment_status = 'passed'", body.professionalId);
    if (!professional) throw notFound('Professional is not available for shortlisting.');
    if (one('SELECT id FROM shortlists WHERE employer_id = ? AND professional_id = ? AND IFNULL(requirement_id, \'\') = ?', req.employer.id, body.professionalId, body.requirementId || '')) {
      throw conflict('This professional is already on your shortlist.');
    }
    const id = `sl_${crypto.randomUUID()}`;
    insert('shortlists', {
      id,
      employer_id: req.employer.id,
      professional_id: body.professionalId,
      requirement_id: body.requirementId || null,
      note: body.note || null,
      created_at: nowIso()
    });
    audit(req, { action: 'candidate.shortlisted', entityType: 'shortlist', entityId: id, meta: { professionalId: body.professionalId } });
    res.status(201).json({ ok: true, id });
  })
);

router.delete(
  '/shortlist/:id',
  asyncHandler(async (req, res) => {
    run('DELETE FROM shortlists WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    audit(req, { action: 'candidate.shortlist_removed', entityType: 'shortlist', entityId: req.params.id });
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------------ interviews
router.get(
  '/interviews',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT i.*, u.name AS professional_name, r.title AS requirement_title
       FROM interviews i JOIN professional_profiles p ON p.id = i.professional_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN job_requirements r ON r.id = i.requirement_id
       WHERE i.employer_id = ? ORDER BY i.scheduled_at DESC`,
      req.employer.id
    );
    const scorecards = all(
      `SELECT sc.* FROM scorecards sc JOIN interviews i ON i.id = sc.interview_id WHERE i.employer_id = ?`,
      req.employer.id
    );
    res.json({
      interviews: rows.map((row) => ({
        ...row,
        panel: jsonParse(row.panel, []),
        scorecards: scorecards.filter((sc) => sc.interview_id === row.id).map((sc) => ({ ...sc, scores: jsonParse(sc.scores, {}) }))
      }))
    });
  })
);

router.post(
  '/interviews',
  asyncHandler(async (req, res) => {
    ensureVerifiedEmployer(req);
    const body = parse(
      z.object({
        professionalId: z.string().min(1),
        requirementId: z.string().optional().nullable(),
        round: z.coerce.number().int().min(1).max(2),
        scheduledAt: z.string().datetime({ offset: true }),
        durationMinutes: z.coerce.number().int().min(20).max(120).default(45),
        panel: z.array(z.object({ name: z.string().min(2).max(120), role: z.string().max(120).optional() })).min(1).max(5),
        notes: z.string().max(1000).optional()
      }),
      req.body
    );
    const settings = getSettings();
    if (body.round > settings.max_interview_rounds) throw badRequest(`A maximum of ${settings.max_interview_rounds} interview rounds is permitted.`);
    const professional = professionalForId(body.professionalId);
    if (!professional || !professional.is_public) throw notFound('Professional is not available.');
    if (!isShortlisted(req.employer.id, professional.id)) {
      throw forbidden('Shortlist the professional before scheduling an interview.');
    }
    const existing = all(
      'SELECT * FROM interviews WHERE employer_id = ? AND professional_id = ? ORDER BY round',
      req.employer.id,
      professional.id
    );
    if (existing.some((interview) => interview.round === body.round)) {
      throw conflict(`Round ${body.round} is already scheduled for this candidate.`);
    }
    if (body.round === 2) {
      const round1 = existing.find((interview) => interview.round === 1);
      if (!round1 || round1.status !== 'completed') throw conflict('Round 1 must be completed before scheduling the final round.');
      const scorecard = one('SELECT id FROM scorecards WHERE interview_id = ? LIMIT 1', round1.id);
      if (!scorecard) throw conflict('Submit the Round 1 scorecard before scheduling the final round.');
    }
    const start = new Date(body.scheduledAt).getTime();
    const end = start + body.durationMinutes * 60_000;
    const candidateClash = all(
      "SELECT * FROM interviews WHERE professional_id = ? AND status = 'scheduled'",
      professional.id
    ).find((interview) => {
      const otherStart = new Date(interview.scheduled_at).getTime();
      const otherEnd = otherStart + interview.duration_minutes * 60_000;
      return start < otherEnd && otherStart < end;
    });
    if (candidateClash) throw conflict('The candidate already has an interview at that time.');
    const employerClash = all(
      "SELECT * FROM interviews WHERE employer_id = ? AND status = 'scheduled'",
      req.employer.id
    ).find((interview) => {
      const otherStart = new Date(interview.scheduled_at).getTime();
      const otherEnd = otherStart + interview.duration_minutes * 60_000;
      return start < otherEnd && otherStart < end;
    });
    if (employerClash) throw conflict('Your panel already has an interview at that time.');

    const id = `int_${crypto.randomUUID()}`;
    insert('interviews', {
      id,
      employer_id: req.employer.id,
      professional_id: professional.id,
      requirement_id: body.requirementId || null,
      round: body.round,
      scheduled_at: body.scheduledAt,
      duration_minutes: body.durationMinutes,
      mode: 'video',
      meeting_url: `https://meet.flamingo.work/${id.slice(4, 12)}`,
      panel: JSON.stringify(body.panel),
      status: 'scheduled',
      notes: body.notes || null,
      outcome: null,
      created_by: req.user.id,
      created_at: nowIso()
    });
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: professional.user_id,
      type: 'interview',
      title: `Round ${body.round} interview scheduled`,
      body: `${req.employer.org_name} has scheduled a ${body.durationMinutes}-minute video interview.`,
      link: '/interview-scheduler',
      read_at: null,
      created_at: nowIso()
    });
    audit(req, { action: 'interview.scheduled', entityType: 'interview', entityId: id, meta: { round: body.round } });
    res.status(201).json({ ok: true, id, round: body.round, meetingUrl: `https://meet.flamingo.work/${id.slice(4, 12)}` });
  })
);

router.post(
  '/interviews/:id/scorecard',
  asyncHandler(async (req, res) => {
    const interview = one('SELECT * FROM interviews WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    if (!interview) throw notFound();
    const body = parse(
      z.object({
        panelName: z.string().min(2).max(120),
        scores: z.record(z.coerce.number().min(0).max(10)),
        notes: z.string().max(2000).optional(),
        recommendation: z.enum(['strong_yes', 'yes', 'no', 'strong_no'])
      }),
      req.body
    );
    if (!Object.keys(body.scores).length) throw badRequest('Enter scores for at least one criterion.');
    const values = Object.values(body.scores);
    const total = Math.round((values.reduce((sum, score) => sum + score, 0) / values.length) * 10);
    const id = `sc_${crypto.randomUUID()}`;
    insert('scorecards', {
      id,
      interview_id: interview.id,
      panel_user_id: req.user.id,
      panel_name: body.panelName,
      scores: JSON.stringify(body.scores),
      total_score: total,
      recommendation: body.recommendation,
      notes: body.notes || null,
      submitted_at: nowIso()
    });
    audit(req, { action: 'interview.scorecard_submitted', entityType: 'interview', entityId: interview.id });
    res.status(201).json({ ok: true, id, totalScore: total });
  })
);

router.post(
  '/interviews/:id/outcome',
  asyncHandler(async (req, res) => {
    const interview = one('SELECT * FROM interviews WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    if (!interview) throw notFound();
    const body = parse(
      z.object({
        outcome: z.enum(['advanced', 'selected', 'rejected', 'no_show']),
        notes: z.string().max(2000).optional()
      }),
      req.body
    );
    if (body.outcome === 'selected' && interview.round !== 2) {
      throw badRequest('Selection can only be recorded after the final round.');
    }
    if (interview.round === 2 && body.outcome === 'advanced') {
      throw badRequest('There is no third round. Record selected or rejected.');
    }
    const now = nowIso();
    run(
      "UPDATE interviews SET status = 'completed', outcome = ?, notes = COALESCE(?, notes) WHERE id = ?",
      body.outcome,
      body.notes || null,
      interview.id
    );
    const professional = one('SELECT * FROM professional_profiles WHERE id = ?', interview.professional_id);
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: professional.user_id,
      type: 'interview',
      title: body.outcome === 'rejected' ? 'Interview outcome' : 'Interview outcome published',
      body:
        body.outcome === 'rejected'
          ? `${req.employer.org_name} has completed the process. You can request feedback through support.`
          : `${req.employer.org_name} recorded: ${body.outcome.replace('_', ' ')}.`,
      link: '/interview-scheduler',
      read_at: null,
      created_at: now
    });
    audit(req, { action: 'interview.outcome', entityType: 'interview', entityId: interview.id, meta: { outcome: body.outcome } });
    res.json({ ok: true, outcome: body.outcome });
  })
);

// ------------------------------------------------------------------ hire & assignments
router.post(
  '/assignments',
  asyncHandler(async (req, res) => {
    ensureVerifiedEmployer(req);
    const body = parse(
      z.object({
        professionalId: z.string().min(1),
        requirementId: z.string().optional().nullable(),
        title: z.string().min(3).max(180),
        description: z.string().max(3000).optional(),
        scope: z.string().min(20).max(3000),
        hourlyRatePaise: z.coerce.number().int().min(10000).max(1000000),
        hoursPerWeek: z.coerce.number().int().min(4).max(48),
        shiftHours: z.coerce.number().int(),
        workingDays: z.array(z.enum(['TUE', 'WED', 'THU', 'FRI', 'SAT'])).min(1).max(4),
        dailyStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('09:00'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        weeks: z.coerce.number().int().min(1).max(52),
        reportingManager: z.string().min(2).max(160),
        deliverables: z.string().min(10).max(3000),
        paymentTerms: z.string().max(1000).optional(),
        cancellationTerms: z.string().max(1000).optional(),
        disputeTerms: z.string().max(1000).optional()
      }),
      req.body
    );
    const settings = getSettings();
    const professional = professionalForId(body.professionalId);
    if (!professional) throw notFound('Professional not found.');
    if (!professional.is_public || professional.assessment_status !== 'passed' || professional.verification_status !== 'verified') {
      throw forbidden('The professional must be verified, assessed and publicly available before hiring.');
    }
    if (!isShortlisted(req.employer.id, professional.id)) {
      throw forbidden('Shortlist and interview the professional before creating an assignment.');
    }
    const interview = one(
      "SELECT * FROM interviews WHERE employer_id = ? AND professional_id = ? AND round = 2 AND status = 'completed' AND outcome = 'selected'",
      req.employer.id,
      professional.id
    );
    if (!interview) throw forbidden('A completed final interview with a “selected” outcome is required before hiring.');

    const availability = validateAvailability(
      {
        days: body.workingDays,
        shiftHours: body.shiftHours,
        startTime: body.dailyStart,
        breaks: [
          { minutes: 15, start: '11:00', end: '11:15' },
          { minutes: 30, start: '13:00', end: '13:30' },
          { minutes: 15, start: '16:00', end: '16:15' }
        ]
      },
      settings
    );
    if (!availability.valid) throw unprocessable('Working pattern is not compliant.', availability.errors);

    const benchmark = one(
      'SELECT * FROM rate_benchmarks WHERE category = ? AND level = ?',
      professional.category,
      levelForExperience(professional.years_experience)
    );
    if (benchmark) {
      const min = Math.min(benchmark.min_hourly_paise, professional.hourly_rate_paise || benchmark.min_hourly_paise);
      if (body.hourlyRatePaise < min || body.hourlyRatePaise > benchmark.max_hourly_paise) {
        throw unprocessable('Rate is outside the sourced market range for this category.', {
          minHourlyPaise: min,
          maxHourlyPaise: benchmark.max_hourly_paise,
          source: benchmark.source_name
        });
      }
    }

    const existingAssignments = all(
      `SELECT id, code, title, working_days, shift_hours, daily_start FROM assignments
       WHERE professional_id = ? AND status IN ('active','not_started','awaiting_approval')`,
      professional.id
    ).map((item) => ({ ...item, working_days: jsonParse(item.working_days, []) }));
    const conflicts = validateAssignmentSchedule({
      workingDays: body.workingDays,
      shiftHours: body.shiftHours,
      dailyStart: body.dailyStart,
      existingAssignments,
      settings
    });
    if (!conflicts.valid) throw unprocessable('The professional has a scheduling conflict.', conflicts.errors);

    const id = `asg_${crypto.randomUUID()}`;
    const now = nowIso();
    const totalValue = body.hourlyRatePaise * body.hoursPerWeek * body.weeks;
    const code = `FLM-ASG-${String((one('SELECT COUNT(*) AS count FROM assignments')?.count || 0) + 1).padStart(4, '0')}`;
    insert('assignments', {
      id,
      code,
      employer_id: req.employer.id,
      professional_id: professional.id,
      requirement_id: body.requirementId || null,
      title: body.title,
      description: body.description || null,
      scope: body.scope,
      category: professional.category,
      hourly_rate_paise: body.hourlyRatePaise,
      hours_per_week: body.hoursPerWeek,
      shift_hours: body.shiftHours,
      working_days: JSON.stringify(body.workingDays),
      daily_start: body.dailyStart,
      start_date: body.startDate,
      end_date: new Date(new Date(`${body.startDate}T00:00:00Z`).getTime() + body.weeks * 7 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      deliverables: body.deliverables,
      reporting_manager: body.reportingManager,
      payment_terms: body.paymentTerms || '50% advance on signature; 50% after completion and formal release.',
      cancellation_terms:
        body.cancellationTerms || 'Either party may cancel with 7 days written notice. Work completed remains payable.',
      dispute_terms: body.disputeTerms || 'Raise a dispute in the Financial Centre within 10 days of the disputed event.',
      break_schedule: JSON.stringify([
        { label: 'Morning break', minutes: 15, start: '11:00', end: '11:15' },
        { label: 'Lunch', minutes: 30, start: '13:00', end: '13:30' },
        { label: 'Afternoon break', minutes: 15, start: '16:00', end: '16:15' }
      ]),
      estimated_hours: body.hoursPerWeek * body.weeks,
      total_value_paise: totalValue,
      status: 'not_started',
      contract_signed_professional: 0,
      contract_signed_employer: 1,
      activation_fee_charged: 0,
      created_at: now,
      updated_at: now
    });
    const fee = activationFee(settings);
    insert('activation_fees', {
      id: `act_${crypto.randomUUID()}`,
      professional_id: professional.id,
      assignment_id: id,
      amount_paise: fee.grossPaise,
      base_paise: fee.basePaise,
      gst_paise: fee.gstPaise,
      payout_id: null,
      status: 'pending',
      disclosed_at: now,
      charged_at: null
    });
    insert('assignment_events', {
      id: `ae_${crypto.randomUUID()}`,
      assignment_id: id,
      event_type: 'created',
      actor_id: req.user.id,
      note: 'Assignment contract generated. ₹699 activation fee disclosed to the professional.',
      created_at: now
    });
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: professional.user_id,
      type: 'assignment',
      title: 'New assignment offer',
      body: `${req.employer.org_name} has offered you “${body.title}”. Review the contract and the ₹699 activation-fee disclosure before accepting.`,
      link: '/assignment-management',
      read_at: null,
      created_at: now
    });
    audit(req, { action: 'assignment.created', entityType: 'assignment', entityId: id, meta: { totalValue, professionalId: professional.id } });
    res.status(201).json({
      ok: true,
      assignmentId: id,
      code,
      totalValuePaise: totalValue,
      paymentPlan: paymentPlan(totalValue, settings.advance_percent),
      activationFeeDisclosure: '₹699 is deducted once from the professional’s first payout for this assignment.'
    });
  })
);

router.post(
  '/assignments/:id/sign',
  asyncHandler(async (req, res) => {
    const assignment = one('SELECT * FROM assignments WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    if (!assignment) throw notFound();
    run('UPDATE assignments SET contract_signed_employer = 1, updated_at = ? WHERE id = ?', nowIso(), assignment.id);
    audit(req, { action: 'assignment.employer_signed', entityType: 'assignment', entityId: assignment.id });
    res.json({ ok: true });
  })
);

router.get(
  '/assignments',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT a.*, u.name AS professional_name, p.headline FROM assignments a
       JOIN professional_profiles p ON p.id = a.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE a.employer_id = ? ORDER BY a.created_at DESC`,
      req.employer.id
    );
    res.json({ assignments: rows });
  })
);

router.get(
  '/assignments/:id',
  asyncHandler(async (req, res) => {
    const assignment = one(
      `SELECT a.*, u.name AS professional_name, p.headline FROM assignments a
       JOIN professional_profiles p ON p.id = a.professional_id JOIN users u ON u.id = p.user_id
       WHERE a.id = ? AND a.employer_id = ?`,
      req.params.id,
      req.employer.id
    );
    if (!assignment) throw notFound();
    const professional = professionalPublicProfile(assignment.professional_id, { includeContact: true });
    const timesheets = all('SELECT * FROM timesheets WHERE assignment_id = ? ORDER BY work_date DESC', assignment.id);
    const invoices = all('SELECT * FROM invoices WHERE assignment_id = ? ORDER BY issued_at', assignment.id);
    const payments = all('SELECT * FROM payments WHERE assignment_id = ? ORDER BY created_at', assignment.id);
    const payouts = all('SELECT * FROM payouts WHERE assignment_id = ? ORDER BY created_at', assignment.id);
    const activation = one('SELECT * FROM activation_fees WHERE assignment_id = ?', assignment.id);
    const review = one('SELECT * FROM reviews WHERE assignment_id = ?', assignment.id);
    const events = all('SELECT * FROM assignment_events WHERE assignment_id = ? ORDER BY created_at', assignment.id);
    res.json({
      assignment: {
        ...assignment,
        working_days: jsonParse(assignment.working_days, []),
        break_schedule: jsonParse(assignment.break_schedule, [])
      },
      professional,
      timesheets,
      invoices,
      payments,
      payouts,
      activationFee: activation,
      review,
      events
    });
  })
);

router.post(
  '/assignments/:id/approve-completion',
  asyncHandler(async (req, res) => {
    const assignment = one('SELECT * FROM assignments WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    if (!assignment) throw notFound();
    if (!['active', 'awaiting_approval'].includes(assignment.status)) throw conflict('This assignment is not awaiting completion approval.');
    const now = nowIso();
    run("UPDATE assignments SET status = 'completed', updated_at = ? WHERE id = ?", now, assignment.id);
    insert('assignment_events', {
      id: `ae_${crypto.randomUUID()}`,
      assignment_id: assignment.id,
      event_type: 'completion_approved',
      actor_id: req.user.id,
      note: 'Employer approved completion. Final payment may now be released.',
      created_at: now
    });
    audit(req, { action: 'assignment.completion_approved', entityType: 'assignment', entityId: assignment.id });
    res.json({ ok: true, status: 'completed', next: 'Final 50% payment is now available in the Financial Centre.' });
  })
);

// ------------------------------------------------------------------ timesheets
router.get(
  '/timesheets',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT t.*, a.title, a.code, u.name AS professional_name FROM timesheets t
       JOIN assignments a ON a.id = t.assignment_id
       JOIN professional_profiles p ON p.id = t.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE a.employer_id = ? ORDER BY t.work_date DESC LIMIT 100`,
      req.employer.id
    );
    res.json({ timesheets: rows });
  })
);

router.post(
  '/timesheets/:id/approve',
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ note: z.string().max(500).optional() }), req.body);
    const row = one(
      `SELECT t.*, a.employer_id FROM timesheets t JOIN assignments a ON a.id = t.assignment_id
       WHERE t.id = ? AND a.employer_id = ?`,
      req.params.id,
      req.employer.id
    );
    if (!row) throw notFound();
    if (row.status !== 'submitted') throw conflict('Only submitted timesheets can be approved.');
    const now = nowIso();
    run(
      "UPDATE timesheets SET status = 'approved', approved_by = ?, approved_at = ?, approval_note = ? WHERE id = ?",
      req.user.id,
      now,
      body.note || 'Approved against agreed deliverables.',
      row.id
    );
    audit(req, { action: 'timesheet.approved', entityType: 'timesheet', entityId: row.id });
    res.json({ ok: true });
  })
);

router.post(
  '/timesheets/:id/reject',
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ note: z.string().min(5).max(500) }), req.body);
    const row = one(
      `SELECT t.* FROM timesheets t JOIN assignments a ON a.id = t.assignment_id
       WHERE t.id = ? AND a.employer_id = ?`,
      req.params.id,
      req.employer.id
    );
    if (!row) throw notFound();
    run(
      "UPDATE timesheets SET status = 'rejected', approved_by = ?, approved_at = ?, approval_note = ? WHERE id = ?",
      req.user.id,
      nowIso(),
      body.note,
      row.id
    );
    audit(req, { action: 'timesheet.rejected', entityType: 'timesheet', entityId: row.id, meta: { note: body.note } });
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------------ payments
router.post(
  '/assignments/:id/pay',
  asyncHandler(async (req, res) => {
    ensureVerifiedEmployer(req);
    const body = parse(z.object({ type: z.enum(['advance', 'final']) }), req.body);
    const assignment = one('SELECT * FROM assignments WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    if (!assignment) throw notFound();
    if (!assignment.contract_signed_employer || !assignment.contract_signed_professional) {
      throw conflict('Both parties must accept the digital contract before payment.');
    }
    if (body.type === 'advance' && assignment.activation_fee_charged) {
      throw conflict('The advance has already been funded for this assignment.');
    }
    if (body.type === 'final') {
      if (assignment.status !== 'completed') throw conflict('Final payment is released only after completion is approved.');
      if (!one('SELECT id FROM payments WHERE assignment_id = ? AND type = ?', assignment.id, 'advance')) {
        throw conflict('The 50% advance must be captured before the final payment.');
      }
    }
    if (one('SELECT id FROM payments WHERE assignment_id = ? AND type = ?', assignment.id, body.type)) {
      throw conflict('This payment has already been captured.');
    }
    const settings = getSettings();
    const plan = paymentPlan(assignment.total_value_paise, settings.advance_percent);
    const charges = body.type === 'advance' ? plan.advancePaise : plan.finalPaise;
    const invoice = employerInvoice({
      professionalChargesPaise: charges,
      platformFeeBps: settings.platform_fee_bps,
      gstRateBps: settings.gst_rate_bps
    });
    const now = nowIso();
    const invoiceId = `inv_${crypto.randomUUID()}`;
    const paymentId = `pay_${crypto.randomUUID()}`;
    const seq = invoiceSeq();
    insert('invoices', {
      id: invoiceId,
      invoice_no: `FLM-${new Date().getFullYear()}-${body.type === 'advance' ? 'ADV' : 'FIN'}-${String(seq).padStart(4, '0')}`,
      assignment_id: assignment.id,
      employer_id: req.employer.id,
      type: body.type,
      professional_charges_paise: invoice.professionalChargesPaise,
      platform_fee_paise: invoice.platformFeePaise,
      gst_paise: invoice.gstPaise,
      other_charges_paise: 0,
      total_paise: invoice.totalPaise,
      status: 'paid',
      issued_at: now,
      due_at: now,
      paid_at: now,
      notes: 'Simulated payment gateway capture. Production requires an RBI-authorised payment aggregator.'
    });
    insert('payments', {
      id: paymentId,
      payment_ref: `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      invoice_id: invoiceId,
      assignment_id: assignment.id,
      employer_id: req.employer.id,
      type: body.type,
      amount_paise: invoice.professionalChargesPaise,
      platform_fee_paise: invoice.platformFeePaise,
      gst_paise: invoice.gstPaise,
      total_paise: invoice.totalPaise,
      gateway: 'simulated',
      gateway_ref: `SIM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
      status: 'captured',
      created_at: now,
      captured_at: now,
      refunded_paise: 0
    });
    const group = `grp_${paymentId}`;
    recordLedger(
      ledgerForInvoiceCapture({ invoice, groupId: group, description: `${body.type} invoice captured` }),
      'payment',
      paymentId,
      now
    );

    let payout = null;
    let activation = null;
    if (body.type === 'advance') {
      const feeRow = one('SELECT * FROM activation_fees WHERE assignment_id = ?', assignment.id);
      activation = feeRow ? activationFee(settings, feeRow.amount_paise) : activationFee(settings);
      const payoutResult = computePayout({
        grossPaise: charges,
        activationFeePaise: activation.grossPaise,
        alreadyCharged: false,
        tdsApplicable: false
      });
      const payoutId = `po_${crypto.randomUUID()}`;
      insert('payouts', {
        id: payoutId,
        payout_ref: `PO-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`,
        assignment_id: assignment.id,
        professional_id: assignment.professional_id,
        type: 'advance',
        gross_paise: payoutResult.grossPaise,
        activation_fee_paise: payoutResult.activationFeePaise,
        tds_paise: 0,
        net_paise: payoutResult.netPaise,
        status: 'processing',
        method: 'simulated_imps',
        created_at: now,
        paid_at: null
      });
      payout = payoutResult;
      recordLedger(
        ledgerForActivation({ fee: activation, groupId: `grp_${payoutId}_activation` }),
        'activation_fee',
        feeRow?.id || payoutId,
        now
      );
      recordLedger(
        ledgerForPayout({
          payout: { netPaise: payoutResult.netPaise, tdsPaise: 0 },
          groupId: `grp_${payoutId}_payout`
        }),
        'payout',
        payoutId,
        now
      );
      if (feeRow) {
        run(
          "UPDATE activation_fees SET status = 'deducted', charged_at = ?, payout_id = ? WHERE id = ?",
          now,
          payoutId,
          feeRow.id
        );
      }
      run('UPDATE assignments SET activation_fee_charged = 1, status = ?, updated_at = ? WHERE id = ?', assignment.status === 'not_started' ? 'active' : assignment.status, now, assignment.id);
    } else {
      const payoutResult = computePayout({ grossPaise: charges, alreadyCharged: true });
      const payoutId = `po_${crypto.randomUUID()}`;
      insert('payouts', {
        id: payoutId,
        payout_ref: `PO-${new Date().getFullYear()}-${String(seq + 1).padStart(5, '0')}`,
        assignment_id: assignment.id,
        professional_id: assignment.professional_id,
        type: 'final',
        gross_paise: payoutResult.grossPaise,
        activation_fee_paise: 0,
        tds_paise: 0,
        net_paise: payoutResult.netPaise,
        status: 'processing',
        method: 'simulated_imps',
        created_at: now,
        paid_at: null
      });
      recordLedger(
        ledgerForPayout({ payout: { netPaise: payoutResult.netPaise, tdsPaise: 0 }, groupId: `grp_${payoutId}_payout` }),
        'payout',
        payoutId,
        now
      );
      run("UPDATE assignments SET status = 'completed', updated_at = ? WHERE id = ?", now, assignment.id);
      run(
        'UPDATE professional_profiles SET completed_assignments = completed_assignments + 1, updated_at = ? WHERE id = ?',
        now,
        assignment.professional_id
      );
      payout = payoutResult;
    }
    insert('assignment_events', {
      id: `ae_${crypto.randomUUID()}`,
      assignment_id: assignment.id,
      event_type: body.type === 'advance' ? 'payment_captured' : 'final_payment_captured',
      actor_id: req.user.id,
      note: `${body.type === 'advance' ? '50% advance' : 'Final 50%'} captured (simulated gateway)`,
      created_at: now
    });
    audit(req, {
      action: 'payment.captured',
      entityType: 'payment',
      entityId: paymentId,
      meta: { type: body.type, totalPaise: invoice.totalPaise, activationDeducted: body.type === 'advance' ? activation.grossPaise : 0 }
    });
    res.status(201).json({
      ok: true,
      invoice: { id: invoiceId, lines: invoice.lines, totalPaise: invoice.totalPaise, invoiceNo: `FLM-${new Date().getFullYear()}-${body.type.toUpperCase()}-${String(seq).padStart(4, '0')}` },
      payment: { id: paymentId, status: 'captured', gateway: 'simulated' },
      payout,
      activationFee: body.type === 'advance' ? { deductedPaise: activation.grossPaise, netPayoutPaise: payout.netPaise } : null,
      message:
        body.type === 'advance'
          ? `Advance captured. ₹${(activation.grossPaise / 100).toLocaleString('en-IN')} activation fee deducted from the professional’s first payout; net payout ₹${(payout.netPaise / 100).toLocaleString('en-IN')}.`
          : 'Final payment captured. Payout scheduled for the next settlement cycle.'
    });
  })
);

router.get(
  '/finance',
  asyncHandler(async (req, res) => {
    const invoices = all(
      `SELECT i.*, a.code, a.title FROM invoices i JOIN assignments a ON a.id = i.assignment_id
       WHERE i.employer_id = ? ORDER BY i.issued_at DESC`,
      req.employer.id
    );
    const payments = all(
      'SELECT * FROM payments WHERE employer_id = ? ORDER BY created_at DESC',
      req.employer.id
    );
    const totals = {
      invoicedPaise: invoices.reduce((sum, invoice) => sum + invoice.total_paise, 0),
      paidPaise: payments.filter((payment) => payment.status === 'captured').reduce((sum, payment) => sum + payment.total_paise, 0),
      gstPaise: invoices.reduce((sum, invoice) => sum + invoice.gst_paise, 0),
      platformFeePaise: invoices.reduce((sum, invoice) => sum + invoice.platform_fee_paise, 0)
    };
    res.json({
      invoices,
      payments,
      totals,
      gatewayNotice:
        'Demonstration gateway: no live funds move. In production, payments must be collected and settled through an RBI-authorised payment aggregator using its designated escrow arrangements.'
    });
  })
);

router.get(
  '/invoices/:id',
  asyncHandler(async (req, res) => {
    const invoice = one('SELECT * FROM invoices WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    if (!invoice) throw notFound();
    const assignment = one('SELECT * FROM assignments WHERE id = ?', invoice.assignment_id);
    const employer = req.employer;
    res.json({
      invoice,
      assignment,
      employer: employerSummary(employer),
      lines: [
        { label: 'Professional assignment charges', amountPaise: invoice.professional_charges_paise },
        { label: 'FLAMINGO platform fee', amountPaise: invoice.platform_fee_paise },
        { label: 'GST on platform fee', amountPaise: invoice.gst_paise },
        { label: 'Other disclosed charges', amountPaise: invoice.other_charges_paise }
      ],
      totalPaise: invoice.total_paise
    });
  })
);

// ------------------------------------------------------------------ performance reviews
router.post(
  '/assignments/:id/review',
  asyncHandler(async (req, res) => {
    const assignment = one('SELECT * FROM assignments WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
    if (!assignment) throw notFound();
    if (assignment.status !== 'completed') throw conflict('A performance review requires a completed assignment.');
    if (one('SELECT id FROM reviews WHERE assignment_id = ?', assignment.id)) throw conflict('A review already exists for this assignment.');
    const body = parse(
      z.object({
        scores: z.object({
          quality: z.coerce.number().min(0).max(10),
          timeliness: z.coerce.number().min(0).max(10),
          technical: z.coerce.number().min(0).max(10),
          conduct: z.coerce.number().min(0).max(10),
          communication: z.coerce.number().min(0).max(10),
          reliability: z.coerce.number().min(0).max(10)
        }),
        strengths: z.string().min(10).max(2000),
        improvements: z.string().min(10).max(2000),
        responsibilities: z.string().min(10).max(2000),
        rehire: z.boolean(),
        managerName: z.string().min(2).max(120).optional()
      }),
      req.body
    );
    const result = scoreReview(body.scores);
    if (!result.valid) throw unprocessable('Review scores are invalid.', result.errors);
    const id = `rev_${crypto.randomUUID()}`;
    const now = nowIso();
    insert('reviews', {
      id,
      assignment_id: assignment.id,
      employer_id: req.employer.id,
      professional_id: assignment.professional_id,
      manager_user_id: req.user.id,
      scores: JSON.stringify(body.scores),
      total_score: result.total,
      strengths: body.strengths,
      improvements: body.improvements,
      responsibilities: body.responsibilities,
      overall_rating: result.band,
      rehire: body.rehire ? 1 : 0,
      status: 'published',
      submitted_at: now,
      professional_response: null,
      response_at: null,
      resolution: null,
      resolution_at: null
    });
    const published = all(
      "SELECT total_score FROM reviews WHERE professional_id = ? AND status IN ('published','upheld','revised')",
      assignment.professional_id
    );
    const average = averageRating(published);
    const rehireRate = Math.round(
      (published.filter((review) => review.rehire === 1).length / published.length) * 100
    );
    run(
      'UPDATE professional_profiles SET rating = ?, rehire_rate = ?, updated_at = ? WHERE id = ?',
      average,
      rehireRate,
      now,
      assignment.professional_id
    );
    run("UPDATE assignments SET status = 'closed', updated_at = ? WHERE id = ?", now, assignment.id);
    insert('assignment_events', {
      id: `ae_${crypto.randomUUID()}`,
      assignment_id: assignment.id,
      event_type: 'review_published',
      actor_id: req.user.id,
      note: `Performance review published: ${result.total}/100`,
      created_at: now
    });
    const professional = one('SELECT * FROM professional_profiles WHERE id = ?', assignment.professional_id);
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: professional.user_id,
      type: 'review',
      title: 'Performance review published',
      body: `${req.employer.org_name} rated the completed assignment ${result.total}/100. You can respond or challenge inaccurate feedback.`,
      link: '/career-record',
      read_at: null,
      created_at: now
    });
    audit(req, { action: 'review.published', entityType: 'review', entityId: id, meta: { total: result.total } });
    res.status(201).json({ ok: true, id, totalScore: result.total, band: result.band, rating: average });
  })
);

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT r.*, u.name AS professional_name, a.code, a.title
       FROM reviews r JOIN professional_profiles p ON p.id = r.professional_id
       JOIN users u ON u.id = p.user_id JOIN assignments a ON a.id = r.assignment_id
       WHERE r.employer_id = ? ORDER BY r.submitted_at DESC`,
      req.employer.id
    );
    res.json({ reviews: rows.map((row) => ({ ...row, scores: jsonParse(row.scores, {}) })) });
  })
);

export default router;
