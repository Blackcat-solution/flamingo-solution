import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { config } from '../config.js';
import {
  all,
  one,
  run,
  insert,
  update,
  jsonParse,
  getSettings,
  setSetting,
  nowIso
} from '../db.js';
import {
  requireAuth,
  requireRole,
  requireAdminPermission,
  verifyCsrf,
  adminPermissionsFor
} from '../lib/auth.js';
import { asyncHandler, audit, pagination } from '../lib/http.js';
import { badRequest, conflict, forbidden, mfaEnrollmentRequired, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { readEncryptedFile } from '../lib/storage.js';
import { professionalDetail } from '../lib/data.js';
import { ratingBand } from '../domain/performance.js';
import { scoreObjective } from '../domain/assessment.js';

const router = Router();
router.use(requireAuth, requireRole('admin'), verifyCsrf);
router.use((req, _res, next) => {
  req.dbUser = one('SELECT * FROM users WHERE id = ?', req.user.id);
  req.permissions = adminPermissionsFor(req.user.adminRole);
  if (config.adminMfaEnforced && !req.dbUser.mfa_enabled) {
    return next(mfaEnrollmentRequired());
  }
  next();
});

const can = (req, permission) =>
  req.permissions.includes('*') || req.permissions.includes(permission);

const paginated = (rows, total, page, limit) => ({
  rows,
  pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
});

function decisionSchema() {
  return z.object({
    decision: z.enum(['approve', 'reject']),
    notes: z.string().max(2000).optional()
  });
}

// ------------------------------------------------------------------ dashboard
router.get(
  '/dashboard',
  requireAdminPermission('users.view'),
  asyncHandler(async (req, res) => {
    const pendingProfessionals = one(
      "SELECT COUNT(*) AS count FROM professional_profiles WHERE verification_status IN ('pending','in_review')"
    )?.count || 0;
    const pendingEmployers = one(
      "SELECT COUNT(*) AS count FROM employer_profiles WHERE verification_status IN ('pending','in_review')"
    )?.count || 0;
    const assessmentQueue = one(
      "SELECT COUNT(*) AS count FROM assessment_attempts WHERE status = 'human_review'"
    )?.count || 0;
    const openDisputes = one("SELECT COUNT(*) AS count FROM disputes WHERE status IN ('open','investigating')")?.count || 0;
    const activeAssignments = one(
      "SELECT COUNT(*) AS count FROM assignments WHERE status IN ('active','not_started','awaiting_approval')"
    )?.count || 0;
    const captured = one(
      "SELECT COALESCE(SUM(total_paise),0) AS total FROM payments WHERE status = 'captured'"
    )?.total || 0;
    const activationRevenue = one(
      "SELECT COALESCE(SUM(base_paise),0) AS total FROM activation_fees WHERE status = 'deducted'"
    )?.total || 0;
    const pendingPayouts = one(
      "SELECT COALESCE(SUM(net_paise),0) AS total FROM payouts WHERE status IN ('pending','processing')"
    )?.total || 0;

    const verificationQueue = all(
      `SELECT p.id, p.headline, p.category, p.verification_status, p.identity_status,
              p.years_experience, p.created_at, u.name
       FROM professional_profiles p JOIN users u ON u.id = p.user_id
       WHERE p.verification_status IN ('pending','in_review')
       ORDER BY p.created_at ASC LIMIT 6`
    );
    const employerQueue = all(
      `SELECT e.id, e.org_name, e.city, e.verification_status, e.created_at, u.name
       FROM employer_profiles e JOIN users u ON u.id = e.user_id
       WHERE e.verification_status IN ('pending','in_review')
       ORDER BY e.created_at ASC LIMIT 6`
    );
    const reviewQueue = all(
      `SELECT a.id, a.status, a.auto_score, a.integrity_score, a.submitted_at, s.title,
              u.name AS professional_name
       FROM assessment_attempts a
       JOIN assessments s ON s.id = a.assessment_id
       JOIN professional_profiles p ON p.id = a.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE a.status = 'human_review'
       ORDER BY a.submitted_at ASC LIMIT 6`
    );
    const disputes = all(
      `SELECT d.*, u.name AS raised_by_name FROM disputes d JOIN users u ON u.id = d.raised_by
       WHERE d.status IN ('open','investigating') ORDER BY d.created_at ASC LIMIT 6`
    );
    const recentAudit = all(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 12'
    ).map((row) => ({ ...row, meta: jsonParse(row.meta, {}) }));

    res.json({
      admin: {
        name: req.dbUser.name,
        role: req.user.adminRole,
        permissions: req.permissions
      },
      stats: {
        pendingProfessionals,
        pendingEmployers,
        assessmentQueue,
        openDisputes,
        activeAssignments,
        capturedPaise: captured,
        activationRevenuePaise: activationRevenue,
        pendingPayoutsPaise: pendingPayouts
      },
      queues: { verificationQueue, employerQueue, reviewQueue, disputes },
      recentAudit
    });
  })
);

// ------------------------------------------------------------------ verification
router.get(
  '/verifications/professionals',
  requireAdminPermission('verification.review'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req, { defaultLimit: 25 });
    const status = String(req.query.status || '');
    const where = ["p.verification_status IN ('pending','in_review','verified','rejected')"];
    const params = [];
    if (['pending', 'in_review', 'verified', 'rejected'].includes(status)) {
      where.push('p.verification_status = ?');
      params.push(status);
    }
    if (req.query.q) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR p.headline LIKE ?)');
      const term = `%${req.query.q}%`;
      params.push(term, term, term);
    }
    const rows = all(
      `SELECT p.*, u.name, u.email, u.phone
       FROM professional_profiles p JOIN users u ON u.id = p.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY CASE p.verification_status WHEN 'in_review' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                p.created_at ASC
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
      ...paginated(
        rows.map((row) => ({
          ...professionalDetail(row),
          email: row.email,
          phone: row.phone,
          identityStatus: row.identity_status,
          verificationStatus: row.verification_status,
          documents: all(
            `SELECT id, doc_type, filename, mime_type, size_bytes, status, created_at
             FROM documents WHERE owner_type = 'professional' AND owner_id = ? ORDER BY created_at DESC`,
            row.id
          ),
          employment: all(
            'SELECT * FROM employment_history WHERE professional_id = ? ORDER BY start_date DESC',
            row.id
          ),
          references: all(
            'SELECT id, name, company, title, email, status FROM professional_references WHERE professional_id = ?',
            row.id
          )
        })),
        total,
        page,
        limit
      )
    });
  })
);

router.post(
  '/verifications/professionals/:id/decision',
  requireAdminPermission('verification.review'),
  asyncHandler(async (req, res) => {
    const body = parse(decisionSchema(), req.body);
    const profile = one('SELECT * FROM professional_profiles WHERE id = ?', req.params.id);
    if (!profile) throw notFound('Professional profile not found.');
    const now = nowIso();
    const approved = body.decision === 'approve';
    update('professional_profiles', profile.id, {
      verification_status: approved ? 'verified' : 'rejected',
      identity_status: approved ? 'verified' : 'rejected',
      profile_status: approved ? 'approved' : 'rejected',
      is_public: approved ? profile.is_public : 0,
      updated_at: now
    });
    const pendingDocs = all(
      "SELECT * FROM documents WHERE owner_type = 'professional' AND owner_id = ? AND status = 'submitted'",
      profile.id
    );
    for (const doc of pendingDocs) {
      update('documents', doc.id, {
        status: approved ? 'verified' : 'rejected',
        reviewer_id: req.user.id,
        reviewed_at: now,
        review_notes: body.notes || null
      });
    }
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: profile.user_id,
      type: 'verification',
      title: approved ? 'Profile verified' : 'Verification decision',
      body: approved
        ? 'Your identity and experience checks are complete. You can now publish your profile if you have passed the assessment.'
        : `Your verification was not approved. ${body.notes || 'Contact support@flamingo.work for details.'}`,
      link: '/portal/professional/profile',
      read_at: null,
      created_at: now
    });
    audit(req, {
      action: approved ? 'verification.professional_approved' : 'verification.professional_rejected',
      entityType: 'professional_profile',
      entityId: profile.id,
      meta: { notes: body.notes || null }
    });
    res.json({
      ok: true,
      verificationStatus: approved ? 'verified' : 'rejected',
      identityStatus: approved ? 'verified' : 'rejected',
      note: approved
        ? 'Verification recorded. Public visibility remains under the professional’s control.'
        : 'Rejection recorded with reviewer notes.'
    });
  })
);

router.get(
  '/verifications/employers',
  requireAdminPermission('verification.review'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req, { defaultLimit: 25 });
    const status = String(req.query.status || '');
    const where = ["e.verification_status IN ('pending','in_review','verified','rejected')"];
    const params = [];
    if (['pending', 'in_review', 'verified', 'rejected'].includes(status)) {
      where.push('e.verification_status = ?');
      params.push(status);
    }
    if (req.query.q) {
      where.push('(e.org_name LIKE ? OR u.email LIKE ? OR u.name LIKE ?)');
      const term = `%${req.query.q}%`;
      params.push(term, term, term);
    }
    const rows = all(
      `SELECT e.*, u.name AS contact_name, u.email AS contact_email, u.phone
       FROM employer_profiles e JOIN users u ON u.id = e.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY CASE e.verification_status WHEN 'in_review' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                e.created_at ASC
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const total = one(
      `SELECT COUNT(*) AS count FROM employer_profiles e JOIN users u ON u.id = e.user_id
       WHERE ${where.join(' AND ')}`,
      ...params
    )?.count || 0;
    res.json({
      ...paginated(
        rows.map((row) => ({
          ...row,
          documents: all(
            `SELECT id, doc_type, filename, mime_type, size_bytes, status, created_at
             FROM documents WHERE owner_type = 'employer' AND owner_id = ? ORDER BY created_at DESC`,
            row.id
          )
        })),
        total,
        page,
        limit
      )
    });
  })
);

