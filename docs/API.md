# API reference

Base URL: `http://localhost:4000/api` (development)

All requests and responses are JSON. Money fields are integer **paise** and are suffixed `_paise`. Dates and timestamps are ISO-8601 strings.

---

## 1. Conventions

### 1.1 Authentication

Sign in with `POST /auth/login`. The server sets an `HttpOnly` session cookie named `fl_session` and returns a CSRF token:

```json
{
  "user": {
    "id": "usr_pro_1",
    "name": "Aarav Mehta",
    "email": "candidate@flamingo.work",
    "role": "professional",
    "adminRole": null,
    "mfaEnabled": false
  },
  "csrfToken": "…",
  "mfaEnrollmentRequired": false
}
```

Send the cookie on every subsequent request. Send the CSRF token on every state-changing request:

```
Cookie: fl_session=…
X-CSRF-Token: …
```

`GET /auth/me` returns the current user, a fresh copy of the CSRF token and `mfaEnrollmentRequired`. If MFA is enabled, `POST /auth/login` returns `200` with `error.code = "mfa_required"` and `mfaRequired: true`; repeat the login with `code`. When admin MFA enforcement is on and an administrator has not enrolled, the admin API returns `403 mfa_enrollment_required`; call `/auth/mfa/setup` and `/auth/mfa/enable` to unlock it.

### 1.2 Error envelope

```json
{
  "error": {
    "code": "forbidden",
    "message": "Your administrator role does not include this permission",
    "details": null
  },
  "requestId": "c0a8…"
}
```

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `bad_request` / `validation_error` | Invalid input; `details` lists fields |
| 401 | `unauthorized` | Missing or expired session |
| 403 | `forbidden` | Wrong role, missing permission or CSRF failure |
| 403 | `mfa_enrollment_required` | Administrator must enrol TOTP before using the admin API |
| 404 | `not_found` | No matching route or record |
| 409 | `conflict` | Duplicate action or invalid state transition |
| 413 | `file_too_large` | Upload exceeds 8 MB |
| 422 | `unprocessable` | Domain rule violation (for example a scheduling conflict) |
| 429 | `too_many_requests` | Rate limit exceeded |
| 500 | `internal_error` | Unexpected failure |

### 1.3 Pagination

Send `page` (default 1) and `limit` (default 20, maximum 100). List responses include:

```json
{
  "rows": [],
  "pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 }
}
```

### 1.4 Rate limits

| Scope | Limit |
| --- | --- |
| Login per IP | 20 per 15 minutes |
| Failed logins per account | 5 per 15 minutes, then a 15-minute lock |
| Registration per IP | 10 per hour |
| Public contact form | Limited per IP per window |

Exceeding a limit returns `429` with a `Retry-After` header.

---

## 2. Authentication

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register/professional` | Public | Create a professional account (minimum 3 years) |
| POST | `/auth/register/employer` | Public | Create an employer account |
| POST | `/auth/login` | Public | Sign in; optionally supply an MFA code |
| POST | `/auth/logout` | Session | Destroy the session |
| GET | `/auth/me` | Session | Current user and CSRF token |
| POST | `/auth/mfa/setup` | Session | Generate a TOTP secret and otpauth URL |
| POST | `/auth/mfa/enable` | Session | Verify a code and enable MFA |
| POST | `/auth/mfa/disable` | Session | Disable MFA |
| POST | `/auth/password/change` | Session | Change the password |

### Example: login

```bash
curl -i -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"candidate@flamingo.work","password":"Flamingo@2026"}'
```

---

## 3. Public endpoints

No authentication. These power the public site.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/public/config` | Public policy, fees, terms and brand values |
| GET | `/public/categories` | Professional categories |
| GET | `/public/benchmarks` | Sourced rate benchmarks with methodology note |
| GET | `/public/stats` | Public aggregate counters |
| GET | `/public/faqs` | Frequently asked questions |
| POST | `/public/contact` | Contact form submission (rate-limited) |

---

## 4. Marketplace

