# Research, benchmarks and assumptions

This document records the market context, the pricing benchmark method, the commercial model and the assumptions behind FLAMINGO. It is deliberately conservative: figures are attributed, dated and separated from product policy.

> **Rule applied throughout:** no market number is invented. Every rate band in the system carries a named source, a URL and an as-of date. Where a figure is an internal estimate, it is labelled as an assumption rather than a fact.

---

## 1. Purpose

FLAMINGO prices professional work transparently and lets employers and professionals see the basis of a suggested rate. To do that credibly, the system needs:

1. A **sourced benchmark range** per category and experience level.
2. A **transparent calculation** showing every factor applied.
3. An explicit **refusal to guess** when no benchmark exists.
4. Clear **assumptions** about working time, taxes and fees.

The product is designed for experienced professionals (minimum three years) working structured shifts of 8, 10 or 12 hours, four days a week, in India.

---

## 2. Market context

India has a large and growing independent-professional market. Two data points frame the opportunity and the pricing problem:

- **Rate dispersion.** Indian freelance rates vary widely by discipline and experience. Karbon Card reports an average Indian freelance range of roughly **₹500–₹2,000/hour**, with web development at **₹800–₹4,000/hour**, UI/UX at **₹1,000–₹4,500/hour**, and specialised technology (AI, blockchain, data science) at **₹2,000–₹6,000/hour or more**. It also reports an experience-based band of **₹300–₹800** (beginner), **₹800–₹2,000** (intermediate) and **₹2,000–₹5,000+** (experienced/specialist) per hour.
- **Full-stack benchmarks.** FreelanceRate India publishes an India domestic full-stack band of **₹700–₹3,200/hour** for mid-level (3–5 years) professionals, **₹980–₹4,480** for senior (6–9 years), and **₹1,260–₹5,760** for specialists (10+ years). Its international-client bands run higher (e.g. ₹2,000–₹5,200 for mid-level).

These sources agree on the shape of the market: a wide range, a clear experience premium, and a meaningful gap between domestic and international client budgets. They do **not** agree on a single “correct” rate, which is exactly why FLAMINGO presents ranges and a calculation trail rather than a fixed price.

**What this means for the product:**

- A single platform-wide rate would be misleading. Pricing must be category- and level-aware.
- Employers need context to negotiate fairly; professionals need a defensible floor.
- Any suggestion must show its arithmetic and its source, so both sides can challenge it.

---

## 3. Sourced rate benchmarks used in the demo

The seed data contains benchmark rows for multiple categories and levels. Each row stores `min_hourly_paise`, `median_hourly_paise`, `max_hourly_paise`, `source_name`, `source_url` and `as_of`.

### 3.1 Source register

| Key | Source | URL | As of | Used for |
| --- | --- | --- | --- | --- |
| `tech` | FreelanceRate India — full-stack developer rate benchmarks (Jan–Jul 2026 sample) | https://freelancerateindia.com/calculator/freelance-rate/fullstack-developer | 2026-07-31 | Technology bands |
| `design` | Karbon Card — Freelance hourly rates: global vs India (2025) | https://www.karboncard.com/blog/freelance-hourly-rate | 2025-06-30 | Design and cross-discipline ranges |
| `salary` | Salary.com Global Salary IQ — freelance developer India (Apr 2025) | https://www.salary.com/research/in/freelance-developer-salary | 2025-04-22 | Cross-check for technology |
| `ambition` | AmbitionBox India salary bands (2025) | https://www.ambitionbox.com/salaries | 2025-12-31 | Fallback categories, via a stated conversion |

### 3.2 Verification status

- **Verified live on 12 November 2026:** `tech` and `design`. The fetched pages corroborate the seeded bands (FreelanceRate: ₹700–₹3,200 domestic mid-level full-stack; Karbon: web development ₹800–₹4,000, UI/UX ₹1,000–₹4,500, specialised tech ₹2,000–₹6,000+).
- **Carried from the seeded research file and requiring re-validation before production:** `salary` and `ambition`. The AmbitionBox conversion is an explicit Flamingo assumption, not a published contractor rate.

