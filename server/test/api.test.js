import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import request from 'supertest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flamingo-api-test-'));
process.env.NODE_ENV = 'test';
process.env.FLAMINGO_DATA_DIR = tempDir;
process.env.FLAMINGO_DB = path.join(tempDir, 'flamingo.db');
process.env.FLAMINGO_STORAGE = path.join(tempDir, 'storage');
process.env.DEMO_MODE = 'true';
process.env.DOCUMENT_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

let app;
let agent;
let adminCsrf;

const PASSWORD = 'Flamingo@2026';

beforeAll(async () => {
  execFileSync(process.execPath, [path.join(__dirname, '../src/seed.js')], {
    env: process.env,
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe'
  });
  const { createApp } = await import('../src/app.js');
  app = createApp();
  agent = request.agent(app);
});

afterAll(() => {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // SQLite may still hold the file on Windows; the OS temp cleaner handles it.
  }
});

describe('public API', () => {
  it('reports health and demo mode', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.demoMode).toBe(true);
  });

  it('reports database and storage readiness', async () => {
    const response = await request(app).get('/api/ready').expect(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.checks).toEqual({ database: 'ok', storage: 'ok', scanner: 'simulated' });
  });

  it('publishes transparent terms and pricing policy', async () => {
    const response = await request(app).get('/api/public/config').expect(200);
    expect(response.body.terms.activationFeePaise).toBe(69_900);
    expect(response.body.terms.advancePercent).toBe(50);
    expect(response.body.terms.maxWorkingHoursDay).toBe(12);
    expect(response.body.terms.mandatoryOffDays).toEqual(['SUN', 'MON']);
    expect(response.body.demoNotice).toMatch(/simulated/i);
  });

  it('exposes sourced rate benchmarks with a methodology note', async () => {
    const response = await request(app).get('/api/public/benchmarks').expect(200);
    expect(response.body.benchmarks.length).toBeGreaterThan(5);
    expect(response.body.methodology).toMatch(/sourced market ranges/i);
  });

  it('lists only verified, assessed, public professionals', async () => {
    const response = await request(app).get('/api/marketplace/professionals?limit=50').expect(200);
    expect(response.body.professionals.length).toBeGreaterThan(10);
    for (const professional of response.body.professionals) {
      expect(professional.isPublic).toBe(true);
      expect(professional.assessmentStatus).toBe('passed');
      expect(professional.verificationStatus).toBe('verified');
      expect(professional.email).toBeUndefined();
    }
    expect(response.body.disclosure).toMatch(/seeded demonstration/i);
  });

  it('filters the directory by category and search term', async () => {
    const byCategory = await request(app)
      .get('/api/marketplace/professionals?category=technology')
      .expect(200);
    expect(byCategory.body.professionals.every((item) => item.category === 'technology')).toBe(true);

    const bySearch = await request(app)
      .get('/api/marketplace/professionals?q=Aarav')
      .expect(200);
    expect(bySearch.body.professionals[0].name).toBe('Aarav Mehta');
  });

  it('returns full public profiles without contact details', async () => {
    const response = await request(app).get('/api/marketplace/professionals/pro_1').expect(200);
    expect(response.body.professional.name).toBe('Aarav Mehta');
    expect(response.body.professional.contactShared).toBe(false);
    expect(response.body.professional.email).toBeUndefined();
  });

  it('rate-limits and validates public contact submissions', async () => {
    await request(app)
      .post('/api/public/contact')
      .send({ name: 'A', email: 'not-an-email', subject: 'Hi', message: 'Short' })
      .expect(422);
    const accepted = await request(app)
      .post('/api/public/contact')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        subject: 'Pilot enquiry',
        message: 'We would like to evaluate a flexible analytics pilot.'
      })
      .expect(201);
    expect(accepted.body.reference).toHaveLength(8);
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = await request(app).get('/api/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('not_found');
    expect(response.body.requestId).toBeTruthy();
  });
});

