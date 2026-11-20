# Security and privacy

This document describes the controls implemented in the FLAMINGO MVP, the residual risks and the work required before handling real personal and financial data.

> **Scope note:** the MVP implements meaningful security controls, but it is not certified, independently penetration-tested or cleared for production financial use. See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

---

## 1. Authentication

| Control | Implementation |
| --- | --- |
| Password hashing | `scrypt` (N=16384, r=8, p=1, 64-byte key) with a 16-byte random salt |
| Password comparison | `crypto.timingSafeEqual` |
| Password policy | Minimum 10 characters, upper, lower and numeric |
| Session token | 32 random bytes, base64url |
| Session storage | Only the SHA-256 hash of the token is stored |
| Cookie | `fl_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` in production |
| Session lifetime | 12 hours by default (`SESSION_TTL_HOURS`) |
| Session revocation | Logout deletes the row; suspension/closure invalidates sessions |
| Account status | Non-active accounts cannot authenticate even with a valid session |

### Brute-force resistance

- Per-IP login limit: **20 attempts per 15 minutes**.
- Per-account throttle: **5 failed attempts in 15 minutes** triggers a 15-minute lock.
- Failed and successful attempts are recorded in `login_attempts`, retained for **30 days**.
- Bad credentials return a generic message that does not reveal whether an account exists.
- Registration endpoints are limited to **10 per hour per IP**.

---

## 2. CSRF protection

Every state-changing request (`POST`, `PATCH`, `PUT`, `DELETE`) must send:

```
X-CSRF-Token: <token returned by login or /auth/me>
```

The token is stored on the session row and compared server-side. Missing or mismatched tokens return `403`. Combined with `SameSite=Lax` and `HttpOnly`, this blocks the standard cross-site request patterns.

---

## 3. Role-based access control

### 3.1 Platform roles

| Role | Scope |
| --- | --- |
| `professional` | Own profile, documents, assessments, assignments, timesheets, finance, reviews |
| `employer` | Own profile, requirements, shortlists, interviews, assignments, timesheets, finance |
| `admin` | Administration, further restricted by admin role |

Every portal router applies `requireAuth` and `requireRole`. Ownership is checked in queries, not just in the UI.

### 3.2 Administrator permissions

| Admin role | Permissions |
| --- | --- |
| `super_admin` | `*` (all) |
| `finance_officer` | `finance.view`, `finance.reconcile`, `payouts.manage`, `disputes.finance`, `reports.view` |
| `verification_officer` | `users.view`, `verification.review`, `documents.review`, `marketplace.moderate` |
| `recruitment_manager` | `users.view`, `marketplace.view`, `assignments.view`, `interviews.view`, `reports.view` |
| `support` | `users.view`, `support.tickets`, `disputes.view`, `marketplace.view` |

`requireAdminPermission` checks the permission server-side. The client hides unavailable navigation, but the API is the authority. The HTTP smoke test asserts both allowed and denied paths for each seeded admin role.

### 3.3 Verified independence

- A finance officer cannot open verification queues or the administration dashboard.
- A verification officer can view users and review documents but cannot see finance.
- Support can view disputes and users but cannot resolve financial disputes or moderate review challenges.
- A professional calling an admin endpoint receives `403`.

---

## 4. Multi-factor authentication

A dependency-free TOTP implementation is included:

- `POST /auth/mfa/setup` generates a base32 secret and an `otpauth://` URL.
- `POST /auth/mfa/enable` verifies a 6-digit code with a ±1 step window and enables MFA.
- Login returns `mfa_required` and demands a valid code when enabled.
- `POST /auth/mfa/disable` is available to the account holder.

**Enforcement:** `REQUIRE_ADMIN_MFA` defaults to **on** in production when demo mode is off. Every `/api/admin/*` request checks the enrolled state; an administrator without MFA receives `403 mfa_enrollment_required`. The client replaces the admin portal with a blocking enrolment screen. Setup and enable live on `/api/auth/*`, so they remain reachable while the admin API is closed. Enrolment and sign-in events are audited.

Demo and test environments default to enforcement off so seeded accounts remain usable. A production deployment may not disable enforcement unless demo mode is explicitly enabled.

Recommended hardening: store recovery codes hashed, rate-limit TOTP attempts, require re-authentication before disabling MFA, and prefer WebAuthn for administrators.

---

## 5. Authorization on files and records

- Documents are owned by a user or organisation; download endpoints resolve ownership before decrypting.
- A professional cannot download another professional's documents (covered by an automated test).
- Public marketplace responses exclude email, phone and exact contact details.
- Employer contact details are released **only after shortlisting**, and the test suite verifies the gate.
- Admin document access is permission-gated and audit-logged.

