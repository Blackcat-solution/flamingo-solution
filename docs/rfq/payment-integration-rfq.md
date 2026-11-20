# RFQ — Marketplace payment collection and split payout

**To:** [Payment aggregator — marketplace/compliance team]
**From:** Flamingo Solution Pvt. Ltd. (CIN [CIN])
**Date:** [date]
**Response due:** [date + 7 working days]

## 1. Business

FLAMINGO is an online marketplace for shift-based professional work in India. Employers post requirements; independent professionals accept assignments. FLAMINGO charges the employer a one-time activation fee of ₹699 per assignment.

Company status: [incorporated YYYY / newly incorporated]. FY25 turnover: [₹X / nil]. FY26 turnover to date: [₹X]. Category: [services marketplace].

## 2. Required flow

| Event | Actor | Amount |
|---|---|---|
| Assignment activated | Employer pays | ₹20,000 |
| Same instant | FLAMINGO fee retained | ₹699 |
| Within [T+1] | Professional paid advance | ₹9,301 |
| Assignment completed | Professional paid balance | ₹10,000 |
| Total to professional | | ₹19,301 |

We need: card, UPI, netbanking and wallet collection; split or linked-account settlement to the professional's verified bank account; refunds and reversals; and a settlement report we can reconcile daily.

## 3. Questions — please answer in writing

**Eligibility**
1. Do we meet your marketplace turnover threshold under the September 2025 RBI directions? If not, is there an alternative onboarding path, and what is it?
2. If we are ineligible now, what is the minimum we must reach, and can we start on a standard merchant account in the interim?

**Custody**
3. In whose name does the professional's settlement appear on their bank statement?
4. Do funds ever enter a FLAMINGO-owned account? If yes, for how long, and under what arrangement?
5. Is the collecting entity a Scheduled Commercial Bank escrow account or a nodal account? Please identify it.
6. What language may we use on our website about fund safety? What may we not say?

**Product**
7. Which product fits: Route / Easy Split / linked accounts / payout API? Provide the docs.
8. Per-transaction pricing at ₹20,000 average ticket, 500 and 5,000 transactions/month, plus per-payout fee and GST.
9. Settlement timeline to the professional, and whether T+0 or instant is available.
10. Beneficiary verification method and failure handling.
11. Idempotency, webhook signing, replay protection and retry semantics.
12. Sandbox access and test data; can we run the ₹20,000 example end to end before signing?
13. Refund, partial refund and chargeback rules, including who bears the loss.
14. Dashboard and API access to settlement and reconciliation reports; format and cut-off time.

**Compliance**
15. Documents required for onboarding, and typical time to activation.
16. Do you require a legal opinion on our model? Will you review ours?
17. Do you require a penetration test report? Which standard and how recent?
18. Data residency commitments and your DPA.

## 4. What we will provide

Certificate of incorporation, PAN, GST, MOA/AOA, board resolution, director KYC, six months' bank statement, cancelled cheque, live terms/privacy/refund URLs, and our custody opinion on request.

## 5. Evaluation

Fit to the flow, written custody position, eligibility certainty, total cost, activation time, and reconciliation quality. We are speaking to three providers and will decide within [3] weeks.