router.post(
  '/verifications/employers/:id/decision',
  requireAdminPermission('verification.review'),
  asyncHandler(async (req, res) => {
    const body = parse(decisionSchema(), req.body);
    const employer = one('SELECT * FROM employer_profiles WHERE id = ?', req.params.id);
    if (!employer) throw notFound('Employer not found.');
    const now = nowIso();
    const approved = body.decision === 'approve';
    update('employer_profiles', employer.id, {
      verification_status: approved ? 'verified' : 'rejected',
      verification_notes: body.notes || null,
      verified_at: approved ? now : null,
      updated_at: now
    });
    if (approved) {
      update('users', employer.user_id, { status: 'active' });
    }
    for (const doc of all(
      "SELECT * FROM documents WHERE owner_type = 'employer' AND owner_id = ? AND status = 'submitted'",
      employer.id
    )) {
      update('documents', doc.id, {
        status: approved ? 'verified' : 'rejected',
        reviewer_id: req.user.id,
        reviewed_at: now,
        review_notes: body.notes || null
      });
    }
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: employer.user_id,
      type: 'verification',
      title: approved ? 'Organisation verified' : 'Verification decision',
      body: approved
        ? 'Your organisation is verified. Shortlisting, interviewing and hiring are now enabled.'
        : `Your organisation verification was not approved. ${body.notes || 'Contact support@flamingo.work for details.'}`,
      link: '/portal/employer/profile',
      read_at: null,
      created_at: now
    });
    audit(req, {
      action: approved ? 'verification.employer_approved' : 'verification.employer_rejected',
      entityType: 'employer_profile',
      entityId: employer.id,
      meta: { notes: body.notes || null }
    });
    res.json({ ok: true, verificationStatus: approved ? 'verified' : 'rejected' });
  })
);

