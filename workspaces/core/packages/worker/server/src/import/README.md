# Preserved-history import

`import.mjs` moves preserved Postgres history into its mech actor once, without starting an agent or replaying an old
tool call. The Node command uses the migration database role. The Worker never receives that migration role or its
database URL; its runtime database credentials remain separate.

```sh
node import.mjs --dry-run --all
node import.mjs --apply --all --expect-digest SOURCE_SHA256 --retirement-receipt RETIREMENT.json --retirement-sha256 RETIREMENT_SHA256
```

Use `--workspace UUID` instead of `--all` to select one workspace. Add `--mech UUID` to select one mech within it.
`--apply` replaces `--dry-run` and requires the digest from the same selection's reviewed dry-run.

Set `MECHANE_MIGRATION_DATABASE_URL` for both modes. Apply also requires `MECHANE_ORIGIN` and
`MECHANE_SANDBOX_SERVICE_KEY`. Keep these in the operator environment. The command prints counts and digests, never
source context, receipt contents, database URLs, or credentials.

Suspend each source workspace before exporting it. The source reader takes a consistent read-only snapshot, and apply
checks the suspension again before every batch. The reviewed retirement receipt must establish that the old execution
owner is positively retired. This command verifies the receipt's exact bytes against its supplied digest; row status and
a successful file hash cannot establish process retirement.

Fence integration delivery at the Worker while retaining producers' durable outboxes, and keep direct member submissions
quiet. Quiesce each fresh target through the authenticated maintenance operation before its first import batch.
Workspace suspension alone still permits notification intake. The first import refuses a target containing native
records; preserve that data and resolve the fence instead of deleting records or merging histories. Keep intake fenced
through every batch, then verify all selected scopes before restoring delivery and execution.

The retirement receipt is a JSON object containing the reviewed retirement evidence. Its optional
`environmentCompletions` array contains complete scoped `SandboxCompletion` records read from the authoritative
environment service. Omit the array or use `[]` when there are no receipts to preserve. Each record must include its
original `workspaceId`, `mechId`, `executionId`, `kind`, `machineId`, `status`, and `exitCode`; nullable fields stay
null. The importer rejects duplicate execution identities and receipts outside the selected scopes. It appends these
inert archives to each scope's final batch, including completions without a historical run or Postgres execution
receipt. Other evidence fields remain covered by the receipt's exact file hash. All enriched batches are validated and
prepared before delivery; an archive that exceeds the existing batch bound fails without sending any batch.

The target actor must admit the import under its empty/quiescent guard. The first batch stores historical context and
its checkpoint-required flag. Historical runs, private events, publications, notifications, receipts, memories, and work
items retain their identifiers and provenance. Pending input is retained for later activation. Final import acceptance
keeps the target inactive; activation is a separate operator action.

Each authenticated batch has a stable request identity, a source digest, and a predecessor cursor. If an acknowledgment
is lost, rerun the same reviewed command. Changed input under an existing identity is rejected. Private temporary batch
files are removed after normal completion or a handled failure. A single record above the batch bound fails during
preparation, before any target delivery; content is never truncated to fit.

Standard output is one JSON object with `version`, `mode`, aggregate `digest`, per-scope `sourceDigest`, `batches`,
`sourceBytes`, and record `counts`. `retirementEvidenceSha256` is null for dry-run and records the reviewed evidence
hash after apply. Errors use standard error and a failing exit status. The canonical transport schemas live in
[`@mechane/protocol`](../../../../shared/protocol/src/import/schemas.ts).
