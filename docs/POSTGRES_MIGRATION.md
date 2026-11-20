# PostgreSQL migration plan

**Status:** planned, **not implemented**. The shipped application still runs on SQLite (`node:sqlite`). Do not claim PostgreSQL support, horizontal scaling or managed-database readiness until every acceptance check in this document has been completed against a real PostgreSQL instance.

---

## 1. Why migrate

The current single-file SQLite design is appropriate for a pilot and a single API process. It becomes a constraint for:

- multiple API instances behind a load balancer;
- managed point-in-time recovery and read replicas;
- long-running analytical queries without blocking writes;
- provider-managed encryption, patching and failover;
- higher write concurrency around payments, payouts and audit events.

SQLite is not being removed from local development. The target is a database adapter with two tested drivers: SQLite for local/test and PostgreSQL for staging/production.

---

## 2. Current coupling

`server/src/db.js` opens `DatabaseSync` and exports synchronous helpers:

```js
all(sql, ...params)
one(sql, ...params)
run(sql, ...params)
insert(table, data)
update(table, id, data)
transaction(fn)
```

Every route calls these synchronously. `node-postgres` is asynchronous. This is the main cost of the migration: the data layer and every route that touches it must become `async`.

Other assumptions to review:

| Area | Current assumption | PostgreSQL change |
| --- | --- | --- |
| Booleans | `INTEGER` 0/1 | `BOOLEAN` with driver conversion |
| Timestamps | ISO-8601 `TEXT` | `TIMESTAMPTZ` or retained ISO text during transition |
| JSON fields | `TEXT` containing JSON | `JSONB` optional; text remains acceptable initially |
| Case-insensitive email | `COLLATE NOCASE` | `citext` extension or `lower(email)` unique index |
| Auto IDs | Application-generated `TEXT` IDs | No change; keep application IDs |
| `INSERT OR IGNORE` / `OR REPLACE` | SQLite syntax | `ON CONFLICT DO NOTHING` / `ON CONFLICT DO UPDATE` |
| `PRAGMA` statements | SQLite-only | Remove from the PostgreSQL path |
| `VACUUM INTO` | Online backup | Replace with `pg_dump` / managed PITR |
| `last_insert_rowid()` | Not relied on; IDs are generated | No change |

A repository-wide search for SQLite-specific SQL must be part of the first migration PR.

---

## 3. Phased delivery

### Phase 0 — Baseline and freeze

1. Tag the SQLite release used for the pilot.
2. Record row counts and financial checksums for every table.
3. Export the current schema and keep `schema.sql` as the SQLite baseline.
4. Add a migration log table with a single applied version.

**Exit:** a reproducible SQLite backup exists and the reference ₹20,000 → ₹19,301 rows are checksummed.

### Phase 1 — Introduce the adapter (no behaviour change)

1. Define a database interface: `all`, `one`, `run`, `insert`, `update`, `transaction`.
2. Keep the existing SQLite implementation behind that interface.
3. Convert `db.js` consumers to `await` the interface. This is mechanical but touches most routes and tests.
4. Add adapter contract tests that run the same operations against both drivers.

**Exit:** the full test suite and smoke test pass on SQLite with the async interface.

### Phase 2 — PostgreSQL schema and migrations

1. Add numbered migrations under `server/migrations/postgres/`.
2. Translate types, constraints and indexes. Preserve every `CHECK` constraint.
3. Use `citext` or a `lower(email)` unique index for email uniqueness.
4. Keep money as `BIGINT` paise. Never use `NUMERIC` for internal arithmetic.
5. Keep application-generated IDs and ISO timestamps during the first cutover; optimise types later.
6. Create a non-demo administrator with a controlled provisioning script. Never run `npm run seed` against PostgreSQL production.

**Exit:** migrations apply cleanly to an empty database and roll forward from the previous version.

### Phase 3 — Local and CI verification

1. Run PostgreSQL in Docker or a disposable CI service.
2. Run the full Vitest suite, the HTTP smoke test and the finance reconciliation tests against PostgreSQL.
3. Add concurrency tests for timesheet submission, advance capture and payout approval.
4. Test transaction rollback on a forced constraint violation.
5. Test session expiry and CSRF under two API processes sharing one database.

**Exit:** the same checks pass on SQLite and PostgreSQL; no route still assumes synchronous database access.

### Phase 4 — Data migration and cutover

1. Put the application in maintenance mode; stop writes.
2. Take a final SQLite backup with `npm run backup`.
3. Run an ETL script in one transaction:
   - copy tables in foreign-key order;
   - preserve IDs and timestamps;
   - reset sequences only if serial columns are introduced;
   - record source and destination row counts;
   - compare financial checksums.
4. Verify encrypted documents are unchanged. The database stores storage keys and IV/tag values; the encryption key does not move.
5. Start the API against PostgreSQL and run read-only smoke checks.
6. Re-enable writes only after reconciliation passes.

**Exit:** row counts and financial totals match; login, document download, timesheet and payout read paths work.

### Phase 5 — Backups, restore and operations

1. Use managed automated backups with point-in-time recovery.
2. Add a nightly `pg_dump --format=custom` export to encrypted off-host storage.
3. Test a restore into a separate instance monthly for the first quarter, then quarterly.
4. Document RPO and RTO. The current SQLite scripts are not a substitute for this.
5. Add connection-pool sizing, statement timeouts and slow-query logging.
6. Add database metrics and alerts before enabling real money.

**Exit:** a timed restore drill meets the agreed RPO/RTO.

### Phase 6 — Scale-out

Only after Phases 0–5:

1. Move rate limiting to Redis.
2. Move encrypted documents to object storage with short-lived signed URLs.
3. Run multiple stateless API instances behind the load balancer.
4. Move notification and payout batches to a job queue.

---

## 4. Acceptance checklist

- [ ] Async database interface used by every route.
- [ ] Full test suite passes against PostgreSQL.
- [ ] HTTP smoke test passes against PostgreSQL.
- [ ] Financial checksums match after ETL.
- [ ] Row counts match after ETL.
- [ ] Concurrent timesheet and payout tests pass.
- [ ] Document download works with the original encryption key.
- [ ] Backup and restore drill completed on PostgreSQL.
- [ ] Rollback to the tagged SQLite release rehearsed.
- [ ] No `PRAGMA`, `INSERT OR IGNORE` or SQLite-only SQL remains on the PostgreSQL path.
- [ ] Production administrator provisioned without demo data.
- [ ] Connection pool, timeouts and monitoring configured.

Until this checklist is complete, the only supported deployment is the single-instance SQLite deployment described in [DEPLOYMENT.md](DEPLOYMENT.md).