router.post(
  '/documents/:id/review',
  requireAdminPermission('documents.review'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        decision: z.enum(['approve', 'reject']),
        notes: z.string().max(1000).optional()
      }),
      req.body
    );
    const doc = one('SELECT * FROM documents WHERE id = ?', req.params.id);
    if (!doc) throw notFound('Document not found.');
    const approved = body.decision === 'approve';
    update('documents', doc.id, {
      status: approved ? 'verified' : 'rejected',
      reviewer_id: req.user.id,
      reviewed_at: nowIso(),
      review_notes: body.notes || null
    });
    audit(req, {
      action: approved ? 'document.verified' : 'document.rejected',
      entityType: 'document',
      entityId: doc.id,
      meta: { ownerType: doc.owner_type, ownerId: doc.owner_id }
    });
    res.json({ ok: true, status: approved ? 'verified' : 'rejected' });
  })
);

router.get(
  '/documents/:id/download',
  requireAdminPermission('documents.review'),
  asyncHandler(async (req, res) => {
    const doc = one('SELECT * FROM documents WHERE id = ?', req.params.id);
    if (!doc) throw notFound('Document not found.');
    const buffer = readEncryptedFile(doc.storage_key, doc.iv, doc.auth_tag);
    if (!buffer) throw notFound('Stored file is unavailable.');
    audit(req, { action: 'document.admin_downloaded', entityType: 'document', entityId: doc.id });
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename.replace(/["\r\n]/g, '')}"`);
    res.send(buffer);
  })
);

// ------------------------------------------------------------------ assessment review
router.get(
  '/assessment-attempts',
  requireAdminPermission('verification.review'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req, { defaultLimit: 25 });
    const status = String(req.query.status || 'human_review');
    const allowed = ['in_progress', 'submitted', 'human_review', 'passed', 'failed', 'expired'];
    const where = ['1 = 1'];
    const params = [];
    if (allowed.includes(status)) {
      where.push('a.status = ?');
      params.push(status);
    }
    const rows = all(
      `SELECT a.*, s.title, s.category, s.duration_minutes, u.name AS professional_name,
              p.headline, p.years_experience
       FROM assessment_attempts a
       JOIN assessments s ON s.id = a.assessment_id
       JOIN professional_profiles p ON p.id = a.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.submitted_at ASC, a.started_at ASC
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const total = one(
      `SELECT COUNT(*) AS count FROM assessment_attempts a WHERE ${where.join(' AND ')}`,
      ...params
    )?.count || 0;
    res.json({
      ...paginated(
        rows.map((row) => ({
          ...row,
          integrityFlags: jsonParse(row.integrity_flags, []),
          practicalCount:
            one(
              "SELECT COUNT(*) AS count FROM assessment_questions WHERE assessment_id = ? AND type = 'practical'",
              row.assessment_id
            )?.count || 0
        })),
        total,
        page,
        limit
      ),
      disclaimer:
        'Practical answers require human judgement. Integrity signals are review prompts only and must never be presented as proof of AI-assisted work or misconduct.'
    });
  })
);

router.get(
  '/assessment-attempts/:id',
  requireAdminPermission('verification.review'),
  asyncHandler(async (req, res) => {
    const attempt = one(
      `SELECT a.*, s.title, s.category, s.duration_minutes, s.pass_score,
              u.name AS professional_name, p.headline
       FROM assessment_attempts a
       JOIN assessments s ON s.id = a.assessment_id
       JOIN professional_profiles p ON p.id = a.professional_id
       JOIN users u ON u.id = p.user_id
       WHERE a.id = ?`,
      req.params.id
    );
    if (!attempt) throw notFound('Attempt not found.');
    const questions = all(
      'SELECT * FROM assessment_questions WHERE assessment_id = ?',
      attempt.assessment_id
    );
    const answers = all('SELECT * FROM attempt_answers WHERE attempt_id = ?', attempt.id);
    const answerMap = Object.fromEntries(answers.map((answer) => [answer.question_id, answer]));
    res.json({
      attempt: { ...attempt, integrityFlags: jsonParse(attempt.integrity_flags, []) },
      questions: questions.map((question) => ({
        ...question,
        options: jsonParse(question.options, []),
        tags: jsonParse(question.tags, []),
        answer: answerMap[question.id] || null
      })),
      objectiveSummary: scoreObjective(questions, answerMap),
      integrityEvents: all(
        'SELECT * FROM integrity_events WHERE attempt_id = ? ORDER BY created_at',
        attempt.id
      ),
      disclaimer:
        'Score practical answers against the published rubric. Text similarity and focus signals are supporting context for a human decision, not automated proof.'
    });
  })
);

router.post(
  '/assessment-attempts/:id/review',
  requireAdminPermission('verification.review'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        finalScore: z.coerce.number().min(0).max(100),
        feedback: z.string().min(10).max(2000),
        decision: z.enum(['pass', 'fail', 'request_retake']),
        answerPoints: z
          .array(z.object({ answerId: z.string().min(1), points: z.coerce.number().min(0).max(50) }))
          .max(50)
          .optional()
      }),
      req.body
    );
    const attempt = one('SELECT * FROM assessment_attempts WHERE id = ?', req.params.id);
    if (!attempt) throw notFound('Attempt not found.');
    if (!['human_review', 'submitted'].includes(attempt.status)) {
      throw conflict('This attempt is not awaiting review.');
    }
    if (body.decision === 'pass' && body.finalScore < attempt.pass_mark) {
      throw badRequest(`A pass requires at least ${attempt.pass_mark}/100.`);
    }
    const now = nowIso();
    for (const point of body.answerPoints || []) {
      const answer = one('SELECT * FROM attempt_answers WHERE id = ? AND attempt_id = ?', point.answerId, attempt.id);
      if (answer) {
        run('UPDATE attempt_answers SET points_awarded = ?, reviewer_note = ? WHERE id = ?', point.points, body.feedback, answer.id);
      }
    }
    const status = body.decision === 'pass' ? 'passed' : body.decision === 'fail' ? 'failed' : 'failed';
    update('assessment_attempts', attempt.id, {
      status,
      final_score: body.finalScore,
      reviewer_id: req.user.id,
      reviewed_at: now,
      review_notes: body.feedback,
      feedback: body.feedback
    });
    if (body.decision === 'pass') {
      update('professional_profiles', attempt.professional_id, {
        assessment_status: 'passed',
        updated_at: now
      });
    } else {
      update('professional_profiles', attempt.professional_id, {
        assessment_status: 'failed',
        updated_at: now
      });
    }
    const profile = one('SELECT * FROM professional_profiles WHERE id = ?', attempt.professional_id);
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: profile.user_id,
      type: 'assessment',
      title: body.decision === 'pass' ? 'Assessment passed' : 'Assessment result published',
      body:
        body.decision === 'pass'
          ? `You scored ${body.finalScore}/100. You can now publish your profile once verification is complete.`
          : `Your assessment result is available. ${body.decision === 'request_retake' ? 'A retake has been opened under the published policy.' : 'Review the feedback and retake after the waiting period.'}`,
      link: '/portal/professional/assessments',
      read_at: null,
      created_at: now
    });
    audit(req, {
      action: 'assessment.reviewed',
      entityType: 'assessment_attempt',
      entityId: attempt.id,
      meta: { finalScore: body.finalScore, decision: body.decision }
    });
    res.json({
      ok: true,
      status,
      finalScore: body.finalScore,
      decision: body.decision,
      note:
        body.decision === 'pass'
          ? 'Pass recorded. The professional can publish after identity verification.'
          : 'Result recorded. Integrity signals remain supporting context only.'
    });
  })
);

