import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import {
  createSession,
  destroySession,
  requireAuth,
  verifyCsrf,
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  recordLoginAttempt,
  generateTotpSecret,
  verifyTotp,
  mfaOtpauthUrl,
  adminPermissionsFor
} from '../lib/auth.js';
import { db, one, run, insert, update, nowIso, getSettings } from '../db.js';
import { parse } from '../lib/validate.js';
import { asyncHandler, audit, rateLimit } from '../lib/http.js';
import { badRequest, conflict, forbidden, unauthorized } from '../lib/errors.js';
import { CATEGORY_LABELS } from '../domain/pricing.js';
import { config } from '../config.js';
import {
  professionalForUser,
  employerForUser,
  professionalCard,
  employerSummary,
  unreadNotifications
} from '../lib/data.js';

const router = Router();
const settings = getSettings();
const emailSchema = z.string().email().max(200).transform((value) => value.trim().toLowerCase());
const passwordSchema = z.string().min(10).max(200);
const categoryKeys = Object.keys(CATEGORY_LABELS);

const professionalRegistrationSchema = z.object({
  name: z.string().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().min(6).max(30),
  category: z.enum(categoryKeys),
  yearsExperience: z.coerce.number().min(0).max(60),
  headline: z.string().min(3).max(160),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  education: z.string().max(200).optional().default(''),
  skills: z.array(z.string().min(1).max(60)).min(1).max(20),
  consent: z.literal(true),
  demo: z.boolean().optional()
});

const employerRegistrationSchema = z.object({
  name: z.string().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().min(6).max(30),
  orgName: z.string().min(2).max(200),
  legalName: z.string().max(200).optional().default(''),
  registrationNumber: z.string().max(60).optional().default(''),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i, 'Enter a valid 15-character GSTIN')
    .optional()
    .or(z.literal('')),
  industry: z.string().min(2).max(100),
  companySize: z.string().max(50).optional().default(''),
  website: z.string().url().max(200).optional().or(z.literal('')),
  registeredAddress: z.string().min(5).max(300),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  repName: z.string().min(2).max(120),
  repDesignation: z.string().max(100).optional().default(''),
  billingEmail: emailSchema,
  consent: z.literal(true)
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  code: z.string().regex(/^\d{6}$/).optional()
});

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    adminRole: user.admin_role,
    status: user.status,
    mfaEnabled: Boolean(user.mfa_enabled),
    isDemo: Boolean(user.is_demo),
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at
  };
}

function requiresAdminMfaEnrollment(user) {
  return Boolean(config.adminMfaEnforced && user.role === 'admin' && !user.mfa_enabled);
}