describe('authentication, CSRF and RBAC', () => {
  it('rejects bad credentials without leaking account existence', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassword1' })
      .expect(401);
    expect(response.body.error.message).toBe('Email or password is incorrect.');
  });

  it('signs in an administrator and returns a CSRF token', async () => {
    const response = await agent
      .post('/api/auth/login')
      .send({ email: 'admin@flamingo.work', password: PASSWORD })
      .expect(200);
    expect(response.body.user.role).toBe('admin');
    expect(response.body.csrfToken).toBeTruthy();
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    adminCsrf = response.body.csrfToken;
  });

  it('blocks state-changing requests without a CSRF token', async () => {
    const response = await agent
      .patch('/api/admin/settings')
      .send({ platform_fee_bps: 100 })
      .expect(403);
    expect(response.body.error.message).toMatch(/CSRF/i);
  });

  it('serves the admin dashboard and finance ledger to an administrator', async () => {
    const dashboard = await agent.get('/api/admin/dashboard').expect(200);
    expect(dashboard.body.stats.pendingProfessionals).toBeGreaterThan(0);

    const finance = await agent.get('/api/admin/finance/summary').expect(200);
    expect(finance.body.reconciliation.balanced).toBe(true);
    expect(finance.body.totals.activationBasePaise).toBeGreaterThan(0);
  });

  it('shows exactly the ₹20,000 example in seeded assignment data', async () => {
    const { one } = await import('../src/db.js');
    expect(one('SELECT total_value_paise FROM assignments WHERE id = ?', 'asg_1').total_value_paise).toBe(2_000_000);

    const finance = await agent.get('/api/admin/finance/summary').expect(200);
    const payout = finance.body.payouts.find((item) => item.id === 'po_asg_1_advance');
    expect(payout.gross_paise).toBe(1_000_000);
    expect(payout.activation_fee_paise).toBe(69_900);
    expect(payout.net_paise).toBe(930_100);
    const fee = finance.body.activationFees.find((item) => item.id === 'act_1');
    expect(fee.amount_paise).toBe(69_900);
    expect(fee.base_paise + fee.gst_paise).toBe(69_900);
  });

  it('lets a finance officer view finance but not verification queues', async () => {
    const financeAgent = request.agent(app);
    const login = await financeAgent
      .post('/api/auth/login')
      .send({ email: 'finance@flamingo.work', password: PASSWORD })
      .expect(200);
    expect(login.body.user.adminRole).toBe('finance_officer');
    await financeAgent.get('/api/admin/finance/summary').expect(200);
    await financeAgent.get('/api/admin/verifications/professionals').expect(403);
  });

  it('prevents a professional from calling admin endpoints', async () => {
    const proAgent = request.agent(app);
    await proAgent
      .post('/api/auth/login')
      .send({ email: 'candidate@flamingo.work', password: PASSWORD })
      .expect(200);
    await proAgent.get('/api/admin/dashboard').expect(403);
    await proAgent.get('/api/professional/dashboard').expect(200);
  });

  it('rejects unknown settings keys and persists valid policy changes', async () => {
    await agent
      .patch('/api/admin/settings')
      .set('X-CSRF-Token', adminCsrf)
      .send({ made_up_key: 1 })
      .expect(400);

    const updated = await agent
      .patch('/api/admin/settings')
      .set('X-CSRF-Token', adminCsrf)
      .send({ platform_fee_bps: 200 })
      .expect(200);
    expect(updated.body.settings.platform_fee_bps).toBe(200);

    const reset = await agent
      .patch('/api/admin/settings')
      .set('X-CSRF-Token', adminCsrf)
      .send({ platform_fee_bps: 0 })
      .expect(200);
    expect(reset.body.settings.platform_fee_bps).toBe(0);
  });
});