### 3.3 Worked benchmark examples

| Category | Level | Min ₹/hr | Median ₹/hr | Max ₹/hr | Basis |
| --- | --- | --- | --- | --- | --- |
| Technology | Mid | 700 | 1,400 | 2,500 | Lower half of the published ₹700–₹3,200 domestic full-stack band |
| Technology | Senior | 1,200 | 2,300 | 3,200 | Upper part of the same published band |
| Design | Mid | 800 | 1,500 | 3,000 | Karbon published design range |
| Other (fallback) | Mid | 400 | 800 | 1,400 | Salary-band conversion; flagged “requires analyst review” |

Fallback rows are marked in their `notes` as requiring analyst review. The pricing engine will **refuse to recommend a rate** when no benchmark exists for the requested category and level; it never fabricates one.

---

## 4. Pricing method

The pricing engine (`server/src/domain/pricing.js`) applies documented multipliers to a sourced median:

| Factor | Basis |
| --- | --- |
| Experience | Experience band factor; never falls below the three-year minimum factor |
| Assessment score | Higher verified scores move the rate up within the band |
| Certifications | Count of verified certifications |
| Education | Qualification level |
| Location | City cost indicator |
| Industry | Sector premium/discount |
| Performance | Published review rating |

The raw suggestion is clamped inside the sourced **min–max** range and rounded to a sensible step. The response includes the **full calculation trail** and the **source** so the user can see how the number was produced.

This is a decision-support tool. It is not a guarantee of market rate and not an automated price setter.

---

## 5. The commercial model

### 5.1 Registration, assessments and fees

| Item | Policy |
| --- | --- |
| Professional registration | Free |
| Minimum experience | 3 years |
| Assessments | Free |
| Assignment activation fee | ₹699, deducted once from the first payout |
| Charge without an assignment | None |
| Platform fee | Configurable; **0% in the reference example** |
| Payment structure | 50% advance, 50% on completion |

### 5.2 Reference example (must reconcile exactly)

```
Gross assignment value        ₹20,000.00   = 2,000,000 paise
Advance (50%)                 ₹10,000.00   = 1,000,000 paise
Activation fee (GST-incl.)       ₹699.00   =    69,900 paise
First payout net               ₹9,301.00   =   930,100 paise
Final payout (50%)            ₹10,000.00   = 1,000,000 paise
Total received                ₹19,301.00   = 1,930,100 paise
```

### 5.3 Activation fee tax split

The ₹699 is **GST-inclusive** at 18%:

```
Base        = 699 / 1.18 = ₹592.37  (59,237 paise)
GST         = 699 − 592.37 = ₹106.63 (10,663 paise)
Total       = ₹699.00               (69,900 paise)
```

The engine splits inclusive GST without losing a paisa. The activation fee is **not** charged again on the final payout; a second charge is explicitly tested against.

### 5.4 Why the platform fee defaults to zero

A non-zero platform fee would change the professional's net and break the required ₹19,301 total. Setting it to **0%** keeps the reference example exact. The fee is still modelled, itemised and GST-treated so it can be enabled by policy without changing the ledger design.

### 5.5 What the professional actually receives

The professional receives **₹18,301 of assignment value** (₹20,000 minus the ₹699 fee) across two payouts totalling **₹19,301 gross**. The distinction matters: the fee is a deduction from the professional's first payout, not an employer charge. Copy in the product states this plainly.

---

## 6. Working-time policy

The scheduling engine enforces a deliberately constrained model:

| Rule | Value | Rationale |
| --- | --- | --- |
| Shift options | 8, 10, 12 hours | Predictable, comparable engagements |
| Working days | 4 per week | Sustainable part-time capacity |
| Compulsory off days | Sunday, Monday | Protected rest window |
| Available days | Tuesday–Saturday | Five-day pool from which four are chosen |
| Daily cap | 12 hours | Fatigue and compliance control |
| Weekly cap | 48 hours | Combined across employers |
| Breaks | 15 + 15 + 30 minutes | 60 minutes inside the attendance window |
| Overlaps | Blocked | No double-booking across employers |
| Interview rounds | Maximum 2 | Panel, then final discussion |

