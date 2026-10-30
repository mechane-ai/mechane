---
name: data-store-ownership
message: Give each owner of persisted data one store module that alone names, parses, reads, and writes it, behind functions named for records and changes.
paths: ["**/*.ts"]
---

## Rules

This contract extends `code-ownership-and-boundaries`, which gives each durable fact one owner, to the code that reads and writes persisted data.
Persisted data is data that code writes and later reads back, in the same process or another one, such as database tables, files in a state directory, and keys in a key-value store.
Inputs that code reads but never writes, such as source files, fixtures, and configuration, are not persisted data.
A configurable storage root, such as a state directory's location or a storage binding, is a setting that the settings module of `code-environment-settings` decodes and the store module receives as an input, so the naming rules below cover what lies beneath that root and not the root's location.
These rules govern product source; tests, fixtures, and smoke checks are outside them, and the lint exempts their paths.

Declare one store module for each owner of persisted data, and mark it by its path, such as a `store` folder or a `store` file.
Name each table, stored file, state directory, and storage key only inside its store module.
Declare each stored file, state directory, and storage key name once in the store module, as a named constant such as `RESULTS_FILE`.
Outside the store module, never write a stored name as a literal, open a stored file, query a table, or read or write a key; call the store module's functions instead.
A report, an audit, or a comparison that reads finished data is outside the store module, and calls the store's read functions, such as `readFinishedResults({ run })`.
Parse each kind of stored record in one function of the store module, and never parse that record anywhere else.

Name each store function that code outside the store module calls for the record it reads or the change it writes, such as `listPendingInvoices()` or `markInvoicePaid({ invoice })`.
Never name such a function only for a storage operation, such as `read`, `write`, `put`, or `execute`.
A function that only the store module calls, such as an append-only line writer, may be named for its storage operation.
So may the one exported store function that runs its caller's store calls in one transaction, such as `runInTransaction`.

Configure the repository's lint or a project script to fail on a declared stored name written as a literal outside its store module, and on a key-value storage call outside it.
Suppress a finding only in the form that `code-lint-suppressions` requires.

Violation: an audit command joins `results.jsonl` onto a run directory and parses each line itself, while the run store writes that file.
Allowed: the run store declares `RESULTS_FILE` once and parses the file in `readFinishedResults({ run })`, which the audit calls.

## Checks

From the repository root, run the repository's checks, and confirm that they fail on a declared stored name written as a literal outside its store module in every declared store path.
For each kind of stored record a change touches, how many modules parse or write it?
Does a change read a file, table, or key that a store module owns without calling that store?
Does each store function that a change exposes to other modules name a record or a change rather than a storage operation?

## Local adaptations

Store modules are the objects' `*-store` members and `store` folders: `packages/worker/directory-store/src` for the directory's tables, `packages/worker/workspace-store/src` for a workspace's mech index, dispatch ledger, machine leases, policy, encrypted credentials and Slack records, `packages/worker/key-cache-store/src` for a key cache shard's cached keys and tombstones, `packages/worker/limiter-store/src` for a limiter's windows, `packages/worker/mech-store/src` for a mech's record, inbox, turns, event log, memory changes, threads, drones and alarm, `packages/worker/sandbox-store/src` for a sandbox's machines, executions and alarm, `packages/node/cli-login/src/store` for the CLI's saved login and key files, and `packages/node/eval/src/store` for an eval run's out folder: its plan, each trial's intents and records, written once through a link, and its report; `packages/worker/store/src` holds the migration ledger every object's store shares; each object's alarm is set only by its store; the smoke and `packages/node/testing/src` are exempt.
pi's own tables in a mech's database carry the prefix `pi_`, and only pi's storage, which the harness opens, reads or writes them.
ast-grep `stored-name-outside-store` rejects, outside its store, a table named in SQL text or a stored file such as `credentials.json`, while a word that only shares a table's name, such as the guest's `machines` segment, stays free; `storage-call-outside-store` rejects a storage call; both skip the smoke and its support, `packages/node/smoke` and `packages/node/testing`, which read stored files to check them; a new table or stored file joins the rule's list in the change that creates it, and the owned check `locks` fails when the list names a table no store creates or misses one a store does.
The CLI's folder name `mechane` stays off that list, since the program's own name shares it.
A fork's copy is the one exception to pi's ownership of its tables: pi's storage exports and imports no Session, and a copy through its commits would renumber the commit sequences its entries and documents keep, so the copy moves each table's rows unread from the parent's store to the new mech's, and pi opens on them only once the copy has ended.
A limiter stores each policy's current window, since Cloudflare drops an idle object's memory after 10 seconds and a deploy drops every object's, so a limit held only in memory would forgive any client that paused.
The key cache holds copies of the directory's rows, which only its fill writes and only the directory decides; a revocation writes the shard's tombstone before the directory's row, so the copy never outlives a revocation.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `storage-call-outside-store` (DO-06): enforced
- ast-grep `stored-name-outside-store` (DO-06): enforced

<!-- End of the generated block. -->
