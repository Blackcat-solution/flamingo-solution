import crypto from 'node:crypto';
import { hashPassword } from './lib/auth.js';
import { saveEncryptedFile } from './lib/storage.js';
import {
  db,
  insert,
  resetDatabase,
  ensureDefaultSettings,
  nowIso,
  uid
} from './db.js';
import { computePayout, employerInvoice, paymentPlan, activationFee } from './domain/finance.js';
import { getSettings } from './db.js';

const PASSWORD = 'Flamingo@2026';
const passwordHash = hashPassword(PASSWORD);
const now = nowIso();
const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
const daysAhead = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const dateOnly = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

resetDatabase();
ensureDefaultSettings();
const settings = getSettings();

function user({ id, email, name, role = 'professional', adminRole = null, phone = '+91 98765 43210', isDemo = 1, status = 'active' }) {
  insert('users', {
    id,
    email,
    password_hash: passwordHash,
    role,
    admin_role: adminRole,
    name,
    phone,
    status,
    mfa_secret: null,
    mfa_enabled: 0,
    is_demo: isDemo,
    created_at: daysAgo(180),
    last_login_at: null
  });
  return id;
}

// ---------------------------------------------------------------- administrators
user({ id: 'usr_admin_1', email: 'admin@flamingo.work', name: 'Ira Krishnan', role: 'admin', adminRole: 'super_admin', phone: '+91 90000 10001' });
user({ id: 'usr_admin_2', email: 'verification@flamingo.work', name: 'Sameer Bedi', role: 'admin', adminRole: 'verification_officer', phone: '+91 90000 10002' });
user({ id: 'usr_admin_3', email: 'finance@flamingo.work', name: 'Latha Subramanian', role: 'admin', adminRole: 'finance_officer', phone: '+91 90000 10003' });
user({ id: 'usr_admin_4', email: 'support@flamingo.work', name: 'Farah Ansari', role: 'admin', adminRole: 'support', phone: '+91 90000 10004' });

// ---------------------------------------------------------------- employers
const employers = [
  {
    id: 'emp_1',
    userId: 'usr_emp_1',
    email: 'employer@flamingo.work',
    name: 'Nandini Rao',
    org: 'Meridian Technologies Pvt. Ltd.',
    industry: 'Technology / SaaS',
    city: 'Bengaluru',
    size: '250–500',
    gstin: '29AABCM1234F1Z5',
    status: 'verified'
  },
  {
    id: 'emp_2',
    userId: 'usr_emp_2',
    email: 'finance@asterfinance.demo',
    name: 'Pranav Bhatia',
    org: 'Aster Financial Services Ltd.',
    industry: 'Banking & Financial Services',
    city: 'Mumbai',
    size: '1,000+',
    gstin: '27AACCA9876K1Z2',
    status: 'verified'
  },
  {
    id: 'emp_3',
    userId: 'usr_emp_3',
    email: 'people@bloomretail.demo',
    name: 'Tara Sethi',
    org: 'Bloom Retail India Pvt. Ltd.',
    industry: 'E-commerce & Retail',
    city: 'Gurugram',
    size: '500–1,000',
    gstin: '06AABCB4567M1Z8',
    status: 'verified'
  },
  {
    id: 'emp_4',
    userId: 'usr_emp_4',
    email: 'talent@northstarhealth.demo',
    name: 'Dr. Anil Menon',
    org: 'Northstar Health Systems',
    industry: 'Healthcare',
    city: 'Chennai',
    size: '100–250',
    gstin: null,
    status: 'in_review'
  },
  {
    id: 'emp_5',
    userId: 'usr_emp_5',
    email: 'ops@kitelabs.demo',
    name: 'Zoya Merchant',
    org: 'Kite Labs LLP',
    industry: 'Professional Services',
    city: 'Pune',
    size: '50–100',
    gstin: '27AAFCK2345P1Z1',
    status: 'verified'
  },
  {
    id: 'emp_6',
    userId: 'usr_emp_6',
    email: 'studio@verve.demo',
    name: 'Aman Sood',
    org: 'Verve Studios',
    industry: 'Media & Design',
    city: 'Mumbai',
    size: '10–50',
    gstin: null,
    status: 'pending'
  }
];

for (const employer of employers) {
  user({
    id: employer.userId,
    email: employer.email,
    name: employer.name,
    role: 'employer',
    phone: '+91 98200 1122' + employers.indexOf(employer),
    isDemo: 1
  });
  insert('employer_profiles', {
    id: employer.id,
    user_id: employer.userId,
    org_name: employer.org,
    legal_name: employer.org,
    registration_number: `U72900${employer.city.slice(0, 2).toUpperCase()}2019PTC0${100 + employers.indexOf(employer)}`,
    gstin: employer.gstin,
    industry: employer.industry,
    company_size: employer.size,
    website: `https://${employer.org.split(' ')[0].toLowerCase()}.example`,
    registered_address: `Level ${3 + employers.indexOf(employer)}, Prestige Atrium, ${employer.city}, India`,
    city: employer.city,
    state: employer.city === 'Bengaluru' ? 'Karnataka' : employer.city === 'Mumbai' ? 'Maharashtra' : 'Haryana',
    rep_name: employer.name,
    rep_designation: 'Director — People & Operations',
    billing_email: employer.email,
    billing_address: `Accounts Payable, ${employer.org}, ${employer.city}`,
    organisation_history: `${employer.org} has operated in ${employer.industry.toLowerCase()} since 2014 and engages flexible specialists for project peaks.`,
    verification_status: employer.status,
    verification_notes: employer.status === 'verified' ? 'GSTIN, incorporation record and authorised representative verified' : null,
    verified_at: employer.status === 'verified' ? daysAgo(90) : null,
    is_demo: 1,
    created_at: daysAgo(160),
    updated_at: daysAgo(20)
  });
}

// ---------------------------------------------------------------- rate benchmarks
const SOURCES = {
  tech: {
    name: 'Freelancerateindia.com — India freelance full-stack rate benchmarks (Jan–Jul 2026 sample)',
    url: 'https://freelancerateindia.com/calculator/freelance-rate/fullstack-developer',
    asOf: '2026-07-31'
  },
  design: {
    name: 'Karbon Card — Freelance hourly rates: global vs India (2025)',
    url: 'https://www.karboncard.com/blog/freelance-hourly-rate',
    asOf: '2025-06-30'
  },
  salary: {
    name: 'Salary.com Global Salary IQ — freelance developer India (Apr 2025)',
    url: 'https://www.salary.com/research/in/freelance-developer-salary',
    asOf: '2025-04-22'
  },
  ambition: {
    name: 'AmbitionBox India salary bands (2025), converted using Flamingo assumption: ₹/month ÷ 160 × 1.30 contractor loading',
    url: 'https://www.ambitionbox.com/salaries',
    asOf: '2025-12-31'
  }
};

const BENCHMARKS = [
  // technology
  [1, 'technology', 'mid', 700, 1400, 2500, 'tech', 'Published India full-stack range ₹700–₹3,200/hr; mid band is the lower half. Median rounded from the quoted range.'],
  [2, 'technology', 'senior', 1200, 2300, 3200, 'tech', 'Senior band from the published ₹700–₹3,200 range.'],
  [3, 'technology', 'lead', 1800, 3200, 4500, 'tech', 'Lead/specialist rates above the published range cross-checked against Salary.com India (₹302/hr salaried median) with contractor loading.'],
  [4, 'software-testing', 'mid', 600, 1100, 2000, 'tech', 'Derived from published development rates with a 20% QA discount (Flamingo assumption).'],
  [5, 'software-testing', 'senior', 1000, 1800, 2800, 'tech', 'Derived from published development rates with a 20% QA discount (Flamingo assumption).'],
  [6, 'software-testing', 'lead', 1500, 2500, 3500, 'tech', 'Automation/QA lead premium over senior band (Flamingo assumption).'],
  [7, 'design', 'mid', 800, 1600, 2500, 'design', 'Published Indian UI/UX range ₹800–₹4,000/hr; mid band.'],
  [8, 'design', 'senior', 1200, 2500, 3500, 'design', 'Published Indian UI/UX range ₹800–₹4,000/hr; senior band.'],
  [9, 'design', 'lead', 1800, 3200, 4000, 'design', 'Top of the published Indian design range for leads and specialists.'],
  [10, 'graphic-design', 'mid', 600, 1100, 2000, 'design', 'Derived from the published design range (lower graphic/brand band).'],
  [11, 'graphic-design', 'senior', 900, 1700, 2800, 'design', 'Derived from the published design range (senior graphic/brand band).'],
  [12, 'graphic-design', 'lead', 1400, 2400, 3500, 'design', 'Derived from the published design range (creative lead band).'],
  [13, 'hr', 'mid', 450, 900, 1500, 'ambition', 'Derived from AmbitionBox HR manager/generalist annual bands; contractor loading applied.'],
  [14, 'hr', 'senior', 700, 1400, 2200, 'ambition', 'Derived from AmbitionBox senior HR annual bands; contractor loading applied.'],
  [15, 'hr', 'lead', 1100, 2100, 3000, 'ambition', 'Derived from AmbitionBox HR leadership bands; contractor loading applied.'],
  [16, 'recruitment', 'mid', 450, 950, 1600, 'ambition', 'Derived from AmbitionBox talent acquisition bands; contractor loading applied.'],
  [17, 'recruitment', 'senior', 750, 1500, 2400, 'ambition', 'Derived from AmbitionBox senior TA bands; contractor loading applied.'],
  [18, 'recruitment', 'lead', 1100, 2200, 3200, 'ambition', 'Derived from AmbitionBox TA leadership bands; contractor loading applied.'],
  [19, 'marketing', 'mid', 600, 1200, 2000, 'design', 'Published Indian digital marketing/SEO range ₹800–₹3,500/hr; mid band adjusted for full-funnel scope.'],
  [20, 'marketing', 'senior', 900, 1900, 2800, 'design', 'Published Indian digital marketing/SEO range ₹800–₹3,500/hr; senior band.'],
  [21, 'marketing', 'lead', 1400, 2800, 3800, 'design', 'Published Indian SEO/marketing consultant rates up to ₹3,500+/hr; lead band.'],
  [22, 'finance', 'mid', 450, 900, 1500, 'ambition', 'Derived from AmbitionBox accountant/finance analyst bands; contractor loading applied.'],
  [23, 'finance', 'senior', 750, 1450, 2200, 'ambition', 'Derived from AmbitionBox senior finance bands; contractor loading applied.'],
  [24, 'finance', 'lead', 1100, 2100, 3000, 'ambition', 'Derived from AmbitionBox finance controller/CA bands; contractor loading applied.'],
  [25, 'business-development', 'mid', 450, 950, 1600, 'ambition', 'Derived from AmbitionBox sales/BD bands; contractor loading applied.'],
  [26, 'business-development', 'senior', 750, 1500, 2400, 'ambition', 'Derived from AmbitionBox senior BD bands; contractor loading applied.'],
  [27, 'business-development', 'lead', 1100, 2200, 3200, 'ambition', 'Derived from AmbitionBox BD leadership bands; contractor loading applied.'],
  [28, 'administration', 'mid', 350, 650, 1100, 'ambition', 'Derived from AmbitionBox administration bands; contractor loading applied.'],
  [29, 'administration', 'senior', 500, 950, 1500, 'ambition', 'Derived from AmbitionBox senior administration bands; contractor loading applied.'],
  [30, 'administration', 'lead', 750, 1400, 2000, 'ambition', 'Derived from AmbitionBox office management bands; contractor loading applied.'],
  [31, 'operations', 'mid', 400, 800, 1300, 'ambition', 'Derived from AmbitionBox operations bands; contractor loading applied.'],
  [32, 'operations', 'senior', 650, 1300, 1900, 'ambition', 'Derived from AmbitionBox senior operations bands; contractor loading applied.'],
  [33, 'operations', 'lead', 1000, 1900, 2600, 'ambition', 'Derived from AmbitionBox operations leadership bands; contractor loading applied.'],
  [34, 'project-management', 'mid', 700, 1300, 2400, 'ambition', 'Derived from AmbitionBox project manager bands; contractor loading applied.'],
  [35, 'project-management', 'senior', 1100, 2100, 3200, 'ambition', 'Derived from AmbitionBox senior PM bands; contractor loading applied.'],
  [36, 'project-management', 'lead', 1600, 3000, 4200, 'ambition', 'Derived from AmbitionBox programme leadership bands; contractor loading applied.'],
  [37, 'customer-support', 'mid', 300, 600, 1000, 'ambition', 'Derived from AmbitionBox support bands; contractor loading applied.'],
  [38, 'customer-support', 'senior', 450, 900, 1500, 'ambition', 'Derived from AmbitionBox senior support bands; contractor loading applied.'],
  [39, 'customer-support', 'lead', 700, 1300, 2000, 'ambition', 'Derived from AmbitionBox support leadership bands; contractor loading applied.'],
  [40, 'data-analytics', 'mid', 600, 1200, 2200, 'ambition', 'Derived from AmbitionBox data analyst bands; contractor loading applied.'],
  [41, 'data-analytics', 'senior', 900, 1900, 3000, 'ambition', 'Derived from AmbitionBox senior analyst bands; contractor loading applied.'],
  [42, 'data-analytics', 'lead', 1400, 2800, 3800, 'ambition', 'Derived from AmbitionBox data science leadership bands; contractor loading applied.'],
  [43, 'engineering', 'mid', 500, 1000, 1800, 'ambition', 'Derived from AmbitionBox engineering bands; contractor loading applied.'],
  [44, 'engineering', 'senior', 800, 1600, 2500, 'ambition', 'Derived from AmbitionBox senior engineering bands; contractor loading applied.'],
  [45, 'engineering', 'lead', 1200, 2400, 3400, 'ambition', 'Derived from AmbitionBox engineering leadership bands; contractor loading applied.'],
  [46, 'legal', 'mid', 600, 1200, 2200, 'ambition', 'Derived from AmbitionBox legal/compliance bands; contractor loading applied.'],
  [47, 'legal', 'senior', 1000, 1900, 3000, 'ambition', 'Derived from AmbitionBox senior counsel bands; contractor loading applied.'],
  [48, 'legal', 'lead', 1500, 2900, 3800, 'ambition', 'Derived from AmbitionBox legal leadership bands; contractor loading applied.'],
  [49, 'other', 'mid', 400, 800, 1400, 'ambition', 'Fallback benchmark for unlisted professional categories; requires analyst review before use.'],
  [50, 'other', 'senior', 650, 1300, 2100, 'ambition', 'Fallback benchmark for unlisted professional categories; requires analyst review before use.'],
  [51, 'other', 'lead', 1000, 2000, 3000, 'ambition', 'Fallback benchmark for unlisted professional categories; requires analyst review before use.']
];

