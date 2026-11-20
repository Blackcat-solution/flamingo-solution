# Production-readiness checklist

**Assessment date:** 12 November 2026
**Verdict:** **Not ready for production financial operations.** Ready for demonstration, stakeholder review and controlled pilot planning.

This checklist separates what is built from what must be completed before handling real users, money or identity documents. Status values: **Implemented**, **Partial**, **Missing**, **Not applicable to MVP**.

---

## 1. Functional completeness

| Item | Status | Notes |
| --- | --- | --- |
| Public marketplace and marketing site | Implemented | Search, profiles, pricing, trust, FAQ, contact |
| Professional registration and portal | Implemented | Free registration, 3-year minimum, profile, documents |
| Employer registration and portal | Implemented | Verification gate, requirements, shortlist, interviews |
| Administration portal | Implemented | Verification, assessments, finance, disputes, users, audit, reports |
| Assessment engine | Implemented | Timed attempts, auto-scoring, human review, integrity signals |
| Scheduling engine | Implemented | 8/10/12-hour shifts, four days, caps, overlaps, breaks |
| Finance engine | Implemented | 50/50 plan, ₹699 fee, GST split, TDS, balanced ledger |
| Performance management | Implemented | 100-point review, response and challenge |
| Notifications | Partial | In-app only; no email or SMS delivery |
| Search relevance | Partial | SQL filters; no ranking or typo tolerance |
| Reporting | Partial | Operational diagnostics; not statutory accounts |

---

## 2. Money and finance

| Item | Status | Required action |
| --- | --- | --- |
| Integer paise arithmetic | Implemented | — |
| ₹20,000 → ₹19,301 example | Implemented and tested | — |
| Activation fee charged once | Implemented and tested | — |
| GST itemisation | Implemented | Confirm treatment with a tax adviser |
| TDS handling | Partial | Confirm applicability, threshold and reporting with a tax adviser |
| Balanced double-entry ledger | Implemented and tested | — |
| Real payment gateway | **Missing** | Integrate a licensed aggregator; implement webhooks and reconciliation |
| Real bank payouts | **Missing** | Integrate payout rails; verify beneficiary accounts |
| Escrow or nodal account | **Missing** | Obtain legal and regulatory advice before making any custody claim |
| Refunds and chargebacks | **Missing** | Define policy and implement flows |
| Invoice numbering and statutory fields | Partial | Confirm GST invoice requirements, place of supply and series |
| Financial reconciliation to bank | **Missing** | Build daily reconciliation and exception handling |
| Audit of money movements | Partial | Application audit exists; no immutable financial store |

> Until the gateway and payout rails are real, the product must state that payments are simulated. Do not claim that funds are held, protected or in escrow.

---

## 3. Identity, trust and compliance

| Item | Status | Required action |
| --- | --- | --- |
| Professional verification workflow | Implemented | Human decision with audit |
| Employer verification workflow | Implemented | Human decision with audit |
| Document upload and encryption | Implemented | Development key must be replaced |
| Upload content sniffing | Implemented | Magic-byte validation for PDF, JPEG, PNG and WebP |
| Real KYC provider | **Missing** | Integrate PAN/Aadhaar or equivalent lawful verification |
| Background checks | **Missing** | Partner process and consent |
| Sanctions/PEP screening | **Missing** | Required depending on business model |
| Malware scanning of uploads | Implemented | ClamAV `clamd` scan before encryption, fails closed; deploy the sidecar and verify with EICAR |
| Document retention policy | **Missing** | Define per document class |
| Privacy policy and terms | **Missing** | Legal drafting and publication |
| DPDP Act readiness (India) | **Missing** | Notice, consent, purpose limitation, grievance officer |
| Data processing agreements | **Missing** | Payment, KYC, email/SMS and hosting vendors |
| Grievance and escalation process | Partial | Dispute workflow exists; statutory process not defined |

---

## 4. Security

| Item | Status | Required action |
| --- | --- | --- |
| Password hashing (scrypt) | Implemented | — |
| Session hardening | Implemented | — |
| CSRF protection | Implemented | — |
| RBAC and least privilege | Implemented and tested | — |
| MFA (TOTP) | Implemented | Enforced for the admin API in production; add recovery codes |
| Rate limiting | Implemented | Move to Redis for multi-instance |
| Audit logging | Implemented | Export to append-only storage; add alerting |
| Security headers and CSP | Implemented | Enable HSTS at the proxy; re-check CSP |
| Encrypted document storage | Implemented | Use KMS/HSM keys and rotation |
| Upload content validation | Implemented | Magic-byte checks; add antivirus scanning |
| Secret management | Partial | Provider adapters for AWS/GCP/Azure/Vault/file and AWS KMS unwrapping are implemented; provision the store, IAM policy and rotation |
| Independent penetration test | **Missing** | Commission before launch |
| Vulnerability scanning / dependency updates | **Missing** | Add CI scanning and a patch cadence |
| WAF and bot defence | **Missing** | Recommended for login and contact endpoints |
| Backup scripts and restore test | Implemented | Schedule off-host backups and repeat the drill quarterly |
| PostgreSQL and managed PITR | **Missing** | Follow [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md) |
| Incident response plan | **Missing** | Define severity, on-call and notification |
| Admin action review | Partial | Audit exists; no dual control for payouts |

---

## 5. Reliability and operations

