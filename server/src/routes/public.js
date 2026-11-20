import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { all, getSettings, insert, nowIso, one } from '../db.js';
import { asyncHandler, audit, rateLimit } from '../lib/http.js';
import { parse } from '../lib/validate.js';
import { CATEGORY_LABELS } from '../domain/pricing.js';

const router = Router();

router.get('/config', (_req, res) => {
  const settings = getSettings();
  res.json({
    brand: {
      product: 'FLAMINGO',
      legalName: settings.brand_legal_name,
      positioning: 'The Future of Flexible Talent',
      philosophy: 'Work Your Time. Earn Your Worth.'
    },
    terms: {
      activationFeePaise: settings.activation_fee_paise,
      gstRateBps: settings.gst_rate_bps,
      platformFeeBps: settings.platform_fee_bps,
      advancePercent: settings.advance_percent,
      maxWorkingHoursDay: settings.max_working_hours_day,
      maxWorkingDaysWeek: settings.max_working_days_week,
      weeklyHoursCap: settings.weekly_hours_cap,
      minExperienceYears: settings.min_experience_years,
      maxInterviewRounds: settings.max_interview_rounds,
      minAssessmentScore: settings.min_assessment_score,
      shiftOptions: settings.shiftOptions,
      allowedWorkingDays: settings.allowedWorkingDays,
      mandatoryOffDays: settings.mandatoryOffDays,
      breakPolicy: settings.breakPolicy,
      supportEmail: settings.support_email
    },
    demoMode: true,
    demoNotice:
      'Demonstration environment: payment capture, identity verification and payouts are simulated. No live money moves and no real identity documents are processed.'
  });
});

router.get('/categories', (_req, res) => {
  res.json({ categories: Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label })) });
});

router.get(
  '/benchmarks',
  asyncHandler(async (_req, res) => {
    const rows = all(
      `SELECT category, level, min_hourly_paise, median_hourly_paise, max_hourly_paise,
              source_name, source_url, as_of, notes, demand_index
       FROM rate_benchmarks ORDER BY category, CASE level WHEN 'mid' THEN 1 WHEN 'senior' THEN 2 ELSE 3 END`
    );
    const grouped = {};
    for (const row of rows) {
      grouped[row.category] ||= { category: row.category, label: CATEGORY_LABELS[row.category] || row.category, levels: [] };
      grouped[row.category].levels.push({
        level: row.level,
        minHourlyPaise: row.min_hourly_paise,
        medianHourlyPaise: row.median_hourly_paise,
        maxHourlyPaise: row.max_hourly_paise,
        demandIndex: row.demand_index,
        source: { name: row.source_name, url: row.source_url, asOf: row.as_of },
        notes: row.notes
      });
    }
    res.json({
      benchmarks: Object.values(grouped),
      methodology:
        'Rates are recommendations from sourced market ranges. Medians are derived from published ranges or from salary bands converted with a documented contractor loading. Flamingo does not present estimates as audited market facts. Review docs/RESEARCH.md for sources and assumptions.',
      lastReviewed: '2026-07-31'
    });
  })
);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const publicProfessionals = one('SELECT COUNT(*) AS count FROM professional_profiles WHERE is_public = 1')?.count || 0;
    const verifiedEmployers = one("SELECT COUNT(*) AS count FROM employer_profiles WHERE verification_status = 'verified'")?.count || 0;
    const completedAssignments = one("SELECT COUNT(*) AS count FROM assignments WHERE status IN ('completed','closed')")?.count || 0;
    const categories = one('SELECT COUNT(DISTINCT category) AS count FROM professional_profiles')?.count || 0;
    res.json({
      publicProfessionals,
      verifiedEmployers,
      completedAssignments,
      categories,
      note: 'Seeded demonstration data. Counts are not claims about live marketplace liquidity.'
    });
  })
);

router.get('/faqs', (_req, res) => {
  res.json({
    faqs: [
      {
        q: 'Is registration free?',
        a: 'Yes. Registration, profile creation and the first assessment are free. Flamingo charges a ₹699 activation fee per new assignment, deducted once from your first payout for that assignment. You are not charged if you never receive an assignment.'
      },
      {
        q: 'Why is there a ₹699 activation fee?',
        a: 'It funds identity and experience verification, assessment review, contract administration, payment reconciliation and support for each engagement. It is disclosed before you accept an assignment and itemised in your statement, including its GST component.'
      },
      {
        q: 'What are the working-hour rules?',
        a: 'Choose an 8, 10 or 12-hour shift and up to four working days between Tuesday and Saturday. Sunday and Monday are compulsory rest days. You get two 15-minute breaks and one 30-minute break. Combined bookings must stay within 12 hours per day and 48 hours per week.'
      },
      {
        q: 'Can I work with more than one employer?',
        a: 'Yes, provided your combined schedule respects your shift choice, the four-day weekly limit, the 48-hour cap and all applicable legal requirements. Flamingo blocks overlapping bookings automatically.'
      },
      {
        q: 'How many interview rounds are there?',
        a: 'A maximum of two. Round 1 is a panel interview covering experience, professional knowledge and problem solving. Round 2 is the final discussion covering expectations, working arrangements, commitment and selection.'
      },
      {
        q: 'How does payment work?',
        a: 'The standard model is 50% advance when the contract is signed and 50% after completion and formal release. Employer payments are held and allocated through an RBI-authorised payment aggregator in production; this demo simulates the gateway and ledger.'
      },
      {
        q: 'Is my public profile always visible?',
        a: 'No. Your profile becomes searchable only after identity verification and a passed assessment. You can turn public visibility off at any time; your career record, contracts and verified history remain intact.'
      },
      {
        q: 'Does Flamingo use AI to detect AI-written answers?',
        a: 'No. AI detection is not reliable enough to make employment decisions. Flamingo uses timed practical work, live problem-solving, oral verification and human review. Integrity signals are only prompts for a human reviewer.'
      }
    ]
  });
});

router.post(
  '/contact',
  rateLimit({ windowMs: 60 * 60_000, max: 5, scope: 'contact' }),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(2).max(120),
        email: z.string().email().max(200),
        subject: z.string().min(3).max(160),
        message: z.string().min(10).max(3000)
      }),
      req.body
    );
    const id = `msg_${crypto.randomUUID()}`;
    insert('contact_messages', {
      id,
      name: body.name,
      email: body.email,
      subject: body.subject,
      message: body.message,
      status: 'new',
      created_at: nowIso()
    });
    audit(req, { action: 'contact.submitted', entityType: 'contact_message', entityId: id });
    res.status(201).json({
      ok: true,
      reference: id.slice(-8).toUpperCase(),
      message: 'Thank you. Our team will respond within one business day.'
    });
  })
);

export default router;