// ------------------------------------------------------------------ finance
router.get(
  '/finance/summary',
  requireAdminPermission('finance.view'),
  asyncHandler(async (req, res) => {
    const captured = one(
      "SELECT COALESCE(SUM(total_paise),0) AS total FROM payments WHERE status = 'captured'"
    )?.total || 0;
    const invoices = all(
      `SELECT i.*, a.code, a.title, e.org_name FROM invoices i
       JOIN assignments a ON a.id = i.assignment_id
       JOIN employer_profiles e ON e.id = i.employer_id
       ORDER BY i.issued_at DESC LIMIT 50`
    );
    const payouts = all(
      `SELECT po.*, a.code, a.title, u.name AS professional_name FROM payouts po
       JOIN assignments a ON a.id = po.assignment_id
       JOIN professional_profiles p ON p.id = po.professional_id
       JOIN users u ON u.id = p.user_id
       ORDER BY po.created_at DESC LIMIT 50`
    );
    const fees = all(
      `SELECT f.*, a.code, u.name AS professional_name FROM activation_fees f
       JOIN assignments a ON a.id = f.assignment_id
       JOIN professional_profiles p ON p.id = f.professional_id
       JOIN users u ON u.id = p.user_id
       ORDER BY f.disclosed_at DESC LIMIT 50`
    );
    const ledger = all(
      `SELECT account, direction, COALESCE(SUM(amount_paise),0) AS total
       FROM ledger_entries GROUP BY account, direction`
    );
    const accounts = {};
    for (const line of ledger) {
      accounts[line.account] ||= { debit: 0, credit: 0 };
      accounts[line.account][line.direction] = line.total;
    }
    const trialBalance = Object.entries(accounts)
      .map(([account, value]) => ({
        account,
        debitPaise: value.debit,
        creditPaise: value.credit,
        balancePaise: value.debit - value.credit
      }))
      .sort((a, b) => a.account.localeCompare(b.account));
    const totals = {
      capturedPaise: captured,
      gstCollectedPaise: one(
        "SELECT COALESCE(SUM(gst_paise),0) AS total FROM payments WHERE status = 'captured'"
      )?.total || 0,
      platformRevenuePaise: one(
        "SELECT COALESCE(SUM(platform_fee_paise),0) AS total FROM payments WHERE status = 'captured'"
      )?.total || 0,
      activationBasePaise: one(
        "SELECT COALESCE(SUM(base_paise),0) AS total FROM activation_fees WHERE status = 'deducted'"
      )?.total || 0,
      activationGstPaise: one(
        "SELECT COALESCE(SUM(gst_paise),0) AS total FROM activation_fees WHERE status = 'deducted'"
      )?.total || 0,
      payoutsPaidPaise: one(
        "SELECT COALESCE(SUM(net_paise),0) AS total FROM payouts WHERE status = 'paid'"
      )?.total || 0,
      payoutsPendingPaise: one(
        "SELECT COALESCE(SUM(net_paise),0) AS total FROM payouts WHERE status IN ('pending','processing')"
      )?.total || 0,
      tdsWithheldPaise: one('SELECT COALESCE(SUM(tds_paise),0) AS total FROM payouts')?.total || 0
    };
    const debit = trialBalance.reduce((sum, row) => sum + row.debitPaise, 0);
    const credit = trialBalance.reduce((sum, row) => sum + row.creditPaise, 0);
    res.json({
      invoices,
      payouts,
      activationFees: fees,
      totals,
      trialBalance,
      reconciliation: {
        debitPaise: debit,
        creditPaise: credit,
        balanced: debit === credit,
        note: 'The demonstration ledger is a double-entry control record. It is not a statutory book of account.'
      },
      gatewayNotice:
        'Simulated gateway in this environment. Production requires an RBI-authorised payment aggregator and its escrow/nodal arrangements. GST and TDS treatment must be confirmed by the company’s tax adviser.'
    });
  })
);