for (const [index, category, level, min, median, max, sourceKey, notes] of BENCHMARKS) {
  const source = SOURCES[sourceKey];
  insert('rate_benchmarks', {
    id: `bench_${index}`,
    category,
    level,
    min_hourly_paise: min * 100,
    median_hourly_paise: median * 100,
    max_hourly_paise: max * 100,
    demand_index: 1,
    source_name: source.name,
    source_url: source.url,
    as_of: source.asOf,
    notes
  });
}

// ---------------------------------------------------------------- assessments
const ASSESSMENTS = [
  {
    id: 'asm_tech',
    code: 'TECH-CORE-01',
    title: 'Full-Stack Engineering — Applied Core',
    category: 'technology',
    duration: 60,
    questions: [
      {
        type: 'mcq',
        prompt: 'A Node.js API suddenly starts returning 502 errors behind a reverse proxy. The process is alive but event-loop delay is above 2 seconds. Which investigation order is most sound?',
        options: [
          'Restart production immediately, then investigate later',
          'Inspect event-loop blocking work, database connection pool saturation and upstream timeout settings',
          'Increase the server CPU count and close the incident',
          'Disable logging to reduce overhead'
        ],
        correct: 1,
        points: 10,
        tags: ['debugging', 'node']
      },
      {
        type: 'mcq',
        prompt: 'Which HTTP behaviour is correct for an idempotent PUT that creates a resource with a client-supplied identifier?',
        options: [
          'Return 201 on first creation, 200/204 on repeat with the same representation',
          'Return 500 if the resource already exists',
          'Always return 201 and create a duplicate row',
          'Use GET because it is idempotent'
        ],
        correct: 0,
        points: 10,
        tags: ['api', 'rest']
      },
      {
        type: 'mcq',
        prompt: 'A query filters on `tenant_id` and sorts by `created_at DESC` over 40 million rows. Which index is most appropriate?',
        options: [
          'Index on created_at only',
          'Composite index on (tenant_id, created_at DESC)',
          'Index on every column to be safe',
          'No index; add a read replica instead'
        ],
        correct: 1,
        points: 10,
        tags: ['database', 'performance']
      },
      {
        type: 'mcq',
        prompt: 'What is the main security risk of storing a JWT in localStorage?',
        options: [
          'Tokens expire too quickly',
          'Any script running on the page can read it, so XSS becomes session theft',
          'It cannot be sent over HTTPS',
          'It increases database load'
        ],
        correct: 1,
        points: 10,
        tags: ['security']
      },
      {
        type: 'mcq',
        prompt: 'In a code review you find `if (user.role = "admin")`. What is the defect and the correct fix?',
        options: [
          'Assignment instead of comparison; use `===` and add a test',
          'Nothing — JavaScript coerces the value',
          'Only a lint warning; ignore it',
          'Change to `==` for flexibility'
        ],
        correct: 0,
        points: 10,
        tags: ['debugging', 'javascript']
      },
      {
        type: 'mcq',
        prompt: 'A payment webhook is delivered twice. What should the handler do first?',
        options: [
          'Process it again to be safe',
          'Check an idempotency key / event id before mutating financial state',
          'Delete the first payment',
          'Return 500 so the gateway retries'
        ],
        correct: 1,
        points: 10,
        tags: ['payments', 'architecture']
      },
      {
        type: 'mcq',
        prompt: 'Which change most directly improves the reliability of a background job that calls a third-party API?',
        options: [
          'Longer timeouts only',
          'Bounded exponential backoff with jitter, idempotency and a dead-letter queue',
          'Run the job in a tight loop until it succeeds',
          'Disable error logging to reduce noise'
        ],
        correct: 1,
        points: 10,
        tags: ['architecture', 'reliability']
      },
      {
        type: 'practical',
        prompt: 'Practical: Write a SQL query using a window function that returns, for each department, the employee with the highest salary and the salary rank. Explain how you would test it with duplicate salaries.',
        points: 15,
        rubric: 'Correct window function (ROW_NUMBER/RANK), partition by department, deterministic tie-breaking, test plan with duplicates.',
        tags: ['sql', 'database']
      },
      {
        type: 'practical',
        prompt: 'Practical: Describe how you would design an API for employers to post a shift-based requirement. Include validation rules for maximum 12 hours/day, four days/week and no overlapping bookings. Provide request shape, error shape and two edge cases.',
        points: 15,
        rubric: 'Clear schema, server-side validation, conflict detection, timezone handling, error contract, edge cases.',
        tags: ['architecture', 'api']
      }
    ]
  },
  {
    id: 'asm_hr',
    code: 'HR-OPS-01',
    title: 'HR Operations & Talent Advisory',
    category: 'hr',
    duration: 45,
    questions: [
      {
        type: 'mcq',
        prompt: 'A hiring manager asks you to reject a candidate because of their surname. What is the correct response?',
        options: [
          'Follow the manager’s instruction to keep the relationship smooth',
          'Refuse, document the request, and escalate under the equal-opportunity policy',
          'Reject without explanation',
          'Ask the candidate to change their name'
        ],
        correct: 1,
        points: 10,
        tags: ['ethics', 'recruitment']
      },
      {
        type: 'mcq',
        prompt: 'An employee resigns with 45 days’ notice while their contract requires 60 days. Which sequence best protects the organisation?',
        options: [
          'Immediately block their email and withhold all salary',
          'Acknowledge in writing, review notice obligations with legal, plan handover and settle dues per policy',
          'Ignore the resignation until day 60',
          'Accept verbally and make no record'
        ],
        correct: 1,
        points: 10,
        tags: ['hr-ops', 'compliance']
      },
      {
        type: 'mcq',
        prompt: 'Which metric best measures whether a recruitment process is screening efficiently?',
        options: [
          'Total applications received',
          'Interview-to-offer ratio combined with time-to-fill and offer-acceptance rate',
          'Number of job portals used',
          'Recruiter headcount'
        ],
        correct: 1,
        points: 10,
        tags: ['talent-acquisition', 'metrics']
      },
      {
        type: 'mcq',
        prompt: 'A candidate asks for feedback after a rejection. What is the most professional approach?',
        options: [
          'Share panel members’ private notes verbatim',
          'Give specific, respectful, job-related feedback without disclosing confidential panel commentary',
          'Say “we found someone better” and end the call',
          'Do not respond'
        ],
        correct: 1,
        points: 10,
        tags: ['candidate-experience']
      },
      {
        type: 'mcq',
        prompt: 'What is the correct first step when an employee reports harassment?',
        options: [
          'Ask them to confront the person directly',
          'Take a written complaint, explain the process, ensure confidentiality and initiate the formal inquiry',
          'Tell the whole team so everyone is aware',
          'Wait for the annual survey'
        ],
        correct: 1,
        points: 10,
        tags: ['compliance', 'employee-relations']
      },
      {
        type: 'mcq',
        prompt: 'Which onboarding practice most improves 90-day retention?',
        options: [
          'A single induction slide deck',
          'A structured 30/60/90 plan with a named buddy, role clarity and early feedback',
          'Sending a laptop without a start date',
          'Delaying access until month two'
        ],
        correct: 1,
        points: 10,
        tags: ['onboarding']
      },
      {
        type: 'practical',
        prompt: 'Practical: Draft a 10-question structured interview scorecard for a senior recruiter role. Include what “strong evidence” looks like for three questions and how you would avoid bias.',
        points: 20,
        rubric: 'Structured, job-related, anchored rating scale, evidence notes, bias controls.',
        tags: ['interviewing']
      },
      {
        type: 'practical',
        prompt: 'Practical: You must reduce time-to-hire by 25% without lowering quality. Outline a measurement plan, three interventions and the risks you would monitor.',
        points: 20,
        rubric: 'Baseline metrics, funnel diagnosis, interventions, quality guardrails, risk controls.',
        tags: ['hr-ops']
      }
    ]
  },
  {
    id: 'asm_design',
    code: 'DESIGN-UX-01',
    title: 'Product Design & UX Thinking',
    category: 'design',
    duration: 50,
    questions: [
      {
        type: 'mcq',
        prompt: 'A checkout flow has a 62% drop-off at the address step. What is the best first research step?',
        options: [
          'Redesign the whole checkout',
          'Review funnel analytics, session recordings and run 5–8 usability interviews focused on that step',
          'Add a discount pop-up',
          'Copy a competitor’s flow exactly'
        ],
        correct: 1,
        points: 10,
        tags: ['ux-research']
      },
      {
        type: 'mcq',
        prompt: 'Which design choice best supports accessibility for a primary action button?',
        options: [
          'Colour alone to indicate state',
          'A 4.5:1 text contrast ratio, visible focus state and a 44px target',
          'Placeholder text as the only label',
          'Auto-playing animation'
        ],
        correct: 1,
        points: 10,
        tags: ['accessibility']
      },
      {
        type: 'mcq',
        prompt: 'What is the purpose of a design system token such as `colour.surface.raised`?',
        options: [
          'To make CSS longer',
          'To encode a design decision once so it stays consistent across themes and platforms',
          'To replace user research',
          'To reduce the number of components'
        ],
        correct: 1,
        points: 10,
        tags: ['design-systems']
      },
      {
        type: 'mcq',
        prompt: 'A stakeholder insists on a feature with no evidence. What is the most useful response?',
        options: [
          'Refuse to build it',
          'Frame the risk, propose a small testable version and agree the success metric before building',
          'Build it silently and hope it fails',
          'Escalate immediately'
        ],
        correct: 1,
        points: 10,
        tags: ['design-thinking', 'stakeholders']
      },
      {
        type: 'mcq',
        prompt: 'Which combination is the strongest signal that a prototype is ready for usability testing?',
        options: [
          'It is pixel-perfect',
          'The core task can be completed end-to-end and the test script covers realistic goals',
          'Every edge case is designed',
          'It has final copy'
        ],
        correct: 1,
        points: 10,
        tags: ['prototyping']
      },
      {
        type: 'practical',
        prompt: 'Practical: Redesign the “apply for an assignment” experience for an experienced professional who has 10 minutes on mobile. Provide the flow, key screens, microcopy and the three metrics you would track.',
        points: 25,
        rubric: 'Task clarity, mobile constraints, trust and disclosure, accessible microcopy, measurable metrics.',
        tags: ['ux', 'mobile']
      },
      {
        type: 'practical',
        prompt: 'Practical: Create a design critique of a dashboard that shows 18 metrics on one screen. Explain prioritisation, hierarchy and how you would validate the redesign with users.',
        points: 25,
        rubric: 'Information hierarchy, cognitive load, progressive disclosure, validation plan.',
        tags: ['design-thinking']
      }
    ]
  },
  {
    id: 'asm_finance',
    code: 'FIN-ACC-01',
    title: 'Accounting, Reconciliation & Financial Controls',
    category: 'finance',
    duration: 45,
    questions: [
      {
        type: 'mcq',
        prompt: 'A bank statement shows ₹10,000 received but the sales ledger has no entry. What is the correct treatment?',
        options: [
          'Ignore it until year end',
          'Record it as an unidentified receipt, investigate against invoices and reclassify once evidence is obtained',
          'Book it as revenue immediately',
          'Refund it without checking'
        ],
        correct: 1,
        points: 10,
        tags: ['reconciliation', 'controls']
      },
      {
        type: 'mcq',
        prompt: 'Which control best prevents duplicate vendor payments?',
        options: [
          'Paying only on Fridays',
          'Three-way match between purchase order, goods receipt and invoice, plus a uniqueness check on invoice number',
          'Approving by email only',
          'Paying from a personal account'
        ],
        correct: 1,
        points: 10,
        tags: ['accounts-payable']
      },
      {
        type: 'mcq',
        prompt: 'An asset costs ₹1,20,000 with a 5-year useful life and zero residual value. Under straight-line depreciation, what is the monthly charge?',
        options: ['₹2,000', '₹1,000', '₹5,000', '₹10,000'],
        correct: 0,
        points: 10,
        tags: ['accounting']
      },
      {
        type: 'mcq',
        prompt: 'What does a rising days sales outstanding (DSO) most likely indicate?',
        options: [
          'Customers are paying faster',
          'Collections are slowing or credit terms are too loose',
          'Inventory is obsolete',
          'Payroll is increasing'
        ],
        correct: 1,
        points: 10,
        tags: ['analysis']
      },
      {
        type: 'mcq',
        prompt: 'A GST invoice shows taxable value ₹50,000 at 18%. What is the invoice total?',
        options: ['₹50,000', '₹54,000', '₹59,000', '₹68,000'],
        correct: 2,
        points: 10,
        tags: ['gst']
      },
      {
        type: 'mcq',
        prompt: 'What is the purpose of segregating duties between the person who creates a vendor and the person who approves payment?',
        options: [
          'To slow down the process',
          'To reduce the risk of fraudulent or erroneous payments',
          'To satisfy the marketing team',
          'To avoid using accounting software'
        ],
        correct: 1,
        points: 10,
        tags: ['internal-controls']
      },
      {
        type: 'practical',
        prompt: 'Practical: You are reconciling a marketplace ledger with 1,200 transactions. Describe a reconciliation method that handles ₹699 activation deductions, 50% advances, refunds and gateway fees. Include the exception report fields.',
        points: 20,
        rubric: 'Control totals, matching keys, timing differences, fee treatment, exception fields, audit trail.',
        tags: ['reconciliation']
      },
      {
        type: 'practical',
        prompt: 'Practical: Prepare a 3-statement view of why a profitable services company can still run out of cash. Give three ratios you would monitor and the actions you would recommend.',
        points: 20,
        rubric: 'Working capital, DSO/DPO, cash conversion, scenario actions.',
        tags: ['analysis', 'controls']
      }
    ]
  },
  {
    id: 'asm_marketing',
    code: 'MKT-GROWTH-01',
    title: 'Digital Marketing & Growth Analytics',
    category: 'marketing',
    duration: 45,
    questions: [
      {
        type: 'mcq',
        prompt: 'A campaign spends ₹80,000, generates 400 leads and 40 qualified opportunities. What is the cost per qualified opportunity?',
        options: ['₹200', '₹2,000', '₹8,000', '₹20,000'],
        correct: 1,
        points: 10,
        tags: ['analytics']
      },
      {
        type: 'mcq',
        prompt: 'Which experiment design best tests a new landing page?',
        options: [
          'Launch it for everyone and compare this month with last month',
          'Randomise visitors 50/50 and compare a pre-registered primary metric',
          'Ask the sales team which page they prefer',
          'Change three pages at once to save time'
        ],
        correct: 1,
        points: 10,
        tags: ['experimentation']
      },
      {
        type: 'mcq',
        prompt: 'Email open rates fell after Apple’s Mail Privacy Protection. Which metric is now more reliable?',
        options: ['Open rate', 'Click-through rate and conversions', 'List size', 'Send volume'],
        correct: 1,
        points: 10,
        tags: ['email', 'metrics']
      },
      {
        type: 'mcq',
        prompt: 'What is the main risk of optimising only for last-click attribution?',
        options: [
          'It over-credits upper-funnel channels that assist conversion',
          'It over-credits the final touchpoint and under-funds discovery',
          'It measures too many channels',
          'It cannot use UTM parameters'
        ],
        correct: 1,
        points: 10,
        tags: ['attribution']
      },
      {
        type: 'mcq',
        prompt: 'A B2B LinkedIn campaign has high CTR but zero pipeline. What should you investigate first?',
        options: [
          'Increase budget',
          'Audience qualification, landing-page promise and lead follow-up quality',
          'Change the logo',
          'Post more frequently'
        ],
        correct: 1,
        points: 10,
        tags: ['b2b', 'funnel']
      },
      {
        type: 'practical',
        prompt: 'Practical: Build a 30-day launch plan for Flamingo’s employer acquisition in Bengaluru with a ₹3 lakh budget. Include channel mix, funnel assumptions, KPIs and the first experiment.',
        points: 25,
        rubric: 'ICP, channel rationale, budget allocation, measurable KPIs, experiment design, risks.',
        tags: ['strategy']
      },
      {
        type: 'practical',
        prompt: 'Practical: Write a landing-page brief for a ₹699-per-assignment candidate proposition. Cover the objection “why should I pay?” without misleading claims.',
        points: 25,
        rubric: 'Clear value exchange, disclosure, trust, CTA, compliance-aware language.',
        tags: ['copy', 'conversion']
      }
    ]
  },
  {
    id: 'asm_data',
    code: 'DATA-SQL-01',
    title: 'Data Analytics & SQL Reasoning',
    category: 'data-analytics',
    duration: 45,
    questions: [
      {
        type: 'mcq',
        prompt: 'Which SQL clause filters groups after aggregation?',
        options: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
        correct: 1,
        points: 10,
        tags: ['sql']
      },
      {
        type: 'mcq',
        prompt: 'A metric rises 20% after a tracking change. What is the most important first check?',
        options: [
          'Celebrate the growth',
          'Check instrumentation, deduplication and whether the definition changed',
          'Double the ad budget',
          'Remove the new tracking'
        ],
        correct: 1,
        points: 10,
        tags: ['analytics', 'quality']
      },
      {
        type: 'mcq',
        prompt: 'What does a left join return when there is no matching row on the right?',
        options: [
          'The left row with NULLs for right columns',
          'Nothing',
          'Only the right row',
          'An error'
        ],
        correct: 0,
        points: 10,
        tags: ['sql']
      },
      {
        type: 'mcq',
        prompt: 'Which chart best shows the distribution of assignment durations?',
        options: ['Pie chart', 'Histogram', 'Single KPI tile', 'Stacked area chart'],
        correct: 1,
        points: 10,
        tags: ['visualisation']
      },
      {
        type: 'mcq',
        prompt: 'A p-value of 0.04 means:',
        options: [
          'There is a 4% chance the null hypothesis is true',
          'Assuming the null hypothesis, there is a 4% chance of data at least this extreme',
          'The result is practically significant',
          'The experiment is invalid'
        ],
        correct: 1,
        points: 10,
        tags: ['statistics']
      },
      {
        type: 'practical',
        prompt: 'Practical: Write SQL to calculate monthly employer retention for the last 6 months, defining an active employer as one with at least one captured payment in the month. Explain how you handle time zones and partial months.',
        points: 25,
        rubric: 'Cohort logic, date truncation, definition clarity, timezone handling, partial-month notes.',
        tags: ['sql', 'metrics']
      },
      {
        type: 'practical',
        prompt: 'Practical: Design a dashboard for Flamingo’s operations team with 6 metrics, definitions and alert thresholds. Explain why each metric matters and what could mislead a viewer.',
        points: 25,
        rubric: 'Metric definitions, leading/lagging balance, thresholds, misinterpretation risks.',
        tags: ['dashboard']
      }
    ]
  }
];

