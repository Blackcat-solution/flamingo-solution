# Technical architecture

This document describes how FLAMINGO is built, how a request flows through the system, how data is modelled and how the domain engines work.

---

## 1. System overview

FLAMINGO is a single-repository application with two workspaces:

- `server` — an Express JSON API that also serves the built React client.
- `client` — a React single-page application built with Vite.

```
┌──────────────────────────────────────────────────────────────┐
│                          Browser                             │
│  React SPA (Vite build) · session cookie · X-CSRF-Token      │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS (production)
┌──────────────────────────────▼───────────────────────────────┐
│                    Express application                       │
│  requestContext → securityHeaders → JSON parser              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /api/auth         register, login, MFA, password       │  │
│  │ /api/public       config, categories, benchmarks       │  │
│  │ /api/marketplace  search, featured, profile, compare   │  │
│  │ /api/professional professional portal                  │  │
│  │ /api/employer     employer portal                      │  │
│  │ /api/admin        administration                       │  │
│  └────────────────────────────────────────────────────────┘  │
│  Domain engines: finance · scheduling · assessment ·         │
│                  performance · pricing                       │
│  Libraries: auth · storage · http · money · data             │
└──────────────────────────────┬───────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐   ┌─────────▼────────┐   ┌─────────▼────────┐
│ SQLite database│   │ Encrypted files  │   │ Static client    │
│ data/*.db      │   │ storage/ (AES-GCM)│   │ client/dist      │
└────────────────┘   └──────────────────┘   └──────────────────┘
```

**Simulated integrations (clearly labelled in the UI):** payment capture, payouts, e-signature, email/SMS notifications, jurisdiction-specific KYC. These are represented by internal state transitions and ledger entries, not external network calls.

---

## 2. Runtime and dependencies

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js ≥ 22.5 | Built-in `node:sqlite`, no native build step |
| HTTP | Express 4 | Small, well understood, easy to audit |
| Validation | Zod | Declarative schemas with typed errors |
| Database | `node:sqlite` | Zero-setup local demo; SQL kept portable |
| Uploads | Multer 2 | Streaming multipart handling |
| Frontend | React 18 + Vite 6 + TypeScript | Fast build, strict typing |
| Tests | Vitest + Supertest | Unit and HTTP integration in one runner |

No ORM is used. Queries are written explicitly, which keeps the SQL portable and the data access visible.

---

## 3. Repository map

```
server/src/
├── app.js              Express wiring and static-client fallback
├── index.js            Listener
├── config.js           Environment configuration and admin permission map
├── db.js               Connection, helpers, default settings, reset
├── schema.sql          Full relational schema
├── seed.js             Deterministic demo data
├── domain/
│   ├── finance.js      Invoices, payment plans, payouts, GST, ledger
│   ├── scheduling.js   Availability, overlaps, timesheets, capacity
│   ├── assessment.js   Question selection, scoring, integrity signals
│   ├── performance.js  100-point review scoring
│   └── pricing.js      Sourced rate recommendation
├── lib/
│   ├── auth.js         Passwords, sessions, CSRF, RBAC, TOTP
│   ├── storage.js      AES-256-GCM file storage, upload policy and magic-byte checks
│   ├── http.js         Rate limiting, headers, audit, pagination, errors
│   ├── money.js        Integer-paise parsing and formatting
│   ├── data.js         Query and shape helpers
│   └── errors.js       Typed application errors
└── routes/
    ├── auth.js
    ├── public.js
    ├── marketplace.js
    ├── professional.js
    ├── employer.js
    └── admin.js
```