router.post(
  '/payouts/:id/mark-paid',
  requireAdminPermission('payouts.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ method: z.string().min(2).max(60).optional() }),
      req.body
    );
    const payout = one('SELECT * FROM payouts WHERE id = ?', req.params.id);
    if (!payout) throw notFound('Payout not found.');
    if (payout.status === 'paid') throw conflict('This payout is already marked paid.');
    if (payout.status === 'failed') throw conflict('A failed payout cannot be marked paid without a new instruction.');
    const now = nowIso();
    run(
      "UPDATE payouts SET status = 'paid', paid_at = ?, method = ? WHERE id = ?",
      now,
      body.method || payout.method || 'simulated_imps',
      payout.id
    );
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: one('SELECT user_id FROM professional_profiles WHERE id = ?', payout.professional_id)?.user_id,
      type: 'payout',
      title: 'Payout settled',
      body: `A ${payout.type} payout of ₹${(payout.net_paise / 100).toLocaleString('en-IN')} has been marked settled (simulated).`,
      link: '/portal/professional/finance',
      read_at: null,
      created_at: now
    });
    audit(req, {
      action: 'payout.marked_paid',
      entityType: 'payout',
      entityId: payout.id,
      meta: { netPaise: payout.net_paise, method: body.method || payout.method }
    });
    res.json({ ok: true, status: 'paid', paidAt: now });
  })
);

