# Testing report

**Report date:** 12 November 2026
**Build:** FLAMINGO MVP 1.0.0
**Runtime:** Node.js 24.22.2, npm workspaces

---

## 1. Summary

| Suite | Result |
| --- | --- |
| Automated tests (Vitest + Supertest) | **101 / 101 passing** |
| Test files | 7 / 7 passing |
| Browser end-to-end tests (Playwright) | **14 / 14 passing** |
| HTTP role and permission smoke test | **58 / 58 checks passing** |
| Client production build (`tsc -b && vite build`) | **Passing** |
| Finance reference example | **Reconciles exactly** |
| Ledger balance | **All groups balanced** |

The MVP is functionally verified at the unit, API, HTTP and browser level. It has **not** had load testing, an external penetration test or an accessibility audit. Those gaps are listed in section 8.

---

## 2. How to reproduce

From the repository root:

```bash
# Automated tests
npm test

# Browser end-to-end tests (installs Chromium on first run)
npx playwright install chromium
npm run e2e

# Production build
npm run build

# Start the API and serve the built client
npm start

# Backup and restore round-trip (also covered by the automated suite)
npm run backup
npm run restore -- --from <backup-directory> --force

# In a second terminal, run the HTTP smoke test
node scripts/smoke.mjs http://localhost:4000
```

The seed is deterministic. To restore the demo database:

```bash
npm run seed
```

---

## 3. Automated test inventory

### 3.1 `finance.test.js` — 12 tests

Covers the money engine as pure functions.

**Required ₹20,000 example**

- Splits ₹20,000 into two ₹10,000 payments.
- Charges a GST-inclusive ₹699 activation fee exactly once.
- Pays ₹9,301 first and ₹10,000 on completion, totalling ₹19,301.
- Does not charge the activation fee twice.

**GST and platform fees**

- Itemises GST only on the platform fee, never on professional charges.
- Keeps the reference example at 0% platform fee so it reconciles exactly.
- Splits inclusive GST without losing a paisa.
- Converts rupees without floating-point drift.

**Payout safety and ledger integrity**

- Never produces a negative payout.
- Withholds TDS only when applicable and rounds correctly.
- Rejects invalid payment plans.
- Balances every ledger group it creates.

### 3.2 `scheduling.test.js` — 20 tests

**Availability rules**

- Accepts four Tuesday–Saturday days on a 12-hour shift (48-hour cap).
- Rejects Sunday and Monday work.
- Rejects more than four working days.
- Rejects unsupported shift lengths.
- Rejects shifts that would run past midnight.
- Requires a full 60 minutes of breaks when provided.
- Requires all three break periods.

**Cross-employer booking conflicts**

- Blocks overlapping hours on a shared day.
- Allows non-overlapping assignments on the same day.
- Blocks a fifth combined working day.
- Blocks combined bookings above 48 hours.
- Detects interval overlap correctly at boundaries.

**Timesheet validation**

- Accepts a compliant 8-hour day with a one-hour break.
- Rejects work on Sunday.
- Rejects a day the assignment is not scheduled for.
- Rejects shifts longer than the assignment shift.
- Rejects overlapping entries across employers.
- Rejects surpassing the weekly 48-hour cap.

**Date helpers**

- Identifies weekdays and week starts.
- Computes shift windows and remaining capacity.

### 3.3 `domains.test.js` — 16 tests

**Assessment scoring**

- Auto-marks objective answers and leaves practical work for a human.
- Treats unanswered questions as incorrect rather than crashing.
- Selects a deterministic, complete question set.

**Integrity signals are review prompts, never proof**

- Scores low risk when nothing is flagged.
- Flags repeated signals for human review with an explicit disclaimer.
- Caps repeated-flag penalties.
- Measures text similarity as a screening signal only.
- Enforces the documented retake waiting period.

**100-point performance review**

- Awards the full 100 points for perfect scores.
- Applies the published weights.
- Rejects missing or out-of-range criteria.
- Maps bands consistently and averages published reviews.

**Sourced pricing engine**

- Refuses to invent a benchmark when none exists.
- Clamps recommendations inside the sourced range.
- Exposes the full calculation trail and its source.
- Maps experience to levels and never drops below the three-year minimum factor.

### 3.4 `api.test.js` — 35 tests

Runs against a real Express app and database using Supertest.

**Public API**

- Reports health and demo mode.
- Reports database and storage readiness.
- Publishes transparent terms and pricing policy.
- Exposes sourced rate benchmarks with a methodology note.
- Lists only verified, assessed, public professionals.
- Filters the directory by category and search term.
- Returns full public profiles without contact details.
- Rate-limits and validates public contact submissions.
- Returns a JSON 404 for unknown API routes.

**Authentication, CSRF and RBAC**

- Rejects bad credentials without leaking account existence.
- Signs in an administrator and returns a CSRF token.
- Blocks state-changing requests without a CSRF token.
- Serves the admin dashboard and finance ledger to an administrator.
- Shows exactly the ₹20,000 example in seeded assignment data.
- Lets a finance officer view finance but not verification queues.
- Prevents a professional from calling admin endpoints.
- Rejects unknown settings keys and persists valid policy changes.