These are **product policy choices**, informed by common practice and fatigue management. They are not presented as statutory requirements. Before launch, employment counsel should confirm how they interact with applicable labour and contract law.

**Accounting convention:** shift hours are treated as paid/productive hours. The mandatory 60-minute break sits inside the attendance window (for example 09:30–18:30 with an hour of breaks yields 8 paid hours). Overlap detection uses attendance windows, not paid hours, so a break cannot be used to hide a clash.

---

## 7. Assessment and integrity stance

FLAMINGO uses assessments to protect marketplace quality, not to police people.

- Assessments are **free** and must be **passed** before a professional becomes publicly discoverable.
- Objective questions are auto-scored. **Practical work is scored by a human.**
- Integrity signals (paste behaviour, focus loss, duplicate text similarity) are **prompts for human review**, weighted and capped.
- The system **never claims AI detection is 100% accurate**, never auto-rejects on a signal, and always displays a human-review disclaimer.
- Retakes are governed by a published waiting period (default 30 days).

This position is a product and ethical choice. False accusations of misconduct are a serious harm; a human reviewer with context is the correct control.

---

## 8. Assumptions register

| ID | Assumption | Impact if wrong | Owner |
| --- | --- | --- | --- |
| A1 | Professionals can lawfully contract on a shift basis in the target states | Engagement model, contracts, tax treatment | Legal |
| A2 | 18% GST applies to the platform/activation fee as modelled | Fee split and invoices | Tax adviser |
| A3 | Professional charges are outside GST in this model | Invoice totals | Tax adviser |
| A4 | TDS applies at 10% only above ₹5,00,000 in the financial year | Payout net amounts | Tax adviser |
| A5 | Platform fee remains 0% for the reference example | The ₹19,301 total | Product/Finance |
| A6 | Benchmarks are indicative and may lag the market | Rate suggestions | Research |
| A7 | The simulated gateway will be replaced by a licensed provider | All payment claims | Product |
| A8 | Identity and document checks require a real KYC provider at launch | Trust and compliance | Operations |
| A9 | Email/SMS delivery is simulated in the MVP | Notifications reach users | Operations |
| A10 | Four-day weeks and Sunday/Monday off are product policy, not statute | Scheduling rules | Legal/Product |

---

## 9. What this research deliberately does **not** claim

- No total addressable market, growth rate or revenue projection is asserted.
- No benchmark is presented without a source and date.
- No claim is made that assessments detect AI-generated work with certainty.
- No claim is made that the platform holds funds in escrow.
- No claim is made that seeded figures represent live demand, users or revenue.
- No legal, tax or compliance conclusion is presented as settled advice.

---

## 10. Sources

1. FreelanceRate India — *Full-Stack Developer Rates India 2026*. https://freelancerateindia.com/calculator/freelance-rate/fullstack-developer — reviewed 27 August 2026; accessed 12 November 2026.
2. Karbon Card — *Freelance Hourly Rates: Global vs India + Steps to Set Your Rate* (2025). https://www.karboncard.com/blog/freelance-hourly-rate — accessed 12 November 2026.
3. Salary.com — *Global Salary IQ: freelance developer, India* (April 2025). https://www.salary.com/research/in/freelance-developer-salary — seeded citation; revalidate before production.
4. AmbitionBox — *India salary bands* (2025). https://www.ambitionbox.com/salaries — seeded citation; conversion is a Flamingo assumption.
5. Income Tax Department, Government of India — Section 44ADA and slab rates. https://www.incometax.gov.in/ — for tax review.
6. CBIC — GST rate and registration notifications. https://www.cbic.gov.in/ — for tax review.

> Benchmarks are negotiation context, not advice. Re-run the research and update `as_of` dates before using any figure in a commercial commitment.