for (const assessment of ASSESSMENTS) {
  insert('assessments', {
    id: assessment.id,
    code: assessment.code,
    title: assessment.title,
    category: assessment.category,
    level: 'mid',
    description: `Timed, randomised practical assessment for ${assessment.category}. Human review is required for written and practical answers.`,
    duration_minutes: assessment.duration,
    pass_score: 70,
    is_active: 1,
    version: 1,
    created_at: daysAgo(120)
  });
  assessment.questions.forEach((question, index) => {
    insert('assessment_questions', {
      id: `${assessment.id}_q${index + 1}`,
      assessment_id: assessment.id,
      type: question.type,
      prompt: question.prompt,
      options: JSON.stringify(question.options || []),
      correct_option: question.correct ?? null,
      points: question.points,
      rubric: question.rubric || null,
      difficulty: 'mid',
      tags: JSON.stringify(question.tags || [])
    });
  });
}

// ---------------------------------------------------------------- professionals
const professionals = [
  {
    id: 'pro_1', userId: 'usr_pro_1', email: 'candidate@flamingo.work', name: 'Aarav Mehta',
    category: 'technology', title: 'Senior Full-Stack Engineer', city: 'Bengaluru', state: 'Karnataka',
    years: 8, rate: 1450, rating: 4.8, completed: 14, assessment: 'passed', visibility: 1,
    skills: ['Node.js', 'React', 'PostgreSQL', 'AWS', 'System Design'],
    certs: ['AWS Certified Solutions Architect', 'MongoDB Associate Developer'],
    education: 'B.Tech, Computer Science — NIT Trichy',
    industry: 'Technology / SaaS', rehire: 86,
    bio: 'Full-stack engineer with eight years building payment and marketplace platforms. I join product teams for delivery peaks, architecture reviews and hands-on implementation, and I document everything so your team can own it afterwards.'
  },
  {
    id: 'pro_2', userId: 'usr_pro_2', email: 'ananya.iyer@demo.flamingo.work', name: 'Ananya Iyer',
    category: 'design', title: 'Senior Product Designer', city: 'Bengaluru', state: 'Karnataka',
    years: 6, rate: 1250, rating: 4.7, completed: 9, assessment: 'passed', visibility: 1,
    skills: ['UX Research', 'Figma', 'Design Systems', 'Accessibility'],
    certs: ['Nielsen Norman UX Certification'],
    education: 'M.Des, Industrial Design — IIT Bombay',
    industry: 'Media & Design', rehire: 78,
    bio: 'Product designer focused on complex B2B workflows. I run lean research, prototype quickly and leave teams with a usable design system rather than a one-off screen.'
  },
  {
    id: 'pro_3', userId: 'usr_pro_3', email: 'rohan.kulkarni@demo.flamingo.work', name: 'Rohan Kulkarni',
    category: 'finance', title: 'Finance & Controls Lead', city: 'Pune', state: 'Maharashtra',
    years: 9, rate: 1100, rating: 4.6, completed: 11, assessment: 'passed', visibility: 1,
    skills: ['Reconciliation', 'Ind AS', 'GST', 'Internal Controls', 'Excel'],
    certs: ['Chartered Accountant (ICAI)'],
    education: 'CA — Institute of Chartered Accountants of India',
    industry: 'Banking & Financial Services', rehire: 82,
    bio: 'Chartered Accountant specialising in marketplace reconciliations, revenue recognition and control design. I have closed books for companies from seed stage to listed group entities.'
  },
  {
    id: 'pro_4', userId: 'usr_pro_4', email: 'meera.nair@demo.flamingo.work', name: 'Meera Nair',
    category: 'hr', title: 'HR Business Partner', city: 'Kochi', state: 'Kerala',
    years: 7, rate: 950, rating: 4.5, completed: 8, assessment: 'passed', visibility: 1,
    skills: ['Employee Relations', 'HR Operations', 'Policy Design', 'Onboarding'],
    certs: ['SHRM-CP'],
    education: 'MBA, Human Resources — XLRI',
    industry: 'Healthcare', rehire: 75,
    bio: 'HR business partner with seven years across healthcare and services. I support founders and people leaders with practical policy, manager coaching and compliant employee relations.'
  },
  {
    id: 'pro_5', userId: 'usr_pro_5', email: 'kabir.singh@demo.flamingo.work', name: 'Kabir Singh',
    category: 'recruitment', title: 'Talent Acquisition Specialist', city: 'Gurugram', state: 'Haryana',
    years: 5, rate: 850, rating: 4.4, completed: 7, assessment: 'passed', visibility: 1,
    skills: ['Technical Recruiting', 'Structured Interviews', 'Sourcing', 'ATS'],
    certs: ['LinkedIn Recruiter Certified'],
    education: 'B.Com — Delhi University',
    industry: 'E-commerce & Retail', rehire: 71,
    bio: 'Technical recruiter who builds calibrated, structured hiring pipelines. I have hired across engineering, data and product roles for high-growth Indian startups.'
  },
  {
    id: 'pro_6', userId: 'usr_pro_6', email: 'sneha.reddy@demo.flamingo.work', name: 'Sneha Reddy',
    category: 'data-analytics', title: 'Senior Data Analyst', city: 'Hyderabad', state: 'Telangana',
    years: 6, rate: 1300, rating: 4.6, completed: 6, assessment: 'passed', visibility: 1,
    skills: ['SQL', 'Python', 'dbt', 'Tableau', 'Experimentation'],
    certs: ['Google Analytics 4 Certification'],
    education: 'M.Sc. Statistics — University of Hyderabad',
    industry: 'Technology / SaaS', rehire: 67,
    bio: 'Analyst who turns ambiguous questions into measurable, trustworthy dashboards. I work with product and operations teams on experimentation, retention and marketplace metrics.'
  },
  {
    id: 'pro_7', userId: 'usr_pro_7', email: 'arjun.desai@demo.flamingo.work', name: 'Arjun Desai',
    category: 'software-testing', title: 'QA Automation Engineer', city: 'Ahmedabad', state: 'Gujarat',
    years: 5, rate: 900, rating: 4.3, completed: 5, assessment: 'passed', visibility: 1,
    skills: ['Playwright', 'API Testing', 'Test Strategy', 'CI/CD'],
    certs: ['ISTQB Foundation'],
    education: 'B.E. Information Technology — GTU',
    industry: 'Technology / SaaS', rehire: 60,
    bio: 'Automation-first QA engineer. I build reliable test suites, test data strategies and release gates that catch regressions without slowing delivery.'
  },
  {
    id: 'pro_8', userId: 'usr_pro_8', email: 'priya.sharma@demo.flamingo.work', name: 'Priya Sharma',
    category: 'marketing', title: 'Growth Marketing Manager', city: 'Mumbai', state: 'Maharashtra',
    years: 8, rate: 1200, rating: 4.5, completed: 10, assessment: 'passed', visibility: 1,
    skills: ['Performance Marketing', 'SEO', 'Analytics', 'Lifecycle Marketing'],
    certs: ['Google Ads Measurement', 'HubSpot Inbound'],
    education: 'MBA, Marketing — NMIMS',
    industry: 'E-commerce & Retail', rehire: 70,
    bio: 'Growth marketer with a bias for measurement. I have run paid and organic acquisition for D2C and B2B teams, with a focus on qualified pipeline rather than vanity metrics.'
  },
  {
    id: 'pro_9', userId: 'usr_pro_9', email: 'vikram.rao@demo.flamingo.work', name: 'Vikram Rao',
    category: 'project-management', title: 'Programme Manager', city: 'Chennai', state: 'Tamil Nadu',
    years: 12, rate: 2000, rating: 4.9, completed: 18, assessment: 'passed', visibility: 1,
    skills: ['Programme Delivery', 'Agile', 'Risk Management', 'Stakeholder Management'],
    certs: ['PMP', 'SAFe Agilist'],
    education: 'MBA, Operations — IIM Kozhikode',
    industry: 'Healthcare', rehire: 89,
    bio: 'Programme leader with twelve years delivering cross-functional technology and operations change. I stabilise troubled engagements and build delivery cadence that lasts.'
  },
  {
    id: 'pro_10', userId: 'usr_pro_10', email: 'neha.gupta@demo.flamingo.work', name: 'Neha Gupta',
    category: 'graphic-design', title: 'Brand & Visual Designer', city: 'New Delhi', state: 'Delhi',
    years: 4, rate: 800, rating: 4.2, completed: 3, assessment: 'passed', visibility: 1,
    skills: ['Brand Identity', 'Illustrator', 'Photoshop', 'Social Design'],
    certs: [],
    education: 'BFA, Visual Communication — College of Art, Delhi',
    industry: 'Media & Design', rehire: 55,
    bio: 'Visual designer crafting brand identities and campaign systems. I work quickly with founders and marketing teams who need distinctive, production-ready assets.'
  },
  {
    id: 'pro_11', userId: 'usr_pro_11', email: 'aditya.joshi@demo.flamingo.work', name: 'Aditya Joshi',
    category: 'operations', title: 'Operations Manager', city: 'Indore', state: 'Madhya Pradesh',
    years: 6, rate: 750, rating: 4.1, completed: 4, assessment: 'passed', visibility: 1,
    skills: ['Process Design', 'Vendor Management', 'SOPs', 'Cost Control'],
    certs: ['Lean Six Sigma Green Belt'],
    education: 'B.E. Mechanical — DAVV',
    industry: 'E-commerce & Retail', rehire: 50,
    bio: 'Operations generalist who brings structure to fast-growing teams. I map processes, remove bottlenecks and document SOPs your team will actually use.'
  },
  {
    id: 'pro_12', userId: 'usr_pro_12', email: 'ishita.bose@demo.flamingo.work', name: 'Ishita Bose',
    category: 'legal', title: 'Legal & Compliance Counsel', city: 'Kolkata', state: 'West Bengal',
    years: 10, rate: 1800, rating: 4.7, completed: 7, assessment: 'passed', visibility: 1,
    skills: ['Contract Drafting', 'Data Protection', 'Employment Law', 'Corporate Compliance'],
    certs: ['Bar Council of India'],
    education: 'LL.M., Commercial Law — NUJS',
    industry: 'Professional Services', rehire: 72,
    bio: 'Commercial and employment counsel with ten years advising technology companies. I focus on practical contracts, data protection readiness and defensible policies.'
  },
  {
    id: 'pro_13', userId: 'usr_pro_13', email: 'rahul.verma@demo.flamingo.work', name: 'Rahul Verma',
    category: 'engineering', title: 'Mechanical Design Engineer', city: 'Noida', state: 'Uttar Pradesh',
    years: 7, rate: 1000, rating: 4.4, completed: 5, assessment: 'passed', visibility: 1,
    skills: ['SolidWorks', 'GD&T', 'DFM', 'Prototyping'],
    certs: ['SolidWorks Professional'],
    education: 'B.Tech, Mechanical — NIT Kurukshetra',
    industry: 'Engineering', rehire: 62,
    bio: 'Mechanical design engineer with production experience in consumer products. I take concepts from sketch to manufacturable CAD with tolerance and cost discipline.'
  },
  {
    id: 'pro_14', userId: 'usr_pro_14', email: 'kavya.menon@demo.flamingo.work', name: 'Kavya Menon',
    category: 'customer-support', title: 'Customer Experience Lead', city: 'Kochi', state: 'Kerala',
    years: 4, rate: 550, rating: 4.3, completed: 4, assessment: 'passed', visibility: 1,
    skills: ['Customer Support', 'CRM', 'Escalation Management', 'Quality Audit'],
    certs: [],
    education: 'B.A. English — University of Kerala',
    industry: 'E-commerce & Retail', rehire: 58,
    bio: 'Customer experience specialist who builds calm, effective support operations. I write macros, design escalations and coach agents on clear communication.'
  },
  {
    id: 'pro_15', userId: 'usr_pro_15', email: 'siddharth.malhotra@demo.flamingo.work', name: 'Siddharth Malhotra',
    category: 'business-development', title: 'Partnerships & BD Manager', city: 'Mumbai', state: 'Maharashtra',
    years: 6, rate: 1050, rating: 4.4, completed: 6, assessment: 'passed', visibility: 1,
    skills: ['Partnerships', 'B2B Sales', 'Negotiation', 'Pipeline Management'],
    certs: [],
    education: 'BBA — Christ University',
    industry: 'Technology / SaaS', rehire: 64,
    bio: 'Partnerships lead who builds win-win commercial structures. I open enterprise doors, run disciplined pipelines and negotiate agreements that survive delivery.'
  },
  {
    id: 'pro_16', userId: 'usr_pro_16', email: 'tanvi.shah@demo.flamingo.work', name: 'Tanvi Shah',
    category: 'administration', title: 'Executive Assistant & Office Manager', city: 'Ahmedabad', state: 'Gujarat',
    years: 5, rate: 600, rating: 4.2, completed: 3, assessment: 'passed', visibility: 1,
    skills: ['Executive Support', 'Calendar Management', 'Travel', 'Vendor Coordination'],
    certs: [],
    education: 'B.Com — Gujarat University',
    industry: 'Professional Services', rehire: 52,
    bio: 'Executive assistant supporting founders and leadership teams. Discreet, organised and comfortable coordinating complex travel, calendars and vendors.'
  },
  {
    id: 'pro_17', userId: 'usr_pro_17', email: 'dev.patel@demo.flamingo.work', name: 'Dev Patel',
    category: 'technology', title: 'Frontend Developer', city: 'Pune', state: 'Maharashtra',
    years: 4, rate: 900, rating: 0, completed: 0, assessment: 'failed', visibility: 0,
    skills: ['React', 'TypeScript', 'CSS'],
    certs: [],
    education: 'B.E. Computer Engineering — Savitribai Phule Pune University',
    industry: 'Technology / SaaS', rehire: 0,
    bio: 'Frontend developer focused on accessible, fast interfaces. Currently completing the Flamingo technical assessment.'
  },
  {
    id: 'pro_18', userId: 'usr_pro_18', email: 'ritika.jain@demo.flamingo.work', name: 'Ritika Jain',
    category: 'finance', title: 'Accounts Executive', city: 'Jaipur', state: 'Rajasthan',
    years: 3, rate: 650, rating: 0, completed: 0, assessment: 'in_progress', visibility: 0,
    skills: ['Accounts Payable', 'Tally', 'Bank Reconciliation'],
    certs: [],
    education: 'M.Com — University of Rajasthan',
    industry: 'Finance & Accounting', rehire: 0,
    bio: 'Accounts professional with three years in payables and reconciliation. Completing identity verification and the Flamingo finance assessment.'
  },
  {
    id: 'pro_19', userId: 'usr_pro_19', email: 'harsh.vardhan@demo.flamingo.work', name: 'Harsh Vardhan',
    category: 'engineering', title: 'Principal Systems Engineer', city: 'Hyderabad', state: 'Telangana',
    years: 15, rate: 2200, rating: 4.8, completed: 21, assessment: 'passed', visibility: 1,
    skills: ['Systems Architecture', 'Embedded', 'Reliability', 'Technical Leadership'],
    certs: ['Six Sigma Black Belt'],
    education: 'M.Tech, Systems Engineering — BITS Pilani',
    industry: 'Engineering', rehire: 90,
    bio: 'Principal engineer with fifteen years across embedded and systems programmes. I join teams for architecture reviews, reliability programmes and technical mentoring.'
  },
  {
    id: 'pro_20', userId: 'usr_pro_20', email: 'aisha.khan@demo.flamingo.work', name: 'Aisha Khan',
    category: 'hr', title: 'Head of People (Interim)', city: 'New Delhi', state: 'Delhi',
    years: 11, rate: 1600, rating: 4.7, completed: 12, assessment: 'passed', visibility: 1,
    skills: ['People Strategy', 'Org Design', 'Compensation', 'Change Management'],
    certs: ['SHRM-SCP', 'ICF Associate Coach'],
    education: 'MBA, HR — FMS Delhi',
    industry: 'Professional Services', rehire: 84,
    bio: 'Interim people leader for scaling organisations. I design org structures, compensation frameworks and manager capability programmes without adding permanent overhead.'
  },
  {
    id: 'pro_21', userId: 'usr_pro_21', email: 'manish.tiwari@demo.flamingo.work', name: 'Manish Tiwari',
    category: 'recruitment', title: 'Recruitment Coordinator', city: 'Bengaluru', state: 'Karnataka',
    years: 3, rate: 600, rating: 4.0, completed: 2, assessment: 'passed', visibility: 0,
    skills: ['Scheduling', 'Candidate Experience', 'ATS', 'Sourcing'],
    certs: [],
    education: 'BBA, HR — Bangalore University',
    industry: 'Technology / SaaS', rehire: 0,
    bio: 'Recruitment coordinator with three years supporting high-volume technical hiring. Strong on candidate experience and scheduling discipline.'
  },
  {
    id: 'pro_22', userId: 'usr_pro_22', email: 'shreya.kapoor@demo.flamingo.work', name: 'Shreya Kapoor',
    category: 'design', title: 'Design Lead — Brand Systems', city: 'Mumbai', state: 'Maharashtra',
    years: 9, rate: 1900, rating: 4.8, completed: 13, assessment: 'passed', visibility: 1,
    skills: ['Brand Systems', 'Art Direction', 'Design Ops', 'Motion'],
    certs: ['Adobe Certified Professional'],
    education: 'M.A. Communication Design — IDC IIT Bombay',
    industry: 'Media & Design', rehire: 86,
    bio: 'Design lead building brand systems for companies that have outgrown their first identity. I combine art direction with the operational discipline of a design system.'
  },
  {
    id: 'pro_23', userId: 'usr_pro_23', email: 'nikhil.rana@demo.flamingo.work', name: 'Nikhil Rana',
    category: 'data-analytics', title: 'Business Intelligence Analyst', city: 'Gurugram', state: 'Haryana',
    years: 4, rate: 850, rating: 4.1, completed: 3, assessment: 'passed', visibility: 0,
    skills: ['Power BI', 'SQL', 'DAX', 'Data Modelling'],
    certs: ['Microsoft PL-300'],
    education: 'B.Tech, IT — MDU Rohtak',
    industry: 'E-commerce & Retail', rehire: 0,
    bio: 'BI analyst who builds models leaders can trust. I tidy messy source data, define metrics once and publish dashboards with clear ownership.'
  },
  {
    id: 'pro_24', userId: 'usr_pro_24', email: 'pooja.deshmukh@demo.flamingo.work', name: 'Pooja Deshmukh',
    category: 'marketing', title: 'Content Marketing Strategist', city: 'Pune', state: 'Maharashtra',
    years: 3, rate: 700, rating: 0, completed: 0, assessment: 'not_started', visibility: 0,
    skills: ['Content Strategy', 'SEO Writing', 'Editorial'],
    certs: [],
    education: 'B.A. Journalism — Symbiosis',
    industry: 'Media & Design', rehire: 0,
    bio: 'Content strategist focused on B2B editorial that earns trust. Building a Flamingo career record.'
  }
];