---

## 6. File upload and encryption

| Control | Implementation |
| --- | --- |
| Encryption | AES-256-GCM per file, random 12-byte IV, stored auth tag |
| Key derivation | SHA-256 of the configured document key, unwrapped at boot |
| Key source | `DOCUMENT_ENCRYPTION_KEY` from a secret manager, or AWS KMS ciphertext decrypted in memory |
| Storage | Files stored under a dated, UUID-named path; no user-supplied filename is used |
| Allowed types | PDF, JPEG, PNG, WebP |
| Content validation | Magic-byte sniffing; declared MIME must match the detected type |
| Malware scan | clamd INSTREAM scan before encryption; rejects with 422, fails closed with 503 |
| Size limit | 8 MB |
| Blocked extensions | `.exe`, `.js`, `.sh`, `.bat`, `.cmd`, `.html`, `.svg` |
| Metadata | Filename, MIME type, size and review status stored in `documents` |

**Scan order:** declared type → magic bytes → malware scan → encryption → storage. An infected file is never encrypted, never written, and never linked to a document row. Rejections are written to the audit log as `document.scan_rejected`; scanner outages are written as `document.scan_unavailable`.

**Modes.** `MALWARE_SCAN_MODE=clamd` is required in production. `eicar` is a simulation that recognises only the standard antivirus test string; it exists so development, demo and tests can exercise the rejection path without a daemon. `off` skips scanning. The production startup guard rejects both `eicar` and `off`.

**Before production:** deploy the ClamAV sidecar with fresh signatures and an alert when signatures are stale; verify with EICAR; rotate the document key through KMS; store files in encrypted object storage with short-lived signed URLs. The development key must never be used with real documents. Magic-byte validation stops disguised file types but is not a substitute for antivirus scanning.

---

## 7. HTTP hardening

`securityHeaders` sets:

- `Content-Security-Policy`: `default-src 'self'`; scripts self-only; images self/data/blob; styles self plus inline; framing denied; form actions self.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera, microphone and geolocation disabled
- `X-Request-Id` for correlation
- `x-powered-by` disabled

**Before production:** enable HSTS at the reverse proxy, verify CSP against the final asset set, and terminate TLS with a modern configuration.

---

## 8. Input validation and output safety

- Zod schemas validate request bodies and query parameters.
- Pagination is clamped (page ≥ 1, limit 1–100).
- Unknown settings keys are rejected (tested).
- SQL uses parameter binding throughout; no string interpolation of user input.
- React escapes rendered content by default.
- Error responses do not leak stack traces in production; a generic message is returned.
- File types are checked by declared MIME, extension and **magic-byte content sniffing**; a mismatch is rejected.

---

## 9. Audit logging

`audit_logs` records:

- Authentication and MFA events
- Verification and document decisions
- Assessment human-review outcomes
- Payout release and dispute resolutions
- Account status and settings changes
- Privileged document access

Each entry includes actor, actor role, action, entity type and ID, IP, JSON metadata and timestamp. The admin audit view is read-only; entries are not editable through the application.

**Production additions:** append-only storage or WORM export, retention schedule, tamper-evident hashing, and alerting on sensitive actions.

---

## 10. Data protection and privacy

Implemented:

- Data minimisation on public profiles.
- Contact release gated by relationship.
- Login telemetry retention limited to 30 days.
- Session revocation on status change.
- Encrypted document storage.
- Demo data clearly flagged with `is_demo`.

Required before launch:

- A published privacy policy and terms.
- Consent capture for document processing and background checks.
- Data-subject access, correction and deletion procedures.
- A retention schedule per data class.
- A DPDP Act (India) readiness review, including notice, purpose limitation and grievance officer details.
- Data processing agreements with payment, KYC and communication providers.
- Cross-border transfer assessment if any vendor stores data outside India.

---

## 11. Secrets and configuration

| Secret | Current default | Production requirement |
| --- | --- | --- |
| `SECRET_PROVIDER` | `env` | `aws`, `gcp`, `azure`, `vault` or `file`; `env` is rejected in production |
| `DOCUMENT_ENCRYPTION_KEY` | Development string | Random 32+ byte secret loaded from the secret manager |
| `KMS_PROVIDER` | `local` | `aws-kms` with a KMS key and ciphertext for the document key |
| `KMS_KEY_ID` | None | Required when `KMS_PROVIDER=aws-kms` |
| `SECURE_COOKIES` | Off in development | On behind HTTPS |
| `REQUIRE_ADMIN_MFA` | On in production when demo is off | Keep on; no production admin without MFA |
| `MALWARE_SCAN_MODE` | `eicar` outside production | `clamd` |
| `SESSION_TTL_HOURS` | 12 | Reviewed against policy |
| Database | Local file | Managed, encrypted, backed up |
| Payment/KYC keys | None | Stored in a secret manager, never in the repo |

