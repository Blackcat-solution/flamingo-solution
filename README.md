# FLAMINGO

**The future of flexible talent.** A workforce marketplace MVP built for Flamingo Solution Pvt. Ltd.

FLAMINGO connects experienced professionals with verified employers for structured, shift-based engagements. It combines a public marketplace, a professional portal, an employer portal, an assessment engine, a financial engine and an administration console in one application.

---

## Project status

This repository is a **production-oriented MVP / demonstration system**, not a live financial marketplace.

| Area | Status |
| --- | --- |
| Public website and marketplace | Working |
| Professional portal | Working |
| Employer portal | Working |
| Administration portal | Working |
| Assessment engine | Working |
| Finance and ledger engine | Working, with a **simulated** payment gateway |
| Automated tests | 101 passing |
| Browser end-to-end tests | 14 passing |
| HTTP role/permission smoke test | 58 checks passing |
| Production build | Passing |

All seeded people, companies, documents and payments are **demo data**. They must never be presented as real users or real revenue. Features that would require external integrations (payments, bank payouts, e-signature, email/SMS, government KYC) are labelled **simulated** in the interface and in this documentation.

---

## Stack

- **Backend:** Node.js (ESM), Express 4, Zod validation, `node:sqlite`
- **Frontend:** React 18, Vite 6, TypeScript, React Router
- **Tests:** Vitest, Supertest, Playwright
- **Runtime requirement:** Node.js **22.5 or newer** (for `node:sqlite`)

Money is stored as integer paise, never floating point. The schema is written to be portable to PostgreSQL, but the shipped database is SQLite for zero-setup local use.

---

## Quick start

From the repository root:

```bash
npm install
npm run seed
npm run dev
```

- Frontend dev server: `http://localhost:5173`
- API: `http://localhost:4000`

For a single-process production-style run:

```bash
npm run build
npm start
```

The API serves the built client from `client/dist` at `http://localhost:4000`.

### Demo accounts

All demo accounts use the password:

```
Flamingo@2026
```

| Role | Email |
| --- | --- |
| Professional | `candidate@flamingo.work` |
| Employer | `employer@flamingo.work` |
| Super administrator | `admin@flamingo.work` |
| Finance officer | `finance@flamingo.work` |
| Verification officer | `verification@flamingo.work` |
| Support | `support@flamingo.work` |

Full details, seeded record IDs and reset instructions are in [`docs/DEMO_ACCOUNTS.md`](docs/DEMO_ACCOUNTS.md).

---

## The money model

The required example reconciles exactly:

```
Assignment value        ₹20,000
Advance (50%)           ₹10,000
Activation fee           − ₹699   (GST-inclusive; deducted once)
First payout            ₹9,301
Final payout (50%)      ₹10,000
Total to professional   ₹19,301
```

- The **₹699 activation fee** is charged once per assignment, from the **first payout only**. It is not a subscription. Declining an assignment before activation means nothing is deducted.
- The fee is GST-inclusive: base **₹592.37**, GST **₹106.63** at 18%.
- The **platform fee defaults to 0%**, so the example reconciles exactly. When configured above zero, it is itemised separately with GST.
- Professional charges do not attract GST in this model. Confirm the final tax treatment with a qualified adviser.
- The payment gateway is **simulated**. There is no escrow, no real charge and no real bank transfer.

---

## Working rules enforced by the engine

- Shift lengths: **8, 10 or 12 hours**
- **Four working days per week**
- **Sunday and Monday compulsory off**
- Availability: **Tuesday to Saturday**
- Caps: **12 hours per day** and **48 hours per week** across all employers
- Breaks: **15 + 15 + 30 minutes** inside the attendance window
- No overlapping bookings or interviews
- Maximum **two interview rounds**: panel, then final discussion

---

## Repository layout

```
FLAMINGO/
├── client/                 React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── pages/public/       Public marketing and marketplace
│   │   ├── pages/auth/         Login and registration
│   │   ├── pages/portal/       Professional, employer and admin portals
│   │   ├── components/         Design system and shared UI
│   │   ├── context/            Auth and toast providers
│   │   └── lib/                API client, formatters, hooks
│   └── dist/                   Production build served by the API
├── server/
│   ├── src/
│   │   ├── routes/             auth, public, marketplace, professional, employer, admin
│   │   ├── domain/             finance, scheduling, assessment, performance, pricing
│   │   ├── lib/                auth, storage, http, money, validation
│   │   ├── schema.sql          Relational schema
│   │   └── seed.js             Demo data
│   └── test/                   Vitest + Supertest suites
├── scripts/
│   ├── smoke.mjs           HTTP role and permission smoke test
│   ├── backup.mjs          Online SQLite + storage backup
│   └── restore.mjs         Restore with key fingerprint check
└── docs/                   Research, architecture, security, testing, deployment ...
```

---

## Verification

```bash
# Automated unit and API tests (101 tests)
npm test

# Browser end-to-end tests (14 tests; run npx playwright install chromium once)
npm run e2e

# HTTP smoke test against a running server
node scripts/smoke.mjs http://localhost:4000

# Type-check and production build
npm run build

# Consistent database and encrypted-storage backup
npm run backup
```

Current results and coverage are recorded in [`docs/TESTING.md`](docs/TESTING.md).

---

## Documentation

| Document | Contents |
| --- | --- |
| [RESEARCH.md](docs/RESEARCH.md) | Market context, sourced rate benchmarks, assumptions and what is deliberately not claimed |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data model, domain engines, API conventions |
| [SECURITY.md](docs/SECURITY.md) | Authentication, RBAC, MFA, encryption, audit, threat model |
| [TESTING.md](docs/TESTING.md) | Test strategy, inventory, results and known gaps |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Environment variables, build, reverse proxy, backups, rollback |
| [DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) | Vercel frontend + separate API host: runbook, proxy rewrite, verification checklist |
| [POSTGRES_MIGRATION.md](docs/POSTGRES_MIGRATION.md) | Planned PostgreSQL migration; not yet supported |
| [PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) | Go-live checklist and blockers |
| [BLOCKER_ACQUISITION.md](docs/BLOCKER_ACQUISITION.md) | How to obtain each blocker: who to engage, what to send, acceptance criteria, sequencing |
| [docs/rfq/](docs/rfq/) | Ready-to-send RFQ/RFP templates for legal, tax, privacy, payments, KYC and pen test |
| [DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md) | Demo logins, seeded records, reset steps |
| [API.md](docs/API.md) | Endpoint reference, conventions and examples |

---

## Important disclaimers

- **Demo data is labelled.** Identity verification, assessments, assignments and payments in the seed are fictional.
- **The payment gateway is simulated.** Do not describe Flamingo as holding funds in escrow.
- **AI/integrity signals are review prompts, not proof.** The assessment engine flags patterns for a human reviewer. It never claims 100% accuracy and never auto-rejects on an integrity signal alone.
- **Rate benchmarks are sourced estimates.** Each benchmark carries a source name, URL and as-of date. They are context for negotiation, not guarantees, and must be re-validated before production pricing decisions.
- **GST and TDS settings are operational controls, not tax advice.** A qualified adviser must confirm treatment before launch.
- **This system is not yet production-live.** See the blockers in [PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

---

© 2026 Flamingo Solution Pvt. Ltd. Demo build.