**Professional journey**

- Returns a populated dashboard and transparent activation fee.
- Lists assessments and refuses a retake after passing.
- Accepts a compliant timesheet and rejects a Sunday entry.
- Protects another professional's documents.

**Employer journey**

- Returns the employer dashboard with verification gates.
- Shows contact details only after shortlisting.
- Blocks duplicate shortlisting and unverified employers.
- Prevents duplicate advance capture on an already-funded assignment.
- Blocks final payment before completion approval.
- Enforces the two-round interview model.
- Refuses hiring without a selected final interview.

**Production hardening**

- Reports database, storage and scanner status from `/api/ready`.
- Accepts a PDF upload whose magic bytes match the declared type.
- Rejects a script disguised as a PDF.
- Rejects content that does not match the declared image type.
- Rejects an upload that passes content sniffing but fails the malware scan.
- Records the scan rejection in the audit log.
- Closes the admin API with `mfa_enrollment_required` when enforcement is on.
- Fails fast on an unsafe production configuration, including an unmanaged secret provider and simulated scanning.

### 3.5 `malware.test.js` — 7 tests

Exercises the real clamd INSTREAM protocol against a local stub, so the client works without ClamAV in CI.

- Sends a clean buffer and parses `stream: OK`.
- Parses `... FOUND` and raises `malware_detected` (422).
- Fails closed with `scan_unavailable` (503) when the daemon is unreachable.
- Fails closed when the daemon does not answer within the timeout.
- Rejects the EICAR test string in simulated mode.
- Answers the readiness `zPING` probe.
- Reports `disabled` when scanning is off.

### 3.6 `secrets.test.js` - 7 tests

- No-ops when the provider is `env`.
- Loads a JSON secret file into the environment.
- Does not overwrite a value already present.
- Fails clearly on a missing secret file or unknown provider.
- Derives a stable 32-byte document key from the configured secret.
- Derives a different key from a different secret.

### 3.7 `backup.test.js` — 4 tests

- Creates a consistent SQLite snapshot with `VACUUM INTO`.
- Copies encrypted storage and writes a manifest without the encryption key.
- Restores the database and storage into a clean target.
- Refuses a restore with the wrong encryption key or without `--force` over an existing database.

### 3.8 Browser end-to-end suite — 14 tests

`playwright.config.ts` starts the real API against a disposable database and drives Chromium against the built client. The seed is recreated for every run, so the suite is independent of local data.

**Public marketplace (5)**

- Home renders and states the demonstration position.
- The ₹20,000 → ₹19,301 worked example appears without drift.
- Pricing repeats the same example.
- The marketplace lists verified professionals.
- Unknown routes render the not-found page without a server error.

**Sign-in and role isolation (7)**

- Professional, employer and administrator each land on their own dashboard.
- A professional is redirected away from the admin portal.
- A bad password shows an error and creates no session.
- A session survives a page reload.
- Demo role buttons fill the form without submitting it.

**Document upload controls (2)**

- A file that passes content sniffing but fails the malware scan is rejected with a visible error.
- Content that does not match its declared type is rejected.

The suite found a real defect: the login response omitted `adminPermissions`, so an administrator saw "Permission required" on the dashboard until a reload. The login response now returns the permission list.

---

## 4. HTTP smoke test

`scripts/smoke.mjs` starts from a clean HTTP client, signs in as each seeded role and calls the endpoints the React pages use. It asserts both success and denial.

### 4.1 Coverage

| Area | Checks |
| --- | --- |
| Public | health, readiness, categories, marketplace search, benchmarks, stats, featured |
| Professional | login plus dashboard, profile, assessments, assignments, timesheets, finance, career, reviews, interviews, notifications |
| Employer | login plus dashboard, requirements, talent search, shortlist, interviews, assignments, timesheets, finance, reviews, profile |
| Super admin | login plus dashboard, professional and employer verification queues, assessment queue and detail, finance, disputes, review challenges, users, settings, audit, reports |
| Finance officer | finance and reports allowed; dashboard and verification queue denied |
| Verification officer | dashboard, verification and assessment queue allowed; finance denied |
| Support | dashboard, users and disputes allowed; finance and review challenges denied |

### 4.2 Result

```
ALL CHECKS PASSED
```

58 checks passed, 0 failed. This confirms that login, session cookies, CSRF setup, role gates and permission gates behave as designed for every seeded role.

---

## 5. Build verification

```
tsc -b && vite build
✓ 91 modules transformed
dist/index.html                 0.72 kB
dist/assets/index-*.css        45.42 kB
dist/assets/index-*.js        695.41 kB
✓ built in ~8s
```

TypeScript strict mode passes. The only warning is Vite's chunk-size advisory (the single JS bundle exceeds 500 kB). It does not affect correctness; code splitting is a future optimisation.