```
client/src/
├── App.tsx                 Route table and role guards
├── main.tsx                Provider composition
├── styles.css              Token-driven design system
├── components/
│   ├── ui.tsx              Buttons, cards, tables, modals, charts
│   ├── PortalLayout.tsx    Role-filtered sidebar shell
│   ├── PublicLayout.tsx    Public header, footer, 404
│   ├── ProtectedRoute.tsx  Client-side role gate
│   ├── Brand.tsx           Wordmark and flamingo mark
│   └── portal/PortalKit.tsx Shared portal section primitives
├── context/
│   ├── AuthContext.tsx     Session, role, admin permissions
│   └── ToastContext.tsx    Transient notifications
├── lib/
│   ├── api.ts              Fetch wrapper, CSRF, typed errors
│   ├── format.ts           Currency, dates, labels, status tones
│   ├── hooks.ts            useApi, useDebounced, document title
│   └── useAction.ts        Mutation state and toast handling
└── pages/
    ├── public/             13 public pages
    ├── auth/               Login, professional and employer registration
    └── portal/
        ├── professional/   12 pages
        ├── employer/       12 pages
        └── admin/          9 pages
```

---

## 4. Request lifecycle

1. **Context** — `requestContext` assigns a UUID (`req.id`) used in logs and error responses.
2. **Security headers** — CSP, frame denial, nosniff, referrer policy, permissions policy; `X-Request-Id` is returned.
3. **Body parsing** — JSON and URL-encoded bodies capped at 1 MB.
4. **Route matching** — the relevant router applies authentication, role and permission middleware.
5. **Authentication** — `requireAuth` reads the `fl_session` cookie, hashes the token, joins `sessions` to `users`, checks expiry and account status, and populates `req.user`.
6. **CSRF** — state-changing methods require `X-CSRF-Token` equal to the session's stored token.
7. **Validation** — Zod schemas parse bodies and query strings; failures produce `400` with field details.
8. **Domain logic** — pure domain functions compute money, schedule validity, scores and suggestions.
9. **Persistence** — explicit SQL statements inside a transaction where multiple rows must stay consistent.
10. **Audit** — privileged actions write to `audit_logs` with actor, entity, IP and metadata.
11. **Response** — JSON on success; a standard error envelope on failure.

### Error envelope

```json
{
  "error": {
    "code": "forbidden",
    "message": "Your administrator role does not include this permission",
    "details": null
  },
  "requestId": "2f0c..."
}
```

Status codes used: `400` validation, `401` unauthenticated, `403` forbidden/CSRF, `404` not found, `409` conflict, `413` file too large, `429` rate limited, `500` unexpected.

---

## 5. Data model

The schema contains 32 tables. They group into seven areas.

### 5.1 Identity and access

| Table | Purpose |
| --- | --- |
| `users` | One row per person: role, status, MFA state, demo flag |
| `sessions` | Hashed session token, CSRF token, IP, user agent, expiry |
| `login_attempts` | Authentication telemetry retained 30 days |

### 5.2 Professional and employer profiles

| Table | Purpose |
| --- | --- |
| `professional_profiles` | Experience, skills, rate, verification and visibility state |
| `employer_profiles` | Organisation identity, verification state, billing details |
| `documents` | Encrypted file metadata, owner, review status |
| `employment_history` | Prior roles with dates and verification |
| `professional_references` | Named referees and contact status |

### 5.3 Assessment

| Table | Purpose |
| --- | --- |
| `assessments` | Assessment definition, category, duration |
| `assessment_questions` | Questions, type, options, points, model answer |
| `assessment_attempts` | Attempt state, timings, scores, human review |
| `attempt_answers` | Per-question answers and awarded points |
| `integrity_events` | Paste, focus loss, similarity signals |

### 5.4 Hiring pipeline

| Table | Purpose |
| --- | --- |
| `job_requirements` | Employer demand: role, category, hours, budget |
| `shortlists` | Employer-to-professional interest with contact release |
| `interviews` | At most two rounds per candidate, with outcomes |
| `scorecards` | Structured panel scoring |

### 5.5 Engagements

| Table | Purpose |
| --- | --- |
| `assignments` | Contract terms, schedule, status, signatures |
| `assignment_events` | Append-only lifecycle timeline |
| `timesheets` | Daily attendance, breaks, approval state |

### 5.6 Finance

| Table | Purpose |
| --- | --- |
| `invoices` | Employer invoices with itemised GST |
| `payments` | Simulated captures per invoice |
| `payouts` | Professional payouts with fee and TDS lines |
| `activation_fees` | One row per assignment; enforces single charge |
| `ledger_entries` | Balanced double-entry-style lines by group |