// ------------------------------------------------------------------ disputes & reviews
router.get(
  '/disputes',
  requireAdminPermission('disputes.view'),
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || '');
    const allowed = ['open', 'investigating', 'resolved', 'rejected'];
    const where = ['1 = 1'];
    const params = [];
    if (allowed.includes(status)) {
      where.push('d.status = ?');
      params.push(status);
    }
    const rows = all(
      `SELECT d.*, u.name AS raised_by_name, u.role AS raised_by_role,
              a.code AS assignment_code, a.title AS assignment_title,
              e.org_name
       FROM disputes d
       JOIN users u ON u.id = d.raised_by
       LEFT JOIN assignments a ON a.id = d.assignment_id
       LEFT JOIN employer_profiles e ON e.id = a.employer_id
       WHERE ${where.join(' AND ')}
       ORDER BY CASE d.status WHEN 'open' THEN 0 WHEN 'investigating' THEN 1 ELSE 2 END, d.created_at ASC`,
      ...params
    );
    res.json({ disputes: rows });
  })
);

router.post(
  '/disputes/:id/resolve',
  requireAdminPermission('disputes.finance'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        status: z.enum(['investigating', 'resolved', 'rejected']),
        resolution: z.string().min(10).max(3000)
      }),
      req.body
    );
    const dispute = one('SELECT * FROM disputes WHERE id = ?', req.params.id);
    if (!dispute) throw notFound('Dispute not found.');
    const now = nowIso();
    update('disputes', dispute.id, {
      status: body.status,
      resolution: body.resolution,
      resolved_at: ['resolved', 'rejected'].includes(body.status) ? now : null
    });
    if (dispute.review_id && ['resolved', 'rejected'].includes(body.status)) {
      update('reviews', dispute.review_id, {
        status: body.status === 'resolved' ? 'upheld' : 'revised',
        resolution: body.resolution,
        resolution_at: now
      });
    }
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: dispute.raised_by,
      type: 'dispute',
      title: `Dispute ${body.status}`,
      body: body.resolution,
      link: '/portal/professional/career',
      read_at: null,
      created_at: now
    });
    audit(req, {
      action: 'dispute.updated',
      entityType: 'dispute',
      entityId: dispute.id,
      meta: { status: body.status }
    });
    res.json({ ok: true, status: body.status });
  })
);

