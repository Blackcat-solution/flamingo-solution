# RFP — Identity verification (KYC)

**To:** [Vendor]
**From:** Flamingo Solution Pvt. Ltd.
**Date:** [date]
**Response due:** [date + 7 working days]

## 1. Requirement

FLAMINGO verifies two populations on an Indian-only marketplace:

**Professionals (higher assurance)**
- PAN verification
- Identity verification, including a liveness or face-match step
- Bank account verification before the first payout
- Address check (optional)
- Duplicate-identity detection across accounts

**Employers (lower assurance)**
- Business entity verification (CIN/GSTIN), authorised-signatory check
- Domain/email verification
- Optional director PAN check

Volume assumption: [500] verifications/month at launch, [5,000] within 12 months.

## 2. What we need from you

**Product and integration**
1. API list with request/response schemas, error codes, sandbox base URL and test identities.
2. Whether you support a hosted flow (we redirect) or API-only, and mobile-web behaviour.
3. Latency p50/p95, uptime SLA, and behaviour during upstream (UIDAI/NSDL) outages.
4. Webhook or polling model for asynchronous results.
5. Rate limits and burst handling.

**Compliance**
6. Which licences/authorisations do you hold for Aadhaar and PAN verification? Please name them.
7. Do you act as Data Processor for FLAMINGO? Will you sign our DPA?
8. Where is data stored (region), for how long, and can we set a shorter retention?
9. Do you retain the raw document image or only the verdict? Can we require verdict-only?
10. Do you store the Aadhaar number? If so, under what masking and encryption?
11. Sub-processors used, and whether any processing occurs outside India.
12. Breach notification commitment and timeline.
13. Audit log availability: can we retrieve the evidence for a specific verification 12 months later?

**Commercial**
14. Per-verification price at 1,000 / 10,000 / 100,000 calls, by check type, inclusive of taxes.
15. Minimum commitment, onboarding fee, sandbox fee.
16. Pilot terms: 30 days or 1,000 free calls.

## 3. Acceptance criteria

- Sandbox passes four paths: success, name mismatch, invalid identifier, upstream timeout.
- Production credentials issued and stored server-side only.
- Our database stores a verdict, a reference ID and a timestamp — never a raw Aadhaar number.
- DPA signed before the first production call.
- Named support contact with a response SLA.

## 4. Response format

Please reply in this order: company and licences → product fit → compliance answers → pricing table → two customer references in Indian fintech or marketplaces → proposed timeline.

We are evaluating [3] vendors and will run a two-week sandbox comparison before contracting.