describe('professional journey', () => {
  let proAgent;
  let csrf;

  beforeAll(async () => {
    proAgent = request.agent(app);
    const login = await proAgent
      .post('/api/auth/login')
      .send({ email: 'candidate@flamingo.work', password: PASSWORD })
      .expect(200);
    csrf = login.body.csrfToken;
  });

  it('returns a populated dashboard and transparent activation fee', async () => {
    const response = await proAgent.get('/api/professional/dashboard').expect(200);
    expect(response.body.profile.name).toBe('Aarav Mehta');
    expect(response.body.earnings.activationFeesPaise).toBe(69_900);
    expect(response.body.earnings.lifetimeNetPaise).toBe(930_100);
    expect(response.body.latestActivationFee.status).toBe('deducted');
  });

  it('lists assessments and refuses a retake after passing', async () => {
    const list = await proAgent.get('/api/professional/assessments').expect(200);
    expect(list.body.recommended.length).toBeGreaterThan(0);
    expect(list.body.integrityNotice).toMatch(/never treated as automated proof/i);

    const retake = await proAgent
      .post('/api/professional/assessments/asm_tech/start')
      .set('X-CSRF-Token', csrf)
      .expect(409);
    expect(retake.body.error.message).toMatch(/already passed/i);
  });

  it('accepts a compliant timesheet and rejects a Sunday entry', async () => {
    const assignments = await proAgent.get('/api/professional/assignments').expect(200);
    const active = assignments.body.assignments.find((item) => item.id === 'asg_1');
    expect(active.status).toBe('active');

    const existing = await proAgent.get('/api/professional/timesheets').expect(200);
    const workDate = latestAllowedDate(
      active.startDate,
      active.endDate,
      active.workingDays,
      existing.body.timesheets.map((item) => item.work_date)
    );
    expect(workDate).toBeTruthy();

    const accepted = await proAgent
      .post('/api/professional/timesheets')
      .set('X-CSRF-Token', csrf)
      .send({
        assignmentId: 'asg_1',
        workDate,
        startTime: '09:30',
        endTime: '18:30',
        breakMinutes: 60
      })
      .expect(201);
    expect(accepted.body.hoursWorked).toBe(8);

    const sunday = nextWeekday('SUN');
    const rejected = await proAgent
      .post('/api/professional/timesheets')
      .set('X-CSRF-Token', csrf)
      .send({
        assignmentId: 'asg_1',
        workDate: sunday,
        startTime: '09:30',
        endTime: '18:30',
        breakMinutes: 60
      })
      .expect(422);
    expect(rejected.body.error.message).toMatch(/not compliant/i);
  });

  it('protects another professional’s documents', async () => {
    const employerAgent = request.agent(app);
    await employerAgent
      .post('/api/auth/login')
      .send({ email: 'employer@flamingo.work', password: PASSWORD })
      .expect(200);
    const response = await employerAgent.get('/api/professional/documents/doc_demo_1/download').expect(403);
    expect(response.body.error.code).toBe('forbidden');
  });
});

