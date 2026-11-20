# RFQ — DPDP compliance implementation

**To:** [Firm / consultancy]
**From:** Flamingo Solution Pvt. Ltd.
**Date:** [date]
**Response due:** [date + 7 working days]

## 1. Scope of processing

FLAMINGO is an Indian-only workforce marketplace. We process, at minimum:

| Data class | Examples | Recipients |
|---|---|---|
| Identity | Name, DOB, PAN, Aadhaar-derived verdicts, address | KYC vendor (proposed) |
| Contact | Email, phone | Email/SMS vendor (proposed) |
| Professional | Skills, experience, rates, availability | Employers (selected fields) |
| Financial | Bank account, IFSC, payout history, invoices | Payment aggregator (proposed) |
| Verification documents | ID proofs, certificates, encrypted at rest | Internal reviewers |
| Assessment | Attempts, scores, integrity signals | Internal reviewers |
| Employment | Assignment history, reviews, disputes | Counterparties |
| Technical | IP, device, session, audit logs | Hosting, error tracking |

We do not knowingly process children's data. We do not transfer data outside India [confirm/intended].

## 2. What we need

Please quote for the following as separate line items:

1. **ROPA / data map** — mapped to our actual schema (we will supply it), purpose and lawful basis per field.
2. **Notice under §5** — plain language, itemised, English + [Hindi/other].
3. **Consent architecture** — granular consents, versioning, withdrawal path, and the product copy for each consent point.
4. **Retention and erasure schedule** — per data class, aligned with tax and contractual retention needs.
5. **DPIA** for identity and financial processing.
6. **Vendor DPA pack** — aggregator, KYC, email/SMS, hosting, error tracking, backups.
7. **Breach playbook** — detection, containment, Board notification, data-principal notification, with the exact statutory timelines under the DPDP Rules 2025.
8. **Grievance mechanism** — process, SLA, and the published channel.
9. **Consent Manager readiness note** — Rule 4 obligations effective 13 November 2026 and what we must do, if anything, as a Data Fiduciary.
10. **Staff briefing** — one 60-minute session plus a one-page do/don't sheet.

## 3. Questions we need answered in the response

1. Which DPDP Rule obligations are in force on which dates, and what must be true by 13 May 2027?
2. Is a DPO mandatory for us at our size and processing profile? If not mandatory, do you recommend one?
3. Do we need to appoint a Data Protection Officer resident in India, and how does that differ from a grievance officer?
4. For Aadhaar-based verification via a third-party KYC vendor, who is the Data Fiduciary for the Aadhaar data, and what consents must we capture ourselves?
5. What must a valid consent artefact contain, and how long must we keep it?
6. Our audit logs contain IP addresses. Retention period and lawful basis?

## 4. Deliverables and acceptance

- All ten items above, in editable format.
- Every database field accounted for in the ROPA, or explicitly excluded with a reason.
- Consent screen copy mapped 1:1 to notice clauses.
- A tested erasure procedure, executed once in staging with a record of the test.
- Signed DPAs, not templates.
- DPO/grievance officer sign-off on the [PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md) §12 table.

## 5. Commercials requested

| Item | Your quote |
|---|---|
| Fixed fee, by item | |
| Timeline, by item | |
| Named lead (qualification, DPDP experience) | |
| Annual retainer for updates and DSR handling | |
| Conflicts: do you act for any payment aggregator or KYC vendor we might use? | |