Public, read-only. Contact details are never returned.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/marketplace/professionals` | Search and filter the directory |
| GET | `/marketplace/featured` | Featured verified professionals |
| GET | `/marketplace/professionals/:id` | Full public profile |
| GET | `/marketplace/compare` | Compare selected professionals |

### Directory query parameters

| Parameter | Example | Meaning |
| --- | --- | --- |
| `q` | `react` | Free-text search |
| `category` | `technology` | Category filter |
| `city` | `Bengaluru` | City filter |
| `minExperience` | `5` | Minimum years |
| `maxRate` | `2500` | Maximum hourly rate (rupees) |
| `minRating` | `4` | Minimum rating |
| `availabilityDay` | `TUE` | Available day |
| `sort` | `rating` / `rate` / `experience` | Sort order |
| `page`, `limit` | `1`, `9` | Pagination |

Only professionals who are verified, assessed and publicly visible appear.

---

## 5. Professional portal

Requires `role = professional`. All paths are scoped to the signed-in professional.

### Profile and documents

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/professional/dashboard` | Dashboard summary |
| GET | `/professional/profile` | Full profile |
| PATCH | `/professional/profile` | Update editable fields |
| POST | `/professional/profile/submit` | Submit for verification |
| POST | `/professional/profile/visibility` | Toggle public visibility |
| POST | `/professional/documents` | Upload a document (multipart `file`) |
| GET | `/professional/documents/:id/download` | Download own document |
| POST | `/professional/employment` | Add employment history |
| POST | `/professional/references` | Add a reference |
| GET | `/professional/pricing/recommendation` | Sourced rate suggestion with calculation trail |

### Assessments

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/professional/assessments` | Available assessments and attempts |
| POST | `/professional/assessments/:id/start` | Start an attempt |
| GET | `/professional/attempts/:id` | Attempt state and questions |
| POST | `/professional/attempts/:id/answer` | Save an answer |
| POST | `/professional/attempts/:id/integrity` | Record an integrity signal |
| POST | `/professional/attempts/:id/submit` | Submit for scoring |

### Assignments and timesheets

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/professional/assignments` | Assignment list |
| GET | `/professional/assignments/:id` | Assignment detail, payouts, events |
| POST | `/professional/assignments/:id/accept` | Accept and sign |
| POST | `/professional/assignments/:id/decline` | Decline |
| POST | `/professional/assignments/:id/submit-completion` | Submit completion |
| GET | `/professional/timesheets` | Timesheet list |
| POST | `/professional/timesheets` | Submit a timesheet |
| GET | `/professional/finance/summary` | Earnings, payouts, activation fees |
| GET | `/professional/career` | Career history and reviews |
| GET | `/professional/reviews` | Published reviews |
| POST | `/professional/reviews/:id/respond` | Respond to or challenge a review |
| GET | `/professional/interviews` | Scheduled interviews |
| GET | `/professional/notifications` | Notifications |
| POST | `/professional/notifications/:id/read` | Mark as read |

---

## 6. Employer portal

Requires `role = employer`. All paths are scoped to the signed-in employer.

### Profile and requirements

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/employer/dashboard` | Dashboard with verification and hiring gates |
| GET | `/employer/profile` | Employer profile |
| PATCH | `/employer/profile` | Update profile |
| POST | `/employer/documents` | Upload a verification document |
| GET | `/employer/documents/:id/download` | Download own document |
| GET | `/employer/requirements` | Requirement list |
| POST | `/employer/requirements` | Create a requirement |
| PATCH | `/employer/requirements/:id` | Update a requirement |

### Shortlisting and interviews

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/employer/shortlist` | Shortlisted professionals |
| POST | `/employer/shortlist` | Shortlist a professional (releases contact) |
| DELETE | `/employer/shortlist/:id` | Remove from shortlist |
| GET | `/employer/interviews` | Interview list |
| POST | `/employer/interviews` | Schedule an interview |
| POST | `/employer/interviews/:id/scorecard` | Submit a panel scorecard |
| POST | `/employer/interviews/:id/outcome` | Record an outcome |

At most two rounds are allowed. Hiring requires a completed final round with outcome `selected`.