describe('employer journey', () => {
  let employerAgent;
  let csrf;

  beforeAll(async () => {
    employerAgent = request.agent(app);
    const login = await employerAgent
      .post('/api/auth/login')
      .send({ email: 'employer@flamingo.work', password: PASSWORD })
      .expect(200);
    csrf = login.body.csrfToken;
  });

  it('returns the employer dashboard with verification gates', async () => {
    const response = await employerAgent.get('/api/employer/dashboard').expect(200);
    expect(response.body.employer.orgName).toBe('Meridian Technologies Pvt. Ltd.');
    expect(response.body.verification.canHire).toBe(true);
    expect(response.body.stats.pendingTimesheets).toBeGreaterThan(0);
  });

  it('shows contact details only after shortlisting', async () => {
    const before = await employerAgent.get('/api/marketplace/professionals/pro_2').expect(200);
    expect(before.body.professional.contactShared).toBe(false);

    await employerAgent
      .post('/api/employer/shortlist')
      .set('X-CSRF-Token', csrf)
      .send({ professionalId: 'pro_2', note: 'Strong design-systems background.' })
      .expect(201);

    const after = await employerAgent.get('/api/marketplace/professionals/pro_2').expect(200);
    expect(after.body.professional.contactShared).toBe(true);
    expect(after.body.professional.email).toBeTruthy();
  });

  it('blocks duplicate shortlisting and unverified employers', async () => {
    await employerAgent
      .post('/api/employer/shortlist')
      .set('X-CSRF-Token', csrf)
      .send({ professionalId: 'pro_2' })
      .expect(409);

    const unverified = request.agent(app);
    const login = await unverified
      .post('/api/auth/login')
      .send({ email: 'studio@verve.demo', password: PASSWORD })
      .expect(200);
    await unverified
      .post('/api/employer/shortlist')
      .set('X-CSRF-Token', login.body.csrfToken)
      .send({ professionalId: 'pro_1' })
      .expect(403);
  });

  it('prevents duplicate advance capture on an already-funded assignment', async () => {
    const response = await employerAgent
      .post('/api/employer/assignments/asg_1/pay')
      .set('X-CSRF-Token', csrf)
      .send({ type: 'advance' })
      .expect(409);
    expect(response.body.error.message).toMatch(/already/i);
  });

  it('blocks final payment before completion approval', async () => {
    const response = await employerAgent
      .post('/api/employer/assignments/asg_1/pay')
      .set('X-CSRF-Token', csrf)
      .send({ type: 'final' })
      .expect(409);
    expect(response.body.error.message).toMatch(/completion/i);
  });

  it('enforces the two-round interview model', async () => {
    const response = await employerAgent
      .post('/api/employer/interviews')
      .set('X-CSRF-Token', csrf)
      .send({
        professionalId: 'pro_1',
        round: 3,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        panel: [{ name: 'Nandini Rao' }]
      })
      .expect(422);
    expect(response.body.error.code).toBe('validation_failed');
  });

  it('refuses hiring without a selected final interview', async () => {
    const response = await employerAgent
      .post('/api/employer/assignments')
      .set('X-CSRF-Token', csrf)
      .send({
        professionalId: 'pro_1',
        title: 'Senior React Engineer',
        scope: 'Deliver a customer onboarding rebuild with documentation and handover.',
        hourlyRatePaise: 1_500_00,
        hoursPerWeek: 20,
        shiftHours: 8,
        workingDays: ['TUE', 'WED'],
        dailyStart: '09:00',
        startDate: '2026-12-01',
        weeks: 4,
        reportingManager: 'Karthik S.',
        deliverables: 'Working onboarding rebuild and handover documentation.'
      })
      .expect(403);
    expect(response.body.error.message).toMatch(/final interview/i);
  });
});