### How secrets are loaded

`server/src/lib/secrets.js` resolves `FLAMINGO_SECRET_NAMES` (default `DOCUMENT_ENCRYPTION_KEY`) from the configured provider and writes them to `process.env` **before** `config.js` is evaluated. `server/src/index.js` performs that await, then imports the app dynamically. A value already in the environment wins, which keeps local overrides predictable.

- **aws** — `@aws-sdk/client-secrets-manager`, `secretsmanager:GetSecretValue`.
- **gcp** — `@google-cloud/secret-manager`, `secretmanager.versions.access`.
- **azure** — `@azure/keyvault-secrets` with `DefaultAzureCredential`.
- **vault** — KV v2 over HTTPS with `VAULT_ADDR`, `VAULT_TOKEN`, `VAULT_MOUNT`, `VAULT_PATH`.
- **file** — a mounted JSON file at `FLAMINGO_SECRETS_FILE`, for Docker or Kubernetes secrets.

Cloud SDKs are optional dependencies, imported only when the provider is selected. A missing SDK fails at boot with an actionable message rather than falling back to defaults.

The repository contains a development encryption key **only** so the demo runs out of the box. It must be replaced before any real document is uploaded, and the production guard refuses to start with it.

---

## 12. Threat model (abbreviated)

| Threat | Control | Residual risk |
| --- | --- | --- |
| Credential stuffing | Rate limits, lockout, generic errors | Distributed attacks need a WAF/bot defence |
| Session theft | HttpOnly, SameSite, Secure in production, short TTL | No device binding; add anomaly detection |
| CSRF | Token header plus SameSite | Low if CSP stays strict |
| Privilege escalation | Server-side role and permission checks, ownership queries | Admin role assignment must be governed |
| Malicious upload | Allowlist, size cap, magic-byte validation, clamd scan before encryption, encryption, blocked extensions | Scanner must be deployed; `eicar` mode is simulated |
| Secret leakage | Managed secret store, KMS-unwrapped document key, no secrets in the repo, boot-time guard | Cloud IAM policy and rotation cadence are operational tasks |
| Admin account takeover | Enforced TOTP MFA for admin API, audited enrolment | No recovery-code or hardware-key flow yet |
| SQL injection | Parameter binding | Low |
| XSS | React escaping plus CSP | Inline styles allowed; review before launch |
| Insider access to documents | Permission gate plus audit | No break-glass workflow yet |
| Payment fraud | Simulated gateway; ledger invariants | Real gateway rules and reconciliation required |
| Data loss | Online backup/restore scripts and documented drill | Scheduling, off-host shipping and quarterly restore practice are operational tasks; no PostgreSQL PITR yet |
| Demo data mistaken for real | `is_demo` flags and UI labels | Operational discipline required |

---

## 13. Incident response (minimum)

1. Revoke affected sessions (`DELETE FROM sessions WHERE user_id = ?`).
2. Suspend the account; this also invalidates sessions.
3. Preserve `audit_logs` and relevant request IDs.
4. Rotate the document encryption key and re-encrypt if documents may be exposed.
5. Notify according to legal and contractual obligations.
6. Record the timeline and remediation.

A formal incident-response plan, on-call rotation and breach-notification matrix are required before launch.

---

## 14. Security checklist summary

| Control | Status |
| --- | --- |
| Password hashing and policy | Implemented |
| Session hardening | Implemented |
| CSRF | Implemented |
| RBAC and least privilege | Implemented |
| MFA (TOTP) | Implemented and enforced for the admin API in production |
| Encrypted documents | Implemented (development key) |
| Upload allowlist, size cap and content sniffing | Implemented |
| Malware scanning | Implemented in code; `clamd` deployment required, `eicar` is simulated |
| Secret manager and KMS unwrapping | Implemented; provider account and IAM policy required |
| Browser end-to-end suite | Implemented (14 Playwright tests) |
| Audit logging | Implemented |
| Security headers and CSP | Implemented |
| Rate limiting | Implemented (in-memory) |
| Backup and restore scripts | Implemented; scheduling and off-host shipping still required |
| Independent penetration test | **Missing** |
| PostgreSQL and managed PITR | **Missing**, plan documented |
| Privacy policy and DPDP review | **Missing** |
| Accessibility audit | **Missing** |

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the go-live gate.