### 5.7 Trust, communication and configuration

| Table | Purpose |
| --- | --- |
| `reviews` | 100-point performance reviews and responses |
| `disputes` | Cases, evidence summary, resolution |
| `notifications` | In-app notifications |
| `audit_logs` | Privileged action record |
| `settings` | Policy values with actor and timestamp |
| `rate_benchmarks` | Sourced rate bands per category and level |
| `contact_messages` | Public contact submissions |

### 5.8 Portability notes

- Primary keys are text IDs with domain prefixes (for example `asg_`, `pay_`, `usr_`), so records remain stable across database engines.
- Timestamps are ISO-8601 text in UTC.
- Booleans are integers (`0`/`1`) for SQLite compatibility.
- Money is `INTEGER` paise.
- Structured values (scores, break schedules, metadata) are JSON text columns.
- There are 11 indexes on the hot lookup paths (session token hash, owner lookups, status filters, assignment and payout joins).
- Foreign keys are enabled.
- Moving to PostgreSQL requires native `BOOLEAN`, `TIMESTAMPTZ`, `JSONB`, retained text IDs, a migration runner, and — most importantly — converting the synchronous `node:sqlite` data layer to an asynchronous driver. This is a planned refactor, not a supported option today. See [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md).

---

## 6. Domain engines

### 6.1 Finance (`domain/finance.js`)

Pure functions, integer paise only:

| Function | Responsibility |
| --- | --- |
| `activationFee(settings, override)` | Returns ₹699 split into base and GST; defaults from settings |
| `employerInvoice(...)` | Builds invoice lines, platform fee and GST |
| `paymentPlan(total, advancePercent)` | Splits into advance and completion amounts |
| `computePayout(...)` | Gross → activation fee → TDS → net, never negative |
| `gstOnPlatformFee(...)` | Itemised GST only on the platform fee |
| `ledgerForInvoiceCapture(...)` | Balanced lines for cash capture |
| `ledgerForActivation(...)` | Balanced lines for the activation fee |
| `ledgerForPayout(...)` | Balanced lines for a payout |
| `assertBalanced(entries)` | Sum of debits equals sum of credits |

**Invariants**

- Debits equal credits for every group.
- No payout can be negative.
- The activation fee is charged at most once per assignment.
- TDS is withheld only above the configured threshold.
- GST is never applied to professional charges in this model.
- Rounding is performed on integer paise, so there is no floating-point drift.

### 6.2 Scheduling (`domain/scheduling.js`)

| Function | Responsibility |
| --- | --- |
| `shiftWindow(start, hours, breaks)` | Attendance window including breaks |
| `validateAvailability(...)` | Days, shift length, start time, break policy |
| `intervalsOverlap(aStart, aEnd, bStart, bEnd)` | Half-open interval overlap |
| `validateAssignmentSchedule(...)` | Daily/weekly caps and day rules |
| `validateTimesheet(...)` | Date, shift length, weekly cap, overlap |
| `remainingCapacity(...)` | Hours left in the week |

Rules are data-driven from `settings`, so policy can change without a code deploy. Boundaries are half-open: an assignment ending at 13:00 and another starting at 13:00 do not overlap.

### 6.3 Assessment (`domain/assessment.js`)

| Function | Responsibility |
| --- | --- |
| `seededShuffle` / `selectQuestions` | Deterministic, complete question sets |
| `scoreObjective` | Auto-mark objective questions; unanswered is incorrect |
| `integrityRisk` | Weighted, capped risk score |
| `similarity` / `plagiarismSignal` | Text similarity as a screening signal only |
| `retakeEligibility` | Enforces the waiting period after a pass |

Integrity output always includes a disclaimer and routes to human review. It never auto-rejects.

### 6.4 Performance (`domain/performance.js`)

Six weighted criteria total 100 points. `scoreReview` validates ranges, `ratingBand` maps totals to bands, and `averageRating` computes published-review averages. Weights are published to users.

### 6.5 Pricing (`domain/pricing.js`)

Rounds a sourced benchmark median through documented factors, clamps to the sourced min–max, and returns the full calculation trail plus source attribution. Missing benchmarks return a refusal, not an invented number.