const verifiedProfileIds = new Set(['pro_1', 'pro_2', 'pro_3', 'pro_4', 'pro_5', 'pro_6', 'pro_7', 'pro_8', 'pro_9', 'pro_10', 'pro_11', 'pro_12', 'pro_13', 'pro_14', 'pro_15', 'pro_16', 'pro_19', 'pro_20', 'pro_22']);

for (const [index, pro] of professionals.entries()) {
  user({ id: pro.userId, email: pro.email, name: pro.name, role: 'professional', phone: `+91 98${String(76500000 + index * 137).slice(0, 8)}` });
  const verified = verifiedProfileIds.has(pro.id);
  const publicProfile = verified && pro.visibility === 1;
  insert('professional_profiles', {
    id: pro.id,
    user_id: pro.userId,
    headline: pro.title,
    category: pro.category,
    bio: pro.bio,
    city: pro.city,
    state: pro.state,
    country: 'India',
    years_experience: pro.years,
    current_title: pro.title,
    current_employer: null,
    education: pro.education,
    languages: JSON.stringify(['English', 'Hindi', index % 3 === 0 ? 'Marathi' : 'Tamil']),
    skills: JSON.stringify(pro.skills),
    certifications: JSON.stringify(pro.certs),
    portfolio_url: pro.category === 'design' ? `https://portfolio.example/${pro.id}` : null,
    linkedin_url: `https://linkedin.com/in/${pro.name.toLowerCase().replace(/\s+/g, '-')}-demo`,
    hourly_rate_paise: pro.rate * 100,
    recommended_rate_paise: Math.round(pro.rate * 100 * 1.02 / 1000) * 1000,
    availability_days: JSON.stringify(['TUE', 'WED', 'THU', 'FRI']),
    shift_hours: index % 3 === 0 ? 8 : index % 3 === 1 ? 10 : 8,
    preferred_start: '09:30',
    preferred_end: '18:30',
    minimum_experience_met: 1,
    notice_period_days: 7,
    salary_expectation_paise: pro.rate * 160 * 100,
    photo_url: null,
    resume_document_id: null,
    is_public: publicProfile ? 1 : 0,
    identity_status: verified ? 'verified' : pro.id === 'pro_18' ? 'submitted' : 'pending',
    verification_status: verified ? 'verified' : pro.id === 'pro_18' ? 'in_review' : 'pending',
    assessment_status: pro.assessment,
    profile_status: publicProfile ? 'approved' : verified ? 'approved' : 'submitted',
    rating: pro.rating,
    completed_assignments: pro.completed,
    rehire_rate: pro.rehire,
    is_demo: 1,
    created_at: daysAgo(150 - index * 3),
    updated_at: daysAgo(10)
  });

  if (pro.years >= 3) {
    insert('employment_history', {
      id: `eh_${pro.id}_1`,
      professional_id: pro.id,
      employer_name: pro.id === 'pro_1' ? 'Northline Payments' : 'Cobalt Consulting',
      title: pro.title,
      start_date: `${2020 + (index % 3)}-04-01`,
      end_date: `${2024 + (index % 2)}-03-31`,
      is_current: index % 4 === 0 ? 1 : 0,
      description: `Delivered ${pro.skills.slice(0, 3).join(', ')} work for cross-functional teams.`,
      verified: verified ? 1 : 0,
      verified_at: verified ? daysAgo(100) : null,
      created_at: daysAgo(140)
    });
  }
  insert('professional_references', {
    id: `ref_${pro.id}_1`,
    professional_id: pro.id,
    name: index % 2 === 0 ? 'Ritu Malhotra' : 'Karan Shah',
    company: 'Northline Payments',
    title: 'VP Engineering',
    email: `reference${index}@example.com`,
    phone: '+91 99000 11122',
    relationship: 'Reporting manager',
    status: verified ? 'verified' : 'invited',
    created_at: daysAgo(130)
  });
}