describe('production hardening', () => {
  let proAgent;
  let csrf;

  beforeAll(async () => {
    proAgent = request.agent(app);
    const login = await proAgent
      .post('/api/auth/login')
      .send({ email: 'candidate@flamingo.work', password: PASSWORD })
      .expect(200);
    csrf = login.body.csrfToken;
  });

  it('accepts an upload whose bytes match its declared PDF type', async () => {
    const response = await proAgent
      .post('/api/professional/documents')
      .set('X-CSRF-Token', csrf)
      .field('docType', 'other')
      .attach('file', Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n'), {
        filename: 'hardening-test.pdf',
        contentType: 'application/pdf'
      })
      .expect(201);
    expect(response.body.document.status).toBe('submitted');
    expect(response.body.message).toMatch(/encrypted at rest/i);
  });

  it('rejects an upload whose content is disguised by a safe Content-Type', async () => {
    const response = await proAgent
      .post('/api/professional/documents')
      .set('X-CSRF-Token', csrf)
      .field('docType', 'other')
      .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), {
        filename: 'not-a-pdf.pdf',
        contentType: 'application/pdf'
      })
      .expect(422);
    expect(response.body.error.message).toMatch(/valid PDF/i);
  });

  it('rejects content that does not match the declared image type', async () => {
    const response = await proAgent
      .post('/api/professional/documents')
      .set('X-CSRF-Token', csrf)
      .field('docType', 'other')
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), {
        filename: 'photo.png',
        contentType: 'image/png'
      })
      .expect(422);
    expect(response.body.error.message).toMatch(/does not match/i);
  });

  it('rejects an upload that passes content sniffing but fails the malware scan', async () => {
    const eicar = Buffer.from(
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      'latin1'
    );
    const response = await proAgent
      .post('/api/professional/documents')
      .set('X-CSRF-Token', csrf)
      .field('docType', 'other')
      .attach('file', Buffer.concat([Buffer.from('%PDF-1.7\n'), eicar]), {
        filename: 'signed-contract.pdf',
        contentType: 'application/pdf'
      })
      .expect(422);
    expect(response.body.error.code).toBe('malware_detected');
    expect(response.body.error.message).toMatch(/security scan/i);
  });

  it('records a scan rejection in the audit log', async () => {
    const adminAgent = request.agent(app);
    const login = await adminAgent
      .post('/api/auth/login')
      .send({ email: 'admin@flamingo.work', password: PASSWORD })
      .expect(200);
    const response = await adminAgent
      .get('/api/admin/audit?action=document.scan_rejected')
      .set('X-CSRF-Token', login.body.csrfToken)
      .expect(200);
    const entries = response.body.rows || [];
    expect(entries.some((entry) => entry.action === 'document.scan_rejected')).toBe(true);
  });

  it('closes the admin API until MFA is enrolled when enforcement is on', async () => {
    const { config } = await import('../src/config.js');
    const previous = config.adminMfaEnforced;
    config.adminMfaEnforced = true;
    try {
      const response = await agent.get('/api/admin/dashboard').expect(403);
      expect(response.body.error.code).toBe('mfa_enrollment_required');
    } finally {
      config.adminMfaEnforced = previous;
    }
  });

  it('fails fast on unsafe production configuration', async () => {
    const { config, assertProductionSafety } = await import('../src/config.js');
    const previous = {
      isProduction: config.isProduction,
      documentEncryptionKey: config.documentEncryptionKey,
      secureCookies: config.secureCookies,
      demoMode: config.demoMode,
      adminMfaEnforced: config.adminMfaEnforced,
      secretProvider: config.secretProvider,
      malwareScan: config.malwareScan
    };
    Object.assign(config, {
      isProduction: true,
      documentEncryptionKey: 'too-short',
      secureCookies: false,
      demoMode: true,
      adminMfaEnforced: false,
      secretProvider: 'env',
      malwareScan: { ...config.malwareScan, mode: 'off' }
    });
    try {
      expect(() => assertProductionSafety()).toThrow(/DOCUMENT_ENCRYPTION_KEY/);
      expect(() => assertProductionSafety()).toThrow(/SECURE_COOKIES/);
      expect(() => assertProductionSafety()).toThrow(/DEMO_MODE/);
      expect(() => assertProductionSafety()).toThrow(/MALWARE_SCAN_MODE/);
      expect(() => assertProductionSafety()).toThrow(/SECRET_PROVIDER/);
      config.secretProvider = 'aws';
      config.malwareScan = { ...config.malwareScan, mode: 'clamd' };
      config.demoMode = false;
      expect(() => assertProductionSafety()).toThrow(/REQUIRE_ADMIN_MFA/);
    } finally {
      Object.assign(config, previous);
    }
  });
});

function nextWeekday(day) {
  const order = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const target = new Date();
  target.setUTCHours(0, 0, 0, 0);
  let diff = (order.indexOf(day) - target.getUTCDay() + 7) % 7;
  if (diff === 0) diff = 7;
  target.setUTCDate(target.getUTCDate() + diff);
  return target.toISOString().slice(0, 10);
}

function latestAllowedDate(startDate, endDate, workingDays, exclude = []) {
  const order = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  for (let cursor = end; cursor >= new Date(`${startDate}T00:00:00Z`).getTime(); cursor -= 86_400_000) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    if (workingDays.includes(order[new Date(cursor).getUTCDay()]) && !exclude.includes(date)) {
      return date;
    }
  }
  return null;
}
