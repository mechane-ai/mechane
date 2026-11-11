---
name: data-sql-schema-rollouts
message: Preserve existing rows through convergent migrations with one declared writer and an explicit rollout mode.
paths: ["packages/worker/control-store/**", "packages/worker/server/src/**", "packages/worker/runtime/src/**", "packages/worker/sandbox-store/src/**"]
---

## Rules

Declare whether supported application versions overlap during migration.
For a rolling deployment, keep the schema readable and writable by every supported live version until its writer retires.
Use additive changes and bounded backfills before removing a field those versions need.
For an authorized hard cutover, fence admission and positively retire old writers before applying the forward migration.
Preserve retained data and unresolved effects, verify the migrated records, then activate the new writer.
Do not require dual writes or a retired compatibility engine when versions do not overlap.
Recover forward after a narrowing; a code-only rollback to a reader that rejects the new schema is unsupported.

Before adding a constraint or rewriting stored values, count the production rows it would reject or change for each kind of row: nulls, legacy values, duplicates, orphans, and every status.
Record those counts with the change for review.
Handle each kind of row before the statement that would fail on it: fix it, exclude it with a predicate and a comment explaining why, or refuse with an error that names the rows.
Never let a constraint violation be the first report of a kind of row.
Make each data rewrite converge: a second run changes nothing, and rows already in the new shape are left alone.
Match the exact old value in a rewrite, so a value that merely contains it is never changed.

Write bulk data work as a loop that commits each bounded batch and repeats until no rows match, so an interrupted run resumes.
Select only rows the current pass can change, so a batch of rows it cannot fix neither ends the loop early nor repeats forever.
Make every statement that commits before a possible interruption safe to run again.
Keep unbounded rewrites out of deploy-time migrations; use a resumable backfill or a measured maintenance operation.
State in each expensive migration why it is safe to run: batched and convergent, or small enough to run at once, with its measured row count.

Test each migration that constrains or rewrites rows on the production database engine, seeded with each counted kind of row, including rows that must not change.
Run a data rewrite twice in that test and assert that the second run changes nothing.

## Checks

For each migration, verify either compatibility with supported overlapping versions or positive retirement of old writers.
Confirm the change records production counts for each kind of row a new constraint or rewrite could reject or change.
Run each constraining or rewriting migration on the production database engine with every counted kind of row seeded.
Interrupt a batched migration partway and rerun it; confirm it resumes and converges.
Review each bulk statement for a batched convergent loop or a stated measured row count.

## Local adaptations

The November 11, 2026 local policy replaces mandatory previous-release overlap with the explicit rollout modes above.
Preserve Postgres identity, authority, credentials, accounting, source history, and sandbox files through either mode.
Keep applied migration identifiers and checksums unchanged. An older migrator refuses a newer ledger rather than
modifying it. Serving readers validate their supported schema and checksum prefix.

Historical imports use a consistent read-only source and bounded idempotent writes. Imported events remain evidence;
they cannot replay commands, approvals, or publication, activate an agent, or override a maintenance hold. Keep any
still-required import procedure with its owning operator command; completed cutovers do not constrain later releases.

Run schema changes with a dedicated migration connection. The runtime connection receives only the permissions its
control tables require. Preserve retained platform history when removing its runtime adapter. Record exact upstream
versions in the release.

The isolated sandbox service retains its own SQLite schema ledger and persistent file checkpoints. A service restart
must not replay a completed command or publish a checkpoint after cancellation. Destructive sandbox changes require
an explicit data decision; the agent-store reset does not authorize deletion of unrelated persisted resources.

Qualify constrained or rewritten rows against the production database engine. Repeating initial setup must leave the
schema unchanged. A future narrowing needs both affected-row evidence and recovery evidence for affected live owners.
Read migrated records through their authenticated product HTTP route and response codec before release. SQL row counts
alone do not establish that stored identifiers, timestamps, text, and structured output remain readable. Include unchanged
records and a repeated migration in that check.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