// Encrypted identity and resume documents for the primary demo professional.
const docSeed = [
  { id: 'doc_demo_1', type: 'identity_proof', filename: 'aarav-mehta-pan.txt', content: 'DEMONSTRATION DOCUMENT — PAN card placeholder for Aarav Mehta. Not a real identity document.' },
  { id: 'doc_demo_2', type: 'resume', filename: 'aarav-mehta-resume.txt', content: 'DEMONSTRATION RESUME — Aarav Mehta, Senior Full-Stack Engineer, 8 years experience.' }
];
for (const [index, doc] of docSeed.entries()) {
  const storageKey = `demo/${doc.id}.txt`;
  const { iv, authTag } = saveEncryptedFile(Buffer.from(doc.content, 'utf8'), storageKey);
  insert('documents', {
    id: doc.id,
    owner_type: 'professional',
    owner_id: 'pro_1',
    doc_type: doc.type,
    filename: doc.filename,
    mime_type: 'text/plain',
    size_bytes: Buffer.byteLength(doc.content),
    storage_key: storageKey,
    iv,
    auth_tag: authTag,
    status: 'verified',
    reviewer_id: 'usr_admin_2',
    reviewed_at: daysAgo(60),
    review_notes: 'Demonstration record',
    created_at: daysAgo(70)
  });
}
db.prepare('UPDATE professional_profiles SET resume_document_id = ? WHERE id = ?').run('doc_demo_2', 'pro_1');

