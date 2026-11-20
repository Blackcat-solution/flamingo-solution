# RFQ — Penetration test and security assessment

**To:** [CERT-In empanelled organisation]
**From:** Flamingo Solution Pvt. Ltd.
**Date:** [date]
**Response due:** [date + 7 working days]

## 1. Application

FLAMINGO is a workforce marketplace with six role-based portals (professional, employer, admin, finance, verification, support) on a single Node.js API with a React client and an encrypted document store.

- Architecture summary and API documentation: attached.
- Environment for testing: [staging URL], seeded with synthetic data; no real personal data.
- Source access: [black-box / grey-box with a read-only repo copy under NDA].

## 2. Scope

**In scope**
- Web application and all six portals.
- REST API, including authorisation boundaries between roles and tenants.
- Authentication: login, session, CSRF, MFA enrolment and enforcement, password reset.
- File upload and document retrieval (encryption at rest, access control, content-type handling).
- Payment and payout flows in test mode: amount tampering, replay, idempotency, webhook forgery.
- Rate limiting and account enumeration.
- Business-logic abuse: shift-cap bypass, fee manipulation, double payout, self-approval of verification.
- Server and TLS configuration, security headers, CSP.

**Out of scope**
- Denial-of-service and volumetric testing.
- Social engineering and physical access.
- Third-party provider infrastructure.
- Production environment.

## 3. Deliverable

1. Report with each finding: title, CVSS v3.1/v4 score, affected endpoint, reproduction steps, evidence, business impact, remediation guidance.
2. Executive summary suitable for a client and for our payment aggregator.
3. Retest of all Critical and High findings, with a closing letter.
4. A raw findings export (JSON/CSV) so we can track remediation.
5. Debrief call with engineering.

## 4. Rules of engagement to confirm

- Named tester(s) and certifications (OSCP/CREST/CISSP).
- Testing window and time zone; named contacts both sides.
- Emergency stop procedure and out-of-hours contact.
- Any personal data encountered is reported, not retained or exfiltrated beyond proof.
- Confidentiality: no publication or reference without written consent.
- Findings shared with us before any third party.

## 5. Commercials requested

| Item | Your quote |
|---|---|
| Fixed fee, web + API | |
| Optional mobile app | |
| Retest fee | |
| Turnaround: test window and report | |
| Earliest available start date | |
| Empanelment reference (CERT-In listing date) | |

## 6. Vendor checks

Please confirm:
1. Your exact legal entity name as it appears on the CERT-In empanelled list, and that it is current.
2. Two references in Indian fintech or marketplaces.
3. Whether your report format is accepted by major payment aggregators.
4. Insurance: professional indemnity cover.
