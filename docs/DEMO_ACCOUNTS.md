# Demo accounts and seeded data

This document lists the demo logins, the meaning of the seeded records and how to reset the environment.

> **Every account, organisation, document and payment described here is fictional demo data.** Accounts are flagged `is_demo = 1` in the database. Do not present demo figures as live users or revenue.

---

## 1. Password

All seeded accounts use the same password:

```
Flamingo@2026
```

Passwords are hashed with scrypt; the plaintext exists only in this document and in the seed script.

---

## 2. Primary accounts

| Role | Email | Name | What they demonstrate |
| --- | --- | --- | --- |
| Professional | `candidate@flamingo.work` | Aarav Mehta | Verified React engineer with an active assignment, passed assessment, timesheets, payouts and an interview |
| Employer | `employer@flamingo.work` | Nandini Rao (Meridian Technologies) | Verified employer with requirements, a shortlist, interviews and a live assignment |
| Super administrator | `admin@flamingo.work` | Ira Krishnan | Full access to every admin capability |
| Finance officer | `finance@flamingo.work` | Latha Subramanian | Finance, payouts and reports only |
| Verification officer | `verification@flamingo.work` | Sameer Bedi | Verification and document review only |
| Support | `support@flamingo.work` | Farah Ansari | Users and disputes, read-oriented |

### Permission differences to demonstrate

| Account | Can open | Is denied |
| --- | --- | --- |
| Finance officer | Finance, reports | Admin dashboard, verification queues |
| Verification officer | Dashboard, verification, assessment review | Finance |
| Support | Dashboard, users, disputes | Finance, review challenges |

The API enforces these boundaries; the sidebar also hides unavailable items.

---

## 3. Other demo accounts

The seed creates additional professionals and employers to populate the marketplace and reports. They use the same password.

- Professionals: `ananya.iyer@demo.flamingo.work`, `rohan.kulkarni@demo.flamingo.work`, `meera.nair@demo.flamingo.work`, `kabir.singh@demo.flamingo.work`, `sneha.reddy@demo.flamingo.work`, `arjun.desai@demo.flamingo.work`, `priya.sharma@demo.flamingo.work`, `vikram.rao@demo.flamingo.work`, `neha.gupta@demo.flamingo.work`, `aditya.joshi@demo.flamingo.work`, `ishita.bose@demo.flamingo.work`, `rahul.verma@demo.flamingo.work`, `kavya.menon@demo.flamingo.work`, `siddharth.malhotra@demo.flamingo.work`, `tanvi.shah@demo.flamingo.work`, `dev.patel@demo.flamingo.work`, `ritika.jain@demo.flamingo.work`, `harsh.vardhan@demo.flamingo.work`, `aisha.khan@demo.flamingo.work`, `manish.tiwari@demo.flamingo.work`, `shreya.kapoor@demo.flamingo.work`, `nikhil.rana@demo.flamingo.work`, `pooja.deshmukh@demo.flamingo.work`
- Other employers: `finance@asterfinance.demo`, `people@bloomretail.demo`, `talent@northstarhealth.demo`, `ops@kitelabs.demo`, `studio@verve.demo`

Only the six primary accounts are needed for a standard demo.

---

## 4. Key seeded records

| ID | Type | Meaning |
| --- | --- | --- |
| `pro_1` | Professional profile | Aarav Mehta, candidate account |
| `emp_1` | Employer profile | Meridian Technologies, employer account |
| `req_1` | Requirement | Senior React Engineer — 12-week platform build |
| `asg_1` | Assignment | **The ₹20,000 reference assignment**, active |
| `asg_4` | Assignment | Awaiting approval, with a processing advance payout |
| `po_asg_1_advance` | Payout | ₹10,000 gross, ₹699 fee, ₹9,301 net, paid |
| `act_1` | Activation fee | ₹699: base ₹592.37 + GST ₹106.63 |
| `att_demo_12` | Assessment attempt | `human_review`, auto score 68, integrity 78 — demonstrates a review, not an auto-reject |
| `att_demo_1` | Assessment attempt | Passed at 86 — demonstrates a successful attempt |
| `disp_1` | Dispute | Timesheet dispute, status `investigating` |
| `int_1` | Interview | Round 1, scheduled |
| `sl_1` | Shortlist | Aarav Mehta shortlisted for `req_1` |
| `rev_1` | Review | Published review scoring 88/100 |

---

## 5. The ₹20,000 example in the demo

Open the professional account and the assignment `FLM-ASG-1001`:

| Line | Amount |
| --- | --- |
| Assignment value | ₹20,000 |
| Advance (50%) | ₹10,000 |
| Activation fee (GST-inclusive) | − ₹699 |
| First payout | ₹9,301 |
| Final payout | ₹10,000 |
| Total to professional | ₹19,301 |

The activation fee appears once, on the first payout. The final payout has no fee. The GST split (base ₹592.37 + GST ₹106.63) is visible in the finance views.

---

## 6. Resetting the demo

From the repository root:

```bash
npm run seed
```

This **deletes all tables and recreates the seeded state**. It is safe for the demo and destructive for any data you added. Never run it against production.

The seed is deterministic for records and relationships, but relative dates are generated from the current date, so “days ago” values shift each run.

---

## 7. Demo walkthrough (suggested order)

1. **Public site** — browse the marketplace, a professional profile, pricing and trust pages.
2. **Professional** — inspect the dashboard, profile, passed assessment, active assignment, finance and timesheets.
3. **Employer** — search talent, view the shortlist, inspect interviews, review the assignment and invoice.
4. **Admin** — verify a professional, review `att_demo_12` with its human-review disclaimer, inspect finance and the balanced ledger, resolve the dispute, read the audit log.
5. **Role boundaries** — sign in as finance, verification and support to show what each can and cannot see.

---

## 8. Safety notes

- **Do not upload real identity documents** to the demo. The document key is a development key.
- **Do not present the payment simulation as real money movement.** There is no escrow and no bank transfer.
- **Do not cite seeded benchmarks as fresh market research.** They carry source dates and must be re-validated.
- **Demo accounts are not secure for public exposure.** Remove or disable them before any real deployment.