// Assessment attempts for demo profiles
const attemptSpecs = [
  { prof: 'pro_1', assessment: 'asm_tech', score: 86, status: 'passed', days: 55 },
  { prof: 'pro_2', assessment: 'asm_design', score: 81, status: 'passed', days: 48 },
  { prof: 'pro_3', assessment: 'asm_finance', score: 78, status: 'passed', days: 44 },
  { prof: 'pro_4', assessment: 'asm_hr', score: 84, status: 'passed', days: 41 },
  { prof: 'pro_5', assessment: 'asm_hr', score: 73, status: 'passed', days: 39 },
  { prof: 'pro_6', assessment: 'asm_data', score: 88, status: 'passed', days: 36 },
  { prof: 'pro_7', assessment: 'asm_tech', score: 71, status: 'passed', days: 34 },
  { prof: 'pro_8', assessment: 'asm_marketing', score: 79, status: 'passed', days: 33 },
  { prof: 'pro_9', assessment: 'asm_data', score: 76, status: 'passed', days: 30 },
  { prof: 'pro_17', assessment: 'asm_tech', score: 54, status: 'failed', days: 22 },
  { prof: 'pro_18', assessment: 'asm_finance', score: null, status: 'in_progress', days: 2 },
  { prof: 'pro_24', assessment: 'asm_marketing', score: 68, status: 'human_review', days: 1 }
];
for (const [index, spec] of attemptSpecs.entries()) {
  const isInProgress = spec.status === 'in_progress';
  const isHumanReview = spec.status === 'human_review';
  insert('assessment_attempts', {
    id: `att_demo_${index + 1}`,
    assessment_id: spec.assessment,
    professional_id: spec.prof,
    attempt_no: 1,
    status: spec.status,
    started_at: daysAgo(spec.days),
    expires_at: isInProgress ? daysAhead(1) : daysAgo(spec.days - 1),
    submitted_at: isInProgress ? null : daysAgo(spec.days),
    auto_score: spec.score,
    final_score: isInProgress || isHumanReview ? null : spec.score,
    pass_mark: 70,
    integrity_score: isHumanReview ? 78 : 96,
    integrity_flags: isHumanReview
      ? JSON.stringify([{ type: 'paste', count: 1 }, { type: 'focus_lost', count: 2 }])
      : '[]',
    reviewer_id: isInProgress || isHumanReview ? null : 'usr_admin_2',
    reviewed_at: isInProgress || isHumanReview ? null : daysAgo(spec.days - 1),
    review_notes: isInProgress ? null : isHumanReview ? null : 'Practical answers reviewed against published rubric.',
    feedback: isInProgress ? null : isHumanReview ? null : 'Strong practical reasoning. Keep documenting trade-offs explicitly.',
    question_order: '[]'
  });
  if (isHumanReview) {
    db.prepare("UPDATE professional_profiles SET assessment_status = 'in_progress' WHERE id = ?").run(spec.prof);
  }
}

// ---------------------------------------------------------------- requirements, shortlists, interviews
const requirements = [
  { id: 'req_1', employer: 'emp_1', title: 'Senior React Engineer — 12-week platform build', category: 'technology', skills: ['React', 'TypeScript', 'GraphQL'], hours: 32, shift: 8, days: ['TUE', 'WED', 'THU', 'FRI'], budget: 1600, status: 'open', weeks: 12, description: 'Join the payments platform team to deliver a customer onboarding rebuild. You will own frontend architecture, pair with two engineers and hand over documentation.' },
  { id: 'req_2', employer: 'emp_1', title: 'Interim QA Lead — release readiness', category: 'software-testing', skills: ['Playwright', 'Test Strategy', 'API Testing'], hours: 20, shift: 10, days: ['WED', 'THU'], budget: 1100, status: 'open', weeks: 6, description: 'Establish a pragmatic release gate and automate the highest-risk regression paths.' },
  { id: 'req_3', employer: 'emp_2', title: 'Finance Controls Specialist — reconciliation sprint', category: 'finance', skills: ['Reconciliation', 'GST', 'Controls'], hours: 24, shift: 8, days: ['TUE', 'WED', 'THU'], budget: 1200, status: 'open', weeks: 8, description: 'Clean up marketplace reconciliations and document a repeatable month-end close.' },
  { id: 'req_4', employer: 'emp_3', title: 'People Operations Partner — policy refresh', category: 'hr', skills: ['HR Operations', 'Policy Design', 'Compliance'], hours: 30, shift: 10, days: ['TUE', 'WED', 'THU', 'FRI'], budget: 1000, status: 'filled', weeks: 10, description: 'Refresh the employee handbook and manager guides for a 700-person retail workforce.' },
  { id: 'req_5', employer: 'emp_5', title: 'Data Analyst — marketplace metrics', category: 'data-analytics', skills: ['SQL', 'dbt', 'Dashboarding'], hours: 24, shift: 8, days: ['TUE', 'WED', 'THU'], budget: 1300, status: 'open', weeks: 6, description: 'Define and instrument the core marketplace metrics for an operations team.' }
];

for (const [index, req] of requirements.entries()) {
  insert('job_requirements', {
    id: req.id,
    employer_id: req.employer,
    title: req.title,
    category: req.category,
    description: req.description,
    skills: JSON.stringify(req.skills),
    min_experience: 5,
    hours_per_week: req.hours,
    shift_hours: req.shift,
    working_days: JSON.stringify(req.days),
    start_date: dateOnly(7 + index * 3),
    duration_weeks: req.weeks,
    budget_hourly_paise: req.budget * 100,
    status: req.status,
    created_at: daysAgo(26 - index * 2),
    updated_at: daysAgo(3)
  });
}

const shortlistSpecs = [
  ['sl_1', 'emp_1', 'pro_1', 'req_1', 'Strong marketplace payments background. Available from next Tuesday.'],
  ['sl_2', 'emp_1', 'pro_17', 'req_1', 'Frontend-focused; assessment not yet passed — keep on watchlist.'],
  ['sl_3', 'emp_1', 'pro_6', 'req_2', 'Analytics depth plus QA collaboration experience.'],
  ['sl_4', 'emp_2', 'pro_3', 'req_3', 'CA with direct marketplace reconciliation experience.'],
  ['sl_5', 'emp_5', 'pro_6', 'req_5', 'Strong SQL and marketplace metric design.']
];
for (const [id, employer, professional, requirement, note] of shortlistSpecs) {
  insert('shortlists', {
    id,
    employer_id: employer,
    professional_id: professional,
    requirement_id: requirement,
    note,
    created_at: daysAgo(12)
  });
}

insert('interviews', {
  id: 'int_1',
  employer_id: 'emp_1',
  professional_id: 'pro_1',
  requirement_id: 'req_1',
  round: 1,
  scheduled_at: daysAhead(2),
  duration_minutes: 45,
  mode: 'video',
  meeting_url: 'https://meet.example/flamingo-meridian-round1',
  panel: JSON.stringify([{ name: 'Nandini Rao', role: 'Director — People & Operations' }, { name: 'Karthik S.', role: 'Engineering Manager' }]),
  status: 'scheduled',
  notes: 'Round 1: experience, professional knowledge and problem-solving.',
  outcome: null,
  created_by: 'usr_emp_1',
  created_at: daysAgo(3)
});
insert('interviews', {
  id: 'int_2',
  employer_id: 'emp_6',
  professional_id: 'pro_2',
  requirement_id: null,
  round: 1,
  scheduled_at: daysAgo(18),
  duration_minutes: 45,
  mode: 'video',
  meeting_url: null,
  panel: JSON.stringify([{ name: 'Aman Sood', role: 'Founder' }]),
  status: 'completed',
  notes: 'Portfolio walkthrough.',
  outcome: 'advanced',
  created_by: 'usr_emp_6',
  created_at: daysAgo(24)
});
insert('scorecards', {
  id: 'sc_1',
  interview_id: 'int_2',
  panel_user_id: 'usr_emp_6',
  panel_name: 'Aman Sood',
  scores: JSON.stringify({ experience: 8, craft: 9, communication: 7, collaboration: 8 }),
  total_score: 82,
  recommendation: 'yes',
  notes: 'Excellent systems thinking; available for the 6-week brand sprint.',
  submitted_at: daysAgo(18)
});

// ---------------------------------------------------------------- assignments and finance
function makeAssignment({ id, code, employer, professional, requirement, title, rate, hours, days, startOffset, status, weeks, signed = 1 }) {
  const total = rate * 100 * hours * weeks;
  insert('assignments', {
    id,
    code,
    employer_id: employer,
    professional_id: professional,
    requirement_id: requirement,
    title,
    description: 'Engagement scoped under the Flamingo flexible workforce framework.',
    scope: 'Deliver the agreed work package, attend scheduled working days and submit weekly timesheets.',
    category: 'technology',
    hourly_rate_paise: rate * 100,
    hours_per_week: hours,
    shift_hours: 8,
    working_days: JSON.stringify(days),
    daily_start: '09:30',
    start_date: dateOnly(startOffset),
    end_date: dateOnly(startOffset + weeks * 7),
    deliverables: 'Working deliverables, documentation and a completion handover.',
    reporting_manager: 'Karthik S., Engineering Manager',
    payment_terms: '50% advance on signature; 50% after completion and formal release.',
    cancellation_terms: 'Either party may cancel with 7 days written notice; work completed to date remains payable.',
    dispute_terms: 'Raise a dispute in the Financial Centre within 10 days of the disputed event.',
    break_schedule: JSON.stringify([
      { label: 'Morning break', minutes: 15, start: '11:00', end: '11:15' },
      { label: 'Lunch', minutes: 30, start: '13:00', end: '13:30' },
      { label: 'Afternoon break', minutes: 15, start: '16:00', end: '16:15' }
    ]),
    estimated_hours: hours * weeks,
    total_value_paise: total,
    status,
    contract_signed_professional: signed,
    contract_signed_employer: signed,
    activation_fee_charged: 0,
    created_at: daysAgo(Math.abs(startOffset) + 5),
    updated_at: daysAgo(2)
  });
  return { totalPaise: total };
}

makeAssignment({ id: 'asg_1', code: 'FLM-ASG-1001', employer: 'emp_1', professional: 'pro_1', requirement: 'req_1', title: 'Senior React Engineer — platform build', rate: 1000, hours: 20, days: ['TUE', 'WED'], startOffset: -7, status: 'active', weeks: 1, signed: 1 });
makeAssignment({ id: 'asg_2', code: 'FLM-ASG-1002', employer: 'emp_6', professional: 'pro_2', requirement: null, title: 'Brand system refresh — 6-week sprint', rate: 1500, hours: 20, days: ['WED', 'THU'], startOffset: -60, status: 'completed', weeks: 2, signed: 1 });
makeAssignment({ id: 'asg_3', code: 'FLM-ASG-1003', employer: 'emp_2', professional: 'pro_6', requirement: 'req_3', title: 'Marketplace metrics analyser', rate: 1200, hours: 24, days: ['TUE', 'WED', 'THU'], startOffset: 8, status: 'not_started', weeks: 4, signed: 0 });
makeAssignment({ id: 'asg_4', code: 'FLM-ASG-1004', employer: 'emp_3', professional: 'pro_7', requirement: null, title: 'Release readiness QA', rate: 900, hours: 20, days: ['WED', 'THU'], startOffset: -30, status: 'awaiting_approval', weeks: 2, signed: 1 });
makeAssignment({ id: 'asg_5', code: 'FLM-ASG-1005', employer: 'emp_5', professional: 'pro_4', requirement: null, title: 'People operations policy refresh', rate: 950, hours: 30, days: ['TUE', 'WED', 'THU'], startOffset: -90, status: 'completed', weeks: 3, signed: 1 });

