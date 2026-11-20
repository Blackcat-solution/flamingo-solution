/**
 * FLAMINGO HTTP smoke test.
 *
 * Logs in as each seeded role and calls the main portal endpoints used by the
 * React client. Fails with a non-zero exit code if an expected request fails.
 *
 * Usage: node scripts/smoke.mjs [baseUrl]
 * Default baseUrl: http://localhost:4000
 */

const base = (process.argv[2] || 'http://localhost:4000').replace(/\/$/, '');
const password = 'Flamingo@2026';

let failures = 0;

async function request(path, { cookie, csrf, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, data, response };
}

function check(label, result, expected = 200) {
  const ok = result.status === expected;
  if (!ok) failures += 1;
  const code = ok ? 'PASS' : 'FAIL';
  const message = ok ? '' : ` — expected ${expected}, got ${result.status}: ${JSON.stringify(result.data).slice(0, 220)}`;
  console.log(`${code} ${label}${message}`);
  return result;
}

async function login(email) {
  const result = await request('/auth/login', { method: 'POST', body: { email, password } });
  check(`login ${email}`, result);
  if (result.status !== 200) throw new Error(`Cannot continue: ${email} login failed`);
  const cookie = (result.response.headers.getSetCookie?.() || [])[0]?.split(';')[0] || '';
  return { cookie, csrf: result.data.csrfToken, user: result.data.user };
}

async function suite(email, paths, forbidden = []) {
  console.log(`\n--- ${email} ---`);
  const session = await login(email);
  for (const [label, path] of paths) {
    check(`${label} (${path})`, await request(path, session));
  }
  for (const [label, path] of forbidden) {
    check(`${label} denied (${path})`, await request(path, session), 403);
  }
}

console.log(`FLAMINGO smoke test against ${base}`);

const publicChecks = [
  ['health', '/health'],
  ['readiness', '/ready'],
  ['public categories', '/public/categories'],
  ['public marketplace', '/marketplace/professionals?limit=5'],
  ['public benchmarks', '/public/benchmarks'],
  ['public stats', '/public/stats'],
  ['public featured', '/marketplace/featured']
];
for (const [label, path] of publicChecks) {
  check(label, await request(path));
}

await suite('candidate@flamingo.work', [
  ['professional dashboard', '/professional/dashboard'],
  ['professional profile', '/professional/profile'],
  ['professional assessments', '/professional/assessments'],
  ['professional assignments', '/professional/assignments'],
  ['professional timesheets', '/professional/timesheets'],
  ['professional finance', '/professional/finance/summary'],
  ['professional career', '/professional/career'],
  ['professional reviews', '/professional/reviews'],
  ['professional interviews', '/professional/interviews'],
  ['professional notifications', '/professional/notifications']
]);

await suite('employer@flamingo.work', [
  ['employer dashboard', '/employer/dashboard'],
  ['employer requirements', '/employer/requirements'],
  ['employer talent', '/marketplace/professionals?limit=5'],
  ['employer shortlist', '/employer/shortlist'],
  ['employer interviews', '/employer/interviews'],
  ['employer assignments', '/employer/assignments'],
  ['employer timesheets', '/employer/timesheets'],
  ['employer finance', '/employer/finance'],
  ['employer reviews', '/employer/reviews'],
  ['employer profile', '/employer/profile']
]);

await suite('admin@flamingo.work', [
  ['admin dashboard', '/admin/dashboard'],
  ['admin professional verifications', '/admin/verifications/professionals?limit=5'],
  ['admin employer verifications', '/admin/verifications/employers?limit=5'],
  ['admin assessment queue', '/admin/assessment-attempts?status=human_review'],
  ['admin assessment detail', '/admin/assessment-attempts/att_demo_12'],
  ['admin finance', '/admin/finance/summary'],
  ['admin disputes', '/admin/disputes'],
  ['admin review challenges', '/admin/reviews/challenges'],
  ['admin users', '/admin/users?limit=5'],
  ['admin settings', '/admin/settings'],
  ['admin audit', '/admin/audit?limit=5'],
  ['admin reports', '/admin/reports/overview']
]);

await suite(
  'finance@flamingo.work',
  [
    ['finance summary', '/admin/finance/summary'],
    ['finance reports', '/admin/reports/overview']
  ],
  [
    ['dashboard', '/admin/dashboard'],
    ['verification queue', '/admin/verifications/professionals']
  ]
);

await suite(
  'verification@flamingo.work',
  [
    ['verification dashboard', '/admin/dashboard'],
    ['verification queue', '/admin/verifications/professionals?limit=5'],
    ['assessment queue', '/admin/assessment-attempts?status=human_review']
  ],
  [
    ['finance summary', '/admin/finance/summary']
  ]
);

await suite(
  'support@flamingo.work',
  [
    ['support dashboard', '/admin/dashboard'],
    ['support users', '/admin/users?limit=5'],
    ['support disputes', '/admin/disputes']
  ],
  [
    ['finance summary', '/admin/finance/summary'],
    ['review challenges', '/admin/reviews/challenges']
  ]
);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
