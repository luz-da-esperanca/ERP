# Operation backups — initial routine (C-09)

This document defines the first database backup routine required by the cycle-1
operational baseline. It covers scheduled logical backups; restore drills, the
paper contingency, and the operations manual belong to a later phase (S6) and
are explicitly out of scope here.

## Requirements traceability

- `RNF-CON-02`: automatic backup at least daily, kept off the main server.
- `RNF-CON-03`: restore tested before the pilot and every 6 months; maximum
  acceptable loss is 24 hours of records.
- `RNF-SEG-06`: backups have the same access control as the source data.
- `RNF-MAN-03`: installation, backup, restore, and user administration are
  documented.

## Running a backup

Prerequisites: the PostgreSQL client tools (`pg_dump`, `pg_restore`) and a
`DATABASE_URL` pointing at the database to back up. The client tools must
match the server major version: an older `pg_dump` cannot back up a newer
server and aborts immediately. CI installs the matching PostgreSQL 17 client
tools from the PostgreSQL Apt repository; see `.github/workflows/quality.yaml`.

```sh
npm run db:backup
```

Environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | (required) | PostgreSQL connection URL; validated, never logged. |
| `BACKUP_DIRECTORY` | `backups` | Output directory, created with mode `0700` when missing. |

Each run writes `erp-backup-<UTC-timestamp>.dump` in custom format
(`--format=custom --no-owner --no-privileges`) and restricts the archive to
mode `0600`. Only the archive path is printed; connection URLs, passwords, and
command arguments never reach the logs. Backup archives are ignored by Git.

## Off-host storage and retention

`RNF-CON-02` requires copies outside the main server. This routine writes to a
local directory; copying archives to separate storage, defining retention, and
documenting responsible operators remain pending institutional decisions
(LAC-10) and must be resolved before the pilot. Do not treat a local archive
as an off-host copy.

## Restore (documented, not rehearsed here)

Restore into an **empty** database, never over production data without an
approved procedure:

```sh
pg_restore --clean --if-exists --dbname='<DATABASE_URL>' erp-backup-<UTC-timestamp>.dump
```

Rehearsing the restore, verifying the 24-hour loss window, and writing the
paper contingency are S6 activities and are not claimed by this routine.

## Verification

- `test/server/backup-database.test.ts` covers naming, arguments, permissions,
  and safe failure messages with an injected command runner.
- `test/server/backup-database.integration.test.ts` runs the published CLI
  against a disposable database, validates the archive with
  `pg_restore --list`, and asserts no credential leaks into process output.