---

## 7. API conventions

- Base path: `/api`.
- JSON in, JSON out.
- Authentication: `fl_session` HttpOnly cookie.
- CSRF: `X-CSRF-Token` header on `POST`, `PATCH`, `PUT`, `DELETE`.
- Pagination: `page` (default 1) and `limit` (default 20, maximum 100). Responses include `pagination: { page, limit, total, pages }`.
- Errors: `{ error: { code, message, details }, requestId }`.
- Public endpoints never return contact details; contact information is released only after a shortlist relationship exists.
- Money fields are suffixed `_paise` in the API and formatted in the client.

The full endpoint reference is in [API.md](API.md).

---

## 8. Frontend architecture

### 8.1 Routing

`App.tsx` defines three portal trees behind `ProtectedRoute`:

- `/portal/professional/*` — role `professional`
- `/portal/employer/*` — role `employer`
- `/portal/admin/*` — role `admin`

Unknown portal paths redirect to the portal root. Public routes sit in `PublicLayout` with a catch-all 404. Auth pages are standalone.

### 8.2 State and data fetching

- `AuthContext` loads `/auth/me`, exposes the user, role and `adminPermissions`, and handles login/logout/refresh.
- `useApi<T>(path)` fetches on mount and when the path changes, exposing `data`, `loading`, `error`, `reload`.
- `useAction()` wraps mutations with busy key, toast on success and a friendly error message.
- `useDebounced` keeps search and filter requests calm.
- No global state library: server data stays close to the page that needs it.

### 8.3 Design system

- A single token-driven `styles.css` defines colour, spacing, type, radii and elevation.
- `components/ui.tsx` provides buttons, cards, tables, badges, modals, tabs, fields, pagination, progress, score rings, charts, alerts, empty states and loading states.
- `PortalLayout` derives its navigation from role and hides admin items the role cannot use; the server enforces the same permission independently.
- The brand palette is coral/rose on cream, with a deep navy portal shell and a custom SVG flamingo mark.

### 8.4 Accessibility and responsiveness

- Semantic landmarks, labelled form fields, visible focus styles and keyboard-dismissable modals.
- Tables reflow inside a scroll container on narrow screens.
- Status is conveyed by text as well as colour.
- Icons that are decorative are hidden from assistive technology.

---

## 9. Operational behaviour

- **Static hosting** — if `client/dist` exists, the API serves it and falls back to `index.html` for client routes, excluding `/api/*`.
- **Health check** — `GET /api/health` returns status, service name, demo mode and server time.
- **Rate limiting** — in-memory buckets per IP and scope. Suitable for a single instance; replace with a shared store when horizontally scaling.
- **Audit** — privileged mutations call `audit()`; the admin audit view is read-only.
- **Reset** — `npm run seed` resets tables and recreates demo data deterministically.

---

## 10. Design decisions and trade-offs

| Decision | Benefit | Cost |
| --- | --- | --- |
| SQLite for the MVP | Zero setup, portable file, fast tests | Single-writer; not for multi-instance production |
| Explicit SQL, no ORM | Transparent, portable, small dependency surface | More manual mapping code |
| Text IDs with prefixes | Readable records, stable across engines | Slightly larger keys |
| Integer paise | Exact money arithmetic | Requires discipline in every layer |
| In-memory rate limits | Simple, dependency-free | Not shared across instances |
| Pure domain modules | Deterministic, heavily unit-tested | Route layer must map data explicitly |
| Client-side role gates | Good UX, no dead links | Must never be the only control; server RBAC is authoritative |

---

## 11. Scaling path

1. Move the database to PostgreSQL with an async adapter, migration runner and connection pool. Follow [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md); not supported yet.
2. Move uploads to encrypted object storage with signed URLs.
3. Replace in-memory rate limits with Redis.
4. Add a job queue for notifications, payout batches and document scanning.
5. Introduce an external payment aggregator and webhook reconciliation.
6. Split the API and the static client behind a CDN and reverse proxy.
7. Add structured logging, metrics, tracing and alerting before launch.
