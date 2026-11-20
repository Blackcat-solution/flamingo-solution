# How to obtain each go-live blocker

**Entity:** Flamingo Solution Pvt. Ltd. · **Product:** FLAMINGO
**Written:** 12 November 2026
**Companion to:** [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) §9

This is an acquisition guide, not a compliance opinion. For each blocker it answers five questions:

1. **What exactly are you buying** (the deliverable, not the activity).
2. **Who to engage** and how to find them.
3. **What to send them** on day one.
4. **How you accept the work** (so "done" is not the vendor's opinion of done).
5. **What engineering does the moment the output arrives.**

Cost and lead-time figures are indicative 2026 India market ranges for a company of this size. Treat them as budgeting anchors, not quotes.

---

## Master view

| # | Blocker | Deliverable you must hold | Engage | Lead time | Indicative cost |
|---|---|---|---|---|---|
| 1 | Legal custody opinion | Signed written opinion on whether FLAMINGO holds customer funds | Fintech/payments law firm | 3–5 weeks | ₹75k–₹3L |
| 2 | Tax review | Written note on GST, TCS, TDS, invoice fields, place of supply | Chartered accountant / indirect-tax adviser | 2–4 weeks | ₹40k–₹1.5L |
| 3 | Privacy / DPDP | Notice, consent design, ROPA, retention schedule, DPAs, breach playbook | Privacy counsel + DPO | 6–10 weeks | ₹1.5L–₹6L |
| 4 | Secret manager / KMS | Managed secret store + KMS key with rotation and audit | Cloud provider + 2 days engineering | 1–2 weeks | ₹2k–₹15k/mo |
| 5 | Payments + payouts | Live merchant account, split/settlement rail, webhooks, reconciliation | Payment aggregator | 4–10 weeks | Setup free; 1.5–2.5% + per-payout fee |
| 6 | KYC provider | Contracted API, sandbox passed, production credentials, policy | KYC vendor | 3–6 weeks | ₹3–₹30 per check |
| 7 | Malware scanning | Scanner in the upload path, EICAR-verified, quarantine working | Self-hosted + 3–5 days engineering | 1 week | ₹0–₹5k/mo |
| 8 | PostgreSQL | Managed instance, migrated schema, PITR, restore drill passed | Cloud provider + engineering | 6–10 weeks | ₹8k–₹40k/mo |
| 9 | Penetration test | CERT-In empanelled report, no open Critical/High | Empanelled auditor | 4–7 weeks | ₹1.5L–₹6L |
| 10 | Monitoring / IR | Dashboards, alerts, on-call rota, incident runbook, CERT-In reporting | Tooling + part-time SRE | 2–3 weeks | ₹5k–₹30k/mo |
| 11 | E2E / a11y / UAT | Playwright suite green, WCAG 2.2 AA audit, signed UAT | Engineering + a11y auditor + business owner | 4–6 weeks | ₹0–₹2.5L |
| 12 | Demo accounts | Production database with zero `is_demo` rows | Internal | 1 day | ₹0 |

**Critical path:** 3 → 1 → 5. You cannot open a payment aggregator account without published terms and a privacy policy, and you cannot design the payout flow until counsel says whether you may touch the money. Start 3 and 1 in the same week.

---

## 0. The document pack to send every vendor

Create one folder and reuse it. Most delays are vendors waiting for paperwork.

| Document | Needed by |
|---|---|
| Certificate of incorporation + CIN | Payments, KYC, pen test, legal |
| PAN of the company | Payments, KYC, tax |
| GST registration certificate | Payments, tax |
| Board resolution authorising the signatory | Payments, KYC |
| Directors' PAN, Aadhaar (masked), address proof | Payments, KYC |
| Last 6 months' bank statement | Payments |
| MOA/AOA | Legal, payments |
| Website URL with live terms, privacy, refund pages | Payments (mandatory) |
| Cancelled cheque + bank verification letter | Payments, payouts |
| Latest audited financials (or a declaration that none exist) | Route-style eligibility |
| This repository's architecture summary | Pen test |
| Data-flow diagram | Privacy, pen test |

> If the company is newly incorporated, say so up front. Several vendors have a "new entity" track; hiding it costs two weeks later.

---

## 1. Legal custody opinion

### What you are buying

A signed opinion from an Indian lawyer answering, in writing, these five questions about the FLAMINGO flow:

- Employer pays ₹20,000 → FLAMINGO deducts ₹699 → professional receives ₹9,301 advance and ₹10,000 on completion.
- Does FLAMINGO, at any instant, hold funds "in custody" or operate a payment system?
- Must FLAMINGO be authorised by RBI as a Payment Aggregator, or must it route entirely through one?
- If routed through a PA, whose name appears on the settlement, and can FLAMINGO describe the flow as "held for the professional"?
- What language may the website, contract and invoices use — and what must it never say?

The opinion must expressly address the **RBI Master Direction on Regulation of Payment Aggregator (September 2025)**, which states a PA business must not carry on marketplace business, and the requirement that non-bank PAs use a Scheduled Commercial Bank escrow account. That combination is exactly the risk in this model.

### Who to engage

A firm with a live fintech/payments practice, not a general corporate firm. Ask for the partner who has filed PA authorisation applications.

Channels:
- **Large full-service:** Cyril Amarchand Mangaldas, Khaitan & Co, AZB & Partners, Trilegal, JSA.
- **Fintech boutiques (usually better value at this stage):** Ikigai Law, Spice Route Legal, Pioneer Legal, Saakshya Law, Verus Advocates.
- **Referral route:** ask the payment aggregator's onboarding manager who they see approve marketplace models. They know which opinions their compliance team accepts.

Shortlist three, send the same scope, compare on partner time (not firm brand).

### What to send

The RFQ at [rfq/legal-opinion-rfq.md](rfq/legal-opinion-rfq.md), plus:
- the money flow above with the exact ₹20,000 worked example;
- a one-page data flow (employer → FLAMINGO account → professional);
- the draft terms of service, if any;
- the intended aggregator (see §5).

### Acceptance criteria

- Written, signed, on letterhead, addressed to the company.
- Names the specific RBI directions considered and the date of the version.
- Gives a **yes/no** on custody and on PA authorisation — not "may require consideration".
- Lists permitted and prohibited marketing language.
- States what changes if FLAMINGO later holds funds for more than *n* hours.
- One follow-up call with your engineering lead included.

### Timeline and cost

3–5 weeks; ₹75,000–₹3,00,000 for a focused opinion. A full regulatory memo is more; you do not need one yet.

### Engineering follow-through

The opinion dictates the ledger model. If funds must never touch a FLAMINGO account, the payout integration becomes a **split settlement at the aggregator** and the platform ledger becomes a record of entitlements, not a bank balance. That is a change to `server/src/lib/ledger` and the payout batch, so get the opinion before writing the integration.

### Common failure mode

Asking a corporate lawyer for a "legal opinion on the payment model". You will get a 40-page survey of Indian payments law and no answer. Ask the five questions.

---

## 2. Tax review

### What you are buying

A written note covering:

| Question | Why it matters here |
|---|---|
| Is the ₹699 activation fee a FLAMINGO service, or a commission on the professional's supply? | Decides who invoices whom and the GST rate |
| Does GST apply at 18% on the fee, and is it inclusive or additional? | The ₹20,000 example must stay exact |
| Does FLAMINGO need to collect **TCS under CGST §52** as an e-commerce operator? | Services marketplaces are often outside it — must be confirmed, not assumed |
| Does **TDS under §194-O** apply to payments to professionals, and who deducts? | Changes the net payout and the 26AS trail |
| §194J / §194C for professional or contract services — which applies? | Determines the deduction the professional sees |
| Place of supply for a professional sitting in another state | Determines IGST vs CGST+SGST |
| Invoice series, mandatory fields, e-invoicing threshold | Blocks statutory invoicing |
| Is the professional an independent contractor, and does that survive a 4-day/week roster? | Labour-law exposure, not just tax |

### Who to engage

A CA firm with e-commerce and marketplace clients. Big Four (Deloitte, PwC, EY, KPMG), mid-tier (Grant Thornton, BDO, Nexdigm, ASA) or a strong local practice. For a company this size, a mid-tier indirect-tax team is usually the right cost/quality point. Ask specifically: *"How many services marketplaces do you currently handle TCS/TDS for?"*

### What to send

[rfq/tax-review-rfq.md](rfq/tax-review-rfq.md), plus the ledger schema, the invoice template, and the ₹20,000 example.

### Acceptance criteria

- A table of every money movement with: who invoices, GST rate, TDS section, TCS applicability, net effect.
- Explicit confirmation that ₹20,000 → ₹9,301 + ₹10,000 = ₹19,301 still holds after tax treatment, or a corrected worked example.
- Registration obligations with deadlines (GST, TAN, professional tax, Shops & Establishments).
- A named person who will answer the aggregator's tax questions during onboarding.

### Timeline and cost

2–4 weeks; ₹40,000–₹1,50,000. Ongoing retainer ₹10,000–₹30,000/month is worth it for the first two quarters of live money.

### Engineering follow-through

Most likely output is a change to the fee object: whether ₹699 is GST-inclusive, whether TDS is deducted before or after the fee, and the exact invoice fields. That is a small, well-tested change in the finance engine — but it must not move the ₹19,301 total.

---

## 3. Privacy and DPDP

### What you are buying

DPDP is not a policy page. The deliverable is a working set:

1. **Data map / ROPA** — every field, purpose, lawful basis, storage location, retention period, recipient.
2. **Notice** under §5 — plain-language, itemised, in English and the languages you operate in.
3. **Consent design** — separate, unbundled consents; withdrawal path as easy as giving; consent artefacts stored with version and timestamp.
4. **Retention and erasure schedule** — per document class (ID proofs, contracts, assessment recordings, payout records).
5. **Vendor DPAs** — aggregator, KYC, email/SMS, hosting, error tracking, backups.
6. **Breach playbook** — detection, containment, notification to the Data Protection Board and to data principals.
7. **Grievance officer** — named, with a published channel and a response SLA.
8. **DPIA** for high-risk processing — identity documents and financial data qualify.
9. **Consent Manager readiness** note.

### The timing you must plan around

The DPDP Rules 2025 were notified on **13 November 2025** and phase in:

- **13 November 2026** — consent-manager framework (Rule 4) becomes operative.
- **13 May 2027** — the substantive fiduciary obligations, including notice, consent, security and breach reporting.

So the consent-manager milestone is effectively **now**, and the substantive obligations are ~6 months out. Instruments executed today should already be in the final form. Confirm the exact Rule 7 breach window with counsel — do not rely on a summary.

### Who to engage

Two roles, often one firm plus one individual:
- **Privacy counsel** — drafts the notice, DPAs, retention schedule and playbook.
- **A DPO or privacy consultant** — operationalises it: ROPA, consent register, training, vendor review.

Candidates: Ikigai Law, Spice Route Legal, Tsaaro, Arrka, DSCI empanelled consultants, or a Big Four privacy practice. For an India-only, pre-scale company, a specialist boutique (Tsaaro/Arrka) plus a lawyer review is usually the most practical combination.

### What to send

[rfq/privacy-dpdp-rfq.md](rfq/privacy-dpdp-rfq.md), plus the data map you can generate from the schema, and the vendor list.

### Acceptance criteria

- Every field in the database appears in the ROPA, or is justified as not personal data.
- Every third party has a signed DPA in the pack — not a promise to sign.
- The consent screen in the product maps 1:1 to the notice clauses.
- Erasure actually works: a documented, tested procedure, not a policy statement.
- The grievance channel is live and tested with a real email.
- Sign-off from the DPO in the [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) §12 table.

### Timeline and cost

6–10 weeks; ₹1,50,000–₹6,00,000 depending on whether drafting and operationalisation are separate.

### Engineering follow-through

Consent capture with versioning, a withdrawal flow, retention jobs, an export/erasure endpoint, and DPA-driven changes to what you log. Budget real work here — this is the blocker most likely to be underestimated.

---

## 4. Secret manager and KMS

### What you are buying

- A managed secret store holding: `DOCUMENT_ENCRYPTION_KEY`, database credentials, session signing material, aggregator API keys, KYC API keys, SMTP credentials.
- A KMS key with envelope encryption for document encryption, rotation enabled, and an audit trail of every decrypt.
- IAM so that only the application role can read the secrets, and no human has standing access.
- A break-glass procedure documented and tested.

### Who to engage

You do not need a vendor; you need whichever cloud you already run on.

| Option | Fit |
|---|---|
| AWS Secrets Manager + AWS KMS | Best if hosting on AWS (Mumbai / `ap-south-1`) |
| GCP Secret Manager + Cloud KMS | Best on GCP |
| Azure Key Vault | Best on Azure |
| HashiCorp Vault (self-hosted) | Only if you cannot use a cloud; you now own HA and unsealing |

### How to do it

1. Create the secret store and one KMS key with a documented rotation period.
2. Move every value out of `.env` / process environment into the store.
3. Load at boot through the provider SDK with an instance role — never a long-lived key on disk.
4. Record the key **fingerprint** in the deployment runbook; the existing backup/restore scripts already check it.
5. Re-encrypt existing documents under the KMS-derived key if the development key was ever used with real files.
6. Test: revoke the role and confirm startup fails closed.

### Acceptance criteria

- `grep` of the repository and the host finds no secret material.
- Boot fails closed if the secret store is unreachable.
- Rotation performed once, with documents still readable afterwards.
- Audit log shows decrypt events attributable to the application role only.

### Timeline and cost

1–2 weeks, mostly engineering; ₹2,000–₹15,000/month. Cheapest blocker to close and one of the highest value — do it early.

---

## 5. Real payments, payouts and reconciliation

### What you are buying

1. A live merchant account on a **RBI-authorised Payment Aggregator**.
2. A settlement mechanism that pays the professional without FLAMINGO holding the money — split settlement, linked accounts, or a payout API funded from the aggregator's settlement.
3. Signed webhooks for payment success, failure, refund and settlement, with replay protection.
4. A payout batch with idempotency, beneficiary verification and status reconciliation.
5. Daily reconciliation: aggregator settlement report ↔ platform ledger ↔ bank statement, with an exception queue.
6. Refund and chargeback flows.

### The eligibility trap

Razorpay Route, Cashfree and similar split-settlement products now apply **turnover thresholds** (typically requiring a minimum FY25/FY26 turnover) following the September 2025 RBI directions. A newly incorporated company may **not** qualify. Confirm eligibility in writing before designing around any one provider.

Ask each provider three questions in writing:
1. Do we meet your marketplace turnover threshold, and if not, what is the alternative onboarding path?
2. In whose name does the professional's settlement appear, and does FLAMINGO ever hold the funds?
3. Which entity is the merchant of record on the customer's statement?

### Who to engage

Request onboarding calls with at least three: Razorpay, Cashfree, and one of PayU / PhonePe PG / CCAvenue / a bank-hosted PG. Ask for the **marketplace/compliance** team, not sales.

The compliance team will ask for the document pack in §0 and will read your website. Terms, privacy and refund pages must be live first — this is why §3 precedes §5.

### What to send

[rfq/payment-integration-rfq.md](rfq/payment-integration-rfq.md), the legal opinion from §1, the tax note from §2, and the live URLs.

### Acceptance criteria

- A test-mode end-to-end run of the exact ₹20,000 example producing ₹9,301 and ₹10,000 settlements with the ₹699 fee retained.
- Webhook signature verification with a replayed payload rejected.
- A payout retried twice produces one bank credit.
- A settlement report parsed into the ledger with zero unexplained rows for 14 consecutive days.
- Refund and chargeback runbooks executed once in test.
- Written confirmation of the custody position matching the §1 opinion.

### Timeline and cost

4–10 weeks including KYC of directors and website review. Pricing typically 1.5–2.5% + GST on collections, plus ₹2–₹15 per payout. Negotiate the payout fee at volume.

### Engineering follow-through

Webhook handler with idempotency keys, a settlement import job, a reconciliation table with an exception state, and payout state machine changes. Do not build this before §1 and §2 answer, or you will build it twice.

---

## 6. KYC provider

### What you are buying

- Contracted access to: PAN verification, Aadhaar-based verification **through the vendor's licence** (never raw Aadhaar storage), bank account verification (penny-drop or API), liveness/face match, and optionally address and employment signals.
- Sandbox credentials, then production credentials.
- A documented verification policy: which checks are mandatory for professionals, which for employers, what happens on a mismatch, and who reviews manually.
- Audit logs retained per your retention schedule.

### Who to engage

| Vendor | Strength |
|---|---|
| Signzy | Broad API catalogue, strong onboarding tooling |
| IDfy | Document + video KYC, good developer experience |
| HyperVerge | Liveness and face match |
| Perfios / Karza | Data aggregation and risk signals |
| Surepass | Competitive per-call pricing |
| Digio | eSign + KYC bundle, useful for contracts |
| AuthBridge | Background verification, if you add employment checks |

Ask all of them the same eight questions (in the RFP):
1. Per-verification price at 1k / 10k / 100k calls.
2. Where is data stored, and for how long?
3. Do you act as a Data Processor under DPDP, and will you sign our DPA?
4. Which licences/authorisations do you hold for Aadhaar and PAN checks?
5. Sandbox quality: can we run the full happy path and the mismatch path?
6. What is the SLA and the failure-mode contract when your upstream is down?
7. Do you retain the raw document, or only the verdict?
8. Can we get a written confirmation that FLAMINGO stores no Aadhaar number?

### What to send

[rfq/kyc-vendor-rfp.md](rfq/kyc-vendor-rfp.md), the privacy pack from §3, and your verification policy draft.

### Acceptance criteria

- Sandbox passes the happy path, a name mismatch, an invalid PAN, and a service timeout.
- Production keys stored in the secret manager, never in the client.
- Only verdicts and reference IDs stored in the FLAMINGO database — no raw Aadhaar.
- Every verification is attributable to a user, a purpose and a timestamp in the audit log.
- DPA signed before the first production call.

### Timeline and cost

3–6 weeks; ₹3–₹30 per check depending on the bundle. Commercials are negotiable at volume and often waived during pilot.

### Engineering follow-through

A provider adapter behind an interface so vendors are swappable, a verification record with verdict and reference ID, and a retry/queue for timeouts. Keep the manual review path — it is already built.

---

## 7. Malware scanning of uploads

### What you are buying

An upload path where no file is encrypted or stored until it has been scanned, plus a quarantine and alerting path.

### How to obtain it

Self-hosted ClamAV is the standard and costs nothing:

1. Run `clamav/clamav` as a sidecar exposing `clamd` on TCP 3310.
2. Enable `freshclam` signature updates and alert if signatures are older than 24 hours.
3. In `server/src/lib/storage.js`, scan the temporary file **before** encryption. On `ScanError`, reject with a 503 — never fail open.
4. On a positive verdict: delete the temp file, record the event, quarantine the reference, and notify the uploader and the security channel.
5. Enforce a size limit and a scan timeout.
6. Test with the EICAR test string in a PDF, a JPEG and a ZIP.

Alternatives if you cannot run a sidecar: AWS GuardDuty Malware Protection for S3, or a commercial scanning API. Note that sending user documents to a third-party scanning API is a new data transfer that must appear in the ROPA and the DPA list.

### Acceptance criteria

- EICAR upload rejected with a clear error, and nothing written to storage.
- Scanner unreachable → upload rejected, logged, alerted; not stored.
- Signatures current, with an alert if they are not.
- A documented quarantine review procedure with an owner.

### Timeline and cost

~1 week of engineering; ₹0–₹5,000/month.

### Engineering follow-through

This one is mostly code and can be done now, before any external vendor exists. It is the blocker with the best effort-to-risk ratio after §4.

---

## 8. PostgreSQL

### What you are buying

- A managed PostgreSQL instance in an Indian region with automated backups and point-in-time recovery.
- The schema migrated, the data loaded, and the application running against it.
- A restore drill that proves RPO/RTO.
- Connection pooling and a migration tool in CI.

### Who to engage

- **AWS RDS for PostgreSQL**, `ap-south-1` (Mumbai) — most common.
- **Azure Database for PostgreSQL Flexible Server**, Central India / South India.
- **GCP Cloud SQL**, Mumbai.
- **Indian providers** (E2E Networks, NxtGen, Yotta) if data-residency commitments matter commercially.

Note that payment-system data has RBI-localisation expectations; keep the database and backups in India.

### What to do

Follow [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md). In short: abstract the database layer, run both engines in CI, dual-write in staging, migrate with a verified row count and checksum, cut over behind a flag, and keep SQLite read-only for one week as a rollback.

### Acceptance criteria

- Row counts and financial checksums match; the ₹19,301 example reproduces.
- `npm test` green against PostgreSQL.
- Restore to a point in time within the stated RTO, verified by querying real rows.
- No `node:sqlite` import remains on the production path.
- Backup/restore scripts updated for the managed engine.

### Timeline and cost

6–10 weeks of engineering; ₹8,000–₹40,000/month depending on size and HA.

### Engineering follow-through

This is the largest internal workstream. It also unblocks horizontal scaling, Redis-backed rate limiting and background jobs.

---

## 9. Independent penetration test

### What you are buying

A VAPT engagement by a **CERT-In empanelled** organisation, covering the web app, the API, authentication and authorisation (especially IDOR across the six portals), file upload, the payment flow, rate limiting and session handling. Deliverable: a report with CVSS-scored findings, evidence, remediation guidance, and a **retest** of all High and Critical items.

### Who to engage

Verify the firm on the authoritative list: `https://www.cert-in.org.in/PDF/Empanel_org.pdf`. Confirm the **exact legal entity name** is listed and the empanelment is current — this is the list your aggregator and enterprise clients will check.

Ask for:
- the names and certifications of the testers who will actually do the work (OSCP/CREST/CISSP);
- two references in fintech;
- the retest policy and whether it is included;
- the report template.

### What to send

[rfq/penetration-test-rfq.md](rfq/penetration-test-rfq.md), the architecture summary, API docs, and a staging environment with seeded test data and **no real personal data**.

### Rules of engagement to agree in writing

- Scope: domains, IPs, API versions — explicitly in scope and out of scope.
- Window and time zone; a named contact on both sides.
- No denial-of-service or destructive testing against production.
- Data handling: any personal data found is reported, not retained.
- Disclosure: findings confidential; no publication without consent.
- Emergency stop procedure.

### Acceptance criteria

- Zero open Critical or High findings. Mediums have an owner and a date.
- A retest letter confirming fixes.
- The report is acceptable to your payment aggregator (ask them in advance what they require).
- A one-page executive summary you can show a client.

### Timeline and cost

4–7 weeks including remediation and retest; ₹1,50,000–₹6,00,000 depending on scope and whether mobile is included.

### Common failure mode

Booking the test before §4, §7 and §8 are done. You will pay twice.

---

## 10. Monitoring, alerting and incident response

### What you are buying

- Error tracking with releases and alerts (Sentry or equivalent).
- Uptime probes against `/api/health` and `/api/ready` from outside your network.
- Metrics and dashboards: latency, 5xx rate, login failures, payout failures, reconciliation exceptions, disk, backup age, certificate expiry.
- Alert routing to a phone that someone actually answers, with a rota.
- An incident runbook with severity levels, an on-call owner, and a communications template.
- **CERT-In obligations**: report specified incident types within **6 hours** of noticing, retain logs for **180 days** in India, and sync to NTP. Put the reporting channel and the template in the runbook *before* you need it.

### Who to engage

Tooling is self-serve: Sentry, Better Stack / UptimeRobot, Grafana Cloud or CloudWatch, PagerDuty or a simple rota. If you have no on-call capability, engage a part-time SRE or an MSP for business hours plus an escalation number — write the contract so the responder is named, not "the team".

### Acceptance criteria

- A deliberately triggered 500 raises an alert within 2 minutes to a named person.
- A stopped backup raises an alert.
- A failed payout batch raises an alert.
- The runbook has been exercised once as a tabletop, with notes.
- The CERT-In reporting path is written down and tested with a dummy ticket.

### Timeline and cost

2–3 weeks; ₹5,000–₹30,000/month.

---

## 11. Browser E2E, accessibility and UAT

### What you are buying

- A Playwright suite covering the critical journeys: register → verify → post requirement → shortlist → interview → activate assignment → advance payout → complete → final payout → review.
- WCAG 2.2 AA audit (India also references IS 17802 / RPwD Act expectations) with fixes.
- Cross-browser and mobile checks.
- A signed UAT acceptance from the business owner, against a written script.

### Who to engage

- **E2E:** internal engineering. Playwright is free; the cost is time. Run it in CI against a seeded database.
- **Accessibility:** an independent auditor for the manual pass (keyboard, screen reader, contrast, focus order). Automated axe-core alone is not an audit.
- **UAT:** the business owner and two real design partners. Prepare the script; do not ask them to "have a look".

### Acceptance criteria

- Suite runs in CI on every pull request; flaky tests are fixed, not skipped.
- All Critical/High accessibility issues closed; a written conformance statement issued.
- UAT script executed with pass/fail per step, defects triaged, and a signature.
- Chrome, Safari, Firefox and one Android + one iOS device verified.

### Timeline and cost

4–6 weeks; ₹0 for Playwright, ₹50,000–₹2,50,000 for the accessibility audit.

---

## 12. Remove demo accounts

### What you are buying

Nothing. This is an internal release task.

### What to do

1. The startup guard already refuses to run in production with `is_demo=1` users. Keep it.
2. Produce a **production seed**: reference data only (skills, categories, settings), no users.
3. Write and test a purge script that removes demo users and their dependent rows in foreign-key order, and records what it deleted.
4. Verify: `SELECT COUNT(*) FROM users WHERE is_demo = 1` returns 0 on the production database; login with `candidate@flamingo.work` fails.
5. Delete [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) from the production artefact and from any client handout.
6. Rotate the demo password out of all documentation before any client sees the repo.

### Acceptance criteria

- Production database has zero demo rows.
- Demo credentials appear nowhere in the deployed bundle or public docs.
- The guard is covered by a test that fails if demo accounts are seeded with demo mode off.

---

## Sequencing

Three parallel tracks, roughly 10–12 weeks to a go-live decision.

**Track A — legal and commercial (weeks 1–8)**
1. Week 1: send the legal RFQ, the tax RFQ and the privacy RFQ on the same day.
2. Week 1: shortlist three aggregators and three KYC vendors; book calls.
3. Weeks 2–5: custody opinion and tax note land; publish terms, privacy and refund pages.
4. Weeks 4–8: aggregator onboarding starts with the live website; KYC sandbox integration begins.
5. Weeks 6–10: DPAs signed, ROPA complete, consent flows shipped.

**Track B — infrastructure (weeks 1–8)**
1. Weeks 1–2: secret manager and KMS. Immediately.
2. Weeks 2–3: ClamAV scanning.
3. Weeks 3–6: monitoring, alerting, runbook.
4. Weeks 4–8: PostgreSQL migration in staging.

**Track C — assurance (weeks 6–12)**
1. Weeks 6–7: Playwright suite and UAT script.
2. Week 8: book the pen test for a date after Track B completes.
3. Weeks 9–11: pen test, remediation, retest.
4. Weeks 10–12: accessibility audit, UAT sign-off, production cutover with demo purge.

Dependencies that will bite you if ignored:

- Aggregator onboarding **requires** published terms and privacy. Track A blocks payments.
- The pen test **requires** the secret manager, scanning and PostgreSQL to be done, or you pay for two tests.
- The privacy ROPA **requires** the KYC and payment vendor list, so do not finalise retention periods before vendor selection.

---

## What still cannot be bought

Some items need your decision, not a purchase:

- **Risk acceptance.** If you launch before a blocker closes, record it in writing with an owner and a date. The sign-off table in [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) §12 is the instrument.
- **The custody position.** No vendor will decide it for you; the aggregator will only tell you what it will and will not onboard.
- **Messaging discipline.** Until §1 and §5 close, every screen, contract and pitch must say payments are simulated and never imply escrow.
- **A named accountable owner** for each blocker. Unowned compliance work does not finish.

---

## Templates

- [rfq/legal-opinion-rfq.md](rfq/legal-opinion-rfq.md)
- [rfq/tax-review-rfq.md](rfq/tax-review-rfq.md)
- [rfq/privacy-dpdp-rfq.md](rfq/privacy-dpdp-rfq.md)
- [rfq/payment-integration-rfq.md](rfq/payment-integration-rfq.md)
- [rfq/kyc-vendor-rfp.md](rfq/kyc-vendor-rfp.md)
- [rfq/penetration-test-rfq.md](rfq/penetration-test-rfq.md)
