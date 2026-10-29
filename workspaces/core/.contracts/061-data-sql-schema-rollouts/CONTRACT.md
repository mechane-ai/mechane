---
name: data-sql-schema-rollouts
message: Ship schema changes that the previous release and existing rows survive, in batches an interrupted deploy resumes.
paths: ["packages/worker/*-store/src/migrations.ts", "packages/worker/store/src/**", "packages/worker/app/wrangler.jsonc"]
---

## Rules

Write every migration for the previous release running against the new schema, during the rollout and after a code rollback.
Ship a migration in the same deploy as the code that uses it only when it is additive: a nullable or defaulted column, a new table, or a new non-unique index.
Do not drop, rename, or narrow a column, table, or type that the previous release reads or writes.
Do not add a `NOT NULL` column without a default while the previous release can insert rows without it.
Set `NOT NULL` only after every running release writes the column and a backfill has filled the existing rows.
Land a destructive change in a later deploy than the code that stopped depending on the old shape.
Rename by expand and contract: add the new column, write both, backfill, switch reads, and drop the old column in a later deploy.

Before adding a constraint or rewriting stored values, count the production rows it would reject or change for each kind of row: nulls, legacy values, duplicates, orphans, and every status.
Record those counts with the change for review.
Handle each kind of row before the statement that would fail on it: fix it, exclude it with a predicate and a comment explaining why, or refuse with an error that names the rows.
Never let a constraint violation be the first report of a kind of row.
Make each data rewrite converge: a second run changes nothing, and rows already in the new shape are left alone.
Match the exact old value in a rewrite, so a value that merely contains it is never changed.

Write bulk data work as a loop that commits each bounded batch and repeats until no rows match, so an interrupted run resumes.
Select only rows the current pass can change, so a batch of rows it cannot fix neither ends the loop early nor repeats forever.
Make every statement that commits before a possible interruption safe to run again.
Keep a statement that cannot be batched, such as one that rewrites a whole table, out of deploy-time migrations, and replace it with a new structure filled by a batched backfill across deploys.
State in each expensive migration why it is safe to run: batched and convergent, or small enough to run at once, with its measured row count.

Test each migration that constrains or rewrites rows on the production database engine, seeded with each counted kind of row, including rows that must not change.
Run a data rewrite twice in that test and assert that the second run changes nothing.

## Checks

For each added migration, ask whether the previous release reads or writes anything it drops, renames, narrows, or makes required.
Confirm the change records production counts for each kind of row a new constraint or rewrite could reject or change.
Run each constraining or rewriting migration on the production database engine with every counted kind of row seeded.
Interrupt a batched migration partway and rerun it; confirm it resumes and converges.
Review each bulk statement for a batched convergent loop or a stated measured row count.

## Local adaptations

Each Durable Object keeps its own SQLite database, and a store's `MIGRATIONS`, in its `*-store` member's `src/migrations.ts`, are its schema steps.
`openDatabase` in `packages/worker/store/src` runs the steps its `schema_migrations` ledger lacks in one transaction as the object starts, so an interrupted start rolls back whole and the next start reruns every missing step.
A Wrangler migration in `packages/worker/app/wrangler.jsonc` adds a class; `deleted_classes` destroys a class's objects, so it lands only in a deploy after the one whose code stopped using the class.
The previous release never reads a newer schema: an object runs one release at a time, and `deploy:rollback` refuses a version whose migrations differ from production's, so a release with a wrong step rolls forward.
The service has deployed databases, and their existing rows must survive each added step. The name freeze preceded the first deploy and renamed tables and columns only inside steps that no deployment had applied.
`lint/migrations.json` refuses an edit to a locked step, and tables and columns are append-only, as `data-stored-and-shipped-formats` records.
Keep a step's private guard limits and schemas inside its callback: the lock hashes the callback's source, not the contents of imported helpers, so moving a guard outside it would let a later helper edit silently change a locked step. A direct named numeric `const` may hold one literal there under `code-numeric-literals`; the migration file still holds only imports and `MIGRATIONS`.
Each table's first step states which nullable columns are written together, and in what order, as CHECKs that name no member of a closed set, so a new status needs no rebuild; a later step cannot add a table CHECK, so a new column carries a column CHECK naming the columns it pairs with.
A step runs inside one object's start and cannot commit in batches, so a rewrite covers only that object's rows and states the measured row count of the largest object it runs in.
Open: no operator query counts rows across objects, and the smoke opens every store empty, so no step has run against seeded rows; the first step that constrains or rewrites deployed rows needs both.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