| Item | Status | Required action |
| --- | --- | --- |
| Health endpoint | Implemented | Liveness and `/api/ready` database/storage readiness checks |
| Structured logging | Partial | Request IDs exist; add JSON logs and correlation |
| Metrics and dashboards | **Missing** | Add latency, error, login and payout metrics |
| Alerting | **Missing** | 5xx, auth anomalies, disk, backup failures |
| Error tracking | **Missing** | Add Sentry or equivalent |
| Automated backups | Partial | `npm run backup` provides consistent snapshots; schedule it off-host and alert on failure |
| Disaster recovery plan | Partial | Restore script and drill documented; define RPO/RTO and test |
| Horizontal scaling | **Missing** | Requires PostgreSQL, Redis and object storage; see [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md) |
| Background jobs | **Missing** | Notifications, payout batches, document scanning |
| Email/SMS delivery | **Missing** | Transactional provider with retries |
| Uptime monitoring | **Missing** | External probe on health endpoint |

---

## 6. Performance

| Item | Status | Required action |
| --- | --- | --- |
| Database indexes | Implemented | 11 indexes on hot paths |
| Pagination | Implemented | Clamped limits |
| Bundle size | Partial | Single 691 kB JS chunk; add route-level code splitting |
| Load testing | **Missing** | Test search, login and finance under concurrency |
| Caching | **Missing** | Consider for public marketplace reads |
| Asset delivery | Partial | Served by Node; put static assets behind a CDN |

---

## 7. Quality assurance

| Item | Status | Required action |
| --- | --- | --- |
| Unit tests | Implemented | 85 tests across five suites |
| API integration tests | Implemented | Real schema and database |
| Backup/restore tests | Implemented | Round-trip, wrong-key refusal and overwrite guard |
| HTTP role/permission smoke test | Implemented | 58 checks, all passing |
| TypeScript strict build | Implemented | Passing |
| Browser end-to-end tests | Implemented | Playwright covers public, auth, RBAC and upload rejection; add WebKit and mobile projects |
| Accessibility audit | **Missing** | WCAG 2.2 AA target |
| Cross-browser testing | **Missing** | Chrome, Safari, Firefox, mobile |
| Visual regression | **Missing** | Screenshot baselines |
| UAT sign-off | **Missing** | Business owner acceptance |

---

## 8. Legal and commercial

| Item | Status | Required action |
| --- | --- | --- |
| Terms of service | **Missing** | Draft and review |
| Privacy policy | **Missing** | Draft and review |
| Professional contractor agreement | **Missing** | Review engagement and payment terms |
| Employer agreement | **Missing** | Review verification and payment obligations |
| Fee disclosure | Implemented | ₹699 shown at assignment activation |
| Refund/cancellation policy | Partial | Terms captured in the contract; policy page needed |
| Insurance | **Missing** | Confirm professional indemnity and cyber cover |
| Labour-law review | **Missing** | Confirm contractor classification and shift rules |
| Tax review (GST, TDS) | **Missing** | Written advice from a qualified adviser |
| Regulatory review of payment model | **Missing** | Confirm no custody/licensing breach |

---

## 9. Go-live blockers

The following must be closed before any real money or real identity data is processed. For each one, [BLOCKER_ACQUISITION.md](BLOCKER_ACQUISITION.md) sets out what to buy, who to engage, what to send, how to accept the work and the sequencing; [rfq/](rfq/) holds the ready-to-send templates.

1. **Real payment and payout integration** with reconciliation and webhook handling.
2. **Legal custody opinion** on the payment model; no escrow claims until approved.
3. **KYC provider integration** and a documented verification policy.
4. **Secret manager** for the document key and provider credentials. Provider adapters and a boot-time guard are implemented; provisioning and IAM remain. Admin MFA enforcement is implemented.
5. **Production database** (PostgreSQL) with managed backups, PITR and a tested restore. SQLite backup/restore scripts exist for the pilot only; see [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md).
6. **Malware scanning** deployed and verified. The scan path is implemented; the ClamAV sidecar, signature updates and EICAR verification remain.
7. **Privacy policy, terms, DPDP readiness** and vendor agreements.
8. **Tax advice** on GST, TDS and invoice fields.
9. **Independent penetration test** with remediation.
10. **Monitoring, alerting and incident response.**
11. **Accessibility audit and business UAT sign-off.** Browser E2E automation is implemented.
12. **Remove or disable seeded demo accounts.**

---

## 10. Recommended pilot path

If the business wants to pilot before full production:

1. Keep payments **simulated** and say so in every screen and contract.
2. Limit to invited, manually verified professionals and employers.
3. Use the real database with backups, but no real bank payouts.
4. Run the pilot under a written agreement that discloses the simulation.
5. Complete items 2, 4, 5, 6, 7, 8 and 10 above before the first real rupee moves.
6. Complete the penetration test and E2E suite before public launch.

---

## 11. Final assessment

| Dimension | Rating | Comment |
| --- | --- | --- |
| Product completeness | Strong for an MVP | All six platforms exist and connect |
| Financial correctness | Strong | Reference example exact; ledger balanced and tested |
| Security fundamentals | Good | Real controls including upload scanning and a secret-manager adapter; still not hardened or tested externally |
| Operational readiness | Weak | No monitoring, backups, jobs or incident plan |
| Compliance readiness | Weak | Legal, tax, privacy and KYC work outstanding |
| Test coverage | Good | Unit, API, HTTP and browser E2E; no load or accessibility automation |
| Production readiness | **Not yet** | Blockers above are material |

**Positioning:** FLAMINGO is a credible, well-structured MVP suitable for demonstration, design-partner feedback and a controlled simulation pilot. It is not yet a production financial marketplace.

---

## 12. Sign-off template

| Area | Owner | Status | Date |
| --- | --- | --- | --- |
| Product | | | |
| Engineering | | | |
| Security | | | |
| Finance and tax | | | |
| Legal and privacy | | | |
| Operations | | | |
| Data protection officer | | | |

A launch requires every owner to sign and every go-live blocker in section 9 to be closed or formally risk-accepted in writing.