### Assignments, timesheets and money

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/employer/assignments` | Assignment list |
| POST | `/employer/assignments` | Create an assignment |
| GET | `/employer/assignments/:id` | Assignment detail |
| POST | `/employer/assignments/:id/sign` | Sign the contract |
| POST | `/employer/assignments/:id/approve-completion` | Approve completion |
| POST | `/employer/assignments/:id/pay` | Capture a simulated advance or final payment |
| GET | `/employer/timesheets` | Timesheet queue |
| POST | `/employer/timesheets/:id/approve` | Approve a timesheet |
| POST | `/employer/timesheets/:id/reject` | Reject a timesheet |
| GET | `/employer/finance` | Invoices, payments and totals |
| GET | `/employer/invoices/:id` | Invoice detail |
| GET | `/employer/reviews` | Review list |
| POST | `/employer/assignments/:id/review` | Publish a 100-point review |

### Example: assignment response fragment

```json
{
  "paymentPlan": {
    "advancePaise": 1000000,
    "finalPaise": 1000000,
    "totalPaise": 2000000
  },
  "activationFeeDisclosure": "₹699 is deducted once from the professional's first payout for this assignment."
}
```

---

## 7. Administration

Requires `role = admin` plus the listed permission. `super_admin` has `*`.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/dashboard` | `users.view` | Platform dashboard |
| GET | `/admin/verifications/professionals` | `verification.review` | Professional verification queue |
| POST | `/admin/verifications/professionals/:id/decision` | `verification.review` | Approve or reject |
| GET | `/admin/verifications/employers` | `verification.review` | Employer verification queue |
| POST | `/admin/verifications/employers/:id/decision` | `verification.review` | Approve or reject |
| POST | `/admin/documents/:id/review` | `documents.review` | Review a document |
| GET | `/admin/documents/:id/download` | `documents.review` | Download a document (audited) |
| GET | `/admin/assessment-attempts` | `marketplace.moderate` | Assessment review queue |
| GET | `/admin/assessment-attempts/:id` | `marketplace.moderate` | Attempt detail |
| POST | `/admin/assessment-attempts/:id/review` | `marketplace.moderate` | Record a human review |
| GET | `/admin/finance/summary` | `finance.view` | Totals, payouts, ledger, reconciliation |
| POST | `/admin/payouts/:id/mark-paid` | `payouts.manage` | Release a payout |
| GET | `/admin/disputes` | `disputes.view` or `disputes.finance` | Dispute register |
| POST | `/admin/disputes/:id/resolve` | `disputes.finance` | Record a resolution |
| GET | `/admin/reviews/challenges` | `marketplace.moderate` | Challenged reviews |
| POST | `/admin/reviews/:id/resolve` | `marketplace.moderate` | Uphold or revise |
| GET | `/admin/users` | `users.view` | Search all accounts |
| POST | `/admin/users/:id/status` | `*` (super admin) | Suspend, activate or close |
| GET | `/admin/audit` | `users.view` | Audit log |
| GET | `/admin/settings` | `users.view` or `*` | Read policy settings |
| PATCH | `/admin/settings` | `*` (super admin) | Update policy settings |
| GET | `/admin/reports/overview` | `reports.view` | Operational reports |

### Admin role permissions

| Role | Permissions |
| --- | --- |
| `super_admin` | `*` |
| `finance_officer` | `finance.view`, `finance.reconcile`, `payouts.manage`, `disputes.finance`, `reports.view` |
| `verification_officer` | `users.view`, `verification.review`, `documents.review`, `marketplace.moderate` |
| `recruitment_manager` | `users.view`, `marketplace.view`, `assignments.view`, `interviews.view`, `reports.view` |
| `support` | `users.view`, `support.tickets`, `disputes.view`, `marketplace.view` |

---

## 8. Key examples

### 8.1 Finance summary (admin)

```bash
curl http://localhost:4000/api/admin/finance/summary \
  -H 'Cookie: fl_session=…'
```

Relevant fields:

```json
{
  "totals": { "activationBasePaise": 59237, "activationGstPaise": 10663 },
  "payouts": [
    {
      "id": "po_asg_1_advance",
      "gross_paise": 1000000,
      "activation_fee_paise": 69900,
      "net_paise": 930100,
      "status": "paid"
    }
  ],
  "reconciliation": { "balanced": true }
}
```

### 8.2 Submit a timesheet

```bash
curl -X POST http://localhost:4000/api/professional/timesheets \
  -H 'Content-Type: application/json' \
  -H 'Cookie: fl_session=…' \
  -H 'X-CSRF-Token: …' \
  -d '{
    "assignmentId": "asg_1",
    "workDate": "2026-11-17",
    "startTime": "09:30",
    "endTime": "18:30",
    "breakMinutes": 60
  }'
```

A Sunday, a non-scheduled day, an over-long shift or a weekly cap breach returns `422` with details.

### 8.3 Resolve a dispute

```bash
curl -X POST http://localhost:4000/api/admin/disputes/disp_1/resolve \
  -H 'Content-Type: application/json' \
  -H 'Cookie: fl_session=…' \
  -H 'X-CSRF-Token: …' \
  -d '{
    "status": "resolved",
    "resolution": "Reviewed the approved timesheet and written communication. The disputed hours were correctly logged and no adjustment is required."
  }'
```

A resolution note of at least 10 characters is required and is shown to the person who raised the dispute.

---

## 9. Uploads

`POST /professional/documents` and `POST /employer/documents` accept `multipart/form-data` with a single `file` field.

- Allowed: PDF, JPEG, PNG, WebP
- Maximum: 8 MB
- Declared `Content-Type` must match the file's magic bytes; disguised or corrupted files return `422`
- Stored encrypted (AES-256-GCM); user filenames are never used for storage paths

---

## 10. Simulated integrations

The following are internal simulations, not external calls:

- Payment capture (`POST /employer/assignments/:id/pay`) creates a payment row with `gateway: "simulated"`.
- Payouts are internal state transitions; no bank transfer occurs.
- E-signature is recorded as flags and timestamps on the assignment.
- Notifications are in-app only.
- KYC is represented by document review, not a government registry check.

Do not describe these as live financial or identity services.