The built client is served by the API. `GET /` returns `200` with the app shell and the hashed JS asset returns `200` with the correct MIME type.

---

## 6. Financial verification

The seeded assignment `asg_1` returns:

| Field | Value |
| --- | --- |
| Assignment value | ₹20,000.00 (2,000,000 paise) |
| Advance gross | ₹10,000.00 (1,000,000 paise) |
| Activation fee | ₹699.00 (69,900 paise) |
| GST on fee | ₹106.63 (10,663 paise) |
| Fee base | ₹592.37 (59,237 paise) |
| First payout net | ₹9,301.00 (930,100 paise) |
| Final payout | ₹10,000.00 (1,000,000 paise) |
| Total received | ₹19,301.00 (1,930,100 paise) |

The payout row is `po_asg_1_advance`, status `paid`, method `simulated_imps`. The ledger is balanced across all groups.

---

## 7. Manual demonstration flows

These flows are wired end to end and are the recommended demo path. They were exercised by the automated and HTTP tests; a human should still click through them in a browser before a stakeholder demo.

| # | Flow | Expected result |
| --- | --- | --- |
| 1 | Sign in as professional | Dashboard with active assignment, earnings and next steps |
| 2 | Open the ₹20,000 assignment | Contract, break schedule, activation fee and payout breakdown |
| 3 | Review finance | ₹9,301 first payout and ₹10,000 completion, with fee disclosure |
| 4 | Submit a timesheet | Accepted only on an agreed day within the shift and weekly cap |
| 5 | Sign in as employer | Dashboard shows verification and hiring gates |
| 6 | Search talent | Seeded professionals appear; contact details remain hidden |
| 7 | Shortlist a professional | Contact details release; shortlist is not duplicated |
| 8 | Schedule two interview rounds | A third round is refused; hiring requires a selected final round |
| 9 | Approve a timesheet | Status becomes approved and the professional is notified |
| 10 | Approve completion and pay | Final payout is created only after approval |
| 11 | Sign in as admin | Full dashboard and verification queue |
| 12 | Review an assessment | Integrity signals shown with a human-review disclaimer |
| 13 | Resolve a dispute | Resolution note is required and recorded |
| 14 | Review the audit log | Decisions appear with actor, IP and metadata |
| 15 | Sign in as finance officer | Finance visible; verification and dashboard denied |
| 16 | Sign in as support | Users and disputes visible; finance and review moderation denied |

### Layout and density check

Every public page and every portal screen for the three demo roles was rendered at 1280 and 1440 px wide and inspected for clipping, overlap and content running into card borders. A scripted pass also flagged elements wider than their container and tables that had to scroll horizontally inside a card. Fixed in this pass:

- Cards built from a header plus bare content (key/value lists, tables, timelines, form grids) had no inset, so rows sat flush against the border. They now take the same 24 px inset as `card-body`.
- The home hero used absolutely positioned, overlapping cards. It is now a flow column, so the card height follows its content.
- Wide finance and timesheet tables sat inside narrow split columns and lost their last columns. Those statements now use the full content width, and the ten-column admin ledgers use tighter cells so every column stays visible.
- Long values in `.kv`, `.money-line`, `.hero-card-line`, page headers and table rows now wrap instead of clipping.

This was a manual inspection pass, not a committed baseline; the visual-regression gap in §8 still stands.

---

## 8. Known gaps and recommended next tests

| Gap | Risk | Recommendation |
| --- | --- | --- |
| No load or soak test | Unknown behaviour under concurrency | k6 or Artillery against search, login and finance |
| No external penetration test | Unknown exploitable issues | Commission before launch |
| No accessibility audit | WCAG compliance unknown | axe-core plus manual keyboard/screen-reader pass |
| Rate limits are in-memory | Not shared across instances | Test with Redis when scaling |
| No visual regression tests | Design drift | Add screenshot baselines for key pages |
| No chaos test | Recovery time unknown | Practise the documented backup/restore drill quarterly |
| Payment gateway is simulated | Real failure modes untested | Contract tests against the chosen provider |
| ClamAV not deployed in production | Real malware is only caught once `clamd` runs | Deploy the sidecar; `eicar` mode is simulated and rejected by the production guard |
| No mobile or Safari E2E project | Untested browsers | Add WebKit and a mobile viewport project to Playwright |

### Test-quality notes

- The suite is deterministic and reseeds per run; it does not depend on wall-clock date.
- Integration tests use the real schema and real SQL, not mocks.
- Money tests use integer assertions, so they catch rounding regressions.
- RBAC tests assert denials as well as successes.

---

## 9. Verdict

**Functional status: verified for demonstration and internal review.**

- The required ₹20,000 → ₹19,301 example is exact.
- Working rules are enforced by code and covered by tests.
- Role and permission boundaries are tested from the HTTP layer and in a browser.
- Upload scanning and secret loading have dedicated coverage.
- The application builds and serves correctly.

**Not yet verified for production.** Load, external security testing, accessibility and real payment integration remain open. See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).