router.post(
  '/register/professional',
  rateLimit({ windowMs: 60 * 60_000, max: 10, scope: 'register' }),
  asyncHandler(async (req, res) => {
    const body = parse(professionalRegistrationSchema, req.body);
    if (body.yearsExperience < settings.min_experience_years) {
      throw badRequest(
        `Flamingo is designed for experienced professionals. A minimum of ${settings.min_experience_years} years of professional experience is required.`
      );
    }
    const passwordError = validatePasswordPolicy(body.password);
    if (passwordError) throw badRequest(passwordError);
    if (one('SELECT id FROM users WHERE email = ?', body.email)) {
      throw conflict('An account with this email already exists. Try signing in instead.');
    }
    if (!body.consent) throw badRequest('Consent to the privacy notice is required.');

    const userId = `usr_${crypto.randomUUID()}`;
    const profileId = `pro_${crypto.randomUUID()}`;
    const timestamp = nowIso();
    db.exec('BEGIN IMMEDIATE');
    try {
      insert('users', {
        id: userId,
        email: body.email,
        password_hash: hashPassword(body.password),
        role: 'professional',
        admin_role: null,
        name: body.name.trim(),
        phone: body.phone,
        status: 'active',
        mfa_secret: null,
        mfa_enabled: 0,
        is_demo: 0,
        created_at: timestamp,
        last_login_at: null
      });
      insert('professional_profiles', {
        id: profileId,
        user_id: userId,
        headline: body.headline.trim(),
        category: body.category,
        bio: '',
        city: body.city,
        state: body.state,
        country: 'India',
        years_experience: body.yearsExperience,
        current_title: body.headline,
        current_employer: null,
        education: body.education,
        languages: JSON.stringify(['English']),
        skills: JSON.stringify(body.skills.map((skill) => skill.trim()).filter(Boolean)),
        certifications: '[]',
        portfolio_url: null,
        linkedin_url: null,
        hourly_rate_paise: null,
        recommended_rate_paise: null,
        availability_days: '[]',
        shift_hours: 8,
        preferred_start: '09:00',
        preferred_end: '18:00',
        minimum_experience_met: 1,
        notice_period_days: 0,
        salary_expectation_paise: null,
        photo_url: null,
        resume_document_id: null,
        is_public: 0,
        identity_status: 'pending',
        verification_status: 'pending',
        assessment_status: 'not_started',
        profile_status: 'draft',
        rating: 0,
        completed_assignments: 0,
        rehire_rate: 0,
        is_demo: 0,
        created_at: timestamp,
        updated_at: timestamp
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const session = createSession(req, res, userId);
    audit(req, {
      action: 'professional.registered',
      entityType: 'professional_profile',
      entityId: profileId,
      actorId: userId,
      actorRole: 'professional'
    });
    res.status(201).json({
      user: safeUser(one('SELECT * FROM users WHERE id = ?', userId)),
      csrfToken: session.csrfToken,
      nextSteps: [
        'Complete your professional profile and availability',
        'Upload identity and experience documents',
        'Take your free assessment',
        'Publish your profile after verification'
      ]
    });
  })
);

router.post(
  '/register/employer',
  rateLimit({ windowMs: 60 * 60_000, max: 10, scope: 'register' }),
  asyncHandler(async (req, res) => {
    const body = parse(employerRegistrationSchema, req.body);
    const passwordError = validatePasswordPolicy(body.password);
    if (passwordError) throw badRequest(passwordError);
    if (one('SELECT id FROM users WHERE email = ?', body.email)) {
      throw conflict('An account with this email already exists.');
    }
    const userId = `usr_${crypto.randomUUID()}`;
    const employerId = `emp_${crypto.randomUUID()}`;
    const timestamp = nowIso();
    db.exec('BEGIN IMMEDIATE');
    try {
      insert('users', {
        id: userId,
        email: body.email,
        password_hash: hashPassword(body.password),
        role: 'employer',
        admin_role: null,
        name: body.name.trim(),
        phone: body.phone,
        status: 'active',
        mfa_secret: null,
        mfa_enabled: 0,
        is_demo: 0,
        created_at: timestamp,
        last_login_at: null
      });
      insert('employer_profiles', {
        id: employerId,
        user_id: userId,
        org_name: body.orgName.trim(),
        legal_name: body.legalName || body.orgName.trim(),
        registration_number: body.registrationNumber || null,
        gstin: body.gstin || null,
        industry: body.industry,
        company_size: body.companySize || null,
        website: body.website || null,
        registered_address: body.registeredAddress,
        city: body.city,
        state: body.state,
        rep_name: body.repName,
        rep_designation: body.repDesignation || null,
        billing_email: body.billingEmail,
        billing_address: body.registeredAddress,
        organisation_history: null,
        verification_status: 'pending',
        verification_notes: null,
        verified_at: null,
        is_demo: 0,
        created_at: timestamp,
        updated_at: timestamp
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const session = createSession(req, res, userId);
    audit(req, {
      action: 'employer.registered',
      entityType: 'employer_profile',
      entityId: employerId,
      actorId: userId,
      actorRole: 'employer'
    });
    res.status(201).json({
      user: safeUser(one('SELECT * FROM users WHERE id = ?', userId)),
      csrfToken: session.csrfToken,
      nextSteps: [
        'Upload incorporation and GST documents',
        'Await verification by the Flamingo onboarding team',
        'Create your first hiring requirement',
        'Search and shortlist verified professionals'
      ]
    });
  })
);

router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60_000, max: 20, scope: 'login-ip' }),
  asyncHandler(async (req, res) => {
    const body = parse(loginSchema, req.body);
    const emailKey = `login-email:${body.email}`;
    const recentFailures = one(
      `SELECT COUNT(*) AS count FROM login_attempts
       WHERE email = ? AND success = 0 AND created_at > ?`,
      body.email,
      new Date(Date.now() - 15 * 60_000).toISOString()
    );
    if (recentFailures?.count >= 8) {
      throw forbidden('Too many failed sign-in attempts. Please wait 15 minutes before trying again.');
    }
    void emailKey;
    const user = one('SELECT * FROM users WHERE email = ?', body.email);
    const valid = user ? verifyPassword(body.password, user.password_hash) : false;
    recordLoginAttempt(body.email, req.ip, valid);
    if (!user || !valid) {
      throw unauthorized('Email or password is incorrect.');
    }
    if (user.status !== 'active') {
      throw forbidden('This account is not active. Contact support@flamingo.work for help.');
    }
    if (user.mfa_enabled) {
      if (!body.code) {
        return res.status(401).json({
          error: { code: 'mfa_required', message: 'Enter the 6-digit code from your authenticator app.' },
          mfaRequired: true
        });
      }
      if (!verifyTotp(user.mfa_secret, body.code)) {
        throw unauthorized('The authentication code is invalid or expired.');
      }
    }
    run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), user.id);
    const session = createSession(req, res, user.id);
    audit(req, { action: 'auth.login', entityType: 'user', entityId: user.id, actorId: user.id, actorRole: user.role });

    const professional = user.role === 'professional' ? professionalForUser(user.id) : null;
    const employer = user.role === 'employer' ? employerForUser(user.id) : null;
    res.json({
      user: safeUser({ ...user, last_login_at: nowIso() }),
      csrfToken: session.csrfToken,
      mfaEnrollmentRequired: requiresAdminMfaEnrollment(user),
      adminPermissions: user.role === 'admin' ? adminPermissionsFor(user.admin_role) : [],
      professional: professional ? professionalCard({ ...professional, name: user.name }) : null,
      employer: employer ? employerSummary(employer) : null
    });
  })
);

router.post('/logout', requireAuth, verifyCsrf, (req, res) => {
  audit(req, { action: 'auth.logout', entityType: 'user', entityId: req.user.id });
  destroySession(req, res);
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = one('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!user) throw unauthorized();
    const professional = user.role === 'professional' ? professionalForUser(user.id) : null;
    const employer = user.role === 'employer' ? employerForUser(user.id) : null;
    res.json({
      user: safeUser(user),
      csrfToken: req.session.csrf_token,
      mfaEnrollmentRequired: requiresAdminMfaEnrollment(user),
      professional: professional ? professionalCard({ ...professional, name: user.name }) : null,
      employer: employer ? employerSummary(employer) : null,
      unreadNotifications: unreadNotifications(user.id),
      adminPermissions: user.role === 'admin' ? adminPermissionsFor(user.admin_role) : []
    });
  })
);

router.post(
  '/mfa/setup',
  requireAuth,
  verifyCsrf,
  asyncHandler(async (req, res) => {
    const user = one('SELECT * FROM users WHERE id = ?', req.user.id);
    if (user.mfa_enabled) throw conflict('Multi-factor authentication is already enabled.');
    const secret = generateTotpSecret();
    run('UPDATE users SET mfa_secret = ? WHERE id = ?', secret, user.id);
    audit(req, { action: 'mfa.setup_started', entityType: 'user', entityId: user.id });
    res.json({
      secret,
      otpauthUrl: mfaOtpauthUrl(secret, user.email),
      instructions:
        'Add this secret to any TOTP authenticator, then confirm with a 6-digit code. The secret is stored server-side and never returned again.'
    });
  })
);

router.post(
  '/mfa/enable',
  requireAuth,
  verifyCsrf,
  asyncHandler(async (req, res) => {
    const { code } = parse(z.object({ code: z.string().regex(/^\d{6}$/) }), req.body);
    const user = one('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!user.mfa_secret) throw badRequest('Start MFA setup first.');
    if (!verifyTotp(user.mfa_secret, code)) throw badRequest('That code is invalid or expired. Try the next code.');
    run('UPDATE users SET mfa_enabled = 1 WHERE id = ?', user.id);
    audit(req, { action: 'mfa.enabled', entityType: 'user', entityId: user.id });
    res.json({ ok: true, mfaEnabled: true });
  })
);

router.post(
  '/mfa/disable',
  requireAuth,
  verifyCsrf,
  asyncHandler(async (req, res) => {
    const { password, code } = parse(
      z.object({ password: z.string().min(1), code: z.string().regex(/^\d{6}$/) }),
      req.body
    );
    const user = one('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!verifyPassword(password, user.password_hash)) throw unauthorized('Password is incorrect.');
    if (!verifyTotp(user.mfa_secret, code)) throw badRequest('That code is invalid or expired.');
    run('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?', user.id);
    audit(req, { action: 'mfa.disabled', entityType: 'user', entityId: user.id });
    res.json({ ok: true, mfaEnabled: false });
  })
);

router.post(
  '/password/change',
  requireAuth,
  verifyCsrf,
  rateLimit({ windowMs: 15 * 60_000, max: 5, scope: 'password-change' }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parse(
      z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(200) }),
      req.body
    );
    const user = one('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!verifyPassword(currentPassword, user.password_hash)) throw unauthorized('Current password is incorrect.');
    const error = validatePasswordPolicy(newPassword);
    if (error) throw badRequest(error);
    run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(newPassword), user.id);
    run('DELETE FROM sessions WHERE user_id = ?', user.id);
    destroySession(req, res);
    audit(req, { action: 'password.changed', entityType: 'user', entityId: user.id });
    res.json({ ok: true, message: 'Password changed. Please sign in again.' });
  })
);

export default router;