function invoiceAndCapture({ assignmentId, employerId, type, chargesPaise, dayOffset, invoiceSuffix, gatewayRef }) {
  const invoice = employerInvoice({
    professionalChargesPaise: chargesPaise,
    platformFeeBps: settings.platform_fee_bps,
    gstRateBps: settings.gst_rate_bps
  });
  const invoiceId = `inv_${assignmentId}_${type}`;
  const issuedAt = daysAgo(dayOffset);
  insert('invoices', {
    id: invoiceId,
    invoice_no: `FLM-${new Date().getFullYear()}-${invoiceSuffix}`,
    assignment_id: assignmentId,
    employer_id: employerId,
    type,
    professional_charges_paise: invoice.professionalChargesPaise,
    platform_fee_paise: invoice.platformFeePaise,
    gst_paise: invoice.gstPaise,
    other_charges_paise: 0,
    total_paise: invoice.totalPaise,
    status: 'paid',
    issued_at: issuedAt,
    due_at: issuedAt,
    paid_at: issuedAt,
    notes: 'Demonstration invoice. Payment gateway is simulated in this environment.'
  });
  const paymentId = `pay_${assignmentId}_${type}`;
  insert('payments', {
    id: paymentId,
    payment_ref: `PAY-${gatewayRef}`,
    invoice_id: invoiceId,
    assignment_id: assignmentId,
    employer_id: employerId,
    type,
    amount_paise: invoice.professionalChargesPaise,
    platform_fee_paise: invoice.platformFeePaise,
    gst_paise: invoice.gstPaise,
    total_paise: invoice.totalPaise,
    gateway: 'simulated',
    gateway_ref: `SIM-${gatewayRef}`,
    status: 'captured',
    created_at: issuedAt,
    captured_at: issuedAt,
    refunded_paise: 0
  });
  const group = `grp_${assignmentId}_${type}`;
  const lines = [
    { account: 'cash_gateway', direction: 'debit', amountPaise: invoice.totalPaise, description: 'Simulated gateway capture' },
    { account: 'professional_payable', direction: 'credit', amountPaise: invoice.professionalChargesPaise, description: 'Professional payable' },
    ...(invoice.platformFeePaise
      ? [{ account: 'platform_revenue', direction: 'credit', amountPaise: invoice.platformFeePaise, description: 'Platform fee revenue' }]
      : []),
    ...(invoice.gstPaise
      ? [{ account: 'gst_payable', direction: 'credit', amountPaise: invoice.gstPaise, description: 'GST on platform fee' }]
      : [])
  ];
  for (const [index, line] of lines.entries()) {
    insert('ledger_entries', {
      id: `led_${assignmentId}_${type}_${index}`,
      txn_group: group,
      account: line.account,
      direction: line.direction,
      amount_paise: line.amountPaise,
      ref_type: 'payment',
      ref_id: paymentId,
      description: line.description,
      created_at: issuedAt
    });
  }
  return invoice;
}

// Assignment 1 — active, 50% advance captured, activation fee deducted from first payout.
const asg1Advance = invoiceAndCapture({
  assignmentId: 'asg_1', employerId: 'emp_1', type: 'advance', chargesPaise: 1000000,
  dayOffset: 8, invoiceSuffix: 'ADV-1001', gatewayRef: 'ADV1001'
});
const fee = activationFee(settings);
const payout1 = computePayout({
  grossPaise: asg1Advance.professionalChargesPaise,
  activationFeePaise: fee.grossPaise,
  alreadyCharged: false,
  tdsApplicable: false
});
insert('payouts', {
  id: 'po_asg_1_advance',
  payout_ref: 'PO-2026-3001',
  assignment_id: 'asg_1',
  professional_id: 'pro_1',
  type: 'advance',
  gross_paise: payout1.grossPaise,
  activation_fee_paise: payout1.activationFeePaise,
  tds_paise: 0,
  net_paise: payout1.netPaise,
  status: 'paid',
  method: 'simulated_imps',
  created_at: daysAgo(7),
  paid_at: daysAgo(6)
});
insert('activation_fees', {
  id: 'act_1',
  professional_id: 'pro_1',
  assignment_id: 'asg_1',
  amount_paise: fee.grossPaise,
  base_paise: fee.basePaise,
  gst_paise: fee.gstPaise,
  payout_id: 'po_asg_1_advance',
  status: 'deducted',
  disclosed_at: daysAgo(11),
  charged_at: daysAgo(7)
});
db.prepare('UPDATE assignments SET activation_fee_charged = 1 WHERE id = ?').run('asg_1');
const actLines = [
  { account: 'professional_payable', direction: 'debit', amountPaise: fee.grossPaise, description: 'Activation fee deducted from first payout' },
  { account: 'activation_revenue', direction: 'credit', amountPaise: fee.basePaise, description: 'Activation fee revenue' },
  { account: 'gst_payable', direction: 'credit', amountPaise: fee.gstPaise, description: 'GST on activation fee' }
];
for (const [index, line] of actLines.entries()) {
  insert('ledger_entries', {
    id: `led_act_1_${index}`,
    txn_group: 'grp_act_1',
    account: line.account,
    direction: line.direction,
    amount_paise: line.amountPaise,
    ref_type: 'activation_fee',
    ref_id: 'act_1',
    description: line.description,
    created_at: daysAgo(12)
  });
}
const payoutLines = [
  { account: 'professional_payable', direction: 'debit', amountPaise: payout1.netPaise, description: 'Payout settled to professional' },
  { account: 'professional_settled', direction: 'credit', amountPaise: payout1.netPaise, description: 'Simulated IMPS settlement' }
];
for (const [index, line] of payoutLines.entries()) {
  insert('ledger_entries', {
    id: `led_po_1_${index}`,
    txn_group: 'grp_po_1',
    account: line.account,
    direction: line.direction,
    amount_paise: line.amountPaise,
    ref_type: 'payout',
    ref_id: 'po_asg_1_advance',
    description: line.description,
    created_at: daysAgo(11)
  });
}

// Assignment 2 — completed with both payments, activation fee and a published review.
const asg2Advance = invoiceAndCapture({
  assignmentId: 'asg_2', employerId: 'emp_6', type: 'advance', chargesPaise: 3000000,
  dayOffset: 58, invoiceSuffix: 'ADV-1002', gatewayRef: 'ADV1002'
});
const asg2Final = invoiceAndCapture({
  assignmentId: 'asg_2', employerId: 'emp_6', type: 'final', chargesPaise: 3000000,
  dayOffset: 26, invoiceSuffix: 'FIN-1002', gatewayRef: 'FIN1002'
});
const fee2 = activationFee(settings);
const payout2 = computePayout({ grossPaise: asg2Advance.professionalChargesPaise, activationFeePaise: fee2.grossPaise, alreadyCharged: false });
insert('payouts', {
  id: 'po_asg_2_advance', payout_ref: 'PO-2026-3002', assignment_id: 'asg_2', professional_id: 'pro_2',
  type: 'advance', gross_paise: payout2.grossPaise, activation_fee_paise: payout2.activationFeePaise,
  tds_paise: 0, net_paise: payout2.netPaise, status: 'paid', method: 'simulated_imps',
  created_at: daysAgo(56), paid_at: daysAgo(55)
});
const payout2Final = computePayout({ grossPaise: asg2Final.professionalChargesPaise, alreadyCharged: true });
insert('payouts', {
  id: 'po_asg_2_final', payout_ref: 'PO-2026-3003', assignment_id: 'asg_2', professional_id: 'pro_2',
  type: 'final', gross_paise: payout2Final.grossPaise, activation_fee_paise: 0,
  tds_paise: 0, net_paise: payout2Final.netPaise, status: 'paid', method: 'simulated_imps',
  created_at: daysAgo(24), paid_at: daysAgo(23)
});
insert('activation_fees', {
  id: 'act_2',
  professional_id: 'pro_2',
  assignment_id: 'asg_2',
  amount_paise: fee2.grossPaise,
  base_paise: fee2.basePaise,
  gst_paise: fee2.gstPaise,
  payout_id: 'po_asg_2_advance',
  status: 'deducted',
  disclosed_at: daysAgo(62),
  charged_at: daysAgo(56)
});
db.prepare('UPDATE assignments SET activation_fee_charged = 1 WHERE id = ?').run('asg_2');
for (const [index, line] of [
  { account: 'professional_payable', direction: 'debit', amountPaise: fee2.grossPaise, description: 'Activation fee deducted from first payout' },
  { account: 'activation_revenue', direction: 'credit', amountPaise: fee2.basePaise, description: 'Activation fee revenue' },
  { account: 'gst_payable', direction: 'credit', amountPaise: fee2.gstPaise, description: 'GST on activation fee' }
].entries()) {
  insert('ledger_entries', {
    id: `led_act_2_${index}`, txn_group: 'grp_act_2', account: line.account, direction: line.direction,
    amount_paise: line.amountPaise, ref_type: 'activation_fee', ref_id: 'act_2', description: line.description,
    created_at: daysAgo(56)
  });
}
for (const [index, line] of [
  { account: 'professional_payable', direction: 'debit', amountPaise: payout2.netPaise, description: 'Advance payout settled' },
  { account: 'professional_settled', direction: 'credit', amountPaise: payout2.netPaise, description: 'Simulated IMPS settlement' }
].entries()) {
  insert('ledger_entries', {
    id: `led_po_2a_${index}`, txn_group: 'grp_po_2a', account: line.account, direction: line.direction,
    amount_paise: line.amountPaise, ref_type: 'payout', ref_id: 'po_asg_2_advance', description: line.description,
    created_at: daysAgo(55)
  });
}
for (const [index, line] of [
  { account: 'professional_payable', direction: 'debit', amountPaise: payout2Final.netPaise, description: 'Final payout settled' },
  { account: 'professional_settled', direction: 'credit', amountPaise: payout2Final.netPaise, description: 'Simulated IMPS settlement' }
].entries()) {
  insert('ledger_entries', {
    id: `led_po_2f_${index}`, txn_group: 'grp_po_2f', account: line.account, direction: line.direction,
    amount_paise: line.amountPaise, ref_type: 'payout', ref_id: 'po_asg_2_final', description: line.description,
    created_at: daysAgo(23)
  });
}

insert('reviews', {
  id: 'rev_1', assignment_id: 'asg_2', employer_id: 'emp_6', professional_id: 'pro_2',
  manager_user_id: 'usr_emp_6',
  scores: JSON.stringify({ quality: 9, timeliness: 8, technical: 9, conduct: 10, communication: 8, reliability: 9 }),
  total_score: 88,
  strengths: 'Outstanding systems thinking and a calm, collaborative working style. The design system handover was exceptional.',
  improvements: 'Could flag scope changes earlier so the delivery timeline can be adjusted sooner.',
  responsibilities: 'Owned the brand audit, design system foundations and component library handover.',
  overall_rating: 'exceeds_expectations',
  rehire: 1,
  status: 'published',
  submitted_at: daysAgo(22),
  professional_response: null,
  response_at: null,
  resolution: null,
  resolution_at: null
});
insert('reviews', {
  id: 'rev_2', assignment_id: 'asg_5', employer_id: 'emp_5', professional_id: 'pro_4',
  manager_user_id: 'usr_emp_5',
  scores: JSON.stringify({ quality: 9, timeliness: 9, technical: 8, conduct: 9, communication: 9, reliability: 9 }),
  total_score: 88.5,
  strengths: 'Pragmatic policy work with excellent manager enablement sessions.',
  improvements: 'Include more worked examples in the first draft of complex policies.',
  responsibilities: 'Refreshed the employee handbook, manager guides and onboarding checklist.',
  overall_rating: 'exceeds_expectations',
  rehire: 1,
  status: 'published',
  submitted_at: daysAgo(80),
  professional_response: 'Thank you — the worked-example feedback is fair and I have updated my template.',
  response_at: daysAgo(78),
  resolution: null,
  resolution_at: null
});