router.get(
  '/reviews/challenges',
  requireAdminPermission('marketplace.moderate'),
  asyncHandler(async (_req, res) => {
    const rows = all(
      `SELECT r.*, e.org_name, u.name AS professional_name, a.code, a.title
       FROM reviews r
       JOIN employer_profiles e ON e.id = r.employer_id
       JOIN professional_profiles p ON p.id = r.professional_id
       JOIN users u ON u.id = p.user_id
       JOIN assignments a ON a.id = r.assignment_id
       WHERE r.status IN ('challenged','under_review')
       ORDER BY r.response_at ASC`
    );
    res.json({
      reviews: rows.map((row) => ({ ...row, scores: jsonParse(row.scores, {}) })),
      disclaimer: 'Challenges are reviewed by a human. The original review remains visible with a review marker until resolved.'
    });
  })
);

router.post(
  '/reviews/:id/resolve',
  requireAdminPermission('marketplace.moderate'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        decision: z.enum(['uphold', 'revise']),
        resolution: z.string().min(10).max(3000)
      }),
      req.body
    );
    const review = one('SELECT * FROM reviews WHERE id = ?', req.params.id);
    if (!review) throw notFound('Review not found.');
    const now = nowIso();
    update('reviews', review.id, {
      status: body.decision === 'uphold' ? 'upheld' : 'revised',
      resolution: body.resolution,
      resolution_at: now
    });
    if (review.review_id) {
      run(
        "UPDATE disputes SET status = 'resolved', resolution = ?, resolved_at = ? WHERE review_id = ? AND status IN ('open','investigating')",
        body.resolution,
        now,
        review.id
      );
    }
    audit(req, {
      action: 'review.challenge_resolved',
      entityType: 'review',
      entityId: review.id,
      meta: { decision: body.decision }
    });
    res.json({
      ok: true,
      status: body.decision === 'uphold' ? 'upheld' : 'revised',
      note:
        body.decision === 'uphold'
          ? 'The original review is upheld with the reviewer’s explanation attached.'
          : 'The review is marked revised. Update the narrative through the employer if factual corrections are needed.'
    });
  })
);

// ------------------------------------------------------------------ users & audit
router.get(
  '/users',
  requireAdminPermission('users.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req, { defaultLimit: 25 });
    const where = ['1 = 1'];
    const params = [];
    if (['professional', 'employer', 'admin'].includes(String(req.query.role))) {
      where.push('role = ?');
      params.push(req.query.role);
    }
    if (['active', 'suspended', 'pending', 'closed'].includes(String(req.query.status))) {
      where.push('status = ?');
      params.push(req.query.status);
    }
    if (req.query.q) {
      where.push('(name LIKE ? OR email LIKE ?)');
      const term = `%${req.query.q}%`;
      params.push(term, term);
    }
    const rows = all(
      `SELECT id, email, role, admin_role, name, phone, status, mfa_enabled, is_demo,
              created_at, last_login_at
       FROM users WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const total = one(
      `SELECT COUNT(*) AS count FROM users WHERE ${where.join(' AND ')}`,
      ...params
    )?.count || 0;
    res.json({
      ...paginated(
        rows.map((row) => ({ ...row, mfaEnabled: Boolean(row.mfa_enabled), isDemo: Boolean(row.is_demo) })),
        total,
        page,
        limit
      )
    });
  })
);

router.post(
  '/users/:id/status',
  requireAdminPermission('users.view'),
  asyncHandler(async (req, res) => {
    if (!req.permissions.includes('*')) {
      throw forbidden('Only a super administrator can change account status.');
    }
    const body = parse(
      z.object({
        status: z.enum(['active', 'suspended', 'closed']),
        reason: z.string().min(5).max(500)
      }),
      req.body
    );
    const user = one('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!user) throw notFound('User not found.');
    if (user.id === req.user.id) throw badRequest('You cannot change your own account status.');
    run('UPDATE users SET status = ? WHERE id = ?', body.status, user.id);
    if (body.status !== 'active') run('DELETE FROM sessions WHERE user_id = ?', user.id);
    insert('notifications', {
      id: `not_${crypto.randomUUID()}`,
      user_id: user.id,
      type: 'account',
      title: 'Account status updated',
      body: `Your account status is now ${body.status}. Reason: ${body.reason}`,
      link: '/login',
      read_at: null,
      created_at: nowIso()
    });
    audit(req, {
      action: 'user.status_changed',
      entityType: 'user',
      entityId: user.id,
      meta: { status: body.status, reason: body.reason }
    });
    res.json({ ok: true, status: body.status });
  })
);

router.get(
  '/audit',
  requireAdminPermission('users.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 200 });
    const where = ['1 = 1'];
    const params = [];
    if (req.query.action) {
      where.push('action LIKE ?');
      params.push(`%${req.query.action}%`);
    }
    if (req.query.entityType) {
      where.push('entity_type = ?');
      params.push(req.query.entityType);
    }
    if (req.query.actorId) {
      where.push('actor_id = ?');
      params.push(req.query.actorId);
    }
    const rows = all(
      `SELECT * FROM audit_logs WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const total = one(
      `SELECT COUNT(*) AS count FROM audit_logs WHERE ${where.join(' AND ')}`,
      ...params
    )?.count || 0;
    res.json({
      ...paginated(
        rows.map((row) => ({ ...row, meta: jsonParse(row.meta, {}) })),
        total,
        page,
        limit
      )
    });
  })
);