// Assignment 5 payments (completed) for professional 4.
invoiceAndCapture({ assignmentId: 'asg_5', employerId: 'emp_5', type: 'advance', chargesPaise: 4275000, dayOffset: 88, invoiceSuffix: 'ADV-1005', gatewayRef: 'ADV1005' });
invoiceAndCapture({ assignmentId: 'asg_5', employerId: 'emp_5', type: 'final', chargesPaise: 4275000, dayOffset: 78, invoiceSuffix: 'FIN-1005', gatewayRef: 'FIN1005' });
const fee5 = activationFee(settings);
const p5a = computePayout({ grossPaise: 4275000, activationFeePaise: fee5.grossPaise, alreadyCharged: false });
const p5b = computePayout({ grossPaise: 4275000, alreadyCharged: true });
insert('payouts', {
  id: 'po_asg_5_advance', payout_ref: 'PO-2026-3005', assignment_id: 'asg_5', professional_id: 'pro_4',
  type: 'advance', gross_paise: p5a.grossPaise, activation_fee_paise: p5a.activationFeePaise, tds_paise: 0,
  net_paise: p5a.netPaise, status: 'paid', method: 'simulated_imps', created_at: daysAgo(86), paid_at: daysAgo(85)
});
insert('payouts', {
  id: 'po_asg_5_final', payout_ref: 'PO-2026-3006', assignment_id: 'asg_5', professional_id: 'pro_4',
  type: 'final', gross_paise: p5b.grossPaise, activation_fee_paise: 0, tds_paise: 0,
  net_paise: p5b.netPaise, status: 'paid', method: 'simulated_imps', created_at: daysAgo(76), paid_at: daysAgo(75)
});
insert('activation_fees', {
  id: 'act_5', professional_id: 'pro_4', assignment_id: 'asg_5', amount_paise: fee5.grossPaise,
  base_paise: fee5.basePaise, gst_paise: fee5.gstPaise, payout_id: 'po_asg_5_advance', status: 'deducted',
  disclosed_at: daysAgo(92), charged_at: daysAgo(86)
});
db.prepare('UPDATE assignments SET activation_fee_charged = 1 WHERE id = ?').run('asg_5');
for (const [suffix, group, payout, when] of [
  ['act5', 'grp_act_5', { grossPaise: fee5.grossPaise, basePaise: fee5.basePaise, gstPaise: fee5.gstPaise }, daysAgo(86)],
  ['po5a', 'grp_po_5a', { grossPaise: p5a.netPaise }, daysAgo(85)],
  ['po5f', 'grp_po_5f', { grossPaise: p5b.netPaise }, daysAgo(75)]
]) {
  const lines = suffix === 'act5'
    ? [
        { account: 'professional_payable', direction: 'debit', amountPaise: payout.grossPaise, description: 'Activation fee deducted from first payout' },
        { account: 'activation_revenue', direction: 'credit', amountPaise: payout.basePaise, description: 'Activation fee revenue' },
        { account: 'gst_payable', direction: 'credit', amountPaise: payout.gstPaise, description: 'GST on activation fee' }
      ]
    : [
        { account: 'professional_payable', direction: 'debit', amountPaise: payout.grossPaise, description: 'Payout settled to professional' },
        { account: 'professional_settled', direction: 'credit', amountPaise: payout.grossPaise, description: 'Simulated IMPS settlement' }
      ];
  lines.forEach((line, index) => {
    insert('ledger_entries', {
      id: `led_${suffix}_${index}`, txn_group: group, account: line.account, direction: line.direction,
      amount_paise: line.amountPaise, ref_type: suffix === 'act5' ? 'activation_fee' : 'payout',
      ref_id: suffix === 'act5' ? 'act_5' : suffix === 'po5a' ? 'po_asg_5_advance' : 'po_asg_5_final',
      description: line.description, created_at: when
    });
  });
}

// Assignment 4 — advance captured, activation deducted, payout awaiting settlement.
const asg4Advance = invoiceAndCapture({
  assignmentId: 'asg_4', employerId: 'emp_3', type: 'advance', chargesPaise: 1800000,
  dayOffset: 20, invoiceSuffix: 'ADV-1004', gatewayRef: 'ADV1004'
});
const fee4 = activationFee(settings);
const payout4 = computePayout({
  grossPaise: asg4Advance.professionalChargesPaise,
  activationFeePaise: fee4.grossPaise,
  alreadyCharged: false
});
insert('payouts', {
  id: 'po_asg_4_advance', payout_ref: 'PO-2026-3004', assignment_id: 'asg_4', professional_id: 'pro_7',
  type: 'advance', gross_paise: payout4.grossPaise, activation_fee_paise: payout4.activationFeePaise,
  tds_paise: 0, net_paise: payout4.netPaise, status: 'processing', method: 'simulated_imps',
  created_at: daysAgo(19), paid_at: null
});
insert('activation_fees', {
  id: 'act_4', professional_id: 'pro_7', assignment_id: 'asg_4', amount_paise: fee4.grossPaise,
  base_paise: fee4.basePaise, gst_paise: fee4.gstPaise, payout_id: 'po_asg_4_advance',
  status: 'deducted', disclosed_at: daysAgo(25), charged_at: daysAgo(19)
});
db.prepare('UPDATE assignments SET activation_fee_charged = 1 WHERE id = ?').run('asg_4');
for (const [index, line] of [
  { account: 'professional_payable', direction: 'debit', amountPaise: fee4.grossPaise, description: 'Activation fee deducted from first payout' },
  { account: 'activation_revenue', direction: 'credit', amountPaise: fee4.basePaise, description: 'Activation fee revenue' },
  { account: 'gst_payable', direction: 'credit', amountPaise: fee4.gstPaise, description: 'GST on activation fee' }
].entries()) {
  insert('ledger_entries', {
    id: `led_act_4_${index}`, txn_group: 'grp_act_4', account: line.account, direction: line.direction,
    amount_paise: line.amountPaise, ref_type: 'activation_fee', ref_id: 'act_4',
    description: line.description, created_at: daysAgo(19)
  });
}
for (const [index, line] of [
  { account: 'professional_payable', direction: 'debit', amountPaise: payout4.netPaise, description: 'Payout instructed — awaiting settlement' },
  { account: 'professional_settled', direction: 'credit', amountPaise: payout4.netPaise, description: 'Simulated IMPS settlement pending' }
].entries()) {
  insert('ledger_entries', {
    id: `led_po_4_${index}`, txn_group: 'grp_po_4', account: line.account, direction: line.direction,
    amount_paise: line.amountPaise, ref_type: 'payout', ref_id: 'po_asg_4_advance',
    description: line.description, created_at: daysAgo(19)
  });
}

// Timesheets for assignment 1 and completed assignment 5.
const DAY_ORDER = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function recentWeekday(dayName, weeksAgo = 0) {
  const target = new Date();
  target.setUTCHours(0, 0, 0, 0);
  const current = target.getUTCDay();
  const wanted = DAY_ORDER.indexOf(dayName);
  let diff = (current - wanted + 7) % 7;
  if (diff === 0) diff = 0;
  target.setUTCDate(target.getUTCDate() - diff - weeksAgo * 7);
  return target.toISOString().slice(0, 10);
}
const timesheetSpecs = [
  ['ts_1', 'asg_1', 'pro_1', recentWeekday('TUE', 1), '09:30', '18:30', 60, 8, 'approved'],
  ['ts_2', 'asg_1', 'pro_1', recentWeekday('WED', 1), '09:30', '18:30', 60, 8, 'approved'],
  ['ts_3', 'asg_1', 'pro_1', recentWeekday('TUE', 0), '09:30', '18:30', 60, 8, 'submitted'],
  ['ts_4', 'asg_5', 'pro_4', recentWeekday('TUE', 12), '09:00', '18:00', 60, 8, 'approved'],
  ['ts_5', 'asg_5', 'pro_4', recentWeekday('WED', 12), '09:00', '18:00', 60, 8, 'approved'],
  ['ts_6', 'asg_4', 'pro_7', recentWeekday('WED', 2), '10:00', '19:00', 60, 8, 'submitted']
];
for (const [id, assignment, professional, workDate, start, end, breaks, hours, status] of timesheetSpecs) {
  insert('timesheets', {
    id, assignment_id: assignment, professional_id: professional, work_date: workDate,
    start_at: start, end_at: end, break_minutes: breaks, hours_worked: hours, status,
    notes: null, submitted_at: daysAgo(1),
    approved_by: status === 'approved' ? (assignment === 'asg_1' ? 'usr_emp_1' : 'usr_emp_5') : null,
    approved_at: status === 'approved' ? daysAgo(1) : null,
    approval_note: status === 'approved' ? 'Approved against agreed deliverables.' : null
  });
}

// Assignment events
const eventSpecs = [
  ['ae_1', 'asg_1', 'created', daysAgo(20), 'Assignment created from requirement req_1'],
  ['ae_2', 'asg_1', 'contract_signed', daysAgo(16), 'Contract accepted by employer and professional'],
  ['ae_3', 'asg_1', 'payment_captured', daysAgo(13), '50% advance captured (simulated gateway)'],
  ['ae_4', 'asg_1', 'activation_fee', daysAgo(12), '₹699 activation fee deducted from first payout'],
  ['ae_5', 'asg_1', 'payout_paid', daysAgo(11), '₹9,301 advance payout settled'],
  ['ae_6', 'asg_1', 'active', daysAgo(10), 'Assignment activated'],
  ['ae_7', 'asg_2', 'completed', daysAgo(24), 'Final release approved'],
  ['ae_8', 'asg_4', 'awaiting_approval', daysAgo(3), 'Professional submitted completion evidence']
];
for (const [id, assignment, type, when, note] of eventSpecs) {
  insert('assignment_events', {
    id, assignment_id: assignment, event_type: type, actor_id: null, note, created_at: when
  });
}

// Dispute example for administration demonstration (not attached to demo professional 1)
insert('disputes', {
  id: 'disp_1',
  raised_by: 'usr_pro_7',
  assignment_id: 'asg_4',
  review_id: null,
  payment_id: null,
  category: 'timesheet',
  description: 'Employer requested an additional review session outside the agreed scope. I logged 2 hours but the timesheet was queried.',
  status: 'investigating',
  resolution: null,
  created_at: daysAgo(2),
  resolved_at: null
});

// Notifications
const notifications = [
  ['not_1', 'usr_pro_1', 'interview', 'Interview scheduled', 'Meridian Technologies has invited you to Round 1 on the platform.', '/interview-scheduler', 0, daysAgo(2)],
  ['not_2', 'usr_pro_1', 'payout', '₹9,301 payout settled', 'Your advance payout is in your bank account. The ₹699 activation fee is itemised in your statement.', '/financial-centre', 0, daysAgo(11)],
  ['not_3', 'usr_emp_1', 'timesheet', 'Timesheet awaiting approval', 'Aarav Mehta submitted 8 hours for approval.', '/employer-dashboard', 0, daysAgo(1)],
  ['not_4', 'usr_admin_2', 'verification', 'Verification queue', '2 professional profiles and 1 employer are awaiting review.', '/admin', 0, daysAgo(1)]
];
for (const [id, userId, type, title, body, link, read, when] of notifications) {
  insert('notifications', {
    id, user_id: userId, type, title, body, link, read_at: read ? when : null, created_at: when
  });
}

insert('contact_messages', {
  id: 'msg_1', name: 'Devika Rao', email: 'devika@example.com',
  subject: 'Enterprise pilot enquiry', message: 'We would like to explore a 20-person flexible analytics pilot in Q1.',
  status: 'new', created_at: daysAgo(1)
});

// Audit trail examples
const audits = [
  ['aud_1', 'usr_admin_2', 'admin', 'verification.approved', 'professional', 'pro_1', 'Identity, documents and employment verified'],
  ['aud_2', 'usr_admin_3', 'admin', 'finance.reconciled', 'payment', 'pay_asg_1_advance', 'Advance captured and matched to invoice'],
  ['aud_3', 'usr_emp_1', 'employer', 'assignment.created', 'assignment', 'asg_1', 'Assignment created'],
  ['aud_4', 'usr_pro_1', 'professional', 'contract.accepted', 'assignment', 'asg_1', 'Professional accepted assignment terms']
];
for (const [id, actor, role, action, entityType, entityId, note] of audits) {
  insert('audit_logs', {
    id, actor_id: actor, actor_role: role, action, entity_type: entityType, entity_id: entityId,
    ip: '127.0.0.1', meta: JSON.stringify({ note }), created_at: daysAgo(12)
  });
}

console.log('FLAMINGO demo data seeded.');
console.log(`Professional login: candidate@flamingo.work / ${PASSWORD}`);
console.log(`Employer login:     employer@flamingo.work / ${PASSWORD}`);
console.log(`Admin login:        admin@flamingo.work / ${PASSWORD}`);
console.log(`Finance login:      finance@flamingo.work / ${PASSWORD}`);