// ------------------------------------------------------------------ settings
const SETTING_KEYS = new Set([
  'activation_fee_paise',
  'gst_rate_bps',
  'platform_fee_bps',
  'advance_percent',
  'tds_rate_bps',
  'max_working_hours_day',
  'max_working_days_week',
  'weekly_hours_cap',
  'min_experience_years',
  'max_interview_rounds',
  'min_assessment_score',
  'assessment_retake_days',
  'payout_hold_days',
  'mandatory_off_days',
  'allowed_working_days',
  'shift_options',
  'break_policy',
  'support_email',
  'brand_legal_name'
]);

router.get(
  '/settings',
  requireAdminPermission('users.view'),
  asyncHandler(async (_req, res) => {
    const settings = getSettings();
    const rows = all('SELECT * FROM settings ORDER BY key');
    res.json({
      settings,
      rows,
      editable: [...SETTING_KEYS],
      note: 'Policy changes apply to new actions. Existing contracts retain the terms disclosed at acceptance.'
    });
  })
);

router.patch(
  '/settings',
  requireAdminPermission('users.view'),
  asyncHandler(async (req, res) => {
    if (!req.permissions.includes('*')) {
      throw forbidden('Only a super administrator can change platform settings.');
    }
    const body = parse(
      z.record(z.union([z.string().max(200), z.number()])),
      req.body
    );
    const invalid = Object.keys(body).filter((key) => !SETTING_KEYS.has(key));
    if (invalid.length) {
      throw badRequest(`Unknown setting keys: ${invalid.join(', ')}`);
    }
    const now = nowIso();
    for (const [key, value] of Object.entries(body)) {
      const numeric = [
        'activation_fee_paise',
        'gst_rate_bps',
        'platform_fee_bps',
        'advance_percent',
        'tds_rate_bps',
        'max_working_hours_day',
        'max_working_days_week',
        'weekly_hours_cap',
        'min_experience_years',
        'max_interview_rounds',
        'min_assessment_score',
        'assessment_retake_days',
        'payout_hold_days'
      ].includes(key);
      if (numeric && !Number.isFinite(Number(value))) {
        throw badRequest(`${key} must be numeric.`);
      }
      setSetting(key, value, req.user.id);
    }
    audit(req, {
      action: 'settings.updated',
      entityType: 'settings',
      entityId: null,
      meta: { keys: Object.keys(body), updatedAt: now }
    });
    res.json({
      ok: true,
      settings: getSettings(),
      note: 'Settings saved. New assessments, assignments and payouts use the updated policy.'
    });
  })
);

// ------------------------------------------------------------------ reports
router.get(
  '/reports/overview',
  requireAdminPermission('reports.view'),
  asyncHandler(async (_req, res) => {
    const byStatus = all('SELECT status, COUNT(*) AS count FROM assignments GROUP BY status ORDER BY count DESC');
    const byCategory = all(
      `SELECT p.category, COUNT(*) AS count FROM assignments a
       JOIN professional_profiles p ON p.id = a.professional_id
       GROUP BY p.category ORDER BY count DESC`
    );
    const monthly = all(
      `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS payments, SUM(total_paise) AS captured_paise
       FROM payments WHERE status = 'captured' GROUP BY month ORDER BY month DESC LIMIT 12`
    );
    res.json({
      byStatus,
      byCategory,
      monthly,
      note: 'Reports use simulated demonstration transactions. They are diagnostic, not audited financial statements.'
    });
  })
);

export default router;
